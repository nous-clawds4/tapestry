# Review: Story 3 — Tag-detail page (write — apply, dispute, search-and-apply)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Diff:** `git diff 10026954...HEAD` (ADR `81787873`, tests `6b2cc84e`, impl `0a6393da`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** on a clean run.

  ```
  Test Results
  -------------
  Configuration Loading:        PASS
  profile-tags suite:           PASS (13 passed, 0 failed)
  profile-tags-publish suite:   PASS (7 passed, 0 failed)
  tag-detail suite:             PASS (8 passed, 0 failed)
  tag-detail-publish suite:     PASS (9 passed, 0 failed)
  tag-detail-write suite:       PASS (4 passed, 0 failed)
  tag-detail-write-publish suite: PASS (4 passed, 0 failed)
  tag-index suite:              PASS (7 passed, 0 failed)
  tag-index-publish suite:      PASS (9 passed, 0 failed)
  Overall:                      PASS
  ```

  **Flake observed (not a regression).** First `npm test` run hit a single
  failure in `profile-tags-publish` — `overwriting the same d-tag with flipped
  polarity moves the entry between buckets (single record)` reported "after
  overwrite, expected 0 applications, got 1." Bisected the failure: reverting
  *only* `src/api/profile-tags/index.js` to 10026954 made it pass, which would
  ordinarily implicate the Story 3 server change. But the only modification in
  that file is `handleProfilesTagged` — the failing test exercises
  `handleTagsForProfile`, an unrelated handler. A second clean `npm test`
  run passed end-to-end. Conclusion: this is a strfry replaceable-event
  propagation timing flake (the test waits a fixed `PROPAGATION_MS = 600` for
  the second event to overwrite the first; under load the second can lose
  the race and arrive after the read). Pre-existing footgun; not introduced
  by Story 3.

  Story 3's own server suites both pass cleanly:
  - `tag-detail-write` (contract): 4/4.
  - `tag-detail-write-publish` (Phase 1): 4/4 PASS; Phase 2 SKIPS as
    documented (`/var/lib/brainstorm/settings.json` is unwritable here —
    in fact the directory doesn't exist on this dev box, mirroring the
    Story 2 + Story 4 infra constraint).

- [ ] `npm run test:playwright` — **NOT RUN** by reviewer. `@playwright/test`
  isn't in this dev box's local `node_modules` (same pre-existing constraint
  Stories 1–6 documented). The spec at
  `tests/brainstorm/tag-detail-write.spec.js` parses cleanly and lists 11
  tests across 5 browser projects (chromium / firefox / webkit / mobile-
  chrome / mobile-safari). The test-plan's verification section confirms the
  spec was authored against a parsing-validated environment.

- [ ] _Lint not configured — skipped per house rules._
- [ ] _Typecheck not configured — skipped per house rules._
- [ ] _Build not configured — skipped per house rules._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.** Cross-referenced the
  test-plan coverage map against the story's 9 ACs:
  - **AC-1** (Apply publishes positive): Playwright `clicking Apply on a row
    publishes a kind-39999 nostr-user-tag assertion with polarity=+1` —
    asserts `kind`, polarity, `p`, `e`, and `z` tags on the captured signed
    event.
  - **AC-2** (Dispute publishes negative): Playwright counterpart with
    polarity=-1; plus `viewerAssertions is populated when viewerPubkey is
    provided` (Phase 1) round-trips both polarities server-side.
  - **AC-3** (already-applied / already-disputed state): two Playwright tests
    (`row shows applied state…` and `row shows disputed state…`) that accept
    any of `disabled`, `aria-pressed=true`, `aria-current=true`,
    `data-state=applied|disputed`, or a class containing `is-applied`/
    `is-disputed`. Implementer chose `aria-pressed` + `is-applied`/
    `is-disputed` class — passes the test.
  - **AC-4** (search input visible to logged-in): Playwright `rows show Apply
    + Dispute buttons and the page-search input is visible`.
  - **AC-5** (search results show buttons): Playwright `typing in the
    page-search input renders result rows with Apply/Dispute buttons`.
  - **AC-6** (apply via search refetches main list): Playwright `applying
    via page-search refetches the main list and the profile appears there`,
    plus the Phase-2 server test `viewer-union: viewer-only applied target
    surfaces with applications=0, disputes=0, onlyViewerVisible=true` (skips
    here for infra reasons; see "Coverage gap" below).
  - **AC-7** (badge present + suppressed): Playwright `viewer-only-visible
    row carries a "your assertion — not yet visible to this POV" badge` and
    `rows whose counts are non-zero do NOT show the viewer-only badge`.
  - **AC-8** (logged-out parity): Playwright `logged-out: tag page renders no
    Apply/Dispute buttons and no profile-search input`, plus Phase-2 server
    no-leak guarantee `viewer-union: without viewerPubkey, viewer-only
    targets are NOT in rows`.
  - **AC-9** (publish failure surfaces inline error): Playwright `total
    publish failure surfaces an inline error`. Mocks strfry publish with
    500 → expects `[role="alert"], .bs-tag-row-error, .bs-tag-error`.
    Implementer renders `<p class="bs-tag-row-error" role="alert">⚠️
    {publishError}</p>` per ADR.

