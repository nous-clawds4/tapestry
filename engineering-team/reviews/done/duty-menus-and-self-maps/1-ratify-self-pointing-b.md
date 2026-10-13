# Review: Story 1 — Ratify the self-pointing `b` (self-declared Shared Concepts)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** `git diff 4dae3e7a^ 4dae3e7a` (commit `4dae3e7a`; base `dafbfe50`)
**Mode:** docs-mode (Protocol-Spec workflow). Test Design was skipped, so there is no test plan. This review audits accuracy and consistency; the gate is a regression check only.
**Inputs:** story `stories/duty-menus-and-self-maps/1-ratify-self-pointing-b.md`; ADR `decisions/duty-menus-and-self-maps/0001-self-declaration-in-the-b-tag-section.md` (Accepted); book `audits/duty-menus-and-self-maps/book.md`; vocabulary policy `docs/NIP_REORG_DESIGN_HANDOFF.md` § D2.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, run as `GATE_LABEL=duty-menus-1-review npm test` on a clean tree at `4dae3e7a`. `npm run -s gate:status -- --label duty-menus-1-review` reports:
  `20261010T222804Z-7814-1784 [duty-menus-1-review] started 2026-10-10T22:28:04.924Z on 4dae3e7a — FAIL, exit 1, 5545 passed, 27 failed, 591 skipped, 297/297 suites; failed: default-deny-mutations, dictionary-wired-create, dictionary-edit-concept, dictionary-resync-concept, curated-dlist-update-publish, author-scoped-inspection-roster, task-routes-owner-admin, admin-action-sweep, admin-action-sweep-access, tagging-edges-wiring, tagging-edges-drift-route`
  - **The red is not caused by this diff.** I checked this myself rather than relying on the Implementer's account:
    - **Static check.** None of the 11 failing suites reads any of the three edited files. The only textual hit is the English word "amendments" in a comment at `test/curated-dlist-update-publish.test.js:6`. No runtime code under `src/`, `ui/src/`, `scripts/` or `setup/` reads them either; the only hits are comments.
    - **Suites that do read the edited specs all PASS**, with the same counts on the clean-tree baseline:
      - `b-coverage-audit-and-disposition` S3/S6: PASS 18/0/8;
      - `curated-dlist-update-pointer-switch` D1: PASS 12/0/0. Its `Implementation` line regex still matches, and the appended clause avoids its `still writes it` guard.
    - **Failing tests compared with the clean-tree baseline.** The baseline record is `20261010T221834Z-4660-bfd0` (`dafbfe50`, `dirty: false`). The 27 failing test names in my run are a strict subset of its 28. The one extra in the baseline is the `tagging-edges-realtime-wrapper` RW7 timing flake. The red has unrelated causes; for example, `admin-action-sweep` fails with "src/middleware/routeAccess.js does not exist yet", which is the Tester-phase red of security-auth-exposure #8 (`ad61b9ad`).
  - Given that evidence, a stash-and-rerun comparison was not needed. No files were stashed.
- [x] `npm run test:playwright`: not applicable (no UI).
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [x] _Lint, typecheck and build are not configured, so they were skipped._
- [x] **Links and §-references resolve.** The new text links to `./shared-concepts.md` § "Declared affiliation" (heading at shared-concepts.md:33), `./inherit-from.md` § "The `b` tag" (inherit-from.md:18) and § "Deliberate non-affiliation" (shared-concepts.md:43). All targets are sibling files in `protocols/drafts/` and exist. The ADR cited in both Sources lines exists at `engineering-team/decisions/duty-menus-and-self-maps/0001-…md`.

## Claims adherence (docs-mode)

