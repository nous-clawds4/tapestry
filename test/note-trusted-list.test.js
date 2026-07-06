/**
 * Story event-tagging #17 (issue #336): TA-signed note Trusted List.
 * ADR event-tagging/0016. See engineering-team/stories/event-tagging/17-...test-plan.md
 *
 * ADR chose Option A: extract `aggregateNotesTagged` (shared by handleForTag + the new pin path),
 * and add `runOneNotePin(pinEvent, { deps })` mirroring the pubkey `runOnePin` — for a note-targeting
 * pin it publishes a TA-signed **kind-30393** Trusted List of the trusted-tagged NOTES (e-tag members,
 * per the NIP-85 TA/TL member-type convention: pubkeys→30392, events→30393), curated by the pin's
 * `noteMethod` (`curateNotes`), under the observer POV; d-tag `tl-pin-notes-…`, metric `pinned-tag-notes`;
 * empty curated set → empty-membership replacement. Wired into `refreshAllPinnedTags` alongside the
 * pubkey TL, with a kind-parameterized stale retraction. Additive — pubkey 30392 TL + kind-30003
 * export unchanged.
 *
 * TEST LEVELS:
 *  - N* : EXECUTE `runOneNotePin` with injected deps ({ lookupTag, aggregateNotesTagged, publishTL })
 *         — the kind/d-tag/metric/members/curation/observer/empty behavior, no live strfry/meili.
 *  - S* : source sentinels (exports; refreshAllPinnedTags wiring; handleForTag re-point).
 *
 * ALL FAIL pre-implementation (runOneNotePin / aggregateNotesTagged absent).
 */

const fs = require('fs');
const path = require('path');

