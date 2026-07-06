/**
 * Story tag-applicability #1: tag-type z-hints + HINT ∪ USAGE applicability Trusted Lists.
 * ADR tag-applicability/0001. See engineering-team/stories/tag-applicability/1-...test-plan.md
 *
 * ADR chose Option A:
 *  - two pubkey-free z constants defined ONCE in the event-tagging core
 *    (TAG_FOR_NOSTR_PUBKEY_Z / TAG_FOR_NOSTR_EVENT_Z), consumed by both flows;
 *  - additive emit at the two existing sites (note-core buildTagElement via an
 *    optional `applicabilityZ`; profile-hook createTag);
 *  - a new refreshApplicabilityLists() deriving two lists (HINT ∪ USAGE) and
 *    publishing them TA-signed as kind-30393 (members = `a`-coordinates), reusing
 *    buildAndPublishTL (extended with an `a` item branch);
 *  - the extra z is INERT to every existing reader.
 *
 * TEST LEVELS:
 *  - C/E/I: EXECUTE the real event-tagging core (constants, emit, inertness).
 *  - D: EXECUTE the new derivation module with injected deps (usage rows / hint
 *    scan / publishTL fake) — the union rule, a-coordinate encoding, TL shape,
 *    ordering, dedup — no live strfry/TA key.
 *  - Sentinels (P/B/Rt): source-regex on the profile-hook emit, the buildAndPublishTL
 *    `a`-branch, and the loopback refresh endpoint.
 *
 * ALL C/E/I/D/P/B/Rt FAIL pre-implementation (constants/module absent); no regression rows.
 */

const fs = require('fs');
const path = require('path');