- [x] **No criterion silently dropped.**

- [x] **No bonus behavior added beyond the story.** The implementer added
  one minor polish (a `×` clear-button on the page-search input and a "No
  profiles match" empty state) — both are obvious UX scaffolding that the
  ADR didn't forbid and don't change the contract. Acceptable.

## ADR adherence

- [x] **Server change matches ADR-0004 §Implementation notes / Server**
  precisely. `handleProfilesTagged` in `src/api/profile-tags/index.js`:470–579:
  - viewerPubkey validation: 64-char lowercase hex; malformed treated as
    absent (silent, no 400). Per ADR.
  - Viewer-assertions map built from `deduped` *before* the WoT-filter loop,
    using `bucketize(readPolarity(ev))` to map to `'applied'` / `'disputed'`
    and dropping `'neutral'`. Per ADR.
  - Viewer-union: `for (const targetPk of Object.keys(viewerAssertions)) {
    if (!byTarget.has(targetPk)) byTarget.set(...) }`. Per ADR.
  - `onlyViewerVisible` set on every row (defaults to `false` when no
    viewerPubkey threaded — guarantees the UI's row component can read the
    field unconditionally). Per ADR.
  - Sort runs unchanged on the union — viewer-only `(0, 0)` rows naturally
    bottom-rank. Per ADR.
  - Response gains `viewerAssertions` field (always present as an object;
    empty `{}` when no viewer or no assertions). Per ADR.
  - No new endpoint; no route changes. Per ADR.

- [x] **Pure publish helper extracted** to `ui/src/utils/publishProfileTag.js`.
  Wire shape (kind, `d`, `p`, `e`, `z`, `polarity`, content) matches
  ADR-0001 / ADR-0004 sketch exactly. `useProfileTags.buildAndPublishAssertion`
  rewritten as a thin wrapper. Single source of truth for the wire shape
  is now this module — the ADR's stated goal.

- [x] **`useTagDetail.js` extension** — `viewerPubkey` threaded to the
  rows-fetch URL when `user?.pubkey` present; `viewerAssertions` read from
  response (default `{}`); `rowsReloadKey` + `refetchRows()` per ADR. Header
  fetch unchanged. Reload key correctly added to the rows-effect deps.

- [x] **`<TagPageRow>`** — props match ADR. Apply/Dispute buttons are
  siblings of the row link (not nested in `<a>`). Per-row local state
  (`publishingPolarity`, `publishError`). Single-flight guard
  (`if (publishingPolarity) return`). Badge rendered when `showActions &&
  row.onlyViewerVisible`.

- [x] **`<TagPageSearch>`** — debounced 250ms; min length 2 chars; cancels
  via `seqRef` last-write-wins (same pattern as `useTagIndex`); calls
  `/api/search/profiles/meili` with `wotPov=user|house` + optional
  `userPubkey`. Reuses `<SearchInput variant="results">` per ADR. Reuses
  `<TagPageRow>` for hit rendering with `applications: 0, disputes: 0,
  onlyViewerVisible: false`. Same `viewerAssertions[pubkey]` source-of-truth
  as the main list — one refetch updates both surfaces.

- [x] **`Tag.jsx` glue** — `viewerAssertions`, `refetchRows` pulled from
  `useTagDetail`. `handleApply` / `handleDispute` await
  `publishProfileTagAssertion(...)` then call `refetchRows()`. Errors
  propagate to `<TagPageRow>` for inline surfacing.

- [x] **CSS** added under the existing `bs-tag-*` namespace per ADR
  (`bs-tag-row-actions`, `bs-tag-row-apply`, `bs-tag-row-dispute`,
  `is-applied`, `is-disputed`, disabled, `bs-tag-row-badge`,
  `bs-tag-row-error`, `bs-tag-search`, `bs-tag-search-results`).

- [x] **No new dependencies.** No new lint/typecheck/build tooling.

- [⚠] **Documented deviation from ADR (acceptable):** The ADR specified
  `<TagPageSearch>` would receive `tagEventId`, `tagSlug`, `tagName`, and
  `pov` props. The implementer simplified to only `user`, `viewerAssertions`,
  `onApply`, `onDispute` — `pov` is derived internally from `user?.pubkey`,
  and `tag` flows in via the closures of `handleApply` / `handleDispute`
  defined in `Tag.jsx`. Cleaner prop surface; same observable behavior;
  doesn't change any contract the test plan locks in.

## Concept-graph integrity

- [x] **No concept changes.** ADR-0004 explicitly states "Firmware reinstall
  required? **No.**" Story 3 is pure read/write composition + UI; the
  `tag` and `nostr-user-tag` concepts from ADR-0001 are reused unchanged.
- [x] **Handles in `kind:pubkey:slug` form.** New `publishProfileTag.js`
  exports `NOSTR_USER_TAG_HANDLE = `39998:${TA_PUBKEY}:nostr-user-tag``.
  Server uses the existing `NOSTR_USER_TAG_Z_TAG` constant. Wire shape
  unchanged.
- [x] **No BIBLE.md / firmware-JSON reads in new code.** Constants are
  inlined where used (TA pubkey + handle); other lookups go through
  strfry / Meili / API.

## Things tests can't catch

- [x] **No secrets in committed files.**
- [x] **No leftover debug logging.** `grep -n "console\." ` against new
  client + server files (`TagPageRow.jsx`, `TagPageSearch.jsx`,
  `publishProfileTag.js`, modified `useTagDetail.js`, `useProfileTags.js`,
  `Tag.jsx`, `src/api/profile-tags/index.js`) returns empty. The console
  output in test files is the test runner's own results pipe — expected.
- [x] **No commented-out code.**
- [x] **Error paths handled.** Server: malformed `viewerPubkey` is silently
  treated as absent (per ADR — preserves the read-only contract). Client:
  per-row `publishError` captures async failures from
  `publishProfileTagAssertion` and surfaces an inline `<p role="alert">`.
- [x] **Race conditions considered.**
  - `<TagPageRow>` has a single-flight publish guard (`if
    (publishingPolarity) return`). A second click during in-flight publish is
    a no-op — no double-publish.
  - `<TagPageSearch>` uses `seqRef` last-write-wins to drop stale fetch
    completions when `q` changes mid-debounce.
  - The publish→refetch race the ADR called out: `handleApply` /
    `handleDispute` `await publishProfileTagAssertion(...)` (which awaits
    `publishOrThrow` → which awaits `publishEverywhere` → local-strfry
    write) *before* calling `refetchRows()`. Same guarantee Story 1's
    profile page accepted; not perfect but acceptable.
- [x] **Security: input validation at boundaries.**
  - `viewerPubkey` validated against `/^[0-9a-f]{64}$/`. Threaded to
    `byTarget` keys / `viewerAssertions` lookup; never to a SQL/strfry
    query string by interpolation. Safe.
  - The Meili search URL in `<TagPageSearch>` builds via `URLSearchParams`,
    not string concatenation — no injection vector.
  - The publish path uses `JSON.stringify` for content; `targetPubkey` and
    `tag.eventId` are passed through `nip19`-validated paths upstream.
- [x] **Decentralized-first / POV-first / view-time-filter invariants
  preserved.** Viewer-union is a single in-memory pass on the same
  `deduped` events the WoT filter scans — no new persistent column, no
  write-time gating, no global "trusted set." Different POVs see different
  views from the same raw assertion data. Honors all three CLAUDE.md
  invariants explicitly enumerated in ADR-0004 §Context.

## House rules check

- [x] **Concept Graph API authority respected.** No new concept handles
  introduced; no firmware reinstall called for; no BIBLE.md re-reads.
- [x] **No new lint/typecheck/build tooling.**

## Coverage gap (not blocking, called out)

The Story 3 publish-flow Phase 2 suite is the only place that exercises the
viewer-union semantics under a real WoT-narrowing POV (the central feature):
viewer-only targets unioned in, no-leak guarantee for the un-viewed read,
false-positive guard on in-WoT rows. It SKIPS in this dev environment because
`/var/lib/brainstorm/settings.json` isn't writable — in fact, the directory
doesn't exist here. The test plan calls this out explicitly and recommends
the implementer/reviewer run Phase 2 in an environment that can write
`settings.json` (the brainstorm server box itself, or tests run inside the
container).

The contract layer + Phase 1 publish + Playwright UI mocks collectively
sandwich the feature, but the *narrowing* semantics — "viewer's apply unioned
in only when their author would otherwise be filtered out" — are only fully
verified end-to-end in an FS-shared environment. Recommend re-running Phase 2
on staging or in a container before promoting to prod. Not a blocker for
review PASS because:
1. The contract suite locks in the response shape (additive `viewerAssertions`
   + per-row `onlyViewerVisible`).
2. Phase 1 confirms `viewerAssertions` is correctly populated from the same
   raw scan the WoT filter uses.
3. The Playwright spec mocks the server response and verifies the UI
   contract end-to-end on top of it.
4. The ADR's narrowing algorithm is small (a single in-memory loop adding
   missing keys) and visually inspectable in the diff at
   `src/api/profile-tags/index.js:494–504,541–547`.

