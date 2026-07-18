/**
 * Tests for Story 3 (epic: tag-event-inspector) — the raw tagging-events
 * inspector for a note's tag chips.
 *
 * Story: engineering-team/stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md
 * ADR:   engineering-team/decisions/tag-event-inspector/0003-note-tagging-raw-events-inspector.md
 *
 * TEST LEVEL — source assertion, not runtime render. Story 2's suite split,
 * carried forward explicitly per ADR 0003 Consequences #4:
 *
 *   - THIS file is the stack-free half: runs with no stack, no network, no
 *     transpile — the only automatic gate this story has in CI
 *     (.github/workflows/test.yml runs `npm ci && npm test` and nothing else;
 *     Playwright is a RATIFIED deferral, OPEN.md #13).
 *   - The live half (test/note-tagging-raw-events-inspector-http.test.js) proves
 *     the `for-event` byte contract against a running stack and SKIPS honestly
 *     — {pass:0, fail:0, skipped} — when nak or the control panel is missing,
 *     which is exactly CI's stack-free job. It gates staging/local runs only.
 *
 * REGION-SCOPING (OPEN.md #40): TagChip.jsx, NoteTags.jsx, styles.css and
 * event-tags/index.js each host many surfaces; assertions slice to the OWNING
 * region first, and each slicer asserts its start marker exists so a missed
 * marker fails LOUDLY instead of passing vacuously against an empty string.
 * Negative sentinels AND content positives run over comment-stripped source —
 * the Story-2 lesson (its U17 passed vacuously against prose): the ADR's own
 * suggested comments mention `toRawEvent`, `counted`, and `rawEvents`, so an
 * un-stripped grep would pass on commentary with nothing built.
 *
 * U tests FAIL now and PASS once built. R tests are regression sentinels
 * (additive change → PASS before AND after); they exist to fail on a FUTURE
 * edit — notably R5 (profile chips must never gain the affordance, ADR D4's
 * absent-prop gate) and R6 (the popover must never gain a close-on-select).
 *
 * Runtime behaviors source cannot prove — a panel actually appearing between
 * the note body and the chips row, two chips' panels stacking, the popover
 * surviving the click, the post-open layout shift — are verify-by-driving
 * work; the test plan names that gap explicitly.
 *
 * NOTE (D5 re-aim): the Implementer moves TagRowRawEvents.jsx →
 * RawTaggingEvents.jsx and re-aims Story 2's suite at the new path. This suite
 * asserts the POST-implementation state (new file exists, old file gone,
 * TagPageRow re-aimed), so U1–U3 fail today by design.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const R = (p) => path.resolve(REPO_ROOT, p);

const RAW_TAGGING_EVENTS = R('ui/src/components/RawTaggingEvents.jsx');
const OLD_TAG_ROW_RAW_EVENTS = R('ui/src/components/TagRowRawEvents.jsx');
const TAG_PAGE_ROW = R('ui/src/components/TagPageRow.jsx');
const TAG_CHIP = R('ui/src/components/TagChip.jsx');
const NOTE_TAGS = R('ui/src/components/NoteTags.jsx');
const NOTE_CARD = R('ui/src/components/NoteCard.jsx');
const PROFILE_TAGS_SECTION = R('ui/src/components/ProfileTagsSection.jsx');
const TAG_A_NOTE_MODAL = R('ui/src/components/TagANoteModal.jsx');
const USE_EVENT_TAGS = R('ui/src/hooks/useEventTags.js');
const EVENT_TAGS_API = R('src/api/event-tags/index.js');
const PROFILE_TAGS_API = R('src/api/profile-tags/index.js');
const STYLES = R('ui/src/styles.css');
const INTAKE = R('engineering-team/stories/_intake.md');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

/**
 * Comment-stripped source. Conservative (block comments + whole-line `//`
 * only), same helper as the Story-1/2 suites: a trailing-`//` strip would eat
 * URL tails, which for a negative assert is a false NEGATIVE — the failure
 * direction that matters.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ───────────────────────────── region slicers ───────────────────────────── */

/** A top-level function's own body in a JS file (decl at column 0). */
function fnRegion(src, re, what, file) {
  const start = src.search(re);
  assert(start !== -1,
    `${what} declaration missing from ${file} — the region slicer cannot address it. ` +
    'If it was renamed, update this test rather than deleting it.');
  const rest = src.slice(start + 1);
  const m = rest.search(/\n(async function |function |const |let |module\.exports)/);
  return m === -1 ? src.slice(start) : src.slice(start, start + 1 + m);
}

