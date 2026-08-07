/**
 * Story 8 (epic: second-brain) — The brain survives: export and restore.
 *
 * Story: engineering-team/stories/second-brain/8-the-brain-survives.md
 * ADR:   engineering-team/decisions/second-brain/0008-the-brain-survives.md
 *
 * Test classes (ADR "Test-class guidance", per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the two new pure cores:
 *     src/lib/brain/export.js (familyEntries' parser-validated membership with
 *     RAW-section fidelity — unknown fields survive; canonical sort
 *     determinism; the assembleExport envelope; ONE contentEquivalent
 *     definition serving AC2 and AC4; validateArtifact's named shape errors)
 *     and src/lib/brain/restore.js (planRestore's goal-collision triple —
 *     name / slug / derived-d-tag, each alone dispositive; per-family record
 *     slug collisions; all-checks-before-any-write refusals that list EVERY
 *     collision; the ordered verbatim mint plan) — all over SYNTHETIC rows.
 *
 *   S-class (source assertions, stack-free) — GET /api/brain/export with the
 *     in-handler gate + dated attachment filename; the brain module's TENTH
 *     require re-pinning the import allowlist; restore-brain and
 *     record-restore-drill gate-first + mutexed with named refusals; the mint
 *     discipline (restored goals name-derived, restored records nonce'd, NO
 *     regenerateJson anywhere on the new paths); ensureGoalConcept closing the
 *     ADR 0001 bootstrap gap; no-egress over every new path including
 *     scripts/brain-drill.sh (loopback-only); the d12 strings verbatim in
 *     Goals.jsx; ui/normalize untouchables; no 64-hex anywhere touched.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the export
 *     envelope live (dated, five families, identity-free, attachment headers);
 *     AC4 live (export twice → contentEquivalent); export is read-only; the
 *     restore round-trip (a cross-linked sentinel artifact restores beside the
 *     live content: decomposition position, pointer, work/proposal/decision/
 *     signal entries, the decision CLOSING its proposal in the open queue, and
 *     the re-export deep-equal to the artifact — capturedOn NOT restamped,
 *     out-of-contract fields intact); collision refusals that write nothing,
 *     including the protection row (the live brain's own export refuses
 *     against the live brain); the drill-journal producer round-trip; caller
 *     classes; hygiene green throughout.
 *
 *   R-class (regression sentinels, stack-free, pass before AND after).
 *
 * Pass-by-design sentinels (documented, story-2→7 review precedent) that pass
 * BEFORE the feature lands: S11 (ui untouchables carry no story tokens — true
 * before and after), S12 (brain module read-only today), the guarded halves of
 * S9 (no 64-hex in files that already exist), R1, R2, H7's POST halves (the
 * middleware default-denies unauthenticated mutations BEFORE routing — 401
 * before and after), H8 (hygiene green). Everything else FAILS until the
 * feature lands (the cores are missing, the routes 404, the drill script does
 * not exist). H tests SKIP when the stack is absent (CI's stack-free job).
 *
 * Fixture hygiene — STATE-FREE discovery teardown (OPEN.md row 94's fix,
 * adopted for this suite): fixture elements are DISCOVERED by a sentinel
 * json-CONTAINS query ('harness-survive'), never reconstructed from
 * process-local arrays — so a crashed prior run's strays are swept by the
 * next pre-clean instead of stranding "already exists" cascades. Teardown:
 * discover uuids → strfry delete by each d-tag + count-0 verify → Neo4j
 * DETACH DELETE elements+tags → value-scoped orphan-tag sweep → discovery
 * count-0 verify. Pre-clean runs the same routine best-effort. A teardown
 * failure is a loud suite failure. Runtime-created CONCEPTS persist (only
 * fixture ELEMENTS are torn down); the suite is idempotent across runs.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EXPORT_CORE = path.join(ROOT, 'src/lib/brain/export.js');
const RESTORE_CORE = path.join(ROOT, 'src/lib/brain/restore.js');
const GOALS_CORE = path.join(ROOT, 'src/lib/brain/goals.js');
const SIGNALS_CORE = path.join(ROOT, 'src/lib/brain/signals.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const RELATIONSHIPS = path.join(ROOT, 'src/api/normalize/relationships.js');
const PROBE = path.join(ROOT, 'src/api/normalize/probe.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const GOALS_JSX = path.join(ROOT, 'ui/src/pages/brain/Goals.jsx');
const GOAL_DETAIL_JSX = path.join(ROOT, 'ui/src/pages/brain/GoalDetail.jsx');
const PROPOSALS_JSX = path.join(ROOT, 'ui/src/pages/brain/Proposals.jsx');
const IO_EXPORT_PAGE = path.join(ROOT, 'ui/src/pages/io/ExportPage.jsx');
const DRILL_SCRIPT = path.join(ROOT, 'scripts/brain-drill.sh');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// The artifact format (ADR 0008 d1) and the drill-journal concept (d9).
const ARTIFACT_FORMAT = 'tapestry-brain-export';
const DRILL_CONCEPT_SLUG = 'tapestry-restore-drill';
const FAMILY_KEYS = ['goals', 'resources', 'workRecords', 'proposals', 'signals'];

// The ratified owner-facing strings (ADR 0008 d12 — operator, 2026-07-24). Verbatim.
const BUTTON_LABEL = 'Export brain.';
const EXPORT_CONFIRM = 'Exported — saved to this machine.';
const EXPORT_FAIL = "Couldn't export — nothing was saved. Try again.";
const DRILL_SENTENCE = 'Restore drill complete — your brain matches the export.';

/* ── H fixtures — one cross-linked sentinel artifact ───────────────────────
 * Every section carries the 'harness-survive' sentinel in its slug/name, so
 * the state-free discovery teardown (json CONTAINS) catches all of them.
 * The child goal is VIABLE (deliverable + boundary), carries a parent (the
 * decomposition position), a back-dated capturedOn (the restamp proof), and
 * one OUT-OF-CONTRACT field (the raw-fidelity proof). The record families
 * cross-link by slug/locator exactly as the live producers write them. */
const SENTINEL = 'harness-survive';
const FIX_PARENT_NAME = 'harness survive parent goal';
const FIX_PARENT_SLUG = 'harness-survive-parent';
const FIX_CHILD_NAME = 'harness survive child goal';
const FIX_CHILD_SLUG = 'harness-survive-child';
const FIX_LOCATOR = 'https://example.com/harness-survive-resource';
const FIX_CAPTURED_ON = '2026-07-01';

const FIX_PARENT_SECTION = {
  name: FIX_PARENT_NAME, slug: FIX_PARENT_SLUG,
  description: 'a harness-survive parent goal for the restore round-trip',
  origin: 'harness test, in conversation', capturedOn: FIX_CAPTURED_ON,
};
const FIX_CHILD_SECTION = {
  name: FIX_CHILD_NAME, slug: FIX_CHILD_SLUG,
  description: 'a harness-survive child goal for the restore round-trip',
  origin: 'harness test, in conversation', capturedOn: FIX_CAPTURED_ON,
  deliverable: 'a harness-survive deliverable', boundary: 'stays inside the harness-survive fixtures',
  parent: FIX_PARENT_SLUG,
  harnessExtra: 'harness-survive out-of-contract field (raw fidelity proof)',
};
const FIX_RESOURCE_SECTION = {
  name: 'harness survive resource', slug: 'harness-survive-res-1',
  description: 'a harness-survive pointer', locatorKind: 'web', locator: FIX_LOCATOR,
  goal: FIX_CHILD_SLUG, whyKept: 'harness-survive keep note', keywords: ['harness-survive'],
  notedOn: '2026-07-02', lastVerified: '2026-07-02',
};
const FIX_WORK_SECTION = {
  name: 'worked: harness-survive-child', slug: 'harness-survive-work-1', type: 'worked',
  goal: FIX_CHILD_SLUG, session: 'harness survive session',
  summary: 'harness-survive worked the child piece', questions: [], produced: [FIX_LOCATOR],
  happenedOn: '2026-07-02',
};
const FIX_PROPOSAL_SECTION = {
  name: 'proposed: harness-survive-child', slug: 'harness-survive-prop-1',
  summary: 'harness-survive why-now', type: 'proposed', goal: FIX_CHILD_SLUG,
  whyNow: 'harness-survive why-now',
  passedOver: [{ goal: FIX_PARENT_SLUG, whyNot: 'harness-survive why-not' }],
  happenedOn: '2026-07-03',
};
const FIX_DECISION_SECTION = {
  name: 'approved: harness-survive-child', slug: 'harness-survive-dec-1',
  summary: 'harness-survive approved', type: 'approved', goal: FIX_CHILD_SLUG,
  proposalId: 'harness-survive-prop-1', happenedOn: '2026-07-03',
};
const FIX_SIGNAL_SECTION = {
  name: 'preferred: harness-survive-child over harness-survive-parent',
  slug: 'harness-survive-sig-1',
  description: 'chose "harness survive child goal" over "harness survive parent goal"',
  prefers: FIX_CHILD_SLUG, over: FIX_PARENT_SLUG,
  reason: 'harness-survive reason: the smaller piece first',
  judgedBy: 'owner', judgedOn: '2026-07-03', framing: 'solve-one-today',
};

