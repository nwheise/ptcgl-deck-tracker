const { ipcRenderer } = require('electron');
const cardDatabase = require('./card-database');

// Load the card database
cardDatabase.load();

// Game State
let gameState = {
  deck: [],
  hand: [],
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
const handList = document.getElementById('hand-list');
const discardList = document.getElementById('discard-list');
const deckCountEl = document.getElementById('deck-count');
const handCountEl = document.getElementById('hand-count');
const discardCountEl = document.getElementById('discard-count');
const prizeCountEl = document.getElementById('prize-count');
const deckHeaderCount = document.getElementById('deck-header-count');
const handHeaderCount = document.getElementById('hand-header-count');
const discardHeaderCount = document.getElementById('discard-header-count');
const searchInput = document.getElementById('search-input');
const resetBtn = document.getElementById('reset-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const importBtn = document.getElementById('import-btn');

// Card columns for drag and drop
const deckColumn = document.getElementById('deck-column');
const handColumn = document.getElementById('hand-column');
const discardColumn = document.getElementById('discard-column');

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
  renderHandList();
  renderDiscardList();
  updateStats();
  setupEventListeners();
}

// Helper function to compare card numbers
function compareCardNumbers(a, b) {
  // Try to parse as integers
  const aNum = parseInt(a);
  const bNum = parseInt(b);

  // If both are valid integers, compare numerically
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum - bNum;
  }

  // Otherwise compare as strings
  return a.localeCompare(b);
}

// Helper function to sort cards by set and number
function sortBySetAndNumber(cards) {
  return cards.sort((a, b) => {
    // First sort by set
    const setCompare = (a.set || '').localeCompare(b.set || '');
    if (setCompare !== 0) return setCompare;

    // Then sort by card number
    return compareCardNumbers(a.number || '0', b.number || '0');
  });
}

// Render deck list organized by card type
function renderDeckList(filter = '') {
  deckList.innerHTML = '';

  const filteredDeck = gameState.deck.filter(card =>
    card.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (filteredDeck.length === 0) {
    deckList.innerHTML = '<div class="empty-state">No cards in deck. Click "Build Deck" to add cards.</div>';
    return;
  }

  // Group cards by type and sort by set and number
  const pokemon = sortBySetAndNumber(filteredDeck.filter(c => c.type === 'Pokemon'));
  const trainers = sortBySetAndNumber(filteredDeck.filter(c => c.type === 'Trainer'));
  const energy = sortBySetAndNumber(filteredDeck.filter(c => c.type === 'Energy'));

  const renderCardItem = (card) => {
    const index = gameState.deck.indexOf(card);
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';
    if (card.inDeck === 0) {
      cardEl.classList.add('drawn');
    }

    // Get image URLs from card database if available
    const dbCard = cardDatabase.getCardById(card.id);
    const smallImageUrl = dbCard?.images?.small || card.imageUrl || '';
    const largeImageUrl = dbCard?.images?.large || smallImageUrl || '';

    cardEl.dataset.imageUrl = largeImageUrl;

    cardEl.innerHTML = `
      <div class="card-info">
        <img class="card-thumbnail" src="${smallImageUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <span class="card-name">${card.name}</span>
      </div>
      <span class="card-count">${card.inDeck}/${card.count}</span>
    `;

    // Make draggable if card is in deck (set after innerHTML to ensure it's applied)
    if (card.inDeck > 0) {
      cardEl.setAttribute('draggable', 'true');
      cardEl.dataset.source = 'deck';
      cardEl.dataset.cardName = card.name;
      cardEl.dataset.cardIndex = index;
    }

    return cardEl;
  };

  const renderGroup = (cards, label) => {
    if (cards.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'deck-group';

    const groupCount = cards.reduce((sum, c) => sum + c.inDeck, 0);
    const totalCount = cards.reduce((sum, c) => sum + c.count, 0);
    groupEl.innerHTML = `<div class="deck-group-header">${label} (${groupCount}/${totalCount})</div>`;

    cards.forEach(card => {
      groupEl.appendChild(renderCardItem(card));
    });

    deckList.appendChild(groupEl);
  };

  renderGroup(pokemon, 'Pokemon');
  renderGroup(trainers, 'Trainer');
  renderGroup(energy, 'Energy');
}

// Render hand list
function renderHandList() {
  handList.innerHTML = '';

  if (gameState.hand.length === 0) {
    handList.innerHTML = '<div class="empty-state">Hand is empty</div>';
    return;
  }

  // Group hand cards by name
  const handMap = {};
  gameState.hand.forEach((card, idx) => {
    if (!handMap[card.name]) {
      handMap[card.name] = { ...card, handCount: 0, indices: [] };
    }
    handMap[card.name].handCount++;
    handMap[card.name].indices.push(idx);
  });

  // Sort hand cards by set and number
  sortBySetAndNumber(Object.values(handMap)).forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';

    // Get image URLs from card database if available
    const dbCard = cardDatabase.getCardById(card.id);
    const smallImageUrl = dbCard?.images?.small || card.imageUrl || '';
    const largeImageUrl = dbCard?.images?.large || smallImageUrl || '';
    cardEl.dataset.imageUrl = largeImageUrl;

    cardEl.innerHTML = `
      <div class="card-info">
        <img class="card-thumbnail" src="${smallImageUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <span class="card-name">${card.name}</span>
      </div>
      <span class="card-count">${card.handCount}</span>
    `;

    // Set draggable after innerHTML
    cardEl.setAttribute('draggable', 'true');
    cardEl.dataset.source = 'hand';
    cardEl.dataset.cardName = card.name;

    handList.appendChild(cardEl);
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
  gameState.discard.forEach((card, idx) => {
    if (!discardMap[card.name]) {
      discardMap[card.name] = { ...card, discardCount: 0, indices: [] };
    }
    discardMap[card.name].discardCount++;
    discardMap[card.name].indices.push(idx);
  });

  // Sort discard cards by set and number
  sortBySetAndNumber(Object.values(discardMap)).forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';

    // Get image URLs from card database if available
    const dbCard = cardDatabase.getCardById(card.id);
    const smallImageUrl = dbCard?.images?.small || card.imageUrl || '';
    const largeImageUrl = dbCard?.images?.large || smallImageUrl || '';
    cardEl.dataset.imageUrl = largeImageUrl;

    cardEl.innerHTML = `
      <div class="card-info">
        <img class="card-thumbnail" src="${smallImageUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <span class="card-name">${card.name}</span>
      </div>
      <span class="card-count">${card.discardCount}</span>
    `;

    // Set draggable after innerHTML
    cardEl.setAttribute('draggable', 'true');
    cardEl.dataset.source = 'discard';
    cardEl.dataset.cardName = card.name;

    discardList.appendChild(cardEl);
  });
}

