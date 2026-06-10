# Review: Story 31 — Establish the `b` tag as a general inherit-from primitive

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-05
**Diff:** `git diff staging...HEAD` (commits `6406ef46` story, `dbe96476` adr, `69faaa6d` impl)
**Story:** `engineering-team/stories/community-reference/31-b-tag-general-inherit-primitive.md`
**ADR:** `engineering-team/decisions/community-reference/0027-inherit-from-tag-b.md` (Accepted)
**Test plan:** none — Test Design skipped per story resolved-Q2 (docs-only, no executable behavior). Verified by claim-accuracy audit + unchanged test gate, following the story #20 precedent.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**, independently re-run. 26/26 suites pass, Overall PASS (Configuration Loading + 25 named suites; 0 failed). No source touched → no regression, as expected.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._
- [x] **Diff scope:** `git diff staging --name-only` = `BIBLE.md` + three engineering-team artifacts (ADR 0027, story #31, `_intake.md`). **No source/test/firmware files touched** (verified). No new lint/typecheck/build tooling.

## Spec adherence (story acceptance criteria)

All six ACs satisfied:

- [x] **AC1 — general primitive, not community-only.** New §25 opener (BIBLE:1666) + "**Kinds:** defined for kind-39998 and kind-39999 — any addressable DList object" (BIBLE:1674).
- [x] **AC2 — canonical meaning in one place.** §25 tag table (BIBLE:1670) + wire format (BIBLE:1672) + resolution (BIBLE:1682–1689): child-claims-parent, value = parent a-tag, "accept the parent's definition unless this event states otherwise," parent-authoritative + child override. Communities affiliation pointer characterized as consumer (`affiliation` → `b`/`inherit`, BIBLE:1666).
- [x] **AC3 — distinguished from IMPORT/REFERENCES/SUPERCEDES + glossary/table.** §25 editorial-boundary table (BIBLE:1694–1698); §6 `INHERITS_FROM` row (BIBLE:306); §21 glossary `b tag` (BIBLE:1567) + `INHERITS_FROM` (BIBLE:1545).
- [x] **AC4 — §22 candidate registry-as-DList mechanism.** BIBLE:1584, explicitly "**candidate mechanism**… Recorded as candidate only; the registry design is not ratified here."
- [x] **AC5 — ADR records decision + rejected IMPORT alt + deferred questions.** ADR 0027 §Options (B = fold into IMPORT, rejected), §Decision (answers to all 5 forwarded questions), §Out-of-scope.
- [x] **AC6 — no test regression / no new tooling.** Confirmed above.

## ADR adherence (fidelity to ADR 0027 Implementation notes)

- [x] **Five edits all present:** new §25 + TOC (BIBLE:38, 1664); §6 row (306); §21 glossary ×2 (1545, 1567); §22 note (1584); §23 amendments ×3 (1622 reserved-`B`, 1626/1627 future-candidate + namespace, 1620 `n`/`s`-scoping clause).
- [x] **Child→parent edge, NOT the `n`/`s` flip.** `(child)-[:INHERITS_FROM]->(parent)` with explicit "diverges from `n`/`s`; do NOT flip" warning (BIBLE:1678). Matches ADR §"Edge direction."
- [x] **Live read-time resolution** (BIBLE:1682–1686), edge as the only materialized artifact. Matches ADR Q5.
- [x] **No `source` property** (canonical, not a stub) (BIBLE:1680, 306, 1545). Matches ADR §"Edge properties."
- [x] **Reserved uppercase `B`** (BIBLE:1622, 1702). Matches ADR Q4.
- [x] **Namespace widened to kind-39998** (BIBLE:1627, 1674). Matches ADR Q3.
- [x] **Set-valued override deferred; field-level now** (BIBLE:1689). Matches ADR Q2.
- [x] **§22 note marked candidate, not ratified** (BIBLE:1584). Matches ADR §"Registry-as-DList."
- [x] **Placement:** appended as §25; §24 Task Queue **not** renumbered (verified TOC + headings). Matches ADR placement note.

## Internal consistency / accuracy audit

- [x] **§23 scoping is correct, no contradiction.** The "no editorial relationships inferable" line (BIBLE:1620) is now explicitly scoped to `n`/`s` with a pointer to §25 — does not contradict `b` being an editorial single-char tag.
- [x] **Boundary table matches existing BIBLE wording.** "IMPORT… implies IS_A_SUPERSET_OF" (BIBLE:1698 / 1545) agrees with §6:301. "REFERENCES… non-committal stub, carries `source`" agrees with §6:304 / §22:1572. `b` canonical/no-`source` agrees with the canonical-edge convention (ADR 0011 / §22 Phase B).
- [x] **"First editorial single-char tag" is accurate.** Existing editorial relationships are descriptor-events or Neo4j-only stubs (§6 header "explicit events"; REFERENCES "Neo4j-only… NOT an explicit event") — none is a single-char tag.
- [x] **Cross-references resolve.** TOC anchor `#25-the-inherit-from-tag-b` (BIBLE:38) matches heading (BIBLE:1664); §25↔§6/§22/§23 textual refs valid; story Linked-artifacts → ADR 0027 path resolves; ADR → story path resolves.
- [x] **Markdown well-formed.** Both new §25 tables (4-col tag table, 5-col boundary table) have matching header/separator/row column counts.

## Concept-graph integrity
- [x] **N/A — no concepts, handles, or schemas changed.** This is documentation of a *future* tag/edge; no firmware concept definitions were edited, no graph nodes created. Handles referenced in prose are illustrative (`39998:<alice>:dogs`) and in correct `kind:pubkey:slug` form.
- [x] **Firmware reinstall:** **not required** (ADR 0027 §Consequences: "No — deliverable is documentation only"). Correctly called out. A future *implementation* story that materializes `INHERITS_FROM` will re-evaluate.

## Things tests can't catch
- [x] No secrets, no debug logging, no commented-out code (prose-only diff).
- [x] No scope creep in implementation: commit `69faaa6d` touches **only** `BIBLE.md`. The `_intake.md` addition (queued Communities Protocol) rides in the *story* commit `6406ef46` as legitimate Planning-phase intake hygiene, referenced by the story's Out-of-scope — not implementation scope creep.
- [x] No silent AC drop; no behavior added beyond the story.

## House rules check
- [x] Concept Graph API authority respected (API was down; grounding in BIBLE was ratified by the user at the Architecture gate — appropriate here since the deliverable *is* BIBLE prose and the subject is a new tag absent from the graph).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **BIBLE.md:1686 / 1666** — §25 forward-references the Communities Protocol and its `effectiveCD` resolver, which are not yet in the BIBLE (queued in `_intake.md`, 2026-06-05). This is intentional (§25 names the Communities Protocol as the first *consumer*) and consistent with how the BIBLE references in-progress work elsewhere, so it is not a defect. **Follow-up:** when the Communities Protocol lands, ensure `effectiveCD` is actually defined there so the analogy resolves.
2. **Process note (not a diff issue)** — git is recording commits under an auto-derived identity (`Clawds4 <clawds4@Davids-MacBook-Pro.local>`). Harmless for content, but the author may wish to set `git config user.name/user.email` before the deploy chain so the merge history carries a proper identity.

## Verdict
**PASS** — the diff matches the story (all 6 ACs), conforms to ADR 0027 (all five edits, all five forwarded-question decisions reflected), is internally consistent and accurate against existing BIBLE wording, every cross-reference resolves, and the test gate is clean (26/26, independently re-run). Documentation-only; no source, test, or firmware touched. One non-blocking follow-up noted (`effectiveCD` definition when the Communities Protocol lands).
