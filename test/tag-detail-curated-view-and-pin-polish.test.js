/**
 * Tests for Story 17: Tag-detail Curated view + Pin curation menu
 * simplification.
 * ADR: engineering-team/decisions/0014-tag-detail-curated-view-and-pin-polish.md
 *
 * These tests are intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layers:
 *   - JSX / CSS / module source-file regex inspection (UI ACs) — same
 *     pattern as test/nip05-checkmark-verification.test.js.
 *   - One server-contract HTTP test against
 *     `/api/profile-tags/profiles-tagged` for the new row-enrichment
 *     fields (AC-5 server side).
 *
 * Live publish-flow assertions (AC-22 WYSIWYG) live in
 * test/tag-detail-curated-view-and-pin-polish-publish.test.js.
 */

const fs = require('fs');
const path = require('path');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

const REPO_ROOT = path.resolve(__dirname, '..');
const UI_PAGES = path.join(REPO_ROOT, 'ui/src/pages');
const UI_COMPONENTS = path.join(REPO_ROOT, 'ui/src/components');
const UI_UTILS = path.join(REPO_ROOT, 'ui/src/utils');
const UI_STYLES = path.join(REPO_ROOT, 'ui/src/styles.css');

const TAG_JSX = path.join(UI_PAGES, 'Tag.jsx');
const TAG_PAGE_ROW = path.join(UI_COMPONENTS, 'TagPageRow.jsx');
const TAG_VIEW_CONTROLS = path.join(UI_COMPONENTS, 'TagViewControls.jsx');
const TAG_SOMEONE_MODAL = path.join(UI_COMPONENTS, 'TagSomeoneModal.jsx');
const TAG_PIN_AFFORDANCE = path.join(UI_COMPONENTS, 'TagPinAffordance.jsx');
const CURATION_DIALOG = path.join(UI_COMPONENTS, 'CurationMethodDialog.jsx');
const PUBLISH_TAG_PIN = path.join(UI_UTILS, 'publishTagPin.js');
const WOT_SCORE_UTIL = path.join(UI_UTILS, 'wotScore.js');
const REFRESH_PINNED_TAGS = path.join(REPO_ROOT, 'src/api/trustedList/refreshPinnedTags.js');
const BRAINSTORM_SEARCH = path.join(UI_PAGES, 'BrainstormSearch.jsx');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

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

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ------------------------------------------------------------------
// AC-1 — "View all my pinned tags" link removed from Tag.jsx
// ------------------------------------------------------------------

t('AC-1: Tag.jsx no longer renders the "View all my pinned tags" link', () => {
  const src = readSafe(TAG_JSX);
  assert(
    !/View all my pinned tags/.test(src),
    'AC-1: Tag.jsx must not contain the literal "View all my pinned tags" — ' +
      'the link to /pins from the tag header must be removed (the user menu remains the canonical entry point). ' +
      'Found the link still present in Tag.jsx.'
  );
});

// ------------------------------------------------------------------
// AC-2 — "Created by" line removed from Tag.jsx
// ------------------------------------------------------------------

t('AC-2: Tag.jsx no longer renders the "Created by" line', () => {
  const src = readSafe(TAG_JSX);
  assert(
    !/Created by/.test(src),
    'AC-2: Tag.jsx must not contain the literal "Created by" — the tag-author identity paragraph in the header ' +
      'must be removed. Found the "Created by" line still present in Tag.jsx.'
  );
});

// ------------------------------------------------------------------
// AC-3 — Sort chips no longer rendered as a top-level always-on
// element in Tag.jsx; they move into TagViewControls' disclosure.
// ------------------------------------------------------------------

