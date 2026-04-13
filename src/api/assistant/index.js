/**
 * Brainstorm Assistant API
 *
 * Publishes a kind 0 profile event for a customer's Brainstorm Assistant
 * (their relay identity that publishes kind 30382 Trust Assertions).
 *
 * The profile includes:
 * - Name: "<CustomerName>'s Brainstorm Assistant"
 * - About: describes the assistant's NIP-85 role
 * - Website: https://brainstorm.nosfabrica.com
 *
 * Future enhancements: avatar image, banner image, NIP-05.
 *
 * The event is signed server-side with the assistant's private key.
 */

const { exec } = require('child_process');
const nostrTools = require('nostr-tools');
const { getCustomerRelayKeys } = require('../../utils/customerRelayKeys');
const { getConfigFromFile } = require('../../utils/config');
const WebSocket = require('ws');

const EXTERNAL_RELAYS = [
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://wot.grapevine.network',
  'wss://purplepag.es',
];

/**
 * Publish a signed event to an external relay via WebSocket.
 * Returns a promise that resolves with success/failure.
 */
function publishToRelay(relayUrl, signedEvent, timeoutMs = 10000) {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(relayUrl);
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        resolve({ relay: relayUrl, success: false, error: 'timeout' });
      }, timeoutMs);

      ws.on('open', () => {
        ws.send(JSON.stringify(['EVENT', signedEvent]));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg[0] === 'OK') {
            clearTimeout(timer);
            ws.close();
            resolve({ relay: relayUrl, success: msg[2] !== false, message: msg[3] || '' });
          }
        } catch {}
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        resolve({ relay: relayUrl, success: false, error: err.message });
      });
    } catch (err) {
      resolve({ relay: relayUrl, success: false, error: err.message });
    }
  });
}

const ABOUT_TEXT = 'I am the Brainstorm Assistant for my owner. My primary task is to publish kind 30382 Trusted Assertions so that my owner\'s personalized web of trust metrics are available to be utilized by any nostr client that supports NIP-85.';

/**
 * Fetch a customer's kind 0 name from strfry.
 */
function getCustomerName(pubkey) {
  return new Promise((resolve) => {
    const filter = JSON.stringify({ kinds: [0], authors: [pubkey], limit: 1 });
    exec(`strfry scan '${filter.replace(/'/g, "'\\''")}' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 10000,
    }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve('My Owner');
        return;
      }
      try {
        const event = JSON.parse(stdout.trim().split('\n')[0]);
        const content = JSON.parse(event.content);
        resolve(content.display_name || content.name || 'My Owner');
      } catch {
        resolve('My Owner');
      }
    });
  });
}

/**
 * POST /api/assistant/publish-profile
 * Body: { customerPubkey: "hex" }
 */
async function handlePublishProfile(req, res) {
  try {
    const { customerPubkey } = req.body;
    if (!customerPubkey || !/^[0-9a-f]{64}$/.test(customerPubkey)) {
      return res.status(400).json({ success: false, error: 'Valid customerPubkey is required' });
    }

    // Verify caller is the customer or the owner
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    if (req.session?.pubkey !== customerPubkey && req.session?.pubkey !== ownerPubkey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // 1. Get customer relay keys
    const relayKeys = await getCustomerRelayKeys(customerPubkey);
    if (!relayKeys || !relayKeys.privkey) {
      return res.status(400).json({ success: false, error: 'Customer relay keys not found. Set up Trusted Assertions first.' });
    }

    // Convert privkey from nsec or hex to Uint8Array
    let privkeyBytes;
    if (typeof relayKeys.privkey === 'string') {
      if (relayKeys.privkey.startsWith('nsec')) {
        privkeyBytes = nostrTools.nip19.decode(relayKeys.privkey).data;
      } else {
        privkeyBytes = Buffer.from(relayKeys.privkey, 'hex');
      }
    } else {
      privkeyBytes = relayKeys.privkey;
    }

    const assistantPubkey = nostrTools.getPublicKey(privkeyBytes);

    // 2. Get customer's name for the assistant's display name
    const customerName = await getCustomerName(customerPubkey);
    const assistantName = `${customerName}'s Brainstorm Assistant`;

    // 3. Build kind 0 event
    const profileContent = {
      name: assistantName,
      display_name: assistantName,
      website: 'https://brainstorm.nosfabrica.com',
      about: ABOUT_TEXT,
    };

    const event = {
      kind: 0,
      pubkey: assistantPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profileContent),
    };

    // 4. Sign with assistant's private key
    const signedEvent = nostrTools.finalizeEvent(event, privkeyBytes);
    console.log(`[assistant] Kind 0 event signed: ${signedEvent.id.slice(0, 16)}...`);

    // 5. Publish to local strfry
    await new Promise((resolve, reject) => {
      const child = exec('strfry import', { timeout: 10000 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
      child.stdin.write(JSON.stringify(signedEvent) + '\n');
      child.stdin.end();
    });

    console.log(`[assistant] Kind 0 published to strfry for ${assistantPubkey.slice(0, 8)}`);

    // 6. Publish to external relays (in parallel, non-blocking)
    const relayResults = await Promise.all(
      EXTERNAL_RELAYS.map(relay => publishToRelay(relay, signedEvent))
    );
    const relaySuccesses = relayResults.filter(r => r.success).length;
    console.log(`[assistant] Published to ${relaySuccesses}/${EXTERNAL_RELAYS.length} external relays`);
    for (const r of relayResults) {
      if (!r.success) console.warn(`[assistant] Failed: ${r.relay} — ${r.error || r.message || 'unknown'}`);
    }

    return res.json({
      success: true,
      event: signedEvent,
      assistantPubkey,
      assistantName,
      relays: { total: EXTERNAL_RELAYS.length, success: relaySuccesses, results: relayResults },
      message: `Brainstorm Assistant profile published to strfry + ${relaySuccesses}/${EXTERNAL_RELAYS.length} external relays`,
    });

  } catch (err) {
    console.error(`[assistant] Error publishing profile:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/assistant/status
 * Query: ?customerPubkey=hex
 * Returns whether the assistant has a kind 0 profile published.
 */
async function handleAssistantStatus(req, res) {
  try {
    const { customerPubkey } = req.query;
    if (!customerPubkey) {
      return res.status(400).json({ success: false, error: 'customerPubkey is required' });
    }

    const relayKeys = await getCustomerRelayKeys(customerPubkey);
    if (!relayKeys || !relayKeys.pubkey) {
      return res.json({ success: true, hasRelayKey: false, hasProfile: false });
    }

    // Check if kind 0 exists for the assistant pubkey
    const filter = JSON.stringify({ kinds: [0], authors: [relayKeys.pubkey], limit: 1 });
    const result = await new Promise((resolve) => {
      exec(`strfry scan '${filter.replace(/'/g, "'\\''")}' 2>/dev/null`, {
        encoding: 'utf8',
        timeout: 10000,
      }, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
        } else {
          try {
            resolve(JSON.parse(stdout.trim().split('\n')[0]));
          } catch {
            resolve(null);
          }
        }
      });
    });

    let profile = null;
    if (result) {
      try {
        profile = JSON.parse(result.content);
      } catch {}
    }

    return res.json({
      success: true,
      hasRelayKey: true,
      assistantPubkey: relayKeys.pubkey,
      assistantNpub: relayKeys.npub,
      hasProfile: !!result,
      profile,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handlePublishProfile, handleAssistantStatus };
