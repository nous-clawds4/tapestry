/**
 * NIP-05 server endpoint.
 *
 * Serves https://<host>/.well-known/nostr.json so any nostr client can verify
 * a `<name>@<host>` identifier per NIP-05.
 *
 * The mapping lives in the two-layer settings system (see src/config/settings.js)
 * under the `nip05` key:
 *
 *   {
 *     "nip05": {
 *       "names":  { "<name>": "<hex-pubkey>", ... },
 *       "relays": { "<hex-pubkey>": ["wss://...", ...], ... }
 *     }
 *   }
 *
 * Edits go through PUT /api/settings (owner-only). This route is public-read,
 * with CORS open since nostr clients fetch it cross-origin.
 *
 * The validateNip05() helper is exported so the settings PUT handler can run
 * the same validation before persisting.
 */

const { getSettings } = require('../config/settings');
const { guardedFetch } = require('../utils/ssrfGuard');

// Per NIP-05 spec: local-part allows lowercase alphanumerics + `-`, `_`, `.`
const NAME_RE = /^[a-z0-9._-]+$/;
const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/;
const RELAY_RE = /^wss?:\/\//;
// NIP-05 identifier: optional `local-part@`, then a dotted domain.
const NIP05_LOOKUP_RE = /^(?:([\w.+-]+)@)?([\w_-]+(\.[\w_-]+)+)$/;

/**
 * Validate a candidate `nip05` settings sub-object.
 * Returns an array of error strings (empty = valid).
 */
function validateNip05(nip05) {
  const errors = [];
  if (!nip05 || typeof nip05 !== 'object' || Array.isArray(nip05)) {
    return ['nip05 must be an object'];
  }

  if (nip05.names !== undefined) {
    if (typeof nip05.names !== 'object' || Array.isArray(nip05.names)) {
      errors.push('nip05.names must be an object');
    } else {
      for (const [name, pk] of Object.entries(nip05.names)) {
        if (!NAME_RE.test(name)) {
          errors.push(`nip05.names: invalid name "${name}" (must match ${NAME_RE.source})`);
        }
        if (typeof pk !== 'string' || !HEX_PUBKEY_RE.test(pk)) {
          errors.push(`nip05.names["${name}"]: pubkey must be 64-char hex`);
        }
      }
    }
  }

  if (nip05.relays !== undefined) {
    if (typeof nip05.relays !== 'object' || Array.isArray(nip05.relays)) {
      errors.push('nip05.relays must be an object');
    } else {
      for (const [pk, relayList] of Object.entries(nip05.relays)) {
        if (!HEX_PUBKEY_RE.test(pk)) {
          errors.push(`nip05.relays: invalid pubkey "${pk}" (must be 64-char hex)`);
        }
        if (!Array.isArray(relayList)) {
          errors.push(`nip05.relays["${pk}"]: must be an array of relay URLs`);
        } else {
          relayList.forEach((url, i) => {
            if (typeof url !== 'string' || !RELAY_RE.test(url)) {
              errors.push(`nip05.relays["${pk}"][${i}]: "${url}" must start with wss:// or ws://`);
            }
          });
        }
      }
    }
  }

  return errors;
}

/**
 * GET /.well-known/nostr.json
 * Public read. CORS open. Optional ?name=<name> filter (per NIP-05 spec).
 */
function handleNip05Lookup(req, res) {
  const settings = getSettings();
  const reg = (settings && settings.nip05) || {};
  const names = (reg.names && typeof reg.names === 'object') ? reg.names : {};
  const relays = (reg.relays && typeof reg.relays === 'object') ? reg.relays : {};

  // CORS: nostr clients fetch this cross-origin.
  res.set('Access-Control-Allow-Origin', '*');
  // Soft cache: clients verify often, but settings rarely change.
  res.set('Cache-Control', 'public, max-age=300');
  res.set('Content-Type', 'application/json; charset=utf-8');

  const requestedName = typeof req.query.name === 'string' ? req.query.name : null;

  if (requestedName !== null) {
    const pk = names[requestedName];
    if (!pk) {
      // Spec-compliant empty response when name is unknown.
      return res.json({ names: {}, relays: {} });
    }
    const result = { names: { [requestedName]: pk } };
    if (Array.isArray(relays[pk]) && relays[pk].length > 0) {
      result.relays = { [pk]: relays[pk] };
    }
    return res.json(result);
  }

  // No filter: return the full registry.
  return res.json({ names, relays });
}

