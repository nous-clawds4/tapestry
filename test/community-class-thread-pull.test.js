/**
 * Story #14 / ADR 0009 — Community class-thread pull (Phase B).
 *
 * Adds an owner-only on-demand endpoint POST /api/concept/:handle/pull-community-class-thread
 * that walks z-tags from the #11 community Superset anchor, materializes the
 * curator's full class-thread vocabulary (Sets + elements + canonical
 * HAS_ELEMENT / IS_A_SUPERSET_OF edges) as a foreign sub-graph, gated by
 * requireOwner. Per ADR 0009 the edges carry no `source` property (canonical
 * relationships, not Neo4j-only stubs) and the handler terminates via
 * visited-set + max-depth + max-fetch budget. No editorial relationships,
 * no election, local concept untouched.
 *
 * Precedent: #5/#6/#8/#10/#11. Source/structural sentinels pin the spec-
 * required code shape without prescribing implementer naming; the behavioral
 * proof (auth + real /api/relay/external against dcosl + real Neo4j +
 * idempotency + Rule-5 audit + honest invariants) is the **authoritative
 * cycle-local smoke S1–S10** (Reviewer-required, per ADR 0009) — only the
 * smoke can prove the foreign sub-graph ends up with `:Set` labelled
 * correctly, the canonical class-thread edges traverse in pass-1d direction,
 * and the local concept's HAS_ELEMENT + IS_A_SUPERSET_OF counts are
 * byte-unchanged.
 *
 * T1/T2/T3/T4/T5 : FAIL pre-implementation, PASS post.
 * R1             : PASS pre AND post — regression guard on the #11
 *                  install.js contract (Header materialization +
 *                  REFERENCES{source:'firmware-community'} MERGE +
 *                  cross-curator IS_A_SUPERSET_OF MERGE). Phase B is an
 *                  *additive* on-demand endpoint and MUST NOT modify
 *                  install.js. Flip ⇒ implementer broke prior behavior.
 */

const fs = require('fs');
const path = require('path');

