/**
 * Tests for Story 2 (epic: tag-federation, Half 2 — Part A) — seed the pointer-`b`
 * map on the three real tag concepts by APPLYING the b-tag primitive via manifest data.
 *
 * Story: engineering-team/stories/tag-federation/2-per-concept-b-tag-seeds.md
 * ADR:   engineering-team/decisions/tag-federation/0002-per-concept-b-tag-seeds.md
 * Prereq (the primitive — NOT re-tested here): community-reference ADR 0034 /
 *        engineering-team/stories/community-reference/38-b-tag-primitive-emitter-derivation.md
 *
 * Intentionally failing until the three `communityReference` blocks land in
 * firmware/active/manifest.json (red phase). Today only `nostr-relay` carries one;
 * `tag` / `nostr-user-tag` / `tag-pinning` carry none.
 *
 * SCOPE OF THIS FILE — DATA-CONTRACT ONLY (runnable on the host, no live stack):
 *   This story is a pure MANIFEST DATA change. The consuming code (the emitter +
 *   derivation + stub-gate) already exists on this branch and is covered by Story 38
 *   (test/b-tag-primitive.test.js). So the high-value, runnable-now coverage is to
 *   parse firmware/active/manifest.json and assert the exact data contract of the
 *   three new blocks (AC-1) plus a scope guard (nothing else gained a block).
 *
 *   The BEHAVIORAL outcome — reinstall → local header carries pointer-`b` →
 *   REFERENCES{source:'b-tag'} edge (AC-2/AC-3), no fresh stub (AC-4), idempotent /
 *   never-clobber (AC-5), graceful-skip on pin mismatch (AC-6) — is NOT host
 *   unit-testable: it needs a running stack (reinstall-then-inspect, ADR 0034 OQ-4 /
 *   ADR 0002 verify recipe). Those ACs are documented as a manual/live recipe in the
 *   test plan, NOT faked here. AC-7 (David PR breadcrumb) is a PR-description
 *   deliverable, not a test.
 *
 * Hand-rolled in the project's existing test style — no new framework (JS-without-build).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const MANIFEST = 'firmware/active/manifest.json';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── the exact contract the three blocks must satisfy (from ADR 0002 §"Exact
 *     manifest blocks to add") ─── */

// The ADR-0015 legacy COORDINATE — a data literal in the manifest (a `b`-tag value),
// NOT a runtime signing key. The headerATag pubkey segment must be exactly this for
// all three slugs (the named-exception expectation; see the documentation-as-test below).
const LEGACY_COORD = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

const EXPECTED_RELAY_HINTS = ['wss://dcosl.brainstorm.world'];

// slug → exact knownGoodEventId (canonical header ids, verified live on dcosl 2026-06-17).
const KNOWN_GOOD = {
  'tag': '6f38f7b7748cbece9f75d131f0c79392cc01fc24cac8a7bdd11a9fc9f24e6fd0',
  'nostr-user-tag': '7df925f78f7f416429b52d558712f1a33d018170a3558706024140199dfe7893',
  'tag-pinning': '69d36397d92c086b5c184840f5af91ad89ab2f7718fcc674418a0b80074c1eef',
};

const TAG_SLUGS = ['tag', 'nostr-user-tag', 'tag-pinning'];

// Parse once. A corrupt manifest (insertion broke a sibling object) fails HERE with a
// JSON parse error — which is itself a meaningful "manifest still valid" signal.
function loadManifest() {
  return JSON.parse(readSrc(MANIFEST));
}
function findConcept(manifest, slug) {
  return (manifest.concepts || []).find((c) => c.slug === slug);
}

/* ════════════════════════════════════════════════════════════════════════
   "Manifest still valid JSON / not corrupted" — the parse + sibling-integrity guard.
   If the Implementer's insertion broke a comma or a neighbouring object, this trips
   first (and clearly), before the more specific assertions.
   ════════════════════════════════════════════════════════════════════════ */

t('manifest.json still parses as valid JSON and the concepts array is intact', () => {
  let manifest;
  try {
    manifest = loadManifest();
  } catch (e) {
    throw new Error(`firmware/active/manifest.json must remain valid JSON after the insertion — ` +
      `it failed to parse: ${e.message}`);
  }
  assert(Array.isArray(manifest.concepts),
    'manifest.concepts must still be an array after the insertion');
  // The four relevant concepts must all still be present with their slug + dir
  // (the insertion must not have clobbered a sibling object).
  for (const slug of [...TAG_SLUGS, 'nostr-relay']) {
    const c = findConcept(manifest, slug);
    assert(c, `manifest.concepts must still contain the ${slug} concept (sibling object not clobbered)`);
    assert(typeof c.slug === 'string' && c.slug === slug,
      `the ${slug} concept must still carry its slug after the insertion`);
    assert(typeof c.dir === 'string' && c.dir.length > 0,
      `the ${slug} concept must still carry its dir after the insertion`);
  }
});