function fixtureArtifact() {
  return {
    format: ARTIFACT_FORMAT, version: 1, takenOn: '2026-07-04',
    content: {
      goals: [
        { name: FIX_PARENT_NAME, section: { ...FIX_PARENT_SECTION } },
        { name: FIX_CHILD_NAME, section: { ...FIX_CHILD_SECTION } },
      ],
      resources: [{ name: FIX_RESOURCE_SECTION.name, section: { ...FIX_RESOURCE_SECTION } }],
      workRecords: [{ name: FIX_WORK_SECTION.name, section: { ...FIX_WORK_SECTION } }],
      proposals: [
        { name: FIX_PROPOSAL_SECTION.name, section: { ...FIX_PROPOSAL_SECTION } },
        { name: FIX_DECISION_SECTION.name, section: { ...FIX_DECISION_SECTION } },
      ],
      signals: [{ name: FIX_SIGNAL_SECTION.name, section: { ...FIX_SIGNAL_SECTION } }],
    },
  };
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 260) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}
// Canonical deep-compare (key-order-insensitive) for the verbatim proofs.
function sortedStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(sortedStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + sortedStringify(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

function loadExportCore() {
  if (!fs.existsSync(EXPORT_CORE)) {
    throw new Error('src/lib/brain/export.js does not exist yet — the export core (ADR 0008 d4) is not implemented.');
  }
  try { return require(EXPORT_CORE); }
  catch (e) { throw new Error(`src/lib/brain/export.js failed to require: ${e.message}`); }
}
function loadRestoreCore() {
  if (!fs.existsSync(RESTORE_CORE)) {
    throw new Error('src/lib/brain/restore.js does not exist yet — the restore-plan core (ADR 0008 d5) is not implemented.');
  }
  try { return require(RESTORE_CORE); }
  catch (e) { throw new Error(`src/lib/brain/restore.js failed to require: ${e.message}`); }
}

// Extract a named function's body from a source blob (S-class regions).
function fnBody(src, name) {
  const i = src.indexOf(`function ${name}`);
  if (i === -1) return '';
  const after = src.slice(i + 10);
  const next = after.search(/\n(?:async )?function /);
  return next === -1 ? src.slice(i) : src.slice(i, i + 10 + next);
}

/* ── synthetic fixtures (U-class) ─────────────────────────────────────── */

// A parsed existing-goal record (what planRestore's `existing.goals` holds).
function existingGoal(over = {}) {
  return {
    uuid: '39999:synthetic-ta:existing-dtag', name: 'Existing Goal', slug: 'existing-goal',
    statement: 'an existing goal', origin: 'test', capturedOn: '2026-06-01',
    createdAt: 1783000000, deliverable: null, boundary: null, parent: null, ...over,
  };
}
function existingSignal(over = {}) {
  return {
    uuid: '39999:synthetic-ta:sig-dtag', name: 'preferred: a over b', slug: 'existing-sig-1',
    description: 'x', prefers: 'a', over: 'b', reason: null,
    judgedBy: 'owner', judgedOn: '2026-06-01', framing: 'solve-one-today', createdAt: 1783000001, ...over,
  };
}
const NO_EXISTING = { goals: [], resources: [], workRecords: [], proposals: [], signals: [] };
const syntheticDerive = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-');

/* ── live-stack helpers (H-class; the house pattern) ──────────────────── */

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 20000 });
}
function loopbackGetJson(pathname) {
  const out = dockerCurl(['-s', '-m', '15', `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback GET ${pathname} did not return JSON: ${short(out)}`); }
}
function loopbackGetRaw(pathname) {
  return dockerCurl(['-s', '-i', '-m', '15', `${CONTAINER_BASE}${pathname}`]);
}
function loopbackPostJson(pathname, body) {
  const out = dockerCurl(['-s', '-m', '30', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback POST ${pathname} did not return JSON: ${short(out)}`); }
}

let reachable = null;
async function stackAvailable() {
  if (reachable !== null) return reachable;
  let host = false;
  try {
    const r = await fetch(`${HOST_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    host = r.ok;
  } catch { host = false; }
  let loopback = false;
  try {
    const out = dockerCurl(['-s', '-m', '3', `${CONTAINER_BASE}/api/auth/user-classification`]);
    loopback = /"success"\s*:\s*true/.test(out);
  } catch { loopback = false; }
  reachable = host && loopback;
  return reachable;
}

let taPubkey = null;
function getTaPubkey() {
  if (taPubkey) return taPubkey;
  const r = loopbackGetJson('/api/assistant/pubkey');
  assert(r && r.success && /^[0-9a-f]{64}$/.test(r.pubkey || ''),
    `could not resolve the runtime TA pubkey via /api/assistant/pubkey (got ${short(r)}).`);
  taPubkey = r.pubkey;
  return taPubkey;
}

function getExport() { return loopbackGetJson('/api/brain/export'); }
function getGoalDetail(slug) { return loopbackGetJson(`/api/brain/goals/${encodeURIComponent(slug)}`); }
function getProposals() { return loopbackGetJson('/api/brain/proposals'); }
function getGoalsList() { return loopbackGetJson('/api/brain/goals'); }
function restoreBrain(artifact) { return loopbackPostJson('/api/normalize/restore-brain', { artifact }); }

/* ── H fixture bookkeeping — STATE-FREE discovery (OPEN.md row 94) ─────── */

let fixturesArmed = false;
let teardownFailure = null;

function dTagFromUuid(uuid) { return String(uuid).split(':').slice(2).join(':'); }

// Discover EVERY fixture element live by the sentinel — never from local state.
function discoverFixtureUuids() {
  const r = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (e:NostrEvent)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
             WHERE e.kind = 39999 AND t.value CONTAINS $sentinel
             RETURN DISTINCT e.uuid AS uuid`,
    params: { sentinel: SENTINEL },
  });
  const rows = (r && (r.data || r.rows)) || [];
  return rows.map((row) => row.uuid).filter(Boolean);
}

function deleteFixturesFromStrfry(dtags) {
  for (const dTag of dtags) {
    const scan = loopbackGetJson(
      `/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify({ kinds: [39999], '#d': [dTag] }))}`);
    const events = Array.isArray(scan?.events) ? scan.events : (Array.isArray(scan) ? scan : []);
    for (const ev of events) {
      if (ev && ev.id) {
        cp.execFileSync('docker', ['exec', CONTAINER, 'strfry', 'delete', `--filter={"ids":["${ev.id}"]}`],
          { encoding: 'utf8', timeout: 15000 });
      }
    }
  }
  for (const dTag of dtags) {
    const verify = loopbackGetJson(
      `/api/strfry/scan/count?filter=${encodeURIComponent(JSON.stringify({ kinds: [39999], '#d': [dTag] }))}`);
    assert(verify && verify.count === 0,
      `strfry still holds ${verify && verify.count} fixture event(s) for d-tag ${dTag} after teardown. ` +
      `Delete manually: docker exec ${CONTAINER} strfry delete --filter='{"kinds":[39999],"#d":["${dTag}"]}'`);
  }
}

function deleteFixturesFromNeo4j(uuids, dtags) {
  const r1 = loopbackPostJson('/api/neo4j/query', {
    cypher: 'UNWIND $uuids AS u MATCH (e:NostrEvent {uuid: u}) OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag) DETACH DELETE e, t',
    params: { uuids },
  });
  assert(r1 && r1.success !== false, `fixture Neo4j teardown failed: ${short(r1)}`);
  // Orphan-tag sweep, value-scoped to the sentinel family and the tracked d-tags.
  // Never by z value (the z value is a concept header uuid, shared with real concepts).
  const r2 = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (t:NostrEventTag) WHERE (t.type = 'd' AND t.value IN $dtags)
             OR (t.type = 'json' AND t.value CONTAINS $sentinel)
             DETACH DELETE t`,
    params: { dtags, sentinel: SENTINEL },
  });
  assert(r2 && r2.success !== false, `fixture orphan-tag sweep failed: ${short(r2)}`);
}

