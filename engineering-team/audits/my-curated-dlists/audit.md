# Build Audit: My Curated DLists

**Book:** `engineering-team/audits/my-curated-dlists/book.md`
**Date:** 2026-09-11
**Branch / commit range:** `551bbe4a..1d5b8769` on `feat/my-curated-dlists` (20 commits, 29 files — the
book-open commit plus 19 phase commits; **unmerged at close**, shipped to staging right after — §8)
**Provenance:** Acceptance-frame *(no PRD)* — restated at kickoff 2026-09-10 with the operator's
answers folded in (the items table's three views and the inherited/candidate vocabulary in the
operator's words; the shared header's fetch-then-import path; no test-data publishing)
**Confidence:** **high** for the as-built — every story reviewed by an independent reviewer subagent,
each verified live on the local stack (stubbed auth and Map, everything else real), including one real
**Import to local strfry**; **medium** for "works with a real signer on staging" — not yet exercised
(the branch is unmerged at close; the operator's own staging check follows the close)

> The as-built record — what the product *is* now, source-linked. It proposes nothing; the seed does that.

## 1. What shipped

- **A "My Curated DLists" page** under 🍇 My Grapevine, directly below TA Treasure Map. It lists every
  DList the signed-in user's Treasure Map empowers — one row per list (the first entry counts; later
  duplicates noted), whichever pubkey each entry names — with the list's name from its header (this
  instance first, then the entry's relay hint), who is empowered, and the relay hint. Only rows naming
  the viewer's **own** assistant open. — `stories/my-curated-dlists/1-my-curated-dlists-page.md`
- **A detail page with a front door.** `/tapestry/grapevine/curated-dlists/<kind>:<d>` resolves
  against the *viewer's* Map, so a shared URL never shows someone else's curation as theirs; eight
  explicit states (checking · signed out · no assistant · bad address · lookup error · no Map · not on
  your Map · another pubkey), none showing list content. — story #1
- **The two headers.** "Your assistant's DList header": where it was found, authorship checked (not
  assumed), the pointer it carries and five pointer problems (no `b` · not a coordinate · wrong type ·
  more than one · deliberately unaffiliated as its own state), a raw-event toggle hidden on load, a
  Simple Lists link when local. "Shared DList header": followed through the pointer, local first then
  the community relay, a raw-event toggle, a Simple Lists link when local. **Import to local strfry**
  for either header found only on a relay — the event exactly as signed, through the permissionless
  client-signed path, then an honest re-check. — `stories/my-curated-dlists/2-the-two-headers.md`
- **The items table with the operator's three views.** Default: the assistant's items on the local
  DList. "Also show items others added to this list". "Also show candidates to inherit" — shared items
  the assistant has not copied, *copied* meaning one of the assistant's items carries the shared item's
  event id or coordinate in any tag. The shared list is read only while candidates are on; item links
  only for items this instance holds; per-source failures and the local 500-item cap reported, never
  read as "empty". — `stories/my-curated-dlists/3-items-method-and-update.md`
- **Two placeholders.** A "Curation method" panel (closed on load; text only, naming the
  downvotes-vs-upvotes example) and a disabled "Update list" button. — story #3
- **The house b-value rule on this page.** A real `b` beats `b-tag-deferred`: `describeCurationHeader`
  now delegates to `ui/src/utils/bDisposition.js` (story 2 review NB-1, fixed as story 3 AC-7).

## 2. Epics & stories rolled up

### Epic: `my-curated-dlists`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 my-curated-dlists-page | Nav item; list page; detail front door; new primitives (`curatedDListRows`, `curatedDListAccess`, `lookupCurationHeaders`, `useTreasureMap`, `useCurationHeaders`) | Done | `reviews/my-curated-dlists/1-my-curated-dlists-page.md` |
| #2 the-two-headers | Both header sections; `describeCurationHeader`; Import to local strfry (the page's only write, isolated in one module) | Done | `reviews/my-curated-dlists/2-the-two-headers.md` |
| #3 items-method-and-update | Items table (three views, lazy shared read); method + Update placeholders; AC-7 (house b-value rule); Amendment 1 (`itemsEmptySentence`) | Done (round 1 found one blocking defect; fixed test-first; round 2 passed) | `reviews/my-curated-dlists/3-items-method-and-update.md` |

