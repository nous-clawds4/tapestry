/**
 * Story feat-tags-modernization #2 — pin-stack integration (contextual pins × TL membership
 * methods). ADR feat-tags-modernization/0001 "Pin-stack composition"; test plan
 * engineering-team/stories/feat-tags-modernization/2-pin-stack-integration.test-plan.md
 *
 * THE DELTA SUITE. The story's AC-1/AC-2/AC-7 acceptance list is the ten pre-existing red
 * assertions in test/context-scoped-pins.test.js (23/32) and
 * test/restore-historical-data-and-fix-tl-author-filter.test.js (21/22) — untouched here.
 * This file covers only what those suites do NOT:
 *
 *   Z*  AC-3  the context `z` on the published TLs (30392 AND 30393), executed through the
 *             real runners with injected deps — the handle form, its runtime-TA provenance,
 *             and its absence on a neutral pin.
 *   B*  AC-4  neutral pins are byte-identical: the published event pinned as a LITERAL
 *             fixture (count + certainty + note TL), so "unchanged" cannot be satisfied by
 *             re-deriving the same formula.
 *   P*  AC-6  client/server parity by construction: one shared composer, two thin wrappers.
 *   D*  AC-5  contextual-pins/0001 flipped to Accepted.
 *   E*        ADR ordering rule (context before method) + the two interim-tree hazards the
 *             ADR's Consequences name (mutual TL overwrite; retraction sweep).
 *   F*  AC-7  the Pinned tab's "update the note list" is a SERVER recompute.
 *
 * STACK-FREE. No strfry, no neo4j, no control panel: every runner call injects its deps and
 * every other assertion reads source text. `TA_PUBKEY` is provisioned via env at load time.
 *
 * TESTABILITY CONTRACT this suite introduces (flagged in the plan as an ADR gap): `runOnePin`
 * must accept injected deps the way `runOneNotePin` already does —
 *   runOnePin(pinEvent, { deps: { lookupTag, aggregateProfilesTagged, resolvePov,
 *                                 resolveMembershipMethod, publishTL } })
 * — otherwise neither AC-3's published-`z` nor AC-4's byte-identity is checkable without a
 * live stack. Defaults must stay the real implementations.
 */

'use strict';

// Must be set BEFORE the server modules load: getOwnerAssistantPubkey() reads env first, and
// this host has no /etc/brainstorm.conf (the stack runs in Docker). Respects a real value.
const FIXTURE_TA = 'f'.repeat(63) + '1';
if (!process.env.TA_PUBKEY) process.env.TA_PUBKEY = FIXTURE_TA;

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const SRC = (p) => path.join(REPO, 'src', p);
const UI = (p) => path.join(REPO, 'ui', 'src', p);
const REFRESH_PATH = SRC('api/trustedList/refreshPinnedTags.js');
const PINS_LIB = SRC('lib/event-tagging/pins.js');
const PUBLISH_TAG_PIN = UI('utils/publishTagPin.js');
const PANEL = UI('components/PinnedListPanel.jsx');
const CONTEXTUAL_PINS_ADR = path.join(
  REPO, 'engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md');