function sweepFixtures({ loud }) {
  const uuids = discoverFixtureUuids();
  const dtags = [...new Set(uuids.map(dTagFromUuid).filter(Boolean))];
  if (loud) {
    deleteFixturesFromStrfry(dtags);
    deleteFixturesFromNeo4j(uuids, dtags);
    const remaining = discoverFixtureUuids();
    assert(remaining.length === 0,
      `fixture teardown left ${remaining.length} sentinel element(s) behind: ${short(remaining, 300)}`);
  } else {
    try { deleteFixturesFromStrfry(dtags); } catch { /* best-effort */ }
    try { deleteFixturesFromNeo4j(uuids, dtags); } catch { /* best-effort */ }
  }
}
function preCleanFixtures() { sweepFixtures({ loud: false }); }
function teardownFixtures() {
  if (!fixturesArmed) return;
  try { sweepFixtures({ loud: true }); fixturesArmed = false; }
  catch (e) { teardownFailure = e.message; }
}

/* ══════════════ U-class — the pure export core (EXECUTED) ══════════════ */

test('U1 (contract): export core exports familyEntries, canonicalContent, assembleExport, contentEquivalent, validateArtifact — and requires NOTHING', () => {
  const core = loadExportCore();
  for (const fn of ['familyEntries', 'canonicalContent', 'assembleExport', 'contentEquivalent', 'validateArtifact']) {
    assert(typeof core[fn] === 'function',
      `src/lib/brain/export.js must export ${fn}() (ADR 0008 d4) — the artifact format's single owner.`);
  }
  const src = safeRead(EXPORT_CORE);
  assert(!/require\s*\(/.test(src),
    'src/lib/brain/export.js must require NOTHING — the pure core is dependency-free (ADR 0008 d4).');
});

test('U2 (AC1 — membership + raw fidelity): familyEntries keeps parser-valid rows as {name, section} with the RAW section verbatim; parser-null rows are excluded; nothing else rides along', () => {
  const core = loadExportCore();
  const { parseGoalRow } = require(GOALS_CORE);
  const rawSection = {
    name: 'Goal With Extras', slug: 'goal-with-extras', description: 'has an out-of-contract field',
    origin: 'test', capturedOn: '2026-07-01', parent: 'some-parent',
    futureField: 'the parser does not know this field',
  };
  const rows = [
    { uuid: '39999:ta:a', name: 'Goal With Extras', createdAt: 1, json: JSON.stringify({ tapestryOwnerGoal: rawSection }) },
    { uuid: '39999:ta:b', name: 'not a goal', createdAt: 2, json: JSON.stringify({ workRecord: { slug: 'w' } }) },
    { uuid: '39999:ta:c', name: 'malformed', createdAt: 3, json: '{not json' },
  ];
  const entries = core.familyEntries(rows, 'tapestryOwnerGoal', parseGoalRow);
  assert(Array.isArray(entries) && entries.length === 1,
    `familyEntries must keep exactly the parser-valid rows (1 of 3 here — membership is the parser's call, ADR 0008 d1); got ${short(entries && entries.length)}.`);
  const e = entries[0];
  assert(e && e.name === 'Goal With Extras',
    `each entry carries the element's event name (got ${short(e && e.name)}).`);
  assert(sortedStringify(e.section) === sortedStringify(rawSection),
    `the section must be the RAW stored object VERBATIM — including fields the parser does not know ` +
    `(raw fidelity is the protection artifact's contract, ADR 0008 d1/Option B rejection). Got ${short(e.section, 400)}.`);
  assert(Object.keys(e).sort().join(',') === 'name,section',
    `an entry is exactly {name, section} — no uuid, no createdAt, no pubkey (the artifact is identity-free, §5.9); got keys [${Object.keys(e)}].`);
});

test('U3 (AC4 — determinism): assembleExport builds the versioned envelope, and shuffled input serializes IDENTICALLY (canonical sort)', () => {
  const core = loadExportCore();
  const g1 = { name: 'Alpha', section: { name: 'Alpha', slug: 'alpha', description: 'a' } };
  const g2 = { name: 'Beta', section: { name: 'Beta', slug: 'beta', description: 'b' } };
  const s1 = { name: 'sig one', section: { name: 'sig one', slug: 'sig-1', prefers: 'alpha', over: 'beta' } };
  const families = { goals: [g1, g2], resources: [], workRecords: [], proposals: [], signals: [s1] };
  const shuffled = { goals: [g2, g1], resources: [], workRecords: [], proposals: [], signals: [s1] };
  const a = core.assembleExport(families, '2026-07-24');
  assert(a && a.format === ARTIFACT_FORMAT && a.version === 1,
    `assembleExport must stamp {format: '${ARTIFACT_FORMAT}', version: 1} (ADR 0008 d1); got ${short(a)}.`);
  assert(a.takenOn === '2026-07-24', `the artifact carries its taken-on date (AC1 — a DATED artifact); got ${short(a.takenOn)}.`);
  assert(a.content && FAMILY_KEYS.every((k) => Array.isArray(a.content[k])),
    `the content must carry all five family arrays (${FAMILY_KEYS.join(', ')}); got ${short(a.content && Object.keys(a.content))}.`);
  const b = core.assembleExport(shuffled, '2026-07-24');
  assert(JSON.stringify(a) === JSON.stringify(b),
    'assembleExport must serialize IDENTICALLY regardless of input order — canonical sort makes AC4 mechanical (ADR 0008 d1).');
});

test('U4 (AC2/AC4 — the ONE equivalence definition): contentEquivalent is reflexive, order-insensitive, ignores takenOn, and detects a one-field change', () => {
  const core = loadExportCore();
  const mk = (takenOn, goals) => core.assembleExport(
    { goals, resources: [], workRecords: [], proposals: [], signals: [] }, takenOn);
  const g1 = { name: 'Alpha', section: { name: 'Alpha', slug: 'alpha', description: 'a' } };
  const g2 = { name: 'Beta', section: { name: 'Beta', slug: 'beta', description: 'b' } };
  const a = mk('2026-07-24', [g1, g2]);
  const b = mk('2026-07-25', [g2, g1]); // different day, different order — same content
  assert(core.contentEquivalent(a, a) === true, 'contentEquivalent must be reflexive.');
  assert(core.contentEquivalent(a, b) === true,
    'contentEquivalent must ignore the envelope taken-on date and input order — the CONTENT is what is compared (ADR 0008 d2; the story\'s AC4 wording is load-bearing).');
  const changed = mk('2026-07-24', [g1, { name: 'Beta', section: { name: 'Beta', slug: 'beta', description: 'CHANGED' } }]);
  assert(core.contentEquivalent(a, changed) === false,
    'contentEquivalent must detect a single changed content field — equivalence is deep, not shape-level.');
});

test('U5 (restore input safety): validateArtifact answers ok for a well-formed artifact and a NAMED plain-words error for each shape violation', () => {
  const core = loadExportCore();
  const good = fixtureArtifact();
  const ok = core.validateArtifact(good);
  assert(ok && ok.ok === true, `a well-formed artifact must validate (got ${short(ok)}).`);
  const cases = [
    ['wrong format', { ...good, format: 'something-else' }],
    ['wrong version', { ...good, version: 99 }],
    ['missing content', { format: ARTIFACT_FORMAT, version: 1, takenOn: '2026-07-04' }],
    ['missing family key', { ...good, content: { goals: [] } }],
    ['entry without a name', { ...good, content: { ...good.content, goals: [{ section: { slug: 'x' } }] } }],
    ['section not an object', { ...good, content: { ...good.content, goals: [{ name: 'x', section: 'nope' }] } }],
    ['section without a slug', { ...good, content: { ...good.content, goals: [{ name: 'x', section: { name: 'x' } }] } }],
  ];
  for (const [label, bad] of cases) {
    const r = core.validateArtifact(bad);
    assert(r && r.ok === false && typeof r.error === 'string' && r.error.length > 0,
      `validateArtifact must refuse '${label}' with {ok:false, error:'<plain words>'} (ADR 0008 d4); got ${short(r)}.`);
  }
});

/* ══════════════ U-class — the pure restore-plan core (EXECUTED) ══════════════ */

test('U6 (the goal-collision triple): planRestore refuses goal-collides when an artifact goal matches an existing goal by NAME, by SLUG, or by derived D-TAG — each alone; ALL collisions are listed; and the core requires NOTHING', () => {
  const core = loadRestoreCore();
  const src = safeRead(RESTORE_CORE);
  assert(!/require\s*\(/.test(src),
    'src/lib/brain/restore.js must require NOTHING — the pure core is dependency-free (ADR 0008 d5).');
  const existing = { ...NO_EXISTING, goals: [existingGoal()] };
  const mkArtifact = (goalEntries) => ({
    format: ARTIFACT_FORMAT, version: 1, takenOn: '2026-07-04',
    content: { goals: goalEntries, resources: [], workRecords: [], proposals: [], signals: [] },
  });
  const byName = mkArtifact([{ name: 'Existing Goal', section: { name: 'Existing Goal', slug: 'different-slug', description: 'x' } }]);
  const bySlug = mkArtifact([{ name: 'Fresh Name', section: { name: 'Fresh Name', slug: 'existing-goal', description: 'x' } }]);
  const byDtag = mkArtifact([{ name: 'Fresh Two', section: { name: 'Fresh Two', slug: 'fresh-two', description: 'x' } }]);
  const dtagDerive = (name) => (name === 'Fresh Two' ? 'existing-dtag' : syntheticDerive(name));
  for (const [label, artifact, derive] of [
    ['name', byName, syntheticDerive],
    ['slug', bySlug, syntheticDerive],
    ['derived d-tag', byDtag, dtagDerive],
  ]) {
    const r = core.planRestore(artifact, existing, { deriveGoalDTag: derive });
    assert(r && r.ok === false && r.refusal === 'goal-collides',
      `a ${label} collision with an existing goal must refuse 'goal-collides' — a colliding mint would MERGE over ` +
      `the existing goal, a silent overwrite (ADR 0008 d5; the createChildGoal triple generalized). Got ${short(r)}.`);
    assert(Array.isArray(r.collisions) && r.collisions.length > 0,
      `the refusal must LIST the collisions (got ${short(r.collisions)}).`);
  }
  // ALL collisions listed, not just the first (all checks precede all writes).
  const both = mkArtifact([
    { name: 'Existing Goal', section: { name: 'Existing Goal', slug: 's1', description: 'x' } },
    { name: 'Also Fresh', section: { name: 'Also Fresh', slug: 'existing-goal', description: 'x' } },
  ]);
  const r2 = core.planRestore(both, existing, { deriveGoalDTag: syntheticDerive });
  assert(r2 && r2.ok === false && Array.isArray(r2.collisions) && r2.collisions.length === 2,
    `EVERY colliding goal must be listed in one refusal — the owner fixes the artifact once, not one collision at a ` +
    `time (ADR 0008 d5). Got ${short(r2)}.`);
});

test('U7 (record collisions): planRestore refuses record-collides when an artifact record\'s slug already exists in that family on the target', () => {
  const core = loadRestoreCore();
  const existing = { ...NO_EXISTING, signals: [existingSignal()] };
  const artifact = {
    format: ARTIFACT_FORMAT, version: 1, takenOn: '2026-07-04',
    content: {
      goals: [], resources: [], workRecords: [], proposals: [],
      signals: [{ name: 'sig', section: { ...FIX_SIGNAL_SECTION, slug: 'existing-sig-1' } }],
    },
  };
  const r = core.planRestore(artifact, existing, { deriveGoalDTag: syntheticDerive });
  assert(r && r.ok === false && r.refusal === 'record-collides',
    `an artifact record whose slug already exists in its family must refuse 'record-collides' — duplicate record ` +
    `slugs would make the slug-keyed linkage (openProposals' proposalId matching) ambiguous (ADR 0008 d5). Got ${short(r)}.`);
  assert(JSON.stringify(r.collisions || '').includes('existing-sig-1'),
    `the refusal must name the colliding slug (got ${short(r.collisions)}).`);
  // Same slug in a DIFFERENT family is not a collision (slugs are family-scoped).
  const crossFamily = {
    ...artifact,
    content: { ...artifact.content, signals: [], workRecords: [{ name: 'w', section: { ...FIX_WORK_SECTION, slug: 'existing-sig-1' } }] },
  };
  const r2 = core.planRestore(crossFamily, existing, { deriveGoalDTag: syntheticDerive });
  assert(r2 && r2.ok === true,
    `record slugs are FAMILY-scoped — the same slug in a different family is no collision (got ${short(r2)}).`);
});

test('U8 (the plan): an empty artifact plans zero mints; a full artifact plans goals → resources → workRecords → proposals → signals with the sections VERBATIM', () => {
  const core = loadRestoreCore();
  const empty = {
    format: ARTIFACT_FORMAT, version: 1, takenOn: '2026-07-04',
    content: { goals: [], resources: [], workRecords: [], proposals: [], signals: [] },
  };
  const r0 = core.planRestore(empty, NO_EXISTING, { deriveGoalDTag: syntheticDerive });
  assert(r0 && r0.ok === true && Array.isArray(r0.mints) && r0.mints.length === 0,
    `an empty artifact must plan zero mints and succeed (an empty brain exports a valid, restorable artifact — ADR 0008 d3). Got ${short(r0)}.`);
  const r = core.planRestore(fixtureArtifact(), NO_EXISTING, { deriveGoalDTag: syntheticDerive });
  assert(r && r.ok === true && Array.isArray(r.mints) && r.mints.length === 7,
    `the fixture artifact (2 goals + 1 resource + 1 work record + 2 proposal facts + 1 signal) must plan 7 mints; got ${short(r && r.mints && r.mints.length)}.`);
  const familyOrder = r.mints.map((m) => m.family);
  const wantOrder = ['goals', 'goals', 'resources', 'workRecords', 'proposals', 'proposals', 'signals'];
  assert(JSON.stringify(familyOrder) === JSON.stringify(wantOrder),
    `the plan must mint in family order goals → resources → workRecords → proposals → signals (ADR 0008 d5); got ${short(familyOrder)}.`);
  const childMint = r.mints.find((m) => m.section && m.section.slug === FIX_CHILD_SLUG);
  assert(childMint && sortedStringify(childMint.section) === sortedStringify(FIX_CHILD_SECTION),
    'the planned sections must be the artifact\'s VERBATIM — no field mapping, no restamping, out-of-contract fields intact (ADR 0008 d7).');
  assert(childMint.name === FIX_CHILD_NAME,
    `each planned mint carries the entry's element name verbatim (got ${short(childMint && childMint.name)}).`);
});

/* ══════════════ S-class — source assertions (stack-free) ══════════════ */

test('S1 (ADR d3): GET /api/brain/export — registered, in-handler gate, dated attachment filename', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/\/api\/brain\/export/.test(src),
    'GET /api/brain/export is not registered (ADR 0008 d3) — not implemented yet.');
  const start = src.indexOf('handleGetExport');
  assert(start !== -1, 'handleGetExport not found in src/api/brain/index.js (ADR 0008 d3).');
  const slice = src.slice(start, start + 6000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'the export read must carry the explicit in-handler gate (isOwner(req) || req.localTrusted → 403) — the export IS the whole brain (ADR 0008 d3).');
  assert(/Content-Disposition/i.test(slice) && /attachment/i.test(slice) && /brain-export-/.test(slice),
    'the export response must set Content-Disposition: attachment with the dated brain-export-<takenOn>.json filename (ADR 0008 d1/d3).');
});