| # | Claim in the new prose | Where | Evidence |
|---|---|---|---|
| 1 | Self-declaration's wire form is `["b", "<kind>:<own pubkey>:<own d-tag>", "pointer"]` | inherit-from.md:38 | `composeSelfDeclare` appends exactly this (`src/lib/headerDispositionCompose.js:31`). Concept Headers' Submit does the same inline (`src/api/concept/selfDeclare.js:85,97`), and so does Create New Concept with no target (`src/api/adoption/newConcept.js:71`). |
| 2 | "A pointer-typed `b`, or one with no type" | inherit-from.md:38 | An absent type reads as `pointer` (inherit-from.md:29,33). The code's self-declared check ignores the type (`bValueForms.js:43-50`; `headerDispositionCompose.js:30`). Inherit-family self-naming is deliberately left unaddressed (ADR sub-decision 4). |
| 3 | Derived as a pointer, it yields the self-loop `(header)-[REFERENCES {source:'b-tag'}]->(header)` | inherit-from.md:38 | `buildImportCypher` sets an addressable event's `uuid` to `kind:pubkey:d` (`src/api/neo4j/eventSync.js:180`). A non-`inherit` `b` MERGEs `(child {uuid})-[r:REFERENCES]->(target {uuid: tag[1]}) SET r.source='b-tag'` (`eventSync.js:259-284`). With `tag[1]` equal to the own coordinate, both ends are the same node. |
| 4 | It "reaches no other node, so reach and deference closure are unchanged" | inherit-from.md:38 | Deference closure follows `inherit` only, and a pointer breaks the chain (inherit-from.md § "Resolution: the resolved definition"). Reach membership is a set, with "cycles are benign" (shared-concepts.md § "Reach"). |
| 5 | It asserts no deference | inherit-from.md:38 | The pointer type carries no deference (inherit-from.md:29; shared-concepts.md § "Deference"). |
| 6 | No weight in any aggregate; never counted as anyone's affiliation with the header | inherit-from.md:38 | GUM₂ skips a concept's own header and its author's owners (`src/lib/trustedDictionary.js:241,244`). Stamp targets exclude the self coordinate (`src/lib/bValueForms.js:80`). GUM₁ counts `z` carriers, not `b` (`trustedDictionary.js:76-99`). Pointer edges carry zero deference weight (shared-concepts.md § "Aggregated deference"). |
| 7 | Convergence is resolved per point of view; the declaration is a claim, not an outcome | inherit-from.md:38 | This meets D2's mandatory observer-relative qualifier (`docs/NIP_REORG_DESIGN_HANDOFF.md:48`). It is consistent with shared-concepts' Terminology, where a shared concept is an *outcome*, so "offers it as a shared concept" is correctly framed as a claim. |
| 8 | Only an addressable header can self-declare; an immutable `9998`, or a declared `9999`, cannot carry its own event id | inherit-from.md:38 | An event id is the hash of the event's own tags, so it cannot appear inside them. For immutable events the importer's `uuid` is `event.id` (`eventSync.js:180`). "Declared `9999` header" is a defined term (dlist-header-declaration.md:21,25). |
| 9 | A self-declaration replaces a `b-tag-deferred` sentinel | inherit-from.md:38 | `stripSentinel` runs before the append (`headerDispositionCompose.js:31`; `selfDeclare.js:97`). `deferred` is true only when the sentinel stands alone (`bValueForms.js:52`). This matches shared-concepts.md:45 ("wires or self-declares … the sentinel is replaced"). |
| 10 | Coverage tooling treats a self-declared header as dispositioned, the third state beside *wired* and *deliberately unaffiliated* | shared-concepts.md:39 | `bState` is `real` for wired or self-declared, then `deferred`, then `none` (`src/api/adoption/index.js:73,233`). Sharing state carries `selfDeclared` (`src/lib/sharingState.js:59`). The worksheet uses the same three-way split (`protocols/worksheet.md:179`). |
| 11 | Implementation: `composeSelfDeclare` writes it, behind Submit as a Shared Concept | inherit-from.md:4 | True for List Headers' Submit (`src/api/list-headers/myAssistantDisposition.js:45`, reused by `meDisposition.js:26`). Incomplete for the other writers; see NB1. |
| 12 | Amendments § 3 is "now normative in inherit-from § The `b` tag (Self-declaration) … policy line in shared-concepts § Declared affiliation" | amendments-2026-09.md:37 | Both landing sites exist (claims 1 and 10). The proposal text is kept below (amendments-2026-09.md:39-41). |
| 13 | No "root" collision with § "Resolution" | inherit-from.md:38 | `grep` of the added lines finds no "root". |

## Spec adherence (acceptance criteria)

- [x] **AC1.** inherit-from.md:38 sits inside § "The `b` tag" (heading at :18). It comes directly after "Reserved value (element 2)" (:36) and before "**Kinds:**" (:40). It states all five required elements:
  - it offers the header as a shared concept others may affiliate with;
  - it asserts no deference;
  - it opens no path: the self-loop reaches no other node (ADR sub-decision 2);
  - it carries no aggregation weight;
  - convergence is resolved per point of view.
- [x] **AC2.** shared-concepts.md:39 is a single source line of two sentences. It links to inherit-from for "wire form and meaning". It carries no wire tuple and does not restate the deference, weight or edge rules, so there is no second normative copy. The wire fact lives only in inherit-from.md:38, and the coverage-tooling reading lives only in shared-concepts.md:39.
- [x] **AC3.** Running `grep -i -E "canonical|consensus"` over the added lines finds one hit: the struck-through historical heading `## 3. ~~A self-pointing `b` declares a header canonical~~ — applied` (amendments-2026-09.md:35). It is ADR-prescribed, struck through, and in a proposal file, so it is not normative text. The new normative text is clean.
- [x] **AC4.**
  - § 3 is struck through with "— applied" (amendments-2026-09.md:35), matching the file's own §§ 2 and 5 pattern.
  - A dated pointer line follows (:37), and the proposal text is kept.
  - The metadata parenthetical (:3) is the one other edit. ADR sub-decision 5 rules it part of marking § 3 applied.
  - The diff has no other hunks.
