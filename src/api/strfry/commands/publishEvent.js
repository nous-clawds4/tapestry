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
const { publishToRelays, getProfileRelays } = require('../../../lib/receiving/publish');
const { invalidateProfileCache } = require('../../profiles/fetchProfiles');

// Lazy-load nostr-tools resiliently: the absolute path resolves inside the Docker
// container (prod/staging); the bare require resolves everywhere else (CI's stack-free
// runner installs node_modules at the repo root). Mirrors src/api/event/eventReadPath.js.
let _nt = null;
function getNostrTools() {
  if (!_nt) {
    try { _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools'); }
    catch { _nt = require('nostr-tools'); }
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
      // Authenticity, not authorization: the signature must be valid for the CLAIMED
      // pubkey. Any validly-signed event from any author still publishes (permissionless);
      // a forged one is rejected HERE, before strfry import, which cannot be relied on to
      // reject it (strfry import exits 0 even when it drops a bad-sig event). Verify a JSON
      // round-trip so a client-attached verifiedSymbol cache cannot be trusted.
      // (ADR event-authenticity/0001.)
      const nt = getNostrTools();
      let verified = false;
      try { verified = nt.verifyEvent(JSON.parse(JSON.stringify(event))) === true; } catch { verified = false; }
      if (!verified) {
        return res.status(400).json({ success: false, error: 'Event signature verification failed' });
      }
      signedEvent = event;
    } else {
      return res.status(400).json({ success: false, error: `Unknown signAs value: ${signAs}` });
    }

    // Publish to local strfry via stdin import
    const eventJson = JSON.stringify(signedEvent);
    
    const child = exec('strfry import', { timeout: 10000 }, async (error, stdout, stderr) => {
      if (error) {
        console.error('strfry import error:', error.message, stderr);
        return res.json({ success: false, error: `strfry import failed: ${error.message}` });
      }
      console.log('Published event to strfry:', signedEvent.id?.slice(0, 16));

      // A kind-0 profile must also reach the external PROFILE_RELAYS that
      // /api/profiles reads, and the read cache must drop its stale copy —
      // otherwise an issuer keeps seeing the old receiving method (Finding 1).
      if (signedEvent.kind === 0) {
        try {
          invalidateProfileCache([signedEvent.pubkey]);
          const profileRelays = getProfileRelays();
          const relayResults = await publishToRelays(signedEvent, profileRelays);
          const accepted = relayResults.filter(r => r.success).length;
          console.log(`kind-0 fan-out: ${accepted}/${relayResults.length} profile relays accepted ${signedEvent.id?.slice(0, 16)}`);
          return res.json({ success: true, event: signedEvent, profileRelays: relayResults });
        } catch (fanErr) {
          // Local import already succeeded — report success, surface the fan-out error.
          console.warn('kind-0 profile-relay fan-out error:', fanErr.message);
          return res.json({ success: true, event: signedEvent, profileRelays: { error: fanErr.message } });
        }
      }

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
