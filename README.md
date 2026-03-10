# Pokemon TCG Live Deck Tracker

A desktop overlay application for managing and viewing Pokemon TCG Live decks while you play.

## Features

- **Always-on-Top Overlay** — Semi-transparent window that stays above your game, even in fullscreen
- **Deck Builder** — Search the card database and build decks visually with card previews
- **Deck Import** — Paste deck lists exported directly from Pokemon TCG Live
- **Deck History** — Saves your last 10 decks with edit, load, and delete
- **Card Preview** — Hover any card to see its full image
- **Match History** — Import battle logs and track your last 50 matches with win/loss results
- **Battle Log Viewer** — Turn-by-turn breakdown of imported game logs
- **Window Tracking** — Capture the game window as PNG frames for CV/ML analysis

## Installation

### Download a release (recommended)

Go to the [Releases page](https://github.com/nwheise/ptcgl-deck-tracker/releases) and download the latest version:

- **Windows** — download the `.exe` installer and run it
- **macOS (Apple Silicon)** — download the `-arm64.dmg` and drag the app to Applications
- **macOS (Intel)** — download the `-x64.dmg` and drag the app to Applications

> **macOS note:** The app is not code-signed. On first launch macOS may block it with an "unidentified developer" warning. To bypass: right-click the app in Finder → **Open** → confirm. You only need to do this once.

### Run from source

```bash
npm install
npm start
```

## Usage

### Importing a deck

1. Export your deck from Pokemon TCG Live (copies to clipboard)
2. Click **Import Deck** in the tracker and paste the list
3. Optionally enter a name, or leave blank for an auto-generated one
4. Click **Import** — the deck is saved to history automatically

### Building a deck

1. Click **Build Deck** and search for cards (2+ characters)
2. Filter by type or toggle **Standard Only**
3. Click **Add** to add cards (4-card limit, unlimited Basic Energy)
4. Click **Save Deck** when done

### Match history

1. Click **Matches** → **+ Import**
2. Paste a battle log from Pokemon TCG Live and click **Import**
3. Click any match to see the full turn-by-turn breakdown

### Window tracking

1. Click **▶ Record Game Session** and choose a save folder
2. Frames are saved as `frame_000000.png`, … at ~5 fps in a timestamped subfolder
3. Click **■ Stop Recording** to end the session

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+Shift+D` | Toggle overlay visibility |
| `Escape` | Close open modals |

## Contributing

```
ptcgl-deck-tracker/
├── main.js              # Electron main process, IPC handlers
├── renderer.js          # All UI logic
├── card-database.js     # Card data loader and search
├── game-log-parser.js   # Battle log parser
├── index.html / styles.css
└── pokemon-tcg-data/    # Card data (git submodule)
```

To update card data, pull the latest from the `pokemon-tcg-data` submodule.

## Notice

This tool is for deck viewing and management only. It does not read game memory, inject code, automate gameplay, or interact with Pokemon TCG Live in any way. Card data is sourced from the public [Pokemon TCG Data](https://github.com/PokemonTCG/pokemon-tcg-data) repository.

