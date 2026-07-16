/**
 * Tests for Story 3 (epic: tag-federation, Half 2 — Part B) — the DUAL-Z WRITER.
 *
 * Story: engineering-team/stories/tag-federation/3-dual-z-writer.md
 * ADR:   engineering-team/decisions/tag-federation/0003-dual-z-writer.md
 *
 * Intentionally failing until the two client writers stamp a SECOND `z` (the
 * local, runtime-TA-composed coordinate) alongside the existing canonical z, and
 * until the runtime `taPubkey` is threaded into the assertion writer + call sites
 * (red phase). Today each writer carries exactly ONE z (the canonical literal).
 *
 * SCOPE OF THIS FILE — SOURCE-CONTRACT REGEX ONLY (runnable on the host, no live
 * stack):
 *   The two writers are ESM under `ui/` (`ui/package.json` → "type":"module") and
 *   are NOT `require()`-able from this CJS root runner (`node test/test.js`) — the
 *   same constraint every prior tag story hit (see test/tag-read-union.test.js,
 *   test/b-tag-seeds.test.js, test/b-tag-primitive.test.js). So the runnable-now
 *   coverage is SOURCE-CONTRACT regex tests: read the two writer files (+ the two
 *   call-site files) with fs.readFileSync and assert on their source text.
 *
 *   The BEHAVIORAL outcome — AC-4 (a new tagging lands in instance X's local
 *   concept list `39998:<X's TA>:nostr-user-tag`) and AC-5 (no migration / still
 *   network-visible) — is NOT host unit-testable: it needs a running stack +
 *   NIP-07 + relay inspection (ADR 0003 §"Verification plan"). Those ACs are
 *   documented as a live Playwright/manual recipe in the test plan, NOT faked here.
 *   AC-7 (David PR breadcrumb) is a PR-description deliverable, not a test.
 *
 *   ⚠️ Dev-box degenerate-z caveat (ADR 0003): on THIS box the local TA equals the
 *   canonical coordinate (`/api/assistant/pubkey` → 82b75e47…), so the two z's
 *   resolve to IDENTICAL strings here. The assertion of record is therefore "the
 *   writer emits TWO z entries by construction, the second one composed from the
 *   RUNTIME taPubkey arg (not a literal)" — NOT "the two values differ". The
 *   distinct-value case only manifests on a non-dev TA.
 *
 * Hand-rolled in the project's existing test style — no new framework (JS-without-build).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

const USE_PROFILE_TAGS = 'ui/src/hooks/useProfileTags.js';
const PUBLISH_PROFILE_TAG = 'ui/src/utils/publishProfileTag.js';
const TAG_PAGE = 'ui/src/pages/Tag.jsx';

// The ADR-0015 legacy canonical COORDINATE — a data literal (a z-tag value), the
// sanctioned named exception. The CANONICAL z is allowed to reference this; the
// LOCAL z must NOT introduce a fresh copy of it (AC-6 anti-hardcode).
const LEGACY_COORD = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/**
 * Extract the literal text of the FIRST `tags: [ ... ]` array in a source string
 * starting at a given offset, balancing brackets. Returns the inner text (between
 * the outer `[` and its matching `]`). Used to scope assertions to the writer's
 * tags array (not the whole file).
 */
function extractTagsArray(src, fromIndex = 0) {
  const key = src.indexOf('tags:', fromIndex);
  assert(key !== -1, 'could not locate a `tags:` array in the source');
  const open = src.indexOf('[', key);
  assert(open !== -1, 'could not locate the opening `[` of the `tags:` array');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error('unbalanced brackets: could not find the closing `]` of the `tags:` array');
}

