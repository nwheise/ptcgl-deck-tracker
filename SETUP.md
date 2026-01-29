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

When the app starts, you'll see an overlay window with three columns (Deck, Hand, Discard). The overlay is:
- **Draggable** - Drag the red header bar to move it
- **Resizable** - Drag the edges to resize
- **Always on top** - Stays above other windows, including fullscreen games

## Building a Deck

1. Click **Build Deck**
2. Type a card name in the search box (at least 2 characters)
3. Use filter buttons to narrow by type: All, Pokemon, Trainer, Energy
4. Toggle **Standard Only** to show only Standard-legal cards
5. Click **Add** next to a card to add it to your deck
6. Adjust quantities with the **+/-** buttons
7. Click **Save Deck** to start tracking

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
4. Click **Import**

The format requires the set code and card number (e.g., `SSP 72`) to match cards correctly.

## Using the Tracker

### Three-Column Layout

| Column | Purpose |
|--------|---------|
| **Deck** | Cards remaining in your deck (grouped by type) |
| **Hand** | Cards currently in your hand |
| **Discard** | Cards in your discard pile |

### Moving Cards

**Drag and drop** cards between columns:
- Drag from **Deck** to **Hand** = Draw a card
- Drag from **Deck** to **Discard** = Discard from deck
- Drag from **Hand** to **Discard** = Discard from hand
- Drag from **Hand** to **Deck** = Return to deck
- Drag from **Discard** to **Hand** = Recover to hand
- Drag from **Discard** to **Deck** = Shuffle back into deck

### Card Preview

Hover over any card to see its full image in a tooltip.

### Stats Bar

| Stat | Meaning |
|------|---------|
| **Deck** | Total cards remaining in deck |
| **Hand** | Number of cards in hand |
| **Discard** | Number of cards in discard pile |
| **Prizes** | Prize cards remaining (starts at 6) |

### Reset Game

Click **Reset Game** to restore all cards to the deck and clear hand/discard.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` / `Cmd+Shift+D` | Show/hide overlay |
| `Ctrl+R` | Reset game |
| `Escape` | Close any open modal |

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

### Drag and drop not working
- Make sure you're clicking on a card item (not empty space)
- Cards with 0 remaining in deck cannot be dragged from the Deck column
- The drag starts after moving 5+ pixels (to prevent accidental drags)