/** TagChip's popover subtree — where the raw button and notice must live. */
function popoverRegion(src) {
  const start = src.indexOf('className="ptc-popover"');
  assert(start !== -1,
    'className="ptc-popover" missing from TagChip.jsx — the popover region slicer cannot ' +
    'address the subtree AC-1 puts the button in. If the class was renamed, update this test.');
  const end = src.indexOf('if (!showScores)');
  assert(end !== -1 && end > start,
    'the `if (!showScores) return chip;` line no longer follows the popover in TagChip.jsx — ' +
    'slicer needs updating (it is the stable end-of-chip marker ADR 0013 left in place).');
  return src.slice(start, end);
}

/** The raw button's own JSX block: from the onToggleRaw gate to its </button>. */
function rawButtonBlock(popRegion) {
  const start = popRegion.indexOf('{onToggleRaw');
  assert(start !== -1,
    'TagChip\'s popover must gate the raw button on the onToggleRaw prop — `{onToggleRaw` not ' +
    'found (ADR 0003 D4: the button renders ONLY when the prop is passed; ProfileTagsSection ' +
    'passes nothing, which is what keeps profile chips byte-identical).');
  const end = popRegion.indexOf('</button>', start);
  assert(end !== -1, 'the onToggleRaw block never closes a <button> — unexpected markup.');
  return popRegion.slice(start, end);
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

/** The 2026-07-16 <RawEventPanel> intake entry (heading → next `## ` or EOF). */
function intakeRawEventPanelRegion(src) {
  const start = src.indexOf('## 2026-07-16 — Cleanup: extract a shared `<RawEventPanel>`');
  assert(start !== -1,
    'the 2026-07-16 <RawEventPanel> entry is missing from engineering-team/stories/_intake.md — ' +
    'ADR 0003 D5 discharges exactly that entry; if it was reworded, update this slicer.');
  const next = src.indexOf('\n## ', start + 1);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

/* ═══════════════════ U — must fail now, pass once built ═══════════════════ */

/* ── D5: the shared blocks component (the intake trigger, fired) ── */

t('U1: RawTaggingEvents.jsx exists — the shared blocks renderer (D5)', () => {
  assert(fs.existsSync(RAW_TAGGING_EVENTS),
    'ui/src/components/RawTaggingEvents.jsx must exist (ADR 0003 D5): TagRowRawEvents promoted ' +
    'to the shared component — same default export, same {assertions} props, same markup and ' +
    'class names byte-for-byte. The third inspection surface fired the _intake.md trigger.');
});

t('U2: TagRowRawEvents.jsx is GONE — a rename, not a third copy (D5)', () => {
  assert(!fs.existsSync(OLD_TAG_ROW_RAW_EVENTS),
    'ui/src/components/TagRowRawEvents.jsx must be DELETED (ADR 0003 D5). Keeping it beside ' +
    'RawTaggingEvents.jsx would ship the very copy the extraction exists to prevent — two ' +
    'renderers of "the event as signed" drifting apart.');
});

t('U3: TagPageRow re-aims its import at the shared component (D5)', () => {
  const src = stripComments(safeRead(TAG_PAGE_ROW));
  assert(/from\s+['"]\.\/RawTaggingEvents['"]/.test(src),
    'TagPageRow.jsx must import from \'./RawTaggingEvents\' (ADR 0003 D5) — the one line of ' +
    'Story-2 surface this story touches.');
  assert(!/TagRowRawEvents/.test(src),
    'TagPageRow.jsx must carry NO remaining TagRowRawEvents reference (import or JSX) — the ' +
    're-aim is a rename, and a stale reference means the old component survived somewhere.');
});

t('U4: the shared component renders the Story-2 blocks verbatim — classes, marker, pubkey, byte-faithful <pre> (D5, AC-3)', () => {
  const src = safeRead(RAW_TAGGING_EVENTS);
  assert(src, 'ui/src/components/RawTaggingEvents.jsx must exist (see U1).');
  assert(/function RawTaggingEvents\s*\(\s*\{\s*assertions\s*\}\s*\)/.test(src),
    'RawTaggingEvents must keep the exact prop contract: a default-exported function taking ' +
    '{ assertions } — [{polarity, counted, event}] (ADR 0002 envelope, reused by ADR 0003 D3).');
  for (const cls of ['bs-tag-row-raw-list', 'bs-tag-row-raw-block', 'bs-tag-row-raw-caption',
    'bs-tag-row-raw-polarity', 'bs-tag-row-raw-author', 'bs-tag-row-raw-uncounted', 'bs-tag-raw-pre']) {
    assert(src.includes(cls),
      `RawTaggingEvents must keep the class \`${cls}\` byte-for-byte (ADR 0003 D5): identical ` +
      'class names are what make AC-6\'s behavior-unchanged bar CHECKABLE on the Story-2 surface. ' +
      'The bs-tag-row-* naming on a non-row surface is recorded cosmetic debt — keep it.');
  }
  assert(src.includes('not counted under this POV'),
    'RawTaggingEvents must keep the verbatim "not counted under this POV" marker (AC-3): a ' +
    'viewer-own-but-uncounted block with no marker breaks the count-the-blocks promise silently.');
  assert(/\.pubkey/.test(src),
    'RawTaggingEvents must render each event\'s author pubkey (AC-3, story decision 6): the ' +
    'pubkey is the bar; a display name is a claim the event does not make.');
  assert(/JSON\.stringify\(\s*a\.event\s*,\s*null\s*,\s*2\s*\)/.test(src),
    'RawTaggingEvents must render the event via JSON.stringify(a.event, null, 2) into the ' +
    'shared <pre> — formatted, readable, byte-faithful, no field summarized (AC-3).');
});

t('U5: NoteTags consumes the shared component for its panels (D3/D5)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  assert(/from\s+['"]\.\/RawTaggingEvents['"]/.test(src),
    'NoteTags.jsx must import RawTaggingEvents (ADR 0003 D5) — the note panel is the second ' +
    'consumer; a local re-implementation of the blocks would be the copy D5 exists to prevent.');
  assert(/<RawTaggingEvents/.test(src),
    'NoteTags.jsx must render <RawTaggingEvents> inside each panel (ADR 0003 D4/D5).');
});

