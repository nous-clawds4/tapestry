/**
 * search-index-selection #2 — "Only me" curation (an `author` constraint on the pin).
 *
 * Story: engineering-team/stories/search-index-selection/2-only-me-curation.md
 * ADR:   engineering-team/decisions/search-index-selection/0001-author-constraint.md (Accepted)
 * Plan:  engineering-team/test-plans/search-index-selection/2-only-me-curation.md
 *
 * A pin's `curationMethod` may carry `authorConstraint: 'observer'`. When it does, the pin's
 * Trusted List folds in ONLY assertions signed by the pin's observer — certainty, not a POV
 * threshold — and the published list says so with ['author-constraint','observer']. Absent
 * (every pin published to date) means exactly today's behaviour, byte for byte.
 *
 * Five classes:
 *   U — the pure SDK vocabulary + predicate composer (src/lib/event-tagging/pins.js),
 *       relay-free, no I/O.
 *   H — the three runners driven through INJECTED deps (refreshPinnedTags.js): what the
 *       aggregation receives, what the published event's extraTags look like, fail-open,
 *       contextual orthogonality, and the E2 bail ordering.
 *   A — the aggregation rule itself. `aggregateProfilesTagged` / `aggregateNotesTagged` have
 *       NO injectable relay/Meili seam, so the rule is pinned through a pure composer the
 *       Implementer must export — `composeAuthorPredicates` from src/api/profile-tags/index.js
 *       (an SDK `authorPredicateFor` + `authorWeightFor` pair is accepted instead) — plus two
 *       source sentinels on the two aggregation call sites.
 *   S — source sentinels: the dialog's "Trust scope" control, the unconstrained client default,
 *       the TL read surfaces, the firmware schema prose, and the no-hardcoded-TA rule.
 *   R — regression sentinels on the deliberately untouched surfaces.
 *
 * STACK-FREE. No strfry, no neo4j, no control panel. `TA_PUBKEY` is provisioned via env at
 * load time (the runner composes every z from the RUNTIME TA).
 *
 * GUARD SUITES — Phase 4 must not edit: test/pin-stack-composition.test.js (its AC-4 literal
 * fixtures are THE byte-identity guard for unconstrained pins; this suite deliberately does
 * not duplicate them), test/item-trusted-list.test.js, test/note-trusted-list.test.js,
 * test/generalized-tag-pinning.test.js.
 */

'use strict';

// Must be set BEFORE the server modules load (getOwnerAssistantPubkey reads env first and this
// host has no /etc/brainstorm.conf — the stack runs in Docker). Respects a real value.
const FIXTURE_TA = 'f'.repeat(63) + '1';
if (!process.env.TA_PUBKEY) process.env.TA_PUBKEY = FIXTURE_TA;

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SRC = (p) => path.join(REPO, 'src', p);
const UI = (p) => path.join(REPO, 'ui', 'src', p);

const REFRESH_PATH = SRC('api/trustedList/refreshPinnedTags.js');
const PINS_LIB = SRC('lib/event-tagging/pins.js');
const SDK_INDEX = SRC('lib/event-tagging/index.js');
const PROFILE_TAGS = SRC('api/profile-tags/index.js');
const EVENT_TAGS = SRC('api/event-tags/index.js');
const MEMBERSHIP = SRC('api/trustedList/membershipMethods.js');
const DIALOG = UI('components/CurationMethodDialog.jsx');
const PUBLISH_TAG_PIN = UI('utils/publishTagPin.js');
const TL_DETAIL = UI('hooks/useTLDetail.js');
const PANEL = UI('components/PinnedListPanel.jsx');
const FIRMWARE_SCHEMA = path.join(REPO, 'firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json');
const PIN_STACK_SUITE = path.join(REPO, 'test/pin-stack-composition.test.js');

// ── harness ─────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
/** Never crash the run on a missing/broken module — report it as a named failure. */
function safeRequire(p) { try { return require(p); } catch (e) { return { __loadError: e.message }; } }
function loadPins() { return safeRequire(PINS_LIB); }
function loadRefresh() { return safeRequire(REFRESH_PATH); }
function runnerTaPubkey() { const m = safeRequire(PROFILE_TAGS); return (m && m.TA_PUBKEY) || null; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
function deepEq(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEq(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort(); const kb = Object.keys(b).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) => deepEq(a[k], b[k]));
  }
  return false;
}

// ── fixtures ────────────────────────────────────────────────────────────────
const HEX = (c) => c.repeat(64);
const OBS = HEX('a');            // the pin's observer — "me"
const STRANGER = HEX('9');       // a GrapeRank-trusted third party — "not me"
const TAGAUTHOR = HEX('b');
const TAG_EVENT_ID = HEX('c');
const M1 = HEX('1');
const M2 = HEX('2');
const N1 = HEX('3');
const ITEM_AUTHOR = HEX('e');
const ADDR = (n) => `39999:${ITEM_AUTHOR}:item-${n}`;
const TAG = { eventId: TAG_EVENT_ID, slug: 'funny', name: 'Funny', authorPubkey: TAGAUTHOR, createdAt: 1 };
const POV = { povSuffix: 'deadbeef', minRank: 0.25, delegatedPubkey: HEX('d') };
const LEGACY_TA = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_PINNING_Z = `39998:${LEGACY_TA}:tag-pinning`;

/**
 * A kind-39999 pin. `authorConstraint: undefined` ⇒ the field is ABSENT from the published
 * curation-method blob (every pin published before this story).
 */
