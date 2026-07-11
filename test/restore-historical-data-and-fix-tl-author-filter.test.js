/**
 * Tests for Story 16 / ADR 0015 — Restore historical data visibility while
 * fixing the TL author filter.
 *
 * These tests are intentionally failing until the fix is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layers:
 *   - Source-file regex inspection (every wire-format invariant and ADR
 *     commitment is captured as a structural property of the source — same
 *     pattern as test/tag-detail-curated-view-and-pin-polish.test.js).
 *   - One server-contract HTTP test confirming the new module init didn't
 *     break /api/profile-tags/profiles-tagged on this dev machine.
 *
 * AC-1, AC-7 are covered by the full test suite continuing to pass; this
 * file only carries the new gap-driven assertions.
 * AC-2 and AC-3 are post-deploy manual verifications at staging /
 * tags.brainstorm.world — see the test plan.
 */

const fs = require('fs');
const path = require('path');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

const REPO_ROOT = path.resolve(__dirname, '..');

const SERVER_PROFILE_TAGS = path.join(REPO_ROOT, 'src/api/profile-tags/index.js');
const SERVER_REFRESH_PINS = path.join(REPO_ROOT, 'src/api/trustedList/refreshPinnedTags.js');
const CLIENT_PUBLISH_TAG_PIN = path.join(REPO_ROOT, 'ui/src/utils/publishTagPin.js');
const CLIENT_PUBLISH_PROFILE_TAG = path.join(REPO_ROOT, 'ui/src/utils/publishProfileTag.js');
const CLIENT_USE_PROFILE_TAGS = path.join(REPO_ROOT, 'ui/src/hooks/useProfileTags.js');
const CLIENT_TAG_PAGE = path.join(REPO_ROOT, 'ui/src/pages/Tag.jsx');
const CLIENT_PINS_PAGE = path.join(REPO_ROOT, 'ui/src/pages/Pins.jsx');
const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');

