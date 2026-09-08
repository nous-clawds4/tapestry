# Build Audit: Relay scan bounds

**Book:** `engineering-team/audits/relay-scan-bounds/book.md`
**Date:** 2026-09-07
**Branch / commit range:** `a2ab95a4^..8e4e11ad` (merged to `staging` as `2485440`, to `main` as `2083907`, to `feat/tags` as `2029ec33`)
**Provenance:** Acceptance-frame
**Confidence:** high — the frame was written at intake from a live reproduction, and every bullet was verified on the deployment it names.

> The as-built record. Factual and source-linked; it proposes nothing. `prd-seed.md` is where recommendations live.

## 1. What shipped

- **The Simple Lists pages work at any relay size.** `/tapestry/lists` and `/tapestry/lists/items` returned `Error: stdout maxBuffer length exceeded` on the two deployments with real accumulated data. Both now render. — `stories/relay-scan-bounds/1-bound-simple-lists-relay-scans.md`
- **A relay scan that outgrows its bound truncates and says so, instead of failing whole.** `/api/strfry/scan` streams to an explicit bound and reports `total` / `truncated` / `limit`. — same story
- **Per-list item counts are correct for items belonging to more than one list.** The page previously attributed each item to its *first* `z` tag, an artifact of `getTag()`; membership is now a set. — same story
- **The page total is the union of items across lists**, counted once each — deliberately not the sum of the per-list counts. — same story
- **A server-side aggregate replaces a client-side one.** `GET /api/dlists/item-counts` produces both figures in one streaming pass; the page previously fetched every list item into the browser to compute them. — same story

## 2. Epics & stories rolled up

### Epic: `relay-scan-bounds`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 bound-simple-lists-relay-scans | Bounded scan contract + server-side list-item counts + both page rewrites | Done | `reviews/relay-scan-bounds/1-bound-simple-lists-relay-scans.md` (round 1 CHANGES_REQUESTED → round 2 PASS) |

ADR: `decisions/relay-scan-bounds/0001-bounded-scan-contract-and-grouped-tally.md` (Accepted).
Test plan: `stories/relay-scan-bounds/1-bound-simple-lists-relay-scans.test-plan.md`.

## 3. As-built inventory

**User-facing**
- `/tapestry/lists` (List Headers) — reads `/api/dlists/item-counts`; subtitle shows the union total. `ui/src/pages/lists/Index.jsx`
- `/tapestry/lists/items` (List Items) — requests `ITEMS_LIMIT = 500`, renders "showing the N most recent of M on the relay", `DataTable pageSize={50}`. `ui/src/pages/events/DListItemsList.jsx`

**Data & contracts**
- `GET /api/strfry/scan` — **changed, additively.** Streams via `spawn` (was `exec` into a fixed 10 MB buffer). Response gains `total`, `truncated`, `limit`; `events` and `count` keep their meaning. `total` is `null` when the read was bounded and the true count could not be obtained. Bounds: `SCAN_MAX_EVENTS = 20000`, `SCAN_MAX_BYTES = 10 MB` — the latter is the ceiling the endpoint always had, kept so every previously-succeeding request still succeeds. `src/api/strfry/queries/scan.js`
- `GET /api/dlists/item-counts` — **new.** Returns `{counts, headers, totalItems, scannedItems, unattached, cached}`. Public, read-only. Cached behind an `(itemCount, newestCreatedAt, headerCount)` validator. `src/api/dlists/itemCounts.js`, registered `src/api/index.js:268`
- `queryRelayBounded(filter)` — **new**, additive beside `queryRelay`, which is unchanged and still used by ~20 other call sites. `ui/src/api/relay.js`

**Domain**
- Concepts read, none changed: `39998:<TA>:list` ("A list header with associated list items") and `39998:<TA>:concept-header`. Handles are constructed at runtime from relay events, never hardcoded.
- Event kinds read: 9998/39998 (list headers), 9999/39999 (list items).
- **No firmware reinstall required** — no concept definitions changed.

