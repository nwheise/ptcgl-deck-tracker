'use strict';

/**
 * inference.js — Main process ML inference pipeline
 *
 * Implements the full YOLO + MobileNetV4 + nearest-neighbor matching pipeline.
 * Runs exclusively in Electron's main process (Node.js context) so it can use
 * onnxruntime-node and sharp (both require native bindings).
 *
 * Pipeline:
 *   raw frame pixels (RGBA)
 *     → YOLO preprocessing (640×640, [0,1], channel-first)
 *     → YOLO ONNX inference
 *     → parse + filter detections (confidence > 0.25, scale to frame coords)
 *     → per-detection crop extraction (with energy/item masking for card classes)
 *     → MobileNetV4 preprocessing (resize width→224, top-crop 224×224)
 *     → MobileNetV4 ONNX inference (1280-dim embedding)
 *     → L2-normalize + cosine similarity against reference embeddings
 *     → class-filtered top-1 match per detection
 */

const path = require('path');
const fs = require('fs');
const ort = require('onnxruntime-node');
const sharp = require('sharp');

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_DIR = path.join(__dirname, 'pipeline');
const YOLO_CONF_THRESHOLD = 0.25;
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD  = [0.229, 0.224, 0.225];
const EMBEDDING_DIM = 1280;

// Class IDs matching the YOLO model export
const CLASS_ATTACHED_ENERGY = 0;
const CLASS_ATTACHED_ITEM   = 1;
const CLASS_CARD            = 2;
const CLASS_MULTICARD       = 3;

// Supertype / subtype strings from the card metadata
const SUPERTYPE_ENERGY  = 'Energy';
const SUBTYPE_POKE_TOOL = 'Pokémon Tool';

// ─── Module-level state ───────────────────────────────────────────────────────

let yoloSession       = null;
let embedSession      = null;
let refEmbeddings     = null; // Float32Array, shape [N, 1280]
let refCardIds        = null; // string[], length N
let energyMask        = null; // Uint8Array, length N — 1 if card is Energy
let toolMask          = null; // Uint8Array, length N — 1 if card is Pokémon Tool
let modelsLoaded      = false;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load all models and reference data from the pipeline/ directory.
 * Safe to call multiple times (no-op if already loaded).
 */
async function loadModels() {
  if (modelsLoaded) return;

  // Discover files in pipeline/
  const files = fs.readdirSync(PIPELINE_DIR);

  const findFile = (predicate, label) => {
    const f = files.find(predicate);
    if (!f) throw new Error(`Cannot find ${label} in ${PIPELINE_DIR}. Run: npm run fetch-pipeline`);
    return path.join(PIPELINE_DIR, f);
  };

  const yoloOnnxPath  = findFile(f => f.includes('yolo') && f.endsWith('.onnx'), 'YOLO ONNX model');
  const embedOnnxPath = findFile(f => (f.includes('mobilenet') || f.includes('embed')) && f.endsWith('.onnx') && !f.includes('yolo'), 'MobileNetV4 ONNX model');
  const embNpzPath    = findFile(f => f.endsWith('.npz'), 'reference embeddings NPZ');
  const metaJsonPath  = findFile(f => f.endsWith('.json') && f.includes('meta'), 'metadata JSON');
  // Load ONNX sessions
  [yoloSession, embedSession] = await Promise.all([
    ort.InferenceSession.create(yoloOnnxPath),
    ort.InferenceSession.create(embedOnnxPath),
  ]);

  // Load reference embeddings from NPZ
  const npzBuf = fs.readFileSync(embNpzPath);
  const npzData = await parseNpzFile(npzBuf);
  refEmbeddings = new Float32Array(npzData.embeddings.data);
  // card_ids may be a string array (pickled object) or typed array
  refCardIds = Array.isArray(npzData.card_ids.data)
    ? npzData.card_ids.data
    : Array.from(npzData.card_ids.data).map(String);

  // Load metadata for class filtering
  const meta = JSON.parse(fs.readFileSync(metaJsonPath, 'utf8'));
  const N = refCardIds.length;
  energyMask = new Uint8Array(N);
  toolMask   = new Uint8Array(N);

  for (let i = 0; i < N; i++) {
    const info = meta[refCardIds[i]];
    if (!info) continue;
    if (info.supertype === SUPERTYPE_ENERGY) energyMask[i] = 1;
    if (Array.isArray(info.subtypes) && info.subtypes.includes(SUBTYPE_POKE_TOOL)) toolMask[i] = 1;
  }

  modelsLoaded = true;
  console.log(`[inference] Models loaded. ${N} reference embeddings.`);
}