test('S2 (ADR d13): the brain module requires the export core; the import surface is re-pinned to TEN', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/require\s*\(\s*['"`][^'"`]*lib\/brain\/export['"`]\s*\)/.test(src),
    'the brain module must require ../../lib/brain/export — the artifact assembly core (ADR 0008 d4) is not wired yet.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/, /lib\/brain\/resources$/, /lib\/brain\/work-records$/, /lib\/brain\/proposals$/, /lib\/brain\/signals$/, /lib\/brain\/export$/, /lib\/brain\/direction$/];
  for (const spec of requires) {
    assert(allowed.some((re) => re.test(spec)),
      `import surface violation: require('${spec}') — story 8 adds exactly lib/brain/export; the brain module ` +
      'allows only the ten cores (ADR 0008 d13; the seven sibling re-pins widen to ten).');
  }
});

test('S3 (ADR d3/d6 — the lanes): restore lives in normalize, never in the brain module; the brain gains exactly the export route', () => {
  const brain = safeRead(BRAIN_API);
  assert(brain, 'src/api/brain/index.js missing — story 1 regression.');
  assert(!/restore/i.test(brain),
    'the brain module must carry NO restore surface — the brain is pinned read-only; RESTORE writes and lives in normalize (ADR 0008 d6; the story-7 handoff\'s own constraint).');
  const routes = [...brain.matchAll(/app\.get\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  // Re-pinned to SEVEN by operational-direction #1 (ADR 0001 d1), then to
  // EIGHT for PR #480 (goals-rationale: the /api/brain/serves-path read,
  // operator-authorized re-pin 2026-07-29). The exact-length check is
  // DELIBERATELY kept — a ninth route still fails here until someone re-pins
  // it on purpose.
  const want = ['/api/brain/goals', '/api/brain/orient', '/api/brain/proposals', '/api/brain/direction/:slug', '/api/brain/goals/:slug', '/api/brain/hygiene', '/api/brain/export', '/api/brain/serves-path'];
  assert(routes.length === want.length && want.every((w) => routes.includes(w)),
    `registerBrainRoutes must carry exactly the eight reads (the seven prior + /api/brain/serves-path — PR #480 goals-rationale, re-pinned 2026-07-29); got ${short(routes)}.`);
});

test('S4 (ADR d6): restore-brain — route, gate-first, one mutex task, artifact validation, named refusals', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/restore-brain/.test(src),
    'POST /api/normalize/restore-brain is not registered (ADR 0008 d6) — not implemented yet.');
  const start = src.indexOf('handleRestoreBrain');
  assert(start !== -1, 'handleRestoreBrain not found in src/api/normalize/index.js (ADR 0008 d6).');
  const slice = src.slice(start, start + 10000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'restore-brain must carry the explicit in-handler gate (isOwner(req) || req.localTrusted → 403) — ADR 0008 d6.');
  assert(/serializeGoalWrite/.test(slice),
    'the ENTIRE restore must run inside one serializeGoalWrite task (ADR 0008 d6) — no interleaved goal writes mid-restore.');
  assert(/validateArtifact/.test(slice) || /validateArtifact/.test(fnBody(src, 'restoreBrain')),
    'restore-brain must validate the artifact shape via the export core\'s validateArtifact before anything (ADR 0008 d6).');
  for (const tok of ['goal-collides', 'record-collides']) {
    assert(src.includes(tok),
      `restore-brain must answer the named refusal '${tok}' (ADR 0008 d5/d6) — loud, named, nothing written.`);
  }
});

