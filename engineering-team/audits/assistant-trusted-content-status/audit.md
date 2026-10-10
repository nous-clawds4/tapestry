# Build Audit: Scores, Lists and Concepts on the Assistant Management page — renamed, and each told true

**Book:** `engineering-team/audits/assistant-trusted-content-status/book.md`
**Date:** 2026-10-09
**Branch / commit range:** `7e38a0d5^..43864a26` on `feat/assistant-trusted-content-status`, merged into `staging` by PR #832 as `17243cdf`.
- **Commits.** 10 of the book's own: 1 story, 1 adr, 5 test (the Phase 3 failing tests, then four Tester-lane commits during Phase 4 and the merges), 1 impl, 2 review (the PASS, then a PASS addendum for a merge). There are also three merges of `origin/staging` into the branch:
  - `dec9128e`, clean;
  - `ed58fc80`, which brought in `assistant-outbox-relays` #1–#3, with ten conflicts resolved;
  - `b3f9d615`, which brought in `assistant-profile-checklist` #1–#3, with five conflicts resolved after the PASS.
- **Staging: deployed.** `staging.brainstorm.world` runs it (deploy run 37993092751, about 97 s; smoke tiers 1–5 pass).
- **Production: not yet.** It waits for the owner's next `staging` → `main` promotion.

**Provenance:** Acceptance-frame. There is no PRD. The owner's ask is quoted verbatim in `book.md`. Two decisions were settled at intake: what "completed" means, and the Standard path. The frame was confirmed at intake on 2026-10-08, and one more answer was settled at story approval (the link to `/treasure-map`).
**Confidence:** **high** for what the code does, **medium** for the frame as a person will meet it.
- **Every frame bullet traces to the one story,** which passed review on its first round, plus an addendum for the post-review merge. Both reviews were run by fresh reviewer agents. Between them they ran 15 mutants against the code, re-ran the gate and compared it with a staging baseline, and probed the merged handler's isolation on a scratch copy.
- **What the record cannot show.** Nobody has exercised the signed-in path on a live instance: a real viewer's Treasure Map read by the server inside the container, a card turning Done, the pill moving. No browser session with a nostr signer was available. The browser tests mock every `/api` route, and the server tests inject their reads. Two things were confirmed instead: the production image ships both `src/lib/` and `ui/src/` (`Dockerfile:92`), and Node 22 loads the `.mjs` rule from CommonJS (review). Staging was checked anonymously at close: the routes answer, the bundle carries the new words, and `GET /api/assistant/attention` answers `{"success":true,"signedIn":false}`.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **The names.** On `/assistant`, *Publication of Trusted Content* now opens with **Scores**, **Lists** and **Concepts**, the Treasure Map page's three categories, then Bounties, Pins and Tags. Each card keeps its description, its NIP link and its address (`/assistant/trusted-assertions`, `/trusted-lists`, `/dlists`). The page behind each card is titled with the new name, gives the rule as its *Alert criteria*, and links to `/treasure-map` with "Manage your Treasure Map →". — `stories/done/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md` (AC-1)
- **One real answer per category.** `GET /api/assistant/attention` now also answers `trusted-assertions`, `trusted-lists` and `dlists` for the signed-in viewer's own Assistant here (AC-2–AC-4).
  - **Which Map:** the viewer's newest Treasure Map, read the way `/setup` reads it: this instance's relay first, then, only on a miss, the outside relays a Map is published to.
  - **Read the same way as `/treasure-map`:** the Treasure Map page's own category rule.
  - **Done** when the viewer's Assistant is among the Assistants the Map gives the category to, alone or beside others.
  - **Otherwise pending,** with `no-map`, `not-assigned` or `other-assistants-only`, or unfinished with the lookup's reason.
  - The answer carries no pubkeys, and a request parameter can't change whose Map is read.
