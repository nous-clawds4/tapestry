/**
 * Story feed-usability #1: "Notes" | "Notes + Replies" toggle on the feed surfaces.
 * ADR feed-usability/0001. See engineering-team/stories/feed-usability/1-notes-replies-toggle.test-plan.md
 *
 * ADR chose Option A: a derived boolean `isReply` computed in the SHARED enrichment
 * (src/api/_shared/noteEnrichment.js) by a pure exported `isReplyNote(tags)` helper —
 * NIP-10 flat rule: a kind-1 is a reply iff it carries an `e` tag whose marker is not
 * "mention" (root/reply-marked and legacy unmarked `e` tags count; mention-only and
 * quote-only `q` notes do not). Both read paths funnel through enrichNotes, so BOTH
 * /api/feed and /api/user/:pubkey/notes items inherit `isReply` from this one change —
 * NO edits to either read-path module. The toggle itself is client-only page state
 * (default 'notes') driving the existing SortToggle; the pure render helpers filter
 * items by `isReply` before mapping to NoteCard, with a reply-only empty-state branch.
 *
 * TEST LEVELS:
 *  - Server (B*): EXECUTES the real CommonJS module `noteEnrichment.js` — isReplyNote
 *    truth table + enrichNotes carrying isReply on the item shape (in-memory scanStrfry
 *    fake; no live strfry/relays). FAIL pre-implementation (isReplyNote absent /
 *    isReply missing from items).
 *  - UI (U*): source-regex sentinels on ui/src/*.jsx — the Node harness has no JSX
 *    transpile (JS-without-build), so the pure render helpers cannot be *called* here;
 *    we pin their source, the exact convention of live-feed-feed-page.test.js /
 *    note-surfaces-ui.test.js. FAIL pre-implementation. The runtime toggle behavior
 *    (click → replies hide/show) is the cycle-local browser smoke before review, per
 *    house feedback — not this suite.
 *  - Regression (R*): PASS before AND after — existing empty states, the no-refetch
 *    hook contracts, and the read-path → enrichNotes inheritance mechanism.
 *
 * COPY NOTE: the story frees punctuation ("punctuation non-binding so long as the
 * message conveys its meaning"), so REPLY_ONLY sentinels assert meaning tokens
 * (top-level + replies/switch), not byte-exact sentences.
 */

const fs = require('fs');
const path = require('path');

