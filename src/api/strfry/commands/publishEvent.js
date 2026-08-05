/**
 * Server-side event signing and publishing to local strfry.
 * POST /api/strfry/publish
 * Body: { event, signAs: "assistant" | "client" }
 *   assistant — sign with Tapestry Assistant key, then publish
 *   client — event is already signed by client (NIP-07), just publish
 */
const { exec } = require('child_process');
const { getOwnerAssistantKeys } = require('../../../utils/assistantKeys');
const { isOwner } = require('../../../middleware/auth');
const { maybeBrainWriteTapestry } = require('../tapestryBrainWrite');

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
      // Signing as the Tapestry Assistant is privileged: only the owner (session)
      // or a genuinely-direct-local caller (req.localTrusted, stamped by the auth
      // middleware) may mint TA-signed events. Client-signed publishing below is
      // permissionless. (ADR security-auth-exposure/0002.)
      if (!isOwner(req) && !req.localTrusted) {
        return res.status(403).json({ success: false, error: 'Signing as the assistant requires owner authentication' });
      }
      // Sign with Tapestry Assistant private key
      const taKeys = await getOwnerAssistantKeys();
      if (!taKeys || !taKeys.privkey) {
        return res.status(500).json({ success: false, error: 'Tapestry Assistant key not configured' });
      }

      const nt = getNostrTools();
      const privBytes = Uint8Array.from(Buffer.from(taKeys.privkey, 'hex'));

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

    try {
      await new Promise((resolve, reject) => {
        const child = exec('strfry import', { timeout: 10000 }, (error, stdout, stderr) => {
          if (error) {
            console.error('strfry import error:', error.message, stderr);
            reject(new Error(`strfry import failed: ${error.message}`));
          } else {
            resolve();
          }
        });
        child.stdin.write(eventJson + '\n');
        child.stdin.end();
      });
    } catch (importError) {
      return res.json({ success: false, error: importError.message });
    }

    console.log('Published event to strfry:', signedEvent.id?.slice(0, 16));

    // Brain-first authoring hook (ADR tapestries/0007): if this letter is one
    // of the instance's own tapestry elements, the brain learns it BEFORE we
    // respond (the story's flow-completion bar) — awaited on purpose. A hook
    // failure is reported alongside publish success, never conflated with it:
    // strfry has already accepted the letter and it cannot be unsent.
    const brainWrite = await maybeBrainWriteTapestry(signedEvent);

    return res.json({ success: true, event: signedEvent, ...(brainWrite ? { brainWrite } : {}) });

  } catch (error) {
    console.error('Publish event error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { handlePublishEvent };
