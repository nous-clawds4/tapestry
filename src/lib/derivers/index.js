/**
 * Deriver Registration — loads all derivation functions and registers them.
 *
 * Call registerAll() once at startup to populate the derivation engine.
 * New derivers: add a require + registerDeriver call below.
 */

const { registerDeriver } = require('../tapestry-derive');
const deriveSet = require('./set');

function registerAll() {
  // Set and Superset use the same deriver (Superset is a specialization of Set)
  registerDeriver('Set', deriveSet);
  registerDeriver('Superset', deriveSet);

  // Future derivers:
  // registerDeriver('ConceptHeader', require('./concept-header'));
  // registerDeriver('JSONSchema', require('./json-schema'));
  // registerDeriver('Property', require('./property'));
  // registerDeriver('NostrUser', require('./nostr-user'));

  console.log('[tapestry-derive] Registered derivers: Set, Superset');
}

module.exports = { registerAll };
