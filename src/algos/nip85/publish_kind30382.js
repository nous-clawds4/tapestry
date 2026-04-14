#!/usr/bin/env node

/**
 * Brainstorm Publish Kind 30382 Events
 * 
 * This script publishes kind 30382 events for users in the Web of Trust.
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
const kind30382_limit = getConfigFromFile('BRAINSTORM_30382_LIMIT', '250000');

console.log(`Neo4j URI: ${neo4jUri}`);
console.log(`Kind 30382 limit: ${kind30382_limit}`);

// Relay keys — loaded from SecureKeyStorage in main()
let relayPrivateKey = null;
let relayPubkey = '';

// Connect to Neo4j
const driver = neo4j.driver(
  neo4jUri,
  neo4j.auth.basic(neo4jUser, neo4jPassword)
);

// Function to get users with WoT scores from Neo4j
async function getUsers(limitOverride = null) {
  const session = driver.session();
  const effectiveLimit = (limitOverride && !isNaN(parseInt(limitOverride))) ? parseInt(limitOverride) : kind30382_limit;

  try {
    console.log(`Querying Neo4j for users with WoT scores (limit: ${effectiveLimit})...`);

    let query = `
      MATCH (u:NostrUser)
      WHERE u.personalizedPageRank IS NOT NULL
      AND u.influence IS NOT NULL
      AND (u.influence > 0.01 OR u.muterInput > 0.1 OR u.reporterInput > 0.1)
      AND u.hops IS NOT NULL
      AND u.hops < 100
      AND u.pubkey IS NOT NULL
      RETURN u.pubkey AS pubkey,
             u.personalizedPageRank AS personalizedPageRank,
             u.hops AS hops,
             u.influence AS influence,
             u.average AS average,
             u.confidence AS confidence,
             u.input AS input,
             u.verifiedFollowerCount AS verifiedFollowerCount,
             u.verifiedMuterCount AS verifiedMuterCount,
             u.verifiedReporterCount AS verifiedReporterCount
      ORDER BY u.influence DESC
      LIMIT ${effectiveLimit}
    `;
    
    const result = await session.run(query);
    
    // Process the records
    const users = result.records.map(record => processUserRecord(record));
    
    console.log(`Found ${users.length} users with WoT scores`);
    
    return users;
  } catch (error) {
    console.error('Error querying Neo4j:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Helper function to process a Neo4j record into a user object
function processUserRecord(record) {
  const user = {
    pubkey: record.get('pubkey'),
    personalizedPageRank: record.get('personalizedPageRank'),
    hops: record.get('hops'),
    influence: record.get('influence'),
    average: record.get('average'),
    confidence: record.get('confidence'),
    input: record.get('input'),
    verifiedFollowerCount: record.get('verifiedFollowerCount'),
    verifiedMuterCount: record.get('verifiedMuterCount'),
    verifiedReporterCount: record.get('verifiedReporterCount')
  };
  
  // Ensure all values are defined
  if (user.personalizedPageRank === null || user.personalizedPageRank === undefined) {
    user.personalizedPageRank = 0;
  }
  
  if (user.hops === null || user.hops === undefined) {
    user.hops = 999;
  }
  
  if (user.influence === null || user.influence === undefined) {
    user.influence = 0;
  }
  
  if (user.average === null || user.average === undefined) {
    user.average = 0;
  }
  
  if (user.confidence === null || user.confidence === undefined) {
    user.confidence = 0;
  }
  
  if (user.input === null || user.input === undefined) {
    user.input = 0;
  }

  if (user.verifiedFollowerCount === null || user.verifiedFollowerCount === undefined) {
    user.verifiedFollowerCount = 0;
  }

  if (user.verifiedMuterCount === null || user.verifiedMuterCount === undefined) {
    user.verifiedMuterCount = 0;
  }

  if (user.verifiedReporterCount === null || user.verifiedReporterCount === undefined) {
    user.verifiedReporterCount = 0;
  }
  
  return user;
}

// Create and sign a kind 30382 event
function createEvent(userPubkey, personalizedPageRank, hops, influence, average, confidence, input, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount) {
  // Create the event object
  const rankValue = Math.round(parseFloat(influence) * 100).toString();
  const event = {
    kind: 30382,
    pubkey: relayPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', userPubkey],
      ['rank', rankValue],
      ["followers", verifiedFollowerCount ? verifiedFollowerCount.toString() : '0'],
      ['hops', hops.toString()],
      ['personalizedGrapeRank_influence', influence ? influence.toString() : '0'],
      ['personalizedGrapeRank_average', average ? average.toString() : '0'],
      ['personalizedGrapeRank_confidence', confidence ? confidence.toString() : '0'],
      ['personalizedGrapeRank_input', input ? input.toString() : '0'],
      ["personalizedPageRank", personalizedPageRank ? personalizedPageRank.toString() : '0'],
      ["verifiedFollowerCount", verifiedFollowerCount ? verifiedFollowerCount.toString() : '0'],
      ["verifiedMuterCount", verifiedMuterCount ? verifiedMuterCount.toString() : '0'],
      ["verifiedReporterCount", verifiedReporterCount ? verifiedReporterCount.toString() : '0']
    ],
    content: ''
  };
  
  // Use finalizeEvent to calculate ID and sign in one step
  return nostrTools.finalizeEvent(event, relayPrivateKey);
}

/**
 * Import an array of signed events into local strfry via stdin pipe.
 */
function importToStrfry(events) {
  return new Promise((resolve, reject) => {
    const child = exec('strfry import', { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) console.error(`strfry import error: ${err.message}`);
      if (stderr) console.log(`strfry import stderr: ${stderr.trim()}`);
      resolve({ success: true, output: (stdout || '').trim() });
    });
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

    // Check if a limit was provided as a command-line argument
    const args = process.argv.slice(2);
    let limit = null;
    
    if (args.length > 0 && !isNaN(parseInt(args[0]))) {
      limit = parseInt(args[0]);
      console.log(`Using limit: ${limit}`);
    }
    
    // Fetch users with personalizedPageRank
    const users = await getUsers(limit);
    
    if (users.length === 0) {
      console.log('No users found with WoT scores');
      return { success: false, message: 'No users found with WoT scores' };
    }

    console.log(`Found ${users.length} users. Creating signed events...`);

    // Create all signed events
    const events = [];
    let createFailures = 0;

    for (const user of users) {
      try {
        const event = createEvent(
          user.pubkey,
          user.personalizedPageRank,
          user.hops,
          user.influence,
          user.average,
          user.confidence,
          user.input,
          user.verifiedFollowerCount,
          user.verifiedMuterCount,
          user.verifiedReporterCount
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
    await importToStrfry(events);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`strfry import complete in ${elapsed}s`);
    console.log(`- Events created: ${events.length}`);
    console.log(`- Create failures: ${createFailures}`);

    return {
      success: true,
      message: `Imported ${events.length} kind 30382 events to local strfry in ${elapsed}s`,
      summary: {
        total: users.length,
        eventsCreated: events.length,
        createFailures,
        importTimeSeconds: parseFloat(elapsed)
      }
    };
  } catch (error) {
    console.error('Error in main function:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
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
