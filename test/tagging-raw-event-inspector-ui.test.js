/**
 * Tests for Story 2 (epic: tag-event-inspector) — the raw event inspector for
 * profile taggings on the tag detail page.
 *
 * Story: engineering-team/stories/tag-event-inspector/2-tagging-raw-event-inspector.md
 * ADR:   engineering-team/decisions/tag-event-inspector/0002-tagging-raw-event-inspector.md
 *
 * TEST LEVEL — source assertion, not runtime render. Same reasoning as Story 1's
 * tag-actions-menu-ui suite, and it is worth restating because it is the reason this
 * file exists rather than a Playwright spec:
 *
 *   CI runs `npm ci && npm test` → `node test/test.js`, and NOTHING ELSE
 *   (.github/workflows/test.yml). Playwright is not run by any workflow or skill —
 *   verified by grep; the only references are the role docs that *instruct* writing
 *   specs. That is a RATIFIED deferral, not an oversight: OPEN.md #13 records the
 *   reviewer's call verbatim — "first CI story is stack-free suites ONLY, e2e
 *   deferred" (heavy dep setup + relay-state pollution).
 *
 *   And the live-HTTP half (test/tag-detail.test.js) SKIPS WHOLESALE when the control
 *   panel is unreachable (:268-271 returns {pass:0, fail:0, skipped}) — which is
 *   exactly CI's stack-free job. So it contributes `fail === 0` trivially and gates
 *   NOTHING on a PR, however load-bearing its assertions read.
 *
 * ⇒ These stack-free source assertions are the ONLY automatic gate this story has.
 *   Every assert below runs with no stack, no network, and no transpile.
 *
 * NOTE FOR THE REVIEWER — this weakens one ADR argument, and it should be said out
 * loud rather than discovered later. ADR 0002 D1 lists "testable by the existing node
 * HTTP-contract suite" among the reasons to prefer eager Option A. That is true
 * locally and on staging, but those tests do not gate CI, so the argument carries less
 * than it reads. It does not change D1 — the decisive argument was scan cost (Option B
 * re-scans the whole tag per panel opened), and that stands untouched.
 *
 * REGION-SCOPING (OPEN.md #40, ADR relay-management/0002 Amendment 1) — TagPageRow.jsx,
 * Tag.jsx, styles.css and profile-tags/index.js each host many surfaces, and a
 * file-global single-occurrence assert over a shared file is the documented way these
 * suites rot: it silently re-aims at whatever lands first in the file. Assertions here
 * slice to the OWNING region first, and each slicer asserts its start marker exists so
 * a missed marker fails LOUDLY instead of passing vacuously against an empty string.
 *
 * U tests FAIL now and PASS once built. R tests are regression sentinels (additive
 * change → PASS before AND after); they exist to fail on a FUTURE edit, which is their
 * whole job — notably U9/R7 (the "Tag someone" modal must never gain this affordance,
 * ADR D5) and R6 (assertion data must never reach a published kind-30392 TL).
 *
 * Runtime behaviors source cannot prove — the menu actually closing on click, two rows
 * holding panels open at once, the desktop hover-reveal actually revealing, 1280px
 * overflow — are verify-by-driving work, per ADR 0002 and Story 1's precedent. The
 * test plan names that gap explicitly rather than implying coverage this file lacks.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const R = (p) => path.resolve(REPO_ROOT, p);

const TAG_PAGE_ROW = R('ui/src/components/TagPageRow.jsx');
// Re-aimed per tag-event-inspector ADR 0003 D5 (Story 3, Phase 3): the blocks
// renderer TagRowRawEvents.jsx is promoted to the shared RawTaggingEvents.jsx
// (identical export/props/markup/classes). Path retargeted; assertions unchanged.
const TAG_ROW_RAW_EVENTS = R('ui/src/components/RawTaggingEvents.jsx');
const TAG_SOMEONE_MODAL = R('ui/src/components/TagSomeoneModal.jsx');
const TAG_PAGE = R('ui/src/pages/Tag.jsx');
const TAG_ACTIONS_MENU = R('ui/src/components/TagActionsMenu.jsx');
const PROFILE_TAGS_API = R('src/api/profile-tags/index.js');
const REFRESH_PINNED_TAGS = R('src/api/trustedList/refreshPinnedTags.js');
const STYLES = R('ui/src/styles.css');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

/**
 * Comment-stripped source, for NEGATIVE sentinels ("this token must not appear").
 * Without it they fail on prose: the ADR tells the Implementer "must not import
 * LEGACY_TA_PUBKEY", so a conscientious comment recording that rule would trip the
 * very sentinel enforcing it. The story bans a 64-hex CONSTANT, not the mention of one.
 *
 * Conservative on purpose (block comments + whole-line `//` only): a trailing-`//`
 * strip would eat the tail of any line holding a URL, which for a negative assert is a
 * false NEGATIVE — the failure direction that matters.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ───────────────────────────── region slicers ───────────────────────────── */

