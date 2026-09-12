# Review: Story 1 — The setup prompt tells the truth

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-11
**Diff:** `git diff f0a5df3b..8d7690ec`. Branch `feat/assistant-profile-setup-prompt`, base `origin/staging` @ `f0a5df3b`. Four commits: `e3ee5014` (ADR), `651d094d` (failing tests), `e5156fc1` (the owner-approved B8 kick-back), `8d7690ec` (implementation).
**Inputs:**
- story `stories/assistant-profile/1-setup-prompt-tells-the-truth.md`
- ADR `decisions/assistant-profile/0001-one-setup-state-answer-local-first.md` (Accepted)
- test plan `stories/assistant-profile/1-setup-prompt-tells-the-truth.test-plan.md`
- epic `epics/assistant-profile.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`.** The full runner can't produce a summary locally: it crashes at suite #2 (OPEN.md #192). So I ran the relevant suites standalone (`node -e "require('./test/<name>.test.js').run()…"`).
  - **`assistant-setup-state`:** 25 passed, 1 failed, 0 skipped. H-class: 2 executed, 0 skipped. H2 passes.
  - **The one failure is H1, and it is environmental.** I checked this rather than assuming it:
    - `docker inspect tapestry` shows the local stack bind-mounts the shared checkout, not this worktree, at `/usr/local/lib/node_modules/brainstorm`.
    - That checkout is on `staging` @ `b6fdc648`. Neither it nor the container's copy of `src/api/assistant/index.js` contains `profileSource` (grep count 0), and it has no `profileState.js`.
    - A live anonymous `GET /api/assistant/status` returns the old key set, without `profileSource`.
    - H1 stays the plan's decisive check, to be run on staging.
  - **Regressions, all 0 skipped and identical to the pre-change baseline:**
    - `admin-tools-dashboard-panel`: 9 passed, 0 failed.
    - `recognizable-published-ta-profile`: 13 passed, 0 failed.
    - `stamped-composite-avatar`: 15 passed, 0 failed.
    - `create-tapestry`: 22 passed, 0 failed.
  - **CI `stack-free` stays the binding gate.** There H1/H2 skip (no stack), so the suite should read 24 passed, 0 failed, 2 skipped. I worked that out from the code and did not run it here.
- [x] **Browser class (`npm run test:playwright`).**
  - I rebuilt this worktree's UI first: `cd ui && npm run build`, exit 0. The new bundle `dist/assets/index-AnlJk4dD.js` contains `needs-setup`.
  - Then I ran `npx playwright test --config <scratchpad>/pw-assistant-profile.config.js tests/brainstorm/assistant-setup-prompt.spec.js --repeat-each 3`. That is chromium, against `vite preview` serving this worktree's `dist/`.
  - **Result: 27 passed in 24.7 s, 0 failed, 0 flaky.**
- [x] **`bash scripts/harness-lint.sh`:** clean (0 violations), exit 0. Pre-existing waivers only.
- [x] _Lint and typecheck not configured, so skipped. No build step besides the Vite UI build above, which is existing tooling._

**Checks beyond the suites.** I used scratch harnesses in the session scratchpad. None were committed, and none write anywhere.

- [x] **I exercised the status handler's caller gate.** I ran `handleAssistantStatus` with a stubbed key store, config and resolver, and recorded the `allowRelayFallback` it hands the resolver. All 12 cases match ADR 0001.
  - **False for:**
    - three anonymous shapes: an empty session, no session, and a pending-auth session;
    - a signed-in guest asking about someone else;
    - a Customer asking about the Owner;
    - `localTrusted: 'yes'`.
  - **True for:** the assistant's own signed-in user, the Owner, an Admin, and `localTrusted === true`.
  - The no-key path never calls the resolver.
  - The full response keeps every earlier field and adds `profileSource`.
- [x] **I exercised the real relay helper against local websocket relays.** These ran on 127.0.0.1 with nostr-tools 2.10.4. The local scan and the import were faked.
  - A forged "newest" kind 0 is dropped, and the newest *valid* one is imported exactly once.
  - Another author's kind 0 alone gives "not found".
  - A dead port gives "not found" immediately.
  - A relay that never answers gives "not found" in 4003 ms.
  - A dead relay plus a good relay gives "found".
  - The pool checks each event's signature and matches it against the filter (`node_modules/nostr-tools/lib/cjs/abstract-pool.js:308`).
