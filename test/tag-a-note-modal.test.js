/**
 * Story 16 (book: unified-tagging-ui) — "+ Tag a Note" Event-ID modal on the Notes tab.
 * Source-contract only (UI render is manual). ADR 0014.
 */
const fs = require('fs');
const path = require('path');
const UI = (p) => path.resolve(__dirname, '..', 'ui/src', p);
const MODAL = UI('components/TagANoteModal.jsx');
const NOTES_VIEW = UI('components/TagNotesView.jsx');
const CONTROLS = UI('components/TagViewControls.jsx');
const HOOK = UI('hooks/useNotesForTag.js');
const EVENTPARAM = UI('utils/eventParam.js');
const SIGNERGUARD = UI('utils/signerGuard.js');
const EVENTTAGGING = UI('hooks/useEventTagging.js');
function assert(c, m) { if (!c) throw new Error(m || 'fail'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function ex(p) { return fs.existsSync(p); }
const tests = [];
const t = (n, f) => tests.push([n, f]);

t('U: eventParam supports note1 (classifier prefix + decode case + precedence)', () => {
  const s = rd(EVENTPARAM);
  assert(/note1/.test(s), 'classifyEventInput must recognize the note1 prefix');
  assert(/case 'note'/.test(s), "decodeOne must handle the 'note' param (note1 → kind-1 id)");
  assert(/'nevent', 'note'|'note', 'id'|'note',/.test(s), "'note' must be added to the precedence ORDER");
});

t('U: TagANoteModal exists and reuses the /event resolver + write hook + NoteCard', () => {
  assert(ex(MODAL), 'ui/src/components/TagANoteModal.jsx must exist');
  const s = rd(MODAL);
  assert(/useEventResolve/.test(s), 'must resolve the note via useEventResolve');
  assert(/classifyEventInput|resolveEventParams/.test(s), 'must parse the pasted identifier via eventParam');
  assert(/useEventTagging/.test(s), 'must publish via the Story-5 useEventTagging');
  assert(/applyTag|disputeTag/.test(s), 'must offer Apply/Dispute for the current tag');
  assert(/NoteCard/.test(s), 'must render the resolved note via the shared NoteCard');
});

t('U: TagANoteModal rejects non-note identifiers (profile / naddr) with a message', () => {
  const s = rd(MODAL);
  assert(/mode === 'author'/.test(s), 'must detect a profile (author-mode) identifier and reject it');
  assert(/naddr/.test(s), 'must detect/reject naddr (addressable, not a kind-1 note)');
});

t('U: TagNotesView shows "+ Tag a Note" and hosts the modal with a refetch-on-tagged', () => {
  const s = rd(NOTES_VIEW);
  assert(/TagANoteModal/.test(s), 'must render <TagANoteModal>');
  assert(/Tag a Note/.test(s), 'must label the primary button "Tag a Note"');
  assert(/onPrimaryClick/.test(s), 'must wire the primary button via onPrimaryClick');
  assert(/onTagged=\{refetch\}|onTagged=\{\s*refetch/.test(s), 'must refetch the notes list on a successful tag');
});

t('U: TagViewControls primary button is configurable (Story 16), Profiles default intact', () => {
  const s = rd(CONTROLS);
  assert(/onPrimaryClick/.test(s), 'must accept an onPrimaryClick handler');
  assert(/primaryLabel/.test(s), 'must accept a primaryLabel');
  assert(/Tag someone/.test(s), 'must keep the Profiles "Tag someone" default');
});

t('U: useNotesForTag exposes refetch', () => {
  const s = rd(HOOK);
  assert(/refetch/.test(s), 'useNotesForTag must expose a refetch()');
});

t('U: modal gives honest post-tag feedback (re-key NoteCard + read-back count)', () => {
  const s = rd(MODAL);
  assert(/refreshNonce/.test(s), 'must re-key the NoteCard after tagging so its chips refetch');
  assert(/for-event/.test(s), 'must read back the resulting count via for-event');
  assert(/resultCount/.test(s), 'must reflect the resulting applied/disputed count in the confirmation');
});

t('R: signer guard exists and is enforced in the event-tagging write path', () => {
  assert(ex(SIGNERGUARD), 'ui/src/utils/signerGuard.js must exist');
  const g = rd(SIGNERGUARD);
  assert(/assertSignerMatches/.test(g), 'must export assertSignerMatches');
  const h = rd(EVENTTAGGING);
  assert(/assertSignerMatches/.test(h), 'useEventTagging must call assertSignerMatches');
  assert(/useAuth/.test(h), 'useEventTagging must read the session identity (useAuth) to compare against the active signer');
});

async function run() {
  console.log('\n--- tag-a-note modal tests (book: unified-tagging-ui, Story 16) ---');
  let pass = 0, fail = 0; const failures = [];
  for (const [name, fn] of tests) { try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failures.push({ name, message: e.message }); fail++; } }
  console.log(`\ntag-a-note-modal: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) { run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); }); }
module.exports = { run };
