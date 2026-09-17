#!/usr/bin/env node

/**
 * Brainstorm Create Kind 10040 Event
 * 
 * This script creates a kind 10040 event for NIP-85 trusted assertions
 * and saves it to a temporary file for later publishing.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { getConfigFromFile } = require('../src/utils/config');

// Get relay configuration
// changing user home relay url to BRAINSTORM_NIP85_HOME_RELAY
const relayUrl = getConfigFromFile('BRAINSTORM_RELAY_URL', '');
const nip85HomeRelay = getConfigFromFile('BRAINSTORM_NIP85_HOME_RELAY', relayUrl);
// const nip85HomeRelay = "wss://nip85.brainstorm.world"
let relayPubkey = getConfigFromFile('BRAINSTORM_RELAY_PUBKEY', '');

// get customer pubkey if one is provided as an argument
const customerPubkey = process.argv[2];

// if customerPubkey is provided, then use CUSTOMER_<customerPubkey>_RELAY_PUBKEY instead of relayPubkey
if (customerPubkey) {
  relayPubkey = getConfigFromFile(`CUSTOMER_${customerPubkey}_RELAY_PUBKEY`, '');
}

if (!relayUrl || !relayPubkey) {
  console.error('Error: Relay URL or pubkey not found in configuration');
  process.exit(1);
}

const { trustAssertionRows, buildTreasureMapTemplate } = require('../src/lib/treasureMapMerge');
const { fetchCurrentMap } = require('../src/api/export/nip85/currentMap');

// The Map's author: the customer when given, else the owner.
const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '');
const mapOwner = customerPubkey || ownerPubkey || undefined;

(async () => {
  // dlist-curation #7: never regenerate blind — read the CURRENT Map and preserve every tag this
  // generator does not own; only the 30382:* rows are regenerated.
  let current;
  try {
    current = await fetchCurrentMap(mapOwner);
  } catch (err) {
    console.error(`Error: not regenerating blind — ${err.message}`);
    process.exit(1);
  }

  const { template: event, preserved, regenerated } = buildTreasureMapTemplate({
    pubkey: mapOwner,
    existingEvent: current.event,
    freshRows: trustAssertionRows(relayPubkey, nip85HomeRelay),
  });

  // Save the event to a temporary file
  const dataDir = '/var/lib/brainstorm/data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let event_file_name = '';
  if (customerPubkey) {
    event_file_name = customerPubkey + '_kind10040_event.json';
  } else {
    event_file_name = 'owner_kind10040_event.json';
  }

  const eventFile = path.join(dataDir, event_file_name);
  fs.writeFileSync(eventFile, JSON.stringify(event, null, 2));

  console.log(`Kind 10040 event created and saved to ${eventFile}`);
  console.log(`Preserved ${preserved} existing tag(s); regenerated ${regenerated} Trust-Assertion row(s); current Map found: ${current.where}`);
  console.log('Event details:');
  console.log(JSON.stringify(event, null, 2));
  console.log('\nThis event is ready for signing and publishing.');
})().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
