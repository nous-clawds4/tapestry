# Review: Story 1 — About this instance: Owner, Admins, and Customer count on /about

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-13
**Diff:** the story's own code is `git diff 3def0f8a..HEAD -- src ui test tests` at `993750e5`. That covers three commits:
- `5592eecb`, the failing tests;
- `1dab4584`, the implementation;
- `993750e5`, the B5 re-aim.

The planning commits (`b6195500`, `5371bcfb`, `a33ea828`) are docs only. `a33ea828..HEAD` also carries merge `3def0f8a` (PR #860, `assistant-self-map` #3), which is not this story's.

**Independent check applied.** The same session wrote the story, ADR, tests and code. So before this verdict, a separate read-only reviewer agent audited the diff from scratch (workflows/5-review.md, "an independent check before the commit"). Each of its findings was verified against the sources here. The two that matter were reproduced in a browser (finding B1 below and non-blocking 1).

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`: PASS.** `npm run gate:status` reads `20261013T230035Z-30681-7f40 started 2026-10-13T23:00:35.327Z on 993750e5 — PASS, exit 0, 6019 passed, 0 failed, 582 skipped, 309/309 suites`. `about-this-instance` passed 28/28. The route-walk suites (`admin-action-sweep`, `-access`, `-named`) pass.
- [x] **Playwright, `tests/brainstorm/about-this-instance.spec.js`, Chromium: 11/11 pass.** The build under test was `ui` at `993750e5`'s component source, served by `vite preview` on port 4173.
- [x] **Live on staging**, after the push of `1dab4584`:
  - `GET https://staging.brainstorm.world/api/about-this-instance` answers 200 with exactly `success`, `ownerPubkey`, `adminPubkeys` (5) and `customerCount` (5).
  - The owner equals `/api/owner-info`'s `ownerPubkey` and is not among the admins.
  - The 5 agrees with the public roster: 5 customer rows, each with an Assistant key, none an Admin, none an Assistant.
  - In a headless browser, the "About this Brainstorm Instance" link on `/about-brainstorm-search` has `href="/about#this-instance"` and lands with the section's top at 142 px in a 900 px viewport.
  - The section shows the owner and 5 admins with their real names and NIP-05s, and "5 customers". There are no page errors.
  - **Not verifiable from this container:** profile pictures. Every picture host (pbs.twimg.com, robohash.org, primal, …) is unreachable from here, so every card showed the initial fallback, which is that fallback working on live data.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._ The UI build (`vite build`) succeeds.

## Spec adherence

- [x] **Every acceptance criterion has a passing test** (test plan coverage map):
  - AC-1: S1–S3, B1, B6, B8, B9
  - AC-2: H2, S4, B1–B3, B7
  - AC-3: K1–K3, C1–C6, H3, S5, B1, B4
  - AC-4: R1, R2, H1, H5, K4–K6, S7, B5
  - AC-5: S8, B10
  - AC-6: H6, S6, B6, B7
- [x] **No criterion silently dropped.** AC-4 was narrowed from "the page" to "the section" at Implementation. The operator approved that in this session ("Go with your recommendation for B5, then start review"), and it is recorded in the story, ADR Amendment 1, test-plan Amendment 1, the book frame and the intake entry. The re-aimed B5 is not vacuous: a section that also read the roster failed it (2 reads against the baseline's 1).
- [x] **No behaviour added beyond the story.** The three small additions ("No owner configured", "Loading…" and the table position) are logged under the story's `## Deviations`.
- [ ] **AC-6's intent, "failure stays contained", does not hold for a malformed profile.** See Blocking 1.

## ADR adherence

- [x] **Files match the ADR's implementation notes:**
  - `secureKeyStorage.js` gains `listStoredAccounts` and `getStoredPubkey`.
  - `assistantKeys.js` gains `countInstanceCustomers(deps)`.
  - The new `src/api/owner/aboutThisInstance.js` is exported from `owner/index.js` and registered beside `owner-info` (`src/api/index.js:358-359`).
  - The route table entry is `public`/`read` (`routeAccess.js:74`).
  - The `openapi.yaml` entry parses and marks `customerCount` nullable.
  - There is a new `AboutThisInstance.jsx` rendered at the end of `/about`, and the link on `/about-brainstorm-search`.
- [x] **Layering is respected.** The count lives beside the mapping it reads. The handler goes through narrowed accessors, and nothing returns a key object.
- [x] **No new dependencies.**
- [x] **Decisions 1–7 are implemented as written.** The count's defaults are top-level imports rather than lazy requires. That makes no practical difference, because `assistantKeys.js` already imports those modules at the top.

## Concept-graph integrity

- [x] Not applicable: no concepts, handles, event kinds or firmware are touched. No firmware reinstall is needed.

## Things tests can't catch

- [x] No secrets committed, no hardcoded TA pubkey (it resolves at runtime through `getOwnerAssistantPubkey`), and no debug logging. The only new log is the handler's `console.error` on failure, server-side.
- [x] No commented-out code.
- [ ] **Error paths: one real gap.** Blocking 1. The other paths are handled:
  - a failed read shows the failure line;
  - a failed profile lookup leaves npubs;
  - an unreadable store gives a null count;
  - an undecryptable file still counts.
- [x] **Concurrency.** No shared mutable state; one store per call. The UI's `cancelled` flag guards every state update after unmount.
- [x] **Security.**
  - **Path traversal:** `getStoredPubkey` validates lowercase 64-hex before `path.join` (K4 includes a `../` attempt).
  - **Private keys:** it decrypts the envelope only, through `this.decrypt`, and never `privkey` or `nsec` (K5 watches it, and a mutant that went through `getRelayKeys` failed it).
  - **Response contents:** the response is exactly four fields, and the 500 body is a fixed string.
  - **Route matching:** the table matches GET and HEAD, any case and a trailing slash; POST and sub-paths fall to `owner`. The customer-or-owner exception in `auth.js` does not cover the route.

## House rules check

- [x] Concept Graph API authority respected (not involved).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

1. **`ui/src/components/AboutThisInstance.jsx:43` and `:56`: a non-string profile name takes down all of `/about` for every visitor.**
   - **Cause:** `name = profile?.display_name || profile?.name || shortNpub(pubkey)`, then `name.charAt(0)`. `/api/profiles` hands kind-0 content through as parsed (`src/api/profiles/fetchProfiles.js:91`), and nostr profiles are anyone's to publish. `ui/src` has no error boundary, and the router (`ui/src/App.jsx:160`) has no `errorElement`.
   - **Reproduced** against the built UI with an Admin's profile of `{ "name": 42 }`, and again with `{ "display_name": { "text": "x" } }`. Each time the whole page became "Unexpected Application Error! r.charAt is not a function". `/about`'s own content was gone too.
   - **Why it blocks:** before this story `/about` showed no profile data, so this is a regression of an existing page that any Owner or Admin profile can trigger. It also breaks AC-6's intent, that a failure in the section leaves the rest of `/about` rendering. The `nip05` and `picture` fields already have `typeof` guards (lines 44–45); the name does not.
   - **Asked change:**
     - **Tester first:** add a failing regression test, for example a browser test B11 in which the Owner or an Admin has `name: 42` and `display_name: {}`. The test checks that the card shows the shortened npub and that `/about`'s own content is intact.
     - **Then the Implementer:** take the first of `display_name` and `name` that is a non-empty string, else the shortened npub.

### Non-blocking

1. **`AboutThisInstance.jsx:56`: a name that starts with an emoji shows half a character as its initial.** `charAt(0)` splits the surrogate pair: `"🧠 Nous"` gave `"\ud83e"`, reproduced. *Optional, and cheap to fold into the Blocking 1 round:* `Array.from(name)[0]`.
2. **`src/utils/assistantKeys.js:203-204`: a holder's stored Assistant pubkey goes into the exclusion set without lowercasing**, while holder names are always lowercase.
   - It is latent: every current writer stores lowercase (`generateRelayKeys`, the restore manifest).
   - The independent check showed an upper-case stored Assistant pubkey leaving that Assistant counted as a customer.
   - *Optional:* `notCustomers.add(hex(assistant))`.
3. **Per-visit cost and logging on an anonymous read.**
   - Each GET reads `/etc/brainstorm.conf` about four times, and `getConfigFromFile` logs two lines per read (`src/utils/config.js:23,31`). The key store logs "Loaded master key from" when its key comes from a file (`secureKeyStorage.js:45`). That is about 9 log lines per visit.
   - The count's I/O is synchronous, about 12 ms per call with 300 key holders (measured by the independent check).
   - This follows the existing pattern (every config read and store construction logs the same way), and the ADR chose no cache.
   - *Follow-up worth noting:* pass the owner and admins into the count instead of re-reading them, or memoise briefly.
4. **A public read can create a directory.** `new SecureKeyStorage()` runs `ensureStorageDirectory()`, so on an instance with a master key but no `secure-keys` directory, the first GET creates it (mode 0750). It is harmless, but the route table says a read "changes nothing". It also means the "missing directory → []" branch of `listStoredAccounts` can't be reached through the default store; C3 reaches it only by deleting the directory after construction.
5. **A wrong or rotated master key is not detected.**
   - Every file then fails to decrypt, so only the TA is excluded as an Assistant, and accounts that are themselves Assistants would count as customers.
   - This follows ADR Decision 3's per-file rule; a whole-store failure is just not told apart.
   - Low likelihood.
6. **A throwing config read inside `countInstanceCustomers` (`assistantKeys.js:200-202`) fails the request (500) rather than giving a null count.** It is latent: the real defaults catch internally, and the handler would already answer 500 for a throwing admin read (H6).
7. **Accessibility.**
   - The Owner / Admins / Customers labels are styled `<div>`s, not headings, so heading navigation finds only the title.
   - "Loading…" has no live region.
   - *Optional.*
8. **Tests.**
   - S3 is a weak source check on its own; B9 and B10 cover the behaviour.
   - C2's "Owner also listed as Admin" assertion cannot fail on its own.
   - No test exercises the handler's real default deps end to end. The independent check did that by hand with a temporary `BRAINSTORM_CONF_PATH`: lower-casing, owner removed from the admins, and a null count with no master key all held.

### Harness friction

1. **This cloud session was pinned to `staging`, so the failing-tests-first convention collided with shared CI.** CI runs the full gate on every PR into `staging`, so pushing the Phase-3 failing tests there would have turned every other open PR red.
   - The repo's practice is to commit failing tests on a feature branch. Recent books did this (`feat/assistant-self-map`), and their `test: failing tests …` commits never sit on `staging`'s first-parent line.
   - The session was not allowed to push to another branch without permission, and the question went unanswered.
   - So the test commit was held locally and pushed together with the implementation once the gate was green. That kept CI green, but it put unreviewed code on staging before this Review.
   - Recorded as ledger row `2026-10-13-staging-pinned-session-vs-failing-tests`.

## Verdict

**CHANGES_REQUESTED**

The diff matches the story and the ADR, the gate is clean, and the feature works live on staging. One blocking defect stands:
- **What:** a malformed Owner or Admin profile replaces the whole `/about` page with an error, for every visitor (Blocking 1).
- **Next:** back to the Tester for a regression test, then to the Implementer for the one-line guard.
- **Same round:** non-blocking 1 and 2 are cheap and can ride along. The rest are notes and follow-ups.

# Round 2

**Date:** 2026-10-14
**Diff:** the round-2 commits are `e61cac6a` (the regression tests, test-plan Amendment 2) and `efd1b1d3` (the fix): `git diff 691b10db..efd1b1d3 -- src ui test tests`. In between, `staging` gained only other books' documentation commits.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`: PASS on the pushed head.** `npm run gate:status` reads `20261014T000151Z-24101-40bd started 2026-10-14T00:01:51.607Z on efd1b1d3 — PASS, exit 0, 6020 passed, 0 failed, 582 skipped, 309/309 suites`. `about-this-instance` passed 29/29, C7 being the new test.
- [x] **Playwright, Chromium: 13/13 pass,** against a build of the round-2 source served by `vite preview`, B11 and B12 included. Before the fix, B11 and B12 failed for the reasons test-plan Amendment 2 records.
- [x] **Live on staging.** Deploy run 716 for `efd1b1d3` completed successfully at 00:03 UTC.
  - The headless check repeats round 1's and holds: the link lands on the section (top at 142 px), there are six cards and no page errors.
  - `GET /api/about-this-instance` still answers exactly the four fields (5 admins, 5 customers).
- [x] _Lint, typecheck, build: not configured._ The UI build succeeds.

## Round 1's findings, each re-derived as a fresh claim

1. **Blocking 1 (a non-string name crashed `/about`): fixed.**
   - The fix is at `AboutThisInstance.jsx:43-44`. The name is `[profile?.display_name, profile?.name].find((v) => typeof v === 'string' && v.trim()) || shortNpub(pubkey)`.
   - Round 1's reproduction was run again against the new build, with seven more hostile shapes added.
   - All nine render `/about` intact with no page error: `{name: 42}`, `{display_name: {…}}`, `"🧠 Nous"`, a bare string, a number, `null`, an array, a whitespace-only name, and `{name: […], nip05: {…}, picture: 5}`.
   - Each falls back to the shortened npub, except the real name "🧠 Nous". `nip05` and `picture` already had `typeof` guards; the last case confirms them.
   - B11 pins the rule, including "the first field that is text wins" (an object `display_name` with a text `name` shows the name).
2. **Non-blocking 1 (half an emoji as the initial): fixed.** `Array.from(name)[0]` at `AboutThisInstance.jsx:57`. "🧠 Nous" now shows 🧠 as its initial (reproduction above), and B12 checks that no lone surrogate remains. Multi-code-point emoji, such as flags or ZWJ sequences, still show their first code point. That is cosmetic, and not worth more code.
3. **Non-blocking 2 (stored Assistant pubkey not lowercased): fixed.** `notCustomers.add(hex(assistant))` at `assistantKeys.js:204`. C7 fails without it (3 instead of 2) and passes with it. `hex()` returns `null` for a malformed value, and `null` is already in the set, so nothing new is excluded by accident.
4. **Non-blocking 3–8 (logging volume, directory creation, a rotated master key, a throwing config read, accessibility, test notes): unchanged by design.** They stay recorded above as follow-ups for the book close. None is a defect against the story or the ADR.

## Findings

### Blocking
None.

### Non-blocking
1. Round 1's non-blocking 3–8 carry forward unchanged, as notes for the book close.

### Harness friction
1. **Round 1's friction recurred in another session the same day.** Book `assistant-scores` pushed its intentionally failing tests (`11d5c626`, "Intentionally failing, awaiting the owner's approval") straight to `staging`, deploy run 717. Added to ledger row `2026-10-13-staging-pinned-session-vs-failing-tests` as evidence.

## Verdict
**PASS**

The round-1 blocking defect is fixed and pinned by a regression test, the two cheap non-blocking fixes are in, the gate is clean on the pushed head, and the feature is live and correct on staging.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed (result in the chat, not here); `/close-book` offered if the book looks complete.