/* ── AC-1: the button, in the popover ── */

t('U6: the popover offers Show/Hide Raw Tagging Events, label driven by rawOpen (AC-1)', () => {
  const region = popoverRegion(stripComments(safeRead(TAG_CHIP)));
  assert(region.includes('Show Raw Tagging Events') && region.includes('Hide Raw Tagging Events'),
    'TagChip\'s popover must render BOTH labels (AC-1): "Show Raw Tagging Events" when the ' +
    'chip\'s panel is hidden, "Hide Raw Tagging Events" when shown. The exact pluralized ' +
    'wording is an operator decision (story Product decision #2) — a chip aggregates N+M ' +
    'events, and "Tagging" disambiguates from the note\'s own JSON and the tag\'s definition.');
  assert(/rawOpen\s*\?/.test(region),
    'the label must be driven by the rawOpen prop (AC-1: "the label reflects the panel\'s ' +
    'actual current state") — a rawOpen ternary, not popover-local state: after the post-open ' +
    'layout shift closes the popover via cursor-leave, re-hovering must show "Hide".');
});

t('U7: the button renders ONLY when onToggleRaw is passed (D4 — the absent-prop gate)', () => {
  // rawButtonBlock's own start-marker assert IS this test: `{onToggleRaw` gating the button.
  const block = rawButtonBlock(popoverRegion(stripComments(safeRead(TAG_CHIP))));
  assert(/aria-expanded/.test(block),
    'the raw button must carry aria-expanded (ADR 0003 D4) — it toggles a panel rendered ' +
    'elsewhere in the card, so the expanded state must be exposed to the accessibility tree.');
});

t('U8: the raw button has NO login gate — enabled signed out (AC-1)', () => {
  const block = rawButtonBlock(popoverRegion(stripComments(safeRead(TAG_CHIP))));
  assert(!/disabled/.test(block),
    'the raw button must carry NO disabled attribute (AC-1: "present and enabled whether or ' +
    'not the viewer is signed in — inspection has no login gate"). Apply/Dispute keep theirs ' +
    '(R7); copying their disabled={busy || !viewerPubkey} onto this button is the tempting ' +
    'wrong move this test exists to catch.');
  assert(!/viewerPubkey/.test(block),
    'the raw button must not condition on viewerPubkey at all (AC-1) — inspection is not ' +
    'login-gated, consistent with Stories 1–2.');
});

