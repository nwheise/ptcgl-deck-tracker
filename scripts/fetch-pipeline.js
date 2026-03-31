#!/usr/bin/env node
/**
 * Fetches pipeline assets from the pinned nwheise/pokematching GitHub Release
 * and extracts them into pipeline/.
 *
 * Run via: npm run fetch-pipeline
 *
 * Assets downloaded:
 *   - YOLO ONNX model
 *   - MobileNetV4 ONNX model
 *   - Reference embeddings NPZ
 *   - JSON sidecars (preprocessing params)
 *   - Metadata JSON (card catalog)
 *   - Golden files ZIP (extracted to pipeline/golden/)
 *
 * Skips download if files already exist for the pinned release tag.
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');

const REPO = 'nwheise/pokematching';
const RELEASE_TAG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'model-version.json'), 'utf8')
).release;

const PIPELINE_DIR = path.join(__dirname, '..', 'pipeline');
const GOLDEN_DIR = path.join(PIPELINE_DIR, 'golden');
const RELEASE_STAMP = path.join(PIPELINE_DIR, '.release');

function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ...options, headers: { 'User-Agent': 'ptcgl-deck-tracker' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location, options).then(resolve, reject);
      }
      resolve(res);
    });
    req.on('error', reject);
  });
}

async function getJson(url) {
  const res = await httpsGet(url);
  return new Promise((resolve, reject) => {
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`)); }
    });
    res.on('error', reject);
  });
}

async function downloadFile(url, destPath) {
  const res = await httpsGet(url);
  if (res.statusCode !== 200) {
    throw new Error(`HTTP ${res.statusCode} downloading ${url}`);
  }
  await pipeline(res, createWriteStream(destPath));
}

async function extractZip(zipPath, destDir) {
  const { execSync } = require('child_process');
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
  }
}

async function main() {
  if (fs.existsSync(RELEASE_STAMP)) {
    const stamp = fs.readFileSync(RELEASE_STAMP, 'utf8').trim();
    if (stamp === RELEASE_TAG) {
      console.log(`Pipeline already up-to-date for release ${RELEASE_TAG}. Skipping.`);
      return;
    }
  }

  fs.mkdirSync(PIPELINE_DIR, { recursive: true });

  console.log(`Fetching release assets for ${REPO}@${RELEASE_TAG}...`);

  const apiUrl = `https://api.github.com/repos/${REPO}/releases/tags/${RELEASE_TAG}`;
  const releaseData = await getJson(apiUrl);

  if (!releaseData.assets || releaseData.assets.length === 0) {
    throw new Error(`No assets found for release ${RELEASE_TAG}`);
  }

  console.log(`Found ${releaseData.assets.length} asset(s):`);
  for (const asset of releaseData.assets) {
    console.log(`  - ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  for (const asset of releaseData.assets) {
    const destPath = path.join(PIPELINE_DIR, asset.name);

    if (asset.name.endsWith('.zip')) {
      console.log(`Downloading ${asset.name}...`);
      await downloadFile(asset.browser_download_url, destPath);
      console.log(`Extracting ${asset.name} → pipeline/golden/`);
      await extractZip(destPath, GOLDEN_DIR);
      fs.unlinkSync(destPath);
    } else {
      if (fs.existsSync(destPath)) {
        console.log(`  Skipping ${asset.name} (already exists)`);
        continue;
      }
      console.log(`Downloading ${asset.name}...`);
      await downloadFile(asset.browser_download_url, destPath);
    }
  }

  // Flatten golden/golden/ if the zip has an inner directory
  const nestedGolden = path.join(GOLDEN_DIR, 'golden');
  if (fs.existsSync(nestedGolden) && fs.statSync(nestedGolden).isDirectory()) {
    for (const entry of fs.readdirSync(nestedGolden)) {
      fs.renameSync(path.join(nestedGolden, entry), path.join(GOLDEN_DIR, entry));
    }
    fs.rmdirSync(nestedGolden);
  }

  fs.writeFileSync(RELEASE_STAMP, RELEASE_TAG, 'utf8');
  console.log(`\nDone. Pipeline assets saved to pipeline/ (release: ${RELEASE_TAG})`);
}

main().catch(err => {
  console.error('fetch-pipeline failed:', err.message);
  process.exit(1);
});
