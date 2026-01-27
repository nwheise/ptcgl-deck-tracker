const fs = require('fs');
const path = require('path');

class CardDatabase {
  constructor() {
    this.cards = [];
    this.cardIndex = new Map();
    this.setIndex = new Map(); // Map from set ID to set info
    this.loaded = false;
  }

  load() {
    if (this.loaded) return;

    // Load set data first
    this.loadSets();

    const cardsDir = path.join(__dirname, 'pokemon-tcg-data', 'cards', 'en');

    if (!fs.existsSync(cardsDir)) {
      console.error('Card database directory not found:', cardsDir);
      return;
    }

    const setFiles = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'));

    for (const setFile of setFiles) {
      try {
        const setPath = path.join(cardsDir, setFile);
        const setData = JSON.parse(fs.readFileSync(setPath, 'utf8'));
        const setId = setFile.replace('.json', '');

        for (const card of setData) {
          const setInfo = this.setIndex.get(setId);
          const cardEntry = {
            id: card.id,
            name: card.name,
            supertype: card.supertype,
            subtypes: card.subtypes || [],
            hp: card.hp,
            types: card.types || [],
            set: setId,
            setName: setInfo ? setInfo.name : setId,
            number: card.number,
            rarity: card.rarity,
            images: card.images || {},
            legalities: card.legalities || {}
          };

          this.cards.push(cardEntry);

          // Index by lowercase name for searching
          const nameLower = card.name.toLowerCase();
          if (!this.cardIndex.has(nameLower)) {
            this.cardIndex.set(nameLower, []);
          }
          this.cardIndex.get(nameLower).push(cardEntry);
        }
      } catch (err) {
        console.error(`Error loading ${setFile}:`, err.message);
      }
    }

    this.loaded = true;
    console.log(`Loaded ${this.cards.length} cards from ${setFiles.length} sets`);
  }

  loadSets() {
    const setsPath = path.join(__dirname, 'pokemon-tcg-data', 'sets', 'en.json');

    if (!fs.existsSync(setsPath)) {
      console.error('Sets file not found:', setsPath);
      return;
    }

    try {
      const setsData = JSON.parse(fs.readFileSync(setsPath, 'utf8'));

      for (const set of setsData) {
        this.setIndex.set(set.id, {
          id: set.id,
          name: set.name,
          series: set.series,
          legalities: set.legalities || {},
          releaseDate: set.releaseDate
        });
      }

      console.log(`Loaded ${this.setIndex.size} sets`);
    } catch (err) {
      console.error('Error loading sets:', err.message);
    }
  }

  getSetName(setId) {
    const set = this.setIndex.get(setId);
    return set ? set.name : setId;
  }

  getSetInfo(setId) {
    return this.setIndex.get(setId);
  }

  search(query, options = {}) {
    const { limit = 50, supertype = null, standardOnly = false } = options;

    if (!query || query.length < 2) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const results = [];
    const seen = new Set();

    for (const card of this.cards) {
      if (results.length >= limit) break;

      // Filter by supertype if specified
      if (supertype && card.supertype !== supertype) continue;

      // Filter by standard legality if specified
      if (standardOnly && card.legalities?.standard !== 'Legal') continue;

      // Match by name
      if (card.name.toLowerCase().includes(queryLower)) {
        // Use name + set as unique key to avoid exact duplicates
        const key = `${card.name}-${card.set}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(card);
        }
      }
    }

    // Sort results: exact matches first, then by name, then by set (newer first)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === queryLower;
      const bExact = b.name.toLowerCase() === queryLower;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;

      // Sort by set in descending order (newer sets first)
      return b.set.localeCompare(a.set);
    });

    return results;
  }

  getCardById(id) {
    return this.cards.find(c => c.id === id);
  }

  getCardsByName(name) {
    const nameLower = name.toLowerCase();
    return this.cardIndex.get(nameLower) || [];
  }

  getUniqueCardNames(query, limit = 20) {
    const queryLower = query.toLowerCase();
    const names = new Map();

    for (const card of this.cards) {
      if (names.size >= limit) break;

      if (card.name.toLowerCase().includes(queryLower)) {
        if (!names.has(card.name)) {
          names.set(card.name, {
            name: card.name,
            supertype: card.supertype,
            subtypes: card.subtypes,
            // Get a representative card for the image
            representativeCard: card
          });
        }
      }
    }

    return Array.from(names.values());
  }
}

module.exports = new CardDatabase();