const CORE_REQUIRE = '../src/lib/event-tagging';
const DERIVE_PATH = path.resolve(__dirname, '../src/api/trustedList/refreshApplicabilityLists.js');
const TL_INDEX = path.resolve(__dirname, '../src/api/trustedList/index.js');
const PROFILE_HOOK = path.resolve(__dirname, '../ui/src/hooks/useProfileTags.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadCore() { try { return require(CORE_REQUIRE); } catch { return null; } }
function loadDerive() {
  try { delete require.cache[require.resolve(DERIVE_PATH)]; } catch { /* not resolvable yet */ }
  try { return require(DERIVE_PATH); } catch { return null; }
}

// ── fixtures (fixed 64-hex) ──
const TA    = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const LOCAL = '5555555555555555555555555555555555555555555555555555555555555555';
const ALICE = '2222222222222222222222222222222222222222222222222222222222222222';
const BOB   = '3333333333333333333333333333333333333333333333333333333333333333';

const PUBKEY_Z = 'tag-for-nostr-pubkey';
const EVENT_Z  = 'tag-for-nostr-event';

function zVals(ev) { return (ev.tags || []).filter(t => t[0] === 'z').map(t => t[1]); }
function aCoord(author, slug) { return `39999:${author}:${slug}`; }

// ===========================================================================
// C — the two constants, defined once in the core, pubkey-free
// ===========================================================================

test('C1: core exports TAG_FOR_NOSTR_PUBKEY_Z / TAG_FOR_NOSTR_EVENT_Z as the exact pubkey-free strings', () => {
  const c = loadCore();
  assert(c, "event-tagging core must load.");
  assert(c.TAG_FOR_NOSTR_PUBKEY_Z === PUBKEY_Z,
    `core must export TAG_FOR_NOSTR_PUBKEY_Z === "${PUBKEY_Z}" (single definition, §1d) — absent pre-implementation; got ${JSON.stringify(c.TAG_FOR_NOSTR_PUBKEY_Z)}.`);
  assert(c.TAG_FOR_NOSTR_EVENT_Z === EVENT_Z,
    `core must export TAG_FOR_NOSTR_EVENT_Z === "${EVENT_Z}"; got ${JSON.stringify(c.TAG_FOR_NOSTR_EVENT_Z)}.`);
  assert(!/[0-9a-f]{64}/i.test(c.TAG_FOR_NOSTR_PUBKEY_Z + c.TAG_FOR_NOSTR_EVENT_Z),
    'the hint z values must contain NO pubkey (lowest rung of the z-tag ladder; do NOT compose from the TA pubkey).');
});

// ===========================================================================
// E — additive emit at the note-core builder + the apply orchestrator
// ===========================================================================

test('E1: buildTagElement appends the applicabilityZ AFTER the concept-z, additively (existing z + d + content unchanged)', () => {
  const c = loadCore();
  assert(c && typeof c.buildTagElement === 'function', 'core must export buildTagElement.');
  const base = c.buildTagElement({ name: 'Podcaster', description: 'd', taPubkeys: [TA, LOCAL] });
  const hinted = c.buildTagElement({ name: 'Podcaster', description: 'd', taPubkeys: [TA, LOCAL], applicabilityZ: EVENT_Z });
  // Concept-z(s) still present and unchanged.
  const conceptZs = zVals(base);
  assert(conceptZs.includes(`39998:${TA}:tag`), 'the concept-z (39998:<TA>:tag) must remain.');
  assert(zVals(hinted).includes(`39998:${TA}:tag`), 'the concept-z must survive alongside the hint.');
  // The hint z is present exactly once, and is the LAST z (appended after the concept-z spread).
  const hz = zVals(hinted);
  assert(hz.filter(z => z === EVENT_Z).length === 1, `the hint z "${EVENT_Z}" must appear exactly once; got ${JSON.stringify(hz)}.`);
  assert(hz[hz.length - 1] === EVENT_Z, 'the hint z must be appended AFTER the concept-z(s).');
  // d-tag + content are byte-identical (the hint changes nothing else / a-coordinate stable).
  const dOf = ev => (ev.tags.find(t => t[0] === 'd') || [])[1];
  assert(dOf(base) === dOf(hinted), 'the d-tag (slug) must be unchanged — the a-coordinate is stable.');
  assert(base.content === hinted.content, 'the content payload must be byte-identical (the hint touches only the tags).');
  // Backward compatible: no applicabilityZ ⇒ no hint z at all.
  assert(!zVals(base).includes(EVENT_Z) && !zVals(base).includes(PUBKEY_Z),
    'without applicabilityZ, buildTagElement must emit NO hint z (backward-compatible).');
});

test('E2: applyEventTagging (new-tag sequence) builds a tag-element carrying the EVENT hint', async () => {
  const c = loadCore();
  assert(c && typeof c.applyEventTagging === 'function', 'core must export applyEventTagging.');
  // applyEventTagging signs+publishes; spy on `sign` to capture the UNSIGNED tag-element.
  const signedInputs = [];
  await c.applyEventTagging({
    tagInput: { name: 'Podcaster', description: '' },
    target: { id: 'a'.repeat(64) },
    polarity: 1,
    asserterPubkey: ALICE,
    taPubkeys: [TA, LOCAL],
    deps: {
      findHeaders: async () => [],
      sign: async (u) => { signedInputs.push(u); return { ...u, id: 'f'.repeat(64), sig: '0'.repeat(128) }; },
      publish: async () => {},
      now: () => 1_700_000_000,
    },
  });
  const tagEl = signedInputs.find(u => u.kind === 39999 && (u.tags || []).some(t => t[0] === 'd'));
  assert(tagEl, 'the new-tag plan must include a kind-39999 tag-element (passed to sign).');
  assert(zVals(tagEl).includes(EVENT_Z),
    `the note-flow tag-element must carry the "${EVENT_Z}" hint (apply.js sequence c passes applicabilityZ). Got z: ${JSON.stringify(zVals(tagEl))}.`);
  assert(!zVals(tagEl).includes(PUBKEY_Z), 'the note flow must NOT emit the pubkey hint.');
});

// ===========================================================================
// I — the hint is INERT to existing readers (regression, proven not assumed)
// ===========================================================================

test('I1: classifyEventTaggings never mistakes a hint-carrying tag-element for a tagging (identical with/without the hint)', () => {
  const c = loadCore();
  assert(c && typeof c.classifyEventTaggings === 'function', 'core must export classifyEventTaggings.');
  const plainTagEl = { id: 'e1', kind: 39999, pubkey: ALICE, created_at: 1, tags: [['d', 'podcaster'], ['z', `39998:${TA}:tag`]], content: '{}' };
  const hintedTagEl = { ...plainTagEl, tags: [...plainTagEl.tags, ['z', EVENT_Z]] };
  const opts = { honoredAuthorities: [TA, LOCAL], isAsserterTrusted: () => true };
  const rPlain = c.classifyEventTaggings({ candidates: [plainTagEl], headers: [], ...opts });
  const rHinted = c.classifyEventTaggings({ candidates: [hintedTagEl], headers: [], ...opts });
  // A tag-element is not a tagging → classified as zero taggings, and the hint changes nothing.
  assert(JSON.stringify(rPlain) === JSON.stringify(rHinted),
    'a tag-element carrying the hint z must classify IDENTICALLY to one without it (the hint is inert to classifyEventTaggings).');
  assert((rHinted.tags || []).length === 0,
    'the hint z must NOT cause a tag-element to be picked up as a tagging (it matches no concept-z / descriptor).');
});

test('I2: the hint z values match NO concept-handle pattern any reader keys on (39998/39999:<hex>:...)', () => {
  // profile-tags reads + /api/tags/index + classify all key on concept handles that embed a
  // 64-hex pubkey. A bare pubkey-free literal can never match — so the hint is invisible to them.
  const conceptLike = /^(39998|39999):[0-9a-f]{64}:/i;
  assert(!conceptLike.test(PUBKEY_Z) && !conceptLike.test(EVENT_Z),
    'the hint z literals must not look like a concept handle (no pubkey) — guarantees inertness to handle-keyed readers.');
});

// ===========================================================================
// P — the profile-flow emit (source sentinel: single-sourced constant, not a literal)
// ===========================================================================

test('P1: useProfileTags.createTag appends the pubkey hint from the shared core constant (no scattered literal)', () => {
  const src = safeRead(PROFILE_HOOK);
  assert(src.length > 0, 'useProfileTags.js must exist.');
  assert(/@tapestry\/event-tagging/.test(src),
    'useProfileTags must import the hint constant from the shared core via the @tapestry/event-tagging alias (§1d single definition).');
  assert(/TAG_FOR_NOSTR_PUBKEY_Z/.test(src),
    'createTag must reference the TAG_FOR_NOSTR_PUBKEY_Z constant (not a hardcoded "tag-for-nostr-pubkey" literal).');
  assert(/\[\s*['"]z['"]\s*,\s*TAG_FOR_NOSTR_PUBKEY_Z\s*\]/.test(src),
    "createTag must push ['z', TAG_FOR_NOSTR_PUBKEY_Z] onto the new tag-element's tags.");
});

// ===========================================================================
// D — the derivation: HINT ∪ USAGE → two kind-30393 TA lists (executes the module)
// ===========================================================================

// A tag-index row shape (subset the derivation reads): tag identity + per-type usage.
function usageRow(author, slug, byType) {
  return { tag: { authorPubkey: author, slug }, byType: byType || {} };
}
// A hint-carrying tag-element (what the #z scan returns).
function hintEl(author, slug) {
  return { kind: 39999, pubkey: author, created_at: 1, tags: [['d', slug]], content: '{}' };
}

function makeDeps({ usage = [], eventHintEls = [], pubkeyHintEls = [] } = {}) {
  const publishCalls = [];
  return {
    calls: publishCalls,
    deps: {
      loadUsageRows: async () => usage,
      scanStrfry: async (filter) => {
        const zs = filter && filter['#z'];
        if (zs && zs.includes(EVENT_Z)) return eventHintEls;
        if (zs && zs.includes(PUBKEY_Z)) return pubkeyHintEls;
        return [];
      },
      publishTL: async (args) => { publishCalls.push(args); return { uuid: `${args.kind}:${TA}:${args.dTag}` }; },
    },
  };
}
function listFor(calls, dSuffix) {
  return calls.find(c => String(c.dTag).includes(dSuffix));
}
function memberCoords(call) {
  return (call.items || []).filter(i => i.tag === 'a').map(i => i.value);
}

test('D1: USAGE-only — a tag applied to events (no hint) lands in the EVENT list, not the pubkey list', async () => {
  const d = loadDerive();
  assert(d && typeof d.refreshApplicabilityLists === 'function',
    'src/api/trustedList/refreshApplicabilityLists.js must export refreshApplicabilityLists — absent pre-implementation.');
  const { deps, calls } = makeDeps({ usage: [usageRow(ALICE, 'podcaster', { event: { applications: 3 } })] });
  await d.refreshApplicabilityLists({ deps });
  const eventList = listFor(calls, 'nostr-event');
  const pubkeyList = listFor(calls, 'nostr-pubkey');
  assert(eventList && memberCoords(eventList).includes(aCoord(ALICE, 'podcaster')),
    'a tag with event-usage must be in the event list.');
  assert(pubkeyList && !memberCoords(pubkeyList).includes(aCoord(ALICE, 'podcaster')),
    'event-usage-only must NOT put the tag in the pubkey list.');
});

test('D2: USAGE-only — a tag applied to profiles lands in the PUBKEY list', async () => {
  const d = loadDerive();
  const { deps, calls } = makeDeps({ usage: [usageRow(BOB, 'vegan', { profile: { applications: 2 } })] });
  await d.refreshApplicabilityLists({ deps });
  assert(memberCoords(listFor(calls, 'nostr-pubkey')).includes(aCoord(BOB, 'vegan')),
    'a tag with profile-usage must be in the pubkey list.');
});

test('D3: HINT-only — a usage-less tag carrying the event hint still lands in the EVENT list (cold-start)', async () => {
  const d = loadDerive();
  const { deps, calls } = makeDeps({ usage: [], eventHintEls: [hintEl(ALICE, 'newtag')] });
  await d.refreshApplicabilityLists({ deps });
  assert(memberCoords(listFor(calls, 'nostr-event')).includes(aCoord(ALICE, 'newtag')),
    'a hint-only (zero-usage) tag must appear via the HINT half of the union (§1c cold-start).');
});

test('D4: a tag used on BOTH types appears in BOTH lists', async () => {
  const d = loadDerive();
  const { deps, calls } = makeDeps({ usage: [usageRow(ALICE, 'music', { event: { applications: 1 }, profile: { applications: 4 } })] });
  await d.refreshApplicabilityLists({ deps });
  assert(memberCoords(listFor(calls, 'nostr-event')).includes(aCoord(ALICE, 'music')), 'both-type tag in event list.');
  assert(memberCoords(listFor(calls, 'nostr-pubkey')).includes(aCoord(ALICE, 'music')), 'both-type tag in pubkey list.');
});

test('D5: HINT ∪ USAGE is deduped by a-coordinate (hint + usage for the same type ⇒ one member)', async () => {
  const d = loadDerive();
  const { deps, calls } = makeDeps({
    usage: [usageRow(ALICE, 'dupe', { event: { applications: 2 } })],
    eventHintEls: [hintEl(ALICE, 'dupe')],
  });
  await d.refreshApplicabilityLists({ deps });
  const coords = memberCoords(listFor(calls, 'nostr-event')).filter(x => x === aCoord(ALICE, 'dupe'));
  assert(coords.length === 1, `a tag present via BOTH hint and usage must appear once; got ${coords.length}.`);
});

test('D6: exactly two lists, kind-30393, correct d-tags + metric + title + a-coordinate members', async () => {
  const d = loadDerive();
  const { deps, calls } = makeDeps({
    usage: [usageRow(ALICE, 'e', { event: { applications: 1 } }), usageRow(BOB, 'p', { profile: { applications: 1 } })],
  });
  await d.refreshApplicabilityLists({ deps });
  assert(calls.length === 2, `exactly two lists must be published (one per target type); got ${calls.length}.`);
  for (const call of calls) {
    assert(call.kind === 30393, `applicability TLs must be kind-30393 (ADR); got ${call.kind}.`);
    assert(call.metric === 'tag-applicability', `metric must be "tag-applicability"; got ${JSON.stringify(call.metric)}.`);
    assert(Array.isArray(call.items) && call.items.every(i => i.tag === 'a'),
      'members must be encoded as a-coordinate items (tag:"a") — stable identity per §2.');
  }
  const ev = listFor(calls, 'nostr-event'); const pk = listFor(calls, 'nostr-pubkey');
  assert(ev && /tag-applicability-nostr-event/.test(ev.dTag), `event list d-tag must be "tag-applicability-nostr-event"; got ${ev && ev.dTag}.`);
  assert(pk && /tag-applicability-nostr-pubkey/.test(pk.dTag), `pubkey list d-tag must be "tag-applicability-nostr-pubkey"; got ${pk && pk.dTag}.`);
  assert(/event/i.test(ev.title) && /pubkey/i.test(pk.title), 'titles must name the target type ("Tags for Nostr Events" / "…Pubkeys").');
});

test('D7: members are ordered by usage count desc (hint-only, zero-usage tags last)', async () => {
  const d = loadDerive();
  const { deps, calls } = makeDeps({
    usage: [usageRow(ALICE, 'lo', { event: { applications: 1 } }), usageRow(BOB, 'hi', { event: { applications: 9 } })],
    eventHintEls: [hintEl(ALICE, 'zero')],
  });
  await d.refreshApplicabilityLists({ deps });
  const coords = memberCoords(listFor(calls, 'nostr-event'));
  assert(coords.indexOf(aCoord(BOB, 'hi')) < coords.indexOf(aCoord(ALICE, 'lo')),
    'higher usage must sort before lower usage.');
  assert(coords.indexOf(aCoord(ALICE, 'lo')) < coords.indexOf(aCoord(ALICE, 'zero')),
    'a used tag must sort before a hint-only (zero-usage) tag.');
});

// ===========================================================================
// B / Rt — the buildAndPublishTL a-branch + the loopback refresh endpoint (sentinels)
// ===========================================================================

test('B1: buildAndPublishTL handles an `a`-coordinate member item (else-if a → ["a", value])', () => {
  const src = safeRead(TL_INDEX);
  assert(/item\.tag\s*===\s*['"]a['"]/.test(src),
    "buildAndPublishTL's item loop must gain an `item.tag === 'a'` branch (a-coordinate members) — additive to the existing p/e branches.");
  assert(/\[\s*['"]a['"]\s*,\s*item\.value\s*\]/.test(src),
    "the a-branch must push ['a', item.value].");
});

test('Rt1: a loopback-guarded POST /api/trusted-list/refresh-applicability-lists is registered', () => {
  const src = safeRead(TL_INDEX);
  assert(/refresh-applicability-lists/.test(src),
    'trustedList/index.js must register POST /api/trusted-list/refresh-applicability-lists (the manual trigger; Story 2 adds the schedule).');
  assert(/isLoopbackRequest/.test(src),
    'the refresh endpoint must be loopback-guarded (TA-signed publish, like refresh-all-pinned-tags).');
});

// ===========================================================================
// LIB — the PORTABLE applicability API in the event-tagging core (a third-party
// kind-1 client imports these to produce context data compatible with ours).
// ===========================================================================

test('LIB1: core exports the portable applicability API (deriveApplicabilityMembers, applicabilityHintFilter, …)', () => {
  const core = require('../src/lib/event-tagging');
  for (const fn of ['deriveApplicabilityMembers', 'applicabilityHintFilter', 'buildMembers', 'hintZForContext']) {
    assert(typeof core[fn] === 'function', `event-tagging core must export ${fn} (portable derivation for third-party kind-1 clients).`);
  }
});

test('LIB2: applicabilityHintFilter(context) yields the tag-element hint scan filter', () => {
  const core = require('../src/lib/event-tagging');
  const ev = core.applicabilityHintFilter('event');
  assert(Array.isArray(ev.kinds) && ev.kinds[0] === 39999 && ev['#z'][0] === 'tag-for-nostr-event',
    `event hint filter must be {kinds:[39999], '#z':['tag-for-nostr-event']}; got ${JSON.stringify(ev)}.`);
  const pk = core.applicabilityHintFilter('pubkey');
  assert(pk['#z'][0] === 'tag-for-nostr-pubkey', 'pubkey hint filter must scan for the pubkey hint z.');
});

test('LIB3: deriveApplicabilityMembers({usageRows,hintEls,context}) = HINT ∪ USAGE (context→byType, enriched, deduped)', () => {
  const core = require('../src/lib/event-tagging');
  const A = '1'.repeat(64), B = '2'.repeat(64);
  const usageRows = [
    { tag: { authorPubkey: A, slug: 'podcaster' }, byType: { event: { applications: 3 } } },
    { tag: { authorPubkey: B, slug: 'vegan' }, byType: { profile: { applications: 2 } } },
  ];
  const eventHints = [{ kind: 39999, pubkey: A, tags: [['d', 'newtag']] }];
  // context 'event' → byType.event ∪ event hint scan; enriched { a, authorPubkey, slug, applications }.
  const evMembers = core.deriveApplicabilityMembers({ usageRows, hintEls: eventHints, context: 'event' });
  const evKeys = evMembers.map((m) => `${m.authorPubkey}:${m.slug}`);
  assert(evKeys.includes(`${A}:podcaster`), 'event-usage tag must be in the event members.');
  assert(evKeys.includes(`${A}:newtag`), 'hint-only tag must be in the event members (cold-start).');
  assert(!evKeys.includes(`${B}:vegan`), 'profile-usage-only must NOT be in the event members.');
  assert(evMembers[0].applications === 3 && evMembers[0].slug === 'podcaster', 'ordered by usage desc; enriched shape.');
  // context 'pubkey' → byType.profile.
  const pkMembers = core.deriveApplicabilityMembers({ usageRows, hintEls: [], context: 'pubkey' });
  assert(pkMembers.map((m) => `${m.authorPubkey}:${m.slug}`).includes(`${B}:vegan`),
    "context 'pubkey' must read byType.profile.");
  assert(core.deriveApplicabilityMembers({ usageRows: [], hintEls: [], context: 'event' }).length === 0,
    'empty inputs ⇒ empty members (no crash).');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
