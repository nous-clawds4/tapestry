/**
 * Tests for Story 21: collapse pin publication into a single "Export" concept.
 * ADR: engineering-team/decisions/0019-collapse-into-export-concept.md
 *
 * These tests are intentionally FAILING until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layer: source-contract guards. This story is overwhelmingly UI/interaction
 * (an Export modal, a per-assertion re-export orchestrator with a NIP-07
 * prompt, a live two-line sync-status state machine). There is no UI unit
 * runner in this repo, so — per the existing pattern (see the syncWoT.sh /
 * absent-endpoint guards in nip51-list-export-from-pins.test.js) — we lock
 * the contract by asserting:
 *
 *   1. The server-observable change (default curation cutoff 2 → 1).
 *   2. The AC-mandated user-visible copy is present in the UI source
 *      (help lines, disclosure label, the four sync-status messages).
 *   3. The collapse: the standalone "Refresh now" affordance is gone.
 *   4. The re-export orchestrator exists and is wired into BOTH assertion
 *      entry points, and gates re-export on the export footprint.
 *
 * The interactive behaviours these guards cannot reach — modal
 * enable/disable when both kinds are unchecked (AC-5), publish branching
 * (AC-6/7), debounce/coalescing of rapid taggings, the live NIP-07
 * re-export prompt (AC-12/14), post-export row visibility (AC-10), and the
 * timestamp line (AC-17) — are covered by manual / Playwright verification
 * per the test plan. The story is "okay if there aren't many tests as this
 * is very UI dependent."
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UI_SRC = path.join(ROOT, 'ui', 'src');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function readFileSafe(rel) {
  const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  try { return fs.readFileSync(abs, 'utf8'); }
  catch { return ''; }
}

/** Concatenate every JS/JSX source file under ui/src into one string so a
 *  guard can assert "this user-facing text exists somewhere in the UI"
 *  without coupling to the Implementer's exact file/component choices. */
let _uiTreeCache = null;
function readUiTree() {
  if (_uiTreeCache !== null) return _uiTreeCache;
  const out = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|jsx)$/.test(e.name)) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(UI_SRC);
  _uiTreeCache = out.join('\n');
  return _uiTreeCache;
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

/* ── F. Default curation cutoff is 1 (AC-21/22/23) — server-observable ── */

test('AC-21: refreshPinnedTags cutoff fallback is 1, not 2', () => {
  const src = readFileSafe('src/api/trustedList/refreshPinnedTags.js');
  assert(src.length > 0, 'could not read src/api/trustedList/refreshPinnedTags.js');
  assert(!/Number\.isFinite\(curation\.cutoff\)\s*\?\s*curation\.cutoff\s*:\s*2\b/.test(src),
    'AC-21: the cutoff fallback in refreshPinnedTags.js still defaults to 2 — it must default to 1');
  assert(/Number\.isFinite\(curation\.cutoff\)\s*\?\s*curation\.cutoff\s*:\s*1\b/.test(src),
    'AC-21: refreshPinnedTags.js must default the curation cutoff to 1 when none is set (expected `... ? curation.cutoff : 1`)');
});

test('AC-23: an explicit finite cutoff is still honored (only the unset case is normalized)', () => {
  const src = readFileSafe('src/api/trustedList/refreshPinnedTags.js');
  assert(/Number\.isFinite\(curation\.cutoff\)\s*\?\s*curation\.cutoff\s*:/.test(src),
    'AC-23: the cutoff resolution must pass an explicit finite curation.cutoff through unchanged (only the fallback becomes 1)');
});

test('AC-22: the /pins cutoff help copy says default 1, not default 2', () => {
  const pins = readFileSafe('ui/src/pages/Pins.jsx');
  assert(pins.length > 0, 'could not read ui/src/pages/Pins.jsx');
  assert(!/default\s*2/i.test(pins),
    'AC-22: ui/src/pages/Pins.jsx still tells the user the cutoff default is 2 — update it to 1');
  assert(/default\s*1/i.test(pins),
    'AC-22: ui/src/pages/Pins.jsx should state the cutoff default is 1');
});

/* ── A/B. One "Export" concept + the modal (AC-1/3/4) ── */

test('AC-1: the standalone "Refresh now" affordance is collapsed into Export', () => {
  const ui = readUiTree();
  assert(!/Refresh now/i.test(ui),
    'AC-1: a standalone "Refresh now" control still exists in the UI — Refresh must fold into the single Export action');
});

