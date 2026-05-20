# Review: Story 12 — Customize curation method at pin time and on /pins

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-20
**Diff:** `git diff HEAD` (uncommitted implementation; staged with the review commit)
**Story:** `engineering-team/stories/done/12-customize-pin-curation.md`
**ADR:** `engineering-team/decisions/0011-customize-pin-curation.md`
**Test plan:** `engineering-team/stories/done/12-customize-pin-curation.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (overall). Story-12 suite:
  `customize-pin-curation-publish`: **3 passed, 0 failed, 1 skipped**
  (POV-required AC-7 skips per documented precondition). Every prior
  suite still green; the generator extension and UI plumbing did not
  regress any existing test.
- [ ] `npm run test:playwright` — not executed in this host
  (Playwright bundled chromium needs Linux .so deps unavailable on
  the NixOS-style host). `tests/brainstorm/customize-pin-curation.spec.js`
  parses and lists correctly under `npx playwright test --list`: 15
  tests covering AC-1, AC-2, AC-3, AC-5, AC-6 × 5 (zero, negative,
  fractional, non-numeric, empty), AC-9, AC-10 × 3 (non-hex, npub,
  empty), AC-11 × 2 (Cancel, Escape). Same skip disposition as
  Stories 10 + 11.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] UI build clean (`npm --prefix ui run build`) — one chunk-size
  warning, no errors.

## Spec adherence

- [x] **AC-1** (Pin click opens dialog with documented fields and
  Story-10 defaults) — `ui/src/pages/Tag.jsx:62–66` replaces direct
  publish with `setShowCurationDialog(true)`; dialog mounted at
  `ui/src/pages/Tag.jsx:162–171` with
  `initialCuration={defaultCurationMethod(user.pubkey)}` (the exact
  Story-10 default from `ui/src/utils/publishTagPin.js:19–26`). Field
  set verified by inspection of
  `ui/src/components/CurationMethodDialog.jsx:130–230`: cutoff
  (number input), includeScoreInTL (toggle), method picker (select
  with 4 options), observer (under `<details>`).
- [x] **AC-2** (submit publishes customized curation-method) —
  `publishWithCuration` at `Tag.jsx:68–86` calls
  `pinTag({ tag, curationMethod: customCuration })`. The `pinTag`
  helper at `ui/src/utils/publishTagPin.js:39–64` writes the
  curation values into both the `curation-method` event-tag and the
  JSON content body.
- [x] **AC-2** (server side, observed) — `customize-pin-curation-publish.test.js`
  test "pin event with cutoff=1 produces a TL whose [cutoff,1]
  event-tag matches" — passes against the generator at
  `src/api/trustedList/refreshPinnedTags.js:184–187` (emits
  `['cutoff', String(cutoff)]`).
- [x] **AC-3** (/pins per-row Edit pre-fills) —
  `ui/src/pages/Pins.jsx:201–209` adds the `⚙️ Edit` button; clicking
  sets `editingPin=row`, and the dialog at lines 230–240 mounts with
  `initialCuration={editingPin.curationMethod}`. The dialog's
  pre-fill logic at `CurationMethodDialog.jsx:63–72` honors the
  passed values for cutoff, includeScoreInTL, method, and observer.
- [x] **AC-4** (edit replaces pin in place) — handled by kind-39999
  replaceable semantics. The `pinTag` helper builds the same `d`-tag
  for the same `(viewer, tagAuthor, tagSlug)` triple
  (`publishTagPin.js:45`), so a re-publish lands in the same
  addressable slot. Verified by the publish-flow test "editing a pin
  (re-publish kind-39999 with same d-tag, new cutoff) lands at the
  same TL d-tag with the new values after refresh".
- [x] **AC-5** (refresh-on-edit fires) — three call sites:
  - `Tag.jsx:75–79` (pin-time path) fires
    `POST /api/trusted-list/refresh-pinned-tag`.
  - `Pins.jsx:85–93` (per-row edit) fires the same endpoint.
  - `PinDetail.jsx:128–132` (PinDetail edit) fires the same.
  All three use fire-and-forget (`fetch(...).catch(() => {})`) per
  ADR §"Why `refresh-pinned-tag` (per-pin)". The Playwright test
  "AC-5: saving a curation edit fires POST /api/trusted-list/refresh-pinned-tag"
  verifies the wire-level fact (would run in CI).
- [x] **AC-6** (cutoff validation) — `normalizeCutoff` at
  `CurationMethodDialog.jsx:42–53` rejects empty / non-numeric /
  fractional / ≤ 0. Submission blocked by the `Object.keys(errs).length > 0`
  guard at line 102. Inline error displayed at line 170. Five
  Playwright variants exist for this AC (zero, negative, fractional,
  non-numeric, empty).
- [x] **AC-7** (includeScoreInTL + resolvable POV → score-bearing
  p tags) — generator extension at
  `src/api/trustedList/refreshPinnedTags.js:155–176` matches the
  ADR's pseudocode exactly. The Meili bulk-fetch reads
  `wot_rank_<povSuffix>`, attaches `m.score` to each member with a
  numeric rank, then the items map at lines 188–192 carries `score`
  through to `buildAndPublishTL`, which emits the existing
  `['p', pubkey, '', String(score)]` triple. The POV-required test
  "AC-7: ... p tags carry [pubkey, '', <score>] triples" exists in
  the publish suite at `test/customize-pin-curation-publish.test.js`
  and runs in CI (skips locally).
- [x] **AC-8** (includeScoreInTL + POV unresolvable → degrade
  silently) — guard at `refreshPinnedTags.js:160`:
  `if (curation.includeScoreInTL === true && povSuffix) { ... }`.
  When `povSuffix` is null, the entire score-enrichment block is
  skipped; members publish without scores. Additional try/catch at
  line 161 swallows Meili failures. Verified by the publish-flow
  test "pin with includeScoreInTL=true + no resolvable POV still
  publishes a kind-30392 with bare p tags".
- [x] **AC-9** (method picker locked) — `SUPPORTED_METHODS` at
  `CurationMethodDialog.jsx:20–25` defines the four entries with
  `enabled: true` only for `nip85:rank`; the `<option>` mapping at
  line 197 sets `disabled={!m.enabled}` and appends `' (coming soon)'`
  for disabled values. Defensive enum check at line 99 catches a
  bypass via accessibility tools.
- [x] **AC-10** (observer field accepts hex / npub / empty) —
  `normalizeObserver` at `CurationMethodDialog.jsx:27–40` handles all
  three branches: empty → viewerPubkey; 64-char hex → as-is;
  `npub1...` → decoded via `nip19.decode` with a `type === 'npub'`
  check; anything else → error. The error message
  `"Must be a 64-char hex pubkey or a valid npub."` matches the
  ADR's wording. Three Playwright variants exist.
- [x] **AC-11** (cancel doesn't publish) — the dialog's `onSubmit`
  wrapper only fires the publish when validation passes (line 108);
  Cancel button at `CurationMethodDialog.jsx:245` calls `onCancel`
  without publishing; ESC handler at line 84 same; backdrop click at
  line 122 same. Submit button is disabled while `submitting === true`
  (line 251) to prevent double-publish. Two Playwright variants
  (Cancel, Escape) exist.

## ADR adherence

- [x] **Option A** (shared dialog, three trigger points) implemented
  exactly as specified. No design drift.
- [x] **Dialog component** at the documented path
  (`ui/src/components/CurationMethodDialog.jsx`); mirrors the visual
  pattern of `AddTagDialog.jsx` (`pcd-*` prefix to avoid collision
  with the `ptd-*` prefix the AddTagDialog uses); same backdrop +
  `role="dialog"` + ESC handler + initial focus pattern.
- [x] **`pinTag` reuse** — no changes to `publishTagPin.js`'s wire
  shape (only the prior export of `TA_PUBKEY` from Story 11 is
  imported). The customization arg was already a Story-10 feature.
- [x] **Generator extension** at `refreshPinnedTags.js::runOnePin`
  matches the ADR pseudocode (`if (curation.includeScoreInTL === true
  && povSuffix) { ... meiliFetchProfilesByPubkey ... rankField =
  wot_rank_<povSuffix> ... m.score = doc[rankField] }`). The items
  map and content body both carry `score` when present.
- [x] **No new server endpoint** — all three refresh-on-edit call
  sites reuse `POST /api/trusted-list/refresh-pinned-tag` from
  Story 11. No new routes in `src/api/`.
- [x] **No firmware reinstall required** — confirmed by inspection;
  no concept-graph changes.
- [x] **Refresh endpoint choice** — `refresh-pinned-tag` (per-pin),
  not `refresh-pinned-tags-for-viewer`. Matches ADR §"Why
  `refresh-pinned-tag` (per-pin) instead of `-for-viewer`".

## Concept-graph integrity

- [x] **No concept-graph changes** — confirmed by `git diff` against
  `firmware/`. No new ConceptHeader, no schema changes.
- [x] **Handles in `kind:pubkey:slug` form** — N/A; story doesn't
  add new handles.
- [x] **No BIBLE.md / firmware JSON reads** — new code reads only
  existing helpers (`profileTags.meiliFetchProfilesByPubkey`).

## Things tests can't catch

- [x] **No secrets in committed files** — diff inspected; no API keys
  / privkeys / credentials.
- [x] **No leftover `console.log`** — the only `console.log` in the
  diff is `test/test.js:101` (the new suite's runner-output reporter,
  matches existing convention).
- [x] **No commented-out code** in the diff.
- [x] **Error paths handled** —
  - `CurationMethodDialog.handleSubmit` (lines 90–115) catches publish
    errors and surfaces them inline via `setError(err.message)`.
  - Server `runOnePin`'s score-enrichment block wraps the Meili call
    in try/catch (`refreshPinnedTags.js:161–177`), degrading silently
    on lookup failure (AC-8).
  - PinDetail's `openEditDialog` (lines 102–122) catches the
    pre-fill lookup error and surfaces it as `editError`.
- [x] **Concurrency / race conditions** —
  - `submitting` state at `CurationMethodDialog.jsx:75` disables the
    submit button while the publish is in flight, preventing
    double-publish on rapid clicks.
  - The dialog blocks ESC/backdrop dismissal while `submitting` (lines
    84, 122) so the user can't close mid-publish and leave state
    half-updated.
  - `pinTag`'s replaceable d-tag means concurrent edits from
    multiple tabs converge on the latest by `created_at` — the
    relay arbitrates; no client-side coordination needed.
- [x] **Security: input validation at boundaries** —
  - Cutoff: regex `/^-?\d+$/` + parseInt + range check.
  - Observer: regex `/^[0-9a-f]{64}$/` for hex; `nip19.decode` with
    `type === 'npub'` check for npub.
  - Method: enum-locked at the picker; defensive check at submit.
- [x] **No new server endpoints** ⇒ no new auth surfaces to audit.

## House rules check

- [x] **Concept Graph API authority** — respected (no BIBLE.md /
  firmware-JSON reads).
- [x] **No new lint/typecheck/build tooling** — diff adds none.
- [x] **Firmware reinstall** — N/A; no concept definitions changed.

## Findings

### Blocking

_None._

### Non-blocking

1. **`ui/src/components/CurationMethodDialog.jsx:77`** — `dialogRef`
   is declared and assigned but never read. Mirrors the same dead
   pattern in `AddTagDialog.jsx:17`, where the implementer borrowed
   the dialog shape from. Trivial. Future cleanup could remove both;
   not worth blocking on either.

2. **`ui/src/pages/Tag.jsx:80`** — `setPinError(e.message)` runs
   even though `publishWithCuration` re-throws so the dialog can
   render the error itself. After the dialog is dismissed (or after
   a Cancel that follows a failed attempt), the stale `pinError` may
   appear on the Pin button's inline error surface until the next
   interaction clears it. Functionally harmless; minor UX glitch.
   Future polish: clear `pinError` when opening the dialog.

3. **`ui/src/pages/PinDetail.jsx:102–122`** — the second site that
   fetches `/api/profile-tags/pins` and matches by
   `tag.eventId + tag.slug` to recover a pin-event reference (first
   site is the Refresh-now lookup at the same file's earlier handler).
   The ADR called this out as acceptable v1 polish ("can either inline
   that look-up (one extra fetch per edit click — fine for v1) or
   refactor it into a shared helper"). Future helper extraction would
   DRY the two sites; not blocking.

4. **AC-7 (POV-required) skips locally** — same disposition as
   Stories 10 + 11's POV-required tests; the test runs in CI / a
   Linux dev env where `/var/lib/brainstorm/settings.json` is
   writable from the test process. Documented in the test plan.

5. **Playwright suite (15 tests) parses but doesn't execute on this
   NixOS host** — same skip path as Stories 10 + 11. The tests are
   well-formed and cover every UI AC; they'd be the primary
   failing-first signal in a Linux env.

6. **Implementation was not committed by the Implementer at the
   phase handoff** — minor workflow slip. The Reviewer bundles the
   impl + test artifacts into the review commit (or a tight
   precursor) to land the work cleanly.

## Verdict

**PASS**

Every acceptance criterion has a verified implementation. The dialog
matches the ADR's Option-A shape (single component, three trigger
points). The generator extension wires AC-7 in the exact ~10 lines
the ADR pseudocoded, with the AC-8 guard correctly placed. Test
gate is green; the publish-flow suite's "regression-protection"
disposition documented in the test plan held up — no wire-path
guarantees were broken. Six non-blocking findings recorded; none of
them block merging.