const LEGACY_HEX = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (err) {
    throw new Error(`could not read ${path.relative(REPO_ROOT, p)} (${err.code || err.message})`);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

// Whole-suite reachability guard — mirrors test/most-pinned-tag-index-publish.test.js.
async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ──────────────────────────────────────────────────────────────────
// AC-5 — Server-side LEGACY_Z_TAG_PUBKEY + z-tag derivations
// ──────────────────────────────────────────────────────────────────

t('AC-5: src/api/profile-tags/index.js defines LEGACY_Z_TAG_PUBKEY with the dev literal', () => {
  const src = readSafe(SERVER_PROFILE_TAGS);
  const re = new RegExp(
    `const\\s+LEGACY_Z_TAG_PUBKEY\\s*=\\s*['"]${LEGACY_HEX}['"]`
  );
  assert(
    re.test(src),
    'AC-5: src/api/profile-tags/index.js must declare a `const LEGACY_Z_TAG_PUBKEY = ' +
      `'${LEGACY_HEX}'` +
      '` at module top (per ADR 0015 Decision A, Implementation shape). ' +
      'Pattern not found.'
  );
});

t('AC-5: LEGACY_Z_TAG_PUBKEY declaration is preceded by an explanatory comment that references ADR-0015', () => {
  const src = readSafe(SERVER_PROFILE_TAGS);
  // Look for any /* ... */ or // run of comments within ~600 chars before
  // the constant declaration, containing "ADR 0015" (or "ADR-0015") and the
  // word "legacy" or "wire-binding" (case-insensitive).
  const idx = src.indexOf('LEGACY_Z_TAG_PUBKEY');
  assert(idx > -1, 'AC-5: cannot find LEGACY_Z_TAG_PUBKEY in src/api/profile-tags/index.js (the earlier AC will have caught this; we re-assert for clarity).');
  const window = src.slice(Math.max(0, idx - 800), idx);
  assert(
    /ADR[\s-]*0015/i.test(window),
    'AC-5: the LEGACY_Z_TAG_PUBKEY declaration must be preceded by a comment block that references "ADR 0015" so the next reader can find the rationale. The reference must appear within ~800 chars before the constant. Not found.'
  );
  assert(
    /legacy|wire-binding|historical/i.test(window),
    'AC-5: the comment block above LEGACY_Z_TAG_PUBKEY must include one of the words "legacy" / "wire-binding" / "historical" so the role of the constant is unambiguous. Not found.'
  );
});

t('AC-5: TAG_Z_TAG, NOSTR_USER_TAG_Z_TAG, TAG_PINNING_Z_TAG are derived from LEGACY_Z_TAG_PUBKEY (not from TA_PUBKEY)', () => {
  const src = readSafe(SERVER_PROFILE_TAGS);
  // Each constant must be a template literal interpolating LEGACY_Z_TAG_PUBKEY.
  const tagRe = /const\s+TAG_Z_TAG\s*=\s*`39998:\$\{LEGACY_Z_TAG_PUBKEY\}:tag`/;
  const nutRe = /const\s+NOSTR_USER_TAG_Z_TAG\s*=\s*`39998:\$\{LEGACY_Z_TAG_PUBKEY\}:nostr-user-tag`/;
  const pinRe = /const\s+TAG_PINNING_Z_TAG\s*=\s*`39998:\$\{LEGACY_Z_TAG_PUBKEY\}:tag-pinning`/;
  assert(
    tagRe.test(src),
    'AC-5: TAG_Z_TAG must be derived from LEGACY_Z_TAG_PUBKEY (per ADR 0015). Pattern not found.'
  );
  assert(
    nutRe.test(src),
    'AC-5: NOSTR_USER_TAG_Z_TAG must be derived from LEGACY_Z_TAG_PUBKEY (per ADR 0015). Pattern not found.'
  );
  assert(
    pinRe.test(src),
    'AC-5: TAG_PINNING_Z_TAG must be derived from LEGACY_Z_TAG_PUBKEY (per ADR 0015). Pattern not found.'
  );
});

t('AC-5: the three z-tag constants do NOT derive from runtime TA_PUBKEY (defensive)', () => {
  const src = readSafe(SERVER_PROFILE_TAGS);
  // Anti-pattern: `39998:${TA_PUBKEY}:tag` or similar.
  const taPubkeyInZTag = /39998:\$\{TA_PUBKEY\}:(tag|nostr-user-tag|tag-pinning)/;
  assert(
    !taPubkeyInZTag.test(src),
    'AC-5: z-tag constants MUST NOT be derived from the runtime TA_PUBKEY — this is exactly the bug ' +
      'that Story 16 fixes. They must derive from LEGACY_Z_TAG_PUBKEY. Found a 39998:${TA_PUBKEY}: ' +
      'interpolation still present.'
  );
});

// ──────────────────────────────────────────────────────────────────
// AC-4 — Runtime TA_PUBKEY preserved and used for kind-30392 author filter
// ──────────────────────────────────────────────────────────────────

t('AC-4: src/api/profile-tags/index.js keeps `const TA_PUBKEY = getOwnerAssistantPubkey()`', () => {
  const src = readSafe(SERVER_PROFILE_TAGS);
  assert(
    /const\s+TA_PUBKEY\s*=\s*getOwnerAssistantPubkey\s*\(\s*\)/.test(src),
    'AC-4: the server module must retain `const TA_PUBKEY = getOwnerAssistantPubkey()` — the runtime ' +
      'value used for the kind-30392 author filter (per ADR 0015). Pattern not found.'
  );
});

t('AC-4: enrichRowsWithTLStatus passes `authors: [TA_PUBKEY]` to its strfry scan (not a literal)', () => {
  const src = readSafe(SERVER_PROFILE_TAGS);
  // Locate the enrichRowsWithTLStatus function, then check its strfry-scan call.
  const fnIdx = src.indexOf('async function enrichRowsWithTLStatus');
  assert(fnIdx > -1, 'AC-4: cannot find enrichRowsWithTLStatus function in src/api/profile-tags/index.js — has the function been renamed?');
  // Look for `authors: [TA_PUBKEY]` within ~2000 chars after the function declaration.
  const fnBody = src.slice(fnIdx, fnIdx + 4000);
  assert(
    /authors:\s*\[\s*TA_PUBKEY\s*\]/.test(fnBody),
    'AC-4: enrichRowsWithTLStatus must use `authors: [TA_PUBKEY]` (where TA_PUBKEY is the runtime ' +
      'value) for its kind-30392 strfry scan. Pattern not found in the function body.'
  );
  // Defensive anti-check: the function must not use a literal pubkey in the authors filter.
  const literalInAuthors = new RegExp(`authors:\\s*\\[\\s*['"]${LEGACY_HEX}['"]`);
  assert(
    !literalInAuthors.test(fnBody),
    'AC-4: enrichRowsWithTLStatus must NOT hardcode the dev literal in its authors filter — that is ' +
      'the original bug. Found the literal still in use.'
  );
});

t('AC-4: refreshPinnedTags retractStaleTLs passes `authors: [TA_PUBKEY]` (not a literal)', () => {
  const src = readSafe(SERVER_REFRESH_PINS);
  // The function uses the module-imported TA_PUBKEY constant (which is the runtime value via the
  // profile-tags module export).
  const literalInAuthors = new RegExp(`authors:\\s*\\[\\s*['"]${LEGACY_HEX}['"]`);
  assert(
    !literalInAuthors.test(src),
    'AC-4: refreshPinnedTags.js must NOT hardcode the dev literal in any authors filter. ' +
      'Found the literal still in use.'
  );
  assert(
    /authors:\s*\[\s*TA_PUBKEY\s*\]/.test(src),
    'AC-4: refreshPinnedTags.js must use `authors: [TA_PUBKEY]` for its kind-30392 author filter ' +
      '(the imported TA_PUBKEY resolves to the runtime value via the profile-tags module export). ' +
      'Pattern not found.'
  );
});

t('AC-4: /api/profile-tags/profiles-tagged responds 200 (the new module init did not break the endpoint)', async () => {
  const VALID_HEX = 'a'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${VALID_HEX}`
  );
  assertEqual(status, 200, 'AC-4: profiles-tagged status');
  assert(json?.success === true, 'AC-4: profiles-tagged success flag must be true');
  // Endpoint shape stays the same; rows[] may be empty.
  assert(Array.isArray(json.rows), 'AC-4: rows must be an array (regression sentinel)');
});

// ──────────────────────────────────────────────────────────────────
// AC-6 / ADR Impl Shape — Client pin publisher reverts to literal
// ──────────────────────────────────────────────────────────────────

t('AC-6: ui/src/utils/publishTagPin.js declares LEGACY_TA_PUBKEY with the dev literal', () => {
  const src = readSafe(CLIENT_PUBLISH_TAG_PIN);
  const re = new RegExp(
    `const\\s+LEGACY_TA_PUBKEY\\s*=\\s*['"]${LEGACY_HEX}['"]`
  );
  assert(
    re.test(src),
    'AC-6: publishTagPin.js must declare a `const LEGACY_TA_PUBKEY = ' +
      `'${LEGACY_HEX}'` +
      '` at module top (per ADR 0015 Implementation shape). Pattern not found.'
  );
});

t('AC-6: publishTagPin.js composes its z-tag handle from LEGACY_TA_PUBKEY (not from a runtime parameter)', () => {
  const src = readSafe(CLIENT_PUBLISH_TAG_PIN);
  // The post-revert shape: `const TAG_PINNING_HANDLE = \`39998:${LEGACY_TA_PUBKEY}:tag-pinning\``
  // or equivalent module-level composition. The composition must reference LEGACY_TA_PUBKEY,
  // not a parameter named `taPubkey`.
  assert(
    /39998:\$\{LEGACY_TA_PUBKEY\}:tag-pinning/.test(src),
    'AC-6: publishTagPin.js must compose its tag-pinning z-tag handle using LEGACY_TA_PUBKEY ' +
      '(per ADR 0015 Implementation shape). Pattern not found.'
  );
  // Anti-pattern: composition still uses `${taPubkey}` (the d3a2640a/branch-current state).
  assert(
    !/39998:\$\{taPubkey\}:tag-pinning/.test(src),
    'AC-6: publishTagPin.js must NOT compose its z-tag from the `taPubkey` parameter anymore — ' +
      'the parameter is removed per ADR 0015. Found `39998:${taPubkey}:tag-pinning` still present.'
  );
});

t('AC-6: pinTag() signature no longer accepts a taPubkey parameter', () => {
  const src = readSafe(CLIENT_PUBLISH_TAG_PIN);
  // The post-fix signature: `export async function pinTag({ tag, curationMethod })` (or similar
  // destructuring; the `taPubkey` parameter is gone).
  // Find the pinTag declaration line and inspect its destructured param list.
  const sigMatch = src.match(/export\s+async\s+function\s+pinTag\s*\(\s*\{([^}]*)\}\s*\)/);
  assert(sigMatch,
    'AC-6: cannot find `export async function pinTag({ ... })` declaration in publishTagPin.js — has the function been renamed?');
  const paramList = sigMatch[1];
  assert(
    !/\btaPubkey\b/.test(paramList),
    'AC-6: pinTag()\'s destructured parameter list must NOT include `taPubkey` (per ADR 0015 — ' +
      'the parameter is removed; the publisher uses LEGACY_TA_PUBKEY instead). ' +
      `Got param list: "${paramList.trim()}".`
  );
});