test('S5 (ADR d7 — mint discipline): restored goals are name-derived (no nonce), restored records are nonce\'d, and NOTHING on the restore/drill paths regenerateJsons', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const goalMint = fnBody(src, 'mintRestoredGoal');
  assert(goalMint, 'mintRestoredGoal is not implemented yet (ADR 0008 d7).');
  assert(/childDTag\s*\(/.test(goalMint) && !/randomDTag\s*\(/.test(goalMint),
    'restored goals must mint under the NAME-DERIVED d-tag (the capture idiom — deterministic per instance), never a nonce (ADR 0008 d7).');
  const elemMint = fnBody(src, 'mintRestoredElement');
  assert(elemMint, 'mintRestoredElement is not implemented yet (ADR 0008 d7).');
  assert(/randomDTag\s*\(/.test(elemMint),
    'restored records must mint under a fresh RANDOM d-tag (the mint*Element idiom — no MERGE-over possible; ADR 0008 d7).');
  const regions = ['restoreBrain', 'mintRestoredGoal', 'mintRestoredElement', 'recordRestoreDrill', 'mintRestoreDrillElement']
    .map((n) => fnBody(src, n)).join('\n--\n');
  assert(!/regenerateJson\s*\(/.test(regions),
    'the restore/drill paths must NEVER regenerateJson — restore mints fresh, edits nothing, re-signs nothing (ADR 0008 d7; PRD §7.2).');
});

test('S6 (ADR d9): record-restore-drill — route, gate, the two outcome words enforced, server-stamped drilledOn, performedBy owner, the concept self-bootstrap', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/record-restore-drill/.test(src),
    'POST /api/normalize/record-restore-drill is not registered (ADR 0008 d9) — not implemented yet.');
  const start = src.indexOf('handleRecordRestoreDrill');
  assert(start !== -1, 'handleRecordRestoreDrill not found (ADR 0008 d9).');
  const slice = src.slice(start, start + 8000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'record-restore-drill must carry the explicit in-handler gate (ADR 0008 d9).');
  assert(/serializeGoalWrite/.test(slice),
    'record-restore-drill must run through the shared write mutex (ADR 0008 d9).');
  assert(src.includes('matched') && src.includes('did-not-match'),
    "the outcome vocabulary is exactly 'matched' | 'did-not-match' (ADR 0008 d9) — both words must exist in normalize.");
  assert(!/body\s*[.[]\s*['"`]?drilledOn/.test(slice) && !/{[^}]*\bdrilledOn\b[^}]*}\s*=\s*req\.body/.test(slice),
    'drilledOn must be SERVER-stamped, never read from the request body (ADR 0008 d9).');
  const core = fnBody(src, 'recordRestoreDrill');
  assert(/drilledOn/.test(core), 'the drill core must stamp drilledOn (ADR 0008 d9).');
  assert(/performedBy/.test(core) && /['"`]owner['"`]/.test(core),
    "the drill core must stamp performedBy: 'owner' (ADR 0008 d9 — the d7 precedent, instance-relative).");
  assert(/ensureRestoreDrillConcept/.test(src),
    'ensureRestoreDrillConcept (the fifth runtime-created concept\'s self-bootstrap) does not exist yet (ADR 0008 d9).');
  const ensure = src.slice(src.indexOf('ensureRestoreDrillConcept'), src.indexOf('ensureRestoreDrillConcept') + 4000);
  assert(/create-concept|handleCreateConcept/.test(ensure) && /save-schema|handleSaveSchema/.test(ensure),
    'ensureRestoreDrillConcept must provision via create-concept + save-schema when absent (ADR 0008 d9).');
  assert(src.includes(DRILL_CONCEPT_SLUG) || src.includes('tapestry restore drill'),
    `normalize must reference the drill concept (${DRILL_CONCEPT_SLUG}) — ADR 0008 d9.`);
});

test('S7 (ADR d8): ensureGoalConcept exists — closing the ADR 0001 bootstrap gap — and the restore path provisions concepts before minting', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/ensureGoalConcept/.test(src),
    'ensureGoalConcept does not exist yet (ADR 0008 d8) — a truly fresh target lacks ALL FIVE concepts (the ADR 0001 recon correction), so restore must be able to provision the goal concept too.');
  // Structure-bounded, not a byte window (OPEN.md row 109; re-aimed by
  // goal-intent-fields #1, Phase 3). The first literal 'ensureGoalConcept' in
  // the module is a COMMENT four lines above the GOAL_SCHEMA constant, so the
  // old 4000-char window spanned that constant: growing GOAL_SCHEMA — which
  // goal-intent-fields #1 does, by four declared properties — ate the window's
  // headroom and would eventually have failed this pin on correct code.
  const ensure = fnBody(src, 'ensureGoalConcept');
  assert(/create-concept|handleCreateConcept/.test(ensure) && /save-schema|handleSaveSchema/.test(ensure),
    'ensureGoalConcept must provision via create-concept + save-schema when the concept is absent (ADR 0008 d8).');
  assert(/GOAL_SCHEMA/.test(src) && /tapestryOwnerGoal/.test(src),
    'a GOAL_SCHEMA with the tapestryOwnerGoal wrapper must exist for the ensure (ADR 0008 d8 — the live schema\'s fields).');
  const restore = fnBody(src, 'restoreBrain');
  assert(restore && /ensureGoalConcept/.test(restore) && /ensureResourceConcept/.test(restore),
    'the restore core must ensure the concepts it mints into (goal + the four record families, lazily) — ADR 0008 d8.');
});

test('S8 (AC3 — no egress): every new path is loopback-local — no outbound publish or fetch anywhere', () => {
  for (const [f, label] of [[EXPORT_CORE, 'export core'], [RESTORE_CORE, 'restore core']]) {
    const src = safeRead(f);
    assert(src, `src/lib/brain/${path.basename(f)} does not exist yet (ADR 0008 d4/d5).`);
    assert(!/publishEverywhere|nostrPublish|\bfetch\s*\(|https?:\/\/|child_process|require\s*\(/.test(src),
      `the ${label} must be pure and egress-free (AC3; §7.4) — no network token may appear in it.`);
  }
  const brain = safeRead(BRAIN_API);
  const exportRegion = brain.slice(brain.indexOf('handleGetExport'), brain.indexOf('handleGetExport') + 6000);
  assert(exportRegion && !/publishEverywhere|nostrPublish|\bfetch\s*\(|https?:\/\//.test(exportRegion),
    'the export handler must touch nothing outward — the artifact is assembled from local reads only (AC3; §7.4).');
  const norm = safeRead(NORMALIZE_INDEX);
  const regions = ['restoreBrain', 'recordRestoreDrill', 'mintRestoredGoal', 'mintRestoredElement', 'mintRestoreDrillElement']
    .map((n) => fnBody(norm, n)).join('\n--\n');
  assert(regions.trim(), 'the restore/drill cores are not implemented yet (ADR 0008 d6/d7/d9).');
  assert(!/publishEverywhere|nostrPublish|\bfetch\s*\(|https?:\/\//.test(regions),
    'the restore/drill writes must ride publishToStrfry + importEventDirect ONLY — local by construction (AC3; event-tagging 0002).');
  const script = safeRead(DRILL_SCRIPT);
  assert(script, 'scripts/brain-drill.sh does not exist yet (ADR 0008 d10).');
  assert(!/https:\/\//.test(script),
    'the drill script must reach NO https host — everything it does is local (AC3; §7.4).');
  const httpUrls = [...script.matchAll(/http:\/\/([^\s/'"]+)/g)].map((m) => m[1]);
  for (const host of httpUrls) {
    assert(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host),
      `the drill script reaches http://${host} — only loopback (127.0.0.1/localhost) is allowed (AC3; §7.4).`);
  }
});

test('S9 (house rule): no hardcoded 64-hex pubkey in any file this story touches', () => {
  for (const f of [EXPORT_CORE, RESTORE_CORE, BRAIN_API, NORMALIZE_INDEX, GOALS_JSX, DRILL_SCRIPT]) {
    const src = safeRead(f);
    if (!src && (f === EXPORT_CORE || f === RESTORE_CORE || f === DRILL_SCRIPT)) continue; // pre-impl: U1/U6/S8 fail loudly for these
    assert(src, `${path.relative(ROOT, f)} missing.`);
    assert(!/\b[0-9a-f]{64}\b/i.test(src),
      `${path.relative(ROOT, f)} contains a 64-hex literal — the TA pubkey is per-deployment and must be resolved ` +
      'at runtime (house rule; PRD §7.8; the artifact is identity-free by design).');
  }
});

test('S10 (ADR d12 — copy discipline): Goals.jsx carries the pinned button label and the ratified confirmation/failure sentences verbatim, digit-free, jargon-free', () => {
  const src = safeRead(GOALS_JSX);
  assert(src, 'ui/src/pages/brain/Goals.jsx missing — story 1 regression.');
  assert(src.includes(BUTTON_LABEL),
    `Goals.jsx must carry the pinned button label '${BUTTON_LABEL}' verbatim (style guide line 24; ADR 0008 d11) — the affordance is not implemented yet.`);
  assert(src.includes(EXPORT_CONFIRM),
    `Goals.jsx must carry the ratified export confirmation '${EXPORT_CONFIRM}' verbatim (ADR 0008 d12).`);
  assert(src.includes(EXPORT_FAIL),
    `Goals.jsx must carry the ratified export failure sentence "${EXPORT_FAIL}" verbatim (ADR 0008 d12).`);
  for (const s of [BUTTON_LABEL, EXPORT_CONFIRM, EXPORT_FAIL]) {
    assert(!/\d/.test(s), `the d12 strings carry no numerals (AC5); '${s}' violates that — fix the suite constant.`);
  }
  const strings = [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
  ].join('\n');
  for (const w of ['schema', 'pubkey', 'superset', 'concept header', 'persona', 'acceptance criteria', 'lease', 'payload', 'endpoint']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(strings),
      `banned jargon "${w}" found in Goals.jsx strings (style guide; AC5).`);
  }
});

test('S11 (ADR d14 — sentinel): the ui untouchables carry no story tokens — GoalDetail/Proposals/io ExportPage', () => {
  for (const [f, label] of [[GOAL_DETAIL_JSX, 'GoalDetail.jsx'], [PROPOSALS_JSX, 'Proposals.jsx']]) {
    const src = safeRead(f);
    assert(src, `${label} missing — regression.`);
    assert(!/brain\/export|restore-brain|restore-drill|Export brain/i.test(src),
      `${label} must NOT reference the export/restore surface — the affordance lives in the Goals view footer only (ADR 0008 d11/d14).`);
  }
  const io = safeRead(IO_EXPORT_PAGE);
  assert(io, 'ui/src/pages/io/ExportPage.jsx missing — regression.');
  assert(!/tapestry-brain-export|api\/brain\/export/.test(io),
    'the io ExportPage (the graph-export surface) must stay byte-clear of the BRAIN export — different products (ADR 0008 d14).');
});

test('S12 (sentinel — ADR d3): the brain module stays structurally read-only — no mutation/strfry tokens', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(!/child_process|execFile|exec\s*\(|strfry|publishToStrfry|regenerateJson|nostrPublish|signAndFinalize/.test(src),
    'the brain module must stay mutation- and strfry-free — the export is a READ; restore writes live in normalize (ADR 0008 d3/d6).');
});

test('S13 (ADR d10): the drill script — pinned sentence, journal call, router quiesce, firmware bring-up, no published ports, self-cleaning', () => {
  const src = safeRead(DRILL_SCRIPT);
  assert(src, 'scripts/brain-drill.sh does not exist yet (ADR 0008 d10) — the drill is the story\'s product act.');
  assert(src.includes(DRILL_SENTENCE),
    `the drill script must print the pinned completion sentence verbatim on match: '${DRILL_SENTENCE}' (style guide line 27; ADR 0008 d12).`);
  assert(/record-restore-drill/.test(src),
    'the drill script must journal its result into the LIVE brain via record-restore-drill — BOTH outcomes (ADR 0008 d9/d10).');
  assert(/did-not-match/.test(src),
    'the drill script must journal a mismatch too (outcome did-not-match) — the result is journaled either way (ADR 0008 d9/d10).');
  assert(/supervisorctl\s+stop\s+strfry-router/.test(src),
    'the drill script must quiesce the scratch instance\'s strfry-router after boot (ADR 0008 d10 — no sync churn).');
  assert(/api\/firmware\/install/.test(src),
    'the drill script must run the standard firmware bring-up inside the scratch (the second-operator baseline; ADR 0008 d10).');
  assert(/docker\s+run/.test(src) && /--rm/.test(src),
    'the scratch container must be docker run --rm (self-cleaning, fresh volumes; ADR 0008 d10).');
  const runLines = src.split('\n').filter((l) => /docker\s+run/.test(l));
  for (const line of runLines) {
    assert(!/\s-p\s|\s--publish\s/.test(line),
      `the scratch container must publish NO ports — docker-exec loopback only (ADR 0008 d10; egress hygiene): ${short(line)}`);
  }
  assert(/contentEquivalent|lib\/brain\/export/.test(src),
    'the drill script must compare via the ONE equivalence definition (lib/brain/export contentEquivalent; ADR 0008 d2/d10).');
});

/* ══════════════ H-class — live local stack (SKIP when absent) ══════════════ */

test('H1 (AC1 — the dated, identity-free artifact): GET /api/brain/export answers the versioned envelope with all five families, attachment headers, and NO instance identity anywhere in it', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const a = getExport();
  assert(a && a.format === ARTIFACT_FORMAT && a.version === 1,
    `the export must answer the versioned envelope {format:'${ARTIFACT_FORMAT}', version:1} (AC1; ADR 0008 d1); got ${short(a, 300)}.`);
  assert(typeof a.takenOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.takenOn),
    `the artifact must be DATED (takenOn, ISO date — AC1); got ${short(a.takenOn)}.`);
  assert(a.content && FAMILY_KEYS.every((k) => Array.isArray(a.content[k])),
    `the artifact must carry all five family arrays (AC1); got ${short(a.content && Object.keys(a.content))}.`);
  assert(a.content.goals.length >= 1,
    'the live brain holds goals — the export must carry them (AC1).');
  for (const k of FAMILY_KEYS) {
    for (const e of a.content[k]) {
      assert(e && typeof e.name === 'string' && e.section && typeof e.section === 'object'
        && Object.keys(e).sort().join(',') === 'name,section',
        `every ${k} entry is exactly {name, section} (ADR 0008 d1); got keys [${Object.keys(e || {})}].`);
    }
  }
  // Identity-freedom, live: the artifact must not contain the runtime TA pubkey
  // (or any 64-hex identity) — the §5.9 portability seed, proven on real content.
  const ta = getTaPubkey();
  const s = JSON.stringify(a);
  assert(!s.includes(ta), 'the artifact contains the runtime TA pubkey — the export must be identity-free (§5.9; ADR 0008 d1).');
  assert(!/\b[0-9a-f]{64}\b/i.test(s), 'the artifact contains a 64-hex identity — the export must be identity-free (§5.9; ADR 0008 d1).');
  // The download contract: attachment headers with the dated filename.
  const raw = loopbackGetRaw('/api/brain/export');
  assert(/content-disposition:\s*attachment/i.test(raw) && /filename="?brain-export-\d{4}-\d{2}-\d{2}\.json/i.test(raw),
    `the export must download as attachment; filename="brain-export-<takenOn>.json" (ADR 0008 d1/d3); headers: ${short(raw, 400)}.`);
});

test('H2 (AC4 live): export twice with no changes in between → contentEquivalent', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const core = loadExportCore();
  const a = getExport();
  const b = getExport();
  assert(a && a.format === ARTIFACT_FORMAT && b && b.format === ARTIFACT_FORMAT, 'both exports must answer the envelope.');
  assert(core.contentEquivalent(a, b) === true,
    'AC4 violated: two exports with no brain writes between them are NOT content-equivalent — the export is not deterministic.');
});

test('H3 (AC1/AC3 — export is a pure read): exporting changes nothing — goals, proposals queue, and hygiene identical before and after', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const goalsBefore = JSON.stringify(getGoalsList());
  const queueBefore = JSON.stringify(getProposals());
  const hygieneBefore = JSON.stringify(loopbackGetJson('/api/brain/hygiene'));
  getExport();
  getExport();
  assert(JSON.stringify(getGoalsList()) === goalsBefore,
    'exporting must not change the goals read — reads never provision or mutate (ADR 0008 d3).');
  assert(JSON.stringify(getProposals()) === queueBefore,
    'exporting must not touch the proposals queue (ADR 0008 d3).');
  assert(JSON.stringify(loopbackGetJson('/api/brain/hygiene')) === hygieneBefore,
    'exporting must leave hygiene untouched (ADR 0008 d3).');
});

test('H4 (AC2 mechanics — the restore round-trip): a cross-linked sentinel artifact restores VERBATIM beside the live content — decomposition, pointer, spine, the decision closing its proposal, capturedOn not restamped', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  fixturesArmed = true;
  preCleanFixtures();
  const artifact = fixtureArtifact();
  const r = restoreBrain(artifact);
  assert(r && r.success === true && r.result === 'restored',
    `restore-brain must succeed on a collision-free artifact (ADR 0008 d6) — the target need NOT be empty; got ${short(r, 400)}.`);
  assert(r.restored && r.restored.goals === 2 && r.restored.resources === 1 && r.restored.workRecords === 1
    && r.restored.proposals === 2 && r.restored.signals === 1,
    `the result must count the restored families {goals:2, resources:1, workRecords:1, proposals:2, signals:1}; got ${short(r.restored)}.`);
  // Decomposition position: the child sits under the parent (record-based linkage survived).
  const child = getGoalDetail(FIX_CHILD_SLUG);
  assert(child && child.goal, `the restored child goal must be readable at its slug (got ${short(child, 300)}).`);
  assert(child.goal.parentSlug === FIX_PARENT_SLUG,
    `the child's decomposition position must survive restore (parent '${FIX_PARENT_SLUG}'; AC2/AC1 "decomposition positions"); got ${short(child.goal.parentSlug)}.`);
  assert(child.goal.captureDate === FIX_CAPTURED_ON,
    `capturedOn must NOT be restamped — the artifact's dates ARE the content (ADR 0008 d7); want ${FIX_CAPTURED_ON}, got ${short(child.goal.captureDate)}.`);
  assert(child.goal.standing === 'viable',
    `the restored child (deliverable + boundary, no children) must derive 'viable' — derived state re-derives on the target (ADR 0008 Context); got ${short(child.goal.standing)}.`);
  // The pointer arrived and grouped onto its goal.
  assert(Array.isArray(child.pointers) && child.pointers.some((p) => p.locator === FIX_LOCATOR),
    `the restored resource must appear among the child's pointers (record-based goal linkage); got ${short(child.pointers, 300)}.`);
  // The spine: worked + proposed + approved + preferred all present.
  const childTypes = new Set((child.records || []).map((e) => e.type));
  for (const t of ['worked', 'proposed', 'approved', 'preferred']) {
    assert(childTypes.has(t),
      `the child's spine must carry the restored '${t}' entry (AC2 — records reproduce); got ${short([...childTypes])}.`);
  }
  const parent = getGoalDetail(FIX_PARENT_SLUG);
  const parentTypes = new Set((parent.records || []).map((e) => e.type));
  assert(parentTypes.has('passed over'),
    `the parent's spine must carry the signal's passed-over side (one fact, two spines); got ${short([...parentTypes])}.`);
  // The decision CLOSED its proposal: proposalId → slug linkage survived verbatim.
  const open = getProposals();
  assert(Array.isArray(open.proposals) && !open.proposals.some((p) => p.proposalId === 'harness-survive-prop-1'),
    'the restored decision must CLOSE its restored proposal in the open queue — the proposalId → slug linkage must survive restore byte-for-byte (ADR 0008 Context/d7).');
  // Verbatim: re-export and deep-compare every sentinel section against the artifact.
  const after = getExport();
  for (const k of FAMILY_KEYS) {
    for (const wanted of artifact.content[k]) {
      const found = (after.content[k] || []).find((e) => e.section && e.section.slug === wanted.section.slug);
      assert(found, `the re-export must carry the restored ${k} entry '${wanted.section.slug}' (AC2).`);
      assert(sortedStringify(found.section) === sortedStringify(wanted.section),
        `AC2 violated: the restored ${k} section '${wanted.section.slug}' is not VERBATIM the artifact's.\n` +
        `  want ${short(sortedStringify(wanted.section), 400)}\n  got  ${short(sortedStringify(found.section), 400)}`);
      assert(found.name === wanted.name,
        `the restored ${k} element name must be verbatim (want '${wanted.name}', got '${short(found.name)}').`);
    }
  }
});

test('H5 (the protection): collisions refuse wholesale and write NOTHING — including the live brain\'s own export against the live brain', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const goalsBefore = JSON.stringify(getGoalsList());
  const exportBefore = getExport();
  // (a) Re-restoring the H4 artifact: every goal now collides.
  const again = restoreBrain(fixtureArtifact());
  assert(again && again.success === false && again.refusal === 'goal-collides',
    `re-restoring the same artifact must refuse goal-collides (the collision guard IS the re-run guard; ADR 0008 d5); got ${short(again, 300)}.`);
  assert(JSON.stringify(again.collisions || '').includes(FIX_CHILD_SLUG) && JSON.stringify(again.collisions || '').includes(FIX_PARENT_SLUG),
    `the refusal must list EVERY colliding goal (both fixtures); got ${short(again.collisions, 300)}.`);
  // (b) A record-slug collision (fresh goal, colliding signal slug).
  const recArtifact = {
    format: ARTIFACT_FORMAT, version: 1, takenOn: '2026-07-05',
    content: {
      goals: [], resources: [], workRecords: [], proposals: [],
      signals: [{ name: 'x', section: { ...FIX_SIGNAL_SECTION, description: 'a different harness-survive signal, same slug' } }],
    },
  };
  const rec = restoreBrain(recArtifact);
  assert(rec && rec.success === false && rec.refusal === 'record-collides',
    `an artifact record whose slug already exists must refuse record-collides (ADR 0008 d5); got ${short(rec, 300)}.`);
  // (c) THE protection row: the live brain's own export refuses against the live brain.
  const self = restoreBrain(exportBefore);
  assert(self && self.success === false && self.refusal === 'goal-collides',
    'AC2\'s "must not risk the thing it protects", structurally: restoring the live brain\'s own export against the ' +
    `live brain must REFUSE on every goal (ADR 0008 d5); got ${short(self, 300)}.`);
  // Nothing was written by any refusal.
  assert(JSON.stringify(getGoalsList()) === goalsBefore,
    'a refusal wrote something: the goals read changed — all checks must precede all writes (ADR 0008 d5/d6).');
  const core = loadExportCore();
  assert(core.contentEquivalent(getExport(), exportBefore) === true,
    'a refusal wrote something: the export changed across three refused restores (ADR 0008 d5/d6).');
});

test('H6 (AC2c — the journal): record-restore-drill self-bootstraps the fifth concept and stores the dated, attributed, both-ways outcome record; a bad outcome word is a 400-class shape error', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  fixturesArmed = true;
  const target = 'harness-survive drill target (suite fixture, not a real drill)';
  const r = loopbackPostJson('/api/normalize/record-restore-drill',
    { exportTakenOn: '2026-07-04', outcome: 'matched', target });
  assert(r && r.success === true,
    `record-restore-drill must succeed for outcome 'matched' (ADR 0008 d9); got ${short(r, 300)}.`);
  const ta = getTaPubkey();
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39998:${ta}:${DRILL_CONCEPT_SLUG}`)}`);
  assert(node && node.success !== false && node.node,
    `the drill concept (39998:<TA>:${DRILL_CONCEPT_SLUG}) must exist after the first journal entry — the FIFTH runtime-created concept (ADR 0008 d9); got ${short(node, 300)}.`);
  // The stored record: discovered by sentinel (state-free), fields per d9.
  const q = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (e:NostrEvent)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
             WHERE e.kind = 39999 AND t.value CONTAINS $target
             RETURN t.value AS json LIMIT 1`,
    params: { target },
  });
  const rows = (q && (q.data || q.rows)) || [];
  assert(rows.length === 1, `the journal element must be stored and discoverable (got ${rows.length} rows).`);
  const wrapper = JSON.parse(rows[0].json);
  const section = wrapper.restoreDrill;
  assert(section && typeof section === 'object',
    `the journal element must carry the restoreDrill section (ADR 0008 d9); got ${short(wrapper, 300)}.`);
  assert(section.exportTakenOn === '2026-07-04' && section.outcome === 'matched' && section.target === target,
    `the journal must store exportTakenOn/outcome/target as given; got ${short(section, 400)}.`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(section.drilledOn || ''),
    `drilledOn must be a server-stamped ISO date (AC2c — a DATED record); got ${short(section.drilledOn)}.`);
  assert(section.performedBy === 'owner',
    `performedBy must be 'owner' (ADR 0008 d9); got ${short(section.performedBy)}.`);
  // The outcome vocabulary is closed: anything else is a shape error, nothing written.
  const bad = loopbackPostJson('/api/normalize/record-restore-drill',
    { exportTakenOn: '2026-07-04', outcome: 'sort-of', target: 'harness-survive bad outcome probe' });
  assert(bad && bad.success === false,
    `an outcome outside 'matched'/'did-not-match' must be refused (ADR 0008 d9); got ${short(bad, 300)}.`);
  const badQ = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (e:NostrEvent)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
             WHERE t.value CONTAINS 'harness-survive bad outcome probe' RETURN count(e) AS n`,
    params: {},
  });
  const badRows = (badQ && (badQ.data || badQ.rows)) || [];
  assert(badRows.length === 1 && badRows[0].n === 0,
    'a refused journal write must store NOTHING (ADR 0008 d9).');
});

