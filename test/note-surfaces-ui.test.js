/**
 * Stories note-surfaces #2 (profile "Content" section) + #3 (per-user /notes page).
 * ADR note-surfaces/0002. See the two .test-plan.md files alongside the stories.
 *
 * ADR 0002 chose Option A: one shared hook ui/src/hooks/useUserNotes.js (mirroring
 * useFeed.js, parameterized by pubkey+limit); a ui/src/components/ProfileContentSection.jsx
 * appended as the LAST section of ui/src/pages/BrainstormProfile.jsx (limit 1); and a new
 * ui/src/pages/BrainstormUserNotes.jsx page at the client route /user/:pubkey/notes (limit 50),
 * modeled on BrainstormFollows.jsx. Both delegate their body to a PURE, named-exported render
 * helper with module-level copy constants. NoteCard is REUSED AS-IS — no variant prop.
 *
 * TEST LEVEL — source assertion, not runtime render (matching live-feed-feed-page.test.js and
 * the profile-* suites): the Node harness has no JSX transpile and react-dom is only in the ui/
 * Vite workspace, so we assert on the ui/src/*.jsx SOURCE TEXT. The page/section/hook/route do
 * not exist pre-implementation, so the U tests FAIL now and PASS once built. R tests are
 * regression sentinels (additive change) — PASS before AND after.
 *
 * The runtime properties source can't prove — an anonymous /user/<pubkey>/notes 200 with a
 * rendered card, the profile's Content section in a browser, no 1280px horizontal scrollbar —
 * are gathered on STAGING after deploy (ADR §Testability), not here.
 *
 * COPY NOTE: the empty-state copy is operator-delegated and punctuation is non-binding; the copy
 * sentinels assert the load-bearing MEANING tokens ("kind-1", "could be located"), anchored on
 * the exported copy constants, not a byte-for-byte sentence.
 */

const fs = require('fs');
const path = require('path');

const HOOK = path.resolve(__dirname, '../ui/src/hooks/useUserNotes.js');
const CONTENT = path.resolve(__dirname, '../ui/src/components/ProfileContentSection.jsx');
const NOTES_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormUserNotes.jsx');
const APP = path.resolve(__dirname, '../ui/src/App.jsx');
const PROFILE = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const STYLES = path.resolve(__dirname, '../ui/src/styles.css');
const NOTE_CARD = path.resolve(__dirname, '../ui/src/components/NoteCard.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// Slice a named body-helper function out of a page/component so branch sentinels match logic
// INSIDE the pure helper, not anywhere on the page. Returns the whole source if not found (so a
// missing helper fails the export sentinel + the branch sentinels rather than passing silently).
function helperBody(src, names) {
  const m = src.match(new RegExp('function\\s+(' + names.join('|') + ')\\s*\\('));
  return m ? src.slice(m.index) : src;
}

// ===========================================================================
// Shared hook — useUserNotes(pubkey, limit): fetches the read path, passes the
// result through, gates on success, aborts on unmount (supports #2 + #3).
// ===========================================================================

test('U1: useUserNotes(pubkey, limit) fetches /api/user/<pubkey>/notes?limit=<limit> and returns { data, loading, error }', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'ui/src/hooks/useUserNotes.js does not exist yet — the Implementer must create the shared notes hook (ADR 0002 §Impl, mirroring useFeed.js).');
  assert(/useUserNotes\s*\(\s*pubkey\s*,\s*limit\s*\)/.test(src) || /function\s+useUserNotes\s*\(/.test(src),
    'useUserNotes must take (pubkey, limit) so both surfaces share it (the Content section passes 1, the page passes 50).');
  assert(/fetch\(\s*[`'"]\/api\/user\/\$\{?pubkey\}?\/notes\?limit=\$\{?limit\}?[`'"]/.test(src) || (/fetch\(/.test(src) && /\/api\/user\//.test(src) && /\/notes/.test(src) && /limit=/.test(src)),
    "useUserNotes must call fetch(`/api/user/${pubkey}/notes?limit=${limit}`) — the ADR 0001 endpoint.");
  assert(/return\s*\{[\s\S]{0,120}data[\s\S]{0,120}loading[\s\S]{0,120}error[\s\S]{0,40}\}/.test(src),
    'useUserNotes must return { data, loading, error } (the established hook shape, mirroring useFeed.js).');
});

test('U2: useUserNotes gates on the response `success` flag, sets `error` on failure, and aborts on unmount', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'useUserNotes.js does not exist yet.');
  assert(/success/.test(src), 'useUserNotes must gate on the body\'s `success` flag (ADR 0001 returns { success:true, ...result }).');
  assert(/setError|error/.test(src), 'useUserNotes must set `error` on a non-success / transport failure (drives the surfaces\' empty/defensive branch).');
  assert(/AbortController/.test(src) && /\.abort\(\)/.test(src), 'useUserNotes must abort the fetch on unmount via AbortController (the useFeed.js / useGrapevineFollows.js convention).');
  assert(/\[\s*pubkey\s*,\s*limit\s*\]/.test(src) || /\[pubkey, ?limit\]/.test(src),
    'useUserNotes must re-run when pubkey or limit changes (effect deps [pubkey, limit]).');
});

