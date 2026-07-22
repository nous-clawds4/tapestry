# Completion Report — relationship-primitives

**Date:** 2026-07-22
**Book:** `engineering-team/audits/relationship-primitives/book.md` (acceptance frame — 9 bullets)
**Stories:** #1 `1-relationship-add-delete-primitives` (Done), #2 `2-read-only-deployment-probe` (Done)
**Staging merge:** PR [#413](https://github.com/nous-clawds4/tapestry/pull/413), merge commit `8e9888b9`, merged 2026-07-22T06:42:42Z; deploy run `29897635326` ✓ 1m30s.

Evidence per acceptance-frame bullet. Raw sources: the decision journal (`journal.md`, evidence entries 2026-07-22T06:45:53Z and prior), test logs in the session scratchpad (`gate4-run3.log`, `gate4-s2-run.log`), committed test suites, reviews, and the live instances.

## Bullet-by-bullet

**1. Two operations — add and delete — uuid-identified, whitelist-validated, reachable by plain curl from the local/Docker host per the `/api/normalize` convention.**
✅ `POST /api/normalize/add-relationship` and `POST /api/normalize/delete-relationship` (`src/api/normalize/relationships.js`, registered in `registerNormalizeRoutes`; impl commit `impl: relationship-add-delete-primitives (story #1, ADR 0001)`). Container-loopback curl exercised across the H-class matrix (H1–H6, four independent green runs) and in the local smoke (validation answer `{"success":false,"error":"Missing required field: fromUuid"}` via `docker exec … curl`, journal 06:45:53Z). Post-security note honored: local reachability via `req.localTrusted`.

**2. Each operation carries an explicit owner gate — not the mount's default-deny alone; authenticated non-owner receives 403.**
✅ In-handler wipe-pattern gate ordered before any Cypher (`gateAndValidate`, relationships.js; ADR 0001 decision; Reviewer verified gate order at review §ADR-adherence). Test U3: authenticated non-owner → 403 from both operations (passing in all green runs). Unauthenticated remote POST → 401 by middleware (verified locally and on staging, journal 06:45:53Z).

**3. Strfry-free: no event written, re-signed, published, no json regeneration, no derivation — automated test asserts no event is written.**
✅ Twice-proven per operation set: structurally — S1 pins `relationships.js`'s require list to exactly three modules and S2 bans alias literals; the probe's S1′ requires an *empty* import list — and behaviorally — H8 (story #1) and H4 (story #2) assert strfry scan-count equality across full operation cycles. All green in the final runs (`gate4-run3.log`: 23/23; `gate4-s2-run.log`: 9/9). The two environmental drift hits en route were control-proven external (journal 2026-07-21T18:30:10Z: +6 events in 60s with the feature untouched) and resolved under the test plans' documented quiet-window remedy.

**4. Add idempotent (MERGE; created vs already-existed); delete targeted (single named edge; deleted vs not-found).**
✅ Tests U9/U10 (response discrimination from pinned driver rows) and H1–H4 live (edge count exactly 1 after double-add; decoy edges in reverse direction and other types survive targeted delete). Reviewer and Gate-5 judge independently reproduced.

**5. Loud failures, never silent no-ops: nonexistent node and non-whitelisted relType name the failed precondition.**
✅ U5–U7 (missing/empty fields; unknown type; firmware-aliased-but-unwhitelisted type in both spellings), U11 + H5 (404 naming the exact missing uuid(s)), H6 (400 with the `allowed` list). `HAS_SUBGOAL` explicitly rejected (frame refresh honored).

**6. Relationship-type names resolve through the firmware alias layer — no hardcoded literals.**
✅ Whitelist built via `firmware.relAlias('CLASS_THREAD_TERMINATION'/'CLASS_THREAD_PROPAGATION')` (ADR 0001 decision 2); S2 asserts no whitelisted Neo4j alias appears as a raw string literal in the module. Judged at Gates 2/3/5.

**7. Automated tests cover the eight-case floor plus the no-strfry-write assertion and the authenticated-non-owner 403.**
✅ 23-test suite (U1–U11, S1–S4, H1–H8) mapping every AC and floor case (Gate-3 judge verified the map item-by-item; Gate-5 judge re-verified). Plus the probe's 9-test suite for story #2. Both registered in the runner's live gating chain.

**8. Firmware-install overwrite hazard documented where the operator will meet it; install behavior untouched.**
✅ Module header documentation + one-line `note` on every graph-changing success response (ADR 0001; Reviewer verified at file:line). `src/firmware/install.js` byte-untouched across the entire book (Reviewer + judges verified the range).

**9. Live on `staging.brainstorm.world` with the staging smoke passing; evidence (a) deployment proof distinguishable from a missing route; (b) functional evidence against the local stack; (c) safe-to-merge output journaled before the merge.**
✅ **Smoke:** Tier 1 stable after 3×2s polls; Tier 2 all 200; Tier 5 clean (the documented expected 504 on the known heavy-graph pubkey per SMOKE_TEST.md).
✅ **(a)** Captured verbatim (journal 06:45:53Z): `GET /api/normalize/relationship-primitives` → **HTTP 200** `application/json` `{"success":true,"surface":"relationship-primitives","operations":["add-relationship","delete-relationship"]}`; `GET /api/normalize/relationship-primitives-missing-sibling` → **HTTP 404** `text/html` `Cannot GET …` — a response pair distinguishable from a missing route, per the operator-ruled fix-forward story #2. The auth-class answer (`POST` → 401) additionally proves the mutation gate live. No add/delete was ever invoked against a deployed instance — staging exercise read-only throughout.
✅ **(b)** Full functional matrix ran live against the local stack in four independent green runs (Implementer, Director Gate-4, Reviewer, Gate-5 judge), logs cited in the journal.
✅ **(c)** `scripts/check-safe-to-merge.sh https://staging.brainstorm.world` → `verdict=safe`, exit 0, full raw JSON journaled (06:45:53Z), merge executed 15 seconds later.

## Gate record

10 blinded-judge verdicts: 9 APPROVE, 1 APPROVE voided on the judge's self-reported blinding breach and re-judged clean by a fresh judge; 0 KICK_BACKs; Gate 4 (mechanical) passed twice on the Director's own runs. Both reviews PASS with the Status flips authored by the Reviewer in the review commits.