t('AC-3: Tag.jsx no longer imports/renders <SortToggle> directly (sorts move under TagViewControls)', () => {
  const src = readSafe(TAG_JSX);
  // Tag.jsx previously imports SortToggle at the top and renders <SortToggle ... />
  // After the change, the toggle is owned by TagViewControls. Tag.jsx should
  // not reference SortToggle anymore.
  assert(
    !/from\s+['"]\.\.\/components\/SortToggle['"]/.test(src),
    'AC-3: Tag.jsx must not import SortToggle directly — the sort toggle is now hosted inside the new ' +
      'TagViewControls component (per ADR Decision 1). Found the SortToggle import still in Tag.jsx.'
  );
  assert(
    !/<SortToggle\b/.test(src),
    'AC-3: Tag.jsx must not render <SortToggle> as a top-level child — sort controls live behind the new ' +
      'View options disclosure inside TagViewControls. Found <SortToggle> still rendered in Tag.jsx.'
  );
});

// ------------------------------------------------------------------
// AC-4 — TagViewControls.jsx exists with a <details>/<summary> disclosure
// and a "View options" label.
// ------------------------------------------------------------------

t('AC-4: ui/src/components/TagViewControls.jsx exists', () => {
  assert(
    fileExists(TAG_VIEW_CONTROLS),
    'AC-4: ui/src/components/TagViewControls.jsx must exist — it owns the toolbar row above the row list ' +
      'with the "Tag someone" button (left) and "View options" disclosure (right). File not found.'
  );
});

t('AC-4: TagViewControls.jsx uses <details> disclosure with a "View options" label', () => {
  if (!fileExists(TAG_VIEW_CONTROLS)) {
    throw new Error('AC-4: TagViewControls.jsx not present yet — cannot assert disclosure shape.');
  }
  const src = readSafe(TAG_VIEW_CONTROLS);
  assert(
    /<details\b/.test(src),
    'AC-4: TagViewControls.jsx must use native <details> for the disclosure widget (ADR Decision 1). ' +
      'No <details> tag found.'
  );
  assert(
    /<summary\b/.test(src),
    'AC-4: TagViewControls.jsx must use <summary> as the disclosure trigger. No <summary> tag found.'
  );
  assert(
    /View options/.test(src),
    'AC-4: TagViewControls.jsx must label the disclosure trigger "View options" (per story AC-4). ' +
      'Literal not found.'
  );
});

// ------------------------------------------------------------------
// AC-5 (UI) — filter text input lives inside TagViewControls' disclosure
// ------------------------------------------------------------------

t('AC-5 (UI): TagViewControls.jsx renders a text-filter input with a "filter"-mentioning placeholder', () => {
  if (!fileExists(TAG_VIEW_CONTROLS)) {
    throw new Error('AC-5: TagViewControls.jsx not present yet — cannot assert filter-input shape.');
  }
  const src = readSafe(TAG_VIEW_CONTROLS);
  // The filter input is an <input type="text" ...> with a placeholder that
  // mentions "filter". Story 15 parameterized the copy (Notes tab passes its own),
  // so the placeholder may be an inline literal OR the `filterPlaceholder` prop —
  // accept either, and separately assert the DEFAULT placeholder still says "filter"
  // (behavior preserved for the Profiles tab).
  const filterInputRe = /<input[^>]*type=["']text["'][^>]*placeholder=(?:["'][^"']*[Ff]ilter[^"']*["']|\{filterPlaceholder\b)/;
  assert(
    filterInputRe.test(src),
    'AC-5: TagViewControls.jsx must render a <input type="text" ... placeholder="...Filter..." | ' +
      '{filterPlaceholder}> for the client-side row filter. No matching input found in TagViewControls.jsx.'
  );
  const filterDefaultRe = /placeholder=["'][^"']*[Ff]ilter[^"']*["']|filterPlaceholder\s*=\s*["'][^"']*[Ff]ilter[^"']*["']/;
  assert(
    filterDefaultRe.test(src),
    'AC-5: the default filter placeholder must still mention "filter" (inline or via the filterPlaceholder ' +
      'default). Parameterizing the copy must not drop the Profiles-tab default.'
  );
});

// ------------------------------------------------------------------
// AC-5 (server) — profiles-tagged endpoint enriches rows with
// nip05, about, website (always-present, may be null).
// ------------------------------------------------------------------

t('AC-5 (server): /api/profile-tags/profiles-tagged rows include nip05, about, website keys', async () => {
  // Use a known-shape valid hex; the endpoint accepts arbitrary tagEventId
  // and returns success+rows[] (possibly empty) for unknown IDs.
  // We need a real tag to get non-empty rows; otherwise the per-row
  // assertion is skipped (the codebase's existing skip-on-empty idiom).
  const VALID_HEX = 'a'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${VALID_HEX}`
  );
  assertEqual(status, 200, 'AC-5 server: profiles-tagged status');
  assert(json?.success === true, 'AC-5 server: success must be true');
  assert(Array.isArray(json.rows), 'AC-5 server: rows must be an array');
  if (json.rows.length === 0) {
    // No rows for this random tagEventId — search for any tag with rows so
    // the shape assertion has something to bite on. Fall back to skip if
    // there are no taggable rows on this instance.
    const indexResp = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/index?limit=20`);
    const candidateTags = (indexResp.json?.rows || [])
      .filter((r) => (r.applications + r.disputes) > 0)
      .slice(0, 5);
    let firstRow = null;
    for (const cand of candidateTags) {
      const r2 = await fetchJson(
        `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${cand.tagEventId}`
      );
      if (r2.json?.rows?.length) { firstRow = r2.json.rows[0]; break; }
    }
    if (!firstRow) {
      // Truly empty instance — skip per the codebase's pattern.
      console.log('    (skipped: no taggable rows on this instance to assert enrichment shape)');
      return;
    }
    assert('nip05' in firstRow,
      'AC-5 server: each row must include the new "nip05" key (may be null). ' +
        `Got keys: ${JSON.stringify(Object.keys(firstRow))}`);
    assert('about' in firstRow,
      'AC-5 server: each row must include the new "about" key (may be null). ' +
        `Got keys: ${JSON.stringify(Object.keys(firstRow))}`);
    assert('website' in firstRow,
      'AC-5 server: each row must include the new "website" key (may be null). ' +
        `Got keys: ${JSON.stringify(Object.keys(firstRow))}`);
    return;
  }
  const firstRow = json.rows[0];
  assert('nip05' in firstRow,
    'AC-5 server: each row must include the new "nip05" key (may be null). ' +
      `Got keys: ${JSON.stringify(Object.keys(firstRow))}`);
  assert('about' in firstRow,
    'AC-5 server: each row must include the new "about" key (may be null). ' +
      `Got keys: ${JSON.stringify(Object.keys(firstRow))}`);
  assert('website' in firstRow,
    'AC-5 server: each row must include the new "website" key (may be null). ' +
      `Got keys: ${JSON.stringify(Object.keys(firstRow))}`);
});

