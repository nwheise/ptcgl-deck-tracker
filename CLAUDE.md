# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT INSTRUCTIONS FOR CLAUDE
- Claude must never work directly on main branch. Always use a feature branch.
- Claude must always update the CLAUDE.md and README.md files before committing changes.
    - README.md is meant for humans. It should focus on project description, usage, and essential info for humans to understand, work with, and contribute to the project. It must be no longer than 750 words.
- Claude must bump the package version in package.json before submitting a PR.


## Commands

- `npm start` — Launch the Electron app
- `npm run dev` — Launch with DevTools enabled
- `npm install` — Install dependencies
- `npm run fetch-pipeline` — Download ML pipeline assets from the pinned pokematching release into `pipeline/`
- `npm test` — Run golden file validation tests for the inference pipeline
- `npm run build` — Build distributable for the current platform (requires `electron-builder`)
- `npm run build:mac` — Build macOS DMG (x64 + arm64)
- `npm run build:win` — Build Windows NSIS installer
- `npm run release` — Build and publish to GitHub Releases (requires `GH_TOKEN`)

## Release process

Releases are fully automated via GitHub Actions (`.github/workflows/release.yml`). On every push to `main`, the workflow reads the version from `package.json` and checks whether a GitHub Release for that version already exists. If not, it creates a `v{version}` git tag, then builds macOS (x64 + arm64 DMG) and Windows (NSIS installer) in parallel and publishes them as a draft GitHub Release. To cut a release:

1. Bump the version in `package.json` on your feature branch
2. Merge to `main` — the tag and draft release are created automatically
3. Review the draft on the Releases page, then publish it

The workflow checks out the `pokemon-tcg-data` git submodule recursively, so card data is included in every build.

## Architecture

This is an Electron desktop overlay app for Pokemon TCG Live. It displays deck information on top of the fullscreen game using a frameless, transparent, always-on-top window at `screen-saver` z-index level.

**Tech stack:** Electron v35, vanilla JavaScript, HTML/CSS. No frameworks, no build tools. Runtime deps: Electron, onnxruntime-node, sharp, npyjs. Dev tooling: `electron-builder` for packaging/distribution.

### Key files

- **main.js** — Electron main process. Creates the overlay window, registers `Cmd/Ctrl+Shift+D` global shortcut to toggle visibility, handles IPC for minimize/close and window-tracking.
- **renderer.js** — All UI logic (~1350 lines). Manages state via module-scoped variables, renders via direct DOM manipulation (`innerHTML`), persists data to `localStorage`.
- **inference.js** — ML inference pipeline (main process). Runs YOLO object detection + MobileNetV4 embedding + nearest-neighbor card matching. See "ML Inference Pipeline" section below.
- **card-database.js** — `CardDatabase` class that loads card JSON from the `pokemon-tcg-data/` git submodule.
- **game-log-parser.js** — `parseGameLog(text)` function that parses Pokemon TCG Live battle logs.
- **scripts/fetch-pipeline.js** — Downloads pipeline assets from the pinned GitHub release into `pipeline/`.
- **npz-utils.js** — NPZ (ZIP of NPY) parser using npyjs + minimal ZIP extraction.
- **test/test-inference.js** — Golden file validation tests for the inference pipeline.

### ML Inference Pipeline

The `inference.js` module implements card detection from game frames. Models are fetched from the `nwheise/pokematching` GitHub release pinned in `scripts/model-version.json`.

**Pipeline:** raw RGBA frame → YOLO preprocessing (640x640, bilinear, [0,1]) → YOLO ONNX inference → parse detections (conf > 0.25) → per-detection crop extraction (with energy/item masking) → MobileNetV4 preprocessing (resize width→224, top-crop 224x224, ImageNet normalize) → MobileNetV4 ONNX inference (1280-dim embedding) → L2 normalize → cosine similarity against reference embeddings → class-filtered top-1 match.

**Class filtering:** class 0 (attached-energy) → Energy cards only; class 1 (attached-item) → Pokemon Tool only; class 2/3 (card/multicard) → all cards.

The `pipeline/` directory is gitignored. Run `npm run fetch-pipeline` to populate it.

### Data flow

User events → handler functions in renderer.js → state updates (module variables) → render functions (DOM manipulation) → localStorage persistence.

### Card data

Card data comes from the `pokemon-tcg-data` git submodule (PokemonTCG/pokemon-tcg-data). Cards are loaded from `pokemon-tcg-data/cards/en/` JSON files. Set metadata from `pokemon-tcg-data/sets/en.json` maps PTCGL set codes to set IDs.

### Storage

- `deckHistory` — last 10 decks (localStorage)
- `matchHistory` — last 50 matches (localStorage)

### Deck import format

Supports the Pokemon TCG Live export format: lines like `4 Comfey SIT 79` (count, name, set code, number).
