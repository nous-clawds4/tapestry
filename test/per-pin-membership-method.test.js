/**
 * search-index-selection #3 — a per-pin membership method (`membershipMethod`).
 *
 * Story: engineering-team/stories/search-index-selection/3-per-pin-membership-method.md
 * ADR:   engineering-team/decisions/search-index-selection/0002-per-pin-membership-method.md (Accepted)
 * Plan:  engineering-team/test-plans/search-index-selection/3-per-pin-membership-method.md
 *
 * A pin's `curationMethod` may carry `membershipMethod`. When it carries an IMPLEMENTED
 * value, THAT fold runs — regardless of the deployment-wide dial. Absent ⇒ the dial, exactly
 * as today. Unknown ⇒ fail OPEN to the dial (one warn, never a refusal to refresh). And every
 * published 30392 now discloses the fold that ACTUALLY ran (post-downgrade) as
 * ['membership-method', <id>] — the one deliberate, non-additive wire change, reversing the
 * Story-4 strip.
 *
 * Four classes:
 *   U — the pure registry predicate `isImplementedMembershipMethod` in
 *       src/api/trustedList/membershipMethods.js. No settings, no I/O, no pins.
 *   H — `runOnePin` / `runOneNotePin` / `runOneItemPin` driven through INJECTED deps: which
 *       fold actually runs, what the published event discloses and where, fail-open, the WoT
 *       downgrade, composition with ADR 0001's author constraint, and the dial-flip sentinel.
 *   S — source sentinels: the dialog's new select, the single UI vocabulary module, the Trust
 *       Determination copy, the two read surfaces, the firmware schema, the client default,
 *       the retired strip comment, the no-TA-literal rule.
 *   R — regression sentinels on the deliberately untouched surfaces (green BEFORE and AFTER).
 *
 * STACK-FREE. No strfry, no neo4j, no control panel, no Playwright. `TA_PUBKEY` is provisioned
 * via env at load time (the runner composes every z from the RUNTIME TA).
 *
 * GUARD SUITES — Phase 4 must not edit: test/pin-stack-composition.test.js (except the two
 * AC-4 30392 fixtures the Tester re-aimed in Phase 3), test/only-me-curation.test.js (except
 * H3, likewise re-aimed), test/item-trusted-list.test.js, test/note-trusted-list.test.js.
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
const MEMBERSHIP = SRC('api/trustedList/membershipMethods.js');
const PROFILE_TAGS = SRC('api/profile-tags/index.js');
const DIALOG = UI('components/CurationMethodDialog.jsx');
const TRUST_PAGE = UI('pages/grapevine/TrustDetermination.jsx');
const UI_VOCAB = UI('config/tlMembershipMethods.js');
const PUBLISH_TAG_PIN = UI('utils/publishTagPin.js');
const TL_DETAIL = UI('hooks/useTLDetail.js');
const PANEL = UI('components/PinnedListPanel.jsx');
const FIRMWARE_SCHEMA = path.join(REPO, 'firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json');

// ── harness ─────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
/** Never crash the run on a missing/broken module — report it as a named failure. */
function safeRequire(p) { try { return require(p); } catch (e) { return { __loadError: e.message }; } }
function loadRefresh() { return safeRequire(REFRESH_PATH); }
function loadMembership() { return safeRequire(MEMBERSHIP); }
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
/** Capture console.warn for the duration of an async call (the fail-open notice). */
async function withWarnCapture(fn) {
  const warns = [];
  const original = console.warn;
  console.warn = (...args) => { warns.push(args.map((a) => String(a)).join(' ')); };
  try { return { value: await fn(), warns }; }
  finally { console.warn = original; }
}

// ── fixtures ────────────────────────────────────────────────────────────────
const HEX = (c) => c.repeat(64);
const OBS = HEX('a');            // the pin's observer — "me"
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

// The one corpus every fold in this suite is applied to. Hand-computed expectations:
//   count     → [M1 (3 endorsements), M2 (2)], NO score key at all
//   input     → same membership/order, score = round6(weightedSum) → M1 1, M2 2
//   certainty → M1 (1/1)*(1-0.5^1)*100 = 50 ; M2 (2/2)*(1-0.5^2)*100 = 75 ; ordered score desc
function byTargetMap() {
  return new Map([
    [M1, { pubkey: M1, applications: 3, disputes: 0, weightedSum: 1, weightedInput: 1 }],
    [M2, { pubkey: M2, applications: 2, disputes: 1, weightedSum: 2, weightedInput: 2 }],
  ]);
}
const EXPECT_ITEMS = {
  count: [{ tag: 'p', value: M1 }, { tag: 'p', value: M2 }],
  input: [{ tag: 'p', value: M1, score: 1 }, { tag: 'p', value: M2, score: 2 }],
  certainty: [{ tag: 'p', value: M2, score: 75 }, { tag: 'p', value: M1, score: 50 }],
};

/**
 * A kind-39999 pin. `membershipMethod: undefined` ⇒ the field is ABSENT from the published
 * curation-method blob (every pin published before this story).
 */