/** A top-level function's own body in a JS file. */
function fnRegion(src, re, what, file) {
  const start = src.search(re);
  assert(start !== -1,
    `${what} declaration missing from ${file} — the region slicer cannot address it. ` +
    'If it was renamed, update this test rather than deleting it.');
  const rest = src.slice(start + 1);
  const m = rest.search(/\n(async function |function |const |let |module\.exports)/);
  return m === -1 ? src.slice(start) : src.slice(start, start + 1 + m);
}

/** `renderActionsMarkup`'s body — the Apply/Dispute helper SHARED with the inline row. */
function renderActionsMarkupRegion(src) {
  const start = src.indexOf('const renderActionsMarkup');
  assert(start !== -1,
    'const renderActionsMarkup missing from TagPageRow.jsx — unexpected. This helper is ' +
    'shared by the inline row and the menu; ADR 0002 D6 turns on the raw button staying OUT of it.');
  const end = src.indexOf('\n  const scoresMarkup', start);
  assert(end !== -1, 'scoresMarkup no longer follows renderActionsMarkup in TagPageRow.jsx — slicer needs updating.');
  return src.slice(start, end);
}

/** The `<div className="bs-tag-row-overflow">` block — trigger + menu. */
function overflowRegion(src) {
  const start = src.indexOf('className="bs-tag-row-overflow"');
  assert(start !== -1, 'the bs-tag-row-overflow block is missing from TagPageRow.jsx — unexpected.');
  return src.slice(start);
}

/** A CSS rule body, addressed by exact selector. */
function cssRule(src, selector) {
  const start = src.indexOf(selector + ' {');
  assert(start !== -1,
    `selector \`${selector}\` missing from ui/src/styles.css — the region slicer cannot ` +
    'address the rule it pins. If it was renamed, update this test rather than deleting it.');
  const end = src.indexOf('}', start);
  return src.slice(start, end + 1);
}

/** The `@media (min-width: 769px)` block that governs the wide-viewport kebab. */
function wideMediaRegion(src) {
  const start = src.search(/@media\s*\(min-width:\s*769px\)/);
  assert(start !== -1,
    'the `@media (min-width: 769px)` block is missing from ui/src/styles.css — it is what ' +
    'made the row kebab narrow-only, and ADR 0002 D5/D6 rewrites exactly it.');
  // Balance braces from the media query's opening brace.
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  assert(false, 'unterminated @media (min-width: 769px) block in ui/src/styles.css.');
}

/* ═══════════════════════════ U — must fail now ═══════════════════════════ */

t('U1: a RawTaggingEvents component exists to render the assertion blocks (D3)', () => {
  assert(fs.existsSync(TAG_ROW_RAW_EVENTS),
    'ui/src/components/RawTaggingEvents.jsx must exist (ADR 0002 D3, re-aimed per ADR 0003 D5) — the presentational ' +
    'component that renders one JSON block per assertion, kept out of TagPageRow so the row ' +
    'does not grow ~30 lines of block-rendering.');
});