function makePin({
  observer = OBS, authorConstraint, contextSlug = null, taPubkey,
  cutoff = 1, targetTypes, noteMethod = 'notes:net-endorsed',
} = {}) {
  const cm = { method: 'nip85:rank', observer, cutoff, noteMethod };
  if (targetTypes !== undefined) cm.targetTypes = targetTypes;
  if (authorConstraint !== undefined) cm.authorConstraint = authorConstraint;
  const tags = [['e', TAG_EVENT_ID], ['z', TAG_PINNING_Z], ['curation-method', JSON.stringify(cm)]];
  if (contextSlug) tags.push(['z', `39998:${taPubkey || runnerTaPubkey()}:${contextSlug}`]);
  return { id: `pin-${authorConstraint || 'plain'}`, kind: 39999, pubkey: observer, created_at: 10, tags, content: '{}' };
}

function byTargetMap() {
  return new Map([
    [M1, { pubkey: M1, applications: 3, disputes: 0, weightedSum: 1, weightedInput: 1 }],
    [M2, { pubkey: M2, applications: 2, disputes: 1, weightedSum: 2, weightedInput: 2 }],
  ]);
}

/** Deps for runOnePin, recording every argument the aggregation is handed. */
function profileDeps({ membershipMethod = 'count' } = {}) {
  const publishCalls = []; const aggArgs = [];
  return {
    publishCalls, aggArgs,
    deps: {
      lookupTag: async () => TAG,
      aggregateProfilesTagged: async (args) => { aggArgs.push(args); return { byTarget: byTargetMap(), wotFiltering: true }; },
      resolvePov: () => POV,
      resolveMembershipMethod: () => membershipMethod,
      ensureTagTLHeader: async () => ({ status: 'exists' }),
      ensureHeader: async () => ({ status: 'exists' }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30392' }, uuid: 'u1' }; },
    },
  };
}

function noteDeps() {
  const publishCalls = []; const aggArgs = [];
  const full = [{ id: N1, applications: 3, disputes: 0, createdAt: 100 }];
  return {
    publishCalls, aggArgs,
    deps: {
      lookupTag: async () => TAG,
      aggregateNotesTagged: async (args) => {
        aggArgs.push(args);
        return { members: full, fullMembers: full, scanTruncated: false, total: full.length };
      },
      resolvePov: () => POV,
      ensureTagTLHeader: async () => ({ status: 'exists' }),
      ensureHeader: async () => ({ status: 'exists' }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30393' }, uuid: 'u2' }; },
    },
  };
}

function itemDeps() {
  const publishCalls = []; const aggArgs = [];
  const items = [{ address: ADDR(1), applications: 2, disputes: 0, createdAt: 100, mine: false }];
  return {
    publishCalls, aggArgs,
    deps: {
      lookupTag: async () => TAG,
      aggregateNotesTagged: async (args) => {
        aggArgs.push(args);
        return {
          members: [], fullMembers: [], total: 0,
          itemMembers: items, fullItemMembers: items, itemTotal: items.length,
          itemTruncated: false, scanTruncated: false,
        };
      },
      resolvePov: () => POV,
      ensureTagTLHeader: async () => ({ status: 'exists', addr: `39999:${runnerTaPubkey()}:tl:funny-tls` }),
      ensureHeader: async () => ({ status: 'exists', addr: `39999:${runnerTaPubkey()}:tl:funny-tls` }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30394' }, uuid: 'u3' }; },
    },
  };
}

const DEPS_CONTRACT =
  'the runner must honor its INJECTED deps (pin-stack-composition established this contract); ';

async function runProfilePin(pin, opts) {
  const mod = loadRefresh();
  assert(typeof mod.runOnePin === 'function',
    `refreshPinnedTags.js must export runOnePin (load error: ${mod.__loadError || 'none'}).`);
  const { deps, publishCalls, aggArgs } = profileDeps(opts);
  let result;
  try { result = await mod.runOnePin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls, aggArgs };
}

async function runNotePin(pin) {
  const mod = loadRefresh();
  assert(typeof mod.runOneNotePin === 'function', 'refreshPinnedTags.js must export runOneNotePin.');
  const { deps, publishCalls, aggArgs } = noteDeps();
  let result;
  try { result = await mod.runOneNotePin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls, aggArgs };
}

async function runItemPin(pin) {
  const mod = loadRefresh();
  assert(typeof mod.runOneItemPin === 'function', 'refreshPinnedTags.js must export runOneItemPin.');
  const { deps, publishCalls, aggArgs } = itemDeps();
  let result;
  try { result = await mod.runOneItemPin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls, aggArgs };
}

function tlZPair() {
  const ta = runnerTaPubkey();
  return [['z', `39998:${ta}:trusted-list`], ['z', `39999:${ta}:tl:funny-tls`]];
}
function tagNames(call) { return (call.extraTags || []).map((t) => t[0]); }
function constraintTags(call) { return (call.extraTags || []).filter((t) => t[0] === 'author-constraint'); }

/**
 * The A-class seam. `aggregateProfilesTagged` builds `authorAllowed` / `authorWeight` from
 * Meili docs it fetches itself — there is no injection point — so the composition rule is
 * pinned through a pure export. Primary: `composeAuthorPredicates` on profile-tags. Accepted
 * alternative: the SDK pair `authorPredicateFor` + `authorWeightFor`.
 */
function composeSeam() {
  const pt = safeRequire(PROFILE_TAGS);
  if (pt && typeof pt.composeAuthorPredicates === 'function') {
    return { how: 'profile-tags.composeAuthorPredicates', fn: pt.composeAuthorPredicates };
  }
  const sdk = loadPins();
  if (sdk && typeof sdk.authorPredicateFor === 'function' && typeof sdk.authorWeightFor === 'function') {
    return {
      how: 'sdk.authorPredicateFor + sdk.authorWeightFor',
      fn: ({ authorConstraint, observer, authorAllowed, authorWeight }) => ({
        authorAllowed: sdk.authorPredicateFor({ authorConstraint, observer, isAsserterTrusted: authorAllowed }),
        authorWeight: sdk.authorWeightFor({ authorConstraint, observer, authorWeight }),
      }),
    };
  }
  return null;
}
const SEAM_CONTRACT =
  'TESTABILITY CONTRACT (test plan § "The seam specified for the Implementer"): the profile ' +
  'aggregation has no injectable Meili seam, so the author/weight composition must be reachable ' +
  'as a pure function — export composeAuthorPredicates({ authorConstraint, observer, ' +
  'authorAllowed, authorWeight }) => { authorAllowed, authorWeight } from src/api/profile-tags/index.js ' +
  '(or export authorWeightFor beside authorPredicateFor in src/lib/event-tagging/pins.js). Neither exists.';

// ===========================================================================
// U — the pure SDK vocabulary and predicate composer (ADR §1, §7)
// ===========================================================================

test('U1 (AC-1, E7): the SDK publishes a CLOSED author-constraint vocabulary of exactly ["observer"]', () => {
  const pins = loadPins();
  assert(Array.isArray(pins.AUTHOR_CONSTRAINTS),
    `src/lib/event-tagging/pins.js must export AUTHOR_CONSTRAINTS (ADR §1). Load error: ${pins.__loadError || 'none'}.`);
  assert(deepEq(pins.AUTHOR_CONSTRAINTS, ['observer']),
    `the v1 vocabulary is exactly ['observer'] — rung 2's list value is NOT accepted yet; got ${JSON.stringify(pins.AUTHOR_CONSTRAINTS)}.`);
  assert(typeof pins.isKnownAuthorConstraint === 'function',
    'pins.js must export isKnownAuthorConstraint(v) — the one place a reader compares against the vocabulary.');
  assert(pins.isKnownAuthorConstraint('observer') === true, "isKnownAuthorConstraint('observer') must be true.");
  for (const bad of [undefined, null, '', 'OBSERVER', 'list:abc', 'author', 0, {}, ['observer']]) {
    assert(pins.isKnownAuthorConstraint(bad) === false,
      `isKnownAuthorConstraint(${JSON.stringify(bad)}) must be false — the vocabulary is closed and case-exact.`);
  }
});

test('U2 (AC-4): with the constraint set, only the observer counts — a GrapeRank-trusted stranger does not', () => {
  const pins = loadPins();
  assert(typeof pins.authorPredicateFor === 'function',
    `pins.js must export authorPredicateFor({ authorConstraint, observer, isAsserterTrusted }) (ADR §1). Load error: ${pins.__loadError || 'none'}.`);
  const trustsEveryone = () => true;
  const p = pins.authorPredicateFor({ authorConstraint: 'observer', observer: OBS, isAsserterTrusted: trustsEveryone });
  assert(typeof p === 'function', 'authorPredicateFor must return a (pk) => boolean predicate.');
  assert(p(OBS) === true, 'the observer must pass the constrained predicate.');
  assert(p(STRANGER) === false,
    'AC-4: a third party must be EXCLUDED under the constraint even when the POV predicate trusts them — that is the whole point.');
});

test('U3 (AC-6, E6): the observer counts under the constraint even when the POV predicate trusts nobody (or is absent)', () => {
  const pins = loadPins();
  assert(typeof pins.authorPredicateFor === 'function', 'pins.js must export authorPredicateFor.');
  const denyAll = pins.authorPredicateFor({ authorConstraint: 'observer', observer: OBS, isAsserterTrusted: () => false });
  assert(denyAll(OBS) === true,
    'AC-6: my own tagging counts regardless of my own rank — the constraint REPLACES the POV predicate, it does not intersect it.');
  const noPredicate = pins.authorPredicateFor({ authorConstraint: 'observer', observer: OBS });
  assert(noPredicate(OBS) === true && noPredicate(STRANGER) === false,
    'E6: with no POV resolvable (today: "everyone counts"), the constraint must degrade to "only the observer", the tighter of the two.');
});

test('U4 (AC-3): an ABSENT constraint returns today\'s predicate untouched (and "everyone" when none was given)', () => {
  const pins = loadPins();
  assert(typeof pins.authorPredicateFor === 'function', 'pins.js must export authorPredicateFor.');
  const base = (pk) => pk === STRANGER;                  // an arbitrary POV verdict
  for (const absent of [undefined, null, '']) {
    const p = pins.authorPredicateFor({ authorConstraint: absent, observer: OBS, isAsserterTrusted: base });
    for (const pk of [OBS, STRANGER, M1]) {
      assert(p(pk) === base(pk),
        `AC-3: with authorConstraint=${JSON.stringify(absent)} the verdicts must be IDENTICAL to the POV predicate's (${pk.slice(0, 4)}…: got ${p(pk)}, want ${base(pk)}).`);
    }
  }
  const none = pins.authorPredicateFor({ authorConstraint: undefined, observer: OBS });
  assert(none(STRANGER) === true && none(OBS) === true,
    'with no constraint AND no predicate given, the result must be "everyone counts" (the existing no-POV semantic), never deny-all.');
});

test('U5 (E7): an UNKNOWN constraint value fails OPEN to the POV predicate — never deny-all, never a silent new meaning', () => {
  const pins = loadPins();
  assert(typeof pins.authorPredicateFor === 'function', 'pins.js must export authorPredicateFor.');
  const base = (pk) => pk === STRANGER;
  for (const unknown of ['list:abc', 'author ∈ list', 'OBSERVER', 'true']) {
    const p = pins.authorPredicateFor({ authorConstraint: unknown, observer: OBS, isAsserterTrusted: base });
    assert(p(STRANGER) === base(STRANGER) && p(OBS) === base(OBS),
      `E7 / ADR sub-option (c): ${JSON.stringify(unknown)} must fail OPEN to today's POV verdicts (an old runner meeting a rung-2 value publishes today's list); got observer=${p(OBS)}, stranger=${p(STRANGER)}.`);
  }
});

test('U6 (E2): the constraint with a missing or malformed observer admits NOBODY (deny is the safe corner)', () => {
  const pins = loadPins();
  assert(typeof pins.authorPredicateFor === 'function', 'pins.js must export authorPredicateFor.');
  for (const bad of [undefined, null, '', 'nothex', 'a'.repeat(63), 'A'.repeat(64)]) {
    const p = pins.authorPredicateFor({ authorConstraint: 'observer', observer: bad, isAsserterTrusted: () => true });
    assert(p(OBS) === false && p(STRANGER) === false,
      `ADR §1: constraint 'observer' with a non-hex observer (${JSON.stringify(bad)}) must deny everyone — unreachable in the runners (E2 bails first) but never "everyone".`);
  }
});

test('U7 (ADR §7): the vocabulary and the composer reach a client through the SDK index, with no new dependency', () => {
  const sdk = safeRequire(SDK_INDEX);
  assert(sdk && !sdk.__loadError, `src/lib/event-tagging/index.js must load (error: ${sdk && sdk.__loadError}).`);
  for (const name of ['AUTHOR_CONSTRAINTS', 'isKnownAuthorConstraint', 'authorPredicateFor']) {
    assert(sdk[name] !== undefined,
      `ADR §7: ${name} must be re-exported by the SDK index (the ...pins spread) so a third-party client reads a published pin the same way the server does.`);
  }
  const src = rd(PINS_LIB);
  const requires = [...stripComments(src).matchAll(/require\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert(requires.every((r) => r.startsWith('./')),
    `the SDK tree is dependency-free: pins.js may only require siblings; got ${JSON.stringify(requires)}.`);
  assert(!/console\./.test(stripComments(src)),
    'ADR §1: the SDK helper stays pure — the "unknown constraint ignored" warn belongs at the two aggregation call sites, not here.');
});

// ===========================================================================
// H — the three runners, driven through injected deps
// ===========================================================================

test('H1 (AC-4, profiles): runOnePin threads { authorConstraint, observer } into the profile aggregation', async () => {
  const { aggArgs } = await runProfilePin(makePin({ authorConstraint: 'observer' }));
  assert(aggArgs.length === 1, `runOnePin must call aggregateProfilesTagged exactly once; got ${aggArgs.length}.`);
  const a = aggArgs[0] || {};
  assert(a.authorConstraint === 'observer',
    `ADR §1: the runner must pass authorConstraint through to aggregateProfilesTagged (the predicate is built INSIDE the aggregation); got ${JSON.stringify(a)}.`);
  assert(a.observer === OBS,
    `ADR §1: the aggregation also needs the observer to compare against; got ${JSON.stringify(a)}.`);
});

test('H2 (AC-5, profiles): the published 30392 discloses the constraint exactly once, right after ["min-rank", …]', async () => {
  const { call } = await runProfilePin(makePin({ authorConstraint: 'observer' }));
  assert(call && call.kind === 30392, `expected a published 30392; got ${JSON.stringify(call && call.kind)}.`);
  const found = constraintTags(call);
  assert(found.length === 1,
    `AC-5: exactly one ['author-constraint','observer'] tag; got ${found.length} (extraTags: ${JSON.stringify(call.extraTags)}).`);
  assert(deepEq(found[0], ['author-constraint', 'observer']),
    `AC-5: the tag value is the RESOLVED constraint string; got ${JSON.stringify(found[0])}.`);
  const names = tagNames(call);
  assert(names.indexOf('author-constraint') === names.indexOf('min-rank') + 1,
    `ADR §4: the disclosure rides immediately after ['min-rank', …] on the 30392; tag order was ${JSON.stringify(names)}.`);
});

test('H3 (AC-3, profiles): an UNCONSTRAINED pin publishes the same 30392 metadata tags as today, with no disclosure', async () => {
  const { call } = await runProfilePin(makePin());
  assert(call && call.kind === 30392, 'expected a published 30392 for the unconstrained pin.');
  assert(constraintTags(call).length === 0,
    `AC-3: an unconstrained pin must carry NO author-constraint tag; got ${JSON.stringify(call.extraTags)}.`);
  assert(deepEq(call.extraTags, [
    ['observer', OBS],
    ['source-tag', TAG_EVENT_ID, TAGAUTHOR, 'funny'],
    ['cutoff', '1'],
    ['min-rank', '0.25'],
    // search-index-selection #3 AC-4 (re-aimed by the Tester, Phase 3): the fold that ran is
    // now disclosed on EVERY 30392 (the deps stub's dial is 'count').
    ['membership-method', 'count'],
    ...tlZPair(),
  ]), `AC-3: the unconstrained 30392 tag array must be byte-identical to today's; got ${JSON.stringify(call.extraTags)}. ` +
     '(Full-event byte identity is guarded by test/pin-stack-composition.test.js AC-4, not duplicated here.)');
});

test('H4 (AC-4 + AC-5, notes): runOneNotePin threads the pair and discloses after ["p", observer]', async () => {
  const pin = makePin({ authorConstraint: 'observer', targetTypes: ['profile', 'note'] });
  const { call, aggArgs } = await runNotePin(pin);
  const a = aggArgs[0] || {};
  assert(a.authorConstraint === 'observer' && a.observer === OBS,
    `ADR §1: runOneNotePin must pass { authorConstraint, observer } into aggregateNotesTagged; got ${JSON.stringify(a)}.`);
  assert(call && call.kind === 30393, 'expected a published 30393.');
  assert(constraintTags(call).length === 1,
    `AC-5: the note TL must disclose the constraint exactly once; got ${JSON.stringify(call.extraTags)}.`);
  const names = tagNames(call);
  assert(names.indexOf('author-constraint') === names.indexOf('p') + 1,
    `ADR §4: on the 30393 the disclosure rides immediately after ['p', observer]; tag order was ${JSON.stringify(names)}.`);
});

test('H5 (AC-3, notes): an unconstrained note pin publishes the same 30393 tags as today', async () => {
  const { call } = await runNotePin(makePin({ targetTypes: ['profile', 'note'] }));
  assert(call && call.kind === 30393, 'expected a published 30393.');
  assert(constraintTags(call).length === 0, 'AC-3: no disclosure tag on an unconstrained note TL.');
  assert(deepEq(call.extraTags, [
    ['observer', OBS],
    ['source-tag', TAG_EVENT_ID, TAGAUTHOR, 'funny'],
    ['curation-method', 'notes:net-endorsed'],
    ['a', `39999:${TAGAUTHOR}:funny`],
    ['p', OBS],
    ...tlZPair(),
  ]), `AC-3: the unconstrained 30393 tag array must be byte-identical to today's; got ${JSON.stringify(call.extraTags)}.`);
});

test('H6 (AC-4 + AC-5, items): runOneItemPin threads the pair and discloses after ["p", observer]', async () => {
  const pin = makePin({ authorConstraint: 'observer', targetTypes: ['profile', 'note', 'item'] });
  const { call, aggArgs } = await runItemPin(pin);
  const a = aggArgs[0] || {};
  assert(a.authorConstraint === 'observer' && a.observer === OBS,
    `ADR §1: runOneItemPin must pass { authorConstraint, observer } into aggregateNotesTagged; got ${JSON.stringify(a)}.`);
  assert(call && call.kind === 30394, 'expected a published 30394.');
  assert(constraintTags(call).length === 1,
    `AC-5: the item TL must disclose the constraint exactly once; got ${JSON.stringify(call.extraTags)}.`);
  const names = tagNames(call);
  assert(names.indexOf('author-constraint') === names.indexOf('p') + 1,
    `ADR §4: on the 30394 the disclosure rides immediately after ['p', observer]; tag order was ${JSON.stringify(names)}.`);
});

test('H7 (AC-3, items): an unconstrained item pin publishes the same 30394 tags as today', async () => {
  const { call } = await runItemPin(makePin({ targetTypes: ['profile', 'note', 'item'] }));
  assert(call && call.kind === 30394, 'expected a published 30394.');
  assert(constraintTags(call).length === 0, 'AC-3: no disclosure tag on an unconstrained item TL.');
  assert(deepEq(call.extraTags, [
    ['observer', OBS],
    ['source-tag', TAG_EVENT_ID, TAGAUTHOR, 'funny'],
    ['curation-method', 'notes:net-endorsed'],
    ['p', OBS],
    ...tlZPair(),
  ]), `AC-3: the unconstrained 30394 tag array must be byte-identical to today's; got ${JSON.stringify(call.extraTags)}.`);
});

test('H8 (E7): an unknown constraint value publishes NO disclosure tag — a list never over-claims', async () => {
  const { call, aggArgs } = await runProfilePin(makePin({ authorConstraint: 'list:abc' }));
  assert(call && call.kind === 30392, 'a fail-open pin must still publish its (unconstrained) list.');
  assert(constraintTags(call).length === 0,
    `ADR §4: the tag carries the RESOLVED constraint, so an unknown value emits NO tag — the list is honestly undisclosed rather than falsely disclosed; got ${JSON.stringify(call.extraTags)}.`);
  assert(/isKnownAuthorConstraint/.test(stripComments(rd(REFRESH_PATH))),
    'ADR §4: the disclosure must be gated on the shared isKnownAuthorConstraint (the RESOLVED constraint), not on truthiness — otherwise a rung-2 value would be disclosed on a list computed without it.');
  const a = aggArgs[0] || {};
  assert(a.authorConstraint !== 'observer',
    `the aggregation must not be told 'observer' for an unknown value; got ${JSON.stringify(a.authorConstraint)}.` +
    ' (Passing the raw value through — the SDK composer fails open — or undefined are both acceptable.)');
});

test('H9 (E4): a constrained CONTEXTUAL pin keeps its d-tag and context z byte-identical; only membership narrows', async () => {
  const TA = runnerTaPubkey();
  assert(TA, 'the runtime TA pubkey must resolve (TA_PUBKEY env) for the context fixtures.');
  const plain = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA }));
  const constrained = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA, authorConstraint: 'observer' }));
  assert(plain.call.dTag === constrained.call.dTag && /-in-lfo$/.test(constrained.call.dTag),
    `ADR §6: the constraint is SCORING and never reaches the d-tag (identity); got "${plain.call.dTag}" vs "${constrained.call.dTag}".`);
  const zOf = (c) => (c.extraTags || []).filter((t) => t[0] === 'z');
  assert(deepEq(zOf(plain.call), zOf(constrained.call)),
    `ADR §6: the context z stays byte-identical under the constraint; got ${JSON.stringify(zOf(plain.call))} vs ${JSON.stringify(zOf(constrained.call))}.`);
  const without = (c) => (c.extraTags || []).filter((t) => t[0] !== 'author-constraint');
  assert(deepEq(without(plain.call), without(constrained.call)),
    'the ONLY tag difference between a contextual pin and its constrained twin is the disclosure tag.');
});

