# Review: Stories #8 & #9 — Community-reference stub + concept export

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-18
**Diff:** `git diff 24460033..c1b96499` (impl commit `c1b96499`)
**Covers:** Story #8 (`engineering-team/stories/8-community-reference-nostr-relay-stub.md`, ADR 0005) and Story #9 (`engineering-team/stories/9-publish-export-a-concept.md`, ADR 0004) — implemented in one coupled diff.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. TE1/TE2/TI1/TI2 green, RE1/RI1/RI2 scope guards green, all 6 pre-existing suites green, Overall PASS. Re-run by reviewer.
- [ ] `npm run test:playwright` — n/a (no browser spec; per test plans, behavior is smoke-gated).
- [x] _Lint / typecheck / build — not configured; skipped per role._

## Spec adherence

| AC | Status | Note |
|---|---|---|
| #8 AC-1 fetch+import distinct node | structural ✓ / behavioral ⧗ | TI1/TI2 pin it; round-trip is smoke M1 — **not run** |
| #8 AC-2 placeholder edge | structural ✓ / behavioral ⧗ | post-derive MERGE present; smoke M1 — **not run** |
| #8 AC-3 graceful | ✓ | per-concept try/catch, miss logs+continues, never throws — code-correct |
| #8 AC-4 knownGoodEventId | ✓ implemented / dormant | mismatch→skip implemented; shipped manifest omits the field (ADR-optional) — path unexercised |
| #8 AC-5 idempotent | ✓ | MERGE ⇒ idempotent |
| #9 AC-1 full export | structural ✓ / behavioral ⧗ | endpoint+UI loop; smoke N1 — **not run** |
| #9 AC-2 own-authored only | ✓ | `WHERE n.pubkey = $taPubkey` — provenance filter correct |
| #9 AC-3 graphContext stripped | ✓ | events read from strfry (portable signed form); sound |
| #9 AC-4 idempotent | ✓ | replaceable events |
| #9 AC-5 partial failure no abort | ✓ | UI loop per-event try/catch + tally |
| #9 AC-6 owner-only | ✓ | `requireOwner` on the route |

No criterion silently dropped; no behavior beyond the stories.

## ADR adherence

- ADR 0004 Option A: server enumerates own-authored set; UI reuses `publishEverywhere`; no server-side external publisher. ✓ (RE1 green; `nostrPublish.js`/`PUBLISH_RELAYS` untouched.)
- ADR 0005 Option A: manifest field + install sub-pass (fetch `/api/relay/external` → publish `/api/strfry/publish` no re-sign → Neo4j-only `IMPORT` MERGE); idempotent; graceful; before Pass-3 derive. ✓
- **Flagged ADR-prose deviation (non-blocking, correct):** ADR 0005's Implementation notes lump the `IMPORT` MERGE into the pre-derive sub-pass. The implementation correctly **splits** it — fetch/publish pre-derive, MERGE post-derive ([src/firmware/install.js:1135](src/firmware/install.js)) — because the community node does not exist until Pass-3 derive. This honors the ADR's stated *intent* ("publish before derive so it becomes a node; then MERGE") and is the only correct sequencing. Recommend annotating ADR 0005 so the artifact matches reality.
- No new dependencies. Concept handles in `kind:pubkey:slug` form. Firmware reinstall correctly called out (ADR 0005 Consequences) — see findings re: not yet performed.

## Things tests can't catch

- **No secrets.** The committed `919ba08a…` is a public nostr pubkey (brainstorm.world TA), not a secret. OK.
- **Logging/style:** new install.js logging matches the file's existing emoji/`console.log` house style; `exportSet.js` `console.error` matches `concept-graph/index.js`. Not debug cruft.
- **Shell exec:** `exportSet.js` `strfryScan` uses `exec(\`strfry scan '${JSON.stringify(filter)...}'\`)` — identical to the established pattern in `io.js`/`eventSync.js`/`admin/index.js`; `filter` is built from Neo4j-derived hex ids, `handle` is a parameterized Cypher param (never shelled). No new injection vector. Acceptable.
- No commented-out code, no dead code, no race conditions (sequential install + sequential export loop).

