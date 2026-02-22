# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT INSTRUCTIONS FOR CLAUDE
- Claude must never work directly on main branch. Always use a feature branch.
- Claude must always update the CLAUDE.md and README.md files when committing changes.

## Commands

- `npm start` — Launch the Electron app
- `npm run dev` — Launch with DevTools enabled
- `npm install` — Install dependencies

There is no test suite, linter, or build step configured.

## Architecture

This is an Electron desktop overlay app for Pokemon TCG Live. It displays deck information on top of the fullscreen game using a frameless, transparent, always-on-top window at `screen-saver` z-index level.

**Tech stack:** Electron v35, vanilla JavaScript, HTML/CSS. No frameworks, no build tools. The only dependency is Electron itself.

### Key files

- **main.js** — Electron main process. Creates the overlay window, registers `Cmd/Ctrl+Shift+D` global shortcut to toggle visibility, handles IPC for minimize/close.
- **renderer.js** — All UI logic (~1200 lines). Manages state via module-scoped variables, renders via direct DOM manipulation (`innerHTML`), persists data to `localStorage`. Contains deck display, deck builder modal, import, history, match history, and card preview functionality.
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

### Deck import format

Supports the Pokemon TCG Live export format: lines like `4 Comfey SIT 79` (count, name, set code, number).