/* ════════════════════════════════════════════════════════════════════════
   AC-1 — manifest seeds present, EXACT (per slug): headerATag, relayHints,
   knownGoodEventId. One test per concept for crisp, descriptive failures.
   DATA-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

for (const slug of TAG_SLUGS) {
  t(`AC-1: the ${slug} concept carries a communityReference with the exact headerATag, relayHints, and knownGoodEventId`, () => {
    const manifest = loadManifest();
    const c = findConcept(manifest, slug);
    assert(c, `manifest must contain the ${slug} concept`);
    const cr = c.communityReference;
    assert(cr && typeof cr === 'object',
      `communityReference missing on concept ${slug} — Story 2 must add a communityReference block to it ` +
      `(per ADR 0002 §"Exact manifest blocks to add").`);

    const expectedHeaderATag = `39998:${LEGACY_COORD}:${slug}`;
    assert(cr.headerATag === expectedHeaderATag,
      `${slug}.communityReference.headerATag must be exactly "${expectedHeaderATag}" ` +
      `(the canonical header coordinate for this slug); got ${JSON.stringify(cr.headerATag)}.`);

    assert(deepEqual(cr.relayHints, EXPECTED_RELAY_HINTS),
      `${slug}.communityReference.relayHints must deep-equal ${JSON.stringify(EXPECTED_RELAY_HINTS)}; ` +
      `got ${JSON.stringify(cr.relayHints)}.`);

    assert(cr.knownGoodEventId === KNOWN_GOOD[slug],
      `${slug}.communityReference.knownGoodEventId must be exactly "${KNOWN_GOOD[slug]}" ` +
      `(the canonical header id verified live on dcosl); got ${JSON.stringify(cr.knownGoodEventId)}.`);
  });
}

/* ════════════════════════════════════════════════════════════════════════
   AC-1 — shape parity with nostr-relay: the three new blocks are not malformed —
   they carry the same KEY shape as the existing, proven nostr-relay block
   (headerATag + relayHints both present, both well-typed).
   DATA-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-1: the three new communityReference blocks share the KEY shape of the existing nostr-relay block (not malformed)', () => {
  const manifest = loadManifest();
  const relay = findConcept(manifest, 'nostr-relay');
  assert(relay && relay.communityReference,
    'nostr-relay must still carry its communityReference (the shape template)');
  const relayCr = relay.communityReference;
  // The shape contract the primitive consumes: headerATag (string) + relayHints (array).
  assert(typeof relayCr.headerATag === 'string' && Array.isArray(relayCr.relayHints),
    'precondition: the nostr-relay template must have a string headerATag and an array relayHints');

  for (const slug of TAG_SLUGS) {
    const c = findConcept(manifest, slug);
    const cr = c && c.communityReference;
    assert(cr && typeof cr === 'object',
      `${slug} must carry a communityReference object to compare shape against nostr-relay`);
    assert(typeof cr.headerATag === 'string' && cr.headerATag.length > 0,
      `${slug}.communityReference.headerATag must be a non-empty string (same shape as nostr-relay); ` +
      `got ${JSON.stringify(cr.headerATag)} — the block is malformed.`);
    assert(Array.isArray(cr.relayHints) && cr.relayHints.length > 0,
      `${slug}.communityReference.relayHints must be a non-empty array (same shape as nostr-relay); ` +
      `got ${JSON.stringify(cr.relayHints)} — the block is malformed.`);
  }
});

/* ════════════════════════════════════════════════════════════════════════
   AC-1 (documentation-as-test) — the headerATag pubkey segment is the ADR-0015
   LEGACY coordinate, not a runtime key. This encodes the named-exception
   expectation so a future reader who "fixes" it to a runtime lookup trips this test.
   DATA-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

t("AC-1: each headerATag's pubkey segment is the ADR-0015 LEGACY coordinate (a data literal, NOT a runtime TA key)", () => {
  const manifest = loadManifest();
  for (const slug of TAG_SLUGS) {
    const c = findConcept(manifest, slug);
    const cr = c && c.communityReference;
    assert(cr && typeof cr.headerATag === 'string',
      `${slug} must carry a communityReference.headerATag string`);
    // headerATag is "39998:<pubkey>:<slug>"; the middle segment is the coordinate.
    const parts = cr.headerATag.split(':');
    assert(parts.length === 3 && parts[0] === '39998',
      `${slug}.communityReference.headerATag must be a kind-39998 coordinate "39998:<pubkey>:<slug>"; ` +
      `got ${JSON.stringify(cr.headerATag)}.`);
    assert(parts[1] === LEGACY_COORD,
      `${slug}.communityReference.headerATag's pubkey segment must be the ADR-0015 LEGACY coordinate ` +
      `"${LEGACY_COORD}" — it is a DATA literal (a b-tag value), the sanctioned named exception, NOT a ` +
      `runtime TA-pubkey lookup. If you "fixed" this to a runtime key, you broke the cross-deployment map; ` +
      `see ADR 0002 §"Interaction check" + ADR 0015. Got pubkey segment ${JSON.stringify(parts[1])}.`);
    assert(parts[2] === slug,
      `${slug}.communityReference.headerATag's slug segment must be "${slug}"; got ${JSON.stringify(parts[2])}.`);
  }
});

/* ════════════════════════════════════════════════════════════════════════
   Stub-trap / scope guard (this story's AC-8-equivalent) — the diff added EXACTLY
   the three tag blocks and nothing crept in. The ONLY concepts carrying a
   communityReference must be nostr-relay + the three tag concepts.
   (Inverse of Story 38's AC-8 guard, which required the tag concepts to have NONE.)
   DATA-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

t('SCOPE GUARD: exactly nostr-relay + the three tag concepts carry a communityReference — nothing else crept in', () => {
  const manifest = loadManifest();
  const withCR = (manifest.concepts || [])
    .filter((c) => 'communityReference' in c)
    .map((c) => c.slug)
    .sort();
  const expected = ['nostr-relay', ...TAG_SLUGS].sort();
  assert(deepEqual(withCR, expected),
    `exactly these four concepts may carry a communityReference: ${JSON.stringify(expected)}. ` +
    `Found: ${JSON.stringify(withCR)}. This story adds EXACTLY the three tag blocks (tag, nostr-user-tag, ` +
    `tag-pinning) on top of the pre-existing nostr-relay — no more, no fewer, and nothing else.`);
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- b-tag seeds tests (epic tag-federation, Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nb-tag-seeds: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
