/**
 * Tests for Story 20: Move Pin detail into a Tag-detail "Pinned" tab;
 * simplify /pins rows.
 * ADR: engineering-team/decisions/0018-pin-detail-into-tag-pinned-tab.md
 *
 * Intentionally failing until the feature is implemented. Hand-rolled in
 * the project's existing source-inspection style (no new framework) —
 * same pattern as test/tag-detail-curated-view-and-pin-polish.test.js.
 *
 * This story is client-side UI/routing only (no server/wire/concept
 * change), so the suite is pure file inspection and runs offline.
 *
 * Three classes of test:
 *   - new-structure (fail now, pass after impl)
 *   - preservation guards (pass now, must stay passing) — AC-17 keep-set
 *     + AC-18 default-tab machinery
 *   - structural proxies for behavioral ACs (AC-4/7/8); runtime is a
 *     manual/browser walkthrough by the Reviewer.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const UI_PAGES = path.join(REPO_ROOT, 'ui/src/pages');
const UI_COMPONENTS = path.join(REPO_ROOT, 'ui/src/components');

const TAG_JSX = path.join(UI_PAGES, 'Tag.jsx');
const PINS_JSX = path.join(UI_PAGES, 'Pins.jsx');
const PIN_DETAIL_JSX = path.join(UI_PAGES, 'PinDetail.jsx');
const APP_JSX = path.join(REPO_ROOT, 'ui/src/App.jsx');
const PINNED_LIST_PANEL = path.join(UI_COMPONENTS, 'PinnedListPanel.jsx');
const PIN_REDIRECT = path.join(UI_COMPONENTS, 'PinRedirect.jsx');
const TAG_PIN_AFFORDANCE = path.join(UI_COMPONENTS, 'TagPinAffordance.jsx');
const TAG_PAGE_ROW = path.join(UI_COMPONENTS, 'TagPageRow.jsx');
const TAG_SOMEONE_MODAL = path.join(UI_COMPONENTS, 'TagSomeoneModal.jsx');
// Story 21 / ADR 0019 superseded TLExportButton/TLShareButton: the single
// collapsed Export affordance now lives in ExportModal.jsx.
const EXPORT_MODAL = path.join(UI_COMPONENTS, 'ExportModal.jsx');
const STYLES = path.join(REPO_ROOT, 'ui/src/styles.css');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (err) {
    throw new Error(`could not read ${path.relative(REPO_ROOT, p)} (${err.code || err.message})`);
  }
}

/** Read a file if it exists, else return '' (so absence is a clean assert miss). */
function readOrEmpty(p) {
  return fileExists(p) ? fs.readFileSync(p, 'utf8') : '';
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

/* ─────────────────────────── Tag-detail tab structure ─────────────────── */

test('AC-1: Tag.jsx renders the tab strip only when the viewer has pinned (gated on viewerPin)', () => {
  const src = readSafe(TAG_JSX);
  // A tablist must exist...
  assert(/role=["']tablist["']/.test(src),
    'AC-1: Tag.jsx must render a tablist (role="tablist") for the Pinned-tab UI. Not found.');
  // ...and its rendering must be gated on viewerPin / a pinned flag so
  // unpinned viewers see no tab strip.
  assert(/viewerPin\s*&&[\s\S]{0,200}role=["']tablist["']/.test(src)
    || /(isPinned|viewerPin)[\s\S]{0,120}\?[\s\S]{0,200}tablist/.test(src)
    || /\{\s*(isPinned|viewerPin)\s*&&/.test(src),
    'AC-1: the tablist must be conditional on viewerPin/isPinned so unpinned viewers see no tab strip.');
});

test('AC-2: Tag.jsx exposes a keyboard-operable tablist with default + Pinned tabs', () => {
  const src = readSafe(TAG_JSX);
  assert(/role=["']tab["']/.test(src),
    'AC-2: tab buttons must carry role="tab".');
  assert(/Pinned/.test(src),
    'AC-2: a "Pinned" tab label must be present in Tag.jsx.');
});

test('AC-3: default selected tab derives from pin status (pinned → Pinned tab) via tab query param', () => {
  const src = readSafe(TAG_JSX);
  assert(/useSearchParams/.test(src),
    'AC-3/13/16: Tag.jsx must use useSearchParams to read the ?tab= selector.');
  assert(/['"]tab['"]/.test(src) && /['"]pinned['"]/.test(src),
    'AC-3: Tag.jsx must reference the "tab" param and the "pinned" value.');
  // The default-when-pinned derivation must conjoin "pinned" with a pin flag
  // (so a stale ?tab=pinned on an un-pinned tag falls back to default).
  assert(/(isPinned|viewerPin)[\s\S]{0,60}['"]pinned['"]/.test(src)
    || /['"]pinned['"][\s\S]{0,60}(isPinned|viewerPin)/.test(src),
    'AC-3 edge: selecting the Pinned tab must be conjoined with viewerPin/isPinned.');
});

test("AC-4: first pin flow switches the active tab to 'pinned' (structural proxy)", () => {
  const src = readSafe(TAG_JSX);
  // After a successful pin, the page must select the Pinned tab. The ADR
  // names setActiveTab('pinned'); accept any setter that targets 'pinned'.
  assert(/set\w*[Tt]ab\(\s*['"]pinned['"]\s*\)/.test(src),
    "AC-4: the pin flow must switch the active tab to 'pinned' (e.g. setActiveTab('pinned')). Not found.");
});

test('AC-5: PinnedListPanel renders TL metadata (Observer/Cutoff/Min rank/Last refreshed/d-tag/naddr) and OMITS the Tag row', () => {
  assert(fileExists(PINNED_LIST_PANEL),
    'AC-5/6: ui/src/components/PinnedListPanel.jsx must exist (extracted from PinDetail).');
  const src = readSafe(PINNED_LIST_PANEL);
  for (const label of ['Observer', 'Cutoff', 'Min rank', 'Last refreshed', 'd-tag']) {
    assert(src.includes(label),
      `AC-5: PinnedListPanel must render the "${label}" metadata row (ported from PinDetail).`);
  }
  assert(/naddr/i.test(src),
    'AC-5: PinnedListPanel must render the naddr / Share ID metadata.');
  // The Tag row is redundant on the tag's own page and must be omitted.
  assert(!/<dt>\s*Tag\s*<\/dt>/.test(src),
    'AC-5: PinnedListPanel must OMIT the "<dt>Tag</dt>" metadata row (redundant on the tag page).');
});

test('AC-6: PinnedListPanel renders the kind-30392 member list via useTLDetail', () => {
  const src = readSafe(PINNED_LIST_PANEL);
  assert(/useTLDetail/.test(src),
    'AC-6: PinnedListPanel must drive the member list from useTLDetail(dTag).');
  assert(/members\b/.test(src) && /\.map\(/.test(src),
    'AC-6: PinnedListPanel must render members.map(...) (the TL member list).');
});

test('AC-7: Tag.jsx keeps the default-tab section mounted (panels toggled, not unmounted)', () => {
  const src = readSafe(TAG_JSX);
  // State preservation across tab switches requires the default-tab panel
  // to stay mounted (hidden), not be conditionally unmounted. Marker: a
  // hidden/aria-hidden toggle or a role="tabpanel" with hidden attribute.
  assert(/role=["']tabpanel["']/.test(src),
    'AC-7: tab content must be wrapped in role="tabpanel" regions.');
  assert(/\bhidden(=|\s|\})/.test(src) || /aria-hidden/.test(src) || /hidden=\{/.test(src),
    'AC-7: the inactive tabpanel must be hidden (kept mounted), not unmounted, to preserve sort/filter/scroll.');
});

test('AC-8: PinnedListPanel carries owner controls keyed by viewerPin.pinEventId', () => {
  const src = readSafe(PINNED_LIST_PANEL);
  assert(/CurationMethodDialog/.test(src),
    'AC-8: PinnedListPanel must reuse CurationMethodDialog for Edit curation.');
  assert(/onUnpin/.test(src),
    'AC-8: the curation dialog must wire onUnpin (unpinning lives here, not on /pins).');
  // Story 21 / ADR 0019: Share + NIP-51 Export + Refresh collapsed into the
  // single ExportModal affordance.
  assert(/ExportModal/.test(src),
    'AC-8: PinnedListPanel must use the collapsed ExportModal (subsumes Share, NIP-51 Export, and Refresh).');
  assert(/pinEventId/.test(src),
    'AC-8: owner actions must be keyed by viewerPin.pinEventId (no separate pins lookup needed).');
});

/* ─────────────────────────── Header button as tab toggle ───────────────── */

test('AC-9: TagPinAffordance unpinned label is "Pin" and click calls onPin', () => {
  const src = readSafe(TAG_PIN_AFFORDANCE);
  assert(/onPin\b/.test(src),
    'AC-9: TagPinAffordance must still call onPin() in the unpinned state.');
  assert(/Pin\b/.test(src),
    'AC-9: the unpinned label must read "Pin".');
});

test("AC-10: TagPinAffordance pinned-on-default switches tab, NOT navigate('/pin')", () => {
  const src = readSafe(TAG_PIN_AFFORDANCE);
  // The button must no longer navigate to the retired /pin page.
  assert(!/navigate\(\s*[`'"]\/pin\//.test(src),
    "AC-10: TagPinAffordance must NOT navigate to '/pin/...' (route retired). Old navigation still present.");
  // It must accept a tab-switch callback and a way to know the active tab.
  assert(/onSwitchTab|onSelectTab|switchTab|setActiveTab/.test(src),
    'AC-10/11: TagPinAffordance must take a tab-switch callback (e.g. onSwitchTab).');
  assert(/activeTab/.test(src),
    'AC-10/11: TagPinAffordance must know the activeTab to decide which way to toggle.');
  assert(/Pinned/.test(src),
    'AC-10: the pinned-on-default label must read "Pinned".');
});

test('AC-11: TagPinAffordance on Pinned tab shows "Back to Tag"', () => {
  const src = readSafe(TAG_PIN_AFFORDANCE);
  assert(/Back to Tag/.test(src),
    'AC-11: when on the Pinned tab, the button label must read "Back to Tag".');
});

/* ─────────────────────────── /pins simplified rows ────────────────────── */

test('AC-12: Pins.jsx rows carry no action controls (no Share/Export/Edit dialog/overflow menu)', () => {
  const src = readSafe(PINS_JSX);
  assert(!/TLShareButton/.test(src),
    'AC-12: Pins.jsx must not render TLShareButton on rows.');
  assert(!/TLExportButton/.test(src),
    'AC-12: Pins.jsx must not render TLExportButton on rows.');
  assert(!/CurationMethodDialog/.test(src),
    'AC-12: Pins.jsx must not render the curation/edit dialog (per-pin management moved to the Pinned tab).');
  assert(!/editingPin/.test(src),
    'AC-12: Pins.jsx must drop the per-row edit-dialog state (editingPin).');
  assert(!/menuOpen/.test(src),
    'AC-12: Pins.jsx PinRow must drop the overflow-menu state (menuOpen).');
});

test('AC-13: Pins.jsx rows link to /tag/:slug/:eventId?tab=pinned', () => {
  const src = readSafe(PINS_JSX);
  assert(/\/tag\//.test(src) && /tab=pinned/.test(src),
    'AC-13: each /pins row must link to its tag detail page with ?tab=pinned selected.');
  // And must NOT link to the retired /pin/ detail route.
  assert(!/to=\{?[`'"]\/pin\//.test(src),
    'AC-13: /pins rows must not link to the retired /pin/:dTag route.');
});

test('AC-14: Pins.jsx rows render an always-visible right-edge chevron', () => {
  const src = readSafe(PINS_JSX);
  assert(/bs-pins-row-chevron/.test(src) || /›/.test(src),
    'AC-14: each /pins row must show a right-edge chevron ("›") to signal tappability on touch.');
  const css = readSafe(STYLES);
  assert(/\.bs-pins-row-chevron/.test(css),
    'AC-14: styles.css must style .bs-pins-row-chevron (right-aligned, always visible).');
});

test('AC-15: Pins.jsx keeps heading/intro/sign-in/empty + page-level Refresh all', () => {
  const src = readSafe(PINS_JSX);
  assert(/PinsIntro/.test(src), 'AC-15: the PinsIntro block must remain.');
  assert(/Sign in/i.test(src), 'AC-15: the signed-out sign-in prompt must remain.');
  assert(/haven't pinned/i.test(src) || /Browse tags/.test(src),
    'AC-15: the empty state must remain.');
  assert(/Refresh all/i.test(src) && /usePins/.test(src),
    'AC-15: the page-level "Refresh all" control and usePins must remain (batch action kept for now).');
});

/* ─────────────────────────── /pin redirect ────────────────────────────── */

test('AC-16: /pin/:dTag route no longer renders PinDetail; redirects to the tag Pinned tab', () => {
  const app = readSafe(APP_JSX);
  const m = app.match(/path:\s*['"]\/pin\/:dTag['"][\s\S]{0,120}?element:\s*<\s*(\w+)/);
  assert(m, 'AC-16: could not locate the /pin/:dTag route element in App.jsx.');
  assert(m[1] !== 'PinDetail',
    `AC-16: the /pin/:dTag route must no longer render <PinDetail> (got <${m[1]}>). It should redirect.`);
  // The redirect target (in App.jsx, a PinRedirect component, or the
  // reduced PinDetail shell) must build the tag Pinned-tab URL.
  const redirectSrc = app + readOrEmpty(PIN_REDIRECT) + readOrEmpty(PIN_DETAIL_JSX);
  assert(/tab=pinned/.test(redirectSrc) && /\/tag\//.test(redirectSrc),
    'AC-16: the /pin/:dTag redirect must navigate to /tag/:slug/:eventId?tab=pinned.');
});

/* ─────────────────────────── AC-17 preservation guards ────────────────── */

test('AC-17 keep: export-modal backdrop + Escape-close preserved in ExportModal + styles', () => {
  // Story 21 / ADR 0019: the export modal moved from TLExportButton to the
  // collapsed ExportModal; backdrop + Escape-close must be preserved there.
  const src = readSafe(EXPORT_MODAL);
  assert(/bs-tl-export-backdrop/.test(src),
    'AC-17: ExportModal must keep the modal backdrop wrapper (mobile usability).');
  assert(/Escape/.test(src) && /handleClose/.test(src),
    'AC-17: ExportModal must keep Escape-to-close / click-outside handling.');
  const css = readSafe(STYLES);
  assert(/\.bs-tl-export-backdrop/.test(css),
    'AC-17: styles.css must keep .bs-tl-export-backdrop.');
});

test('AC-17 keep: menuRecentlyClosedRef stacked-menu guard preserved in TagPageRow + TagSomeoneModal', () => {
  assert(/menuRecentlyClosedRef/.test(readSafe(TAG_PAGE_ROW)),
    'AC-17: TagPageRow must keep the menuRecentlyClosedRef stacked-menu guard.');
  assert(/menuRecentlyClosedRef/.test(readSafe(TAG_SOMEONE_MODAL)),
    'AC-17: TagSomeoneModal must keep passing menuRecentlyClosedRef to its rows.');
});

test('AC-17 rework: dead .bs-pins-row-overflow-trigger/.bs-pins-row-actions-menu CSS removed', () => {
  const css = readSafe(STYLES);
  assert(!/\.bs-pins-row-overflow-trigger/.test(css),
    'AC-17: the dead .bs-pins-row-overflow-trigger CSS (pins overflow WIP) must be removed once rows are plain links.');
  assert(!/\.bs-pins-row-actions-menu/.test(css),
    'AC-17: the dead .bs-pins-row-actions-menu CSS must be removed.');
});

/* ─────────────────────────── AC-18 regression guard ───────────────────── */

test('AC-18: Tag.jsx default tab still wires TagViewControls + TagPageRow + TagSomeoneModal', () => {
  const src = readSafe(TAG_JSX);
  assert(/TagViewControls/.test(src),
    'AC-18: the default tab must keep TagViewControls (Stories 17/18 behavior).');
  assert(/TagPageRow/.test(src),
    'AC-18: the default tab must keep the TagPageRow list.');
  assert(/TagSomeoneModal/.test(src),
    'AC-18: the "Tag someone" modal must remain wired.');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- pin-detail-into-tag-pinned-tab tests (Story 20) ---');
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
  console.log(`\npin-detail-into-tag-pinned-tab: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
