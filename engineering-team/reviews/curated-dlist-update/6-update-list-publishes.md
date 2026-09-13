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
  row 276, read pointer-level only.

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
      row 276), never as `node test/<file>`. 156 passed, 0 failed:
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
   - **The residual.** An origin on the same host name with another port is same-site, so the session cookie goes with
     its requests: the cookie sets no `sameSite`. And the global CORS reflects any origin with credentials (ADR 0006
     § Context, `bin/control-panel.js`). So content served from another port on the same host passes guard 1 with the
     user's session. On a local stack, that means any localhost service. In some browsers, another scheme on the same
     host behaves the same way.
   - **Ask:** carry this point into the separate CORS and cookie hardening task (row 276's follow-ups). Keep it
     pointer-level.
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
