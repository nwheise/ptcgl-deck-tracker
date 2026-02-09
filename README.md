# Pokemon TCG Live Deck Tracker

A desktop overlay application that helps you view and manage your Pokemon TCG Live decks.

## Features

- **Always-on-Top Overlay** - Semi-transparent window that stays above your game (even fullscreen)
- **Deck List View** - View all cards in your deck organized by type (Pokemon, Trainer, Energy)
- **Deck Builder** - Search the card database and build decks visually with card previews
- **Deck Import** - Paste deck lists exported from Pokemon TCG Live
- **Deck History** - Automatically saves your last 10 decks with Edit, Load, and Delete functions
- **Custom Deck Names** - Name your decks or use auto-generated names based on key Pokemon
- **Card Preview** - Hover over any card to see its full image
- **Search & Filter** - Quickly find cards in your deck or when building
- **Organized by Type** - Cards grouped by Pokemon, Trainer, and Energy with set/number sorting
- **Draggable & Resizable** - Position the overlay wherever works best

## Screenshot

The overlay displays:
- **Deck Name** - Current deck name at the top
- **Deck List** - All cards organized by type with card counts and thumbnails
- **Stats Bar** - Total card count display

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
2. Search for cards by name (at least 2 characters)
3. Filter by type (All, Pokemon, Trainer, Energy) or toggle **Standard Only**
4. Click **Add** to add cards to your deck (respects 4-card limit, unlimited Basic Energy)
5. Use **+/-** buttons to adjust quantities in your current deck
6. Optionally enter a **Deck Name** or leave blank for auto-generated name
7. Click **Save Deck** when done - deck is automatically saved to history

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
4. Optionally enter a **Deck Name** or leave blank for auto-generated name
5. Click **Import** - deck is automatically saved to history

### Managing Deck History

1. Click **Deck History** to view your saved decks
2. **Edit** - Opens the deck in Build Deck UI for full editing
3. **Load** - Loads the deck into the main view
4. **Delete** - Removes the deck from history
5. History automatically keeps your last 10 decks and removes duplicates

### Viewing Your Deck

- Hover over any card thumbnail to see the full card image
- Use the search bar to filter cards by name
- Cards are organized by type: Pokemon, Trainer, Energy
- Each section shows the total count (e.g., "Pokemon (18)")

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) | Toggle overlay visibility |
| `Escape` | Close open modals (Build Deck, Import Deck, Deck History) |

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
- Uses local card data from Pokemon TCG Data repository as a git submodule
- Transparent, frameless overlay window with `screen-saver` level always-on-top
- Card database with efficient search by name, type, and Standard legality
- Deck history stored in localStorage (last 10 decks, auto-deduplication)
- Works with the game in any mode including exclusive fullscreen

## Legal

This is a deck viewing and management tool for organizing your Pokemon TCG Live decks. It does not:
- Read game memory
- Inject code into the game
- Automate any gameplay
- Interact with Pokemon TCG Live in any way

Card data is sourced from the public Pokemon TCG Data repository. Always check Pokemon TCG Live's Terms of Service for any restrictions on third-party tools.

## License

MIT
