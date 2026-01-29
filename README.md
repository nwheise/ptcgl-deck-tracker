# Pokemon TCG Live Deck Tracker

A desktop overlay application that helps you track your deck, hand, and discard pile during Pokemon TCG Live games.

## Features

- **Always-on-Top Overlay** - Semi-transparent window that stays above your game (even fullscreen)
- **Three-Column Layout** - View Deck, Hand, and Discard piles simultaneously
- **Drag & Drop** - Move cards between zones by dragging
- **Deck Builder** - Search the card database and build decks visually
- **Deck Import** - Paste deck lists exported from Pokemon TCG Live
- **Card Preview** - Hover over any card to see its full image
- **Search & Filter** - Quickly find cards in your deck
- **Organized by Type** - Cards grouped by Pokemon, Trainer, and Energy
- **Draggable & Resizable** - Position the overlay wherever works best

## Screenshot

The overlay displays three columns:
- **Deck** - Cards remaining in your deck with counts (e.g., "2/4" means 2 of 4 copies still in deck)
- **Hand** - Cards currently in your hand
- **Discard** - Cards that have been discarded

Stats bar shows total counts for Deck, Hand, Discard, and Prizes.

## Installation

See [SETUP.md](SETUP.md) for detailed installation instructions.

**Quick start:**
```bash
npm install
npm start
```

## Usage

### Building a Deck

1. Click **Build Deck** at the bottom of the overlay
2. Search for cards by name
3. Filter by type (Pokemon, Trainer, Energy) or Standard-legal only
4. Click **Add** to add cards to your deck
5. Use **+/-** buttons to adjust quantities
6. Click **Save Deck** when done

### Importing a Deck from Pokemon TCG Live

1. In Pokemon TCG Live, export your deck (copies to clipboard)
2. Click **Import Deck** in the tracker
3. Paste your deck list in this format:
   ```
   Pokémon: 6
   1 Togekiss SSP 72
   4 Gholdengo ex PAR 139

   Trainer: 14
   4 Ultra Ball SVI 196
   ...

   Energy: 8
   4 Basic {M} Energy SVE 8
   ...
   ```
4. Click **Import**

### Tracking Cards During a Game

- **Drag cards** between Deck, Hand, and Discard columns
- Cards maintain their counts (dragging from Deck decreases deck count)
- Hover over any card to see the full card image
- Use the search bar to filter cards in the deck
- Click **Reset Game** to restore all cards to the deck

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) | Toggle overlay visibility |
| `Ctrl+R` | Reset game |
| `Escape` | Close modals |

## Project Structure

```
ptcgl-deck-tracker/
├── main.js              # Electron main process
├── renderer.js          # UI logic and deck tracking
├── index.html           # UI structure
├── styles.css           # Styling
├── card-database.js     # Card database loader and search
├── package.json         # Dependencies and scripts
├── scripts/
│   └── sync-cards.js    # Pokemon TCG API card sync
└── pokemon-tcg-data/    # Card data (from Pokemon TCG Data repo)
    └── cards/en/        # English card JSON files by set
```

## Card Database

The project includes card data from the [Pokemon TCG Data](https://github.com/PokemonTCG/pokemon-tcg-data) repository. This provides:
- Card names, types, and images
- Set codes for matching Pokemon TCG Live exports
- Standard format legality information

To update the card database, pull the latest from the pokemon-tcg-data submodule or replace the data files.

## Technical Details

- Built with [Electron](https://www.electronjs.org/) v35
- Uses local card data from Pokemon TCG Data repository
- Transparent, frameless overlay window with `screen-saver` level always-on-top
- Custom mouse-based drag & drop (works with transparent windows)
- Works with the game in any mode including exclusive fullscreen

## Legal

This is a deck tracking tool similar to note-taking during paper play. It does not:
- Read game memory
- Inject code into the game
- Automate any gameplay

Always check Pokemon TCG Live's Terms of Service for any restrictions on third-party tools.

## License

MIT
