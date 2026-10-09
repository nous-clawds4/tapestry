# Build Audit: Outbox Relays — your Assistant's relay list, and the hub's third persona card

**Book:** `engineering-team/audits/assistant-outbox-relays/book.md`
**Date:** 2026-10-09
**Branch / commit range:** `9d22ca48^..79f17935` on `staging` (the shared line); `staging` was at `ff3d4e6c` at close.
- **Commits.** 17 of the book's own, all straight onto `staging`, no PR and no merge: 1 story (book, epic, stories), 3 adr (0001–0003, then Amendments 1 and 2), 3 test, 3 impl, 5 review, 1 ledger, 1 docs.
- **Interleaved.** Ten commits from elsewhere sit between them: PR #825 (treasure-map-card-details), six Phase-3 test commits of the parallel book `assistant-profile-checklist`, the negentropy-sync hotfix `95876ca`, and an empty redeploy commit.
- **Staging: deployed.** `staging.brainstorm.world` runs it (deploy run 541, commit `79f17935`).
- **Production: pending.** The owner chose a full `staging` → `main` promotion. PR #829 is open and blocked by its required `stack-free` check (§5).

**Provenance:** Acceptance-frame. There is no PRD and no Discovery conversation (book Decision 5). The owner's ask is quoted verbatim in `book.md`. Seven decisions were settled at intake and at story approval, and the frame was confirmed when the owner approved stories 1–3 on 2026-10-09.
**Confidence:** **high** for what the code does, **medium** for the frame as a person will meet it.
- **Every frame bullet traces to a story.** Stories 1 and 2 passed review in round 1; story 3 passed in round 3, after two security rounds that added AC-6 and ADR 0003 Amendments 1–2.
- **The code was exercised hard, but not live.** Three gate runs, the browser classes against a built bundle, and the reviewer's probes: request fakes, a stubbed resolver beneath the real `ssrfGuard`, and the real c-ares path against a local DNS server.
- **Staging, checked anonymously at close.** I checked with my own requests: `/assistant/outbox-relays` answers 200; anonymous `GET /api/assistant/attention` is `{"success":true,"signedIn":false}`; an anonymous `POST /api/assistant/outbox-relays/publish` is 401. The coordinator reports the bundle carries the publish route, and that `POST /api/negentropy-sync` is 401 anonymous too.
- **What the record cannot show.** Nobody has exercised the signed-in flow on staging or any live instance: a real Assistant publishing its list, outside relays answering, the hub card turning Done. No browser session with a nostr signer was available. Every browser test mocks the API, the route's suite injects its dependencies, and its one live test (H1) skipped for lack of a stack.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **A third persona card, Outbox Relays,** after Identification Tags on `/assistant`. It has the owner's description and a NIP-65 link, and leads to `/assistant/outbox-relays`. The hub now has eleven actions — `stories/done/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.md`
- **One real answer.** `GET /api/assistant/attention` also answers `outbox-relays` for the signed-in viewer's own Assistant only:
  - what it reads: the outbox relays its newest kind 10002 names, from this instance's relay first, then (only on a miss) the configured general-purpose, profile and WoT relays;
  - what it says: how many inbox-only relays the list names, whether the check finished, and a reason when it did not;
  - a failing outbox check answers `check-failed` without failing the identification-tags answer — story 1.
- **The hub tells the truth for this action.**
  - The card reads **Needs attention** until the list names an outbox relay, and **Done** once it does.
  - This book built the hub's **Done** badge for every checked action, as ADR `assistant-profile-checklist/0001` sub-decision 7 specifies, so the Identification Tags card shows it too.
  - The count line counts the card the way it is marked; the Assistant Alert counts it only when a finished check found none — story 1.
- **The page** at `/assistant/outbox-relays`, in the Identification Tags page's frame and cards:
  - the Assistant's outbox relays with the hub's mark, and a line counting inbox-only relays;
  - an on-screen draft, with a "changes not yet published" line;
  - an **Add a relay** field (one spelling per relay; refuses non-relays, duplicates, a 51st relay, and a relay plainly not on the public internet);
  - **Suggested relays**: this instance's relay at its public address, then the General Purpose, Trusted Assertion, Trusted List, DList and Outbox relay settings, minus plainly-private ones; one **Add** each, and **Add all**;
  - **Remove** per relay, with screen-reader names on every Add and Remove — `stories/done/assistant-outbox-relays/2-the-outbox-relays-page.md`
