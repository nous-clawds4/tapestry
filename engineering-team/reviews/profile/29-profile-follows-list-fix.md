# Review: Story 29 — follows-list fix (Name-column / `/api/profiles` 50-cap)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-29
**Diff:** `git show fefd39d0` (branch `fix/follows-profiles-chunk-cap`)
**Scope:** Follow-up to `engineering-team/reviews/29-profile-follows-list.md` (PASS). Covers **only** the staging-smoke-caught bug fix, not the whole feature.

## Defect (caught by cycle-staging smoke, not local)
On `staging.brainstorm.world` the follows page's **Name column never resolved** — every row showed the npub fallback + "N" placeholder. Root cause: `/api/profiles` returns **400 for >50 pubkeys** (`src/api/profiles/fetchProfiles.js:148-149`), but `BrainstormFollows.jsx` batched at `CHUNK = 100`, so every profile request 400'd, the `catch` swallowed it, and names/pictures never merged. Verified live: 100→400, 50→200, 10→200. Local missed it because the dev graph has no follow edges (the profile-fetch path never ran).

## Quality gates (run by reviewer)
- [x] **node suite — 26/26.** T23 (new guard) passes; the prior 22 + 3 sentinels still green (incl. R1 — shared `get-grapevine-interaction` query untouched).
- [x] **`npm --prefix ui run build` — clean** (~37s, only the pre-existing chunk-size warning).
- [n/a] lint/typecheck/server-build — not configured.

## Audit of the fix (`fefd39d0`, 2 files)

`ui/src/pages/BrainstormFollows.jsx`:
- [x] **Root cause addressed:** `PROFILE_CHUNK = 50` (≤ the server cap). The old `CHUNK = 100` helper is removed (no dead code left).
- [x] **Incremental merge is correct:** the effect resets `setProfiles({})` on observee change, then an async loop fetches each ≤50 batch and merges via a **functional** update `setProfiles(prev => ({ ...prev, ...j.profiles }))` — no stale-closure. The `!cancelled` guard is checked both in the loop condition and before each `setProfiles`, and the cleanup sets `cancelled = true`, so a unmount/observee-change aborts cleanly. Deps `[follows]` (stable hook state) → runs once; no infinite loop (it never sets `follows`).
- [x] Names now fill in **progressively** per chunk rather than all-at-once at the end, and a *failed* chunk no longer aborts the rest (each chunk independent + `catch`).

`test/profile-follows-list.test.js`:
- [x] **Guard test T23** extracts `PROFILE_CHUNK = <n>` and asserts `1 ≤ n ≤ 50`, cross-referencing `fetchProfiles.js:148`. Confirmed red→green across the fix (failed at 100, passes at 50). Meaningful regression guard.

## Spec / ADR / scope
- [x] No ADR change — same design (owner-POV, new endpoint). Shared `follows` Cypher untouched (R1 green).
- [x] No scope creep — exactly the 2 files; the other story-29 ACs are undisturbed (suite green).
- [x] No secrets / debug logging / commented-out code introduced.

## Findings
### Blocking
_None._

### Non-blocking
1. **Sequential chunking at scale:** with `PROFILE_CHUNK = 50`, jack's 1,659 follows still fetch in ~34 sequential requests. The incremental merge means earlier names appear quickly, but a *slow* (not failed) chunk still delays later ones. Acceptable for v1; a future enhancement could fetch only the visible page's profiles, or parallelize bounded batches. (Commit message's "one slow chunk no longer blocks the whole list" is slightly generous — a *failed* chunk doesn't block; a *slow* one still serializes — but earlier results already render.)

## Verdict
**PASS** — the fix targets the confirmed root cause, the incremental-merge effect is correct and cancel-safe, the guard test prevents regression, gates are green, and scope is minimal. Re-run `cycle-staging` to re-smoke the populated Name column on staging before any prod promotion.
