# Test Plan: Story 5 — Add a concept to a Tapestry (add-only, on the existing Exploration page)

**Story:** `engineering-team/stories/tapestries/5-add-a-concept-to-a-tapestry.md`
**ADR:** `engineering-team/decisions/tapestries/0005-add-concept-add-only-republish.md`
**Date:** 2026-07-28

Two suites, mirroring the epic's #3 split:

- **`test/add-a-concept-to-a-tapestry.test.js`** — the **binding, stack-free** gate (Node runner,
  registered in `test/test.js`). P1–P13 exercise the pure append transform `buildAddConceptDraft`
  via dynamic `import()`; S1–S6 are source sentinels on the page/component/hooks the ADR pins;
  R1–R4 are regression guards that pass pre AND post.
- **`tests/brainstorm/tapestry-add-concept.spec.js`** — the mocked-network browser round-trip
  (Playwright, `BRAINSTORM_SERVER_ACCESSIBLE`-gated), E1–E13. Mirrors
  `tapestry-create.spec.js`'s mock pattern + `tapestry-exploration.spec.js`'s scan-by-d-tag
  dispatch. UI contract pinned by the spec: the affordance is a **textbox with accessible name
  matching `/add a concept/i`**; matches render as buttons named `Add <name>` (the NewTapestry
  typeahead idiom); **picking a result performs the save** (one concept per save).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 offered to the owner on own/TA tapestries, on the existing page | `E1` (TA-authored, affordance present, same URL); `E8` (owner-authored) | `tests/brainstorm/tapestry-add-concept.spec.js` | Playwright (mocked) |
