/**
 * Tests for Story 1 (epic: tag-event-inspector) — the tag actions menu and the
 * raw event inspector on the tag detail page.
 *
 * Story: engineering-team/stories/tag-event-inspector/1-tag-actions-menu-and-raw-event.md
 * ADR:   engineering-team/decisions/tag-event-inspector/0001-tag-actions-menu-and-raw-event.md
 *
 * TEST LEVEL — source assertion, not runtime render (matching
 * event-tag-note-affordance-ui / note-surfaces-ui / the profile-* UI suites): the
 * Node harness has no JSX transpile and react-dom lives only in the ui/ Vite
 * workspace, so we assert on SOURCE TEXT.
 *
 * WHY THIS SUITE EXISTS AT ALL — it is the half that gates CI. The API contract is
 * asserted at runtime in test/tag-detail.test.js, but that suite is live-HTTP and
 * SKIPS WHOLESALE when the control panel is unreachable, which is exactly CI's
 * stack-free job. So the set-equality whitelist assert there, however load-bearing,
 * gates nothing on a PR. These stack-free source assertions do. Every assert below
 * runs with no stack, no network, and no transpile.
 *
 * REGION-SCOPING (OPEN.md #40, ADR relay-management/0002 Amendment 1) — Tag.jsx and
 * profile-tags/index.js each host many surfaces, and a file-global single-occurrence
 * assert over a shared file is the documented way these suites rot: it silently
 * re-aims at whatever lands first in the file. Assertions here slice to the OWNING
 * region first, and each slicer asserts its start marker exists so a missed marker
 * fails LOUDLY instead of passing vacuously against an empty string.
 *
 * U tests FAIL now and PASS once built. R tests are regression sentinels (additive
 * change → PASS before AND after); they exist to fail on a FUTURE edit, which is
 * their whole job — notably the TA-hardcode sentinel (CLAUDE.md's reference
 * incident for this area) and the D3 placement sentinel.
 *
 * Runtime behaviors source cannot prove — a real click copying a real naddr to a
 * real clipboard, the menu staying open across a select, the panel surviving a
 * Taggings↔Pinned tab switch, 1280px overflow — are Playwright/verify-by-driving
 * work per ADR 0001 §Test strategy layers 2 and 3, not here.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const R = (p) => path.resolve(REPO_ROOT, p);

const TAG_ACTIONS_MENU = R('ui/src/components/TagActionsMenu.jsx');
const NOTE_ACTIONS_MENU = R('ui/src/components/NoteActionsMenu.jsx');
const TAG_PAGE = R('ui/src/pages/Tag.jsx');
const PROFILE_TAGS_API = R('src/api/profile-tags/index.js');

// The seven canonical NIP-01 event fields, in canonical order. Authority: the
// concept graph's own `39998:<TA>:nostr-event` definition (ADR 0001 §Context).
const CANONICAL_EVENT_KEYS = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];

// The kebab glyph: U+22EF MIDLINE HORIZONTAL ELLIPSIS. The literal character the
// emulated menu uses — there is no icon library in this repo.
const KEBAB = '⋯';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function exists(p) { return fs.existsSync(p); }

/**
 * Comment-stripped source, for the NEGATIVE sentinels ("this token must not appear").
 * Without this they fail on prose: the ADR tells the Implementer "Do NOT add a
 * setOpen(false)" and "must not call useConfig().taPubkey", so a conscientious
 * comment recording that rule — `// no setOpen(false) here (D4)` — would trip the
 * very sentinel enforcing it. AC-7 bans a 64-hex CONSTANT, not the mention of one.
 *
 * Deliberately conservative: block comments, plus `//` comments only where they
 * begin a line. A trailing-`//` strip would eat the tail of any line holding a URL
 * ('https://…'), which for a negative assert is a false NEGATIVE — the failure
 * direction that matters. Whole-line comments cannot contain code, so this is safe.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ───────────────────────────── region slicers ───────────────────────────── */

