# Review: Story pov-resolution #1 — Ratify the three-PoV resolution standard

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-08
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3 — accuracy/consistency audit, not coverage)
**Diff:** `git diff origin/staging...HEAD` — commits `4a147dc3` (impl: BIBLE §27 + handoff flip), `dad45164` (ADR 0033), `28f983c0` (story + epic)
**Story:** `engineering-team/stories/pov-resolution/1-ratify-three-pov-standard.md`
**ADR:** `engineering-team/decisions/pov-resolution/0033-three-pov-resolution-standard.md`
**Test plan:** N/A — Test Design skipped (docs-mode; no executable behavior)

## Quality gates (run by reviewer, not trusted)
- [x] `npm test` — **Overall PASS, no FAIL suites.** Docs-only change touched no tests. (This branch was cut from `staging` before profile #35/#36 merged, so its suite counts predate those stories' #36 updates — expected, not a regression.)
- [x] Diff scope — **spec/docs only**: `BIBLE.md`, `docs/POV_RESOLUTION_DESIGN_HANDOFF.md`, `engineering-team/**`. No source, concept, schema, or firmware files touched.
- [x] _Lint/typecheck not configured — skipped._

## Accuracy audit (are the §27 claims true?)
Cross-checked every factual claim against the source of truth (`docs/POV_RESOLUTION_DESIGN_HANDOFF.md`) and the shipped reality.

- [x] **Three PoVs + source map** (BIBLE.md:1757–1761) reproduce handoff §2 exactly: Owner → Neo4j node props (`influence`/`verified*Count`/`hops`) + live traversals, always available; House → kind 30382 → Meili `wot_*_<houseSuffix>`, only if published/imported; Personalized → kind 30382 per-user → Meili `wot_*_<userSuffix>`, only if that user's assertions exist.
- [x] **Following stays on strfry / non-PoV** (BIBLE.md:1765) — matches handoff §7.3; the batch-immunity rationale is accurate.
- [x] **Owner-not-House naming correction** (BIBLE.md:1766) — matches handoff §2; correctly scopes "House" to the kind-30382 → Meili read.
- [x] **"Status today" matches reality** (BIBLE.md:1772–1777). Verified profile Verified Followers/Reporters = Owner (Neo4j), shipped profile #35/#36 — ADR `0031`/`0032`, `VerificationInfo.jsx`, `reportersWithMetrics.js` all confirmed present on `origin/staging` (PR #254). Badge==table independently confirmed at PR #254 smoke (Jack VR badge 6 == `get-grapevine-reporters` count 6). Grapevine tables = Owner live; search = Meili 2-way House↔Personalized — both accurate.
- [x] **Target-direction block is unambiguously not-built** (BIBLE.md:1779–1785): "The following is the intended direction. **None of it is implemented yet**." No selector/fallback/freshness claim reads as present-tense. This is ADR 0033's core constraint (Option B) — satisfied.
- [x] **Open questions (6) listed as open** (BIBLE.md:1791–1796), one-to-one with handoff §8 (default PoV, resolver shape, freshness signaling, per-feature fallback chains, Personalized source, count=list-length). None silently decided. The handoff §2 "possibly a local per-customer calc" nuance is preserved as open-question #5.

## Consistency / cross-reference audit
- [x] TOC entry (BIBLE.md:40) text matches the heading (BIBLE.md:1747).
- [x] GitHub anchor `#27-point-of-view-pov-resolution` resolves to the heading (verified by slug computation: lowercase, parens dropped, spaces→hyphens → exact match).
- [x] `See ADR 0033` cross-ref present (BIBLE.md:1798).
- [x] §27 sits **after §26** (line 1711) and **before** the maintainer footer (line 1802). Internal ordering intact.
- [x] Handoff doc flipped to **✅ SUPERSEDED** with a `**Superseded by:** BIBLE.md §27` pointer naming the section correctly; **body preserved** (full §1–§10 retained for history, per the CLAUDE.md SUPERSEDED convention).
- [x] Story Deviations + Linked artifacts updated; ADR linked.

## ADR conformance
- [x] **Option B (four-block structural split)** used verbatim: *The standard (ratified)* / *Status today* / *Target direction (not yet built)* / *Open questions* (BIBLE.md:1753, 1768, 1779, 1787).
- [x] Optional §11/§14 cross-refs **correctly skipped** — ADR 0033 marked them optional "to keep the diff focused"; omission is conformant, not a defect.
- [x] No code/concept/schema/firmware change; **no firmware reinstall** (pure spec, per ADR Consequences).

## Things tests can't catch
- [x] Prose does not overclaim: built vs target vs open are physically separated; a reader cannot mistake the selector/fallback for shipped behavior.
- [x] No stale "House (default)" labels reintroduced in the new section.
- [x] The handoff doc's open questions survive the retirement (mirrored into §27 + the epic's Deferred list) — no thinking lost.

## Findings

### Blocking
None.

### Non-blocking
1. **The "ADR 0031/0032 / profile #35/#36" reference in §27 resolves on the merge target, not on this branch in isolation.** Those ADR files live on `origin/staging` (PR #254), and this docs branch was cut before they merged. Once this PR merges into `staging` (which carries them), the reference resolves in the combined tree. The claim is factually accurate today; only the in-repo file does not exist on this isolated branch. No action needed.
2. **Branch is 13 commits behind `origin/staging`.** The 13 are profile code + artifacts (disjoint file set from this docs change), so the merge is expected to be clean — but the PR may report `BEHIND`. Handle in the `cycle-staging` step (rebase if flagged); not a review concern.

## Verdict
**PASS** — all 10 story ACs met, ADR 0033 conformant (Option B structural split, optional cross-refs legitimately skipped), every §27 factual claim verified against the design handoff and the shipped PR #254 reality, the target/open material clearly non-normative, cross-references and the anchor resolve, the handoff doc retired with body preserved, and the gate is green (`npm test` Overall PASS; docs-only, no test touched). Only two minor, no-action non-blocking notes.