- [x] **I probed the five real publish relays, read-only.** I sent one REQ each for a well-known public kind 0, with the local scan and import faked.
  - All five answered, in 168 to 640 ms.
  - The resolver found the profile end to end in 600 ms and 642 ms.
  - So the real path works today, and Blocking 1 is latent rather than active.

## Spec adherence

- [x] **AC1: a profile on the local relay means no prompt, whatever the relays do.**
  - Resolver step 1 answers from the local relay with no relay traffic at all (`profileState.js:124-125`; U1).
  - The `pubkeys=null` race is gone at its cause:
    - no `/api/profiles` setup fetch remains (D1);
    - the hook waits for `authLoading` and re-runs when the user changes (`useAssistantSetupState.js:25-50`; D2).
  - B2 watches the DOM with a MutationObserver while sign-in is delayed 400 ms, and never sees even a transient prompt.
  - A failed check renders nothing (B7).
- [ ] **AC2: a profile only on a publish relay means no prompt, and it is copied home.**
  - This holds when every publish relay answers or fails fast (U2, U3, and my local-relay runs).
  - **It fails when any one publish relay accepts the connection but stays silent past the budget.** See Blocking 1.
- [x] **AC3: no profile anywhere means a prompt, and its button leads where this viewer can publish their own assistant's profile.**
  - Tests: U4, U5, D6. B3 covers an Admin, sent to `/tapestry/settings/assistant`. B4 covers a Customer, sent to `/settings`. B5 covers the Owner.
  - I checked that the destinations work, which B4's mocked URL check alone cannot show:
    - `/settings` renders `AssistantProfileEditor customerPubkey={user.pubkey}` for every signed-in user (`ui/src/pages/BrainstormSettings.jsx:476-478`). That is outside the owner/admin-only block at `:428`.
    - The Tapestry assistant tab renders the same editor for `user.pubkey` (`ui/src/pages/settings/Index.jsx:211-212`).
    - `handlePublishProfile` authorizes `session.pubkey === customerPubkey` (`src/api/assistant/index.js:282`).
- [x] **AC4: visitors and users with no assistant see nothing, and an Admin's or Customer's prompt concerns their own assistant.**
  - The hook returns `'no-assistant'` without making a request (`useAssistantSetupState.js:30-33`; B1, B6).
  - Its only fetch asks about `user.pubkey` (D3). B3 asserts the Admin's own pubkey is the only one asked about.
  - Anonymous calls stay local-only (U7, S2, and the gate harness above).
- [x] **AC5: one answer everywhere, and fresh after a publish.**
  - One resolver sits behind the one endpoint every surface reads (S1, R1).
  - The negative memo never hides a fresh local profile (U8).
  - The hook asks again on every mount and keeps no client cache (B8).
  - The editor reloads status after publishing (`AssistantProfileEditor.jsx:175-184`).
  - "Surprise me" calls `refresh()` (`Dashboard.jsx:776`).
- [x] **No criterion is silently dropped.** Every AC has tests. But AC2's tests cannot see the failure in Blocking 1: the fake stands in for the whole relay list with a single call.
- [x] **No behaviour beyond the story and ADR.** The three logged deviations are judged below.

## ADR adherence

- [x] **Files match the implementation notes.**
  - New: `src/api/assistant/profileState.js` and `ui/src/hooks/useAssistantSetupState.js`.
  - Changed: `src/api/assistant/index.js` and `ui/src/pages/Dashboard.jsx`.
  - Untouched, as the ADR requires: `AssistantProfileEditor.jsx`, the legacy pages, and `fetchProfiles.js`.
  - Tests and the test plan change only in the Phase-3 commits. The implementation commit touches no test file.
- [x] **Layering holds.** The resolver owns the rule, the handler owns the caller gate, and the hook owns the client state. There is no new dependency (`ws` and `nostr-tools` already exist; `package.json` is unchanged).
- [x] **Point by point:**

