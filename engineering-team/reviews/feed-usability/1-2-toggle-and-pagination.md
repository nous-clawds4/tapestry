# Review: feed-usability #1 (Notes | Notes + Replies toggle) + #2 (Load more pagination)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-03
**Diff:** `git diff b1b1ff59^..HEAD` (through commit `3a719f36`)
**Stories:** `feed-usability/1-notes-replies-toggle.md`, `feed-usability/2-feed-pagination.md`
**ADRs:** `feed-usability/0001-notes-replies-toggle.md`, `feed-usability/0002-feed-pagination.md`

Reviewed as one pass at the operator's request (Story 1 review was deferred until Story 2
landed — "a simple toggle doesn't strike me as a standalone review").

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **epic suites all green**: `notes-replies-toggle` 21/0,
  `feed-pagination` 17/0, `live-feed-feed-page` 27/0 (sentinels updated for the
  virtualization/indicator change), read paths `live-feed-read-path` 30/0 and
  `note-surfaces-read-path` 28/0. Overall harness is FAIL, but **every failing suite is
  pre-existing and unrelated to this epic** (verified: none reference epic files;
  `NoteCard.jsx` is not in the diff):
  - `note-surfaces-ui` (1), `event-page-ui` (1) — the pre-existing "NoteCard reused as-is /
    no variant fork" R2 sentinel (fails on the parent commit).
  - `b-tag-primitive` (1), `b-tag-seeds` (1) — pre-existing communityReference scope guards.
  - `tl-publication-from-pins*`, `most-pinned-tag-index-publish` — flaky live-stack *publish*
    suites (publish to the local relay + read back; fail count varies run-to-run).
- [x] `npm run build` (ui/) — clean; `react-virtuoso` resolves, no JSX/import errors.
- [x] Local runtime smoke (`:7778`): the `until` cursor verified end-to-end — page 1 → 50
  notes, page 2 `until=<oldest>` → strictly-older batch (all ≤ cursor, newest-first, boundary
  deduped by id). Browser click-through (virtualized DOM bound / scroll-restore) not run —
  host lacks the Chrome extension + Playwright browser libs; operator confirmed the toggle
  and Load more behavior in their own browser.
- [ ] Lint / typecheck — _not configured (house rule)._

## Spec adherence

**Story 1 (toggle):** ✅ all six ACs covered. Toggle on both surfaces defaulting to "Notes"
(U1/U2/U5/U6); Notes filters replies / Notes+Replies shows all / switch re-filters
(U3/U7, client-side, no refetch — R3); reply-only empty state (U4/U8); pre-existing empty
states preserved (R1/R2). The NIP-10 rule is server-computed once in `enrichNotes`
(`isReplyNote`, B1–B7) with the `tag[1]` guard the test plan flagged.

**Story 2 (pagination):** ✅ all seven ACs covered. Load-more control (P1/P2); appends
strictly-older, deduped, newest-first (SF/SU cursor behavioral + H1/H2 dedup);
composes with the toggle (R1 + the reply-only branch keeps a Load-more control so Notes
mode can page past an all-replies batch); exhaustion signalled (end-of-history copy,
`exhausted`); loading state + no double-append (`loadingMore` + stale/in-flight guard);
bounded live content via react-virtuoso window-scroll (P1/P2/P3, runtime owned by the lib);
truthful count indicator replacing the fixed "50" (P1/P2). No criterion silently dropped;
no behavior beyond the stories (toggle not persisted; no auto-scroll — both correctly out
of scope).

## ADR adherence

- **0001:** `isReply` added to the shared `enrichNotes` item (one home; both read paths
  inherit, neither grows its own copy — R4). Client-side filtering in the pure render
  helpers. Matches the ADR exactly.
- **0002:** `until` relay cursor threaded through `buildFeed`/`buildUserNotes` +
  handlers; accumulating hooks mirror `useTagIndex`'s machine (cursor, dedup, stale guard);
  react-virtuoso window-scroll + `LoadMoreFooter`; the two flagged shipped `items.map`
  sentinels (live-feed T4, note-surfaces :180) and the indicator sentinel (T3) were updated
  as the ADR required. The one authorized new dependency (`react-virtuoso ^4.18.10`) is in
  `ui/package.json` — approved by ADR 0002 §3A. `coerceUntil` is duplicated across the two
  read paths, consistent with the existing house pattern (they already duplicate
  `resolveGeneralPurposeRelays`/`querySync`; ADR note-surfaces/0001 chose duplication over
  touching shared code, consolidation tracked).

## Concept-graph integrity
- No concept definitions, schemas, or handles changed. `isReply` is a derived read-time
  boolean; `until` is a query cursor. **No firmware reinstall required** (both ADRs state
  this). No BIBLE re-derivation; handles untouched.

## Things tests can't catch

- No secrets, no leftover `console.log`, no commented-out code, no TA-pubkey hardcodes
  (the read paths resolve identity via the existing helpers; nothing new here).
- Input validation at the boundary: `coerceUntil` rejects junk → `undefined` (page 1);
  `handleGetUserNotes` still validates the pubkey (INVALID → 400) before any cursor use.
- **Race condition — found during review, fixed in `3a719f36`:** `useUserNotes`' page-1
  effect reset `loading`/`error`/`exhausted`/`status`/`items`/cursor/ids on a `pubkey`
  change but **not `loadingMore`**. A profile switch *during* an in-flight "Load more" left
  the prior fetch's `finally` guarded out by the stale `liveSeqRef`, stranding the new
  profile's button on the disabled "Loading…" state until reload. Reachable given the slow
  (≤8s) relay fetches already observed. Fixed by resetting `loadingMore` in the effect.
  `useFeed` is not affected (its effect deps are `[]`, so `liveSeqRef` never advances).
- **Loading-state regression — found in cycle-local, fixed in `d92a50b5`:** the accumulating
  hooks initially returned an always-truthy `data`, so the page's `loading && !data` gate
  skipped the loading line and showed the empty state on first paint. Fixed by gating `data`
  to `null` until page 1 resolves; H3 guard added.

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] The one new dependency (`react-virtuoso`) is ADR-authorized (0002). No new
  lint/typecheck/build tooling.

## Findings

### Blocking
_None remaining._ The one blocking issue (the `loadingMore` stale-reset race) was found and
fixed in-phase (`3a719f36`); re-verified green.

### Non-blocking
1. **`test/test.js`** — the printed summary *table* omits `notes-replies-toggle` and
   `feed-pagination` (it stops at `verified-muters-profile-surface`; ~a dozen later suites
   including `profile-authored-notes-ui` and the event-tagging suites are likewise absent).
   The suites still gate via `overallOk` and the progress output. My suites follow the
   current convention; syncing the whole table is a separate cleanup, not this epic's.
2. **`useFeed`/`useUserNotes`** — `components={{ Footer: () => footer }}` gives Virtuoso a
   new Footer identity each render (minor remount churn). Harmless; noted only.
3. **Exhaustion in Notes mode** — a batch of only-replies leaves "Load more" up (correct,
   not a dead button); auto-continue-until-one-visible is the deferred enhancement ADR 0002
   already logs.

## Verdict
**PASS** — both stories match their stories, ADRs, and test plans; epic suites are green;
the one blocking race and the loading regression were found and fixed in-phase; all
remaining harness failures are pre-existing and unrelated. Mergeable as-is.
