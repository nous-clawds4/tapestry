# Test Plan: Story 2 — Adoption-candidates queue

**Story:** `engineering-team/stories/shared-concepts-adoption/2-adoption-candidates-queue.md`
**ADR:** `engineering-team/decisions/shared-concepts-adoption/0002-adoption-candidates-queue.md`
**Date:** 2026-08-06
**Suite:** `test/adoption-candidates-queue.test.js` (registered in `test/test.js`, the standard five-touch)

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| AC-1 population (S3 base + three exclusions, sorted) | `U1`–`U6` (each exclusion independently; self-filed rule; supersede chains) + `H1` (live base) + `H4` (wired exclusion e2e) + `H2` (declined exclusion e2e) | unit + live |
| AC-2 evidence (counts + usedByMe) | `U3` + `H1` | unit + live |
| AC-3 adopt (wire a twin) | `H4` (b-append on a TA twin removes the nomination); primitive semantics themselves are F5's suite | live |
| AC-4 recognize (registry) | `U5` (a-tag AND event-id matching; malformed tolerance) — **U-only, gap recorded below** | unit |
| AC-5 decline (dated, supersedable, Declined view, reversal) | `U6`, `U7` + `H2`, `H3` | unit + live |
| AC-6 nothing auto-acts / empty state | structural-by-design (the queue GET is read-only — `S1`'s module carries no write path; empty-state copy is a review-phase manual check) + `H5` (empty world) | structural + live |
| AC-7 gating (public read, owner-only actions) | `H1` (unauthenticated host GET 200) + `H6` (remote producer 401 — regression-class; unknown-word refusal) + `S2` (gate before mint, structure-bounded) | live + structural |
| AC-8 gates | the suite itself in `npm test`; harness-lint unchanged | — |

## Edge cases

- [x] Self-filed-only usage never nominates (`U2` — the PR #494 rule).
- [x] Registry match by a-tag **or** event id; malformed registry JSON tolerated (`U5`).
- [x] Disposition supersede chains both directions + **equal-timestamp ties resolve toward visibility** (`U6` — wrongly-shown is benign, wrongly-hidden is not; pinned as the core's contract).
- [x] Zero-usage and zero-input worlds (`U1`, `U2`, `H5`).
- [x] Unknown disposition words refused with a named error (`H6`).
- [x] Stack down → every H row SKIPs with a recorded count.

## Test infrastructure

- Framework: the house micro-runner; live reads via host fetch, privileged writes via docker-exec loopback (`localTrusted`).
- Fixtures: all replaceable with **stable d-tags** (OPEN.md #128) — a **client-signed foreign header** (`adoption-queue-fixture-f1`, deliberately non-secret throwaway key via `nostr-tools`, the brain-first R2 precedent), a TA z-carrier (`adoption-carrier-fixture-f1`), a TA twin (`adoption-twin-fixture-f1`). Teardown republishes all three bare.
- **Accepted bounded residue, named:** ledger records are append-only by design (nonce d-tags) — each full run leaves one `declined` + one `requeued` dated record whose names carry the fixture slug; they exclude nothing real (the bare-torn fixture has zero usage, so it leaves the S3 base entirely) and are sweepable by name.
- **Recorded gap:** AC-4's registry-recognition path is **U-covered only**. An H row would mint a *permanent* registry element per run (`create-element` is append-only with graph wiring and no teardown), which #128 forbids; the registry *scan* is still exercised live by every `queue()` call (empty-tolerant). Revisit when F3 brings managed registry fixtures.
- No firmware precondition (the ledger concept is runtime-created — `S3` pins it out of firmware/ forever). No Playwright row (the page is fetch+render over the server-assembled queue; interactions are the F5 panel patterns; review-phase manual walk).

## How to run

```
node test/adoption-candidates-queue.test.js
```

Full gate: `npm test`.

## Verification

The suite fails with current code for the right reasons. Confirmed 2026-08-06 at commit `6bededd3` (stack up):

```
adoption-candidates-queue: 1 passed, 18 failed, 0 skipped
  — U1–U8 fail: "precondition: src/lib/adoptionQueue.js is missing"
  — S1, S2, S4, S5 fail: adoption module / producer / UI seams / shared strfryScan export absent
  — H1, H4, H5 fail: "GET /api/adoption-queue failed (404)"
  — H2, H3, H6(bad-word half) fail: "Cannot POST /api/normalize/adoption-disposition"
  — Passing by design: S3 (ledger concept never firmware-seeded — regression guard)
  — Fixture machinery proved live pre-implementation: the client-signed foreign publish and the
    TA carrier publish both succeeded before the 404s (H1's first two asserts green)
```
