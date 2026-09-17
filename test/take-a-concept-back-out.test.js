/**
 * tapestries #6 — Take a concept back out of a Tapestry (remove-only, same-coordinate republish).
 * Story: engineering-team/stories/tapestries/6-take-a-concept-back-out.md
 * ADR:   engineering-team/decisions/tapestries/0006-remove-concept-remove-only-republish.md
 * Book:  engineering-team/audits/take-a-concept-back-out/book.md (operational Direction run)
 *
 * This suite is the BINDING (stack-free) gate — the Node runner. Three classes:
 *
 *   P1..P15 — behavioral unit tests of the PURE subtract transform
 *             buildRemoveConceptDraft({ event, memberUuid, resolvedImports, conceptOptions })
 *             and the shared membership helper authoredConceptMembers(event) in
 *             ui/src/pages/tapestries/tapestryDraft.mjs, loaded via dynamic import()
 *             (same pattern as test/add-a-concept-to-a-tapestry.test.js). The LIVE fixture
 *             mirrors the instance's one real element (bare-hex d-tag `b0b48b00`, slug-valued
 *             `name` tag, 4 member nodes / 4 imports, empty relationships) INCLUDING the dog
 *             divergence the ADR verified live: the dog member node's uuid d-tag is a random
 *             UUID (`b08502ed-…`) while its import is `…:dog-concept-graph` — so attribution
 *             can never be derived from the node uuid alone.
 *   S1..S4  — source sentinels on the component/page wiring the ADR pins but only a browser
 *             can fully exercise (the inline confirm step, the up-front refusal sentence,
 *             both publish paths, the renamed canEdit gate). Browser behavior itself is
 *             tests/brainstorm/tapestry-remove-concept.spec.js (Playwright, mocked).
 *   R1..R3  — regression guards (PASS pre AND post): buildAddConceptDraft's append shape
 *             ("adding is already built and stays as it is" — the boundary's words), no
 *             remove machinery leaking into the shipped add/create path, and useTapestryGraph
 *             still exposing { event, imports, reload } (the remove component's inputs).
 *
 * P1..P15 and S1..S4 FAIL now — buildRemoveConceptDraft and authoredConceptMembers are not
 * exported, RemoveConceptFromTapestry.jsx does not exist, TapestryDetail has no canEdit gate.
 * R1..R3 PASS now and after.
 *
 * Operator-data safety: everything here is fixture-only. Nothing reads or writes any relay;
 * the live b0b48b00 ELEMENT is never touched — only its published SHAPE is mirrored.
 * Pubkeys below are fixture literals (test files only — production code must resolve the TA
 * at runtime, never hardcode; CLAUDE.md).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const nodeAssert = require('assert');

const ROOT = path.resolve(__dirname, '..');

const DRAFT_MJS       = path.join(ROOT, 'ui/src/pages/tapestries/tapestryDraft.mjs');
const REMOVE_COMPONENT = path.join(ROOT, 'ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx');
const ADD_COMPONENT   = path.join(ROOT, 'ui/src/pages/tapestries/AddConceptToTapestry.jsx');
const DETAIL_JSX      = path.join(ROOT, 'ui/src/pages/tapestries/TapestryDetail.jsx');
const USE_GRAPH       = path.join(ROOT, 'ui/src/pages/tapestries/useTapestryGraph.js');
const USE_CREATE      = path.join(ROOT, 'ui/src/pages/tapestries/useCreateTapestry.js');
const NEW_TAPESTRY    = path.join(ROOT, 'ui/src/pages/tapestries/NewTapestry.jsx');

// Fixture pubkeys (fixtures only — never hardcode the TA in production code; CLAUDE.md).
const TA    = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
const OWNER = '1'.repeat(64);

// The live divergence (ADR 0006 Context, verified against the local relay 2026-07-30):
// the dog concept-header's d-tag is a random UUID, NOT "dog" — while the tapestry's import
// for it is `…:dog-concept-graph` (derived at add time from oSlugs.singular = "dog").
const DOG_HEADER_DTAG = 'b08502ed-9adf-42b4-9e10-ef3090179346';
const DOG_UUID = `39998:${TA}:${DOG_HEADER_DTAG}`;
const CAT_UUID = `39998:${TA}:cat`;

const B0B_TAPESTRY = {
  slug: 'tapestry-for-farm-animals', title: 'Tapestry for Farm Animals',
  description: 'the tapestry for the kinds of farm animals that toddlers learn: dog, cat, cow, pig, etc',
};

/** The live element's graph block, shape-mirrored: 4 members, 4 imports, empty relationships. */
function liveGraph() {
  return {
    graphType: 'tapestry',
    nodes: [
      { slug: 'concept-header-for-the-concept-of-dogs', uuid: DOG_UUID, name: 'dog' },
      { slug: 'concept-header-for-the-concept-of-cats', uuid: CAT_UUID, name: 'cat' },
      { slug: 'concept-header-for-the-concept-of-cows', uuid: `39998:${TA}:cow`, name: 'cow' },
      { slug: 'concept-header-for-the-concept-of-pigs', uuid: `39998:${TA}:pig`, name: 'pig' },
    ],
    relationshipTypes: [],
    relationships: [],
    imports: [
      { slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` },
      { slug: 'concept-graph-for-cat', uuid: `39999:${TA}:cat-concept-graph` },
      { slug: 'concept-graph-for-cow', uuid: `39999:${TA}:cow-concept-graph` },
      { slug: 'concept-graph-for-pig', uuid: `39999:${TA}:pig-concept-graph` },
    ],
  };
}

// Distinct sentinel for "the json tag carries NO graph key at all". An explicitly passed
// `undefined` cannot express this — default-parameter semantics resolve it right back to
// the default (the Gate-3 kick-back: the absent-graph branch was dead code until the
// Implementer's transform made the surrounding assertions reachable).
const OMIT_GRAPH = Symbol('omit the graph key entirely');

/** The instance's one live tapestry, shape-verified: bare-hex d-tag, name tag = the SLUG.
 *  graphOverride: omit the argument for the live 4-member graph; pass OMIT_GRAPH for a
 *  json tag with NO graph key; pass null / a malformed shape to embed exactly that value. */
function liveEvent(overrides = {}, graphOverride = liveGraph()) {
  const json = graphOverride === OMIT_GRAPH
    ? { tapestry: B0B_TAPESTRY }
    : { tapestry: B0B_TAPESTRY, graph: graphOverride };
  return {
    id: 'a'.repeat(64), pubkey: TA, kind: 39999, created_at: 1773183323, content: '',
    tags: [
      ['d', 'b0b48b00'],
      ['name', 'tapestry-for-farm-animals'],
      ['z', `39998:${TA}:tapestry`],
      ['json', JSON.stringify(json)],
    ],
    sig: '0'.repeat(128),
    ...overrides,
  };
}

// A create-shaped tapestry carrying everything the subtract transform must NOT touch when
// removing `cat`: another member with a superset + property node, an authored relationship
// (dog ↔ dog.breed — NOT involving cat), an import attributable to NO member (mystery),
// unknown tags between and after the known ones, and an unknown top-level json key.
const RICH_GRAPH = {
  graphType: 'tapestry',
  nodes: [
    { slug: 'concept-header-for-the-concept-of-dogs', uuid: `39998:${TA}:dog`, name: 'dog' },
    { slug: 'concept-header-for-the-concept-of-cats', uuid: `39998:${TA}:cat`, name: 'cat' },
    { slug: 'superset-for-the-concept-of-dogs', uuid: `39999:${TA}:dog-superset`, name: 'superset for the concept of dogs' },
    { slug: 'dog.breed', name: 'dog.breed' },
  ],
  relationshipTypes: [{ slug: 'PROPERTY_ENUMERATION', alias: 'ENUMERATES' }],
  relationships: [
    { nodeFrom: { slug: 'concept-header-for-the-concept-of-dogs' }, relationshipType: { slug: 'PROPERTY_ENUMERATION' }, nodeTo: { slug: 'dog.breed' } },
  ],
  imports: [
    { slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` },
    { slug: 'concept-graph-for-cat', uuid: `39999:${TA}:cat-concept-graph` },
    { slug: 'concept-graph-for-mystery', uuid: `39999:${TA}:mystery-concept-graph` },
  ],
};

function richEvent(overrides = {}, graphOverrides = null) {
  const graph = { ...JSON.parse(JSON.stringify(RICH_GRAPH)), ...(graphOverrides || {}) };
  const json = {
    tapestry: { slug: 'my-pets', title: 'My Pets', description: 'good pets' },
    graph,
    provenance: { authoredBy: 'hand', note: 'unknown json keys must survive a removal' },
  };
  return {
    id: 'b'.repeat(64), pubkey: TA, kind: 39999, created_at: 1773183323, content: '',
    tags: [
      ['d', 'tapestry-my-pets-abcd1234'],
      ['name', 'My Pets'],
      ['t', 'pets'],                       // unknown tag BETWEEN known tags — position must survive
      ['z', `39998:${TA}:tapestry`],
      ['json', JSON.stringify(json)],
      ['alt', 'A tapestry of pets'],       // unknown tag AFTER the json tag
    ],
    sig: '0'.repeat(128),
    ...overrides,
  };
}

// Concept-picker options in the useConceptOptions shape (the page passes these in as
// `conceptOptions` — matcher (b)'s evidence). The dog option carries the live divergence:
// handle d-tag = the random UUID, conceptGraphSlug = "dog".
const DOG_OPTION = {
  handle: DOG_UUID, shortSlug: DOG_HEADER_DTAG, conceptGraphSlug: 'dog',
  descriptiveSlug: 'concept-header-for-the-concept-of-dogs', name: 'dog',
};
const CAT_OPTION = {
  handle: CAT_UUID, shortSlug: 'cat', conceptGraphSlug: 'cat',
  descriptiveSlug: 'concept-header-for-the-concept-of-cats', name: 'cat',
};

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
function expectThrowMatching(fn, re, label) {
  try { fn(); } catch (e) {
    if (re.test(e.message || '')) return;
    throw new Error(`${label}\n      It threw, but the message ${JSON.stringify(e.message)} does not match ${re} — the UI shows this text verbatim (plain-language refusal, ratified reading 3).`);
  }
  throw new Error(label);
}

// tapestryDraft.mjs EXISTS (create + add shipped it) — the expected pre-implementation
// failure is the MISSING EXPORT, reported with a message that names what to build.
let _mod;
async function loadModule() {
  if (_mod) return _mod;
  _mod = await import(pathToFileURL(DRAFT_MJS).href);
  return _mod;
}
async function loadRemoveBuilder() {
  const mod = await loadModule();
  if (typeof mod.buildRemoveConceptDraft !== 'function') {
    throw new Error(
      'ui/src/pages/tapestries/tapestryDraft.mjs does not export buildRemoveConceptDraft — the Implementer must add the ' +
      'pure subtract transform (ADR tapestries/0006 Decisions 1-A + 2-A + 3-A): buildRemoveConceptDraft({ event, memberUuid, ' +
      'resolvedImports = [], conceptOptions = [] }) → { dTag, uuid, unsignedEvent, removed: { node, importUuids } }: copy the ' +
      'event verbatim and remove exactly ONE authored member node plus the import(s) attributed to it (containment ∪ options ' +
      'derivation ∪ short-slug derivation) and claimed by no remaining member. ' +
      'Exports found: [' + Object.keys(mod).join(', ') + ']'
    );
  }
  return mod.buildRemoveConceptDraft;
}
async function loadMembersHelper() {
  const mod = await loadModule();
  if (typeof mod.authoredConceptMembers !== 'function') {
    throw new Error(
      'ui/src/pages/tapestries/tapestryDraft.mjs does not export authoredConceptMembers — the Implementer must add the shared ' +
      'membership helper (ADR tapestries/0006 Decision 1-A): authoredConceptMembers(event) → [{slug, uuid, name}] of nodes with ' +
      'a 39998: uuid in the element\'s OWN json.graph.nodes; [] on missing/unparseable json or missing/null graph; never throws. ' +
      'One definition of "authored membership" shared by the transform, the page, and tests. ' +
      'Exports found: [' + Object.keys(mod).join(', ') + ']'
    );
  }
  return mod.authoredConceptMembers;
}

/* ───────────── Pure transform — AC-3 "Save = removing only, published as tapestries already are" ───────────── */

test('P1: republishing keeps the SAME coordinate — d-tag copied verbatim (the bare-hex b0b48b00 shape), uuid = 39999:<author>:<dTag>, kind 39999, unsigned, and a removed summary naming the node + its imports', async () => {
  const build = await loadRemoveBuilder();
  const draft = build({ event: liveEvent(), memberUuid: CAT_UUID });
  assert(draft.dTag === 'b0b48b00',
    `dTag must be the EXISTING d-tag verbatim ("b0b48b00") — any derivation (tapestry-<slug>-<suffix>) lands on a NEW ` +
    `coordinate: a duplicate directory row and an unchanged original, failing "same uuid/URL, no duplicate entry". Got ${draft.dTag}.`);
  assert(tagVal(draft.unsignedEvent, 'd') === 'b0b48b00', `the event's d tag must also be "b0b48b00" verbatim, got ${tagVal(draft.unsignedEvent, 'd')}.`);
  assert(draft.uuid === `39999:${TA}:b0b48b00`, `uuid must be 39999:<event author>:<dTag> (the address every session re-reads), got ${draft.uuid}.`);
  assert(draft.unsignedEvent.kind === 39999, `kind must stay 39999, got ${draft.unsignedEvent.kind}.`);
  assert(draft.unsignedEvent.sig === undefined && draft.unsignedEvent.pubkey === undefined,
    'must return an UNSIGNED event with no pubkey — the own-key branch attaches the author before NIP-07 signing; the TA branch lets the server re-sign.');
  assert(draft.removed && draft.removed.node && draft.removed.node.uuid === CAT_UUID,
    'the returned removed.node must be the member node that was taken out — it feeds the confirm copy ("Take out cat?") and the page\'s selected-reset.');
  assert(Array.isArray(draft.removed.importUuids) && draft.removed.importUuids.includes(`39999:${TA}:cat-concept-graph`),
    `removed.importUuids must name the import(s) that left with the member (expected 39999:${TA}:cat-concept-graph), got ${JSON.stringify(draft.removed && draft.removed.importUuids)}.`);
});

test('P2: remove-only is structural on the live shape — exactly the cat node and the cat import leave; every remaining node/import survives in order; tapestry block, slug-valued name tag, z tag, content untouched; input not mutated', async () => {
  const build = await loadRemoveBuilder();
  const before = liveEvent();
  const frozen = JSON.stringify(before);
  const draft = build({ event: before, memberUuid: CAT_UUID });
  assert(JSON.stringify(before) === frozen, 'buildRemoveConceptDraft must not MUTATE its input event — the page keeps it as the base for the next removal.');
  const j = jsonOf(draft.unsignedEvent);
  deepEq(j.tapestry, B0B_TAPESTRY, 'the tapestry block (title/description/slug) must pass through unchanged — only membership may change.');
  const g = j.graph;
  const base = liveGraph();
  deepEq(g.nodes, [base.nodes[0], base.nodes[2], base.nodes[3]],
    'exactly ONE node (cat) must be removed and the remaining member nodes must survive verbatim IN THEIR ORIGINAL ORDER — a rebuild that re-derives or reorders rows the owner didn\'t touch is an edit beyond removing.');
  deepEq(g.imports, [base.imports[0], base.imports[2], base.imports[3]],
    'exactly the cat concept-graph import must leave with the member (ratified reading 4: what the element carried solely on its behalf goes too) and the remaining imports must survive verbatim in order.');
  deepEq(g.relationshipTypes, [], 'relationshipTypes must pass through unchanged (empty on the live shape).');
  deepEq(g.relationships, [], 'relationships must pass through unchanged (empty on the live shape).');
  assert(g.graphType === 'tapestry', 'graphType must pass through unchanged.');
  assert(tagVal(draft.unsignedEvent, 'name') === 'tapestry-for-farm-animals',
    `the name tag must stay the SLUG value exactly as the live event carries it — rewriting it to the title would be an edit beyond removing. Got ${JSON.stringify(tagVal(draft.unsignedEvent, 'name'))}.`);
  assert(tagVal(draft.unsignedEvent, 'z') === `39998:${TA}:tapestry`, 'the z tag must pass through unchanged (it is what the directory reads).');
  assert(draft.unsignedEvent.content === '', 'content must pass through unchanged.');
  assert(draft.unsignedEvent.tags.length === before.tags.length, 'tag count must not change — only the json tag\'s VALUE changes.');
});

test('P3: the LIVE dog divergence — removing the member whose node uuid d-tag is a random UUID still takes its dog-concept-graph import with it, via the options derivation (matcher b), with no resolved imports available', async () => {
  const build = await loadRemoveBuilder();
  const draft = build({ event: liveEvent(), memberUuid: DOG_UUID, resolvedImports: [], conceptOptions: [DOG_OPTION, CAT_OPTION] });
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(!g.nodes.some((n) => n.uuid === DOG_UUID), 'the dog member node must be gone.');
  assert(!g.imports.some((i) => i.uuid === `39999:${TA}:dog-concept-graph`),
    `the dog import (39999:${TA}:dog-concept-graph) must leave with the member: the node uuid's d-tag segment is "${DOG_HEADER_DTAG}", so short-slug derivation CANNOT find it — the conceptOptions mapping (handle → conceptGraphSlug "dog") is the evidence. This is the real b0b48b00 data; a design that derives the import from the node uuid fails on it (ADR 0006 Decision 2-A matcher b).`);
  assert(g.imports.some((i) => i.uuid === `39999:${TA}:cat-concept-graph`) && g.imports.length === 3,
    `every other import must survive (cat/cow/pig — got ${JSON.stringify(g.imports.map((i) => i.uuid))}).`);
});

test('P4: read-time containment (matcher a) alone — a member whose concept header was DELETED (no picker option) and whose import name diverges from its node uuid still loses its import, because the resolved import contains the member\'s slug', async () => {
  const build = await loadRemoveBuilder();
  // The mistaken-member cleanup case the feature most needs: header gone from the instance,
  // divergent import name — only the page's already-resolved import proves the linkage.
  const ghostUuid = `39998:${TA}:felis-9x8y7z`;
  const graph = liveGraph();
  graph.nodes[1] = { slug: 'concept-header-for-the-concept-of-cats', uuid: ghostUuid, name: 'cat' };
  const ev = liveEvent({}, graph);
  const resolvedImports = [{
    slug: 'concept-graph-for-cat', uuid: `39999:${TA}:cat-concept-graph`,
    graph: { graphType: 'conceptGraph', nodes: [{ slug: 'concept-header-for-the-concept-of-cats', uuid: `39998:${TA}:cat`, name: 'cat' }], relationshipTypes: [], relationships: [] },
  }];
  const draft = build({ event: ev, memberUuid: ghostUuid, resolvedImports, conceptOptions: [] });
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(!g.nodes.some((n) => n.uuid === ghostUuid), 'the member node must be gone.');
  assert(!g.imports.some((i) => i.uuid === `39999:${TA}:cat-concept-graph`),
    'the cat-concept-graph import must be removed by READ-TIME CONTAINMENT: its resolved graph carries a node under the removed member\'s slug, so if it survived, composeGraph would re-contribute that slug and the concept would STILL SHOW after the save — failing "no longer shows that concept" (AC-4/AC-5). Matcher (a) is the one that tracks the actual read-time semantics (ADR 0006 Decision 2-A).');
});

test('P5: short-slug derivation (matcher c) alone — with NO options and NO resolved imports, removing a member whose import follows the common <dTag>-concept-graph shape still takes the import', async () => {
  const build = await loadRemoveBuilder();
  const draft = build({ event: liveEvent(), memberUuid: CAT_UUID });
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(!g.nodes.some((n) => n.uuid === CAT_UUID), 'the cat member node must be gone.');
  assert(!g.imports.some((i) => i.uuid === `39999:${TA}:cat-concept-graph`),
    'with zero external evidence the import must still be found by deriving 39999:<pubkeyOf(member uuid)>:<dTagOf(member uuid)>-concept-graph — three of the four live members follow this shape, and it must work even when the header is deleted AND the import is unresolvable (ADR 0006 Decision 2-A matcher c).');
});

test('P6: an import attributable to NO member passes through unchanged — removing what cannot be attributed would be an edit beyond removing', async () => {
  const build = await loadRemoveBuilder();
  const draft = build({ event: richEvent(), memberUuid: `39998:${TA}:cat`, conceptOptions: [CAT_OPTION] });
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(g.imports.some((i) => i.uuid === `39999:${TA}:mystery-concept-graph`),
    'the mystery import matches no member under any matcher — it is "everything else in it stays as it was" and MUST survive the removal verbatim.');
  deepEq(g.imports.map((i) => i.uuid), [`39999:${TA}:dog-concept-graph`, `39999:${TA}:mystery-concept-graph`],
    'exactly the removed member\'s import leaves; the dog import and the unattributable mystery import survive in their original order.');
});

test('P7: the "solely on its behalf" guard — an import claimed by a REMAINING member as well stays put when one of its claimants is removed', async () => {
  const build = await loadRemoveBuilder();
  // Two headers whose concept-graphs derive to the SAME import uuid: dog (short-slug match)
  // and hound (options-derived to conceptGraphSlug "dog"). Removing hound must NOT take the
  // shared import — dog still needs it at read time.
  const HOUND_UUID = `39998:${TA}:hound-77aa88bb`;
  const graph = {
    graphType: 'tapestry',
    nodes: [
      { slug: 'concept-header-for-the-concept-of-dogs', uuid: `39998:${TA}:dog`, name: 'dog' },
      { slug: 'concept-header-for-the-concept-of-hounds', uuid: HOUND_UUID, name: 'hound' },
    ],
    relationshipTypes: [], relationships: [],
    imports: [{ slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` }],
  };
  const houndOption = { handle: HOUND_UUID, shortSlug: 'hound-77aa88bb', conceptGraphSlug: 'dog', descriptiveSlug: 'concept-header-for-the-concept-of-hounds', name: 'hound' };
  const draft = build({ event: richEvent({}, graph), memberUuid: HOUND_UUID, conceptOptions: [houndOption] });
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(!g.nodes.some((n) => n.uuid === HOUND_UUID), 'the hound member node must be gone.');
  deepEq(g.imports, [{ slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` }],
    'the shared import must STAY: it is carried for the remaining dog member too (short-slug derivation), so it is not carried SOLELY on the removed member\'s behalf (ADR 0006 Decision 2-A) — removing it would break the surviving member\'s read-time resolution.');
});

/* ───────────── Refusals — AC-2 and the transform's "refuse what can't be removed cleanly" ───────────── */

test('P8: the LAST authored concept cannot be taken out — the refusal throws with the plain-language sentence, and superset/property nodes do not count as concepts', async () => {
  const build = await loadRemoveBuilder();
  // One 39998: concept + a superset + a property node: the concept COUNT is 1, so removal
  // is refused even though the nodes array holds three entries — the boundary's word is
  // "concept", judged from authoredConceptMembers (ADR 0006 Decision 3-A).
  const soloGraph = {
    graphType: 'tapestry',
    nodes: [
      { slug: 'concept-header-for-the-concept-of-dogs', uuid: `39998:${TA}:dog`, name: 'dog' },
      { slug: 'superset-for-the-concept-of-dogs', uuid: `39999:${TA}:dog-superset`, name: 'superset for the concept of dogs' },
      { slug: 'dog.breed', name: 'dog.breed' },
    ],
    relationshipTypes: [], relationships: [],
    imports: [{ slug: 'concept-graph-for-dog', uuid: `39999:${TA}:dog-concept-graph` }],
  };
  expectThrowMatching(
    () => build({ event: richEvent({}, soloGraph), memberUuid: `39998:${TA}:dog` }),
    /keeps at least one concept/i,
    'removing the LAST authored concept must throw — an emptied tapestry is a deletion, and deleting is not this goal (the boundary). The transform is the backstop behind the page\'s up-front refusal; no save from this surface may leave zero member concepts (AC-2).'
  );
});

test('P9: a uuid that is not an authored member is refused — ghosts visible only via imports, superset uuids, and unknown uuids all throw', async () => {
  const build = await loadRemoveBuilder();
  expectThrow(() => build({ event: liveEvent(), memberUuid: `39998:${TA}:zebra` }),
    'a memberUuid absent from the element\'s own graph.nodes must be refused — a "ghost" member that appears only through a resolved import needs an import-with-no-node edit, which is integration-shaped work, not membership removal (ADR 0006 Decision 3-A; story Out of scope).');
  expectThrow(() => build({ event: richEvent(), memberUuid: `39999:${TA}:dog-superset` }),
    'a 39999: superset node is NOT an authored concept member — only 39998:-uuid nodes are removable; anything else must throw.');
});

test('P10: refuses what it cannot preserve — wrong kind, missing d tag, unparseable json, non-object json, ABSENT graph, null graph, nodes-not-an-array, imports-not-an-array all THROW', async () => {
  const build = await loadRemoveBuilder();
  expectThrow(() => build({ event: liveEvent({ kind: 1 }), memberUuid: CAT_UUID }),
    'a non-39999 event must be refused — the transform only understands tapestry elements.');
  expectThrow(() => build({ event: liveEvent({ tags: liveEvent().tags.filter((t) => t[0] !== 'd') }), memberUuid: CAT_UUID }),
    'an event with no d tag has no coordinate to republish to — must throw, never invent one.');
  const badJson = liveEvent(); badJson.tags = badJson.tags.map((t) => (t[0] === 'json' ? ['json', '{not json'] : t));
  expectThrow(() => build({ event: badJson, memberUuid: CAT_UUID }),
    'an unparseable json tag must be refused — a remove-only guarantee cannot be given over a structure the transform cannot read.');
  const arrJson = liveEvent(); arrJson.tags = arrJson.tags.map((t) => (t[0] === 'json' ? ['json', '["not an object"]'] : t));
  expectThrow(() => build({ event: arrJson, memberUuid: CAT_UUID }),
    'a json tag that does not hold an object must be refused.');
  expectThrow(() => build({ event: liveEvent({}, OMIT_GRAPH /* graph absent entirely */), memberUuid: CAT_UUID }),
    'an event with NO graph block has no members to take out (the story\'s Out of scope: degraded tapestries) — the transform must refuse, never invent an empty graph to subtract from.');
  expectThrow(() => build({ event: liveEvent({}, null), memberUuid: CAT_UUID }),
    'a null graph must be refused the same as an absent one.');
  expectThrow(() => build({ event: liveEvent({}, { nodes: 'broken' }), memberUuid: CAT_UUID }),
    'a graph whose nodes is not an array must be refused — subtracting from it is undefined; the UI shows the error and the tapestry stays unchanged.');
  const badImports = liveGraph(); badImports.imports = 'broken';
  expectThrow(() => build({ event: liveEvent({}, badImports), memberUuid: CAT_UUID }),
    'graph.imports present but not an array must be refused (mirror of the add transform\'s guard, extended per story #5\'s ratified Deviations).');
});

test('P11: a removed slug shared by another 39998: node is refused — composeGraph merges by slug, so the removal could not be shown distinctly', async () => {
  const build = await loadRemoveBuilder();
  const graph = liveGraph();
  // A second concept node under the SAME slug as cat, different uuid — the read model
  // would have been merging them all along; removing one cannot render truthfully.
  graph.nodes.push({ slug: 'concept-header-for-the-concept-of-cats', uuid: `39998:${TA}:felis`, name: 'felis' });
  expectThrow(() => build({ event: liveEvent({}, graph), memberUuid: CAT_UUID }),
    'when the removed node\'s slug is shared by another 39998: node the transform must THROW — the mirror of add\'s slug-collision refusal (ADR 0006 Decision 1-A): at compose time the survivor would still render under that slug and the removal would look like a no-op.');
});

test('P12: created_at is STRICTLY greater than the base event even on same-second input (a tie lets NIP-01 keep the OLD event), and fresh (now-ish) for old bases', async () => {
  const build = await loadRemoveBuilder();
  const now = Math.floor(Date.now() / 1000);
  const sameSecond = build({ event: liveEvent({ created_at: now }), memberUuid: CAT_UUID });
  assert(sameSecond.unsignedEvent.created_at > now,
    `created_at must be STRICTLY greater than the base event's (${now}) — equal timestamps resolve by event id and can keep the OLD event, silently losing the removal. Got ${sameSecond.unsignedEvent.created_at}.`);
  const future = build({ event: liveEvent({ created_at: now + 40 }), memberUuid: CAT_UUID });
  assert(future.unsignedEvent.created_at > now + 40,
    `even against a clock-skewed base (${now + 40}), created_at must still exceed it (Math.max(now, base+1) — ADR). Got ${future.unsignedEvent.created_at}.`);
  const old = build({ event: liveEvent(), memberUuid: CAT_UUID }); // base created_at 1773183323 (months old)
  assert(old.unsignedEvent.created_at > 1773183323 && old.unsignedEvent.created_at >= now - 300,
    `for an old base the replacement must carry a FRESH (now-ish) timestamp, not base+1 — got ${old.unsignedEvent.created_at} (now ≈ ${now}).`);
});

test('P13: authoredConceptMembers — the ONE membership definition: 39998:-uuid nodes only, in order; [] (never a throw) on missing json, unparseable json, absent/null graph, nodes-not-an-array', async () => {
  const members = await loadMembersHelper();
  deepEq(members(liveEvent()).map((m) => m.uuid),
    [DOG_UUID, CAT_UUID, `39998:${TA}:cow`, `39998:${TA}:pig`],
    'on the live shape the helper must list exactly the four member concepts, in node order — the page derives per-row eligibility AND the last-member count from this list (ADR 0006 Decision 3-A).');
  deepEq(members(richEvent()).map((m) => m.uuid), [`39998:${TA}:dog`, `39998:${TA}:cat`],
    'superset (39999:) and property (uuid-less) nodes must NOT count as concepts — the boundary\'s word is "concept".');
  const m0 = members(liveEvent())[0];
  deepEq(m0, { slug: 'concept-header-for-the-concept-of-dogs', uuid: DOG_UUID, name: 'dog' },
    'each entry must carry {slug, uuid, name} — what the refusal copy, the confirm copy, and the selected-reset consume.');
  const noJson = liveEvent({ tags: liveEvent().tags.filter((t) => t[0] !== 'json') });
  deepEq(members(noJson), [], 'no json tag → [] (the page uses this for eligibility; it must never throw).');
  const badJson = liveEvent(); badJson.tags = badJson.tags.map((t) => (t[0] === 'json' ? ['json', '{not json'] : t));
  deepEq(members(badJson), [], 'unparseable json → [].');
  deepEq(members(liveEvent({}, OMIT_GRAPH)), [], 'absent graph → [].');
  deepEq(members(liveEvent({}, null)), [], 'null graph → [].');
  deepEq(members(liveEvent({}, { nodes: 'broken' })), [], 'nodes not an array → [].');
  deepEq(members(null), [], 'a null event → [] (defensive: the page may render before the event loads).');
});

test('P14: everything else stays as it was — authored relationships, relationshipTypes, unknown json keys, unknown tags (between AND after known ones), superset/property nodes, and content all pass through verbatim when a member is removed', async () => {
  const build = await loadRemoveBuilder();
  const before = richEvent();
  const frozen = JSON.stringify(before);
  const draft = build({ event: before, memberUuid: `39998:${TA}:cat`, conceptOptions: [CAT_OPTION] });
  assert(JSON.stringify(before) === frozen, 'the input event must not be mutated.');
  const a = before.tags, b = draft.unsignedEvent.tags;
  assert(b.length === a.length, `tag count must not change (${a.length} → ${b.length}).`);
  a.forEach((tag, i) => {
    assert(b[i] && b[i][0] === tag[0], `tag order changed at index ${i}: expected a ${JSON.stringify(tag[0])} tag, got ${JSON.stringify(b[i] && b[i][0])} — tags must be copied in order (ADR 1-A).`);
    if (tag[0] !== 'json') {
      deepEq(b[i], tag, `tag [${tag[0]}] at index ${i} must be byte-identical — unknown tags (t, alt, …) are part of "everything else unchanged".`);
    }
  });
  const j = jsonOf(draft.unsignedEvent);
  deepEq(j.tapestry, { slug: 'my-pets', title: 'My Pets', description: 'good pets' }, 'title and description must be unchanged.');
  deepEq(j.provenance, { authoredBy: 'hand', note: 'unknown json keys must survive a removal' },
    'unknown top-level json keys must pass through untouched.');
  const g = j.graph;
  deepEq(g.relationships, RICH_GRAPH.relationships,
    'authored relationships (none of which involve the removed member) must pass through unchanged — the transform copies, never rebuilds; a rebuild that zeroes relationships destroys authored data the day it exists (ADR 0006 rejects Option 1-B on exactly this).');
  deepEq(g.relationshipTypes, RICH_GRAPH.relationshipTypes, 'relationshipTypes must pass through unchanged.');
  deepEq(g.nodes, [RICH_GRAPH.nodes[0], RICH_GRAPH.nodes[2], RICH_GRAPH.nodes[3]],
    'the superset and property nodes must survive verbatim and in order — only the cat member node leaves.');
  assert(draft.unsignedEvent.content === before.content, 'content must pass through unchanged.');
});

test('P15: the coordinate follows the EVENT\'s author — an owner-authored tapestry republishes under 39999:<owner>:<dTag>, and the removed member\'s TA-namespaced import still leaves with it', async () => {
  const build = await loadRemoveBuilder();
  const draft = build({ event: liveEvent({ pubkey: OWNER }), memberUuid: CAT_UUID });
  assert(draft.uuid === `39999:${OWNER}:b0b48b00`,
    `uuid must be namespaced to the event's AUTHOR (the owner here) — the own-key republish is signed by the owner, so a TA-keyed uuid would make the post-save re-read miss the event. Got ${draft.uuid}.`);
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(!g.imports.some((i) => i.uuid === `39999:${TA}:cat-concept-graph`),
    'attribution must key off the pubkey inside the MEMBER\'s uuid (always the TA for concept handles), not the tapestry author — the transform takes no taPubkey parameter and hardcodes nothing (ADR 0006 Decision 2-A).');
  assert(g.nodes.length === 3 && g.imports.length === 3, 'the removal itself must behave identically on an owner-authored element.');
});

/* ───────────── Source sentinels — pinned by the spec, exercised by Playwright ───────────── */

test('S1: tapestryDraft.mjs exports buildRemoveConceptDraft AND authoredConceptMembers (the pure subtract transform + the shared membership helper exist)', async () => {
  await loadRemoveBuilder();
  await loadMembersHelper();
});

test('S2: RemoveConceptFromTapestry.jsx exists and drives the save through the pure transform, the shared helpers, an inline confirm step, and the up-front last-member refusal sentence', () => {
  const src = readSafe(REMOVE_COMPONENT);
  assert(src !== null,
    'ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx missing — the Implementer must create the sidebar affordance ' +
    'component (ADR 0006 Decision 5): props {event, imports, onRemoved}; per-member "Take out" controls when the authored ' +
    'concept count is >= 2, the plain-language refusal sentence INSTEAD of any control when it is exactly 1, an inline ' +
    'confirm (Take out / Cancel) that publishes nothing until confirmed, the Decision-4 signing branch, and inline errors.');
  assert(/buildRemoveConceptDraft/.test(src),
    'RemoveConceptFromTapestry.jsx does not call buildRemoveConceptDraft — the replacement event must come from the pure subtract transform, never be re-inlined in the component.');
  assert(/authoredConceptMembers/.test(src),
    'RemoveConceptFromTapestry.jsx does not use authoredConceptMembers — eligibility and the last-member count must come from the ONE shared membership definition (ADR 0006 Decision 3-A), not a second parse that drifts.');
  assert(/useConceptOptions/.test(src),
    'RemoveConceptFromTapestry.jsx does not use useConceptOptions — the options list is matcher (b)\'s evidence (the live dog divergence needs it); the component must pass it into the transform.');
  assert(/Cancel/.test(src),
    'RemoveConceptFromTapestry.jsx has no Cancel — choosing a member must publish NOTHING until the owner confirms; declining returns to idle with the tapestry untouched (ratified reading 2, AC-3).');
  assert(/keeps at least one concept/i.test(src),
    'RemoveConceptFromTapestry.jsx does not carry the plain-language refusal ("…keeps at least one concept…") — AC-2\'s refusal is something the owner SEES up-front, with no way to attempt the save (ratified reading 3), not an error after a rejected publish.');
});

test('S3: RemoveConceptFromTapestry uses BOTH existing publish paths and no new endpoint — TA → POST /api/strfry/publish signAs assistant; own key → signerGuard + NIP-07 + publishOrThrow', () => {
  const src = readSafe(REMOVE_COMPONENT);
  assert(src !== null, 'RemoveConceptFromTapestry.jsx missing — S2 must pass first.');
  assert(/\/api\/strfry\/publish/.test(src) && /assistant/.test(src),
    'no TA branch: a TA-authored tapestry must republish via the EXISTING POST /api/strfry/publish with signAs:"assistant" (server-signed, owner-403-gated) — "publishes the way Tapestries are already published", no new server endpoint (the boundary).');
  assert(/getActiveSignerOrThrow/.test(src),
    'no signer guard: the own-key branch must resolve the active NIP-07 signer via getActiveSignerOrThrow(author) so a signer/session mismatch is refused before signing.');
  assert(/signEvent|window\.nostr/.test(src),
    'no NIP-07 signing: an owner-key tapestry must be signed in the browser by the owner (window.nostr.signEvent), exactly as create and add do.');
  assert(/publishOrThrow/.test(src),
    'own-key publish must go through publishOrThrow (local + external co-publish, throwing only when both fail) — the same path create and add use.');
});

test('S4: TapestryDetail renders RemoveConceptFromTapestry behind ONE owner-strict gate named canEdit (the renamed canAdd — a single expression gating BOTH affordances), passing imports and an onRemoved handler', () => {
  const src = readSafe(DETAIL_JSX);
  assert(src !== null, 'ui/src/pages/tapestries/TapestryDetail.jsx missing — re-baseline.');
  assert(/RemoveConceptFromTapestry/.test(src),
    'TapestryDetail.jsx does not render RemoveConceptFromTapestry — the affordance lives on the EXISTING Exploration page (sidebar Concepts section); no new page, no new route (the boundary).');
  assert(/canEdit\s*&&\s*<RemoveConceptFromTapestry/.test(src),
    'the removal affordance is not gated on canEdit — ADR 0006 Decision 4: ONE owner-strict expression (user is the owner AND the author is the runtime-resolved TA or the session key) gates both edit affordances; a second, separate gate expression is drift waiting to happen.');
  assert(!/\bcanAdd\b/.test(src),
    'TapestryDetail.jsx still has canAdd — the ADR renames it to canEdit so ONE expression gates add AND remove; keeping both invites the two gates to diverge (shipped sentinel S4\'s owner-strict regexes are unaffected by the rename).');
  assert(/onRemoved/.test(src),
    'TapestryDetail.jsx passes no onRemoved handler — after a successful save the page must re-read the same coordinate (the existing reload()) and reset a removed-member selection so it never shows the detail pane of a concept that is no longer a member (ADR 0006 Decision 5).');
  assert(/imports/.test(src),
    'TapestryDetail.jsx does not pass imports — useTapestryGraph\'s resolved imports are matcher (a)\'s evidence (read-time containment); without them the transform cannot attribute a deleted-header member\'s import.');
});

/* ───────────── Regression guards — PASS pre AND post ───────────── */

test('R1 (regression, passes pre AND post): buildAddConceptDraft still appends exactly one member node + import at the same coordinate — "adding is already built and stays as it is"', async () => {
  const { buildAddConceptDraft } = await loadModule();
  assert(typeof buildAddConceptDraft === 'function', 'buildAddConceptDraft disappeared from tapestryDraft.mjs — adding the subtract transform must not break the shipped append transform.');
  const HORSE = { handle: `39998:${TA}:horse`, shortSlug: 'horse', conceptGraphSlug: 'horse', descriptiveSlug: 'concept-header-for-the-concept-of-horses', name: 'horse' };
  const draft = buildAddConceptDraft({ event: liveEvent(), member: HORSE, taPubkey: TA });
  assert(draft.dTag === 'b0b48b00', 'add\'s same-coordinate behavior changed — R1.');
  const g = jsonOf(draft.unsignedEvent).graph;
  assert(g.nodes.length === 5 && g.nodes[4].uuid === `39998:${TA}:horse`, 'add no longer appends exactly one member node — R1.');
  assert(g.imports.length === 5 && g.imports[4].uuid === `39999:${TA}:horse-concept-graph`, 'add no longer appends exactly one concept-graph import — R1.');
});

test('R2 (regression): no remove machinery leaks into the shipped add/create path — AddConceptToTapestry, useCreateTapestry, and NewTapestry reference nothing of this story\'s', () => {
  const addSrc = readSafe(ADD_COMPONENT);
  assert(addSrc !== null, 'AddConceptToTapestry.jsx missing — re-baseline.');
  assert(!/RemoveConceptFromTapestry|buildRemoveConceptDraft/.test(addSrc),
    'AddConceptToTapestry.jsx references remove machinery — the boundary pins "adding is already built and stays as it is": zero lines of the shipped add path change (ADR 0006 Decision 4 deliberately DUPLICATES the publish branch instead of extracting it, so shipped sentinel S3 keeps holding).');
  const createHook = readSafe(USE_CREATE);
  assert(createHook !== null && !/RemoveConceptFromTapestry|buildRemoveConceptDraft/.test(createHook),
    'useCreateTapestry.js references remove machinery — the create flow is out of scope and must be untouched.');
  const newPage = readSafe(NEW_TAPESTRY);
  assert(newPage !== null && !/RemoveConceptFromTapestry|buildRemoveConceptDraft/.test(newPage),
    'NewTapestry.jsx references remove machinery — the create flow is out of scope and must be untouched.');
});

test('R3 (regression): useTapestryGraph still exposes { event, imports, reload } — the raw element, the resolved imports (matcher a\'s evidence), and the re-read that makes AC-4 true', () => {
  const src = readSafe(USE_GRAPH);
  assert(src !== null, 'useTapestryGraph.js missing — re-baseline.');
  assert(/\breload\b/.test(src),
    'useTapestryGraph.js has no reload — post-save visibility is by RE-READ of the same coordinate (the same read any session performs), not optimistic state (ADR 0005 Decision 4, unchanged).');
  assert(/[{,]\s*event\b/.test(src),
    'useTapestryGraph.js does not return the raw fetched event — the subtract transform\'s input must be the REAL event, copied verbatim.');
  assert(/\bimports\b/.test(src),
    'useTapestryGraph.js does not return the resolved imports — the page must feed them to the transform as matcher (a)\'s read-time-containment evidence (ADR 0006 Decision 2-A); without them a deleted-header member\'s import cannot be attributed and the concept would re-materialize at compose time.');
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
