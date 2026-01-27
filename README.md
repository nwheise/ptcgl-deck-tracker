# Pokemon TCG Live Deck Tracker

A desktop overlay application that helps you track your deck during Pokemon TCG Live games.

## Features

- **Always-on-Top Overlay** - Semi-transparent window that stays above your game
- **Deck Import** - Paste your deck list to load it instantly
- **Manual Card Tracking** - Track draws and discards with a click
- **Search & Filter** - Quickly find cards in your deck
- **Discard Pile Viewer** - See what's been discarded
- **Keyboard Shortcuts** - Quick actions without clicking
- **Draggable & Resizable** - Position the overlay wherever works best

## Screenshot

The overlay displays:
- Card counts remaining in deck (e.g., "2/4" means 2 of 4 copies still in deck)
- Total deck size, discard count, and prize count
- Tabs to switch between deck list and discard pile views

## Installation

See [SETUP.md](SETUP.md) for detailed installation instructions.

**Quick start:**
```bash
npm install
npm start
```

## Usage

### Importing Your Deck

1. Click **Import Deck** at the bottom of the overlay
2. Paste your deck list in this format:
   ```
   4 Pikachu ex
   3 Professor's Research
   12 Electric Energy
   ```
3. Click **Import**

### Tracking Cards During a Game

- Click **-** next to a card to mark it as drawn (decreases deck count)
- Click the trash icon to move a card to the discard pile
- Use **Draw Card** button for a quick draw
- Click **Reset Game** to restore all cards to the deck

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) | Toggle overlay visibility |
| `Space` | Quick draw (when not typing) |
| `Ctrl+R` | Reset game |

## Project Structure

```
ptcgl-deck-tracker/
├── main.js          # Electron main process
├── renderer.js      # UI logic and deck tracking
├── index.html       # UI structure
├── styles.css       # Styling
├── package.json     # Dependencies and scripts
├── scripts/
│   └── sync-cards.js    # Pokemon TCG API card sync
└── data/            # Synced card data (generated)
```

## Card Database Sync

The project includes a script to sync card data from the [Pokemon TCG API](https://pokemontcg.io):

```bash
npm run sync-cards           # Sync Standard format cards
```

This downloads card metadata to the `data/` directory for offline use.

## Technical Details

- Built with [Electron](https://www.electronjs.org/) v35
- Uses the [Pokemon TCG SDK](https://github.com/PokemonTCG/pokemon-tcg-sdk-javascript) for card data
- Overlay uses transparent, frameless window with always-on-top flag
- Works best with the game in windowed or borderless windowed mode

## Legal

This is a deck tracking tool similar to note-taking during paper play. It does not:
- Read game memory
- Inject code into the game
- Automate any gameplay

Always check Pokemon TCG Live's Terms of Service for any restrictions on third-party tools.

## License

MIT