t('U9: a per-chip rawNotice renders via the ptc-hint idiom, inside the popover (AC-4)', () => {
  const region = popoverRegion(stripComments(safeRead(TAG_CHIP)));
  assert(/\{rawNotice\s*&&/.test(region),
    'TagChip must render a rawNotice when the prop is set (ADR 0003 D6): when a chip\'s events ' +
    'cannot be produced, the toggle yields a visible message INSTEAD of a panel — never a ' +
    'panel that could read as "nobody asserted this" (AC-4).');
  const noticeIdx = region.indexOf('{rawNotice');
  assert(region.slice(noticeIdx, noticeIdx + 300).includes('ptc-hint'),
    'the rawNotice must use the existing .ptc-hint idiom (ADR 0003 D6) — the popover\'s ' +
    'established hint styling, not a new notice class.');
});

/* ── AC-2: placement, per-chip toggle, stacking ── */

t('U10: NoteTags owns a per-coordinate Set of open panels (AC-2, D4)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  assert(/openRaw/.test(src) && /new Set\(\)/.test(src),
    'NoteTags must hold `openRaw` as a Set of tag coordinates (ADR 0003 D4). Per-instance ' +
    'state gives per-note isolation for free (opening a panel on one note never affects ' +
    'another), and a Set gives multi-open stacking (several chips\' panels at once, AC-2).');
  assert(/openRaw\.has\(/.test(src),
    'panel visibility must be coordinate membership in openRaw (`openRaw.has(...)`) — the ' +
    'toggle is per (note, tag), keyed by the stable `${authorPubkey}:${slug}` coordinate ' +
    '(t.eventId can be a synthesized fallback for mine-only chips, so it is NOT the key).');
});

t('U11: panels render between PovStatusNotice and the chips row (AC-2 — the mandated slot)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  const notice = src.lastIndexOf('<PovStatusNotice');
  assert(notice !== -1, '<PovStatusNotice> JSX missing from NoteTags.jsx — unexpected; the slot is defined relative to it.');
  const panel = src.indexOf('bsp-note-tags-raw');
  assert(panel !== -1,
    'NoteTags must render a .bsp-note-tags-raw panel wrapper (ADR 0003 D6): new classes in the ' +
    'note-tags namespace ONLY — no shared class modified.');
  const row = src.indexOf('"bsp-note-tags-row"');
  assert(row !== -1, 'the .bsp-note-tags-row chips row is missing from NoteTags.jsx — unexpected.');
  assert(notice < panel && panel < row,
    'the panels must sit BETWEEN <PovStatusNotice/> and the .bsp-note-tags-row chips row in ' +
    'JSX order (AC-2: "inside that note\'s card, below the note\'s content and above the chips ' +
    `row"). Found: PovStatusNotice@${notice}, panel@${panel}, chips-row@${row}.`);
});

t('U12: panels stack in the chips\' display order — displayedTags filtered on openRaw (AC-2)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  assert(/displayedTags\s*\.\s*filter\([^)]*openRaw\.has/.test(src),
    'the panels must be produced by mapping displayedTags filtered on openRaw (ADR 0003 D4): ' +
    'displayedTags IS the chips\' display order, so stacking order is correct by construction ' +
    'rather than by a second sort that could drift.');
});

t('U13: each panel is captioned with the tag\'s name (AC-2 — attributable when stacked)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  assert(/bsp-note-tags-raw-caption/.test(src),
    'each panel must carry a .bsp-note-tags-raw-caption (ADR 0003 D4/D6).');
  const capIdx = src.indexOf('bsp-note-tags-raw-caption');
  assert(/\{t\.name\}/.test(src.slice(capIdx, capIdx + 200)),
    'the caption must include the tag\'s name ({t.name}) so a panel stays attributable when ' +
    'several stack on one note (AC-2). Exact caption wording is Director-delegated minutiae; ' +
    'the NAME being present is the AC.');
});