test('H7 (caller classes): remote GET /api/brain/export is 403\'d; remote restore-brain and record-restore-drill are 401\'d by the default-deny middleware', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const g = await fetch(`${HOST_BASE}/api/brain/export`, { signal: AbortSignal.timeout(5000) });
  assert(g.status === 403,
    `an unauthenticated remote GET /api/brain/export must be 403'd — the export is the WHOLE brain (ADR 0008 d3). ` +
    `Got ${g.status}${g.status === 404 ? ' — route not registered yet' : ''}.`);
  for (const p of ['/api/normalize/restore-brain', '/api/normalize/record-restore-drill']) {
    const r = await fetch(`${HOST_BASE}${p}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), signal: AbortSignal.timeout(5000),
    });
    assert(r.status === 401,
      `an unauthenticated remote mutation to ${p} must be 401'd by the middleware (security-auth-exposure/0002). Got ${r.status}.`);
  }
});

test('H8 (sentinel): the hygiene check stays green through everything this suite did', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/hygiene');
  assert(r && r.success === true && r.sound === true && Array.isArray(r.problems) && r.problems.length === 0,
    `the hygiene check must stay green — restore mints in-contract structures and the drill concept is outside its scope. Got: ${short(r, 500)}.`);
});

/* ══════════════ R-class — regression sentinels (pass before AND after) ══════════════ */