Phase commits for the epic (`scripts/harness-stats.sh` at close): **19** — story 3 · adr 4 (one
amendment) · test 4 · impl 4 · review 4 — plus the book-open commit. Corpus: story 206 · adr 185 ·
test 194 · impl 194 · review 247. Every story story→review within the same day.

## 3. As-built inventory

**User-facing** (`/tapestry/grapevine/curated-dlists`, `/tapestry/grapevine/curated-dlists/:id`)
- `ui/src/components/Layout.jsx` — one nav line under 🍇 My Grapevine, directly below TA Treasure Map.
- `ui/src/App.jsx` — a nested `curated-dlists` route block (index → list page, crumb "My Curated
  DLists"; `:id` → detail, crumb "Detail").
- `ui/src/pages/grapevine/MyCuratedDLists.jsx` (new, 128 lines) — the list page.
- `ui/src/pages/grapevine/CuratedDListDetail.jsx` (new) — the front door; the two header lookups
  (the assistant's; the shared one at `COMMUNITY_RELAYS[0]`); places the sections. Write-free.
- `ui/src/pages/grapevine/CuratedDListHeaders.jsx` (new) — the two header sections, the raw-event
  toggle, and `ImportToLocalButton` — the page's **only** write.
- `ui/src/pages/grapevine/CuratedDListItems.jsx` (new) — `CurationMethodPanel`, `UpdateListButton`,
  `ItemsSection`. Write-free.

**Logic & hooks**
- `ui/src/utils/treasureMap.js` (+341) — pure, Node-testable: `curatedDListRows`,
  `parseCuratedDListRouteId`, `curatedDListPath`, `curatedDListAccess`, `lookupCurationHeaders`,
  `parseCoordinate`, `describeCurationHeader` (now via `bDisposition.js`), `curationPointerRow`,
  `itemRouteId`, `lookupListItems`, `curatedItemRows`, `sharedListUnavailable`,
  `itemsEmptySentence`, `LIST_ITEMS_LIMIT`. Its first import: `./bDisposition.js`.
- `ui/src/hooks/useTreasureMap.js` (new) — the Map lookup, race-free (waits for the relay list; every
  failure `error`, never `none`). `ui/src/hooks/useCurationHeaders.js` (new; `refresh()` since story
  2). `ui/src/hooks/useListItems.js` (new; the bounded local scan + the community relay).

**Server / API** — none changed. The import reuses `POST /api/strfry/publish` `{ event, signAs:
'client' }` (permissionless for client-signed events; `strfry import` verifies signatures; its only
graph hook fires for owned kind-39999 tapestry letters, never a DList header).

**Domain** — no concept added or changed; `39998:<TA>:list`, `39998:<TA>:shared-concept`,
`39998:<TA>:tapestry-assistant` read for orientation only. No firmware reinstall. No new event kinds
or wire shapes; the page reads kind 10040 (the Map), 39998 (headers), 9999/39999 (items).

**Tests** — three suites registered in `test/test.js`: `my-curated-dlists-page` (19),
`my-curated-dlists-headers` (16), `my-curated-dlists-items` (23); story 2's U4 re-aimed by story 3
(ADR 0003 sub-decision 9).

**Local state changed during the book** — story 2's reviewer really imported `253d40c4…`'s `dog-breed`
assistant header from dcosl into the Mac Studio's local strfry (sanctioned by the test plan; no Neo4j
node created, verified).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 6: "candidates … where inherited means duplicated by my assistant" | The candidates view and the "already copied" rule (an explicit back-reference) — but the **copy convention itself** is not specified, and the ratified `inherit-items` facet and the DList Curation panel's copy still say "never duplicating" | deferred | Operator, 2026-09-10: reconcile when Update is built (book § Known constraints; OPEN.md row 259) | Today nothing copies items, so every shared item is a candidate; the protocol text and the operator's intent disagree until reconciled | OPEN.md row 259 |
| 2 | Frame bullet 4: import "when it is not in local strfry" (shared header) | Import offered for **either** header found only on a relay | interpretation | Settled at story 2's gate (story 2 § Open questions) | One more (rare) path: the assistant's header is normally local | — |
| 3 | Frame bullets 3–4: a Simple Lists link for each header | The link appears only when the header (or item) is in local strfry; relay-only → the import control (headers) or "on <relay> only" (items) | constraint-discovered | Simple Lists reads local strfry only (ADR 0002 fact 5; ADR 0003 fact 1) | A relay-only item cannot be opened in Simple Lists (item import is out of scope) | seed §6 |
| 4 | Frame bullet 6: the items table | Columns Name · Author · From · Added, no votes; the local read capped at 500 with the cap reported; the relay read's cap undetectable | interpretation / constraint-discovered | Story 3 gate; ADR 0003 sub-decisions 3, 7 | Votes are the curation method's inputs, later | seed §6 |
| 5 | Frame bullet 2: "an entry naming my own Tapestry Assistant" opens | "Mine" = the signed-in user's own assistant (`user.assistantPubkey`); the route resolves against the viewer's own Map | interpretation | ADR 0001 sub-decisions 2–3; OPEN.md row 188 | A shared or bookmarked link never shows someone else's curation as the viewer's | — |
| 6 | (not in the frame) | AC-7: the page follows the house b-value rule (a real pointer beats `b-tag-deferred`) | added-beyond-scope | Story 2 review NB-1 folded into story 3 at its gate (ADR 0003 sub-decision 9 amends ADR 0002) | A header with both reads as affiliated, as everywhere else in the house | OPEN.md row 262 (why it diverged) |
| 7 | Frame bullet 8: "nothing else moves" | Held: no shipped page, server file, or Simple Lists file changed; the only write is the explicit import | — | Stories' AC-6; every review checked the shipped files byte-unchanged vs base | none | — |
| 8 | Frame bullet 1: the list's names | Names come from each header's `names[1]` (singular), as Map Entries and the DList Curation panel read them | interpretation | ADR 0001 sub-decision 7 | — | — |

**Undocumented work:** none. Every file in the diff traces to a story, an ADR, a review, a ledger row
(259–263 raised during the book), or a Tester-lane change named in a test plan (story 2's U4 re-aim).

## 5. Quality state at close

- **Gate.** Story-scoped gate at the final review (round 2): `TOTAL_FAIL=0`, 251 tests across 12 suites
  (the three epic suites, the eight Treasure Map guards, `b-coverage-audit-and-disposition`). Full
  `npm test` at the final code (`58c5fd48`, the round-2 reviewer's run): **164 suites PASS, 3 FAIL** —
  the four failing tests are exactly OPEN.md row 191's (three `trusted-lists` L0 guards + the refused
  prune); row 261's two LB matrices skipped. **Close-time full run** (2026-09-11, on the close
  artifacts — book Closed, the L2 waiver in place; code byte-identical to `58c5fd48`): **164 suites
  PASS, 3 FAIL** — again exactly row 191's four failing tests; row 261's two LB matrices skipped
  ("meili indexing did not settle"); the three epic suites 19 / 16 / 23; `harness-lint` 41/0 over the
  closed book; `tl-publication-from-pins` 10/0 (the stopped run's "500" was the empty-output artifact
  of row 263, not a server error).
- **Known open issues** (ledger, raised by this book): **259** (inherit = copy vs the ratified facet —
  the operator's deferred decision), **260** (the TA Treasure Map page can skip its relay step on SPA
  navigation — suspected from reading), **261** (two `trusted-lists` LB matrices flip fail/skip with
  Meili load), **262** (no orientation doc names the b-value code owner — `meta`), **263** (a stopped full
  run ends on a phantom 500 — `meta`).
- **Debt logged by ADRs.** Row 249's shared-primitive chore now has a third lookup shape to migrate onto
  (`useTreasureMap`, `lookupCurationHeaders`, `lookupListItems`) and two hardening notes (story 1 NB-2:
  key `useTreasureMap`'s state to its pubkey; NB-4: concurrent lookups). The epic file's "Close-out
  follow-ups" lists every non-blocking review note (story 1 NB-1…5, story 2 NB-2…6, story 3 NB-1…4 and
  round 2's two).

## 6. Carry-forward register

- [ ] **The Update feature** — have the assistant actually curate: copy candidates the method accepts,
      remove, rank. Needs the copy convention (row 259), including the back-reference the candidates
      rule reads, and a decision on whether copies may carry the shared list's `z` (story 3 NB-1: they
      would be listed twice).
- [ ] **The curation method** — its inputs (votes, trust scores per POV), controls, and where it runs.
- [ ] **Reconcile `inherit-items`** — the ratified live/copy-free facet, ADR `dlist-curation/0003`, the
      BIBLE glossary, the handoff D10, and the DList Curation panel's copy vs the operator's meaning (row 259).
- [ ] **Row 249's chore** — migrate the Treasure Map page family onto `useTreasureMap` /
      `lookupCurationHeaders` after the story-1 hardening notes; fixes row 260 on the way.
- [ ] **Item import / relay-only items in Simple Lists** — today a relay-only item has no link.
- [ ] **Candidates on staging** — the shared `dog-breed` items live only in the Mac Studio's local
      strfry; the community relay has none, so staging's candidates view is empty until items reach it.
- [ ] **Small follow-ups** in the epic file (partial-read wording, the https-hint phrasing, the S10
      argument pin, concurrent lookups, the `%2F` d-tag router limit).

## 7. Process findings (harness)

Inputs: the three reviews' "Harness friction" sections (four review rounds), the stories' process-shaped
Deviations, the book's `meta` rows (262, 263), and `scripts/harness-stats.sh` at close (epic: 19 phase
commits; corpus: story 206 · adr 185 · test 194 · impl 194 · review 247). "Ports" = whether the lesson
applies to the other flow (Direction ↔ human-gated).

