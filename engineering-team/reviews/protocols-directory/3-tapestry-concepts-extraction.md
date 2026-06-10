# Review: Story 3 — Tapestry Concepts extraction

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-10
**Diff:** commit `4ed8e199` (4 files, +206/−151: `protocols/drafts/tapestry-concepts.md` new; `BIBLE.md` §5/§8/§9 rewritten; `protocols/README.md` row 3; `engineering-team/workflows/protocol-spec-workflow.md` amendment)
**Contract:** `protocols-directory` ADR 0001 (split table + 11-heading skeleton) + story ACs + traceability rule
**Method note:** implementation authored in this same session; audit fanned out to 9 independent agents across five dimensions — ADR conformance, boundary discipline (story-mandated), traceability against the pre-change BIBLE (`git show 4ed8e199~1:BIBLE.md`), cross-reference/anchor integrity, and stranger-readability — with every non-note finding adversarially verified. Quality gates run directly by the Reviewer.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (full suite)
- [x] Playwright — skipped: docs-only
- [x] Diff scope — exactly the ADR's four files; zero BIBLE TOC lines touched
- [x] _Lint/typecheck/build not configured — skipped._

## ADR adherence

- [x] Skeleton: exactly the 11 fixed headings, in order, with the two example subsections.
- [x] Split table, both directions: every "goes to spec" item present in the spec; every "stays" item present in its BIBLE section; landmark sweep confirms no wire table, tag definition, or JSON wire example normative in two places.
- [x] Workflow amendment: the ADR's three touches + the one pre-flagged extra parenthetical (accepted — required by the story's consistency AC). Nothing else changed in the charter.

## Boundary discipline (story-mandated dimension)

- [x] Spec side: zero occurrences of Neo4j/Meilisearch/strfry/UI/CLI/firmware-install machinery; zero hardcoded pubkeys; deployment-relative identity handled via "as published by the deployment" + worksheet W1 link.
- [x] BIBLE side: §5 keeps uuid-on-Neo4j, `create-concept` emission, `IS_THE_CONCEPT_GRAPH_FOR` contrast, ADR 0007 note, §6 cross-ref; §8 keeps firmware framing + §7 ref; §9 keeps Health Audit verbatim + firmware-published sentence. Pointer-first shape in all three.

## Traceability (story rule)

- [x] All normative spec claims traced to old BIBLE §5/§8/§9, ADR 0007 content, or the DList base NIP — including the four scrutinized new-prose passages (three-z-forms contrast; "key their stores on it" generalization; coreMemberOf/deterministic-d-tag wiring; the W1 identity section). No invented protocol behavior.

## Cross-references

- [x] §5/§8/§9 anchors + TOC intact; Glossary "See §5" chain and §22's "(ADR 0007, §5)" still satisfied; worksheet W2/W5/W7 refs still true; all links in the four files resolve; W1 anchor slug verified.

## Findings

Audit: 4 confirmed (all minor, all one dimension), 0 refuted, 3 notes.

### Blocking (consolidated — one kickback, one file)

All four are stranger-readability gaps in `protocols/drafts/tapestry-concepts.md`; each fix is **constrained by the traceability rule**: clarify only to the extent the sources support, and mark what remains unspecified *explicitly in the spec text* (a pre-NIP may honestly say "not yet formalized") rather than inventing constraints.

1. **`uuid` undefined** (examples at :76–77, :128, :131, :139–145) — define once: in word-wrapper payloads, `uuid` carries the referenced node's a-tag address (sourceable from old §5's addressing text).
2. **`wordTypes` undefined** (:75, :86, :106, :127) — describe what the sources show: the node's roles, corresponding to the type-specific section keys, `"word"` first in every sourced example; explicitly mark value constraints as not yet formalized.
3. **`coreMemberOf` prose/example inconsistency** (:86 vs. the Concept Header example) — clarify conditionality: carried by core nodes pointing back at the concept they belong to; the Concept Header itself omits it (observable in the sourced examples).
4. **`concept-graph` tag vs. kind unification** (:174) — the tag is sourced only for kind-39998 headers while §"Kind unification" allows 39999-as-concept; state the sourced scope (defined on 39998 headers; the compute fallback is phrased for any header) and explicitly mark 39999-header tagging as unspecified.

### Non-blocking

1. Spec header lists sources as text, not links — acceptable metadata style (matches the other two spec headers).
2. Only 2 of 9 type-specific keys have worked examples — fine for a pre-NIP; future maturation item, not a wire gap.
3. Glossary one-line glosses retained — pre-disclosed, accepted.

## Verdict

**CHANGES_REQUESTED** — solely for the four-definition kickback above, all in one file, all additive sentences under the traceability constraint. Everything structural passed clean on first audit: ADR conformance, boundary discipline, traceability, references, gates. On the fix landing with the constraint honored, this converts to PASS with a targeted re-check of the four passages (no full re-audit).