t('U2: TagPageRow takes a showRawEvent prop, defaulting to false (D5 — the modal gate)', () => {
  const src = safeRead(TAG_PAGE_ROW);
  assert(/showRawEvent\s*=\s*false/.test(src),
    'TagPageRow must accept `showRawEvent = false` in its props destructuring (ADR 0002 D5). ' +
    'Defaulting to FALSE is the whole point: TagSomeoneModal renders this same component and ' +
    'must not opt in, so the safe default has to be off.');
});

t('U3: the menu offers Show Raw Event / Hide Raw Event, label reflecting state (AC-2)', () => {
  const region = overflowRegion(safeRead(TAG_PAGE_ROW));
  assert(/Hide Raw Event/.test(region) && /Show Raw Event/.test(region),
    'the bs-tag-row-overflow block must render BOTH labels (AC-2): "Show Raw Event" when the ' +
    'panel is hidden and "Hide Raw Event" when shown. The label reflects current state.');
});

t('U5: selecting the raw item CLOSES the menu (D4 — the sheet would cover the panel)', () => {
  const region = overflowRegion(safeRead(TAG_PAGE_ROW));
  const btn = region.slice(Math.max(0, region.indexOf('bs-tag-row-raw-btn')));
  assert(region.includes('bs-tag-row-raw-btn'),
    'TagPageRow must render a .bs-tag-row-raw-btn in the overflow menu (ADR 0002 D6).');
  assert(/closeOverflow\(\)/.test(btn.slice(0, 800)),
    'the raw button\'s handler must call closeOverflow() (ADR 0002 D4, story Product decision #1). ' +
    'Under 769px the menu is a position:fixed bottom sheet with a backdrop at inset:0 — leaving it ' +
    'open would sit on top of the very panel the click just opened. This deliberately DIVERGES from ' +
    'TagActionsMenu\'s stays-open convention and follows this component\'s own (Apply/Dispute already ' +
    'pass closeAfter:true) — see the amended epic guardrail.');
});

t('U6: the panel\'s open state is PER ROW, so several can be open at once (AC-3, D3)', () => {
  const src = safeRead(TAG_PAGE_ROW);
  assert(/useState\(false\)/.test(src) && /rawOpen/.test(src),
    'TagPageRow must hold its own `rawOpen` useState (ADR 0002 D3). Per-instance state is what ' +
    'gives AC-3 ("several rows may have panels open at once; opening one does not close another") ' +
    'for free — unlike Story 1, where the menu and panel were siblings and state had to lift to Tag.jsx.');
});

t('U7: the row carries an is-raw-enabled class so the wide CSS can scope to it (D5)', () => {
  const src = safeRead(TAG_PAGE_ROW);
  assert(/is-raw-enabled/.test(src),
    'TagPageRow must add `is-raw-enabled` to its rowClasses when showRawEvent is set (ADR 0002 D5). ' +
    'This class is what scopes the wide-viewport kebab to the tag page WITHOUT touching the base ' +
    '.bs-tag-row-overflow rule the "Tag someone" modal shares.');
});

t('U8: the tag page opts its rows in (D5)', () => {
  const src = safeRead(TAG_PAGE);
  assert(/showRawEvent/.test(src),
    'Tag.jsx must pass `showRawEvent` to its <TagPageRow> (ADR 0002 D5) — the tag detail page is ' +
    'the one surface this story ships on (story decision 3).');
});