const PULL = path.resolve(__dirname, '../src/api/concept/pullClassThread.js');
const INDEX = path.resolve(__dirname, '../src/api/index.js');
const INSTALL = path.resolve(__dirname, '../src/firmware/install.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function readMaybe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #14 is implemented per ADR 0009.
// ---------------------------------------------------------------------------

test('T1: POST /api/concept/:handle/pull-community-class-thread is registered with requireOwner middleware (AC-1, ADR 0009)', () => {
  const idx = readMaybe(INDEX);
  assert(idx !== null, 'src/api/index.js not found — re-baseline this sentinel.');
  // Match the exact ADR-mandated route + verb + middleware, allowing the
  // handler reference to be any identifier (Implementer naming freedom).
  // Precedent: #9 uses `app.get('/api/concept/:handle/export-set', requireOwner, handleConceptExportSet);`
  const re = /app\.post\(\s*['"`]\/api\/concept\/:handle\/pull-community-class-thread['"`]\s*,\s*requireOwner\s*,\s*\w+/;
  assert(
    re.test(idx),
    'src/api/index.js does not register POST /api/concept/:handle/pull-community-class-thread with the ' +
      'requireOwner middleware (AC-1; ADR 0009). Mirror Story #9\'s export-set registration at line 491 — ' +
      'POST verb, exact literal path, requireOwner as second argument, handler as third.'
  );
});

test('T2: pullClassThread.js walks z-tags via /api/relay/external (#z filter + kinds:[39999]) (AC-3, ADR 0009)', () => {
  const src = readMaybe(PULL);
  assert(
    src !== null,
    'src/api/concept/pullClassThread.js does not exist yet. Implementer must create the handler per ADR 0009 ' +
      '(z-tag recursive walk starting at the materialized community Superset from #11; owner-only via requireOwner).'
  );
  // Z-tag filter: `'#z'` (or `"#z"` or backtick) — the kind-39999 sub-graph
  // walk fetches events tagged at the current uuid via the existing
  // /api/relay/external endpoint, same primitive install.js uses.
  const hasZTag = /['"`]#z['"`]/.test(src);
  assert(
    hasZTag,
    'pullClassThread.js does not filter by `#z` tag (AC-3; ADR 0009). The z-tag recursive walk fetches ' +
      'events whose z-tag references the current uuid being walked — `{kinds:[39999], "#z":[<uuid>]}`. ' +
      'Without this filter, the walk has no traversal primitive.'
  );
  // Must also restrict to kind 39999 (the only kind that carries class-thread
  // membership); avoids fetching kind-1 notes or other event types.
  const hasKindFilter = /kinds\s*:\s*\[\s*39999\s*\]/.test(src);
  assert(
    hasKindFilter,
    'pullClassThread.js does not restrict the z-tag walk to kind 39999 (AC-3; ADR 0009). ' +
      'Add `kinds:[39999]` to the /api/relay/external filter alongside the #z tag.'
  );
});

test('T3: pullClassThread.js classifies and SETs :Set label on foreign Sets (AC-3, ADR 0009)', () => {
  const src = readMaybe(PULL);
  assert(src !== null, 'src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.');
  // buildImportCypher labels kind-39999 as :ListItem only. Class-thread
  // queries match `(:Superset)-[:IS_A_SUPERSET_OF]->(:Set)-[:HAS_ELEMENT]->…`,
  // so the Implementer MUST explicitly add :Set on classified Sets via the
  // existing precedent at src/api/normalize/index.js:2937 — `MATCH (n {uuid:$u}) SET n:Set`.
  // Elements stay :ListItem (correct for leaves).
  const re = /SET\s+\w+:Set\b/;
  assert(
    re.test(src),
    'pullClassThread.js does not SET :Set on classified foreign Sets (AC-3; ADR 0009). ' +
      'buildImportCypher gives kind-39999 events only :ListItem; without `SET n:Set` on Sets, ' +
      'class-thread traversals `(:Set)-[:HAS_ELEMENT]->…` will not include them and the ' +
      'reachability promise of Phase B is broken. Use precedent at normalize/index.js:2937: ' +
      '`MATCH (n {uuid:$u}) SET n:Set`.'
  );
});

test('T4: pullClassThread.js MERGEs canonical HAS_ELEMENT / IS_A_SUPERSET_OF with NO source property (AC-4 + AC-6, ADR 0009)', () => {
  const src = readMaybe(PULL);
  assert(src !== null, 'src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.');

  // Must MERGE at least one HAS_ELEMENT edge (for element membership) and at
  // least one IS_A_SUPERSET_OF edge (for set-subset hierarchy in the foreign
  // sub-graph). Both are canonical class-thread relationships.
  assert(
    /MERGE[^;]*:HAS_ELEMENT\b/.test(src),
    'pullClassThread.js does not MERGE a [:HAS_ELEMENT] edge (AC-4; ADR 0009). The canonical ' +
      'parent-Set→element relationship must be wired between foreign nodes.'
  );
  assert(
    /MERGE[^;]*:IS_A_SUPERSET_OF\b/.test(src),
    'pullClassThread.js does not MERGE a [:IS_A_SUPERSET_OF] edge (AC-4; ADR 0009). The canonical ' +
      'set-subset hierarchy must be wired between foreign nodes (pass-1d-direction-equivalent).'
  );

  // The honest-invariant gate: the new canonical edges must NOT carry a
  // `source` property. The #11 REFERENCES edge in install.js *does* carry
  // `source:'firmware-community'` (it's a Neo4j-only stub) — these new
  // edges are canonical class-thread relationships, not stubs, and ADR 0009
  // explicitly forbids `source`. Mirrors ADR 0008's IS_A_SUPERSET_OF posture.
  //
  // Sweep: for each MERGE clause involving HAS_ELEMENT or IS_A_SUPERSET_OF
  // in this file, the relationship pattern `[:TYPE …]` MUST NOT contain
  // a `{source:…}` property bag.
  const relPattern = /\[\s*:(HAS_ELEMENT|IS_A_SUPERSET_OF)\b[^\]]*\]/g;
  let m;
  while ((m = relPattern.exec(src)) !== null) {
    const matched = m[0];
    assert(
      !/\{[^}]*source[^}]*\}/.test(matched),
      `pullClassThread.js MERGE for :${m[1]} carries a source property — ADR 0009 forbids it ` +
        `(canonical class-thread relationships have no \`source\`, only Neo4j-only stubs like ` +
        `#11 REFERENCES do). Found: ${matched}`
    );
  }
});

test('T5: pullClassThread.js carries visited-set + max-depth termination guards (AC-5, ADR 0009)', () => {
  const src = readMaybe(PULL);
  assert(src !== null, 'src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.');
  // Termination guarantee 1: visited-set on uuid (prevents revisit / cycles).
  assert(
    /\bvisited\b/.test(src),
    'pullClassThread.js does not carry a visited-set guard (AC-5; ADR 0009). The z-tag walk MUST ' +
      'track visited uuids to prevent cycles and re-processing (deterministic-uuid + MERGE ' +
      'idempotency alone is not enough — cycles in pathological data would still cost relay calls).'
  );
  // Termination guarantee 2: max-depth bound (env-configurable per ADR 0009;
  // default 16). Implementer naming flexibility — match maxDepth, MAX_DEPTH,
  // or max_depth.
  assert(
    /maxDepth|MAX_DEPTH|max_depth/.test(src),
    'pullClassThread.js does not carry a max-depth termination guard (AC-5; ADR 0009). The walk MUST ' +
      'bound recursion depth (env BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH, default 16). Without a hard ' +
      'cap, deeply nested or cycle-bearing curator vocabularies could exhaust resources.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinel — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: install.js #11 Header materialization + REFERENCES MERGE + IS_A_SUPERSET_OF MERGE preserved (regression guard)', () => {
  const src = readMaybe(INSTALL);
  assert(src !== null, 'src/firmware/install.js not found — re-baseline this sentinel.');
  // Pin the full #11 contract that Phase B MUST NOT touch (Phase B is an
  // additive on-demand endpoint; install.js stays Phase A):
  // (a) /api/relay/external fetch (Header + Superset),
  // (b) /api/strfry/publish (no re-sign),
  // (c) buildImportCypher / executeCypher materialization,
  // (d) post-derive [:REFERENCES] MERGE with source:'firmware-community' (Neo4j-only stub),
  // (e) post-derive [:IS_A_SUPERSET_OF] MERGE (canonical, no source) — #11 Phase A anchor,
  // (f) explicit SET :Superset on the materialized community Superset.
  assert(src.includes('/api/relay/external'), 'R1: install.js no longer fetches via /api/relay/external — #8/#11 Header/Superset fetch broken.');
  assert(src.includes('/api/strfry/publish'), 'R1: install.js no longer publishes via /api/strfry/publish.');
  assert(/buildImportCypher|executeCypher/.test(src), 'R1: install.js no longer materializes via buildImportCypher/executeCypher (Rev-2 contract).');
  assert(/source\s*:\s*['"`]firmware-community['"`]/.test(src), 'R1: install.js no longer MERGEs REFERENCES with source:\'firmware-community\' — #8 Rev-2 contract broken.');
  assert(/:IS_A_SUPERSET_OF\]/.test(src), 'R1: install.js no longer MERGEs the cross-curator [:IS_A_SUPERSET_OF] edge — #11 Phase A anchor broken.');
  assert(/SET\s+\w+:Superset\b/.test(src), 'R1: install.js no longer SETs :Superset on the materialized community Superset — #11 label step broken.');
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
