# Build Audit: Shared Concepts Row Detail

**Book:** `engineering-team/audits/shared-concepts-row-detail/book.md`
**Date:** 2026-09-20
**Branch / commit range:** `c6679845..29278355` on `feat/shared-concepts-row-detail`; merged to `staging` as `04a78a7b` (PR #699), promoted to `main` as `440600b3` (PR #701). In production.
**Provenance:** Acceptance-frame
**Confidence:** **high** — the frame was written at intake before any code, confirmed with the owner in the same session, and amended twice by the owner at gates with each amendment recorded in `book.md` at the moment it was made. Nothing here is reconstructed.

## 1. What shipped

- **A per-row detail panel on Active b-tags**, closed by default, opened by a disclosure control that does not disturb the row's existing navigation — showing the description from the **local** DList Header carrying the b-tag, plus the b-tag itself with one-click copy — `stories/done/shared-concepts-row-detail/1-row-detail-panels-on-active-tag-pages.md`
- **The same panel on Active z-tags**, showing the foreign concept header's own description and the z-tag coordinate — same story
- **Both wire-coordinate columns retired from their tables**, with both values still matched by the filter box, and descriptions now matched too — same story
- **`.text-muted` defined app-wide**, making 132 previously-inert muted strings across 43 files render as their authors intended — same story, owner-directed at the Architecture gate
- **Two reusable `DataTable` capabilities** — `filterKeys` (match row values that have no column) and `renderExpanded` (per-row disclosure + panel row) — available to the other 23 callers without further design work — ADR `shared-concepts-row-detail/0001`

## 2. Epics & stories rolled up

### Epic: `shared-concepts-row-detail`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 row-detail-panels-on-active-tag-pages | Disclosure panels on both Active …-tags pages; tag columns retired but still filterable; descriptions filterable; `.text-muted` defined | Done | `reviews/done/shared-concepts-row-detail/1-row-detail-panels-on-active-tag-pages.md` (PASS) |

## 3. As-built inventory

**User-facing**
- `/tapestry/shared-concepts/b-tags` — `b-tag` column removed; trailing disclosure column added; panel row per expanded row. Row click still routes to `/tapestry/shared-concepts/b-tags/:coord?b=<value>`, unchanged.
- `/tapestry/shared-concepts/z-tags` — `z-tag` column removed; same disclosure column and panel. This page has no row-click destination and did not gain one.
- **App-wide:** every element carrying `className="text-muted"` now renders `#8b949e` instead of `#e6edf3` — 132 occurrences across 43 files, including surfaces this book never otherwise touched.

**Domain**
- No concept definitions changed. **No firmware reinstall required.**
- Concepts read, not modified: `39998:<TA>:concept-header` (the kind-39998 event behind every row on both pages; source of the `description` tag surfaced here) and `39998:<TA>:shared-concept` (what a b-tag points at and a z-tag files under). `<TA>` is per-deployment and resolved at runtime via `useConfig()` on both pages; no pubkey is written into any changed file.

**Data & contracts**
- **No new fetch, endpoint, event kind or stored shape.** Both pages already retrieved the events the panels display; the book added a field to an object that already existed. The test suite pins this as a regression guard (`R3`: ActiveBTags must keep exactly 1 `queryRelay` call, ActiveZTags exactly 2).
- `ui/src/components/DataTable.jsx` — two optional props added to a component with 25 callers. Both default to absent; omitted, the rendered DOM is unchanged.
- `ui/src/components/TagDetailPanel.jsx` — new shared component, props `{ description, tagLabel, tagValue }`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "the description from the DList Header — the **local** event, not the shared one" | On b-tags, the local carrier's description. On z-tags, the **foreign header's own** description. | interpretation | A z-tag row *is* a foreign-authored header (`ActiveZTags.jsx` skips the local TA), so no local event stands behind it and the distinction has no z-tag analogue. Surfaced before the story was written and recorded in `book.md` § Frame notes at kickoff. | None — it is the only description that exists on that page. | — |
| 2 | Frame at intake said nothing about filtering by description | The description is matched by the filter box on both pages | added-beyond-scope → **owner-directed** | Owner amended the ask at the planning gate ("make the description filterable too"); frame bullet added the same day with the amendment dated in place. | Positive: rows are findable by text that is only visible inside a closed panel. | — |
| 3 | Frame at intake said nothing about muted text | `.text-muted` defined once, globally | added-beyond-scope → **owner-directed** | The Architect surfaced the dead class as a finding and proposed deferring it; the owner directed fixing it here instead ("fix the text-muted class too"). ADR 0001 § Decision, "Scope amendment". | **Widest-reaching change in the book, and the least related to its subject** — 132 strings across 43 files change colour in production. | §6 item 1 |
| 4 | Not in the frame or the story's criteria | Sorting by the tag column is gone, along with the column | constraint-discovered | Removing a column removes its header, and with it the click target that sorted by it. Flagged by the Architect in ADR 0001 § Consequences and accepted there rather than discovered at review. | Negligible — sorting a list by an opaque `kind:pubkey:slug` has no reading anyone wants. Recorded so it is not later read as an accidental loss. | — |
| 5 | ADR proposed `descriptionOf` stay local to each page | It did — the helper now exists in three files | intentional-change | House style: `singularName` was already duplicated across two of these files and `ActiveZTags` carries a third variant (`bestName`). Extracting them would touch the b-tag pair page, which the story put out of scope. ADR 0001 § Consequences, "New debt". | None. | §6 item 2 |

**Undocumented work** — none. All 14 files in the book's diff trace to the story, its ADR, or its test plan. The two ledger rows the book filed are process artifacts, not product surface.

## 5. Quality state at close

- **Test gate at close:** `npm run gate:status` →
  `20260920T060602Z-16829-80d9` started 2026-09-20T06:06:02.574Z on `b9efca93` — **FAIL**, exit 1, **3371 passed, 5 failed, 59 skipped, 208/208 suites**; failed: `tl-membership-method-selector`, `tl-weighted-sum-method`, `tl-certainty-method`, `summaries-element-count`.
  **All four failures are pre-existing and already ledgered; none is reachable from this book's diff, which is entirely `ui/src` plus its own tests.** Three are `OPEN.md` row 191 (the `trusted-lists` publish-posture guard, red by default on a machine that keeps external publishing on). One is `OPEN.md` row 285 (`summaries-element-count` L5's `firmware-concept` control went stale when the operator began subsetting that concept on 2026-09-12; verified live during review — `/summaries` gives `elementCount: 37, setCount: 3` against a direct-only count of 28, exactly the widening row 285 predicted). **This book's own suite passes inside the full run: 21 passed, 0 failed.** A close-time re-run was not performed: the gate takes multiple hours on this machine, and the tree changed only by documentation after `b9efca93`.