t('U14: the API builds row.assertions as {polarity, counted, event} (D1)', () => {
  const region = fnRegion(safeRead(PROFILE_TAGS_API),
    /async function handleProfilesTagged/, 'handleProfilesTagged', 'src/api/profile-tags/index.js');
  assert(/assertions/.test(region),
    'handleProfilesTagged must attach `assertions` to each row (ADR 0002 D1) — the evidence behind ' +
    'the row\'s +N/-M. Today the events are read at :669-685 and thrown away into integer counters.');
  assert(/counted/.test(region),
    'each assertion entry must carry `counted` (ADR 0002 D1). This is what makes AC-4\'s promise exact: ' +
    'count the counted:true blocks and you get the row\'s numbers — even for a viewer whose OWN assertion ' +
    'fails this POV\'s filter on a row that also has trusted ones, where onlyViewerVisible is FALSE (no ' +
    'badge renders) yet the union still lands an extra block under the count.');
  assert(/polarity/.test(region),
    'each assertion entry must carry `polarity` (ADR 0002 D1) — server-emitted, not client-derived, so a ' +
    'future change to bucketize\'s +/-0.5 thresholds cannot silently mis-caption a block as "applied" that ' +
    'the server counted as a dispute.');
});

t('U15: aggregateProfilesTagged hands its WoT predicate to the caller (D2)', () => {
  const region = fnRegion(safeRead(PROFILE_TAGS_API),
    /async function aggregateProfilesTagged/, 'aggregateProfilesTagged', 'src/api/profile-tags/index.js');
  assert(/return\s*\{[^}]*authorAllowed/s.test(region),
    'aggregateProfilesTagged must return `authorAllowed` alongside byTarget/deduped/wotFiltering ' +
    '(ADR 0002 D2). The handler needs the same trust verdict the counts used; re-deriving it there ' +
    'would mean a SECOND meiliFetchProfilesByPubkey over every author, per request, to recompute a ' +
    'predicate this function just built — and two sources of truth for the one question the counts turn on.');
});

t('U17: neutral assertions are excluded from the panel, matching the counts (decision #5)', () => {
  // stripComments is load-bearing here, and its absence is why this test passed
  // VACUOUSLY when first written: the word "neutral" already appears in an existing
  // comment in this region (:965, "the viewer has a non-neutral assertion on this
  // target"), so a bare /neutral/ grep matched prose and proved nothing. Assert the
  // QUOTED LITERAL in comment-stripped source — bucketize returns the string
  // 'neutral', so the builder must compare against it in code, not mention it.
  const region = stripComments(fnRegion(safeRead(PROFILE_TAGS_API),
    /async function handleProfilesTagged/, 'handleProfilesTagged', 'src/api/profile-tags/index.js'));
  assert(/'neutral'/.test(region),
    'the assertions builder must skip neutral assertions (story Product decision #5, ADR 0002 D1). ' +
    'bucketize() calls polarity strictly between -0.5 and +0.5 "neutral", and the counts already skip ' +
    'them (:675). The panel\'s contract is "the events behind THIS ROW\'S NUMBERS", so a neutral event ' +
    'is correctly outside it — otherwise the block count stops reconciling with +N/-M. DELIBERATE: a ' +
    'reviewer must not read this as an oversight.');
});

t('U18: each block shows the assertion\'s AUTHOR PUBKEY (story open question (a))', () => {
  const src = safeRead(TAG_ROW_RAW_EVENTS);
  assert(src, 'ui/src/components/RawTaggingEvents.jsx must exist (see U1).');
  assert(/\.pubkey/.test(src),
    'RawTaggingEvents must render each assertion\'s author pubkey (story open question (a), ADR 0002 ' +
    'Implementation notes). The pubkey is THE BAR: the audience reaching for a raw-event viewer reads ' +
    'pubkeys, and a display name is a claim the event itself does not make. A name may sit BESIDE it; ' +
    'it must never REPLACE it.');
});

t('U19: blocks the counts do not account for are marked (D1 — AC-4 kept honest)', () => {
  const src = safeRead(TAG_ROW_RAW_EVENTS);
  assert(src, 'ui/src/components/RawTaggingEvents.jsx must exist (see U1).');
  assert(/counted/.test(src),
    'RawTaggingEvents must distinguish `counted: false` blocks (ADR 0002 D1). Otherwise a viewer whose ' +
    'own assertion fails this POV\'s filter, on a row that also has trusted assertions, sees THREE blocks ' +
    'under a "+2" with nothing marking which one the number excludes — and onlyViewerVisible is false in ' +
    'that case, so the row badge does not explain it either.');
});

