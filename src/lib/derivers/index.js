/**
 * Deriver Registration — loads all derivation functions and registers them.
 *
 * Call registerAll() once at startup to populate the derivation engine.
 * New derivers: add a require + registerDeriver call below.
 */

const { registerDeriver } = require('../tapestry-derive');
const deriveSet = require('./set');
const deriveWord = require('./word');

function registerAll() {
  // Set and Superset use the set-specific deriver (adds elements, childSets, parentSets)
  registerDeriver('Set', deriveSet);
  registerDeriver('Superset', deriveSet);

  // Generic word deriver for all other node types
  // These produce word + graphContext (identifiers, elementOf, parentJsonSchemas)
  registerDeriver('ListItem', deriveWord);
  registerDeriver('ListHeader', deriveWord);
  registerDeriver('ConceptHeader', deriveWord);
  registerDeriver('JSONSchema', deriveWord);
  registerDeriver('Property', deriveWord);

  console.log('[tapestry-derive] Registered derivers: Set, Superset, ListItem, ListHeader, ConceptHeader, JSONSchema, Property');
}

module.exports = { registerAll };