// Update stats
function updateStats() {
  const totalInDeck = gameState.deck.reduce((sum, card) => sum + card.inDeck, 0);
  deckCountEl.textContent = totalInDeck;
  handCountEl.textContent = gameState.hand.length;
  discardCountEl.textContent = gameState.discard.length;
  prizeCountEl.textContent = gameState.prizes;

  // Update column header counts
  if (deckHeaderCount) deckHeaderCount.textContent = totalInDeck;
  if (handHeaderCount) handHeaderCount.textContent = gameState.hand.length;
  if (discardHeaderCount) discardHeaderCount.textContent = gameState.discard.length;
}

// Draw a card from deck to hand
function drawCard(cardIndex) {
  const card = gameState.deck[cardIndex];
  if (card.inDeck > 0) {
    card.inDeck--;
    gameState.hand.push({ ...card });
    renderDeckList(searchInput.value);
    renderHandList();
    updateStats();
  }
}

// Discard a card from deck
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

// Quick draw (draws from first available card to hand)
function quickDraw() {
  const availableCard = gameState.deck.find(card => card.inDeck > 0);
  if (availableCard) {
    availableCard.inDeck--;
    gameState.hand.push({ ...availableCard });
    renderDeckList(searchInput.value);
    renderHandList();
    updateStats();
  }
}

// Move card from hand to deck
function moveHandToDeck(cardName) {
  const handIndex = gameState.hand.findIndex(c => c.name === cardName);
  if (handIndex === -1) return;

  const card = gameState.hand[handIndex];
  gameState.hand.splice(handIndex, 1);

  // Find the deck card and increment its inDeck count
  const deckCard = gameState.deck.find(c => c.name === cardName);
  if (deckCard) {
    deckCard.inDeck++;
  }

  renderDeckList(searchInput.value);
  renderHandList();
  updateStats();
}