## Findings

### Blocking

1. **Authoritative behavioral gate not executed.** The approved test plans state the local/staging smoke is **Reviewer-required, not optional** (the structural sentinels deliberately cannot prove the relay/Neo4j round-trip). It has not been run. Per role ("approve when in doubt → don't"), I cannot PASS the behavioral ACs (#8 AC-1/AC-2, #9 AC-1) on structural evidence alone. **Asked:** run `cycle-local` to evidence export E2E (N1/N2), import **graceful** (M2), and re-install **idempotency** (M4) before this proceeds.
2. **[src/firmware/install.js:1141](src/firmware/install.js)** — the post-derive step logs `✅ ${slug}: IMPORT → ${to}` whenever the Cypher call succeeds, but `MATCH (a),(b) MERGE …` creates **no edge and errors not** when the community node `b` is absent (curator hasn't published / derive didn't pick up the foreign 39998). This yields a **false-positive "✅ IMPORT" in smoke output** — directly undermining the M1 evidence the Reviewer must rely on. **Asked (small, Implementer):** return/inspect a created-count (e.g. `… MERGE (a)-[:IMPORT]->(b) RETURN count(*)`) and log success only when the edge was actually created; otherwise log a distinct "community node not present yet — IMPORT deferred".

### Non-blocking

1. **Export↔import chicken-and-egg (track explicitly).** Import-positive M1/M3 is structurally unprovable locally until the reference curator (brainstorm.world TA `919ba08a…`) has itself run the new export. Not an implementation defect — but #8 AC-1/AC-2 must NOT be marked proven until a staging run (where brainstorm.world has exported) or a deliberate fixture (hand-publish a 39998 under a test key + temp `communityReference`). Recommend recording as a staging acceptance item on Story #8.
2. **#8 AC-4 dormant.** `knownGoodEventId` handling is implemented but the shipped manifest omits the field, so the mismatch path is unexercised by default config (ADR-optional). Acceptable; note for the smoke that AC-4 needs a deliberate fixture to exercise.
3. **ADR 0005 prose** should be annotated to reflect the (correct) pre/post-derive split — see ADR adherence.

## Verdict

**CHANGES_REQUESTED.**

The code is clean, in-scope, ADR-conformant, and the full `npm test` gate is green — there are no architecture/spec/scope defects. But (1) the approved test plans make the behavioral smoke a **required** gate and it has not been run, and (2) the post-derive success log is misleading in exactly the output that smoke relies on. Both asks are small and precise. Route: fix finding #2 via `/implement-feature` (one-function change), run the finding #1 smoke (`cycle-local`), then re-review — no re-architecture, no scope change.

---

## Re-review (2026-05-18) — after ADR 0004/0005 Revision 1 + fixes

**Diff re-audited:** ADR-revision commit `d37f1587` + re-implementation (parameterized `publishEverywhere`, dcosl-only concept publish, `relayHints` → `["wss://dcosl.brainstorm.world"]`, install.js IMPORT-log fix) + Tester consistency notes.

**Quality gate (re-run by reviewer):** `npm test` → **Overall PASS**. All 7 suites + config green; TE1/RE1 still green under the parameterized `publishEverywhere` (primitive + `PUBLISH_RELAYS` still present; export still calls it; no server-side `SimplePool.publish`), TI1 still green (`relayHints` non-empty `ws(s)://` array). `manifest.json` valid JSON.

**Blocking #2 (install.js misleading IMPORT log) — RESOLVED.** [src/firmware/install.js:1144](src/firmware/install.js) now does a `count(b)` presence check before MERGE; logs `✅ IMPORT →` only when the community node exists, else `⏭️ … IMPORT deferred (graceful)`. Smoke output is now trustworthy as M1 evidence.

**ADR adherence (revised):** matches ADR 0004 Rev 1 (relay-parameterized `publishEverywhere`, default arg unchanged ⇒ profile/follow/mute callers byte-identical; concept-export passes the dcosl set) and ADR 0005 Rev 1 (`relayHints` aligned to `wss://dcosl.brainstorm.world`). Export ⇄ import relay sets are now consistent. No scope creep; no new deps.

**Blocking #1 (Reviewer-required behavioral smoke) — code-cleared, behavior gated.** All *code* blockers are resolved; the authoritative behavioral proof is now the **explicitly-authorized stepwise deploy**: `cycle-local` (export→import round-trip on dcosl, local fixture) → `cycle-staging` → `cycle-prod`, then run "Publish concept" for `nostr-relay` on brainstorm.world (TA `919ba08a…`, dcosl-only) so the shipped pointer resolves for real. Per the harness, **PASS ⇒ deploy chain**; the smoke executes there and remains a hard precondition to prod.

**Non-blocking carried forward:** export↔import chicken-and-egg now closes *by plan* at the prod export step (no longer an open risk, just a sequenced action); AC-4 (`knownGoodEventId`) still dormant by default config — exercise via fixture in smoke; ADR pre/post-derive split now documented (Rev 1). 

### Verdict (Re-review)
**PASS (code/ADR/scope).** Behavioral acceptance gate = the stepwise `cycle-local → cycle-staging → cycle-prod` smoke that is the immediate next planned step. #8 AC-1/AC-2 and #9 AC-1 are **not** to be marked proven until the export→import round-trip is observed on dcosl (cycle-local first, then the real prod-curator export). No further code changes required to proceed.

---

## Re-review 2 (2026-05-19) — M1 defect found in prod-curator smoke, fixed (ADR 0005 Rev 2)

**What happened:** Owner published the curator `nostr-relay` Header to `wss://dcosl.brainstorm.world` (prod export, confirmed on dcosl). The local-consumer M1 smoke (TA `e00ed090…` ≠ curator) then **caught a real defect**: fetch+publish worked but the edge never formed — root cause: the "Pass-3 derive materializes the strfry event" assumption was false (`tapestry-derive` only computes tapestryJSON for nodes already in Neo4j). This is exactly the class of bug the Reviewer-required behavioral gate exists to catch; it validates having insisted on it.

**Fix audited (ADR 0005 Rev 2):** `pass_communityReferences` now explicitly materializes the fetched event via `buildImportCypher`/`executeCypher` (the real strfry→Neo4j single-event primitive; precedent `src/api/io.js`). Edge renamed `IMPORT`→`REFERENCES` with `source:'firmware-community'` as the accepted-collision mitigation vs eventSync's `(:NostrEventTag)-[:REFERENCES]->(:NostrEvent)`.

**Quality gate (reviewer re-run):** `npm test` → **Overall PASS** (all 7 suites + config). TI2 strengthened — now pins `buildImportCypher|executeCypher` AND a `[:REFERENCES]` MERGE, so the materialization-defect class is structurally caught next time (it previously passed while behaviour was broken). RI1 generalized (label-agnostic). RI2/RE1 unaffected.

**M1 behavioral proof — CLOSED (authoritative):** local consumer reinstall produced `✅ REFERENCES {source:firmware-community} → 39998:919ba08a…:nostr-relay`; concept-graph shows `REFERENCES` present / `IMPORT` gone, target = distinct foreign `[NostrEvent,ListHeader]` node; direct Cypher confirms `r.source='firmware-community'`, target kind 39998. Graceful path + idempotency (MERGE) unaffected.

**Collision-mitigation contract (binding on future consumers):** any traversal of concept-level `REFERENCES` MUST filter by endpoint labels (`ListHeader→ListHeader`) and/or `r.source IS NOT NULL`. A bare `MATCH ()-[:REFERENCES]->()` is a defect (would also match high-volume tag-level edges).

### Verdict (Re-review 2)
**PASS.** M1 closed on a real consumer instance; defect fixed; ADR amended; sentinels strengthened; full gate green. Ships as a follow-up `feat → staging → main` PR (feature already on prod via #156/#157). The same stepwise smoke applies; staging M1 can be re-proven there post-deploy if desired (curator header already live on dcosl ⇒ smoke is repeatable).