t('U14: NoteTags threads the three raw props to its chips — and only NoteTags (D4)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  for (const prop of ['rawOpen={', 'onToggleRaw={', 'rawNotice={']) {
    assert(src.includes(prop),
      `NoteTags must pass \`${prop}...}\` to <TagChip> (ADR 0003 D4) — the surface opts IN by ` +
      'passing the props (ADR 0002 D5\'s explicit-prop-gate lesson: gate on the surface\'s ' +
      'intent, never on data presence). ProfileTagsSection passes nothing (R5).');
  }
});

/* ── AC-3: composition — every event behind the counts, faithfully ── */

t('U15: counted = channel membership; the viewer joins via mineEventId, deduped (AC-3, D3)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  assert(/counted:\s*true/.test(src) && /counted:\s*false/.test(src),
    'NoteTags\' composition must label blocks by which server channel the entry rode in on — ' +
    'applications/disputes → counted: true, mine-and-not-already-counted → counted: false ' +
    '(ADR 0003 D3). The client classifies NOTHING: re-deriving trust or polarity from event ' +
    'bytes client-side is the drift hazard ADR 0002 D1 flagged.');
  assert(/mineEventId/.test(src),
    'the viewer\'s own block must join on mineEventId (ADR 0003 D3): on an enriched mine entry ' +
    '`eventId` is the TAG element\'s id from the available-tags join (useEventTags.js:92) — ' +
    'joining on it would look up the wrong bytes. This is the one rename trap on this path.');
  assert(/\.some\(/.test(src),
    'the viewer\'s own entry must be added only when not already among the counted entries ' +
    '(a .some(...) dedupe by event id, ADR 0003 D3) — a trusted viewer\'s event appears ONCE, ' +
    'counted: true, or the block count stops reconciling with the popover\'s numbers.');
});

t('U16: blocks sort apply-first, then created_at desc, then id — a total order (AC-3)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  assert(/'apply'/.test(src) && /created_at/.test(src) && /localeCompare/.test(src),
    'the composed blocks must be sorted by Story 2\'s total order, reused verbatim (ADR 0003 ' +
    'D3): polarity group (applications first), then event.created_at descending, then event.id ' +
    'lexicographic — applied client-side AFTER composition, so the panel\'s order never ' +
    'depends on strfry\'s incidental output order (AC-3 "stable deterministic order").');
});

t('U17: a chip with ANY missing bytes gets no panel — all-or-nothing (AC-4, D6)', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  assert(/\.some\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*!\s*\1\.event\s*\)/.test(src),
    'the composition must withhold the WHOLE panel when any referenced id is missing from ' +
    'rawEvents (a some(b => !b.event) guard, ADR 0003 D6). A partial panel breaks AC-3\'s ' +
    'count-back SILENTLY; the notice breaks it LOUDLY — the only honest option for an ' +
    'inspector. Reachable only via deploy skew or a regression, but the guard must exist.');
});

/* ── AC-3 server side: the rawEvents byte channel ── */

t('U18: toRawEvent is EXPORTED from profile-tags — one definition of "as signed" (D2)', () => {
  const src = safeRead(PROFILE_TAGS_API);
  const exportsIdx = src.indexOf('module.exports');
  assert(exportsIdx !== -1, 'module.exports missing from src/api/profile-tags/index.js — unexpected.');
  assert(/toRawEvent/.test(src.slice(exportsIdx)),
    'src/api/profile-tags/index.js must export toRawEvent (ADR 0003 D2): the 7-field whitelist ' +
    'is the one shared definition of "the event as signed" across both inspection APIs. ' +
    'Re-declaring it in event-tags would be two whitelists drifting apart (Story 2 R8\'s ' +
    'argument, extended across modules).');
});

