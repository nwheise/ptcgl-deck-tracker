#!/usr/bin/env node
/**
 * Pokemon TCG Card Sync Script
 *
 * Fetches Standard format card data from the Pokemon TCG API (https://pokemontcg.io)
 * and stores it locally for the deck tracker to use.
 */

const pokemon = require('pokemontcgsdk');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CARDS_FILE = path.join(DATA_DIR, 'cards.json');
const SETS_FILE = path.join(DATA_DIR, 'sets.json');
const CARD_INDEX_FILE = path.join(DATA_DIR, 'card-index.json');

async function fetchSets() {
  console.log('Fetching sets...');
  const sets = await pokemon.set.all();
  return sets.sort(function(a, b) {
    return new Date(b.releaseDate) - new Date(a.releaseDate);
  });
}

// Fetch cards for a specific set
async function fetchCardsForSet(setId) {
  const cards = await pokemon.card.all({ q: `set.id:${setId}` });
  console.log(`  Fetched ${cards.length} cards`);
  return cards;
}

// Process card data into a simplified format for the deck tracker
function processCard(card) {
  const set = card.set || {};
  const images = card.images || {};
  return {
    id: card.id,
    name: card.name,
    supertype: card.supertype,
    subtypes: card.subtypes || [],
    types: card.types || [],
    hp: card.hp,
    set: {
      id: set.id,
      name: set.name,
      series: set.series
    },
    number: card.number,
    rarity: card.rarity,
    legalities: card.legalities || {},
    images: {
      small: images.small,
      large: images.large
    },
    evolvesFrom: card.evolvesFrom,
    evolvesTo: card.evolvesTo,
    attacks: card.attacks ? card.attacks.map(function(attack) {
      return {
        name: attack.name,
        cost: attack.cost,
        damage: attack.damage,
        text: attack.text
      };
    }) : undefined,
    abilities: card.abilities ? card.abilities.map(function(ability) {
      return {
        name: ability.name,
        text: ability.text,
        type: ability.type
      };
    }) : undefined,
    weaknesses: card.weaknesses,
    resistances: card.resistances,
    retreatCost: card.retreatCost,
    rules: card.rules
  };
}

// Build a name-based index for quick lookups
function buildCardIndex(cards) {
  const index = {};

  for (const card of cards) {
    const normalizedName = card.name.toLowerCase().trim();

    if (!index[normalizedName]) {
      index[normalizedName] = [];
    }

    index[normalizedName].push({
      id: card.id,
      name: card.name,
      supertype: card.supertype,
      set: card.set.id,
      number: card.number
    });
  }

  return index;
}

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

async function syncCards() {
  console.log('='.repeat(50));
  console.log('Pokemon TCG Card Sync (Standard Format)');
  console.log('='.repeat(50));
  console.log();

  ensureDataDir();

  const allSets = await fetchSets();
  var sets = allSets.filter(function(set) {
    return set.legalities && set.legalities.standard === 'Legal';
  });
  console.log(`Found ${sets.length} Standard legal sets (of ${allSets.length} total)\n`);

  fs.writeFileSync(SETS_FILE, JSON.stringify(sets, null, 2));
  console.log(`Saved sets metadata to ${path.relative(process.cwd(), SETS_FILE)}\n`);

  // Fetch all cards
  const allCards = [];

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    console.log(`[${i + 1}/${sets.length}] Fetching ${set.name} (${set.id})...`);

    try {
      const cards = await fetchCardsForSet(set.id);
      const processedCards = cards.map(processCard);
      allCards.push(...processedCards);
    } catch (error) {
      console.error(`  Error fetching ${set.id}: ${error.message}`);
    }
  }

  console.log(`\nTotal cards fetched: ${allCards.length}`);

  // Save cards
  fs.writeFileSync(CARDS_FILE, JSON.stringify(allCards, null, 2));
  console.log(`Saved cards to ${path.relative(process.cwd(), CARDS_FILE)}`);

  // Build and save index
  const cardIndex = buildCardIndex(allCards);
  fs.writeFileSync(CARD_INDEX_FILE, JSON.stringify(cardIndex, null, 2));
  console.log(`Saved card index to ${path.relative(process.cwd(), CARD_INDEX_FILE)}`);

  // Summary
  const supertypes = {};
  allCards.forEach(card => {
    supertypes[card.supertype] = (supertypes[card.supertype] || 0) + 1;
  });

  console.log('\n' + '='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Total cards: ${allCards.length}`);
  console.log(`Unique card names: ${Object.keys(cardIndex).length}`);
  Object.entries(supertypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log('\nSync complete!');
}

syncCards().catch(error => {
  console.error('\nSync failed:', error.message);
  process.exit(1);
});