function makePin({
  observer = OBS, membershipMethod, authorConstraint, contextSlug = null, taPubkey,
  cutoff = 1, targetTypes, noteMethod = 'notes:net-endorsed',
} = {}) {
  const cm = { method: 'nip85:rank', observer, cutoff, noteMethod };
  if (targetTypes !== undefined) cm.targetTypes = targetTypes;
  if (authorConstraint !== undefined) cm.authorConstraint = authorConstraint;
  if (membershipMethod !== undefined) cm.membershipMethod = membershipMethod;
  const tags = [['e', TAG_EVENT_ID], ['z', TAG_PINNING_Z], ['curation-method', JSON.stringify(cm)]];
  if (contextSlug) tags.push(['z', `39998:${taPubkey || runnerTaPubkey()}:${contextSlug}`]);
  return { id: `pin-${membershipMethod || 'dial'}`, kind: 39999, pubkey: observer, created_at: 10, tags, content: '{}' };
}

/**
 * Deps for runOnePin. `membershipMethod` here is THE INSTANCE DIAL — the argument-blind,
 * zero-arg stub every hermetic suite injects (ADR §1: the seam keeps meaning "the dial").
 * `wotFiltering: false` reproduces "the WoT filter did not run" (E2).
 */
function profileDeps({ dial = 'count', wotFiltering = true } = {}) {
  const publishCalls = []; const aggArgs = []; const dialCalls = [];
  return {
    publishCalls, aggArgs, dialCalls,
    deps: {
      lookupTag: async () => TAG,
      aggregateProfilesTagged: async (args) => { aggArgs.push(args); return { byTarget: byTargetMap(), wotFiltering }; },
      resolvePov: () => POV,
      resolveMembershipMethod: (...args) => { dialCalls.push(args); return dial; },
      ensureTagTLHeader: async () => ({ status: 'exists' }),
      ensureHeader: async () => ({ status: 'exists' }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30392' }, uuid: 'u1' }; },
    },
  };
}

function noteDeps() {
  const publishCalls = []; const aggArgs = []; const dialCalls = [];
  const full = [{ id: N1, applications: 3, disputes: 0, createdAt: 100 }];
  return {
    publishCalls, aggArgs, dialCalls,
    deps: {
      lookupTag: async () => TAG,
      aggregateNotesTagged: async (args) => {
        aggArgs.push(args);
        return { members: full, fullMembers: full, scanTruncated: false, total: full.length };
      },
      resolvePov: () => POV,
      resolveMembershipMethod: (...args) => { dialCalls.push(args); return 'certainty'; },
      ensureTagTLHeader: async () => ({ status: 'exists' }),
      ensureHeader: async () => ({ status: 'exists' }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30393' }, uuid: 'u2' }; },
    },
  };
}

function itemDeps() {
  const publishCalls = []; const aggArgs = []; const dialCalls = [];
  const items = [{ address: ADDR(1), applications: 2, disputes: 0, createdAt: 100, mine: false }];
  return {
    publishCalls, aggArgs, dialCalls,
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
      resolveMembershipMethod: (...args) => { dialCalls.push(args); return 'certainty'; },
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
  const { deps, publishCalls, aggArgs, dialCalls } = profileDeps(opts);
  let result;
  try { result = await mod.runOnePin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls, aggArgs, dialCalls };
}

async function runNotePin(pin) {
  const mod = loadRefresh();
  assert(typeof mod.runOneNotePin === 'function', 'refreshPinnedTags.js must export runOneNotePin.');
  const { deps, publishCalls, aggArgs, dialCalls } = noteDeps();
  let result;
  try { result = await mod.runOneNotePin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls, aggArgs, dialCalls };
}

async function runItemPin(pin) {
  const mod = loadRefresh();
  assert(typeof mod.runOneItemPin === 'function', 'refreshPinnedTags.js must export runOneItemPin.');
  const { deps, publishCalls, aggArgs, dialCalls } = itemDeps();
  let result;
  try { result = await mod.runOneItemPin(pin, { deps, ...deps }); }
  catch (err) { throw new Error(DEPS_CONTRACT + `it reached the real stack instead: ${err.message}`); }
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls, aggArgs, dialCalls };
}

function tlZPair() {
  const ta = runnerTaPubkey();
  return [['z', `39998:${ta}:trusted-list`], ['z', `39999:${ta}:tl:funny-tls`]];
}
function tagNames(call) { return (call.extraTags || []).map((t) => t[0]); }
function methodTags(call) { return (call.extraTags || []).filter((t) => t[0] === 'membership-method'); }
function disclosed(call) { const f = methodTags(call); return f.length === 1 ? f[0][1] : null; }
/** The published members, as the consumer sees them: pubkey + score slot (absent under count). */
function publishedItems(call) { return call.items || []; }
function uniqueUnknown(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 8)}`; }

// ===========================================================================
// U — the pure registry predicate (ADR §1)
// ===========================================================================

test('U1 (AC-1): the registry exports isImplementedMembershipMethod, true for every implemented id', () => {
  const mm = loadMembership();
  assert(typeof mm.isImplementedMembershipMethod === 'function',
    `ADR §1: src/api/trustedList/membershipMethods.js must export the pure predicate ` +
    `isImplementedMembershipMethod(v) — the vocabulary check belongs in the module that owns the ` +
    `vocabulary. Load error: ${mm.__loadError || 'none'}.`);
  assert(Array.isArray(mm.IMPLEMENTED_METHOD_IDS) && mm.IMPLEMENTED_METHOD_IDS.length > 0,
    'IMPLEMENTED_METHOD_IDS must still be a non-empty array.');
  for (const id of mm.IMPLEMENTED_METHOD_IDS) {
    assert(mm.isImplementedMembershipMethod(id) === true,
      `isImplementedMembershipMethod(${JSON.stringify(id)}) must be true — it is in IMPLEMENTED_METHOD_IDS.`);
  }
});

test('U2 (AC-3): the predicate is false for absent, unknown, future-rung and non-string values', () => {
  const mm = loadMembership();
  assert(typeof mm.isImplementedMembershipMethod === 'function',
    'ADR §1: membershipMethods.js must export isImplementedMembershipMethod(v).');
  const rejects = [
    undefined, null, '', 'COUNT', 'Certainty', ' count', 'count ', 'rung-9', 'nip85:rank',
    'notes:net-endorsed', 'blorp', 0, 1, true, false, {}, [], ['count'], NaN,
  ];
  for (const bad of rejects) {
    assert(mm.isImplementedMembershipMethod(bad) === false,
      `AC-3: isImplementedMembershipMethod(${JSON.stringify(bad)}) must be FALSE (strictly false, not falsy) — ` +
      'the vocabulary is closed and case-exact, so a present-but-unimplemented pin value falls back to the dial.');
  }
});

test('U3 (ADR §1): the predicate stays pin-blind and pure — no settings read, no logging', () => {
  const mm = loadMembership();
  assert(typeof mm.isImplementedMembershipMethod === 'function',
    'ADR §1: membershipMethods.js must export isImplementedMembershipMethod(v).');
  assert(mm.isImplementedMembershipMethod.length === 1,
    `the predicate takes exactly one argument (the candidate value); got arity ${mm.isImplementedMembershipMethod.length}.`);
  const body = String(mm.isImplementedMembershipMethod);
  assert(!/getSettings|require\(/.test(body),
    `ADR §1: the predicate must not read settings — it answers "is this in the vocabulary?", never "what is this deployment set to?"; body was: ${body}`);
  assert(!/console\./.test(body),
    'ADR §1: the one-time "unknown pin method" warn lives at the refreshPinnedTags call site, not in the registry.');
  assert(!/curation|pinEvent|membershipMethod\s*\./.test(stripComments(String(mm.isImplementedMembershipMethod))),
    'ADR §1 / Option B rejection: the registry must stay blind to pins — it receives a bare value, never a pin or a blob.');
});

// ===========================================================================
// H — the runners, driven through injected deps
// ===========================================================================

test("H1 (AC-1, the sharpest sentinel): the pin's 'certainty' beats a 'count' dial — the certainty fold RUNS", async () => {
  const { call } = await runProfilePin(makePin({ membershipMethod: 'certainty' }), { dial: 'count' });
  assert(call && call.kind === 30392, `expected a published 30392; got ${JSON.stringify(call && call.kind)}.`);
  assert(deepEq(publishedItems(call), EXPECT_ITEMS.certainty),
    `AC-1: on a deployment whose dial says 'count', a pin carrying membershipMethod:'certainty' must be folded by ` +
    `CERTAINTY — integer 0–100 scores, score-desc order (M2 75 before M1 50). Got ${JSON.stringify(publishedItems(call))}. ` +
    "(A 'count' fold publishes score-less p tags in endorsements-desc order — that is what a failure here looks like.)");
  assert(/"score":75/.test(call.content) && /"score":50/.test(call.content),
    `AC-1: the content JSON must carry the certainty scores too; got ${call.content}.`);
});

test("H2 (AC-4): that same list discloses ['membership-method','certainty'] exactly once", async () => {
  const { call } = await runProfilePin(makePin({ membershipMethod: 'certainty' }), { dial: 'count' });
  const found = methodTags(call);
  assert(found.length === 1,
    `AC-4: exactly one ['membership-method', …] tag on every 30392; got ${found.length} (extraTags: ${JSON.stringify(call.extraTags)}).`);
  assert(deepEq(found[0], ['membership-method', 'certainty']),
    `AC-4: the tag names the fold that RAN — the pin's method, not the dial's; got ${JSON.stringify(found[0])}.`);
});

test("H3 (AC-2): an ABSENT membershipMethod still follows the instance dial, and the dial's value is disclosed", async () => {
  const { call, dialCalls } = await runProfilePin(makePin(), { dial: 'input' });
  assert(dialCalls.length >= 1, 'AC-2: with no per-pin value the runner must consult the instance dial.');
  assert(deepEq(publishedItems(call), EXPECT_ITEMS.input),
    `AC-2: absent means today — the dial ('input') supplies the fold, so the members carry the weighted sums; got ${JSON.stringify(publishedItems(call))}.`);
  assert(disclosed(call) === 'input',
    `AC-4: the disclosure names the dial's fold when the pin chose nothing; got ${JSON.stringify(methodTags(call))}.`);
});