/**
 * `handleTagById`'s own body in src/api/profile-tags/index.js. The file hosts many
 * handlers; `res.json({...})` and `federatedScan(` are not remotely unique in it.
 * The function's nested statements are all indented, so a keyword at column 0
 * cannot match inside the function — it lands on the next top-level declaration.
 */
function handleTagByIdRegion(src) {
  const start = src.indexOf('async function handleTagById');
  assert(start !== -1,
    'handleTagById declaration missing from src/api/profile-tags/index.js — unexpected; ' +
    'the region slicer cannot address the by-id response builder.');
  const rest = src.slice(start + 1);
  const m = rest.search(/\n(async function |function |const |let |module\.exports)/);
  return m === -1 ? src.slice(start) : src.slice(start, start + 1 + m);
}

/** The `toRawEvent` projection's own body — where D1's whitelist is pinned. */
function toRawEventRegion(src) {
  const start = src.search(/function\s+toRawEvent\s*\(/);
  assert(start !== -1,
    'src/api/profile-tags/index.js must declare a `toRawEvent(ev)` helper (ADR 0001 D1) — ' +
    'the 7-field NIP-01 projection the raw panel\'s "as signed" contract rests on.');
  const rest = src.slice(start + 1);
  const m = rest.search(/\n(async function |function |const |let |module\.exports)/);
  return m === -1 ? src.slice(start) : src.slice(start, start + 1 + m);
}

/**
 * The tag page's <header className="bs-tag-header"> block — where AC-1 places the
 * kebab (beside the h1), and nowhere else.
 */
function tagHeaderRegion(src) {
  const start = src.indexOf('<header className="bs-tag-header">');
  assert(start !== -1, '<header className="bs-tag-header"> missing from Tag.jsx — unexpected.');
  const end = src.indexOf('</header>', start);
  assert(end !== -1, 'unterminated bs-tag-header in Tag.jsx — unexpected.');
  return src.slice(start, end);
}

/**
 * The PAGE-LEVEL region D3 reserves for the raw panel: from the header block down
 * to (but excluding) the `bs-tag-rows` tabpanel. The panel must live in here — a
 * sibling of the tab strip, outside every tabpanel.
 *
 * NB the end marker is the className, not `<section className="bs-tag-rows"`: that
 * section's opening tag is multiline in the source, so the combined form would never
 * match and the slicer would silently run to EOF — swallowing the very placement it
 * exists to police.
 */
function pageLevelRegionBeforeRows(src) {
  const start = src.indexOf('<header className="bs-tag-header">');
  assert(start !== -1, '<header className="bs-tag-header"> missing from Tag.jsx — unexpected.');
  const end = src.indexOf('className="bs-tag-rows"');
  assert(end !== -1, 'the bs-tag-rows tabpanel is missing from Tag.jsx — unexpected.');
  assert(end > start, 'bs-tag-rows precedes the tag header in Tag.jsx — unexpected page structure.');
  return src.slice(start, end);
}

/* ─────────────── API: the whitelisted raw event (D1, AC-6) ─────────────── */

t('U: profile-tags API declares a toRawEvent(ev) projection helper', () => {
  const src = safeRead(PROFILE_TAGS_API);
  assert(/function\s+toRawEvent\s*\(/.test(src),
    'src/api/profile-tags/index.js must declare `toRawEvent(ev)` (ADR 0001 D1) — the raw panel\'s ' +
    'contract is "the event as signed", not "whatever the scan leg attached".');
});

t('U: toRawEvent projects all seven canonical NIP-01 fields, in canonical order', () => {
  const region = toRawEventRegion(safeRead(PROFILE_TAGS_API));
  const positions = [];
  for (const key of CANONICAL_EVENT_KEYS) {
    const re = new RegExp(`\\b${key}\\s*:`);
    const at = region.search(re);
    assert(at !== -1, `toRawEvent must project the canonical NIP-01 field \`${key}\` (ADR 0001 D1) — ` +
      'AC-6 forbids any field being omitted.');
    positions.push(at);
  }
  const ordered = positions.every((p, i) => i === 0 || p > positions[i - 1]);
  assert(ordered,
    `toRawEvent must declare the fields in canonical order (${CANONICAL_EVENT_KEYS.join(', ')}) — ` +
    'D1 projects in a declared order so the panel renders canonically rather than inheriting the ' +
    'relay\'s incidental key order, and so the local/remote legs stay diffable.');
});

t('R: toRawEvent whitelists — it never spreads the scanned event (the D1 decision)', () => {
  // The regression this sentinel is armed for: today `{...ev}` would in fact emit
  // clean JSON on both legs (strfry returns exactly 7 fields; nostr-tools attaches
  // `verifiedSymbol`, a Symbol that JSON.stringify silently drops). That cleanliness
  // is ACCIDENTAL — it rests on a third-party implementation detail. A nostr-tools
  // upgrade to a string key, or a new strfry field, would start leaking a
  // non-canonical field into a panel captioned "the raw signed event". Whitelist,
  // never spread.
  const region = stripComments(toRawEventRegion(safeRead(PROFILE_TAGS_API)));
  assert(!/\.\.\.\s*ev\b/.test(region),
    'toRawEvent must NOT spread the scanned event (`...ev`) — ADR 0001 D1 mandates an explicit ' +
    '7-field whitelist. A spread\'s contract is "whatever the scan leg happened to attach", which ' +
    'is not the statement AC-6 makes.');
});

t('U: the by-id response hangs the raw event on tag.rawEvent (so useTagDetail needs no change)', () => {
  const region = handleTagByIdRegion(safeRead(PROFILE_TAGS_API));
  assert(/rawEvent\s*:\s*toRawEvent\s*\(\s*ev\s*\)/.test(region),
    'handleTagById\'s res.json must carry `rawEvent: toRawEvent(ev)` inside its `tag` object ' +
    '(ADR 0001 D1) — nested under `tag` because useTagDetail.js already does setTag(data.tag).');
});

t('R: handleTagById does not spread the scanned event into its response', () => {
  const region = stripComments(handleTagByIdRegion(safeRead(PROFILE_TAGS_API)));
  assert(!/\.\.\.\s*ev\b/.test(region),
    'handleTagById must NOT spread `ev` into the response — the raw event goes through the ' +
    'toRawEvent whitelist (ADR 0001 D1).');
});

t('U: the raw event is projected off a POV-free id lookup (invariant #1 — POV-invariance)', () => {
  // ADR 0001 §Architecture invariants, the reviewer's explicit check. The taggings
  // AROUND a tag are emphatically per-POV; the definition event itself is not — its
  // id is a hash over the bytes the author signed, identical from every POV.
  // POV governs whose assertions COUNT, not what an event SAYS; namespacing here
  // (a rawevent_<8charsuffix> column, a WoT gate) would be a category error.
  const region = handleTagByIdRegion(safeRead(PROFILE_TAGS_API));

  // The definition scan must stay a bare id lookup. NB this scopes to the
  // definition scan rather than the whole handler on purpose: the viewerPin scan
  // later in the same function legitimately takes viewerPubkey and authors (ADR
  // 0009), so a handler-wide token ban would fail on correct code.
  const defScan = region.match(/federatedScan\(\s*\{[^}]*ids:\s*\[\s*tagEventId\s*\][^}]*\}\s*\)/);
  assert(defScan,
    'handleTagById must fetch the definition via federatedScan({ kinds:[39999], ids:[tagEventId] }) — unexpected.');
  assert(!/povSuffix|wotPov|wot_rank|viewerPubkey|authors/.test(defScan[0]),
    'the tag-definition scan must take NO POV input — it is an id lookup (ADR 0001 §Architecture ' +
    'invariants). A signed event is the same event from every point of view.');

  // …and the projection must hang off exactly that result, with no POV in its path.
  // Asserting the line EXISTS first, so this cannot pass vacuously pre-implementation.
  const rawLine = region.split('\n').find((l) => /rawEvent\s*:/.test(l));
  assert(rawLine,
    'handleTagById must project `rawEvent:` off the definition scan result (ADR 0001 D1).');
  assert(!/povSuffix|wotPov|wot_rank|viewerPubkey/.test(rawLine),
    'rawEvent must not be POV-namespaced, POV-filtered, or gated on the viewer (ADR 0001 ' +
    '§Architecture invariants) — reviewer check: no povSuffix/wotPov/viewerPubkey in rawEvent\'s path.');
});