t('AC-6: pinTag() body no longer throws when taPubkey is missing (the validation block is removed)', () => {
  const src = readSafe(CLIENT_PUBLISH_TAG_PIN);
  // The post-revert body has no `if (!taPubkey || ...) throw ...` block. The pre-fix branch state
  // has one at line ~57.
  assert(
    !/if\s*\(\s*!\s*taPubkey/.test(src),
    'AC-6: pinTag must NOT contain a `if (!taPubkey ...) throw ...` validation block — the parameter ' +
      'is removed in the post-fix shape (per ADR 0015). Found the validation block still present.'
  );
});

// ──────────────────────────────────────────────────────────────────
// AC-6 (regression) — useProfileTags.js and publishProfileTag.js unchanged
// ──────────────────────────────────────────────────────────────────

t('AC-6 / R-4: useProfileTags.js still hardcodes the literal (Story 16 deliberately does NOT touch this file)', () => {
  const src = readSafe(CLIENT_USE_PROFILE_TAGS);
  const re = new RegExp(`const\\s+TA_PUBKEY\\s*=\\s*['"]${LEGACY_HEX}['"]`);
  assert(
    re.test(src),
    'AC-6 / R-4: useProfileTags.js must continue to declare its literal `const TA_PUBKEY = \'' +
      LEGACY_HEX + '\'` (per ADR 0015 — this file is explicitly NOT modified). ' +
      'If this assertion fails, the Implementer touched a file the ADR put out of scope.'
  );
});

t('AC-6 / R-5: publishProfileTag.js still hardcodes the literal (Story 16 deliberately does NOT touch this file)', () => {
  const src = readSafe(CLIENT_PUBLISH_PROFILE_TAG);
  const re = new RegExp(`const\\s+TA_PUBKEY\\s*=\\s*['"]${LEGACY_HEX}['"]`);
  assert(
    re.test(src),
    'AC-6 / R-5: publishProfileTag.js must continue to declare its literal `const TA_PUBKEY = \'' +
      LEGACY_HEX + '\'` (per ADR 0015 — this file is explicitly NOT modified). ' +
      'If this assertion fails, the Implementer touched a file the ADR put out of scope.'
  );
});

// ──────────────────────────────────────────────────────────────────
// ADR Impl Shape — Pin callers drop the taPubkey argument
// ──────────────────────────────────────────────────────────────────

t('Caller: ui/src/pages/Tag.jsx pinTag(...) call no longer passes taPubkey', () => {
  const src = readSafe(CLIENT_TAG_PAGE);
  // Find every `pinTag({ ... })` call and assert taPubkey isn't in its arg destructuring.
  const callRe = /\bpinTag\s*\(\s*\{([^}]*)\}\s*\)/g;
  let match;
  let foundAny = false;
  while ((match = callRe.exec(src)) !== null) {
    foundAny = true;
    const args = match[1];
    assert(
      !/\btaPubkey\b/.test(args),
      'Caller: Tag.jsx pinTag(...) calls must NOT pass `taPubkey` (per ADR 0015 — the parameter ' +
        `is removed). Found call with args: "${args.trim()}".`
    );
  }
  assert(foundAny,
    'Caller: cannot find any `pinTag(...)` call in Tag.jsx — has the file been restructured?');
});

