/**
 * Story graph-curation-ui #2 — restore the "Add Node as Element" page.
 * ADR graph-curation-ui/0002 — shared author-display util.
 * See engineering-team/stories/graph-curation-ui/2-restore-add-node-as-element-page.test-plan.md
 *
 * ADR 0002 chose Option B: extract the duplicated `authorDisplayName` out of
 * ui/src/pages/concepts/AddNodeAsElement.jsx and ui/src/pages/nodes/Index.jsx into a pure
 * ui/src/utils/authorDisplay.js, correct the useProfiles JSDoc, and rename the breadcrumb.
 *
 * TEST LEVEL — there is no jsdom in this repo (ADR graph-curation-ui/0001), so:
 *   U1..U5  EXECUTED against the pure ESM util via dynamic import (the pattern in
 *           event-page-ui.test.js). This is where the crash actually lives, so these are
 *           the real proof that the page can render. FAIL now: the util does not exist.
 *   S1..S4  SOURCE-LEVEL over the JSX/JS the ADR names. FAIL now: sources unchanged.
 *   R1..R5  REGRESSION sentinels over behavior the story must not break. PASS before
 *           AND after — they exist to catch the Implementer removing working behavior
 *           while restoring the page.
 *
 * There is deliberately NO live-API tier. A first draft posted to the endpoint to prove it
 * was alive; it returned 401, and an UNREGISTERED path under /api/normalize/ returns 401 too
 * (auth middleware runs before routing resolves). An unauthenticated Node test therefore
 * cannot distinguish "route exists" from "route does not exist" — the assertion would have
 * looked like coverage while proving nothing. R5 checks registration at the source instead.
 *
 * What these tests do NOT cover, stated plainly: nothing here mounts the React page or clicks
 * Confirm end to end. The flow is owner-gated and the automated browser has no NIP-07 signer,
 * so AC5 is covered by wiring sentinels (R4 client-side, R5 server-side) — NOT by a
 * click-through. Restoring the page is verified by hand on :7778 at review.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UTIL = path.join(ROOT, 'ui/src/utils/authorDisplay.js');
const ADD_NODE = path.join(ROOT, 'ui/src/pages/concepts/AddNodeAsElement.jsx');
const NODES_INDEX = path.join(ROOT, 'ui/src/pages/nodes/Index.jsx');
const REVIEW = path.join(ROOT, 'ui/src/pages/concepts/AddNodeReview.jsx');
const USE_PROFILES = path.join(ROOT, 'ui/src/hooks/useProfiles.js');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const NORMALIZE_API = path.join(ROOT, 'src/api/normalize/index.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }

const NOT_BUILT =
  'ui/src/utils/authorDisplay.js must export authorDisplayName({ profiles, pubkey, ownerPubkey, ' +
  'taPubkey, davePubkey }) — not implemented yet (ADR graph-curation-ui/0002, decision 1).';

async function util() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.authorDisplayName === 'function', NOT_BUILT);
  return mod.authorDisplayName;
}

// Throwaway non-secret fixture identities (test file only).
const OWNER = '1'.repeat(64);
const TA = '2'.repeat(64);
const DAVE = '3'.repeat(64);
const STRANGER = 'abcdef01' + '4'.repeat(56);

const IDS = { ownerPubkey: OWNER, taPubkey: TA, davePubkey: DAVE };

// ===========================================================================
// U — EXECUTED against the pure util. The crash class lives here.
// ===========================================================================

test('U1 (AC1): authorDisplayName reads a PLAIN OBJECT of profiles without throwing — the crash that killed the page', async () => {
  const fn = await util();
  // useProfiles returns useState({}) — a plain object, never a Map. Calling .get() on it
  // is what threw "TypeError: _?.get is not a function" and took out the whole route.
  const profiles = { [STRANGER]: { name: 'Alice' } };
  let out;
  try {
    out = fn({ profiles, pubkey: STRANGER, ...IDS });
  } catch (err) {
    throw new Error(
      `authorDisplayName must accept a plain object keyed by pubkey (that is what useProfiles ` +
      `returns — ui/src/hooks/useProfiles.js:12,74). It threw instead: ${err.message}`);
  }
  assert(typeof out === 'string' && out.includes('Alice'),
    `a profile with a name must render that name; got ${JSON.stringify(out)}.`);
});

test('U2 (AC1): missing, empty, or null profiles degrade to the short pubkey instead of throwing', async () => {
  const fn = await util();
  for (const profiles of [undefined, null, {}]) {
    let out;
    try {
      out = fn({ profiles, pubkey: STRANGER, ...IDS });
    } catch (err) {
      throw new Error(
        `profiles=${JSON.stringify(profiles)} must be tolerated — useProfiles returns {} before its ` +
        `fetch resolves, which is the first render of every page that uses it. It threw: ${err.message}`);
    }
    assert(typeof out === 'string' && out.length > 0,
      `profiles=${JSON.stringify(profiles)} must still yield a display string; got ${JSON.stringify(out)}.`);
    assert(out.includes(STRANGER.slice(0, 8)),
      `with no profile, fall back to the truncated pubkey; got ${JSON.stringify(out)}.`);
  }
});

test('U3 (AC2): owner / assistant / Dave each get their badge; a stranger gets none', async () => {
  const fn = await util();
  const owner = fn({ profiles: {}, pubkey: OWNER, ...IDS });
  const ta = fn({ profiles: {}, pubkey: TA, ...IDS });
  const dave = fn({ profiles: {}, pubkey: DAVE, ...IDS });
  const other = fn({ profiles: {}, pubkey: STRANGER, ...IDS });

  assert(owner.startsWith('👑'), `the owner pubkey must be badged 👑; got ${JSON.stringify(owner)}.`);
  assert(ta.startsWith('🤖'), `the Tapestry Assistant pubkey must be badged 🤖; got ${JSON.stringify(ta)}.`);
  assert(dave.startsWith('🧑‍💻'), `Dave's pubkey must be badged 🧑‍💻; got ${JSON.stringify(dave)}.`);
  assert(!/^(👑|🤖|🧑‍💻)/.test(other), `an unrecognised pubkey must carry no badge; got ${JSON.stringify(other)}.`);
});

test('U4 (AC2): each identity falls back to its role label when no profile name is known, and uses display_name when name is absent', async () => {
  const fn = await util();
  // Unnamed → role label + truncated pubkey.
  assert(/Owner/.test(fn({ profiles: {}, pubkey: OWNER, ...IDS })),
    'an unnamed owner must read "👑 Owner (<short>…)".');
  assert(/Assistant/.test(fn({ profiles: {}, pubkey: TA, ...IDS })),
    'an unnamed assistant must read "🤖 Assistant (<short>…)".');
  assert(/Dave/.test(fn({ profiles: {}, pubkey: DAVE, ...IDS })),
    'an unnamed Dave must read "🧑‍💻 Dave (<short>…)".');

  // Named → the name replaces the role label entirely for badged identities.
  const namedOwner = fn({ profiles: { [OWNER]: { name: 'Nous' } }, pubkey: OWNER, ...IDS });
  assert(namedOwner.includes('Nous') && !namedOwner.includes('Owner'),
    `a named owner shows the name, not the role label; got ${JSON.stringify(namedOwner)}.`);

  // display_name is the documented second choice after name.
  const viaDisplay = fn({ profiles: { [STRANGER]: { display_name: 'Bob' } }, pubkey: STRANGER, ...IDS });
  assert(viaDisplay.includes('Bob'),
    `display_name must be used when name is absent; got ${JSON.stringify(viaDisplay)}.`);
  const namePreferred = fn({ profiles: { [STRANGER]: { name: 'Alice', display_name: 'Bob' } }, pubkey: STRANGER, ...IDS });
  assert(namePreferred.includes('Alice') && !namePreferred.includes('Bob'),
    `name must win over display_name; got ${JSON.stringify(namePreferred)}.`);
});

test('U5 (AC2): the pubkey is truncated to 8 characters plus an ellipsis, never rendered in full', async () => {
  const fn = await util();
  const out = fn({ profiles: {}, pubkey: STRANGER, ...IDS });
  assert(out.includes(STRANGER.slice(0, 8) + '…'),
    `expected the 8-char prefix followed by "…"; got ${JSON.stringify(out)}.`);
  assert(!out.includes(STRANGER),
    `the full 64-char pubkey must never be rendered in the dropdown; got ${JSON.stringify(out)}.`);
});

// ===========================================================================
// S — SOURCE-LEVEL over the files ADR 0002 names.
// ===========================================================================

test('S1 (AC1): AddNodeAsElement consumes the shared util and no longer carries its own copy or a .get() profile read', async () => {
  const src = safeRead(ADD_NODE);
  assert(src.length > 0, 'ui/src/pages/concepts/AddNodeAsElement.jsx is missing — unexpected.');
  assert(/authorDisplay/.test(src) && /import\s*\{[^}]*authorDisplayName[^}]*\}\s*from/.test(src),
    'AddNodeAsElement.jsx must import authorDisplayName from the shared util (ADR 0002 decision 2) — ' +
    'the util being correct does not help while the page keeps its own broken copy.');
  assert(!/function\s+authorDisplayName\s*\(/.test(src),
    'AddNodeAsElement.jsx must no longer DEFINE authorDisplayName — the duplication is the defect ' +
    '(ADR 0002 "The duplication"), and deleting one copy is the fix.');
  assert(!/Profiles\s*\??\.\s*get\s*\(/.test(src),
    'no profiles value may be read with .get() — useProfiles returns a plain object, not a Map ' +
    '(ui/src/hooks/useProfiles.js:12,74). This is the exact line that threw.');
});

test('S2 (ADR 0002 consequence): nodes/Index adopts the same util — the second copy goes too', async () => {
  const src = safeRead(NODES_INDEX);
  assert(src.length > 0, 'ui/src/pages/nodes/Index.jsx is missing — unexpected.');
  assert(/import\s*\{[^}]*authorDisplayName[^}]*\}\s*from/.test(src),
    'nodes/Index.jsx must import the shared authorDisplayName (ADR 0002 decision 2). Wiring only the ' +
    'broken page would leave the divergence that caused this bug.');
  assert(!/function\s+authorDisplayName\s*\(/.test(src),
    'nodes/Index.jsx must no longer define its own authorDisplayName.');
});

test('S3 (AC6): the breadcrumb for the add-node route reads "Add Node as Element"', async () => {
  const src = safeRead(APP_JSX);
  const route = src.split('\n').find(l => /path:\s*'elements\/add-node'/.test(l)) || '';
  assert(route.length > 0, "ui/src/App.jsx must still register the 'elements/add-node' route.");
  assert(/crumb:\s*'Add Node as Element'/.test(route),
    `the crumb must read 'Add Node as Element' — "Add Node" reads as "add a node to Neo4j", the ` +
    `opposite of what the page does (story AC6). Route line is currently: ${route.trim()}`);
  assert(/path:\s*'elements\/add-node'/.test(route),
    'the route PATH stays elements/add-node — ADR 0002 explicitly does not rename it (four inbound links).');
});

test('S4 (ADR 0002 decision 3): the useProfiles docstring no longer promises a Map', async () => {
  const src = safeRead(USE_PROFILES);
  assert(src.length > 0, 'ui/src/hooks/useProfiles.js is missing — unexpected.');
  const doc = src.slice(0, src.indexOf('export default'));
  assert(!/Returns\s+Map</.test(doc),
    'the JSDoc must stop claiming Map<pubkey, ...> — it returns useState({}), a plain object. ' +
    'That false docstring is what invited the bad copy-paste (ADR 0002 "The contract question").');
  assert(/object/i.test(doc),
    'the corrected JSDoc should say what it actually returns: a plain object keyed by pubkey.');
});

// ===========================================================================
// R — REGRESSION sentinels. PASS before and after; they guard working behavior.
// ===========================================================================

test('R1 (AC3): the candidate query still narrows by Neo4j label', async () => {
  const src = safeRead(ADD_NODE);
  assert(/labelFilter/.test(src) && /n:\$\{labelFilter\}/.test(src),
    'the label filter must still contribute a label predicate to the candidate Cypher.');
});

test('R2 (AC2): the candidate query still narrows by author pubkey', async () => {
  const src = safeRead(ADD_NODE);
  assert(/authorFilter/.test(src) && /n\.pubkey\s*=/.test(src),
    'the author filter must still contribute an n.pubkey predicate to the candidate Cypher — ' +
    'this is what excludes foreign community-reference headers from a curation pass.');
});

test('R3 (AC4): nodes already elements of this concept are still identified for marking', async () => {
  const src = safeRead(ADD_NODE);
  assert(/existingElements/.test(src) && /IS_THE_CONCEPT_FOR/.test(src) && /HAS_ELEMENT/.test(src),
    'the page must still query this concept’s existing elements.');
  assert(/existingUuids/.test(src),
    'the existing-element uuids must still be collected so already-added candidates can be marked.');
});

test('R4 (AC5): the review step still wires Confirm to the add-node-as-element endpoint', async () => {
  const src = safeRead(REVIEW);
  assert(/addNodeAsElement/.test(src),
    'AddNodeReview.jsx must still call addNodeAsElement — ADR 0002 makes no server-side change.');
  assert(/conceptUuid/.test(src) && /nodeUuid/.test(src),
    'the confirm call must still pass { conceptUuid, nodeUuid }.');
});

test('R5 (AC5): the add-node-as-element route is still registered server-side', async () => {
  const src = safeRead(NORMALIZE_API);
  assert(/app\.post\(\s*['"]\/api\/normalize\/add-node-as-element['"]/.test(src),
    'src/api/normalize/index.js must still register POST /api/normalize/add-node-as-element — ' +
    'ADR 0002 makes no server-side change, so this endpoint must survive the story untouched.');
  assert(/async\s+function\s+handleAddNodeAsElement\s*\(/.test(src),
    'its handler must still exist.');
});

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
  console.log(`\nadd-node-as-element-restore: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
