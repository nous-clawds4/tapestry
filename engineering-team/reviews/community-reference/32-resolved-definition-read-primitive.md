# Review: Story 32 — Resolved Definition read primitive (§26)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-05
**Branch:** `feat/communities`
**Type:** Doc (protocol-definition). Phases run: Planning → Architecture → Implementation → Review (Test Design skipped per story Q2, mirroring #31/#20).
**Diff under review (3 commits):**
- `story: resolved-definition-read-primitive (#32)`
- `adr: 0028 resolved-definition (#32)`
- `impl: BIBLE §26 resolved-definition (#32)` — **BIBLE.md only, +36/−8**

## Quality gates (run by reviewer, not trusted)

- [x] **`git diff --stat` — BIBLE.md only** (+36/−8). No source, tests, or firmware touched. Confirms the docs-only contract.
- [x] **`npm test` — no regression.** Full suite run. 3 suites fail (`community-reference-nostr-relay-stub` TI1; `manual-task-retrigger-after-finish` ×4; `task-queue-semaphore-protection-audit` ×3) — **proven pre-existing**: stashing the BIBLE edit and re-running reproduces the identical failures on HEAD. None reference the new §26 content (relay-stub/manual-retrigger have 0 BIBLE refs; semaphore-audit's BIBLE refs are to unrelated sections). This story introduced **zero** new failures. See Findings NB-4.
- [x] **No new lint/typecheck/build tooling** (CLAUDE.md house rule). None added.
- [x] **Concept-graph integrity** — no concept definition or schema changed → **no firmware reinstall required** (matches ADR 0028). The local stack is installed (36/36) and the concept-graph API confirms no schema delta from this change.
- [ ] **Test Design** — N/A (skipped per story; doc-content sentinels covered here in Review).

## Spec adherence (vs. story #32 acceptance criteria)

- [x] **AC1 — §26 adjacent to §25, read-side companion to `b`, general, not community-scoped.** [BIBLE.md:1703](BIBLE.md#L1703) — "The read-side companion to the `b` tag (§25)… **general concept-graph machinery, not community-specific** — Alice's resolved definition of `dogs`…concept↔concept, set↔set, Declaration↔Declaration."
- [x] **AC2 — canonical resolution rule: child overrides, omitted inherited, first-listed-`b` wins, terminate at root/maxDepth/cycle.** [BIBLE.md:1707-1720](BIBLE.md#L1707) — normative pseudocode + explicit precedence ("node's own stated fields → first-listed `b` parent → later-listed → root"); first-listed-wins at :1720; guards at :1726. **Pseudocode logic verified correct:** `reversed(node.bParents)` merged into `base` means the first-listed parent is merged last and therefore wins; `node.statedFields` merged last wins over all parents.
- [x] **AC3 — live/read-time, not snapshot.** [BIBLE.md:1724](BIBLE.md#L1724) — "Resolution reads each ancestor's *current* state on every read… never snapshotted."
- [x] **AC4 — WoT-weighted field resolution explicitly rejected for v1.** [BIBLE.md:1728](BIBLE.md#L1728) — "WoT-weighted field resolution was considered and **rejected for v1**." ADR 0028 Option C records the rationale.
- [x] **AC5 — boundary: §26 is the read step over `b`, distinct from the `b` write tag and from IMPORT/REFERENCES.** Met. §26 opens by contrasting write (§25) vs read; §25's resolution block was condensed to a pointer ([BIBLE.md:1684](BIBLE.md#L1684)); the IMPORT/REFERENCES distinction lives in §25's editorial-family table, which §26 reaches via the `b` cross-reference. See NB-1 (optional self-containment polish).
- [x] **AC6 — Communities named as consumer without defining membership; membership/`nostr-user-tag`/GrapeRank/roles out of scope.** **The load-bearing guardrail — held.** [BIBLE.md:1730](BIBLE.md#L1730) — "The Communities Protocol is the first consumer… **The membership model itself — who belongs to a community, trust-weighted vouches, roles — is a separate, downstream layer and is not defined here.**" No `nostr-user-tag`, no GrapeRank roster weighting, no `INFLUENCE_CUTOFF`, no roles appear anywhere in §26. Verified by read-through.
- [x] **AC7 — ADR 0028 records decision + rejected WoT alternative + forwarded questions.** [0028](engineering-team/decisions/community-reference/0028-resolved-definition.md): Option A chosen, Option C (WoT) rejected; "Answers to the story's forwarded questions" resolves set-algebra (deferred), MAX_DEPTH (16), cycle (truncate-and-continue), live, pseudocode placement.
- [x] **AC8 — no regression; no new tooling.** Confirmed (quality gates).

**8/8 ACs met.**

## ADR adherence (vs. ADR 0028)

- [x] §26 created adjacent to §25; §25 condensed to a pointer (no dual home for the rule) — [BIBLE.md:1684](BIBLE.md#L1684).
- [x] First-listed-wins multi-parent — matches.
- [x] WoT-field-weighting rejected; determinism boundary preserved (selection = WoT/§22, merge = deterministic) — [BIBLE.md:1728](BIBLE.md#L1728).
- [x] `MAX_DEPTH = 16`, cycle-guard truncate-and-continue (never throws) — [BIBLE.md:1726](BIBLE.md#L1726).
- [x] Whole-field replace; set-valued algebra deferred — [BIBLE.md:1722](BIBLE.md#L1722).
- [x] **No new §6 edge row** (no new edge) — confirmed; §6 untouched. Glossary entry added ([BIBLE.md:1547](BIBLE.md#L1547)); ToC updated ([BIBLE.md:39](BIBLE.md#L39)).
- [~] §22 cross-link was marked **optional** in the ADR and skipped by the Implementer (§26→§22 link exists; §22→§26 backlink does not). Acceptable; see NB-3.

**No ADR deviations.**

## Things tests can't catch

- [x] **Substrate-only line held** (the user's gating condition) — re-verified by full read of §26: nothing membership-specific leaked in.
- [x] **No secrets / no source / no commented-out code.** Pure prose.
- [x] **Internal consistency** — §25 pointer, §26 body, §21 glossary, and ToC agree on the rule (first-listed-wins, MAX_DEPTH=16, deterministic, live).
- [x] **Cross-references resolve** — §26 → §22/§23/§25 and ADR 0028; glossary → §26; ToC anchor `#26-resolved-definition` matches the header.

## Findings

### Blocking
_None._

### Non-blocking
1. **NB-1 — §26 self-containment vs IMPORT/REFERENCES.** §26 distinguishes read-vs-write (§25) clearly but relies on §25's editorial-family table for the IMPORT/REFERENCES contrast. A one-line "(unlike IMPORT/REFERENCES, which have no read-time merge step)" in §26 would make it self-contained. Optional polish; not required by any AC.
2. **NB-2 — diamond inheritance + shared `visited` set (for the *future* resolver-impl story).** The illustrative pseudocode's `visited` set serves double duty: cycle-guard *and* diamond-dedup. In a diamond (A inherits B and C; B and C both inherit D), D resolves once via the first branch and is skipped on the second. The documented contract (first-listed-wins, truncate) is sound at the spec level, but the future implementation story (resolver/merge-walk — explicitly deferred by ADR 0028) should **specify diamond semantics explicitly and test them**, and write the real `visited` as an explicitly-threaded accumulator (the `visited={}` default-arg is an illustrative-only footgun). Out of scope for this docs story.
3. **NB-3 — optional §22 backlink.** Adding a one-line §22→§26 pointer near the registry-as-DList candidate paragraph would aid discoverability. ADR marked it optional; Implementer's skip is defensible.
4. **NB-4 — 3 pre-existing test failures inherited from the 278-commit merge** (`community-reference-nostr-relay-stub` TI1 / firmware manifest `communityReference` per ADR 0005; `manual-task-retrigger-after-finish`; `task-queue-semaphore-protection-audit`). Not caused by this story (proven via stash) and out of its scope, but real merge debt worth its own triage — the first is community-reference substrate, the other two are the task-queue epic.

## Verdict

**PASS.**

Story #32 lands the read-side bookend to ADR 0027's `b` tag: a new BIBLE §26 "Resolved Definition" that (a) names the read primitive as general concept-graph machinery, (b) closes ADR 0027's deferred multi-parent ordering with first-listed-wins, (c) pins the previously by-reference guards (`MAX_DEPTH=16`, cycle truncate-and-continue), (d) records the WoT-weighting rejection and preserves the load-bearing selection-vs-merge boundary, and (e) holds the substrate-only line — no membership model pre-committed. 8/8 ACs met, ADR-conformant, BIBLE-only diff, zero new test failures. Four non-blocking notes; NB-2 is the one worth carrying forward into the future resolver-implementation story.

Ready for the deploy chain (`cycle-staging` → `cycle-prod`) when the user chooses. Per the reconciliation proposal's merge order, §26 is branch-independent and merges ahead of the three-branch reconciliation.