// Count occurrences of a `['z'` element opener inside a tags-array slice.
function countZEntries(tagsArrayText) {
  const matches = tagsArrayText.match(/\[\s*['"]z['"]\s*,/g);
  return matches ? matches.length : 0;
}

/* ════════════════════════════════════════════════════════════════════════
   AC-1 (tag element dual-z) — useProfileTags.js `createTag`.
   The createTag tags array must carry BOTH the canonical z (existing
   TAG_HANDLE const reference, unchanged) AND a NEW local z composed from a
   runtime-interpolated `39998:${taPubkey}:tag` template.
   SOURCE-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-1: createTag (useProfileTags.js) still stamps the canonical z via the TAG_HANDLE const', () => {
  const src = readSrc(USE_PROFILE_TAGS);
  // Scope to createTag's tags array (createTag builds the only kind-39999 with `['d', slug]`).
  const fromCreate = src.indexOf('createTag');
  assert(fromCreate !== -1, 'createTag not found in useProfileTags.js');
  const tagsArr = extractTagsArray(src, fromCreate);
  assert(/\[\s*['"]z['"]\s*,\s*TAG_HANDLE\s*\]/.test(tagsArr),
    `createTag's tags array must still contain the canonical \`['z', TAG_HANDLE]\` (the unchanged ` +
    `ADR-0015 literal const). The second z must be ADDITIVE — not a replacement. tags array was:\n${tagsArr}`);
});

t('AC-1: createTag (useProfileTags.js) stamps a NEW local z composed from runtime ${taPubkey} (39998:${taPubkey}:tag)', () => {
  const src = readSrc(USE_PROFILE_TAGS);
  const fromCreate = src.indexOf('createTag');
  const tagsArr = extractTagsArray(src, fromCreate);
  // A runtime-interpolated local z: ['z', `39998:${taPubkey}:tag`] (template literal
  // interpolating taPubkey, NOT a hardcoded pubkey).
  const localZ = /\[\s*['"]z['"]\s*,\s*`39998:\$\{\s*taPubkey\s*\}:tag`\s*\]/;
  assert(localZ.test(tagsArr),
    `createTag's tags array has no runtime-interpolated local z. Expected a second z entry ` +
    "like ['z', `39998:${taPubkey}:tag`] (a template literal interpolating the runtime taPubkey). " +
    `This is the membership coordinate that lands the new tag in this instance's local concept list ` +
    `(AC-1). tags array was:\n${tagsArr}`);
});

t('AC-1 + dual-z-count: createTag (useProfileTags.js) tags array contains EXACTLY three z entries (canonical + local + applicability hint)', () => {
  const src = readSrc(USE_PROFILE_TAGS);
  const fromCreate = src.indexOf('createTag');
  const tagsArr = extractTagsArray(src, fromCreate);
  const n = countZEntries(tagsArr);
  assert(n === 3,
    `createTag's tags array must contain exactly THREE \`['z', …]\` entries: canonical + local ` +
    `(the dev-box-degenerate-proof pair of record per ADR 0003 — we assert both are EMITTED, not that ` +
    `their values differ, because on this dev box local TA == canonical so they resolve equal) PLUS the ` +
    `pubkey-free applicability hint (tag-applicability Story 1, joined at the 2026-07-15 feat/tags↔staging merge). ` +
    `Found ${n}. tags array was:\n${tagsArr}`);
  assert(/\[\s*['"]z['"]\s*,\s*TAG_FOR_NOSTR_PUBKEY_Z\s*\]/.test(tagsArr),
    `the third z must be the pubkey-free applicability hint \`['z', TAG_FOR_NOSTR_PUBKEY_Z]\` ` +
    `('tag-for-nostr-pubkey') — a concept-handle z here instead would be a real dual-z regression. ` +
    `tags array was:\n${tagsArr}`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-2 (tagging dual-z) — publishProfileTag.js `publishProfileTagAssertion`.
   Must carry BOTH the canonical z (NOSTR_USER_TAG_HANDLE const) AND a NEW
   local z interpolating `localTaPubkey` (39998:${localTaPubkey}:nostr-user-tag).
   SOURCE-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-2: publishProfileTagAssertion still stamps the canonical z via NOSTR_USER_TAG_HANDLE', () => {
  const src = readSrc(PUBLISH_PROFILE_TAG);
  const tagsArr = extractTagsArray(src, src.indexOf('publishProfileTagAssertion'));
  assert(/\[\s*['"]z['"]\s*,\s*NOSTR_USER_TAG_HANDLE\s*\]/.test(tagsArr),
    `publishProfileTagAssertion's tags array must still contain the canonical ` +
    `\`['z', NOSTR_USER_TAG_HANDLE]\` (unchanged ADR-0015 literal const). The second z must be ` +
    `ADDITIVE. tags array was:\n${tagsArr}`);
});

t('AC-2: publishProfileTagAssertion stamps a NEW local z composed from runtime ${localTaPubkey} (39998:${localTaPubkey}:nostr-user-tag)', () => {
  const src = readSrc(PUBLISH_PROFILE_TAG);
  const tagsArr = extractTagsArray(src, src.indexOf('publishProfileTagAssertion'));
  const localZ = /\[\s*['"]z['"]\s*,\s*`39998:\$\{\s*localTaPubkey\s*\}:nostr-user-tag`\s*\]/;
  assert(localZ.test(tagsArr),
    `publishProfileTagAssertion's tags array has no runtime-interpolated local z. Expected a second ` +
    "z entry like ['z', `39998:${localTaPubkey}:nostr-user-tag`] (a template literal interpolating the " +
    `runtime localTaPubkey arg, NOT a hardcoded pubkey). This is the membership coordinate (AC-2). ` +
    `tags array was:\n${tagsArr}`);
});

t('AC-2 + dual-z-count: publishProfileTagAssertion tags array contains EXACTLY two z entries', () => {
  const src = readSrc(PUBLISH_PROFILE_TAG);
  const tagsArr = extractTagsArray(src, src.indexOf('publishProfileTagAssertion'));
  const n = countZEntries(tagsArr);
  assert(n === 2,
    `publishProfileTagAssertion's tags array must contain exactly TWO \`['z', …]\` entries ` +
    `(canonical + local) — the dev-box-degenerate-proof assertion of record per ADR 0003 (we assert ` +
    `two z's are EMITTED, not that their values differ, because on this dev box local TA == canonical). ` +
    `Found ${n}. tags array was:\n${tagsArr}`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-3 (composes with ADR-0022 hybrid e+a) — REGRESSION GUARD (most important).
   The second z must NOT have replaced or disturbed the e+a shape. The `a`/`e`
   lines and the tagAddress = `39999:${tag.authorPubkey}:${tag.slug}` composition
   must remain intact.
   SOURCE-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-3: publishProfileTag.js still composes the ADR-0022 hybrid `a` coordinate (39999:${tag.authorPubkey}:${tag.slug})', () => {
  const src = readSrc(PUBLISH_PROFILE_TAG);
  const tagAddr = /tagAddress\s*=\s*`39999:\$\{\s*tag\.authorPubkey\s*\}:\$\{\s*tag\.slug\s*\}`/;
  assert(tagAddr.test(src),
    'publishProfileTag.js must STILL compose the ADR-0022 tagAddress as ' +
    '`39999:${tag.authorPubkey}:${tag.slug}`. The dual-z change must be additive — it must not ' +
    'disturb the hybrid e+a parent reference (AC-3 regression guard).');
});

t('AC-3: publishProfileTagAssertion tags array still carries BOTH the `a` (tagAddress) and `e` (tag.eventId) lines', () => {
  const src = readSrc(PUBLISH_PROFILE_TAG);
  const tagsArr = extractTagsArray(src, src.indexOf('publishProfileTagAssertion'));
  assert(/\[\s*['"]a['"]\s*,\s*tagAddress\s*\]/.test(tagsArr),
    `publishProfileTagAssertion's tags array must still contain \`['a', tagAddress]\` (ADR-0022 ` +
    `hybrid parent reference). The second z must not replace it. tags array was:\n${tagsArr}`);
  assert(/\[\s*['"]e['"]\s*,\s*tag\.eventId\s*\]/.test(tagsArr),
    `publishProfileTagAssertion's tags array must still contain \`['e', tag.eventId]\` (ADR-0022 ` +
    `applied-version provenance). The second z must not replace it. tags array was:\n${tagsArr}`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-6 (runtime local TA — anti-hardcode). BOTH files. The LOCAL z handle is
   composed from a runtime variable (taPubkey / localTaPubkey interpolation), and
   NO new 82b75e47…-style 64-hex literal was introduced for the local handle. The
   ONLY allowed 82b75e47… literal is the pre-existing canonical const(s): exactly
   one per file (TAG_HANDLE / NOSTR_USER_TAG_HANDLE def). canonical = literal
   (allowed); local = runtime (required).
   SOURCE-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

t('AC-6: useProfileTags.js introduces NO new 82b75e47… literal — exactly the one pre-existing canonical const occurrence', () => {
  const src = readSrc(USE_PROFILE_TAGS);
  const occurrences = (src.match(new RegExp(LEGACY_COORD, 'g')) || []).length;
  assert(occurrences === 1,
    `useProfileTags.js must contain the ADR-0015 canonical literal exactly ONCE — the pre-existing ` +
    `\`const TA_PUBKEY = '82b75e47…'\`. A second occurrence means the LOCAL z was hardcoded instead of ` +
    `composed from the runtime taPubkey (CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode"; AC-6). ` +
    `Found ${occurrences} occurrences.`);
});

t('AC-6: publishProfileTag.js introduces NO new 82b75e47… literal — exactly the one pre-existing canonical const occurrence', () => {
  const src = readSrc(PUBLISH_PROFILE_TAG);
  const occurrences = (src.match(new RegExp(LEGACY_COORD, 'g')) || []).length;
  assert(occurrences === 1,
    `publishProfileTag.js must contain the ADR-0015 canonical literal exactly ONCE — the pre-existing ` +
    `\`const TA_PUBKEY = '82b75e47…'\`. A second occurrence means the LOCAL z was hardcoded instead of ` +
    `composed from the runtime localTaPubkey arg (AC-6 anti-hardcode). Found ${occurrences} occurrences.`);
});

/* ════════════════════════════════════════════════════════════════════════
   AC-2/AC-3 signature + threading — the local z is useless if the runtime arg
   isn't accepted by the writer and threaded from the call sites (OQ-3 wiring).
   SOURCE-CONTRACT.
   ════════════════════════════════════════════════════════════════════════ */

t('SIGNATURE: publishProfileTagAssertion accepts the new localTaPubkey param in its destructured signature', () => {
  const src = readSrc(PUBLISH_PROFILE_TAG);
  // The signature destructures its single object arg: { tag, targetPubkey, polarity, localTaPubkey }
  const sig = /publishProfileTagAssertion\s*\(\s*\{[^}]*\blocalTaPubkey\b[^}]*\}\s*\)/;
  assert(sig.test(src),
    'publishProfileTagAssertion must extend its destructured signature to accept `localTaPubkey` ' +
    '(e.g. `publishProfileTagAssertion({ tag, targetPubkey, polarity, localTaPubkey })`). Without the ' +
    'param the threaded runtime TA never reaches the writer and the local z cannot be composed (OQ-3).');
});

t('THREADING: useProfileTags.js reads taPubkey via useConfig and passes localTaPubkey into publishProfileTagAssertion', () => {
  const src = readSrc(USE_PROFILE_TAGS);
  assert(/useConfig/.test(src) && /taPubkey/.test(src),
    'useProfileTags.js must read the runtime TA via `useConfig()` and reference `taPubkey` ' +
    '(the local z source). Neither appears — the runtime TA is not wired in.');
  // The assertion call site (buildAndPublishAssertion) must thread localTaPubkey (or taPubkey) in.
  const threaded = /publishProfileTagAssertion\s*\(\s*\{[^}]*\b(?:localTaPubkey|taPubkey)\b[^}]*\}/;
  assert(threaded.test(src),
    'useProfileTags.js must thread the runtime TA into publishProfileTagAssertion ' +
    '(e.g. `publishProfileTagAssertion({ tag, targetPubkey, polarity, localTaPubkey: taPubkey })`). ' +
    'The local z is dropped if the arg is not threaded (OQ-3 wiring).');
});