/* ─────────────── TagActionsMenu: the component (D2, AC-1/AC-2) ─────────────── */

t('U: TagActionsMenu component exists as a sibling of NoteActionsMenu', () => {
  assert(exists(TAG_ACTIONS_MENU),
    'ui/src/components/TagActionsMenu.jsx must exist (ADR 0001 D2 — a new sibling, so the shipped ' +
    'feed menu carries zero risk per AC-7).');
});

t('U: TagActionsMenu copies through the shared clipboard helper', () => {
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(/copyText/.test(src),
    'TagActionsMenu must copy via the shared `copyText` helper from ui/src/utils/clipboard.js ' +
    '(ADR 0001 D2 — reused verbatim, not reimplemented).');
});

t('U: TagActionsMenu renders the kebab glyph and the emulated bsp-note-menu markup', () => {
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(src.includes(KEBAB),
    'TagActionsMenu must render the literal ⋯ (U+22EF) glyph — the same character NoteActionsMenu ' +
    'uses; there is no icon library in this repo.');
  assert(/bsp-note-menu/.test(src),
    'TagActionsMenu must reuse the existing bsp-note-menu* CSS classes (ADR 0001 D2/D6) — reusing ' +
    'the classes IS how "emulate" is enforced in CSS, and it guarantees the two kebabs cannot drift.');
});

