#!/usr/bin/env node
/**
 * Pokemon TCG Card Sync Script
 *
 * Fetches the latest card data from the Pokemon TCG API (https://pokemontcg.io)
 * and stores it locally for the deck tracker to use.
 *
 * Usage:
 *   node scripts/sync-cards.js [options]
 *
 * Options:
 *   --sets <set1,set2>   Sync specific sets only (e.g., sv1,sv2,sv3)
 *   --all                Sync all available sets (may take a while)
 *   --standard           Sync only Standard format legal sets
 *   --api-key <key>      Use API key for higher rate limits
 *
 * The Pokemon TCG API is free to use without an API key, but rate limits apply.
 * Get an API key at: https://dev.pokemontcg.io
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// API Configuration
const API_BASE_URL = 'https://api.pokemontcg.io/v2';
const DEFAULT_PAGE_SIZE = 250;
const RATE_LIMIT_DELAY = 100; // ms between requests

// Output paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const CARDS_FILE = path.join(DATA_DIR, 'cards.json');
const SETS_FILE = path.join(DATA_DIR, 'sets.json');
const CARD_INDEX_FILE = path.join(DATA_DIR, 'card-index.json');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sets: null,
    all: false,
    standard: false,
    apiKey: process.env.POKEMON_TCG_API_KEY || null
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sets':
        options.sets = args[++i]?.split(',').map(s => s.trim());
        break;
      case '--all':
        options.all = true;
        break;
      case '--standard':
        options.standard = true;
        break;
      case '--api-key':
        options.apiKey = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Pokemon TCG Card Sync Script

Fetches the latest card data from the Pokemon TCG API and stores it locally.

Usage:
  node scripts/sync-cards.js [options]

Options:
  --sets <set1,set2>   Sync specific sets only (e.g., sv1,sv2,sv3)
  --all                Sync all available sets
  --standard           Sync only Standard format legal sets
  --api-key <key>      Use API key for higher rate limits
  --help, -h           Show this help message

Examples:
  node scripts/sync-cards.js --standard
  node scripts/sync-cards.js --sets sv1,sv2,sv3,sv4
  node scripts/sync-cards.js --all --api-key YOUR_API_KEY

Environment Variables:
  POKEMON_TCG_API_KEY  API key for higher rate limits

Get an API key at: https://dev.pokemontcg.io
`);
}

// HTTPS request helper
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'pokemon-tcg-deck-tracker/1.0',
        'Accept': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve({ data: JSON.parse(data), statusCode: res.statusCode });
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else if (res.statusCode === 429) {
          resolve({ data: null, statusCode: 429 });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}

// Fetch helper with rate limiting and retries
async function fetchWithRetry(url, headers = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await httpsGet(url, headers);

      if (response.statusCode === 429) {
        // Rate limited - wait and retry
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`  Rate limited. Waiting ${waitTime / 1000}s before retry...`);
        await sleep(waitTime);
        continue;
      }

      return response.data;
    } catch (error) {
      if (attempt === retries) throw error;
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`  Request failed. Retrying in ${waitTime / 1000}s... (${error.message})`);
      await sleep(waitTime);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch all available sets
async function fetchSets(apiKey) {
  console.log('Fetching available sets...');

  const headers = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;

  const data = await fetchWithRetry(`${API_BASE_URL}/sets?orderBy=-releaseDate`, headers);
  return data.data;
}

// Fetch cards for a specific set
async function fetchCardsForSet(setId, apiKey) {
  const headers = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;

  let allCards = [];
  let page = 1;
  let totalCount = null;

  do {
    const url = `${API_BASE_URL}/cards?q=set.id:${setId}&pageSize=${DEFAULT_PAGE_SIZE}&page=${page}`;
    const data = await fetchWithRetry(url, headers);

    allCards = allCards.concat(data.data);
    totalCount = data.totalCount;

    process.stdout.write(`\r  Fetched ${allCards.length}/${totalCount} cards`);

    page++;
    await sleep(RATE_LIMIT_DELAY);
  } while (allCards.length < totalCount);

  console.log(); // New line after progress
  return allCards;
}

// Process card data into a simplified format for the deck tracker
function processCard(card) {
  return {
    id: card.id,
    name: card.name,
    supertype: card.supertype,
    subtypes: card.subtypes || [],
    types: card.types || [],
    hp: card.hp,
    set: {
      id: card.set?.id,
      name: card.set?.name,
      series: card.set?.series
    },
    number: card.number,
    rarity: card.rarity,
    legalities: card.legalities || {},
    images: {
      small: card.images?.small,
      large: card.images?.large
    },
    // Pokemon-specific fields
    evolvesFrom: card.evolvesFrom,
    evolvesTo: card.evolvesTo,
    attacks: card.attacks?.map(attack => ({
      name: attack.name,
      cost: attack.cost,
      damage: attack.damage,
      text: attack.text
    })),
    abilities: card.abilities?.map(ability => ({
      name: ability.name,
      text: ability.text,
      type: ability.type
    })),
    weaknesses: card.weaknesses,
    resistances: card.resistances,
    retreatCost: card.retreatCost,
    // Trainer/Energy specific
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

// Main sync function
async function syncCards(options) {
  console.log('='.repeat(50));
  console.log('Pokemon TCG Card Sync');
  console.log('='.repeat(50));
  console.log();

  ensureDataDir();

  // Fetch sets
  const allSets = await fetchSets(options.apiKey);
  console.log(`Found ${allSets.length} sets\n`);

  // Determine which sets to sync
  let setsToSync = allSets;

  if (options.sets) {
    // Sync specific sets
    setsToSync = allSets.filter(set => options.sets.includes(set.id));
    if (setsToSync.length === 0) {
      console.error('Error: No matching sets found for:', options.sets.join(', '));
      console.log('\nAvailable sets:');
      allSets.slice(0, 20).forEach(set => console.log(`  ${set.id}: ${set.name}`));
      process.exit(1);
    }
  } else if (options.standard) {
    // Sync only Standard legal sets
    setsToSync = allSets.filter(set => set.legalities?.standard === 'Legal');
  } else if (!options.all) {
    // Default: sync recent Scarlet & Violet sets (most relevant for PTCGL)
    const svSets = allSets.filter(set =>
      set.series === 'Scarlet & Violet' ||
      set.id.startsWith('sv')
    );

    if (svSets.length > 0) {
      setsToSync = svSets;
      console.log('Defaulting to Scarlet & Violet series sets.');
      console.log('Use --all for all sets, --standard for Standard legal, or --sets for specific sets.\n');
    }
  }

  console.log(`Syncing ${setsToSync.length} sets...\n`);

  // Save sets metadata
  fs.writeFileSync(SETS_FILE, JSON.stringify(setsToSync, null, 2));
  console.log(`Saved sets metadata to ${path.relative(process.cwd(), SETS_FILE)}\n`);

  // Fetch all cards
  const allCards = [];

  for (let i = 0; i < setsToSync.length; i++) {
    const set = setsToSync[i];
    console.log(`[${i + 1}/${setsToSync.length}] Fetching ${set.name} (${set.id})...`);

    try {
      const cards = await fetchCardsForSet(set.id, options.apiKey);
      const processedCards = cards.map(processCard);
      allCards.push(...processedCards);
    } catch (error) {
      console.error(`  Error fetching ${set.id}: ${error.message}`);
    }

    // Add delay between sets
    await sleep(RATE_LIMIT_DELAY * 2);
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

// Run
const options = parseArgs();

if (!options.sets && !options.all && !options.standard) {
  console.log('No options specified. Will sync Scarlet & Violet sets by default.');
  console.log('Run with --help for more options.\n');
}

syncCards(options).catch(error => {
  console.error('\nSync failed:', error.message);
  console.error('\nNote: This script requires internet access to the Pokemon TCG API.');
  console.error('If you are behind a firewall or have network restrictions, you may need to:');
  console.error('  1. Check your network connection');
  console.error('  2. Configure proxy settings if required');
  console.error('  3. Ensure api.pokemontcg.io is accessible');
  process.exit(1);
});
