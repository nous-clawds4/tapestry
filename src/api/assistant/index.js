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

    return res.json({
      success: true,
      event: signedEvent,
      assistantPubkey,
      assistantName,
      message: 'Brainstorm Assistant profile published successfully',
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