t('THREADING: Tag.jsx reads taPubkey via useConfig and passes localTaPubkey into both publishProfileTagAssertion calls', () => {
  const src = readSrc(TAG_PAGE);
  assert(/useConfig/.test(src) && /taPubkey/.test(src),
    'Tag.jsx must read the runtime TA via `useConfig()` and reference `taPubkey` for its direct ' +
    'publishProfileTagAssertion calls (handleApply / handleDispute). Neither appears — not wired.');
  // Both handleApply and handleDispute call publishProfileTagAssertion directly; both must thread the arg.
  const calls = src.match(/publishProfileTagAssertion\s*\(\s*\{[^}]*\}/g) || [];
  assert(calls.length >= 2,
    `Tag.jsx is expected to call publishProfileTagAssertion at least twice (apply + dispute); ` +
    `found ${calls.length}.`);
  for (const call of calls) {
    assert(/\b(?:localTaPubkey|taPubkey)\b/.test(call),
      'every publishProfileTagAssertion call in Tag.jsx must thread the runtime TA ' +
      '(`localTaPubkey: taPubkey`). An un-threaded call silently drops the local z (OQ-3). ' +
      `Offending call:\n${call}`);
  }
});

/* ════════════════════════════════════════════════════════════════════════
   Non-throwing guard (the design choice) — SOFT / source-contract.
   ADR 0003: a missing/malformed local TA must WARN+omit, NEVER hard-throw
   (a missing local z has no cost — the canonical still ships). The ONLY
   throw-guard tied to a pubkey arg is the existing authorPubkey guard; no NEW
   throw may be introduced for taPubkey/localTaPubkey.
   See test-plan note on the robustness limitation of this regex.
   ════════════════════════════════════════════════════════════════════════ */

t('SOFT: publishProfileTag.js introduces NO new throw tied to a missing/malformed localTaPubkey (warn+omit, not throw)', () => {
  const src = readSrc(PUBLISH_PROFILE_TAG);
  // The forbidden pattern is a GUARD: an `if (...)` whose condition tests
  // localTaPubkey and whose body throws — `if (… localTaPubkey …) { … throw … }`.
  // (Refined from a crude 220-char-window heuristic, which false-positived on the
  // function SIGNATURE now containing `localTaPubkey` right before the pre-existing
  // `!window.nostr`/`authorPubkey` throws. The signature is not a guard. — tightened
  // by the Implementer; see review note.)
  const guardThrow = /if\s*\([^)]*\blocalTaPubkey\b[^)]*\)\s*\{[^}]*\bthrow\b/;
  assert(!guardThrow.test(src),
    'publishProfileTag.js must NOT hard-throw on a missing/malformed localTaPubkey — per ADR 0003 ' +
    'the guard WARNS and omits the local z so the canonical publish still ships (AC-5/decentralization). ' +
    'Found an `if (… localTaPubkey …) { … throw }` guard. Use console.warn + omit, not throw.');
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- dual-z writer tests (epic tag-federation, Story 3) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ndual-z-writer: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
