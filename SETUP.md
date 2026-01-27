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

When the app starts, you'll see an overlay window with a sample deck loaded. The overlay is:
- **Draggable** - Drag the red header bar to move it
- **Resizable** - Drag the edges to resize
- **Always on top** - Stays above other windows

## Importing Your Deck

1. Click **Import Deck**
2. Paste your deck list (one card per line):
   ```
   4 Pikachu ex
   3 Professor's Research
   4 Ultra Ball
   12 Basic Lightning Energy
   ```
3. Click **Import**

Supported formats:
- `4 Pikachu ex` - count followed by card name
- `4x Pikachu ex` - count with "x" also works

## Using the Tracker

### Card Actions
| Button | Action |
|--------|--------|
| **-** | Mark card as drawn (decreases count) |
| Trash icon | Move card to discard pile |
| **Draw Card** | Quick draw from top of deck |
| **Reset Game** | Restore all cards to deck |

### Tabs
- **Deck List** - Shows cards remaining in your deck with counts
- **Discard Pile** - Shows cards that have been discarded

### Stats Bar
- **Deck** - Total cards remaining in deck
- **Discard** - Number of cards in discard pile
- **Prizes** - Prize cards remaining (starts at 6)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` / `Cmd+Shift+D` | Show/hide overlay |
| `Space` | Quick draw (when not in a text field) |
| `Ctrl+R` | Reset game |

## Troubleshooting

### Overlay doesn't stay on top of the game
- Use **windowed** or **borderless windowed** mode in Pokemon TCG Live
- Fullscreen mode may prevent overlays from appearing

### Deck import doesn't work
- Make sure each card is on its own line
- Format should be: `[count] [card name]`
- Example: `4 Pikachu ex` (not `Pikachu ex x4`)

### Overlay is in the way
- Drag it to a corner of your screen
- Use `Ctrl+Shift+D` to quickly hide/show it
- Resize it smaller if needed

## Optional: Sync Card Database

To download the Pokemon TCG card database for offline reference:

```bash
npm run sync-cards
```

This fetches Standard-legal cards from the [Pokemon TCG API](https://pokemontcg.io) and saves them to the `data/` folder.
