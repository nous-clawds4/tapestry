/**
 * Brainstorm Assistant API
 *
 * Publishes a kind 0 profile event for a customer's Brainstorm Assistant
 * (their relay identity that publishes kind 30382 Trust Assertions).
 *
 * The profile includes:
 * - A unique avatar: Brainstorm brain logo with customer-specific colors
 * - A branded banner (hardcoded nostr.build URL)
 * - Name: "<CustomerName>'s Brainstorm Assistant"
 * - About: describes the assistant's NIP-85 role
 *
 * The event is signed server-side with the assistant's private key.
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const nostrTools = require('nostr-tools');
const { getCustomerRelayKeys } = require('../../utils/customerRelayKeys');
const { getConfigFromFile } = require('../../utils/config');
const FormData = require('form-data');

// Branded banner — upload once to nostr.build, hardcode URL here
const BANNER_URL = ''; // TODO: Upload a branded banner and paste URL here

const ABOUT_TEXT = 'I am the Brainstorm Assistant for my owner. My primary task is to publish kind 30382 Trusted Assertions so that my owner\'s personalized web of trust metrics are available to be utilized by any nostr client that supports NIP-85.';

/**
 * Derive two unique colors from a pubkey hash.
 * Returns HSL color strings for replacing the SVG's orange and purple.
 */
function deriveColors(pubkey) {
  const hue1 = parseInt(pubkey.slice(0, 6), 16) % 360;
  const hue2 = (hue1 + 140) % 360; // complementary-ish offset

  // Convert HSL to hex for SVG fill replacement
  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  return {
    primary: hslToHex(hue1, 75, 60),   // replaces #ff914d (orange lightning)
    secondary: hslToHex(hue2, 65, 50),  // replaces #9546ed (purple cloud)
  };
}

/**
 * Generate a colored brainstorm SVG for the given pubkey.
 */
function generateColoredSvg(pubkey) {
  const svgPath = path.join(__dirname, '../../../ui/public/brainstorm.svg');
  let svg = fs.readFileSync(svgPath, 'utf8');
  const colors = deriveColors(pubkey);
  svg = svg.replace(/#ff914d/g, colors.primary);
  svg = svg.replace(/#9546ed/g, colors.secondary);
  return svg;
}

/**
 * Upload an SVG string to nostr.build.
 * Returns the hosted URL.
 */
async function uploadToNostrBuild(svgContent, filename) {
  const formData = new FormData();
  formData.append('file[]', Buffer.from(svgContent), {
    filename: filename || 'avatar.svg',
    contentType: 'image/svg+xml',
  });

  const resp = await fetch('https://nostr.build/api/v2/upload/files', {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`nostr.build upload failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const result = await resp.json();
  if (result.status !== 'success' || !result.data?.[0]?.url) {
    throw new Error('nostr.build upload returned unexpected format');
  }

  return result.data[0].url;
}

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

    // 3. Generate colored avatar SVG
    console.log(`[assistant] Generating colored avatar for ${customerPubkey.slice(0, 8)}...`);
    const coloredSvg = generateColoredSvg(customerPubkey);

    // 4. Upload avatar to nostr.build
    let avatarUrl;
    try {
      avatarUrl = await uploadToNostrBuild(coloredSvg, `brainstorm-assistant-${customerPubkey.slice(0, 8)}.svg`);
      console.log(`[assistant] Avatar uploaded: ${avatarUrl}`);
    } catch (uploadErr) {
      console.error(`[assistant] nostr.build upload failed: ${uploadErr.message}`);
      return res.status(502).json({ success: false, error: `Avatar upload failed: ${uploadErr.message}` });
    }

    // 5. Build kind 0 event
    const profileContent = {
      name: assistantName,
      display_name: assistantName,
      picture: avatarUrl,
      website: 'https://brainstorm.nosfabrica.com',
      about: ABOUT_TEXT,
    };
    if (BANNER_URL) {
      profileContent.banner = BANNER_URL;
    }

    const event = {
      kind: 0,
      pubkey: assistantPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profileContent),
    };

    // 6. Sign with assistant's private key
    const signedEvent = nostrTools.finalizeEvent(event, privkeyBytes);
    console.log(`[assistant] Kind 0 event signed: ${signedEvent.id.slice(0, 16)}...`);

    // 7. Publish to local strfry
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
      avatarUrl,
      assistantPubkey,
      assistantName,
      message: `Brainstorm Assistant profile published successfully`,
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
