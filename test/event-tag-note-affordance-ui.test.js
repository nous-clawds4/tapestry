/**
 * Tests for Story 6 (epic: event-tagging) — the tag affordance on note surfaces.
 *
 * Story: engineering-team/stories/event-tagging/6-event-tag-affordance-on-note-surfaces.md
 * ADR:   engineering-team/decisions/event-tagging/0006-event-tag-affordance-on-note-surfaces.md
 *
 * TEST LEVEL — source assertion, not runtime render (matching note-surfaces-ui /
 * live-feed-feed-page / the profile-* UI suites): the Node harness has no JSX
 * transpile and react-dom lives only in the ui/ Vite workspace, so we assert on the
 * ui/src/*.jsx SOURCE TEXT. The new hook/component and the NoteCard/NoteActionsMenu
 * edits do not exist pre-implementation, so the U tests FAIL now and PASS once built;
 * the R tests are regression sentinels (additive change → PASS before AND after).
 *
 * Runtime behaviors source can't prove — a click on Apply publishing a kind-39999
 * nostr-event-tag assertion, the chip reflecting `mine` durably across reload,
 * logged-out read-only, local-only with the guard on — are in the test plan's
 * MANUAL browser checklist (run on the local dev stack, per the operator's flow and
 * ADR §Testability), not here.
 *
 * Design latitude: ADR 0006 leaves exact placement/markup density to the Implementer
 * (story Open Qs). These sentinels assert the load-bearing WIRING (which hook, which
 * reused components, which write calls, the data contract), not pixels or class names.
 */

const fs = require('fs');
const path = require('path');