test('R1: the five existing brain reads stay registered (goals/orient/proposals/detail/hygiene)', () => {
  const src = safeRead(BRAIN_API);
  assert(/\/api\/brain\/goals/.test(src) && /\/api\/brain\/hygiene/.test(src) && /\/api\/brain\/orient/.test(src)
    && /\/api\/brain\/proposals/.test(src) && /goals\/:slug/.test(src),
    'src/api/brain/index.js must keep the goals + orient + proposals + detail + hygiene reads (story 1/2/4/5/6 regression).');
});

test('R2: the byte-pinned untouchables and PUBLIC_MUTATIONS stay free of this story', () => {
  for (const f of [RELATIONSHIPS, PROBE]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing — relationship-primitives regression.`);
    assert(!/restore-brain|restore-drill|brain-export|restoreBrain/.test(src),
      `${path.relative(ROOT, f)} must not be touched by this story (byte-pinned untouchable; ADR 0008 d14).`);
  }
  const auth = safeRead(AUTH);
  assert(auth, 'src/middleware/auth.js missing — regression.');
  assert(!/restore-brain|record-restore-drill|brain\/export/.test(auth),
    'PUBLIC_MUTATIONS / the middleware must NOT special-case the restore/export routes — they stay owner/loopback-gated (ADR 0008 d6/d14).');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- the-brain-survives tests (epic second-brain, Story 8) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try {
        const r = await fn();
        if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
        else { console.log(`  PASS  ${name}`); pass++; }
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    teardownFixtures();
    if (teardownFailure) {
      console.log(`  FAIL  fixture teardown\n        ${teardownFailure}`);
      failures.push({ name: 'fixture teardown', message: teardownFailure });
      fail++;
    }
  }
  console.log(`\nthe-brain-survives: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