t('U19: event-tags REQUIRES the shared projection from ../profile-tags (D2)', () => {
  const src = stripComments(safeRead(EVENT_TAGS_API));
  assert(/\{\s*toRawEvent\s*\}\s*=\s*require\(['"]\.\.\/profile-tags['"]\)/.test(src),
    'src/api/event-tags/index.js must `const { toRawEvent } = require(\'../profile-tags\')` ' +
    '(ADR 0003 D2). No cycle: profile-tags never requires event-tags, and the precedent is ' +
    'the aggregateTagPins require at index.js:541.');
});

t('U20: handleForEvent serves a rawEvents side-table built with toRawEvent (D1/D2)', () => {
  const region = fnRegion(stripComments(safeRead(EVENT_TAGS_API)),
    /async function handleForEvent/, 'handleForEvent', 'src/api/event-tags/index.js');
  assert(/toRawEvent\(/.test(region),
    'handleForEvent must project candidates through the shared toRawEvent(...) (ADR 0003 D2) — ' +
    'a whitelist call, never a spread: the response now carries signed events, and the ' +
    'projection is the contract that keeps stray scan-leg fields out of "the event as signed".');
  assert(/rawEvents/.test(region),
    'handleForEvent must build a `rawEvents` map — { [eventId]: 7-field projection }, keyed by ' +
    'exactly the ids referenced by tags[].applications ∪ disputes ∪ mine (ADR 0003 D2). The ' +
    'classifier\'s output already names the events behind the numbers; the handler serves ' +
    'their bytes. (Exact key-set semantics are proven by the live HTTP suite.)');
  assert(/res\.json\([\s\S]{0,400}?rawEvents/.test(region),
    'the response object must include rawEvents — always present (possibly {}), the "always ' +
    'assign" convention: 0 B increment for untagged notes, additive and invisible to ' +
    'TagANoteModal and every existing test (no suite pins the response\'s key set — verified).');
});

t('U21: useEventTags carries rawEvents through to consumers (D2→D3 seam)', () => {
  const src = stripComments(safeRead(USE_EVENT_TAGS));
  assert(/forEvent\.rawEvents/.test(src),
    'useEventTags must read forEvent.rawEvents off the response (ADR 0003 implementation ' +
    'notes) — beside setTags/setMine, reset in the !eventId branch.');
  assert(/return\s*\{[^}]*rawEvents/.test(src),
    'useEventTags must RETURN rawEvents so NoteTags can join entry ids to bytes (ADR 0003 D3). ' +
    'povParams is already in the effect deps, so a POV switch re-derives the whole snapshot — ' +
    'nothing per-POV is stored (CLAUDE.md invariant #3).');
});

/* ── AC-6 / D6: styling ── */

t('U22: the panel\'s new classes exist in the note-tags namespace (D6)', () => {
  const css = safeRead(STYLES);
  cssRule(css, '.bsp-note-tags-raw');          // asserts presence, loudly
  cssRule(css, '.bsp-note-tags-raw-caption');  // asserts presence, loudly
});

/* ── D5: the intake trigger is discharged ── */

t('U23: the _intake.md <RawEventPanel> entry is flipped to DONE, pointing at ADR 0003 (D5)', () => {
  const region = intakeRawEventPanelRegion(safeRead(INTAKE));
  assert(/\*\*DONE\*\*/.test(region),
    'the 2026-07-16 <RawEventPanel> intake entry must carry a **DONE** marker (ADR 0003 D5: ' +
    '"the Implementer flips it to DONE with a pointer here") — the intake convention is a bold ' +
    'status marker under the heading (cf. **PICKED UP** / **RESOLVED** on older entries).');
  assert(/0003/.test(region),
    'the DONE marker must point at ADR 0003 (tag-event-inspector) so the discharge is ' +
    'traceable — including the deliberate Story-1 exclusion (the definition panel is the ' +
    'revealed outlier; its shared parts are toRawEvent and .bs-tag-raw-pre, not the blocks).');
});

/* ═════════════ R — regression sentinels (pass before AND after) ═════════════ */

t('R1: SENTINEL — no TA pubkey literal reaches the chip, the panel, or the composition (AC-6)', () => {
  for (const [file, label] of [[NOTE_TAGS, 'NoteTags.jsx'], [TAG_CHIP, 'TagChip.jsx'],
    [RAW_TAGGING_EVENTS, 'RawTaggingEvents.jsx'], [USE_EVENT_TAGS, 'useEventTags.js']]) {
    const src = stripComments(safeRead(file));
    if (!src) continue; // RawTaggingEvents does not exist yet; U1 owns that failure.
    assert(!/[0-9a-f]{64}/.test(src),
      `${label} must not contain a 64-hex pubkey constant (AC-6, CLAUDE.md § "Per-deployment ` +
      'TA pubkey"). A tagging\'s author is arbitrary runtime data read off the event — this ' +
      'feature needs no TA at all.');
    assert(!/LEGACY_(TA|Z_TAG)_PUBKEY/.test(src),
      `${label} must not import LEGACY_TA_PUBKEY / LEGACY_Z_TAG_PUBKEY (AC-6). ADR-0015's ` +
      'named exception governs z-tag concept-handle composition in the write path — a ' +
      'different thing from displaying an event\'s author.');
    assert(!/taPubkey/.test(src),
      `${label} must not reach for the runtime TA pubkey either (AC-6). Not "use the helper ` +
      'instead of the literal" — this surface needs NO TA: it displays whoever signed.');
  }
});

t('R2: SENTINEL — event-tags keeps exactly ONE 64-hex literal: CANONICAL_AUTHORITY, verbatim (AC-6)', () => {
  const src = safeRead(EVENT_TAGS_API);
  assert(src.includes("const CANONICAL_AUTHORITY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'"),
    'the CANONICAL_AUTHORITY declaration must survive verbatim (ADR 0003 citation hygiene): it ' +
    'is an ADR-0004 default honored authority in ADR-0015\'s lineage, read through and never ' +
    'touched. A diff adding, removing, or rewriting it must be rejected.');
  const hexes = (stripComments(src).match(/[0-9a-f]{64}/g) || []).length;
  assert(hexes === 1,
    `src/api/event-tags/index.js must contain exactly ONE 64-hex literal (found ${hexes}). ` +
    'The rawEvents diff introduces no pubkey literal of any kind — authors, ids, and bytes ' +
    'are runtime data off the events (AC-6).');
});

t('R3: SENTINEL — the other read paths never grow raw-event bytes (D2 — core + siblings untouched)', () => {
  const src = stripComments(safeRead(EVENT_TAGS_API));
  for (const [re, what] of [
    [/async function aggregateNotesTagged/, 'aggregateNotesTagged'],
    [/async function handleForTag/, 'handleForTag'],
    [/async function handleTagIndex/, 'handleTagIndex'],
    [/async function handleNotesByAuthor/, 'handleNotesByAuthor'],
  ]) {
    const region = fnRegion(src, re, what, 'src/api/event-tags/index.js');
    assert(!/rawEvents|toRawEvent/.test(region),
      `${what} must NOT gain rawEvents/toRawEvent (ADR 0003 D2 "Do not touch"). ` +
      'aggregateNotesTagged feeds the TA-signed note Trusted List — event BYTES leaking there ' +
      'would publish raw assertion events inside a user-signed kind-30392 on public relays ' +
      '(the Story-2 R6 hazard, one epic over). The side-table lives in handleForEvent ONLY.');
  }
});

t('R4: SENTINEL — TagANoteModal never consumes the byte channel', () => {
  const src = stripComments(safeRead(TAG_A_NOTE_MODAL));
  assert(src, 'ui/src/components/TagANoteModal.jsx must still exist — unexpected.');
  assert(!/rawEvents/.test(src),
    'TagANoteModal must not reference rawEvents (ADR 0003 out-of-scope). It calls for-event ' +
    'and reads only j.tags — the additive field must stay invisible to it; if it ever wants ' +
    'bytes, that is the ?rawEvents=0 opt-out conversation (Consequences #1), not a drive-by.');
});

t('R5: SENTINEL — profile pages\' own tag chips gain NO raw-event affordance (AC-6, D4)', () => {
  const src = stripComments(safeRead(PROFILE_TAGS_SECTION));
  assert(/<TagChip/.test(src), 'ProfileTagsSection must still render <TagChip> — unexpected.');
  assert(!/rawOpen|onToggleRaw|rawNotice/.test(src),
    'ProfileTagsSection must NOT pass rawOpen/onToggleRaw/rawNotice (AC-6: profile chips are ' +
    'byte-identical; the profile-tagging family\'s inspector is a deliberately deferred fourth ' +
    'surface). THIS IS THE HIGHEST-VALUE SENTINEL IN THIS SUITE: an implementation that ' +
    'renders the button whenever the chip HAS applications/disputes — gating on data presence ' +
    'instead of the onToggleRaw prop — passes every U test above and fails only here, because ' +
    'profile chips carry those same arrays.');
});

t('R6: SENTINEL — the popover\'s close conventions are untouched: no close-on-select (AC-2)', () => {
  const src = stripComments(safeRead(TAG_CHIP));
  const closes = (src.match(/setOpen\(false\)/g) || []).length;
  assert(closes === 4,
    `TagChip.jsx must contain exactly 4 setOpen(false) call sites (found ${closes}): ` +
    'click-outside, Escape, mouseleave, blur-outside — the popover\'s own conventions. The raw ' +
    'button adds NO close call (AC-2; story Product decision #3): Story 2\'s close-on-select ' +
    'was a bottom sheet\'s convention, and this hover popover has the opposite one. The ' +
    'post-open layout shift closing it via cursor-leave is a documented composition of two ' +
    'mandated behaviors (ADR 0003 D4) — not a license to add or remove close calls.');
  assert(/onMouseLeave=\{\(\) => setOpen\(false\)\}/.test(src),
    'cursor-leave must still close the popover (AC-2 — hover behavior unchanged).');
  assert(/'Escape'/.test(src), 'Escape must still close the popover (AC-2).');
  assert(/relatedTarget/.test(src), 'the blur-outside close must survive (AC-2 — focus behavior unchanged).');
});

t('R7: SENTINEL — Apply and Dispute keep their login gate (AC-1/AC-6)', () => {
  const src = stripComments(safeRead(TAG_CHIP));
  const gated = (src.match(/disabled=\{busy \|\| !viewerPubkey\}/g) || []).length;
  assert(gated === 2,
    `TagChip must keep exactly 2 buttons gated with disabled={busy || !viewerPubkey} — Apply ` +
    `and Dispute (found ${gated}). AC-1 removes the gate from INSPECTION only; loosening the ` +
    'write actions\' gate (or extending it to a third button) is a behavior change.');
});

t('R8: SENTINEL — the affordance rides the shared card: NoteTags in NoteCard, chips shared by exactly two surfaces (AC-5)', () => {
  assert(/<NoteTags/.test(safeRead(NOTE_CARD)),
    'NoteCard must still render <NoteTags> (ADR 0006) — the shared unit is what makes AC-5 ' +
    'STRUCTURAL: feed, /event, tag-page Notes tab, and profile notes all inherit the panel ' +
    'from one place. Per-page wiring would make the same popover honest on one surface and ' +
    'opaque on the next — the exact split the story rules out.');
  // Every TagChip importer, recursively — the affordance must not be wired per-page.
  const importers = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(jsx|js)$/.test(name) && /from\s+['"][^'"]*\/TagChip['"]/.test(safeRead(p))) importers.push(name);
    }
  })(R('ui/src'));
  importers.sort();
  assert(importers.length === 2 && importers[0] === 'NoteTags.jsx' && importers[1] === 'ProfileTagsSection.jsx',
    `TagChip must be imported by exactly NoteTags.jsx + ProfileTagsSection.jsx (found: ` +
    `${importers.join(', ') || 'none'}). A third importer means a new chip surface whose raw-` +
    'affordance stance was never decided — that needs a story, not a drive-by (ADR 0003: ' +
    '"its prop changes must consider both importers").');
});