t('U10: the wide-viewport kebab is scoped to is-raw-enabled, sparing the modal (D5)', () => {
  const media = wideMediaRegion(safeRead(STYLES));
  assert(/\.bs-tag-row\.is-raw-enabled\s+\.bs-tag-row-overflow/.test(media),
    'the @media (min-width: 769px) block must override the kebab hide ONLY for ' +
    '`.bs-tag-row.is-raw-enabled .bs-tag-row-overflow` (ADR 0002 D5). Scoping POSITIVELY is what keeps ' +
    'the "Tag someone" modal byte-identical at desktop width — simply deleting the base ' +
    '`.bs-tag-row-overflow { display: none }` would sprout a kebab on the modal\'s rows too.');
  assert(/visibility:\s*hidden/.test(media),
    'the wide-viewport kebab must default to `visibility: hidden`, not `display: none` (ADR 0002 D6). ' +
    'The row\'s established reserved-width no-jiggle invariant (.bs-tag-row-actions { min-width: 9.5rem; ' +
    'visibility: hidden }) means slots hold their width permanently and only toggle visibility — a display ' +
    'toggle would reflow the row on hover, the exact defect that invariant exists to prevent.');
});

t('U11: above 769px the menu carries ONLY the raw item — and leaves the a11y tree (AC-2)', () => {
  const media = wideMediaRegion(safeRead(STYLES));
  assert(/\.bs-tag-row-overflow-menu\s+\.bs-tag-row-scores/.test(media)
      && /\.bs-tag-row-overflow-menu\s+\.bs-tag-row-actions/.test(media),
    'above 769px the menu\'s scores and Apply/Dispute must be hidden (AC-2) — they are already inline on ' +
    'the row at that width, so duplicating them in the menu is redundant. Use `display: none`, NOT ' +
    'visibility: AC-2 says the menu CONTAINS only the raw item, which must be true for a screen reader ' +
    'too, and visibility:hidden leaves nodes in the accessibility tree.');
});

t('U12: the panel wraps onto its own line BELOW its row (AC-3)', () => {
  const rule = cssRule(safeRead(STYLES), '.bs-tag-row-raw');
  assert(/flex-basis:\s*100%/.test(rule),
    '.bs-tag-row-raw must set `flex-basis: 100%` (ADR 0002 D6). .bs-tag-row is `display: flex; ' +
    'flex-wrap: wrap`, so without this the panel lays out as another flex item IN the row instead of ' +
    'below it. This is the in-file precedent .bs-tag-row-error already uses — reuse, do not invent.');
});

t('U13: the raw button floats to the menu\'s right edge (AC-2)', () => {
  const rule = cssRule(safeRead(STYLES), '.bs-tag-row-raw-btn');
  assert(/margin-left:\s*auto/.test(rule),
    '.bs-tag-row-raw-btn must set `margin-left: auto` (AC-2, ADR 0002 D6) — the user asked for it to sit ' +
    'to the right of Dispute but pushed to the right edge of the panel. Same mechanism .bsp-note-menu ' +
    'already uses (styles.css:7551); it requires a flex parent, which .bs-tag-row-overflow-actions provides.');
});

/* ═════════════ R — regression sentinels (pass before AND after) ═════════════ */

t('R7: SENTINEL — the "Tag someone" modal never gains the raw-event affordance (D5)', () => {
  const src = stripComments(safeRead(TAG_SOMEONE_MODAL));
  assert(/<TagPageRow/.test(src), 'TagSomeoneModal must still render <TagPageRow> — unexpected.');
  assert(!/showRawEvent/.test(src),
    'TagSomeoneModal must NOT pass showRawEvent to its <TagPageRow> (story decision 3, ADR 0002 D5).\n' +
    '        THIS IS THE HIGHEST-VALUE SENTINEL IN THIS SUITE. The modal passes the profiles-tagged row ' +
    'object BY REFERENCE for any hit already in the tagged list (TagSomeoneModal.jsx:196, ' +
    '`const row = existingRow || {…}`), so those rows DO carry `assertions`. An implementation that gates ' +
    'the affordance on `row.assertions?.length` instead of on this prop passes every other test in this ' +
    'suite and fails only here.');
});

