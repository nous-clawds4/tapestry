/**
 * Tests for Story 1 (epic: event-tagging) — the generic NIP-style spec.
 *
 * Story: engineering-team/stories/event-tagging/1-protocol-core-and-spec.md
 * ADR:   engineering-team/decisions/event-tagging/0001-protocol-core-and-spec.md
 *
 * SOURCE-CONTRACT assertions over the finalized spec and its index/pointer.
 * Intentionally failing until the Implementer finalizes the draft (red phase):
 * the current protocols/drafts/event-taggings.md lacks the metadata header,
 * normative polarity/d-tag definitions, the read-time/POV framing, the
 * relationship section, the README index entry, and the tags.md pointer flip;
 * and it still contains invalid `//` comments inside JSON examples.
 *
 * We keep David's indirect per-tag-header STRUCTURE — these tests check spec
 * completeness/hygiene, NOT the rejected reviewer collapse.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SPEC = 'protocols/drafts/event-taggings.md';
const README = 'protocols/README.md';
const TAGS = 'protocols/drafts/tags.md';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function read(rel) {
  const p = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} does not exist`);
  return fs.readFileSync(p, 'utf-8');
}
/** Return the bodies of every ```json fenced code block. */
function jsonBlocks(src) {
  return [...src.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─── AC-9: metadata header + title + normative bits + hygiene ───
t('spec: metadata header, title, normative d-tag + polarity, no // in JSON, relationship section', () => {
  const src = read(SPEC);

  // Standard protocols/ metadata header (README "Status ladder").
  assert(/^>\s*\*\*Repo metadata/m.test(src) || /^>\s*\*\*Status:/m.test(src),
    'spec must open with the protocols/ metadata block (> **Repo metadata** / Status)');
  assert(/📝\s*pre-NIP/.test(src), 'spec metadata must declare Status 📝 pre-NIP');
  assert(/^=+\s*$/m.test(src), 'spec must have a setext title underline (=====)');

  // Polarity defined (not merely used).
  assert(/dispute/i.test(src) && /-1/.test(src) && /apply/i.test(src),
    'spec must DEFINE polarity (apply / dispute / -1), not just use it');

  // Deterministic d-tag forms stated normatively.
  assert(src.includes('event-tag-') && /tagging:.*-tagging/.test(src),
    'spec must state the assertion (event-tag-…) and header (tagging:<slug>-tagging) d-tag forms');

  // Hygiene: no `//` comments inside JSON examples (invalid JSON).
  for (const block of jsonBlocks(src)) {
    assert(!/\/\//.test(block), 'JSON examples must not contain `//` comments (invalid JSON)');
  }

  // Reconciliation with the taggings family.
  assert(/Relationship to other specs/i.test(src), 'spec must have a "Relationship to other specs" section');
  assert(/tags\.md|\[Tags/i.test(src), 'spec must reference the tags.md family spec');

  // Firmware-seeding note for the two TA-authored headers.
  assert(/firmware|seed/i.test(src), 'spec must note the two DList headers are firmware-seeded by the per-deployment TA');
});

// ─── AC-10: read-time / POV framing ───
t('spec: discovery yields candidates; counting is a read-time per-POV op', () => {
  const src = read(SPEC);
  assert(/candidate/i.test(src), 'spec must frame discovery results as candidates (not global truth)');
  assert(/per-POV|read[ -]?time|point of view|POV/i.test(src),
    'spec must state that whether a tagging counts is a read-time, per-POV computation');
});

// ─── AC-9: no hardcoded deployment identity (stack leak) ───
t('spec: no literal 64-hex pubkey hardcoded', () => {
  const src = read(SPEC);
  const m = src.match(/[0-9a-f]{64}/);
  assert(!m, `spec must use placeholders/"the deployment's concept", not a literal 64-hex pubkey (found: ${m && m[0]})`);
});

// ─── AC-9: indexed in protocols/README.md ───
t('spec: indexed in protocols/README.md', () => {
  const src = read(README);
  assert(/event-tagging/i.test(src), 'protocols/README.md must index the event-tagging(s) spec');
});

// ─── AC-9: tags.md "Event tagging" section points to the spec ───
t('tags.md: "Event tagging" section points to event-taggings spec', () => {
  const src = read(TAGS);
  assert(/event-taggings/i.test(src),
    'tags.md must point its "Event tagging" section at the event-taggings spec (no longer "not yet specified")');
});

async function run() {
  console.log('\n--- event-tagging spec tests (epic event-tagging, Story 1) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nevent-tagging-spec: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
