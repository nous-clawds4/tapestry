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

## Verdict (initial — PASS, code/ADR/scope, pre-smoke)
**PASS (code/ADR/scope).** No blocking issues; minimal, ADR-conformant, no regression; the Rev-2 graceful/idempotent pattern is preserved per-edge. Behavioral acceptance gate = the **Reviewer-required cycle-local smoke S1–S5** (sharpened per findings #1–#3 above), which is the explicitly-authorized immediate next step. AC-1/AC-2 not "proven" until that smoke is observed. Same posture as #10's pre-smoke verdict (which #10's smoke promptly caught a real defect under — the structural sentinel + archaeology was insufficient there; the discipline holds here).

---

## Re-review (cycle-local smoke, 2026-05-19) — PASS confirmed end-to-end

**Pre-check:** curator Superset `39999:919ba08a…:nostr-relay-superset` (event `e54d96c7be02…`) confirmed live on `wss://dcosl.brainstorm.world` — the Story-#9 export from prod did publish the full Concept-Graph-rooted set including the Superset.

**Sharpened evidence (every Reviewer-required check confirmed):**

| Smoke | Cypher / action | Result | Verdict |
|---|---|---|---|
| **S1a** | `MATCH (n:NostrEvent {uuid:'39999:919ba08a…:nostr-relay-superset'}) RETURN labels(n)` | `['NostrEvent','ListItem','Superset']` | **PASS** — explicit `SET n:Superset` landed (label is in the set alongside kindToLabel's `:ListItem`) |
| **S1b** | `MATCH (a:Superset {uuid:'…<localTA>…'})-[r:IS_A_SUPERSET_OF]->(b:Superset {uuid:'…<curator>…'}) RETURN count(r)` | `1` | **PASS** — canonical edge with both endpoints matched as `:Superset` by uuid; T2 + T3 end-to-end |
| **S1c** | local Header → `IS_THE_CONCEPT_FOR` → `:Superset` → `IS_A_SUPERSET_OF` → `comm` | community Superset uuid appears (plus the local concept's own internal sets — expected) | **PASS** — class-thread reachability promise |
| **S2** | graceful Superset miss path | sentinels + independent-graceful refactor (R1, post-derive try/catch) structurally prove it; natural inline test absent (curator IS on dcosl) — documented out of scope | **PASS (structural)** |
| **S3** | reinstall → re-query S1b + node count | edge=1, node=1 (no dup) | **PASS** |
| **S4** | community Superset `HAS_ELEMENT` count | `0` | **PASS** — honest invariant: no bulk element import; structural bookmark only |
| **S5** | Rule-5 audit interaction | **No programmatic Rule-5 audit exists on the server** (BIBLE §10 documents it; the actual enforcement lives in `tapestry-cli` per BIBLE §3 — separate repo). Cross-curator `IS_A_SUPERSET_OF` is therefore **benign on the server side**. If `tapestry-cli`'s `tapestry normalize check-supersets`-style commands are later run against a Neo4j containing foreign Supersets, that's where the interaction would matter — out of scope for this server-side smoke. **Surfaced + documented; no exemption needed for the server.** | **PASS (surfaced + benign)** |

**`npm test` re-run:** Overall PASS (community-reference-superset-link 4/4 + all 9 prior suites + config green).

### Final verdict
**PASS — code/ADR/scope AND behavioral.** Story #11 / ADR 0008 Phase A is verified end-to-end on a real consumer instance (local TA `e00ed090…` ≠ curator `919ba08a…`). The cross-curator `(:Superset)-[:IS_A_SUPERSET_OF]->(:Superset)` edge is real, labelled correctly on both endpoints, idempotent on reinstall, the honest invariant (no element pull) holds, and Rule-5 is candidly benign on the server. Ready for the deploy chain (cycle-staging → cycle-prod, each gated).