t('U: TagActionsMenu offers exactly the three specified items, with the user\'s exact labels', () => {
  // AC-2. The labels are the user's own words, settled at Planning (story open
  // question (a)): "Note ID / Note Addr" is idiomatic nostr-speak and is verbatim
  // what the emulated row menu already says. Not to be "improved" here alone —
  // that would put two vocabularies for one operation on a single page.
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(src.includes('Copy Note ID (event id)'),
    'TagActionsMenu must offer the exact label "Copy Note ID (event id)" (AC-2).');
  assert(src.includes('Copy Note Addr'),
    'TagActionsMenu must offer the exact label "Copy Note Addr" (AC-2).');
  assert(src.includes('Show Raw Event') && src.includes('Hide Raw Event'),
    'TagActionsMenu\'s third item must read "Show Raw Event" when hidden and "Hide Raw Event" when ' +
    'shown — the label flips in place (AC-2).');
});

t('U: TagActionsMenu\'s Show/Hide label is driven by rawOpen (flips in place)', () => {
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(/rawOpen\s*\?[\s\S]{0,80}Hide Raw Event[\s\S]{0,40}Show Raw Event/.test(src),
    'the third item\'s label must be driven by the rawOpen prop ({rawOpen ? \'Hide Raw Event\' : ' +
    '\'Show Raw Event\'}) so it flips on the same click that toggles the panel (AC-2, ADR 0001 D4).');
});

t('U: TagActionsMenu exposes the menu a11y contract (accessible name, expanded state, menu roles)', () => {
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(/aria-label=/.test(src), 'the kebab button must expose an accessible name (AC-1).');
  assert(/aria-expanded=/.test(src), 'the kebab button must expose its expanded state (AC-1).');
  assert(/aria-haspopup="menu"/.test(src) && /role="menu"/.test(src),
    'the dropdown must be exposed as a menu (AC-1).');
  assert(/role="menuitem"/.test(src), 'each item must be exposed as a menuitem (AC-1).');
});

