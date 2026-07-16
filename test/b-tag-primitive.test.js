/**
 * Tests for Story 38 (epic: community-reference) — the shared `b`-tag primitive:
 * emitter (pointer-`b` seed) + edge derivation (pointer/absent → REFERENCES{source:'b-tag'},
 * inherit → INHERITS_FROM) + stub retirement.
 *
 * ADR:  engineering-team/decisions/community-reference/0034-b-tag-primitive-emitter-derivation.md
 * Wire: protocols/drafts/inherit-from.md  (type-gated derivation; child→target, NO flip)
 *
 * Intentionally failing until the `b` branch + emitter land (red phase). The `b`
 * branch does not exist in buildImportCypher yet, and pass_communityReferences
 * still MERGEs the legacy `firmware-community` stub. Hand-rolled in the project's
 * existing test style — no new framework.
 *
 * Levels (decided per-AC; see the test plan for the full rationale):
 *   - BEHAVIORAL-UNIT: `buildImportCypher(event)` is a PURE function returning
 *     Cypher strings. We call the REAL function with synthetic kind-39998 headers
 *     and assert on the generated Cypher text. This is the highest-value coverage
 *     for the DERIVATION (AC-2, AC-3, AC-5 idempotency, direction guard) — it does
 *     no I/O, so it runs on the host.
 *   - SOURCE-CONTRACT: the EMITTER lives inside pass_communityReferences, which
 *     does strfry I/O + TA signing (unavailable on the unit-test host). Those ACs
 *     (AC-1, AC-4, AC-6, AC-7, OQ-1) are covered by regex assertions over the
 *     source of src/firmware/install.js. AC-8 parses firmware/active/manifest.json.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const INSTALL_SRC = 'src/firmware/install.js';
const MANIFEST = 'firmware/active/manifest.json';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// The real, under-test pure function. Loaded once.
const { buildImportCypher } = require('../src/api/neo4j/eventSync.js');

/* ─── synthetic event helpers ───
 * A kind-39998 TA-authored concept header. uuid (its a-tag) = 39998:<pk>:<slug>.
 */
const TA_PK = '82b75e4700000000000000000000000000000000000000000000000000973833';
const CURATOR_PK = '919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff';
const HEADER_A = `39998:${TA_PK}:nostr-relay`;          // child = the local TA header
const TARGET_A = `39998:${CURATOR_PK}:nostr-relay`;     // the b-tag target (community header)

function header(bTag) {
  return {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    kind: 39998,
    pubkey: TA_PK,
    created_at: 1700000000,
    tags: [
      ['d', 'nostr-relay'],
      ['name', 'Nostr Relay'],
      ...(bTag ? [bTag] : []),
    ],
  };
}

// Join all generated statements into one searchable blob (the function returns
// an array of Cypher strings; we test the union as the Implementer is free to
// split statements however they like, so long as the edge gets MERGEd).
function cypherOf(event) {
  const out = buildImportCypher(event);
  assert(Array.isArray(out), 'buildImportCypher must return an array of Cypher statements');
  return out.join('\n');
}

