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
const { emitTaskEvent } = require('../../../utils/structuredLogging');

// Extract CUSTOMER_PUBKEY, CUSTOMER_ID, CUSTOMER_NAME, and optional WARM_START flag
const CUSTOMER_PUBKEY = process.argv[2];
const CUSTOMER_ID = process.argv[3];
const CUSTOMER_NAME = process.argv[4];
const WARM_START = process.argv[5] === 'warmStart';

const CONFIG_FILES = {
  brainstorm: '/etc/brainstorm.conf'
};

// Maximum FOLLOWS-hop distance from the new customer TO the owner for
// the owner's scorecards to be a useful seed. FOLLOWS is directed; we
// want influence to actually propagate from the customer through the
// owner's network, which requires the owner to be downstream of the
// customer along FOLLOWS edges within this threshold.
const OWNER_SEED_MAX_HOPS = 3;

// Get the owner pubkey from brainstorm.conf (same execSync-based pattern
// used for Neo4j credentials).
function getOwnerPubkey() {
  try {
    const ownerPubkey = execSync(
      `source ${CONFIG_FILES.brainstorm} && echo $BRAINSTORM_OWNER_PUBKEY`,
      { shell: '/bin/bash', encoding: 'utf8' }
    ).trim();
    return ownerPubkey || null;
  } catch (error) {
    console.error(`Error reading BRAINSTORM_OWNER_PUBKEY: ${error.message}`);
    return null;
  }
}

// Is the owner reachable from the customer within OWNER_SEED_MAX_HOPS
// along directed FOLLOWS edges? Returns the hop count if yes, null if
// not (either no path within the cap or the query failed).
//
// Directionality matters: GrapeRank influence propagates from the
// observer (customer) outward along FOLLOWS. For the owner to have
// non-zero influence in the customer's POV — and therefore for the
// owner's scorecards to be a useful seed — there must be a directed
// FOLLOWS path FROM the customer TO the owner.
function checkOwnerReachable(customerPubkey, ownerPubkey, maxHops) {
  const neo4jConfig = getNeo4jConfig();
  if (!neo4jConfig) {
    return null;
  }

  // shortestPath with a length cap is cheap even on large graphs.
  const cypher = `MATCH p = shortestPath((c:NostrUser {pubkey: '${customerPubkey}'})-[:FOLLOWS*..${maxHops}]->(o:NostrUser {pubkey: '${ownerPubkey}'})) RETURN length(p) AS hops`;

  const command = `cypher-shell -a "${neo4jConfig.uri}" -u "${neo4jConfig.username}" -p "${neo4jConfig.password}" "${cypher}" --format plain`;

  try {
    const output = execSync(command, {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1 * 1024 * 1024
    });
    const lines = output.trim().split('\n');
    // Expect header line + 0 or 1 data line
    if (lines.length < 2) {
      return null;
    }
    const hops = parseInt(lines[1].trim(), 10);
    return Number.isFinite(hops) ? hops : null;
  } catch (error) {
    console.warn(`shortestPath query failed: ${error.message}`);
    return null;
  }
}