// Updated 2026-06-10: Story 20 / ADR 0018 removed the pinTag(...) call from
// Pins.jsx entirely (re-pin now happens on the tag page's Pinned tab), so
// the original "must find a pinTag call" guard no longer applies. The
// ADR-0015 protection this test exists for — no caller resurrects the
// taPubkey parameter — is preserved as a file-wide negative assertion.
t('Caller: ui/src/pages/Pins.jsx does not reference taPubkey (pinTag caller contract, ADR 0015)', () => {
  const src = readSafe(CLIENT_PINS_PAGE);
  const callRe = /\bpinTag\s*\(\s*\{([^}]*)\}\s*\)/g;
  let match;
  while ((match = callRe.exec(src)) !== null) {
    const args = match[1];
    assert(
      !/\btaPubkey\b/.test(args),
      'Caller: Pins.jsx pinTag(...) calls must NOT pass `taPubkey` (per ADR 0015). ' +
        `Found call with args: "${args.trim()}".`
    );
  }
  assert(
    !/\btaPubkey\b/.test(src),
    'Caller: Pins.jsx must not reference `taPubkey` at all (per ADR 0015 — the parameter is removed; ' +
      'Story 20 removed the pinTag call from this page entirely).'
  );
});

// ──────────────────────────────────────────────────────────────────
// Documentation — CLAUDE.md named exception paragraph
// ──────────────────────────────────────────────────────────────────

