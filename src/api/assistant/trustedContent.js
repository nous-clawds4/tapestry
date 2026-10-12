/**
 * Scores, Lists and Concepts — the three "Publication of Trusted Content" actions the /assistant hub checks for real
 * (assistant-trusted-content-status #1, ADR assistant-trusted-content-status/0001). One of the checks behind
 * GET /api/assistant/attention (src/api/assistant/attention.js).
 *
 * A category is done when the viewer's own Treasure Map (kind 10040) gives it to any Assistant. It is `shared` when any
 * of those Assistants is not the viewer's own on this instance: 'partly' beside theirs, 'entirely' without it
 * (assistant-shared-categories #1, Done but shared). Which entries count for which category is the Treasure Map page's
 * rule, loaded from its one home (src/lib/treasureMapCategories.mjs), so the hub and /treasure-map read a Map the same
 * way. Which Map is /setup's read (src/api/setup/status.js lookupNewest + treasureMapRelays): this instance's relay
 * first, then, only on a miss, the outside relays a Map is published to. "Finished" is /setup's rule too.
 *
 * Read-only: strfry is only scanned and outside relays only read, through the dependencies handed in. Whose Map and
 * which Assistant come from the caller (the session), never from the request.
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { lookupNewest, treasureMapRelays } = require('../setup/status');

/** The actions' keys (ui/src/pages/assistant/actions.js, also their addresses) → the Treasure Map's categories. */
const TRUSTED_CONTENT_ACTIONS = { 'trusted-assertions': 'scores', 'trusted-lists': 'lists', dlists: 'concepts' };

const RULE_PATH = path.join(__dirname, '../../lib/treasureMapCategories.mjs');

let rulePromise = null;

/**
 * The category rule module, imported once. The rule is an ES module the server cannot require; a failed import is
 * forgotten so a later request tries again.
 */
function loadCategoryRule() {
  if (!rulePromise) {
    rulePromise = import(pathToFileURL(RULE_PATH).href).catch((err) => {
      rulePromise = null;
      throw err;
    });
  }
  return rulePromise;
}

/**
 * The three actions' answers (ADR 0001 sub-decision 4, as superseded in part by assistant-shared-categories #1). Pure.
 * Done when the Map gives the category to any Assistant; `shared` is null unless done, then null when every one of
 * them is the viewer's here, 'partly' when theirs is among them, 'entirely' when it is not.
 * @param {{ lookup: Object, assistantPubkey: string, assignments: ?{ scores: string[], lists: string[], concepts: string[] } }} input
 *   lookup is lookupNewest's answer; assignments is categoryAssistants(lookup.event), or null when there is no Map
 * @returns {Object<string, { category, finished, done, pending, reason, source, shared }>}
 */
function evaluateTrustedContent({ lookup, assistantPubkey, assignments }) {
  const assistant = String(assistantPubkey || '').toLowerCase();
  const out = {};
  for (const [key, category] of Object.entries(TRUSTED_CONTENT_ACTIONS)) {
    if (!lookup || !lookup.finished) {
      out[key] = { category, finished: false, done: false, pending: false, reason: (lookup && lookup.reason) || 'outside-unreachable', source: null, shared: null };
      continue;
    }
    const source = lookup.source || null;
    if (!lookup.event) {
      out[key] = { category, finished: true, done: false, pending: true, reason: 'no-map', source, shared: null };
      continue;
    }
    const assigned = assignments && Array.isArray(assignments[category]) ? assignments[category] : [];
    if (assigned.length === 0) {
      out[key] = { category, finished: true, done: false, pending: true, reason: 'not-assigned', source, shared: null };
      continue;
    }
    const ours = assistant !== '' && assigned.includes(assistant);
    const shared = assigned.every((pubkey) => pubkey === assistant) ? null : ours ? 'partly' : 'entirely';
    out[key] = { category, finished: true, done: true, pending: false, reason: null, source, shared };
  }
  return out;
}

/**
 * The viewer's newest Map, read as /setup reads it, then evaluated. Rejects when the rule cannot be loaded, so the
 * attention handler can answer `check-failed` without losing its other actions (sub-decision 6).
 * @param {{ viewer: string, assistantPubkey: string }} input  the session's viewer and their own Assistant here
 * @param {Object} deps  scanLocal, readRelay, getConfigFromFile, mapDefaultRelays, loadCategoryRule
 */
async function checkTrustedContent({ viewer, assistantPubkey }, deps) {
  const lookup = await lookupNewest({ kind: 10040, pubkey: viewer, relays: treasureMapRelays(deps) }, deps);
  let assignments = null;
  if (lookup.finished && lookup.event) {
    const rule = await deps.loadCategoryRule();
    assignments = rule.categoryAssistants(lookup.event);
  }
  return evaluateTrustedContent({ lookup, assistantPubkey, assignments });
}

module.exports = {
  checkTrustedContent,
  evaluateTrustedContent,
  loadCategoryRule,
  TRUSTED_CONTENT_ACTIONS,
};
