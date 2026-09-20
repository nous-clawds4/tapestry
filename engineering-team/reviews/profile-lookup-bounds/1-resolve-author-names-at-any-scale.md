# Review: Story 1 — Author names must resolve on pages with many distinct authors

**Story:** `engineering-team/stories/profile-lookup-bounds/1-resolve-author-names-at-any-scale.md`
**ADR:** `engineering-team/decisions/profile-lookup-bounds/0001-chunk-at-the-cap-in-the-shared-hook.md`
**Test plan:** `engineering-team/stories/profile-lookup-bounds/1-resolve-author-names-at-any-scale.test-plan.md`
**Diff reviewed:** `origin/staging a55b9631` → `56ea6cf9`
**Date:** 2026-09-20

## Verdict

**CHANGES_REQUESTED** — one blocking regression, user-visible, in the exact path this story
adds. Everything else in the change is sound and should stand.

## Blocking

### B1 — The Tapestry Assistant loses its name on the failed-lookup path

`ui/src/components/AuthorCell.jsx:42-54`. The new failed-lookup branch renders
`shortPubkey(pubkey)` directly, bypassing the `unnamed` fallback two lines above it. For the
TA that is a regression:

| case | before (`origin/staging`) | after (`56ea6cf9`) |
|---|---|---|
| TA, lookup **failed** | `Tapestry Assistant` | **`e00ed090…`** |
| TA, no profile published | `Tapestry Assistant` | `Tapestry Assistant` |

The TA's identity comes from config (`useConfig().taPubkey`), not from the lookup — so a failed
lookup tells us nothing about who that pubkey is, and we still know. Showing a truncated pubkey
instead reintroduces precisely what the comment at `AuthorCell.jsx:25-27` exists to prevent:
*"A fresh instance's assistant has published no kind-0, so without this it would be listed as a
truncated pubkey — naming nothing to a reader."*

Not hypothetical: the TA authors most concept and list content, and `e00ed090…` was among the
288 truncated cells measured live on `/tapestry/lists/items` on 2026-09-20.

**Ask:** in the failed branch, render `unnamed` rather than `shortPubkey(pubkey)`, so a known
identity keeps its name and the ⚠ affordance carries the "we couldn't check" signal. The
non-TA case is unaffected — `unnamed` already falls through to `shortPubkey` there.

## Non-blocking

### N1 — The catch now discards all diagnostics

`ui/src/utils/profileBatch.js:76`. The bare `catch {}` drops the error entirely; the previous
code had `console.warn('useProfiles fetch error:', err)` (`useProfiles.js:67`, pre-change). The
sentinel makes the failure visible *to the operator*, which is the AC-4 requirement and is
satisfied — but a developer debugging why a batch failed now has nothing in the console. A
one-line `console.warn` inside the catch would restore it without changing behavior. Left
non-blocking because AC-4 is about the operator, not the console.

### N2 — R3 passes while the behavior it names regresses

`test/profile-lookup-bounds.test.js` R3 asserts `/Tapestry Assistant/.test(src)` — source text,
not behavior. B1 regresses exactly what R3 is named for, and R3 stayed green. This is the
`relay-scan-bounds` D-class lesson recurring: happy paths covered, the degraded path asserted
only structurally. Worth a behavioral case over the failed-lookup branch when B1 is fixed —
the pure-seam pattern makes it cheap, since `AuthorCell`'s naming rule could be exercised the
way `authorDisplay.js` already is.

### N3 — Extra pubkeys in a response are now dropped

`profileBatch.js:69-75` iterates `batch` rather than `Object.entries(data.profiles)`, so a
pubkey the server returns that was not asked for is ignored (the old code cached it). No caller
does this and the endpoint does not behave this way; noted for completeness, no action.

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 — 246 authors all resolve, no oversized request | **Met** | `C1` green; largest batch 50 |
| AC-2 — ≥1,000 authors, past both ceilings | **Met** | `C2` (20 requests, none >50), `C12` (largest URL well under half the 16,384-byte ceiling) |
| AC-3 — ≤50 unchanged | **Met** | `C3` (exactly one request at 50), `C4`, `E1` live |
| AC-4 — failures visible, incl. bodiless | **Met for the general case; B1 regresses the TA case** | `C5`–`C8`, `S5` green; B1 above |
| AC-5 — readable refusal | **Met** | `S6`, `S7`; handler verified in-container (below) |

## ADR conformance

Follows ADR 0001 on every substantive point: the cap stays 50 (`fetchProfiles.js:32`,
`profileBatch.js:17` — one number, cross-checked by `S3`+`S6`), batches are sequential with
progressive merge, the sentinel is returned but never cached (`useProfiles.js:60-62`), the
refusal gained `limit`/`received`/`hint` additively, and the stale 1-hour TTL comment was
corrected. `getProfiles` was left alone, as the ADR required — `OPEN.md` row 273 stays with the
`assistant-profile` book.

The one departure is the **seam location**: the ADR's implementation notes said to modify
`fetchMissing()` in place; the work instead created `ui/src/utils/profileBatch.js`. That was
ratified at the Test Design gate, for a verified reason — `react` is not resolvable from the
repo root, so a hook cannot be executed by any test and AC1–AC4 would have been source-asserted
only. It follows the `graph-curation-ui/0002` precedent. Accepted, not a finding.

## Test gate

Run per-suite; `npm test` crashes at suite #2 on an unreachable Meilisearch and prints no
summary (`OPEN.md` #192), so no full-gate read is available locally. CI's stack-free gate is the
binding check.

```
profile-lookup-bounds        26 passed, 1 failed   (E2 — see below)
add-node-as-element-restore  14 passed, 0 failed
in-app-badged-ta-avatar      13 passed, 0 failed
relay-scan-bounds            28 passed, 0 failed
stack-free-npm-test           7 passed, 0 failed
```

`ui` builds clean: `✓ built in 17.52s` (the chunk-size warning predates this change).

**E2's red is environmental, and I verified that rather than taking it on trust.** The live tier
targets `:7778`, which bind-mounts the *shared checkout* on `staging` — not this branch — so the
stack is serving the old handler. Re-running the real handler inside the container against a
copy placed outside the bind-mount returned:

```
HTTP 400 {"success":false,"error":"max 50 pubkeys per request","limit":50,"received":51,"hint":"split into batches of 50"}
```

Every E2 and E3 assertion passes against it. **E2 must be confirmed green on staging after
deploy** — it is the only AC-5 check that exercises the wire, and it cannot be read from here.

## Phase discipline

The implementation commit touches **0** files under `test/` — the Phase-3/Phase-4 boundary held.
Harness-lint clean.

## What was checked and found fine

- **Unbound `fetchImpl`.** `profileBatch.js:45` extracts `globalThis.fetch` and calls it
  detached, which throws "Illegal invocation" for some DOM APIs. Verified in the browser on
  `:7778`: both bound and unbound calls return 200. Not a defect.
- **Cancellation** (`:56`) is checked before each batch; `useProfiles.js:56` additionally guards
  `onBatch`, so a late-arriving batch cannot set state after unmount.
- **`null` vs sentinel** stays distinct through the whole path (`:72-74`, `C8`), so a
  profile-less author does not read as an error.
