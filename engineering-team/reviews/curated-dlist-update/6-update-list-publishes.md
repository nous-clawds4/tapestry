# Review: Story 6 — Update list publishes what I approved

**Reviewer:** Claude (acting as Reviewer; independent reviewer subagent)
**Date:** 2026-09-13
**Diff:** `git diff e1625ea1 4e64b5b6` (24 files, +2830 / −77). Every commit since ADR 0006 was accepted:
- `126f3f8a`, the tests: the new suite, the re-aims, the registration in `test/test.js`, the plan and ADR Amendment 1;
- `24a4c447`, the implementation, by a separate Implementer agent. It touches no test file (`git show --name-only
  24a4c447 -- test/` is empty);
- `4e64b5b6`, docs: the story's entries 13 and 14, nothing else.

- Story: `engineering-team/stories/curated-dlist-update/6-update-list-publishes.md`
- ADR: `engineering-team/decisions/curated-dlist-update/0006-update-publishes.md` (with Amendment 1)
- Test plan: `engineering-team/stories/curated-dlist-update/6-update-list-publishes.test-plan.md`
- Context: ADRs 0001 and 0005 in the same folder; `engineering-team/epics/curated-dlist-update.md`; staging's OPEN.md
  row 310, read pointer-level only.

> **At a glance.** One blocking item, and it is small. The server half holds where it matters most:
> - only the signed-in user can make their assistant sign;
> - nothing the browser sends is signed;
> - deletions and refreshes stay inside my assistant's own copies.
>
> The guards refuse in the ADR's order, in the suite and live.
>
> The blocking item is an honesty gap at the edge of a call. A call's timeouts can add up past nginx's 60 seconds.
> When that happens, or when the connection drops, the page can say "Nothing was published." while the server goes on
> publishing (Blocking 1). The story's record says a call stays inside 60 seconds; the constants say otherwise.
>
> For the operator:
> - **Blocking 1, second half:** a deadline in the endpoint, or an ADR amendment that drops the 60-second claim.
>   Either closes it; the deadline is better.
> - **Non-blocking 1:** the server reads every deletion request my assistant ever made, on every list, so Update stops
>   for good after 500 of them. The fix is the Architect's.
> - **AC-9:** I judge it met, on ADR §10's survey and the per-place read-back (§ Spec adherence).

## Quality gates (run by reviewer, not trusted)

- [x] **The story's suites.** Each ran in its own process through its exported `run()` (the test plan's gate; OPEN.md
      row 310), never as `node test/<file>`. 156 passed, 0 failed:
      - `curated-dlist-update-publish` 50/0 (new)
      - `curated-dlist-update-update-preview` 34/0 (re-aimed)
      - `curated-dlist-update-curation-method` 24/0 (re-aimed)
      - `my-curated-dlists-items` 23/0 (re-aimed)
      - `curated-dlist-update-read-only-curation` 13/0
      - `curated-dlist-update-pointer-switch` 12/0
- [x] **Every other suite whose source names a changed file** (`/usr/bin/grep -l` over `test/*.test.js`), run the
      same way. 267 passed, 0 failed:
      - `dlist-curation-header-endpoint` 29/0
      - `dlist-curation-map-entries` 14/0
      - `dlist-curation-merge-preserve` 16/0
      - `dlist-curation-panel` 18/0
      - `dlist-curation-tl-panel` 19/0
      - `my-curated-dlists-headers` 16/0
      - `my-curated-dlists-page` 19/0
      - `publish-export-a-concept` (RE1) 3/0
      - `scheduled-search-and-house-scores-refresh` 12/0
      - `tl-treasure-map-optin-publish` 23/0
      - `tl-treasure-map-panel` 18/0
      - `treasure-map-panel-summary` 18/0
      - `treasure-map-relay-presence` 35/0
      - `treasure-map-relay-sync` 22/0
      - `treasure-maps-router-preset` 5/0

      Together, 21 suites and 423 tests, with 0 failures. I read every network-shaped line in these suites first.
      Each is a regex over source or an injected fake; none makes a request.
- [x] **The tests fail without the change.** I ran them on a `git archive` snapshot of `126f3f8a` in the scratchpad:
      - the new suite: 2 passed, 48 failed. Only the R1 and R2 sentinels pass;
      - `curated-dlist-update-update-preview`: 33/1 (S5);
      - `my-curated-dlists-items`: 22/1;
      - `curated-dlist-update-curation-method` 24/0 and `curated-dlist-update-read-only-curation` 13/0.

      That is the test plan's § Verification exactly.
- [x] **`harness-lint`:** clean, 0 violations (waivers only).
- [x] **Full `npm test`: not re-run.** I judge the recorded run sufficient, for four reasons:
      - `24a4c447` → `4e64b5b6` is docs-only: `git diff --stat` shows the story file alone (32 lines). So Deviation
        14's full run at `24a4c447` ran exactly this code.
      - Its reds are the known set: row 191's four, and `summaries-element-count` L5. The flaky
        `most-pinned-tag-index-publish` passed that time (row 293).
      - Every suite that reads a changed file passes in my own run (above).
      - A re-run takes about 40 minutes and adds fixtures to the shared stack (rows 293–294). It would cover no code my
        run doesn't.

      There is no `gate:status` line to quote, because this branch has no gate recorder (Harness friction 1). The full
      run rests on the story's record.