| ADR 0001 requirement | Where | Evidence |
|---|---|---|
| 1. Scan the local relay first; a hit returns `source:'local'` with no relay traffic | `profileState.js:124-125` | U1 |
| 2. `!allowRelayFallback` returns "no profile" | `:128` | U7 |
| 3. A 5-minute negative memo, per assistant | `:131-132`, `:150-152`, `:157` | U9, U8 |
| 4. Publish relays with `maxWait` 4000, raced against an outer timeout of the same length; an error or timeout means "not found" | `:137-145` | U5, U6, U10. This follows the ADR exactly; see Blocking 1 |
| Keep the newest valid kind 0 by this pubkey | `:146-148` | U2, plus the forged-event harness |
| 5. Import; a failed import is logged, still counts as "has a profile", and is retried next check | `:157-163` | U3 |
| Real helpers required lazily, so the module loads in a bare checkout | `:66-70`, `:80-82` | S4 (only the `child_process` builtin loads at the top) |
| One copy of the scan and the import; the publish path calls it | `index.js:341`; `profileState.js:31-61` | Equivalent to the inline code it replaced |
| `getAssistantPublishRelays()` replaces `EXTERNAL_RELAYS`; publishing and checking share it | `index.js:34-42`, `:356-373`, `:434` | S3, U11. Same five URLs in the same order. Nothing else used the old constant; `nip50-proxy/src/wot-pipeline.js:19` has its own |
| `allowRelayFallback` = the assistant's own signed-in user, the owner or an admin, or `req.localTrusted` | `index.js:421-430` | S2, plus the gate harness (12/12) |
| Keep every response field; add `profileSource` | `index.js:437-448`, `:404` | S5, plus the harness's key set |
| Hook: waits for sign-in; asks about `user.pubkey`; five statuses; errors become `'unknown'`; stale responses ignored | `useAssistantSetupState.js:20-55` | D2–D4; B1, B6, B7 |
| Dashboard: the prompt only for `needs-setup`. The checklist item only when the status is known, done when `set-up`. The block renders once loading ends. Per-role destination. "Surprise me" for the Owner only, with its robohash from `user.assistantPubkey` and `refresh()` on success | `Dashboard.jsx:27`, `:66-74`, `:726-732`, `:761`, `:776`, `:785-803` | D5, D6; B1–B8 |

- [x] **The three logged deviations are all acceptable.**
  1. **The owner/admin check is written inline rather than calling `isOwnerOrAdmin(req)`.** It is the same test as `src/middleware/auth.js:276-284`: an authenticated session whose pubkey is the owner or on the admin list. The gate harness confirmed it case by case, and it avoids importing the middleware into the API module. Note for later: if `isOwnerOrAdmin` changes, this copy will not follow.
  2. **The no-key response also carries `profileSource: null`.** It is additive and gives the endpoint one response shape.
  3. **`realGetPublishRelays` requires `./index` lazily.** That breaks a load-time cycle. The handler passes `getPublishRelays` explicitly anyway, so the lazy path is only a default.
- [x] **Behavioural risk and regressions.**
  - **Publishing is unchanged apart from the two shared helpers.** `handlePublishProfile`'s local write is the same `exec('strfry import', { timeout: 10000 })` piped over stdin. Its relay list, `relays.total` and message are the same.
  - **Every status consumer still gets the fields it reads.** That covers the editor (`AssistantProfileEditor.jsx:67-73`, `:267-272`), `public/pages/nip85.html:164`, `public/pages/customers/customer.html:872`, the `ta-composite-avatar.spec.js` mock, and the live `recognizable-published-ta-profile` suite.
  - **`WelcomeCard` and `OnboardingChecklist` are used only in `Dashboard.jsx`.** Removing `taPubkey` leaves `useConfig` still in use (`Dashboard.jsx:370`).
  - **The no-key early return still omits `isOwner`.** The ADR assigns that to story 4.
  - **Signed-in editor and legacy loads may now wait up to about 4 s** when the local relay is empty. The ADR accepts this latency.

## Concept-graph integrity

- [x] **No concept handle created or changed**, and no firmware reinstall is needed (the ADR says no). The story changes which stores are asked for a nostr event, not the graph.
- [x] **Orientation via `/summaries`:** not applicable, since no new code needs concept orientation.

## Things tests can't catch

- [x] **No secrets.** Only fixture keys (`'a1'.repeat(32)` and so on). The H-class reads the owner pubkey at runtime.
- [x] **No leftover debug logging.** The two `console.warn` calls (`profileState.js:144`, `:161`) are intended operational logs.
- [x] **No commented-out code.**
- [~] **Error paths.** Handled, except the partial-silence case (Blocking 1) and two small client edges (Non-blocking 1 and 2).
- [~] **Concurrency.**
  - The hook ignores stale responses (`useAssistantSetupState.js:34-49`).
  - Two concurrent checks can import twice, which is harmless because strfry de-duplicates.
  - The relay step does have a timing race (Blocking 1).
