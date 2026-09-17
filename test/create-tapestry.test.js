/**
 * tapestries #3 — Create a Tapestry (members-only authoring).
 * Story: engineering-team/stories/tapestries/3-create-tapestry.md
 * ADR:   engineering-team/decisions/tapestries/0003-create-tapestry-authoring.md
 *
 * This suite is the BINDING (stack-free) gate — the Node runner. It has two halves:
 *
 *   P1..P9  — behavioral unit tests of the PURE wire-shape builder
 *             ui/src/pages/tapestries/tapestryDraft.mjs, loaded via dynamic import().
 *             These pin the exact kind-39999 element the Exploration page must be able
 *             to render (grounded against LIVE concept-header data probed 2026-07-24:
 *             concept `dog` → word.slug `concept-header-for-the-concept-of-dogs`, and its
 *             `dog-concept-graph` uses that SAME slug for its header node — ADR Decision
 *             2-A's dedup invariant, confirmed).
 *   S1..S6  — source sentinels on the page/hook/index that the spec pins but that only a
 *             browser can fully exercise (mirrors test/admin-tools-dashboard-panel.test.js).
 *   R1..R3  — regression guards (PASS pre AND post): the shipped read-path model and the
 *             directory query stay intact, and the server's TA-sign 403 gate (the
 *             "non-owner TA-sign is server-refused" AC's server half) is preserved.
 *
 * P1..P9, S1..S6 FAIL now (tapestryDraft.mjs + useCreateTapestry.js don't exist; NewTapestry.jsx
 * is still the inert placeholder; Index.jsx's create button isn't gated). R1..R3 PASS now and after.
 *
 * The full browser round-trip (owner sees form / non-owner blocked / validation blocks / submit
 * posts the right signAs+event / success navigates) is tests/brainstorm/tapestry-create.spec.js
 * (Playwright; BRAINSTORM_SERVER_ACCESSIBLE-gated, run in the cycle-staging smoke).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');

const DRAFT_MJS       = path.join(ROOT, 'ui/src/pages/tapestries/tapestryDraft.mjs');
const NEW_TAPESTRY    = path.join(ROOT, 'ui/src/pages/tapestries/NewTapestry.jsx');
const USE_CREATE_HOOK = path.join(ROOT, 'ui/src/pages/tapestries/useCreateTapestry.js');
const INDEX_JSX       = path.join(ROOT, 'ui/src/pages/tapestries/Index.jsx');
const GRAPH_MODEL     = path.join(ROOT, 'ui/src/pages/tapestries/tapestryGraphModel.js');
const PUBLISH_EVENT   = path.join(ROOT, 'src/api/strfry/commands/publishEvent.js');

// Grounded in the live graph (TA e00ed090…df36). Descriptive slugs are the real word.slug values.
const TA = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
const MEMBERS = [
  { handle: `39998:${TA}:dog`,              shortSlug: 'dog',              conceptGraphSlug: 'dog',              descriptiveSlug: 'concept-header-for-the-concept-of-dogs',              name: 'dog' },
  { handle: `39998:${TA}:golden-retriever`, shortSlug: 'golden-retriever', conceptGraphSlug: 'golden-retriever', descriptiveSlug: 'concept-header-for-the-concept-of-golden-retrievers', name: 'golden retriever' },
];

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; } }

// Memoized dynamic import of the pure ESM builder. A missing module is the expected
// pre-implementation failure — reported with a message that names what to build.
let _mod;
async function loadDraft() {
  if (_mod) return _mod;
  try { _mod = await import(pathToFileURL(DRAFT_MJS).href); return _mod; }
  catch (e) {
    throw new Error(
      'Cannot import ui/src/pages/tapestries/tapestryDraft.mjs — the Implementer must create this pure, ' +
      'React-free ESM module (ADR 0003 §Implementation): export `slugifyTitle(title)` and ' +
      '`buildTapestryDraft({title, description, members, taPubkey, dTagSuffix})`. Import error: ' + e.message
    );
  }
}

function tagVal(ev, name) { const t = (ev.tags || []).find((x) => x[0] === name); return t ? t[1] : undefined; }
function jsonTag(ev) { return JSON.parse(tagVal(ev, 'json')); }
function buildOK() { // the canonical happy-path draft used by several tests
  return loadDraft().then(({ buildTapestryDraft }) =>
    buildTapestryDraft({ title: 'My Dogs', description: 'good dogs', members: MEMBERS, taPubkey: TA, dTagSuffix: 'abcd1234' }));
}

// ───────────────────────── Pure builder — wire shape (AC "Publish shape") ─────────────────────────

test('P1: buildTapestryDraft emits a kind-39999 element z-tagged 39998:<TA>:tapestry with content "" (AC Publish shape)', async () => {
  const draft = await buildOK();
  const ev = draft.unsignedEvent;
  assert(ev && ev.kind === 39999, `unsignedEvent.kind must be 39999, got ${ev && ev.kind}. This is the tapestry element kind the directory + Exploration page read.`);
  assert(ev.content === '', `unsignedEvent.content must be "" (the payload lives in the json tag), got ${JSON.stringify(ev.content)}.`);
  assert(ev.sig === undefined, 'buildTapestryDraft must return an UNSIGNED template (no sig) — signing happens in the hook (own-key NIP-07) or server (TA).');
  assert(tagVal(ev, 'z') === `39998:${TA}:tapestry`, `missing/incorrect z tag — must be "39998:${TA}:tapestry" so the directory (queryRelay #z) lists it; got ${tagVal(ev, 'z')}.`);
});

test('P2: the d tag follows tapestry-<slug>-<suffix> and the returned uuid is its a-tag coordinate (AC Publish shape / Round-trips)', async () => {
  const draft = await buildOK();
  const dTag = tagVal(draft.unsignedEvent, 'd');
  assert(dTag === 'tapestry-my-dogs-abcd1234', `d tag must be "tapestry-my-dogs-abcd1234" (tapestry-<slugifyTitle>-<dTagSuffix>), got ${dTag}.`);
  assert(draft.dTag === dTag, `returned draft.dTag (${draft.dTag}) must equal the event's d tag (${dTag}).`);
  assert(draft.uuid === `39999:${TA}:${dTag}`, `returned uuid must be the a-tag coordinate 39999:<TA>:<dTag> (this is what the owner is navigated to), got ${draft.uuid}.`);
});

test('P3: the json tag carries tapestry {slug,title,description} (AC Compose / Publish shape)', async () => {
  const j = jsonTag((await buildOK()).unsignedEvent);
  assert(j && j.tapestry, 'json tag must contain a `tapestry` block.');
  assert(j.tapestry.title === 'My Dogs', `tapestry.title must be the entered title "My Dogs", got ${JSON.stringify(j.tapestry.title)}.`);
  assert(j.tapestry.description === 'good dogs', `tapestry.description must be the entered description, got ${JSON.stringify(j.tapestry.description)}.`);
  assert(j.tapestry.slug === 'my-dogs', `tapestry.slug must be the slugified title "my-dogs", got ${JSON.stringify(j.tapestry.slug)}.`);
});

test('P4: the graph block has exactly one node and one import PER selected member (AC Publish shape)', async () => {
  const g = jsonTag((await buildOK()).unsignedEvent).graph;
  assert(g && g.graphType === 'tapestry', `graph.graphType must be "tapestry", got ${g && g.graphType}.`);
  assert(Array.isArray(g.nodes) && g.nodes.length === MEMBERS.length, `graph.nodes must have one entry per selected concept (${MEMBERS.length}), got ${g.nodes && g.nodes.length}.`);
  assert(Array.isArray(g.imports) && g.imports.length === MEMBERS.length, `graph.imports must have one *-concept-graph import per selected concept (${MEMBERS.length}), got ${g.imports && g.imports.length}.`);
});

test('P5: each member node uses uuid=handle and slug=descriptiveSlug so it DEDUPS with its resolved import (AC Publish shape / ADR Decision 2-A)', async () => {
  const g = jsonTag((await buildOK()).unsignedEvent).graph;
  for (const m of MEMBERS) {
    const node = g.nodes.find((n) => n.uuid === m.handle);
    assert(node, `no graph node with uuid ${m.handle} (the concept header coordinate).`);
    assert(node.slug === m.descriptiveSlug,
      `node for ${m.shortSlug} must use slug="${m.descriptiveSlug}" (the concept-header word.slug) — NOT the short slug. ` +
      `composeGraph dedups by slug; matching the derived concept-graph's header-node slug is what makes each member render ` +
      `EXACTLY ONCE on the Exploration page (ADR Decision 2-A, verified live). Got slug="${node.slug}".`);
    assert(node.name === m.name, `node for ${m.shortSlug} must carry the display name "${m.name}", got ${JSON.stringify(node.name)}.`);
    const imp = g.imports.find((i) => i.uuid === `39999:${TA}:${m.conceptGraphSlug}-concept-graph`);
    assert(imp, `no import with uuid 39999:${TA}:${m.conceptGraphSlug}-concept-graph — the Exploration page resolves this to add the superset + spine.`);
  }
});

test('P6: members-only — relationshipTypes and relationships are empty (AC / Out-of-scope: no cross-concept integrations in v1)', async () => {
  const g = jsonTag((await buildOK()).unsignedEvent).graph;
  assert(Array.isArray(g.relationshipTypes) && g.relationshipTypes.length === 0, `graph.relationshipTypes must be [] in members-only v1, got ${JSON.stringify(g.relationshipTypes)}.`);
  assert(Array.isArray(g.relationships) && g.relationships.length === 0, `graph.relationships must be [] in members-only v1 (cross-concept integrations are a fast-follow), got ${JSON.stringify(g.relationships)}.`);
});

test('P7: buildTapestryDraft THROWS on an empty title (AC Validation & failure)', async () => {
  const { buildTapestryDraft } = await loadDraft();
  let threw = false;
  try { buildTapestryDraft({ title: '   ', description: '', members: MEMBERS, taPubkey: TA, dTagSuffix: 'x1' }); }
  catch (_e) { threw = true; }
  assert(threw, 'buildTapestryDraft must throw when the title is empty/whitespace — the wire shape must be guarded independent of the UI (nothing publishable without a title).');
});

test('P8: buildTapestryDraft THROWS on zero members (AC Validation & failure)', async () => {
  const { buildTapestryDraft } = await loadDraft();
  let threw = false;
  try { buildTapestryDraft({ title: 'Empty', description: '', members: [], taPubkey: TA, dTagSuffix: 'x2' }); }
  catch (_e) { threw = true; }
  assert(threw, 'buildTapestryDraft must throw when no concepts are selected — a tapestry with no members must never be published.');
});

test('P9: slugifyTitle lowercases, collapses non-alphanumerics to single dashes, trims (d-tag/slug contract)', async () => {
  const { slugifyTitle } = await loadDraft();
  assert(slugifyTitle('My Dogs') === 'my-dogs', `slugifyTitle("My Dogs") must be "my-dogs", got ${JSON.stringify(slugifyTitle('My Dogs'))}.`);
  const messy = slugifyTitle('  My Dogs & Cats!! ');
  assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(messy), `slugifyTitle must yield a clean kebab slug (no leading/trailing/double dashes, lowercase), got ${JSON.stringify(messy)}.`);
  assert(messy.includes('dogs') && messy.includes('cats'), `slug must preserve the words, got ${JSON.stringify(messy)}.`);
});

test('P10: the returned uuid is namespaced to the AUTHOR (signer), not always the TA (AC Round-trips — own-key redirect fix)', async () => {
  const { buildTapestryDraft } = await loadDraft();
  const OWNER = '1'.repeat(64);
  const own = buildTapestryDraft({ title: 'My Dogs', members: MEMBERS, taPubkey: TA, authorPubkey: OWNER, dTagSuffix: 'abcd1234' });
  assert(own.uuid === `39999:${OWNER}:tapestry-my-dogs-abcd1234`,
    `own-key uuid must be namespaced to the SIGNER — the own-key event is authored by the owner, so a TA-keyed uuid ` +
    `makes the post-create redirect 404 (readByUuid queries authors:[<TA>]). Got ${own.uuid}.`);
  // The z-tag and concept-graph imports stay TA-namespaced (concept handles are always TA), regardless of author.
  assert(tagVal(own.unsignedEvent, 'z') === `39998:${TA}:tapestry`, 'z-tag must remain TA-namespaced regardless of signer.');
  assert(jsonTag(own.unsignedEvent).graph.imports.every((i) => i.uuid.startsWith(`39999:${TA}:`)),
    'concept-graph imports must remain TA-namespaced regardless of signer.');
  // Default author is the TA (assistant path).
  const ta = buildTapestryDraft({ title: 'My Dogs', members: MEMBERS, taPubkey: TA, dTagSuffix: 'abcd1234' });
  assert(ta.uuid === `39999:${TA}:tapestry-my-dogs-abcd1234`, 'default authorPubkey must be the TA (assistant path).');
});

test('P11: the *-concept-graph import uuid is built from conceptGraphSlug (oSlugs.singular), not the header d-tag (dedup fix — nostr-event-tag)', async () => {
  const { buildTapestryDraft } = await loadDraft();
  // A real concept (verified live) whose concept-graph name diverges from its header d-tag:
  // d-tag 'nostr-event-tag' but oSlugs.singular 'nostr-event-tagging'.
  const divergent = { handle: `39998:${TA}:nostr-event-tag`, shortSlug: 'nostr-event-tag', conceptGraphSlug: 'nostr-event-tagging', descriptiveSlug: 'concept-header-for-the-concept-of-nostr-event-taggings', name: 'nostr event tag' };
  const g = jsonTag(buildTapestryDraft({ title: 'Tags', members: [divergent], taPubkey: TA, dTagSuffix: 'x9' }).unsignedEvent).graph;
  assert(g.imports.length === 1 && g.imports[0].uuid === `39999:${TA}:nostr-event-tagging-concept-graph`,
    `import must be built from conceptGraphSlug (nostr-event-tagging) so it resolves — the d-tag-based ` +
    `'39999:${TA}:nostr-event-tag-concept-graph' does not exist and would render the member isolated. Got ${g.imports[0]?.uuid}.`);
});

// ───────────────────────── Source sentinels — pinned by the spec, exercised by Playwright ─────────────────────────

test('S1: NewTapestry.jsx is owner-gated (hasAdminAccess) and wired to the create hook (AC Owner-gated)', () => {
  const src = readSafe(NEW_TAPESTRY);
  assert(src !== null, 'ui/src/pages/tapestries/NewTapestry.jsx missing — re-baseline.');
  assert(/hasAdminAccess/.test(src),
    'NewTapestry.jsx does not reference hasAdminAccess (AC Owner-gated). The page must read useAuth() and, for a ' +
    'non-owner/admin, render an owner-only notice instead of the form — same idiom as Layout.jsx / Dashboard.jsx ' +
    '(hasAdminAccess from ui/src/utils/auth.js).');
  assert(/useCreateTapestry/.test(src),
    'NewTapestry.jsx does not use the useCreateTapestry hook (ADR 0003 §Implementation). The form must drive ' +
    'concept loading + publish through the hook, not remain the inert placeholder.');
});

test('S2: NewTapestry.jsx offers the owner-enforced signing selector (Tapestry Assistant | my own key) (AC Signing selector)', () => {
  const src = readSafe(NEW_TAPESTRY);
  assert(src !== null, 'NewTapestry.jsx missing — S1 must pass first.');
  assert(/Tapestry Assistant/.test(src) && /own key/i.test(src),
    'NewTapestry.jsx does not present BOTH signing options ("Tapestry Assistant" and "my own key") (AC Signing selector). ' +
    'The owner picks the author identity per-create; per the ADR the selector defaults to Tapestry Assistant.');
  assert(/signAs/.test(src),
    'NewTapestry.jsx does not reference `signAs` (AC Signing selector). The chosen identity must flow to the publish ' +
    'call as signAs "assistant" | "client".');
});

test('S3: useCreateTapestry.js loads the picker from strfry concept headers and builds via the pure model (AC Compose / Publish shape)', () => {
  const src = readSafe(USE_CREATE_HOOK);
  assert(src !== null,
    'ui/src/pages/tapestries/useCreateTapestry.js missing — the Implementer must create the hook (ADR 0003 §Implementation): ' +
    'load concepts via queryRelay({kinds:[39998], authors:[taPubkey]}), and publish via buildTapestryDraft + the two signing paths.');
  assert(/queryRelay/.test(src) && /39998/.test(src),
    'useCreateTapestry.js does not scan kind-39998 concept headers via queryRelay (ADR Decision 1-A — strfry is the ' +
    'canonical picker source, not Neo4j /summaries).');
  assert(/buildTapestryDraft/.test(src),
    'useCreateTapestry.js does not call buildTapestryDraft (ADR 0003) — the wire shape must come from the pure model, not be re-inlined.');
});

test('S4: useCreateTapestry.js implements BOTH publish paths — NIP-07 own-key and TA via /api/strfry/publish (AC Signing selector)', () => {
  const src = readSafe(USE_CREATE_HOOK);
  assert(src !== null, 'useCreateTapestry.js missing — S3 must pass first.');
  assert(/signEvent|window\.nostr/.test(src),
    'useCreateTapestry.js does not sign via NIP-07 for the own-key path (AC Signing selector — author = owner). ' +
    'Build the unsigned event with pubkey=owner, then window.nostr.signEvent before publishing signAs:"client".');
  assert(/\/api\/strfry\/publish/.test(src) && /assistant/.test(src),
    'useCreateTapestry.js does not POST /api/strfry/publish with signAs:"assistant" for the TA path (AC Signing selector). ' +
    'The server signs as the TA (and 403s non-owners).');
});

test('S7: useCreateTapestry keys the own-key uuid to the SIGNER (passes authorPubkey: authorPk) so the redirect matches (AC Round-trips)', () => {
  const src = readSafe(USE_CREATE_HOOK);
  assert(src !== null, 'useCreateTapestry.js missing — S3 must pass first.');
  assert(/authorPubkey\s*:\s*authorPk/.test(src),
    'useCreateTapestry.js client (own-key) path does not pass `authorPubkey: authorPk` to buildTapestryDraft (review ' +
    'blocking fix). The own-key event is authored by the owner, so the returned uuid must be 39999:<ownerKey>:<dTag> — ' +
    'otherwise the post-create redirect 404s (useTapestryGraph.readByUuid queries authors:[<TA>]).');
});

test('S5: Index.jsx gates the "+ Create New Tapestry" affordance behind hasAdminAccess (AC Owner-gated)', () => {
  const src = readSafe(INDEX_JSX);
  assert(src !== null, 'ui/src/pages/tapestries/Index.jsx missing — re-baseline.');
  assert(/hasAdminAccess/.test(src),
    'Index.jsx does not gate the create button with hasAdminAccess (AC Owner-gated). Non-owner/admin visitors must not ' +
    'see a "+ Create New Tapestry" affordance in the directory. Wrap the button in a useAuth()+hasAdminAccess check.');
});

test('S6: NewTapestry.jsx no longer advertises the inert placeholder (AC — the page now functions)', () => {
  const src = readSafe(NEW_TAPESTRY);
  assert(src !== null, 'NewTapestry.jsx missing — re-baseline.');
  assert(!/Coming soon/i.test(src) && !/aria-disabled=["']true["']/.test(src),
    'NewTapestry.jsx still carries the placeholder markers ("Coming soon" / aria-disabled="true"). The story replaces the ' +
    'inert preview with a working, owner-gated authoring form.');
});

test('S8: concept keyword search covers the o* naming fields + the description, not just the name (operator request 2026-07-24)', () => {
  const hook = readSafe(USE_CREATE_HOOK);
  const page = readSafe(NEW_TAPESTRY);
  assert(hook !== null && page !== null, 'useCreateTapestry.js / NewTapestry.jsx missing — re-baseline.');
  // The picker parse builds a searchable blob spanning the header's naming forms + free-text description…
  assert(/searchText/.test(hook),
    'useCreateTapestry.js builds no searchText blob — the keyword search would still match only the display name.');
  assert(/description/.test(hook) && /oSlugs/.test(hook) && /oKeys/.test(hook),
    'searchText omits the concept-header description and/or the o* fields (oSlugs/oKeys/…). The operator asked to search ' +
    'the description (most important) plus the other naming fields, not just oNames.singular.');
  // …and the typeahead filters against that blob rather than name/shortSlug alone.
  assert(/searchText/.test(page),
    'NewTapestry.jsx results filter does not reference searchText — the expanded keyword search is not wired into the typeahead.');
});

// ───────────────────────── Regression guards — PASS pre AND post ─────────────────────────

test('R1: the shipped Exploration read-path model is untouched (composeGraph + inferNodeType still exported)', () => {
  const src = readSafe(GRAPH_MODEL);
  assert(src !== null, 'tapestryGraphModel.js missing — re-baseline.');
  assert(/export function composeGraph/.test(src) && /export function inferNodeType/.test(src),
    'R1: ui/src/pages/tapestries/tapestryGraphModel.js no longer exports composeGraph/inferNodeType. ADR 0003 makes NO ' +
    'change to the shipped read path — the create page produces data these already render. Do not refactor them here.');
});

test('R2: the directory query is intact (Index.jsx still reads kind-39999 elements by #z tapestry handle)', () => {
  const src = readSafe(INDEX_JSX);
  assert(src !== null, 'Index.jsx missing — re-baseline.');
  assert(/39999/.test(src) && /#z/.test(src) && /:tapestry/.test(src),
    'R2: Index.jsx no longer queries kind-39999 elements z-tagged to the tapestry concept. The owner-gate change to the ' +
    'create button must be ADDITIVE — the directory read (queryRelay kinds:[39999], #z 39998:<TA>:tapestry) must remain.');
});

test('R3: the server still refuses TA-signing from a non-owner session (AC Signing selector — server half; pre-existing gate preserved)', () => {
  const src = readSafe(PUBLISH_EVENT);
  assert(src !== null, 'src/api/strfry/commands/publishEvent.js missing — re-baseline.');
  const region = src.slice(src.indexOf("signAs === 'assistant'"), src.indexOf("signAs === 'assistant'") + 600);
  assert(region.length > 0, 'publishEvent.js no longer branches on signAs === "assistant".');
  assert(/isOwner\(req\)/.test(region) && /localTrusted/.test(region) && /403/.test(region),
    'R3: publishEvent.js no longer 403-gates assistant-signing to owner/localTrusted (AC "a TA-sign request from a ' +
    'non-owner session is refused by the server"). This gate (ADR security-auth-exposure/0002) is the server half of the ' +
    'signing AC — the create feature must NOT weaken it.');
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
