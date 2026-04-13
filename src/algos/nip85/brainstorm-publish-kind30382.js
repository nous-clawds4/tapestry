#!/usr/bin/env node

/**
 * Brainstorm Publish Kind 30382 Events
 * 
 * This script publishes kind 30382 events for the top users by influence.
 * Each event is signed with the relay's private key (from SecureKeyStorage)
 * and imported directly into local strfry for maximum speed.
 * External relay distribution is handled by strfry's router presets.
 */

const { exec } = require('child_process');
const neo4j = require('neo4j-driver');
const nostrTools = require('nostr-tools');
const { getConfigFromFile } = require('../../utils/config');
const { getOwnerAssistantKeys } = require('../../utils/assistantKeys');

// Get config
const neo4jUri = getConfigFromFile('NEO4J_URI', 'bolt://localhost:7687');
const neo4jUser = getConfigFromFile('NEO4J_USER', 'neo4j');
const neo4jPassword = getConfigFromFile('NEO4J_PASSWORD', 'neo4j');

console.log(`Neo4j URI: ${neo4jUri}`);

// Relay keys — loaded from SecureKeyStorage in main()
let relayPrivateKey = null;
let relayPubkey = '';

// Connect to Neo4j
const driver = neo4j.driver(
  neo4jUri,
  neo4j.auth.basic(neo4jUser, neo4jPassword)
);

async function getTopUsers() {
  const session = driver.session();
  try {
    // Query to get users with personalizedPageRank, including GrapeRank data
    // Make sure we're only getting users that have been processed by the GrapeRank algorithm
    const result = await session.run(`
      MATCH (u:NostrUser)
      WHERE u.personalizedPageRank IS NOT NULL 
      AND u.influence IS NOT NULL
        AND u.hops IS NOT NULL 
        AND u.hops < 100
        AND u.pubkey IS NOT NULL
      RETURN u.pubkey AS pubkey, 
             u.personalizedPageRank AS personalizedPageRank, 
             u.hops AS hops,
             u.influence AS influence,
             u.average AS average,
             u.confidence AS confidence,
             u.input AS input
      ORDER BY u.influence DESC
      LIMIT 100
    `);
    
    console.log(`Found ${result.records.length} users with influence`);
    
    // If no users found, try a more lenient query
    if (result.records.length === 0) {
      console.log("No users found with complete GrapeRank data. Trying more lenient query...");
      
      const fallbackResult = await session.run(`
        MATCH (u:NostrUser)
        WHERE u.pubkey IS NOT NULL
        OPTIONAL MATCH (u)-[:FOLLOWS]->(followed)
        WITH u, count(followed) as followCount
        WHERE followCount > 0
        RETURN u.pubkey AS pubkey, 
               u.personalizedPageRank AS personalizedPageRank, 
               u.hops AS hops,
               u.influence AS influence,
               u.average AS average,
               u.confidence AS confidence,
               u.input AS input
        ORDER BY u.personalizedPageRank DESC
        LIMIT 1000
      `);
      
      console.log(`Fallback query found ${fallbackResult.records.length} users`);
      
      if (fallbackResult.records.length > 0) {
        return fallbackResult.records.map(processUserRecord);
      }
      
      return [];
    }
    
    return result.records.map(processUserRecord);
  } finally {
    await session.close();
  }
}

// Helper function to process a Neo4j record into a user object
function processUserRecord(record) {
  // Safely get values with null checks
  const pubkey = record.get('pubkey');
  const personalizedPageRank = record.get('personalizedPageRank');
  const hops = record.get('hops');
  const influence = record.get('influence');
  const average = record.get('average');
  const confidence = record.get('confidence');
  const input = record.get('input');
  
  // For debugging
  console.log(`Processing user ${pubkey} with data:`, {
    personalizedPageRank: personalizedPageRank || 'null',
    hops: hops || 'null',
    influence: influence || 'null',
    average: average || 'null',
    confidence: confidence || 'null',
    input: input || 'null'
  });
  
  return {
    pubkey: pubkey,
    personalizedPageRank: personalizedPageRank ? personalizedPageRank.toString() : "0.01",
    hops: hops ? hops.toString() : "1",
    influence: influence ? influence.toString() : "0",
    average: average ? average.toString() : "0",
    confidence: confidence ? confidence.toString() : "0.5",
    input: input ? input.toString() : "0"
  };
}

