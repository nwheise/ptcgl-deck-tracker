const { ipcRenderer } = require('electron');

// Game State
let gameState = {
  deck: [],
  discard: [],
  prizes: 6
};

// Sample deck for demo (will be replaced by user import)
const sampleDeck = [
  { name: 'Pikachu ex', count: 3, inDeck: 3, type: 'Pokemon' },
  { name: 'Zapdos ex', count: 2, inDeck: 2, type: 'Pokemon' },
  { name: 'Pawmi', count: 4, inDeck: 4, type: 'Pokemon' },
  { name: 'Pawmo', count: 2, inDeck: 2, type: 'Pokemon' },
  { name: 'Pawmot', count: 2, inDeck: 2, type: 'Pokemon' },
  { name: 'Electric Generator', count: 4, inDeck: 4, type: 'Trainer' },
  { name: 'Professor\'s Research', count: 4, inDeck: 4, type: 'Trainer' },
  { name: 'Ultra Ball', count: 4, inDeck: 4, type: 'Trainer' },
  { name: 'Nest Ball', count: 3, inDeck: 3, type: 'Trainer' },
  { name: 'Rare Candy', count: 2, inDeck: 2, type: 'Trainer' },
  { name: 'Boss\'s Orders', count: 2, inDeck: 2, type: 'Trainer' },
  { name: 'Switch', count: 2, inDeck: 2, type: 'Trainer' },
  { name: 'Electric Energy', count: 12, inDeck: 12, type: 'Energy' },
];

// Initialize with sample deck
gameState.deck = JSON.parse(JSON.stringify(sampleDeck));

// DOM Elements
const deckList = document.getElementById('deck-list');
const discardList = document.getElementById('discard-list');
const deckCountEl = document.getElementById('deck-count');
const discardCountEl = document.getElementById('discard-count');
const prizeCountEl = document.getElementById('prize-count');
const searchInput = document.getElementById('search-input');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const drawBtn = document.getElementById('draw-btn');
const resetBtn = document.getElementById('reset-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const importBtn = document.getElementById('import-btn');
const importModal = document.getElementById('import-modal');
const confirmImportBtn = document.getElementById('confirm-import');
const cancelImportBtn = document.getElementById('cancel-import');
const deckInput = document.getElementById('deck-input');

// Initialize UI
function init() {
  renderDeckList();
  renderDiscardList();
  updateStats();
  setupEventListeners();
}

// Render deck list
function renderDeckList(filter = '') {
  deckList.innerHTML = '';
  
  const filteredDeck = gameState.deck.filter(card => 
    card.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (filteredDeck.length === 0) {
    deckList.innerHTML = '<div class="empty-state">No cards found</div>';
    return;
  }

  filteredDeck.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';
    if (card.inDeck === 0) {
      cardEl.classList.add('drawn');
    }
    
    cardEl.innerHTML = `
      <span class="card-name">${card.name}</span>
      <span class="card-count">${card.inDeck}/${card.count}</span>
      <div class="card-controls">
        <button class="card-btn" data-action="draw" data-index="${index}" title="Draw">-</button>
        <button class="card-btn discard" data-action="discard" data-index="${index}" title="Discard">🗑️</button>
      </div>
    `;
    
    deckList.appendChild(cardEl);
  });
}

// Render discard list
function renderDiscardList() {
  discardList.innerHTML = '';
  
  if (gameState.discard.length === 0) {
    discardList.innerHTML = '<div class="empty-state">Discard pile is empty</div>';
    return;
  }

  // Group discarded cards by name
  const discardMap = {};
  gameState.discard.forEach(card => {
    if (!discardMap[card.name]) {
      discardMap[card.name] = { ...card, discardCount: 0 };
    }
    discardMap[card.name].discardCount++;
  });

  Object.values(discardMap).forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';
    
    cardEl.innerHTML = `
      <span class="card-name">${card.name}</span>
      <span class="card-count">${card.discardCount}</span>
    `;
    
    discardList.appendChild(cardEl);
  });
}

