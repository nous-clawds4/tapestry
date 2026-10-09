# Review: Story 2 — The Outbox Relays page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git diff 50a6103..ccb4bbc`: the tests `9a9b715` (Phase 3) and the implementation `ccb4bbc` (Phase 4), shared by the three stories. This review covers story 2's part: the draft rules in `src/lib/relay-list/index.js` (`addRelay`, `removeRelay`, `visibleSuggestions`, `addAll`, `sameRelayList`), `outboxSuggestions` in `src/api/assistant/outboxRelays.js`, `ui/src/pages/assistant/OutboxRelays.jsx` (everything but the publish button and report, which are story 3's), `ui/src/pages/assistant/outboxRelaysCopy.js`, `ACTION_PAGES` in `ui/src/App.jsx`, the `bs-outbox-*` rules in `ui/src/styles.css`, and the `suggestions` field in `src/api/openapi.yaml`. Base `50a6103`. `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0).
**Story:** `engineering-team/stories/assistant-outbox-relays/2-the-outbox-relays-page.md`
**ADR:** `engineering-team/decisions/assistant-outbox-relays/0002-the-outbox-relays-page-reads-the-one-answer.md` (Accepted)
**Test plan:** `engineering-team/stories/assistant-outbox-relays/2-the-outbox-relays-page.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`**: one run for the three stories. `npm run gate:status -- --label reviewer-outbox-relays`:

  > `20261009T120133Z-5764-c4eb [reviewer-outbox-relays] started 2026-10-09T12:01:33.183Z on ccb4bbc8 — FAIL, exit 1, 5209 passed, 70 failed, 582 skipped, 284/284 suites; failed: harness-lint, stamped-composite-avatar, my-assistant-page, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone`

  All six failures are pre-existing. Each fails identically at the base `50a6103` in a worktree, except `assistant-profile-check`, which gains three passes from this diff. The per-suite comparison is in story 1's review.
- [x] **The suite alone:** `assistant-outbox-relays-page` **17 passed, 0 failed, 0 skipped**. Re-aimed: `assistant-identification-tags-page` 16/0/0, which includes the S3 correction discussed below.
- [x] **Playwright, chromium,** against a fresh `vite build` of `ccb4bbc` served by `vite preview`: story 2's B3, B4, B5, B6 and B10 pass, within the run of **69 passed, 3 skipped, 1 failed**. The failure is the parallel book's `assistant-attention` B4, explained in story 1's review. `assistant-management-page` B8 for `/assistant/outbox-relays` skips as built.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ The `vite build` succeeds with the page and the alias.

## Spec adherence
- [x] Every acceptance criterion has a passing test, and the plan's coverage map holds:
  - AC-1 → C2, C3, D1, D5, B3, B4, B10.
  - AC-2 → L5, D2, B4, B5.
  - AC-3 → L1, D3, B6.
  - AC-4 → G1–G4, L3, L4, B5.
  - AC-5 → L2, D3, B5.
  - Copy → C1. Route → D4.
- [x] No criterion silently dropped.
  - AC-1's states are all present: the signed-out line and button (`OutboxRelays.jsx:139-147`); the no-assistant line and link (`:149-154`); Checking…, the reason or request-failed (`checkLine`, `outboxRelaysCopy.js:60-66`); the none-yet line only when finished (`:189-191`); the inbox line (`:192`); the hub's mark and Done from `assistantAttention` (`:64-66`, `:158-168`).
  - AC-2's draft is rebuilt from each new answer (`:69-72`, the Identification Tags idiom). The unpublished line uses `sameRelayList` when finished, else a non-empty draft (`:82`, `:193`).
  - AC-4's order and public-address rule are in `outboxSuggestions` (`outboxRelays.js:75-93`; G1–G3).
- [x] No behavior beyond the story, apart from the `too-many` refusal ("A relay list here holds at most 50 relays.") that ADR 0002 § Consequences put to the Architecture gate.

