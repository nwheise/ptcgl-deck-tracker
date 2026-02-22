const { ipcRenderer } = require('electron');
const cardDatabase = require('./card-database');
const { parseGameLog } = require('./game-log-parser');

// Load the card database
cardDatabase.load();

// Deck State - simplified to just the card list
let deck = [];
let currentDeckName = 'No Deck Loaded';

// Deck Builder State
let builderDeck = [];
let currentFilter = 'all';
let standardOnly = false;
let searchDebounceTimer = null;

// Deck History
const HISTORY_KEY = 'deckHistory';
const MAX_HISTORY = 10;

// Match History
const MATCH_HISTORY_KEY = 'matchHistory';
const MAX_MATCHES = 50;

// DOM Elements
const deckList = document.getElementById('deck-list');
const deckCountEl = document.getElementById('deck-count');
const currentDeckNameEl = document.getElementById('current-deck-name');
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
const importDeckName = document.getElementById('import-deck-name');
const importError = document.getElementById('import-error');
const importDeckBtn = document.getElementById('import-deck-btn');
const cancelImportBtn = document.getElementById('cancel-import-btn');

// Deck History Modal DOM Elements
const deckHistoryModal = document.getElementById('deck-history-modal');
const deckHistoryList = document.getElementById('deck-history-list');
const closeHistoryBtn = document.getElementById('close-history-btn');

// Deck Builder Name Input
const builderDeckName = document.getElementById('builder-deck-name');

// Match History DOM Elements
const matchesBtn = document.getElementById('matches-btn');
const importMatchModal = document.getElementById('import-match-modal');
const matchImportText = document.getElementById('match-import-text');
const matchImportError = document.getElementById('match-import-error');
const importMatchBtn = document.getElementById('import-match-btn');
const cancelImportMatchBtn = document.getElementById('cancel-import-match-btn');
const matchHistoryModal = document.getElementById('match-history-modal');
const matchHistoryList = document.getElementById('match-history-list');
const importMatchFromHistoryBtn = document.getElementById('import-match-from-history-btn');
const closeMatchHistoryBtn = document.getElementById('close-match-history-btn');
const matchDetailModal = document.getElementById('match-detail-modal');
const matchDetailBackBtn = document.getElementById('match-detail-back-btn');
const matchDetailOpponent = document.getElementById('match-detail-opponent');
const matchDetailResult = document.getElementById('match-detail-result');
const matchDetailDate = document.getElementById('match-detail-date');
const matchDetailLog = document.getElementById('match-detail-log');

// Initialize UI
function init() {
  renderDeckList();
  updateStats();
  updateDeckNameDisplay();
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

// Update deck name display
function updateDeckNameDisplay() {
  currentDeckNameEl.textContent = currentDeckName;
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

function saveDeckToHistory(deckCards, customName = null) {
  if (deckCards.length === 0) return;

  const history = getDeckHistory();

  // Use custom name if provided, otherwise create a summary name from the deck's key Pokemon
  let deckName;
  if (customName && customName.trim()) {
    deckName = customName.trim();
  } else {
    const pokemonCards = deckCards.filter(c => c.type === 'Pokemon');
    const topCards = pokemonCards.slice(0, 3).map(c => c.name);
    deckName = topCards.length > 0 ? topCards.join(', ') : 'Unnamed Deck';
  }

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

  currentDeckName = entry.name;
  renderDeckList();
  updateStats();
  updateDeckNameDisplay();
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

    // Create info section
    const infoEl = document.createElement('div');
    infoEl.className = 'history-entry-info';
    infoEl.innerHTML = `
      <div class="history-entry-name">${entry.name}</div>
      <div class="history-entry-meta">${entry.totalCards} cards - ${dateStr} ${timeStr}</div>
    `;

    // Create actions section
    const actionsEl = document.createElement('div');
    actionsEl.className = 'history-entry-actions';

    // Create Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn history-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => {
      console.log('Edit button clicked for index:', index);
      editDeckFromHistory(index);
    };

    // Create Load button
    const loadBtn = document.createElement('button');
    loadBtn.className = 'action-btn history-load-btn';
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
      console.log('Load button clicked for index:', index);
      loadDeckFromHistory(index);
    };

    // Create Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn secondary history-delete-btn';
    deleteBtn.textContent = 'X';
    deleteBtn.onclick = () => {
      console.log('Delete button clicked for index:', index);
      deleteDeckFromHistory(index);
    };

    actionsEl.appendChild(editBtn);
    actionsEl.appendChild(loadBtn);
    actionsEl.appendChild(deleteBtn);

    entryEl.appendChild(infoEl);
    entryEl.appendChild(actionsEl);

    deckHistoryList.appendChild(entryEl);
  });

  console.log('History list rendered with', history.length, 'entries');
}