test('AC-4: the Export modal has a "What will be exported?" disclosure', () => {
  const ui = readUiTree();
  assert(/What will be exported\?/i.test(ui),
    'AC-4: the Export modal must hide the kind checkboxes behind a "What will be exported?" disclosure');
});

test('AC-3: the Export modal offers both a Follow Set and a Trusted List target', () => {
  const ui = readUiTree();
  // Gate on the disclosure too, so this fails now (the bare labels already
  // appear in comments/aria) and genuinely locks "both targets, in the modal".
  assert(/What will be exported\?/i.test(ui),
    'AC-3: the two export targets must live inside the "What will be exported?" modal disclosure');
  assert(/Follow Set/i.test(ui),
    'AC-3: the Export modal must offer a "Follow Set" (kind-30000) export target');
  assert(/Trusted List/i.test(ui),
    'AC-3: the Export modal must offer a "Trusted List" (kind-30392) export target');
});

/* ── Story 22 / ADR 0020: optional Follow Pack (kind-39089) target ── */

test('Story22 AC-1: the Export modal offers a Follow Pack (kind-39089) target', () => {
  const modal = readFileSafe('ui/src/components/ExportModal.jsx');
  assert(modal.length > 0, 'could not read ui/src/components/ExportModal.jsx');
  assert(/Follow Pack/.test(modal),
    'Story22 AC-1: the Export modal must offer a "Follow Pack" export target');
  assert(/39089/.test(modal),
    'Story22 AC-1: the Follow Pack target must name kind-39089');
});

test('Story22 AC-2: the Follow Pack target is UNCHECKED by default', () => {
  const modal = readFileSafe('ui/src/components/ExportModal.jsx');
  // The opt-in target's state must initialize to false (Follow Set /
  // Trusted List stay true — asserted by Story 21 AC-3 above).
  assert(/useState\(false\)/.test(modal) && /exportFollowPack/.test(modal),
    'Story22 AC-2: ExportModal must hold an exportFollowPack state defaulting to false');
  assert(/const \[exportFollowPack,\s*setExportFollowPack\]\s*=\s*useState\(false\)/.test(modal),
    'Story22 AC-2: exportFollowPack must default-initialize to false (opt-in)');
});

test('Story22 AC-3: the Follow Pack publishes with kind 39089 via the shared publisher', () => {
  const modal = readFileSafe('ui/src/components/ExportModal.jsx');
  assert(/kind:\s*39089/.test(modal),
    'Story22 AC-3: confirming with Follow Pack checked must call publishNip51ExportForPin with kind 39089');
});

test('Story22 AC-3 (server): prepare-nip51-export accepts and validates kind 39089', () => {
  const src = readFileSafe('src/api/trustedList/index.js');
  assert(/39089/.test(src),
    'Story22 AC-3: prepare-nip51-export must accept kind 39089 (Follow Pack)');
  assert(/exportKind\s*!==\s*30000\s*&&\s*exportKind\s*!==\s*39089/.test(src),
    'Story22 AC-3: prepare-nip51-export must reject any kind other than 30000 or 39089');
  assert(/kind:\s*exportKind/.test(src),
    'Story22 AC-3: the unsigned template kind must be the validated exportKind, not a hardcoded 30000');
});

/* ── Story 22 / ADR 0020 — read-side (the part the one-off omitted) ──
   The four tests above lock the already-landed WRITE side. The tests below
   are the read-side ADR 0020 adds and are expected to FAIL until the
   Implementer builds them: a pack-specific description, a followPackStatus
   on /pins, the panel naddr row + drift hint, and the modal memory hint.
   AC-4/AC-5 here are regression guards (write-side already correct).        */

test('Story22 AC-7: kind-39089 carries a Follow-Pack-specific description (not the kind-30000 mirror copy)', () => {
  const src = readFileSafe('src/api/trustedList/index.js');
  assert(src.length > 0, 'could not read src/api/trustedList/index.js');
  // The kind-30000 copy ("…Re-publish from your Brainstorm instance to
  // update.") is meaningless to a stranger who receives the pack. The pack
  // needs its own description, selected by kind.
  assert(/FOLLOW_PACK_DESCRIPTION|STARTER_PACK_DESCRIPTION|PACK_DESCRIPTION/.test(src),
    'Story22 AC-7: prepare-nip51-export must define a Follow-Pack-specific description constant');
  assert(/exportKind\s*===\s*39089\s*\?|39089\s*===\s*exportKind\s*\?/.test(src),
    'Story22 AC-7: the unsigned template description must branch on exportKind === 39089, not use BRAINSTORM_EXPORT_DESCRIPTION unconditionally');
});