/**
 * Look a NIP-05 identifier up on its own domain, and say what happened (my-assistants #4, ADR my-assistants/0004
 * sub-decision 1). Fetches https://<domain>/.well-known/nostr.json?name=<name>, 5-second timeout.
 * (Same shape as the verifyNip05 helpers in src/api/admin and the meili search proxy, which are kept local rather than
 * refactored across all three; that's out of scope for story #6 and for my-assistants #4.)
 *
 * The domain comes from user-supplied input and this route is unauthenticated, so the request goes through
 * guardedFetch (src/utils/ssrfGuard): a host that is or resolves to a non-public address is refused before anything
 * leaves the process, and redirects are not followed.
 *
 * @returns {Promise<{ outcome: 'malformed'|'unreachable'|'answered', pubkey: string|null }>}
 *   - 'malformed': not a NIP-05 identifier (NIP05_LOOKUP_RE); nothing is fetched.
 *   - 'unreachable': no readable listing was reached. A refused host, a network error, the abort, a non-ok response
 *     (any 3xx included), a body that isn't JSON, or JSON whose `names` isn't a plain object.
 *   - 'answered': the domain served a listing. `pubkey` is what it lists for the name (or its lowercase form) when
 *     that is 64-hex, else null.
 */
async function lookupNip05(nip05Address) {
  const match = String(nip05Address || '').match(NIP05_LOOKUP_RE);
  if (!match) return { outcome: 'malformed', pubkey: null };
  const name = match[1] || '_';
  const domain = match[2];
  let json;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await guardedFetch(
      `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!resp || !resp.ok) return { outcome: 'unreachable', pubkey: null };
    json = await resp.json();
  } catch {
    return { outcome: 'unreachable', pubkey: null };
  }
  const names = json && json.names;
  if (!names || typeof names !== 'object' || Array.isArray(names)) return { outcome: 'unreachable', pubkey: null };
  const listed = names[name] || names[name.toLowerCase()];
  return { outcome: 'answered', pubkey: typeof listed === 'string' && HEX_PUBKEY_RE.test(listed) ? listed : null };
}

/**
 * Resolve a NIP-05 identifier against its own domain: the hex pubkey the domain attests for that name, or null.
 * Every failure is null, as it always was; lookupNip05 is the one that says which failure.
 */
async function verifyNip05Identifier(nip05Address) {
  const found = await lookupNip05(nip05Address);
  return found.outcome === 'answered' ? found.pubkey : null;
}

/**
 * GET /api/nip05/verify?nip05=<addr>&pubkey=<hex>
 * Returns { verified, status } (my-assistants #4, ADR my-assistants/0004 sub-decision 2):
 *   - 'verified': the identifier's domain attests the SAME pubkey as the one supplied;
 *   - 'invalid': the identifier is malformed, or its domain answered and doesn't list this pubkey for it;
 *   - 'unchecked': no readable answer (lookupNip05's 'unreachable'), a missing or malformed `pubkey`, or an error.
 * `verified` is true exactly when `status` is 'verified', so it stays fail-closed for its existing readers
 * (useNip05Verification on the profile pages).
 */
async function handleNip05Verify(req, res) {
  res.set('Cache-Control', 'no-store');
  const nip05 = typeof req.query.nip05 === 'string' ? req.query.nip05 : '';
  const pubkey = typeof req.query.pubkey === 'string' ? req.query.pubkey.toLowerCase() : '';
  const answer = (status) => res.json({ verified: status === 'verified', status });
  if (!HEX_PUBKEY_RE.test(pubkey)) return answer('unchecked');
  try {
    const found = await lookupNip05(nip05);
    if (found.outcome === 'unreachable') return answer('unchecked');
    if (found.outcome === 'answered' && found.pubkey && found.pubkey.toLowerCase() === pubkey) return answer('verified');
    return answer('invalid');
  } catch {
    return answer('unchecked');
  }
}

function registerNip05Routes(app) {
  app.get('/.well-known/nostr.json', handleNip05Lookup);
  app.get('/api/nip05/verify', handleNip05Verify);
}

module.exports = {
  registerNip05Routes,
  handleNip05Lookup,
  handleNip05Verify,
  verifyNip05Identifier,
  lookupNip05,
  validateNip05,
};
