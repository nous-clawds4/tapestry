/**
 * Story #14 / ADR 0010 (mechanism amended by ADR 0011) — Community class-thread pull (Phase B).
 *
 * Adds an owner-only on-demand endpoint POST /api/concept/:handle/pull-community-class-thread
 * that materializes the curator's full class-thread vocabulary (Sets +
 * elements + canonical HAS_ELEMENT / IS_A_SUPERSET_OF edges) as a foreign
 * sub-graph reachable from the local concept only via the #11 anchor.
 *
 * ADR 0011 amended the walk mechanism: instead of the original z-tag
 * recursive walk (which didn't match Tapestry's actual published encoding),
 * Phase B walks single-char child-claims-parent tags `#n` (HAS_ELEMENT-inverse)
 * and `#s` (IS_A_SUPERSET_OF-inverse) — relay-indexed by default, decentralized
 * by construction, and structurally complete with no descriptor-event walking.
 * A back-compat z-at-Header walk (`#z=39998:<curatorPk>:<handle>`) runs at
 * the root iteration only, to cover curators' pre-amendment events on relays
 * without forcing curator-side migration. ADR 0011 also adds a binding
 * authorship trust gate and a dual-emit policy on the local mutation sites
 * (handleCreateSet emits `s`; handleAddToSet emits `n` via republish), with
 * the existing descriptor-event publication preserved during the back-compat
 * cycle.
 *
 * Per ADR 0010 (carried forward) the new canonical edges carry no `source`
 * property; per ADR 0011 the walk terminates via visited-set + max-depth +
 * max-fetch budget and refuses to materialize cross-pubkey events.
 *
 * Precedent: #5/#6/#8/#10/#11. Source/structural sentinels pin the spec-
 * required code shape without prescribing implementer naming; the behavioral
 * proof (real owner-authenticated POST + auth + /api/relay/external against
 * dcosl + real Neo4j + idempotency + honest invariants + trust-gate +
 * back-compat z-walk + Rule-5 audit interaction) is the **authoritative
 * cycle-local smoke S1–S12** (Reviewer-required, per ADR 0011).
 *
 * T1–T8 : FAIL pre-implementation, PASS post.
 * R1, R2: PASS pre AND post — regression guards.
 *   R1 pins the #11 install.js contract (Phase B is purely additive; install.js
 *     stays Phase A).
 *   R2 pins the dual-emit policy (handleCreateSet + handleAddToSet continue
 *     to publish descriptor events alongside the new `s`/`n` tags). The
 *     deferred cutover ADR will eventually flip R2 — until then, R2 protects
 *     against premature cutover.
 */

const fs = require('fs');
const path = require('path');

