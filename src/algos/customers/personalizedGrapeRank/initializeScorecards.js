#!/usr/bin/env node

/**
 * initializeScorecards.js
 * 
 * This script creates a scorecards_init.json file in the temporary directory by:
 * 1. Reading ratees.csv from the temporary directory
 * 2. For each ratee_pubkey, adding a property with key equal to the ratee_pubkey and value [0,0,0,0]
 * 3. Setting the value for BRAINSTORM_OWNER_PUBKEY to [1,1,1,9999]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Extract CUSTOMER_PUBKEY, CUSTOMER_ID, CUSTOMER_NAME, and optional WARM_START flag
const CUSTOMER_PUBKEY = process.argv[2];
const CUSTOMER_ID = process.argv[3];
const CUSTOMER_NAME = process.argv[4];
const WARM_START = process.argv[5] === 'warmStart';

const CONFIG_FILES = {
  brainstorm: '/etc/brainstorm.conf'
};

// Get Neo4j configuration from brainstorm.conf (same pattern as updateNeo4jWithApoc.js)
function getNeo4jConfig() {
  try {
    const neo4jUri = execSync(`source ${CONFIG_FILES.brainstorm} && echo $NEO4J_URI`, {
      shell: '/bin/bash',
      encoding: 'utf8'
    }).trim();

    const neo4jUsername = execSync(`source ${CONFIG_FILES.brainstorm} && echo $NEO4J_USER`, {
      shell: '/bin/bash',
      encoding: 'utf8'
    }).trim();

    const neo4jPassword = execSync(`source ${CONFIG_FILES.brainstorm} && echo $NEO4J_PASSWORD`, {
      shell: '/bin/bash',
      encoding: 'utf8'
    }).trim();

    if (!neo4jUri || !neo4jUsername || !neo4jPassword) {
      throw new Error('Missing Neo4j connection details in brainstorm.conf');
    }

    return { uri: neo4jUri, username: neo4jUsername, password: neo4jPassword };
  } catch (error) {
    console.error(`Error loading Neo4j configuration: ${error.message}`);
    return null;
  }
}

// Load existing scorecards from Neo4j for warm start
function loadScorecardsFromNeo4j(customerId) {
  const neo4jConfig = getNeo4jConfig();
  if (!neo4jConfig) {
    return {};
  }

  const cypher = `MATCH (u:NostrUserWotMetricsCard {customer_id: ${customerId}}) WHERE u.influence IS NOT NULL RETURN u.observee_pubkey AS pubkey, u.influence AS influence, u.average AS average, u.confidence AS confidence, u.input AS input`;

  const command = `cypher-shell -a "${neo4jConfig.uri}" -u "${neo4jConfig.username}" -p "${neo4jConfig.password}" "${cypher}" --format plain`;

  const output = execSync(command, { encoding: 'utf8', timeout: 60000 });

  const scorecards = {};
  const lines = output.trim().split('\n');
  // Skip header line, parse each data row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse tab-separated or comma-separated values, strip quotes
    const parts = line.split(/[,\t]/).map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 5 && parts[0]) {
      scorecards[parts[0]] = [
        parseFloat(parts[1]) || 0,
        parseFloat(parts[2]) || 0,
        parseFloat(parts[3]) || 0,
        parseFloat(parts[4]) || 0
      ];
    }
  }
  return scorecards;
}

// Main function
async function main() {
  try {
    console.log('Initializing scorecards for CUSTOMER_PUBKEY: ' + CUSTOMER_PUBKEY + ' CUSTOMER_ID: ' + CUSTOMER_ID + ' CUSTOMER_NAME: ' + CUSTOMER_NAME);
    
    // Define paths
    const tempDir = '/var/lib/brainstorm/algos/personalizedGrapeRank/tmp';
    const rateesFile = path.join(tempDir, 'ratees.csv');
    const scorecardsFile = path.join(tempDir, CUSTOMER_NAME, 'scorecards_init.json');
    
    const observerPubkey = CUSTOMER_PUBKEY
    
    // Initialize scorecards object
    const scorecards = {};

    // Set default value for observer pubkey
    scorecards[observerPubkey] = [1, 1, 1, 9999];

    // Load existing scores from Neo4j if warm start is enabled
    let neo4jScorecards = {};
    if (WARM_START) {
      try {
        neo4jScorecards = loadScorecardsFromNeo4j(CUSTOMER_ID);
        console.log(`Warm start: loaded ${Object.keys(neo4jScorecards).length} existing scores from Neo4j`);
      } catch (error) {
        console.warn(`Warm start failed, falling back to cold start: ${error.message}`);
        neo4jScorecards = {};
      }
    }

    // Check if ratees.csv exists
    if (!fs.existsSync(rateesFile)) {
      console.error(`Ratees file not found: ${rateesFile}`);
      process.exit(1);
    }

    // Create readline interface
    const fileStream = fs.createReadStream(rateesFile);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    // Skip header line
    let isFirstLine = true;
    let warmCount = 0;
    let coldCount = 0;

    // Process each line
    for await (const line of rl) {
      // Skip header
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }

      // Skip empty lines
      if (!line.trim()) continue;

      // Extract ratee_pubkey (remove quotes if present)
      const ratee_pubkey = line.trim().replace(/"/g, '');

      // Skip if empty or already in scorecards
      if (!ratee_pubkey || scorecards[ratee_pubkey]) continue;

      // Use Neo4j score if available (warm start), otherwise cold start [0,0,0,0]
      if (neo4jScorecards[ratee_pubkey]) {
        scorecards[ratee_pubkey] = neo4jScorecards[ratee_pubkey];
        warmCount++;
      } else {
        scorecards[ratee_pubkey] = [0, 0, 0, 0];
        coldCount++;
      }
    }

    // Write scorecards to file
    fs.writeFileSync(scorecardsFile, JSON.stringify(scorecards, null, 2));

    if (WARM_START) {
      console.log(`Successfully created scorecards_init.json: ${warmCount} warm-started, ${coldCount} cold-started, ${Object.keys(scorecards).length} total`);
    } else {
      console.log(`Successfully created scorecards_init.json with ${Object.keys(scorecards).length} entries (cold start)`);
    }
  } catch (error) {
    console.error(`Error initializing scorecards: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