t('R9: SENTINEL — the shared CSS this feature leans on survives unmodified (AC-6, D6)', () => {
  const css = safeRead(STYLES);
  const hint = cssRule(css, '.ptc-hint');
  assert(hint.length > 0, '.ptc-hint must survive — the rawNotice idiom depends on it (D6).');
  const pop = cssRule(css, '.ptc-popover');
  assert(/position:\s*absolute/.test(pop),
    '.ptc-popover must keep position: absolute (AC-6): it hangs below the chip and moves with ' +
    'it, which is exactly the mechanism behind the documented post-open layout-shift ' +
    'interaction (ADR 0003 D4). "Fixing" the shift by repositioning the popover changes a ' +
    'settled decision and needs its own story.');
  // The blocks' own class rules — consumed by the shared component on BOTH surfaces now.
  for (const sel of ['.bs-tag-row-raw-list', '.bs-tag-row-raw-block', '.bs-tag-row-raw-caption', '.bs-tag-row-raw-uncounted']) {
    cssRule(css, sel); // presence, loudly — renaming them is a story that owns both surfaces' CSS
  }
  // .bs-tag-raw-pre's pre-wrap/break-all contract is already sentineled by Story 2's
  // suite (R4 there); deferring to the suite that owns it rather than duplicating.
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- note-tagging raw-events inspector UI tests (epic tag-event-inspector, Story 3) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nnote-tagging-raw-events-inspector-ui: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