// Update stats
function updateStats() {
  const totalInDeck = gameState.deck.reduce((sum, card) => sum + card.inDeck, 0);
  deckCountEl.textContent = totalInDeck;
  discardCountEl.textContent = gameState.discard.length;
  prizeCountEl.textContent = gameState.prizes;
}

// Draw a card from deck
function drawCard(cardIndex) {
  const card = gameState.deck[cardIndex];
  if (card.inDeck > 0) {
    card.inDeck--;
    renderDeckList(searchInput.value);
    updateStats();
  }
}

// Discard a card
function discardCard(cardIndex) {
  const card = gameState.deck[cardIndex];
  if (card.inDeck > 0) {
    card.inDeck--;
    gameState.discard.push({ ...card });
    renderDeckList(searchInput.value);
    renderDiscardList();
    updateStats();
  }
}

// Quick draw (draws from first available card)
function quickDraw() {
  const availableCard = gameState.deck.find(card => card.inDeck > 0);
  if (availableCard) {
    availableCard.inDeck--;
    renderDeckList(searchInput.value);
    updateStats();
  }
}

// Reset game
function resetGame() {
  if (confirm('Reset the game? This will restore all cards to the deck.')) {
    // Restore all cards to deck
    gameState.deck.forEach(card => {
      card.inDeck = card.count;
    });
    gameState.discard = [];
    gameState.prizes = 6;
    
    renderDeckList(searchInput.value);
    renderDiscardList();
    updateStats();
  }
}

// Import deck from text
function importDeck(deckText) {
  const lines = deckText.trim().split('\n');
  const newDeck = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Parse format: "4 Pikachu ex" or "4x Pikachu ex" or just "Pikachu ex"
    const match = trimmed.match(/^(\d+)\s*x?\s+(.+)$/i);
    
    if (match) {
      const count = parseInt(match[1]);
      const name = match[2].trim();
      
      // Determine card type (simple heuristic)
      let type = 'Trainer';
      if (name.toLowerCase().includes('energy')) {
        type = 'Energy';
      } else if (name.match(/\b(ex|V|VMAX|GX)\b/i) || !name.match(/\b(ball|search|research|boss|switch|candy)\b/i)) {
        // If it has ex/V/VMAX/GX or doesn't have common trainer words, assume Pokemon
        if (name.toLowerCase().includes('energy')) {
          type = 'Energy';
        } else {
          type = 'Pokemon';
        }
      }
      
      newDeck.push({
        name: name,
        count: count,
        inDeck: count,
        type: type
      });
    }
  }
  
  if (newDeck.length > 0) {
    gameState.deck = newDeck;
    gameState.discard = [];
    gameState.prizes = 6;
    renderDeckList();
    renderDiscardList();
    updateStats();
    return true;
  }
  
  return false;
}

// Event Listeners
function setupEventListeners() {
  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    renderDeckList(e.target.value);
  });

  // Card controls (event delegation)
  deckList.addEventListener('click', (e) => {
    if (e.target.classList.contains('card-btn')) {
      const action = e.target.dataset.action;
      const index = parseInt(e.target.dataset.index);
      
      if (action === 'draw') {
        drawCard(index);
      } else if (action === 'discard') {
        discardCard(index);
      }
    }
  });

  // Quick draw button
  drawBtn.addEventListener('click', quickDraw);

  // Reset button
  resetBtn.addEventListener('click', resetGame);

  // Window controls
  minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('minimize');
  });

  closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close');
  });

  // Import modal
  importBtn.addEventListener('click', () => {
    importModal.classList.add('active');
  });

  cancelImportBtn.addEventListener('click', () => {
    importModal.classList.remove('active');
  });

  confirmImportBtn.addEventListener('click', () => {
    const deckText = deckInput.value;
    if (importDeck(deckText)) {
      importModal.classList.remove('active');
      deckInput.value = '';
      alert('Deck imported successfully!');
    } else {
      alert('Failed to import deck. Please check the format.');
    }
  });

}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Space: Quick draw
  if (e.code === 'Space' && !e.target.matches('input, textarea')) {
    e.preventDefault();
    quickDraw();
  }
  
  // R: Reset
  if (e.code === 'KeyR' && e.ctrlKey) {
    e.preventDefault();
    resetGame();
  }
});

// Initialize app
init();