test('H10 (E2): a constrained pin with a malformed observer still errors on the observer, before anything else', async () => {
  const mod = loadRefresh();
  assert(typeof mod.runOnePin === 'function', 'refreshPinnedTags.js must export runOnePin.');
  const { deps, publishCalls, aggArgs } = profileDeps();
  const r = await mod.runOnePin(makePin({ observer: 'not-a-pubkey', authorConstraint: 'observer' }), { deps, ...deps });
  assert(r && r.status === 'error' && r.errorReason === 'observer pubkey missing or malformed',
    `E2: the existing observer bail must fire unchanged and FIRST — a constrained pin with no valid observer is an error, never "trust nobody" and never "trust everyone"; got ${JSON.stringify(r)}.`);
  assert(publishCalls.length === 0 && aggArgs.length === 0,
    'E2: nothing may be aggregated or published for a pin with a malformed observer.');
});

// ===========================================================================
// A — the aggregation rule (pure seam + two call-site sentinels)
// ===========================================================================

test('A1 (AC-4, AC-6): the composed author verdict admits the observer and excludes a rank-42 trusted stranger', () => {
  const seam = composeSeam();
  assert(seam, SEAM_CONTRACT);
  const authorAllowed = (pk) => pk === STRANGER || pk === OBS;   // both pass the POV threshold today
  const authorWeight = (pk) => (pk === STRANGER ? 0.42 : null);  // the observer has NO wot_rank doc
  const out = seam.fn({ authorConstraint: 'observer', observer: OBS, authorAllowed, authorWeight });
  assert(out && typeof out.authorAllowed === 'function' && typeof out.authorWeight === 'function',
    `the seam must return { authorAllowed, authorWeight } (via ${seam.how}); got ${JSON.stringify(out)}.`);
  assert(out.authorAllowed(OBS) === true, 'AC-6: the observer always counts under the constraint.');
  assert(out.authorAllowed(STRANGER) === false,
    'AC-4: a GrapeRank-trusted stranger is excluded under the constraint — same corpus, different membership.');
});