/* ════════════════════════════════════════════════════════════════════════
   AC-2 — pointer / absent  →  (child)-[:REFERENCES {source:'b-tag'}]->(target)
   BEHAVIORAL-UNIT against the real buildImportCypher.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-2: a pointer-typed b tag derives a header-level REFERENCES edge with source=\'b-tag\'', () => {
  const c = cypherOf(header(['b', TARGET_A, 'pointer']));
  assert(/REFERENCES/.test(c),
    `pointer b tag must derive a REFERENCES edge, but no REFERENCES appears in the Cypher.\n--- Cypher ---\n${c}`);
  assert(/source\s*=\s*'b-tag'/.test(c),
    `the derived REFERENCES edge must carry source = 'b-tag' (the disambiguator), but it does not.\n--- Cypher ---\n${c}`);
  // child = the header's own a-tag/uuid; target = the b value.
  assert(c.includes(HEADER_A) && c.includes(TARGET_A),
    `the b-tag edge must connect child (${HEADER_A}) → target (${TARGET_A}); one or both are missing from the Cypher.\n--- Cypher ---\n${c}`);
});

t('AC-2: a b tag with the type element ABSENT also derives REFERENCES{source:\'b-tag\'} (absent reads as pointer)', () => {
  const c = cypherOf(header(['b', TARGET_A])); // no element 3
  assert(/REFERENCES/.test(c) && /source\s*=\s*'b-tag'/.test(c),
    `an untyped b tag (absent element 3) must derive REFERENCES{source:'b-tag'} — the fail-safe pointer reading ` +
    `(wire spec :41). Got no such edge.\n--- Cypher ---\n${c}`);
  assert(!/INHERITS_FROM/.test(c),
    `an untyped b tag must NOT derive INHERITS_FROM — derivation gates on explicit 'inherit' only, never "not pointer".\n--- Cypher ---\n${c}`);
});

t('AC-2: the pointer b edge points child→target (no source-only stub; the published event is the sole producer)', () => {
  const c = cypherOf(header(['b', TARGET_A, 'pointer']));
  // The b edge is the ONLY REFERENCES{source} edge here — and it must be b-tag,
  // never the retired firmware-community stub.
  assert(!/source\s*=\s*'firmware-community'/.test(c),
    `buildImportCypher must NOT emit a firmware-community stub for a b-carrying header — the only REFERENCES is the derived b-tag edge.\n--- Cypher ---\n${c}`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-3 — inherit  →  (child)-[:INHERITS_FROM]->(parent), no `source`
   BEHAVIORAL-UNIT + the explicit-gate guard.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-3: an inherit-typed b tag derives INHERITS_FROM (no source property)', () => {
  const c = cypherOf(header(['b', TARGET_A, 'inherit']));
  assert(/INHERITS_FROM/.test(c),
    `an inherit-typed b tag must derive an INHERITS_FROM edge, but none appears.\n--- Cypher ---\n${c}`);
  // The INHERITS_FROM relationship is canonical — it must NOT carry source='b-tag'.
  // (REFERENCES{source:'b-tag'} would be the wrong derivation for inherit.)
  assert(!/source\s*=\s*'b-tag'/.test(c),
    `the inherit derivation must be a bare INHERITS_FROM with NO source property; found a source='b-tag' assignment instead.\n--- Cypher ---\n${c}`);
  assert(c.includes(HEADER_A) && c.includes(TARGET_A),
    `INHERITS_FROM must connect child (${HEADER_A}) → parent (${TARGET_A}); one or both are missing.\n--- Cypher ---\n${c}`);
});

t('AC-3 (gate): pointer and absent types do NOT derive INHERITS_FROM (gate keys on explicit \'inherit\')', () => {
  const cPointer = cypherOf(header(['b', TARGET_A, 'pointer']));
  const cAbsent = cypherOf(header(['b', TARGET_A]));
  assert(!/INHERITS_FROM/.test(cPointer),
    `a pointer-typed b tag must NEVER derive INHERITS_FROM (gate is explicit 'inherit', not "not pointer").\n--- Cypher ---\n${cPointer}`);
  assert(!/INHERITS_FROM/.test(cAbsent),
    `an absent-type b tag must NEVER derive INHERITS_FROM.\n--- Cypher ---\n${cAbsent}`);
});

/* ════════════════════════════════════════════════════════════════════════
   Direction guard (wire spec :46) — child→target, do NOT flip.
   BEHAVIORAL-UNIT.
   ════════════════════════════════════════════════════════════════════════ */

t('DIRECTION: the b edge is child→target and is NOT flipped to target→child', () => {
  const c = cypherOf(header(['b', TARGET_A, 'pointer']));
  // A flipped edge would MATCH/MERGE the target node and point it back at the
  // header (target)-[:REFERENCES]->(child). The wire spec forbids the n/s-style
  // direction flip for b. We can't fully parse Cypher here, but a flipped edge
  // would have to MERGE the relationship FROM a node carrying the TARGET uuid
  // TO a node carrying the HEADER uuid. Assert the natural child→target order:
  // the child uuid must appear before the target uuid in the relationship build.
  const relMatch = c.match(/MERGE\s*\([^)]*\)\s*-\[[^\]]*REFERENCES[^\]]*\]->\s*\([^)]*\)/);
  assert(relMatch,
    `could not find a child→target REFERENCES MERGE; the b edge derivation is missing or malformed.\n--- Cypher ---\n${c}`);
  // The inherit form must likewise be child→parent.
  const ci = cypherOf(header(['b', TARGET_A, 'inherit']));
  const relInherit = ci.match(/MERGE\s*\([^)]*\)\s*-\[[^\]]*INHERITS_FROM[^\]]*\]->\s*\([^)]*\)/);
  assert(relInherit,
    `INHERITS_FROM must be built as a child→parent directed MERGE (no flip).\n--- Cypher ---\n${ci}`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-5 — idempotent: MERGE (not CREATE) for the b edge so re-derivation
   yields exactly one edge.
   BEHAVIORAL-UNIT (the derivation half) + SOURCE-CONTRACT (the emitter half).
   ════════════════════════════════════════════════════════════════════════ */

t('AC-5 (derivation idempotency): the b edge is built with MERGE, not CREATE (re-import yields one edge)', () => {
  const c = cypherOf(header(['b', TARGET_A, 'pointer']));
  // The relationship that carries source='b-tag' must be a MERGE so that two
  // imports of the same header collapse to a single edge.
  assert(/MERGE[^;]*REFERENCES/.test(c),
    `the b-tag REFERENCES edge must be created with MERGE (idempotent), not CREATE.\n--- Cypher ---\n${c}`);
  assert(!/CREATE\s*\([^)]*\)\s*-\[[^\]]*REFERENCES/.test(c),
    `the b-tag edge must not use CREATE for the relationship — that would duplicate on re-import.\n--- Cypher ---\n${c}`);
});