## ADR adherence
- [x] Option A as decided. The page reads only `useAuth`, `useAssistantAttention` and the hub's `assistantAttention`, and never fetches for its state (D1). Its only network call is story 3's util. Suggestions come from the answer, computed per request from Relay Settings (principle 3), not filtered by the draft on the server (G4).
- [x] Sub-decision 2: the five draft rules are pure, in the shared library. The draft always holds normalized spellings (`addRelay` appends `normalizeRelayUrl(input)`), so what the page shows is what story 3 publishes.
- [x] Sub-decision 3: the words live in `outboxRelaysCopy.js` with no imports, named apart from the page for the case-insensitive bind mount. The frame and cards reuse `bs-setup-*` / `bs-idtags-*`. New CSS exists only for the relay rows, the field and the notes, with a mobile rule.
- [x] Sub-decision 4: `ACTION_PAGES['outbox-relays']` (`App.jsx:150`).
- [x] No new dependencies.

## Concept-graph integrity
- [x] No concept handle composed or read. The suggestions come from Relay Settings (`aRelays`), as the ADR chose over the `nostr-relay` concept's relay sets.
- [x] No concept definitions changed, so no firmware reinstall.
- [x] Orientation: the AGENTS.md §2 fallback at Architecture. The code reads no graph.

## Things tests can't catch
- [x] No secrets, no TA literal, no debug logging, no commented-out code. The one `eslint-disable-line` (`OutboxRelays.jsx:72`) copies `IdentificationTags.jsx:167`. It is a comment, not tooling.
- [x] Error paths: an unfinished or failed check starts an empty, editable draft and still offers the suggestions it carries. A `check-failed` action carries `suggestions: []`.
- [x] Concurrency: a refresh of the answer while editing discards the draft. That is the trade ADR 0002 § "What we trade away" accepted. Since story 3's narrowing, a refresh after a publish follows only a successful write (story 3 review, non-blocking 1).
- [x] Security: the page stores and sends nothing by itself.
  - React escapes every relay string drawn.
  - The suggestions are read server-side from owner-set Relay Settings, with no outbound connection.
  - `outboxSuggestions` keeps this instance's relay only when `isPublicHost` passes, so a loopback or LAN address is never suggested.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] POV-first: the viewer's own Assistant only; the page shows nothing to a visitor or a viewer without an Assistant. Filter-at-read: the suggestions are re-derived per request.

## Product-guide adherence
Not applicable: no PRD. Copy matches story § Copy verbatim (C1). The `too-many` line is the one ADR-gated addition.

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/pages/assistant/OutboxRelays.jsx:233-234`**: when the attention request itself fails (`phase: 'failed'`), the suggestions panel shows only its explainer, with no list and no line saying why. Panel 1 does say "Could not check: this instance did not answer.". The story names no wording for this state. Optional: reuse the request-failed line there, or say nothing can be suggested until the page reloads.
2. **Depends on story 3's fix.** Story 3's review blocks on request-supplied relay addresses that the server connects to (its blocking finding 1). One remedy the Architect may choose is to refuse non-public relay addresses where they are entered. That would amend this story's AC-3 (`stories/…/2-the-outbox-relays-page.md:52`, "Accepted: a `wss://` or `ws://` address with a host") and change `normalizeRelayUrl` / `addRelay` (`src/lib/relay-list/index.js:34`, `:86`). If it does, story 3's next round re-checks those lines against this story. As built and specified today, this story's own surface is correct and sends nothing anywhere.
3. **Phase-4 test edit (process).** `test/assistant-identification-tags-page.test.js` S3 was corrected inside the `impl:` commit. It is right on merits: ADR 0002 sub-decision 4 adds a second `ACTION_PAGES` key, which the Phase-3 re-aim list missed. The guard still demands `identification-tags` and refuses any key outside the two built pages, so it weakens no judge. Not logged under a story `## Deviations`; see story 1's review, non-blocking 3.

### Harness friction
1. None beyond story 1's.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/assistant-outbox-relays/2-the-outbox-relays-page.md:3`), and the review linked in its § Linked artifacts.
- [x] Completion detection performed; the result is in the chat, not here.