| Finding | Source | Terminal state |
|---|---|---|
| No orientation surface names the b-value code owner, so ADR 0002 re-derived the sentinel rule and diverged (ports: yes) | story 2 review, harness friction 1 | OPEN.md row 262 |
| A stopped full `npm test` ends its log on a phantom "got 500" (empty `docker exec` output); full runs are not concurrency-safe on one stack, which is why it was stopped (ports: yes) | story 3 review round 2, friction 1; story 3 implementation | OPEN.md row 263 |
| The verdict parser's post-Verdict "On PASS" edge nearly fired again; the reviewer renamed the heading (ports: yes) | story 3 review round 1, friction 1 | OPEN.md row 28 (recurrence noted) |
| Presence-only structural pins could not see mutually exclusive copy — the round-1 blocking defect (ports: yes) | story 3 review round 1 | OPEN.md row 236 (a text pin that does not discriminate — recurrence noted) |
| Running a new suite against a throwaway ADR-faithful sketch before committing caught five over-constraining pins across stories 1–3 (ports: yes) | story 2 and 3 test plans ("Relaxed during the satisfiability check") | OPEN.md row 264 (propose it for the Tester workflow) |
| Gate messages must name contradictions with shipped copy/ratified protocol explicitly — the operator approves without reading every artifact ("never duplicating them" vs inherit = copy) (ports: yes) | kickoff, 2026-09-10 | OPEN.md row 265 |
| CLAUDE.md's stale bind-mount claim recurred in an ADR and two reviewer briefs | story 2 review, friction 2 | OPEN.md rows 198 / 226 (pre-existing; restated) |
| CLAUDE.md's stale local TA pubkey | story 1 review | OPEN.md rows 44 / 71 / 127 / 168 / 223 (pre-existing; restated) |
| Playwright's pinned Chromium missing (reviewers used `executablePath`) | every review | OPEN.md row 232 (pre-existing; restated) |
| The full suite outruns the foreground ceiling and is red by default here | every review | OPEN.md rows 83 / 191 (pre-existing; restated) |
| Row 261's LB matrices flip between fail and skip with Meili load | stories 1–3 full runs | OPEN.md row 261 |
| Independent reviewer subagents caught the one real defect self-review missed | story 3 review round 1 | **declined** — already the house practice (every story here and in `dlist-curation` used them); nothing to change |
| The session-start META ESCALATION (91 open lessons) asked for a grouped harness-story proposal | session-start digest | **declined for this book** — it belongs to the `/whats-open` triage step, as `dlist-curation` recorded; this book **added four `meta` rows (262, 263, 264, 265)**, raising that pressure |

## 8. Note on the state of the branch at close

The close lands on `feat/my-curated-dlists` **before** any merge; the operator asked to close, then run
`/cycle-staging`. Consequences recorded here so a future reader does not misattribute them:
- The epic `my-curated-dlists` is **complete but not retired** (all three stories Done; the workflow
  retires an epic only once its branch has merged to the shared line). A harness-lint **L2 waiver**
  cites OPEN.md row 266; retirement (folders under `done/`, epic `Status: Done`, waiver removed) is the
  first act after the staging merge. **Done 2026-09-11:** PR #637 merged; retired on `close/my-curated-dlists`.
- Production promotion is **not** part of this close.