- **One publish.** **Have your Assistant publish** has this instance sign the whole list as the person's own Assistant, a NIP-65 kind 10002, through `POST /api/assistant/outbox-relays/publish`.
  - **The route.** It is session-bound, and refusals come before any key is read. The relays already in the newest list keep their markers; added ones are `write`; inbox-only entries are kept; removed ones are gone.
  - **Where it goes.** It is written to this instance's relay first, then to every relay the new and previous lists name plus the profile publish relays. Each relay's answer is shown. An empty outbox may be published. The page re-checks after a write — `stories/done/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md`
- **Only public relays** (story 3 AC-6, added at review). A relay plainly not on the public internet is refused at entry, on the page and by the server. At send time every relay from the new or previous list is resolved off the threadpool within a 3 s budget, and never connected to unless every address is public; its line reads "not sent: not a public address". Relay Settings' own relays are sent to as before — story 3; ADR 0003 Amendments 1–2.
- **The contracts are written down:** `src/api/openapi.yaml` (the action's shape; the route) and BIBLE §11 (both rows) and §14 Assistant Keys (one sentence) — stories 1 and 3.

## 2. Epics & stories rolled up

### Epic: `assistant-outbox-relays` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-outbox-check-and-the-hubs-outbox-relays-card | The action entry, the attention answer for the viewer's own Assistant's kind 10002, the hub's card, count line, pill and Done badge | Done | `reviews/done/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.md`: PASS, round 1 |
| #2 the-outbox-relays-page | The page: list and mark, on-screen draft, add by hand, suggestions (one or all), remove | Done | `reviews/done/assistant-outbox-relays/2-the-outbox-relays-page.md`: PASS, round 1 |
| #3 your-assistant-publishes-its-relay-list | The narrow signing route and the page's button and report; AC-6 only public relays | Done | `reviews/done/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md`: CHANGES_REQUESTED in round 1 (the fan-out connected to any relay a request named) and round 2 (the remedy's DNS lookups were unbounded and ran on the threadpool); PASS in round 3 |

**Epic close-out at this close.** All three stories are Done and the work is on the shared line (`staging`). Step 9 of the close workflow applies as written: the epic reads Done, and its story, ADR and review folders sit under `done/`. Production is not a condition of step 9 and is recorded as pending (§6 #1).

## 3. As-built inventory

Derived from the book's own commits: `src/` and `ui/` were touched only by this book inside the range, except `ui/src/styles.css`, whose book share is `fe29db24`. That is 18 files, +1329 −29, checked file by file against the stories, ADRs, amendments, plans and reviews.

- **User-facing.**
  - `/assistant/outbox-relays` replaces its placeholder (`ui/src/pages/assistant/OutboxRelays.jsx`; words and two pure helpers in `outboxRelaysCopy.js`; `.bs-outbox-*` rules in `styles.css` with a 480 px rule). It is routed through `ACTION_PAGES` in `ui/src/App.jsx`.
  - The hub (`ui/src/pages/assistant/Index.jsx`, `actions.js`):
    - the eleventh action entry and `NIP_LINKS.relayList`;
    - `CHECKED_ACTIONS = ['identification-tags', 'outbox-relays']`;
    - `assistantAttention()` gains `done: string[]`, and `ActionCard` gains `done` (`is-done`, ✓, `bs-setup-step-badge is-done`, "Done", the screen-reader prefix "Done: ");
    - one CSS rule for the done marker.
  - The page's single network call, `ui/src/utils/publishAssistantRelayList.js`. `taggingPublishReport.js`'s `relayLine` gains the `not-sent` wording.
- **Server.**
  - `src/api/assistant/attention.js`: `lookupNewestReplaceable` (a replaceable kind with no `d`, local-first, the 8 s relay budget); the checks run under `Promise.allSettled`; `OUTBOX_RELAYS`.
  - `src/api/assistant/outboxRelays.js`: `checkOutboxRelays`, the pure `evaluateOutboxRelays`, and `outboxSuggestions`.
  - `src/api/assistant/relayListPublish.js`: the route; `isPublicRelayHostWithin` (c-ares `Resolver`, `{ timeout, tries: 1 }`); `LOOKUP_BUDGET_MS = 3000`.
  - `identificationTaggings.js` exports `privkeyBytesOf`. `profilePublish.js`'s `summarizePublish` counts a `not-sent` row as neither attempted nor accepted. The route is registered in `src/api/index.js`.
- **Shared library.** `src/lib/relay-list/index.js` is pure CommonJS with no imports, reached by the UI through the Vite alias `@tapestry/relay-list` (`ui/vite.config.js`). It holds:
  - `normalizeRelayUrl`, `parseRelayList` (100 `r` tags read, 50 relays per list);
  - the draft rules `addRelay`, `removeRelay`, `visibleSuggestions`, `addAll`, `sameRelayList`;
  - the publish rules `validateRelayListRequest`, `buildRelayListTags`;
  - `isPlainlyPrivateHost` / `isPlainlyPrivateRelay`, the browser's copy of `src/utils/ssrfGuard.js`'s synchronous rule, pinned to it by a drift test.
- **Domain.** Concepts named, not changed: `39998:<TA>:nostr-user` (whose Assistant) and `39998:<TA>:nostr-relay` (the relays). No concept definition changed; no firmware reinstall. The TA pubkey is resolved at runtime everywhere (`getAssistantPubkeyFor`, `getAssistantKeys`); no literal was added.
- **Data & contracts.**
  - **The event.** Standard NIP-65 kind 10002, no new wire format, `content: ''`, one `r` tag per relay with `write` / `read` / no marker. `created_at` is `max(now, newest + 1)`.
  - **The answer.** `actions['outbox-relays'] = { finished, done, pending, reason, source, createdAt, outbox[], inboxOnlyCount, suggestions[] }`, with no pubkey in it. `check-failed` carries the same shape with `suggestions: []`.
  - **The route's input and refusals.** `{ relays: string[] }` in, at most 50. 401 `not-signed-in`; 400 `not-a-relay-list` or `not-a-public-relay`; 403 `no-assistant`, all before any key is read.
  - **The route's output.** 200 `{ success, result: { ok, outcome, message, localOnly, outbox, relays: { total, success, results[] } } }`. Row statuses: `accepted | refused | unreachable | timeout | skipped | not-sent`. A failed local write is `ok: false, stage: 'local'` and nothing is sent. 500 "Could not publish your Assistant's relay list".
- **Tests.**
  - **Unit:** 79 tests in three suites (`assistant-outbox-check` 29, `assistant-outbox-relays-page` 18, `assistant-relay-list-publish` 32 plus a live H1), fixtures in `test/helpers/outboxRelaysFixtures.js`, `test/registry.js` +3.
  - **Browser:** 12 cases in `tests/brainstorm/assistant-outbox-relays.spec.js`.
  - **Re-aimed:** the hub suites (`assistant-management-page`, `assistant-attention`, `assistant-identification-tags-page`, `assistant-taggings-publish`, `test/helpers/assistantManagementFixtures.js`) and specs (`assistant-alert`, `assistant-attention`, `assistant-management-page`, `assistant-identification-tags-page`, `assistant-taggings-publish`), combined with the parallel book's re-aims where they share lines.

## 4. Deviations from intent

Harvested from story 3 § Deviations, the ADRs' § Consequences and Amendments 1–2, and the three reviews' findings, then reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 2: the list is read "from this instance's relay first and then the outside relays a relay list is published to" | As specified. Outside means the configured general-purpose, profile and WoT relays, read even in local-only publish mode. A list found only outside is not copied home | interpretation | ADR 0001 sub-decision 3 ("reading is not publishing") and § What we trade away | None until a list is published some other way | — |
| 2 | Frame bullet 3: the card "shows Needs attention until the list names at least one outbox relay" | Two readings of one answer. The card and the page are marked unless the check is done, so while checking or unfinished too. The pill counts only a finished check that found none. A failing check is `check-failed` and leaves the identification-tags answer intact | intentional-change | ADR 0001 sub-decisions 4–6, the identification-tags precedent | On first deploy the pill grows by one for almost every viewer, since no Assistant has a kind 10002 yet. Until an Assistant publishes, each page load's answer waits on outside reads, up to 8 s when a relay hangs | §6 #6 |
| 3 | Frame bullet 3 (story 1 AC-4): the Done badge, "whichever story is built first adds it" | Built here, word for word to ADR `assistant-profile-checklist/0001` sub-decision 7; that book's C4/D1/D2 tests pass against it | interpretation | ADR 0001 sub-decision 6; review 1 (ADR adherence) | The Identification Tags card on the hub shows Done too when its check is done | — |
| 4 | Frame bullet 4: "add a relay by hand … suggested relays … one at a time or accept all at once" | As specified, plus three refusals the frame did not name: more than 50 relays (copy approved at the ADR 0002 gate); a relay plainly not on the public internet (AC-6); and suggestions leave plainly-private relays out | constraint-discovered | ADR 0002 § Consequences; ADR 0003 Amendment 1; review 3 round 1 | A person cannot list a LAN or private relay as an outbox | — |
| 5 | Frame bullet 5: "keeping inbox-only entries the person did not remove" | As specified. "The newest list" is read at publish time, local first. A relay marked both that the person removes loses its inbox role too (book Decision 6). An unfinished lookup counts as none found, so inbox entries of a list that lives only on an outside relay would not be kept | interpretation | ADR 0003 sub-decisions 2–3 | Only a list published elsewhere and unreadable at publish time is at risk | §6 #7 |
| 6 | Frame bullet 5: "written to this instance's relay first, then sent out, each relay's answer shown" | Local first; then to the new list's, the previous list's and the profile publish set's relays. A list relay that does not resolve public within the 3 s lookup budget is never connected to and reads "not sent: not a public address". The worst-case press is about 19 s (newest-list read 8 s + lookups 3 s + sends 8 s) | constraint-discovered | ADR 0003 Amendments 1 and 2 (owner-chosen); reviews 3 rounds 1–2 | A relay with slow or failing DNS reads "not sent" rather than being tried | §6 #3, #4 |
| 7 | Frame bullet 5: "the page and the hub re-check afterwards" | They re-check only after a list was written (`result.ok`). A refusal, a failed local write or a request that never answers keeps the person's draft for another try | intentional-change | story 3 § Deviations; ADR 0003 Amendment 1 "Also recorded here"; review 3 round 1 | A refused press does not wipe the person's edits | — |
| 8 | Story 3 § Copy: "Sign in to have your Assistant publish its relay list." | Unreachable for a real anonymous caller: the auth middleware's default deny answers 401 "Authentication required for this action" first (checked on staging at close). The page calls the route only for a signed-in viewer | constraint-discovered | this close's staging check; the same finding as `assistant-identification-tags` audit §4 #12 | None in the page | — |
| 9 | Story 3 AC-1: the report in the profile publish's sentence shapes | When every list relay is `not-sent` and Relay Settings is empty, the summary says "no general-purpose, profile or WoT relays are configured"; the rows underneath are right | constraint-discovered | review 3 round 2 R2-2; ADR 0003 Amendment 2 "Not changed" (a sentence of its own needs new approved copy) | A rare edge reads misleadingly | §6 #5 |
| 10 | Frame bullet 6: "nothing else gains the power to sign as an Assistant … no other action page changes" | Held. One narrow, session-bound route; no creation-time publish (story 3 S3); the generic signer untouched. Shared surfaces changed without behavior change for their other callers: `summarizePublish` (`not-sent`), `relayLine` (`not-sent`), `privkeyBytesOf` exported, the hub's Done badge | — | ADR 0003 sub-decision 6; Amendment 1 point 2 | None | — |
| 11 | Frame bullet 6 (nothing else changes) | Outside the book's own diff, its round-1 review found shell command injection in `POST /api/negentropy-sync` while checking precedent. It was hotfixed separately by the owner's decision (`95876ca` on `staging`; on `main` and in production since PR #830, merge `14e140b`, 2026-10-09). Who may start a sync, and with which relays, is still an open access-scope decision | constraint-discovered (outside the book) | review 3 round 1 § Out of scope; ledger `2026-10-09-negentropy-sync-hotfix-prod` (DONE) and `2026-10-09-negentropy-sync-access-scope` | Not this book's feature | §6 #2 |

**Undocumented work** — none. Every source file in the book's commits is named by a story, an ADR or amendment, a plan or a review. The library's `isPlainlyPrivateRelay` helper and the route's exported `NOT_SENT`, `LOOKUP_BUDGET_MS` and `isPublicRelayHostWithin` fall inside Amendments 1–2.

## 5. Quality state at close

- **`npm test` at close,** after the book flip and the epic close-out, over the tree this close leaves behind:
  `20261009T165915Z-27122-2892 [book-close-assistant-outbox-relays] started 2026-10-09T16:59:15.912Z on ff3d4e6c+dirty — FAIL, exit 1, 5254 passed, 73 failed, 582 skipped, 286/286 suites; failed: stamped-composite-avatar, my-assistant-page, one-writer-assistant-profile, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone, tagging-edges-realtime-wrapper`
  (`+dirty` is this close, uncommitted; the clone unshallowed at this close). `harness-lint` passes, 76/0, over the closed tree, with the epic Done and its folders under `done/` (L2 satisfied).
- **The six suites that fail on every run of this book are not this book's** (each review compared them suite by suite with a clean `origin/staging` worktree):
  - five suites of the parallel book `assistant-profile-checklist`, whose Phase-3 tests are intentionally failing on `staging`: `stamped-composite-avatar`, `my-assistant-page`, `one-writer-assistant-profile`, `assistant-profile-checklist-page`, `assistant-stamped-avatar-for-everyone`;
  - its `assistant-profile-check`, which has three more passes with this book (the Done badge it specifies).
- **Correction to the review record: `harness-lint` L10 `commit:f932e16` was never a real violation.** Reviews 1–3 called it "pre-existing … another session's docs commit". In fact `f932e16` is this checkout's shallow-clone boundary (listed in `.git/shallow`), and ledger `2026-10-07-shallow-clone-trips-lint-l10` describes exactly that. After `git fetch --unshallow origin` at this close, `bash scripts/harness-lint.sh` reports "clean (0 violations)". CI checks out with `fetch-depth: 0` (`.github/workflows/test.yml`), so it should not fire there either. I could not read PR #829's CI log to confirm (its log host is unreachable from this session). The same day, PR #830 into `main` passed the same required `stack-free` check, which is consistent with L10 not firing on CI.
- **Flake.** `tagging-edges-realtime-wrapper` RW7 failed in round 2's and round 3's full gates and in the close gate above, and passes alone six of six. This book touches none of its files. It is the known flake, ledger `2026-10-08-realtime-wrapper-timing-flake-under-load` (both occurrences appended at this close).
- **The book's suites at round 3:** `assistant-relay-list-publish` 32/0/1, `assistant-outbox-relays-page` 18/0/0, `assistant-outbox-check` 29/0/0. The re-aimed `assistant-taggings-publish` 19/0/1 and `assistant-identification-tags-page` 16/0/0; `assistant-publish-relays` 39/0/0; `nip05-ssrf-guard` 21/0/0.
- **Browser classes, chromium, against a `vite build` served by `vite preview`:**
  - round 2: six specs together, 70 passed, 3 skipped, 1 failed;
  - round 3 (no `ui/` change since round 2): `assistant-outbox-relays.spec.js` 12/12.
  - The one failure is `assistant-attention.spec.js` B4. It expects the parallel book's count (8 placeholders once its profile action is checked) and reads 9 until that book lands.
  - The 3 skips are `assistant-management-page` B8 for the three built pages.
- **Reviewer probes** (rounds 1–3; nothing sent):
  - the route with injected fakes;
  - a stubbed resolver beneath the real `ssrfGuard`: every private, encoded-loopback, link-local and Docker-name address is refused 400 before any key is read; private-resolving, mixed and unresolvable list relays are `not-sent`;
  - the real c-ares path against a local DNS server: a public name is true, private and NXDOMAIN names are false, a silent server is false at its budget, and 50 hung lookups left the threadpool free (8 `pbkdf2` jobs done in 39 ms).
- **Staging, checked at close:** `/assistant/outbox-relays` 200; anonymous attention `{"success":true,"signedIn":false}`; anonymous POST to the route 401. **Not exercised: the signed-in flow** (ledger `2026-10-09-outbox-relays-signed-in-staging-check`).
- **Production:** pending for this book. PR #829 (`staging` → `main`) is blocked by its required `stack-free` check, which fails on the parallel book's intentionally failing Phase-3 tests now on `staging`. The negentropy-sync hotfix went to production on its own (PR #830, merge `14e140b`, deploy run 139, production smoke clean).
- **Known open issues:**
  - ledger `2026-10-09-connect-to-vetted-address`: after the c-ares check passes, the socket looks the name up again on the threadpool. That is DNS rebinding's two-query class, accepted in Amendment 1;
  - ledger `2026-10-09-ssrfguard-ipv6-ranges`: `fec0::/10` and `100::/64` count as public, in the guard and in the page's copy;
  - ledger `2026-10-09-negentropy-sync-access-scope`: who may start a negentropy sync, and with which relays (the input hotfix itself is in production, PR #830).
- **Debt from the ADRs' Consequences and the reviews:**
  - two relay-URL normalizers (`relayKey` / `outsideOnly` versus the stricter `normalizeRelayUrl`), ADR 0001; filed at this close as ledger `2026-10-09-two-relay-url-normalizers`;
  - the page reuses `bs-idtags-*` card classes, and a third page would want a neutral `bs-action-card` (ADR 0002);
  - a second narrow assistant-signed route, with a shared module a candidate once a third arrives (ADR 0003);
  - the ssrfGuard-backed wrapper written twice, in `outboxRelays.js` and `relayListPublish.js` (review 3 R2-5);
  - the page's dependency-free copy of the guard's tables, held in step by the A1 drift test (ADR 0003 Amendment 1).

## 6. Carry-forward register

- [ ] **1. Promote to production.** PR #829 waits on its required `stack-free` check. That check is red because of the parallel book's Phase-3 tests on `staging`; L10 should not be a factor on CI (§5). Since PR #830, #829 also has a merge conflict in `test/registry.js`: `main` got the hotfix as a cherry-pick. The owner chose to clear it at promotion time by merging `main` into `staging` and keeping staging's suite lines. Checked 2026-10-09, the merged tree equals staging's, so no file changes. (audit header; ledger `2026-10-07-staging-sessions-push-red-tests`, occurrence appended)
- [ ] **2. Who may start a negentropy sync, and with which relays:** an access-scope decision for the owner. The input hotfix itself is on `main` and in production (PR #830, merge `14e140b`; ledger `2026-10-09-negentropy-sync-hotfix-prod`, DONE). (§4 #11; ledger `2026-10-09-negentropy-sync-access-scope`)
- [ ] **3. Exercise the signed-in flow on staging:** publish a list as a real Assistant, see the per-relay report, see the hub card turn Done and the pill drop by one. (§5; ledger `2026-10-09-outbox-relays-signed-in-staging-check`)
- [ ] **4. Connect to the vetted address,** closing both DNS rebinding and the second, threadpool-bound lookup; codebase-wide, with `nip05` verify. (§4 #6; ledger `2026-10-09-connect-to-vetted-address`) And the guard's two IPv6 ranges (ledger `2026-10-09-ssrfguard-ipv6-ranges`).
- [ ] **5. Report wording edges:** the all-not-sent summary that blames empty settings (§4 #9, needs copy); the `not-a-public-relay` refusal does not name the relay (review 3 R2-4); the suggestions panel shows only its explainer when the attention request fails (review 2 non-blocking 1).
- [ ] **6. First-deploy weight of the outbox check:** until each Assistant publishes, every hub and pill load reads the configured outside relays (§4 #2). Watch it on staging; ADR 0001 accepted it.
- [ ] **7. Lists published elsewhere:** inbox entries of a list held only on an outside relay and unreadable at publish time are not kept (§4 #5). Also, a list found only outside is not copied home (§4 #1).
- [ ] **8. The inbox (`read`) side and its page,** for when the Assistant handles DMs; publishing a list at Assistant creation or when Relay Settings change; making the Assistant's other publishers (trusted assertions, trusted lists, DLists) send to the relays the list names. (epic § Deferred; story 3 Out of scope)
- [ ] **9. Code debt noticed, not fixed:** two relay-URL normalizers (ledger `2026-10-09-two-relay-url-normalizers`); the `bs-idtags-*` classes outside their page; a shared assistant-signed publish module at a third route; the duplicated ssrfGuard wrapper. (§5 debt)
- [ ] **10. Two tabs editing the list: last write wins** (ADR 0003 § What we trade away). Accepted; only worth revisiting if people report lost relays.

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-10-09):
- 270 reviews parsed: 268 final PASS, 2 final CHANGES_REQUESTED, 62 with kick-back history, re-review churn 3.
- The headline kick-back rate reads 0% because it counts final verdicts only, so story 3's two sent-back rounds are invisible there (OPEN.md row 309, already open).
- 15 phase commits matched this epic by name.
- Books: 71 closed before this one, 10 open.

**What held.**
- The shared line was re-checked before Implementation and before each review round (`git fetch`, `git merge-tree --write-tree HEAD origin/staging`, ledger `2026-09-22-parallel-books-no-shared-line-recheck`). It was clean every time.
- Building the Done badge exactly as the parallel book's ADR specifies made its own tests pass against this book's code.
- Rounds 2 and 3 kept ADR, test and implementation in separate commits, and every fix was re-derived from commands rather than taken from prose.

| Finding | Source | Terminal state |
|---|---|---|
| **Architecture never asks whether the server connects to an address a user supplies.** ADR 0003 reviewed only what its route signs, and the fan-out would have opened sockets to private addresses. **Extended at this close:** the remedy then needed its own bounds (round 2: unbounded DNS lookups on the threadpool), so the checklist line should also ask for time and concurrency bounds on every lookup and connection. Ports to Direction mode: yes, the same Architecture phase | review 3 round 1 harness friction 1; round 2 (R2-1) | OPEN.md row `2026-10-09-architecture-misses-outbound-connections` (a paragraph appended at this close) |
| **Phase-4 test corrections landed inside the `impl:` commit;** `.claude/commands/implement-feature.md` does not restate that they go to the Tester's lane in their own `test:` commit. Ports: yes | review 1 harness friction 1; review 3 round 1 harness friction 2 | OPEN.md row `2026-10-09-phase4-test-fixes-own-commit` |
| **The review template's closing "On PASS" heading made round 2's CHANGES_REQUESTED review lint as PASS-final** (L1), until the reviewer renamed the heading. That is the third occurrence. Ports: yes | review 3 round 2 (lint during the review) | OPEN.md row `2026-10-07-on-pass-heading-reads-as-verdict` (occurrence appended) |
| **A parallel book's intentionally failing Phase-3 tests on `staging` now block an unrelated promotion:** PR #829's required `stack-free` check is red because of them, holding back this finished book; the negentropy hotfix had to reach production through its own PR (#830). Ports: yes | this close; coordinator's promotion state | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (occurrence appended) |
| **The shallow-clone L10 artifact was misread as a real violation** by three reviews in this book, and the misreading reached a promotion decision ("blocked by … L10"). Ports: yes | reviews 1–3 quality gates; this close's unshallow check | OPEN.md row `2026-10-07-shallow-clone-trips-lint-l10` (occurrence appended) |
| **`tagging-edges-realtime-wrapper` RW7 flaked in two full gates,** one with no deliberate load from the reviewer, against the row's "two gates share the machine" premise | review 3 rounds 2–3 | OPEN.md row `2026-10-08-realtime-wrapper-timing-flake-under-load` (both occurrences appended) |
| **The Implementer did not log the refresh narrowing and the test corrections under a story `## Deviations` in Phase 4;** they were logged in round 2 | review 3 round 1 non-blocking 1–2 | declined: `roles/implementer.md` step 9 already requires it, the miss was caught and corrected inside the same book, and the Phase-4 row above covers the commit-placement half |
| **After an epic close-out, code and test header comments name the pre-move paths** (`engineering-team/stories/assistant-outbox-relays/…`). The workflow's "no link-rewriting needed" holds only for links inside the moved folders | this close | declined: the file names are slug-unique and found by name after the move, as the sibling books' comments already are; rewriting production comments in a docs-only close would widen every close's diff |
| **The headline kick-back rate hides re-review rounds** (story 3's two sent-back rounds read as 0%) | `harness-stats.sh` at this retro | OPEN.md row 309 (already open) |
