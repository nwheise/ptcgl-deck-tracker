const { ipcRenderer } = require('electron');
const cardDatabase = require('./card-database');

// Load the card database
cardDatabase.load();

// Deck State - simplified to just the card list
let deck = [];

// Deck Builder State
let builderDeck = [];
let currentFilter = 'all';
let standardOnly = false;
let searchDebounceTimer = null;

// Deck History
const HISTORY_KEY = 'deckHistory';
const MAX_HISTORY = 10;

// DOM Elements
const deckList = document.getElementById('deck-list');
const deckCountEl = document.getElementById('deck-count');
const searchInput = document.getElementById('search-input');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const importBtn = document.getElementById('import-btn');
const historyBtn = document.getElementById('history-btn');

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

// Deck History Modal DOM Elements
const deckHistoryModal = document.getElementById('deck-history-modal');
const deckHistoryList = document.getElementById('deck-history-list');
const closeHistoryBtn = document.getElementById('close-history-btn');

// Initialize UI
function init() {
  renderDeckList();
  updateStats();
  setupEventListeners();
}

// Helper function to compare card numbers
function compareCardNumbers(a, b) {
  const aNum = parseInt(a);
  const bNum = parseInt(b);

  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum - bNum;
  }

  return a.localeCompare(b);
}

// Helper function to sort cards by set and number
function sortBySetAndNumber(cards) {
  return cards.sort((a, b) => {
    const setCompare = (a.set || '').localeCompare(b.set || '');
    if (setCompare !== 0) return setCompare;

    return compareCardNumbers(a.number || '0', b.number || '0');
  });
}