- [x] **The deployed endpoint, read-only.**
      - The container's `update.js`, `updateEvents.js` and `index.js` are byte-identical to the worktree's (SHA-256).
      - Its nostr-tools is 2.10.4.
      - No request carried a session, so none could reach the key or the signer.

      The answers:
      - **In the container, over loopback, past the middleware:**
        - a foreign `Origin` → 403 "a request from another site is refused";
        - `Origin: null` → 403;
        - the same host → 401 "authentication required";
        - no `Origin` → 401.
      - **From the host, through the container's nginx (`127.0.0.1:8080`):** no session → the middleware's 401, with or
        without a foreign `Origin`.
- [ ] `npm run test:playwright`: not applicable, because the plan has no browser class. The browser run was the
      orchestrator's fetch-stub check (the story's entry 13).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test, apart from the parts the plan gives to the local check.
- [x] No criterion is silently dropped.
- [x] No behavior beyond the story, apart from small recorded additions:
  - Deviation 9's "⚠️ Couldn't check …" line;
  - Deviation 10's words;
  - Deviation 8's `useListItems` change. The hook's only caller is this page.

Per criterion:
- **AC-1:** S1, S3 and H10. A read-only list keeps a disabled Update (the read-only suite, 13/0). Met.
- **AC-2:** H7, H24, H8, H18, H19, S2, S4 and U1. Met. I traced the browser's re-check, and the fresh plan settles
  only on reads made after the press:
  - `useListItems` reports loading until the current key's read is in;
  - `useItemVotes` answers only for its key;
  - the weights are read again as the votes come back, and `weightsState` waits for a weight per pubkey;
  - the header's `refresh()` holds `headerState.state` at `checking`.
- **AC-3:** P1–P3, H10, H20 and U5. Met.
- **AC-4:** P4, H10, H23 and U5. Met.
- **AC-5:** P5, H9, H10, H15, U2 and U5. Met.
- **AC-6:** P6, H10, H18, H20, U2, U3, U5, S1 and S6. Met. I checked the marked header in the browser's util, with the
  tags in either order. It reads as the older link with no problem, the marker set, and a shared list available. So
  the preview offers the upgrade with the marker clause, and the server drops the marker.
- **AC-7:** H1–H5, S9, S10 and the live refusals above. Met.
- **AC-8:** H10–H13, H21, H22, S2 and S4. Met on the server. Nothing in the publish path retries; the one bounded retry
  is `readRelayEvents`' connect, which is a read. One browser path is not honest: Blocking 1.
- **AC-9:** H14–H16 and S5. Met; see the judgment below.
- **AC-10:** S3, H17, H7, R1 and R2. Simple Lists' pages call `useTrustWeights` with one argument, as before, so they
  are unchanged. Met.
- **AC-11:** U4, S6, S7 and S8. Met.

**AC-9's "checked before the story is done".** I judge it met.
- **What was checked.** ADR §10's read-only survey:
  - **This instance's strfry** is 1.1.0. It stores kind 5 and honors both forms for the same author. It refuses a
    re-send of what it deleted, and it rejects a deletion whose `a` names another author. All of this is read from
    source.
  - **The community relay** is strfry 1.0.4, by its NIP-11. It stores kind 5: it holds 55, and none of their `e`
    targets remains, which is an observation. It honors only `e`.
- **What the design does with that.** It never relies on the `a` form where the `a` form is missing:
  - each deletion names every version the server read (H15);
  - a re-copy is timed after the deletion (H16);
  - the read-back reports `gone` or `still-there` per place (H14), and the page flags a copy a place still shows.

  The one residual is row 297: an older version, replayed to strfry 1.0.4, is accepted again.
- **What wasn't done:**
  - a live public write. The operator ruled that out at the Architecture gate;
  - the optional scratch-stack check of the local `a` form (Deviation 12).

  If the local `a` form misbehaved, the `e` tags would still remove the named versions, and the read-back would say
  `still-there` rather than trust it.

The check the AC asks for came before anything relied on it. The first real Update's read-back is an honest live test,
not an assumption.

## ADR adherence
- [x] **Files match the implementation notes:**
  - `updateEvents.js` is pure: the four composers and `validateUpdateBody`;
  - `update.js` has `createUpdateHandler`, with exactly the ten injected seams, and is registered from `index.js`;
  - `treasureMap.js` has the pins, `planIntents`, `marker` and `own`;
  - the five pages and three hooks;
  - §11's three notes, and OPEN.md rows 295–297.
- [x] **Layering:**
  - the publisher lives in `src/api/dlist-curation/`, inside RE1's exclusion (3/0);
  - the route clears every owner-only substring (S10);
  - nothing touches the graph (S9). No kind-5 or `q` consumer exists anywhere else in `src/`.
- [x] **No new dependencies:** nostr-tools and ws are already present, and load through the fallback.

The Implementer's twelve deviations, judged:
- **1, host names:** sound. It is necessary behind nginx on a non-default port; the residual is Non-blocking 2.
- **2, 3, 4 and 7:** fair readings. These are guard 4's order, the 409 for a header that names no one shared list, the
  two extra stale checks, and the limit on Amendment 1's three reads only. Deviation 4 applies Amendment 1's intent at
  the copy's address.
- **5, publishing:** one connection per relay, and a relay that can't be reached costs one attempt, is good design. Its
  closing claim, "a call stays inside nginx's 60 seconds", is not what the constants give: Blocking 1.
- **6, "failed: sent, but couldn't read it back":** honest. §4 has no word for "unconfirmed".
- **8, the re-check waits for fresh reads:** necessary, and correctly scoped.
- **9–11, the deletion read's warning line, the words, the panel's kept second sentence:** fine.
- **12, the optional scratch-stack check not done:** acceptable; see AC-9.

