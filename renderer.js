const { ipcRenderer } = require('electron');
const cardDatabase = require('./card-database');

// Load the card database
cardDatabase.load();

// Game State
let gameState = {
  deck: [],
  discard: [],
  prizes: 6
};

// Deck Builder State
let builderDeck = [];
let currentFilter = 'all';
let standardOnly = false;
let searchDebounceTimer = null;

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

// Deck Builder DOM Elements
const deckBuilderModal = document.getElementById('deck-builder-modal');
const cardSearchInput = document.getElementById('card-search-input');
const searchResults = document.getElementById('search-results');
const currentDeckList = document.getElementById('current-deck-list');
const builderCardCount = document.getElementById('builder-card-count');
const filterBtns = document.querySelectorAll('.filter-btn');
const clearDeckBtn = document.getElementById('clear-deck-btn');
const saveDeckBtn = document.getElementById('save-deck-btn');
const cancelDeckBtn = document.getElementById('cancel-deck-btn');
const standardOnlyToggle = document.getElementById('standard-only-toggle');
const cardPreview = document.getElementById('card-preview');
const cardPreviewImage = document.getElementById('card-preview-image');

// Import Deck Modal DOM Elements
const importTextBtn = document.getElementById('import-text-btn');
const importDeckModal = document.getElementById('import-deck-modal');
const deckImportText = document.getElementById('deck-import-text');
const importError = document.getElementById('import-error');
const importDeckBtn = document.getElementById('import-deck-btn');
const cancelImportBtn = document.getElementById('cancel-import-btn');

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
    deckList.innerHTML = '<div class="empty-state">No cards in deck. Click "Build Deck" to add cards.</div>';
    return;
  }

  filteredDeck.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';
    if (card.inDeck === 0) {
      cardEl.classList.add('drawn');
    }

    // Get large image URL from card database if available
    const dbCard = cardDatabase.getCardById(card.id);
    const largeImageUrl = dbCard?.images?.large || card.imageUrl || '';

    cardEl.innerHTML = `
      <span class="card-name hoverable" data-image-url="${largeImageUrl}">${card.name}</span>
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

// ========== Deck Builder Functions ==========

function openDeckBuilder() {
  // Copy current deck to builder
  builderDeck = gameState.deck.map(card => ({
    id: card.id,
    name: card.name,
    count: card.count,
    type: card.type,
    imageUrl: card.imageUrl
  }));

  currentFilter = 'all';
  standardOnly = false;
  filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === 'all');
  });
  standardOnlyToggle.checked = false;

  cardSearchInput.value = '';
  searchResults.innerHTML = '<div class="search-placeholder">Type to search for cards...</div>';

  renderBuilderDeck();
  deckBuilderModal.classList.add('active');
  cardSearchInput.focus();
}

function closeDeckBuilder() {
  deckBuilderModal.classList.remove('active');
}

function getBuilderCardCount() {
  return builderDeck.reduce((sum, card) => sum + card.count, 0);
}

function updateBuilderStats() {
  builderCardCount.textContent = getBuilderCardCount();
}

function renderBuilderDeck() {
  currentDeckList.innerHTML = '';
  updateBuilderStats();

  if (builderDeck.length === 0) {
    currentDeckList.innerHTML = '<div class="empty-state">No cards added yet</div>';
    return;
  }

  // Group by type
  const pokemon = builderDeck.filter(c => c.type === 'Pokemon');
  const trainers = builderDeck.filter(c => c.type === 'Trainer');
  const energy = builderDeck.filter(c => c.type === 'Energy');

  const renderGroup = (cards, label) => {
    if (cards.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'deck-group';

    const groupCount = cards.reduce((sum, c) => sum + c.count, 0);
    groupEl.innerHTML = `<div class="deck-group-header">${label} (${groupCount})</div>`;

    cards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'builder-card-item';
      cardEl.innerHTML = `
        <span class="card-name">${card.name}</span>
        <div class="card-quantity">
          <button class="qty-btn" data-action="decrease" data-id="${card.id}">-</button>
          <span class="qty-value">${card.count}</span>
          <button class="qty-btn" data-action="increase" data-id="${card.id}">+</button>
        </div>
      `;
      groupEl.appendChild(cardEl);
    });

    currentDeckList.appendChild(groupEl);
  };

  renderGroup(pokemon, 'Pokemon');
  renderGroup(trainers, 'Trainer');
  renderGroup(energy, 'Energy');
}

function searchCards(query) {
  if (!query || query.length < 2) {
    searchResults.innerHTML = '<div class="search-placeholder">Type at least 2 characters to search...</div>';
    return;
  }

  const supertypeFilter = currentFilter === 'all' ? null :
    (currentFilter === 'Pokemon' ? 'Pokémon' : currentFilter);

  const results = cardDatabase.search(query, {
    limit: 30,
    supertype: supertypeFilter,
    standardOnly: standardOnly
  });

  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-placeholder">No cards found</div>';
    return;
  }

  searchResults.innerHTML = '';

  results.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'search-result-item';

    // Determine card type for display
    const displayType = card.supertype === 'Pokémon' ? 'Pokemon' : card.supertype;
    const subtypeText = card.subtypes.length > 0 ? ` - ${card.subtypes.join(', ')}` : '';

    cardEl.innerHTML = `
      <div class="result-card-info">
        <img class="result-card-image" src="${card.images.small || ''}" alt="${card.name}" loading="lazy" onerror="this.style.display='none'" data-large-image="${card.images.large || card.images.small || ''}" />
        <div class="result-card-details">
          <div class="result-card-name">${card.name}</div>
          <div class="result-card-meta">${displayType}${subtypeText} - ${card.setName}</div>
        </div>
      </div>
      <button class="add-card-btn" data-card-id="${card.id}">Add</button>
    `;

    searchResults.appendChild(cardEl);
  });
}

function addCardToDeck(cardId) {
  const card = cardDatabase.getCardById(cardId);
  if (!card) return;

  // Check deck limit
  if (getBuilderCardCount() >= 60) {
    alert('Deck cannot have more than 60 cards!');
    return;
  }

  // Determine card type
  const cardType = card.supertype === 'Pokémon' ? 'Pokemon' : card.supertype;

  // Check if card already exists in deck
  const existingCard = builderDeck.find(c => c.name === card.name);

  if (existingCard) {
    // Check 4-card limit (except basic energy)
    const isBasicEnergy = card.supertype === 'Energy' &&
      (!card.subtypes || card.subtypes.length === 0 || card.subtypes.includes('Basic'));

    if (!isBasicEnergy && existingCard.count >= 4) {
      alert('You can only have 4 copies of a card (except Basic Energy)!');
      return;
    }

    existingCard.count++;
  } else {
    builderDeck.push({
      id: card.id,
      name: card.name,
      count: 1,
      type: cardType,
      imageUrl: card.images.small || ''
    });
  }

  renderBuilderDeck();
}

function changeCardQuantity(cardId, delta) {
  const card = builderDeck.find(c => c.id === cardId);
  if (!card) return;

  if (delta > 0) {
    // Check deck limit
    if (getBuilderCardCount() >= 60) {
      alert('Deck cannot have more than 60 cards!');
      return;
    }

    // Check 4-card limit (except basic energy)
    const dbCard = cardDatabase.getCardById(cardId);
    const isBasicEnergy = dbCard && dbCard.supertype === 'Energy' &&
      (!dbCard.subtypes || dbCard.subtypes.length === 0 || dbCard.subtypes.includes('Basic'));

    if (!isBasicEnergy && card.count >= 4) {
      alert('You can only have 4 copies of a card (except Basic Energy)!');
      return;
    }

    card.count++;
  } else {
    card.count--;
    if (card.count <= 0) {
      builderDeck = builderDeck.filter(c => c.id !== cardId);
    }
  }

  renderBuilderDeck();
}

function clearBuilderDeck() {
  if (builderDeck.length === 0 || confirm('Clear all cards from the deck?')) {
    builderDeck = [];
    renderBuilderDeck();
  }
}

function updatePreviewPosition(e) {
  const previewWidth = 266; // 250px image + 16px padding
  const previewHeight = 370; // approximate height
  const offset = 15; // distance from cursor

  let x = e.clientX + offset;
  let y = e.clientY + offset;

  // Keep preview within viewport
  if (x + previewWidth > window.innerWidth) {
    x = e.clientX - previewWidth - offset;
  }
  if (y + previewHeight > window.innerHeight) {
    y = window.innerHeight - previewHeight - 10;
  }
  if (y < 10) {
    y = 10;
  }

  cardPreview.style.left = `${x}px`;
  cardPreview.style.top = `${y}px`;
}

function saveDeck() {
  if (builderDeck.length === 0) {
    alert('Please add some cards to your deck first!');
    return;
  }

  // Convert builder deck to game state format
  gameState.deck = builderDeck.map(card => ({
    id: card.id,
    name: card.name,
    count: card.count,
    inDeck: card.count,
    type: card.type,
    imageUrl: card.imageUrl
  }));

  gameState.discard = [];
  gameState.prizes = 6;

  renderDeckList();
  renderDiscardList();
  updateStats();
  closeDeckBuilder();
}

// ========== Import Deck Functions ==========

function openImportDeck() {
  deckImportText.value = '';
  importError.textContent = '';
  importError.classList.remove('visible');
  importDeckModal.classList.add('active');
  deckImportText.focus();
}

function closeImportDeck() {
  importDeckModal.classList.remove('active');
}

function showImportError(message) {
  importError.textContent = message;
  importError.classList.add('visible');
}

function parseDeckText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const cards = [];
  const errors = [];

  for (const line of lines) {
    // Skip section headers (e.g., "Pokémon: 6", "Trainer: 14", "Energy: 8")
    if (/^(Pokémon|Pokemon|Trainer|Energy):\s*\d+$/i.test(line)) {
      continue;
    }

    // Skip "Total Cards: N" line
    if (/^Total Cards:\s*\d+$/i.test(line)) {
      continue;
    }

    // Parse card line: "count name set number"
    // Examples:
    //   "4 Gholdengo ex PAR 139"
    //   "1 Basic {L} Energy SVE 12"
    //   "2 Boss's Orders PAL 172"
    const match = line.match(/^(\d+)\s+(.+?)\s+([A-Z0-9-]+)\s+(\d+)$/i);
    if (!match) {
      // Could be an empty line or invalid format, skip silently
      if (line.length > 0 && !/^\s*$/.test(line)) {
        errors.push(`Could not parse: "${line}"`);
      }
      continue;
    }

    const count = parseInt(match[1], 10);
    const cardName = match[2].trim();
    const setCode = match[3].toUpperCase();
    const cardNumber = match[4];

    // Look up the card in the database
    const card = cardDatabase.getCardByPtcglCode(setCode, cardNumber);

    if (!card) {
      errors.push(`Card not found: ${cardName} (${setCode} ${cardNumber})`);
      continue;
    }

    // Determine card type
    const cardType = card.supertype === 'Pokémon' ? 'Pokemon' : card.supertype;

    // Check if card already exists in our parsed list
    const existingCard = cards.find(c => c.id === card.id);
    if (existingCard) {
      existingCard.count += count;
    } else {
      cards.push({
        id: card.id,
        name: card.name,
        count: count,
        type: cardType,
        imageUrl: card.images.small || ''
      });
    }
  }

  return { cards, errors };
}

function importDeck() {
  const text = deckImportText.value.trim();

  if (!text) {
    showImportError('Please paste a deck list');
    return;
  }

  const { cards, errors } = parseDeckText(text);

  if (cards.length === 0) {
    showImportError('No valid cards found. Make sure you paste a deck exported from Pokemon TCG Live.');
    return;
  }

  // Show warnings for cards that couldn't be found
  if (errors.length > 0) {
    const proceed = confirm(
      `Warning: ${errors.length} card(s) could not be found:\n\n` +
      errors.slice(0, 5).join('\n') +
      (errors.length > 5 ? `\n...and ${errors.length - 5} more` : '') +
      '\n\nImport the remaining cards anyway?'
    );
    if (!proceed) {
      return;
    }
  }

  // Convert to game state format
  gameState.deck = cards.map(card => ({
    id: card.id,
    name: card.name,
    count: card.count,
    inDeck: card.count,
    type: card.type,
    imageUrl: card.imageUrl
  }));

  gameState.discard = [];
  gameState.prizes = 6;

  renderDeckList();
  renderDiscardList();
  updateStats();
  closeImportDeck();
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

  // Search in deck
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

  // Deck list hover preview
  deckList.addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('hoverable')) {
      const imageUrl = e.target.dataset.imageUrl;
      if (imageUrl) {
        cardPreviewImage.src = imageUrl;
        cardPreview.classList.add('visible');
        updatePreviewPosition(e);
      }
    }
  });

  deckList.addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('hoverable')) {
      cardPreview.classList.remove('visible');
    }
  });

  deckList.addEventListener('mousemove', (e) => {
    if (e.target.classList.contains('hoverable') && cardPreview.classList.contains('visible')) {
      updatePreviewPosition(e);
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

  // Open deck builder
  importBtn.addEventListener('click', openDeckBuilder);

  // ========== Deck Builder Events ==========

  // Card search with debounce
  cardSearchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchCards(e.target.value);
    }, 200);
  });

  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Re-run search with new filter
      if (cardSearchInput.value.length >= 2) {
        searchCards(cardSearchInput.value);
      }
    });
  });

  // Standard only toggle
  standardOnlyToggle.addEventListener('change', (e) => {
    standardOnly = e.target.checked;

    // Re-run search with new filter
    if (cardSearchInput.value.length >= 2) {
      searchCards(cardSearchInput.value);
    }
  });

  // Search results - add card (event delegation)
  searchResults.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-card-btn')) {
      const cardId = e.target.dataset.cardId;
      addCardToDeck(cardId);
    }
  });

  // Card image hover preview
  searchResults.addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('result-card-image')) {
      const largeImageUrl = e.target.dataset.largeImage;
      if (largeImageUrl) {
        cardPreviewImage.src = largeImageUrl;
        cardPreview.classList.add('visible');
        updatePreviewPosition(e);
      }
    }
  });

  searchResults.addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('result-card-image')) {
      cardPreview.classList.remove('visible');
    }
  });

  searchResults.addEventListener('mousemove', (e) => {
    if (e.target.classList.contains('result-card-image') && cardPreview.classList.contains('visible')) {
      updatePreviewPosition(e);
    }
  });

  // Current deck - quantity controls (event delegation)
  currentDeckList.addEventListener('click', (e) => {
    if (e.target.classList.contains('qty-btn')) {
      const cardId = e.target.dataset.id;
      const action = e.target.dataset.action;
      const delta = action === 'increase' ? 1 : -1;
      changeCardQuantity(cardId, delta);
    }
  });

  // Clear deck button
  clearDeckBtn.addEventListener('click', clearBuilderDeck);

  // Save deck button
  saveDeckBtn.addEventListener('click', saveDeck);

  // Cancel button
  cancelDeckBtn.addEventListener('click', closeDeckBuilder);

  // ========== Import Deck Events ==========

  // Open import deck modal
  importTextBtn.addEventListener('click', openImportDeck);

  // Import deck button
  importDeckBtn.addEventListener('click', importDeck);

  // Cancel import button
  cancelImportBtn.addEventListener('click', closeImportDeck);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape: Close modal
  if (e.code === 'Escape') {
    if (deckBuilderModal.classList.contains('active')) {
      closeDeckBuilder();
    }
    if (importDeckModal.classList.contains('active')) {
      closeImportDeck();
    }
  }

  // Space: Quick draw (when not typing)
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