test('A2 (AC-7 carve-out): under the constraint the observer\'s own weight is 1.0 even with no wot_rank doc', () => {
  const seam = composeSeam();
  assert(seam, SEAM_CONTRACT);
  const authorAllowed = () => true;
  const authorWeight = (pk) => (pk === STRANGER ? 0.42 : null);
  const out = seam.fn({ authorConstraint: 'observer', observer: OBS, authorAllowed, authorWeight });
  assert(out.authorWeight(OBS) === 1,
    `AC-7 (operator ruling 2026-09-18): "I am certain about my own taggings" — the constrained observer weighs 1.0, so input/certainty do not publish an empty list for want of a wot_rank doc; got ${JSON.stringify(out.authorWeight(OBS))}.`);
});

test('A3 (AC-3, AC-7): with no constraint the verdict AND the weight function are today\'s, unchanged', () => {
  const seam = composeSeam();
  assert(seam, SEAM_CONTRACT);
  const authorAllowed = (pk) => pk === STRANGER;
  const authorWeight = (pk) => (pk === STRANGER ? 0.42 : null);
  for (const absent of [undefined, null, '']) {
    const out = seam.fn({ authorConstraint: absent, observer: OBS, authorAllowed, authorWeight });
    assert(out.authorAllowed(STRANGER) === true && out.authorAllowed(OBS) === false,
      `AC-3: absent constraint (${JSON.stringify(absent)}) ⇒ today's verdicts exactly.`);
    assert(out.authorWeight(STRANGER) === 0.42,
      `AC-7: the unconstrained weight is rank/100 unchanged — a stranger with rank 42 weighs 0.42; got ${out.authorWeight(STRANGER)}.`);
    assert(out.authorWeight(OBS) === null,
      'AC-7: without the constraint the observer gets NO special weight — null (no rank doc) stays null, or weighted methods would silently change for every existing pin.');
  }
  const unknown = seam.fn({ authorConstraint: 'list:abc', observer: OBS, authorAllowed, authorWeight });
  assert(unknown.authorAllowed(STRANGER) === true && unknown.authorWeight(OBS) === null,
    'E7: an unknown value fails open on the weight too — no 1.0 carve-out for a constraint that was not applied.');
});

