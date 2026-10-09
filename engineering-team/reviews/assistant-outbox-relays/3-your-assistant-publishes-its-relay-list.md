# Review: Story 3 — Your Assistant publishes its relay list

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git diff 50a6103..ccb4bbc`: the tests `9a9b715` (Phase 3) and the implementation `ccb4bbc` (Phase 4), shared by the three stories. This review covers story 3's part:
- `src/lib/relay-list/index.js`: `validateRelayListRequest`, `buildRelayListTags`;
- `src/api/assistant/relayListPublish.js` (new);
- the `privkeyBytesOf` export in `src/api/assistant/identificationTaggings.js`;
- the route in `src/api/index.js:596-598`;
- `ui/src/utils/publishAssistantRelayList.js` (new);
- the publish button and report in `ui/src/pages/assistant/OutboxRelays.jsx`, and their words in `outboxRelaysCopy.js`;
- the route in `src/api/openapi.yaml`, BIBLE §11's row and the §14 sentence.

Base `50a6103`. `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0).
**Story:** `engineering-team/stories/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md`
**ADR:** `engineering-team/decisions/assistant-outbox-relays/0003-the-assistant-signs-its-relay-list-through-one-narrow-route.md` (Accepted)
**Test plan:** `engineering-team/stories/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`**: one run for the three stories. `npm run gate:status -- --label reviewer-outbox-relays`:

  > `20261009T120133Z-5764-c4eb [reviewer-outbox-relays] started 2026-10-09T12:01:33.183Z on ccb4bbc8 — FAIL, exit 1, 5209 passed, 70 failed, 582 skipped, 284/284 suites; failed: harness-lint, stamped-composite-avatar, my-assistant-page, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone`

  All six failures are pre-existing (the comparison against the base is in story 1's review). None is this story's.
- [x] **The suite alone:** `assistant-relay-list-publish` **22 passed, 0 failed, 1 skipped**. The skip is H1, live, with no stack. Events are really signed and verified with nostr-tools. Re-aimed: `assistant-taggings-publish` 19/0/1.
- [x] **Playwright, chromium,** against a fresh `vite build` of `ccb4bbc` served by `vite preview`: story 3's B0, B7, B8 and B9 pass, within the run of **69 passed, 3 skipped, 1 failed**. The failure is the parallel book's `assistant-attention` B4 (story 1's review).
- [x] **My own probe of the route** (scratch script; `createPublishRelayListHandler` with an injected key, local write and `publishToRelays`; nothing sent). I posted `{ relays: ['ws://10.0.0.5:6379', 'ws://169.254.169.254/latest/meta-data', 'ws://tapestry-redis:6379', 'ws://[::1]:7777', 'ws://127.0.0.2:7687', 'wss://staging.brainstorm.world/relay'] }` as a signed-in viewer. The route answered **200, ok**, and handed `publishToRelays` `["ws://10.0.0.5:6379","ws://169.254.169.254/latest/meta-data","ws://tapestry-redis:6379","ws://127.0.0.2:7687","wss://pub.example"]`. Only `[::1]` and this instance's own host were left out. See blocking finding 1.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test, and the plan's coverage map holds:
  - AC-1 → P5, C1, R1, S4, B4, B5, B7, B9.
  - AC-2 → P1–P3, P12, L3, S2, S3.
  - AC-3 → L1, L2, P4, P6–P8.
  - AC-4 → P4, P5, P9, P10.
  - AC-5 → L2, P11, B8.
  - Docs → S1. Errors → P13.
- [x] No criterion silently dropped.
  - Refusal order: 401, then 400, then 403 before any key is read (`relayListPublish.js:137-148`, `:88-89`).
  - AC-3's marker rules: `buildRelayListTags` (`src/lib/relay-list/index.js:155-170`). I probed it beyond L1: a previous `read` named in the draft becomes `['r', url]`; a previous `write` stays `write`; a dropped `null` entry is gone; a kept `read` is appended.
  - `created_at = max(now, newest + 1)` (`:99`).
  - Local first, and a failed local write sends nothing (`:108-119`).
  - Fan-out to new ∪ previous ∪ the profile publish set (`:121`). Local-only gives skipped rows (`:122-123`).
- [ ] **AC-4 is met as written, but as written it makes the server connect to any address the request names.** This is blocking finding 1. The story is not wrong to send a relay list to the relays it names. What is missing is the boundary on which addresses this server will open a socket to.

## ADR adherence
- [x] Option A as decided. One narrow, session-bound route in the identification-tags shape. Whose key comes from `getAssistantKeys(viewer)` (session only). It signs only kind 10002, with `r` tags built from normalized `ws(s)://` URLs. The request cannot name a pubkey, a kind or a tag (P12). The generic signer is untouched (S3).
- [x] Sub-decisions 1–6 match the code. `privkeyBytesOf` is shared by export with no behavior change. The answer's shape is per sub-decision 5. Non-accepting relays are logged as the tagging route logs them.
- [x] **Sub-decision 7, a deliberate narrowing.** `OutboxRelays.jsx:111-128` calls `attention.refresh()` only when the server answered `success: true` with `result.ok === true`, meaning a list was written to this instance's relay. The ADR (`0003-…md:140-145`) and story AC-1 put "Then `attention.refresh()`" after every answer.
  - **I judge this within the ADR's intent.** The ADR and the story give the refresh one purpose: "so the page's list and mark, the hub card, the count line and the Assistant Alert all reflect the new list".
  - After a refusal or a failed local write there is no new list. A refresh would only rebuild the draft from the unchanged answer, throwing away the person's edits before they can retry.
  - A thrown request (unknown outcome) also skips the refresh. The draft then stays "changed", and a second press is harmless: the new list gets `created_at` one second past the newest.
  - It needs no amendment of its own. Because finding 1 amends ADR 0003 anyway, fold one line recording it into that amendment (non-blocking 1).
- [x] No new dependencies.

## Concept-graph integrity
- [x] No concept handle composed. Kind 10002 is a standard NIP-65 event; no new wire format and nothing through `protocols/`.
- [x] No concept definitions changed, so no firmware reinstall.
- [x] Orientation: the AGENTS.md §2 fallback at Architecture.

## Things tests can't catch
- [x] No secrets and no key literal (S2). The key comes from the key store, used in-process, never logged or returned.
- [x] Logging: `relayListPublish.js:150` (`console.log`) and `:152` (`console.warn`) are the operational lines ADR 0003 sub-decision 5 asks for, mirroring `identificationTaggings.js:225-227`.
- [x] No commented-out code, and no TODO/FIXME.
- [x] Concurrency: the button is disabled while publishing. Two tabs means last write wins, as ADR 0003 accepted. The server reads the newest list at publish time, so markers and inbox entries are never stale.
- [ ] **Security: the request picks the hosts this server connects to.** Blocking finding 1.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] Permissionless publication: the server gates only what it signs with keys it holds. POV: the session's own Assistant only. Local-first: this instance's relay first, and a failed write sends nothing. No hardcoded TA pubkey.

## Product-guide adherence
Not applicable: no PRD. The report's words come from `summarizePublish` / `localFailureMessage` with the story's subject. The refusals and the empty-outbox line match story § Copy (C1, P5, P9, P10).

## Findings

### Blocking
1. **`src/api/assistant/relayListPublish.js:121-124` (with `src/lib/relay-list/index.js:133-144`, `src/api/setup/status.js:38`): a signed-in person chooses which hosts this server opens connections to, and reads back what happened.**
   - **Where the addresses come from.** The fan-out set is the request's relays, plus the previous list's, plus the configured set. It is filtered only by `outsideOnly`, which drops exactly `localhost`, `127.0.0.1`, `::1` and this instance's own host.
   - **What is let through.** `validateRelayListRequest` accepts any `ws(s)://` host. So RFC1918 addresses, link-local `169.254.169.254` (droplet metadata), Docker service names (`tapestry-redis`, the `nostr-search-*` containers), the rest of `127.0.0.0/8` and `0.0.0.0` all reach `publishToRelays` (my probe above). That opens a WebSocket handshake (an HTTP GET to the named host, port and path), then sends an EVENT frame if the handshake succeeds.
   - **What comes back.** Each row's raw socket `reason` is returned to the caller (`:126`, `result.relays.results[].reason`; e.g. `ECONNREFUSED`, `Unexpected server response: 200`, `connection timed out`). That is an internal host and port oracle.
   - **Who can trigger it: effectively anyone.** Any nostr key can sign in (`handleAuthLoginUser`, `src/middleware/auth.js:567-614`) and self-register as a Customer, which provisions relay keys, that is, an Assistant (`src/api/auth/signUpNewCustomer.js`). The check before this route, `getAssistantKeys`, therefore stops nobody on a public instance.
   - **The house already has the guard.** `src/utils/ssrfGuard.js` ("Some endpoints take a hostname from user-supplied input and then fetch it from the server. Without a check, the caller chooses which host the server talks to — including hosts only the server can reach. This module is the one place that decides…": `isPublicAddress`, `hasPrivateHostSuffix`, `isPublicHostname`). This route does not use it. The parallel book's avatar story pins SSRF cases for its fetch.
   - **The ADR missed it.** ADR 0003 § Consequences "Security" (`0003-…md:161-162`) covers what the route signs, never where it connects.
   - **Nothing is lost by guarding.** A NIP-65 list naming a private address is useless to every other client anyway.

   **Asked change.** This needs an Architecture decision, not just an Implementer fix, because story 3 AC-4 (`stories/…/3-…md:60`) says "every relay the new list names". So the order is:
   1. **Architect:** amend ADR 0003 with owner approval, deciding where non-public relay addresses stop. Options:
      - (a) refuse them in the request check, with a refusal word. This also amends story 2 AC-3 and `addRelay`, so the page refuses them where they are typed.
      - (b) keep them out of the fan-out, each reported as a not-sent row with its own reason.

      Either way, classify with `src/utils/ssrfGuard.js`: `isPublicHostname` (resolve, every answer public) for the fan-out, or at least `isPublicAddress` + `hasPrivateHostSuffix` syntactically, with the DNS caveat stated. Apply it to the previous list's relays too, and decide whether non-accepting rows should keep raw socket error text.
   2. **Tester:** failing tests pinning the decision, in their own `test:` commit.
   3. **Implementer:** the change.
   4. **Review:** a fresh round.

   Commit `ccb4bbc` carries all three stories, so **it should not be pushed until this story passes**, even though stories 1 and 2 are Done.

### Non-blocking
1. **`ui/src/pages/assistant/OutboxRelays.jsx:126-128`**: the refresh-only-after-a-write narrowing. Within intent (see ADR adherence). Fold one line into the ADR 0003 amendment so the book-close audit finds it. Also log it under the story's `## Deviations` (roles/implementer.md:47); it is not logged anywhere today.
2. **Phase-4 test edits (process).** Both are corrections the Tester's lane should have made in Phase 3, and they landed inside the `impl:` commit `ccb4bbc` (workflows/4-implementation.md:38, templates/adr.md:37). Each is right on merits:
   - `test/assistant-relay-list-publish.test.js` S1 reads `src/api/index.js` raw. I confirmed `codeOnly()` blanks the registration: the `'/api/settings/*'` string at `src/api/index.js:343` opens a false block comment. With `codeOnly` the regex fails; on the raw source it matches. This is the same correction as `assistant-taggings-publish` S1 and `assistant-attention`, both reading raw.
   - `test/assistant-taggings-publish.test.js` S2 allows `src/api/assistant/relayListPublish.js` to name `identificationTaggings`. ADR 0003 sub-decision 6 requires exactly that import, and this book's own S2 pins it. The guard's intent, that no creation path requires the module, still holds, because S3 here pins that only `src/api/index.js` requires `relayListPublish.js`.

   Neither weakens a judge. Keep the next round's test changes in their own commit.
3. **`relayListPublish.js:121`**: one press can open up to about 150 sockets (50 new, up to 100 parsed previous entries, plus the configured set), with no per-viewer rate limit. That is bounded by the 8 s publish budget and is not a defect by itself. It is worth a sentence in the amendment if option (b) keeps a large fan-out.

### Out of scope: a pre-existing hole found while checking precedent (not this diff)
1. **`src/api/pipeline/batch/commands/negentropySync.js:20,37`: shell command injection reachable by any signed-in session.** `req.body.relay` and `req.body.filter` are interpolated unvalidated into ``exec(`strfry sync ${relay} --filter '${filter}' --dir down`)``. `POST /api/negentropy-sync` (`src/api/index.js:287`) is in the auth middleware's "any authenticated user" list (`src/middleware/auth.js:369-381`), and any nostr key can authenticate (`:567-614`). I found no OPEN.md row or story for it. Precedent: `audits/compute-endpoint-hardening` fixed the same class (shell to `execFile`, input validated). This needs its own ledger row, type bug/security, urgently. I did not add one: this review's writes are the review files and the story status lines.

### Harness friction
1. **Architecture has no prompt for outbound connections.** `workflows/2-architecture.md`, `roles/architect.md` and `templates/adr.md` never ask "does the server connect to an address the request, or a stored user-authored value, names?". So ADR 0003's Security paragraph reviewed only the signing power. Candidate `meta` row: one checklist line pointing at `src/utils/ssrfGuard.js`.
2. As in story 1's review: `.claude/commands/implement-feature.md` does not restate that Phase-4 test corrections belong in their own `test:` commit.

## Verdict
**CHANGES_REQUESTED**

## Round 2 (2026-10-09): the round-1 blocking finding, re-reviewed as fresh claims

**Diff:** `git diff a03f8ec..38c00dd`. It holds `e21d334` (ADR 0003 Amendment 1, story 3 AC-6, its § Copy lines and § Deviations), `99ffb6d` (the Tester's failing tests A1–A7, G5 and B6b, plus the plan's round-2 record) and `38c00dd` (the fix). HEAD is `8ba7b78`, a ledger-only commit (three `ledger/` files) after the fix. The branch was rebased onto `origin/staging` `95876ca`. `git range-diff 50a6103..a57ff75 95876ca..a03f8ec` shows all five round-1 commits as `=`, so the rebase changed nothing I reviewed. `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0).

### What I re-ran
- **Commit hygiene, fixed this round.** `e21d334` touches only the ADR and the story. `99ffb6d` touches only `test/`, `tests/` and the plan. `38c00dd` touches no test file. Round 1's non-blocking 2 is closed. Round 1's non-blocking 1 is closed by story § Deviations and the amendment's "Also recorded here".
- **The tests failed first.** In a worktree at `99ffb6d`: A1, A2, A3, A4, A6, A7, G5 and the page suite's C1 fail. A5 passes, as the plan records. After the fix A5 still has teeth: if `summarizePublish` counted a `not-sent` row, its message would read "n of n+1" and the test would fail.
- **The suites alone, on HEAD:**
  - `assistant-relay-list-publish` **29 passed, 0 failed, 1 skipped** (H1, live);
  - `assistant-outbox-relays-page` 18/0/0;
  - `assistant-outbox-check` 29/0/0;
  - `assistant-taggings-publish` 19/0/1;
  - `assistant-identification-tags-page` 16/0/0.
- **`npm test`.** `npm run gate:status -- --label reviewer-outbox-relays-r2`:

  > `20261009T134224Z-32038-d116 [reviewer-outbox-relays-r2] started 2026-10-09T13:42:24.742Z on 8ba7b788 — FAIL, exit 1, 5218 passed, 74 failed, 582 skipped, 285/285 suites; failed: harness-lint, stamped-composite-avatar, my-assistant-page, one-writer-assistant-profile, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone, tagging-edges-realtime-wrapper`

  I compared suite by suite with a clean `origin/staging` (`95876ca`) worktree:
  - `stamped-composite-avatar` 8/5/2, `my-assistant-page` 28/3/0, `one-writer-assistant-profile` 16/1/0, `assistant-profile-checklist-page` 0/14 and `assistant-stamped-avatar-for-everyone` 0/19 are identical.
  - `assistant-profile-check` is 0/33 there and 3/30 here (the Done badge, as in round 1).
  - `harness-lint` has the same single L10 (`f932e16`) on both.
  - `tagging-edges-realtime-wrapper` (RW7, 23/1) is a load flake. That test times restart backoff against wall-clock windows, and I was running a `vite build` and Playwright beside the gate. Alone it passes **24/0/0, three runs out of three**, and this book touches no tagging-edges code. Without it the counts match the coordinator's run (5219 / 73).
- **Playwright, chromium,** against a fresh `vite build` of HEAD served by `vite preview`: **70 passed, 3 skipped, 1 failed**. B6b passes. The failure is the parallel book's `assistant-attention` B4 (8 vs 9), unchanged from round 1. The preview server was stopped.
- **`bash scripts/harness-lint.sh`:** only the pre-existing L10. The story's new § Deviations passes L14.
- **`src/api/openapi.yaml` parses** (`js-yaml`). The status enum gains `not-sent`, and the 400 text names `not-a-public-relay`.
- **My own probes** (scratch scripts; nothing sent; DNS is unavailable in this sandbox, so `dns.promises.lookup` is stubbed *beneath* the real `ssrfGuard`):
  - **Entry.** Round 1's probe (`ws://10.0.0.5:6379`, `ws://169.254.169.254/…`, `ws://tapestry-redis:6379`, `ws://[::1]:7777`, `ws://127.0.0.2:7687`) is now **400 `not-a-public-relay`, and nothing is sent**. So are `ws://2130706433`, `ws://[::ffff:a00:5]` and `ws://localhost.`.
  - **URL rewriting.** WHATWG URL turns `2130706433`, `0x7f000001`, `127.1`, `0177.0.0.1` and `%31%32%37.0.0.1` all into `127.0.0.1` before the check runs.
  - **No drift.** Over 31 hosts (encoded IPv4 forms, IPv4-mapped and NAT64 IPv6, trailing dots, `.internal`, `[::]`, multicast), the page's `isPlainlyPrivateHost` and the server's `ssrfGuard` rule give the same answer every time.
  - **Send time.** List relays that resolve to `10.1.2.3`, to `169.254.169.254`, to a mix of `8.8.8.8` and `192.168.0.9`, or to `fd00::5`, or that don't resolve at all, are all `not-sent: not a public address` and never handed to `publishToRelays`. A public one, and both Relay Settings relays (one of them an owner LAN name), are sent.
  - **Previous list.** Its `ws://10.0.0.9:7777` (write) and `ws://192.168.5.5` (read) are `not-sent`.
- **The negentropy-sync hotfix `95876ca`, looked at as invited.** It uses `execFile` with an argument list. The relay is `URL.href` (ws/wss only), so it can never pose as a flag. The filter is re-serialized from a parsed JSON object as one argument. The sibling stream route already uses `spawn` with an argument list. I saw no problem.

### Each amendment claim, checked with its own command
| Claim (ADR 0003 Amendment 1) | Command | Result |
|---|---|---|
| `isPublicAddress` rejects private, loopback, link-local, CGNAT, unspecified, multicast, reserved and IPv4-mapped private | the entry probe and the drift table | **True** |
| `hasPrivateHostSuffix` rejects `localhost`, `.local`, `.internal`, `.home.arpa`, `.localhost`, `.lan`, `.intranet`, `.private`, or a bare label | `src/utils/ssrfGuard.js` `PRIVATE_SUFFIXES`, `PRIVATE_EXACT`, the bare-label return | **True** |
| One plainly-private relay refuses the whole request, before any key is read: 400 `not-a-public-relay` | A3, plus the probe (`getAssistantKeys` never called) | **True** (`relayListPublish.js:180-182`) |
| The server never trusts the page's copy | the route requires `ssrfGuard` itself (`relayListPublish.js:37`); A7 | **True** |
| A drift test pins the two rules over a table | A1, plus my 31-host extension | **True** |
| `outboxSuggestions` leaves plainly-private relays out | G5; `outboxRelays.js:78-81`, `:90` | **True** |
| Each relay from the new and previous lists is checked with `isPublicHostname`, fails closed, is never passed to `publishToRelays`, and gets the row `not-sent` / `not a public address` | A4, plus the send-time and previous-list probes | **True.** A list relay that *is* a Relay Settings relay (same one spelling) is not looked up. That matches "configured relays are sent to as before" (A4 pins it). |
| `summarizePublish` counts `not-sent` as neither attempted nor accepted | `profilePublish.js:226`; A5 | **True** |
| `relayLine` gains the `not-sent` wording | `taggingPublishReport.js:31`; A6 | **True** |
| (3) Rows for relays that pass the guard keep their reason text; "those hosts are public" | the send-time probe | **True for list relays.** Relay Settings relays bypass the guard rather than pass it, and can be private (an owner's LAN relay). Their socket text reaches any caller. Low sensitivity, because Relay Settings are already public through `GET /api/relays`. Wording only (non-blocking R2-3). |
| "Which internal names resolve can be inferred … reveals only that a name exists" | the send-time probe | **True, if anything an overstatement.** `not-sent` covers "resolves private" and "does not resolve" alike, so only "resolves public or not" is revealed. |
| **"One press can still reach about 150 relays …, each looked up first, all within the 8 s publish budget"** | `relayListPublish.js:151-156`; `profilePublish.js:197`; `ssrfGuard.js:233`; the slow-resolver probe | **False.** The lookups have no timeout. They run *before* `publishToRelays` starts its 8 s deadline (`profilePublish.js:197`), and *after* the local write. Probe with a 10 s resolver: local write at 0.2 s, the budget starts at 10.2 s, the report arrives at 10.2 s. See blocking R2-1. |

### Findings

#### Blocking
1. **R2-1. `src/api/assistant/relayListPublish.js:151-156`: the send-time lookups are unbounded in time and concurrency, sit outside the publish budget, and run after the local write.**
   - **No time limit.** Every list relay that is not a Relay Settings relay goes through `isPublicHostname` → `dns.promises.lookup` (`src/utils/ssrfGuard.js:233`), which has no timeout. `publishToRelays`' 8 s deadline begins only after every lookup has settled (`profilePublish.js:197`).
   - **Threadpool exhaustion.** `dns.lookup` runs `getaddrinfo` on libuv's threadpool (Node's default is 4 threads, and the repo sets no `UV_THREADPOOL_SIZE`). A request may name 50 relays, and the previous list adds its own. Anyone with a domain whose nameserver never answers can submit 50 names under it. With glibc's default resolver timeouts (about 5 s × 2 attempts), each press then holds the threadpool for roughly ⌈50/4⌉ = 13 waves, a minute or two. Meanwhile the control panel's other threadpool work (async fs for static assets, every other lookup, zlib, async crypto) queues behind it. Any self-registered Customer can repeat this. Exact numbers depend on the container's resolver; the code imposes no bound at all.
   - **A false report.** Past nginx's default 60 s (`docker/nginx.conf`'s `location /` sets no `proxy_read_timeout`), the browser gets a 504 page. The page then says "This instance did not answer; nothing was published." But the list was already written to this instance's relay, which happens before the lookups, and the fan-out continues.
   - **What it breaks.** It contradicts story 3 AC-4 ("Slow, down or broken relays cost their own line and nothing else; the person gets the report within a bounded time"), AC-1's honest report, and the amendment's own claim, checked above as false.

   **Asked change:**
   1. **Architect:** correct Amendment 1's sentence and decide the bound, failing closed. One shape: each lookup races the *same* 8 s budget the sends use, and a lookup that has not settled reads `not-sent`. Lookups in flight per press are capped, because a race alone does not free a threadpool thread. Alternatively, resolve off the threadpool (a `dns.promises.Resolver` with a timeout) if the guard grows such a function.
   2. **Tester:** a failing test with an injected slow `isPublicHostname`, pinning that the report arrives within the budget and that the slow relay is `not-sent`, plus the cap if one is chosen. Own `test:` commit.
   3. **Implementer:** the change.

   Everything else in the fix (entry refusal, send-time partition, rows, summary, words, suggestions, docs) is verified above and stands.