t('R1: SENTINEL — no TA pubkey literal reaches the row or the panel (AC-6)', () => {
  for (const [file, label] of [[TAG_PAGE_ROW, 'TagPageRow.jsx'], [TAG_ROW_RAW_EVENTS, 'RawTaggingEvents.jsx']]) {
    const src = stripComments(safeRead(file));
    if (!src) continue;   // RawTaggingEvents does not exist yet; U1 owns that failure.
    assert(!/[0-9a-f]{64}/.test(src),
      `${label} must not contain a 64-hex pubkey constant (AC-6, CLAUDE.md § "Per-deployment TA pubkey"). ` +
      'A tagging\'s author is arbitrary runtime data read off the event — this feature needs no TA at all.');
    assert(!/LEGACY_(TA|Z_TAG)_PUBKEY/.test(src),
      `${label} must not import LEGACY_TA_PUBKEY / LEGACY_Z_TAG_PUBKEY (AC-6). ADR-0015's named exception ` +
      'governs z-tag concept-handle composition — a different thing from reading an event\'s author.');
    assert(!/taPubkey/.test(src),
      `${label} must not reach for the runtime TA pubkey either (AC-6). Not "use the helper instead of the ` +
      'literal" — this surface needs NO TA: it displays whoever signed the event.');
  }
});