const UI = (p) => path.resolve(__dirname, '..', 'ui/src', p);
const USE_EVENT_TAGS   = UI('hooks/useEventTags.js');
const USE_EVENT_TAGGING = UI('hooks/useEventTagging.js'); // Story 5 (must already exist)
const NOTE_TAGS        = UI('components/NoteTags.jsx');
const NOTE_CARD        = UI('components/NoteCard.jsx');
const NOTE_ACTIONS     = UI('components/NoteActionsMenu.jsx');
const TAG_CHIP         = UI('components/TagChip.jsx');
const ADD_TAG_DIALOG   = UI('components/AddTagDialog.jsx');
// The four kind-1 note surfaces that render through the shared NoteCard.
const SURFACES = [
  UI('pages/BrainstormFeed.jsx'),
  UI('pages/BrainstormUserNotes.jsx'),
  UI('pages/BrainstormEvent.jsx'),
  UI('components/ProfileContentSection.jsx'),
];

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function exists(p) { return fs.existsSync(p); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─────────────────────────── READ HOOK: useEventTags ───────────────────────────

t('U: useEventTags hook exists and reads a note\'s tags from the Story-4 for-event endpoint', () => {
  assert(exists(USE_EVENT_TAGS), 'ui/src/hooks/useEventTags.js must exist (the note-tags read hook)');
  const src = safeRead(USE_EVENT_TAGS);
  assert(/event-tags\/for-event/.test(src), 'useEventTags must fetch /api/event-tags/for-event (Story-4 read)');
  assert(/eventId/.test(src), 'useEventTags must key the read on the note\'s eventId');
});

t('U: useEventTags identifies the viewer (viewerPubkey) and consumes the Story-7 `mine` channel', () => {
  const src = safeRead(USE_EVENT_TAGS);
  assert(/viewerPubkey/.test(src), 'useEventTags must pass viewerPubkey to for-event (so the viewer\'s own stance returns)');
  assert(/\bmine\b/.test(src), 'useEventTags must consume the `mine` channel (the durable viewer stance from Story 7)');
});

t('U: useEventTags joins display names from the shared available-tags endpoint', () => {
  const src = safeRead(USE_EVENT_TAGS);
  assert(/profile-tags\/available-tags/.test(src),
    'useEventTags must enrich counted tags with name/eventId from /api/profile-tags/available-tags (for-event returns only {authorPubkey,slug})');
});

t('U: useEventTags does NOT reach an external publish path (read-only hook; local-only invariant)', () => {
  assert(exists(USE_EVENT_TAGS), 'ui/src/hooks/useEventTags.js must exist');
  const src = safeRead(USE_EVENT_TAGS);
  assert(!/publishEverywhere|PUBLISH_RELAYS|nostrPublish/.test(src), 'a read hook must not import any publish path');
});

// ─────────────────────────── COMPONENT: NoteTags ───────────────────────────

t('U: NoteTags component exists and is the single owner of the note tag affordance', () => {
  assert(exists(NOTE_TAGS), 'ui/src/components/NoteTags.jsx must exist');
  const src = safeRead(NOTE_TAGS);
  assert(/useEventTags/.test(src), 'NoteTags must read via useEventTags');
});

t('U: NoteTags writes through the Story-5 useEventTagging hook (guarded/local-only), not a new publish path', () => {
  const src = safeRead(NOTE_TAGS);
  assert(/useEventTagging/.test(src), 'NoteTags must call the Story-5 write hook useEventTagging (applyTag/disputeTag)');
  assert(/applyTag|disputeTag/.test(src), 'NoteTags must invoke applyTag/disputeTag');
  assert(!/publishEverywhere|PUBLISH_RELAYS/.test(src),
    'NoteTags must NOT reach an external publish path directly — writes go through the guarded useEventTagging');
  assert(exists(USE_EVENT_TAGGING), 'the Story-5 hook ui/src/hooks/useEventTagging.js must exist (dependency)');
});

t('U: NoteTags reuses the existing TagChip and AddTagDialog (no forked note-specific components)', () => {
  const src = safeRead(NOTE_TAGS);
  assert(/TagChip/.test(src), 'NoteTags must reuse TagChip for the counted-tag chips');
  assert(/AddTagDialog/.test(src), 'NoteTags must reuse AddTagDialog for add-existing + create-new');
  // and the reused components must still exist
  assert(exists(TAG_CHIP) && exists(ADD_TAG_DIALOG), 'TagChip and AddTagDialog must exist (reused as-is)');
});

t('U: NoteTags maps add-existing → applyTag({authorPubkey,slug}) and create-new → applyTag({name,description})', () => {
  const src = safeRead(NOTE_TAGS);
  assert(/authorPubkey/.test(src) && /slug/.test(src),
    'NoteTags must apply an existing tag by its (authorPubkey, slug) coordinate (the event-tag identity)');
  assert(/onSelectExisting/.test(src) && /onCreateNew/.test(src),
    'NoteTags must wire AddTagDialog\'s onSelectExisting (existing) and onCreateNew (brand-new) handlers');
  assert(/\bname\b/.test(src) && /description/.test(src),
    'create-new must pass {name, description} to the write hook');
});

t('U: NoteTags sources the viewer from useAuth and is READ-ONLY when logged out', () => {
  const src = safeRead(NOTE_TAGS);
  assert(/useAuth/.test(src), 'NoteTags must source the viewer identity from useAuth (user.pubkey), not a prop on NoteCard');
  assert(/disabled|!\s*(user|viewer)|user\s*\?|viewer\s*\?|!viewerPubkey/.test(src),
    'NoteTags must disable the write controls when there is no logged-in viewer (read-only; nothing publishes)');
});

t('U: NoteTags consumes `mine` so the viewer\'s own stance is shown durably (the Story-7 payoff)', () => {
  const src = safeRead(NOTE_TAGS);
  assert(/\bmine\b/.test(src),
    'NoteTags must read the viewer\'s own stance from `mine` (so a just-applied tag survives reload even when the POV doesn\'t count it)');
});

t('U: NoteTags surfaces partial failure (failedAt) / errors for retry', () => {
  const src = safeRead(NOTE_TAGS);
  assert(/failedAt|error|catch/.test(src),
    'NoteTags must surface a partial/failed publish (the write hook returns failedAt) so the viewer can retry');
});

// ─────────────────────────── INTEGRATION: NoteCard + NoteActionsMenu ───────────────────────────

t('U: NoteCard renders <NoteTags> so EVERY note surface gets the affordance at once', () => {
  const src = safeRead(NOTE_CARD);
  assert(/import\s+NoteTags|from\s+['"][.\/]*NoteTags/.test(src), 'NoteCard must import NoteTags');
  assert(/<NoteTags\b/.test(src), 'NoteCard must render <NoteTags item={…}/> (the single integration point)');
});

t('U: the NoteActionsMenu "Tag Event" stub is retired (its job moved into NoteTags)', () => {
  const src = safeRead(NOTE_ACTIONS);
  assert(!/not yet supported/i.test(src) && !/Tag Event/.test(src),
    'the "Tag Event … not yet supported" stub must be removed from NoteActionsMenu (no competing entry point)');
});

// ─────────────────────────── REGRESSION SENTINELS (additive change) ───────────────────────────

t('R: NoteCard still renders the note body (NoteContent) and the actions menu', () => {
  const src = safeRead(NOTE_CARD);
  assert(/<NoteContent\b/.test(src), 'NoteCard must still render the note content');
  assert(/<NoteActionsMenu\b/.test(src), 'NoteCard must still render the per-note actions menu');
});

t('R: all four kind-1 note surfaces still render through the shared NoteCard', () => {
  for (const p of SURFACES) {
    const src = safeRead(p);
    assert(src.length > 0, `${path.basename(p)} must exist`);
    assert(/<NoteCard\b/.test(src), `${path.basename(p)} must still render <NoteCard> (so it inherits the tag affordance)`);
  }
});

async function run() {
  console.log('\n--- event-tag note-affordance UI tests (epic event-tagging, Story 6) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nevent-tag-note-affordance-ui: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
