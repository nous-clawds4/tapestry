# Build Audit: Harden and restrict an admin computation endpoint

**Book:** `engineering-team/audits/compute-endpoint-hardening/book.md`
**Date:** 2026-09-19
**Branch / commit range:** shipped via PR #684 (staging, merge `eb8e7e7f`) + PR #685 (production, merge `3eb38e8e`); backported to sandbox hosts on `feat/tags` (`e8ca6597`) and `feature-magic-carpet` (`ebb941b3`). Base `94fc855e`.
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high

> As-built record. Factual, source-linked. The endpoint and vulnerability class were held generic in-book per the disclosure discipline; now that the fix is live on all public hosts, this audit names them plainly.

## 1. What shipped

- **The `GET /api/personalized-pagerank` endpoint no longer executes attacker-controlled input as a shell command** — the client `pubkey` is validated (`^[0-9a-f]{64}$`) and `limit` as an integer, and the server-side program is invoked via `execFile` with an argument vector (no shell). Was an unauthenticated remote command injection. — `stories/compute-endpoint-hardening/1-harden-and-restrict-compute-endpoint.md`
- **The endpoint's GET now requires owner authentication** — `/personalized-pagerank` added to the auth middleware's `ownerOnlyGetEndpoints` (authed-non-owner → 403) and `protectedGetEndpoints` (unauth → 401); its owner-list enforcement was previously POST-only. — same story.
- **The dead `pagerank_deprecating` twin was removed** (loaded by nothing, same vulnerable shape). — same story.
- **A regression suite** proves a crafted parameter is rejected before any spawn, a valid one runs via an argv (not a shell string), and an unauthenticated GET is rejected. — same story.
- **Backported to both public sandbox hosts** — `tags.brainstorm.world` (`feat/tags`) and `magic-carpet.brainstorm.world` (`feature-magic-carpet`), each deployed and verified (unauth → 401).

## 2. Epics & stories rolled up

### Epic: `compute-endpoint-hardening`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 harden-and-restrict-compute-endpoint | validation + execFile + owner-auth gate + dead-twin removal + regression suite | Done | `reviews/compute-endpoint-hardening/1-harden-and-restrict-compute-endpoint.md` (PASS) |

## 3. As-built inventory (from the diff)
- **API behaviour:** `GET /api/personalized-pagerank` — validates inputs (400 on malformed), invokes `execFile(scriptPath, [pubkey, limit?])`, and is owner-gated (401 unauth / 403 non-owner). `src/api/algos/pagerank/commands/generateForApi.js`, `src/middleware/auth.js`.
- **Removed:** `src/api/export/pagerank_deprecating/` (index + two command modules).
- **Domain / data / contracts:** none. No concepts, handles, schema, firmware, event kinds.
- **Tests:** `test/harden-compute-endpoint.test.js` (registered in `test/registry.js`).

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | epic/story kickoff wording: "gate this endpoint **in-handler** (`isOwner \|\| localTrusted`)" | Gated via **data-only additions** to the auth middleware's existing GET-scoped owner-only lists; matching logic unchanged, no other route affected | interpretation | review non-blocking finding 1; story/epic wording reconciled in the review commit (`bb623178`) | none (same security outcome; still a targeted, single-route gate) | — |

**Undocumented work:** none. Every diff hunk traces to story #1.

## 5. Quality state at close
- Test gate: clean. `20260919T062140Z-22-64f4 — PASS, exit 0, 2856 passed, 0 failed, 522 skipped, 206/206` (isolated Node 22, `--network none`); the new suite `harden-compute-endpoint: 4 passed, 0 failed`. Re-certified over the final close tree (both books closed): `20260919T071410Z-22-fb6e — PASS, exit 0, 2856 passed, 0 failed, 522 skipped, 206/206`.
- Live verification: `GET /api/personalized-pagerank` unauth → 401 on all four public hosts (prod, staging, tags, magic-carpet).
- Exploitation review: operator log-checks on all four hosts found no evidence (retention-bounded).

## 6. Carry-forward register
- [ ] **log-and-exit unhandled-rejection backstop** — shared with the `user-data-error-path` book; decided, filed in `_intake.md`, not built. A backstop would have contained this class of failure too.
- [ ] **Broader shell-string call-site cleanup** — OPEN.md row 328 (from #680's triage) tracks ~16 `exec(\`strfry scan …\`)` sites that build shell strings; the `execFile`/argv shape this book used is the pattern to converge on.

## 7. Process findings (harness)

Retro measurement: `scripts/harness-stats.sh` at close — this book contributed 3 matched phase commits (book-open/test/impl/review; the test-interception fix is a fourth, unmatched by the heuristic).

| Finding | Source | Terminal state |
|---|---|---|
| **A gate suite that monkeypatches a shared core module at load time clobbers the whole gate.** The regression suite patched `child_process` at module load; because the registry loads every suite up front, that broke other suites — and it passed in isolation, so only the full gate caught it. | impl-phase full-gate run; fixed in `f4b52949` | **declined** — self-caught by the gate (isolation-green ≠ gate-green is exactly what the full run exists to catch), fixed in-book, and captured here; `test/registry.js` documents the load-all-up-front model. No harness change. |
| **Commit-boundary slip.** The `pagerank_deprecating` deletion landed in the test-interception commit rather than the impl commit. | reviewer non-blocking note | **declined** — net diff correct; cosmetic; not worth a rewrite of a security branch under expedited handling. |
| **The expedited-with-gates cadence worked for a live RCE.** Frame pre-approved → build phases continuous → outward merges gated; branch-local-until-ship; ship staging→prod back-to-back; sandboxes backported same-session. | this book | **declined** — validated positive pattern; recorded, no change. |