## Security (the brief's first concern)
Pointer-level only, per staging's row 276.
- **Guards.** They run in the ADR's order, before anything is read (`update.js:313–327`):
  1. Origin;
  2. `requireAuth`, a verified session, whose pubkey is the only identity;
  3. `getAssistantKeys(session pubkey)`;
  4. the body: another assistant's list gets 403, before the count's 413.

  More on the key:
  - there is no `isOwner` and no `getOwnerAssistantKeys`, and nobody named in the body is used (H4, S9);
  - an admin gets their own assistant, never the instance's;
  - an account with no stored private key gets 400. That includes `getCustomerRelayKeys`' object of nulls (H3).
- **Body.** Strict shapes: 64-hex ids and pubkeys, d-tags of 1–256 characters with no control character, and at most
  50 intents (P7, H6). Only the validated fields go on.
- **Nothing client-sent is signed.** Every signed event is built from the server's own reads: the original's tags and
  content, my header's tags, the copy's versions. The body's pins are only compared (H17). The one body string that
  reaches a signed event is `list`, and it must be my assistant's coordinate and name a header the server found.
- **Scope.**
  - A delete or refresh must name my assistant's kind-39999 item under my header whose newest version carries a `q`
    (Amendment 1; H9).
  - A deletion's `a` is always my assistant's own address, and its `e`s are versions of that address only (P5).
- **Shell and imports.** The scans use `spawn` with an argument list, the import goes through `publishToStrfry`'s
  stdin, and nostr-tools and ws load with the fallback (S9).
- **Honest reporting on the server.** All of this is pinned (H7, H11–H14, H24):
  - a failed read, or one of 500 events or more, gets 503 before anything is signed;
  - the settled value is read, so a fulfilled "connection failure" is `failed`;
  - each event is read back by id;
  - `isLocalOnly()` skips every relay.
- **Failure modes.** Partial failures are reported per item and per place (H12, H13, H22). Timeouts are Blocking 1.
- **Cross-site.** Guard 1 is sound behind nginx:
  - both the host nginx and the container's nginx forward `Host $host` (`OPERATIONS.md:245`; `docker/nginx.conf`);
  - so a same-site page's Origin names the host the app sees;
  - and a foreign site can't forge `Origin`.

  The residual is Non-blocking 2.
- **Concurrency.** Two tabs publishing the same plan converge:
  - copies live at derived addresses and replace each other;
  - a repeated deletion is harmless;
  - the upgrade is replaceable.

  A refresh that loses to a deletion made in the same second reads back as `not-stored`, which is honest.

## Concept-graph integrity
- [x] **Handles in `kind:pubkey:slug` form.** The story names `39998:<TA>:list` and `39998:<TA>:tapestry-assistant`,
      resolved at runtime. The new code composes no concept handle and carries no pubkey literal (S9, and a sweep of
      the diff).
- [x] **Firmware reinstall:** not needed; no concept definition changes (ADR § Consequences).
- [x] **Orientation:** the new code reads no concept and no BIBLE section, so there is nothing to orient.

## Things tests can't catch
- [x] No secrets: the diff adds no nsec, private-key literal or 64-hex literal outside `test/`.
- [x] No debug logging, `debugger` or TODO added in `src/` or `ui/`.
- [x] No commented-out code.
- [ ] Error paths: one isn't honest (Blocking 1).
- [x] Concurrency considered (§ Security).
- [x] Input is validated at the boundary; I found no injection vector.

## House rules check
- [x] Concept Graph API authority respected: no concept is read or changed.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence *(when the story traces to a PRD)*
Not applicable: the book is an acceptance frame, with no PRD.

## Findings

### Blocking
1. **The page can say "Nothing was published." after the server published.** The words are at
   `ui/src/pages/grapevine/UpdatePreview.jsx:53`, with `:64`, and `ui/src/pages/grapevine/CuratedDListItems.jsx:235–240`
   feeds them. The timing is in `src/api/dlist-curation/update.js:34–36` and `:460–482`.
   - **Why a call can outrun nginx.** ADR 0006 §6 says a call "stays well inside nginx's default 60-second proxy
     timeout" (`0006-update-publishes.md:222–223`), and Deviation 5 says it does (`6-update-list-publishes.md:162–163`).
     The per-step budgets don't bear that out:
     - my header, my list and the deletion requests are read together. A relay read may take two 5-second connects and
       a 5-second query (`src/api/_shared/relaySource.js:91–92`, `:247`), so up to 15 seconds;
     - the shared list is read afterwards: up to 15 seconds more;
     - this instance's imports run one after another, at up to 5 seconds each (`src/api/trustedList/index.js:90–91`);
     - each relay gets at most 4 sends in flight, each allowed 5 seconds (`update.js:33`, `:36`), and the groups run in
       turn. So 50 intents to a relay that doesn't answer OK within 5 seconds take up to 65 seconds on their own;
     - the read-back adds up to 30 seconds per place.

     So one 50-intent call can take about two minutes, before the local imports. Two things trigger it:
     - a slow but reachable community relay;
     - a second `aDListRelays` entry that accepts connections and never answers. It is published to, but never read
       first.
   - **What the page then says.**
     - nginx answers 504, while Node carries on publishing.
     - `publishIntents` turns a 504, or a dropped connection, into `refusal.kind: 'error'`.
     - On the first call, `PublishResults` shows "Nothing was published." above "⚠️ Publishing stopped: the server
       answered 504".

     The re-read afterwards shows the true list, but by then the page has said the opposite of what happened. AC-8 says
     "A partial failure is shown, never hidden."
   - **Asked change (Implementer):**
     1. When a call's outcome is unknown, don't say "Nothing was published." Unknown means a network error, or any
        answer that isn't one of the endpoint's own refusals before signing: 400, 401, 403, 409, 413 or 503. Say instead
        that the call's outcome is unknown, and that the list has been read again, so the fresh preview shows what
        landed. Add a local-check line with the stub answering 504. A structural pin is the Tester's call.
     2. Make the 60-second claim true, or withdraw it. Either of these works:
        - give the handler a deadline comfortably inside 60 seconds. It stops starting new sends, reports what it didn't
          send as `failed`, "not sent: out of time", and reads back what it did send;
        - or, if the Architect prefers, amend ADR 0006 §6 to drop "stays well inside" and rely on (1).

        Correct Deviation 5's sentence either way.