test("H4 (AC-2): under a 'count' dial an absent-method pin publishes today's 30392 plus exactly the one new tag", async () => {
  const { call } = await runProfilePin(makePin(), { dial: 'count' });
  assert(deepEq(call.extraTags, [
    ['observer', OBS],
    ['source-tag', TAG_EVENT_ID, TAGAUTHOR, 'funny'],
    ['cutoff', '1'],
    ['min-rank', '0.25'],
    ['membership-method', 'count'],
    ...tlZPair(),
  ]), 'AC-2 + AC-4: a pre-story pin\'s 30392 tag array must be exactly today\'s array with the ONE disclosure tag ' +
     `inserted after ['min-rank', …] — no other tag added, removed, reordered or revalued. Got ${JSON.stringify(call.extraTags)}.`);
  assert(deepEq(publishedItems(call), EXPECT_ITEMS.count),
    `AC-2: the members are still today's count fold (no score slot); got ${JSON.stringify(publishedItems(call))}.`);
});

test('H5 (AC-3): an UNKNOWN per-pin value fails OPEN to the dial, discloses the dial\'s fold, and warns once', async () => {
  const bogus = uniqueUnknown('bogus');
  const { value, warns } = await withWarnCapture(() =>
    runProfilePin(makePin({ membershipMethod: bogus }), { dial: 'certainty' }));
  const { call, result } = value;
  assert(result && result.status === 'ok',
    `AC-3: an unknown per-pin method must never refuse the refresh — the registry's own posture is fail-safe; got ${JSON.stringify(result)}.`);
  assert(deepEq(publishedItems(call), EXPECT_ITEMS.certainty),
    `AC-3: the fold falls back to the instance dial ('certainty'); got ${JSON.stringify(publishedItems(call))}.`);
  assert(disclosed(call) === 'certainty',
    `AC-4: the list never over-claims — it discloses the fold that ran (the dial's), never the unrecognised request ` +
    `${JSON.stringify(bogus)}; got ${JSON.stringify(methodTags(call))}.`);
  const hits = warns.filter((w) => w.includes(bogus));
  assert(hits.length === 1,
    `ADR §1: exactly ONE call-site console.warn naming the offending value (module-level Set, keyed by value, so one bad ` +
    `pin cannot flood the log across refresh cycles); got ${hits.length}: ${JSON.stringify(warns)}.`);
});