**Counting rules, as built** (the substance of the change)
- *Per-list count* = set membership. An item belonging to two lists counts in both.
- *Page total* = the union. That item counts once.
- The two figures deliberately do not sum: two lists of 10 sharing 5 items read 10, 10, and a total of 15.
- Items whose `z`/`e` tags name no displayed header are excluded from both, and reported as `unattached`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "The Items count shown per list is the true count" | Counting semantics were *redefined*, not merely fixed — per-list membership plus a union total, ratified by the operator mid-Architecture | interpretation | Architecture measured that the existing rule was a `getTag()` artifact undercounting every multi-list item (427 of 9,497 locally); the operator specified the intended semantics at the ADR gate (ADR 0001 §"The pivotal fact") | Displayed numbers changed on every deployment. Locally 7 of 28 counted rows read higher; the page total fell 9,497 → 9,368 | — (shipped) |
| 2 | Frame: "load and show their content on **every** deployment — including staging and tags" | staging and prod inherited it through the normal line; **tags required a cherry-pick** | constraint-discovered | `feat/tags` is 639 commits behind `staging` (last commit 2026-08-12) and could not inherit; PR #591 | Frame bullet met on all three | OPEN.md row 195 — the hand-resolved `test/test.js` will conflict at the next `feat/tags` ↔ `staging` sync |
| 3 | Frame: "a bounded set with its total stated, never a silently truncated one" | Also holds when the total is *unknowable*: `{total: null, truncated: true}` | intentional-change | Review round 1 Blocking 1 found the bounded read reported `truncated: false` when the count failed; the Implementer went wider than the reviewer's literal ask, because `total = events.length` beside `truncated: true` reads as "showing 500 of 500, truncated" (story `## Deviations`) | The frame's promise holds on the degraded path too | — |
| 4 | Frame: "Deployments holding few list items show what they show today; nothing regresses" | Story AC-5 was **amended** — the *set of items* is unchanged, but counts follow the new rule | interpretation | Deviation #1 supersedes "same counts as today"; recorded in the story's Open questions § "Resolved 2026-09-07 (at the Architecture gate)" | Small deployments see corrected, not identical, numbers | — |
| 5 | (not in frame) | Pagination on List Items | deferred | Planning chose a bounded set with its total stated; full browsability is feature work (story `## Out of scope`) | Items past the 500 most recent are not reachable from this page | Carry-forward §6 |
| 6 | (not in frame) | `filterTaggingsUsingTag` — the same unbounded-scan class | deferred | Already triaged to the event-tagging epic's performance hardening (`_intake.md`, 2026-07) | A very hot tag can still overflow that path's buffer | Stays with event-tagging |
| 7 | (not in frame) | A sweep of every other `/api/strfry/scan` caller | deferred | Considered and declined at planning; the endpoint guard is what protects them (story `## Out of scope`) | Other callers inherit the bound but do not surface `truncated` | Carry-forward §6 |
| 8 | (not in frame) | `/api/strfry/scan` still returns HTTP 200 with `success:false` on a genuine error | deferred | A contract change affecting callers this story does not touch (story `## Out of scope`; ADR 0001 Consequences) | A failed scan is indistinguishable from a successful one at the transport layer | Carry-forward §6 |
| 9 | (not in frame) | The ~356,000 items on staging/tags that belong to no list | constraint-discovered | The story makes the pages work *at* that scale; it does not clean data (story `## Out of scope`) | The page total now excludes them, so they are invisible rather than miscounted | Carry-forward §6 |

**Undocumented work** — none. Every file in the diff traces to the story or the ADR's implementation notes. The three `engineering-team/` doc files are the harness artifacts the phases produce.

## 5. Quality state at close

- **Test gate:** see §"Gate at close" below.
- **Cold-pass latency exceeds the ADR's estimate by ~3×.** `/api/dlists/item-counts` measured **39.5 s** cold on staging (473,229 items) and **38.7 s** on tags (451,914); ADR 0001 estimated 7–15 s. Cached: 1.4 s. Production, at 9,148 items, is **0.59 s** — so this is a staging/tags-scale effect only. The cache invalidates on any new list item, and those relays grow slowly, so cold loads recur there.
- **Known open, accepted:** `useProfiles` batches an unbounded pubkey set into a querystring; `/api/profiles?pubkeys=…` returns 400 locally and **414** on staging/tags/prod for pages with many authors, so author names fall back to truncated pubkeys. Pre-existing; this book improved the List Items fan-out from 4,506 authors (~293 KB of URL) to 221 (~14 KB) without resolving it. Spun off as its own task (story `## Found, not fixed`).
- **Debt logged by ADR 0001 `Consequences`:** the cache validator cannot detect a delete-plus-insert of an older event with an unchanged total (self-heals on the next write); the `truncated` signal is available to every caller but only List Items surfaces it; unattached items became invisible where the old subtitle counted them by accident.
- **Non-blocking review findings, accepted:** no single-flight on the counts cache (two concurrent cold requests each run the full pass); no `'error'` listener on `proc.stdout` although the endpoint now SIGTERMs the child on every bounded read; `resolveTotal` is exported with a "number or null" contract that would misbehave on `undefined` (unreachable from the handler).

## 6. Carry-forward register