t('CLAUDE.md carries a "Named exception (ADR 0015)" note referencing LEGACY_Z_TAG_PUBKEY', () => {
  const src = readSafe(CLAUDE_MD);
  // Look for both the ADR reference and the constant name within the same ~2000-char window.
  const adrRefIdx = src.search(/ADR[\s-]*0015/i);
  assert(
    adrRefIdx > -1,
    'CLAUDE.md must reference ADR 0015 in the "Per-deployment TA pubkey" subsection (per ADR 0015 ' +
      'Implementation shape — Documentation). Reference not found.'
  );
  const window = src.slice(Math.max(0, adrRefIdx - 1000), Math.min(src.length, adrRefIdx + 2000));
  assert(
    /LEGACY_Z_TAG_PUBKEY/.test(window),
    'CLAUDE.md\'s ADR-0015 note must mention LEGACY_Z_TAG_PUBKEY by name so the next reader who ' +
      'encounters the constant can find the rationale. Reference not found within ~2000 chars of the ADR mention.'
  );
});

// ──────────────────────────────────────────────────────────────────
// Regression sentinels (R-tests)
// ──────────────────────────────────────────────────────────────────

t('R-1: publishTagPin.js defaultCurationMethod still returns cutoff: 1 and includeScoreInTL: true (Story 17 preserved)', () => {
  const src = readSafe(CLIENT_PUBLISH_TAG_PIN);
  const m = src.match(/export\s+function\s+defaultCurationMethod\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};?\s*\}/);
  assert(m, 'R-1: cannot find defaultCurationMethod in publishTagPin.js');
  const body = m[1];
  assert(/cutoff:\s*1\b/.test(body),
    `R-1: defaultCurationMethod must still return cutoff: 1 (Story 17 invariant). Got body: ${body}`);
  assert(/includeScoreInTL:\s*true\b/.test(body),
    `R-1: defaultCurationMethod must still return includeScoreInTL: true (Story 17 invariant). Got body: ${body}`);
});

