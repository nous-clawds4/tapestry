# Build Audit: Tapestries (read-only browse & explore)

**Book:** `engineering-team/audits/tapestries/book.md`
**Date:** 2026-07-24
**Branch / commit range:** `feat/tapestries-skeleton` (`2d447b79` story … `5dbc7619` review) → staging PR #438 (`b32b1cad`) → main PR #440 (`a52f4d27`); base `ac344864`
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** medium — same-session, operator-gated at every phase gate; the ask is quoted verbatim in `book.md` (not inferred from git); two full per-story cycles with PASS reviews, shipped to prod and smoke-verified. Raised above the anchor-less default (low) because the intent holder was present throughout; not higher, because there was no ratified PRD to reconcile against.

> As-built record. What the Tapestries surface *is* now — factual, source-linked. Change proposals live in `prd-seed.md`.

## 1. What shipped

- A public **"🧵 Tapestries"** nav group under Nostr Users → *View Tapestries* + *Create New Tapestry* — `stories/done/tapestries/1-tapestries-nav-and-directory.md`
- **View Tapestries** directory: lists every element of the `tapestry` concept (read from strfry), showing title / description / author; each row links to `/tapestry/tapestries/:uuid` — `stories/done/tapestries/1-…`
- **Create New Tapestry**: an inert placeholder previewing the planned authoring fields — `stories/done/tapestries/1-…`
- **Tapestry Exploration page**: a concept sidebar + vis-network integration graph + enumerations/elements/subsets tables + JSON viewer, rendered **as-authored** from the element's `graph` block plus one-level-resolved imports — `stories/done/tapestries/2-tapestry-exploration-page.md`

## 2. Epics & stories rolled up

### Epic: `tapestries`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 nav-and-directory | nav group + View Tapestries directory + Create stub | Done | `reviews/done/tapestries/1-nav-and-directory.md` (PASS) |
| #2 tapestry-exploration-page | the per-tapestry Exploration page (as-authored render) | Done | `reviews/done/tapestries/2-tapestry-exploration-page.md` (PASS) |

## 3. As-built inventory (from the diff)

- **User-facing:** three routes under `/tapestry/tapestries` — `index` (directory), `new` (stub), `:uuid` (exploration) — in `ui/src/App.jsx`; the nav group in `ui/src/components/Layout.jsx`. Pages: `ui/src/pages/tapestries/{Index,NewTapestry,TapestryDetail,TapestryIntegrationGraph}.jsx` + the `useTapestryGraph.js` hook and pure `tapestryGraphModel.js` helpers. 10 files, ~1185 insertions; **no backend, no new API routes, no new dependencies** (vis-network already bundled).
- **Domain / concepts:** `39998:<TA>:tapestry` (its elements are the directory). Member concepts of the seed tapestry: `dog`, `dog-breed` (firmware-seeded, present on all deployments) and `irish-setter`, `golden-retriever` (authored during this book as elements of `dog-breed`). **The graph-embedding convention** is now in use: a tapestry element carries a top-level `graph` block alongside `tapestry` — `{ nodes[{slug,uuid?,name?}], relationshipTypes[{slug,alias?}], relationships[{nodeFrom,relationshipType,nodeTo}], imports[{slug,uuid}] }`, with synthetic (uuid-less) property nodes for `ENUMERATES` targets. **No concept-definition/schema changes → no firmware reinstall.**
- **Data & contracts:** reads kind-**39999** addressable events from **strfry** via the existing public `GET /api/strfry/scan` (`queryRelay`); imports resolved the same way. `uuid` = the a-tag coordinate `kind:pubkey:d-tag` (stable across edits). No stored-shape or event-kind changes introduced.

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "a list of each element of the Tapestry concept" (implied Neo4j, like the Concepts pages) | directory reads from **strfry**, not Neo4j | constraint-discovered | a Neo4j reconcile prunes tapestry elements (the `tapestry` header lacks `IS_THE_CONCEPT_FOR` wiring); ADR `tapestries/0001`; OPEN.md #88 | none — same list to the user | root-cause fix (OPEN.md #88) |
| 2 | "modeled to a great extent after the Firmware Explorer" | fresh tapestry view components copy the idiom; the Firmware Explorer is untouched | intentional-change | its view components are inline / not-exported and manifest-shaped; extracting them would refactor a shipped owner-only page; ADR `0002` | none — looks/behaves like it | extract a shared `GraphExplorer` (ADR 0002 Out of scope) |
| 3 | "explore … that individual Tapestry" | renders **as-authored** (element `graph` + one-level imports), not a live Neo4j re-derivation | interpretation | ADR `0002`; imports via strfry (the Neo4j projection had drifted from the signed events) | none | transitive import expansion |
| 4 | "Create New Tapestry … will be just a stub" | inert placeholder previewing fields | as-specified | story #1 | — | create-a-Tapestry authoring |
| 5 | "Future features … create … and … edit … we will not build those yet" | deferred | deferred | per frame | — | create/edit authoring (operator starting it next session) |
| 6 | (design discussion) add the wire-level `graph` z-tag to tapestry elements | the `graph` block was written; the z-tag was **not** | deferred | membership is already transitive via `graph ⊇ tapestry`; no first-class endpoint adds a z-tag to an existing element; ADR `0002` Context | none | publish the z-tag when authoring lands |

