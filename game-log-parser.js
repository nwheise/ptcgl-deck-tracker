// Game Log Parser for Pokemon TCG Live game logs

/**
 * Parse a Pokemon TCG Live game log into a structured match object.
 * @param {string} text - The raw game log text
 * @returns {object} Parsed match object
 */
function parseGameLog(text) {
  const lines = text.split('\n');

  // Find all unique player names from the log
  const playerNames = detectPlayers(lines);
  const userPlayer = detectUserPlayer(lines, playerNames);
  const opponentPlayer = playerNames.find(n => n !== userPlayer) || 'Unknown';
  const result = detectResult(lines, userPlayer);

  // Split into setup and turns
  const { setup, turns } = splitIntoTurns(lines, playerNames);

  return {
    id: `match-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    playerName: userPlayer,
    opponentName: opponentPlayer,
    result,
    setup,
    turns,
    rawLog: text
  };
}

/**
 * Detect all player names mentioned in the log.
 */
function detectPlayers(lines) {
  const players = new Set();

  for (const line of lines) {
    // Match patterns like "PlayerName drew", "PlayerName played", "PlayerName chose", etc.
    const actionMatch = line.match(/^(\S+)\s+(drew|played|chose|won|decided|took|ended|evolved|attached|used|retreated|didn't)/);
    if (actionMatch) {
      players.add(actionMatch[1]);
    }

    // Match "PlayerName's Turn"
    const turnMatch = line.match(/^(\S+)'s Turn$/);
    if (turnMatch) {
      // This is the placeholder — actual player names come from action lines
    }
  }

  // Filter out non-player strings
  players.delete('Opponent');
  players.delete('Setup');

  return Array.from(players);
}

/**
 * Detect which player is the user (the one whose hand contents are revealed).
 * In PTCGL logs, the user's opening hand cards are shown with bullet points.
 */
function detectUserPlayer(lines, playerNames) {
  // The user's opening hand is revealed with bullet points (•) immediately
  // after the "- N drawn cards." line. The opponent's hand is NOT revealed.
  // Pattern: "PlayerName drew 7 cards..." → "- 7 drawn cards." → "   • card1, card2..."
  for (let i = 0; i < lines.length; i++) {
    const drawMatch = lines[i].match(/^(\S+) drew \d+ cards for the opening hand/);
    if (drawMatch) {
      const name = drawMatch[1];
      // The next line should be "- N drawn cards." and the line after should have bullets
      if (i + 2 < lines.length &&
          lines[i + 1].trim().startsWith('- ') &&
          lines[i + 2].trim().startsWith('•')) {
        return name;
      }
    }
  }

  return playerNames[0] || 'Unknown';
}

/**
 * Detect the match result for the user.
 */
function detectResult(lines, userPlayer) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    // "Opponent conceded. PlayerName wins."
    // "PlayerName wins."
    // "PlayerName took all Prize cards. PlayerName wins."
    const winMatch = line.match(/(\S+) wins\.?$/);
    if (winMatch) {
      return winMatch[1] === userPlayer ? 'win' : 'loss';
    }
  }

  return 'unknown';
}

/**
 * Split the log into setup lines and turn objects.
 */
function splitIntoTurns(lines, playerNames) {
  const setup = [];
  const turns = [];
  let currentTurn = null;
  let inSetup = true;
  let turnNumber = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for turn marker: "[playerName]'s Turn"
    // The log uses a placeholder "[playerName]'s Turn" but actual names appear in actions
    if (trimmed === "[playerName]'s Turn" || playerNames.some(p => trimmed === `${p}'s Turn`)) {
      inSetup = false;

      // Save previous turn if exists
      if (currentTurn) {
        turns.push(currentTurn);
      }

      turnNumber++;
      currentTurn = {
        turnNumber,
        player: '', // Will be determined from first action
        actions: []
      };
      continue;
    }

    if (inSetup) {
      if (trimmed) {
        setup.push(trimmed);
      }
    } else if (currentTurn) {
      if (trimmed) {
        currentTurn.actions.push(trimmed);

        // Detect turn player from first action line
        if (!currentTurn.player) {
          for (const name of playerNames) {
            if (trimmed.startsWith(name + ' ')) {
              currentTurn.player = name;
              break;
            }
          }
        }
      }
    }
  }

  // Push final turn
  if (currentTurn) {
    turns.push(currentTurn);
  }

  return { setup, turns };
}

module.exports = { parseGameLog };