test('H6 (ADR §1): the warn is SILENT when the field is simply absent — a pre-story pin is not a defect', async () => {
  const { warns } = await withWarnCapture(() => runProfilePin(makePin(), { dial: 'count' }));
  const noisy = warns.filter((w) => /membershipMethod|membership-method/i.test(w));
  assert(noisy.length === 0,
    `ADR §1: warnUnknownPinMembershipMethod must return early on undefined/null — every pin published to date omits the ` +
    `field, so warning on absence would log once per pin per refresh cycle forever. Got ${JSON.stringify(noisy)}.`);
});

test("H7 (E2, AC-3): a weighted per-pin method with the WoT filter OFF downgrades to count — and says 'count'", async () => {
  const { call } = await runProfilePin(makePin({ membershipMethod: 'certainty' }), { dial: 'count', wotFiltering: false });
  assert(deepEq(publishedItems(call), EXPECT_ITEMS.count),
    `E2: the existing degradation (refreshPinnedTags.js:306-307) applies to the PER-PIN value exactly as it applied to the ` +
    `dial's — no ranks, no weighted fold; got ${JSON.stringify(publishedItems(call))}.`);
  assert(disclosed(call) === 'count',
    `AC-4 / E2: the disclosure records the POST-DOWNGRADE fold — the math that actually ran, never the method the pin ` +
    `requested; got ${JSON.stringify(methodTags(call))}.`);
  assert(!tagNames(call).includes('rigor'),
    "E2: a downgraded list is a count list — ['rigor','0.5'] rides certainty only, unchanged.");
});

test("H8 (AC-4, ADR §2): the tag sits after author-constraint/min-rank and immediately before rigor", async () => {
  // Unconstrained: min-rank is the immediate predecessor (authorConstraintTags contributes nothing).
  const plain = await runProfilePin(makePin({ membershipMethod: 'input' }), { dial: 'count' });
  let names = tagNames(plain.call);
  assert(names.indexOf('membership-method') === names.indexOf('min-rank') + 1,
    `ADR §2: with no author constraint the disclosure rides immediately after ['min-rank', …]; tag order was ${JSON.stringify(names)}.`);
  // Constrained: author-constraint keeps ADR 0001 §4's slot and the new tag follows it.
  const constrained = await runProfilePin(
    makePin({ membershipMethod: 'input', authorConstraint: 'observer' }), { dial: 'count' });
  names = tagNames(constrained.call);
  assert(names.indexOf('author-constraint') === names.indexOf('min-rank') + 1,
    `ADR 0001 §4 is unaffected — author-constraint keeps the slot right after min-rank; got ${JSON.stringify(names)}.`);
  assert(names.indexOf('membership-method') === names.indexOf('author-constraint') + 1,
    `ADR §2: the disclosure rides immediately AFTER authorConstraintTags(...); got ${JSON.stringify(names)}.`);
  // Certainty: rigor is a parameter OF the method and must read after it.
  const cert = await runProfilePin(makePin({ membershipMethod: 'certainty' }), { dial: 'count' });
  names = tagNames(cert.call);
  assert(names.indexOf('rigor') === names.indexOf('membership-method') + 1,
    `ADR §2: ['rigor','0.5'] qualifies the method, so it must sit immediately AFTER the membership-method tag; got ${JSON.stringify(names)}.`);
  assert(names.indexOf('membership-method') < names.indexOf('z'),
    'ADR §2: the scoring tags precede the discovery z pair.');
});

