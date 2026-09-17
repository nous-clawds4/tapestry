# Review: Story 1 — Concept Elements & Sets viewer in the Firmware Explorer

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-23
**Diff:** `git diff 93251f62..HEAD` (commits c3f7887a story, 267d6c8b adr, 02b68501 test, 8ec32106 impl)
**Epic:** firmware-explorer (book: bounded ask, no PRD)

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite** `node test/firmware-concept-elements-sets.test.js` — **PASS: 19 passed, 0 failed, 0 skipped.**
      All classes ran because the local stack is up: U1–U9 (executed pure-ESM), S1–S3
      (source), H1–H4 (live Neo4j fixtures `test-fecs-*`, created + DETACH-DELETE'd via
      container loopback — self-cleaning, confirmed torn down), R1–R3 (regression).
- [x] **Build** `cd ui && npx vite build` — **PASS** (`✓ built in 20.22s`, 3693 modules).
      The `chunks > 500 kB` warning is pre-existing (`index-*.js`, `ts.worker`, `vis-network`)
      and not introduced by this diff — not a failure.
- [x] _Full `npm test` "Overall:" line — NOT used as the gate_ (FAILs environmentally on the
      local stack per OPEN.md #27); audited this suite specifically + a differential read of
      the registration and touched files, per the phase instruction.
- [ ] _Playwright — not applicable (no e2e added; harness has no jsdom by design)._
- [ ] _Lint / Typecheck — not configured (JS-without-build; no new tooling added)._

## Spec adherence
- [x] Every acceptance criterion has a passing test — full AC→test map verified below.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story (read-only inspector; authoring untouched).

AC coverage (story ↔ implementation ↔ test):

| Acceptance criterion | Implementation | Test |
|---|---|---|
| Elements & Sets offered alongside core views | `FirmwareExplorer.jsx` `MEMBER_VIEWS` + divider + branch (`:360`, `:395`) | S1 |
| Elements list by name, selectable | `ConceptMembersView.jsx` sorted list (`:99`) | S2, H1 |
| Empty state (not error/blank) | "No {noun}s … try Full." (`:94`) | S2 |
| Sets list by name, selectable | same list, `kind='sets'` | S2, H3 |
| Direct/Full toggle, default Direct, governs **both** | `useState('direct')` (`:31`), `SCOPES` toggle rendered for both kinds; `scope` passed to fetch for elements **and** sets | U1–U6, S2, H1–H4 |
| Direct = direct only; Full = transitive (+implicit for elements) | `buildMembersQuery` `*0..10`+UNION z-tag (elements/full), `*1..10` (sets/full), no `*` for direct | U2,U3,U5,U6; **live-verified** H1–H4 |
| Count header per active scope | `.firmware-members-count` "N elements/sets" (`:64`,`:87`) | S2 |
| Click item → JSON, Viewer default, Raw toggle | `MemberDetail`, `viewMode` default `'viewer'`, reset to viewer on select (`:104`,`:36`) | S2 |
| No-JSON item → clear message | `parsed.state==='none'` → "This item has no JSON." (`:162`) | S2 |
| Not-installed concept degrades gracefully | members branch sits **behind** the `!conceptData.installed` guard (`FirmwareExplorer.jsx:381` precedes `:395`) | S3 |
| Any-author (no gating) | no author/pubkey predicate in any built query | U2; H2 (implicit z-tag member included) |

Both Resolved Decisions honored: Direct/Full governs both lists (Decision 1) and each view
shows a scope-reflecting count (Decision 2).

## ADR adherence
- [x] Files changed match ADR 0001 Implementation notes exactly: new `ui/src/api/conceptMembers.js`
      (pure `buildMembersQuery` + thin `fetchConceptMembers`), one-line `ui/src/api/cypher.js`
      `params` extension, new `ui/src/pages/settings/ConceptMembersView.jsx`, additive
      `FirmwareExplorer.jsx` wiring, `styles.css` `.firmware-members*` block.
- [x] Layering respected — query logic lives only in `conceptMembers.js`; the view never
      builds Cypher inline (`ConceptMembersView` imports `fetchConceptMembers`).
- [x] Chosen Option A (frontend-only, parameterized) implemented as decided; no server
      endpoint (Option C) introduced.
- [x] No new dependencies — `conceptMembers.js` imports only `./cypher.js`; the view imports
      React + the existing `JsonView`. Build added no packages.
- [x] Validated Cypher shapes match the ADR table and were **executed against real Neo4j**
      (H1–H4): elements/direct excludes nested+implicit; elements/full adds both; sets/direct
      excludes nested; sets/full includes the transitive closure.

## Concept-graph integrity
- [x] Handles stay in `kind:pubkey:slug` form and travel as the `$h` **parameter** — the
      header handle is read at runtime from `conceptData.nodes.header.uuid` (never hardcoded).
- [x] **Firmware reinstall NOT required** — the diff changes no concept definitions, schema,
      or firmware seed. Confirmed: no `src/**`, `setup/**`, `config/**`, or `*.conf` files in
      the diff. ADR states the same. Read-only UI over existing graph data.
- [x] New code orients via the concept graph's own structural edges (`IS_THE_CONCEPT_FOR`,
      `HAS_ELEMENT`, `IS_A_SUPERSET_OF`), not re-derived from BIBLE.md.