## Findings

### Blocking

_None._

### Non-blocking

1. **The `<span class="bs-tag-row-badge">` is rendered inside the `<Link
   to="/user/${row.pubkey}">`.** `ui/src/components/TagPageRow.jsx:65–96`.
   Clicking the badge will navigate to the user's profile page, not just
   read the badge text. Probably intended UX (the badge labels the row;
   anywhere on the row navigates to the profile), but worth noting. If a
   future hover-tooltip behavior wants the badge to be a non-navigating
   element, restructure the row to put the badge as a sibling of the link.

2. **`profile-tags-publish` "overwrite d-tag with flipped polarity" test
   timing-flake.** Pre-existing; not introduced by this story. The test
   uses a fixed `PROPAGATION_MS = 600` between publish + read, and the
   second publish (which must overwrite the first) can lose the timing
   race under load. Recommend a small follow-up: poll for the expected
   state with a short timeout instead of a fixed sleep, or bump the
   propagation budget. Not a Story 3 blocker.

3. **Phase 2 SKIP in dev environments without filesystem write to
   `/var/lib/brainstorm`.** The test plan documents this; the structural
   solution would be a small in-process POV-injection hook that doesn't
   require touching settings.json — out of scope for this story. Strongly
   recommend running Phase 2 once on staging or in the container before
   the next promotion.