function renameDeckInHistory(index, newName) {
  const history = getDeckHistory();
  if (index < 0 || index >= history.length) return;

  if (!newName || !newName.trim()) {
    alert('Please enter a valid deck name');
    return;
  }

  history[index].name = newName.trim();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistoryList();
}

function editDeckFromHistory(index) {
  const history = getDeckHistory();
  if (index < 0 || index >= history.length) return;

  const entry = history[index];

  // Load the deck into the builder
  builderDeck = entry.cards.map(card => ({
    id: card.id,
    name: card.name,
    count: card.count,
    type: card.type,
    imageUrl: card.imageUrl,
    set: card.set || '',
    number: card.number || ''
  }));

  // Set the deck name in the builder
  builderDeckName.value = entry.name;

  // Reset filters
  currentFilter = 'all';
  standardOnly = false;
  filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === 'all');
  });
  standardOnlyToggle.checked = false;

  // Clear search
  cardSearchInput.value = '';
  searchResults.innerHTML = '<div class="search-placeholder">Type to search for cards...</div>';

  // Render the deck in the builder
  renderBuilderDeck();

  // Close history modal and open deck builder
  closeHistory();
  deckBuilderModal.classList.add('active');
  cardSearchInput.focus();
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
  builderDeckName.value = currentDeckName !== 'No Deck Loaded' ? currentDeckName : '';
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

  const customName = builderDeckName.value.trim();

  // Determine the deck name
  if (customName) {
    currentDeckName = customName;
  } else {
    const pokemonCards = deck.filter(c => c.type === 'Pokemon');
    const topCards = pokemonCards.slice(0, 3).map(c => c.name);
    currentDeckName = topCards.length > 0 ? topCards.join(', ') : 'Unnamed Deck';
  }

  saveDeckToHistory(deck, customName);
  renderDeckList();
  updateStats();
  updateDeckNameDisplay();
  closeDeckBuilder();
}

// ========== Import Deck Functions ==========

function openImportDeck() {
  deckImportText.value = '';
  importDeckName.value = '';
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

  const customName = importDeckName.value.trim();

  // Determine the deck name
  if (customName) {
    currentDeckName = customName;
  } else {
    const pokemonCards = deck.filter(c => c.type === 'Pokemon');
    const topCards = pokemonCards.slice(0, 3).map(c => c.name);
    currentDeckName = topCards.length > 0 ? topCards.join(', ') : 'Unnamed Deck';
  }

  saveDeckToHistory(deck, customName);
  renderDeckList();
  updateStats();
  updateDeckNameDisplay();
  closeImportDeck();
}

// ========== Match History Functions ==========

function getMatchHistory() {
  try {
    const history = localStorage.getItem(MATCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

function saveMatch(parsedLog) {
  const history = getMatchHistory();
  history.unshift(parsedLog);
  if (history.length > MAX_MATCHES) {
    history.length = MAX_MATCHES;
  }
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(history));
}

function deleteMatch(id) {
  let history = getMatchHistory();
  history = history.filter(m => m.id !== id);
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(history));
  renderMatchHistoryList();
}

function openImportMatch() {
  matchImportText.value = '';
  matchImportError.textContent = '';
  matchImportError.classList.remove('visible');
  importMatchModal.classList.add('active');
  matchImportText.focus();
}

function closeImportMatch() {
  importMatchModal.classList.remove('active');
}

function importMatch() {
  const text = matchImportText.value.trim();
  if (!text) {
    matchImportError.textContent = 'Please paste a game log';
    matchImportError.classList.add('visible');
    return;
  }

  try {
    const parsed = parseGameLog(text);

    if (parsed.turns.length === 0 && parsed.setup.length === 0) {
      matchImportError.textContent = 'Could not parse the game log. Make sure you paste the full log from Pokemon TCG Live.';
      matchImportError.classList.add('visible');
      return;
    }

    saveMatch(parsed);
    closeImportMatch();
    openMatchHistory();
  } catch (err) {
    matchImportError.textContent = 'Error parsing game log: ' + err.message;
    matchImportError.classList.add('visible');
  }
}

function openMatchHistory() {
  renderMatchHistoryList();
  matchHistoryModal.classList.add('active');
}

function closeMatchHistory() {
  matchHistoryModal.classList.remove('active');
}

function renderMatchHistoryList() {
  const history = getMatchHistory();
  matchHistoryList.innerHTML = '';

  if (history.length === 0) {
    matchHistoryList.innerHTML = '<div class="empty-state">No matches recorded yet. Import a game log to get started.</div>';
    return;
  }

  history.forEach((match) => {
    const entryEl = document.createElement('div');
    entryEl.className = 'history-entry match-history-entry';

    const date = new Date(match.timestamp);
    const dateStr = date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit'
    });

    const resultClass = match.result === 'win' ? 'result-win' : match.result === 'loss' ? 'result-loss' : 'result-unknown';
    const resultText = match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : '?';

    const infoEl = document.createElement('div');
    infoEl.className = 'history-entry-info';
    infoEl.style.cursor = 'pointer';
    infoEl.innerHTML = `
      <div class="history-entry-name">
        <span class="match-result-badge ${resultClass}">${resultText}</span>
        vs. ${match.opponentName}
      </div>
      <div class="history-entry-meta">${match.turns.length} turns - ${dateStr} ${timeStr}</div>
    `;
    infoEl.onclick = () => openMatchDetail(match.id);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'history-entry-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn secondary history-delete-btn';
    deleteBtn.textContent = 'X';
    deleteBtn.onclick = () => deleteMatch(match.id);

    actionsEl.appendChild(deleteBtn);

    entryEl.appendChild(infoEl);
    entryEl.appendChild(actionsEl);
    matchHistoryList.appendChild(entryEl);
  });
}