#### Non-blocking
- **R2-2. `relayListPublish.js:160` with `profilePublish.js:238`:** when every list relay is `not-sent` and Relay Settings has none, the summary reads "…saved on this instance's relay only: no general-purpose, profile or WoT relays are configured.". Accurate about the settings, misleading about why nothing went out; the rows below do say "not sent". A rare edge (the default lists are not empty).
- **R2-3. Amendment decision 3's wording:** "those hosts are public" holds for list relays, not for the owner-set Relay Settings relays, which skip the guard (see the table). Fold a word into the R2-1 correction.
- **R2-4. `relayListPublish.js:180-182`:** the refusal does not name the relay. That matters only for a draft seeded from a list published elsewhere, since the page refuses such a relay where it is typed. Optional.
- **R2-5. Duplication:** `outboxRelays.js:78-81` (`isPlainlyPrivateRelay`) and `relayListPublish.js:98-101` (`isPlainlyPrivate`) are the same ssrfGuard-backed wrapper twice; one export would do. The library's browser copy is by design and drift-tested.
- **R2-6. Outside this book, `src/utils/ssrfGuard.js`:** `isPublicAddress` treats `fec0::/10` (deprecated site-local, RFC 3879) and `100::/64` (discard-only, RFC 6666) as public. That table is shared by every caller. Candidate ledger row for the guard's owner, not this book.
- Round 1's non-blocking 3 (fan-out volume) is now recorded in the amendment's Accepted limits. R2-1 asks only that its timing claim be made true.

