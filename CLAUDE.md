# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT INSTRUCTIONS FOR CLAUDE
- Claude must never work directly on main branch. Always use a feature branch.
- Claude must always update the CLAUDE.md and README.md files before committing changes.
    - CLAUDE.md must be kept concise, it can never be more than 750 words maximum.
    - README.md is meant for humans. It should focus on project description, usage, and essential info for humans to understand, work with, and contribute to the project. It must be no longer than 750 words.
- Claude must bump the package version in package.json before submitting a PR.


## Commands

- `npm start` — Launch the Electron app
- `npm run dev` — Launch with DevTools enabled
- `npm install` — Install dependencies
- `npm run build` — Build distributable for the current platform (requires `electron-builder`)
- `npm run build:mac` — Build macOS DMG (x64 + arm64)
- `npm run build:win` — Build Windows NSIS installer
- `npm run release` — Build and publish to GitHub Releases (requires `GH_TOKEN`)

There is no test suite or linter configured.

## Release process

Releases are fully automated via GitHub Actions (`.github/workflows/release.yml`). On every push to `main`, the workflow reads the version from `package.json` and checks whether a GitHub Release for that version already exists. If not, it creates a `v{version}` git tag, then builds macOS (x64 + arm64 DMG) and Windows (NSIS installer) in parallel and publishes them as a draft GitHub Release. To cut a release:

1. Bump the version in `package.json` on your feature branch
2. Merge to `main` — the tag and draft release are created automatically
3. Review the draft on the Releases page, then publish it

The workflow checks out the `pokemon-tcg-data` git submodule recursively, so card data is included in every build.

## Architecture

This is an Electron desktop overlay app for Pokemon TCG Live. It displays deck information on top of the fullscreen game using a frameless, transparent, always-on-top window at `screen-saver` z-index level.

**Tech stack:** Electron v35, vanilla JavaScript, HTML/CSS. No frameworks, no build tools. Runtime dependency: Electron. Dev tooling: `electron-builder` for packaging/distribution.

### Key files

- **main.js** — Electron main process. Creates the overlay window, registers `Cmd/Ctrl+Shift+D` global shortcut to toggle visibility, handles IPC for minimize/close, and handles window-tracking IPC (`get-desktop-sources`, `choose-save-directory`, `create-tracking-session`, `remove-tracking-session`, `save-frame`).
- **renderer.js** — All UI logic (~1350 lines). Manages state via module-scoped variables, renders via direct DOM manipulation (`innerHTML`), persists data to `localStorage`. Contains deck display, deck builder modal, import, history, match history, card preview, and window tracking functionality.
- **card-database.js** — `CardDatabase` class that loads card JSON from the `pokemon-tcg-data/` git submodule. Builds indexes for fast lookup by name, set ID, PTCGL code, and set+number composite key. Supports filtered search with debouncing.
- **game-log-parser.js** — `parseGameLog(text)` function that parses Pokemon TCG Live battle logs into structured data: player names, win/loss result, setup phase, and turn-by-turn actions.
- **index.html** — Single-page app with main deck view and multiple modals (builder, import, history, match history, match detail, import match).

### Data flow

User events → handler functions in renderer.js → state updates (module variables) → render functions (DOM manipulation) → localStorage persistence.

### Card data

Card data comes from the `pokemon-tcg-data` git submodule (PokemonTCG/pokemon-tcg-data). Cards are loaded from `pokemon-tcg-data/cards/en/` JSON files. Set metadata from `pokemon-tcg-data/sets/en.json` maps PTCGL set codes to set IDs.

### Storage

- `deckHistory` — last 10 decks (localStorage)
- `matchHistory` — last 50 matches (localStorage)

### Window Tracking

The window tracking feature captures the Pokemon TCG Live game window at ~5 fps using Electron's `desktopCapturer` API and `getUserMedia`. If the game window is not found, recording is refused with an error — there is no fallback to the primary screen. Before each session the user selects a base directory via a native folder-picker dialog; a timestamped sub-folder is created inside it and frames are saved as sequentially numbered PNGs (`frame_000000.png`, …). IPC channels: `get-desktop-sources` (enumerates windows/screens in main process), `choose-save-directory` (native folder picker), `create-tracking-session` (creates timestamped sub-folder, returns path), `remove-tracking-session` (deletes empty sub-folder on abort), `save-frame` (writes one PNG to disk).

### Deck import format

Supports the Pokemon TCG Live export format: lines like `4 Comfey SIT 79` (count, name, set code, number).
