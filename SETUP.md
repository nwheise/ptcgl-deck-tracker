# Pokemon TCG Live Deck Tracker - Setup Instructions

## Installation

1. **Install Node.js** (if you haven't already)
   - Download from https://nodejs.org/
   - Version 16 or higher recommended

2. **Navigate to the project folder**
   ```bash
   cd path/to/pokemon-tcg-deck-tracker
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Run the application**
   ```bash
   npm start
   ```

## How to Use

### First Launch

1. The overlay will appear on your screen with a sample Electric-type deck
2. Position it where you want (drag the header bar)
3. Resize if needed (drag from edges)

### Importing Your Deck

1. Click the **"Import Deck"** button at the bottom
2. Enter your deck list in this format:
   ```
   3 Pikachu ex
   2 Zapdos ex
   4 Electric Energy
   4 Professor's Research
   ```
   - Each line should be: `[count] [card name]`
   - You can also use: `4x Pikachu ex` format
3. Click **"Import"**
4. Your deck is now loaded!

### During a Game

**Track cards manually:**
- Click the **"-"** button next to a card to mark it as drawn
- Click the **🗑️** button to move it to discard pile
- Or use the **"Draw Card"** button for quick draws

**View different zones:**
- Click **"Deck List"** tab to see cards remaining in deck
- Click **"Discard Pile"** tab to see discarded cards

**Search for cards:**
- Type in the search box to filter your deck list

**Reset for new game:**
- Click **"Reset Game"** to return all cards to deck

### Keyboard Shortcuts

- **Ctrl+Shift+D** - Hide/show the overlay
- **Ctrl+Shift+C** - Toggle click-through mode (walk through overlay to game)
- **Space** - Quick draw (when not typing)
- **Ctrl+R** - Reset game

### Window Controls

- **🖱️** - Toggle click-through (lets you click through the overlay to the game)
- **−** - Minimize window
- **×** - Close application

## Features

✅ **Manual card tracking** - Track draws, discards, and prizes
✅ **Deck import** - Paste your deck list to import
✅ **Search functionality** - Quickly find cards
✅ **Always-on-top overlay** - Stays above the game
✅ **Transparent design** - Doesn't block too much of the screen
✅ **Click-through mode** - Click through to game when needed
✅ **Resizable & draggable** - Position it however you like

## Tips

1. **Positioning**: Place the overlay on the side of your screen where it doesn't block important game UI
2. **Click-through**: Enable this when you need to interact with the game behind the tracker
3. **Deck format**: Make sure your deck import has one card per line with the count
4. **Prize cards**: Manually track these by noting which cards are prized (future feature: dedicated prize tracker)

## Troubleshooting

**Overlay won't stay on top:**
- Make sure you're running the app while the game is in windowed mode (not fullscreen)
- Try Alt+Tab to refocus the overlay

**Can't click on the overlay:**
- You might have click-through mode enabled. Click the 🖱️ button or press Ctrl+Shift+C

**Cards not importing:**
- Check the format: `4 Pikachu ex` (count, space, card name)
- Make sure each card is on its own line

**Game running slow:**
- The overlay is very lightweight, but if you experience issues, minimize it when not needed

## Advanced Usage

### Deck List Format Examples

```
3 Pikachu ex
2 Zapdos ex
4 Pawmi
2 Pawmo
2 Pawmot
4 Electric Generator
4 Professor's Research
4 Ultra Ball
3 Nest Ball
2 Rare Candy
2 Boss's Orders
2 Switch
12 Electric Energy
```

### Future Enhancements

The following features are planned for future versions:
- OCR-based automatic card tracking (read game screen)
- Prize card zone tracking
- Probability calculator
- Game statistics and history
- Multiple deck profiles
- Export game logs
- Custom themes

## Support

If you encounter issues or have feature requests, you can:
1. Check this README for troubleshooting tips
2. Modify the code to suit your needs (it's all open!)
3. Create detailed bug reports with steps to reproduce

## File Structure

```
pokemon-tcg-deck-tracker/
├── main.js          # Electron main process (window management)
├── renderer.js      # UI logic and deck tracking
├── index.html       # UI structure
├── styles.css       # Styling and theme
├── package.json     # Dependencies and scripts
└── README.md        # This file
```

Enjoy tracking your decks! 🎴⚡