t('R-2: refreshPinnedTags.js computeTLDTag is unchanged (TL d-tag is wire-binding)', () => {
  const src = readSafe(SERVER_REFRESH_PINS);
  // The canonical shape is `tl-pin-<obs8>-<ta8>-<slug>`.
  assert(
    /function\s+computeTLDTag/.test(src),
    'R-2: refreshPinnedTags.js must still define `computeTLDTag` (Story 11 invariant; ' +
      'TL d-tag shape is wire-binding).'
  );
  assert(
    /tl-pin-\$\{[^}]+slice\(0,\s*8\)\}-\$\{[^}]+slice\(0,\s*8\)\}-\$\{[^}]+\}/i.test(src),
    'R-2: computeTLDTag must still produce `tl-pin-<observer8>-<tagAuthor8>-<tagSlug>` (Story 11 ' +
      'invariant — TL d-tag shape is wire-binding). Pattern not found.'
  );
});

t('R-3: /api/profile-tags/index continues to return rows with applications/disputes/pinnedCount integers', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=used&limit=20`
  );
  assertEqual(status, 200, 'R-3: index endpoint status');
  assert(Array.isArray(json?.rows), 'R-3: rows must be an array');
  if (json.rows.length === 0) return; // empty instance — shape assertion skipped (existing pattern)
  const row = json.rows[0];
  assert(typeof row.applications === 'number',
    `R-3: row.applications must remain a number; got ${JSON.stringify(row)}`);
  assert(typeof row.disputes === 'number',
    `R-3: row.disputes must remain a number; got ${JSON.stringify(row)}`);
  assert(typeof row.pinnedCount === 'number',
    `R-3: row.pinnedCount must remain a number (Story 13 invariant); got ${JSON.stringify(row)}`);
});

t('R-4: useProfileTags.js literal hardcode untouched (regression duplicate of AC-6 / R-4 above)', () => {
  // Already covered above; kept as an explicit sentinel under the R-numbering for the test plan.
  const src = readSafe(CLIENT_USE_PROFILE_TAGS);
  const re = new RegExp(`const\\s+TA_PUBKEY\\s*=\\s*['"]${LEGACY_HEX}['"]`);
  assert(re.test(src),
    'R-4: useProfileTags.js literal must remain. Out-of-scope-file sentinel.');
});

t('R-5: publishProfileTag.js literal hardcode untouched (regression duplicate of AC-6 / R-5 above)', () => {
  const src = readSafe(CLIENT_PUBLISH_PROFILE_TAG);
  const re = new RegExp(`const\\s+TA_PUBKEY\\s*=\\s*['"]${LEGACY_HEX}['"]`);
  assert(re.test(src),
    'R-5: publishProfileTag.js literal must remain. Out-of-scope-file sentinel.');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- restore-historical-data-and-fix-tl-author-filter tests (Story 16 / ADR 0015) ---');
  if (!(await controlPanelReachable())) {
    const skipped = tests.length;
    console.log(`  - SKIP: control panel not reachable at ${CONTROL_PANEL_BASE} — live-API suite needs the local stack (${skipped} tests skipped)`);
    return { pass: 0, fail: 0, skipped };
  }
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      fail++;
    }
  }
  console.log(`\nrestore-historical-data-and-fix-tl-author-filter: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
