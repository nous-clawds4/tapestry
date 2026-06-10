# Review: Story 4 — Class-Thread Membership Tags (`n`, `s`) extraction

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-10
**Diff:** commit `db659caf` (4 files, +66/−29: `protocols/drafts/class-thread-tags.md` new; `BIBLE.md` §23 rewritten; `protocols/README.md` row 4; `protocols/worksheet.md` W2/W5/W7 ref repoints)
**Contract:** `protocols-directory` ADR 0002 (thin — trust-constraint split table + 7-heading skeleton), inheriting ADR 0001's pattern; story ACs; traceability rule
**Method note:** implementation authored in this same session; audit fanned out to 7 independent agents across five dimensions (ADR conformance, boundary discipline, traceability against `git show db659caf~1:BIBLE.md` §23, references/anchors, stranger-readability), non-note findings adversarially verified. Gates run directly by the Reviewer.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (full suite)
- [x] Playwright — skipped: docs-only
- [x] Diff scope — exactly four files; BIBLE modified in a single hunk (§23 only)
- [x] _Lint/typecheck/build not configured — skipped._

## ADR adherence

- [x] Skeleton: exactly the 7 fixed headings, in order.
- [x] Split table, both directions: three security kernels in the spec (cross-instance-election attack named); BIBLE retains dual-emit policy, concrete trust-gate wiring (curatorPk / #11 anchor / Phase-B rules / §22 ref), materialization note (§6), "Established by ADR 0011", §25 pointer for `b`.
- [x] `b` cross-ref form exactly as specified (BIBLE §25 link + migration-pending parenthetical; no duplication).
- [x] Example hygiene: `919ba08a…` → `<pubkey>` placeholder, flagged in the source map.
- [x] Worksheet touches: W2/W5 per the ADR's allowance; W7 (unlisted in the ADR) judged within the same allowance — its ref claimed content §23 no longer carries, which is exactly the story AC the allowance exists for.

## Boundary discipline

- [x] Spec side: zero stack machinery (no Neo4j/MERGE/curatorPk/TA/story-numbers/function names/endpoints/hex fragments).
- [x] BIBLE side: no normative tag definition, value format, or general rule restated; the trust-gate bullet states only the concrete gate.
- [x] Dual-normativity landmark sweep clean (table, direction-principle text, multi-parent text live only in the spec; §25's own "multi-parent" usage is the `b` family, not duplication).

## Traceability (story rule)

- [x] All normative claims traced to old §23 / ADR 0011 / §25-for-`b`-contrast. The ADR-flagged **constraint-2 generalization** was scrutinized and judged a faithful abstraction: the #11 anchor that §23 permits is itself an explicit consumer-side act (firmware install, §22), so "bridging is an explicit consumer-side act, never derived from a foreign tag" claims neither more nor less than the Tapestry rule enforces.
- [x] Constraint-1 generalization (`pubkey === curatorPk` → "events signed by that curator") faithful.

## Findings

Audit: 1 confirmed blocker, 1 refuted, 19 notes (all confirmatory).

### Blocking

1. **protocols/worksheet.md:51 (W5)** — the W1-interaction parenthetical still reads "(BIBLE §23 ties it to the flaw-A exit; §22's deferred list carries it only as a reserved-future candidate)". After this commit, §23 carries no REFERENCES content at all — the candidate-tags paragraph moved to the spec, which deliberately does *not* restate the flaw-A-exit linkage (per ADR 0002, per-candidate detail lives in W5). The linkage statement therefore now has no surviving source outside W5 itself. Asked change: rewrite the parenthetical so W5 *owns* the claim — e.g. "(the REFERENCES↔flaw-A-exit linkage, formerly noted in BIBLE §23, is now recorded here; §22's deferred list still carries REFERENCES as a reserved-future candidate)". One sentence, same file the commit already touched. *Irony noted for the record: this exact text was story 1's kickback fix — each extraction story shifts the ground under earlier cross-references. Story 5 should sweep the worksheet proactively.*

### Non-blocking

1. "Curator" used without formal definition — **refuted** by the adversarial verifier (the Security-considerations context supplies the operative meaning: the keyholder whose signed events define a graph). Recorded here because story 5/6 touch the same term; a one-line definition in a future pass wouldn't hurt.

## Verdict

**CHANGES_REQUESTED** — solely for the W5 parenthetical (one sentence, one already-touched file). Everything else clean on first audit: skeleton, split both directions, both generalizations traceability-verified, boundary sweep spotless, gates green. Converts to PASS on the fix with a targeted re-check of W5 (no re-audit).