// Load the owner's scorecards directly from NostrUser nodes (the owner
// GrapeRank calculation writes influence/average/confidence/input as
// node properties, not into NostrUserWotMetricsCard). Returns a map
// {pubkey: [influence, average, confidence, input]}.
function loadOwnerScorecards() {
  const neo4jConfig = getNeo4jConfig();
  if (!neo4jConfig) {
    return {};
  }

  const cypher = `MATCH (u:NostrUser) WHERE u.influence IS NOT NULL RETURN u.pubkey AS pubkey, u.influence AS influence, u.average AS average, u.confidence AS confidence, u.input AS input`;

  const command = `cypher-shell -a "${neo4jConfig.uri}" -u "${neo4jConfig.username}" -p "${neo4jConfig.password}" "${cypher}" --format plain`;

  // maxBuffer: 500 MB handles ~2.5M rows; default 1 MB truncates at ~5k rows.
  const output = execSync(command, {
    encoding: 'utf8',
    timeout: 300000,
    maxBuffer: 500 * 1024 * 1024
  });

  const scorecards = {};
  const lines = output.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

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

  // maxBuffer: 500 MB handles ~2.5M rows; default 1 MB truncates at ~5k rows.
  // timeout: 5 minutes to accommodate large customers.
  const output = execSync(command, {
    encoding: 'utf8',
    timeout: 300000,
    maxBuffer: 500 * 1024 * 1024
  });

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

    // Load seed scores for warm start. Tiered fallback:
    //   1. Use the customer's own prior scorecards if present (normal warm start).
    //   2. Otherwise (first-time customer), if the owner is reachable from
    //      the customer within OWNER_SEED_MAX_HOPS via directed FOLLOWS,
    //      seed from the owner's scorecards.
    //   3. Otherwise, cold start.
    let neo4jScorecards = {};
    let warmStartStatus = 'disabled';
    let warmStartSource = 'disabled';  // 'self' | 'owner' | 'cold' | 'failed' | 'disabled'
    let warmStartError = null;
    let ownerSeedHops = null;
    if (WARM_START) {
      try {
        // Tier 0: prior scores for this customer
        neo4jScorecards = loadScorecardsFromNeo4j(CUSTOMER_ID);
        const selfCount = Object.keys(neo4jScorecards).length;
        if (selfCount > 0) {
          console.log(`Warm start: loaded ${selfCount} existing scores from Neo4j (source=self)`);
          warmStartStatus = 'loaded';
          warmStartSource = 'self';
        } else {
          // Tier 1: owner-seed fallback
          const ownerPubkey = getOwnerPubkey();
          if (!ownerPubkey) {
            console.warn('Warm start: no BRAINSTORM_OWNER_PUBKEY available; cold start');
            warmStartStatus = 'no_prior_scores';
            warmStartSource = 'cold';
          } else if (ownerPubkey === CUSTOMER_PUBKEY) {
            // Customer IS the owner; owner-seed would be self-seed but their
            // scores live on NostrUser nodes — fetch them.
            neo4jScorecards = loadOwnerScorecards();
            const ownerCount = Object.keys(neo4jScorecards).length;
            console.log(`Warm start: customer is the owner; loaded ${ownerCount} scores from NostrUser (source=owner)`);
            warmStartStatus = ownerCount > 0 ? 'loaded' : 'no_prior_scores';
            warmStartSource = ownerCount > 0 ? 'owner' : 'cold';
            ownerSeedHops = 0;
          } else {
            const hops = checkOwnerReachable(CUSTOMER_PUBKEY, ownerPubkey, OWNER_SEED_MAX_HOPS);
            if (hops !== null && hops <= OWNER_SEED_MAX_HOPS) {
              neo4jScorecards = loadOwnerScorecards();
              const ownerCount = Object.keys(neo4jScorecards).length;
              console.log(`Warm start: owner is ${hops} hop(s) downstream; loaded ${ownerCount} scores from NostrUser (source=owner)`);
              warmStartStatus = ownerCount > 0 ? 'loaded' : 'no_prior_scores';
              warmStartSource = ownerCount > 0 ? 'owner' : 'cold';
              ownerSeedHops = hops;
            } else {
              console.log(`Warm start: owner not within ${OWNER_SEED_MAX_HOPS} hops of customer; cold start (source=cold)`);
              warmStartStatus = 'no_prior_scores';
              warmStartSource = 'cold';
            }
          }
        }
      } catch (error) {
        console.warn(`Warm start failed, falling back to cold start: ${error.message}`);
        neo4jScorecards = {};
        warmStartStatus = 'failed';
        warmStartSource = 'failed';
        warmStartError = error.message;
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

    // Emit structured event so warm_start outcome is visible in task.html timeline
    try {
      await emitTaskEvent('PROGRESS', 'calculateCustomerGrapeRank', CUSTOMER_PUBKEY, {
        customer_id: CUSTOMER_ID,
        customer_pubkey: CUSTOMER_PUBKEY,
        customer_name: CUSTOMER_NAME,
        message: 'Scorecards initialized',
        phase: 'scorecards_initialization',
        step: 'initialize_scorecards_summary',
        warm_start: WARM_START ? 'warmStart' : 'coldStart',
        warm_start_status: warmStartStatus,
        warm_start_source: warmStartSource,
        warm_start_error: warmStartError,
        owner_seed_hops: ownerSeedHops,
        owner_seed_max_hops: OWNER_SEED_MAX_HOPS,
        warm_started_count: warmCount,
        cold_started_count: coldCount,
        total_scorecards: Object.keys(scorecards).length,
        algorithm: 'personalized_graperank'
      });
    } catch (emitErr) {
      console.warn(`Warning: failed to emit initialize_scorecards_summary event: ${emitErr.message}`);
    }
  } catch (error) {
    console.error(`Error initializing scorecards: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