const ENRICHMENT = path.resolve(__dirname, '../src/api/_shared/noteEnrichment.js');
const FEED_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormFeed.jsx');
const NOTES_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormUserNotes.jsx');
const FEED_HOOK = path.resolve(__dirname, '../ui/src/hooks/useFeed.js');
const NOTES_HOOK = path.resolve(__dirname, '../ui/src/hooks/useUserNotes.js');
const SORT_TOGGLE = path.resolve(__dirname, '../ui/src/components/SortToggle.jsx');
const FEED_READ_PATH = path.resolve(__dirname, '../src/api/feed/feedReadPath.js');
const NOTES_READ_PATH = path.resolve(__dirname, '../src/api/notes/userNotesReadPath.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

function loadEnrichment() {
  try {
    delete require.cache[require.resolve(ENRICHMENT)];
  } catch { /* fine */ }
  try { return require(ENRICHMENT); } catch { return null; }
}

// Slice the pure body helper out of a page source so branch sentinels match logic
// inside the helper, not anywhere on the page (live-feed-feed-page.test.js convention).
function bodyHelper(src, names) {
  const m = src.match(new RegExp(`function\\s+(${names.join('|')})\\s*\\(`));
  if (!m) return src;
  return src.slice(m.index);
}

// ---------------------------------------------------------------------------
// Fixtures — raw kind-1 events with NIP-10 tag shapes, and a local kind-0 fake.
// ---------------------------------------------------------------------------

const AUTHOR = 'a'.repeat(64);
const OTHER_PK = 'b'.repeat(64);
const PARENT = 'e'.repeat(64);

function rawNote(id, tags, content = 'hello world') {
  return { id: id.repeat(64).slice(0, 64), kind: 1, pubkey: AUTHOR, created_at: 1_700_000_000, content, tags };
}

// In-memory local kind-0 scan (the enrichNotes seam) — never hits strfry.
async function fakeScanStrfry(filter) {
  if (filter && Array.isArray(filter.kinds) && filter.kinds.includes(0)) {
    return [{
      kind: 0, pubkey: AUTHOR, created_at: 1,
      content: JSON.stringify({ name: 'Alice', picture: 'https://x/p.png' }),
    }];
  }
  return [];
}

// ===========================================================================
// AC-2 mechanism — the NIP-10 reply rule as a pure, executable server helper
// (isReplyNote). ALL FAIL pre-implementation (export absent).
// ===========================================================================

test('B1: noteEnrichment.js exports the pure isReplyNote(tags) helper (ADR §Server)', () => {
  const mod = loadEnrichment();
  assert(mod, 'src/api/_shared/noteEnrichment.js must load — unexpected.');
  assert(typeof mod.isReplyNote === 'function',
    'noteEnrichment.js must export isReplyNote(tags) — the single home of the NIP-10 reply rule (absent pre-implementation).');
});

test('B2: a legacy UNMARKED e tag counts as a reply (NIP-10 positional form)', () => {
  const mod = loadEnrichment();
  assert(mod && typeof mod.isReplyNote === 'function', 'isReplyNote absent — implement it first (B1).');
  assert(mod.isReplyNote([['e', PARENT]]) === true,
    "isReplyNote([['e', <id>]]) must be true — a legacy unmarked e tag is a reply (NIP-10 positional form).");
  assert(mod.isReplyNote([['e', PARENT, 'wss://relay.x']]) === true,
    'an unmarked e tag with a relay hint (no 4th element) must still count as a reply.');
});

test("B3: 'reply'- and 'root'-marked e tags count as replies", () => {
  const mod = loadEnrichment();
  assert(mod && typeof mod.isReplyNote === 'function', 'isReplyNote absent — implement it first (B1).');
  assert(mod.isReplyNote([['e', PARENT, '', 'reply']]) === true,
    "an e tag marked 'reply' must count as a reply.");
  assert(mod.isReplyNote([['e', PARENT, '', 'root']]) === true,
    "an e tag marked 'root' must count as a reply (a direct reply to the thread root carries only the root marker).");
});

test("B4: a 'mention'-marked e tag is NOT a reply (quote/mention, NIP-10)", () => {
  const mod = loadEnrichment();
  assert(mod && typeof mod.isReplyNote === 'function', 'isReplyNote absent — implement it first (B1).');
  assert(mod.isReplyNote([['e', PARENT, '', 'mention']]) === false,
    "an e tag marked 'mention' must NOT count as a reply — it is a quote/mention.");
  assert(mod.isReplyNote([['e', PARENT, '', 'mention'], ['p', OTHER_PK]]) === false,
    'mention-marked e + p tags must still be top-level.');
});

test('B5: q-tag-only (NIP-18 quote) and p/t-only notes are top-level; a mixed reply+mention is a reply', () => {
  const mod = loadEnrichment();
  assert(mod && typeof mod.isReplyNote === 'function', 'isReplyNote absent — implement it first (B1).');
  assert(mod.isReplyNote([['q', PARENT]]) === false,
    'a q-tag-only quote note must be top-level (a quote is not a reply — ADR §Defining "reply").');
  assert(mod.isReplyNote([['p', OTHER_PK], ['t', 'nostr']]) === false,
    'p/t tags alone must not make a note a reply.');
  assert(mod.isReplyNote([['e', PARENT, '', 'mention'], ['e', PARENT, '', 'reply']]) === true,
    'a note carrying BOTH a mention-e and a reply-e must count as a reply (any non-mention e tag wins).');
});

test('B6: no tags / empty / malformed input never counts as a reply (guards)', () => {
  const mod = loadEnrichment();
  assert(mod && typeof mod.isReplyNote === 'function', 'isReplyNote absent — implement it first (B1).');
  assert(mod.isReplyNote([]) === false, 'an empty tags array must be top-level.');
  assert(mod.isReplyNote(undefined) === false, 'undefined tags must be top-level, not a crash.');
  assert(mod.isReplyNote(null) === false, 'null tags must be top-level, not a crash.');
  assert(mod.isReplyNote('nope') === false, 'a non-array tags value must be top-level, not a crash.');
  assert(mod.isReplyNote([null, 'x', 42, []]) === false,
    'junk tag entries (null / strings / numbers / empty arrays) must not crash and must classify as top-level.');
  assert(mod.isReplyNote([['e']]) === false,
    "an ['e'] tag with NO event id references nothing — it must not count as a reply (guard tag[1]; the ADR snippet is illustrative, the story's rule is 'a response to another note').");
});

test('B7: enrichNotes items carry isReply matching the rule, alongside the unchanged shape (AC-2/AC-3 data)', async () => {
  const mod = loadEnrichment();
  assert(mod && typeof mod.enrichNotes === 'function', 'enrichNotes must exist (shipped) — unexpected.');
  const topLevel = rawNote('1', [['p', OTHER_PK]]);
  const reply = rawNote('2', [['e', PARENT, '', 'reply'], ['p', OTHER_PK]]);
  const mentionOnly = rawNote('3', [['e', PARENT, '', 'mention']]);
  const legacyReply = rawNote('4', [['e', PARENT]]);
  const items = await mod.enrichNotes([topLevel, reply, mentionOnly, legacyReply], fakeScanStrfry);
  assert(items.length === 4, `enrichNotes must return 4 items, got ${items.length}`);
  assert(items[0].isReply === false,
    'a p-tag-only note must carry isReply:false on the enriched item (isReply absent pre-implementation).');
  assert(items[1].isReply === true,
    "a 'reply'-marked note must carry isReply:true on the enriched item.");
  assert(items[2].isReply === false,
    'a mention-only note must carry isReply:false.');
  assert(items[3].isReply === true,
    'a legacy unmarked-e note must carry isReply:true.');
  // The existing contract fields are untouched (additive field only — ADR §Constraints).
  for (const k of ['id', 'pubkey', 'createdAt', 'content', 'author', 'mentions']) {
    assert(k in items[0], `the enriched item must still carry '${k}' — isReply is ADDED, nothing removed.`);
  }
  assert(items[0].author.displayName === 'Alice',
    'author enrichment from local kind-0 must still work (displayName from the fake scan).');
});

// ===========================================================================
// AC-1 — the toggle on BOTH surfaces, defaulting to "Notes" (UI sentinels)
// ===========================================================================

test('U1: /feed renders the shared SortToggle with "Notes" and "Notes + Replies" options (AC-1)', () => {
  const src = safeRead(FEED_PAGE);
  assert(src.length > 0, 'ui/src/pages/BrainstormFeed.jsx missing — unexpected.');
  assert(/import\s+SortToggle\s+from\s+['"]\.\.\/components\/SortToggle['"]/.test(src),
    'BrainstormFeed.jsx must import the existing shared SortToggle (ADR §Client — no new control).');
  assert(/['"]Notes['"]/.test(src) && /['"]Notes \+ Replies['"]/.test(src),
    'the toggle must carry the two labels "Notes" and "Notes + Replies" (AC-1 exact control labels).');
  assert(/value=\{mode\}/.test(src) && /onChange=\{setMode\}/.test(src),
    'SortToggle must be wired to the page mode state (value={mode} onChange={setMode}) so switching is instant client state — no refetch, no navigation (AC-3).');
});

test("U2: /feed mode state defaults to 'notes' (AC-1 default)", () => {
  const src = safeRead(FEED_PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx missing — unexpected.');
  assert(/useState\(\s*['"]notes['"]\s*\)/.test(src),
    "the page must initialize the toggle state to 'notes' — top-level only is the default view (AC-1, operator-resolved).");
});

test('U5: /user/:pubkey/notes renders the shared SortToggle with the same two options (AC-1)', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'ui/src/pages/BrainstormUserNotes.jsx missing — unexpected.');
  assert(/import\s+SortToggle\s+from\s+['"]\.\.\/components\/SortToggle['"]/.test(src),
    'BrainstormUserNotes.jsx must import the existing shared SortToggle (ADR §Client).');
  assert(/['"]Notes['"]/.test(src) && /['"]Notes \+ Replies['"]/.test(src),
    'the toggle must carry the two labels "Notes" and "Notes + Replies" (AC-1).');
  assert(/value=\{mode\}/.test(src) && /onChange=\{setMode\}/.test(src),
    'SortToggle must be wired to page mode state (value={mode} onChange={setMode}) (AC-3 no-refetch).');
});

test("U6: /user/:pubkey/notes mode state defaults to 'notes' (AC-1 default)", () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx missing — unexpected.');
  assert(/useState\(\s*['"]notes['"]\s*\)/.test(src),
    "the page must initialize the toggle state to 'notes' (AC-1 default).");
});

// ===========================================================================
// AC-2 / AC-3 / AC-4 — the pure render helpers filter by isReply per mode
// ===========================================================================

test('U3: renderFeedState takes mode and filters items by isReply (Notes drops replies; all keeps them) (AC-2/AC-3/AC-4)', () => {
  const src = safeRead(FEED_PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx missing — unexpected.');
  assert(/renderFeedState\s*\(\s*\{[^}]*\bmode\b/.test(src) || /function\s+renderFeedState\s*\(\s*\{[^}]*\bmode\b/.test(src),
    'the pure renderFeedState helper must receive `mode` in its args (the filter is view-time logic inside the pure helper — ADR §Client / testability).');
  const body = bodyHelper(src, ['renderFeedState', 'FeedBody']);
  assert(/isReply/.test(body),
    'the OK branch must filter entries by the item isReply flag (AC-2: in Notes mode no entry shown is a reply).');
  assert(/mode\s*===?\s*['"]all['"]/.test(body) || /mode\s*!==?\s*['"]notes['"]/.test(body) || /mode\s*===?\s*['"]notes['"]/.test(body),
    "the filter must branch on the mode value ('notes' filters replies out; 'all' keeps everything — AC-3), so switching modes re-filters the SAME items with no refetch (AC-4).");
  assert(/\.filter\s*\(/.test(body),
    'Notes mode must drop reply items via a filter over the delivered array (client-side filtering — ADR Option A).');
});

test('U7: renderUserNotesState takes mode and filters items by isReply the same way (AC-2/AC-3/AC-4)', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx missing — unexpected.');
  assert(/renderUserNotesState\s*\(\s*\{[^}]*\bmode\b/.test(src) || /function\s+renderUserNotesState\s*\(\s*\{[^}]*\bmode\b/.test(src),
    'the pure renderUserNotesState helper must receive `mode` in its args (ADR §Client).');
  const body = bodyHelper(src, ['renderUserNotesState']);
  assert(/isReply/.test(body),
    'the OK branch must filter entries by isReply (AC-2 on the notes page).');
  assert(/mode\s*===?\s*['"]all['"]/.test(body) || /mode\s*!==?\s*['"]notes['"]/.test(body) || /mode\s*===?\s*['"]notes['"]/.test(body),
    'the filter must branch on the mode value (AC-3/AC-4).');
  assert(/\.filter\s*\(/.test(body),
    'Notes mode must drop reply items via a filter over the delivered array.');
});

test('U9: neither page re-sorts — filtered items render in delivered array order (AC-2/AC-3 "still newest-first")', () => {
  for (const [p, helper] of [[FEED_PAGE, ['renderFeedState', 'FeedBody']], [NOTES_PAGE, ['renderUserNotesState']]]) {
    const src = safeRead(p);
    assert(src.length > 0, `${path.basename(p)} missing — unexpected.`);
    const body = bodyHelper(src, helper);
    assert(!/\.sort\s*\(/.test(body),
      `${path.basename(p)}: the body helper must NOT re-sort — filtering must preserve the read path's newest-first array order (AC-2/AC-4; re-sorting is re-derivation).`);
  }
});

// ===========================================================================
// AC-5 — the reply-only empty state (Notes mode, everything filtered away)
// ===========================================================================

test('U4: /feed shows an explicit reply-only message when Notes mode filters everything (AC-5)', () => {
  const src = safeRead(FEED_PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx missing — unexpected.');
  const m = src.match(/REPLY_ONLY\s*:\s*["']([^"']+)["']/);
  assert(m, 'FEED_COPY must gain a REPLY_ONLY message for the notes-are-all-replies case (AC-5) — absent pre-implementation.');
  assert(/top[\s-]?level/i.test(m[1]),
    `the reply-only copy must convey there are no TOP-LEVEL notes (meaning token; punctuation free) — got "${m[1]}"`);
  assert(/repl/i.test(m[1]),
    `the reply-only copy must point at replies / the "Notes + Replies" state as the way to see the rest (AC-5) — got "${m[1]}"`);
  const body = bodyHelper(src, ['renderFeedState', 'FeedBody']);
  assert(/REPLY_ONLY/.test(body),
    'the pure body helper must render the REPLY_ONLY branch (filtered-to-zero while notes exist) — never a blank list (AC-5).');
});

test('U8: /user/:pubkey/notes shows the same explicit reply-only message (AC-5)', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx missing — unexpected.');
  const m = src.match(/REPLY_ONLY\s*:\s*["']([^"']+)["']/);
  assert(m, 'NOTES_COPY must gain a REPLY_ONLY message (AC-5) — absent pre-implementation.');
  assert(/top[\s-]?level/i.test(m[1]),
    `the reply-only copy must convey there are no TOP-LEVEL notes — got "${m[1]}"`);
  assert(/repl/i.test(m[1]),
    `the reply-only copy must point at replies / "Notes + Replies" (AC-5) — got "${m[1]}"`);
  const body = bodyHelper(src, ['renderUserNotesState']);
  assert(/REPLY_ONLY/.test(body),
    'the pure body helper must render the REPLY_ONLY branch — never a blank list (AC-5).');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: /feed keeps its pre-existing empty states — NO_SOURCE / FOLLOW_LIST_UNAVAILABLE / EMPTY branches + copy (AC-6)', () => {
  const src = safeRead(FEED_PAGE);
  assert(src.length > 0, 'BrainstormFeed.jsx missing — unexpected.');
  for (const key of ['NO_SOURCE', 'FOLLOW_UNAVAIL', 'NO_NOTES']) {
    assert(new RegExp(`${key}\\s*:`).test(src),
      `FEED_COPY.${key} must remain — the toggle must not disturb the three defined /feed empty states (AC-6).`);
  }
  const body = bodyHelper(src, ['renderFeedState', 'FeedBody']);
  for (const status of ['NO_SOURCE', 'FOLLOW_LIST_UNAVAILABLE', 'EMPTY']) {
    assert(new RegExp(`status\\s*===?\\s*['"]${status}['"]`).test(body),
      `the body helper must still branch on status === '${status}' (AC-6: pre-existing empty states unaffected).`);
  }
});

test('R2: /user/:pubkey/notes keeps its pre-existing EMPTY state + copy (AC-6)', () => {
  const src = safeRead(NOTES_PAGE);
  assert(src.length > 0, 'BrainstormUserNotes.jsx missing — unexpected.');
  assert(/EMPTY\s*:\s*["'][^"']*kind-1[^"']*["']/i.test(src),
    'NOTES_COPY.EMPTY ("no kind-1 events could be located") must remain (AC-6).');
  const body = bodyHelper(src, ['renderUserNotesState']);
  assert(/status\s*===?\s*['"]EMPTY['"]/.test(body) || /\bEMPTY\b/.test(body),
    'the EMPTY branch must remain in the body helper (AC-6).');
});

test('R3: filtering is CLIENT-side — the hooks still fetch the same URLs with no mode param (AC-3 no refetch)', () => {
  const feedHook = safeRead(FEED_HOOK);
  const notesHook = safeRead(NOTES_HOOK);
  assert(feedHook.length > 0 && notesHook.length > 0, 'useFeed.js / useUserNotes.js missing — unexpected.');
  assert(/fetch\(\s*['"]\/api\/feed['"]/.test(feedHook),
    "useFeed must still fetch '/api/feed' unchanged (the toggle adds no server param — ADR Option A, rejected Option B).");
  assert(!/mode|include|replies/i.test(feedHook),
    'useFeed must NOT gain a mode/include/replies parameter — filtering happens client-side on the flagged items (ADR Option A).');
  assert(/\/api\/user\/\$\{pubkey\}\/notes\?limit=\$\{limit\}/.test(notesHook),
    'useUserNotes must still fetch /api/user/${pubkey}/notes?limit=${limit} unchanged.');
  assert(!/mode|include|replies/i.test(notesHook),
    'useUserNotes must NOT gain a mode/include/replies parameter (client-side filtering).');
});

test('R4: both read paths still funnel through the SHARED enrichNotes (the isReply inheritance mechanism)', () => {
  const feedRp = safeRead(FEED_READ_PATH);
  const notesRp = safeRead(NOTES_READ_PATH);
  assert(feedRp.length > 0 && notesRp.length > 0, 'read-path modules missing — unexpected.');
  assert(/enrichNotes\s*\(/.test(feedRp) && /require\(['"]\.\.\/_shared\/noteEnrichment['"]\)/.test(feedRp),
    'feedReadPath.js must still call the shared enrichNotes — that is how /api/feed items inherit isReply with NO read-path edit (ADR §Server).');
  assert(/enrichNotes\s*\(/.test(notesRp) && /require\(['"]\.\.\/_shared\/noteEnrichment['"]\)/.test(notesRp),
    'userNotesReadPath.js must still call the shared enrichNotes (same inheritance).');
  assert(!/isReply/.test(feedRp) && !/isReply/.test(notesRp),
    'neither read path may grow its own isReply logic — the rule lives ONCE, in noteEnrichment.js (ADR: one definition, both surfaces).');
});

test('R5: SortToggle itself is unchanged — options/value/onChange contract intact (shared control, other consumers)', () => {
  const src = safeRead(SORT_TOGGLE);
  assert(src.length > 0, 'ui/src/components/SortToggle.jsx missing — unexpected.');
  assert(/\{\s*options,\s*value,\s*onChange,\s*ariaLabel,\s*className\s*\}/.test(src),
    'SortToggle must keep its { options, value, onChange, ariaLabel, className } props — /tag, /tags, and the tagging-activity section consume it.');
  assert(/aria-pressed=\{value === key\}/.test(src),
    'SortToggle must keep the aria-pressed active-state contract.');
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
