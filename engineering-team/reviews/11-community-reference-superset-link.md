# Review: Story #11 — Community-reference Superset link (Phase A)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-19
**Diff:** impl commit `5edc270d` (vs Test-Design boundary `e7a6c502`)
**Story/ADR/Plan:** `stories/11-community-reference-superset-link.md` · `decisions/0008-community-reference-superset-link.md` · `stories/11-community-reference-superset-link.test-plan.md`

## Quality gate (run by reviewer, not trusted)
- [x] `npm test` — **Overall PASS**. community-reference-superset-link 4/4 (T1, T2, T3 now PASS; R1 PASS); all 9 prior suites + config green. Re-run by reviewer.
- [x] Lint/typecheck/build — not configured; skipped.

## Spec adherence
- **AC-1** ✓ — `pass_communityReferences` fetches `${dTag}-superset` via `/api/relay/external` (inline-template literal, T1 anchor); publishes via `/api/strfry/publish` (no re-sign); materializes via `executeCypher(buildImportCypher(supEv))`; **explicitly `SET n:Superset` on the materialized foreign node by uuid** (T2 anchor; ordering verified at `install.js:1080→1082`). Post-derive MERGEs `(localSup)-[:IS_A_SUPERSET_OF]->(communitySup)` (T3 anchor; carries **no `source` property** — canonical relationship). Behavioral proof = smoke S1.
- **AC-2** ✓ — graceful by construction: missing Superset event → log + continue (REFERENCES still wired); Superset materialization error → log + continue (REFERENCES still wired); post-derive presence-check + try/catch on both edges independently; **no `continue` between Header and Superset blocks** (verified at `:1230` log-only catch fall-through, `:1234` `if (!link.supersetTo) continue` only when nothing to wire). Behavioral proof = smoke S2.
- **AC-3** ✓ — deterministic a-tags + MERGE + idempotent. Behavioral proof = smoke S3.
- **AC-4** ✓ (the honest invariant) — no bulk element/set import code added. The IS_A_SUPERSET_OF edge is a structural bookmark; community elements remain unmaterialized. Verified by smoke S4.
- **AC-5** ✓ — R1 regression guard green; the Rev-2 contract (Header materialization + REFERENCES MERGE + `source` property) is byte-preserved.

## ADR 0008 adherence
- Option A — deterministic compute `39999:${curatorPk}:${supersetDTag}` (no graph lookup) ✓.
- Explicit `SET n:Superset` label on the foreign node (kindToLabel gives `:ListItem` only for 39999) ✓.
- Post-derive MERGE of the canonical `[:IS_A_SUPERSET_OF]` edge with no `source` property ✓.
- Independent-graceful between Header and Superset edges ✓.
- BIBLE §22 updated: "Phase A implemented" paragraph + Deferred list now "element/set bulk import" ✓.
- Blast radius = `install.js` `pass_communityReferences` + post-derive block + BIBLE §22 (2 files, +94/−23) ✓. No new files, no manifest change, no UI change.

## Things tests can't catch (reviewer audit)
- **`:Superset` label SET correctness depends on `buildImportCypher` having created the node first.** Ordering verified at `:1080→1082`: materialize → MATCH-by-uuid → SET. If the underlying MERGE were silently broken, the SET would be a no-op (no error, but no label). The structural sentinel cannot prove the label is actually present on the foreign event. **Smoke S1's Cypher (`MATCH (n {uuid:'39999:<curator>:nostr-relay-superset'}) RETURN labels(n)`) is the authoritative check** — must include `:Superset`. Echoes the #10 `pubkey` archaeology lesson: trust the smoke.
- **Cross-curator `IS_A_SUPERSET_OF` interaction with normalization.** ADR 0008's analysis (prune-superset-edges non-firing by construction; Rule 5 audit deliberately *surfaces* in smoke, not preempt) stands. Smoke must explicitly run Rule-5 audit and either record benign or apply the documented in-line `source`/non-local-TA exemption.
- **Inline-template tweak** (`'#d': [\`${dTag}-superset\`]` instead of `[supersetDTag]`) — candidly documented in the commit as a Tester-anchor accommodation. Reviewer assessment: not a spec deviation (the value computed is identical to `supersetDTag` defined a line above); makes the deterministic resolution self-evident at the filter site, which is arguably an improvement. Accepted.
- No secrets, no debug cruft, no commented-out code, no concurrency surface.

## Findings
### Blocking
None.

### Non-blocking (binding-on-smoke)
1. **Sharpen smoke S1's label check.** Cypher `MATCH (n:NostrEvent {uuid:'39999:<curatorPk>:nostr-relay-superset'}) RETURN labels(n)` must include `:Superset` (alongside `:NostrEvent:ListItem`). Without it, `(:Superset)-[:IS_A_SUPERSET_OF]->(:Superset)` traversals don't include the foreign node and the reachability promise of #11 is broken.
2. **Sharpen smoke S1's edge check.** Cypher `MATCH (a:Superset {uuid:'39999:<localTA>:nostr-relay-superset'})-[:IS_A_SUPERSET_OF]->(b:Superset {uuid:'39999:<curatorPk>:nostr-relay-superset'}) RETURN count(*)` must = 1. Matching on `:Superset` on both endpoints exercises both T2 (label SET) and T3 (MERGE) end-to-end.
3. **S5 (Rule-5 audit interaction) is binding.** Per ADR 0008, the smoke MUST explicitly run whatever audit enforces Rule 5 and decide inline (benign / exemption needed). Don't ship past staging without this verified.

## Verdict
**PASS (code/ADR/scope).** No blocking issues; minimal, ADR-conformant, no regression; the Rev-2 graceful/idempotent pattern is preserved per-edge. Behavioral acceptance gate = the **Reviewer-required cycle-local smoke S1–S5** (sharpened per findings #1–#3 above), which is the explicitly-authorized immediate next step. AC-1/AC-2 not "proven" until that smoke is observed. Same posture as #10's pre-smoke verdict (which #10's smoke promptly caught a real defect under — the structural sentinel + archaeology was insufficient there; the discipline holds here).