/**
 * Run the full inference pipeline on a raw RGBA frame.
 *
 * @param {Buffer}  rawPixels  RGBA pixel data, row-major
 * @param {number}  width      Frame width in pixels
 * @param {number}  height     Frame height in pixels
 * @returns {Promise<Array<{box, confidence, className, cardId, cardName, similarity}>>}
 */
async function runInference(rawPixels, width, height) {
  if (!modelsLoaded) await loadModels();

  // ── Stage 1: YOLO inference ──────────────────────────────────────────────
  const yoloTensor = await preprocessYolo(rawPixels, width, height);
  const yoloFeeds  = { [yoloSession.inputNames[0]]: yoloTensor };
  const yoloOut    = await yoloSession.run(yoloFeeds);
  const detections = parseYoloOutput(yoloOut[yoloSession.outputNames[0]], width, height);

  if (detections.length === 0) return [];

  // ── Stage 2: Per-detection embedding + matching ───────────────────────────
  // Build a sharp pipeline from the original frame (RGB)
  const rgbBuf   = rgbaToRgb(rawPixels, width, height);
  const sharpImg = sharp(rgbBuf, { raw: { width, height, channels: 3 } });

  const results = [];
  for (const det of detections) {
    try {
      const cropBuf  = await cropDetection(sharpImg, det, detections);
      const cropW    = det.x2 - det.x1;
      const cropH    = det.y2 - det.y1;
      const embTensor = await preprocessEmbedding(cropBuf, cropW, cropH);
      const match    = await embedAndMatch(embTensor, det.classId);

      results.push({
        box:        { x1: det.x1, y1: det.y1, x2: det.x2, y2: det.y2 },
        confidence: det.confidence,
        className:  classIdToName(det.classId),
        cardId:     match.cardId,
        cardName:   match.cardName,
        similarity: match.similarity,
      });
    } catch (err) {
      console.warn('[inference] Detection skipped:', err.message);
    }
  }

  return results;
}

// ─── Preprocessing: YOLO ─────────────────────────────────────────────────────

async function preprocessYolo(rawPixels, width, height) {
  const rgbBuf = rgbaToRgb(rawPixels, width, height);

  // Resize to 640×640 bilinear, channel-first
  const resized = await sharp(rgbBuf, { raw: { width, height, channels: 3 } })
    .resize(640, 640, { fit: 'fill', kernel: 'linear' })
    .raw()
    .toBuffer();

  // Normalize to [0,1] and arrange as [1, 3, 640, 640]
  const tensor = hwcToChw(resized, 640, 640, 3);
  for (let i = 0; i < tensor.length; i++) tensor[i] /= 255.0;

  return new ort.Tensor('float32', tensor, [1, 3, 640, 640]);
}

// ─── Post-processing: YOLO ───────────────────────────────────────────────────

function parseYoloOutput(outputTensor, origWidth, origHeight) {
  // Output shape: [1, 300, 6] — each row: [x1, y1, x2, y2, confidence, class_id]
  const data   = outputTensor.data;
  const scaleX = origWidth  / 640;
  const scaleY = origHeight / 640;
  const results = [];

  for (let i = 0; i < 300; i++) {
    const base = i * 6;
    const conf = data[base + 4];
    if (conf <= YOLO_CONF_THRESHOLD) continue;

    const classId = Math.round(data[base + 5]);
    results.push({
      x1:         Math.round(data[base + 0] * scaleX),
      y1:         Math.round(data[base + 1] * scaleY),
      x2:         Math.round(data[base + 2] * scaleX),
      y2:         Math.round(data[base + 3] * scaleY),
      confidence: conf,
      classId,
    });
  }

  return results;
}