// Render deck list organized by card type
function renderDeckList(filter = '') {
  deckList.innerHTML = '';

  const filteredDeck = deck.filter(card =>
    card.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (filteredDeck.length === 0 && deck.length === 0) {
    deckList.innerHTML = '<div class="empty-state">No cards in deck. Click "Build Deck" or "Import Deck" to add cards.</div>';
    return;
  }

  if (filteredDeck.length === 0) {
    deckList.innerHTML = '<div class="empty-state">No cards match your search.</div>';
    return;
  }

  // Group cards by type and sort by set and number
  const pokemon = sortBySetAndNumber(filteredDeck.filter(c => c.type === 'Pokemon'));
  const trainers = sortBySetAndNumber(filteredDeck.filter(c => c.type === 'Trainer'));
  const energy = sortBySetAndNumber(filteredDeck.filter(c => c.type === 'Energy'));

  const renderCardItem = (card) => {
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
      <span class="card-count">${card.count}</span>
    `;

    return cardEl;
  };

  const renderGroup = (cards, label) => {
    if (cards.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'deck-group';

    const totalCount = cards.reduce((sum, c) => sum + c.count, 0);
    groupEl.innerHTML = `<div class="deck-group-header">${label} (${totalCount})</div>`;

    cards.forEach(card => {
      groupEl.appendChild(renderCardItem(card));
    });

    deckList.appendChild(groupEl);
  };

  renderGroup(pokemon, 'Pokemon');
  renderGroup(trainers, 'Trainer');
  renderGroup(energy, 'Energy');
}

// Update stats
function updateStats() {
  const totalCards = deck.reduce((sum, card) => sum + card.count, 0);
  deckCountEl.textContent = totalCards;
}

// ========== Deck History Functions ==========

function getDeckHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

function saveDeckToHistory(deckCards) {
  if (deckCards.length === 0) return;

  const history = getDeckHistory();

  // Create a summary name from the deck's key Pokemon
  const pokemonCards = deckCards.filter(c => c.type === 'Pokemon');
  const topCards = pokemonCards.slice(0, 3).map(c => c.name);
  const deckName = topCards.length > 0 ? topCards.join(', ') : 'Unnamed Deck';

  const totalCards = deckCards.reduce((sum, c) => sum + c.count, 0);

  const entry = {
    name: deckName,
    totalCards: totalCards,
    timestamp: Date.now(),
    cards: deckCards.map(card => ({
      id: card.id,
      name: card.name,
      count: card.count,
      type: card.type,
      imageUrl: card.imageUrl,
      set: card.set || '',
      number: card.number || ''
    }))
  };

  // Remove duplicate decks (same card composition)
  const entryKey = entry.cards.map(c => `${c.id}:${c.count}`).sort().join(',');
  const filtered = history.filter(h => {
    const hKey = h.cards.map(c => `${c.id}:${c.count}`).sort().join(',');
    return hKey !== entryKey;
  });

  // Add to front and limit to MAX_HISTORY
  filtered.unshift(entry);
  if (filtered.length > MAX_HISTORY) {
    filtered.length = MAX_HISTORY;
  }

  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
}

function loadDeckFromHistory(index) {
  const history = getDeckHistory();
  if (index < 0 || index >= history.length) return;

  const entry = history[index];
  deck = entry.cards.map(card => ({
    id: card.id,
    name: card.name,
    count: card.count,
    type: card.type,
    imageUrl: card.imageUrl,
    set: card.set || '',
    number: card.number || ''
  }));

  renderDeckList();
  updateStats();
  closeHistory();
}

function deleteDeckFromHistory(index) {
  const history = getDeckHistory();
  if (index < 0 || index >= history.length) return;

  history.splice(index, 1);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistoryList();
}

function openHistory() {
  renderHistoryList();
  deckHistoryModal.classList.add('active');
}

function closeHistory() {
  deckHistoryModal.classList.remove('active');
}

function renderHistoryList() {
  const history = getDeckHistory();
  deckHistoryList.innerHTML = '';

  if (history.length === 0) {
    deckHistoryList.innerHTML = '<div class="empty-state">No deck history yet. Import or build a deck to get started.</div>';
    return;
  }

  history.forEach((entry, index) => {
    const entryEl = document.createElement('div');
    entryEl.className = 'history-entry';

    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit'
    });

    entryEl.innerHTML = `
      <div class="history-entry-info">
        <div class="history-entry-name">${entry.name}</div>
        <div class="history-entry-meta">${entry.totalCards} cards - ${dateStr} ${timeStr}</div>
      </div>
      <div class="history-entry-actions">
        <button class="action-btn history-load-btn" data-index="${index}">Load</button>
        <button class="action-btn secondary history-delete-btn" data-index="${index}">X</button>
      </div>
    `;

    deckHistoryList.appendChild(entryEl);
  });
}

// ========== Deck Builder Functions ==========

function openDeckBuilder() {
  builderDeck = deck.map(card => ({
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

  if (getBuilderCardCount() >= 60) {
    alert('Deck cannot have more than 60 cards!');
    return;
  }

  const cardType = card.supertype === 'Pokémon' ? 'Pokemon' : card.supertype;
  const existingCard = builderDeck.find(c => c.name === card.name);

  if (existingCard) {
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
    if (getBuilderCardCount() >= 60) {
      alert('Deck cannot have more than 60 cards!');
      return;
    }

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
  const previewWidth = 266;
  const previewHeight = 370;
  const offset = 15;

  let x = e.clientX + offset;
  let y = e.clientY + offset;

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

  deck = builderDeck.map(card => ({
    id: card.id,
    name: card.name,
    count: card.count,
    type: card.type,
    imageUrl: card.imageUrl,
    set: card.set || '',
    number: card.number || ''
  }));

  saveDeckToHistory(deck);
  renderDeckList();
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
    if (/^(Pokémon|Pokemon|Trainer|Energy):\s*\d+$/i.test(line)) {
      continue;
    }

    if (/^Total Cards:\s*\d+$/i.test(line)) {
      continue;
    }

    const match = line.match(/^(\d+)\s+(.+?)\s+([A-Z0-9-]+)\s+(\d+)$/i);
    if (!match) {
      if (line.length > 0 && !/^\s*$/.test(line)) {
        errors.push(`Could not parse: "${line}"`);
      }
      continue;
    }

    const count = parseInt(match[1], 10);
    const cardName = match[2].trim();
    const setCode = match[3].toUpperCase();
    const cardNumber = match[4];

    const card = cardDatabase.getCardByPtcglCode(setCode, cardNumber);

    if (!card) {
      errors.push(`Card not found: ${cardName} (${setCode} ${cardNumber})`);
      continue;
    }

    const cardType = card.supertype === 'Pokémon' ? 'Pokemon' : card.supertype;

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

  deck = cards.map(card => ({
    id: card.id,
    name: card.name,
    count: card.count,
    type: card.type,
    imageUrl: card.imageUrl,
    set: card.set || '',
    number: card.number || ''
  }));

  saveDeckToHistory(deck);
  renderDeckList();
  updateStats();
  closeImportDeck();
}

// Event Listeners
function setupEventListeners() {
  // Search in deck
  searchInput.addEventListener('input', (e) => {
    renderDeckList(e.target.value);
  });

  // Card Hover Preview
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

  cardSearchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchCards(e.target.value);
    }, 200);
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (cardSearchInput.value.length >= 2) {
        searchCards(cardSearchInput.value);
      }
    });
  });

  standardOnlyToggle.addEventListener('change', (e) => {
    standardOnly = e.target.checked;

    if (cardSearchInput.value.length >= 2) {
      searchCards(cardSearchInput.value);
    }
  });

  searchResults.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-card-btn')) {
      const cardId = e.target.dataset.cardId;
      addCardToDeck(cardId);
    }
  });

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

  currentDeckList.addEventListener('click', (e) => {
    if (e.target.classList.contains('qty-btn')) {
      const cardId = e.target.dataset.id;
      const action = e.target.dataset.action;
      const delta = action === 'increase' ? 1 : -1;
      changeCardQuantity(cardId, delta);
    }
  });

  clearDeckBtn.addEventListener('click', clearBuilderDeck);
  saveDeckBtn.addEventListener('click', saveDeck);
  cancelDeckBtn.addEventListener('click', closeDeckBuilder);

  // ========== Import Deck Events ==========
  importTextBtn.addEventListener('click', openImportDeck);
  importDeckBtn.addEventListener('click', importDeck);
  cancelImportBtn.addEventListener('click', closeImportDeck);

  // ========== Deck History Events ==========
  historyBtn.addEventListener('click', openHistory);
  closeHistoryBtn.addEventListener('click', closeHistory);

  deckHistoryList.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('.history-load-btn');
    if (loadBtn) {
      const index = parseInt(loadBtn.dataset.index, 10);
      loadDeckFromHistory(index);
      return;
    }

    const deleteBtn = e.target.closest('.history-delete-btn');
    if (deleteBtn) {
      const index = parseInt(deleteBtn.dataset.index, 10);
      deleteDeckFromHistory(index);
    }
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (deckBuilderModal.classList.contains('active')) {
      closeDeckBuilder();
    }
    if (importDeckModal.classList.contains('active')) {
      closeImportDeck();
    }
    if (deckHistoryModal.classList.contains('active')) {
      closeHistory();
    }
  }
});

// Initialize app
init();
