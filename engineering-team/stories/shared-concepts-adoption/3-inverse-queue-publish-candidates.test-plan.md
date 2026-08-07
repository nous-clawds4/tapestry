# Test Plan: Story 3 — Inverse queue (publish candidates)

**Story:** `engineering-team/stories/shared-concepts-adoption/3-inverse-queue-publish-candidates.md`
**ADR:** `engineering-team/decisions/shared-concepts-adoption/0003-inverse-queue-publish-candidates.md`
**Date:** 2026-08-06
**Suite:** `test/inverse-queue-publish-candidates.test.js` (registered in `test/test.js`, the standard five-touch)

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| AC-1 population (no-b ∧ cross-author usage, sorted) | `U2`, `U3`, `U5`, `U6` + `H1` | unit + live |
| AC-2 evidence (filings vs affiliations, distinguishable) | `U4` + `H1` | unit + live |
| AC-3 accept (self-declare; leaves immediately) | `H2` (removal + self-b stamped) | live |
| AC-4 decline (sentinel; leaves; stays gone) | `H3` (removal + deferred-in-use) + `U5` (deferred never a candidate) | live + unit |
| AC-5 deferred-but-in-use reveal | `U5` (the split) + `S2` (the collapsed-line copy) + `H3`/`H4` (round-trip incl. the sentinel-stripping un-defer) | unit + structural + live |
| AC-6 placement (one page, F1 view unchanged) | `S2` (three-view control) + `S3` (no new route) + `H5` (F1 arrays intact, unpolluted) | structural + live |
| AC-7 nothing auto-acts / empty state | endpoint read-only by construction (S1's module gains no write path); empty-state copy at review-phase manual walk | structural |
| AC-8 gating | both actions are the shipped gated endpoints (their own suites pin the gates); the view rides the public GET (`H1` host fetch) | inherited + live |
| AC-9 gates | the suite in `npm test`; meta-suites + lint green after registration | — |

## Edge cases

- [x] The instance's own filings/wirings are never evidence (`U2`, `U3` — cross-author-only on both kinds).
- [x] bState routing exhaustive: real excluded even with usage; deferred+usage → reveal only; deferred+quiet → nowhere (`U5`).
- [x] Both-evidence counting distinguishable and correct (`U4`).
- [x] Empty inputs (`U1`).
- [x] Stack down → every H row SKIPs.

## Test infrastructure

- The F1 suite's idioms carried forward: docker-exec loopback writes, host-fetch reads, bounded settle-polls with self-describing predicates, and the **`nextStamp` monotonic-stamp discipline on every fixture write** (OPEN.md #144 — adopted here from day one).
- Fixtures (stable d-tags, teardown republishes bare): two TA headers (`publish-candidate-fixture-f2a/b`), a foreign z-carrier and a foreign b-carrier (F1's non-secret throwaway key; the b-carrier is a kind-39998 foreign header carrying `["b", <my coord>, "pointer"]`).
- No firmware precondition; no Playwright row (the view is fetch+render over the server assembly; actions are the shipped endpoints, H-covered; review-phase manual walk covers the control/reveal interactions).

## How to run

```
node test/inverse-queue-publish-candidates.test.js
```

Full gate: `npm test`.

## Verification

The suite fails with current code for the right reasons. Confirmed 2026-08-06 at commit `dd2b5d88` (stack up):

```
inverse-queue-publish-candidates: 2 passed, 14 failed, 0 skipped
  — U1–U7 fail: "computePublishCandidates must be exported from src/lib/adoptionQueue.js (ADR 0003)"
  — S1, S2, S4 fail: endpoint keys / UI seams / action-helper extraction absent
  — H1–H4 fail: "the response must carry publishCandidates[] and deferredInUse[] … got keys
     success,nominations,declined" — the additive-key gap named exactly
  — Passing by design (regression guards, pre AND post): S3 (no new route), H5 (F1's arrays intact)
```
