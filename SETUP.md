# Setup Guide

## Requirements

- [Node.js](https://nodejs.org/) version 18 or higher

## Installation

1. Clone or download this repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the app:
   ```bash
   npm start
   ```

## First Launch

When the app starts, you'll see an overlay window displaying a deck list. The overlay is:
- **Draggable** - Drag the red header bar to move it
- **Resizable** - Drag the edges to resize
- **Always on top** - Stays above other windows, including fullscreen games

You'll see "No Deck Loaded" at the top. Click **Build Deck** or **Import Deck** to get started.

## Building a Deck

1. Click **Build Deck**
2. Type a card name in the search box (at least 2 characters)
3. Use filter buttons to narrow by type: All, Pokemon, Trainer, Energy
4. Toggle **Standard Only** to show only Standard-legal cards
5. Click **Add** next to a card to add it to your deck
   - Enforces 4-card limit (except Basic Energy which is unlimited)
   - Maximum 60 cards per deck
6. Adjust quantities with the **+/-** buttons in your current deck
7. Optionally enter a **Deck Name** (or leave blank for auto-generated name from top 3 Pokemon)
8. Click **Save Deck** - your deck is automatically saved to history

## Importing a Deck from Pokemon TCG Live

1. In Pokemon TCG Live, go to your deck and click **Export**
2. Click **Import Deck** in the tracker
3. Paste the exported deck list:
   ```
   Pokémon: 6
   1 Togekiss SSP 72
   4 Gholdengo ex PAR 139
   1 Gimmighoul PAR 87

   Trainer: 14
   4 Ultra Ball SVI 196
   4 Buddy-Buddy Poffin TWM 144
   ...

   Energy: 8
   4 Basic {M} Energy SVE 8
   4 Basic {P} Energy SVE 5
   ```
4. Optionally enter a **Deck Name** (or leave blank for auto-generated name from top 3 Pokemon)
5. Click **Import** - your deck is automatically saved to history

The format requires the set code and card number (e.g., `SSP 72`) to match cards correctly.

## Using the Deck Viewer

### Deck Display

The main overlay shows:
- **Deck Name** - At the top, shows current deck name (custom or auto-generated)
- **Deck List** - Cards organized by type with thumbnails and counts
- **Stats** - Total card count at the bottom

### Deck List Organization

Cards are grouped by type:
- **Pokemon** - All Pokemon cards sorted by set and card number
- **Trainer** - All Trainer cards sorted by set and card number
- **Energy** - All Energy cards sorted by set and card number

Each group shows the total count (e.g., "Pokemon (18)").

### Card Preview

Hover over any card thumbnail to see its full image in a tooltip.

### Search

Use the search bar at the top to filter cards by name. The deck list updates in real-time.

### Deck History

Click **Deck History** to manage your saved decks:

| Action | Description |
|--------|-------------|
| **Edit** | Opens the deck in Build Deck UI for full editing |
| **Load** | Loads the deck into the main view |
| **Delete** | Removes the deck from history |

- History automatically saves your last 10 decks
- Duplicate decks (same cards) are automatically removed
- Each deck shows name, card count, and timestamp

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` / `Cmd+Shift+D` | Show/hide overlay |
| `Escape` | Close any open modal (Build Deck, Import Deck, Deck History) |

## Troubleshooting

### Overlay doesn't stay on top of the game
The app uses `screen-saver` level always-on-top which should work even with exclusive fullscreen games. If it still doesn't appear:
- Try **windowed** or **borderless windowed** mode in Pokemon TCG Live
- Restart the tracker after launching the game

### Deck import doesn't work
- Make sure you're using the **Pokemon TCG Live export format**
- Each card needs the set code and number (e.g., `4 Ultra Ball SVI 196`)
- Cards not found in the database will show a warning but other cards will still import

### Cards not found during import
- The card database may not include the newest sets
- Check that the set code matches (e.g., `SVI` for Scarlet & Violet base)
- Try using the **Build Deck** feature to search for the card manually

### Overlay is in the way
- Drag it to a corner of your screen
- Use `Ctrl+Shift+D` to quickly hide/show it
- Resize it smaller if needed

### Card previews not showing
- Make sure you're hovering over the card thumbnail image
- Images load from the pokemon-tcg-data submodule
- Some older or promo cards may not have images available
