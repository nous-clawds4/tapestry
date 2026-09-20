# Review: Story 1 — Author names must resolve on pages with many distinct authors

**Story:** `engineering-team/stories/profile-lookup-bounds/1-resolve-author-names-at-any-scale.md`
**ADR:** `engineering-team/decisions/profile-lookup-bounds/0001-chunk-at-the-cap-in-the-shared-hook.md`
**Test plan:** `engineering-team/stories/profile-lookup-bounds/1-resolve-author-names-at-any-scale.test-plan.md`
**Diff reviewed:** `origin/staging a55b9631` → `5b3af3b9`
**Date:** 2026-09-20

## Verdict

**PASS**

Round 1 raised one blocking regression (B1) and three non-blocking notes. B1 and N1 are fixed
in `5b3af3b9`; B1's closure is verified structurally below, not just case-by-case. The change
meets every acceptance criterion, conforms to ADR 0001, and introduces no regression in the
suites that neighbour it.

One carry-forward, recorded rather than blocking: **E2 must be confirmed green on staging after
deploy.** It is the only AC-5 check that exercises the wire, and it cannot be read from this
worktree.

## Round 1 — Blocking (now resolved)

### B1 — The Tapestry Assistant loses its name on the failed-lookup path — **FIXED**

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

**Resolution — verified structurally, which is stronger than the case list.** `AuthorCell.jsx:53`
now renders `{unnamed}`. Two facts close this for *every* path, not only the cases someone
thought to enumerate:

1. `const unnamed` (`AuthorCell.jsx:34`) is **byte-identical** to the same line on
   `origin/staging` (`:27` there) — the naming rule itself is untouched.
2. `shortPubkey(pubkey)` now appears in **exactly one place** in the file — inside that rule.

So every render path, failed or not, resolves a name through the identical rule that existed
before this story. The only difference the story introduces to a cell is the added ⚠ affordance
and its styling. Spot-checked across TA/non-TA × failed/absent/named: the displayed name matches
pre-change behavior in all five.

## Round 1 — Non-blocking

### N1 — The catch now discards all diagnostics

`ui/src/utils/profileBatch.js:76`. The bare `catch {}` drops the error entirely; the previous
code had `console.warn('useProfiles fetch error:', err)` (`useProfiles.js:67`, pre-change). The
sentinel makes the failure visible *to the operator*, which is the AC-4 requirement and is
satisfied — but a developer debugging why a batch failed now has nothing in the console. A
one-line `console.warn` inside the catch would restore it without changing behavior. Left
non-blocking because AC-4 is about the operator, not the console.

**Resolution — fixed** in `profileBatch.js:76-79`: the catch now binds `err` and warns with the
batch size and the underlying message. Public pubkeys only; nothing sensitive is logged.

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
| AC-4 — failures visible, incl. bodiless | **Met** | `C5`–`C8`, `S5` green; B1 resolved in `5b3af3b9` |
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

Both implementation commits (`56ea6cf9`, `5b3af3b9`) touch **0** files under `test/` — the
Phase-3/Phase-4 boundary held across the kick-back. Harness-lint clean.

## A neighbouring suite that is red, and why it is not this story

`concept-count-canonical` reports 15 passed, 4 failed. All four are `L` (live) tests and all
four fail on the same cause — the local concept graph holds 0 concepts
(`/api/concept-graph/summaries` → `{"count":0}`, the known local condition, `OPEN.md` #69):

```
L2: expected the graph to hold many concepts; got 0.
L3: a count of 0 means the old :ListItem predicate is still in force
L4: word: a count of 0 means set-nested elements are still being skipped.
L6: expected at least one fixture concept to have nested sets.
```

Confirmed unrelated: this branch changes no file the suite exercises
(`git diff origin/staging..HEAD -- test/concept-count-canonical.test.js ui/src/pages/concepts
src/api/concept-graph` is empty), and the suite references none of
`useProfiles`/`AuthorCell`/`profileBatch`/`api/profiles`. Worth naming because these are tests
that **FAIL where they should SKIP** on an empty graph — the "local test gate lies" class the
operator has already deferred to a future harness story. Reading them as this story's breakage
would be a misread; so would letting them hide a real one.

## What was checked and found fine

- **Unbound `fetchImpl`.** `profileBatch.js:45` extracts `globalThis.fetch` and calls it
  detached, which throws "Illegal invocation" for some DOM APIs. Verified in the browser on
  `:7778`: both bound and unbound calls return 200. Not a defect.
- **Cancellation** (`:56`) is checked before each batch; `useProfiles.js:56` additionally guards
  `onBatch`, so a late-arriving batch cannot set state after unmount.
- **`null` vs sentinel** stays distinct through the whole path (`:72-74`, `C8`), so a
  profile-less author does not read as an error.
