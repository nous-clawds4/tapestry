/**
 * Server-side event signing and publishing to local strfry.
 * POST /api/strfry/publish
 * Body: { event, signAs: "assistant" | "client" }
 *   assistant — sign with Tapestry Assistant key, then publish
 *   client — event is already signed by client (NIP-07), just publish
 */
const { exec } = require('child_process');
const { getConfigFromFile } = require('../../../utils/config');

// Lazy-load nostr-tools (ESM-friendly path inside Docker)
let _nt = null;
function getNostrTools() {
  if (!_nt) {
    _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
  }
  return _nt;
}

async function handlePublishEvent(req, res) {
  try {
    const { event, signAs } = req.body;

    if (!event) {
      return res.status(400).json({ success: false, error: 'Missing event' });
    }

    let signedEvent;

    if (signAs === 'assistant') {
      // Sign with Tapestry Assistant private key
      const privkeyHex = getConfigFromFile('BRAINSTORM_RELAY_PRIVKEY');
      if (!privkeyHex) {
        return res.status(500).json({ success: false, error: 'Tapestry Assistant key not configured' });
      }

      const nt = getNostrTools();
      const privBytes = Uint8Array.from(Buffer.from(privkeyHex, 'hex'));

      const template = {
        kind: event.kind,
        created_at: event.created_at || Math.floor(Date.now() / 1000),
        tags: event.tags || [],
        content: event.content || '',
      };

      signedEvent = nt.finalizeEvent(template, privBytes);
      
    } else if (signAs === 'client' || !signAs) {
      // Event should already be signed by the client (NIP-07)
      if (!event.sig || !event.id || !event.pubkey) {
        return res.status(400).json({ success: false, error: 'Client-signed event must include id, sig, and pubkey' });
      }
      signedEvent = event;
    } else {
      return res.status(400).json({ success: false, error: `Unknown signAs value: ${signAs}` });
    }

    // Publish to local strfry via stdin import
    const eventJson = JSON.stringify(signedEvent);
    
    const child = exec('strfry import', { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('strfry import error:', error.message, stderr);
        return res.json({ success: false, error: `strfry import failed: ${error.message}` });
      }
      console.log('Published event to strfry:', signedEvent.id?.slice(0, 16));
      return res.json({ success: true, event: signedEvent });
    });
    
    child.stdin.write(eventJson + '\n');
    child.stdin.end();

  } catch (error) {
    console.error('Publish event error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { handlePublishEvent };