**Undocumented work:** none in the code diff — every file traces to story #1 or #2. The seed **data** (authoring the two breed concepts + the "Tapestry for Dog" element and its `graph` block) was done via the API on the local stack, not committed code — it is runtime data, recorded in `book.md` "Seed data". It exists **only on the local stack**; staging + prod render the empty state (see §6, seeding).

## 5. Quality state at close

- **Test gate:** the book's binding gate is the **Playwright** suite — **11/11 pass** (2026-07-24; `tests/brainstorm/tapestries-nav-and-directory.spec.js` + `tapestry-exploration.spec.js`). `npm test` (the node/CJS suite) is *not* a gate for this UI-only book: it exercises none of the diff and is environmentally-failing on the local stack (OPEN.md #27/#69). Staging (#438) and prod (#440) smokes were green (nav + directory empty state + create stub render; existing Concepts page intact; no console errors).
- **Known open issues:** OPEN.md **#88** (Neo4j drops tapestry elements — worked around by the strfry read path; root cause deferred); **#89**/**#90** (non-blocking test/CSS nits from the two reviews).
- **Debt (ADR Consequences):** two integration-graph implementations now coexist (Firmware Explorer + tapestry) and may drift — consolidation candidate (ADR `0002`).

## 6. Carry-forward register

- [ ] **Create-a-Tapestry** authoring (§4 #4/#5) — operator kicks it off in a new session
- [ ] **Edit-a-Tapestry** authoring (§4 #5)
- [ ] Publish the wire-level **`graph` z-tag** on tapestry elements (§4 #6)
- [ ] **Transitive import expansion** (property-tree / core-nodes) (§4 #3; ADR 0002 Out of scope)
- [ ] **POV/WoT filtering** of which tapestries the directory shows (stories #1/#2 Out of scope)
- [ ] **Seed staging + prod** (needs droplet SSH; the seed data is local-only) — deferred by the operator 2026-07-24
- [ ] Extract a shared **`GraphExplorer`** component (Firmware Explorer + tapestry) (§4 #2)
- [ ] Fix the **Neo4j-desync root cause** (wire the tapestry concept's class thread and/or stop the reconcile pruning un-placeable elements) — OPEN.md #88
- [ ] Non-blocking review nits — OPEN.md **#89** / **#90**

## 7. Process findings (harness)

harness-stats at retro (2026-07-24, repo-wide phase commits): story 143 · adr 125 · test 127 · impl 131 · review 162. Tapestries contributed the standard 5-phase × 2-story ladder (10 phase commits).

| Finding | Source | Terminal state |
|---|---|---|
| **Book anchor skipped at intake** (3rd occurrence): `/plan-feature` opened the epic without opening `audits/tapestries/book.md`. | `reviews/done/tapestries/1-…` § Harness friction | **OPEN.md #78** (existing) — occurrence note restored this close (it was lost in the staging merge). Notably caught+opened **eagerly at the #1 review** rather than reconstructed at close — the earliest catch of the three. Ports to Direction mode (same intake). |
| **Playwright route-stub gotcha:** an encoded `#d` filter round-trips through the browser as a URL *fragment* and is dropped by `URLSearchParams`; the stub must dispatch by d-tag substring. | `stories/done/tapestries/2-…test-plan.md` + spec comment | **Declined** as a harness amendment — documented in the spec + test plan as a tester-role note; a test-writing tip, not a process defect. |
| **`curl` in shell subshells hits a stripped PATH** (`$()` / `for` loops fail "command not found"; top-level `curl` works) — broke the `/cycle-staging` and `/cycle-prod` smoke's Tier-1/2 curl loops until reworked to top-level curls + the browser. | this session (staging + prod smokes) | **OPEN.md #92** (meta) — smoke tooling in the cycle skills should prefer top-level curls or the browser. Ports to Direction mode (same smoke tooling). |