#### Harness friction
- None new. The two harness rows filed from round 1 (`ledger/2026-10-09-architecture-misses-outbound-connections.md`, `ledger/2026-10-09-phase4-test-fixes-own-commit.md`) match its findings. R2-1 is the same class one step on: an outbound-connection fix still needs its own bounds stated and checked.

### Verdict (round 2)
**CHANGES_REQUESTED.** One ask: bound the send-time lookups in time and concurrency within the publish budget, failing closed, and correct Amendment 1's "all within the 8 s publish budget". Round 3 needs the story suite, the new slow-lookup test, `harness-lint`, and B6b–B9 in the browser. The rest of the gate showed nothing this book moved.

### Story status and completion (round 2)
- [ ] Story `**Status:**` not flipped: it stays `Approved`.
- [ ] Completion detection: the book's "One publish" bullet still waits on this story. Recorded in the chat, not here.

## Round 3 (2026-10-09): R2-1, re-reviewed as fresh claims

**Diff:** `git diff 2129810..7352810`. It holds `f8808b4` (ADR 0003 Amendment 2), `8bcd24a` (the failing tests: A8, A9, A10, A7 re-aimed, plus the plan's round-3 record) and `7352810` (the fix in `relayListPublish.js`, plus BIBLE §11). `8ba7b78`, the ledger commit, predates round 2's review commit and was noted there. `origin/staging` is now `b4fefe7`, an empty "redeploy staging" commit. `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0).

### What I re-ran
- **Commit hygiene:** the ADR commit is docs only, `8bcd24a` touches only `test/` and the plan, and `7352810` touches no test. `ui/` and `tests/` are unchanged since round 2 (`git diff --stat 38c00dd..7352810 -- ui tests` is empty), and `src/utils/ssrfGuard.js` is unchanged by this book.
- **The tests failed first.** In a worktree at `8bcd24a`: A7, A8, A9 and A10 fail; 28/4/1.
- **The suites alone, on HEAD:**
  - `assistant-relay-list-publish` **32 passed, 0 failed, 1 skipped** (H1, live);
  - `assistant-outbox-relays-page` 18/0/0;
  - `assistant-outbox-check` 29/0/0;
  - `assistant-publish-relays` 39/0/0;
  - `assistant-taggings-publish` 19/0/1;
  - `assistant-identification-tags-page` 16/0/0;
  - `nip05-ssrf-guard` 21/0/0.
- **`npm test`.** `npm run gate:status -- --label reviewer-outbox-relays-r3`:

  > `20261009T141024Z-14530-8c35 [reviewer-outbox-relays-r3] started 2026-10-09T14:10:24.970Z on 73528100 — FAIL, exit 1, 5221 passed, 74 failed, 582 skipped, 285/285 suites; failed: harness-lint, stamped-composite-avatar, my-assistant-page, one-writer-assistant-profile, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone, tagging-edges-realtime-wrapper`

  - The first seven failing suites have exactly round 2's counts, which round 2 matched against a clean `origin/staging` (assistant-profile-check +3 for the Done badge).
  - `tagging-edges-realtime-wrapper` RW7 failed again with the same early second start (0.72 s against a floor of 0.8 s). That is the known flake in `ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md`.
  - Alone it passes **24/0/0, three runs out of three this round** (six of six across rounds 2 and 3). This book touches none of its files (`run.sh`, `taggingEdgesFixtures.js`, the suite).
  - Without that flake the counts match the coordinator's run.
- **Playwright, chromium:** `assistant-outbox-relays.spec.js` **12 passed** (B6b–B9 included). It ran against round 2's `vite build`, which is HEAD's UI byte for byte because no `ui/` file changed. Every `/api` route is mocked, so the server change cannot reach it. The preview server was stopped.
- **`bash scripts/harness-lint.sh`:** only the pre-existing L10.
- **My probe of the real c-ares path** (scratch; a local UDP DNS server; `isPublicRelayHostWithin` with a `Resolver` subclass pointed at it; Node 22.22.0):

  | Name served as | Result | Time |
  |---|---|---|
  | public A, AAAA NODATA | `true` | 16 ms |
  | private A (`10.0.0.5`) | `false` | 3 ms |
  | NXDOMAIN | `false` | 2 ms |
  | never answered (budget 1500 ms) | `false` | 1501 ms |

  Then 50 never-answered lookups (budget 3000 ms) ran in parallel with 8 `crypto.pbkdf2` threadpool jobs. **The threadpool jobs finished at 39 ms; all 50 lookups returned `false` at 3005 ms.** The guard's lookups are off the threadpool and bounded.
- **The three ledger rows in `8ba7b78`, read as invited:** accurate. The negentropy row's "related, not fixed" paragraph states the remaining exposure correctly.

### Each Amendment 2 claim, checked with its own command
| Claim | Command | Result |
|---|---|---|
| One `LOOKUP_BUDGET_MS = 3000` from the start of the lookups; an unanswered one is `not-sent` | `relayListPublish.js:99`, `:201-205`; A8 | **True** |
| The default check keeps ssrfGuard's rule (literal → `isPublicAddress`; private-by-construction name → not public) and resolves A + AAAA through a c-ares `Resolver({ timeout, tries: 1 })`, off the threadpool | `:118-144`, `:92`; A9, A10; the c-ares probe | **True** |
| Public only when both queries finished, at least one address came back, and every address is public; a timeout, error or empty answer is not public; cancelled at the limit | A9; the probe (NODATA → empty list, NXDOMAIN → `false`, hung → `false` at the limit, `cancel()` at `:137`) | **True** |
| `ssrfGuard.js` is unchanged; its other callers keep `dns.lookup` | `git diff --stat 50a6103..HEAD -- src/utils/ssrfGuard.js` (empty) | **True** |
| c-ares does not read `/etc/hosts`; a hosts-file name can only be set by the operator | the container's Docker-managed entries are `localhost`, the `ip6-*` names and the container hostname, all bare labels refused at entry | **True** (accepted limit) |
| Amendment 1 point 3 corrected: configured relays skip the guard and may be private | the round-2 table | **True.** Closes R2-3. |
| **"a press answers in at most about 11 s, well inside nginx's 60 s"** (`0003-…md:250`) | `relayListPublish.js:166` → `lookupNewestReplaceable` → `readWithinBudget` (`RELAY_BUDGET_MS = 8000`, `src/api/setup/status.js:33`) | **The bound is right in kind, wrong in number.** The newest-list read before signing can itself take up to 8 s when this instance's relay holds no list (every Assistant's first press) and an outside relay hangs. The worst case is therefore about 8 + 3 + 8 ≈ 19 s, still well inside nginx's 60 s, so AC-4's "bounded time" holds. Non-blocking R3-2. |

### Findings

#### Blocking
None. R2-1 is resolved. The send-time lookups are bounded (3 s, failing closed) and run on c-ares, off the threadpool. A press always answers well before nginx's 60 s, so the false "nothing was published" can no longer occur. The amendment records the change.

#### Non-blocking
- **R3-1. `relayListPublish.js:208` → `profilePublish.js:140` (`new WebSocketImpl(relay)`): the socket still resolves through `dns.lookup`, on the threadpool.**
  - **The gap.** After a relay passes the c-ares check, the connect resolves its name again (confirmed: `dns.lookup` is called for the passed host). A name whose nameserver answers the c-ares query and then stays silent for the socket's query holds one of the four threadpool threads until the resolver gives up. That is past the 8 s send budget, which only ends the row.
  - **Why not blocking.**
    - It is DNS rebinding's two-query class, which Amendment 1 accepted.
    - The report stays bounded.
    - A cheaper version already exists: the unauthenticated `GET /api/nip05/verify` runs `ssrfGuard.isPublicHostname` and its fetch through `dns.lookup` with no timeout (`src/api/nip05.js`, whose header says the route is unauthenticated).
  - **Candidate ledger row (codebase-wide, not this book):** server-side lookups of user-supplied names run `getaddrinfo` on the 4-thread pool with no timeout. Pinning the vetted address into the socket (for example a `lookup` option on the connection, or the dispatcher `ssrfGuard`'s header defers) would close this and DNS rebinding together.
- **R3-2. `decisions/assistant-outbox-relays/0003-…md:250`:** "at most about 11 s" leaves out the publish-time newest-list read (up to 8 s on a local miss). Worst case is about 19 s. Correct the number when the book closes; the conclusion it supports ("well inside nginx's 60 s") stands.
- **R2-2** is stated as accepted in Amendment 2 (it would need new copy). **R2-4, R2-5 and R2-6** stand as written in round 2; none blocks.

#### Harness friction
- `ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md` says the flake shows "when two gates share the machine". This round's run had no deliberate load from me, though another session may have shared the machine. Candidate: append this occurrence (`20261009T141024Z-14530-8c35`, RW7, 0.72 s) and round 2's (`20261009T134224Z-32038-d116`) to that row.

### Story status and completion (round 3)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md:3`). Its Review link already points here.
- [x] Completion detection performed; the result is in the chat, not here.

### Verdict (round 3)
**PASS**