// Create and sign a kind 30382 event
function createEvent(userPubkey, personalizedPageRank, hops, influence, average, confidence, input) {
  // Calculate the rank value (influence * 100, rounded to integer)
  const rankValue = Math.round(parseFloat(influence) * 100).toString();
  
  // Round GrapeRank values to 4 significant digits
  const roundToSigFigs = (num, sigFigs) => {
    if (num === 0) return 0;
    const parsedNum = parseFloat(num);
    if (isNaN(parsedNum)) return "0";
    const magnitude = Math.floor(Math.log10(Math.abs(parsedNum))) + 1;
    const factor = Math.pow(10, sigFigs - magnitude);
    return (Math.round(parsedNum * factor) / factor).toString();
  };
  
  const influenceRounded = roundToSigFigs(influence, 4);
  const averageRounded = roundToSigFigs(average, 4);
  const confidenceRounded = roundToSigFigs(confidence, 4);
  const inputRounded = roundToSigFigs(input, 4);
  
  const event = {
    kind: 30382,
    created_at: Math.floor(Date.now() / 1000),
    content: "",
    pubkey: relayPubkey,
    tags: [
      ["d", userPubkey],
      ["personalizedPageRank", personalizedPageRank],
      ["hops", hops],
      ["rank", rankValue],
      ["personalizedGrapeRank_influence", influenceRounded],
      ["personalizedGrapeRank_average", averageRounded],
      ["personalizedGrapeRank_confidence", confidenceRounded],
      ["personalizedGrapeRank_input", inputRounded]
    ]
  };
  
  // Sign the event with the relay's private key
  return nostrTools.finalizeEvent(event, relayPrivateKey);
}

/**
 * Import an array of signed events into local strfry via stdin pipe.
 * Returns { success, imported, failed }.
 */
function importToStrfry(events) {
  return new Promise((resolve, reject) => {
    const child = exec('strfry import', { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`strfry import error: ${err.message}`);
        // strfry import still processes valid lines even on partial errors
      }
      if (stderr) console.log(`strfry import stderr: ${stderr.trim()}`);
      resolve({ success: true, output: (stdout || '').trim() });
    });
    // Write one JSON event per line
    for (const event of events) {
      child.stdin.write(JSON.stringify(event) + '\n');
    }
    child.stdin.end();
  });
}

// Main function
async function main() {
  try {
    // Load TA keys from SecureKeyStorage
    const taKeys = await getOwnerAssistantKeys();
    if (!taKeys || !taKeys.privkey) {
      console.error('No relay private key found in SecureKeyStorage. Cannot continue.');
      process.exit(1);
    }
    relayPrivateKey = taKeys.privkey;
    if (typeof relayPrivateKey === 'string' && relayPrivateKey.startsWith('nsec')) {
      relayPrivateKey = nostrTools.nip19.decode(relayPrivateKey).data;
    }
    relayPubkey = nostrTools.getPublicKey(relayPrivateKey);

    console.log(`Using relay pubkey: ${relayPubkey.substring(0, 8)}...`);
    console.log('Fetching users with personalizedPageRank...');
    const topUsers = await getTopUsers();
    
    if (topUsers.length === 0) {
      console.log('No users found with personalizedPageRank property');
      return {
        success: false,
        message: 'No users found with personalizedPageRank property',
        events: []
      };
    }
    
    console.log(`Found ${topUsers.length} users. Creating signed events...`);

    // Create all signed events
    const events = [];
    let createFailures = 0;

    for (const user of topUsers) {
      try {
        const event = createEvent(
          user.pubkey,
          user.personalizedPageRank,
          user.hops,
          user.influence,
          user.average,
          user.confidence,
          user.input
        );
        events.push(event);
      } catch (error) {
        console.error(`Error creating event for user ${user.pubkey}:`, error.message);
        createFailures++;
      }
    }

    console.log(`Created ${events.length} signed events (${createFailures} failures). Importing to local strfry...`);

    // Import all events to local strfry in one shot
    const startTime = Date.now();
    const result = await importToStrfry(events);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`strfry import complete in ${elapsed}s`);
    console.log(`- Events created: ${events.length}`);
    console.log(`- Create failures: ${createFailures}`);

    return {
      success: true,
      message: `Imported ${events.length} kind 30382 events to local strfry in ${elapsed}s`,
      summary: {
        total: topUsers.length,
        eventsCreated: events.length,
        createFailures,
        importTimeSeconds: parseFloat(elapsed)
      }
    };
  } catch (error) {
    console.error('Error in main function:', error);
    return {
      success: false,
      message: `Error publishing kind 30382 events: ${error.message}`,
      error: error.stack
    };
  } finally {
    // Close the Neo4j driver
    await driver.close();
  }
}

// Run the main function
main()
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
