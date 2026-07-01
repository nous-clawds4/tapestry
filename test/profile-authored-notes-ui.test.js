/**
 * Story 14 (book: unified-tagging-ui) — profile shows the notes a person tagged.
 * Source-contract only (UI render is manual). ADR 0010 endpoint (Story 11).
 */
const fs = require('fs');
const path = require('path');
const UI = (p) => path.resolve(__dirname, '..', 'ui/src', p);
const HOOK = UI('hooks/useNotesByAuthor.js');
const SECTION = UI('components/AuthoredNotesSection.jsx');
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
t('U: AuthoredNotesSection renders the tagged notes via the shared NoteCard', () => {
  assert(ex(SECTION), 'ui/src/components/AuthoredNotesSection.jsx must exist');
  const s = rd(SECTION);
  assert(/useNotesByAuthor/.test(s), 'must use useNotesByAuthor');
  assert(/NoteCard/.test(s), 'must render NoteCard for each tagged note');
  assert(/taggedWith/.test(s), 'must surface the tag(s) the person applied (taggedWith)');
});
t('U: the profile page renders AuthoredNotesSection (alongside the profiles section)', () => {
  const s = rd(PROFILE);
  assert(/AuthoredNotesSection/.test(s), 'BrainstormProfile must render <AuthoredNotesSection>');
  assert(/AuthoredTaggingSection/.test(s), 'and keep the existing AuthoredTaggingSection (unchanged)');
});
t('R: AuthoredTaggingSection (profiles side) still exists and is untouched by this story', () => {
  assert(ex(UI('components/AuthoredTaggingSection.jsx')), 'profiles-side section must remain');
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