// ─── Crop extraction ─────────────────────────────────────────────────────────

/**
 * Extract a detection crop from the original RGB frame.
 * For card/multicard classes, masks overlapping energy/item boxes with mean color.
 */
async function cropDetection(sharpImg, det, allBoxes) {
  const { x1, y1, x2, y2, classId } = det;
  const cropW = Math.max(1, x2 - x1);
  const cropH = Math.max(1, y2 - y1);

  // Extract the raw crop
  const cropBuf = await sharpImg
    .clone()
    .extract({ left: x1, top: y1, width: cropW, height: cropH })
    .raw()
    .toBuffer();

  // Only mask for card and multicard classes
  if (classId !== CLASS_CARD && classId !== CLASS_MULTICARD) {
    return cropBuf;
  }

  // Find overlapping class 0/1 boxes
  const overlapping = allBoxes.filter(b => {
    if (b.classId !== CLASS_ATTACHED_ENERGY && b.classId !== CLASS_ATTACHED_ITEM) return false;
    // Check overlap with det box
    return b.x1 < x2 && b.x2 > x1 && b.y1 < y2 && b.y2 > y1;
  });

  if (overlapping.length === 0) return cropBuf;

  // Compute mean color of non-masked pixels first
  const maskRegions = overlapping.map(b => ({
    left:   Math.max(0, b.x1 - x1),
    top:    Math.max(0, b.y1 - y1),
    right:  Math.min(cropW, b.x2 - x1),
    bottom: Math.min(cropH, b.y2 - y1),
  }));

  // Expand each region by 10% halo
  const haloRegions = maskRegions.map(r => {
    const hw = Math.round((r.right - r.left) * 0.10);
    const hh = Math.round((r.bottom - r.top) * 0.10);
    return {
      left:   Math.max(0, r.left - hw),
      top:    Math.max(0, r.top - hh),
      right:  Math.min(cropW, r.right + hw),
      bottom: Math.min(cropH, r.bottom + hh),
    };
  });

  // Compute mean RGB of non-masked area
  const pixels  = Buffer.from(cropBuf);
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let py = 0; py < cropH; py++) {
    for (let px = 0; px < cropW; px++) {
      const masked = haloRegions.some(r => px >= r.left && px < r.right && py >= r.top && py < r.bottom);
      if (!masked) {
        const off = (py * cropW + px) * 3;
        sumR += pixels[off];
        sumG += pixels[off + 1];
        sumB += pixels[off + 2];
        count++;
      }
    }
  }

  const meanR = count > 0 ? Math.round(sumR / count) : 127;
  const meanG = count > 0 ? Math.round(sumG / count) : 127;
  const meanB = count > 0 ? Math.round(sumB / count) : 127;

  // Fill masked regions with mean color
  const out = Buffer.from(cropBuf);
  for (const r of haloRegions) {
    for (let py = r.top; py < r.bottom; py++) {
      for (let px = r.left; px < r.right; px++) {
        const off = (py * cropW + px) * 3;
        out[off]     = meanR;
        out[off + 1] = meanG;
        out[off + 2] = meanB;
      }
    }
  }

  return out;
}

// ─── Preprocessing: MobileNetV4 ───────────────────────────────────────────────

/**
 * Prepare a crop buffer for MobileNetV4:
 *   - Resize width → 224, preserve aspect ratio (bilinear)
 *   - Top-crop to 224×224 (take top 224 rows)
 *   - ImageNet normalize per channel
 *   - Channel-first Float32Array [1, 3, 224, 224]
 */