test('H9 (E1): the 30393 and 30394 gain NOTHING — they already disclose their own per-pin fold', async () => {
  const note = await runNotePin(makePin({ targetTypes: ['profile', 'note'], membershipMethod: 'certainty' }));
  assert(note.call && note.call.kind === 30393, 'expected a published 30393.');
  assert(methodTags(note.call).length === 0,
    `E1 / ADR §2: the note TL must NOT gain a membership-method tag — it carries ['curation-method', noteMethod]; got ${JSON.stringify(note.call.extraTags)}.`);
  assert(note.dialCalls.length === 0,
    'E1: runOneNotePin must not consult the membership dial at all (it never did).');
  const item = await runItemPin(makePin({ targetTypes: ['profile', 'note', 'item'], membershipMethod: 'certainty' }));
  assert(item.call && item.call.kind === 30394, 'expected a published 30394.');
  assert(methodTags(item.call).length === 0,
    `E1: the item TL must NOT gain a membership-method tag; got ${JSON.stringify(item.call.extraTags)}.`);
  assert(item.dialCalls.length === 0, 'E1: runOneItemPin must not consult the membership dial.');
});

test('H10 (E4 of ADR 0001): a CONTEXTUAL pin is unchanged apart from the disclosure tag', async () => {
  const TA = runnerTaPubkey();
  assert(TA, 'the runtime TA pubkey must resolve (TA_PUBKEY env) for the context fixtures.');
  const dialPin = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA }), { dial: 'count' });
  const pinPin = await runProfilePin(
    makePin({ contextSlug: 'lfo', taPubkey: TA, membershipMethod: 'count' }), { dial: 'count' });
  assert(dialPin.call.dTag === pinPin.call.dTag && /-in-lfo$/.test(pinPin.call.dTag),
    `ADR §6: the method is SCORING and never reaches the d-tag (identity); got "${dialPin.call.dTag}" vs "${pinPin.call.dTag}".`);
  const zOf = (c) => (c.extraTags || []).filter((t) => t[0] === 'z');
  assert(deepEq(zOf(dialPin.call), zOf(pinPin.call)),
    `ADR §6: the context z stays byte-identical whether the method came from the pin or the dial; got ${JSON.stringify(zOf(dialPin.call))} vs ${JSON.stringify(zOf(pinPin.call))}.`);
  assert(deepEq(dialPin.call.extraTags, pinPin.call.extraTags),
    'a contextual pin that names the same fold the dial names publishes an identical tag array — the tag records the fold, not its provenance.');
  assert(disclosed(pinPin.call) === 'count',
    `AC-4: a contextual list discloses its fold too — the tag rides EVERY 30392; got ${JSON.stringify(methodTags(pinPin.call))}.`);
});

test('H11 (E3): membershipMethod composes with authorConstraint — both honoured, both disclosed', async () => {
  const { call, aggArgs } = await runProfilePin(
    makePin({ membershipMethod: 'certainty', authorConstraint: 'observer' }), { dial: 'count' });
  const a = aggArgs[0] || {};
  assert(a.authorConstraint === 'observer' && a.observer === OBS,
    `E3: the ADR 0001 eligibility filter must still reach the aggregation when the pin also names a method; got ${JSON.stringify(a)}.`);
  assert(deepEq(publishedItems(call), EXPECT_ITEMS.certainty),
    `E3: the day-one search-index pin — { authorConstraint:'observer', membershipMethod:'certainty' } on a 'count' ` +
    `deployment — must fold by certainty; got ${JSON.stringify(publishedItems(call))}.`);
  assert(disclosed(call) === 'certainty' &&
    (call.extraTags || []).some((t) => deepEq(t, ['author-constraint', 'observer'])),
    `E3: both disclosures ride the same list; got ${JSON.stringify(call.extraTags)}.`);
  // ADR §6: the 1.0 observer self-weight is a property of the WEIGHT function, not of any fold,
  // so it must still apply under a per-pin certainty. Pinned through story 2's pure seam.
  const pt = safeRequire(PROFILE_TAGS);
  assert(typeof pt.composeAuthorPredicates === 'function',
    'story 2 shipped composeAuthorPredicates as the pure author/weight seam — E3 needs it to re-check the 1.0 carve-out.');
  const out = pt.composeAuthorPredicates({
    authorConstraint: 'observer', observer: OBS, authorAllowed: () => true, authorWeight: () => null,
  });
  assert(out.authorWeight(OBS) === 1,
    `ADR §6 / ADR 0001 AC-7: the constrained observer still weighs 1.0 under a per-pin weighted fold — otherwise the ` +
    `day-one certainty+observer pin publishes an empty list for want of a wot_rank doc; got ${JSON.stringify(out.authorWeight(OBS))}.`);
});

