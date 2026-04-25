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

// Per NIP-05 spec: local-part allows lowercase alphanumerics + `-`, `_`, `.`
const NAME_RE = /^[a-z0-9._-]+$/;
const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/;
const RELAY_RE = /^wss?:\/\//;

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

function registerNip05Routes(app) {
  app.get('/.well-known/nostr.json', handleNip05Lookup);
}

module.exports = {
  registerNip05Routes,
  handleNip05Lookup,
  validateNip05,
};