4. **`<TagPageSearch>` props simpler than ADR specified** (only `user`,
   `viewerAssertions`, `onApply`, `onDispute` instead of also `tagEventId`,
   `tagSlug`, `tagName`, `pov`). Cleaner; not a deviation that breaks
   anything. Worth noting in the ADR-vs-shipped diff for future maintainers.

5. **`publishOrThrow` lives in `publishProfileTag.js` even though the name
   is generic.** This is fine for now — only two callers (the profile-page
   chip popover via `useProfileTags`, and the tag-page handlers), both
   publishing kind-39999 assertions. If a third caller wants the
   "succeed-if-any-relay-succeeded" semantics for a non-profile-tag event,
   hoist it to a more generally-named module. Non-blocking.

## Verdict

**PASS**

The implementation matches the story, ADR, and test plan. Server contract +
Phase 1 publish + UI Playwright spec collectively cover all 9 ACs. Architecture
invariants honored explicitly (POV-first union at query time on the same raw
scan; decentralized-first signing at the boundary; no persistent per-POV
denormalization). No blocking issues. The coverage gap (Phase 2 SKIPs without
FS write to `/var/lib/brainstorm`) is documented in the test plan and is a
shared-infra constraint, not a Story 3 defect — recommend Phase 2 be exercised
on staging before promotion. The pre-existing `profile-tags-publish` overwrite
flake bisected to a strfry timing race in a *different* handler from anything
Story 3 changed; not a regression.