t('U: TagActionsMenu renders no dead affordance when the tag has not loaded (AC-1)', () => {
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(/if\s*\(\s*!\s*tag\??\.?\??\.?eventId\s*\)\s*return null/.test(src.replace(/\s+/g, ' ')) ||
         /!tag\?\.eventId[\s\S]{0,30}return null/.test(src),
    'TagActionsMenu must return null when the tag has no eventId (AC-1: "given a tag that has not ' +
    'loaded, no menu renders" — mirroring NoteActionsMenu.jsx:47).');
});

t('U: TagActionsMenu degrades per the emulated convention rather than throwing (AC-6)', () => {
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(/unavailable/i.test(src),
    'TagActionsMenu must follow the emulated menu\'s "<label> unavailable" convention when it ' +
    'cannot produce a value (AC-6) — the item stays, it reports; it is not hidden or disabled.');
});

t('R: TagActionsMenu never closes the dropdown on select (D4 — deliberate emulated parity)', () => {
  // Verified in the emulated component: NoteActionsMenu's ONLY setOpen(false) is
  // its click-outside effect (:30); no select handler closes it. AC-2 codifies
  // this, and it matters most for the Show/Hide item — the label flips in place so
  // the viewer can toggle straight back without reopening.
  const src = safeRead(TAG_ACTIONS_MENU);
  if (!src) throw new Error('ui/src/components/TagActionsMenu.jsx must exist');
  // Strip the click-outside effect, where a setOpen(false) is legitimate and expected.
  const outsideEffect = /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[\s*\]\s*\)\s*;/;
  const handlers = stripComments(src).replace(outsideEffect, '');
  assert(!/setOpen\(\s*false\s*\)/.test(handlers),
    'no select handler may call setOpen(false) — ADR 0001 D4: the menu stays open on select, which ' +
    'is the convention this story exists to emulate. (The click-outside effect may close it; that ' +
    'region is excluded from this assert.)');
});

/* ─── The naddr, and the TA-hardcode sentinel (D5, AC-4, AC-7) ─── */

t('U: TagActionsMenu builds the naddr with nip19.naddrEncode over kind 39999', () => {
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(/nip19/.test(src) && /naddrEncode/.test(src),
    'TagActionsMenu must encode the tag coordinate with nip19.naddrEncode (ADR 0001 D5).');
  assert(/kind:\s*39999/.test(src),
    'the naddr must encode kind 39999 (AC-4). Kind 39999 is inside the 30000–39999 addressable ' +
    'range, so the item is unconditional — do not build a kind-range branch (D5).');
});

t('U: the naddr is encoded from the TAG\'S OWN AUTHOR and its slug — never the TA (AC-4)', () => {
  // The load-bearing assert of the whole naddr path. The canonical coordinate is
  // `39999:${tag.authorPubkey}:${tag.slug}` (publishProfileTag.js:64, ADR-0022).
  // Substituting the TA would emit an address for an event that does not exist:
  // `39999:<TA>:stoicism` is not vinney's tag, so "Copy Note Addr" would yield a
  // dead address on essentially every tag.
  const src = safeRead(TAG_ACTIONS_MENU);
  const call = src.match(/naddrEncode\s*\(\s*\{[\s\S]*?\}\s*\)/);
  assert(call, 'TagActionsMenu must call nip19.naddrEncode({...}) (ADR 0001 D5).');
  assert(/pubkey\s*:\s*[^,}]*authorPubkey/.test(call[0]),
    'naddrEncode\'s `pubkey` MUST come from the tag element\'s own authorPubkey (AC-4/AC-7, ADR 0001 D5) ' +
    '— the tag author is an ordinary user, not the TA.');
  assert(/identifier\s*:\s*[^,}]*slug/.test(call[0]),
    'naddrEncode\'s `identifier` MUST be the tag\'s slug — the d-tag value (AC-4).');
});

