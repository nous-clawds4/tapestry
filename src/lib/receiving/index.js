/**
 * Framework-free "receiving setup" core.
 *
 * Pure modules (walletOptions, mergeKind0, newest, resolveMethod) carry the
 * hard logic — option catalog, validators, kind-0 REPLACE merge, newest-wins
 * selection, bolt12→lud16 precedence. I/O modules (publish, resolveProfile)
 * wrap relays + local strfry. The CLI (bin/receiving.js) drives all of it; the
 * web UI is meant to import the same modules later (Phase 2).
 */

module.exports = {
  ...require('./walletOptions'),
  ...require('./mergeKind0'),
  ...require('./newest'),
  ...require('./resolveMethod'),
  ...require('./publish'),
  ...require('./resolveProfile'),
  ...require('./probe'),
};
