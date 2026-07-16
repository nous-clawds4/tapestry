/**
 * Story 12 item #3 (book: unified-tagging-ui) — Pinned-tab note bookmark-set
 * display + drift. Source-contract (UI render is manual). ADR 0015 / issue #336.
 */
const fs = require('fs');
const path = require('path');
const UI = (p) => path.resolve(__dirname, '..', 'ui/src', p);
const HOOK = UI('hooks/usePinnedNotes.js');
const PANEL = UI('components/PinnedListPanel.jsx');
function assert(c, m) { if (!c) throw new Error(m || 'fail'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function ex(p) { return fs.existsSync(p); }
const tests = [];
const t = (n, f) => tests.push([n, f]);

t('U: usePinnedNotes reads the viewer\'s kind-30003 snapshot + computes drift', () => {
  assert(ex(HOOK), 'ui/src/hooks/usePinnedNotes.js must exist');
  const s = rd(HOOK);
  assert(/computeNoteBookmarkDTag/.test(s), 'must address the note bookmark set by its notes-pin d-tag');
  assert(/30003/.test(s), 'must scan the kind-30003 bookmark set');
  assert(/curateNotes/.test(s), 'must curate the live set to compute drift');
  assert(/added|removed|drift/.test(s), 'must expose the added/removed drift vs the snapshot');
});

t('U: PinnedListPanel renders a "Pinned notes" section with drift + update + NoteCard', () => {
  const s = rd(PANEL);
  assert(/usePinnedNotes/.test(s), 'panel must consume usePinnedNotes');
  assert(/Pinned notes/.test(s), 'panel must render a "Pinned notes" section');
  assert(/NoteCard/.test(s), 'panel must render the pinned notes via NoteCard');
  assert(/publishNoteBookmarkSetForPin/.test(s), 'the Update affordance must re-publish the bookmark set');
  assert(/Up to date|since you pinned/.test(s), 'must show a drift indicator (up-to-date / N since you pinned)');
});

async function run() {
  console.log('\n--- pinned-notes display tests (book: unified-tagging-ui, Story 12 #3) ---');
  let pass = 0, fail = 0; const failures = [];
  for (const [name, fn] of tests) { try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failures.push({ name, message: e.message }); fail++; } }
  console.log(`\npinned-notes-display: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) { run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); }); }
module.exports = { run };