- **Verified in production** (`440600b3`, deploy run 35527432499, 1m30s): both pages render the retired-column layout with panels closed on load; a panel opens with description and full coordinate; filtering by a fragment that exists *only* in the retired column returns its rows with zero panels open; muted text computes `rgb(139, 148, 158)` against body `rgb(230, 237, 243)`; a non-opting `DataTable` page (Concepts, 44 rows, 15 columns) shows 0 blank header cells and 0 disclosure buttons.
- **Per-deployment TA pubkey exercised across three distinct instances** — local `11f23fe4…`, staging `8e901369…`, production `919ba08a…` — all rendering correctly. The hardcoding failure mode CLAUDE.md warns about could not have survived this.
- **Known open issues / accepted:** `OPEN.md` rows 191 and 285 (above, both pre-existing). Ledger row `2026-09-20-muted-class-dims-failure-messages` (below).
- **Debt logged by the ADR:** `descriptionOf` in three files (§4 #5); `filterKeys = []` is a fresh array each render, so the filter memo no longer memoizes for the one caller with stable `columns` (`BrainstormFollows.jsx:148`) — measured as negligible because the memo early-returns on an empty filter; `renderExpanded` keys panel state by `rowKey`, which falls back to row index for callers with no stable `uuid` (documented as a precondition, not solved generally).

## 6. Carry-forward register

- [ ] **Decide whether the eight muted failure-message strings should be muted at all.** Defining `.text-muted` made it real for 132 call sites; eight carry error or failure text and are now *less* prominent, including `HeaderEvent.jsx:49`, which dims a real caught error string. Nobody has ever seen these muted, because the class did nothing until this book. Ledger row `2026-09-20-muted-class-dims-failure-messages`. (from §4 #3)
- [ ] **Extract the event-tag readers** — `singularName` / `bestName` / `descriptionOf` now live across four shared-concepts files in three variants. A shared module is the obvious cleanup; it touches the b-tag pair page, which this book excluded. (from §4 #5)
- [ ] **Offer `renderExpanded` / `filterKeys` to the other 23 `DataTable` callers where they'd help.** The mechanism is built and guarded; adoption was deliberately not attempted here. (story § Out of scope)
- [ ] **`aria-controls` on the disclosure button.** `aria-expanded` is present and correct, so state is announced; the button-to-panel relationship is not. (review § non-blocking 4)
- [ ] **Neither page's shared-name column is matched by the filter**, and never was — `sharedName` is a virtual column with no row field, so `DataTable`'s column-derived filter has always missed it. Pre-existing, noticed while auditing the filter; out of this book's scope.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time: **1163 phase commits · 224 reviews decided · kick-back rate 0% · churn 3 · books open 7 / closed 54 · cycle-time median 0d across 197 of 250 matched stories.** The 0% kick-back rate is the number worth reading here: this book's review passed first time, consistent with the corpus, which means the review gate is not currently a source of correction pressure — the corrections in this book came from *tests* failing the implementation twice (F1 below), not from the reviewer.

| Finding | Source | Terminal state |
|---|---|---|
| **CLAUDE.md claims local source edits are live via a bind mount; the running container has no bind mount and served a 3-day-old baked image.** The failure is silent — build succeeds, page loads, browser shows old code — and it made a correct implementation report ten Playwright failures. | review § Harness friction 1 | **OPEN.md row `2026-09-20-claude-md-overstates-bind-mount`** |
| **A full `npm test` is not completable on this machine** (208 suites, multiple hours), so the Reviewer role's instruction to run the gate and quote a `gate:status` verdict cannot be satisfied in-session. | review § Harness friction 2 | **OPEN.md row 191** (pre-existing; not re-filed — a duplicate would be noise) |
| **Two Tester assertions pinned *spelling* rather than behaviour**, and Phase 4 had to reshape correct code to satisfy them: `S4` required `rowKey()` re-derived at each use site rather than bound to a local, and `S14` anchored the CSS rule to a preceding `}`, which a comment between rule and predecessor broke. The Implementer moved the code rather than loosening the tests — the right direction — but the cost was real and the tests are now slightly over-constraining for future edits. | Phase-4 implementation notes; `test/shared-concepts-row-detail.test.js` S4, S14 | **OPEN.md row `2026-09-20-source-assertions-pin-spelling`** |
| **A backgrounded `npm test` wrapped in a shell compound reported "exit code 0" while the gate had recorded FAIL.** The wrapper's trailing `echo` supplied the exit status, masking the gate's `exit 1`. A session trusting the notification would have recorded a false PASS into a review. | this session's gate run `20260920T060602Z-16829-80d9` vs its task notification | **OPEN.md row `2026-09-20-backgrounded-gate-exit-code-masked`** |
| **Retiring this epic to `done/` broke this book's own test suite.** Step 9 moved the story and ADR; the suite held both as path constants and its two D-class tests went red (`19 passed, 2 failed`) — caught only because step 10 runs the gate *after* the flip. Fixed here by resolving either location. A scan of `test/` found the same trap loaded in **4 other suites across 2 epics** (`second-brain`, `task-queue-scheduler`), none broken today. | this close, steps 9–10; `test/shared-concepts-row-detail.test.js` | **OPEN.md row `2026-09-20-epic-retirement-breaks-suite-paths`** |
| **`OPEN.md` row 285's prediction came true and the row's numbers are now stale** — it recorded a direct-only count of 33 "after the first subset" and warned the gap would widen; a second subset landed 2026-09-13 and the count is 28. | review § Quality gates; live `/summaries` check | **declined** — no new row. Row 285 already states the mechanism, names the fix as test-only, and records the operator's 2026-09-13 deferral; updating one number in it changes no decision, and the row's own text already anticipates the drift. |

**Does any of this port to the other flow (Direction ↔ human-gated)?** Yes, three: the masked background exit code (F4) is *worse* under Direction, where no human reads the notification's phrasing and a Director could bank a false PASS into a gate verdict; and the CLAUDE.md bind-mount drift (F1) would silently invalidate a Direction run's own browser verification the same way it did here. Both rows note the Direction exposure. The epic-retirement breakage (F5) ports too, and is the one a Direction run would handle *worse* than a human: its symptom appears in an unrelated session's gate run, far from the close that caused it, with nothing linking the two.
