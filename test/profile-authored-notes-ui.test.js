/**
 * Story 14 (book: unified-tagging-ui) — profile "Tagging Activity" spans notes.
 * Source-contract only (UI render is manual). ADR 0010 endpoint (Story 11).
 *
 * REWORK (operator, 2026-07-01): note-taggings are folded INTO the existing
 * `AuthoredTaggingSection` toggle, intermixed with profile-taggings — the separate
 * `AuthoredNotesSection` is retired. These tests assert that intermixed contract.
 */
const fs = require('fs');
const path = require('path');
const UI = (p) => path.resolve(__dirname, '..', 'ui/src', p);
const HOOK = UI('hooks/useNotesByAuthor.js');
const SECTION = UI('components/AuthoredTaggingSection.jsx');
const RETIRED = UI('components/AuthoredNotesSection.jsx');
const PROFILE = UI('pages/BrainstormProfile.jsx');
function assert(c, m) { if (!c) throw new Error(m || 'fail'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function ex(p) { return fs.existsSync(p); }
const tests = [];
const t = (n, f) => tests.push([n, f]);

t('U: useNotesByAuthor hook reads /api/event-tags/notes-by-author', () => {
  assert(ex(HOOK), 'ui/src/hooks/useNotesByAuthor.js must exist');
  const s = rd(HOOK);
  assert(/event-tags\/notes-by-author/.test(s), 'must fetch /api/event-tags/notes-by-author');
  assert(/authorPubkey/.test(s), 'must key on authorPubkey');
});
t('U: AuthoredTaggingSection folds tagged notes in via useNotesByAuthor + NoteCard', () => {
  assert(ex(SECTION), 'ui/src/components/AuthoredTaggingSection.jsx must exist');
  const s = rd(SECTION);
  assert(/useNotesByAuthor/.test(s), 'must fetch the person\'s note-taggings (useNotesByAuthor)');
  assert(/NoteCard/.test(s), 'must render note-taggings via the shared NoteCard');
  assert(/taggedWith/.test(s), 'must surface the tag(s) the person applied (taggedWith)');
});
t('U: the separate AuthoredNotesSection is retired (folded into Tagging Activity)', () => {
  assert(!ex(RETIRED), 'ui/src/components/AuthoredNotesSection.jsx must be deleted');
  const s = rd(PROFILE);
  assert(/AuthoredTaggingSection/.test(s), 'BrainstormProfile must render <AuthoredTaggingSection>');
  assert(
    !/import\s+AuthoredNotesSection|<AuthoredNotesSection\b/.test(s),
    'BrainstormProfile must not import or render the retired <AuthoredNotesSection>',
  );
});
t('R: AuthoredTaggingSection (profiles side) still exists', () => {
  assert(ex(SECTION), 'the intermixed Tagging Activity section must remain');
});

async function run() {
  console.log('\n--- profile authored-notes UI tests (book: unified-tagging-ui, Story 14) ---');
  let pass = 0, fail = 0; const failures = [];
  for (const [name, fn] of tests) { try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failures.push({ name, message: e.message }); fail++; } }
  console.log(`\nprofile-authored-notes-ui: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) { run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); }); }
module.exports = { run };