test('A4 (AC-4, profiles): aggregateProfilesTagged accepts the two params and composes BEFORE the fold', () => {
  const src = rd(PROFILE_TAGS);
  assert(src, 'src/api/profile-tags/index.js must be readable.');
  const start = src.indexOf('async function aggregateProfilesTagged');
  assert(start !== -1, 'profile-tags must define aggregateProfilesTagged.');
  const sig = src.slice(start, start + 220);
  assert(/authorConstraint/.test(sig) && /\bobserver\b/.test(sig),
    `ADR §1: aggregateProfilesTagged must accept { …, authorConstraint, observer }; signature was: ${sig.split('\n')[0]}`);
  const body = src.slice(start, src.indexOf('\n}\n', start));
  const compose = Math.max(body.indexOf('authorPredicateFor'), body.indexOf('composeAuthorPredicates'));
  const fold = body.indexOf('for (const ev of deduped)');
  assert(compose !== -1,
    'ADR §1: the composition must go through the shared SDK helper (authorPredicateFor / composeAuthorPredicates) — not a second inline definition of the vocabulary.');
  assert(fold !== -1 && compose < fold,
    'AC-7: the predicate must be composed BEFORE the counting fold, so count/input/certainty see a set that differs only in membership and no method is special-cased.');
});

test('A5 (AC-4, notes/items): aggregateNotesTagged composes the constraint before groupTaggingsByTarget', () => {
  const src = rd(EVENT_TAGS);
  assert(src, 'src/api/event-tags/index.js must be readable.');
  const start = src.indexOf('async function aggregateNotesTagged');
  assert(start !== -1, 'event-tags must define aggregateNotesTagged.');
  const sig = src.slice(start, start + 260);
  assert(/authorConstraint/.test(sig),
    `ADR §1: aggregateNotesTagged must accept { …, authorConstraint, observer }; signature was: ${sig.split('\n')[0]}`);
  const body = src.slice(start, start + 4000);
  const compose = body.indexOf('authorPredicateFor');
  const group = body.indexOf('groupTaggingsByTarget');
  assert(compose !== -1,
    'ADR §1: the note/item side must compose trustPredicateFor\'s result through the shared authorPredicateFor helper.');
  assert(group !== -1 && compose < group,
    'the composition must happen before core.groupTaggingsByTarget — the fold consumes an already-filtered set.');
});

