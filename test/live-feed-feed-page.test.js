/**
 * Story live-feed #2: the public, login-free `/feed` page (front-end only).
 * ADR live-feed/0002. See engineering-team/stories/live-feed/2-feed-page.test-plan.md
 *
 * ADR 0002 chose Option A: a top-level public React SPA route `/feed` in ui/src/App.jsx
 * (beside /about), a new ui/src/pages/BrainstormFeed.jsx modeled on BrainstormAbout.jsx's
 * plain public shell, and a new ui/src/hooks/useFeed.js modeled on useGrapevineFollows.js,
 * with the body rendered by a PURE, named-exported renderFeedState / <FeedBody> that maps
 * the read path's { status, items, … } result (status ∈ {OK, EMPTY, NO_SOURCE,
 * FOLLOW_LIST_UNAVAILABLE}) to exactly one of the four story states, plus a transient
 * loading line and a defensive "couldn't load" case. Copy lives in an exported FEED_COPY.
 *
 * TEST LEVEL — source assertion, not runtime render (see test-plan §"Test level decision").
 * The Node harness (`node test/test.js`) has NO JSX transpile, and `react-dom/server` is not
 * resolvable from the repo root (react-dom lives only in the ui/ Vite workspace). So the
 * `renderToStaticMarkup` path the ADR *floats* is not runnable here, and adding a transpile
 * would be new tooling (forbidden, JS-without-build house rule). We therefore assert on the
 * `ui/src/*.jsx` SOURCE TEXT — the exact convention of the profile-follows-list /
 * profile-followers-list / verified-reporters-list-page / reputation-info-popup suites. The
 * page/hook/route/CSS do not exist pre-implementation, so T1–T16 FAIL now and PASS once built.
 * R1–R2 are regression sentinels — PASS before AND after (additive change; read path untouched).
 *
 * The runtime properties the source level cannot prove — anonymous GET /feed returning 200,
 * and a browser actually rendering ≥3 notes with no 1280px horizontal scrollbar — are the
 * book's MANDATORY Tier-4 staging smoke (curl + DOM extract/screenshot), gathered by the
 * Director, NOT this suite. This suite proves the page is built-to-render those four states
 * and wired-to-be reachable + non-overflowing; it makes no runtime-rendering claim.
 *
 * COPY NOTE: per the story, the empty-state copy is operator-delegated and "punctuation is
 * non-binding so long as each message conveys its frame meaning." The copy sentinels therefore
 * assert the load-bearing MEANING tokens of each message (anchored on the exported FEED_COPY
 * constants), not a byte-for-byte sentence — so they hold the meaning without over-constraining
 * punctuation the story explicitly frees.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PAGE   = path.resolve(__dirname, '../ui/src/pages/BrainstormFeed.jsx');
const HOOK   = path.resolve(__dirname, '../ui/src/hooks/useFeed.js');
const APP    = path.resolve(__dirname, '../ui/src/App.jsx');
const STYLES = path.resolve(__dirname, '../ui/src/styles.css');
const READ_PATH = path.resolve(__dirname, '../src/api/feed/feedReadPath.js');
const TIMEAGO = path.resolve(__dirname, '../ui/src/utils/timeAgo.js');
const NOSTR_ENTITIES = path.resolve(__dirname, '../ui/src/utils/nostrEntities.js');
const COMPONENT_NOTE_CONTENT = path.resolve(__dirname, '../ui/src/components/NoteContent.jsx');
const NOTE_CARD = path.resolve(__dirname, '../ui/src/components/NoteCard.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); }
  catch { return null; }
}

// Fixed "now" so the relative-time assertions are deterministic.
const TA_NOW = 1_700_000_000;
const TA_MIN = 60, TA_HOUR = 3600, TA_DAY = 86400, TA_YEAR = 365 * TA_DAY;

// Slice the body-helper function (renderFeedState OR FeedBody) out of the page source so the
// branch sentinels match logic *inside* the pure helper, not anywhere on the page. Returns the
// whole page source if the helper can't be located by name (so missing-helper still fails loudly
// on the export sentinel T14, and the branch sentinels fail on absent copy/branches rather than
// silently passing against unrelated text).
function bodyHelper(src) {
  const m = src.match(/function\s+(renderFeedState|FeedBody)\s*\(/);
  if (!m) return src;
  return src.slice(m.index);
}

// ===========================================================================
// AC-1 — public reachability: route registered in the top-level public group
// (the 200 + no-login-wall RUNTIME proof is the Tier-4 staging curl; here we
//  prove the route is wired into the public group so the SPA fallback serves it)
// ===========================================================================

test('T1: registers a top-level public /feed route mapped to BrainstormFeed (AC-1 reachability)', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/path:\s*['"]\/feed['"]/.test(src),
    "App.jsx must declare a route with path '/feed' (the bookmarkable public page). Absent pre-implementation.");
  assert(/BrainstormFeed/.test(src),
    'App.jsx must import and map the /feed route to the BrainstormFeed page component.');
  // The route must sit in the TOP-LEVEL public group (beside /about, /how-search-works,
  // /developers) — NOT nested under the /tapestry admin Layout or the /user/:pubkey profiles,
  // so it is public-by-construction. Assert /feed appears before the /tapestry admin block.
  const feedIdx = src.search(/path:\s*['"]\/feed['"]/);
  const tapestryIdx = src.search(/path:\s*['"]\/tapestry['"]/);
  assert(feedIdx !== -1 && tapestryIdx !== -1 && feedIdx < tapestryIdx,
    'the /feed route must live in the top-level public router array (before the /tapestry admin group), not nested under an admin Layout or a pubkey-scoped profile route — so anonymous clients reach it (AC-1).');
});

// ===========================================================================
// AC-2 — populated feed: heading, window indicator, per-note content, order
// ===========================================================================

test('T2: exports the exact heading copy "Live Feed" (AC-2 heading)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'ui/src/pages/BrainstormFeed.jsx does not exist yet — the Implementer must create the feed page (ADR 0002 Option A).');
  assert(/FEED_COPY/.test(src),
    'BrainstormFeed.jsx must define the exported FEED_COPY copy constants (so the copy is pinned and the Implementer cannot drift it).');
  assert(/HEADING\s*:\s*['"]Live Feed['"]/.test(src),
    'FEED_COPY.HEADING must be exactly "Live Feed" — the populated-feed heading (AC-2).');
});

test('T3: shows a populated-feed indicator (feed-usability/0002: now a truthful COUNT, not the fixed "most recent 50")', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  // ADR feed-usability/0002 replaced the fixed "Showing the most recent 50 notes." with a
  // truthful, count-derived indicator (pagination loads past 50; the toggle filters). We
  // pin that the indicator element exists; its exact wording is owned by feed-pagination.test.js.
  assert(/bsp-feed-indicator/.test(src),
    'BrainstormFeed.jsx must render the populated-feed indicator (bsp-feed-indicator). Its truthful count wording is asserted by the feed-pagination suite (ADR feed-usability/0002).');
});

test('T4: the OK branch renders the indicator then maps items in ARRAY ORDER without re-sorting (AC-2 order)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  const body = bodyHelper(src);
  assert(/status\s*===?\s*['"]OK['"]/.test(body),
    "the body helper must branch on status === 'OK' (the populated feed). Absent pre-implementation.");
  // feed-usability/0002 virtualized the list: the OK branch renders one entry per note via
  // items.map(...) OR react-virtuoso's itemContent (windowed) — both are "one entry per note".
  assert(/\bitems\b[\s\S]{0,40}\.map\s*\(/.test(body) || /\.map\s*\(\s*(\(?\s*item)/.test(body) || /itemContent=\{/.test(body),
    'the OK branch must render one entry per note — via items.map(...) or a virtualized <Virtuoso itemContent> (ADR feed-usability/0002).');
  // The read path already delivers items newest-first (FEED_CAP, created_at desc); the page must
  // NOT re-sort — re-sorting would be re-derivation (ADR §No re-derivation) and could break order.
  assert(!/\bitems\b[\s\S]{0,8}\.sort\s*\(/.test(body) && !/\.sort\s*\([\s\S]{0,40}createdAt/.test(src),
    'the page must render items in the array order the read path delivered (already newest-first); it must NOT re-sort them (ADR §No re-derivation / AC-2 newest-first is owned by #1).');
});

test('T5: each note entry shows author display name + avatar (with placeholder fallback) + timestamp + text (AC-2 content)', () => {
  // The per-note card is now the shared NoteCard component (extracted from the page).
  const src = safeRead(NOTE_CARD);
  assert(src.length > 0, 'ui/src/components/NoteCard.jsx must exist — the shared per-note card unit.');
  // Per-note content fields off the contract item { author:{ displayName, avatar }, createdAt, content }.
  assert(/author[\s\S]{0,12}displayName|displayName/.test(src),
    "each entry must show the author display name (item.author.displayName) (AC-2).");
  assert(/bsp-avatar/.test(src),
    'each entry must show the author avatar using the shared bsp-avatar image class (AC-2).');
  assert(/bsp-avatar-placeholder/.test(src),
    'a null author.avatar must fall back to the bsp-avatar-placeholder (so an avatar-less author still renders, no broken image) (AC-2 / edge case).');
  assert(/createdAt/.test(src),
    "each entry must show the note timestamp derived from item.createdAt (AC-2).");
  assert(/\.content\b|item\.content|\bcontent\b/.test(src),
    "each entry must show the note text (item.content) (AC-2).");
});

test('T6: derives the per-note timestamp from createdAt via a local formatTimestamp helper, with no date library (AC-2 timestamp)', () => {
  const src = safeRead(NOTE_CARD);
  assert(src.length > 0, 'ui/src/components/NoteCard.jsx must exist.');
  assert(/formatTimestamp/.test(src),
    'NoteCard must define a local formatTimestamp helper that turns the Unix-seconds createdAt into a human timestamp (a tiny local helper, no date library).');
  // ADR/house rule: no new dependency — must not import a date library (moment/dayjs/date-fns/luxon).
  assert(!/from\s+['"](moment|dayjs|date-fns|luxon)['"]/.test(src) && !/require\(\s*['"](moment|dayjs|date-fns|luxon)['"]/.test(src),
    'formatTimestamp must NOT pull in a date library (moment/dayjs/date-fns/luxon) — no new dependency (ADR §Constraints / house rules). Use the built-in Date.');
});

// ===========================================================================
// AC-3 / AC-4 / AC-5 — the three empty states, each its own exact-meaning copy
// and ZERO note entries
// ===========================================================================

test('T7: empty state 6a — NO_SOURCE renders the "no House point-of-view selected" copy and no entries (AC-3)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  // Meaning tokens (punctuation non-binding per the story): names the House point-of-view and that
  // there is no feed/none selected yet.
  assert(/NO_SOURCE\s*:\s*["'][^"']*House[^"']*["']/.test(src),
    'FEED_COPY.NO_SOURCE must name the **House point-of-view** as the missing source (AC-3, frame 6a meaning) — e.g. "No House point-of-view is selected — there\'s no feed to show yet."');
  assert(/(point[\s-]?of[\s-]?view|PoV)[\s\S]{0,80}(no\s+feed|nothing|selected|yet)/i.test(src) ||
         /(no\s+feed|nothing|selected|yet)[\s\S]{0,80}(point[\s-]?of[\s-]?view|PoV)/i.test(src),
    'the 6a message must convey that, with no House point-of-view selected, there is no feed to show yet (AC-3 meaning).');
  const body = bodyHelper(src);
  assert(/status\s*===?\s*['"]NO_SOURCE['"]/.test(body),
    "the body helper must branch on status === 'NO_SOURCE' and render FEED_COPY.NO_SOURCE — with no items.map (no note entries) (AC-3).");
});

test('T8: empty state 6b — FOLLOW_LIST_UNAVAILABLE renders the "follow list not available locally" copy and no entries (AC-4)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  assert(/FOLLOW_UNAVAIL\s*:\s*["'][^"']*(follow list|follow-list)[^"']*["']/i.test(src),
    "FEED_COPY.FOLLOW_UNAVAIL must say the identity's follow list isn't available locally yet (AC-4, frame 6b meaning).");
  assert(/(follow[\s-]?list)[\s\S]{0,60}(local|isn't available|not available|unavailable)/i.test(src) ||
         /(local|isn't available|not available|unavailable)[\s\S]{0,60}(follow[\s-]?list)/i.test(src),
    'the 6b message must convey that the follow list is not available locally (yet) (AC-4 meaning).');
  const body = bodyHelper(src);
  assert(/status\s*===?\s*['"]FOLLOW_LIST_UNAVAILABLE['"]/.test(body),
    "the body helper must branch on status === 'FOLLOW_LIST_UNAVAILABLE' and render FEED_COPY.FOLLOW_UNAVAIL — with no note entries (AC-4).");
});

test('T9: empty state 6c — EMPTY renders the "no recent notes from accounts this identity follows" copy and no entries (AC-5)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  assert(/NO_NOTES\s*:\s*["'][^"']*(recent notes|no .*notes|notes)[^"']*["']/i.test(src),
    "FEED_COPY.NO_NOTES must convey there are no recent notes from the accounts this identity follows (AC-5, frame 6c meaning).");
  assert(/(no recent notes|no .*notes)[\s\S]{0,80}(follow|accounts)/i.test(src),
    'the 6c message must convey there are no recent notes from the accounts this identity follows (AC-5 meaning).');
  const body = bodyHelper(src);
  assert(/status\s*===?\s*['"]EMPTY['"]/.test(body),
    "the body helper must branch on status === 'EMPTY' and render FEED_COPY.NO_NOTES — with no note entries (AC-5).");
});

// ===========================================================================
// Supporting — the data hook (consumes #1's /api/feed, passes the result through)
// ===========================================================================

test('T10: useFeed fetches /api/feed and surfaces a transport failure as `error` (supporting AC-1/AC-2 plumbing)', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'ui/src/hooks/useFeed.js does not exist yet — the Implementer must create the data hook (ADR 0002 §Impl, mirroring useGrapevineFollows.js).');
  assert(/fetch\(\s*['"]\/api\/feed['"]/.test(src),
    "useFeed.js must call the read path's endpoint: fetch('/api/feed', { signal }) (the page renders #1's output; it adds no read logic).");
  assert(/success/.test(src),
    'useFeed.js must gate on the response body\'s `success` flag (ADR 0001 returns { success:true, ...result }).');
  assert(/setError|error/.test(src),
    'useFeed.js must set an `error` on a non-success / transport failure (drives the page\'s defensive "couldn\'t load" branch).');
});

// ===========================================================================
// AC-1 (no overflow) — the capped-width column + wrapping CSS mechanism
// (the *rendered* no-scrollbar @1280px is Tier-4; here we prove the mechanism exists)
// ===========================================================================

test('T11: note text wraps so a long token cannot overflow 1280px (overflow-wrap / word-break) (AC-1 no overflow)', () => {
  const css = safeRead(STYLES);
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  // The shared note-card text class must wrap long content/URLs. Anchor on a bsp-note-card-*
  // rule carrying overflow-wrap/word-break (the protection now travels with the card to every
  // surface that reuses it, not just the feed).
  const block = css.match(/\.bsp-note-card[\w-]*\s*\{[^}]*\}/g);
  assert(block && block.length > 0,
    'styles.css must define the shared bsp-note-card-* rules for the note card.');
  const joined = block.join('\n');
  assert(/overflow-wrap\s*:\s*(anywhere|break-word)|word-break\s*:\s*(break-word|break-all)/.test(joined),
    'a bsp-note-card-* rule must wrap note text (overflow-wrap:anywhere / word-break) so a long URL or unbroken token cannot extend past the column / 1280px (AC-1 no horizontal overflow).');
});

test('T12: the feed column is width-capped with box-sizing:border-box so content cannot exceed 1280px (AC-1 no overflow)', () => {
  const src = safeRead(PAGE);
  const css = safeRead(STYLES);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  // The column must be capped (a max-width token / inline maxWidth, as BrainstormAbout does) and
  // box-sizing:border-box so padding doesn't push the box past its cap. Accept the cap on the page
  // (inline maxWidth, the BrainstormAbout pattern) OR in a shared bsp-note-card-* CSS rule.
  const cappedOnPage = /maxWidth\s*:\s*\d/.test(src);
  const cardRules = (css.match(/\.bsp-note-card[\w-]*\s*\{[^}]*\}/g) || []).join('\n');
  const cappedInCss = /max-width\s*:\s*\d/.test(cardRules);
  assert(cappedOnPage || cappedInCss,
    'the column must be width-capped — an inline maxWidth on the bsp-content column (the BrainstormAbout pattern) or a max-width on a bsp-note-card-* rule — so the page does not stretch unbounded (AC-1 no overflow @1280px).');
  assert(/box-sizing\s*:\s*border-box/.test(cardRules) || /box-sizing\s*:\s*border-box/.test(css),
    'the note card/column must use box-sizing:border-box so its padding is inside the capped width and cannot push content past 1280px (AC-1).');
});

// ===========================================================================
// Testability contract (the property the ADR rests the per-story level on) +
// defensive case + the reused public shell
// ===========================================================================

test('T13: useFeed mirrors the hook convention — returns { data, loading, error } and aborts on unmount (supporting)', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'useFeed.js does not exist yet.');
  assert(/return\s*\{[\s\S]{0,120}data[\s\S]{0,120}loading[\s\S]{0,120}error[\s\S]{0,40}\}/.test(src),
    'useFeed must return { data, loading, error } (the established hook shape, mirroring useGrapevineFollows.js).');
  assert(/AbortController/.test(src) && /\.abort\(\)/.test(src),
    'useFeed must abort the fetch on unmount via AbortController (the useGrapevineFollows.js convention — no setState-after-unmount).');
});

test('T14: the body is a PURE, named-exported renderFeedState/FeedBody of {data,loading,error}, free of fetch/auth/router/browser globals (ADR testability)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  // The decisive testability property (ADR §Testability #1): the state→view mapping is an isolated,
  // importable pure unit. We can't runtime-render it here, but we can pin that it IS that unit.
  assert(/export\s+(function\s+(renderFeedState|FeedBody)|const\s+(renderFeedState|FeedBody)\s*=)/.test(src),
    'BrainstormFeed.jsx must NAMED-export a pure body helper (renderFeedState or FeedBody) so the four states are an isolated, testable unit (ADR §Testability #1 — the property the per-story level rests on).');
  const body = bodyHelper(src);
  // Inside the helper: no fetch, no useAuth, no router hooks, no window/document — it is a pure
  // function of its args. (useFeed/useAuth belong in the page wrapper, not the helper.)
  for (const banned of ['fetch(', 'useAuth(', 'useFeed(', 'useNavigate(', 'useParams(', 'window.', 'document.']) {
    assert(!body.includes(banned),
      `the pure body helper must not call ${banned} — it must be a pure function of { data, loading, error } (data fetching/auth/routing live in the page wrapper, ADR §Testability #1).`);
  }
});

test('T15: a transport/error or unknown status renders a neutral "couldn\'t load" line, never a raw error or blank (defensive case)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  const body = bodyHelper(src);
  assert(/\berror\b/.test(body),
    'the body helper must handle the `error` arg — the defensive transport-failure case (ADR §Context: a 5th presentation case beyond the four read-path states).');
  assert(/couldn'?t load|could not load|unable to load|try again|something went wrong/i.test(src),
    'the defensive branch must show a neutral "Couldn\'t load the feed right now." line — never a raw error/stack or a blank page (ADR §Impl defensive branch; AC "never an error").');
});

test('T16: the page reuses the plain public shell (bsp-page/bsp-top-bar/bsp-content + BrainstormUserMenu) and useAuth, so the logged-out case is safe (AC-1 no login wall)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx does not exist yet.');
  assert(/bsp-page/.test(src) && /bsp-top-bar/.test(src) && /bsp-content/.test(src),
    'BrainstormFeed.jsx must reuse the plain public shell classes (bsp-page → bsp-top-bar → bsp-content), modeled on BrainstormAbout.jsx (ADR §Impl).');
  assert(/BrainstormUserMenu/.test(src),
    'BrainstormFeed.jsx must render the shared <BrainstormUserMenu> (the public top bar), as BrainstormAbout does.');
  assert(/useAuth\s*\(\s*\)/.test(src),
    'BrainstormFeed.jsx must use useAuth() — which initializes user=null and tolerates the anonymous case, so the page renders with no logged-in user (AC-1: no login wall).');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: App.jsx still registers the existing public + profile routes — /feed is ADDED beside them, nothing removed (additive)', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  for (const route of ['/about', '/how-search-works', '/developers']) {
    assert(new RegExp("path:\\s*['\"]" + route.replace('/', '\\/') + "['\"]").test(src),
      `the existing top-level public route '${route}' must remain (the /feed route is added beside it, not in place of it).`);
  }
  assert(/path:\s*['"]\/['"]/.test(src) && /BrainstormSearch/.test(src),
    'the root "/" search route must remain registered (additive change — the rest of the app is unchanged).');
});

test('R2: this story re-derives nothing — the read-path module src/api/feed/feedReadPath.js is NOT modified by the page (the #1/#2 split)', () => {
  const src = safeRead(READ_PATH);
  assert(src.length > 0, 'src/api/feed/feedReadPath.js missing — unexpected (ADR 0001 / #1 owns it).');
  // #1 owns resolution/order/cap; #2 only renders its output. The read path must still expose the
  // discriminated four-status contract this page maps over. If this sentinel breaks, the page
  // edited #1's logic (forbidden — re-derivation; ADR §Out of scope / §No re-derivation).
  assert(/FEED_CAP\s*=\s*50/.test(src),
    'the read path must keep FEED_CAP = 50 (the 50-cap is #1\'s; the page only *displays* "most recent 50 notes", it does not change the cap).');
  for (const status of ['NO_SOURCE', 'FOLLOW_LIST_UNAVAILABLE', 'EMPTY', 'OK']) {
    assert(new RegExp("status:\\s*['\"]" + status + "['\"]").test(src),
      `the read path must still return the '${status}' status (the four-outcome contract this page maps over — owned by #1, untouched by this story).`);
  }
});

// ===========================================================================
// RELATIVE TIMESTAMP — the feed shows a compact "time ago" label (max two
// y/d/h/m units, space-separated), delegating the unit math to the shared
// formatTimeAgo helper. These EXECUTE the real ui ESM (dynamic import).
// ===========================================================================

test('T17: formatTimeAgo({maxUnits:2, separator:" "}) renders the feed two-unit space format', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function',
    'ui/src/utils/timeAgo.js must export formatTimeAgo — the feed reuses it for its relative label.');
  const fmt = (sec) => mod.formatTimeAgo(TA_NOW - sec, TA_NOW, { maxUnits: 2, separator: ' ' });
  assert(fmt(2 * TA_MIN) === '2m ago', `2m → "2m ago", got "${fmt(2 * TA_MIN)}"`);
  assert(fmt(4 * TA_HOUR + 53 * TA_MIN) === '4h 53m ago', `4h53m → "4h 53m ago", got "${fmt(4 * TA_HOUR + 53 * TA_MIN)}"`);
  assert(fmt(1 * TA_YEAR + 213 * TA_DAY) === '1y 213d ago', `1y213d → "1y 213d ago", got "${fmt(1 * TA_YEAR + 213 * TA_DAY)}"`);
  // The third unit is dropped — at most two units (the story's "1y, 23d, 4h" → "1y 23d").
  assert(fmt(1 * TA_YEAR + 23 * TA_DAY + 4 * TA_HOUR) === '1y 23d ago',
    `1y23d4h → "1y 23d ago" (3rd unit dropped), got "${fmt(1 * TA_YEAR + 23 * TA_DAY + 4 * TA_HOUR)}"`);
});

test('T18: formatTimeAgo DEFAULTS are unchanged (3 units, comma separator) — verified-reporters untouched (regression)', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function', 'ui/src/utils/timeAgo.js must export formatTimeAgo.');
  // No opts → must still be the 3-unit comma format the verified-reporters suite pins.
  const got = mod.formatTimeAgo(TA_NOW - (3 * TA_DAY + 4 * TA_HOUR + 12 * TA_MIN), TA_NOW);
  assert(got === '3d, 4h, 12m ago', `default 3-unit comma format must be preserved; got "${got}"`);
  assert(mod.formatTimeAgo(TA_NOW - 30, TA_NOW) === '0m ago', 'default sub-minute must still be "0m ago".');
});

test('T19: NoteCard reuses formatTimeAgo, renders "just now" for sub-minute, and keeps the exact time on hover (title)', () => {
  const src = safeRead(NOTE_CARD);
  assert(src.length > 0, 'ui/src/components/NoteCard.jsx must exist.');
  assert(/from\s+['"]\.\.\/utils\/timeAgo['"]/.test(src) && /formatTimeAgo/.test(src),
    'NoteCard must import + use formatTimeAgo from ../utils/timeAgo (reuse, not a third time-format copy).');
  assert(/just now/.test(src),
    'formatTimestamp must render "just now" for the sub-minute case (the smallest unit is the minute).');
  assert(/maxUnits\s*:\s*2/.test(src),
    'the card must request the two-unit form via formatTimeAgo(..., { maxUnits: 2, ... }).');
  assert(/bsp-note-card-time[^>]*title=/.test(src) || /title=\{[^}]*absoluteTimestamp/.test(src),
    'the timestamp element must carry a title (hover) with the exact local time so no precision is lost.');
});

// ===========================================================================
// NIP-21 nostr: ENTITY PARSING — note content turns `nostr:<entity>` references
// into in-app links (the standard nostr-client treatment). EXECUTES the real pure
// parser (ui ESM via dynamic import); fixtures are minted with nostr-tools so the
// asserted pubkey/id is self-validating, not hardcoded.
// ===========================================================================

const { nip19 } = require('nostr-tools');
const TA_PK = 'a'.repeat(64);  // a deterministic 32-byte hex pubkey for fixtures
const TA_ID = 'b'.repeat(64);  // a deterministic 32-byte hex event id

function segsOfType(segs, t) { return segs.filter(s => s.type === t); }

test('T20: parseNostrContent links npub/nprofile → /user/<pubkey> and note/nevent/naddr → /event?…', async () => {
  const mod = await loadEsm(NOSTR_ENTITIES);
  assert(mod && typeof mod.parseNostrContent === 'function',
    'ui/src/utils/nostrEntities.js must export parseNostrContent — the feed reuses it to render note content.');
  const p = mod.parseNostrContent;

  const npub = nip19.npubEncode(TA_PK);
  const nprofile = nip19.nprofileEncode({ pubkey: TA_PK });
  const note = nip19.noteEncode(TA_ID);
  const nevent = nip19.neventEncode({ id: TA_ID, author: TA_PK });
  const naddr = nip19.naddrEncode({ identifier: 'x', pubkey: TA_PK, kind: 39998 });

  const [pn] = segsOfType(p(`hi nostr:${npub} there`), 'profile');
  assert(pn && pn.href === `/user/${TA_PK}` && pn.label.startsWith('@'), `npub → profile mention /user/<pubkey>, got ${JSON.stringify(pn)}`);
  assert(segsOfType(p(`nostr:${nprofile}`), 'profile')[0]?.href === `/user/${TA_PK}`, 'nprofile → /user/<pubkey>');
  assert(segsOfType(p(`nostr:${note}`), 'event')[0]?.href === `/event?id=${TA_ID}`, 'note → /event?id=<hex>');
  assert(segsOfType(p(`nostr:${nevent}`), 'event')[0]?.href === `/event?nevent=${nevent}`, 'nevent → /event?nevent=<nevent>');
  assert(segsOfType(p(`nostr:${naddr}`), 'event')[0]?.href === `/event?naddr=${naddr}`, 'naddr → /event?naddr=<naddr>');
});

test('T21: parseNostrContent preserves surrounding text in order (text / entity / text)', async () => {
  const mod = await loadEsm(NOSTR_ENTITIES);
  const nevent = nip19.neventEncode({ id: TA_ID });
  const segs = mod.parseNostrContent(`before nostr:${nevent} after`);
  assert(segs.length === 3, `expected 3 segments (text,event,text), got ${segs.length}`);
  assert(segs[0].type === 'text' && segs[0].text === 'before ', 'leading text preserved');
  assert(segs[1].type === 'event', 'middle segment is the event link');
  assert(segs[2].type === 'text' && segs[2].text === ' after', 'trailing text preserved');
});

test('T22: parseNostrContent NEVER linkifies nsec, and keeps an undecodable entity as plain text (security + robustness)', async () => {
  const mod = await loadEsm(NOSTR_ENTITIES);
  const nsec = nip19.nsecEncode(new Uint8Array(32).fill(7));
  const nsecSegs = mod.parseNostrContent(`leak? nostr:${nsec} end`);
  assert(segsOfType(nsecSegs, 'profile').length === 0 && segsOfType(nsecSegs, 'event').length === 0,
    'an nsec must NEVER be turned into a link — a private key stays as plain text.');
  assert(nsecSegs.map(s => s.text || '').join('').includes(nsec), 'the nsec text itself is preserved verbatim (not dropped).');
  // Undecodable (bad checksum) → kept as the original "nostr:…" text, never a broken link.
  const bad = mod.parseNostrContent('nostr:nevent1qqsbadchecksumzzzz');
  assert(segsOfType(bad, 'event').length === 0, 'an undecodable entity must not become an event link.');
});

test('T23: the user-provided real example strings decode to a profile and an event reference', async () => {
  const mod = await loadEsm(NOSTR_ENTITIES);
  const profileEx = 'nostr:nprofile1qqszv6q4uryjzr06xfxxew34wwc5hmjfmfpqn229d72gfegsdn2q3fgpz3mhxue69uhhyetvv9ujuerpd46hxtnfduq32amnwvaz7tmjv4kxz7fwv3sk6atn9e5k7tc6khtzt';
  const eventEx = 'nostr:nevent1qqsz56926mefn8mj05mutplk4em3e8qypp9gmmkx6hq8yv5s3w0yqtsupa5xa';
  const pseg = segsOfType(mod.parseNostrContent(profileEx), 'profile')[0];
  assert(pseg && /^\/user\/[0-9a-f]{64}$/.test(pseg.href), `the nprofile example must resolve to /user/<64-hex>, got ${pseg && pseg.href}`);
  const eseg = segsOfType(mod.parseNostrContent(eventEx), 'event')[0];
  assert(eseg && eseg.href.startsWith('/event?nevent=nevent1'), `the nevent example must resolve to /event?nevent=…, got ${eseg && eseg.href}`);
});

test('T24: the feed renders each note via the shared NoteCard, which renders content through NoteContent (NIP-21 entity links)', () => {
  const page = safeRead(PAGE);
  const card = safeRead(NOTE_CARD);
  const comp = safeRead(COMPONENT_NOTE_CONTENT);
  assert(page.length > 0 && card.length > 0 && comp.length > 0, 'BrainstormFeed.jsx, NoteCard.jsx and NoteContent.jsx must exist.');
  // The page delegates each item to the shared card unit (so the two new locations + future
  // per-note improvements reuse one component) — it does not inline the card markup.
  assert(/<NoteCard\b[^>]*\bitem=\{item\}/.test(page) && /import NoteCard/.test(page),
    'the feed must render each note via <NoteCard item={item} /> (the shared per-note card), not inline card markup.');
  assert(/<NoteContent\s+content=\{item\.content\}/.test(card),
    'NoteCard must render the note text via <NoteContent content={item.content} /> (the entity-linkifying renderer), not {item.content} verbatim.');
  assert(/parseNostrContent/.test(comp) && /react-router-dom/.test(comp),
    'NoteContent must map parseNostrContent segments to react-router <Link>s.');
});

test('T25: NoteCard passes the resolved mentions map and NoteContent renders "@name" over the raw npub', () => {
  const card = safeRead(NOTE_CARD);
  const comp = safeRead(COMPONENT_NOTE_CONTENT);
  assert(/<NoteContent\b[^>]*\bmentions=\{item\.mentions\}/.test(card),
    'NoteCard must pass the read path\'s resolved mentions map: <NoteContent content={item.content} mentions={item.mentions} />.');
  assert(/mentions\[seg\.pubkey\]/.test(comp) && /@\$\{name\}/.test(comp),
    'NoteContent must look up mentions[seg.pubkey] and render "@${name}" when the display name is resolved (falling back to the npub otherwise).');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