async function preprocessEmbedding(cropBuf, cropW, cropH) {
  // Determine resize dimensions: scale width to 224, maintain aspect ratio
  const scale     = 224 / cropW;
  const newWidth  = 224;
  // Use Math.round to match Python's round() in torchvision resize
  const newHeight = Math.max(1, Math.round(cropH * scale));

  let pipeline = sharp(cropBuf, { raw: { width: cropW, height: cropH, channels: 3 } })
    .resize(newWidth, newHeight, { fit: 'fill', kernel: 'linear' });

  if (newHeight >= 224) {
    // Normal case: top-crop to 224×224 (take top 224 rows)
    pipeline = pipeline.extract({ left: 0, top: 0, width: 224, height: 224 });
  } else {
    // Edge case: height < 224 after resize. Pad bottom with black to reach 224.
    pipeline = pipeline.extend({
      top: 0, bottom: 224 - newHeight,
      left: 0, right: 0,
      background: { r: 0, g: 0, b: 0 },
    });
  }

  const resized = await pipeline.raw().toBuffer();

  // Normalize and convert to channel-first Float32Array
  const tensor = new Float32Array(1 * 3 * 224 * 224);
  const numPx  = 224 * 224;
  for (let px = 0; px < numPx; px++) {
    const base = px * 3;
    for (let c = 0; c < 3; c++) {
      tensor[c * numPx + px] = (resized[base + c] / 255.0 - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
    }
  }

  return new ort.Tensor('float32', tensor, [1, 3, 224, 224]);
}

// ─── Embedding + matching ─────────────────────────────────────────────────────

async function embedAndMatch(embTensor, classId) {
  const feeds = { [embedSession.inputNames[0]]: embTensor };
  const out   = await embedSession.run(feeds);
  const raw   = out[embedSession.outputNames[0]].data; // Float32Array, length 1280

  // L2-normalize
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += raw[i] * raw[i];
  norm = Math.sqrt(norm);
  const emb = new Float32Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) emb[i] = raw[i] / norm;

  // Select mask for class filtering
  const mask = classId === CLASS_ATTACHED_ENERGY ? energyMask
             : classId === CLASS_ATTACHED_ITEM   ? toolMask
             : null; // class 2/3: all cards

  // Dot-product cosine similarity against reference embeddings
  const N = refCardIds.length;
  let bestIdx  = -1;
  let bestSim  = -Infinity;

  for (let i = 0; i < N; i++) {
    if (mask !== null && mask[i] === 0) continue;
    let dot = 0;
    const base = i * EMBEDDING_DIM;
    for (let d = 0; d < EMBEDDING_DIM; d++) dot += emb[d] * refEmbeddings[base + d];
    if (dot > bestSim) {
      bestSim = dot;
      bestIdx  = i;
    }
  }

  if (bestIdx === -1) {
    // Fallback: no valid card (empty mask), match all
    for (let i = 0; i < N; i++) {
      let dot = 0;
      const base = i * EMBEDDING_DIM;
      for (let d = 0; d < EMBEDDING_DIM; d++) dot += emb[d] * refEmbeddings[base + d];
      if (dot > bestSim) { bestSim = dot; bestIdx = i; }
    }
  }

  return {
    cardId:     refCardIds[bestIdx] ?? 'unknown',
    cardName:   refCardIds[bestIdx] ?? 'unknown',
    similarity: bestSim,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rgbaToRgb(rgbaBuf, width, height) {
  const numPx  = width * height;
  const out    = Buffer.allocUnsafe(numPx * 3);
  for (let i = 0; i < numPx; i++) {
    out[i * 3]     = rgbaBuf[i * 4];
    out[i * 3 + 1] = rgbaBuf[i * 4 + 1];
    out[i * 3 + 2] = rgbaBuf[i * 4 + 2];
  }
  return out;
}

/**
 * Convert HWC (row-major, interleaved) RGB buffer to CHW (channel-first) Float32Array.
 */
function hwcToChw(buf, w, h, c) {
  const numPx = w * h;
  const out   = new Float32Array(c * numPx);
  for (let px = 0; px < numPx; px++) {
    for (let ch = 0; ch < c; ch++) {
      out[ch * numPx + px] = buf[px * c + ch];
    }
  }
  return out;
}

function classIdToName(classId) {
  return ['attached-energy', 'attached-item', 'card', 'multicard'][classId] ?? 'unknown';
}

/**
 * Parse an NPZ buffer into an object of { arrayName: { data, dtype, shape } }.
 */
async function parseNpzFile(buf) {
  const { parseNpzBuffer } = require('./npz-utils');
  return parseNpzBuffer(buf);
}

module.exports = { loadModels, runInference, preprocessYolo, parseYoloOutput, preprocessEmbedding, embedAndMatch };