const tests = [];
function t(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadRefresh() { try { return require(REFRESH_PATH); } catch (e) { return { __loadError: e.message }; } }
function loadPins() { try { return require(PINS_LIB); } catch (e) { return { __loadError: e.message }; } }

// The TA the runner itself will use (same module instance, so the same value).
function runnerTaPubkey() {
  try { return require(SRC('api/profile-tags')).TA_PUBKEY || null; } catch { return null; }
}

// ── fixtures ────────────────────────────────────────────────────────────────
const HEX = (c) => c.repeat(64);
const OBS = HEX('a');
const TAGAUTHOR = HEX('b');
const TAG_EVENT_ID = HEX('c');
const M1 = HEX('1');
const M2 = HEX('2');
const N1 = HEX('3');
const N2 = HEX('4');
const TAG = { eventId: TAG_EVENT_ID, slug: 'funny', name: 'Funny', authorPubkey: TAGAUTHOR, createdAt: 1 };
const POV = { povSuffix: 'deadbeef', minRank: 0.25, delegatedPubkey: HEX('d') };
const LEGACY_TA = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_PINNING_Z = `39998:${LEGACY_TA}:tag-pinning`;

/** A kind-39999 pin. `contextSlug` adds the context `z` stamp the runner must recover. */
function makePin({ contextSlug = null, taPubkey, cutoff = 1, targetTypes, noteMethod = 'notes:net-endorsed' } = {}) {
  const cm = { method: 'nip85:rank', observer: OBS, cutoff, noteMethod };
  if (targetTypes !== undefined) cm.targetTypes = targetTypes;
  const tags = [['e', TAG_EVENT_ID], ['z', TAG_PINNING_Z], ['curation-method', JSON.stringify(cm)]];
  if (contextSlug) tags.push(['z', `39998:${taPubkey}:${contextSlug}`]);
  return { id: `pin-${contextSlug || 'neutral'}`, kind: 39999, pubkey: OBS, created_at: 10, tags, content: '{}' };
}

/** byTarget rows in aggregateProfilesTagged's shape (counts + the weighted accumulators). */
function byTargetMap() {
  return new Map([
    [M1, { pubkey: M1, applications: 3, disputes: 0, weightedSum: 1, weightedInput: 1 }],
    [M2, { pubkey: M2, applications: 2, disputes: 1, weightedSum: 2, weightedInput: 2 }],
  ]);
}

function profileDeps({ membershipMethod = 'count', wotFiltering = true } = {}) {
  const publishCalls = [];
  return {
    publishCalls,
    deps: {
      lookupTag: async () => TAG,
      aggregateProfilesTagged: async () => ({ byTarget: byTargetMap(), wotFiltering }),
      resolvePov: () => POV,
      resolveMembershipMethod: () => membershipMethod,
      ensureTagTLHeader: async () => ({ status: 'exists' }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30392' }, uuid: 'u1' }; },
    },
  };
}

function noteDeps({ notes } = {}) {
  const publishCalls = [];
  const full = notes || [
    { id: N1, applications: 3, disputes: 0, createdAt: 100 },
    { id: N2, applications: 2, disputes: 0, createdAt: 200 },
  ];
  return {
    publishCalls,
    deps: {
      lookupTag: async () => TAG,
      aggregateNotesTagged: async () => ({ members: full, fullMembers: full, scanTruncated: false, total: full.length }),
      resolvePov: () => POV,
      ensureTagTLHeader: async () => ({ status: 'exists' }),
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-30393' }, uuid: 'u2' }; },
    },
  };
}

const DEPS_CONTRACT =
  'runOnePin must accept INJECTED DEPS ({ lookupTag, aggregateProfilesTagged, resolvePov, ' +
  'resolveMembershipMethod, publishTL }) the way runOneNotePin already does — otherwise AC-3 ' +
  '(the published context z) and AC-4 (byte-identity) are not checkable without a live stack. ';

async function runProfilePin(pin, opts) {
  const mod = loadRefresh();
  assert(typeof mod.runOnePin === 'function',
    `refreshPinnedTags.js must export runOnePin (load error: ${mod.__loadError || 'none'}).`);
  const { deps, publishCalls } = profileDeps(opts);
  const before = publishCalls.length;
  let result;
  try {
    result = await mod.runOnePin(pin, { deps, ...deps });
  } catch (err) {
    throw new Error(DEPS_CONTRACT + `It ignored them and reached the real stack instead: ${err.message}`);
  }
  assert(publishCalls.length > before,
    DEPS_CONTRACT + `Nothing was published through the injected publishTL (result: ${JSON.stringify(result)}).`);
  return { result, call: publishCalls[publishCalls.length - 1], publishCalls };
}

async function runNotePin(pin, opts) {
  const mod = loadRefresh();
  assert(typeof mod.runOneNotePin === 'function', 'refreshPinnedTags.js must export runOneNotePin.');
  const { deps, publishCalls } = noteDeps(opts);
  let result;
  try {
    result = await mod.runOneNotePin(pin, { deps, ...deps });
  } catch (err) {
    throw new Error(`runOneNotePin must honor its injected deps; it reached the real stack instead: ${err.message}`);
  }
  assert(publishCalls.length === 1,
    `runOneNotePin must publish exactly one note TL through the injected publishTL; got ${publishCalls.length} (result: ${JSON.stringify(result)}).`);
  return { result, call: publishCalls[0] };
}

function zTags(call) { return (call.extraTags || []).filter((x) => x[0] === 'z').map((x) => x[1]); }

// ADR dlist-item-tagging/0002 — every TL now carries the family-wide z pair (concept + per-tag
// TL header). The header helper is injected so no test reaches a relay; the pair is deterministic.
function tlZPair(slug = 'funny') { const ta = runnerTaPubkey(); return [['z', `39998:${ta}:trusted-list`], ['z', `39999:${ta}:tl:${slug}-tls`]]; }
const TL_Z_RE = /^39998:[0-9a-f]{64}:trusted-list$|^39999:[0-9a-f]{64}:tl:.+-tls$/;
/** z tags that are NOT the Trusted-List discovery pair — i.e. the context stamp, if any. */
function contextZTags(call) { return zTags(call).filter((z) => !TL_Z_RE.test(z)); }

/** Deep equality: arrays order-sensitive, object keys order-insensitive. */
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
function assertFixture(actual, expected, label) {
  assert(deepEq(actual, expected),
    `${label}: the published event must be byte-identical to the pinned fixture (AC-4).\n` +
    `      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
}

/**
 * Load the real client publisher (ESM with vite-only specifiers) in node: rewrite the
 * `@tapestry/event-tagging` alias to the real folder and stub the transport/signer imports
 * (never called by the pure d-tag helpers). Written beside the original so its relative
 * imports keep their meaning; removed afterwards.
 */
async function loadClientPublishTagPin() {
  const src = rd(PUBLISH_TAG_PIN);
  if (!src) return null;
  const rel = path.relative(path.dirname(PUBLISH_TAG_PIN), SRC('lib/event-tagging/index.js')).split(path.sep).join('/');
  const rewritten = src.replace(/^import\s+([\s\S]*?)\s+from\s+'([^']+)';?[ \t]*$/gm, (m, clause, spec) => {
    if (spec === '@tapestry/event-tagging') {
      // CJS with spread exports ⇒ no named ESM exports; default-import then destructure.
      return `import __et from '${rel}';\nconst ${clause} = __et;`;
    }
    const names = [...clause.matchAll(/([A-Za-z_$][\w$]*)/g)].map((x) => x[1]).filter((n) => n !== 'as');
    return names.map((n) => `const ${n} = undefined;`).join('\n');
  });
  const tmp = path.join(path.dirname(PUBLISH_TAG_PIN), `__pin_stack_probe_${process.pid}.mjs`);
  fs.writeFileSync(tmp, rewritten);
  try { return await import(pathToFileURL(tmp).href); }
  catch (e) { return { __loadError: e.message }; }
  finally { try { fs.unlinkSync(tmp); } catch { /* best effort */ } }
}

// ===========================================================================
// Z — AC-3: the context `z` on the published Trusted Lists (30392 and 30393)
// ===========================================================================

t('AC-3: a contextual pin publishes a profile TL (30392) carrying the context concept as a z tag', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const { call } = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA }));
  const { contextHandle } = loadPins();
  assert(call.kind === 30392, `expected the profile TL kind 30392; got ${call.kind}.`);
  assert(zTags(call).includes(contextHandle(TA, 'lfo')),
    `a contextual TL must carry ['z', contextHandle(TA, 'lfo')] so {kinds:[30392],"#z":[<context>]} finds it; z tags were ${JSON.stringify(zTags(call))}.`);
});

t('AC-3: a contextual pin publishes a note TL (30393) carrying the same context z tag', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const { call } = await runNotePin(makePin({ contextSlug: 'lfo', taPubkey: TA, targetTypes: ['profile', 'note'] }));
  const { contextHandle } = loadPins();
  assert(call.kind === 30393, `expected the note TL kind 30393; got ${call.kind}.`);
  assert(zTags(call).includes(contextHandle(TA, 'lfo')),
    `the contextual NOTE TL must carry the context z too (both 3039x lists are discoverable by context); z tags were ${JSON.stringify(zTags(call))}.`);
});

t('AC-3: the context z handle is exactly 39998:<runtime TA>:<contextSlug> — never the legacy literal', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const { call } = await runProfilePin(makePin({ contextSlug: 'tapestry-web-of-trust', taPubkey: TA }));
  const zs = zTags(call);
  assert(zs.includes(`39998:${TA}:tapestry-web-of-trust`),
    `the context z must be 39998:<runtime TA>:<slug>; z tags were ${JSON.stringify(zs)}.`);
  assert(!zs.some((z) => z.startsWith(`39998:${LEGACY_TA}:`) && !z.endsWith(':tag-pinning')),
    'contexts are greenfield: the context z must NOT be composed from LEGACY_TA_PUBKEY (ADR event-tagging/0015 covers only tag-pinning).');
});

t('AC-3: a neutral pin publishes no context z on either list (the asymmetry is the feature)', async () => {
  const { call: profile } = await runProfilePin(makePin());
  assert(contextZTags(profile).length === 0,
    `a neutral profile TL must carry no context z; got ${JSON.stringify(zTags(profile))}.`);
  const { call: note } = await runNotePin(makePin({ targetTypes: ['profile', 'note'] }));
  assert(contextZTags(note).length === 0,
    `a neutral note TL must carry no context z; got ${JSON.stringify(zTags(note))}.`);
});

t('AC-3: the contextual lists keep the -in-<context> d suffix as their replaceability key', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const { call: profile } = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA }));
  assert(profile.dTag === 'tl-pin-aaaaaaaa-bbbbbbbb-funny-in-lfo',
    `contextual profile TL d-tag must be tl-pin-<obs8>-<author8>-<slug>-in-lfo; got ${profile.dTag}.`);
  const { call: note } = await runNotePin(makePin({ contextSlug: 'lfo', taPubkey: TA, targetTypes: ['profile', 'note'] }));
  assert(note.dTag === 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny-in-lfo',
    `contextual note TL d-tag must be tl-pin-notes-<obs8>-<author8>-<slug>-in-lfo; got ${note.dTag}.`);
});

t('AC-3: the runner recovers the context from the pin z stamp, not from an unstamped pin (malformed pin ⇒ neutral)', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  // A pin whose only 39998 z is the legacy tag-pinning stamp, plus a junk z and a malformed tag.
  const pin = makePin();
  pin.tags.push(['z']);                                  // no value
  pin.tags.push(['z', `39998:${TA}:not-a-known-context`]); // unknown slug
  pin.tags.push(['z', 'garbage']);
  const { call } = await runProfilePin(pin);
  assert(call.dTag === 'tl-pin-aaaaaaaa-bbbbbbbb-funny',
    `an unstamped/malformed pin must resolve to the NEUTRAL identity (no suffix); got ${call.dTag}.`);
  assert(contextZTags(call).length === 0, 'an unstamped/malformed pin must publish no context z.');
});

// ===========================================================================
// B — AC-4: a neutral pin's published events, pinned as literal fixtures
// ===========================================================================

t('AC-4: a neutral pin under the count method publishes exactly the pre-change 30392 event', async () => {
  const { call } = await runProfilePin(makePin(), { membershipMethod: 'count' });
  assertFixture(call, {
    kind: 30392,
    dTag: 'tl-pin-aaaaaaaa-bbbbbbbb-funny',
    title: 'Funny',
    metric: 'pinned-tag-membership',
    items: [{ tag: 'p', value: M1 }, { tag: 'p', value: M2 }],
    extraTags: [
      ['observer', OBS],
      ['source-tag', TAG_EVENT_ID, TAGAUTHOR, 'funny'],
      ['cutoff', '1'],
      ['min-rank', '0.25'],
      // search-index-selection #3 AC-4 (Tester re-aim, Phase 3): every 30392 now discloses
      // the fold that actually ran.
      ['membership-method', 'count'],
      ...tlZPair(),
    ],
    content: `{"members":[{"pubkey":"${M1}","endorsements":3,"disputes":0},{"pubkey":"${M2}","endorsements":2,"disputes":1}]}`,
  }, 'neutral / count');
});

t('AC-4: a neutral pin under the certainty method publishes exactly the pre-change 30392 event (scores, rigor, order)', async () => {
  const { call } = await runProfilePin(makePin(), { membershipMethod: 'certainty' });
  assertFixture(call, {
    kind: 30392,
    dTag: 'tl-pin-aaaaaaaa-bbbbbbbb-funny',
    title: 'Funny',
    metric: 'pinned-tag-membership',
    items: [{ tag: 'p', value: M2, score: 75 }, { tag: 'p', value: M1, score: 50 }],
    extraTags: [
      ['observer', OBS],
      ['source-tag', TAG_EVENT_ID, TAGAUTHOR, 'funny'],
      ['cutoff', '1'],
      ['min-rank', '0.25'],
      // search-index-selection #3 AC-4 (Tester re-aim, Phase 3): the disclosure precedes rigor,
      // which is a parameter OF certainty.
      ['membership-method', 'certainty'],
      ['rigor', '0.5'],
      ...tlZPair(),
    ],
    content: `{"members":[{"pubkey":"${M2}","endorsements":2,"disputes":1,"score":75},{"pubkey":"${M1}","endorsements":3,"disputes":0,"score":50}]}`,
  }, 'neutral / certainty');
});

t('AC-4: a neutral pin publishes exactly the pre-change 30393 note event', async () => {
  const { call } = await runNotePin(makePin({ targetTypes: ['profile', 'note'] }));
  assertFixture(call, {
    kind: 30393,
    dTag: 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny',
    title: 'Funny',
    metric: 'pinned-tag-notes',
    items: [{ tag: 'e', value: N2 }, { tag: 'e', value: N1 }],
    extraTags: [
      ['observer', OBS],
      ['source-tag', TAG_EVENT_ID, TAGAUTHOR, 'funny'],
      ['curation-method', 'notes:net-endorsed'],
      ['a', `39999:${TAGAUTHOR}:funny`],
      ['p', OBS],
      ...tlZPair(),
    ],
    content: `{"notes":[{"id":"${N2}","applications":2,"disputes":0},{"id":"${N1}","applications":3,"disputes":0}]}`,
  }, 'neutral / note TL');
});

t('AC-4: the membership method never sees the context (scoring is independent of identity)', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const seen = [];
  const mod = loadRefresh();
  assert(typeof mod.runOnePin === 'function', 'refreshPinnedTags.js must export runOnePin.');
  const { deps, publishCalls } = profileDeps({ membershipMethod: 'certainty' });
  deps.resolveMembershipMethod = (...args) => { seen.push(args); return 'certainty'; };
  try {
    await mod.runOnePin(makePin({ contextSlug: 'lfo', taPubkey: TA }), { deps, ...deps });
  } catch (err) {
    throw new Error(DEPS_CONTRACT + `It ignored them and reached the real stack instead: ${err.message}`);
  }
  assert(publishCalls.length === 1, 'runOnePin must publish through the injected publishTL (deps contract).');
  assert(seen.every((args) => args.every((a) => JSON.stringify(a || '').indexOf('lfo') === -1)),
    `resolveMembershipMethod must never be passed the context (ADR §1: context feeds identity only); got ${JSON.stringify(seen)}.`);
  const neutral = await runProfilePin(makePin(), { membershipMethod: 'certainty' });
  assert(deepEq(publishCalls[0].items, neutral.call.items),
    'the same aggregation must score identically with and without a context — only the identity (d-tag/z) differs.');
});

// ===========================================================================
// P — AC-6: client/server parity by construction (one shared composer)
// ===========================================================================

t('AC-6: the shared composer in pins.js builds both TL d-tags, with and without a context', () => {
  const pins = loadPins();
  assert(typeof pins.tlDTag === 'function' && typeof pins.noteTlDTag === 'function',
    `src/lib/event-tagging/pins.js must export tlDTag + noteTlDTag (the single source of both strings, ADR §2/§5). Load error: ${pins.__loadError || 'none'}.`);
  const args = { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny' };
  assert(pins.tlDTag(args) === 'tl-pin-aaaaaaaa-bbbbbbbb-funny', `tlDTag neutral form wrong: ${pins.tlDTag(args)}`);
  assert(pins.noteTlDTag(args) === 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny', `noteTlDTag neutral form wrong: ${pins.noteTlDTag(args)}`);
  assert(pins.tlDTag({ ...args, contextSlug: 'lfo' }) === 'tl-pin-aaaaaaaa-bbbbbbbb-funny-in-lfo', 'tlDTag must append the discriminator.');
  assert(pins.noteTlDTag({ ...args, contextSlug: 'lfo' }) === 'tl-pin-notes-aaaaaaaa-bbbbbbbb-funny-in-lfo', 'noteTlDTag must append the discriminator.');
});

t('AC-6: the client computeNoteTLDTag and the server note runner compose the identical string for every fixture row', async () => {
  const client = await loadClientPublishTagPin();
  assert(client && !client.__loadError,
    `ui/src/utils/publishTagPin.js must load as a module for the parity check (error: ${client && client.__loadError}).`);
  assert(typeof client.computeNoteTLDTag === 'function', 'publishTagPin.js must export computeNoteTLDTag.');
  const pins = loadPins();
  assert(typeof pins.noteTlDTag === 'function', 'pins.js must export noteTlDTag (the server side of the parity).');
  const rows = [
    { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny' },
    { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny', contextSlug: 'lfo' },
    { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny', contextSlug: 'tapestry-web-of-trust' },
    { observer: HEX('e'), tagAuthorPubkey: HEX('f'), tagSlug: 'dog-breed', contextSlug: 'lfo' },
    { observer: HEX('e'), tagAuthorPubkey: HEX('f'), tagSlug: 'dog-breed', contextSlug: null },
  ];
  for (const row of rows) {
    const c = client.computeNoteTLDTag(row);
    const s = pins.noteTlDTag(row);
    assert(c === s, `note-TL d-tag parity broke for ${JSON.stringify(row)}: client "${c}" vs server "${s}".`);
  }
  // and the same for the profile TL d-tag
  for (const row of rows) {
    const c = client.computeTLDTag(row);
    const s = pins.tlDTag(row);
    assert(c === s, `profile-TL d-tag parity broke for ${JSON.stringify(row)}: client "${c}" vs server "${s}".`);
  }
});

t('AC-6: the contextual d-tag the client computes is the one the server publishes (end-to-end, not just helper-to-helper)', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const client = await loadClientPublishTagPin();
  assert(client && !client.__loadError, `publishTagPin.js must load (error: ${client && client.__loadError}).`);
  const row = { observer: OBS, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'funny', contextSlug: 'lfo' };
  const { call: profile } = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA }));
  const { call: note } = await runNotePin(makePin({ contextSlug: 'lfo', taPubkey: TA, targetTypes: ['profile', 'note'] }));
  assert(client.computeTLDTag(row) === profile.dTag,
    `the client must read the TL the server writes: client "${client.computeTLDTag(row)}" vs published "${profile.dTag}".`);
  assert(client.computeNoteTLDTag(row) === note.dTag,
    `the client must read the note TL the server writes: client "${client.computeNoteTLDTag(row)}" vs published "${note.dTag}".`);
});

t('AC-6: neither the client nor the server hand-formats the tl-pin-notes- prefix (both delegate to the shared composer)', () => {
  const clientSrc = rd(PUBLISH_TAG_PIN);
  const serverSrc = rd(REFRESH_PATH);
  assert(clientSrc && serverSrc, 'both pin-stack files must be readable.');
  const handFormatted = /`tl-pin(?:-notes)?-\$\{/;
  assert(!handFormatted.test(clientSrc),
    'publishTagPin.js must not build a tl-pin… d-tag by template interpolation — it must call the shared tlDTag/noteTlDTag (ADR §5: one composer, two thin wrappers).');
  assert(!handFormatted.test(serverSrc),
    'refreshPinnedTags.js must not build a tl-pin… d-tag by template interpolation — it must call the shared tlDTag/noteTlDTag.');
  assert(/noteTlDTag\s*\(/.test(clientSrc) && /noteTlDTag\s*\(/.test(serverSrc),
    'both sides must call noteTlDTag (the single composer) so the string cannot drift again.');
  assert(/tlDTag\s*\(/.test(clientSrc) && /tlDTag\s*\(/.test(serverSrc),
    'both sides must call tlDTag for the profile TL d-tag.');
});

// ===========================================================================
// D — AC-5: the prior ADR is Accepted
// ===========================================================================

t('AC-5: the contextual-pins ADR 0001 is marked Accepted', () => {
  const src = rd(CONTEXTUAL_PINS_ADR);
  assert(src, `${CONTEXTUAL_PINS_ADR} must exist.`);
  assert(/^\*\*Status:\*\*\s*Accepted\s*$/m.test(src),
    'contextual-pins/0001 must read "**Status:** Accepted" (it shipped and passed review — AC-5).');
});

// ===========================================================================
// E — the ADR's ordering rule and its two named hazards
// ===========================================================================

t('ADR ordering rule: runOnePin resolves the context before it dispatches the membership method', () => {
  const src = rd(REFRESH_PATH);
  const start = src.indexOf('async function runOnePin');
  assert(start !== -1, 'refreshPinnedTags.js must define runOnePin.');
  const body = src.slice(start, src.indexOf('\n}\n', start) + 1);
  // Re-aimed 2026-09-18 (search-index-selection #5, ADR 0003 §4): identity is now recovered by
  // variantOfPin( (which itself falls back to contextSlugOfPin for legacy pins). The RULE this
  // sentinel guards — identity resolved BEFORE the membership method dispatches — is unchanged.
  const ctxA = body.indexOf('variantOfPin(');
  const ctxB = body.indexOf('contextSlugOfPin(');
  const ctx = ctxA !== -1 ? ctxA : ctxB;
  const method = body.indexOf('resolveMembershipMethod(');
  assert(ctx !== -1, 'runOnePin must recover the pin identity with variantOfPin( (or, pre-#5, contextSlugOfPin() (ADR §1).');
  assert(method !== -1, 'runOnePin must still dispatch the membership method with resolveMembershipMethod(.');
  assert(ctx < method,
    'ADR §1: context resolution (identity) must come BEFORE method dispatch (scoring) in runOnePin — never the reverse.');
});

t('Hazard 1: a contextual pin and its neutral twin publish to different TL coordinates (no mutual overwrite)', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const neutral = await runProfilePin(makePin());
  const contextual = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA }));
  assert(neutral.call.dTag !== contextual.call.dTag,
    `the neutral and contextual TLs of the same tag must have DISTINCT d-tags or they silently overwrite each other (both were "${neutral.call.dTag}").`);
  const nNote = await runNotePin(makePin({ targetTypes: ['profile', 'note'] }));
  const cNote = await runNotePin(makePin({ contextSlug: 'lfo', taPubkey: TA, targetTypes: ['profile', 'note'] }));
  assert(nNote.call.dTag !== cNote.call.dTag,
    `the neutral and contextual NOTE TLs must have distinct d-tags (both were "${nNote.call.dTag}").`);
});

t('Hazard 2: a contextual refresh returns its -in-<context> d-tag, and retraction still diffs on the full current set', async () => {
  const TA = runnerTaPubkey();
  if (!TA) return 'SKIP';
  const { result } = await runProfilePin(makePin({ contextSlug: 'lfo', taPubkey: TA }));
  assert(result && typeof result.dTag === 'string' && result.dTag.endsWith('-in-lfo'),
    `runOnePin must RETURN the contextual d-tag so refreshAllPinnedTags puts it in currentDTags and the cron pass cannot sweep the contextual TL; got ${JSON.stringify(result)}.`);
  const src = rd(REFRESH_PATH);
  assert(/new Set\(\s*currentDTags\s*\)/.test(src),
    'retractStaleTLs must diff on the full Set(currentDTags) — collapsing by (obs, author, slug) would retract sibling contextual TLs (contextual-pins/0001 invariant).');
  assert(/retractStaleTLs\s*\(\s*currentDTags/.test(src) && /retractStaleTLs\s*\(\s*currentNoteDTags/.test(src),
    'refreshAllPinnedTags must pass the full collected d-tag lists (profile AND note) into retractStaleTLs.');
});

// ===========================================================================
// F — AC-7: "update the note list" is a server recompute
// ===========================================================================

t('AC-7: the Pinned panel updates the note list via the server refresh endpoint, not a client bookmark publish', () => {
  const src = rd(PANEL);
  assert(src, 'PinnedListPanel.jsx must be readable.');
  const start = src.indexOf('handleRepinNotes');
  assert(start !== -1, 'PinnedListPanel.jsx must define handleRepinNotes (the "update the note list" action).');
  const body = src.slice(start, start + 1200);
  assert(/\/api\/trusted-list\/refresh-pinned-tag/.test(body),
    'handleRepinNotes must POST /api/trusted-list/refresh-pinned-tag (server recompute of the assistant-signed 30393, context-aware via the pin event id) — D2 / AC-7.');
  assert(!/publishNoteBookmarkSetForPin\s*\(/.test(body),
    'handleRepinNotes must NOT publish the client-signed bookmark set — that export moved to the Export modal (AC-7).');
});

t('AC-7: the client bookmark export survives as a separate Export-modal action', () => {
  const src = rd(PANEL);
  assert(/<ExportModal/.test(src), 'the Export modal must still be rendered.');
  assert(/noteExport=\{/.test(src),
    'the Export modal must keep its noteExport prop — the client-signed bookmark export remains available as its own action (AC-7).');
});

// ===========================================================================

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const test of tests) {
    try {
      const r = await test.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${test.name}`); skipped++; }
      else { console.log(`  ✓ ${test.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${test.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: test.name, message: err.message });
      fail++;
    }
  }
  console.log(`\npin-stack-composition: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
