/**
 * tapestries #5 — Add a concept to a Tapestry (add-only, same-coordinate republish).
 * Story: engineering-team/stories/tapestries/5-add-a-concept-to-a-tapestry.md
 * ADR:   engineering-team/decisions/tapestries/0005-add-concept-add-only-republish.md
 *
 * This suite is the BINDING (stack-free) gate — the Node runner. Three classes:
 *
 *   P1..P13 — behavioral unit tests of the PURE append transform
 *             buildAddConceptDraft({ event, member, taPubkey }) in
 *             ui/src/pages/tapestries/tapestryDraft.mjs, loaded via dynamic import()
 *             (same pattern as test/create-tapestry.test.js). The b0b48b00 fixture is
 *             shaped byte-for-byte like the instance's ONE live tapestry element
 *             (verified against the local relay 2026-07-28: bare-hex d-tag `b0b48b00`,
 *             slug-valued `name` tag, json WITHOUT a graph block).
 *   S1..S6  — source sentinels on the page/component/hooks the spec pins but that only
 *             a browser can fully exercise (owner-strict gate, reload-by-re-read,
 *             extracted picker loader). Browser behavior itself is
 *             tests/brainstorm/tapestry-add-concept.spec.js (Playwright, mocked).
 *   R1..R4  — regression guards (PASS pre AND post): buildTapestryDraft's create shape,
 *             the Exploration read path, the server's TA-sign 403 gate, and the create
 *             flow surviving the useConceptOptions extraction.
 *
 * P1..P13 and S1..S6 FAIL now — buildAddConceptDraft is not exported,
 * AddConceptToTapestry.jsx and useConceptOptions.js do not exist, TapestryDetail has no
 * gate, useTapestryGraph exposes no event/reload. R1..R4 PASS now and after.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const nodeAssert = require('assert');

const ROOT = path.resolve(__dirname, '..');

const DRAFT_MJS     = path.join(ROOT, 'ui/src/pages/tapestries/tapestryDraft.mjs');
const ADD_COMPONENT = path.join(ROOT, 'ui/src/pages/tapestries/AddConceptToTapestry.jsx');
const USE_OPTIONS   = path.join(ROOT, 'ui/src/pages/tapestries/useConceptOptions.js');
const DETAIL_JSX    = path.join(ROOT, 'ui/src/pages/tapestries/TapestryDetail.jsx');
const USE_GRAPH     = path.join(ROOT, 'ui/src/pages/tapestries/useTapestryGraph.js');
const USE_CREATE    = path.join(ROOT, 'ui/src/pages/tapestries/useCreateTapestry.js');
const NEW_TAPESTRY  = path.join(ROOT, 'ui/src/pages/tapestries/NewTapestry.jsx');
const PUBLISH_EVENT = path.join(ROOT, 'src/api/strfry/commands/publishEvent.js');

// Fixture pubkeys (fixtures only — production code must NEVER hardcode the TA; CLAUDE.md).
const TA    = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
const OWNER = '1'.repeat(64);

// Members use the same object shape create uses (ADR 0005 Consequences: the member
// object is shared by both builders).
const COW = {
  handle: `39998:${TA}:cow`, shortSlug: 'cow', conceptGraphSlug: 'cow',
  descriptiveSlug: 'concept-header-for-the-concept-of-cows', name: 'cow',
};
// A real concept (verified live in #3) whose concept-graph name diverges from its
// header d-tag: the import uuid must come from conceptGraphSlug, not the d-tag.
const DIVERGENT = {
  handle: `39998:${TA}:nostr-event-tag`, shortSlug: 'nostr-event-tag',
  conceptGraphSlug: 'nostr-event-tagging',
  descriptiveSlug: 'concept-header-for-the-concept-of-nostr-event-taggings', name: 'nostr event tag',
};

const B0B_TAPESTRY = {
  slug: 'tapestry-for-farm-animals', title: 'Tapestry for Farm Animals',
  description: 'the tapestry for the kinds of farm animals that toddlers learn: dog, cat, cow, pig, etc',
};

/** The instance's one live tapestry, shape-verified against the local relay 2026-07-28:
 *  bare-hex d-tag, name tag = the SLUG (not the title), json WITHOUT a graph block. */