// Move card from hand to discard
function moveHandToDiscard(cardName) {
  const handIndex = gameState.hand.findIndex(c => c.name === cardName);
  if (handIndex === -1) return;

  const card = gameState.hand[handIndex];
  gameState.hand.splice(handIndex, 1);
  gameState.discard.push({ ...card });

  renderHandList();
  renderDiscardList();
  updateStats();
}

// Move card from discard to deck
function moveDiscardToDeck(cardName) {
  const discardIndex = gameState.discard.findIndex(c => c.name === cardName);
  if (discardIndex === -1) return;

  gameState.discard.splice(discardIndex, 1);

  // Find the deck card and increment its inDeck count
  const deckCard = gameState.deck.find(c => c.name === cardName);
  if (deckCard) {
    deckCard.inDeck++;
  }

  renderDeckList(searchInput.value);
  renderDiscardList();
  updateStats();
}

// Move card from discard to hand
function moveDiscardToHand(cardName) {
  const discardIndex = gameState.discard.findIndex(c => c.name === cardName);
  if (discardIndex === -1) return;

  const card = gameState.discard[discardIndex];
  gameState.discard.splice(discardIndex, 1);
  gameState.hand.push({ ...card });

  renderHandList();
  renderDiscardList();
  updateStats();
}

// Reset game
function resetGame() {
  if (confirm('Reset the game? This will restore all cards to the deck.')) {
    // Restore all cards to deck
    gameState.deck.forEach(card => {
      card.inDeck = card.count;
    });
    gameState.hand = [];
    gameState.discard = [];
    gameState.prizes = 6;

    renderDeckList(searchInput.value);
    renderHandList();
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
    imageUrl: card.imageUrl,
    set: card.set || '',
    number: card.number || ''
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

  // Group by type and sort by set and number
  const pokemon = sortBySetAndNumber(builderDeck.filter(c => c.type === 'Pokemon'));
  const trainers = sortBySetAndNumber(builderDeck.filter(c => c.type === 'Trainer'));
  const energy = sortBySetAndNumber(builderDeck.filter(c => c.type === 'Energy'));

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
      imageUrl: card.images.small || '',
      set: card.set || '',
      number: card.number || ''
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
    imageUrl: card.imageUrl,
    set: card.set || '',
    number: card.number || ''
  }));

  gameState.hand = [];
  gameState.discard = [];
  gameState.prizes = 6;

  renderDeckList();
  renderHandList();
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
        imageUrl: card.images.small || '',
        set: card.set || '',
        number: card.number || ''
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
    imageUrl: card.imageUrl,
    set: card.set || '',
    number: card.number || ''
  }));

  gameState.hand = [];
  gameState.discard = [];
  gameState.prizes = 6;

  renderDeckList();
  renderHandList();
  renderDiscardList();
  updateStats();
  closeImportDeck();
}

