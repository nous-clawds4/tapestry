# Review: Story 1 — Entrypoint memory override

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-28
**Diff:** `git diff aa2ae2b3...02878a18` (impl `c58bc348`, merged PR #578), branch
`fix/neo4j-sizing-override` → staging

## Quality gates (run by reviewer, not trusted)

- [x] Scoped gate (story's Type-block command) — **TOTAL_FAIL=0**: `neo4j-sizing-override` 9/9
      + guard `entrypoint-template-rendering` 11/11.
- [x] `bash scripts/harness-lint.sh` — clean at review commit.
- [x] Pre-implementation red/green shape verified: P1–P3 + U2 + S3 green (pins of today's
      behavior), U1/U3/S1/S2 red → all green post-implementation.
- [ ] Full `npm test` — deferred to the imminent book close per workflows/light-profile.md.

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 unset/empty ⇒ formula unchanged, byte-identical | ✅ | P1 (staging's live 8038/8038/4019 reproduced **from the real script block**), P2/P3 (both reserve branches + the 24000MB threshold), U2 (empty≡unset), S3 (writer lines untouched) — **and live**: staging's recreated container regenerated exactly 8038/8038/4019 (see AC-5) |
| AC-2 override verbatim; per-var independence | ✅ | U1 (all three verbatim), U3 (heap-only: cache/tx stay formula-derived); independence documented in the script comment |
| AC-3 compose pass-throughs; `set -e`-safe note | ✅ | S2 (three `${VAR:-}` lines), S1 (placement after formula / before writer; no bare `[ … ] && …`); both entrypoint logs behave (local prints the note once, staging zero times) |
| AC-4 local durable profile | ✅ | `.env` (untracked) carries 2048/1024/1024; rebuilt+recreated container logged "override active", config reads 2048/2048/1024/1024, Neo4j RUNNING, graph API up, JVM RSS 2.7GB (was 7.8GB); `tapestry-neo4j` volume untouched (principle 4) |
| AC-5 droplet no-change proof | ✅ | Post-#578 deploy recreated staging's container on the new entrypoint: live config **exactly 8038m/8038m/8038m/4019m**, `override active` count **0**, formula log shows the unchanged computation (Reserved 12000MB), Neo4j RUNNING, site 200 |
| AC-6 entrypoint guard green | ✅ | `entrypoint-template-rendering` 11/11 in the scoped gate |

- [x] No criterion dropped; no behavior beyond the story.

## Design-note adherence (Gate-A classification ratified)
- [x] **Bug, no ADR — correct.** Single-repo config path; no irreversibility trigger (no wire
      format, no dependency, no cross-repo value — the env names live in this repo's compose +
      entrypoint only). The operator-rejected alternative (store-size-driven) is recorded in the
      story and OPEN.md row 186.
- [x] Blast radius held: entrypoint + compose + suite + registration + untracked `.env` +
      row 186 text. Deploy workflows' compose `sed` (ports line) verified non-interacting.

## Things tests can't catch
- [x] `set -e` safety proven live twice: both containers (local with override, staging without)
      completed their entrypoints and reached healthy supervisord state.
- [x] The compose empty-string injection path is the *real* droplet path and was exercised for
      real on staging — not just simulated by U2.
- [x] Rollout ordering: droplets pick the change up passively at each next deploy; no manual
      droplet action exists to forget.

## Findings

### Blocking
None.

### Non-blocking
1. **prod / sandbox droplets** — they receive the same inert change at their next routine
   deploy; no verification needed beyond what staging proved (identical code path, env unset).
   Noted for the book audit's carry-forward: verify opportunistically after prod's next deploy.

### Harness friction
1. None this story.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: every acceptance-frame bullet of the `neo4j-sizing` book is now met
      except the ledger flip (frame bullet 6), which belongs to the close itself. Book looks
      complete; `/close-book` to be **offered** at Gate B.