### Non-blocking
1. **Update stops for good after 500 deletion requests by my assistant, across all its lists.** The read is at
   `src/api/dlist-curation/update.js:339`, with its capped words at `:344`; the filter is ADR 0006 §2's, capped by
   Amendment 1.
   - The server reads `{ kinds: [5], authors: [assistant], "#k": ["39999"] }`. That is every deletion my assistant ever
     sent for any kind-39999 item, on any list. None is ever removed, and each Update deletion adds one.
   - At 500 in either place, every call answers 503, "couldn't check every deletion request by your assistant". The
     preview still offers Publish, because the browser's read of the same filter only warns (`useDeletionRequests`,
     `CuratedDListItems.jsx:258–289`).
   - The server uses these requests only to time a re-copy (`deletedAt`, `update.js:118–127`, `:442`). That needs only
     the requests naming this call's copy and refresh addresses, which number at most 50.
   - **Suggested, for the Architect:** narrow the server's read to `#a` over those addresses in an amendment, or record
     the ceiling as an OPEN.md row.

   It fails closed and honestly, and today's lists hold two items, so it doesn't block.
2. **Guard 1 compares host names, so it admits the same host on another port** (`update.js:97–105`; Deviation 1).
   - Against a foreign site the check is sound. A port-sensitive check would refuse every local publish through
     `127.0.0.1:8080`, where nginx forwards `Host` without the port.
   - **The residual** lies in the control panel's CORS and cookie posture (ADR 0006 § Context), not in this endpoint.
   - **Ask:** carry this point into the separate CORS and cookie hardening task (staging's row 276 follow-ups). Keep it
     pointer-level.

   *Trimmed to pointer-level by the orchestrator on 2026-09-13, under the standing rule for security detail in committed
   text. The full point went to the CORS and cookie hardening task.*
3. **The server reads the list's relay from settings, and the browser reads it from a constant.** The server uses
   `aDListRelays[0]` (`update.js:331–333`). The browser uses `COMMUNITY_RELAYS[0]` (`ui/src/pages/grapevine/CuratedDListDetail.jsx:16`;
   `ui/src/hooks/useCommunitySharedConcepts.js:9`).
   - Both are `wss://dcosl.brainstorm.world` by default (`src/config/defaults.json:9–11`).
   - If an operator changes `aDListRelays`, the server checks and reads back one relay while the preview reads
     another. A plan can then come back 409 on every press. It fails safe.
   - **Optional:** say so in ADR 0006, or read both from one place.
4. **What stays unpinned, by the plan's choice.** These rest on structure and the orchestrator's fetch-stub check:
   - the browser's run: its calls of at most 50, and its stop at a refused call;
   - the deletion flag and its place (`CuratedDListItems.jsx:384–395`, rendered at `:440`);
   - `relaySessions`' one connection per relay;
   - `scanStrfry`'s non-zero exit;
   - `Origin: null`.

   I confirmed `Origin: null` live (403). Nothing to do, unless the Tester wants pins in round 2.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **The Reviewer's instructions say to quote an `npm run gate:status` line, but this branch has no gate recorder.**
   - They point at `engineering-team/README.md` § "Running and reading the test gate". Neither that section nor the
     `gate:status` script exists on this branch.
   - Both are on `origin/staging` (`package.json:14`; the README's `:57–63`), 42 commits ahead.
   - So no full run on this branch can be quoted as a `gate:status` line, and Deviation 14 is a prose record.
   - **Candidate:** until the branch merges staging, a review on it says the recorder is absent and rests on the
     recorded run. This needs a new `meta` row, for the orchestrator to file.
2. **Row 294 again.** The Reviewer role still requires a full `npm test`. Like stories 4 and 5, this review rests on a
   recorded run at the same code, and on every suite that reads a changed file. Row 294 already covers it, so no new row
   is needed.

## Verdict
**CHANGES_REQUESTED**

**Why.**
- **The server is right where it matters most.**
  - The key follows the session, and the guards refuse in order.
  - Nothing client-sent is signed, and deletions and refreshes stay inside my assistant's copies.
  - Every read is strict and capped.
- **The evidence.** All 423 tests I ran pass. The new tests failed without the change, as recorded. The deployed files
  are the reviewed ones.
- **What blocks.** One reachable path makes the page state something false. After a timeout or a dropped connection, it
  says "Nothing was published." while the server published. That is the kind of error this book's honest-reporting
  work exists to prevent, and the story's record claims a bound the code doesn't have. Both halves of Blocking 1 are
  small.
- **Round 2.** The fix touches `UpdatePreview.jsx` and `CuratedDListItems.jsx`, and perhaps `update.js`. Re-run the
  suites that read them (the lists above) and `harness-lint`.

The story's status stays as it is, and completion detection waits for a passing round.

## Round 2

**Reviewer:** Claude (acting as Reviewer; independent reviewer subagent)
**Date:** 2026-09-17
**Diff:** `git diff c1c2d079 8dd2d79b` (9 files, +1151 / −58), in four commits:
- `08dafb5b`, ADR 0006 Amendment 2, OPEN.md rows 299 and 300, and the story's Deviation 5 correction;
- `5bc766b1`, the round-2 tests, the plan's round-2 section, and Amendment 3. It touches no source file;
- `f0abfb3c`, the implementation, by the same separate Implementer agent as round 1. It touches no test file
  (`git show --name-only f0abfb3c -- test/` is empty), and it carries the story's Deviations 15–22;
- `8dd2d79b`, docs: the story's Deviations 23 and 24, nothing else.

> **At a glance.** Round 1's Blocking 1 is fixed, both halves, and nothing else was disturbed.
> - **The honesty half.** "Nothing was published." now renders only when no call's outcome is unknown
>   (`UpdatePreview.jsx:58`), and an answer that isn't the endpoint's own is sorted into `unknown` by a pure function
>   (`treasureMap.js:1041–1057`). A 504, a 502, a 500, a 3xx, a body that can't be read and a dropped connection all
>   reach the unknown sentence instead.
> - **The timing half.** A call is now bounded: no send starts after 25 s, the read-back is raced against what is left
>   of 45 s, and the clock starts before the guards. The composition answers inside nginx's 60 seconds on every path I
>   could construct.
> - **Amendment 3 is right about this endpoint.** Every 4xx it can answer is answered before `d.sign` is ever called;
>   after signing it answers only 200, or 500 from its catch. The auth middleware's body-less `401 { error }` is the
>   case it was written for, and that string is real (`src/middleware/auth.js:482`).
>
> The four flags the Implementer raised at its gate are all non-blocking; each is honest in what the page says, and
> three are recorded in the ADR or the Deviations already. I add one of my own: the read phase sits *outside* the
> deadline, so "45 seconds" holds only in composition with `relaySource.js`'s own timeouts.
>
> **PASS.**

### Quality gates (round 2) — run by reviewer, not trusted

- [x] **The 13 suites that read a changed file.** Each in its own process through its exported `run()` (OPEN.md row 310),
      never as `node test/<file>`. **306 passed, 0 failed:**
      - `curated-dlist-update-publish` 69/0 · `-update-preview` 34/0 · `-curation-method` 24/0 · `-pointer-switch` 12/0 ·
        `-read-only-curation` 13/0 (152);
      - `dlist-curation-header-endpoint` 29/0 · `-map-entries` 14/0 · `-merge-preserve` 16/0 · `-panel` 18/0 ·
        `-tl-panel` 19/0 · `my-curated-dlists-headers` 16/0 · `-items` 23/0 · `-page` 19/0 (154).
- [x] **The tests catch a regression of Blocking 1.** Four mutations, each applied in a *throwaway* worktree at
      `8dd2d79b` (baseline 69/0), one at a time, restored and syntax-checked after each. The worktree was removed
      afterwards (`git worktree remove --force`; it is gone from `git worktree list`):
      1. `UpdatePreview.jsx:58` back to round 1's unguarded `{results.length === 0 && …}` → **S12 fails**, naming the
         condition it found. That is round 1's Blocking 1 exactly;
      2. the relay send's `if (!canSend())` guard (`update.js:522`) deleted → **H25, H26, H27, H30 fail** (65/4);
      3. `updateAnswer`'s final `unknown(...)` turned into an `error` refusal, so a 504 reads as a refusal →
         **U8 fails**;
      4. the by-id read-back un-bounded (`readBefore` → `readPlace`, `update.js:319`) → **H28 fails** inside its
         4-second real-time bound, with the plan's `HUNG` message. It fails the test rather than stalling the suite,
         which is what `within()` is for.
- [x] **`harness-lint`:** clean, 0 violations (waivers only).
- [x] **Control bytes.** All nine changed files swept for bytes 00–08, 0B, 0C, 0E–1F and 7F: **0 in every file**,
      the suite included. (Round 1's raw NUL and U+001F in P7 are now `String.fromCharCode(0)` / `(31)`.)
- [x] **No gate line to quote.** This branch has no gate recorder — neither `npm run gate:status` nor the README
      section the instructions point at (OPEN.md row 298, filed from round 1's Harness friction 1). This review says
      the recorder is absent rather than quoting a line that cannot exist.
- [x] **Full `npm test`: not re-run, and the recorded run is at the reviewed code.**
      - `f0abfb3c` → `8dd2d79b` is docs-only: `git diff --stat` shows the story file alone (37 lines). So Deviation
        24's run at `f0abfb3c` ran exactly this code.
      - I read the run's own log rather than the prose: `curated-dlist-update-publish` **69/0**, and every neighbouring
        suite at the counts Deviation 24 gives (header endpoint 29, panel 18, map entries 14, merge-preserve 16, TL
        panel 19, page 19, headers 16, items 23). Its reds are the known set — row 191's four failures across
        `tl-membership-method-selector`, `tl-weighted-sum-method` and `tl-certainty-method`, plus
        `summaries-element-count` L5 — and 56 skipped. `most-pinned-tag-index-publish` passed (row 293 is flaky).
      - Every suite that reads a changed file passes in my own run above. A re-run would cover no code my run doesn't,
        and each one leaves fixtures on the shared local stack (rows 293–294). I do not think one is needed.
- [x] **The deployed endpoint, read-only.** The container's `update.js`, `updateEvents.js` and `index.js` are
      byte-identical to the worktree's (md5), and the served bundle
      (`dist/assets/index-DKVp6eWS.js`) carries the unknown sentence. I changed nothing, restarted nothing and
      published nothing.
- [ ] `npm run test:playwright`: not applicable — the plan has no browser class. The browser evidence is the
      orchestrator's fetch-stub check (Deviation 23).
- [ ] _Lint not configured — skipped._ _Typecheck not configured — skipped._ _Build not configured — skipped._

### Spec adherence (round 2)

Round 1's per-criterion findings stand. Only **AC-8** changes, and it is now met on both halves:

- **AC-8, "A partial failure is shown, never hidden."** The browser half is fixed. `publishIntents`
  (`CuratedDListItems.jsx:229–245`) no longer maps every unexpected answer to a refusal; it hands `(status, body)` to
  `updateAnswer` and stops at the first answer that isn't results, keeping the earlier calls' results. `PublishResults`
  (`UpdatePreview.jsx:51–79`) prints the results first, then the refusal line by kind, and prints "Nothing was
  published." only when `results.length === 0 && !unknown`. Pinned by U6–U8 (the sorting), S11 (the sentence, its fixed
  parts exact), S12 (the condition reads the unknown kind) and S13 (the blanket mapping is gone).
- **AC-8, "Nothing is retried on its own."** Still true. An out-of-time call is a 200, not a refusal, so the run
  continues to the next call, which re-reads first (§6). The next preview proposes what is still missing — the list is
  re-read after every run (`CuratedDListItems.jsx:379`).
- **AC-9** is unchanged; a deletion's copy re-read that runs out of time claims neither `gone` nor `still-there`
  (`update.js:330`; H29).

No criterion is dropped, and I found no behavior beyond the story and the two amendments.

### ADR adherence (round 2)

- [x] **Amendment 2, change 1 (the deadline).** `DEADLINE_MS = 45000`, `READBACK_RESERVE_MS = 10000`,
      `SEND_CUTOFF_MS = 45000 − 10000 − (5000 + 5000) = 25000` (`update.js:39–46`) — derived exactly as the amendment
      words it. The clock starts at `update()`'s first line, before the guards (`:350`). `canSend()` is evaluated
      before *each* import (`:513`) and before *each* relay send at its turn, including one queued behind the four in
      flight (`:522`). `nowMs` is injected, `Date.now` by default (`:298`), and `now` is still the `created_at` clock.
- [x] **The arithmetic closes.** I walked every await between the handler's start and its answer:
      - **reads:** `Promise.all` over my header, my list and the deletion requests (≤15 s: `readRelayEvents` is two
        5-second connects plus a 5-second query, `relaySource.js:243–255`, `:268–280`; a local scan is capped at 10 s,
        `update.js:36`), then the shared list (≤15 s). ≤30 s, plus signature verification of what comes back;
      - **sends:** `publishToStrfry` is killed at 5 s (`src/api/trustedList/index.js:85–88`), and one relay send is
        `withTimeout(connect, 5000)` then `withTimeout(publish, 5000)` (`update.js:266–273`). Only a send that started
        before 25 s can still be running, so the send phase ends by 25 + 10 = 35 s — and the local loop's 5-second
        overshoot and the relay's 10-second one cannot both happen, because the first pushes `canSend()` false for the
        second;
      - **read-back:** raced against `deadline − nowMs()` (`:176–189`), so it ends at the deadline. With ≥10 s left by
        construction.
      The two live paths round 1 named both close: a slow-but-reachable community relay, and a second `aDListRelays`
      entry that accepts connections and never answers (it is published to, never read first) — both are send-side, and
      both are cut at 25 s.
- [x] **The read-back race is correct.** Timers are cleared in a `finally` (`:186–188`); `readPlace` catches everything
      and never rejects, so there is no unhandled rejection; the loser's answer is dropped and cannot write into
      `s.places` after the answer, because `readBack` only ever reads the raced value. `left ≤ 0` (or `NaN`) returns
      out-of-time without starting a timer.
- [x] **Amendment 2, change 3 (the narrowed read).** `{ kinds: [5], authors: [assistant], '#a': copyAddresses,
      limit: 500 }` over each copy intent's derived address and each refresh's `copy`, de-duplicated, and skipped
      entirely when there are none (`:376–388`). The addresses are exactly the ones `deletedAt` is later asked for
      (`:492`, against `w.copy`), so §3's timing loses nothing. H31 pins the filter's shape and its `#a` as a set,
      H32 the skip, H33 that 520 unrelated requests no longer 503.
      - **A deletion that names the address only in `e`.** §3's timing exists because strfry 1.1.0 refuses a version at
        an `a`-deleted address that isn't newer than the deletion. An `e`-only request blocks only the exact ids it
        names, and a re-copy carries a new id — so the narrowed read misses nothing the timing needs. Every deletion
        this system composes carries the `a` anyway (`composeDeletion`, P5).
      - **An address deleted more than once:** `deletedAt` takes the newest match (`:129–137`); the read returns all of
        them.
      - **The capped rule** still applies to the narrowed read (Amendment 1), and now needs 500 requests naming this
        call's ≤50 addresses rather than every request the assistant ever sent. Its *words* still say "every deletion
        request by your assistant" — non-blocking 4 below.
- [x] **Amendment 3 is true of this endpoint as written.** Every 4xx it answers is at `:356` (Origin), `:358` (the
      injected `requireAuth`), `:362` (no key), `:365`/`:367`/`:368` (the body and the list's owner), `:394`/`:414`
      (503) and `:405`/`:480` (409). The first `d.sign` is at `:500`. After it, the only exits are `res.json({ success:
      true, results })` at `:544` and the catch's 500 at `:555`. Everything in front — the auth middleware
      (`auth.js:482`, `:496`), the body parser, nginx — answers before the handler runs at all. The rule holds, and the
      ADR records the obligation on any later change.
- [x] **`updateAnswer` follows Amendment 3, not Amendment 2 alone** (`treasureMap.js:1041–1057`): the endpoint's 409 and
      503 keep their own words, *any* other 4xx is a refusal with the body's `error` or "the server answered <status>",
      and everything else is unknown. A 503 without the endpoint's body stays unknown, which is the safe direction.
- [x] **Files match the implementation notes:** `update.js`, `treasureMap.js` (`updateAnswer`, beside `planIntents`),
      `CuratedDListItems.jsx` (`publishIntents`), `UpdatePreview.jsx` (the sentence and the guard). Nothing else.
- [x] **No new dependencies**, no new tooling, no shell, no graph access, no pubkey literal, no `console.log`,
      `debugger`, TODO or commented-out code in the four changed source files.

**The Implementer's Deviations 15–22, judged.** Each is a fair reading of room the amendments left, and each matches
what the code does:
- **15 and 16 (the read-back's races, and a copy re-read that runs out):** sound, and the plan explicitly leaves both
  the "skipped or raced" choice and the copy re-read's two acceptable answers open. Deviation 15's last line — an
  abandoned read runs on to its own timeout — is true and harmless; see Non-blocking 7.
- **17 (everything is signed before the first send):** true, and the results keep one row per write, which is why an
  all-out-of-time call still reports per item. Non-blocking 6.
- **18 (where the cutoff is checked):** matches `:513` and `:522` exactly, the local-only branch included.
- **19 (the narrowed read's shape and its unchanged gap words):** accurate; the second half is Non-blocking 4.
- **20 and 21 (`updateAnswer`'s and `publishIntents`' edges):** accurate, and each is pinned. The one that matters most
  — a connection dropped while the body is read counts as no body, so a 200 reads "the answer couldn't be read"
  rather than as results — is right.
- **22 (where the unknown sentence sits):** accurate.
- **23 and 24 (the orchestrator's local check and regression):** I verified 24 against the run's own log, and 23's
  server half against `auth.js:482`; its browser half is consistent with the code I read, and the container's files
  are the reviewed ones.

### Security (round 2)

Pointer-level only, per staging's row 276. **The round-2 server diff is surgical, and none of round 1's guarantees
moved.** I re-read the whole diff for `update.js` line by line:
- **The guards' order is untouched** (`:356–368`): Origin, then `requireAuth`, then `getAssistantKeys(session pubkey)`,
  then the body with the list's owner before the 413. The two new lines above them only read the clock.
- **The key choice is untouched:** no `isOwner`, no `getOwnerAssistantKeys`, and nobody named in the body is used
  (H4, S9 still pass).
- **Nothing client-sent is signed.** The signing block (`:486–503`) is unchanged; H17 still passes.
- **Deletions and refreshes are still confined to my assistant's own copies** (`:438–470`, Amendment 1's rule 1,
  unchanged; H9).
- **The reads are no less strict.** The narrowed read keeps `authors: [assistant]` and `limit: 500`, and a failure or a
  cap still 503s before anything is signed. Its `#a` values come from `validateUpdateBody`, which requires each
  `refresh.copy` to be a kind-39999 coordinate with a 64-hex pubkey and a d-tag of 1–256 characters with no control
  character (`updateEvents.js:168–173`), and from `copyD`, which the server derives itself. At most 50 addresses, so no
  new argv- or filter-size hazard, and the local scan still uses `spawn` with an argument list.
- **The new failure modes are honest.** "not sent: out of time" and "sent, but couldn't read it back: out of time" both
  say what happened; neither claims a publish, and neither hides one.
- **Nothing is answered twice.** `requireAuth` writing its own 401 returns `undefined` from the handler, `readBack`
  cannot throw, and the catch's 500 can only fire before `res.json` is reached.
- **Concurrency:** unchanged from round 1. A second tab converges; an abandoned read cannot write into a finished
  answer.

### Concept-graph integrity (round 2)
- [x] No concept handle is composed, no pubkey literal appears, no concept definition changes — so no firmware
      reinstall, and nothing to orient via `/summaries`.

### House rules check (round 2)
- [x] Concept Graph API authority respected: nothing here reads or changes a concept.
- [x] No new lint, typecheck or build tooling.

### Findings (round 2)

#### Blocking
None.

#### Non-blocking
1. **The read phase sits outside the deadline, so "45 seconds" is a composition, not an enforced bound.**
   `src/api/dlist-curation/update.js:382–388` and `:412` are plain `await`s; only the sends (`:513`, `:522`) and the
   read-back (`:533`) consult the clock.
   - Today it closes: the reads are bounded at about 30 s by `relaySource.js`'s own `CONNECT_TIMEOUT_MS` and
     `QUERY_TIMEOUT_MS` (5 s each, one bounded connect retry) and by `SCAN_TIMEOUT_MS`, and 30 s is past the 25-second
     cutoff, so a call that slow sends nothing and answers at once. ADR 0006 Amendment 2 says this in as many words.
   - But nothing in `update.js` *enforces* it. Those constants are module-level in `relaySource.js` and shared with the
     presence probe; raising them would silently stretch this endpoint's answer, and the 45-second claim would go quiet.
   - **Optional, for the Architect:** bound the two read phases by the same deadline (they already have `readBefore`),
     or name the dependency where the constants are defined. A reviewer of a future `relaySource` change has nothing
     pointing here today.
   - Second-order, worth knowing: a call against an unreachable list relay spends about 30 s in the reads before its
     503. Honest, but slow.
2. **A run whose calls can send nothing keeps going** (the Implementer's gate flag a). When the reads alone pass the
   cutoff, the call answers 200 with every place "not sent: out of time", which is not a refusal, so
   `CuratedDListItems.jsx:241` goes on to the next call — which re-reads and will usually time out the same way. Two
   calls on a two-item list means about a minute of "Publishing…" for a result that published nothing.
   - This is exactly what Amendment 2 chose ("A call that ran out of time isn't a refusal, so the browser goes on to
     the next call"), and what the page says is true throughout. **Not blocking.**
   - **Optional:** stop the run when a whole call was out of time, the way a refusal stops it.
3. **The 10-second read-back reserve is shorter than one strict relay read** (flag b). A relay read-back is up to two
   5-second connects plus a 5-second query, so in the worst case it is cut short and the place reads "failed: sent, but
   couldn't read it back: out of time" although the event landed.
   - The words say "sent", so nobody is told nothing was published, and the fresh preview immediately afterwards shows
     the truth. The floor only binds when the sends ran to the cutoff; in the ordinary case the read-back gets nearer
     40 s. **Not blocking.**
4. **The capped-read words still say "every deletion request by your assistant"** (`update.js:392`; flag c), though the
   read now covers only this call's copy and refresh addresses. The 503 therefore overstates what couldn't be checked.
   Cosmetic, on a path that now needs 500 requests against ≤50 addresses. Deviation 19 records it.
   - **Optional:** "every deletion request for the copies in this batch".
5. **"Your list has been read again" shows while the re-read is still running** (flag d). `CuratedDListItems.jsx:379`
   sets `phase: 'done'` and bumps the epoch in the same commit, so the unknown sentence renders beside the preview's
   "⏳ Checking…" for as long as the reads take. It is a beat early, never wrong, and self-corrects. Cosmetic.
6. **An all-out-of-time call still signs every event** (Deviation 17). Up to 50 signatures are made for events that are
   never sent. No key material leaves the server and the caller is already the owner of that assistant, so there is no
   privilege gain — only wasted work, and one result row per write, which is what makes the per-item report possible.
   Worth knowing, not worth changing.
7. **An abandoned read outlives the answer** (Deviation 15). A read-back that loses its race runs on to its own timeout
   (≤15 s for a relay), holding a websocket that `readRelayEvents` closes in its `finally`. Its answer is dropped and
   cannot touch the response. Bounded and harmless.
8. **Round 1's Non-blocking 1 and 3 are now recorded, not fixed where they couldn't be.** Non-blocking 1 is fixed on
   the server (Amendment 2, change 3; H33) and filed as OPEN.md row 299 for the page's own read, which cannot be
   narrowed the same way — a list's copies can number 500, too many addresses for one GET. Non-blocking 3 is OPEN.md
   row 300. Both rows read accurately against the code. Round 1's Non-blocking 2 stays with the CORS and cookie
   hardening task, and Non-blocking 4's biggest gaps now have pins (S11–S13).

#### Harness friction *(each becomes an OPEN.md row, type `meta`)*
1. **Nothing new this round.** The two standing items both already have rows, so no new row is needed:
   - the absent gate recorder on this branch — OPEN.md row 298, filed from round 1's Harness friction 1. This review
     says the recorder is absent instead of quoting a `gate:status` line;
   - the Reviewer role's full-`npm test` requirement against the shared local stack — OPEN.md row 294 (with rows 293
     and 294 on the fixtures a run leaves). This review rests on the recorded run at `f0abfb3c`, which I verified is
     the reviewed code, plus the 13 suites I ran myself.

### Verdict (round 2)
**PASS**

**Why.**
- **Blocking 1 is fixed, and fixed at the right layer.** The honesty half is a pure function with its own tests, not a
  patch at the render site; the timing half is a deadline in the handler with the clock started before the guards, not
  a promise in prose. Mutating either back makes the suite red (S12; H25–H27, H30; U8; H28).
- **Amendment 3 is a genuine find, not a rubber stamp.** The auth middleware really does answer a body-less
  `401 { error }` before the handler, and under Amendment 2 alone the page would have claimed "some changes may have
  been published" when nothing was. The rule it lands on — any 4xx is a refusal — is true of this endpoint as written,
  and the ADR states the obligation it puts on later changes.
- **Nothing else moved.** The round-2 server diff touches the clock, the two send guards, the read-back's bound and one
  filter. The guards' order, the key choice, the refusal to sign anything the browser sent, and the confinement of
  deletions and refreshes to my assistant's own copies are byte-for-byte what round 1 passed on.
- **The evidence.** 306 tests in the 13 suites that read a changed file, 0 failures, each run through `run()`. Four
  mutations caught. `harness-lint` clean. No control byte in any changed file. The deployed files are the reviewed
  ones, and the recorded full run is at the reviewed code.
- **What is left** is eight non-blocking notes. Five are the Implementer's own flags and Deviations, honest on the page
  and recorded; two are debt already filed as rows 299 and 300; one is mine — that the read phase is bounded by
  another module's constants rather than by this handler — and it is a hardening suggestion, not a defect today.

The story's status flip and completion detection are the orchestrator's, per this round's brief; this file records
neither.