- [ ] **Make the cold counts pass faster, or make it not block first paint** — 39.5 s on staging (§5). Prod is unaffected. (from §4 #5 context / §5)
- [ ] **Pagination on List Items** so items past the 500 most recent are reachable (from §4 #5)
- [ ] **Surface `truncated` on the other `/api/strfry/scan` callers** — they inherit the bound but present a capped set as complete (from §4 #7)
- [ ] **Decide the scan API's error contract** — HTTP 200 with `success:false` (from §4 #8)
- [ ] **Decide whether "unattached" items deserve a surface** — ~356,000 on staging, ~133 on prod, currently invisible (from §4 #9)
- [ ] **Bound the `useProfiles` pubkey batch** — already spun off as its own task (from §5)
- [ ] **`feat/tags` is 641 commits behind `staging`** — it now carries one cherry-pick; a real sync is the eventual fix (from §4 #2, OPEN.md row 195)
- [ ] **Single-flight the counts cache** if concurrent cold loads ever matter (from §5)

## 7. Process findings (harness)

Retro run against `scripts/harness-stats.sh` at close: **936 phase commits · 188 reviews decided · kick-back rate 1% (churn 2) · books open 6 / closed 40 · cycle-time median 0d (162 of 211 stories matched)**. This book contributed one kick-back, which at a 1% historical rate makes it a genuinely rare event — worth noting that the gate caught a real defect rather than rubber-stamping.

| Finding | Source (journal / review / deviation / meta row) | Terminal state |
|---|---|---|
| `npm test` cannot be run at all on a host without Meilisearch — the runner dies at suite #2 instead of skipping, so a reviewer gets no gate result at all. Worked around by requiring each suite individually (181 suites). | Review round 1 "Harness friction" 1 | **OPEN.md row 192** |
| Static regex pins over JSX produced **two** false failures in one story: `U3` forbade the named constant the ADR itself mandates; `D5` banned a substring that also appears in the correct guarded form. Twice is a pattern. Both were caught only because the Implementer argued the code was right. | Review round 2 "Harness friction" 3; story `## Deviations` ×2 | **OPEN.md row 193** |
| The local Neo4j graph carries leftover test fixtures, so ~6 goal/brain suites fail at setup on a re-run rather than on behaviour. No documented reset. | Review round 1 "Harness friction" 2 | **OPEN.md row 194** |
| A cherry-pick onto a long-stale sandbox branch cannot be content-identical when the suite list has diverged; the next sync will conflict on `test/test.js`. | This close (§4 #2) | **OPEN.md row 195** |
| The ADR carried a stale implementation bullet describing a superseded design, because an en-dash made an earlier edit silently miss its target. Caught by the Implementer re-reading the ADR at Phase 4. | Story `## Deviations` 1 | **Declined** — a one-off text-matching slip, not a harness defect. The phase that caught it (Implementer re-reads the ADR before coding) worked as designed. Ported check: none needed. |
| The test gate (`test.yml`) does not run on `feat/tags`, and `deploy-tags.yml` deploys straight off a push — so a sandbox branch takes changes with no automated verification. | This close (tags cherry-pick) | **Declined** — sandbox branches are deliberately outside the gate; the deploy is not gated anywhere and making it so is a policy change well beyond this book. Verified locally instead and said so in PR #591. Recorded here so the next person does not assume CI covered it. |

**Ports to the other flow (Direction ↔ human-gated):** rows 192 and 193 are flow-agnostic — a Direction-mode run would hit both identically, and 193 is worse there, since a Direction Implementer has no operator to argue with when a bad assertion demands worse code. Row 194 is environmental. No amendment proposed to the Director rubrics from this book.

## Gate at close

Run after the book flip and the epic close-out, so it certifies the tree this close leaves behind.

- **`npm test` — could not produce a result.** Exit 1; the runner crashed at suite #2 with
  `TypeError: fetch failed` (Meilisearch unreachable from this host). This is the defect
  dispositioned as OPEN.md row 192, not a consequence of this book — the identical crash at the
  identical output line was captured on the unmodified tree before any of this book's work.
- **Per-suite equivalent, the meaningful number:** all suites required and run individually —
  **184 suites · 2,775 pass · 54 fail · 35 skipped.** The failing-suite set is **byte-identical**
  to the pre-implementation baseline (verified by diff), so this book leaves the tree exactly as
  it found it. Those 54 are pre-existing: leftover fixtures (row 194), a missing `open-ranking`
  devDependency, Meilisearch 503s on the search proxy, and live-corpus drift.
- **This book's suite:** `relay-scan-bounds` 28 passed / 0 failed with the stack up;
  21 passed / 0 failed / 7 skipped stack-free — the latter confirmed by the required
  `stack-free` CI gate on the production promotion (run 34167277476, `Overall: PASS`).
- **`harness-lint`:** clean, 0 violations, after the book flip and epic retirement (L2 satisfied).