- [x] **Security.**
  - **Anonymous callers cannot make the server query relays or write.**
    - The gate is false for every unauthenticated shape.
    - `req.localTrusted` is set only for a loopback peer with no `X-Forwarded-For` or `X-Real-IP` header (`auth.js:343-364`).
    - The resolver returns at step 2, before it touches the memo, the relays or the import (U7).
  - **Shell use.**
    - The new scan interpolates only the server-derived `relayKeys.pubkey`, with the same single-quote escaping as before (`profileState.js:32-34`; compare `index.js:94-95`).
    - The import runs a constant command and sends the event over stdin (`:52-60`).
    - The unvalidated `customerPubkey` query parameter still reaches `getKind0DisplayName`'s escaped scan (`index.js:410` → `:94-95`). That is pre-existing and unchanged here.
  - **Copy-home imports only checked events.** An event must pass the pool's signature and filter checks and the resolver's kind/pubkey filter; `strfry import` verifies it again.
  - **No hardcoded TA pubkey.** The Dashboard no longer needs one at all, and the server resolves keys at runtime. The ADR 0015 `LEGACY_*` constants are untouched.
- [x] **Architecture invariants.**
  - POV: the question is always about the viewer's own assistant.
  - Local-first (BIBLE §30): the copy-home only adds to the local relay and never removes from it.
  - Decentralized: nothing gates anyone's events at write time.

## House rules check

- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint, typecheck or build tooling.
- [x] **No docs drift.**
  - BIBLE never described `/api/assistant/status` or `EXTERNAL_RELAYS`: its API tables do not list the endpoint.
  - The `/api/profiles` row (`BIBLE.md:529`) is unchanged and still accurate.
  - "All UI components use `useConfig().taPubkey`" (`BIBLE.md:1068-1071`) is still true.
  - No other document names either one.
  - The epic's survey and the ADR's context are dated history.
  - A suggestion is under Non-blocking 4.

## Product-guide adherence *(when the story traces to a PRD)*

- [x] Not applicable. The book has no PRD (it runs on an acceptance frame), and the user-facing copy is unchanged.

## Findings

### Blocking

1. **`src/api/assistant/profileState.js:137-141` (with `:73`): one silent publish relay throws away a profile another relay already returned, so AC2 fails.**
   - **What AC2 requires.** A kind 0 on *any* publish relay means "has a profile", and it is copied home (story `:42-46`, `:52-54`).
   - **Why it fails.**
     - `realQueryRelaysKind0` asks every relay through a single `pool.querySync`, which is all-or-nothing. It resolves only after *every* relay has closed (`node_modules/nostr-tools/lib/cjs/abstract-pool.js:592-610`).
     - Each relay's `maxWait` EOSE timeout starts only once that relay has connected (`:567`, `:578`).
     - The outer `withinBudget` timer is the same 4000 ms, but it starts before any connection.
     - So if one relay accepts the socket and never sends EOSE, the outer timer always wins. The events a responsive relay already delivered are thrown away. The check returns "no profile", nothing is copied home, and the negative memo (`:150-152`) stops the relays being asked again for five minutes.
   - **Reproduced** with the real helper against local relays:

     | Relays | Result |
     |---|---|
     | One good relay plus one that connects and stays silent | **`hasProfile=false`, 0 imports, 4003 ms** |
     | The good relay alone | found in 15 ms |
     | Good plus one that sends EOSE at 3.5 s | found in 3516 ms |
     | Good plus one that sends EOSE at 3.95 s | found in 3961 ms |
     | Good plus a TCP blackhole | found in 3210 ms |

   - **Impact.**
     - It causes a false "set up your Assistant" prompt, which is this story's own defect class. It hits an assistant whose local relay was wiped or restored. That is the very case the relay fallback exists for, and ADR 0001 lists the self-healing among the gains it enables (`:126-128`).
     - It is latent today: all five publish relays answered from here in under 700 ms.
     - It will trigger whenever any one of the five public relays is overloaded or silently ignores a REQ, which is routine on nostr.
   - **Why the tests missed it.**
     - The U-class fake stands in for the whole relay list with a single call (`test/assistant-setup-state.test.js:90-94`).
     - U6 (`:219-229`) models only a total hang.
     - So this failure cannot be expressed at that seam.
   - **Who owns it.** The implementation follows ADR step 4 exactly, including "an outer timeout of the same length" (ADR `:157-160`). The slip is in that design step, and the code reproduced it faithfully.
   - **Asked change:**
     - (a) A silent relay must cost only its own answer. Events that any relay has delivered by the deadline must count, within the same worst case of about 4 s. For example, race each relay separately within the budget and merge the results, or collect events as they arrive and settle at the deadline. U6 must keep passing.
     - (b) Pin it with a stack-free test through the real helper. Use local websocket relays on 127.0.0.1 (`ws` is already a dependency): one serves a signed kind 0, the other accepts the connection but never answers. Expect "has a profile", `source: 'relay'`, exactly one import, within the budget. No public relay traffic.
     - (c) Record the change to ADR 0001 step 4, either as an Architect amendment or as a logged deviation. The orchestrating session decides which.