- **The hub tells the truth for these three.** Each card shows the hub's Done look (green ✓, a "Done" badge, and "Done:" for screen readers) once its check says done, and **Needs attention** otherwise, including while the answer is on its way. The count line counts the cards the way they are marked. The Assistant Alert counts a category only when a finished check found it needing attention (AC-5).
- **It catches up.** Saving the Treasure Map on `/treasure-map` makes the app ask for the attention answer again, so the hub and the pill follow without a reload. There is no polling (AC-6).
- **One home for the category rule.** The rule moved, unchanged, from the Treasure Map page into `src/lib/treasureMapCategories.mjs`. The page re-exports it, and the server loads the same file, so the two can't drift apart (ADR 0001 sub-decision 1).
- **The contracts are written down:** `src/api/openapi.yaml` (the three keys and their fields) and BIBLE §11's attention row.

## 2. Epics & stories rolled up

### Epic: `assistant-trusted-content-status` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 scores-lists-and-concepts-on-the-hub | The names, the page words and link, the server check, the hub's readings and Done look, the catch-up after a Map save, the shared rule module | Done | `reviews/done/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md`: PASS (gate `review-tcs1`), plus a PASS addendum for the merge of `assistant-profile-checklist` (gate `review-merge2`) |

**Epic close-out at this close.** The one story is Done and the work is on the shared line (`staging`). Step 9 applies as written: the epic reads Done, and its story, ADR and review folders sit under `done/`. Production is not a condition of step 9 and is recorded as pending (§6 #1).

## 3. As-built inventory

Derived from what PR #832 brought into `staging` (`git diff 17243cdf^1 17243cdf`). It touched 37 files (+2471 −181); `src/` and `ui/` account for 7 of them (+306 −142).

- **User-facing.**
  - `ui/src/pages/assistant/actions.js`: the three entries' titles, alert criteria and `editLink`; `CHECKED_ACTIONS` gains `trusted-assertions`, `trusted-lists` and `dlists`. Since the merges the list is `profile, identification-tags, outbox-relays, trusted-assertions, trusted-lists, dlists`, in `ASSISTANT_ACTIONS` order.
  - The placeholder page (`ActionPage.jsx`) and the hub card (`Index.jsx`) needed no change. The Done look on `staging` is `assistant-outbox-relays` #1's build, of the same design (§4 #1).
  - `ui/src/context/AssistantAttentionContext.jsx`: the `onEventPublished` listener calls `refresh()` for a kind 10040 by the viewer.
  - `ui/src/pages/treasure-map/manageTreasureMap.js`: re-exports the rule; behaviour unchanged.
- **Server.**
  - `src/api/assistant/trustedContent.js` (new): `checkTrustedContent`, `evaluateTrustedContent`, `loadCategoryRule` (a memoized dynamic `import()` of the `.mjs`, forgotten on failure), and `TRUSTED_CONTENT_ACTIONS`. It reuses `lookupNewest` and `treasureMapRelays` from `src/api/setup/status.js`.
  - `src/api/assistant/attention.js`: `defaultDeps()` gains `mapDefaultRelays`, `loadCategoryRule` and `checkTrustedContent`. The handler settles four checks side by side: identification tags (a rejection still answers 500), outbox relays, profile, and this one (a rejection answers `check-failed` for all three keys).
  - `src/lib/treasureMapCategories.mjs` (new): an import-free ES module, the first `.mjs` in `src/lib/`.
- **Domain.** No concept, schema or firmware change. Whose Map and whose Assistant come from the session (`39998:<TA>:nostr-user` instances).
- **Data & contracts.** No new event kind, route or stored shape. Kind 10040 is read, never written. The attention answer gains three keys of shape `{ category, finished, done, pending, reason, source }`.
- **Tests.**
  - New: `test/assistant-trusted-content.test.js` (30 tests, registered), `test/helpers/trustedContentFixtures.js`, `tests/brainstorm/assistant-trusted-content.spec.js` (TC1–TC5), and SV17 in `tests/brainstorm/treasure-map-save.spec.js`.
  - Re-aimed: the shared hub fixtures, five Node suites, and five browser specs. `treasure-map-needs-attention` S4 was narrowed (§4 #4).
- **Harness.** The book, epic, story, test plan, ADR and review; six new ledger rows and one existing row extended (§7); and dated notes on `assistant-management` audit §6 #1 and treasure-map-card-details #1 AC-7.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "a green ✓ marker and a green 'Done' badge … Identification Tags gains it too" | The look shipped, but as `assistant-outbox-relays` #1's build, not this book's | interpretation | Three books shared one design (ADR assistant-profile-checklist/0001 sub-decision 7), "whichever builds first". Phase 4 built it here first, then the `ed58fc80` merge took staging's identical build (story § Deviations, corrected at review) | None | — |
| 2 | Story AC-2: "found where `/treasure-map` finds it: this instance's relay first, then the general-purpose relays" | The server reads `/setup`'s Map list: the NIP-85 home relay, Relay Settings' Trusted Assertion relays and popular general-purpose relays, minus this instance's own | intentional-change | ADR 0001 sub-decision 3: one "finished" rule, shared with `/setup`. The browser hook reads the concept graph's general-purpose set instead | Where the lists differ, the hub can say "no Map" or unfinished while `/treasure-map` shows one. It is never a wrong Done | §6 #4 |
| 3 | Frame: done when the Map "gives that category to their Tapestry Assistant" | Only each entry's *first* Assistant counts. A Map that names the viewer's Assistant only as a backup reads as needing attention | interpretation | ADR 0001 sub-decision 2: read exactly as the cards read it, and the card shows only the first delegate | A person who keeps their Tapestry Assistant as a backup sees Needs attention | §6 #5 |
| 4 | treasure-map-card-details #1 AC-7: "the count doesn't learn about the Treasure Map" | The pill's count now covers Scores, Lists and Concepts, answered by the server from the Map | intentional-change | The owner's frame bullet 4. That AC was a scope boundary for its own story. Its negative pin (S4) was narrowed, not removed, and the review judged the narrowing legitimate; the old story carries a dated "superseded in part" note | The pill can move when the Map changes | — |
| 5 | (none) | On a page load where this instance's relay holds no Map, the attention answer, and so the pill, waits up to about 8 s for outside relays | constraint-discovered | ADR 0001 "What we trade away"; `/setup` already pays the same wait | A slower first pill for some viewers | §6 #6 |
| 6 | Frame: the items renamed | The FAQ still says "Trusted Assertions (kind 3038x)", "Trusted Lists" and "Decentralized Lists", and so do the cards' descriptions | deferred | Story § Out of scope (descriptions, NIP links and FAQ unchanged) | Mixed vocabulary on one page | §6 #7 |
| 7 | (none) | The three pages remain placeholders: no status, no reason, no fix beyond the link | deferred | Story § Out of scope and Open question 1 (one link, nothing more) | The reasons exist in the answer, but no page shows them | §6 #3 |

**Undocumented work:** none. Every file in the PR traces to the story, the ADR, the test plan, the review, or a merge resolution recorded in a merge commit and the review addendum. Two pieces of local-only tooling were never committed: the `.claude/launch.json` preview entry `atcs-preview` (gitignored) and an agent-memory note (§7).

## 5. Quality state at close

- **`npm test` at close,** after the book flip and the epic close-out, over the tree this close leaves behind:
  `20261009T213103Z-427-2a3a [book-close-assistant-trusted-content-status] started 2026-10-09T21:31:03.580Z on 17243cdf+dirty — FAIL, exit 1, 5803 passed, 86 failed, 165 skipped, 290/290 suites`
  - 35 suites failed. `+dirty` is this close, uncommitted; `17243cdf` is staging with PR #832.
  - Every suite this book touches passes except three environmental checks:
    - two live checks timed out against the :7778 stack: `assistant-management-page` H1 ("The operation was aborted due to timeout") and `assistant-setup-state` H2;
    - `stack-free-npm-test` G2 needs the live control panel and fails the same way on the staging baseline.
  - The other 32 are the live-stack and macOS-environment suites the reviews compared, suite by suite, against a staging baseline. `router-stream-limit-on-connect` is ledger `2026-10-09-router-patch-sed-macos`.
  - `harness-lint` is clean over the closed tree, with the epic Done and its folders under `done/` (L2 satisfied).
- **The review's gates.**
  - **The branch at `ffc15aa2`:** `20261009T162409Z-77985-ea65 [review-tcs1]`, 39 suites failing, compared with a staging baseline `20261009T171010Z-60866-d501`. 38 of them were common to both; the other differences were environmental. The new suite passed 30/0.
  - **The merge re-review at `b3f9d615`:** `20261009T200711Z-77634-0a9c [review-merge2]`, 34 suites failing, none caused by the merge. It ran while another session's gate (`hgi3-impl-baseline`) used the same :7778 stack. `router-stream-limit-on-connect` P1–P3 fail on macOS on any branch (ledger `2026-10-09-router-patch-sed-macos`).
- **Node suites of all three assistant books, plus the hub and Treasure Map suites, on the merged tree:** 603 passed, 0 failed (review addendum). `assistant-profile-check` is 33/0.
- **Browser classes, chromium, against a `vite build` of `b3f9d615` served by `vite preview`:** 155 passed, 0 failed, 3 skipped across the assistant-*, `treasure-map-save`, `treasure-map-needs-attention` and `manage-treasure-map-cards` specs. The 3 skips are `assistant-management-page` B8 for the three built pages. SV17 was shown to fail on a build without the 10040 re-ask.
- **Staging smoke at close (PR #832, deploy run 37993092751):**
  - Tier 1: stable after 3 polls, Neo4j ready after 3.
  - Tier 2: every page and API 200; Odell's `get-user-data` returns its documented 504; search returns hits.
  - Tier 3: `/assistant`, the three pages and `/treasure-map` answer 200; the served bundle carries "Manage your Treasure Map" and the Scores criteria; anonymous attention answers `signedIn: false`.
  - Tier 4: the hub shows Scores, Lists, Concepts in order, and the Scores page shows its rule and link.
  - Tier 5: the setup, assistants, outbox, profile and identification-tags routes all answer 200.
- **Open, non-blocking:** ledger `2026-10-09-trusted-content-review-followups` holds five small items:
  - the check-failed fallback re-requires its module;
  - test D1 is looser than meant;
  - the attention.js header reads "Three actions are checked";
  - the response-shape line is out of date;
  - the openapi list sentence reads as complete when it isn't.
- **Debt the ADR logged:** the Map relay list differs between the browser hook and the server (§4 #2), and the rule module now has a server consumer, so it must stay import-free (pinned by R1).

## 6. Carry-forward register

- [ ] **1. Production.** It ships with the owner's next `staging` → `main` promotion (the owner batches promotions).
- [ ] **2. The signed-in path on a live instance.** Sign in on staging, open `/assistant`, and check that each card's mark matches your Treasure Map; then save the Map on `/treasure-map` and watch the hub follow. (Header; the same kind of gap as `assistant-outbox-relays` audit §6.)
- [ ] **3. The three pages beyond placeholders:** show the category's status and reason (the answer already carries both), and perhaps a one-click "give this to my Tapestry Assistant". (§4 #7; story § Out of scope)
- [ ] **4. One Map relay list.** The browser hook (`useTreasureMap`, concept-graph general-purpose set) and the server (`currentMap.defaultRelays()`) look for a Map in different places. (§4 #2; ADR 0001 Consequences; nearest thread OPEN.md row 249)
- [ ] **5. Backup-only assignments.** Should a Map that names the person's Tapestry Assistant only as a backup count as Done? A product question. (§4 #3)
- [ ] **6. The worst-case wait** for the attention answer on a local Map miss (§4 #5). The first lever, if it is ever measured to matter, is a memo (ADR 0001 Out of scope).
- [ ] **7. One vocabulary on the page.** The FAQ and the three descriptions still say Trusted Assertions, Trusted Lists and Decentralized Lists. (§4 #6)
- [ ] **8. Whether the Assistant actually publishes** Scores, Lists and Concepts events. The check reads only where the Map points. (story § Out of scope)
- [ ] **9. The remaining placeholders:** Bounties, Pins, Tags, Notifications and Alerts, Preferences. (`assistant-management` audit §6 #1, annotated at this close)
- [ ] **10. The review's small follow-ups.** (ledger `2026-10-09-trusted-content-review-followups`)

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-10-09):
- 1573 phase commits; 277 reviews decided, with a headline kick-back rate of 0% (final verdicts only) and 66 with kick-back history; re-review churn 3.
- 72 books closed before this one, 10 open.
- This book's story read 0 d (story → review, same day). Neither of its reviews sent it back.

**What held.**
- Every Phase 4 test correction went into its own `test:` commit, each named in the test plan. The review judged all of them legitimate.
- Fresh reviewer agents for the review and for the merge addendum. The first caught a Deviation the merge had made untrue.
- Mutant probes on the riskiest seams: the 10040 re-ask, the narrowed S4, and the shared Done look.
- Building to the parallel book's ADR text made its tests pass against this branch's code.

| Finding | Source | Terminal state |
|---|---|---|
| Phase 3's re-aim list missed two pins that read a moved file's source (W4, S1) and another book's negative pin (S4), although the ADR named the class | Phase 4 (test plan § Re-aimed suites) | OPEN.md row `2026-10-09-phase3-misses-moved-file-pins` (meta) |
| Merging a parallel book made a story Deviation untrue, and nothing re-checks Deviations after a merge. A merge *after* the PASS changed reviewed lines, and the owner chose a targeted merge re-review, which no harness step names | Review § Harness friction 1; merge addendum; `cycle-staging` conflict stop | OPEN.md row `2026-10-09-merge-stale-story-deviations` (meta; extended at this close) |
| A `git archive` staging baseline always fails `gate-result-record` A2, and the same recipe can plant a self-looping `node_modules` link in the main checkout (one was found and unlinked) | Review § Harness friction 3; addendum process note | OPEN.md row `2026-10-09-archive-baseline-gate-record-a2` (meta; extended at this close). Agent memory updated: export into a fresh, empty directory |
| The profile book's browser B2 could not pass as written | Review § Harness friction 2 | OPEN.md row `2026-10-09-profile-check-spec-b2-outbox-count`, already DONE (fixed on staging by `fabd2cb5`) |
| A gate run beside a UI build and browser tests, or beside another session's gate on the same stack, fails wall-clock tests that pass alone | Phase 4 gate `atcs-impl-final`; addendum gate `review-merge2` | OPEN.md row `2026-10-08-realtime-wrapper-timing-flake-under-load` (existing; occurrence appended) |
| `patches/strfry-router/apply-patches.sh` uses GNU `sed -i`, so its suite fails on every macOS gate | Merge addendum | OPEN.md row `2026-10-09-router-patch-sed-macos` (bug, relay-stream-gaps' lane) |
| Phase 4 test corrections belong in their own `test:` commit (`implement-feature` doesn't say so) | This book followed it, confirming the existing row | OPEN.md row `2026-10-09-phase4-test-fixes-own-commit` (existing; nothing to add) |

**Does it port to the other flow?** All three meta rows apply to Direction mode unchanged. A Director that merges a parallel book mid-run meets the same stale-Deviation and post-review-merge questions, and its judges use the same baseline recipe.
