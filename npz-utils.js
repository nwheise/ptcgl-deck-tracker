'use strict';

/**
 * npz-utils.js — NPZ loader that combines ZIP extraction with npyjs for NPY parsing.
 *
 * NPZ is simply a ZIP archive of .npy files. We extract the ZIP entries ourselves
 * (Node.js zlib handles deflate) and delegate NPY parsing to the npyjs package.
 *
 * The one exception is Unicode string arrays (<U{N} dtype), which npyjs doesn't
 * support. We handle those inline since the format is straightforward.
 */

const zlib = require('zlib');
const NpyJs = require('npyjs').default;

/**
 * Parse an NPZ buffer and return an object keyed by array name.
 *
 * @param {Buffer} buf  Raw NPZ file bytes
 * @returns {Promise<Object>}  { arrayName: { data: TypedArray|string[], dtype, shape } }
 */
async function parseNpzBuffer(buf) {
  const entries = extractZipEntries(buf);
  const npyjs  = new NpyJs();
  const result  = {};

  for (const [filename, data] of Object.entries(entries)) {
    const name = filename.replace(/\.npy$/, '');

    // Peek at the NPY header to check for Unicode string dtype
    const dtype = peekNpyDtype(data);
    const unicodeMatch = dtype.match(/^[<>=|]U(\d+)$/);

    if (unicodeMatch) {
      result[name] = parseUnicodeStringArray(data, unicodeMatch);
    } else {
      // npyjs needs a properly aligned ArrayBuffer, not a Buffer subarray view
      const ab = new ArrayBuffer(data.length);
      new Uint8Array(ab).set(data);
      result[name] = await npyjs.load(ab);
    }
  }

  return result;
}

/**
 * Read just the dtype string from an NPY header without fully parsing it.
 */
function peekNpyDtype(buf) {
  if (buf[0] !== 0x93 || buf.toString('ascii', 1, 6) !== 'NUMPY') {
    throw new Error('Not a valid NPY file');
  }
  const majorVersion = buf[6];
  const headerOffset = majorVersion === 1 ? 10 : 12;
  const headerLen = majorVersion === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
  const headerStr = buf.toString('ascii', headerOffset, headerOffset + headerLen);
  const match = headerStr.match(/'descr'\s*:\s*'([^']+)'/);
  return match ? match[1] : '';
}

/**
 * Parse a Unicode string NPY array (<U{N} dtype).
 * Each element is N UTF-32LE code points (4 bytes each), null-padded.
 */
function parseUnicodeStringArray(buf, unicodeMatch) {
  const majorVersion = buf[6];
  const headerOffset = majorVersion === 1 ? 10 : 12;
  const headerLen = majorVersion === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
  const headerStr = buf.toString('ascii', headerOffset, headerOffset + headerLen);
  const dataOffset = headerOffset + headerLen;

  const shape = headerStr.match(/'shape'\s*:\s*\(([^)]*)\)/);
  const dims = shape[1].split(',').map(s => s.trim()).filter(Boolean).map(Number);

  const maxChars   = parseInt(unicodeMatch[1], 10);
  const bytesPerEl = maxChars * 4;
  const totalEls   = dims.reduce((a, b) => a * b, 1);
  const rawData    = buf.subarray(dataOffset);
  const strings    = [];

  for (let i = 0; i < totalEls; i++) {
    const start = i * bytesPerEl;
    let str = '';
    for (let j = 0; j < maxChars; j++) {
      const cp = rawData.readUInt32LE(start + j * 4);
      if (cp === 0) break;
      str += String.fromCodePoint(cp);
    }
    strings.push(str);
  }

  return { data: strings, dtype: unicodeMatch[0], shape: dims };
}

/**
 * Extract entries from a ZIP buffer by reading the central directory.
 */
function extractZipEntries(buf) {
  const entries = {};

  // Find End of Central Directory record (signature 0x06054b50)
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Not a valid ZIP file (no EOCD)');

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdSize   = buf.readUInt32LE(eocdOffset + 12);
  let pos = cdOffset;

  while (pos < cdOffset + cdSize) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;

    const compressionMethod = buf.readUInt16LE(pos + 10);
    const compressedSize    = buf.readUInt32LE(pos + 20);
    const uncompressedSize  = buf.readUInt32LE(pos + 24);
    const nameLen           = buf.readUInt16LE(pos + 28);
    const extraLen          = buf.readUInt16LE(pos + 30);
    const commentLen        = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const filename          = buf.toString('utf8', pos + 46, pos + 46 + nameLen);

    pos += 46 + nameLen + extraLen + commentLen;

    const localNameLen  = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataOffset    = localHeaderOffset + 30 + localNameLen + localExtraLen;

    let data;
    if (compressionMethod === 0) {
      data = buf.subarray(dataOffset, dataOffset + uncompressedSize);
    } else if (compressionMethod === 8) {
      data = zlib.inflateRawSync(buf.subarray(dataOffset, dataOffset + compressedSize));
    } else {
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    entries[filename] = data;
  }

  return entries;
}

module.exports = { parseNpzBuffer };