### Non-blocking

1. **`ui/src/hooks/useAssistantSetupState.js:44`: a successful response with `hasRelayKey: false` becomes `'needs-setup'`.**
   - `user.assistantPubkey` and the status call both come from `getAssistantKeys`, so they normally agree.
   - They can disagree only if a key-store read fails between the two calls. Then the dashboard shows a false prompt that leads to an editor that cannot publish.
   - Optional improvement: treat `hasRelayKey === false` as `'no-assistant'` (or `'unknown'`).
2. **`ui/src/pages/Dashboard.jsx:66`, `:78`: a failed check can read as "Setup complete".**
   - When the check fails (`'unknown'`), the assistant item is dropped. If the other items are done, the checklist then says "Setup complete".
   - This follows the ADR's wording (the item appears only for `set-up` or `needs-setup`), so it is not a defect.
   - Optional improvement: do not declare the checklist complete while the status is `'unknown'`.
3. **`test/assistant-setup-state.test.js:310-317`, `:404-419`: the caller gate is barely pinned by the suite.**
   - It rests on a source regex (S2) and on the live H1, which cannot pass until deployed.
   - I exercised the gate behaviourally (12/12), but nothing in the suite would catch a regression such as a stray `|| true`.
   - After deploy, run H1 against staging (`BRAINSTORM_BASE_URL=<staging>`). The plan itself names this the decisive check.
   - Optional: add a stack-free handler test using require-cache stubs.
4. **Docs: BIBLE's API tables have no row for `/api/assistant/status`.**
   - The endpoint now has a conditional side effect: a GET that can write to the local relay for the assistant's own user, the owner or an admin, or a loopback caller. It also has a new `profileSource` field.
   - The handler's JSDoc (`src/api/assistant/index.js:382-388`) does not mention the write either; only the inline comment at `:415-420` does.
   - Optional: add the row (near `BIBLE.md:539`) and a JSDoc line.
5. **Loose end: ADR 0001's named follow-up has no OPEN.md row yet.**
   - `/api/profiles` still skips its local fallback when its relay race times out (`src/api/profiles/fetchProfiles.js:123`). The ADR calls it "a candidate OPEN.md row" (`:135-137`).
   - File it so it is not lost.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. **`engineering-team/templates/review-checklist.md:61-66` makes a "changes requested" review read as passed.**
   - The template's closing section heading, `On PASS (same commit)`, comes after `## Verdict`.
   - `scripts/lib/review-verdict.awk:15-21` takes the last verdict token on any heading or bold line.
   - So a review that asks for changes, but keeps the template's order, parses as passed. Harness-lint then raises a false L1 against a story that is rightly not Done.
   - I reproduced it: filling the template's tail after a "changes requested" verdict makes the awk print a pass.
   - This review works around it by putting the approval section above the verdict, as the w14-settlement review did.
   - Suggested fix: move that section above `## Verdict`, retitle it, or have the awk skip it.
   - This should become an OPEN.md `meta` row.

## On approval (same commit)

- [ ] **Not yet applicable.** The story keeps its current status, In Progress. It is not flipped.
- [ ] **Completion detection** is deferred to the approving re-review.

## Verdict

**CHANGES_REQUESTED** — one blocking issue: a single silent publish relay voids AC2's relay fallback (Blocking 1).

Everything else holds up:

- The diff follows ADR 0001 point by point, and the three logged deviations are acceptable.
- AC1, AC3, AC4 and AC5 are met and tested. The browser class passed 27 of 27 over three repeats, and the Node suites match their baselines.
- Anonymous calls never query relays and never write.
- Publishing, the editor and the legacy pages behave as before.

The requested fix is contained: `profileState.js`, one hermetic test with local relays, and a note on ADR step 4. The re-review should be quick.