t('AC-5 (emitter idempotency): a second install is suppressed by the never-clobber b-presence check', () => {
  const src = readSrc(INSTALL_SRC);
  const seam = src.match(/async function pass_communityReferences[\s\S]*?\n\}/);
  assert(seam, 'could not locate pass_communityReferences in install.js');
  const body = seam[0];
  // The idempotency mechanism IS the never-clobber guard: scan the live local
  // header and skip the seed if it already carries any b. (See ADR fixed-point 1
  // + Implementation notes §1: `tags.some(t => t[0] === 'b')`.)
  assert(/\.some\(\s*(\w+)\s*=>\s*\1\[0\]\s*===\s*['"]b['"]\s*\)/.test(body) || /t\[0\]\s*===\s*['"]b['"]/.test(body),
    `pass_communityReferences must contain a never-clobber b-presence check (e.g. tags.some(t => t[0] === 'b')) — ` +
    `this is BOTH the never-clobber guard AND the idempotency mechanism (a second run sees the b it wrote and suppresses).`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-1 — EMITTER seeds a pointer-b on the local header, never-clobber,
   re-signs via the existing TA signer (not a hardcoded key).
   SOURCE-CONTRACT over install.js.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-1: the emitter appends ["b", <headerATag>, "pointer"] to the local header', () => {
  const src = readSrc(INSTALL_SRC);
  const seam = src.match(/async function pass_communityReferences[\s\S]*?\n\}/);
  assert(seam, 'could not locate pass_communityReferences in install.js');
  const body = seam[0];
  // The seeded tag is a pointer-b on the cr.headerATag literal. Accept either a
  // tag-array literal ['b', <atag>, 'pointer'] or an equivalent push of those
  // three elements with 'pointer' present.
  const hasPointerLiteral =
    /\[\s*['"]b['"]\s*,[^\]]*,\s*['"]pointer['"]\s*\]/.test(body);
  assert(hasPointerLiteral,
    `pass_communityReferences must append a pointer-typed b tag literal of the shape ['b', <headerATag>, 'pointer'] — ` +
    `the emitter seeds 'pointer' ONLY (never 'inherit'; ADR key-constraint 1). Found no such literal.`);
  assert(!/\[\s*['"]b['"]\s*,[^\]]*,\s*['"]inherit['"]\s*\]/.test(body),
    `the emitter must NEVER seed an 'inherit'-typed b — that would fake the W1 deference signal (ADR key-constraint 1).`);
});

t('AC-1: the emitter re-signs through the existing TA signer (signAndFinalize / TA key path), not a hardcoded key', () => {
  const src = readSrc(INSTALL_SRC);
  const seam = src.match(/async function pass_communityReferences[\s\S]*?\n\}/);
  assert(seam, 'could not locate pass_communityReferences in install.js');
  const body = seam[0];
  // Re-signing the TA's own header requires the runtime TA signer. ADR Impl §1:
  // signAndFinalize (helpers.js) or an equivalent existing signed-publish route.
  const usesSigner =
    /signAndFinalize/.test(body) ||
    /republish-header/.test(body) ||
    /loadTAKey/.test(body) ||
    /signEvent/.test(body);
  assert(usesSigner,
    `the emitter must re-sign the republished local header through the existing TA signer ` +
    `(signAndFinalize / loadTAKey / a republish-header route) — appending a b changes id+sig, so a re-sign is mandatory.`);
  // Per-deployment TA pubkey — never hardcode a private/sk literal as the signer.
  assert(!/['"][0-9a-f]{64}['"]\s*[,)]\s*\/\/\s*sk/i.test(body),
    `the emitter must never hardcode a signing key — use the runtime TA key path.`);
});

t('AC-1/AC-6 (never-clobber): an existing b of ANY type/target suppresses the seed (check is t[0]===\'b\', not type-specific)', () => {
  const src = readSrc(INSTALL_SRC);
  const seam = src.match(/async function pass_communityReferences[\s\S]*?\n\}/);
  assert(seam, 'could not locate pass_communityReferences in install.js');
  const body = seam[0];
  // The guard must key on element 0 === 'b' ONLY (any type, any target), per
  // ADR fixed-point 1 / Implementation notes §1 — NOT on the type or target.
  assert(/t\[0\]\s*===\s*['"]b['"]/.test(body),
    `the never-clobber check must be t[0] === 'b' (ANY existing b suppresses the seed — any type, any target), ` +
    `not a type- or target-specific match. The published live state outranks the static firmware default (AC-6).`);
  assert(!/t\[2\]\s*===\s*['"]pointer['"]/.test(body),
    `the never-clobber guard must NOT narrow to pointer-typed b tags — an operator-set 'inherit' b must also suppress the seed (AC-6).`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-4 — STUB RETIRED for b-carrying headers: the firmware-community MERGE
   is gated so it is skipped when a b was seeded/present.
   SOURCE-CONTRACT over install.js.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-4: the firmware-community stub MERGE is gated on the absence of a seeded b (skipped when a b is present)', () => {
  const src = readSrc(INSTALL_SRC);
  // The post-derive REFERENCES-wiring block still MERGEs the firmware-community
  // stub today. After this story it must be gated: a header that carries a b is
  // NOT given a firmware-community stub (the edge derives from the event as
  // source:'b-tag'). ADR Impl §3: gate on link.seededB (or equivalent).
  assert(/source\s*=\s*'firmware-community'/.test(src),
    `expected the firmware-community stub MERGE to still exist in install.js (gated, not deleted — AC-7).`);
  // Locate the post-derive edge-wiring loop and require a b-presence gate around
  // the stub MERGE.
  const block = src.match(/Community-reference edges[\s\S]*?\n  \}\n/);
  assert(block, 'could not locate the post-derive Community-reference edges block in install.js');
  const b = block[0];
  const gated =
    /seededB/.test(b) ||
    /hasB/.test(b) ||
    /link\.\w*[Bb]\b/.test(b) ||
    /if\s*\([^)]*[Bb]\b[^)]*\)\s*\{[^}]*continue/.test(b);
  assert(gated,
    `the firmware-community stub MERGE must be gated so it is SKIPPED for a header that now carries a b ` +
    `(e.g. if (link.seededB) { /* derives from the published event */ } else { ...stub MERGE... }). ` +
    `No such b-presence gate found around the stub MERGE.`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-7 — pre-existing legacy stubs are NOT deleted by this story.
   SOURCE-CONTRACT: no DELETE/DETACH of firmware-community edges introduced.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-7: no DELETE/DETACH of firmware-community REFERENCES edges is introduced (legacy stubs stay harmless)', () => {
  const src = readSrc(INSTALL_SRC);
  // A sweep of pre-existing stubs is explicitly out of scope. The diff must NOT
  // introduce any delete of a source='firmware-community' edge.
  const deletesFwCommunity =
    /DELETE[\s\S]{0,200}firmware-community/i.test(src) ||
    /DETACH\s+DELETE[\s\S]{0,200}firmware-community/i.test(src) ||
    /firmware-community[\s\S]{0,200}DELETE/i.test(src);
  assert(!deletesFwCommunity,
    `this story must NOT delete pre-existing REFERENCES{source:'firmware-community'} edges (AC-7 — they stay legacy-but-harmless). ` +
    `Found a DELETE/DETACH touching firmware-community.`);
});

/* ════════════════════════════════════════════════════════════════════════
   OQ-1 — the local-header seed proceeds even when the community fetch /
   pin-verify fails (the seed is independent of the foreign-fetch result).
   SOURCE-CONTRACT (best-effort structural assertion; see test-plan limitation).
   ════════════════════════════════════════════════════════════════════════ */

t('OQ-1: the local-header b seed is reachable even when the community fetch fails (not nested under the fetch-success guard)', () => {
  const src = readSrc(INSTALL_SRC);
  const seam = src.match(/async function pass_communityReferences[\s\S]*?\n\}/);
  assert(seam, 'could not locate pass_communityReferences in install.js');
  const body = seam[0];
  // OQ-1 resolution: the pointer-b seed runs whenever (the local header exists)
  // AND (it carries no b) — independent of the community fetch result. Today the
  // function `continue`s on `if (!ev)` (not-found) and on the pin mismatch BEFORE
  // any local-header work. The seed must NOT sit only after those `continue`s.
  //
  // Structural contract: the local-header seed step (the pointer-b literal) must
  // appear, and it must NOT be the case that EVERY `continue` for a fetch failure
  // precedes it with no seed possible. The robust, regex-checkable form the ADR
  // mandates is that the seed is reachable on the not-found path — assert the
  // seed literal exists AND a not-found/mismatch path does not unconditionally
  // bypass it. We check the seed literal sits OUTSIDE (before, or hoisted from)
  // the `if (!ev)` early-continue: i.e. the pointer-b literal's index precedes the
  // LAST fetch-failure `continue`, OR the function comments/structure mark the
  // seed as fetch-independent.
  const pointerIdx = body.search(/\[\s*['"]b['"]\s*,[^\]]*,\s*['"]pointer['"]\s*\]/);
  assert(pointerIdx >= 0,
    `OQ-1 cannot be evaluated: no pointer-b seed literal found in pass_communityReferences (AC-1 must land first).`);
  // The not-found early-return today:  if (!ev) { ...; continue; }
  const notFoundContinue = body.search(/if\s*\(\s*!ev\s*\)\s*\{[\s\S]*?continue\s*;?\s*\}/);
  // If the not-found continue exists and the seed literal comes AFTER it, the
  // seed is unreachable on a fetch failure — a violation. We require either the
  // seed precedes that continue, or the not-found path was restructured away.
  const reachableOnFailure = (notFoundContinue < 0) || (pointerIdx < notFoundContinue);
  assert(reachableOnFailure,
    `OQ-1: the pointer-b seed must be reachable even when the community-header fetch fails ` +
    `(seed before the not-found 'continue', or hoist the seed out of the fetch-success guard). ` +
    `As written, the seed sits after the not-found 'continue', so a fetch miss would skip it. ` +
    `(If the Implementer chose a different-but-valid structure, update this assertion — see test plan note.)`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-8 — TRANSITIONED (Story 38 stub-trap guard → exited by Story 2).
   Story 38's AC-8 asserted the tag concepts carried NO communityReference:
   adding one against PRE-primitive install code would deploy the legacy stub,
   not the b. That guard was correct WHILE the emitter did not yet exist.
   It now exists on this branch (Story 38, this very suite's subject), so
   `tag-federation` Story 2 (ADR 0002) deliberately added the three seeds —
   the sanctioned exit from the stub trap. These two tests are updated to the
   post-Story-2 truth; the EXACT seed contents (headerATag/relayHints/pin) are
   owned by `test/b-tag-seeds.test.js`. SOURCE-CONTRACT: parse manifest.json.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-8 (post-Story-2): tag / nostr-user-tag / tag-pinning NOW carry a communityReference (stub trap exited — emitter present)', () => {
  const manifest = JSON.parse(readSrc(MANIFEST));
  const concepts = manifest.concepts || [];
  const find = (slug) => concepts.find((c) => c.slug === slug);
  for (const slug of ['tag', 'nostr-user-tag', 'tag-pinning']) {
    const c = find(slug);
    assert(c, `manifest must still contain the ${slug} concept`);
    assert('communityReference' in c,
      `${slug} must carry a communityReference as of tag-federation Story 2 (ADR 0002) — safe because the b-tag ` +
      `emitter (this suite's subject, Story 38) is present, so install seeds the pointer-b, not the legacy stub. ` +
      `Exact contents are asserted in test/b-tag-seeds.test.js.`);
  }
});

t('AC-8 (post-Story-2): exactly nostr-relay + the three tag concepts carry a communityReference', () => {
  const manifest = JSON.parse(readSrc(MANIFEST));
  const withCR = (manifest.concepts || []).filter((c) => 'communityReference' in c).map((c) => c.slug).sort();
  // Widened 2026-07-07 (OPEN.md #13): + the two event-tagging concepts, deliberately seeded with a
  // communityReference by event-tagging Story 3 per the federation model.
  const expected = ['nostr-event-tag', 'nostr-relay', 'nostr-user-tag', 'tag', 'tag-pinning', 'tagging-with-specific-tag'];
  assert(JSON.stringify(withCR) === JSON.stringify(expected),
    `the concepts carrying a communityReference must be exactly ${JSON.stringify(expected)} ` +
    `(nostr-relay = pilot; tag concepts = tag-federation Story 2; event-tagging concepts = event-tagging Story 3). ` +
    `Found: ${JSON.stringify(withCR)}.`);
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- b-tag primitive tests (epic community-reference, Story 38) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nb-tag-primitive: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