// ===========================================================================
// S — source sentinels (the dialog, the client default, the read surfaces)
// ===========================================================================

test('S1 (AC-1): the curation dialog offers a two-option "Trust scope" — "My web of trust" and "Only me"', () => {
  const src = rd(DIALOG);
  assert(src, 'CurationMethodDialog.jsx must be readable.');
  assert(/Trust scope/.test(src),
    'AC-1 / ADR §3: the dialog needs a control labelled "Trust scope" (a separate control, NOT a value in the method enum).');
  assert(/My web of trust/.test(src) && /Only me/.test(src),
    'AC-1: the two options are labelled "My web of trust" and "Only me" (Gate A ruling 2).');
  assert(/type="radio"/.test(src),
    'Gate A ruling 2: a two-option radio group, not a checkbox — a checkbox reads as a modifier and under-sells that this is what makes the list certain.');
});

test('S2 (E3, AC-3): the dialog defaults to web-of-trust and emits authorConstraint ONLY when "Only me" is chosen', () => {
  const src = stripComments(rd(DIALOG));
  assert(/authorConstraint/.test(src), 'ADR §3: the dialog must read and write authorConstraint.');
  assert(/init\.authorConstraint/.test(src),
    'ADR §3: the control is seeded from init.authorConstraint (the initTypes discipline), so editing a pin round-trips its own value.');
  assert(!/authorConstraint:\s*undefined/.test(src),
    'ADR §3: never emit `authorConstraint: undefined` — a conditional spread keeps a pre-story pin\'s blob byte-identical (E3).');
  // Re-aimed 2026-09-18 (search-index-selection #4): the submit build moved verbatim out of the
  // JSX into the pure module ui/src/utils/curationDialogBuild.js (buildCuration). The RULE is
  // unchanged — the field rides the blob only by conditional spread — and is asserted where the
  // build now lives; the dialog's seeding/raw/touched assertions above stay on the dialog.
  const buildSrc = stripComments(rd(require('path').join(require('path').dirname(DIALOG), '../utils/curationDialogBuild.js')));
  const inModule = buildSrc.indexOf('curation: {') > -1;
  const submit = inModule
    ? buildSrc.slice(buildSrc.indexOf('curation: {'), buildSrc.indexOf('},', buildSrc.indexOf('curation: {')))  // the returned blob, in the pure module
    : src.slice(src.indexOf('const custom = {'), src.indexOf('setSubmitting(true)'));                          // pre-extraction shape
  // 2. the negative "never emit <field>: undefined" rule must be checked where the blob is BUILT
  //    (the module once it exists), not only in the JSX that no longer builds it.
  assert(!new RegExp(`authorConstraint:\\s*undefined`).test(inModule ? buildSrc : src),
    'the build must never emit `authorConstraint: undefined` — a conditional spread keeps a pre-story pin\'s blob byte-identical.');
  assert(/\.\.\.\(/.test(submit) && /authorConstraint/.test(submit),
    `ADR §3: the field must be included by conditional spread in the submitted blob; got: ${submit.trim().slice(0, 400)}`);
});

test('S3 (ADR §3): an initial value this build does not recognise is re-emitted verbatim, never silently downgraded', () => {
  const src = stripComments(rd(DIALOG));
  assert(/authorConstraint/.test(src), 'ADR §3: the dialog must handle authorConstraint.');
  assert(/(rawAuthorConstraint|initialAuthorConstraint|authorConstraintRaw)/.test(src),
    'ADR §3: the RAW initial value must be kept in state and re-emitted when the user does not touch the control — otherwise editing a rung-2 pin on an old build silently downgrades it to WoT.');
});

test('S4 (AC-3): the client\'s defaultCurationMethod leaves NEW pins unconstrained', () => {
  const src = rd(PUBLISH_TAG_PIN);
  assert(src, 'publishTagPin.js must be readable.');
  const start = src.indexOf('export function defaultCurationMethod');
  assert(start !== -1, 'publishTagPin.js must export defaultCurationMethod.');
  const body = stripComments(src.slice(start, src.indexOf('\n}', start)));
  assert(!/authorConstraint/.test(body),
    'ADR §2: a new pin is unconstrained by default — narrowing whose assertions count is not a safe default (the one place this story diverges from the targetTypes precedent).');
});

test('S5 (AC-5): the TL read surface parses the author-constraint tag', () => {
  const src = rd(TL_DETAIL);
  assert(src, 'useTLDetail.js must be readable.');
  assert(/author-constraint/.test(src),
    "ADR §5: useTLDetail must parse findTag('author-constraint') into the tl object — the disclosure is on the LIST, which is the surface a consumer actually has.");
  assert(/authorConstraint/.test(src), 'the parsed value must land on the tl object as authorConstraint.');
});

test('S6 (AC-5): the pin detail panel renders a "Curation scope" row reading "Only me"', () => {
  const src = rd(PANEL);
  assert(src, 'PinnedListPanel.jsx must be readable.');
  assert(/Curation scope/.test(src),
    'ADR §5: the pin detail meta gains a "Curation scope" row so a reader can tell a self-curated list from a WoT threshold.');
  assert(/Only me/.test(src), 'ADR §5: the row reads "Only me (only the observer\'s taggings counted)".');
  assert(/authorConstraint/.test(src), 'the row must be driven by tl.authorConstraint, and only render when set.');
});

test('S7 (concept graph): the tag-pinning firmware schema documents the new curationMethod field', () => {
  const src = rd(FIRMWARE_SCHEMA);
  assert(src, 'firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json must be readable.');
  assert(/authorConstraint/.test(src),
    "ADR Consequences: the schema's curationMethod description is the only human-readable definition of the vocabulary — it must gain authorConstraint ('observer'; absent = unconstrained), then POST /api/firmware/install.");
});

test('S8 (CLAUDE.md): no deployment TA pubkey literal is introduced by any touched file', () => {
  const clean = [PINS_LIB, REFRESH_PATH, DIALOG, TL_DETAIL, PANEL];
  for (const p of clean) {
    const hits = (rd(p).match(/[0-9a-f]{64}/g) || []);
    assert(hits.length === 0,
      `CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode": ${path.relative(REPO, p)} must contain no 64-hex literal; found ${JSON.stringify(hits.slice(0, 2))}.`);
  }
  const et = (rd(EVENT_TAGS).match(/[0-9a-f]{64}/g) || []);
  assert(et.length === 1,
    `src/api/event-tags/index.js may keep exactly its one ADR-0015 CANONICAL_AUTHORITY literal and gain no other; found ${et.length}.`);
});

// ===========================================================================
// R — regression sentinels (green before AND after)
// ===========================================================================

test('R1 (AC-8): retractStaleTLs carries over identity/provenance/discovery only — never the scoring tags', () => {
  const src = rd(REFRESH_PATH);
  const start = src.indexOf('async function retractStaleTLs');
  assert(start !== -1, 'refreshPinnedTags.js must define retractStaleTLs.');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  const carry = body.slice(body.indexOf('const carryOver'), body.indexOf('const carryOver') + 400);
  assert(!/author-constraint/.test(carry),
    "ADR §4: carryOver must NOT gain 'author-constraint' — a retracted list has an empty membership, so there is no curated set left to characterise (its siblings cutoff/min-rank are already dropped).");
  for (const t of ['title', 'metric', 'observer', 'source-tag']) {
    assert(carry.includes(`'${t}'`), `carryOver must still keep '${t}'.`);
  }
  assert(!/'cutoff'/.test(carry) && !/'min-rank'/.test(carry),
    'the scoring tags stay dropped on retraction (unchanged).');
});

test('R2 (AC-8): min-rank and cutoff are still emitted, with their pre-story values', async () => {
  const { call } = await runProfilePin(makePin({ authorConstraint: 'observer', cutoff: 3 }));
  const find = (n) => (call.extraTags || []).find((t) => t[0] === n);
  assert(deepEq(find('cutoff'), ['cutoff', '3']),
    `Gate A ruling 4: cutoff is left as-is under the constraint (it still binds); got ${JSON.stringify(find('cutoff'))}.`);
  assert(deepEq(find('min-rank'), ['min-rank', '0.25']),
    `Gate A ruling 4: min-rank stays an honest record of what ran; got ${JSON.stringify(find('min-rank'))}.`);
});

test('R3 (AC-7): the membership-method registry and its fail-safe resolver are untouched', () => {
  const mm = safeRequire(MEMBERSHIP);
  assert(deepEq(mm.METHOD_IDS, ['count', 'input', 'certainty']),
    `AC-7: the three methods are unchanged; got ${JSON.stringify(mm.METHOD_IDS)}.`);
  assert(deepEq(mm.IMPLEMENTED_METHOD_IDS, ['count', 'input', 'certainty']),
    'AC-7: the implemented set is unchanged.');
  assert(typeof mm.resolveMembershipMethod === 'function' && mm.resolveMembershipMethod() === 'count',
    'resolveMembershipMethod must stay the fail-safe pipeline-wide dial (no settings on this host ⇒ "count").');
  assert(!/authorConstraint/.test(rd(MEMBERSHIP)),
    'AC-7: membershipMethods.js must not learn about the constraint — the filter happens before the fold.');
});

test('R4 (AC-7): the three membership folds in runOnePin are unchanged and constraint-blind', () => {
  const src = rd(REFRESH_PATH);
  const start = src.indexOf('const membershipFolds = {');
  assert(start !== -1, 'runOnePin must still build the membershipFolds dispatch map.');
  const region = src.slice(start, src.indexOf('};', start));
  for (const m of ['count:', 'input:', 'certainty:']) {
    assert(region.includes(m), `AC-7: the ${m.slice(0, -1)} fold must survive verbatim.`);
  }
  assert(!/authorConstraint/.test(region),
    'AC-7: no method may be special-cased — the constraint filters the set BEFORE the fold, so the fold never mentions it.');
  assert(/applyDisputesFunction\(byTarget, cutoff\)/.test(region),
    'the folds still read the already-filtered byTarget with the pin\'s cutoff (dispute handling unchanged, E1).');
});

test('R5: the guard suites this story must not edit are present, and still own unconstrained byte-identity', () => {
  for (const f of ['pin-stack-composition', 'item-trusted-list', 'note-trusted-list', 'generalized-tag-pinning']) {
    assert(rd(path.join(REPO, `test/${f}.test.js`)), `guard suite test/${f}.test.js must exist and stay unedited by Phase 4.`);
  }
  const guard = rd(PIN_STACK_SUITE);
  assert(/AC-4: a neutral pin under the count method publishes exactly the pre-change 30392 event/.test(guard)
    && /AC-4: a neutral pin publishes exactly the pre-change 30393 note event/.test(guard),
    'pin-stack-composition AC-4 keeps the literal whole-event fixtures for unconstrained pins — AC-3\'s byte-identity guard, cited rather than duplicated here.');
});

// ===========================================================================

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\nonly-me-curation: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
