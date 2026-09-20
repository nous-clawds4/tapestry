# Test Plan: Story 1 — Author names must resolve on pages with many distinct authors

**Story:** `engineering-team/stories/profile-lookup-bounds/1-resolve-author-names-at-any-scale.md`
**ADR:** `engineering-team/decisions/profile-lookup-bounds/0001-chunk-at-the-cap-in-the-shared-hook.md`
**Date:** 2026-09-20

## The seam this plan pins

There is no jsdom in this repo (ADR `graph-curation-ui/0001`), and **`react` is not resolvable
from the repo root** — verified: `import('./ui/src/hooks/useProfiles.js')` fails with
`ERR_MODULE_NOT_FOUND: Cannot find package 'react'`. A React hook therefore cannot be executed
by any test here. If the chunking lives inside `useProfiles`, AC1–AC4 can only ever be
*source-asserted* — pattern-matching on the text of a file, which proves the code was written,
not that it works.

So the plan pins a React-free seam, which is the same move ADR `graph-curation-ui/0002` made for
the same reason (`ui/src/utils/authorDisplay.js`), and the same thing the sibling story's plan
did with `createTally`:

```js
// ui/src/utils/profileBatch.js   — must NOT import react
export const PROFILE_CHUNK = 50;
export const PROFILE_LOOKUP_FAILED = Object.freeze({ __lookupFailed: true });
export async function fetchProfilesChunked(pubkeys, {
  fetchImpl,                 // defaults to globalThis.fetch; injected in tests
  chunkSize = PROFILE_CHUNK,
  onBatch,                   // (partialProfiles) => void, after each batch
  isCancelled,               // () => boolean, checked before each batch
} = {})
// resolves to a plain object: { [pubkey]: profile | null | PROFILE_LOOKUP_FAILED }
```

`useProfiles` becomes a thin React wrapper over it; `AuthorCell` imports the sentinel from the
same module. **This refines the ADR's implementation notes** (which said to modify
`fetchMissing()` in place) and is the one judgment call in this plan — it is what moves AC1–AC4
from "the text contains a loop" to "the behavior is correct."

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 (246 authors all resolve) | `C1` | `test/profile-lookup-bounds.test.js` | unit (executed) |
| AC-2 (≥1,000 authors, both ceilings) | `C2`, `C12` | same | unit (executed) |
| AC-3 (≤50 unchanged) | `C3`, `C4`, `E1` | same | unit + live |
| AC-4 (failures visible, incl. bodiless) | `C5`, `C6`, `C7`, `C8`, `S5` | same | unit + source |
| AC-5 (readable refusal) | `E2`, `S7`, `S6`, `C12` | same | live + source |
| Wiring the ADR names | `S1`–`S4` | same | source |
| Must-not-break | `R1`–`R5` | same | regression |

**Classes.** `C` executes the pure seam with an injected fetch — this is where AC1–AC4 are
actually proved. `S` pins the wiring the ADR names. `E` is live HTTP against `/api/profiles`,
skipped when the stack is absent. `R` are sentinels that are green **before and after**; they
exist to catch the Implementer breaking working behavior while fixing the request shape.

## Edge cases covered

- [x] Empty pubkey list issues no request at all (`C11`).
- [x] Exactly at the cap — 50 — stays one request, not two (`C3`). Off-by-one here would
      double every page's request count.
- [x] A single pubkey still costs a single request (`C4`).
- [x] **One bad batch must cost only its own 50** (`C5`) — the other batches still resolve.
- [x] A `200`-shaped failure (`success: false`) is not swallowed (`C6`) — this is the exact
      path the hook takes today at `:51`.
- [x] **A bodiless rejection** — the 431 shape, where `.json()` throws (`C7`). This is the
      failure mode List Items is six authors from reaching, and today it vanishes into a
      `console.warn`.
- [x] **`null` (no profile published) must not collapse into the failure sentinel** (`C8`).
      If it did, every profile-less author would read as an error — including a fresh
      instance's own assistant.
- [x] Progressive merge fires per batch, not once at the end (`C9`).
- [x] Cancellation stops the remaining batches (`C10`).
- [x] The failure sentinel must never reach `clientCache` (`S4`) — caching a transient
      failure makes it permanent.
- [x] Client and server agree on one number, not two copies of `50` (`S3` + `S6`).

## Deliberately NOT tested

**A request past the ~16 KB request-head ceiling.** Node refuses it beneath Express — 431 with
an empty body, handler never invoked — so no assertion about the endpoint's *response* is
possible, and one written anyway would assert a property of Node, not of this code. AC-5 is
scoped to requests the endpoint actually handles. The real guarantee is covered instead by
`C12`: no URL first-party code emits comes within half the ceiling.

## Test infrastructure

- Runner: Node built-in, `test/profile-lookup-bounds.test.js`, registered in
  `test/registry.js` next to `relay-scan-bounds.test.js`. Registration is mandatory —
  `stack-free-npm-test.test.js` G5 fails otherwise; confirmed green (7/7).
- Live tier: `E1`–`E3` against `TAPESTRY_BASE` (default `http://localhost:7778`), each
  returning `'SKIP'` when the stack is absent.
- Firmware state: none required. This story touches no concepts.
- Fixtures: deterministic 64-hex pubkeys generated in-file; a recording stub `fetch` whose
  per-batch behavior is scripted (`ok` / `reject` / `unsuccessful` / `bodiless`). No network,
  no graph state.

## How to run

Run the suite on its own — `npm test` currently crashes at suite #2 on an unreachable
Meilisearch and prints no summary (`OPEN.md` #192), so a full-gate read is not available
locally:

```bash
node -e "require('./test/profile-lookup-bounds.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

CI runs the stack-free gate, which is the binding check.

## Verification

Confirmed 2026-09-20 on `fix/profile-lookup-bounds` at `1f671740`:

```
profile-lookup-bounds: 7 passed, 20 failed, 0 skipped
```

**The 20 failures are the right 20.** Every `C` test fails with
`ui/src/utils/profileBatch.js must export fetchProfilesChunked(...) — not implemented yet`;
every `S` test fails naming the specific wiring that is missing (e.g. *"useProfiles.js:49 still
sends every pubkey in one request — this is the defect"*); `E2` fails with
`the refusal must name the limit so a caller can self-correct; got limit=undefined`.

**The 7 passes are all sentinels and must stay green:** `E1` (50 pubkeys already succeed — the
contract the client codes against), `E3` (the refusal's existing shape), and `R1`–`R5`. `R1` was
corrected during authoring: its first draft failed by matching the legitimate
`clientCache = new Map()` declaration, which would have made a must-pass-always sentinel red
from the start.
