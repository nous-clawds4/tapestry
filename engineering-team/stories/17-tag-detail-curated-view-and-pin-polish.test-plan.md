# Test Plan: Story 17 — Tag-detail Curated view + Pin curation menu simplification

**Story:** `engineering-team/stories/17-tag-detail-curated-view-and-pin-polish.md`
**ADR:** `engineering-team/decisions/0014-tag-detail-curated-view-and-pin-polish.md`
**Date:** 2026-05-26

## Approach

Story 17 is overwhelmingly UI work (React components, JSX, CSS).
The project intentionally ships JS without a build step and uses
**no UI test framework** (no Jest, no React Testing Library, no
Vitest). The established pattern for UI assertions in this repo
is **source-file regex inspection** — see
`test/nip05-checkmark-verification.test.js` for the reference
pattern. Tests read `.jsx` / `.css` / `.js` files as strings and
assert on their structural content.

This plan combines three test styles, all in the existing
hand-rolled-`assert` idiom:

1. **JSX / CSS source inspection** — covers UI ACs by asserting
   the presence or absence of structural markers (class names,
   prop names, JSX guards, regex-matched JSX patterns) in the
   source files the ADR commits to.
2. **Server contract HTTP test** — covers AC-5's underlying
   server-side row enrichment by hitting
   `/api/profile-tags/profiles-tagged` and asserting the new
   `nip05`, `about`, `website` keys appear on row objects.
3. **Live publish-flow integration** — covers AC-22's WYSIWYG
   invariant (Curated-view membership === Pin TL membership at
   cutoff=1) end-to-end via `nak` + the existing publish/refresh
   endpoints, mirroring `test/customize-pin-curation-publish.test.js`.

Where an AC has a **runtime-only** aspect that source inspection
cannot prove (e.g., AC-9 "no layout shift" requires a real
browser to measure `getBoundingClientRect()`), the test asserts
the load-bearing CSS rules that produce the runtime behavior and
flags the gap in this plan for manual verification at review time.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 | `Tag.jsx removes "View all my pinned tags" link` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-2 | `Tag.jsx removes "Created by" line` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-3 | `Tag.jsx no longer renders <SortToggle> as a top-level child` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-4 | `TagViewControls.jsx exists and uses <details> disclosure with "View options" label` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-5 (UI) | `TagViewControls.jsx renders a filter text input` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-5 (server) | `/api/profile-tags/profiles-tagged rows carry nip05, about, website fields` | `tag-detail-curated-view-and-pin-polish.test.js` | server contract |
| AC-6 | `TagPageRow.jsx renders bs-tag-row-net with is-positive/is-negative/is-zero variants` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-7 | `styles.css makes bs-tag-row-counts visually secondary (smaller font + reduced opacity)` | `tag-detail-curated-view-and-pin-polish.test.js` | css-regex |
| AC-8 | `TagPageRow.jsx accepts showActionsOnHover prop and emits is-revealed class state` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-9 | `styles.css enforces no-jiggle on bs-tag-row-actions (visibility + min-width reservation)` | `tag-detail-curated-view-and-pin-polish.test.js` | css-regex |
| AC-10 | `Tag.jsx applies Curated filter (applications > disputes) when view options collapsed` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-11 | `Tag.jsx threads !viewOptionsExpanded to showActionsOnHover (expanded → always-on)` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-12 | `Tag.jsx / useTagDetail preserves wotPov defaulting to house unless user override` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex (regression sentinel) |
| AC-13 | `TagViewControls.jsx renders left-aligned "Tag someone" button` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-14 | `TagSomeoneModal.jsx exists with backdrop chrome and Escape/close lifecycle` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-15 | `wotScore.js util exports getWotScore; TagSomeoneModal renders Verification Score` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-15a | `TagSomeoneModal search-result row applies hover-only button reveal (mirrors AC-8)` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-16 | `TagSomeoneModal wires Escape + backdrop click to onClose` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-17 | `TagPinAffordance.jsx Pin button carries explanatory title="..." tooltip` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-18 | `CurationMethodDialog.jsx renders pcd-intro paragraph at top of dialog body` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-19 | `publishTagPin.js defaultCurationMethod now defaults cutoff to 1 (not 2)` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-20 | `CurationMethodDialog.jsx Advanced disclosure is wrapped in {false && (...)} guard` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-21 | `publishTagPin.js defaults includeScoreInTL to true; dialog's Include-scores block is hidden` | `tag-detail-curated-view-and-pin-polish.test.js` | source-regex |
| AC-22 | `pin with new defaults publishes a TL whose member set matches the Curated view algorithm` | `tag-detail-curated-view-and-pin-polish-publish.test.js` | publish-flow integration |

### Regression sentinels (must PASS pre- AND post-implementation)