test('Story22 AC-8: the /pins enricher derives followPackStatus and scans kind-39089', () => {
  const src = readFileSafe('src/api/profile-tags/index.js');
  assert(src.length > 0, 'could not read src/api/profile-tags/index.js');
  assert(/followPackStatus/.test(src),
    'Story22 AC-8: each /pins row must carry a followPackStatus (mirroring nip51ExportStatus)');
  // followPackStatus must be sourced from a strfry scan that includes 39089.
  assert(/kinds:\s*\[\s*30000\s*,\s*39089\s*\]|kinds:\s*\[\s*39089/.test(src),
    'Story22 AC-8: the export-status enricher must scan kind-39089 (e.g. kinds:[30000,39089]) to know whether a pack was exported');
});

test('Story22 AC-9: PinnedListPanel composes a kind-39089 naddr and renders a gated "Follow Pack (naddr)" row', () => {
  const panel = readFileSafe('ui/src/components/PinnedListPanel.jsx');
  assert(panel.length > 0, 'could not read ui/src/components/PinnedListPanel.jsx');
  assert(/kind:\s*39089/.test(panel),
    'Story22 AC-9: the detail panel must compose a kind-39089 naddr for the Follow Pack');
  assert(/Follow Pack \(naddr\)|label="Follow Pack/.test(panel),
    'Story22 AC-9: the detail panel must render a "Follow Pack (naddr)" copy row');
  assert(/followPackStatus/.test(panel),
    'Story22 AC-9: the Follow Pack row must be gated on followPackStatus (shown only once exported, like the Follow Set row)');
});

test('Story22 AC-10: a stale Follow Pack shows a "members behind / re-export to update" drift hint', () => {
  const panel = readFileSafe('ui/src/components/PinnedListPanel.jsx');
  assert(/members behind/i.test(panel),
    'Story22 AC-10: a stale Follow Pack must surface a "N members behind your current list" drift hint');
  assert(/re-export to update/i.test(panel),
    'Story22 AC-10: the drift hint must prompt "re-export to update" (the export action publishes the pack — not "re-share")');
});

test('Story22 AC-10 (snapshot guard): the auto-re-export path does NOT publish kind-39089', () => {
  const helper = readFileSafe('ui/src/utils/publishTagPin.js');
  assert(helper.length > 0, 'could not read ui/src/utils/publishTagPin.js');
  // Packs are deliberate snapshots: runReexportForPin re-publishes only the
  // kind-30000 footprint. The shared publisher accepts a `kind` (so the
  // string "39089" legitimately appears in its JSDoc), but no publish call
  // in this module may PASS kind:39089 — the only 39089 export is the
  // explicit, user-initiated modal action.
  assert(!/kind:\s*39089/.test(helper),
    'Story22 AC-10: publishTagPin.js must NOT pass kind:39089 to a publish call (auto-re-export path) — packs are snapshots (no prompt-per-retag)');
});

test('Story22 AC-11: the Export modal surfaces a "last exported as a pack" memory hint without auto-checking', () => {
  const modal = readFileSafe('ui/src/components/ExportModal.jsx');
  assert(/last exported as a pack/i.test(modal),
    'Story22 AC-11: when a pack was exported before, the modal must show a "last exported as a pack {ago}" hint');
  assert(/followPackStatus/.test(modal),
    'Story22 AC-11: the memory hint must read followPackStatus from the pin row');
  // Opt-in preserved: surfacing memory must not flip the checkbox to checked.
  assert(/const \[exportFollowPack,\s*setExportFollowPack\]\s*=\s*useState\(false\)/.test(modal),
    'Story22 AC-11: the memory hint must not auto-check Follow Pack (state stays useState(false))');
});

test('Story22 AC-4 (guard): Export is disabled only when ALL THREE targets are unchecked', () => {
  const modal = readFileSafe('ui/src/components/ExportModal.jsx');
  assert(/!exportFollowSet\s*&&\s*!exportTrustedList\s*&&\s*!exportFollowPack/.test(modal),
    'Story22 AC-4: nothingSelected must require all three targets unchecked (Follow Pack alone is a valid export)');
});

test('Story22 AC-5 (guard): the relay preview renders when either user-signed list is selected', () => {
  const modal = readFileSafe('ui/src/components/ExportModal.jsx');
  assert(/exportFollowSet\s*\|\|\s*exportFollowPack/.test(modal),
    'Story22 AC-5: the relay-preview gate must include exportFollowPack (both kind-30000 and kind-39089 publish to relays)');
});

/* ── C. Detail-view naddr rows + help lines (AC-8/9/11) ── */

test('AC-9: the kind-30000 detail row carries the "Lists and Follow Sets" help line', () => {
  const ui = readUiTree();
  assert(/Lists and Follow Sets/i.test(ui),
    'AC-9: the Follow Set (kind-30000) detail row must carry a help line about clients that support Lists and Follow Sets');
});

test('AC-8: the kind-30392 detail row carries the "curation pipelines" help line', () => {
  const ui = readUiTree();
  assert(/useful in curation pipelines/i.test(ui),
    'AC-8: the Trusted List (kind-30392) detail row must carry a help line ending "useful in curation pipelines"');
});

test('AC-11: the detail panel composes an naddr for BOTH kind-30392 and kind-30000', () => {
  const panel = readFileSafe('ui/src/components/PinnedListPanel.jsx');
  assert(panel.length > 0, 'could not read ui/src/components/PinnedListPanel.jsx');
  assert(/kind:\s*30392/.test(panel),
    'AC-11: the detail panel must compose a kind-30392 naddr copy row');
  assert(/kind:\s*30000/.test(panel),
    'AC-11: the detail panel must compose a kind-30000 naddr copy row (naddr, not a raw event id)');
});

/* ── E. Honest sync-status messaging (AC-18/19/20) ── */

test('AC-18: the in-sync status line names the current Pin', () => {
  const ui = readUiTree();
  assert(/in sync with current Pin/i.test(ui),
    'AC-18: the status line must read "last export is in sync with current Pin" when membership matches');
});

test('AC-19: the transient out-of-sync line says "Pinned list changed"', () => {
  const ui = readUiTree();
  assert(/Pinned list changed/i.test(ui),
    'AC-19: while a self-triggered re-export is in flight, the status must read "Pinned list changed, last export out of sync"');
});

test('AC-20: other-caused divergence carries the "background list refresh coming soon" caveat', () => {
  const ui = readUiTree();
  assert(/background list refresh coming soon/i.test(ui),
    'AC-20: when others\' taggings drift the list, the status must include the "(background list refresh coming soon!)" caveat');
});

/* ── D. Auto-re-export orchestrator wired into both assertion paths ── */

test('AC-13: a shared re-export orchestrator (syncPinnedExportsForTag) is defined', () => {
  const helper = readFileSafe('ui/src/utils/publishTagPin.js');
  assert(/export\s+(async\s+)?function\s+syncPinnedExportsForTag|syncPinnedExportsForTag\s*=/.test(helper),
    'AC-12/13: ui/src/utils/publishTagPin.js must define and export syncPinnedExportsForTag(...) — the shared recompute-30392 + re-export-30000 orchestrator');
});

test('AC-13: the tag-page assertion path invokes the orchestrator', () => {
  const tagPage = readFileSafe('ui/src/pages/Tag.jsx');
  assert(/syncPinnedExportsForTag/.test(tagPage),
    'AC-12/13: Tag.jsx handleApply/handleDispute must call syncPinnedExportsForTag after a successful assertion');
});

test('AC-13: the profile-page assertion path invokes the orchestrator', () => {
  const hook = readFileSafe('ui/src/hooks/useProfileTags.js');
  assert(/syncPinnedExportsForTag/.test(hook),
    'AC-12/13: useProfileTags applyTag/disputeTag must call syncPinnedExportsForTag after a successful assertion');
});

test('AC-15/16: the orchestrator gates the kind-30000 re-export on the export footprint', () => {
  const helper = readFileSafe('ui/src/utils/publishTagPin.js');
  assert(/never-exported/.test(helper),
    'AC-15/16: the orchestrator must skip the kind-30000 re-export (no NIP-07 prompt) when the pin has no export footprint (nip51ExportStatus.status === "never-exported")');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- collapse-into-export-concept tests (Story 21) ---');
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
  console.log(`\ncollapse-into-export-concept: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
