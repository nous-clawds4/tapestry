# Test Plan: Story 6 — Take a concept out of a Tapestry (remove-only, on the existing Exploration page)

**Story:** `engineering-team/stories/tapestries/6-take-a-concept-back-out.md`
**ADR:** `engineering-team/decisions/tapestries/0006-remove-concept-remove-only-republish.md`
**Book:** `engineering-team/audits/take-a-concept-back-out/book.md` (operational Direction run)
**Date:** 2026-07-30

Two suites, mirroring the epic's #5 split:

- **`test/take-a-concept-back-out.test.js`** — the **binding, stack-free** gate (Node runner,
  registered additively in `test/test.js`: require + run + summary line + `overallOk` term +
  skip roll-up; no existing line changed). P1–P15 exercise the pure subtract transform
  `buildRemoveConceptDraft` and the shared membership helper `authoredConceptMembers` via
  dynamic `import()`; S1–S4 are source sentinels on the component/page wiring the ADR pins;
  R1–R3 are regression guards that pass pre AND post.
- **`tests/brainstorm/tapestry-remove-concept.spec.js`** — the mocked-network browser
  round-trip (Playwright, `BRAINSTORM_SERVER_ACCESSIBLE`-gated), E1–E14. Mirrors
  `tapestry-add-concept.spec.js`'s mock pattern, with two deliberate upgrades: (i) scan
  dispatch parses the **exact filter** out of the request URL rather than substring-matching
  it (OPEN.md #75's scope-to-the-exact-signature lesson, applied to mocks); (ii) after a
  successful publish the element scan serves back **the body the implementation actually
  published** (signed-back), and import scans keep resolving every member's concept-graph —
  so a replacement that removes the node but keeps its import **re-materializes the member
  at compose time and fails "gone"** (ADR Decision 2-A's functional guarantee, end-to-end).

**UI contract pinned by the spec** (Tester's mechanics under ADR 0006 Decision 5): each
eligible member gets a **button accessible-named `Take out <name>`**; arming publishes
nothing and swaps in an inline confirm **naming the member** (text matching
`/take out\s+["'"]?<name>/i`) with buttons **`Take out`** (exact) and **`Cancel`** (exact);
a one-concept tapestry renders the refusal sentence **matching `/keeps at least one
concept/i`** instead of any control (the same regex the transform's last-member throw and
the component source must match — the boundary's own words, pinned loosely enough that the
Implementer owns the exact sentence).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 offered to the owner on own/TA tapestries, on the existing page | `E1` (TA-authored: per-member take-out controls, same URL, no new page); `E9` (owner-authored tapestry is editable) | `tests/brainstorm/tapestry-remove-concept.spec.js` | Playwright (mocked) |
| AC-1 not offered otherwise | `E2` (guest), `E3` (unauthenticated), `E4` (**admin — owner-strict**, the #5 Director ruling carried forward), `E5` (foreign author, even for the owner); `S4` (ONE gate expression `canEdit` — the renamed `canAdd` — gates the render; shipped S4's owner-strict regexes keep holding) | spec + `test/take-a-concept-back-out.test.js` | Playwright + sentinel |
| AC-2 last concept refused — up-front, plain-language, no save possible, nothing changed | `E6` (refusal sentence visible, NO control exists, publish sink stays empty); `P8` (transform backstop throws `/keeps at least one concept/i`; superset/property nodes do NOT count as concepts); `P13` (the count's single source: `authoredConceptMembers`) | both files | Playwright + unit |
| AC-3 nothing published until confirm; declining leaves unchanged | `E7` (arming publishes nothing; confirm step names the member; Cancel → idle, member still present, still nothing published) | spec | Playwright (mocked) |
| AC-3 same coordinate / no duplicate directory row | `P1` (d-tag verbatim on the bare-hex `b0b48b00` shape, uuid = `39999:<author>:<dTag>`, unsigned); `E8` (published body reuses the existing d-tag, name tag unchanged) | both files | unit + Playwright |
| AC-3 published as tapestries already are, no new endpoint | `E8` (TA → `POST /api/strfry/publish` `signAs:"assistant"`), `E9` (own key → NIP-07 + `signAs:"client"`, author = existing key); `S3` (both #3/#5 publish-path strings in the new component — the S3 mirror); `P15` (uuid follows the event's author) | both files | Playwright + sentinel + unit |
| AC-3 everything else intact (title/description/name-tag/integrations/unknown fields/order) | `P2` (live-shape subtract: remaining nodes+imports verbatim in order, slug-valued name tag, z, content), `P14` (authored relationships, relationshipTypes, unknown tags between AND after known ones, unknown json keys, superset/property nodes, input not mutated), `P6` (an import attributable to NO member passes through), `P7` (an import shared with a remaining member STAYS), `E8` (published body: all of the above) | both files | unit + Playwright |
| AC-3 the only difference: the removed concept + what was carried solely on its behalf (ratified reading 4) | `P3` (the **live dog divergence** — import found via options derivation, matcher b), `P4` (deleted-header member — import found via read-time containment, matcher a), `P5` (zero-evidence case — short-slug derivation, matcher c), `P1` (`removed` summary names node + importUuids) | `test/take-a-concept-back-out.test.js` | unit |
| AC-3 replacement actually replaces (never ties) | `P12` (`created_at` strictly greater on same-second and clock-skewed bases; fresh for old bases); `E8` (`created_at > base`) | both files | unit + Playwright |
| AC-3 publish fails → clear error, membership unchanged | `E12` (inline error text; member still among the members); `P10` (transform refuses unpreservable structures → nothing publishable exists) | both files | Playwright + unit |
| AC-4 gone for me | `E10` (the removed member is the SELECTED one; after save the coordinate is **re-read** — scan count grows — the member is gone from the sidebar, the others stay, and no stale detail pane remains); `S4` (`onRemoved` wiring), `R3` (`useTapestryGraph` keeps exposing `event`/`imports`/`reload`) | both files | Playwright + sentinel |
| AC-5 gone for anyone else afterwards | `E11` (fresh unauthenticated session, same uuid, removed member absent, others render; still no affordance) | `tests/brainstorm/tapestry-remove-concept.spec.js` | Playwright (mocked) |

Supporting sentinels: `S1` (both exports exist — the headline articulate failure), `S2`
(`RemoveConceptFromTapestry.jsx` wired to the pure transform + `authoredConceptMembers` +
`useConceptOptions`, carries Cancel and the refusal sentence). Regression guards (pass pre
AND post): `R1` (`buildAddConceptDraft` still appends one node + import at the same
coordinate — "adding is already built and stays as it is"), `R2` (no remove machinery leaks
into `AddConceptToTapestry` / `useCreateTapestry` / `NewTapestry` — the no-extraction
decision that keeps shipped sentinel S3 green), `R3` (`useTapestryGraph` surface intact).

## Edge cases

All named by the ADR's testability guidance; each has an explicit test:

- [x] **`b0b48b00`-shaped fixture with the live dog divergence** (bare-hex d-tag, slug-valued
  `name` tag, 4 members / 4 imports, empty relationships; dog node uuid d-tag =
  `b08502ed-…` while its import is `dog-concept-graph`) — shape mirrored from the ADR's
  live census; the element itself is never read or written. `P1`–`P3`, `P5`, `P12`, `P15`.
- [x] **Attribution by each matcher alone**: (a) resolved-import containment with options
  empty (`P4` — the deleted-header cleanup case), (b) options derivation with resolution
  empty (`P3` — the live divergence), (c) short-slug derivation with neither (`P5`).
- [x] **Shared-import keep-guard** — claimed by a remaining member → stays (`P7`).
- [x] **Unattributable-import pass-through** — claimed by nobody → stays (`P6`).
- [x] **Ghost member** (uuid absent from the authored block / a `39999:` superset uuid) —
  refused (`P9`); **shared-slug** removal — refused (`P11`).
- [x] **Superset + property nodes don't count as concepts** — membership and the
  last-member count (`P8`, `P13`).
- [x] **Malformed / unpreservable structures** — wrong kind, no d tag, unparseable json,
  non-object json, absent graph, null graph, nodes-not-array, imports-not-array all throw
  (`P10`); page-level: malformed graph → no affordance (`E14`), graph-less degraded → no
  affordance and no refusal, first-add untouched (`E13`).
- [x] **`created_at` strictly greater on same-second input** and clock-skewed bases (`P12`).
- [x] **Input event not mutated** (`P2`, `P14`).
- [x] **Owner-authored element** — coordinate follows the event's author; TA-namespaced
  attribution unaffected (`P15`, `E9`).
- [x] **Removed member was the selected one** — no stale per-concept detail pane (`E10`).
- [x] **Post-save render is the published truth** — the mock serves the captured publish
  body back and keeps resolving every concept-graph import, so keeping the removed member's
  import re-materializes it and fails `E10`.

Not covered by automation (recorded for the Reviewer): the double-submit busy guard
(UI-timing-dependent; same #5 gap), the armed-state transition when a *different* member is
picked mid-confirm (cosmetic ADR detail), and live cross-relay AC-5 (follows structurally
from same-coordinate replacement — pinned by `P1`/`E8`; NIP-01 replacement itself was
verified by the epic's evidence goal and proven in production by shipped #5).

## Test infrastructure

- Test framework: Node built-in runner (`node test/test.js`; suite registered additively —
  require, run + banner, summary line, `overallOk` term, skip roll-up) and Playwright
  (`playwright.config.js`).
- **Stack-free:** the entire Node suite (P/S/R) runs with no stack — fixtures only, dynamic
  `import()` of the ESM builder, `fs` reads for sentinels. Nothing in it hits
  `localhost:$TAPESTRY_PORT`.
- **Playwright:** requires the control panel serving the UI at `BRAINSTORM_BASE_URL`
  (default `http://localhost:7778`) and `BRAINSTORM_SERVER_ACCESSIBLE=true`; **all network
  is mocked** via `page.route` (no graph state, no firmware precondition, nothing read from
  or written to any relay — the operator's live `b0b48b00` element is untouched; only its
  shape is mirrored in fixtures). Skips cleanly when the env flag is unset (CI-safe). The
  served UI must include the live source under test (locally the repo is bind-mounted; see
  OPERATIONS.md).
- Firmware state: none required by either suite. No `strfry-router` quiesce is needed for
  these two suites in isolation (no whole-relay counts anywhere; scan mocks parse exact
  filters — OPEN.md #75/#128 honored by construction: no live corpus, no pinned event ids).
  Full-suite gate runs still follow the book's router-quiesce instruction, which governs
  other suites.
- Fixtures: pubkeys are fixture literals in test files only (production code must resolve
  the TA at runtime — CLAUDE.md); the live-shape fixture mirrors the `b0b48b00` element's
  published shape including the `dog` divergence the ADR verified (`b08502ed-…` node uuid →
  `dog-concept-graph` import); concept options reuse the `useConceptOptions` output shape;
  resolved imports reuse the `useTapestryGraph.imports` shape.

## How to run

Binding gate (full run — the new suite makes the overall run FAIL until implementation):

```
npm test
```

New Node suite in isolation (from the repo root):

```
node -e "require('./test/take-a-concept-back-out.test.js').run().then(r => console.log('\nsuite result:', JSON.stringify(r)))"
```

New Playwright spec in isolation (stack up; chromium):

```
BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test tests/brainstorm/tapestry-remove-concept.spec.js --project=chromium --reporter=line
```

## Verification

The new tests fail with the current code, for the right reason (the feature is missing —
the transform export, the membership helper, the component, and the gate do not exist; no
import/typo errors). Confirmed 2026-07-30 at commit `1a996ec3` (pre-commit working tree).
The shipped `add-a-concept-to-a-tapestry` suite was re-run the same session: **23 passed,
0 failed** — sentinels S3/S4 unaffected, as the ADR's rename-and-duplicate design intends.

Node suite (isolated run): **3 passed (R1–R3 regression guards), 19 failed (P1–P15,
S1–S4)** — every failure is articulate. Representative output:

```
  ✗ P1: republishing keeps the SAME coordinate — d-tag copied verbatim (the bare-hex b0b48b00 shape), uuid = 39999:<author>:<dTag>, kind 39999, unsigned, and a removed summary naming the node + its imports
      ui/src/pages/tapestries/tapestryDraft.mjs does not export buildRemoveConceptDraft — the Implementer must add the pure subtract transform (ADR tapestries/0006 Decisions 1-A + 2-A + 3-A): buildRemoveConceptDraft({ event, memberUuid, resolvedImports = [], conceptOptions = [] }) → { dTag, uuid, unsignedEvent, removed: { node, importUuids } }: copy the event verbatim and remove exactly ONE authored member node plus the import(s) attributed to it (containment ∪ options derivation ∪ short-slug derivation) and claimed by no remaining member. Exports found: [buildAddConceptDraft, buildTapestryDraft, slugifyTitle]
  [… P2–P12, P14, P15 fail with the same missing-export message …]
  ✗ P13: authoredConceptMembers — the ONE membership definition: 39998:-uuid nodes only, in order; [] (never a throw) on missing json, unparseable json, absent/null graph, nodes-not-an-array
      ui/src/pages/tapestries/tapestryDraft.mjs does not export authoredConceptMembers — the Implementer must add the shared membership helper (ADR tapestries/0006 Decision 1-A): authoredConceptMembers(event) → [{slug, uuid, name}] of nodes with a 39998: uuid in the element's OWN json.graph.nodes; [] on missing/unparseable json or missing/null graph; never throws. […]
  ✗ S2: RemoveConceptFromTapestry.jsx exists and drives the save through the pure transform, the shared helpers, an inline confirm step, and the up-front last-member refusal sentence
      ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx missing — the Implementer must create the sidebar affordance component (ADR 0006 Decision 5): props {event, imports, onRemoved}; per-member "Take out" controls when the authored concept count is >= 2, the plain-language refusal sentence INSTEAD of any control when it is exactly 1, an inline confirm (Take out / Cancel) that publishes nothing until confirmed, the Decision-4 signing branch, and inline errors.
  ✗ S4: TapestryDetail renders RemoveConceptFromTapestry behind ONE owner-strict gate named canEdit (the renamed canAdd — a single expression gating BOTH affordances), passing imports and an onRemoved handler
      TapestryDetail.jsx does not render RemoveConceptFromTapestry — the affordance lives on the EXISTING Exploration page (sidebar Concepts section); no new page, no new route (the boundary).
  ✓ R1 (regression, passes pre AND post): buildAddConceptDraft still appends exactly one member node + import at the same coordinate — "adding is already built and stays as it is"
  ✓ R2 (regression): no remove machinery leaks into the shipped add/create path — AddConceptToTapestry, useCreateTapestry, and NewTapestry reference nothing of this story's
  ✓ R3 (regression): useTapestryGraph still exposes { event, imports, reload } — the raw element, the resolved imports (matcher a's evidence), and the re-read that makes AC-4 true

suite result: {"pass":3,"fail":19}
```

Playwright spec (isolated, chromium, local stack up): **7 failed (E1, E6, E7, E8, E9, E10,
E12), 7 passed (E2–E5, E11, E13, E14 — permanent negative/read-path guards, non-vacuous:
each first asserts the members/page rendered)**. Every failure is the same right reason —
the affordance (or the refusal sentence) does not exist on a page that otherwise rendered:

```
    Error: expect(locator).toBeVisible() failed
    Locator:  getByRole('button', { name: 'Take out cow', exact: true })
    Expected: visible
    Received: <element(s) not found>
    Timeout:  10000ms
      [E1 — after expectMembersVisible(page) had already passed]

    Error: expect(locator).toBeVisible() failed
    Locator:  getByText(/keeps at least one concept/i)
    Expected: visible
    Received: <element(s) not found>
      [E6 — after the single member had already rendered]

  7 failed
    [chromium] › …tapestry-remove-concept.spec.js:289:3 › … › E1: the owner sees a take-out control for each member concept on the Exploration page of a TA-authored tapestry
    [chromium] › …tapestry-remove-concept.spec.js:336:3 › … › E6: a tapestry with exactly one concept shows the plain-language refusal instead of any take-out control, and nothing can be published
    [chromium] › …tapestry-remove-concept.spec.js:349:3 › … › E7: choosing a concept publishes NOTHING until the owner confirms; Cancel returns to idle with the tapestry unchanged
    [chromium] › …tapestry-remove-concept.spec.js:371:3 › … › E8: confirming on a TA tapestry POSTs signAs:"assistant" — same d-tag, the removed node AND its import gone, every other member/relationship/tag intact, created_at newer, no navigation
    [chromium] › …tapestry-remove-concept.spec.js:404:3 › … › E9: on an owner-authored tapestry the save NIP-07-signs and POSTs signAs:"client" under the owner's key, same d-tag
    [chromium] › …tapestry-remove-concept.spec.js:424:3 › … › E10: after a successful save the page re-reads the same coordinate and the removed concept no longer shows — not among the members, no leftover detail pane
    [chromium] › …tapestry-remove-concept.spec.js:464:3 › … › E12: a failed publish shows a clear inline error and the membership is unchanged
  7 passed (34.2s)
```