## Things tests can't catch
- [x] **No secrets / no hardcoded TA pubkey.** Scanned all added lines: the only pubkey-shaped
      literals are the ADR/story prose ("resolved at runtime, never hardcoded") and the test
      file's deliberate fake `TESTPUBKEY0…:set` placeholder (whose `:set` slug exists precisely
      to prove the write-guard dodge). Zero real 64-hex literals in production code.
- [x] **No leftover debug logging** in production code. `console.log` appears only in the test
      file and `test/test.js` result lines — that is the harness's own output, correct.
- [x] **No commented-out code.**
- [x] **Error / edge paths handled:** effect `.catch` → in-pane `⚠️ {error}`; missing
      `headerUuid` → "no header node" empty state; null `name` → uuid-suffix fallback;
      `json == null | ''` → no-JSON message; unparseable json → raw `<pre>` (`MemberDetail`
      `state:'raw'`); already-parsed object values handled (`typeof json === 'string' ? parse`).
- [x] **Concurrency:** the fetch effect uses a `cancelled` flag with cleanup — stale/at-unmount
      responses are dropped; `setSelectedUuid(null)` on each fetch prevents a detail pane
      pointing at a row no longer in the list. No race.
- [x] **Remount correctness:** `key={header.uuid + ':' + selectedNode}` remounts per
      concept+kind so scope resets to Direct and selection clears (matches ADR); scope changes
      re-fetch in place without remount (effect dep `[headerUuid, kind, scope]`).
- [x] **Security / injection:** the handle is a bound `$h` param, so it is injection-safe and
      the query template stays write-keyword-clean (the load-bearing write-guard dodge) —
      pinned by U6/U8 (`!sent.cypher.includes(H_SET)`) and U9 (backward-compat).

## House rules check
- [x] Concept Graph API authority respected — structural reads only; no re-declaration of
      concepts; no author/owner/role gate (correct for a structural inspector: POV-first /
      decentralized-first / filter-at-view-time invariants all honored — this view is not
      POV-scoped, so no per-POV columns and no gating is the *correct* choice here).
- [x] No new lint/typecheck/build tooling.
- [x] ADR 0015 `LEGACY_*` constants untouched (diff doesn't touch profile-tags).

## Product-guide adherence
- n/a — bounded-ask epic (no PRD); no canonical copy table to match.

## Test-registration audit (`test/test.js`)
- [x] Suite `require`d (`:177`) and `.run()`'d (`:471`).
- [x] Summary line printed (`:814–818`).
- [x] Registered in the **LIVE** `overallOk` chain **before** the severed terminator —
      `firmwareConceptElementsSetsResult.fail === 0;` is the final term ending the assignment
      at `:964` (the dead `harnessLintResult…` block below the `;` is the known OPEN.md #43
      sever, correctly left alone).
- [x] Added to the `totalSkipped` reducer array (`:1002`).
- [x] Test quality is meaningful, not tautological: U-tests pin the *validated Cypher shapes*
      (directed edges, `*0..10`+UNION+z-tag vs `*1..10` vs no-`*`, RETURN columns) and the
      param contract; H-tests bind the builder's own output to real DB semantics. Not brittle.

## Findings

### Blocking
None.

### Non-blocking
1. **ADR 0001 §Consequences / `ui/src/pages/…/ConceptElements.jsx`** — the pre-existing Concepts
   admin Elements page still interpolates concept handles into its Cypher and shares the same
   `\bSET\b` write-guard fragility this story dodges. Correctly **out of scope** here (called
   out in the ADR). Recommend an OPEN.md row / small hardening story to move it to params.
2. **`test/test.js:1002`** — this diff also adds `captureAGoalAndSeeItResult` to the
   `totalSkipped` array, correcting a prior-story omission (it had been added to `overallOk`
   but not to the skip reducer). Benign and correct — makes the skip count accurate — though
   strictly it's a tidy-up outside this story's scope. Not blocking.
3. **Minor duplication:** `MemberDetail` re-implements the FirmwareNodeJson Viewer/Raw scaffold
   rather than sharing a component. The ADR explicitly accepts this (optional DRY follow-up).

### Harness friction
None.

## Verdict
**PASS**

The diff faithfully implements ADR 0001, covers every acceptance criterion with meaningful
tests (19/19 green, including live-Neo4j confirmation of all four scope shapes), builds clean,
honors the architecture invariants and the runtime-TA-pubkey house rule, and is read-only with
no firmware reinstall required. Mergeable as-is.

## On PASS (same commit — delegated to the launching agent per its instruction)
- [x] Completion detection run — see below.
- [ ] Story `**Status:**` → `Done`: **should be flipped** at the top of
      `engineering-team/stories/firmware-explorer/1-concept-elements-and-sets-viewer.md`
      in the review commit. (Left to the committer; this reviewer did not commit per instruction.)

### Completion detection — book: `firmware-explorer` (bounded ask, acceptance frame)
The epic's acceptance frame is: *an operator can browse a selected concept's live elements and
sets inside the Firmware Explorer and drill into any one as JSON with the Viewer/Raw toggle,
without leaving the Explorer or dropping to Cypher.* Story 1 — the epic's only listed story —
now satisfies that frame end to end. **The book looks complete.** Per workflow, this is an
*offer*, not an auto-close: the launching agent / operator should be asked whether to run
`/close-book` (generate the build audit + PRD seed) — do not auto-run.