// ------------------------------------------------------------------
// AC-6 — Net score with positive/negative/zero color variants in
// TagPageRow.jsx.
// ------------------------------------------------------------------

t('AC-6: TagPageRow.jsx renders a Net score with positive/negative/zero color variants', () => {
  const src = readSafe(TAG_PAGE_ROW);
  // The row computes Net = applications - disputes and renders it inside
  // a span with `bs-tag-row-net` (per ADR Decision 2). Three variant
  // classes carry color semantics: is-positive, is-negative, is-zero.
  assert(
    /applications\s*-\s*disputes/.test(src),
    'AC-6: TagPageRow.jsx must compute Net as `applications - disputes` somewhere in its render path. ' +
      'No `applications - disputes` expression found.'
  );
  assert(
    /bs-tag-row-net/.test(src),
    'AC-6: TagPageRow.jsx must render a span/element with class "bs-tag-row-net" carrying the Net score ' +
      '(per ADR Decision 2). Class not found.'
  );
  assert(
    /is-positive/.test(src),
    'AC-6: TagPageRow.jsx must emit the `is-positive` variant class when Net > 0 (green). Not found.'
  );
  assert(
    /is-negative/.test(src),
    'AC-6: TagPageRow.jsx must emit the `is-negative` variant class when Net < 0 (red). Not found.'
  );
  assert(
    /is-zero/.test(src),
    'AC-6: TagPageRow.jsx must emit the `is-zero` variant class when Net === 0 (yellow / contested). Not found.'
  );
});

// ------------------------------------------------------------------
// AC-7 — Existing +N/-M counts visually secondary (smaller font +
// reduced opacity in styles.css for .bs-tag-row-counts).
// ------------------------------------------------------------------

t('AC-7: styles.css makes .bs-tag-row-counts visually secondary (smaller font + reduced opacity)', () => {
  const src = readSafe(UI_STYLES);
  // Find the .bs-tag-row-counts block. The new rule must include an
  // opacity declaration < 1 (reduced saturation) — the current rule does
  // not include opacity.
  const blockMatch = src.match(/\.bs-tag-row-counts\s*\{[^}]*\}/);
  assert(blockMatch,
    'AC-7: styles.css must contain a .bs-tag-row-counts rule. Not found.');
  const block = blockMatch[0];
  assert(
    /opacity\s*:\s*0?\.\d+/.test(block),
    'AC-7: .bs-tag-row-counts must include an `opacity: 0.xx` declaration (< 1) to de-prioritize the small ' +
      `+N/-M counts visually. Got block: ${block}`
  );
});

// ------------------------------------------------------------------
// AC-8 — Hover-only buttons in curated mode. TagPageRow.jsx
// accepts a `showActionsOnHover` prop and emits an `is-expanded-mode`
// class for the always-on Expanded view.
// Updated 2026-06-10: Story 18 / ADR 0016 removed the `is-revealed`
// touch-tap row-wide reveal (touch UX is now the ⋯ overflow menu — see
// the styles.css comment above .bs-tag-row-actions). The surviving
// Story-17 contract is the prop plus the is-expanded-mode class.
// ------------------------------------------------------------------

t('AC-8: TagPageRow.jsx accepts showActionsOnHover prop and emits is-expanded-mode state class', () => {
  const src = readSafe(TAG_PAGE_ROW);
  assert(
    /showActionsOnHover/.test(src),
    'AC-8: TagPageRow.jsx must reference the prop `showActionsOnHover` (per ADR Decision 2) so the parent ' +
      'can toggle hover-only vs always-on action buttons. Prop name not found.'
  );
  assert(
    /is-expanded-mode/.test(src),
    'AC-8 (as amended by ADR 0016): TagPageRow.jsx must conditionally apply the `is-expanded-mode` class ' +
      '(always-on actions in the Expanded view). The legacy `is-revealed` touch reveal was removed by ' +
      'Story 18; touch access to row actions is the ⋯ overflow menu. Class name not found.'
  );
});

