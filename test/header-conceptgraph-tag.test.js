/**
 * Story #10 / ADR 0007 — Header→ConceptGraph self-describing tag (hybrid C).
 *
 * `handleCreateConcept` must emit, on the kind-39998 ConceptHeader, a
 * descriptive custom tag `["concept-graph", "39999:<pubkey>:<dtag>-concept-graph"]`
 * — the value COMPUTED from the header's own pubkey + d-tag (no Neo4j lookup),
 * so it is correct even before the concept-graph node exists. Resolution
 * contract (consumed by the deferred stream #5, NOT here): tag-if-present
 * else compute the same deterministic a-tag.
 *
 * Precedent: stories #5/#6/#8 — a source/structural sentinel pins the
 * spec-required emission without prescribing whether the Implementer
 * computes the value pre- or post-sign. The behavioral proof (the emitted
 * 39998 event actually carries the tag with the right value after a real
 * firmware reinstall) is NOT reproducible in this hand-rolled runner and is
 * the **authoritative cycle-local smoke** documented in the test plan
 * §"Not covered" — the Reviewer must treat that smoke as required.
 *
 * T1 : FAIL pre-implementation, PASS post.
 * R1 : PASS pre AND post — regression guard on the existing header builder;
 *      flips to FAIL only if the existing 39998 header tag shape is broken.
 */

const fs = require('fs');
const path = require('path');

const NORMALIZE = path.resolve(__dirname, '../src/api/normalize/index.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// The spec-required emission: a tag literal whose FIRST element is exactly
// `concept-graph` and whose value position contains a deterministic
// `39999:…-concept-graph` a-tag. Anchored on the tag-literal start so it does
// NOT false-match NODE_ROLES' 'concept-graph' role string, the
// `concept-header-for-the-concept-of-…` slugs, or `['z', conceptUuid('concept-graph')]`.
const CONCEPT_GRAPH_TAG = /\[\s*['"]concept-graph['"]\s*,\s*[`'"][^\n]*39999:[^\n]*-concept-graph/;

test('T1: handleCreateConcept emits the deterministic concept-graph tag on the 39998 header (AC-1, ADR 0007)', () => {
  const src = fs.readFileSync(NORMALIZE, 'utf8');
  assert(
    CONCEPT_GRAPH_TAG.test(src),
    'src/api/normalize/index.js does not emit a `["concept-graph", "39999:<pubkey>:<dtag>-concept-graph"]` ' +
      'tag on the kind-39998 ConceptHeader (AC-1; ADR 0007 Option A). Add it to the `headerTags` ' +
      'array in handleCreateConcept (~:1244), value COMPUTED from the header pubkey + d-tag — ' +
      'no Neo4j lookup. STRUCTURAL sentinel only; the authoritative proof (a real reinstalled ' +
      '39998 event actually carries the tag with the right value) is the cycle-local smoke in the plan.'
  );
});

test('R1: the existing 39998 header tag builder is preserved (regression guard)', () => {
  const src = fs.readFileSync(NORMALIZE, 'utf8');
  // ADR 0007: blast radius is one added tag — the existing header tag shape
  // (`['d', headerDTag]` + `['json', JSON.stringify(headerWord)]` in
  // handleCreateConcept) must remain intact. Flip to FAIL ⇒ the Implementer
  // disturbed the out-of-scope existing header construction.
  assert(
    /\[\s*['"]d['"]\s*,\s*headerDTag\s*\]/.test(src) &&
      /\[\s*['"]json['"]\s*,\s*JSON\.stringify\(headerWord\)\s*\]/.test(src),
    'The existing kind-39998 header tag construction in handleCreateConcept ' +
      "(`['d', headerDTag]` and `['json', JSON.stringify(headerWord)]`) must be preserved — " +
      'ADR 0007 adds ONE tag and changes nothing else. Sentinel failing ⇒ out-of-scope change to the header builder.'
  );
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