const REFRESH_PATH = path.resolve(__dirname, '../src/api/trustedList/refreshPinnedTags.js');
const EVENT_TAGS = path.resolve(__dirname, '../src/api/event-tags/index.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadRefresh() { try { return require(REFRESH_PATH); } catch { return null; } }

// ── fixtures ──
const HEX = (c) => c.repeat(64);
const OBSERVER = HEX('a');
const TAGAUTHOR = HEX('b');
const TAG_EVENT_ID = HEX('c');
const N1 = HEX('1'); const N2 = HEX('2'); const N3 = HEX('3');

function makeNotePin({ observer = OBSERVER, tagEventId = TAG_EVENT_ID, noteMethod = 'notes:net-endorsed', targetTypes } = {}) {
  const cm = { method: 'nip85:rank', observer, cutoff: 1, noteMethod };
  if (targetTypes !== undefined) cm.targetTypes = targetTypes;
  return {
    id: 'pin-' + observer.slice(0, 6),
    kind: 39999,
    pubkey: observer,
    created_at: 1,
    tags: [['e', tagEventId], ['curation-method', JSON.stringify(cm)]],
    content: '{}',
  };
}
// note membership shape (from aggregateNotesTagged): { id, applications, disputes, createdAt }
function note(id, applications, disputes, createdAt) { return { id, applications, disputes, createdAt }; }

function makeDeps({ notes = [], tag } = {}) {
  const publishCalls = [];
  return {
    publishCalls,
    deps: {
      lookupTag: async () => tag || { eventId: TAG_EVENT_ID, slug: 'funny', name: 'funny', authorPubkey: TAGAUTHOR },
      aggregateNotesTagged: async () => notes,
      publishTL: async (args) => { publishCalls.push(args); return { event: { id: 'tl-1' }, uuid: `30393:x:${args.dTag}` }; },
    },
  };
}
async function run1(mod, pin, scenario) {
  assert(mod && typeof mod.runOneNotePin === 'function',
    'refreshPinnedTags.js must export runOneNotePin(pinEvent, {deps}) — absent pre-implementation (ADR 0016).');
  const { deps, publishCalls } = makeDeps(scenario || {});
  const r = await mod.runOneNotePin(pin, { deps, ...deps });
  return { r, publishCalls };
}
function eTagValues(call) { return (call.items || []).filter((i) => i.tag === 'e').map((i) => i.value); }
function extra(call, name) { return (call.extraTags || []).find((t) => t[0] === name); }

// ===========================================================================
// STRUCTURAL
// ===========================================================================

test('S1: refreshPinnedTags exports runOneNotePin; event-tags exports aggregateNotesTagged', () => {
  const mod = loadRefresh();
  assert(mod && typeof mod.runOneNotePin === 'function', 'refreshPinnedTags.js must export runOneNotePin.');
  const et = safeRead(EVENT_TAGS);
  assert(/aggregateNotesTagged/.test(et) && /module\.exports[\s\S]*aggregateNotesTagged/.test(et),
    'event-tags/index.js must define + export aggregateNotesTagged (shared note aggregation).');
});

test('S2: handleForTag is re-pointed onto the shared aggregateNotesTagged (DRY; guarded)', () => {
  const et = safeRead(EVENT_TAGS);
  assert(/function\s+handleForTag/.test(et) && /aggregateNotesTagged\s*\(/.test(et),
    'handleForTag must call aggregateNotesTagged (extract-and-re-point, ADR §Impl).');
});

test('S3: refreshAllPinnedTags runs runOneNotePin alongside runOnePin', () => {
  const src = safeRead(REFRESH_PATH);
  assert(/runOneNotePin\s*\(/.test(src) && /async function refreshAllPinnedTags/.test(src),
    'refreshAllPinnedTags must call runOneNotePin per pin (note TL refreshed alongside the pubkey TL).');
});

// ===========================================================================
// N — runOneNotePin behavior (executes with injected deps)
// ===========================================================================

test('N1: a note-targeting pin publishes a kind-30393 TL with e-tag note members', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await run1(mod, makeNotePin({ targetTypes: ['profile', 'note'] }),
    { notes: [note(N1, 3, 0, 100), note(N2, 2, 0, 200)] });
  assert(publishCalls.length === 1, `expected one note-TL publish; got ${publishCalls.length}.`);
  const c = publishCalls[0];
  assert(c.kind === 30393, `note TL must be kind-30393 (event-list, NIP-85 convention); got ${c.kind}.`);
  const es = eTagValues(c);
  assert(es.includes(N1) && es.includes(N2), 'members must be the trusted-tagged notes as e-tags.');
  assert((c.items || []).every((i) => i.tag === 'e'), 'note-TL members must be e-tags (not p/a).');
});

test('N2: d-tag is tl-pin-notes-<obs8>-<tagAuthor8>-<slug>; metric pinned-tag-notes; observer + source-tag', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await run1(mod, makeNotePin({ targetTypes: ['note'] }), { notes: [note(N1, 1, 0, 1)] });
  const c = publishCalls[0];
  assert(c.dTag === `tl-pin-notes-${OBSERVER.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-funny`,
    `d-tag must be tl-pin-notes-<obs8>-<tagAuthor8>-<slug>; got ${c.dTag}.`);
  assert(c.metric === 'pinned-tag-notes', `metric must be "pinned-tag-notes"; got ${c.metric}.`);
  assert(extra(c, 'observer') && extra(c, 'observer')[1] === OBSERVER, 'must carry an observer extraTag.');
  assert(extra(c, 'source-tag'), 'must carry a source-tag extraTag (tagEventId/author/slug provenance).');
});

test('N3: members are curated by the pin noteMethod (net-endorsed drops disputed>=applied; most-applied keeps + orders)', async () => {
  const mod = loadRefresh();
  const notes = [note(N1, 3, 0, 100), note(N2, 1, 5, 200), note(N3, 2, 0, 50)];
  // net-endorsed: keep applications>disputes (N1, N3), drop N2 (1 vs 5).
  const ne = await run1(mod, makeNotePin({ noteMethod: 'notes:net-endorsed', targetTypes: ['note'] }), { notes });
  const neE = eTagValues(ne.publishCalls[0]);
  assert(neE.includes(N1) && neE.includes(N3) && !neE.includes(N2),
    `net-endorsed must keep applications>disputes and drop the disputed note; got ${JSON.stringify(neE)}.`);
  // most-applied: keep all, ordered by applications desc (N1=3, N3=2, N2=1).
  const ma = await run1(mod, makeNotePin({ noteMethod: 'notes:most-applied', targetTypes: ['note'] }), { notes });
  const maE = eTagValues(ma.publishCalls[0]);
  assert(maE[0] === N1 && maE.includes(N2), `most-applied must keep all, ordered by applications desc; got ${JSON.stringify(maE)}.`);
});

test('N4: empty curated set ⇒ empty-membership replacement (items:[]), not a stale list', async () => {
  const mod = loadRefresh();
  // All notes disputed → net-endorsed curates to empty.
  const { publishCalls } = await run1(mod, makeNotePin({ noteMethod: 'notes:net-endorsed', targetTypes: ['note'] }),
    { notes: [note(N1, 0, 3, 1), note(N2, 1, 2, 2)] });
  assert(publishCalls.length === 1, 'an empty curated set must still publish (the empty-membership replacement).');
  assert(eTagValues(publishCalls[0]).length === 0, 'the empty replacement must carry no e-tag members.');
});

test('N5: a NON-note-targeting pin (profile only) publishes NO note TL', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await run1(mod, makeNotePin({ targetTypes: ['profile'] }), { notes: [note(N1, 3, 0, 1)] });
  assert(publishCalls.length === 0, 'a pin that does not target notes must not publish a note TL.');
});

test('N6: absent targetTypes ⇒ defaults to include note (ADR-0015 default) ⇒ publishes', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await run1(mod, makeNotePin({ targetTypes: undefined }), { notes: [note(N1, 1, 0, 1)] });
  assert(publishCalls.length === 1, 'a pin with no targetTypes must default to including notes and publish a note TL.');
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