const PULL = path.resolve(__dirname, '../src/api/concept/pullClassThread.js');
const INDEX = path.resolve(__dirname, '../src/api/index.js');
const INSTALL = path.resolve(__dirname, '../src/firmware/install.js');
const NORMALIZE = path.resolve(__dirname, '../src/api/normalize/index.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function readMaybe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #14 is implemented per ADR 0011.
// ---------------------------------------------------------------------------

test('T1: POST /api/concept/:handle/pull-community-class-thread is registered with requireOwner middleware (AC-1, ADR 0010 §"Surface")', () => {
  const idx = readMaybe(INDEX);
  assert(idx !== null, 'src/api/index.js not found — re-baseline this sentinel.');
  // Match the exact ADR-mandated route + verb + middleware, allowing the
  // handler reference to be any identifier (Implementer naming freedom).
  // Precedent: #9 uses `app.get('/api/concept/:handle/export-set', requireOwner, handleConceptExportSet);`
  const re = /app\.post\(\s*['"`]\/api\/concept\/:handle\/pull-community-class-thread['"`]\s*,\s*requireOwner\s*,\s*\w+/;
  assert(
    re.test(idx),
    'src/api/index.js does not register POST /api/concept/:handle/pull-community-class-thread with the ' +
      'requireOwner middleware (AC-1; ADR 0010 §"Surface"). Mirror Story #9\'s export-set registration at ' +
      'line 491 — POST verb, exact literal path, requireOwner as second argument, handler as third.'
  );
});

test('T2: pullClassThread.js walks #n AND #s tag filters at kind 39999 (AC-3, ADR 0011 §"Phase B walk mechanism")', () => {
  const src = readMaybe(PULL);
  assert(
    src !== null,
    'src/api/concept/pullClassThread.js does not exist yet. Implementer must create the handler per ADR 0011 ' +
      '(single-char #n/#s child-claims-parent tag walk from the #11 community Superset anchor; owner-only via requireOwner).'
  );
  // Per ADR 0011 §"Phase B walk mechanism": the walk fetches kind-39999 events
  // whose `#n` tag references the current parent (direct elements) AND whose
  // `#s` tag references the current parent (direct sub-Sets/Supersets) via
  // /api/relay/external. Both filter shapes must appear.
  const hasNTag = /['"`]#n['"`]/.test(src);
  assert(
    hasNTag,
    'pullClassThread.js does not filter by `#n` tag (AC-3; ADR 0011). The HAS_ELEMENT-inverse walk fetches ' +
      'events claiming this parent via the canonical `n` tag — `{kinds:[39999], "#n":[<parentUuid>]}`. ' +
      'Without this filter, the walk has no element-discovery primitive.'
  );
  const hasSTag = /['"`]#s['"`]/.test(src);
  assert(
    hasSTag,
    'pullClassThread.js does not filter by `#s` tag (AC-3; ADR 0011). The IS_A_SUPERSET_OF-inverse walk ' +
      'fetches events claiming this parent via the canonical `s` tag — `{kinds:[39999], "#s":[<parentUuid>]}`. ' +
      'Without this filter, the walk cannot discover sub-Sets to recurse into.'
  );
  // Must also restrict to kind 39999 (the only kind that carries class-thread
  // membership); avoids fetching kind-1 notes or other event types.
  const hasKindFilter = /kinds\s*:\s*\[\s*39999\s*\]/.test(src);
  assert(
    hasKindFilter,
    'pullClassThread.js does not restrict the walk to kind 39999 (AC-3; ADR 0011). ' +
      'Add `kinds:[39999]` to the /api/relay/external filter alongside the #n / #s tag predicates.'
  );
});

test('T3: pullClassThread.js SETs :Set label on classified foreign Sets (AC-3, ADR 0011 §"Decision")', () => {
  const src = readMaybe(PULL);
  assert(src !== null, 'src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.');
  // buildImportCypher labels kind-39999 as :ListItem only. Class-thread
  // queries match `(:Superset)-[:IS_A_SUPERSET_OF]->(:Set)-[:HAS_ELEMENT]->…`,
  // so the Implementer MUST explicitly add :Set on classified Sets via the
  // existing precedent at src/api/normalize/index.js:2937 — `MATCH (n {uuid:$u}) SET n:Set`.
  // Per ADR 0011 the classification rule is: `isSet ⇔ event has z-tag = 39998:<curatorPk>:set`.
  // The classification predicate itself is implementer-detail; this sentinel
  // pins only the consequence (the SET cypher), which is the necessary
  // structural prerequisite for class-thread reachability. Cycle-local smoke
  // S6 verifies the classification rule materially reaches the correct Sets.
  // Elements stay :ListItem (correct for leaves).
  const re = /SET\s+\w+:Set\b/;
  assert(
    re.test(src),
    'pullClassThread.js does not SET :Set on classified foreign Sets (AC-3; ADR 0011). ' +
      'buildImportCypher gives kind-39999 events only :ListItem; without `SET n:Set` on Sets, ' +
      'class-thread traversals `(:Set)-[:HAS_ELEMENT]->…` will not include them. Use precedent at ' +
      'normalize/index.js:2937: `MATCH (n {uuid:$u}) SET n:Set`. Classification rule per ADR 0011: ' +
      '`isSet ⇔ event has z-tag = 39998:<curatorPk>:set`.'
  );
});

test('T4: pullClassThread.js MERGEs canonical HAS_ELEMENT / IS_A_SUPERSET_OF with NO source property (AC-4 + AC-6, ADR 0010 §"Trust constraints" + ADR 0011 §"Decision")', () => {
  const src = readMaybe(PULL);
  assert(src !== null, 'src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.');

  // Must MERGE at least one HAS_ELEMENT edge (from the #n walk + back-compat z-walk)
  // and at least one IS_A_SUPERSET_OF edge (from the #s walk). Both are
  // canonical class-thread relationships between foreign sub-graph nodes.
  assert(
    /MERGE[^;]*:HAS_ELEMENT\b/.test(src),
    'pullClassThread.js does not MERGE a [:HAS_ELEMENT] edge (AC-4; ADR 0011). The canonical ' +
      'parent-Set→element relationship must be wired between foreign nodes for events found via the ' +
      '#n walk (and via the back-compat z-walk at the root iteration).'
  );
  assert(
    /MERGE[^;]*:IS_A_SUPERSET_OF\b/.test(src),
    'pullClassThread.js does not MERGE a [:IS_A_SUPERSET_OF] edge (AC-4; ADR 0011). The canonical ' +
      'set-subset hierarchy must be wired between foreign nodes for events found via the #s walk ' +
      '(pass-1d-direction-equivalent: parent → child).'
  );

  // The honest-invariant gate: the new canonical edges must NOT carry a
  // `source` property. The #11 REFERENCES edge in install.js *does* carry
  // `source:'firmware-community'` (it's a Neo4j-only stub) — these new
  // edges are canonical class-thread relationships, not stubs, and ADR 0011
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
      `pullClassThread.js MERGE for :${m[1]} carries a source property — ADR 0011 forbids it ` +
        `(canonical class-thread relationships have no \`source\`, only Neo4j-only stubs like ` +
        `#11 REFERENCES do). Found: ${matched}`
    );
  }
});

test('T5: pullClassThread.js carries visited-set + max-depth termination guards (AC-5, ADR 0011 §"Phase B walk mechanism")', () => {
  const src = readMaybe(PULL);
  assert(src !== null, 'src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.');
  // Termination guarantee 1: visited-set on uuid (prevents revisit / cycles).
  assert(
    /\bvisited\b/.test(src),
    'pullClassThread.js does not carry a visited-set guard (AC-5; ADR 0011). The walk MUST ' +
      'track visited uuids to prevent cycles and re-processing.'
  );
  // Termination guarantee 2: max-depth bound (env-configurable per ADR 0011;
  // default 16). Implementer naming flexibility — match maxDepth, MAX_DEPTH,
  // or max_depth.
  assert(
    /maxDepth|MAX_DEPTH|max_depth/.test(src),
    'pullClassThread.js does not carry a max-depth termination guard (AC-5; ADR 0011). The walk MUST ' +
      'bound recursion depth (env BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH, default 16). Without a hard ' +
      'cap, deeply nested or cycle-bearing curator vocabularies could exhaust resources.'
  );
});

test('T6: pullClassThread.js enforces authorship trust gate (skips events whose pubkey !== curatorPk) (ADR 0011 §"Trust constraints" §1)', () => {
  const src = readMaybe(PULL);
  assert(src !== null, 'src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.');
  // ADR 0011 §"Trust constraints" §1 (binding): Phase B MUST refuse to
  // materialize events whose `pubkey !== curatorPk`. This prevents
  // cross-instance election — someone publishing an event with
  // `['n', '39999:<my-localTA>:my-superset']` cannot trick Phase B into
  // MERGEing edges that elect their content into the local class thread.
  //
  // The pattern is implementer-flexible — match any comparison form
  // involving pubkey + a curator-pubkey identifier:
  //   - `if (ev.pubkey !== curatorPk)` — skip-and-log
  //   - `if (event.pubkey === curatorPk)` — positive-guard
  const hasTrustGate = /pubkey\s*(?:!==|===|!=|==)\s*\w*[Cc]urator/.test(src)
    || /\w*[Cc]urator\w*\s*(?:!==|===|!=|==)\s*\w*\.?pubkey/.test(src);
  assert(
    hasTrustGate,
    'pullClassThread.js does not enforce the authorship trust gate (ADR 0011 §"Trust constraints" §1). ' +
      'Phase B MUST skip events whose `pubkey !== curatorPk` to prevent cross-instance election. Add ' +
      'a guard early in the per-event processing loop, e.g. `if (ev.pubkey !== curatorPk) { ' +
      'stats.skipped++; stats.errors.push({step:"trust-gate", uuid:uuidOf(ev), reason:"non-curator author"}); continue; }`. ' +
      'Reviewer audit + cycle-local smoke S12 verify the gate.'
  );
});

test('T7: handleCreateSet emits child-claims-parent `s` tag on the Set event (ADR 0011 §"Emission in handleCreateSet")', () => {
  const src = readMaybe(NORMALIZE);
  assert(src !== null, 'src/api/normalize/index.js not found — re-baseline this sentinel.');
  // ADR 0011 §"Emission in handleCreateSet": before the `signAndFinalize`
  // call (line ~2934), prepend `['s', resolvedParentUuid]` to the Set
  // event's tags array (or `tags.push(['s', resolvedParentUuid])`).
  //
  // Pre-impl: zero occurrences of `['s', ` in normalize/index.js (baseline-verified).
  // Post-impl: at least one — the handleCreateSet emission.
  const hasSTagEmission = /\[\s*['"`]s['"`]\s*,/.test(src);
  assert(
    hasSTagEmission,
    'src/api/normalize/index.js does not emit the canonical `s` tag (ADR 0011 §"Emission in handleCreateSet"). ' +
      'In handleCreateSet (line ~2934), add `tags.push([\'s\', resolvedParentUuid]);` before signAndFinalize. ' +
      'Mirrors the existing z-tag pattern: lowercase single-char tag with the parent\'s a-tag form as value. ' +
      'Dual-emit policy — keep the existing descriptor-event publication unchanged (R2 regression-guards it).'
  );
});

test('T8: handleAddToSet emits child-claims-parent `n` tag on the source event via republish (ADR 0011 §"Emission in handleAddToSet")', () => {
  const src = readMaybe(NORMALIZE);
  assert(src !== null, 'src/api/normalize/index.js not found — re-baseline this sentinel.');
  // ADR 0011 §"Emission in handleAddToSet": handleAddToSet doesn't create the
  // source event — it adds an existing item to a set. To get the `n` tag
  // onto the source event, the Implementer republishes the item as a
  // replaceable kind-39999 event with existing tags + the new `n` tag.
  //
  // Pre-impl: zero occurrences of `['n', ` in normalize/index.js (baseline-verified).
  // Post-impl: at least one — the handleAddToSet emission.
  //
  // Edge case acknowledged in ADR 0011: items NOT authored by the local TA
  // cannot be re-signed; in that case, emit the descriptor event only and
  // log a warning. The sentinel anchors on the *presence* of the `n` tag
  // emission, accepting that mixed-authorship paths may skip it conditionally.
  const hasNTagEmission = /\[\s*['"`]n['"`]\s*,/.test(src);
  assert(
    hasNTagEmission,
    'src/api/normalize/index.js does not emit the canonical `n` tag (ADR 0011 §"Emission in handleAddToSet"). ' +
      'In handleAddToSet (line ~3014), build and publish a replaceable kind-39999 event with the existing ' +
      'source tags + `[\'n\', setUuid]` added, before publishing the descriptor event. Locally-authored items ' +
      'only (foreign-authored items cannot be re-signed — log + skip the `n` tag for those; descriptor event ' +
      'still emitted). Dual-emit policy — keep the existing descriptor-event publication unchanged (R2).'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — PASS now AND post-implementation.
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

test('R2: handleCreateSet + handleAddToSet still emit descriptor events (dual-emit policy regression guard, ADR 0011 §"Emission policy")', () => {
  const src = readMaybe(NORMALIZE);
  assert(src !== null, 'src/api/normalize/index.js not found — re-baseline this sentinel.');
  // ADR 0011 §"Emission policy (dual-emit cycle)": for one full release
  // cycle after this ADR ships, every mutation that creates a class-thread
  // relationship emits BOTH the new `n`/`s` tag on the child event AND the
  // existing relationship-descriptor event. The cutover is a future ADR;
  // until then, R2 protects against premature cutover.
  //
  // The descriptor-event pattern is `kind: 39999` events tagged with
  // `relationshipType` (line ~2948 IS_A_SUPERSET_OF descriptor, line ~3022
  // HAS_ELEMENT descriptor). Pin two binding patterns: the
  // `['relationshipType', REL.CLASS_THREAD_PROPAGATION]` (IS_A_SUPERSET_OF
  // descriptor) and `['relationshipType', REL.CLASS_THREAD_TERMINATION]`
  // (HAS_ELEMENT descriptor) — both must remain.
  assert(
    /\[\s*['"`]relationshipType['"`]\s*,\s*REL\.CLASS_THREAD_PROPAGATION\s*\]/.test(src),
    'R2: src/api/normalize/index.js no longer emits the IS_A_SUPERSET_OF descriptor event in handleCreateSet ' +
      '(ADR 0011 §"Emission policy" — dual-emit MUST continue during the back-compat cycle). The literal ' +
      '`["relationshipType", REL.CLASS_THREAD_PROPAGATION]` (line ~2948) must remain. The cutover to drop ' +
      'descriptor emission is a future ADR; do not cut over prematurely.'
  );
  assert(
    /\[\s*['"`]relationshipType['"`]\s*,\s*REL\.CLASS_THREAD_TERMINATION\s*\]/.test(src),
    'R2: src/api/normalize/index.js no longer emits the HAS_ELEMENT descriptor event in handleAddToSet ' +
      '(ADR 0011 §"Emission policy" — dual-emit MUST continue during the back-compat cycle). The literal ' +
      '`["relationshipType", REL.CLASS_THREAD_TERMINATION]` (line ~3022) must remain. The cutover to drop ' +
      'descriptor emission is a future ADR; do not cut over prematurely.'
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