- [x] **AC5.**
  - Links resolve, and harness-lint is clean.
  - The gate shows no regression (see Quality gates).
  - `git show --stat 4dae3e7a` lists only the three `protocols/drafts/` files: 11 insertions, 5 deletions.

## ADR adherence
- [x] The changed files match the ADR's Implementation notes exactly. Items 1–3 are verbatim against the ADR's quoted target wording. The inherit-from Implementation clause in item 4 has minor smoothing ("writes it, behind Submit as a Shared Concept"), which the notes permit.
- [x] Layering is respected: the wire meaning is in the primitive spec, and the policy reading is in Shared Concepts as a pointer back.
- [x] No dependencies, no code, no tooling.

## Concept-graph integrity
- [x] No handles are cited or changed.
- [x] No concept definitions changed, so no firmware reinstall is needed (ADR Consequences: "No").
- [x] The orientation-via-summaries check does not apply: there is no new code.

## Things tests can't catch
- [x] No secrets, debug output or commented-out content.
- [x] Scope: nothing beyond the ADR. The three other "self-declared canonical" passages are correctly left alone (ADR Out of scope; AC5).
- [x] Edge cases are addressed in prose: untyped `b`, immutable headers, and a sentinel on the same header. Inherit-family self-naming is deliberately unaddressed.

## House rules check
- [x] Concept Graph API authority respected (nothing derived from source in place of the graph).
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence
- n/a: no PRD and no UI copy.

## Findings

### Blocking
None.

### Non-blocking
1. **protocols/drafts/inherit-from.md:4**: the new Implementation clause names only `composeSelfDeclare`, which backs List Headers' Submit (`myAssistantDisposition.js:45`, `meDisposition.js:26`). Concept Headers' Submit (`src/api/concept/selfDeclare.js:97`) and Create New Concept with no target (`src/api/adoption/newConcept.js:71`) write the same tag inline. The clause is true but incomplete; it follows the ADR's prescribed wording. Optional: name all three writers in a later doc-lane pass.
2. **protocols/drafts/inherit-from.md:38**: one paragraph uses "affiliation" in two senses. "Never counted as anyone's affiliation with it" sits beside "Like any real affiliation, a self-declaration replaces … sentinel". This matches the existing shared-concepts.md:45, which already counts self-declaring as a real affiliation, and it is ADR-prescribed. Readable, so no action is required.
3. **protocols/drafts/shared-concepts.md:39**: "the third state beside *wired*" reads as exclusive. In code, `dispositionOf` can report `wired` and `selfDeclared` together (`src/lib/bValueForms.js:37-52`). This is harmless and carried over from the amendment and worksheet wording.
4. **Follow-up outside this story (AC5 forbids touching it):**
   - The ADR's three remaining D2 slips should be fixed: `protocols/drafts/dlist-header-declaration.md:58`, `protocols/drafts/trust-determination-methods.md:30,35`, and the amendments § 1 table. The ADR leaves the choice to the Reviewer, and I prefer **a ledger row now** so the slips are not lost if the book closes without a doc-lane pass.
   - dlist-header-declaration.md:58 also still cites "Amendments proposal § 3" as the source of the self-pointing `b`. It now resolves to an archived proposal that forwards to inherit-from. That is not broken, but it should point to inherit-from.md § "The `b` tag" directly.
   - `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md:79` now says self-declaration is "not yet in `inherit-from.md`". That is stale; the book's last acceptance bullet flips the handoff at close.

### Harness friction
1. The docs-mode blockquote in `engineering-team/templates/review-checklist.md:20` treats "Docs-mode / doc-lane" as one thing. It says "there are no ACs" and "File the review under the non-numbered form". A Protocol-Spec docs-mode story is storied, has ACs, and takes the numbered filename (`workflows/0-intake.md:31` reserves the non-numbered form for storyless doc-lane reviews). Read literally, the template would mis-file this review. It needs an OPEN.md `meta` row.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place, and the story's "Review:" link filled in. Done by the orchestrator in this review's commit, since this run was told not to edit the story and not to commit.
- [x] Completion detection performed. The book is not complete: stories 2 and 3 of the acceptance frame remain, so there is no `/close-book` offer.
- [x] Follow-ups recorded: OPEN.md rows `2026-10-10-self-declared-canonical-wording` (Findings non-blocking 4, plus notes 1–3 and the accuracy audit's extra stale pointer, `content-categories.md:96`) and `2026-10-10-review-template-docs-mode-filename` (Harness friction 1). The stale handoff line is updated in the same commit.