function openMatchDetail(matchId) {
  const history = getMatchHistory();
  const match = history.find(m => m.id === matchId);
  if (!match) return;

  // Set header info
  matchDetailOpponent.textContent = `vs. ${match.opponentName}`;

  const resultClass = match.result === 'win' ? 'result-win' : match.result === 'loss' ? 'result-loss' : 'result-unknown';
  const resultText = match.result === 'win' ? 'WIN' : match.result === 'loss' ? 'LOSS' : '???';
  matchDetailResult.textContent = resultText;
  matchDetailResult.className = `match-result-badge ${resultClass}`;

  const date = new Date(match.timestamp);
  matchDetailDate.textContent = date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }) + ' ' + date.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit'
  });

  // Render turn-by-turn log
  matchDetailLog.innerHTML = '';

  // Setup section
  if (match.setup.length > 0) {
    const setupSection = createTurnSection('Setup', match.setup, true);
    matchDetailLog.appendChild(setupSection);
  }

  // Turn sections
  match.turns.forEach((turn) => {
    const turnLabel = `Turn ${turn.turnNumber}` + (turn.player ? ` — ${turn.player}` : '');
    const isUserTurn = turn.player === match.playerName;
    const turnSection = createTurnSection(turnLabel, turn.actions, false, isUserTurn);
    matchDetailLog.appendChild(turnSection);
  });

  // Hide match history, show detail
  matchHistoryModal.classList.remove('active');
  matchDetailModal.classList.add('active');
}

function createTurnSection(label, lines, startExpanded = false, isUserTurn = false) {
  const section = document.createElement('div');
  section.className = 'turn-section';

  const header = document.createElement('div');
  header.className = 'turn-section-header' + (isUserTurn ? ' user-turn' : '');
  header.innerHTML = `<span class="turn-toggle">${startExpanded ? '▼' : '▶'}</span> ${label}`;

  const content = document.createElement('div');
  content.className = 'turn-section-content';
  if (!startExpanded) {
    content.style.display = 'none';
  }

  lines.forEach(line => {
    const lineEl = document.createElement('div');
    lineEl.className = 'turn-action-line';
    lineEl.textContent = line;
    content.appendChild(lineEl);
  });

  header.onclick = () => {
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    header.querySelector('.turn-toggle').textContent = isOpen ? '▶' : '▼';
  };

  section.appendChild(header);
  section.appendChild(content);
  return section;
}

function closeMatchDetail() {
  matchDetailModal.classList.remove('active');
  openMatchHistory();
}

// Event Listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  console.log('deckHistoryList element:', deckHistoryList);

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

  // ========== Match History Events ==========
  matchesBtn.addEventListener('click', openMatchHistory);
  importMatchBtn.addEventListener('click', importMatch);
  cancelImportMatchBtn.addEventListener('click', closeImportMatch);
  importMatchFromHistoryBtn.addEventListener('click', () => {
    closeMatchHistory();
    openImportMatch();
  });
  closeMatchHistoryBtn.addEventListener('click', closeMatchHistory);
  matchDetailBackBtn.addEventListener('click', closeMatchDetail);

  // Note: Individual button click handlers are now set up in renderHistoryList()
  console.log('History event listeners set up');
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
    if (importMatchModal.classList.contains('active')) {
      closeImportMatch();
    }
    if (matchDetailModal.classList.contains('active')) {
      closeMatchDetail();
    }
    if (matchHistoryModal.classList.contains('active')) {
      closeMatchHistory();
    }
  }
});

// Initialize app
init();