| Sentinel | What it guards | Test file |
|---|---|---|
| R-1 | `/api/profile-tags/profiles-tagged` continues to return `applications` and `disputes` integers on each row | `tag-detail-curated-view-and-pin-polish.test.js` |
| R-2 | `TagPageRow` still emits `+N` and `−M` count text (the new layout reshapes presentation; the count strings themselves remain) | `tag-detail-curated-view-and-pin-polish.test.js` |
| R-3 | `refreshPinnedTags.js` server-side `cutoff` fallback remains `?? 2` (ADR Decision 11 — left UNCHANGED) | `tag-detail-curated-view-and-pin-polish.test.js` |
| R-4 | `CurationMethodDialog.jsx` still defines `useState` for `observer`, `includeScoreInTL`, and `advancedOpen` (state preserved per Decision 8 — fields hidden, state intact) | `tag-detail-curated-view-and-pin-polish.test.js` |

## Edge cases

- **Empty row list:** `/api/profile-tags/profiles-tagged` returning an
  empty `rows` array does not allow asserting the new enrichment
  fields; the test skips per-row shape assertion in that case
  (matches existing skip-on-empty pattern in
  `most-pinned-tag-index.test.js`).
- **Server fallback path:** when the publish suite's preconditions
  (`nak`, control panel reachable) are not met, the WYSIWYG
  invariant test marks `skipped` rather than failing — consistent
  with the other `-publish` suites' behavior.
- **Hide-don't-delete:** the AC-20 / AC-21 tests assert the
  `{false && (` guard pattern with `pcd-toggle` (for the
  Include-scores block) and `pcd-advanced` (for the Advanced
  block) inside the guard. The Reviewer additionally verifies the
  single-line explanatory comment is present (covered by the
  R-4 sentinel checking the `useState` declarations remain).
- **AC-9 runtime verification:** source/CSS inspection cannot
  prove `getBoundingClientRect()` is stable across hover. The CSS
  test asserts the load-bearing rules (`visibility: hidden` on
  `.bs-tag-row-actions` + a `min-width` or equivalent
  width-reservation declaration; a hover/`is-revealed` rule
  flipping it to `visibility: visible`). The Reviewer + manual
  in-browser check at implementation time closes the loop.
- **iOS hover state quirk for AC-8/AC-15a:** native `:hover`
  behavior on iOS Safari fires on first tap; combined with the
  explicit React state for Android/other touch platforms, this
  satisfies "first tap reveals." Manual mobile-browser smoke at
  review time confirms cross-device behavior.

## Test infrastructure

- **Test framework:** the project's hand-rolled runner (`node test/test.js`),
  per [test/test.js](../../test/test.js). Suites export `{ run }`
  returning `{ pass, fail }` (or `{ skipped }`); the entry point
  aggregates results.
- **Concept Graph API:** not required for this story (no firmware
  / concept changes).
- **Firmware state:** unchanged — no reinstall.
- **Control panel:** required at `BRAINSTORM_BASE_URL`
  (default `http://localhost:7778`) for the server contract test.
- **`nak` binary:** required for the WYSIWYG publish-flow suite.
  Suite marks `skipped` when absent (no false failures in dev
  environments without `nak`).
- **Fixtures:** the publish suite generates ephemeral keypairs
  per run (no shared state, no cleanup needed beyond the
  natural addressable-replaceable eventual cleanup that other
  publish suites already produce).

## How to run

```
npm test
```

The new suites are registered in `test/test.js` alongside the
existing `pin-a-tag` / `tl-publication-from-pins` /
`customize-pin-curation-publish` suites.

## Verification

The new tests fail with the current code. Confirmed on 2026-05-26
at commit `156bc671`:

**Contract suite** — `node test/tag-detail-curated-view-and-pin-polish.test.js`:
- **5 PASS** — AC-12 (PoV-cascade unchanged; load-bearing regression
  sentinel) and R-1, R-2, R-3, R-4 (regression sentinels guarding
  out-of-scope behavior).
- **28 FAIL** — every AC-driven assertion, each with an actionable
  message naming the specific gap (e.g., "TagViewControls.jsx must
  exist", "defaultCurationMethod must return cutoff: 1", "Tag.jsx
  must not contain the literal 'Created by'", etc.).

**Publish suite** — `node test/tag-detail-curated-view-and-pin-polish-publish.test.js`:
- **AC-22 FAIL** — TL is empty (live `defaultCurationMethod` still
  returns `cutoff: 2`, so the test fixture's `targetIn` with 1 apply
  and 0 disputes fails the cutoff), while the Curated view (Net ≥ 1)
  includes targetIn. The two sets diverge. Post-AC-19 (cutoff flips
  to 1), the sets will converge.

The publish suite reads `defaultCurationMethod`'s actual literal-
object from `ui/src/utils/publishTagPin.js` source (the module is
ESM and not require-able from a CommonJS test), so AC-22 genuinely
locks the WYSIWYG invariant to the live default rather than a
hardcoded test value. This is what makes AC-22 fail pre-impl and
pass post-impl.