t('U: the naddr construction is guarded against malformed data (naddrEncode throws)', () => {
  // Verified signature: naddrEncode calls hexToBytes(addr.pubkey) and
  // utf8Encoder.encode(addr.identifier) — BOTH THROW on malformed/undefined input.
  // A null naddr then flows into the existing doCopy(null, 'Addr') path, which
  // flashes "Addr unavailable" — AC-6's degradation for free (D5).
  const src = safeRead(TAG_ACTIONS_MENU);
  assert(/\[0-9a-f\]\{64\}/.test(src),
    'the naddr build must guard authorPubkey with a /^[0-9a-f]{64}$/ test before encoding (ADR 0001 ' +
    'D5) — mirroring publishProfileTag.js:55, which validates the identical field for the identical ' +
    'coordinate. naddrEncode throws on malformed hex.');
  assert(/try\s*\{[\s\S]*?naddrEncode[\s\S]*?\}\s*catch/.test(src),
    'the naddrEncode call must sit in a try/catch resolving to a null naddr (ADR 0001 D5) — AC-4 ' +
    'says it degrades rather than emitting a wrong or partial address.');
});

t('R: SENTINEL — TagActionsMenu introduces no TA pubkey literal and no TA lookup (AC-7)', () => {
  // THE regression sentinel for this story. CLAUDE.md § "Per-deployment TA pubkey"
  // names the Pin/TL stack's hardcode as the reference incident for this exact area:
  // the signer used the real on-disk TA while readers filtered on a hardcoded
  // literal, so tags.brainstorm.world reported "No TL yet" forever while local dev
  // kept working BY COINCIDENCE (same TA pubkey). The identical coincidence is armed
  // here — a TA-hardcoded naddr would look right on any TA-authored tag.
  //
  // ADR 0015's LEGACY_* exception governs the z-TAG CONCEPT HANDLE
  // (39998:<LEGACY>:tag — a pointer to the concept an event instantiates). This
  // feature composes the A-COORDINATE (39999:<authorPubkey>:<slug> — the address of
  // the element itself). Different kind, different pubkey role, different purpose.
  // The exception does not reach here; this component needs no TA at all.
  const raw = safeRead(TAG_ACTIONS_MENU);
  if (!raw) throw new Error('ui/src/components/TagActionsMenu.jsx must exist');
  const src = stripComments(raw); // AC-7 bans a 64-hex CONSTANT, not the mention of one
  const hex = src.match(/[0-9a-f]{64}/);
  assert(!hex,
    `TagActionsMenu must contain NO 64-hex literal — found "${hex && hex[0]}". The naddr is derived ` +
    'from the event we just fetched (tag.authorPubkey), so it is correct by construction on every ' +
    'deployment. A literal is correct on exactly one machine, by coincidence.');
  assert(!/LEGACY_/.test(src),
    'TagActionsMenu must NOT import LEGACY_TA_PUBKEY / LEGACY_Z_TAG_PUBKEY (AC-7, ADR 0001 D5) — ' +
    'ADR 0015\'s named exception is scoped to the z-tag concept handle, not to this a-coordinate.');
  assert(!/taPubkey|useConfig/.test(src),
    'TagActionsMenu must NOT look up the TA at runtime either (AC-7) — not via useConfig().taPubkey, ' +
    'not at all. The TA is irrelevant to a tag element\'s own address.');
});

t('R: SENTINEL — TagActionsMenu gates on nothing: no authorship check, no login gate', () => {
  // Invariant #2 (decentralized-first) + AC-1. Reflex-check #3 — "could anyone else
  // publish their own version of this?" — answers YES: anyone may publish a
  // kind-39999 tag element, and the live proof is that `stoicism` is authored by
  // vinney, not any TA. So no trust/authorship gate. And inspection is a read over
  // public data, so unlike the login-gated pin row (Tag.jsx:234), no auth gate.
  const raw = safeRead(TAG_ACTIONS_MENU);
  if (!raw) throw new Error('ui/src/components/TagActionsMenu.jsx must exist');
  const src = stripComments(raw);
  assert(!/useAuth|\buser\s*&&|isOwner|wot_rank|wotPov/.test(src),
    'TagActionsMenu must perform no authorship, trust, POV or login check — it receives `tag` and ' +
    'renders (AC-1, ADR 0001 §Architecture invariants #2). Publishing is permissionless; the tag ' +
    'author is arbitrary; and reading a public event is not login-gated.');
});