t('R2: SENTINEL — the assertion scan still unions #e and #a, still federated', () => {
  const region = fnRegion(safeRead(PROFILE_TAGS_API),
    /async function aggregateProfilesTagged/, 'aggregateProfilesTagged', 'src/api/profile-tags/index.js');
  assert(/federatedScan\(/.test(region),
    'aggregateProfilesTagged must stay on federatedScan — it is a browse/visibility surface, so the remote ' +
    'leg must stay (tag-read-union.test.js:151-155 asserts this today; ADR 0002 must not regress it).');
  assert(/'#a'/.test(region) && /'#e'/.test(region),
    'aggregateProfilesTagged must retain BOTH scan legs (profile-tag-hardening/0001): #a spans tag-element ' +
    'versions, #e is legacy provenance. Union, never replace. ADR 0002 only adds a return value.');
});

t('R6: SENTINEL — assertion data can never reach a published kind-30392 TL', () => {
  const src = safeRead(REFRESH_PINNED_TAGS);
  const region = fnRegion(src, /function applyDisputesFunction/, 'applyDisputesFunction',
    'src/api/trustedList/refreshPinnedTags.js');
  assert(/pubkey:\s*entry\.pubkey/.test(region)
      && /endorsements:\s*entry\.applications/.test(region)
      && /disputes:\s*entry\.disputes/.test(region),
    'applyDisputesFunction must keep WHITELISTING {pubkey, endorsements, disputes} out of each byTarget ' +
    'entry rather than spreading it (refreshPinnedTags.js:104-119). This is the one hazard on the shared ' +
    'aggregateProfilesTagged helper: `members` are PUBLISHED inside a signed kind-30392 Trusted List, so a ' +
    '`{...entry}` spread here would start emitting raw assertion events into user-signed events on public ' +
    'relays. ADR 0002 D2 keeps assertions out of byTarget entirely, but this sentinel is the backstop.');
  assert(!/\.\.\.entry/.test(stripComments(region)),
    'applyDisputesFunction must not spread a byTarget entry into a TL member — see above.');
});

t('R3: SENTINEL — Story 1\'s tag-header menu is untouched (AC-6)', () => {
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(src, 'ui/src/components/TagActionsMenu.jsx must still exist (AC-6).');
  for (const item of ['Copy Note ID (event id)', 'Copy Note Addr']) {
    assert(src.includes(item),
      `TagActionsMenu must still offer "${item}" (AC-6) — Story 1's menu is unchanged by this story: ` +
      'same three items, same labels, same behavior.');
  }
  assert(src.includes('Raw Event'),
    'TagActionsMenu must still offer its Show/Hide Raw Event item (AC-6).');
  // NOT asserted here: "the header menu stays open on select". It is already
  // sentineled properly by test/tag-actions-menu-ui.test.js:309, which excludes the
  // click-outside region — TagActionsMenu.jsx:32 legitimately calls setOpen(false)
  // there. A naive file-global !/setOpen\(false\)/ assert (which this test carried
  // when first written) fails against that legitimate line. Duplicating another
  // suite's assertion badly is worse than deferring to it; the convention split
  // between the two menus is recorded in the amended epic guardrail and in U5.
});

t('R4: SENTINEL — Story 1\'s raw <pre> styling survives and is shared, not forked (D6)', () => {
  const rule = cssRule(safeRead(STYLES), '.bs-tag-raw-pre');
  assert(/white-space:\s*pre-wrap/.test(rule) && /word-break:\s*break-all/.test(rule),
    '.bs-tag-raw-pre must keep `pre-wrap` + `break-all` (ADR 0001 D6, reused by ADR 0002 D6). Story 2 ' +
    'renders its blocks with this same class so the two raw-event panels look like one feature rather than ' +
    'two — which also means this rule now protects BOTH from 1280px horizontal overflow: 64-char ids and ' +
    '128-char sigs are unbroken hex with no break opportunity.');
  assert(safeRead(TAG_PAGE).includes('bs-tag-raw-pre'),
    'Tag.jsx must still render .bs-tag-raw-pre for Story 1\'s page-level panel (AC-6).');
});

t('R5: SENTINEL — the row menu\'s Apply/Dispute still close it on success', () => {
  const region = overflowRegion(safeRead(TAG_PAGE_ROW));
  assert(/renderActionsMarkup\(true\)/.test(region),
    'the overflow menu must still call renderActionsMarkup(true) — the `closeAfter: true` that makes a ' +
    'successful Apply/Dispute collapse the sheet (TagPageRow.jsx:339). This is the LOCAL convention that ' +
    'ADR 0002 D4 follows for the raw item; if this regresses, U5\'s justification goes with it.');
});

t('R9: SENTINEL — the raw button stays OUT of renderActionsMarkup (D6)', () => {
  // Classified R, not U, deliberately: it passes vacuously today (nothing is built),
  // passes after a CORRECT build, and fails only on a WRONG one. That is exactly what
  // a sentinel is in this suite's vocabulary, and calling it a U test would have been
  // a lie — a U test that passes before implementation proves nothing about the spec.
  const region = renderActionsMarkupRegion(safeRead(TAG_PAGE_ROW));
  assert(!/Raw Event/.test(region),
    'the Show/Hide Raw Event button must NOT live inside renderActionsMarkup (ADR 0002 D6). ' +
    'That helper is rendered BOTH in the menu and inline on the row (TagPageRow.jsx:294), so a ' +
    'button placed there would (a) become hover-only on desktop and (b) break the reserved-width ' +
    'no-jiggle invariant that .bs-tag-row-actions { min-width: 9.5rem } exists to hold. The ' +
    'tempting-but-wrong implementation is to just append it to that helper — this is the sentinel ' +
    'that catches it.');
});

t('R8: SENTINEL — toRawEvent is reused, never re-declared (D1)', () => {
  const src = safeRead(PROFILE_TAGS_API);
  const decls = (src.match(/function\s+toRawEvent\s*\(/g) || []).length;
  assert(decls === 1,
    `src/api/profile-tags/index.js must declare toRawEvent EXACTLY once (found ${decls}). ADR 0002 D1 ` +
    'reuses Story 1\'s existing projection verbatim. Two copies means two whitelists drifting apart, and ' +
    'the 7-field "as signed" contract is exactly the thing that must not have two definitions.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- tagging raw event inspector UI tests (epic tag-event-inspector, Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-raw-event-inspector-ui: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
