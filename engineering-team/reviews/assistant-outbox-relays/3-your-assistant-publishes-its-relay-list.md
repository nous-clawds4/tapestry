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