function b0bEvent(overrides = {}) {
  return {
    id: 'a'.repeat(64), pubkey: TA, kind: 39999, created_at: 1773183323, content: '',
    tags: [
      ['d', 'b0b48b00'],
      ['name', 'tapestry-for-farm-animals'],
      ['z', `39998:${TA}:tapestry`],
      ['json', JSON.stringify({ tapestry: B0B_TAPESTRY })],
    ],
    sig: '0'.repeat(128),
    ...overrides,
  };
}

// A create-shaped tapestry carrying things the transform must NOT touch: an existing
// member, a superset + property node, an authored relationship, an existing import,
// unknown tags (between and after the known ones), and an unknown top-level json key.
const RICH_GRAPH = {
  graphType: 'tapestry',
  nodes: [
    { slug: 'concept-header-for-the-concept-of-dogs', uuid: `39998:${TA}:dog`, name: 'dog' },
    { slug: 'superset-for-the-concept-of-dogs', uuid: `39999:${TA}:dog-superset`, name: 'superset for the concept of dogs' },
    { slug: 'dog.breed', name: 'dog.breed' },
  ],
  relationshipTypes: [{ slug: 'PROPERTY_ENUMERATION', alias: 'ENUMERATES' }],
  relationships: [
    { nodeFrom: { slug: 'concept-header-for-the-concept-of-dogs' }, relationshipType: { slug: 'PROPERTY_ENUMERATION' }, nodeTo: { slug: 'dog.breed' } },
  ],
  imports: [{ slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` }],
};

function richEvent(overrides = {}, graphOverrides = null) {
  const graph = { ...JSON.parse(JSON.stringify(RICH_GRAPH)), ...(graphOverrides || {}) };
  const json = {
    tapestry: { slug: 'my-dogs', title: 'My Dogs', description: 'good dogs' },
    graph,
    provenance: { authoredBy: 'hand', note: 'unknown json keys must survive an add' },
  };
  return {
    id: 'b'.repeat(64), pubkey: TA, kind: 39999, created_at: 1773183323, content: '',
    tags: [
      ['d', 'tapestry-my-dogs-abcd1234'],
      ['name', 'My Dogs'],
      ['t', 'farm'],                       // unknown tag BETWEEN known tags — position must survive
      ['z', `39998:${TA}:tapestry`],
      ['json', JSON.stringify(json)],
      ['alt', 'A tapestry of dogs'],       // unknown tag AFTER the json tag
    ],
    sig: '0'.repeat(128),
    ...overrides,
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; } }
function deepEq(actual, expected, msg) {
  try { nodeAssert.deepStrictEqual(actual, expected); }
  catch (e) { throw new Error(`${msg}\n      ${e.message.split('\n').slice(0, 6).join('\n      ')}`); }
}
function tagVal(ev, name) { const t = (ev.tags || []).find((x) => x[0] === name); return t ? t[1] : undefined; }
function jsonOf(ev) { return JSON.parse(tagVal(ev, 'json')); }
function expectThrow(fn, label) {
  try { fn(); } catch (_e) { return; }
  throw new Error(label);
}

// tapestryDraft.mjs EXISTS (create shipped it) — the expected pre-implementation failure
// is the MISSING EXPORT, reported with a message that names what to build.
let _mod;
async function loadModule() {
  if (_mod) return _mod;
  _mod = await import(pathToFileURL(DRAFT_MJS).href);
  return _mod;
}
async function loadBuilder() {
  const mod = await loadModule();
  if (typeof mod.buildAddConceptDraft !== 'function') {
    throw new Error(
      'ui/src/pages/tapestries/tapestryDraft.mjs does not export buildAddConceptDraft — the Implementer must add the ' +
      'pure append transform (ADR tapestries/0005 Decision 1-A): buildAddConceptDraft({ event, member, taPubkey }) → ' +
      '{ dTag, uuid, unsignedEvent }: copy the event verbatim, append ONE member node + import inside the json tag. ' +
      'Exports found: [' + Object.keys(mod).join(', ') + ']'
    );
  }
  return mod.buildAddConceptDraft;
}

/* ───────────── Pure transform — AC "Save = adding only, published as tapestries already are" ───────────── */

test('P1: republishing keeps the SAME coordinate — d-tag copied verbatim (even the bare-hex b0b48b00), uuid = 39999:<author>:<dTag>, kind 39999, unsigned', async () => {
  const build = await loadBuilder();
  const draft = build({ event: b0bEvent(), member: COW, taPubkey: TA });
  assert(draft.dTag === 'b0b48b00',
    `dTag must be the EXISTING d-tag verbatim ("b0b48b00") — any derivation (tapestry-<slug>-<suffix>) lands on a NEW ` +
    `coordinate: a duplicate directory row and an unchanged original, failing "same uuid/URL, no duplicate entry". Got ${draft.dTag}.`);
  assert(tagVal(draft.unsignedEvent, 'd') === 'b0b48b00', `the event's d tag must also be "b0b48b00" verbatim, got ${tagVal(draft.unsignedEvent, 'd')}.`);
  assert(draft.uuid === `39999:${TA}:b0b48b00`, `uuid must be 39999:<event author>:<dTag> (the address the page re-reads), got ${draft.uuid}.`);
  assert(draft.unsignedEvent.kind === 39999, `kind must stay 39999, got ${draft.unsignedEvent.kind}.`);
  assert(draft.unsignedEvent.sig === undefined && draft.unsignedEvent.pubkey === undefined,
    'must return an UNSIGNED event with no pubkey — the own-key branch attaches the author before NIP-07 signing; the TA branch lets the server re-sign.');
});

test('P2: a graph-less tapestry (the live b0b48b00 shape) gains the minimal envelope holding ONLY the new member; tapestry block, slug-valued name tag, and all other tags untouched', async () => {
  const build = await loadBuilder();
  const before = b0bEvent();
  const draft = build({ event: before, member: COW, taPubkey: TA });
  const j = jsonOf(draft.unsignedEvent);
  deepEq(j.tapestry, B0B_TAPESTRY, 'the tapestry block (title/description/slug) must pass through unchanged — only membership may change.');
  const g = j.graph;
  assert(g && g.graphType === 'tapestry', `first add on a graph-less event must CREATE the envelope {graphType:"tapestry",…} (ADR 1-A) — without it the live b0b48b00 tapestry could never be grown. Got ${JSON.stringify(g && g.graphType)}.`);
  deepEq(g.nodes, [{ slug: COW.descriptiveSlug, uuid: COW.handle, name: COW.name }],
    'the envelope must hold EXACTLY the one new member node {slug: descriptiveSlug, uuid: handle, name} — the same member shape create publishes (ADR 0003 Decision 2-A).');
  deepEq(g.relationshipTypes, [], 'relationshipTypes must be [] on first add — nothing beyond the member may be authored.');
  deepEq(g.relationships, [], 'relationships must be [] on first add — adding a concept authors no integrations.');
  deepEq(g.imports, [{ slug: 'concept-graph-for-cow', uuid: `39999:${TA}:cow-concept-graph` }],
    'the envelope must hold exactly the one concept-graph import for the new member (what the Exploration page resolves at read time).');
  assert(tagVal(draft.unsignedEvent, 'name') === 'tapestry-for-farm-animals',
    `the name tag must stay the SLUG value ("tapestry-for-farm-animals") exactly as the live event carries it — rewriting it to the title would be an edit beyond adding. Got ${JSON.stringify(tagVal(draft.unsignedEvent, 'name'))}.`);
  assert(tagVal(draft.unsignedEvent, 'z') === `39998:${TA}:tapestry`, 'the z tag must pass through unchanged (it is what the directory reads).');
  assert(draft.unsignedEvent.content === '', 'content must pass through unchanged.');
});

test('P3: every tag except json is byte-identical and IN ORDER — unknown tags survive at their positions, the json tag is replaced in place, content unchanged', async () => {
  const build = await loadBuilder();
  const before = richEvent();
  const draft = build({ event: before, member: COW, taPubkey: TA });
  const a = before.tags, b = draft.unsignedEvent.tags;
  assert(Array.isArray(b) && b.length === a.length,
    `tag count must not change (${a.length} → ${b && b.length}) — nothing may be added or dropped; only the json tag's VALUE changes.`);
  a.forEach((tag, i) => {
    assert(b[i] && b[i][0] === tag[0], `tag order changed at index ${i}: expected a ${JSON.stringify(tag[0])} tag, got ${JSON.stringify(b[i] && b[i][0])} — tags must be copied in order (ADR 1-A).`);
    if (tag[0] !== 'json') {
      deepEq(b[i], tag, `tag [${tag[0]}] at index ${i} must be byte-identical — unknown tags (t, alt, …) are part of "everything else unchanged".`);
    }
  });
  assert(draft.unsignedEvent.content === before.content, 'content must pass through unchanged.');
});

test('P4: the appended member uses the create-time shape — node {slug: descriptiveSlug, uuid: handle, name}; import keyed by conceptGraphSlug (nostr-event-tag → nostr-event-tagging-concept-graph)', async () => {
  const build = await loadBuilder();
  const draft = build({ event: richEvent(), member: DIVERGENT, taPubkey: TA });
  const g = jsonOf(draft.unsignedEvent).graph;
  const node = g.nodes[g.nodes.length - 1];
  deepEq(node, { slug: DIVERGENT.descriptiveSlug, uuid: DIVERGENT.handle, name: DIVERGENT.name },
    'the appended node must be {slug: member.descriptiveSlug, uuid: member.handle, name: member.name} — the identical shape buildTapestryDraft emits, so composeGraph dedups it with its resolved concept-graph and the member renders exactly once.');
  const imp = g.imports[g.imports.length - 1];
  deepEq(imp, { slug: 'concept-graph-for-nostr-event-tagging', uuid: `39999:${TA}:nostr-event-tagging-concept-graph` },
    `the appended import must be built from conceptGraphSlug (oSlugs.singular), not the header d-tag — '39999:${TA}:nostr-event-tag-concept-graph' does not exist and would render the member isolated.`);
});

test('P5: add-only is structural — prior nodes/relationships/relationshipTypes/imports and unknown json keys pass through unchanged, the new node+import are APPENDED, and the input event is not mutated', async () => {
  const build = await loadBuilder();
  const before = richEvent();
  const frozen = JSON.stringify(before);
  const draft = build({ event: before, member: COW, taPubkey: TA });
  assert(JSON.stringify(before) === frozen, 'buildAddConceptDraft must not MUTATE its input event — the page keeps it as the base for the next add.');
  const j = jsonOf(draft.unsignedEvent);
  deepEq(j.tapestry, { slug: 'my-dogs', title: 'My Dogs', description: 'good dogs' }, 'title and description must be unchanged.');
  deepEq(j.provenance, { authoredBy: 'hand', note: 'unknown json keys must survive an add' },
    'unknown top-level json keys must pass through untouched (ADR 1-A: unrecognized keys are copied verbatim).');
  const g = j.graph;
  assert(g.nodes.length === RICH_GRAPH.nodes.length + 1, `exactly ONE node appended (${RICH_GRAPH.nodes.length} → ${g.nodes.length} expected ${RICH_GRAPH.nodes.length + 1}).`);
  deepEq(g.nodes.slice(0, RICH_GRAPH.nodes.length), RICH_GRAPH.nodes, 'all prior member/superset/property nodes must survive verbatim and in order.');
  deepEq(g.nodes[g.nodes.length - 1], { slug: COW.descriptiveSlug, uuid: COW.handle, name: COW.name }, 'the new member node must be appended last.');
  deepEq(g.relationships, RICH_GRAPH.relationships, 'authored relationships must pass through unchanged — "prior integrations shown unchanged" (AC). A rebuild that hardcodes relationships:[] destroys them.');
  deepEq(g.relationshipTypes, RICH_GRAPH.relationshipTypes, 'relationshipTypes must pass through unchanged.');
  assert(g.imports.length === RICH_GRAPH.imports.length + 1, `exactly ONE import appended (got ${g.imports.length}).`);
  deepEq(g.imports.slice(0, RICH_GRAPH.imports.length), RICH_GRAPH.imports, 'existing imports must survive verbatim — re-deriving them from today\'s headers would silently rewrite them (an edit beyond adding).');
});

test('P6: adding a concept that is ALREADY a member throws — no save can produce a duplicate member (AC "Only non-members are addable", transform half)', async () => {
  const build = await loadBuilder();
  const dogAgain = { handle: `39998:${TA}:dog`, shortSlug: 'dog', conceptGraphSlug: 'dog', descriptiveSlug: 'concept-header-for-the-concept-of-dogs', name: 'dog' };
  expectThrow(() => build({ event: richEvent(), member: dogAgain, taPubkey: TA }),
    'buildAddConceptDraft must THROW when member.handle already appears as a node uuid — the picker exclusion (Decision 2-A) is UI-level; the transform is the defense in depth that makes a duplicate member impossible.');
});

test('P7: a slug collision (same descriptiveSlug, different uuid) throws — composeGraph dedups by slug, so the add would silently merge two different concepts', async () => {
  const build = await loadBuilder();
  const impostor = { handle: `39998:${TA}:doggo`, shortSlug: 'doggo', conceptGraphSlug: 'doggo', descriptiveSlug: 'concept-header-for-the-concept-of-dogs', name: 'doggo' };
  expectThrow(() => build({ event: richEvent(), member: impostor, taPubkey: TA }),
    'buildAddConceptDraft must THROW when member.descriptiveSlug equals an existing node slug under a DIFFERENT uuid — at compose time the two would collapse into one node and the tapestry would misrender.');
});

test('P8: created_at is STRICTLY greater than the base event even on same-second input (a tie lets NIP-01 keep the OLD event), and fresh (now-ish) for old bases', async () => {
  const build = await loadBuilder();
  const now = Math.floor(Date.now() / 1000);
  const sameSecond = build({ event: richEvent({ created_at: now }), member: COW, taPubkey: TA });
  assert(sameSecond.unsignedEvent.created_at > now,
    `created_at must be STRICTLY greater than the base event's (${now}) — equal timestamps resolve by event id and can keep the OLD event, silently losing the add (the evidence-goal failure class). Got ${sameSecond.unsignedEvent.created_at}.`);
  const future = build({ event: richEvent({ created_at: now + 40 }), member: COW, taPubkey: TA });
  assert(future.unsignedEvent.created_at > now + 40,
    `even against a clock-skewed base (${now + 40}), created_at must still exceed it (Math.max(now, base+1) — ADR). Got ${future.unsignedEvent.created_at}.`);
  const old = build({ event: b0bEvent(), member: COW, taPubkey: TA }); // base created_at 1773183323 (months old)
  assert(old.unsignedEvent.created_at > 1773183323 && old.unsignedEvent.created_at >= now - 300,
    `for an old base the replacement must carry a FRESH (now-ish) timestamp, not base+1 — got ${old.unsignedEvent.created_at} (now ≈ ${now}).`);
});

test('P9: refuses what it cannot preserve — wrong kind, missing d tag, unparseable json tag, and graph.nodes-not-an-array all THROW (publish fails cleanly, membership unchanged)', async () => {
  const build = await loadBuilder();
  expectThrow(() => build({ event: richEvent({ kind: 1 }), member: COW, taPubkey: TA }),
    'a non-39999 event must be refused — the transform only understands tapestry elements.');
  expectThrow(() => build({ event: richEvent({ tags: richEvent().tags.filter((t) => t[0] !== 'd') }), member: COW, taPubkey: TA }),
    'an event with no d tag has no coordinate to republish to — must throw, never invent one.');
  const badJson = b0bEvent(); badJson.tags = badJson.tags.map((t) => (t[0] === 'json' ? ['json', '{not json'] : t));
  expectThrow(() => build({ event: badJson, member: COW, taPubkey: TA }),
    'an unparseable json tag must be refused — an add-only guarantee cannot be given over a structure the transform cannot read (silently replacing it would DESTROY the payload).');
  const badGraph = b0bEvent(); badGraph.tags = badGraph.tags.map((t) => (t[0] === 'json' ? ['json', JSON.stringify({ tapestry: B0B_TAPESTRY, graph: { nodes: 'broken' } })] : t));
  expectThrow(() => build({ event: badGraph, member: COW, taPubkey: TA }),
    'a graph block whose nodes is not an array must be refused — appending into it is undefined; the UI shows the error and the tapestry stays unchanged.');
});

test('P10: an event with NO json tag at all is treated as {} — the original tags survive in order and exactly one json tag is added carrying the envelope + member', async () => {
  const build = await loadBuilder();
  const noJson = b0bEvent({ tags: [['d', 'b0b48b00'], ['name', 'tapestry-for-farm-animals'], ['z', `39998:${TA}:tapestry`]] });
  const draft = build({ event: noJson, member: COW, taPubkey: TA });
  const tags = draft.unsignedEvent.tags;
  deepEq(tags.filter((t) => t[0] !== 'json'), noJson.tags, 'the three original tags must survive verbatim and in order.');
  const jsonTags = tags.filter((t) => t[0] === 'json');
  assert(jsonTags.length === 1, `exactly ONE json tag must be added when none existed (got ${jsonTags.length}).`);
  const j = JSON.parse(jsonTags[0][1]);
  assert(j.graph && Array.isArray(j.graph.nodes) && j.graph.nodes.length === 1 && j.graph.nodes[0].uuid === COW.handle,
    'the added json tag must carry the graph envelope with the one new member.');
});

test('P11: if the member\'s concept-graph import ALREADY exists it is not duplicated — the node is appended, imports stay unique by uuid', async () => {
  const build = await loadBuilder();
  const withCowImport = richEvent({}, { imports: [...RICH_GRAPH.imports, { slug: 'concept-graph-for-cow', uuid: `39999:${TA}:cow-concept-graph` }] });
  const draft = build({ event: withCowImport, member: COW, taPubkey: TA });
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(g.nodes.length === RICH_GRAPH.nodes.length + 1, 'the member node must still be appended.');
  const cowImports = g.imports.filter((i) => i.uuid === `39999:${TA}:cow-concept-graph`);
  assert(cowImports.length === 1, `the cow concept-graph import must appear exactly once — the append is SKIPPED when an import with that uuid already exists (ADR 1-A). Got ${cowImports.length}.`);
  assert(g.imports.length === RICH_GRAPH.imports.length + 1, `imports length must be unchanged from the input's (${RICH_GRAPH.imports.length + 1}), got ${g.imports.length}.`);
});

test('P12: the coordinate follows the EVENT\'s author — an owner-authored tapestry republishes under 39999:<owner>:<dTag>, while the new import and z tag stay TA-namespaced', async () => {
  const build = await loadBuilder();
  const draft = build({ event: richEvent({ pubkey: OWNER }), member: COW, taPubkey: TA });
  assert(draft.uuid === `39999:${OWNER}:tapestry-my-dogs-abcd1234`,
    `uuid must be namespaced to the event's AUTHOR (the owner here) — the own-key republish is signed by the owner, so a TA-keyed uuid would make the post-save re-read miss the event. Got ${draft.uuid}.`);
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(g.imports[g.imports.length - 1].uuid === `39999:${TA}:cow-concept-graph`,
    'the new concept-graph import must stay TA-namespaced regardless of the tapestry author — concept handles are always the TA\'s.');
  assert(tagVal(draft.unsignedEvent, 'z') === `39998:${TA}:tapestry`, 'the z tag passes through TA-namespaced.');
});

test('P13: missing inputs throw — no taPubkey, no member, member without a handle', async () => {
  const build = await loadBuilder();
  expectThrow(() => build({ event: richEvent(), member: COW, taPubkey: undefined }),
    'a missing taPubkey must throw — the import uuid cannot be composed without the runtime-resolved TA (never hardcoded).');
  expectThrow(() => build({ event: richEvent(), member: null, taPubkey: TA }),
    'a missing member must throw.');
  expectThrow(() => build({ event: richEvent(), member: { name: 'ghost' }, taPubkey: TA }),
    'a member without a handle must throw — there is nothing addressable to append.');
});

/* ───────────── Source sentinels — pinned by the spec, exercised by Playwright ───────────── */

test('S1: tapestryDraft.mjs exports buildAddConceptDraft (the pure append transform exists)', async () => {
  await loadBuilder();
});

test('S2: AddConceptToTapestry.jsx exists and drives the save through the pure transform + the shared concept options (typeahead over searchText)', () => {
  const src = readSafe(ADD_COMPONENT);
  assert(src !== null,
    'ui/src/pages/tapestries/AddConceptToTapestry.jsx missing — the Implementer must create the sidebar affordance ' +
    'component (ADR 0005 Decision 4): props {event, onAdded}; typeahead over useConceptOptions() excluding current ' +
    'members; on pick → buildAddConceptDraft → the Decision-3 signing branch; inline error on failure.');
  assert(/buildAddConceptDraft/.test(src),
    'AddConceptToTapestry.jsx does not call buildAddConceptDraft — the replacement event must come from the pure append transform, never be re-inlined in the component.');
  assert(/useConceptOptions/.test(src),
    'AddConceptToTapestry.jsx does not use useConceptOptions — the picker loader must be the ONE shared hook (Decision 4), not a second copy that drifts from create\'s.');
  assert(/searchText/.test(src),
    'AddConceptToTapestry.jsx does not filter on searchText — the add picker must match the same keyword blob (names/slugs/keys/description) the create picker searches.');
});

test('S3: AddConceptToTapestry uses BOTH existing publish paths and no new endpoint — TA → POST /api/strfry/publish signAs assistant; own key → signerGuard + NIP-07 + publishOrThrow', () => {
  const src = readSafe(ADD_COMPONENT);
  assert(src !== null, 'AddConceptToTapestry.jsx missing — S2 must pass first.');
  assert(/\/api\/strfry\/publish/.test(src) && /assistant/.test(src),
    'no TA branch: a TA-authored tapestry must republish via the EXISTING POST /api/strfry/publish with signAs:"assistant" (server-signed, owner-403-gated) — "published as tapestries already are", no new server endpoint.');
  assert(/getActiveSignerOrThrow/.test(src),
    'no signer guard: the own-key branch must resolve the active NIP-07 signer via getActiveSignerOrThrow(author) so a signer/session mismatch is refused before signing.');
  assert(/signEvent|window\.nostr/.test(src),
    'no NIP-07 signing: an owner-key tapestry must be signed in the browser by the owner (window.nostr.signEvent), exactly as create does.');
  assert(/publishOrThrow/.test(src),
    'own-key publish must go through publishOrThrow (local + external co-publish, throwing only when both fail) — the same path create uses.');
});

test('S4: TapestryDetail gates the affordance OWNER-STRICT (classification === "owner", NOT hasAdminAccess) against the event author, and offers first-add on the graph-less degraded branch', () => {
  const src = readSafe(DETAIL_JSX);
  assert(src !== null, 'ui/src/pages/tapestries/TapestryDetail.jsx missing — re-baseline.');
  assert(/classification\s*===\s*['"]owner['"]/.test(src),
    'TapestryDetail.jsx has no owner-strict gate: the affordance renders iff user?.classification === "owner" AND the event author is the TA or the session pubkey (ADR 0005 Decision 3, Director ruling). An admin who is not the owner gets NO affordance.');
  assert(!/hasAdminAccess/.test(src),
    'TapestryDetail.jsx references hasAdminAccess — that is #3\'s owner-or-ADMIN create gate and must NOT gate the add affordance; the frame\'s acting user is the owner, strictly (ADR Decision 3 names and rejects this alternative).');
  assert(/AddConceptToTapestry/.test(src),
    'TapestryDetail.jsx does not render AddConceptToTapestry — the affordance lives on the EXISTING Exploration page (sidebar "Concepts" section); no new page, no new route.');
  assert(/taPubkey/.test(src),
    'TapestryDetail.jsx does not reference the runtime-resolved taPubkey (useConfig) — the author comparison must use the per-deployment TA pubkey, never a literal (CLAUDE.md).');
  assert(/rawGraph\s*===\s*null/.test(src),
    'TapestryDetail.jsx does not distinguish the graph-less degraded case (rawGraph === null → offer first add; the envelope is created on save) from a MALFORMED graph (no affordance — the transform would refuse anyway). Without this the live b0b48b00 tapestry can never be grown.');
});

test('S5: useTapestryGraph exposes the raw event and a reload() so the page re-reads the same coordinate after a save (visibility by re-read, not optimism)', () => {
  const src = readSafe(USE_GRAPH);
  assert(src !== null, 'ui/src/pages/tapestries/useTapestryGraph.js missing — re-baseline.');
  assert(/\breload\b/.test(src),
    'useTapestryGraph.js has no reload — after a successful publish the page must re-read the tapestry from strfry (the same read ANY session performs); optimistic local state can show a member whose publish was refused or replaced (ADR Decision 4).');
  assert(/[{,]\s*event\b/.test(src),
    'useTapestryGraph.js does not return the raw fetched event — the transform\'s input (already fetched, currently discarded) must be exposed so the add flow copies the REAL event verbatim.');
});

test('S6: useConceptOptions.js exists (the extracted kind-39998 loader) and useCreateTapestry consumes it — one picker source, no drift', () => {
  const src = readSafe(USE_OPTIONS);
  assert(src !== null,
    'ui/src/pages/tapestries/useConceptOptions.js missing — move toConcept + the queryRelay({kinds:[39998], authors:[taPubkey]}) effect out of useCreateTapestry.js verbatim (ADR 0005 Decision 4); return { concepts, conceptsLoading, conceptsError }.');
  assert(/queryRelay/.test(src) && /39998/.test(src) && /searchText/.test(src),
    'useConceptOptions.js must carry the kind-39998 strfry scan and the searchText blob — the same options + typeahead data create uses.');
  const hook = readSafe(USE_CREATE);
  assert(hook !== null && /useConceptOptions/.test(hook),
    'useCreateTapestry.js does not consume useConceptOptions — leaving two copies of the loader to drift defeats the extraction (create must keep working unchanged THROUGH the shared hook).');
});

/* ───────────── Regression guards — PASS pre AND post ───────────── */

test('R1 (regression, passes pre AND post): buildTapestryDraft still emits the create shape — kind/d-tag/z/member node + import', async () => {
  const { buildTapestryDraft } = await loadModule();
  assert(typeof buildTapestryDraft === 'function', 'buildTapestryDraft disappeared from tapestryDraft.mjs — adding the append transform must not break the create builder.');
  const draft = buildTapestryDraft({ title: 'My Dogs', description: 'good dogs', members: [{ handle: `39998:${TA}:dog`, shortSlug: 'dog', conceptGraphSlug: 'dog', descriptiveSlug: 'concept-header-for-the-concept-of-dogs', name: 'dog' }], taPubkey: TA, dTagSuffix: 'abcd1234' });
  assert(draft.unsignedEvent.kind === 39999 && draft.dTag === 'tapestry-my-dogs-abcd1234', 'create d-tag derivation changed — R1.');
  assert(tagVal(draft.unsignedEvent, 'z') === `39998:${TA}:tapestry`, 'create z-tag changed — R1.');
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(g.nodes.length === 1 && g.imports.length === 1 && g.nodes[0].uuid === `39998:${TA}:dog`, 'create member shape changed — R1 (the member object is shared by both builders; keep them in step, not merged).');
});

test('R2 (regression): the Exploration read path is intact — useTapestryGraph still composes via composeGraph and still exports parseUuid', () => {
  const src = readSafe(USE_GRAPH);
  assert(src !== null, 'useTapestryGraph.js missing — re-baseline.');
  assert(/composeGraph/.test(src),
    'useTapestryGraph.js no longer composes via composeGraph — the reload/event extension must not change parsing, import resolution, or composition (ADR 0005 implementation notes).');
  assert(/export function parseUuid/.test(src),
    'parseUuid is no longer exported from useTapestryGraph.js — the gate reads the author from parseUuid(uuid)/the fetched event; other pages import it too.');
});

test('R3 (regression): the server still refuses TA-signing from a non-owner session (the 403 gate is the second line of defense behind the UI gate)', () => {
  const src = readSafe(PUBLISH_EVENT);
  assert(src !== null, 'src/api/strfry/commands/publishEvent.js missing — re-baseline.');
  const at = src.indexOf("signAs === 'assistant'");
  assert(at >= 0, 'publishEvent.js no longer branches on signAs === "assistant".');
  const region = src.slice(at, at + 600);
  assert(/isOwner\(req\)/.test(region) && /localTrusted/.test(region) && /403/.test(region),
    'R3: publishEvent.js no longer 403-gates assistant-signing to owner/localTrusted. The add flow reuses this endpoint; it must NOT weaken the gate (ADR security-auth-exposure/0002).');
});

test('R4 (regression): the create flow survives the extraction — useCreateTapestry still returns concepts + create, and NewTapestry still drives it', () => {
  const hook = readSafe(USE_CREATE);
  assert(hook !== null, 'useCreateTapestry.js missing — re-baseline.');
  assert(/\bconcepts\b/.test(hook) && /\bcreate\b/.test(hook),
    'useCreateTapestry.js no longer provides { concepts, create } — the extraction must leave create()\'s behavior and API unchanged (ADR: "useCreateTapestry consumes it, no behavior change to create").');
  const page = readSafe(NEW_TAPESTRY);
  assert(page !== null && /useCreateTapestry/.test(page),
    'NewTapestry.jsx no longer uses useCreateTapestry — story #3\'s shipped create page must be untouched by this story.');
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
