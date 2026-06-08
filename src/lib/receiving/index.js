/**
 * Framework-free "receiving setup" core.
 *
 * Pure modules (walletOptions, mergeKind0, newest, resolveMethod) carry the
 * hard logic — option catalog, validators, kind-0 REPLACE merge, newest-wins
 * selection, LNURL-only resolution (lud16 → lnurl; legacy bolt12 is reported
 * unsupported). I/O modules (publish, resolveProfile) wrap relays + local
 * strfry. Both the CLI (bin/receiving.js) and the web API (src/api/receiving)
 * drive these modules.
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