// ===========================================================================
// Story #2 — the profile "Content" section
// ===========================================================================

test('U3 (#2 AC label): ProfileContentSection exists, consumes the content read path, and is labelled "Content"', () => {
  const src = safeRead(CONTENT);
  assert(src.length > 0, 'ui/src/components/ProfileContentSection.jsx does not exist yet — the Implementer must create the Content section (ADR 0002 §Impl).');
  assert(/export\s+default\s+function\s+ProfileContentSection\s*\(\s*\{\s*pubkey/.test(src) || (/ProfileContentSection/.test(src) && /pubkey/.test(src)),
    'ProfileContentSection({ pubkey }) must be the default export.');
  // feed-usability/0003 replaced useUserNotes(pubkey, 1) with the dedicated one-shot
  // useProfileContent(pubkey) (pinned-note-aware selection lives server-side).
  assert(/useProfileContent\s*\(\s*pubkey\s*\)/.test(src),
    'the Content section must consume the pinned-note-aware content read path via useProfileContent(pubkey) (ADR feed-usability/0003).');
  assert(/CONTENT_COPY/.test(src) && /HEADING\s*:\s*['"]Content['"]/.test(src),
    'the section must be labelled exactly "Content" via an exported CONTENT_COPY.HEADING (the operator-chosen label; kind-1 only for now, future-proofed name).');
});

test('U4 (#2 AC latest note): the OK branch renders exactly ONE NoteCard for the single latest note (items[0]), not a list', () => {
  const src = safeRead(CONTENT);
  assert(src.length > 0, 'ProfileContentSection.jsx does not exist yet.');
  assert(/import\s+NoteCard/.test(src) && /<NoteCard\b[^>]*\bitem=\{/.test(src),
    'the Content section must render the shared <NoteCard item={...} /> (reuse the card, no inline markup, no fork).');
  const body = helperBody(src, ['renderContentBody']);
  // feed-usability/0003: the read path returns a single `item` (pinned or latest top-level),
  // so the OK branch renders that one item — still exactly one note, still not a .map list.
  assert(/\bdata\.item\b/.test(body) || /items\s*\[\s*0\s*\]/.test(body) || /items\?\.\[0\]/.test(body),
    'the OK branch must render the SINGLE selected note (data.item) — one note, not a .map list (#2/#3 AC: no more than one note).');
  assert(!/\bitems\b[\s\S]{0,16}\.map\s*\(/.test(body),
    'the Content section must NOT map a list of notes — it shows only the single selected one (#2/#3 AC).');
});

test('U5 (#2 AC empty state): the empty/defensive branch shows a "no kind-1 events could be located" message, no card', () => {
  const src = safeRead(CONTENT);
  assert(src.length > 0, 'ProfileContentSection.jsx does not exist yet.');
  assert(/CONTENT_COPY[\s\S]{0,120}EMPTY\s*:\s*['"][^'"]*['"]/.test(src),
    'CONTENT_COPY must define an EMPTY message constant.');
  assert(/EMPTY\s*:\s*['"][^'"]*kind[\s-]?1[^'"]*['"]/i.test(src),
    'the empty-state copy must name kind-1 (the operator\'s "no kind 1 events could be located" framing).');
  assert(/EMPTY\s*:\s*['"][^'"]*(could (?:not |n't )?be located|locate|no .*(?:events|notes))[^'"]*['"]/i.test(src),
    'the empty-state copy must convey that no kind-1 events could be located (operator-delegated meaning; punctuation non-binding).');
});

test('U6 (#2 AC link): the section links to /user/<pubkey>/notes in all states (populated or empty)', () => {
  const src = safeRead(CONTENT);
  assert(src.length > 0, 'ProfileContentSection.jsx does not exist yet.');
  assert(/to=\{\s*[`'"]\/user\/\$\{pubkey\}\/notes[`'"]\s*\}/.test(src) || (/<Link\b/.test(src) && /\/user\/\$\{pubkey\}\/notes/.test(src)),
    'the Content section must include a <Link to={`/user/${pubkey}/notes`}> to the full notes page (#2 AC: link present populated OR empty).');
});

test('U7 (#2 testability): renderContentBody is a named-exported PURE function (no fetch/hook/router/browser globals)', () => {
  const src = safeRead(CONTENT);
  assert(src.length > 0, 'ProfileContentSection.jsx does not exist yet.');
  assert(/export\s+(function\s+renderContentBody|const\s+renderContentBody\s*=)/.test(src),
    'ProfileContentSection.jsx must NAMED-export a pure body helper renderContentBody({ data, loading, error }) so its states are an isolated, sentinel-testable unit.');
  const body = helperBody(src, ['renderContentBody']);
  for (const banned of ['fetch(', 'useUserNotes(', 'useAuth(', 'useParams(', 'window.', 'document.']) {
    assert(!body.includes(banned), `the pure renderContentBody must not call ${banned} — it is a pure function of { data, loading, error } (data fetching lives in the component wrapper).`);
  }
});

test('U8 (#2 AC placement): BrainstormProfile renders <ProfileContentSection> as the LAST section, AFTER the Reputation section', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'ui/src/pages/BrainstormProfile.jsx missing — unexpected.');
  assert(/import\s+ProfileContentSection\s+from\s+['"]\.\.\/components\/ProfileContentSection['"]/.test(src),
    'BrainstormProfile.jsx must import ProfileContentSection.');
  assert(/<ProfileContentSection\b[^>]*\bpubkey=\{pubkey\}/.test(src),
    'BrainstormProfile.jsx must render <ProfileContentSection pubkey={pubkey} />.');
  const repIdx = src.search(/<h3>\s*Reputation/);
  const contentIdx = src.search(/<ProfileContentSection\b/);
  assert(repIdx !== -1 && contentIdx !== -1 && contentIdx > repIdx,
    'the Content section must appear AFTER the Reputation section (it is the last section of the profile — #2 AC).');
});

// ===========================================================================
// Story #3 — the per-user /notes page
// ===========================================================================

test('U9 (#3 AC route): App.jsx registers /user/:pubkey/notes → BrainstormUserNotes, among the pubkey-scoped routes', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/path:\s*['"]\/user\/:pubkey\/notes['"]/.test(src),
    "App.jsx must declare the route path '/user/:pubkey/notes'. Absent pre-implementation.");
  assert(/BrainstormUserNotes/.test(src) && /import\s+BrainstormUserNotes/.test(src),
    'App.jsx must import and map /user/:pubkey/notes to the BrainstormUserNotes page.');
  // It belongs in the top-level group (with the other /user/:pubkey/* routes), before the /tapestry admin block — so it is public.
  const notesIdx = src.search(/path:\s*['"]\/user\/:pubkey\/notes['"]/);
  const tapestryIdx = src.search(/path:\s*['"]\/tapestry['"]/);
  assert(notesIdx !== -1 && tapestryIdx !== -1 && notesIdx < tapestryIdx,
    'the /user/:pubkey/notes route must be a public top-level route (before the /tapestry admin group), like /user/:pubkey/follows — so anonymous clients reach it (#3 AC reachability).');
});

test('U10 (#3 AC list + reuse): BrainstormUserNotes uses useUserNotes(pubkey, 50), reuses the public shell, and renders notes via NoteCard', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'ui/src/pages/BrainstormUserNotes.jsx does not exist yet — the Implementer must create the notes page (ADR 0002 §Impl, modeled on BrainstormFollows.jsx).');
  assert(/useUserNotes\s*\(\s*pubkey\s*,\s*50\s*\)/.test(src),
    'the page must consume the read path at limit 50: useUserNotes(pubkey, 50).');
  assert(/bsp-page/.test(src) && /bsp-top-bar/.test(src) && /bsp-content/.test(src) && /BrainstormUserMenu/.test(src),
    'the page must reuse the public shell (bsp-page → bsp-top-bar → bsp-content + <BrainstormUserMenu>), modeled on BrainstormFollows.jsx.');
  assert(/import\s+NoteCard/.test(src) && /<NoteCard\b[^>]*\bitem=\{/.test(src),
    'the page must render each note via the shared <NoteCard item={...} /> (reuse the card).');
});

test('U11 (#3 AC order): the OK branch maps items in ARRAY ORDER (newest-first from the read path) and does NOT re-sort', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx does not exist yet.');
  const body = helperBody(src, ['renderUserNotesState']);
  assert(/status\s*===?\s*['"]OK['"]/.test(body), "the body helper must branch on status === 'OK' (the populated list).");
  // feed-usability/0002 virtualized the notes list: one entry per note via items.map(...) OR
  // react-virtuoso's itemContent (windowed) — both satisfy "one entry per note".
  assert(/\bitems\b[\s\S]{0,40}\.map\s*\(/.test(body) || /\.map\s*\(\s*\(?\s*(it|item|n)\b/.test(body) || /itemContent=\{/.test(body),
    'the OK branch must render one entry per note — via items.map(...) or a virtualized <Virtuoso itemContent> (#3 AC / ADR feed-usability/0002).');
  assert(!/\bitems\b[\s\S]{0,8}\.sort\s*\(/.test(body) && !/\.sort\s*\([\s\S]{0,40}createdAt/.test(src),
    'the page must render items in the array order the read path delivered (already newest-first); it must NOT re-sort (re-derivation; ADR §No re-derivation).');
});

test('U12 (#3 AC whose-notes): the page identifies WHOSE notes — it fetches the subject profile name and shows it', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx does not exist yet.');
  assert(/\/api\/profiles\?pubkeys=/.test(src),
    'the page must fetch the subject\'s display name (/api/profiles?pubkeys=<pubkey>, the BrainstormProfile convention) so it identifies whose notes are shown — even when empty (#3 AC: whose notes).');
  assert(/display_name|displayName/.test(src),
    'the page must show the subject display name in its header (#3 AC: identifies the viewed user).');
});

test('U13 (#3 AC empty state): the empty/defensive branch shows a "no kind-1 events could be located" message and no entries', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx does not exist yet.');
  assert(/NOTES_COPY/.test(src), 'BrainstormUserNotes.jsx must define the exported NOTES_COPY copy constants.');
  assert(/EMPTY\s*:\s*['"][^'"]*kind[\s-]?1[^'"]*['"]/i.test(src),
    'NOTES_COPY.EMPTY must name kind-1 (the operator\'s "no kind 1 events could be located" framing).');
  assert(/EMPTY\s*:\s*['"][^'"]*(could (?:not |n't )?be located|locate|no .*(?:events|notes))[^'"]*['"]/i.test(src),
    'NOTES_COPY.EMPTY must convey that no kind-1 events could be located (operator-delegated meaning).');
  const body = helperBody(src, ['renderUserNotesState']);
  assert(/status\s*===?\s*['"]EMPTY['"]/.test(body) || /EMPTY/.test(body),
    'the body helper must branch on the EMPTY outcome and render the empty copy with no entries.');
});

test('U14 (#3 heading): the page shows a "Notes" heading and a back link to the profile', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx does not exist yet.');
  assert(/NOTES_COPY[\s\S]{0,80}HEADING\s*:\s*['"]Notes['"]/.test(src) || /HEADING\s*:\s*['"]Notes['"]/.test(src),
    'NOTES_COPY.HEADING must be "Notes" (the page heading).');
  assert(/to=\{\s*[`'"]\/user\/\$\{pubkey\}[`'"]\s*\}/.test(src) || (/<Link\b/.test(src) && /Back to profile/i.test(src)),
    'the page must include a back link to /user/${pubkey} (the BrainstormFollows convention).');
});

test('U15 (#3 testability): renderUserNotesState is a named-exported PURE function (no fetch/hook/router/browser globals)', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx does not exist yet.');
  assert(/export\s+(function\s+renderUserNotesState|const\s+renderUserNotesState\s*=)/.test(src),
    'BrainstormUserNotes.jsx must NAMED-export a pure body helper renderUserNotesState({ data, loading, error }) (ADR §Testability — the property the per-story level rests on).');
  const body = helperBody(src, ['renderUserNotesState']);
  for (const banned of ['fetch(', 'useUserNotes(', 'useAuth(', 'useParams(', 'useNavigate(', 'window.', 'document.']) {
    assert(!body.includes(banned), `the pure renderUserNotesState must not call ${banned} — it is a pure function of { data, loading, error }.`);
  }
});

// ===========================================================================
// AC (no overflow @1280px) — the wrap + capped-column mechanism (the rendered
// no-scrollbar proof is the staging capstone; here we prove the mechanism exists)
// ===========================================================================

test('U16 (#3 AC no overflow): the shared note-card text wraps and the notes column is width-bounded (no 1280px overflow)', () => {
  const css = safeRead(STYLES);
  const page = safeRead(NOTES_PAGE);
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  assert(page.length > 0, 'BrainstormUserNotes.jsx does not exist yet.');
  // The shared bsp-note-card-* text rule must wrap long content/URLs (this travels with the card to
  // every surface that reuses it — it already exists from the feed; here it protects this page too).
  const cardRules = (css.match(/\.bsp-note-card[\w-]*\s*\{[^}]*\}/g) || []).join('\n');
  assert(cardRules.length > 0, 'styles.css must define the shared bsp-note-card-* rules.');
  assert(/overflow-wrap\s*:\s*(anywhere|break-word)|word-break\s*:\s*(break-word|break-all)/.test(cardRules),
    'a bsp-note-card-* rule must wrap note text (overflow-wrap:anywhere / word-break) so a long URL/token cannot extend past 1280px (#3 AC no overflow).');
  // The page renders inside the capped shared bsp-content column (the BrainstormFollows pattern) OR
  // caps its own list — accept either, mirroring live-feed's column-cap sentinel.
  assert(/bsp-content/.test(page) || /maxWidth\s*:\s*\d/.test(page) || /max-width\s*:\s*\d/.test((css.match(/\.bsp-notes[\w-]*\s*\{[^}]*\}/g) || []).join('\n')),
    'the notes list must live in a width-bounded column (the shared bsp-content column, an inline maxWidth, or a capped bsp-notes-* rule) so the page does not overflow 1280px (#3 AC).');
});

// ===========================================================================
// REGRESSION SENTINELS (PASS before AND after — additive change)
// ===========================================================================

test('R1: App.jsx still registers the existing /user/:pubkey sub-routes — /notes is ADDED beside them, nothing removed', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  for (const route of ['/user/:pubkey/follows', '/user/:pubkey/followers', '/user/:pubkey/follows-hops']) {
    assert(new RegExp("path:\\s*['\"]" + route.replace(/\//g, '\\/') + "['\"]").test(src),
      `the existing sub-route '${route}' must remain (the /notes route is added beside it, not in place of it).`);
  }
  assert(/path:\s*['"]\/user\/:pubkey['"]/.test(src) && /BrainstormProfile/.test(src),
    'the /user/:pubkey profile route must remain registered (additive change).');
});

test('R2: NoteCard is REUSED AS-IS — it still takes a single { item } prop and renders a bsp-note-card (no variant fork)', () => {
  const src = safeRead(NOTE_CARD);
  assert(src.length > 0, 'ui/src/components/NoteCard.jsx missing — unexpected.');
  assert(/export\s+default\s+function\s+NoteCard\s*\(\s*\{\s*item\s*[,}]/.test(src),
    'NoteCard must keep its item-first presentational contract — ADR 0002 chose to reuse it as-is (no variant fork; ' +
    'optional defaulted props like showTagScores (tag surfaces, joined at the 2026-07-15 feat/tags↔staging merge) are additive and allowed).');
  assert(/bsp-note-card/.test(src), 'NoteCard must still render the shared bsp-note-card markup (unchanged).');
});

test('R3: the profile Reputation section + TRUST_METRICS grid path are untouched (additive — the Content section only appends)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/<h3>\s*Reputation/.test(src) && /TRUST_METRICS/.test(src),
    'BrainstormProfile.jsx must keep its Reputation section + TRUST_METRICS grid — the Content section is appended after it, changing nothing existing (#2 AC additive/no-regression).');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