/* ─────────────── Tag.jsx: wiring and placement (D3, D4, AC-5) ─────────────── */

t('U: Tag.jsx imports and renders <TagActionsMenu> inside the tag header, beside the h1', () => {
  const src = safeRead(TAG_PAGE);
  assert(/import\s+TagActionsMenu|from\s+['"][^'"]*TagActionsMenu/.test(src),
    'Tag.jsx must import TagActionsMenu.');
  const header = tagHeaderRegion(src); // region-scoped: OPEN.md #40
  assert(/<TagActionsMenu\b/.test(header),
    'Tag.jsx must render <TagActionsMenu> INSIDE <header className="bs-tag-header"> (AC-1) — the ' +
    'header is outside every tabpanel, which is what lets the toggle stay reachable from any tab.');
  assert(/bs-tag-name-row/.test(header),
    'the h1 needs the new .bs-tag-name-row flex wrapper (ADR 0001 D6) — .bsp-note-menu floats right ' +
    'via `margin-left:auto`, which only works inside a flex container, and .bs-tag-header is a ' +
    'plain block.');
});

t('U: Tag.jsx owns the rawOpen state, defaulting to hidden, and passes the toggle down (D4, AC-5)', () => {
  const src = safeRead(TAG_PAGE);
  // `rawOpen` is a novel identifier unique to this story, so a file-global assert
  // carries no single-occurrence risk here (contrast the region-scoped asserts above,
  // which address strings Tag.jsx already shares across surfaces).
  assert(/const\s*\[\s*rawOpen\s*,\s*setRawOpen\s*\]\s*=\s*useState\(\s*false\s*\)/.test(src),
    'Tag.jsx must own `const [rawOpen, setRawOpen] = useState(false)` (ADR 0001 D4) — the menu and ' +
    'the panel are siblings, so Tag.jsx is their only common ancestor that can hold shared state. ' +
    'useState(FALSE) is AC-5\'s default-hidden.');
  const header = tagHeaderRegion(src);
  assert(/rawOpen=\{rawOpen\}/.test(header) && /onToggleRaw=\{/.test(header),
    'Tag.jsx must pass rawOpen / onToggleRaw down to <TagActionsMenu> (ADR 0001 D4) — the menu is ' +
    'presentational w.r.t. the panel; two sources of truth would be a bug.');
});

t('U: Tag.jsx renders the raw panel at page level, between the header and the tab strip (AC-5)', () => {
  const region = pageLevelRegionBeforeRows(safeRead(TAG_PAGE)); // region-scoped: OPEN.md #40
  assert(/bs-tag-raw/.test(region),
    'Tag.jsx must render the raw event panel (.bs-tag-raw) in the PAGE-LEVEL region between the tag ' +
    'header and the bs-tag-rows tabpanel (ADR 0001 D3, AC-5).');
  assert(/rawOpen\s*&&/.test(region),
    'the panel must be gated on rawOpen (AC-5: default hidden, governed SOLELY by the toggle).');
  assert(/JSON\.stringify\(\s*tag[?.]*\.rawEvent\s*,\s*null\s*,\s*2\s*\)/.test(region),
    'the panel must render JSON.stringify(tag.rawEvent, null, 2) — the complete signed event as ' +
    'formatted JSON, byte-faithful, nothing summarized (AC-6).');
});

t('U: the raw panel renders nothing when the raw event is absent (AC-6 — no empty panel)', () => {
  const region = pageLevelRegionBeforeRows(safeRead(TAG_PAGE));
  assert(/rawOpen\s*&&\s*tag\??\.?rawEvent|tag\??\.?rawEvent\s*&&/.test(region),
    'the panel must also be conditioned on tag.rawEvent existing (AC-6) — no empty panel that could ' +
    'be misread as "this tag has no definition".');
});

t('R: SENTINEL — the raw panel is NOT nested in the hidden-toggled bs-tag-rows tabpanel (D3)', () => {
  // This is the ADR's FORCED decision and the single reason D3 exists. The naive
  // reading of "above the Profiles|Notes button" puts the panel inside
  // <section className="bs-tag-rows">, because that switch lives inside it. But that
  // section carries hidden={activeTab !== 'default'}. A viewer who opened the panel
  // and switched to the Pinned tab would then see the panel VANISH while the header
  // menu still read "Hide Raw Event" — the exact state AC-5 forbids ("there is no
  // state in which the menu reads 'Hide Raw Event' while no panel is visible").
  // The toggle lives in the always-visible header, so the thing it toggles must too.
  // A future refactor that moves the panel inside must fail here.
  const src = safeRead(TAG_PAGE);
  const rowsIdx = src.indexOf('className="bs-tag-rows"');
  assert(rowsIdx !== -1, 'the bs-tag-rows tabpanel is missing from Tag.jsx — unexpected.');
  const panelIdx = src.indexOf('bs-tag-raw');
  assert(panelIdx !== -1,
    'the raw event panel (.bs-tag-raw) is missing from Tag.jsx entirely (ADR 0001 D3, AC-5).');
  assert(panelIdx < rowsIdx,
    'the raw panel must appear BEFORE the bs-tag-rows tabpanel in source order (ADR 0001 D3) — it ' +
    'is a PAGE-LEVEL sibling of the tab strip. Nested inside bs-tag-rows it inherits ' +
    'hidden={activeTab !== \'default\'} and vanishes on the Pinned tab while the menu still reads ' +
    '"Hide Raw Event" — the state AC-5 explicitly forbids.');
});

t('R: the raw panel sits BELOW the POV status banner (D3 — a tall blob can\'t hide a notice)', () => {
  const src = safeRead(TAG_PAGE);
  const povIdx = src.indexOf('<PovStatusNotice');
  assert(povIdx !== -1, 'PovStatusNotice is missing from Tag.jsx — unexpected.');
  const panelIdx = src.indexOf('bs-tag-raw');
  assert(panelIdx !== -1, 'the raw event panel (.bs-tag-raw) is missing from Tag.jsx.');
  assert(panelIdx > povIdx,
    'the raw panel must be inserted AFTER <PovStatusNotice/> (ADR 0001 D3) — below the banner, so an ' +
    'expanded JSON blob can never push a page-level status notice out of view.');
});

/* ─────────────── AC-7: the shipped feed menu is untouched ─────────────── */

t('R: NoteActionsMenu still exports a default component and keeps its own three items', () => {
  // AC-7, the cheap non-regression sentinel. D2 chose a new sibling component
  // precisely so this file never had to move: it renders on 8 surfaces with no
  // runtime test coverage. A diff that "helpfully" refactors it into a shared shell
  // must fail here — that extraction is deferred to the third menu (D2, _intake.md).
  const src = safeRead(NOTE_ACTIONS_MENU);
  assert(src.length > 0, 'ui/src/components/NoteActionsMenu.jsx must still exist (AC-7).');
  assert(/export default function NoteActionsMenu/.test(src),
    'NoteActionsMenu must still export its default component unchanged (AC-7).');
  for (const label of ['Copy Note Link', 'Copy Note ID (nevent)', 'Copy Note ID (event id)']) {
    assert(src.includes(label),
      `NoteActionsMenu must still render its own item "${label}" — same items, same labels (AC-7).`);
  }
});

t('R: this story adds no item to the feed note menu (AC-7)', () => {
  const src = safeRead(NOTE_ACTIONS_MENU);
  assert(!/Raw Event/.test(src),
    'NoteActionsMenu must NOT gain a raw-event item — raw inspection on note surfaces is explicitly ' +
    'out of scope; this story is the tag definition event on the tag detail page, full stop (AC-7).');
  assert(!/Copy Note Addr/.test(src),
    'NoteActionsMenu must NOT gain a "Copy Note Addr" item (AC-7) — a kind-1 note is not addressable.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- tag actions menu + raw event inspector UI tests (epic tag-event-inspector, Story 1) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntag-actions-menu-ui: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