test('H12 (E4): flipping the instance dial moves only the pins that chose nothing', async () => {
  const explicitUnderCount = await runProfilePin(makePin({ membershipMethod: 'input' }), { dial: 'count' });
  const explicitUnderCertainty = await runProfilePin(makePin({ membershipMethod: 'input' }), { dial: 'certainty' });
  assert(deepEq(explicitUnderCount.call.items, explicitUnderCertainty.call.items)
    && deepEq(explicitUnderCount.call.extraTags, explicitUnderCertainty.call.extraTags),
    'E4: a pin carrying an explicit method is UNAFFECTED by an operator flipping the deployment dial — same members, ' +
    `same tags. Got ${JSON.stringify(explicitUnderCount.call.items)} vs ${JSON.stringify(explicitUnderCertainty.call.items)}.`);
  const absentUnderCount = await runProfilePin(makePin(), { dial: 'count' });
  const absentUnderCertainty = await runProfilePin(makePin(), { dial: 'certainty' });
  assert(!deepEq(absentUnderCount.call.items, absentUnderCertainty.call.items),
    'E4: a pin WITHOUT a method still moves with the dial — that is what keeps AC-2 honest and the dial card true.');
  assert(disclosed(absentUnderCount.call) === 'count' && disclosed(absentUnderCertainty.call) === 'certainty',
    'E4: and each published list honestly names the fold it ran under.');
});

test('H13 (ADR §1): the injected dial seam stays ZERO-ARG and pin-blind', async () => {
  const { dialCalls } = await runProfilePin(makePin({ membershipMethod: 'certainty', contextSlug: null }), { dial: 'count' });
  assert(dialCalls.every((args) => args.length === 0),
    `ADR §1 (Option B rejected): resolveMembershipMethod must keep its zero-arg signature — every existing hermetic stub is ` +
    `argument-blind, so passing the pin's value down would make the feature invisible to the suites meant to guard it. ` +
    `Got calls with args: ${JSON.stringify(dialCalls)}.`);
  const body = stripComments(rd(REFRESH_PATH));
  assert(/isImplementedMembershipMethod/.test(body),
    'ADR §1: precedence must gate on the registry\'s shared predicate, not on a second inline copy of the vocabulary or on truthiness.');
});

// ===========================================================================
// S — source sentinels (the dialog, the vocabulary module, the read surfaces)
// ===========================================================================

test('S1 (AC-5): the curation dialog offers a "Membership method" select led by an "Instance default" option', () => {
  const src = rd(DIALOG);
  assert(src, 'CurationMethodDialog.jsx must be readable.');
  assert(/Membership method/.test(src),
    'AC-5 / ADR §3: the dialog needs a control labelled "Membership method", under the existing Method select.');
  assert(/<select/.test(src) && /value=""/.test(src),
    'ADR §3: it is a <select> whose FIRST option is value="" — absence is a real, selectable choice.');
  assert(/Instance default/.test(src),
    'ADR §3: the empty option reads "Instance default" — the dialog deliberately does not try to name the current dial ' +
    '(the only endpoint carrying it is owner-gated).');
});