// Event Listeners
function setupEventListeners() {
  // Search in deck
  searchInput.addEventListener('input', (e) => {
    renderDeckList(e.target.value);
  });

  // ========== Card Hover Preview (entire card-item triggers tooltip) ==========
  const setupCardHover = (listElement) => {
    listElement.addEventListener('mouseover', (e) => {
      const cardItem = e.target.closest('.card-item');
      if (cardItem) {
        const imageUrl = cardItem.dataset.imageUrl;
        if (imageUrl) {
          cardPreviewImage.src = imageUrl;
          cardPreview.classList.add('visible');
          updatePreviewPosition(e);
        }
      }
    });

    listElement.addEventListener('mouseout', (e) => {
      const cardItem = e.target.closest('.card-item');
      const relatedCardItem = e.relatedTarget?.closest?.('.card-item');
      // Only hide if we're leaving the card-item entirely
      if (cardItem && cardItem !== relatedCardItem) {
        cardPreview.classList.remove('visible');
      }
    });

    listElement.addEventListener('mousemove', (e) => {
      if (cardPreview.classList.contains('visible')) {
        updatePreviewPosition(e);
      }
    });
  };

  setupCardHover(deckList);
  setupCardHover(handList);
  setupCardHover(discardList);

  // ========== Custom Drag and Drop (mouse-based for transparent windows) ==========
  let dragState = null;
  let dragClone = null;

  // Create a visual clone for dragging
  const createDragClone = (cardItem) => {
    const clone = cardItem.cloneNode(true);
    clone.classList.add('drag-clone');
    clone.style.position = 'fixed';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '20000';
    clone.style.width = cardItem.offsetWidth + 'px';
    clone.style.opacity = '0.9';
    clone.style.transform = 'rotate(2deg) scale(1.05)';
    clone.style.boxShadow = '0 8px 20px rgba(0,0,0,0.4)';
    document.body.appendChild(clone);
    return clone;
  };

  // Update clone position
  const updateClonePosition = (e) => {
    if (dragClone) {
      dragClone.style.left = (e.clientX - dragState.offsetX) + 'px';
      dragClone.style.top = (e.clientY - dragState.offsetY) + 'px';
    }
  };

  // Get drop target column from coordinates
  const getDropTarget = (x, y) => {
    // Temporarily hide the clone to get element at point
    if (dragClone) dragClone.style.display = 'none';
    const element = document.elementFromPoint(x, y);
    if (dragClone) dragClone.style.display = '';

    if (!element) return null;

    // Find the column this element belongs to
    const column = element.closest('.card-column');
    return column;
  };

  // Mouse down handler - start drag
  const handleMouseDown = (e) => {
    const cardItem = e.target.closest('.card-item');
    if (!cardItem) return;

    // Only start drag on left mouse button
    if (e.button !== 0) return;

    // Check if this card can be dragged
    const source = cardItem.dataset.source;
    if (source === 'deck') {
      const card = gameState.deck[parseInt(cardItem.dataset.cardIndex)];
      if (!card || card.inDeck <= 0) return;
    }

    e.preventDefault();

    // Calculate offset from card corner to mouse position
    const rect = cardItem.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    dragState = {
      cardItem: cardItem,
      name: cardItem.dataset.cardName,
      source: cardItem.dataset.source,
      index: cardItem.dataset.cardIndex ? parseInt(cardItem.dataset.cardIndex) : null,
      offsetX: offsetX,
      offsetY: offsetY,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false
    };

    // Hide tooltip while potentially dragging
    cardPreview.classList.remove('visible');
  };

  // Mouse move handler - update drag
  const handleMouseMove = (e) => {
    if (!dragState) return;

    // Start actual drag after moving a few pixels (prevents accidental drags)
    if (!dragState.isDragging) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

      // Start dragging
      dragState.isDragging = true;
      dragState.cardItem.classList.add('dragging');
      dragClone = createDragClone(dragState.cardItem);
    }

    updateClonePosition(e);

    // Update drop target highlighting
    const targetColumn = getDropTarget(e.clientX, e.clientY);
    [deckColumn, handColumn, discardColumn].forEach(col => {
      if (col === targetColumn && col.id.replace('-column', '') !== dragState.source) {
        col.classList.add('drag-over');
      } else {
        col.classList.remove('drag-over');
      }
    });
  };

  // Mouse up handler - complete drag
  const handleMouseUp = (e) => {
    if (!dragState) return;

    if (dragState.isDragging) {
      // Find drop target
      const targetColumn = getDropTarget(e.clientX, e.clientY);

      if (targetColumn) {
        const targetZone = targetColumn.id.replace('-column', '');
        const sourceZone = dragState.source;
        const cardName = dragState.name;

        // Don't process if dropping in same zone
        if (targetZone !== sourceZone) {
          // Move card based on source and target
          if (sourceZone === 'deck') {
            if (targetZone === 'hand') {
              if (dragState.index !== null) drawCard(dragState.index);
            } else if (targetZone === 'discard') {
              if (dragState.index !== null) discardCard(dragState.index);
            }
          } else if (sourceZone === 'hand') {
            if (targetZone === 'deck') {
              moveHandToDeck(cardName);
            } else if (targetZone === 'discard') {
              moveHandToDiscard(cardName);
            }
          } else if (sourceZone === 'discard') {
            if (targetZone === 'deck') {
              moveDiscardToDeck(cardName);
            } else if (targetZone === 'hand') {
              moveDiscardToHand(cardName);
            }
          }
        }
      }

      // Clean up
      dragState.cardItem.classList.remove('dragging');
      if (dragClone) {
        dragClone.remove();
        dragClone = null;
      }

      // Remove drag-over class from all columns
      [deckColumn, handColumn, discardColumn].forEach(col => {
        col.classList.remove('drag-over');
      });
    }

    dragState = null;
  };

  // Add mouse event listeners
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Add mousedown to each card list
  [deckList, handList, discardList].forEach(list => {
    list.addEventListener('mousedown', handleMouseDown);
  });

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

  // R: Reset
  if (e.code === 'KeyR' && e.ctrlKey) {
    e.preventDefault();
    resetGame();
  }
});

// Initialize app
init();
