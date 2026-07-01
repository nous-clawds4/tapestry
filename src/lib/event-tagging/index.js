/**
 * Event-tagging protocol core — the dependency-free, framework-agnostic SDK seed
 * for tagging Nostr events (David's indirect per-tag-header protocol).
 *
 * Spec:  protocols/drafts/event-taggings.md  (the generic, stack-agnostic spec)
 * ADR:   engineering-team/decisions/event-tagging/0001-protocol-core-and-spec.md
 *
 * Pure construction only: builders return UNSIGNED `{ kind, tags, content }`
 * events; filter builders return plain Nostr filter objects. Nothing here signs,
 * publishes, reads relays, or imports anything outside this folder. The runtime
 * Tapestry-Assistant pubkey is always a parameter (`taPubkey`) — never hardcoded.
 *
 * A consumer (server read API, browser publish path, or a third-party client) can
 * lift this folder wholesale and add its own signing/transport around it.
 */

const { slug } = require('./slug');
const handles = require('./handles');
const builders = require('./builders');
const filters = require('./filters');
const classify = require('./classify');
const apply = require('./apply');
const taggings = require('./taggings');

module.exports = {
  slug,
  ...handles,
  ...builders,
  ...filters,
  ...classify,
  ...apply,
  ...taggings,
};