// ------------------------------------------------------------------
// AC-9 — No layout shift: styles.css must enforce visibility:hidden
// on .bs-tag-row-actions with a reserved width (min-width or similar),
// and a hover/`is-revealed` rule flipping to visibility:visible.
// ------------------------------------------------------------------

t('AC-9: styles.css enforces no-jiggle (.bs-tag-row-actions: visibility:hidden + min-width + hover-reveal)', () => {
  const src = readSafe(UI_STYLES);
  // Default state: visibility:hidden with reserved width.
  const actionsBlockRe = /\.bs-tag-row-actions\s*\{[^}]*\}/;
  const blockMatch = src.match(actionsBlockRe);
  assert(blockMatch,
    'AC-9: styles.css must contain a .bs-tag-row-actions rule. Not found.');
  const block = blockMatch[0];
  assert(
    /visibility\s*:\s*hidden/.test(block),
    'AC-9: .bs-tag-row-actions must declare `visibility: hidden` as its default state, so the action slot ' +
      `is occupied (no jiggle) but not visible. Got: ${block}`
  );
  assert(
    /min-width\s*:/.test(block) || /width\s*:/.test(block),
    'AC-9: .bs-tag-row-actions must reserve horizontal space (via `min-width` or `width`) so the slot does not ' +
      `collapse and shift layout when buttons appear. Got: ${block}`
  );
  // Reveal rule: at least one selector that flips visibility to visible on
  // hover or the is-revealed class. Match patterns like
  // `.bs-tag-row:hover .bs-tag-row-actions` or `.bs-tag-row.is-revealed .bs-tag-row-actions`
  // followed by a rule body containing `visibility: visible`.
  const revealRe = /\.bs-tag-row[^{]*(?::hover|is-revealed|is-expanded-mode|:focus-within)[^{]*\.bs-tag-row-actions[^{]*\{[^}]*visibility\s*:\s*visible/;
  assert(
    revealRe.test(src),
    'AC-9: styles.css must include a reveal rule that flips .bs-tag-row-actions to `visibility: visible` ' +
      'on `.bs-tag-row:hover` / `.bs-tag-row.is-revealed` / `.bs-tag-row.is-expanded-mode` / `:focus-within`. ' +
      'No such selector found.'
  );
});

// ------------------------------------------------------------------
// AC-10 — Curated filter (Net >= 1) applied client-side in Tag.jsx
// when view options are collapsed.
// ------------------------------------------------------------------

t('AC-10: Tag.jsx applies a Curated filter (applications > disputes) when view options collapsed', () => {
  const src = readSafe(TAG_JSX);
  // The Curated rule is `applications > disputes` (algorithmically
  // identical to Net >= 1; ADR proves this). The filter sits in a
  // useMemo or inline filter expression. We assert the source contains
  // both the literal comparison and a reference to a `viewOptionsExpanded`
  // state guard.
  assert(
    /applications\s*>\s*disputes/.test(src),
    'AC-10: Tag.jsx must filter rows by `applications > disputes` in the Curated default view ' +
      '(per ADR Decision 4 + AC-10). Comparison not found.'
  );
  assert(
    /viewOptionsExpanded/.test(src),
    'AC-10: Tag.jsx must carry a `viewOptionsExpanded` state (or equivalently-named flag) gating whether the ' +
      'Curated filter is applied. State name not found.'
  );
});

// ------------------------------------------------------------------
// AC-11 — Expanded mode shows all rows + always-on buttons. The
// parent threads `showActionsOnHover={!viewOptionsExpanded}` so
// the row's hover-only behavior is off when expanded.
// ------------------------------------------------------------------

t('AC-11: Tag.jsx threads showActionsOnHover={!viewOptionsExpanded} into TagPageRow', () => {
  const src = readSafe(TAG_JSX);
  // Look for the explicit prop wiring. The exact JSX layout may vary
  // (could be a destructured variable assigned first) — accept either
  // inline `showActionsOnHover={!viewOptionsExpanded}` or a renaming via
  // a const.
  const inline = /showActionsOnHover=\{!viewOptionsExpanded\}/.test(src);
  const viaConst = /showActionsOnHover=\{[A-Za-z_][\w]*\}/.test(src) &&
    /(?:const|let)\s+\w+\s*=\s*!viewOptionsExpanded/.test(src);
  assert(
    inline || viaConst,
    'AC-11: Tag.jsx must wire `showActionsOnHover={!viewOptionsExpanded}` into each <TagPageRow> ' +
      '(directly or via a const derived from !viewOptionsExpanded). Neither pattern found.'
  );
});

// ------------------------------------------------------------------
// AC-12 — Curated view defaults to house POV unless the viewer has
// switched to their own. This is the existing useTagDetail behavior
// (wotPov defaults to 'house' unless 'user' is set). Regression sentinel.
// ------------------------------------------------------------------

t('AC-12: useTagDetail still defaults wotPov to user when authenticated (PoV cascade unchanged)', () => {
  const hookPath = path.join(REPO_ROOT, 'ui/src/hooks/useTagDetail.js');
  const src = readSafe(hookPath);
  // The current code at useTagDetail sets wotPov='user' when user.pubkey
  // is present (line 81-83). The Curated view's "default to house unless
  // user has switched" semantic is upstream — the user's POV setting is
  // the override the user makes via the existing selector. We just assert
  // that useTagDetail still threads `wotPov` and `userPubkey` from the
  // viewer's auth state — this story does not break that cascade.
  assert(
    /wotPov/.test(src),
    'AC-12: useTagDetail.js must still thread `wotPov` to the rows endpoint — the Curated semantic depends ' +
      'on the existing POV cascade. Reference not found.'
  );
  assert(
    /userPubkey/.test(src),
    'AC-12: useTagDetail.js must still thread `userPubkey` alongside wotPov for the user-POV branch. ' +
      'Reference not found.'
  );
});

// ------------------------------------------------------------------
// AC-13 — "Tag someone" button on the toolbar row (left-aligned),
// owned by TagViewControls.
// ------------------------------------------------------------------

t('AC-13: TagViewControls.jsx renders a "Tag someone" button', () => {
  if (!fileExists(TAG_VIEW_CONTROLS)) {
    throw new Error('AC-13: TagViewControls.jsx not present yet — cannot assert "Tag someone" button.');
  }
  const src = readSafe(TAG_VIEW_CONTROLS);
  assert(
    /Tag someone/.test(src),
    'AC-13: TagViewControls.jsx must render a button labeled "Tag someone" — the affordance that opens ' +
      'the search modal (per ADR Decision 5). Literal not found.'
  );
});

// ------------------------------------------------------------------
// AC-14 — TagSomeoneModal.jsx exists with backdrop chrome and an
// onClose handler driven by both Escape key and backdrop click.
// ------------------------------------------------------------------

t('AC-14: ui/src/components/TagSomeoneModal.jsx exists', () => {
  assert(
    fileExists(TAG_SOMEONE_MODAL),
    'AC-14: ui/src/components/TagSomeoneModal.jsx must exist — the clearly-separated modal for the ' +
      '"Tag someone" search flow. File not found.'
  );
});

t('AC-14: TagSomeoneModal.jsx uses a backdrop element (className containing "backdrop" or "modal")', () => {
  if (!fileExists(TAG_SOMEONE_MODAL)) {
    throw new Error('AC-14: TagSomeoneModal.jsx not present yet.');
  }
  const src = readSafe(TAG_SOMEONE_MODAL);
  assert(
    /className=["'][^"']*(?:backdrop|modal|tsm-)[^"']*["']/.test(src),
    'AC-14: TagSomeoneModal.jsx must render a backdrop/modal chrome element with a class containing one of ' +
      '"backdrop"/"modal"/"tsm-" (per ADR Decision 5 — modal chrome reuses or namespaces the existing pcd-* pattern). ' +
      'No backdrop class found.'
  );
});

// ------------------------------------------------------------------
// AC-15 — Verification Score plumbing.
//   - ui/src/utils/wotScore.js exists and exports getWotScore.
//   - BrainstormSearch.jsx imports getWotScore from the new util
//     instead of defining its own.
//   - TagSomeoneModal.jsx references getWotScore for search-result rows.
// ------------------------------------------------------------------

t('AC-15: ui/src/utils/wotScore.js exists and exports getWotScore', () => {
  assert(
    fileExists(WOT_SCORE_UTIL),
    'AC-15: ui/src/utils/wotScore.js must exist (extracted from BrainstormSearch.jsx per ADR Decision 6). ' +
      'File not found.'
  );
  const src = readSafe(WOT_SCORE_UTIL);
  assert(
    /export\s+(?:default\s+)?(?:function|const)\s+getWotScore/.test(src) ||
      /export\s*\{[^}]*\bgetWotScore\b[^}]*\}/.test(src),
    'AC-15: wotScore.js must export `getWotScore`. No export found.'
  );
});

t('AC-15: BrainstormSearch.jsx imports getWotScore from the new shared util (no local definition)', () => {
  const src = readSafe(BRAINSTORM_SEARCH);
  // The local function definition `function getWotScore(hit, metric, povSuffix)`
  // must be gone. An import statement from `../utils/wotScore` must be present.
  assert(
    !/function\s+getWotScore\s*\(/.test(src),
    'AC-15: BrainstormSearch.jsx must no longer define `function getWotScore(...)` locally — it now imports from ' +
      'the shared util (per ADR Decision 6). Local definition still present.'
  );
  assert(
    /from\s+['"]\.\.\/utils\/wotScore['"]/.test(src),
    'AC-15: BrainstormSearch.jsx must import from `../utils/wotScore`. Import not found.'
  );
});

t('AC-15: TagSomeoneModal.jsx renders Verification Score (or uses getWotScore) for search-result rows', () => {
  if (!fileExists(TAG_SOMEONE_MODAL)) {
    throw new Error('AC-15: TagSomeoneModal.jsx not present yet.');
  }
  const src = readSafe(TAG_SOMEONE_MODAL);
  assert(
    /Verification Score/.test(src) || /getWotScore/.test(src),
    'AC-15: TagSomeoneModal.jsx must surface the Verification Score (literal label or via the getWotScore helper) ' +
      'on search-result rows that have no per-tag assertion data yet. Neither marker found.'
  );
});

// ------------------------------------------------------------------
// AC-15a — Modal search-result rows apply the same hover-only button
// behavior as the main list. The simplest way to enforce this is to
// have the modal reuse <TagPageRow> with showActionsOnHover, OR to
// directly emit the same `is-revealed` reveal pattern.
// ------------------------------------------------------------------

t('AC-15a: TagSomeoneModal.jsx applies hover-only reveal behavior to search-result rows', () => {
  if (!fileExists(TAG_SOMEONE_MODAL)) {
    throw new Error('AC-15a: TagSomeoneModal.jsx not present yet.');
  }
  const src = readSafe(TAG_SOMEONE_MODAL);
  // Either: reuses <TagPageRow showActionsOnHover={...} />, OR carries its
  // own is-revealed treatment.
  const reusesRow = /<TagPageRow[^>]*showActionsOnHover/.test(src);
  const carriesReveal = /is-revealed/.test(src) && /showActionsOnHover/.test(src);
  assert(
    reusesRow || carriesReveal,
    'AC-15a: TagSomeoneModal.jsx must apply the AC-8 hover-only reveal behavior to its search-result rows. ' +
      'Either reuse <TagPageRow showActionsOnHover={...}> or emit the same is-revealed pattern. Neither found.'
  );
});

// ------------------------------------------------------------------
// AC-16 — Modal closes on Escape and backdrop click.
// ------------------------------------------------------------------

t('AC-16: TagSomeoneModal.jsx wires Escape key + backdrop click to onClose', () => {
  if (!fileExists(TAG_SOMEONE_MODAL)) {
    throw new Error('AC-16: TagSomeoneModal.jsx not present yet.');
  }
  const src = readSafe(TAG_SOMEONE_MODAL);
  assert(
    /onClose\b/.test(src),
    'AC-16: TagSomeoneModal.jsx must accept and call an `onClose` prop. Not found.'
  );
  assert(
    /['"]Escape['"]/.test(src) || /e\.key\s*===\s*['"]Escape['"]/.test(src),
    'AC-16: TagSomeoneModal.jsx must close on Escape (handle a keydown / keyup with key === "Escape"). ' +
      'No Escape handler found.'
  );
});

// ------------------------------------------------------------------
// AC-17 — Pin button tooltip in TagPinAffordance.jsx.
// Native title attribute is sufficient per ADR Decision 10.
// ------------------------------------------------------------------

// Updated 2026-06-10: Story 18 / ADR 0016 migrated tooltips from the
// native `title=` attribute to the project's fast-onset `data-bs-tooltip`
// mechanism (ADR 0016 "Tooltip onset"; reaffirmed by ADR 0018 for this
// button). The AC's intent — an explanatory tooltip on the Pin button —
// is unchanged; only the carrier attribute moved.
t('AC-17: TagPinAffordance.jsx Pin button carries an explanatory data-bs-tooltip', () => {
  const src = readSafe(TAG_PIN_AFFORDANCE);
  assert(
    /<button[^>]*\bdata-bs-tooltip=/s.test(src) || /data-bs-tooltip=\{/.test(src),
    'AC-17 (as amended by ADR 0016/0018): TagPinAffordance.jsx must carry a `data-bs-tooltip` attribute ' +
      'on the Pin button (fast-onset tooltip; replaced the native title= attribute). Attribute not found.'
  );
  assert(
    /Trusted List|kind-30392|30392|Other Nostr apps/i.test(src),
    'AC-17: the Pin button tooltip copy should explain pinning briefly — referencing Trusted List, ' +
      'kind-30392, or "Other Nostr apps" (baseline copy from ADR 0014 Decision 10).'
  );
});

// ------------------------------------------------------------------
// AC-18 — Curation dialog header intro paragraph.
// ------------------------------------------------------------------

t('AC-18: CurationMethodDialog.jsx renders a `pcd-intro` paragraph between tag-info and form', () => {
  const src = readSafe(CURATION_DIALOG);
  assert(
    /pcd-intro/.test(src),
    'AC-18: CurationMethodDialog.jsx must include an intro block with class "pcd-intro" containing a ' +
      'paragraph that explains what pinning does (per ADR Decision 9). Class not found.'
  );
  // The intro must mention what pinning produces ("Trusted List" /
  // "30392") so external readers of the source can find it.
  const introBlock = src.match(/pcd-intro[\s\S]{0,500}<\/div>/);
  assert(
    introBlock && /Trusted List|30392/.test(introBlock[0]),
    'AC-18: The pcd-intro block should mention "Trusted List" or "30392" — mirroring PinsIntro at ' +
      `Pins.jsx:28–40 (per ADR Decision 9). Found: ${introBlock?.[0] || '(no intro block)'}`
  );
});

// ------------------------------------------------------------------
// AC-19 — Default cutoff flips from 2 to 1 in
// ui/src/utils/publishTagPin.js.
// ------------------------------------------------------------------

t('AC-19: defaultCurationMethod in publishTagPin.js defaults cutoff to 1 (not 2)', () => {
  const src = readSafe(PUBLISH_TAG_PIN);
  const fnMatch = src.match(/export\s+function\s+defaultCurationMethod\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};?\s*\}/);
  assert(fnMatch,
    'AC-19: could not locate the `defaultCurationMethod` function in publishTagPin.js — file shape changed?');
  const body = fnMatch[1];
  assert(
    /cutoff:\s*1\b/.test(body),
    `AC-19: defaultCurationMethod must return cutoff: 1 (was 2). Got body: ${body}`
  );
  assert(
    !/cutoff:\s*2\b/.test(body),
    `AC-19: defaultCurationMethod must NOT still return cutoff: 2. Got body: ${body}`
  );
});

t('AC-19: CurationMethodDialog cutoff useState fallback aligns to ?? 1', () => {
  const src = readSafe(CURATION_DIALOG);
  // The cutoff useState fallback uses `init.cutoff ?? 1` post-implementation
  // (was `?? 2`). Defensive fallback for legacy pins missing the field.
  assert(
    /init\.cutoff\s*\?\?\s*1\b/.test(src),
    'AC-19: CurationMethodDialog.jsx must initialize cutoff state with `init.cutoff ?? 1` (was ?? 2). ' +
      'Per ADR Decision 11. Pattern not found.'
  );
});

// ------------------------------------------------------------------
// AC-20 — Advanced disclosure block hidden via {false && (...)} guard.
// ------------------------------------------------------------------

t('AC-20: CurationMethodDialog.jsx Advanced disclosure is wrapped in `{false && (...)}` guard', () => {
  const src = readSafe(CURATION_DIALOG);
  // The Advanced block was a <details className="pcd-advanced"> ...
  // Post-implementation, it must be wrapped in `{false && (` ... `)}`.
  // We require the substring `{false &&` appearing before a `pcd-advanced`
  // occurrence, within ~200 chars of it.
  const advancedRe = /\{\s*false\s*&&\s*\([\s\S]{0,400}pcd-advanced/;
  assert(
    advancedRe.test(src),
    'AC-20: CurationMethodDialog.jsx must wrap the Advanced disclosure block (containing `pcd-advanced`) in ' +
      'a `{false && ( ... )}` guard so the field is hidden but the code remains in place (per ADR Decision 8). ' +
      'Guard pattern not found near pcd-advanced.'
  );
});

// ------------------------------------------------------------------
// AC-21 — Include rank scores checkbox hidden, and includeScoreInTL
// default flips to true in publishTagPin.js.
// ------------------------------------------------------------------

t('AC-21: CurationMethodDialog.jsx Include-rank-scores block is wrapped in `{false && (...)}` guard', () => {
  const src = readSafe(CURATION_DIALOG);
  // The Include-rank-scores block contains `pcd-toggle` and the literal
  // "Include rank scores" (per current code lines 176-191). Wrap in
  // `{false && ( ... )}` per ADR Decision 8.
  const includeBlockRe = /\{\s*false\s*&&\s*\([\s\S]{0,400}pcd-toggle/;
  assert(
    includeBlockRe.test(src),
    'AC-21: CurationMethodDialog.jsx must wrap the Include-rank-scores block (containing `pcd-toggle`) in a ' +
      '`{false && ( ... )}` guard so the toggle is hidden but the code remains (per ADR Decision 8). ' +
      'Guard pattern not found near pcd-toggle.'
  );
});

t('AC-21: defaultCurationMethod includeScoreInTL flips from false to true', () => {
  const src = readSafe(PUBLISH_TAG_PIN);
  const fnMatch = src.match(/export\s+function\s+defaultCurationMethod\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};?\s*\}/);
  assert(fnMatch,
    'AC-21: could not locate the `defaultCurationMethod` function in publishTagPin.js.');
  const body = fnMatch[1];
  assert(
    /includeScoreInTL:\s*true\b/.test(body),
    `AC-21: defaultCurationMethod must return includeScoreInTL: true (was false). Got body: ${body}`
  );
  assert(
    !/includeScoreInTL:\s*false\b/.test(body),
    `AC-21: defaultCurationMethod must NOT still return includeScoreInTL: false. Got body: ${body}`
  );
});

// ------------------------------------------------------------------
// Regression sentinels (R-tests) — must PASS pre- AND post-implementation.
// ------------------------------------------------------------------

t('R-1: /api/profile-tags/profiles-tagged still returns applications + disputes integers on rows', async () => {
  const VALID_HEX = 'a'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${VALID_HEX}`
  );
  assertEqual(status, 200, 'R-1: profiles-tagged status');
  assert(Array.isArray(json?.rows), 'R-1: rows must be an array');
  if (json.rows.length === 0) return;
  for (const row of json.rows) {
    assert(typeof row.applications === 'number',
      `R-1: row.applications must remain a number; got ${JSON.stringify(row)}`);
    assert(typeof row.disputes === 'number',
      `R-1: row.disputes must remain a number; got ${JSON.stringify(row)}`);
  }
});

t('R-2: TagPageRow.jsx still emits +N and −N count text (presentation reshape, not removal)', () => {
  const src = readSafe(TAG_PAGE_ROW);
  // The current `+{row.applications}` and `−{row.disputes}` patterns must
  // remain — Story 17 reshapes their presentation (smaller, less saturated)
  // but the values themselves still render.
  assert(
    /\+\{row\.applications\}/.test(src) || /\+\$\{row\.applications\}/.test(src),
    'R-2: TagPageRow.jsx must still render `+{row.applications}` (or similar) — Story 17 keeps the count text. ' +
      'Pattern not found.'
  );
  assert(
    /−\{row\.disputes\}/.test(src) || /-\{row\.disputes\}/.test(src),
    'R-2: TagPageRow.jsx must still render `−{row.disputes}` (or `-{row.disputes}`) — Story 17 keeps the count text. ' +
      'Pattern not found.'
  );
});

t('R-3: refreshPinnedTags.js server-side cutoff fallback is 1 (superseded by Story 21 / ADR 0019 AC-21)', () => {
  const src = readSafe(REFRESH_PINNED_TAGS);
  // SUPERSEDED: ADR 0014/0016 Decision 11 kept the server fallback at 2.
  // Story 21 / ADR 0019 AC-21 unifies the default at 1 everywhere (client
  // already sent 1; this fallback now matches). An explicit finite cutoff is
  // still honored unchanged.
  assert(
    /curation\.cutoff\s*:\s*1/.test(src),
    'R-3: refreshPinnedTags.js cutoff fallback must default to 1 (Story 21 / ADR 0019 AC-21). Pattern not found.'
  );
  assert(
    !/curation\.cutoff\s*:\s*2/.test(src),
    'R-3: refreshPinnedTags.js must no longer default the cutoff fallback to 2 (superseded by ADR 0019).'
  );
});

t('R-4: CurationMethodDialog.jsx keeps useState declarations for observer/includeScoreInTL/advancedOpen (hide-not-delete)', () => {
  const src = readSafe(CURATION_DIALOG);
  // Per ADR Decision 8: the hidden fields keep their useState declarations
  // so default values flow through to onSubmit. Asserting state retention
  // catches a future "deleted the dead code" mistake.
  assert(
    /useState\([^)]*observer/.test(src) || /\[observer,\s*setObserver\]/.test(src),
    'R-4: CurationMethodDialog.jsx must keep its `observer` useState — the field is hidden, not deleted ' +
      '(per ADR Decision 8). State declaration not found.'
  );
  assert(
    /useState\([^)]*includeScoreInTL/.test(src) ||
      /\[includeScoreInTL,\s*setIncludeScoreInTL\]/.test(src),
    'R-4: CurationMethodDialog.jsx must keep its `includeScoreInTL` useState — the field is hidden, not deleted ' +
      '(per ADR Decision 8). State declaration not found.'
  );
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tag-detail-curated-view-and-pin-polish tests (Story 17) ---');
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
  console.log(`\ntag-detail-curated-view-and-pin-polish: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