| AC-1 not offered otherwise | `E2` (guest), `E3` (unauthenticated), `E4` (**admin — owner-strict**, Director ruling), `E5` (foreign author, even for the owner); `S4` (gate expression: `classification === 'owner'`, not `hasAdminAccess`; author vs runtime `taPubkey`) | spec + `test/add-a-concept-to-a-tapestry.test.js` | Playwright + sentinel |
| AC-2 only non-members addable | `E6` (member excluded, non-member offered); `P6` (duplicate-member **throws** — transform half, defense in depth); `P7` (slug-collision throws) | both files | Playwright + unit |
| AC-3 same coordinate / no duplicate directory row | `P1` (d-tag verbatim on the bare-hex `b0b48b00`, uuid = `39999:<author>:<dTag>`); `E7`, `E12` (published body reuses the existing d-tag) | both files | unit + Playwright |
| AC-3 published as tapestries already are, no new endpoint | `E7` (TA → `POST /api/strfry/publish` `signAs:"assistant"`), `E8` (own key → NIP-07 + `signAs:"client"`, author = existing key); `S3` (both #3 publish paths, `getActiveSignerOrThrow`, `publishOrThrow`); `R3` (server 403 gate intact); `P12` (uuid follows the event's author) | both files | Playwright + sentinel + unit |
| AC-3 everything else intact (title/description/name-tag/integrations/unknown fields) | `P2` (tapestry block + slug-valued name tag untouched), `P3` (tag order + unknown tags byte-identical, json replaced in place, content unchanged), `P5` (nodes/relationships/relationshipTypes/imports/unknown json keys pass through; input not mutated), `E7` (prior nodes + relationships intact in the published body) | both files | unit + Playwright |
| AC-3 the only difference is the new member | `P4` (create-shaped node + import; import uuid from `conceptGraphSlug`), `P5` (exactly one node + one import appended), `P11` (existing import not duplicated) | `test/add-a-concept-to-a-tapestry.test.js` | unit |
| AC-3 replacement actually replaces (never ties) | `P8` (`created_at` strictly greater on same-second and clock-skewed bases; fresh for old bases); `E7` (`created_at > base`) | both files | unit + Playwright |
| AC-3 publish fails → clear error, membership unchanged | `E11` (inline error text from the publish path; member absent); `P9` (transform refuses unpreservable structures → nothing publishable exists) | both files | Playwright + unit |
| AC-4 visible to me | `E9` (after save the coordinate is **re-read** — element-scan count grows — and the member renders); `S5` (`useTapestryGraph` exposes `event` + `reload`) | both files | Playwright + sentinel |
| AC-5 visible to anyone else afterwards | `E10` (fresh unauthenticated session, same uuid, member renders; still no affordance) | `tests/brainstorm/tapestry-add-concept.spec.js` | Playwright (mocked) |

Supporting sentinels: `S1` (export exists — the headline articulate failure), `S2`
(`AddConceptToTapestry.jsx` wired to the pure transform + shared `useConceptOptions`, typeahead
over `searchText`), `S6` (`useConceptOptions.js` extracted; `useCreateTapestry` consumes it).
Regression guards (pass pre AND post): `R1` (`buildTapestryDraft` create shape), `R2`
(Exploration read path: `composeGraph`, `parseUuid`), `R3` (assistant-sign 403 gate), `R4`
(create flow survives the extraction).

## Edge cases

All named by the ADR's testability guidance; each has an explicit test:

- [x] **`b0b48b00`-shaped fixture** (bare-hex d-tag, slug-valued `name` tag, no graph block) —
  shape verified against the live local relay 2026-07-28 (`d=b0b48b00`,
  `name=tapestry-for-farm-animals`, json = `{tapestry}` only). `P1`, `P2`, `E12`.
- [x] Graph-less event **gains the envelope** on first add (`{graphType:'tapestry', nodes:[member],
  relationshipTypes:[], relationships:[], imports:[import]}`) — `P2`, `E12`.
- [x] `json` tag **absent entirely** → treated as `{}`; exactly one json tag added — `P10`.
- [x] **Duplicate-member** and **slug-collision** throws — `P6`, `P7`.
- [x] **Malformed json refusal**: unparseable json tag; `graph.nodes` not an array; wrong kind;
  missing d tag — `P9`. Malformed graph → **no affordance** (vs absent graph → first-add offer):
  `E13` vs `E12`, and the `rawGraph === null` sentinel in `S4`.
- [x] **`created_at` strictly greater on same-second input** (and on a clock-skewed future base) — `P8`.
- [x] **Tag order / unknown-field pass-through** (unknown tags between and after known ones;
  unknown top-level json keys) — `P3`, `P5`.
- [x] **Import already present** → not duplicated — `P11`.
- [x] **Input event not mutated** (the page reuses it as the base for the next add) — `P5`.
- [x] Missing inputs (`taPubkey`, member, member.handle) throw — `P13`.
- [x] Own-key authored tapestry → coordinate follows the **event's author**, imports/z stay
  TA-namespaced — `P12`, `E8`.

Not covered by automation (recorded for the Reviewer): the double-submit busy-guard (ADR
implementation note; UI-timing-dependent) and the live end-to-end directory non-duplication
(follows structurally from same-coordinate replacement, pinned by `P1`; NIP-01 replacement
behavior itself was verified by the book's evidence goal).

## Test infrastructure

- Test framework: Node built-in runner (`node test/test.js`; suite registered — require, run,
  summary line, `overallOk` term, skip roll-up) and Playwright (`playwright.config.js`).
- **Stack-free:** the entire Node suite (P/S/R) runs with no stack — fixtures only, dynamic
  `import()` of the ESM builder, `fs` reads for sentinels. Nothing in it hits
  `localhost:$TAPESTRY_PORT`.
- **Playwright:** requires the control panel serving the UI at `BRAINSTORM_BASE_URL` (default
  `http://localhost:7778`) and `BRAINSTORM_SERVER_ACCESSIBLE=true`; **all network is mocked**
  via `page.route` (no graph state, no firmware precondition, nothing written to the relay).
  Skips cleanly when the env flag is unset (CI-safe). Note: the served UI must include the
  built/live source under test (locally the repo is bind-mounted; see OPERATIONS.md).
- Firmware state: none required by either suite.
- Fixtures: pubkeys are fixture literals in test files only (production code must resolve the TA
  at runtime — CLAUDE.md); the `b0b48b00` fixture mirrors the live event's shape; `DIVERGENT`
  member (`nostr-event-tag` → `nostr-event-tagging-concept-graph`) reuses the real divergence
  #3 verified live.

## How to run

Binding gate (full run — the new suite makes the overall run FAIL until implementation):

```
npm test
```

New Node suite in isolation (from the repo root):

```
node -e "require('./test/add-a-concept-to-a-tapestry.test.js').run().then(r => console.log('\nsuite result:', JSON.stringify(r)))"
```

New Playwright spec in isolation (stack up; chromium):

```
BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test tests/brainstorm/tapestry-add-concept.spec.js --project=chromium --reporter=line
```

## Verification

The new tests fail with the current code, for the right reason (the feature is missing — the
export, component, hook extraction, and gate do not exist; no import/typo errors). Confirmed
2026-07-28 at commit `1dad85c4` (pre-commit working tree).

Node suite (isolated run): **4 passed (R1–R4 regression guards), 19 failed (P1–P13, S1–S6)** —
every failure is articulate. Representative output:

```
  ✗ P1: republishing keeps the SAME coordinate — d-tag copied verbatim (even the bare-hex b0b48b00), uuid = 39999:<author>:<dTag>, kind 39999, unsigned
      ui/src/pages/tapestries/tapestryDraft.mjs does not export buildAddConceptDraft — the Implementer must add the pure append transform (ADR tapestries/0005 Decision 1-A): buildAddConceptDraft({ event, member, taPubkey }) → { dTag, uuid, unsignedEvent }: copy the event verbatim, append ONE member node + import inside the json tag. Exports found: [buildTapestryDraft, slugifyTitle]
  [… P2–P13 fail with the same missing-export message …]
  ✗ S2: AddConceptToTapestry.jsx exists and drives the save through the pure transform + the shared concept options (typeahead over searchText)
      ui/src/pages/tapestries/AddConceptToTapestry.jsx missing — the Implementer must create the sidebar affordance component (ADR 0005 Decision 4): props {event, onAdded}; typeahead over useConceptOptions() excluding current members; on pick → buildAddConceptDraft → the Decision-3 signing branch; inline error on failure.
  ✗ S4: TapestryDetail gates the affordance OWNER-STRICT (classification === "owner", NOT hasAdminAccess) against the event author, and offers first-add on the graph-less degraded branch
      TapestryDetail.jsx has no owner-strict gate: the affordance renders iff user?.classification === "owner" AND the event author is the TA or the session pubkey (ADR 0005 Decision 3, Director ruling). An admin who is not the owner gets NO affordance.
  ✗ S5: useTapestryGraph exposes the raw event and a reload() so the page re-reads the same coordinate after a save (visibility by re-read, not optimism)
      useTapestryGraph.js has no reload — after a successful publish the page must re-read the tapestry from strfry (the same read ANY session performs); optimistic local state can show a member whose publish was refused or replaced (ADR Decision 4).
  ✗ S6: useConceptOptions.js exists (the extracted kind-39998 loader) and useCreateTapestry consumes it — one picker source, no drift
      ui/src/pages/tapestries/useConceptOptions.js missing — move toConcept + the queryRelay({kinds:[39998], authors:[taPubkey]}) effect out of useCreateTapestry.js verbatim (ADR 0005 Decision 4); return { concepts, conceptsLoading, conceptsError }.
  ✓ R1 (regression, passes pre AND post): buildTapestryDraft still emits the create shape — kind/d-tag/z/member node + import
  ✓ R2 (regression): the Exploration read path is intact — useTapestryGraph still composes via composeGraph and still exports parseUuid
  ✓ R3 (regression): the server still refuses TA-signing from a non-owner session (the 403 gate is the second line of defense behind the UI gate)
  ✓ R4 (regression): the create flow survives the extraction — useCreateTapestry still returns concepts + create, and NewTapestry still drives it

suite result: {"pass":4,"fail":19}
```

Playwright spec (isolated, chromium, local stack up): **7 failed (E1, E6, E7, E8, E9, E11, E12),
6 passed (E2–E5, E10, E13 — permanent negative/read-path guards, non-vacuous: each first asserts
the members render)**. Every failure is the same right reason — the affordance does not exist:

```
    Expected: visible
    Received: <element(s) not found>
    Timeout:  10000ms
    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByRole('textbox', { name: /add a concept/i })

  7 failed
    [chromium] › …tapestry-add-concept.spec.js:225:3 › … › E1: the owner sees the add-a-concept affordance on the Exploration page of a TA-authored tapestry
    [chromium] › …tapestry-add-concept.spec.js:272:3 › … › E6: the picker excludes concepts that are already members and offers the ones that are not
    [chromium] › …tapestry-add-concept.spec.js:288:3 › … › E7: picking a concept on a TA tapestry POSTs signAs:"assistant" — same d-tag, prior members + integrations intact, one member appended, created_at newer, no navigation
    [chromium] › …tapestry-add-concept.spec.js:319:3 › … › E8: on an owner-authored tapestry the save NIP-07-signs and POSTs signAs:"client" under the owner's key, same d-tag
    [chromium] › …tapestry-add-concept.spec.js:339:3 › … › E9: after a successful save the page re-reads the same coordinate and the added concept appears among the members
    [chromium] › …tapestry-add-concept.spec.js:370:3 › … › E11: a failed publish shows a clear inline error and the membership is unchanged
    [chromium] › …tapestry-add-concept.spec.js:390:3 › … › E12: the graph-less b0b48b00-shaped tapestry still offers the owner the affordance, and the first add publishes the minimal envelope at the same bare-hex coordinate
  6 passed (13.7s)
```
