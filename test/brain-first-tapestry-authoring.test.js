/**
 * tapestries #7 — Brain-first tapestry authoring (publish-hook dual write).
 * Story: engineering-team/stories/tapestries/7-brain-first-tapestry-authoring.md
 * ADR:   engineering-team/decisions/tapestries/0007-brain-first-authoring-publish-hook.md
 * Book:  engineering-team/audits/brain-first-tapestry-authoring/book.md
 *
 * Five classes:
 *
 *   U1..U3 — pure draft-builder tests via dynamic import() of
 *            ui/src/pages/tapestries/tapestryDraft.mjs (the create-tapestry /
 *            add-a-concept / take-a-concept-back-out suites' pattern): the create
 *            draft authors `word` alongside `tapestry`+`graph`, and both republish
 *            builders carry it through untouched.
 *   G0..G5 — dependency-injected guard tests of the new module
 *            src/api/strfry/tapestryBrainWrite.js: isOwnedTapestryEvent(event,
 *            {taPubkey, ownerPubkey}) accepts exactly the instance's own tapestry
 *            letters (TA- or owner-authored kind-39999 z-tagged to the tapestry
 *            concept) and nothing else. No stack needed.
 *   S1     — source sentinel: the publish endpoint awaits the hook after a
 *            successful strfry import (the one call site the ADR pins).
 *   I1..I7 — live-stack integration (SKIP when the local stack is down): the
 *            assistant-signed create reaches strfry AND the brain (AC1), the
 *            letter carries all three sections and validates against the live
 *            concept schema (AC3), the node carries a tapestryKey with a derived
 *            LMDB doc (AC4), and add/remove republishes keep brain and letter
 *            agreeing (AC5). Assistant-signed publishes go through the house
 *            docker-exec loopback (localTrusted); reads go through host fetch.
 *   R1..R2 — regression guards that PASS pre AND post: legacy word-less letters
 *            are never retrofitted by the add builder (create-only authoring
 *            change), and a third-party client-signed tapestry letter still
 *            publishes permissionlessly (ADR security-auth-exposure/0002) while
 *            producing NO brain node (the allow-list; stage-2 ingest's lane).
 *
 * AC2 (own-key create) is covered by composition, documented in the test plan:
 * R2 proves client-signed events traverse the same post-import hook (its skip
 * branch is observable), G2 proves the guard accepts the owner pubkey, and I1
 * proves accepted events brain-write. A true end-to-end own-key test is
 * impossible without the owner's private key.
 *
 * EXPECTED NOW (pre-implementation): U1–U3, G0–G5, S1, I1–I7 FAIL (the draft has
 * no word section; tapestryBrainWrite.js does not exist; the endpoint returns no
 * brainWrite; the brain gets no node). R1–R2 PASS. When the stack is down, I* and
 * R2 SKIP (recorded, never silent).
 *
 * Fixture safety (OPEN.md #128 lesson): live writes use STABLE, recognizable
 * d-tags (`tapestry-brainfirst-fixture-t7fixture`, `test-brainfirst-thirdparty-t7`)
 * AND stable keys, so each run REPLACES the previous run's addressable event —
 * zero corpus growth, and any future relay sweep can classify them by the
 * brainfirst prefix. R2's third-party letter additionally self-cleans by exact
 * event id on the way out (best-effort), so the permissionless View Tapestries
 * directory carries no third-party residue between runs. Keys in fixtures are
 * literals, including R2's deliberately NON-SECRET throwaway private key (test
 * files only — production code resolves the TA at runtime, never hardcodes;
 * CLAUDE.md).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const DRAFT_MJS = path.join(ROOT, 'ui/src/pages/tapestries/tapestryDraft.mjs');
const BRAIN_WRITE_JS = path.join(ROOT, 'src/api/strfry/tapestryBrainWrite.js');
const PUBLISH_JS = path.join(ROOT, 'src/api/strfry/commands/publishEvent.js');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;

// Fixture pubkeys (fixtures only — never hardcode the TA in production code).
const FIX_TA = 'a'.repeat(63) + '1';
const FIX_OWNER = 'b'.repeat(63) + '2';
const FIX_THIRD = 'c'.repeat(63) + '3';
const fixHandle = (slug) => `39998:${FIX_TA}:${slug}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── module loaders ─────────────────────────────────────────────────────

let _draft = null;
async function draftMod() {
  if (!_draft) _draft = await import(pathToFileURL(DRAFT_MJS).href);
  return _draft;
}

function brainWriteMod() {
  // require() fresh each call; G0 is the headline failure, so the G1..G5
  // dependents fail with a short precondition message, not a require stack.
  try { return require(BRAIN_WRITE_JS); }
  catch { throw new Error('precondition: the brain-write module is missing (G0\'s contract) — implement src/api/strfry/tapestryBrainWrite.js first'); }
}

// ── live-stack helpers (house pattern: reads via host fetch, privileged
//    writes via docker-exec loopback so the auth middleware sees a genuine
//    in-container loopback peer → req.localTrusted) ─────────────────────

let _stack = null;
async function stack() {
  if (_stack) return _stack;
  try {
    const r = await fetch(`${HOST_BASE}/api/assistant/pubkey`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    _stack = (j && j.success && /^[0-9a-f]{64}$/.test(j.pubkey))
      ? { up: true, ta: j.pubkey }
      : { up: false };
  } catch {
    _stack = { up: false };
  }
  return _stack;
}

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 30000 });
}

function loopbackPostJson(pathname, body) {
  const out = dockerCurl(['-s', '-m', '25', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback POST ${pathname} did not return JSON: ${String(out).slice(0, 200)}`); }
}

async function hostPostJson(pathname, body) {
  const r = await fetch(`${HOST_BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  return r.json();
}

async function cypher(query, params = {}) {
  const j = await hostPostJson('/api/neo4j/query', { cypher: query, params });
  if (!j || j.success !== true) throw new Error(`cypher failed: ${JSON.stringify(j).slice(0, 200)}`);
  return Array.isArray(j.data) ? j.data : [];
}

async function scanEvents(filter) {
  const r = await fetch(`${HOST_BASE}/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify(filter))}`,
    { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.events)) return j.events;
  if (j && Array.isArray(j.data)) return j.data;
  throw new Error(`strfry scan returned an unrecognized shape: ${JSON.stringify(j).slice(0, 200)}`);
}

function jsonTagOf(event) {
  const raw = (event.tags || []).find((t) => t[0] === 'json')?.[1];
  assert(raw, 'event has no json tag');
  return { raw, parsed: JSON.parse(raw) };
}

// The tapestry-key read API's exact response nesting is the Implementer's; the
// spec only demands the derived doc be retrievable. Accept the envelope at any
// of the obvious nestings and fail articulately otherwise.
function pluckDerived(resp) {
  const candidates = [resp?.data?.data, resp?.data, resp?.entry?.data, resp?.value?.data];
  for (const c of candidates) {
    if (c && typeof c === 'object' && (c.word || c.tapestry || c.graphContext)) return c;
  }
  return null;
}

// ── fixtures ───────────────────────────────────────────────────────────

const FIXTURE_TITLE = 'Brainfirst Fixture';
const FIXTURE_SUFFIX = 't7fixture'; // stable → replaceable event, zero corpus growth
const THIRD_PARTY_DTAG = 'test-brainfirst-thirdparty-t7';

function memberFor(ta, slug, name) {
  return { handle: `39998:${ta}:${slug}`, shortSlug: slug, conceptGraphSlug: slug, descriptiveSlug: slug, name: name || slug };
}

// Shared integration context, filled by I1 and consumed downstream. Each
// downstream test re-checks its own preconditions with an articulate failure
// (never a cascade crash) when the stack is up but I1's postcondition is absent.
const ctx = {};

// ═══ U-class: the authored wire shape (stack-free, binding) ════════════

test('U1: buildTapestryDraft authors word + tapestry + graph — word.slug mirrors the tapestry slug, word.name carries the title, wordTypes is ["word"], and no other top-level section appears', async () => {
  const { buildTapestryDraft, slugifyTitle } = await draftMod();
  const draft = buildTapestryDraft({
    title: FIXTURE_TITLE, description: 'fixture', members: [memberFor(FIX_TA, 'tag')],
    taPubkey: FIX_TA, dTagSuffix: 'u1',
  });
  const { parsed } = jsonTagOf(draft.unsignedEvent);
  assert(parsed.word && typeof parsed.word === 'object',
    'the create draft has no top-level `word` section — the letter must carry word alongside tapestry and graph (story AC3; OPEN.md #136 owner ratification)');
  assert(parsed.word.slug === slugifyTitle(FIXTURE_TITLE),
    `word.slug must equal the tapestry slug (${slugifyTitle(FIXTURE_TITLE)}); got ${JSON.stringify(parsed.word.slug)}`);
  assert(parsed.word.name === FIXTURE_TITLE,
    `word.name must carry the clean title (${FIXTURE_TITLE}); got ${JSON.stringify(parsed.word.name)}`);
  assert(Array.isArray(parsed.word.wordTypes) && parsed.word.wordTypes.length === 1 && parsed.word.wordTypes[0] === 'word',
    `word.wordTypes must be ["word"] (the generic word deriver's own default, so derive never fights authoring); got ${JSON.stringify(parsed.word.wordTypes)}`);
  assert(parsed.tapestry && parsed.tapestry.slug === slugifyTitle(FIXTURE_TITLE) && parsed.tapestry.title === FIXTURE_TITLE,
    'the tapestry section lost its pre-change contract (slug + title) — AC3 forbids regressing the existing shape');
  assert(parsed.graph && parsed.graph.graphType === 'tapestry' && Array.isArray(parsed.graph.nodes) && parsed.graph.nodes.length === 1,
    'the graph section lost its pre-change contract (graphType tapestry, one member node)');
  const keys = Object.keys(parsed).sort();
  assert(keys.join(',') === 'graph,tapestry,word',
    `the authored json must carry exactly {word, tapestry, graph}; got top-level keys [${keys.join(', ')}]`);
});

test('U2: buildAddConceptDraft carries an authored word section through the republish verbatim (AC5\'s json half — an edit must never strip what create authored)', async () => {
  const { buildTapestryDraft, buildAddConceptDraft } = await draftMod();
  const draft = buildTapestryDraft({
    title: FIXTURE_TITLE, description: 'fixture', members: [memberFor(FIX_TA, 'tag')],
    taPubkey: FIX_TA, dTagSuffix: 'u2',
  });
  const baseWord = jsonTagOf(draft.unsignedEvent).parsed.word;
  assert(baseWord, 'precondition: the create draft has no word section (U1\'s contract) — nothing to preserve');
  const republished = buildAddConceptDraft({
    event: { ...draft.unsignedEvent, pubkey: FIX_TA },
    member: memberFor(FIX_TA, 'nostr-user-tag'),
    taPubkey: FIX_TA,
  });
  const after = jsonTagOf(republished.unsignedEvent).parsed;
  assert(after.word && JSON.stringify(after.word) === JSON.stringify(baseWord),
    `the add-republish altered or dropped the word section: before ${JSON.stringify(baseWord)}, after ${JSON.stringify(after.word)}`);
  assert(after.graph.nodes.length === 2, 'the add-republish failed to append the new member node');
});

test('U3: buildRemoveConceptDraft carries an authored word section through the republish verbatim (AC5\'s json half, subtract direction)', async () => {
  const { buildTapestryDraft, buildRemoveConceptDraft } = await draftMod();
  const draft = buildTapestryDraft({
    title: FIXTURE_TITLE, description: 'fixture',
    members: [memberFor(FIX_TA, 'tag'), memberFor(FIX_TA, 'nostr-user-tag')],
    taPubkey: FIX_TA, dTagSuffix: 'u3',
  });
  const baseWord = jsonTagOf(draft.unsignedEvent).parsed.word;
  assert(baseWord, 'precondition: the create draft has no word section (U1\'s contract) — nothing to preserve');
  const republished = buildRemoveConceptDraft({
    event: { ...draft.unsignedEvent, pubkey: FIX_TA },
    memberUuid: fixHandle('nostr-user-tag'),
  });
  const after = jsonTagOf(republished.unsignedEvent).parsed;
  assert(after.word && JSON.stringify(after.word) === JSON.stringify(baseWord),
    `the remove-republish altered or dropped the word section: before ${JSON.stringify(baseWord)}, after ${JSON.stringify(after.word)}`);
  assert(after.graph.nodes.length === 1, 'the remove-republish failed to drop the member node');
});

// ═══ G-class: the author allow-list guard (dependency-injected) ════════

const GUARD_KEYS = { taPubkey: FIX_TA, ownerPubkey: FIX_OWNER };
function guardEvent(over = {}) {
  return {
    kind: 39999,
    pubkey: FIX_TA,
    tags: [['d', 'g-fixture'], ['name', 'g'], ['z', fixHandle('tapestry')], ['json', '{}']],
    ...over,
  };
}

test('G0: src/api/strfry/tapestryBrainWrite.js exists and exports maybeBrainWriteTapestry + isOwnedTapestryEvent (the headline articulate failure)', () => {
  let mod;
  try { mod = require(BRAIN_WRITE_JS); }
  catch (e) { throw new Error(`the brain-write module is missing or unloadable (${String(e.message).split('\n')[0]}) — ADR 0007 Implementation note 1`); }
  assert(typeof mod.maybeBrainWriteTapestry === 'function', 'maybeBrainWriteTapestry is not an exported function');
  assert(typeof mod.isOwnedTapestryEvent === 'function', 'isOwnedTapestryEvent is not an exported function (the dependency-injectable guard the stack-free tests exercise)');
});

test('G1: the guard accepts a TA-authored kind-39999 letter z-tagged to the tapestry concept', () => {
  const { isOwnedTapestryEvent } = brainWriteMod();
  assert(isOwnedTapestryEvent(guardEvent(), GUARD_KEYS) === true,
    'a TA-authored tapestry letter must pass the guard — assistant-signed creates are the primary authoring path (AC1)');
});

test('G2: the guard accepts an owner-authored letter (AC2\'s guard half — own-key creates brain-write too)', () => {
  const { isOwnedTapestryEvent } = brainWriteMod();
  assert(isOwnedTapestryEvent(guardEvent({ pubkey: FIX_OWNER }), GUARD_KEYS) === true,
    'an owner-authored tapestry letter must pass the guard — the own-key signing mode is first-class (story AC2)');
});

test('G3: the guard rejects a third-party author — importing anyone else\'s letters is stage-2 ingest, not this story', () => {
  const { isOwnedTapestryEvent } = brainWriteMod();
  assert(isOwnedTapestryEvent(guardEvent({ pubkey: FIX_THIRD }), GUARD_KEYS) === false,
    'a third-party-authored letter must NOT pass the guard (OPEN.md #136 stage 2; provenance unshipped)');
});

test('G4: the guard rejects a wrong or missing z-tag — only elements of THIS instance\'s tapestry concept qualify', () => {
  const { isOwnedTapestryEvent } = brainWriteMod();
  const wrongConcept = guardEvent({ tags: [['d', 'g'], ['z', fixHandle('tag')], ['json', '{}']] });
  assert(isOwnedTapestryEvent(wrongConcept, GUARD_KEYS) === false,
    'a letter z-tagged to a different concept must not pass');
  const foreignNamespace = guardEvent({ tags: [['d', 'g'], ['z', `39998:${FIX_THIRD}:tapestry`], ['json', '{}']] });
  assert(isOwnedTapestryEvent(foreignNamespace, GUARD_KEYS) === false,
    'a letter z-tagged to another instance\'s tapestry concept (foreign TA namespace) must not pass');
  const noZ = guardEvent({ tags: [['d', 'g'], ['json', '{}']] });
  assert(isOwnedTapestryEvent(noZ, GUARD_KEYS) === false,
    'a letter with no z-tag at all must not pass');
});

test('G5: the guard rejects non-39999 kinds — concept headers and arbitrary notes never take the tapestry brain-write path', () => {
  const { isOwnedTapestryEvent } = brainWriteMod();
  assert(isOwnedTapestryEvent(guardEvent({ kind: 39998 }), GUARD_KEYS) === false, 'kind 39998 must not pass');
  assert(isOwnedTapestryEvent(guardEvent({ kind: 1 }), GUARD_KEYS) === false, 'kind 1 must not pass');
});

// ═══ S-class: the one call site (source sentinel) ══════════════════════

test('S1: publishEvent.js requires the brain-write module and AWAITS the hook (brain-known by flow completion — the response must not race the write)', () => {
  const src = fs.readFileSync(PUBLISH_JS, 'utf8');
  assert(/require\([^)]*tapestryBrainWrite[^)]*\)/.test(src),
    'publishEvent.js does not require ../tapestryBrainWrite — the hook is not wired at the one seam all six authoring paths share (ADR 0007 Decision)');
  assert(/await\s+maybeBrainWriteTapestry\s*\(/.test(src),
    'publishEvent.js does not AWAIT maybeBrainWriteTapestry — an un-awaited hook lets the publish response race the brain write, breaking the flow-completion bar (story AC1/AC2)');
});

// ═══ I-class: live-stack integration (SKIP when the stack is down) ═════

test('I1 (AC1): an assistant-signed create publishes the letter AND reports a successful brain write in the same response', async () => {
  const st = await stack();
  if (!st.up) return 'SKIP';
  const { buildTapestryDraft } = await draftMod();
  const draft = buildTapestryDraft({
    title: FIXTURE_TITLE, description: 'live fixture — stable d-tag, replaced every run',
    members: [memberFor(st.ta, 'tag')], taPubkey: st.ta, dTagSuffix: FIXTURE_SUFFIX,
  });
  // Replaceable-event hygiene: strictly newer than the previous run's fixture so
  // replacement can never tie (NIP-01 resolves equal timestamps by id).
  const prior = await scanEvents({ kinds: [39999], authors: [st.ta], '#d': [draft.dTag] });
  if (prior[0]) draft.unsignedEvent.created_at = Math.max(draft.unsignedEvent.created_at, prior[0].created_at + 1);

  const resp = loopbackPostJson('/api/strfry/publish', { event: draft.unsignedEvent, signAs: 'assistant' });
  assert(resp && resp.success === true, `the publish itself failed: ${JSON.stringify(resp).slice(0, 200)}`);
  assert(resp.brainWrite, 'the publish response carries no brainWrite result — the post-import hook did not run for an owner-authored tapestry letter (ADR 0007 Implementation note 2)');
  assert(resp.brainWrite.success === true, `the brain write ran but failed: ${JSON.stringify(resp.brainWrite).slice(0, 300)}`);
  ctx.dTag = draft.dTag;
  ctx.uuid = `39999:${st.ta}:${draft.dTag}`;
  assert(resp.brainWrite.uuid === ctx.uuid,
    `brainWrite.uuid must be the element coordinate ${ctx.uuid}; got ${resp.brainWrite.uuid}`);
  ctx.tapestryKey = resp.brainWrite.tapestryKey;
  assert(typeof ctx.tapestryKey === 'string' && ctx.tapestryKey.length > 0,
    'brainWrite reported no tapestryKey — AC4 needs the node stamped at creation');
});

test('I2 (AC1): the brain node exists with the ListItem label, the implicit z-tag membership the Elements view queries, and explicit HAS_ELEMENT placement from the tapestry superset', async () => {
  const st = await stack();
  if (!st.up) return 'SKIP';
  assert(ctx.uuid, 'precondition: I1 did not complete — no element coordinate to inspect');
  const handle = `39998:${st.ta}:tapestry`;

  const node = await cypher('MATCH (e:NostrEvent {uuid: $u}) RETURN labels(e) AS labels, e.tapestryKey AS tk', { u: ctx.uuid });
  assert(node.length === 1, `the brain has no node for ${ctx.uuid} — the letter was mailed but the brain never thought it (the exact split-brain this story ends)`);
  assert((node[0].labels || []).includes('ListItem'), `the element node lacks the ListItem label; labels: ${JSON.stringify(node[0].labels)}`);

  const implicit = await cypher(
    "MATCH (e:NostrEvent {uuid: $u})-[:HAS_TAG]->(zt:NostrEventTag {type: 'z', value: $h}) RETURN e.uuid AS uuid", { u: ctx.uuid, h: handle });
  assert(implicit.length === 1,
    'the implicit-membership row is missing — ConceptElements\' z-tag union query would not list this tapestry (AC1\'s "Elements view lists it" contract)');

  const placed = await cypher(
    'MATCH (h:ListHeader {uuid: $h})-[:IS_THE_CONCEPT_FOR]->(sup)-[:HAS_ELEMENT]->(e:NostrEvent {uuid: $u}) RETURN e.uuid AS uuid', { h: handle, u: ctx.uuid });
  assert(placed.length === 1,
    'no HAS_ELEMENT edge from the tapestry superset — the element is not explicitly placed in the class thread (ADR 0007 Implementation note 1, placement step)');
});

test('I3 (AC3): the published letter carries word + tapestry + graph', async () => {
  const st = await stack();
  if (!st.up) return 'SKIP';
  assert(ctx.dTag, 'precondition: I1 did not complete — no fixture letter to scan');
  const events = await scanEvents({ kinds: [39999], authors: [st.ta], '#d': [ctx.dTag] });
  assert(events.length === 1, `expected exactly one fixture letter in strfry for d=${ctx.dTag}; got ${events.length}`);
  const { parsed } = jsonTagOf(events[0]);
  ctx.letterJsonRaw = jsonTagOf(events[0]).raw;
  for (const key of ['word', 'tapestry', 'graph']) {
    assert(parsed[key] && typeof parsed[key] === 'object',
      `the published letter's json is missing the ${key} section — got top-level keys [${Object.keys(parsed).join(', ')}]`);
  }
});

test('I4 (AC3): the published json validates against the live tapestry concept schema (adding word breaks nothing)', async () => {
  const st = await stack();
  if (!st.up) return 'SKIP';
  assert(ctx.letterJsonRaw, 'precondition: I3 did not complete — no published json to validate');
  const rows = await cypher(
    "MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h:ListHeader {uuid: $h}) MATCH (js)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN t.value AS v LIMIT 1",
    { h: `39998:${st.ta}:tapestry` });
  assert(rows.length === 1 && rows[0].v, 'could not fetch the tapestry concept schema from the live graph (firmware installed?)');
  const parsedSchema = JSON.parse(rows[0].v);
  const schema = parsedSchema.jsonSchema || parsedSchema;
  const Ajv = require('ajv');
  const ajv = new Ajv({ allErrors: true, strict: false });
  const { $schema: _ignored, ...schemaNoMeta } = schema;
  const validate = ajv.compile(schemaNoMeta);
  const ok = validate(JSON.parse(ctx.letterJsonRaw));
  assert(ok, `the published tapestry json no longer validates against the concept schema: ${ajv.errorsText(validate.errors)}`);
});

test('I5 (AC4): the node carries a tapestryKey and the tapestry-key API returns a derived doc with word, tapestry, graph, and graphContext', async () => {
  const st = await stack();
  if (!st.up) return 'SKIP';
  assert(ctx.tapestryKey, 'precondition: I1 did not complete — no tapestryKey to look up');
  const r = await fetch(`${HOST_BASE}/api/tapestry-key/${encodeURIComponent(ctx.tapestryKey)}`, { signal: AbortSignal.timeout(10000) });
  const j = await r.json();
  const derived = pluckDerived(j);
  assert(derived,
    `the tapestry-key API returned no derived doc for ${ctx.tapestryKey} — the LMDB cache was not derived at creation (ADR 0007 derive step): ${JSON.stringify(j).slice(0, 200)}`);
  for (const key of ['word', 'tapestry', 'graph', 'graphContext']) {
    assert(derived[key] && typeof derived[key] === 'object',
      `the derived doc is missing its ${key} section — got [${Object.keys(derived).join(', ')}]`);
  }
  assert(derived.graphContext.identifiers && derived.graphContext.identifiers.uuid === ctx.uuid,
    'graphContext.identifiers.uuid does not point back at the element coordinate — the derive ran against the wrong node');
});

test('I6 (AC5): adding a concept republishes the letter AND the brain\'s copy gains the member — the derived doc follows', async () => {
  const st = await stack();
  if (!st.up) return 'SKIP';
  assert(ctx.dTag, 'precondition: I1 did not complete — no fixture tapestry to edit');
  const { buildAddConceptDraft } = await draftMod();
  const [current] = await scanEvents({ kinds: [39999], authors: [st.ta], '#d': [ctx.dTag] });
  assert(current, 'precondition: the fixture letter vanished from strfry between tests');
  const member = memberFor(st.ta, 'nostr-user-tag');
  const draft = buildAddConceptDraft({ event: current, member, taPubkey: st.ta });
  const resp = loopbackPostJson('/api/strfry/publish', { event: draft.unsignedEvent, signAs: 'assistant' });
  assert(resp && resp.success === true && resp.brainWrite && resp.brainWrite.success === true,
    `the add-republish did not brain-write: ${JSON.stringify(resp).slice(0, 300)}`);

  const rows = await cypher(
    "MATCH (e:NostrEvent {uuid: $u})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN t.value AS v LIMIT 1", { u: ctx.uuid });
  assert(rows.length === 1 && rows[0].v, 'the brain node lost its json tag on republish');
  const brainJson = JSON.parse(rows[0].v);
  assert((brainJson.graph?.nodes || []).some((n) => n && n.uuid === member.handle),
    'the brain\'s json still shows the OLD member list after the add — the edit republished the letter but the brain went stale (the divergence AC5 forbids)');

  const kr = await fetch(`${HOST_BASE}/api/tapestry-key/${encodeURIComponent(ctx.tapestryKey)}`, { signal: AbortSignal.timeout(10000) });
  const derived = pluckDerived(await kr.json());
  assert(derived && (derived.graph?.nodes || []).some((n) => n && n.uuid === member.handle),
    'the derived LMDB doc still shows the OLD member list after the add — the cache was not re-derived on republish');
  ctx.addedMember = member;
});

test('I7 (AC5): taking the concept back out re-converges — and the brain\'s json is byte-identical to the letter\'s (the stores agree, strongest form)', async () => {
  const st = await stack();
  if (!st.up) return 'SKIP';
  assert(ctx.addedMember, 'precondition: I6 did not complete — no member to remove');
  const { buildRemoveConceptDraft } = await draftMod();
  const [current] = await scanEvents({ kinds: [39999], authors: [st.ta], '#d': [ctx.dTag] });
  assert(current, 'precondition: the fixture letter vanished from strfry between tests');
  const draft = buildRemoveConceptDraft({ event: current, memberUuid: ctx.addedMember.handle });
  const resp = loopbackPostJson('/api/strfry/publish', { event: draft.unsignedEvent, signAs: 'assistant' });
  assert(resp && resp.success === true && resp.brainWrite && resp.brainWrite.success === true,
    `the remove-republish did not brain-write: ${JSON.stringify(resp).slice(0, 300)}`);

  const [after] = await scanEvents({ kinds: [39999], authors: [st.ta], '#d': [ctx.dTag] });
  const letter = jsonTagOf(after);
  assert(!(letter.parsed.graph?.nodes || []).some((n) => n && n.uuid === ctx.addedMember.handle),
    'the letter still lists the removed member — the remove-republish itself regressed');

  const rows = await cypher(
    "MATCH (e:NostrEvent {uuid: $u})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN t.value AS v LIMIT 1", { u: ctx.uuid });
  assert(rows.length === 1 && rows[0].v, 'the brain node lost its json tag on republish');
  assert(rows[0].v === letter.raw,
    'the brain\'s json tag and the letter\'s json tag differ after the edit — the two stores no longer agree (AC5\'s core promise)');
});

// ═══ R-class: regression guards (PASS pre AND post) ════════════════════

test('R1 (regression): a legacy word-less letter stays word-less through an add-republish — authoring word is create-only; nothing retrofits old letters', async () => {
  const { buildAddConceptDraft } = await draftMod();
  const legacy = {
    kind: 39999, pubkey: FIX_TA, created_at: 1785818349, content: '',
    tags: [
      ['d', 'b0b48b00'],
      ['name', 'legacy-fixture'],
      ['z', fixHandle('tapestry')],
      ['json', JSON.stringify({
        tapestry: { slug: 'legacy-fixture', title: 'Legacy', description: '' },
        graph: { graphType: 'tapestry', nodes: [{ slug: 'tag', uuid: fixHandle('tag'), name: 'tag' }], relationshipTypes: [], relationships: [], imports: [] },
      })],
    ],
  };
  const republished = buildAddConceptDraft({ event: legacy, member: memberFor(FIX_TA, 'nostr-user-tag'), taPubkey: FIX_TA });
  const after = jsonTagOf(republished.unsignedEvent).parsed;
  assert(!('word' in after),
    'the add-republish INVENTED a word section on a legacy letter — republish builders are passthrough; word authoring belongs to create only (ADR 0007 Implementation note 3)');
});

test('R2 (regression + allow-list): a third-party client-signed tapestry letter publishes permissionlessly but produces NO brain node and NO brainWrite result', async () => {
  const st = await stack();
  if (!st.up) return 'SKIP';
  const { getPublicKey, finalizeEvent } = require('nostr-tools');
  // STABLE throwaway keypair — deliberately non-secret fixture material. A
  // per-run random key would mint a NEW addressable coordinate every run and
  // grow user-visible junk rows in the permissionless View Tapestries
  // directory (observed live, 2026-08-04); a fixed key keeps one replaceable
  // coordinate, and the cleanup below removes even that.
  const sk = Uint8Array.from(Buffer.from('d7'.repeat(32), 'hex'));
  const pk = getPublicKey(sk);
  const handle = `39998:${st.ta}:tapestry`;
  const prior = await scanEvents({ kinds: [39999], authors: [pk], '#d': [THIRD_PARTY_DTAG] });
  const event = finalizeEvent({
    kind: 39999,
    created_at: Math.max(Math.floor(Date.now() / 1000), prior[0] ? prior[0].created_at + 1 : 0),
    content: '',
    tags: [
      ['d', THIRD_PARTY_DTAG],
      ['name', 'third party fixture'],
      ['z', handle],
      ['json', JSON.stringify({ tapestry: { slug: 'third-party-fixture' }, graph: { graphType: 'tapestry', nodes: [], relationshipTypes: [], relationships: [], imports: [] } })],
    ],
  }, sk);

  const resp = await hostPostJson('/api/strfry/publish', { event, signAs: 'client' });
  // Best-effort self-cleanup on exit (hygiene, never spec): delete this run's
  // letter by exact id so the directory carries zero third-party residue.
  const cleanup = () => {
    try {
      cp.execFileSync('docker', ['exec', CONTAINER, 'strfry', 'delete', `--filter={"ids":["${event.id}"]}`],
        { encoding: 'utf8', timeout: 15000 });
    } catch { /* cleanup is best-effort */ }
  };
  try {
    assert(resp && resp.success === true,
      `third-party client-signed publishing must remain permissionless (ADR security-auth-exposure/0002) — got ${JSON.stringify(resp).slice(0, 200)}`);
    assert(!resp.brainWrite || resp.brainWrite.skipped || resp.brainWrite.success !== true,
      `a third-party letter must NOT brain-write (stage-2 ingest's lane, not this story's): ${JSON.stringify(resp.brainWrite || null).slice(0, 200)}`);
    const rows = await cypher('MATCH (e:NostrEvent {uuid: $u}) RETURN e.uuid AS uuid', { u: `39999:${pk}:${THIRD_PARTY_DTAG}` });
    assert(rows.length === 0,
      'the brain has a node for a third-party-authored tapestry letter — the author allow-list is not holding');
  } finally {
    cleanup();
  }
});

// ═══ runner ════════════════════════════════════════════════════════════

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
  console.log(`\nbrain-first-tapestry-authoring: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
