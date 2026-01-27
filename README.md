# Pokemon TCG Live Deck Tracker

A desktop overlay application that tracks your deck state during Pokemon TCG Live games.

## Features

- **Overlay UI** - Transparent window that sits on top of the game
- **Deck Management** - Import and manage your deck lists
- **Card Tracking** - Track cards in deck, hand, discard, and prize pools
- **Real-time Updates** - Manual card tracking with keyboard shortcuts
- **Search & Filter** - Quick card lookup and filtering

## Architecture

### Technology Stack

**Recommended:** Electron + React for cross-platform overlay support

- **Electron** - Creates overlay windows with transparency and always-on-top
- **React** - UI component library
- **TypeScript** - Type safety for card data
- **electron-overlay-window** - Better overlay control (optional)

**Alternative:** Python + PyQt5/Tkinter for lighter footprint

### Core Components

1. **Overlay Window Manager**
   - Transparent, click-through window
   - Always on top of game
   - Draggable/resizable
   - Toggle visibility (hotkey)

2. **Deck State Manager**
   - Load deck lists (from PTCGL export or manual entry)
   - Track card locations (deck, hand, discard, prizes, play area)
   - Update counts in real-time
   - Undo/reset functionality

3. **UI Components**
   - Deck list view with remaining counts
   - Discard pile viewer
   - Prize card tracker
   - Search/filter bar
   - Probability calculator (optional)

4. **Input Handler**
   - Global hotkeys for common actions
   - Manual card movement buttons
   - Import/export functionality

## Technical Challenges

### 1. Game Detection
- **Manual tracking:** User manually updates when cards are drawn/discarded
- **OCR approach:** Screen capture + text recognition (complex, unreliable)
- **Memory reading:** Against TOS, not recommended

**Recommendation:** Start with manual tracking via hotkeys

### 2. Overlay Implementation

The overlay needs to:
- Stay on top of the game window
- Be transparent/semi-transparent
- Allow click-through (optional) or be positioned to not block important UI
- Survive game focus changes

### 3. Deck Import

Support common formats:
- PTCGL deck code export
- Text-based deck lists
- Manual entry with card search

## Implementation Phases

### Phase 1: Basic Overlay (Start Here)
- Create transparent overlay window
- Basic UI with deck list display
- Manual card tracking (click to mark as drawn)
- Toggle visibility hotkey

### Phase 2: Enhanced Tracking
- Multiple zones (deck, hand, discard, prizes)
- Drag-and-drop card movement between zones
- Search and filter functionality
- Deck import from PTCGL format

### Phase 3: Advanced Features
- Probability calculations
- Game history/statistics
- Multiple deck profiles
- Auto-save game state

### Phase 4: Polish
- Customizable UI themes
- Hotkey customization
- Better animations
- Performance optimization

## Quick Start Options

I can create either:

1. **Electron + React** version (cross-platform, modern UI)
2. **Python + PyQt5** version (lighter, simpler)
3. **HTML/JS** overlay (runs in browser, simple but limited)

Each has trade-offs in complexity, features, and performance.

## Legal Considerations

- This is a deck tracking tool, not a game modification
- Does not read game memory or inject code
- Similar to physical deck tracking during paper play
- Check PTCGL Terms of Service for any overlay restrictions

## Next Steps

Choose your preferred tech stack and I can create:
- Initial project structure
- Working overlay window
- Basic deck tracking functionality
- UI mockup

Let me know which direction you'd like to go!
