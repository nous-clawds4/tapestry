# Test Plan: Story 11 — Community-reference Superset link (Phase A)

**Story:** `engineering-team/stories/11-community-reference-superset-link.md`
**ADR:** `engineering-team/decisions/0008-community-reference-superset-link.md`
**Date:** 2026-05-19

## Approach
Same precedent as #5/#6/#8/#10. Source/structural sentinels pin the spec-required code shape ADR 0008 specified. The behavioral round-trip — real install actually fetches the `-superset` event, materializes a foreign `:NostrEvent:ListItem:Superset`, MERGEs the canonical cross-curator `IS_A_SUPERSET_OF` between two `(:Superset)` nodes, behaves idempotently, graceful-skips when missing, and the **Rule-5 audit interaction** (z-tag references the curator's superset concept, not ours) — is **not** reproducible in the hand-rolled Node runner and is the **authoritative cycle-local smoke** (Reviewer-required). Story #10's cycle-local definitively vindicated this discipline (it caught the pubkey double-encode); same expectation here.

## Coverage map

| AC | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (fetch+materialize community Superset; canonical IS_A_SUPERSET_OF edge) | **T1** (fetch via `-superset` `#d` filter), **T2** (SET :Superset on the materialized foreign node), **T3** (post-derive [:IS_A_SUPERSET_OF] MERGE) — together pin the spec. Behavioral S1 = cycle-local | test/community-reference-superset-link.test.js | source + smoke |
| AC-2 (graceful: community Superset unreachable ⇒ install continues, no edge) | Symmetrical to the Rev-2 Header graceful pattern (T3 requires presence-check; R1 preserves the pattern). Behavioral S2 = cycle-local | test/community-reference-superset-link.test.js | source + smoke |
| AC-3 (idempotent re-install) | Deterministic a-tags + MERGE ⇒ idempotent by construction. Behavioral S3 = cycle-local | — | smoke |
| AC-4 (honest invariant — community element/set nodes NOT pulled local) | Out of scope by design; nothing in the sentinel exercises bulk element import. The smoke explicitly verifies element nodes do NOT appear local. | — | smoke |
| AC-5 (zero behavior change for non-traversers) | **R1** preserves the Rev-2 Header+REFERENCES contract; T1/T2/T3 are additions only | test/community-reference-superset-link.test.js | source (sentinel) |

T1/T2/T3 = FAIL pre-impl, PASS post. R1 = PASS pre AND post (regression guard on the Rev-2 Header materialization + REFERENCES MERGE).

## Edge cases
- [x] **No false-positive on existing upstream `IS_A_SUPERSET_OF` MERGEs.** T3 uses `lastIndexOf(':IS_A_SUPERSET_OF]')` and requires it to be AFTER `lastIndexOf(':REFERENCES]')` (the existing Rev-2 post-derive REFERENCES MERGE near the end of install.js). Pre-impl, all existing IS_A_SUPERSET_OF MERGEs are upstream (~`:470`, `:563`) — earlier than the REFERENCES MERGE (~`:1177`) — so T3 correctly FAILs pre-impl.
- [x] **No false-positive on local `:Superset` label SETs in other files.** T2 reads only `install.js`; local Supersets get the label via `src/api/normalize/index.js`, not install.js. install.js pre-impl has no `SET … :Superset`.
- [x] **No false-positive from existing `-superset` slug strings.** T1 anchors on the tag-filter literal shape (`"#d": […-superset…]`), not bare `-superset`. The existing slug literals like `superset-for-the-concept-of-…` and d-tag `${slug}-superset` strings are not inside `#d` filter arrays.
- [ ] **Cross-curator `IS_A_SUPERSET_OF` interaction with normalization (prune + Rule 5).** Not catchable in source — the **cycle-local smoke is the authoritative check** (per ADR 0008's stated stance: surface, don't preemptively engineer).

## Not covered (deferred to cycle-local smoke — authoritative, Reviewer-required)
Run on the local Docker stack (`:7778`):

**S1 — AC-1 (real materialization + canonical edge):** `POST /api/firmware/install`. Then:
- `docker exec tapestry strfry scan '{"kinds":[39999],"authors":["<curatorPk>"],"#d":["nostr-relay-superset"]}'` → assert exactly one event found (the curator's Superset on dcosl, post-#10).
- Cypher `MATCH (n:NostrEvent {uuid:'39999:<curatorPk>:nostr-relay-superset'}) RETURN labels(n)` → assert `:Superset` is in the labels (alongside `:NostrEvent:ListItem`).
- Cypher `MATCH (a:Superset {uuid:'39999:<localTA>:nostr-relay-superset'})-[r:IS_A_SUPERSET_OF]->(b:Superset {uuid:'39999:<curatorPk>:nostr-relay-superset'}) RETURN count(r)` → **= 1** (the canonical edge between two `(:Superset)` nodes — proves the label-SET is correct AND the MERGE landed).
- Cypher `MATCH (h:ListHeader {uuid:'39998:<localTA>:nostr-relay'})-[:IS_THE_CONCEPT_FOR]->(s:Superset)-[:IS_A_SUPERSET_OF]->(comm) RETURN comm.uuid` → confirms the class-thread traversal reaches the community Superset from the local concept Header (the reachability promise).

**S2 — AC-2 (graceful):** temporarily mismatch `communityReference.headerATag`'s `<dtag>` so the `-superset` fetch returns nothing (or point relayHints at an empty relay). Run install. Expect: log "community Superset … not found … skipped (graceful)"; no `IS_A_SUPERSET_OF` edge; local concept + existing REFERENCES edge unaffected; install completes.

**S3 — AC-3 (idempotent):** re-run firmware install. Expect: exactly one foreign Superset node, exactly one `IS_A_SUPERSET_OF` edge (no duplicates).

**S4 — AC-4 (honest invariant):** `MATCH (s:Superset {uuid:'39999:<curatorPk>:nostr-relay-superset'})-[:HAS_ELEMENT]->(e) RETURN count(e)` → expect 0 (community elements/sets are NOT materialized locally — the link is structural only; element pull is the deferred next stream).

**S5 — Rule-5 audit interaction (ADR 0008 stated to surface, not preempt):** run whatever audit/normalize check enforces Rule 5; record whether it flags the foreign Superset (z-tag references `39998:<curatorPk>:superset`, not the local TA's). If it flags, the in-line resolution (small audit exemption keyed on source / non-local-TA pubkey) is the Reviewer-authorized follow-up; if benign, document.

## Test infrastructure
- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps. Registered: `communityReferenceSupersetLink`.
- Asserts only against `src/firmware/install.js`. No Playwright (relay+firmware-install+Neo4j is smoke territory).

## How to run
```
npm test
```
Targeted: `node -e "require('./test/community-reference-superset-link.test.js').run()"`

## Verification
New tests fail on the pre-implementation tree (atop ADR commit `4dd08428`):

```
community-reference-superset-link suite:
  ✗ T1: pass_communityReferences fetches the -superset variant via /api/relay/external (AC-1, ADR 0008)
  ✗ T2: install.js explicitly SETs :Superset on the materialized community Superset node (AC-1, ADR 0008)
  ✗ T3: post-derive block MERGEs a canonical [:IS_A_SUPERSET_OF] edge after the existing :REFERENCES MERGE (AC-1, ADR 0008)
  ✓ R1: existing pass_communityReferences Header materialization + post-derive :REFERENCES MERGE preserved (regression guard)
community-reference-superset-link suite:         FAIL (1 passed, 3 failed)
Overall:                                         FAIL
```
(Filled from the actual run below.)
