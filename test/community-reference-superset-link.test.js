/**
 * Story #11 / ADR 0008 — Community-reference Superset link (Phase A).
 *
 * Extends pass_communityReferences (after the existing Header materialization)
 * to also: (1) fetch the community Superset 39999:<curatorPk>:<dtag>-superset
 * via the existing /api/relay/external (a `#d` filter containing the
 * `-superset` value), (2) publish + materialize via the proven primitives,
 * (3) explicitly SET :Superset on the materialized foreign node (kindToLabel
 * gives only :ListItem for 39999), (4) in the post-derive block, MERGE the
 * canonical (localSup)-[:IS_A_SUPERSET_OF]->(communitySup) edge after the
 * existing REFERENCES MERGE.
 *
 * Precedent: #5/#6/#8/#10. Source/structural sentinels pin the spec-required
 * code shape without prescribing implementer naming; the behavioral proof
 * (real install actually emits the -superset fetch, materializes :Superset,
 * forms the canonical edge between deterministic a-tags; idempotent; graceful
 * miss; Rule-5 audit interaction) is the **authoritative cycle-local smoke**
 * (Reviewer-required) — only the smoke can prove the foreign node ends up
 * `:NostrEvent:ListItem:Superset` and the cross-curator `IS_A_SUPERSET_OF`
 * matches between `(:Superset)…(:Superset)` class-thread traversal.
 *
 * T1/T2/T3 : FAIL pre-implementation, PASS post.
 * R1       : PASS pre AND post — regression guard on the existing
 *            pass_communityReferences Header materialization + post-derive
 *            REFERENCES MERGE. Flip ⇒ implementer broke prior behavior.
 */

const fs = require('fs');
const path = require('path');

const INSTALL = path.resolve(__dirname, '../src/firmware/install.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #11 is implemented per ADR 0008.
// ---------------------------------------------------------------------------

test('T1: pass_communityReferences fetches the -superset variant via /api/relay/external (AC-1, ADR 0008)', () => {
  const src = fs.readFileSync(INSTALL, 'utf8');
  // Match any tag-filter "#d" whose value contains "-superset" — the new
  // /api/relay/external filter the Implementer adds for the Superset fetch.
  // Pre-impl install.js's only #d filter is the bare slug (Header fetch);
  // post-impl gains a second filter referencing the `-superset` d-tag.
  const re = /['"`]#d['"`]\s*:\s*\[[^\]]*-superset/;
  assert(
    re.test(src),
    'install.js does not fetch the community Superset event by its -superset d-tag (AC-1; ADR 0008). ' +
      'Add a second /api/relay/external call in pass_communityReferences with a filter whose `#d` ' +
      'value contains `${dTag}-superset` (deterministic Phase-A resolution).'
  );
});

test('T2: install.js explicitly SETs :Superset on the materialized community Superset node (AC-1, ADR 0008)', () => {
  const src = fs.readFileSync(INSTALL, 'utf8');
  // buildImportCypher labels kind-39999 as :ListItem — the Superset label is
  // derived locally but NOT added to imported foreign events. Without an
  // explicit SET, class-thread queries that match `(:Superset)` won't include
  // the materialized community Superset, breaking the reachability claim.
  const re = /SET\s+\w+:Superset\b/;
  assert(
    re.test(src),
    'install.js does not explicitly SET :Superset on the materialized community Superset node ' +
      '(AC-1; ADR 0008). buildImportCypher gives :ListItem only for kind 39999; without ' +
      'SET n:Superset, class-thread queries `(:Superset)-[:IS_A_SUPERSET_OF]->…` will not ' +
      'traverse it and the reachability promise of Story #11 is broken.'
  );
});

test('T3: post-derive block MERGEs a canonical [:IS_A_SUPERSET_OF] edge after the existing :REFERENCES MERGE (AC-1, ADR 0008)', () => {
  const src = fs.readFileSync(INSTALL, 'utf8');
  // install.js already contains IS_A_SUPERSET_OF MERGEs upstream (existing-sets
  // wiring + concept manifest wiring in pass1). To pin the NEW post-derive
  // MERGE specifically, require the last :IS_A_SUPERSET_OF appearance to be
  // AFTER the existing post-derive :REFERENCES] MERGE.
  const iRef = src.lastIndexOf(':REFERENCES]');
  const iSuper = src.lastIndexOf(':IS_A_SUPERSET_OF]');
  assert(
    iRef !== -1,
    'Existing post-derive [:REFERENCES] MERGE not found in install.js — re-baseline this sentinel (the existing community-reference wiring may have moved).'
  );
  assert(
    iSuper !== -1 && iSuper > iRef,
    'install.js does not MERGE a canonical [:IS_A_SUPERSET_OF] edge in the post-derive block AFTER ' +
      'the existing :REFERENCES MERGE (AC-1; ADR 0008). Add the cross-curator class-thread edge ' +
      '`MATCH (a {uuid:$from}),(b {uuid:$to}) MERGE (a)-[:IS_A_SUPERSET_OF]->(b)` (no `source` ' +
      'property — this is the canonical relationship, not a Neo4j-only stub).'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinel — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: existing pass_communityReferences Header materialization + post-derive :REFERENCES MERGE preserved (regression guard)', () => {
  const src = fs.readFileSync(INSTALL, 'utf8');
  // Pin the Rev-2 contract: pass_communityReferences must still
  // (a) fetch via /api/relay/external,
  // (b) publish via /api/strfry/publish (no re-sign),
  // (c) materialize the Header via buildImportCypher/executeCypher, and
  // (d) post-derive MERGE the [:REFERENCES] edge.
  // Story #11 extends this — it must not break it.
  assert(src.includes('/api/relay/external'), 'R1: install.js no longer fetches via /api/relay/external — Header materialization broken.');
  assert(src.includes('/api/strfry/publish'), 'R1: install.js no longer publishes via /api/strfry/publish.');
  assert(/buildImportCypher|executeCypher/.test(src), 'R1: install.js no longer materializes via buildImportCypher/executeCypher (Rev 2 contract).');
  assert(/:\s*REFERENCES\s*\]/.test(src), 'R1: install.js no longer MERGEs the [:REFERENCES] placeholder edge (ADR 0005 contract).');
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