test('S2 (AC-5, E3-discipline): the dialog seeds from init, keeps the raw value, and spreads conditionally', () => {
  const src = stripComments(rd(DIALOG));
  assert(/membershipMethod/.test(src), 'ADR §3: the dialog must read and write membershipMethod.');
  assert(/init\.membershipMethod/.test(src),
    'ADR §3: the control is seeded from init.membershipMethod, so editing a pin round-trips its own value.');
  assert(/(rawMembershipMethod|initialMembershipMethod|membershipMethodRaw)/.test(src)
    && /membershipMethodTouched/.test(src),
    'ADR §3: the RAW initial value plus a touched flag — an untouched control re-emits the pin\'s value verbatim, so a ' +
    'future-rung value this build does not recognise is never silently downgraded.');
  assert(!/membershipMethod:\s*undefined/.test(src),
    'AC-5 / ADR §3: never emit `membershipMethod: undefined` — a conditional spread keeps a pre-story pin\'s blob byte-identical.');
  // Re-aimed 2026-09-18 (search-index-selection #4): the submit build moved verbatim out of the
  // JSX into the pure module ui/src/utils/curationDialogBuild.js (buildCuration). The RULE is
  // unchanged — the field rides the blob only by conditional spread — and is asserted where the
  // build now lives; the dialog's seeding/raw/touched assertions above stay on the dialog.
  const buildSrc = stripComments(rd(require('path').join(require('path').dirname(DIALOG), '../utils/curationDialogBuild.js')));
  const submit = buildSrc.indexOf('export function buildCuration') > -1
    ? buildSrc.slice(buildSrc.indexOf('export function buildCuration'))          // the pure module owns the build now
    : src.slice(src.indexOf('const custom = {'), src.indexOf('setSubmitting(true)')); // pre-extraction shape
  assert(/\.\.\.\(/.test(submit) && /membershipMethod/.test(submit),
    `ADR §3: the field must be included by conditional spread in the submitted blob; got: ${submit.trim().slice(0, 500)}`);
});

test('S3 (ADR §3, open question): the method vocabulary lives in ONE UI module, imported by both consumers', () => {
  const vocab = rd(UI_VOCAB);
  assert(vocab,
    'ADR §3 / sub-option (c): ui/src/config/tlMembershipMethods.js must exist — the single hand-kept client mirror ' +
    '(a third copy inside the dialog was rejected; importing from the page inverts the dependency direction).');
  assert(/export const TL_MEMBERSHIP_METHODS/.test(vocab),
    'the module exports TL_MEMBERSHIP_METHODS.');
  for (const id of ['count', 'input', 'certainty']) {
    assert(new RegExp(`id:\\s*'${id}'`).test(vocab), `the moved array must still declare the '${id}' method verbatim.`);
  }
  assert(/keep in sync/i.test(vocab),
    'the "mirrors src/api/trustedList/membershipMethods.js — keep in sync" comment moves with the array (ADR §3).');
  const page = rd(TRUST_PAGE);
  assert(/from\s+['"].*config\/tlMembershipMethods['"]/.test(page),
    'ADR §3: TrustDetermination.jsx must IMPORT the vocabulary from the new module.');
  assert(!/const TL_MEMBERSHIP_METHODS\s*=/.test(page),
    'ADR §3: TrustDetermination.jsx must no longer declare the local const — the mirror count stays 1, not 2.');
  const dialog = rd(DIALOG);
  assert(/from\s+['"].*config\/tlMembershipMethods['"]/.test(dialog),
    'ADR §3: the dialog imports the same module rather than hand-copying the ids.');
});

test('S4 (AC-6): the Trust Determination blurb describes a DEFAULT for pins that do not choose', () => {
  const src = rd(TRUST_PAGE);
  assert(src, 'TrustDetermination.jsx must be readable.');
  assert(/default for pins that don/i.test(src),
    'AC-6 / ADR §4: the card must say it is the "default for pins that don\'t choose" — it is no longer the only dial.');
  assert(/a pin can set its own membership method/i.test(src),
    'AC-6: and that a pin\'s own choice wins (the curation dialog).');
  assert(/records the method that actually ran/i.test(src),
    'AC-6: the aspirational sentence ("Published TLs record the active method…") becomes true and precise — the list records ' +
    'the method that ACTUALLY ran, which is what AC-4 now guarantees.');
  assert(/One setting for the whole pipeline/.test(src) === false,
    'AC-6: "One setting for the whole pipeline" is now false — the method can be set per pin.');
});

test('S5 (ADR §5): useTLDetail parses the membership-method tag onto the tl object', () => {
  const src = rd(TL_DETAIL);
  assert(src, 'useTLDetail.js must be readable.');
  assert(/membership-method/.test(src),
    "ADR §5: useTLDetail must parse findTag('membership-method') — the disclosure is on the LIST, which is the surface a consumer actually has.");
  assert(/membershipMethod/.test(src), 'the parsed value must land on the tl object as membershipMethod.');
});

test('S6 (ADR §5): the pin detail panel renders a "Membership method" row', () => {
  const src = rd(PANEL);
  assert(src, 'PinnedListPanel.jsx must be readable.');
  assert(/Membership method/.test(src),
    'ADR §5: PinnedListPanel gains one <dl> row, "Membership method", after "Curation scope" and before "Min rank".');
  assert(/membershipMethod/.test(src),
    'the row must be driven by tl.membershipMethod, and render only when the tag is present (pre-story lists unaffected).');
  assert(/TL_MEMBERSHIP_METHODS/.test(src),
    'ADR §5: the label comes from the shared vocabulary when the id is known — and falls back to the raw id, so a list ' +
    'published by a future rung still displays.');
});

test('S7 (concept graph): the tag-pinning firmware schema documents membershipMethod', () => {
  const src = rd(FIRMWARE_SCHEMA);
  assert(src, 'firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json must be readable.');
  assert(/membershipMethod/.test(src),
    "ADR §7: the curationMethod description is the only human-readable definition of the blob vocabulary — it must gain " +
    "membershipMethod ('count' | 'input' | 'certainty'; absent = the instance-wide default), then POST /api/firmware/install.");
});

test('S8 (AC-2): defaultCurationMethod still leaves NEW pins on the instance default', () => {
  const src = rd(PUBLISH_TAG_PIN);
  assert(src, 'publishTagPin.js must be readable.');
  const start = src.indexOf('export function defaultCurationMethod');
  assert(start !== -1, 'publishTagPin.js must export defaultCurationMethod.');
  const body = stripComments(src.slice(start, src.indexOf('\n}', start)));
  assert(!/membershipMethod/.test(body),
    'ADR §3: a new pin deliberately carries NO membershipMethod — it follows the dial, same call ADR 0001 §2 made for ' +
    'authorConstraint. Stamping one at create time would freeze every new pin against a later operator change.');
});

test('S9 (AC-4): the Story-4 "membership-method is stripped" comment is gone from the runner', () => {
  const src = rd(REFRESH_PATH);
  assert(src, 'refreshPinnedTags.js must be readable.');
  assert(!/membership-method tag is stripped|stripped \(never\s*\n?\s*\/\/\s*spec'd\)|never spec'd/.test(src),
    'AC-4 / ADR §2: the strip comment at :372-374 must be REPLACED, not left beside the code that now contradicts it — ' +
    'a stale comment claiming the tag is stripped is the next reader\'s false premise.');
  assert(/\['membership-method'/.test(src) || /"membership-method"/.test(src),
    'AC-4: the runner must emit the tag literally.');
});

test('S10 (CLAUDE.md): no deployment TA pubkey literal is introduced by any touched file', () => {
  const touched = [REFRESH_PATH, MEMBERSHIP, DIALOG, TRUST_PAGE, UI_VOCAB, TL_DETAIL, PANEL];
  for (const p of touched) {
    const hits = (rd(p).match(/[0-9a-f]{64}/g) || []);
    assert(hits.length === 0,
      `CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode": ${path.relative(REPO, p)} must contain no 64-hex literal; found ${JSON.stringify(hits.slice(0, 2))}.`);
  }
});

// ===========================================================================
// R — regression sentinels (green BEFORE and AFTER)
// ===========================================================================

test('R1: retractStaleTLs carryOver does NOT learn membership-method', () => {
  const src = rd(REFRESH_PATH);
  const start = src.indexOf('async function retractStaleTLs');
  assert(start !== -1, 'refreshPinnedTags.js must define retractStaleTLs.');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  const carry = body.slice(body.indexOf('const carryOver'), body.indexOf('const carryOver') + 400);
  assert(!/membership-method/.test(carry),
    "ADR §2: carryOver stays identity + provenance + discovery — a retracted list has an EMPTY membership, so there is no " +
    "fold left to characterise. Its siblings cutoff/min-rank/author-constraint are already dropped.");
  for (const t of ['title', 'metric', 'observer', 'source-tag']) {
    assert(carry.includes(`'${t}'`), `carryOver must still keep '${t}'.`);
  }
  assert(!/'cutoff'/.test(carry) && !/'min-rank'/.test(carry) && !/'author-constraint'/.test(carry),
    'the scoring tags stay dropped on retraction (unchanged).');
});

test('R2 (ADR §5): enrichRowsWithTLStatus does not read the membership method', () => {
  const src = rd(PROFILE_TAGS);
  const start = src.indexOf('function enrichRowsWithTLStatus');
  assert(start !== -1, 'profile-tags must define enrichRowsWithTLStatus.');
  const body = src.slice(start, start + 4000);
  assert(!/membershipMethod|membership-method/.test(body),
    'ADR §5: the TL-status enrichment keys on method + observer + context, none of which move. If it starts reading the ' +
    'membership method, the per-pin value has leaked into an identity path.');
});

test('R3 (AC-2): resolveMembershipMethod keeps its zero-arg signature, its settings read and its fail-safe', () => {
  const mm = loadMembership();
  assert(typeof mm.resolveMembershipMethod === 'function',
    `membershipMethods.js must still export resolveMembershipMethod (load error: ${mm.__loadError || 'none'}).`);
  assert(mm.resolveMembershipMethod.length === 0,
    `ADR §1 (Option B rejected): the resolver must take NO parameter — the pin's value is composed by the runner, not ` +
    `handed to the dial; got arity ${mm.resolveMembershipMethod.length}.`);
  assert(mm.resolveMembershipMethod() === 'count',
    'the dial still fails safe to "count" (no settings on this host) — the pin falls back to the dial, the dial to count.');
  assert(deepEq(mm.METHOD_IDS, ['count', 'input', 'certainty']),
    `the wire-stable ladder is unchanged; got ${JSON.stringify(mm.METHOD_IDS)}.`);
  assert(deepEq(mm.IMPLEMENTED_METHOD_IDS, ['count', 'input', 'certainty']),
    'the implemented set is unchanged.');
  assert(/trustedLists\?\.\.?membershipMethod|trustedLists\?\.membershipMethod/.test(rd(MEMBERSHIP)),
    'the resolver still reads trustedLists.membershipMethod out of settings, fresh per call.');
});

test('R4 (E1): the note and item runners still read their own per-pin noteMethod, unchanged', async () => {
  const note = await runNotePin(makePin({ targetTypes: ['profile', 'note'], noteMethod: 'notes:net-endorsed' }));
  assert((note.call.extraTags || []).some((t) => deepEq(t, ['curation-method', 'notes:net-endorsed'])),
    `E1: the 30393 still discloses its per-pin fold as ['curation-method', noteMethod]; got ${JSON.stringify(note.call.extraTags)}.`);
  const item = await runItemPin(makePin({ targetTypes: ['profile', 'note', 'item'] }));
  assert((item.call.extraTags || []).some((t) => deepEq(t, ['curation-method', 'notes:net-endorsed'])),
    `E1: the 30394 likewise; got ${JSON.stringify(item.call.extraTags)}.`);
  const src = rd(REFRESH_PATH);
  for (const fn of ['async function runOneNotePin', 'async function runOneItemPin']) {
    const start = src.indexOf(fn);
    assert(start !== -1, `refreshPinnedTags.js must define ${fn}.`);
    const body = src.slice(start, src.indexOf('\n}\n', start));
    assert(!/membershipMethod/.test(body),
      `E1 / Gate A ruling 1: ${fn} must not learn membershipMethod — noteMethod and membershipMethod are two vocabularies, ` +
      'not one merged field; merging them would change the meaning of already-published note pins.');
  }
});

test('R5: the three membership folds are unchanged and method-provenance-blind', () => {
  const src = rd(REFRESH_PATH);
  const start = src.indexOf('const membershipFolds = {');
  assert(start !== -1, 'runOnePin must still build the membershipFolds dispatch map.');
  const region = src.slice(start, src.indexOf('};', start));
  for (const m of ['count:', 'input:', 'certainty:']) {
    assert(region.includes(m), `the ${m.slice(0, -1)} fold must survive verbatim.`);
  }
  assert(!/curation\.|pinEvent/.test(region),
    'ADR §1: no fold may be special-cased on where the method came from — the dispatch map is byte-identical.');
  assert(/applyDisputesFunction\(byTarget, cutoff\)/.test(region),
    "the folds still read the already-filtered byTarget with the pin's cutoff (dispute handling unchanged).");
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
  console.log(`\nper-pin-membership-method: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
