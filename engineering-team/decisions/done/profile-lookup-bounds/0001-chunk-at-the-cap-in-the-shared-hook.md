# ADR 0001: Chunk at the endpoint's own cap, in the shared hook

**Status:** Accepted
**Date:** 2026-09-20
**Story:** `engineering-team/stories/profile-lookup-bounds/1-resolve-author-names-at-any-scale.md`

## Context

`useProfiles` (`ui/src/hooks/useProfiles.js:49`) puts a page's entire pubkey set into one
querystring: `GET /api/profiles?pubkeys=${needed.join(',')}`. The endpoint refuses more than
50 (`src/api/profiles/fetchProfiles.js:147-150`), so on any author-heavy page the lookup is
rejected, the hook swallows it (`:51` returns early on `!data.success`; `:66-68` warns to the
console), and every author cell falls back to a truncated pubkey. Measured on `:7778`,
2026-09-20: `/tapestry/lists/items` asks for **246** authors in one 16,032-byte URL and gets a
400; **288** cells render as truncated pubkeys.

**The pattern this project already uses.** Five pages do not call the shared hook at all — they
roll their own chunked loop against the same endpoint:

```
ui/src/pages/BrainstormFollowers.jsx:55      const PROFILE_CHUNK = 50;
ui/src/pages/BrainstormFollows.jsx:53        const PROFILE_CHUNK = 50;
ui/src/pages/BrainstormMuters.jsx:55         const PROFILE_CHUNK = 50;
ui/src/pages/BrainstormReporters.jsx:64      const PROFILE_CHUNK = 50;
ui/src/pages/BrainstormFollowsHops.jsx:19    const PROFILE_CHUNK = 50;
```

`BrainstormFollowers.jsx:95-115` carries the rationale in a comment — *"/api/profiles caps at 50
pubkeys/request, so chunk at PROFILE_CHUNK and merge each chunk as it returns (names fill in
progressively; one slow/failed chunk no longer blocks the whole list)."* The shape of the fix is
therefore not an open question in this codebase; it is proven five times over. The defect is that
the **shared** hook never learned it, so the other 41 call sites across 38 files inherit the
unbounded request.

**Constraints that bound the design:**

- **Two ceilings, not one.** The 50-cap returns a readable 400. Past a ~16 KB request head
  (Node `maxHeaderSize` = 16,384) the request is refused *below* Express — 431, empty body,
  handler never runs. Nothing in application code can intercept that, so the only defense is
  never to emit such a request. List Items is six authors from it.
- **Batch size is coupled to the relay timeout.** `getProfiles` puts every requested author into
  one filter (`:66-69`) under a 6 s race, and its `catch` (`:123`) skips the local-strfry
  fallback entirely. A larger batch is slower, so it times out more often, and each timeout
  silently drops the fallback — the defect recorded as `OPEN.md` row 273. **Raising the cap
  makes that bug fire more often**, which is the decisive argument against doing so.
- **The hook's return contract is pinned.** ADR `graph-curation-ui/0002` established that
  `useProfiles` returns a **plain object** read as `profiles?.[pubkey]`, never a `Map`, after a
  `.get()` call site crashed a whole route. Any error signal must not change that shape.
- **`AuthorCell` is the shared rendering point** (`ui/src/components/AuthorCell.jsx`), used by 31
  of the call sites. ADR `ta-avatar/0001` set the precedent of upgrading every page through it
  "without editing" call sites — the same lever applies here.

### Concept-graph orientation

The local graph answers `{"count":0}` (empty — `OPEN.md` #69), so no handles were resolvable
here. None are needed: this ADR changes no concept, only the transport shape of kind-0 lookups.
No firmware reinstall.

## Options considered

### Option A — Chunk in the shared hook at the endpoint's existing cap

`useProfiles` slices `needed` into batches of 50 and issues them sequentially, merging each
batch into state as it lands. The endpoint is untouched except for making its refusal
actionable. The five hand-rolled copies become redundant.

**Pros.** Lifts a pattern already proven in-repo rather than inventing one. No endpoint contract
change, so nothing else that calls `/api/profiles` can break. Keeps every request far below both
ceilings (50 pubkeys ≈ 3.3 KB, a fifth of the header limit). Keeps batches small enough that the
6 s race usually completes, so the local-relay fallback actually runs. Progressive merge means
names appear as they arrive and one bad batch costs only its own 50. Works for any N.

**Cons.** N/50 requests instead of one — 5 for List Items today, 20 for a 1,000-author page.
Sequential issue means a cold 1,000-author page is slow (bounded by 20 × relay latency), though
it renders progressively throughout.

### Option B — Move the lookup to POST with a JSON body

`POST /api/profiles` reading `req.body.pubkeys`, no querystring limit, one request for any N.

**Pros.** One round trip. No chunking logic. Sheds the URL ceiling entirely.

**Cons.** Decisive: it pushes the whole author set into a single `querySync` filter under the
existing 6 s race. A 1,000-author query will not finish in 6 s, so it hits the `catch` at `:123`,
**skips the local-relay fallback**, and returns `200 {success: true}` with mostly-empty profiles.
That converts today's loud, readable failure into a silent wrong answer — the opposite of what
AC4 asks for. Fixing that means also rewriting `getProfiles` to sub-batch internally, at which
point the chunking exists anyway, just server-side and less observable. Also: a body-parser must
be mounted for this route, POST-for-a-read forfeits HTTP caching, and every existing caller
(including the five hand-rolled pages) would need migrating.

### Option C — Raise the cap and sub-batch inside `getProfiles`

Keep GET, lift the cap to ~250 (the header ceiling's practical maximum), and have `getProfiles`
split internally into relay-sized batches.

**Pros.** Fewer round trips than A. Server controls batch size, so it can tune to relay
behavior.

**Cons.** ~250 is a hard ceiling set by `maxHeaderSize`, so it does not satisfy AC2 at 1,000
without chunking on the client *as well* — it adds a mechanism without removing one. It silently
changes the contract the five existing pages code against. And the cap's stated purpose is abuse
prevention; raising it weakens that for a gain the client-side chunk already delivers.

## Decision

We chose **Option A**, and we keep the cap at exactly **50** — resolving the question left open
at planning.

The cap stays because it is load-bearing three times over: it is the abuse guard the story
requires preserved; it is the de-facto contract five pages already code against, so moving it
changes their behavior silently; and it keeps each relay query small enough to finish inside the
6 s race, which is what keeps the local-relay fallback reachable. Raising it would make
`OPEN.md` row 273 fire more often. The right number of pubkeys per request is the number the
server already asks for.

Three surfaces change:

1. **`useProfiles` chunks and reports failure.** Sequential batches of 50, merged progressively.
   Failed batches mark their pubkeys with a sentinel that is *returned but not cached*, so the
   failure is visible now and retried on the next mount.
2. **`AuthorCell` renders the sentinel** as an explicit "name unavailable" state. One file, 31
   pages, no call-site edits — the `ta-avatar/0001` lever.
3. **The endpoint's refusal becomes actionable** — the 400 body names the limit and what to do,
   so a caller can self-correct instead of guessing.

## Consequences

- **Every page that uses the shared hook is fixed at once**, including the 40-odd that have never
  been reproduced locally because this machine's graph is thin.
- **The five hand-rolled `PROFILE_CHUNK` loops become redundant.** Retiring them onto the shared
  hook is a natural follow-up and is deliberately *not* done here — the story puts call-site
  auditing out of scope, and those five pages work today. Worth an intake entry.
- **Request count rises** — 5 per cold load of List Items instead of 1. The server's 5-minute
  cache (`fetchProfiles.js:22`) and the hook's own client cache absorb repeats, so this is a
  cold-load cost only.
- **A 431 is still possible for a hand-rolled caller**, because it is refused beneath the
  application. What changes is that no first-party code emits one. AC5's guarantee is scoped to
  requests the endpoint actually handles — which is how it is written ("when the endpoint handles
  it") and the only way it is satisfiable. **The Tester should not write a test asserting Express
  answers an over-ceiling request; it cannot.**
- **`OPEN.md` row 273 is unaffected but made less likely to fire**, since batches stay small.
  It remains the `assistant-profile` book's to fix.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

**File: `ui/src/hooks/useProfiles.js`**

- Add and export `export const PROFILE_CHUNK = 50;` — the single source for the batch size,
  named to match the five existing copies so a future consolidation is a straight swap.
- Add and export a failure sentinel:
  `export const PROFILE_LOOKUP_FAILED = Object.freeze({ __lookupFailed: true });`
  A frozen object rather than a `Symbol` so it reads like the rest of this plain-JS codebase.
  Consumers that don't know about it do `p?.display_name` → `undefined` → existing fallback, so
  the 40 non-`AuthorCell` call sites are unaffected. This preserves ADR `graph-curation-ui/0002`:
  the return value stays a plain object keyed by pubkey.
- Replace the single fetch in `fetchMissing()` (`:47-69`) with a loop over
  `needed.slice(i, i + PROFILE_CHUNK)`, awaiting each batch and merging with
  `setProfiles(prev => ({ ...prev, ...batchResult }))` so names fill in progressively. Honor the
  existing `cancelled` flag between batches, as `BrainstormFollowers.jsx:104` does.
- On a batch that throws, or returns `!data.success`, or returns a non-OK status: set each pubkey
  in that batch to `PROFILE_LOOKUP_FAILED` in the returned object, and **do not** write it to
  `clientCache`. Caching a transient failure would make it permanent. Continue to the next batch
  rather than aborting — one bad batch costs only its own 50.
- Keep the existing null-caching for pubkeys the server searched and did not find (`:57-63`);
  "no profile exists" and "lookup failed" must stay distinguishable.
- Update the JSDoc (`:6-11`) to document the sentinel alongside the existing plain-object note.

**File: `ui/src/components/AuthorCell.jsx`**

- Import `PROFILE_LOOKUP_FAILED` and branch at `:24-28`: when
  `profiles?.[pubkey] === PROFILE_LOOKUP_FAILED`, render the short pubkey with a visible
  unavailable affordance and a `title` saying the name could not be loaded — distinct from both a
  resolved name and the legitimate "no profile published" case that `:27` already handles for the
  TA. Leave the `unnamed`/`displayName` logic otherwise intact.
- The `Avatar` delegation at `:37` is unchanged.

**File: `src/api/profiles/fetchProfiles.js`**

- At `:147-150`, keep the `> 50` rejection and keep it a 400. Extend the body from a bare
  `error` string to also carry the limit and the remedy, e.g.
  `{ success: false, error: 'max 50 pubkeys per request', limit: 50, received: pubkeys.length, hint: 'split into batches of 50' }`.
  Additive only — the existing `success`/`error` fields keep their shape, so no current caller
  breaks.
- Define the 50 as a named exported constant rather than a literal in the guard, so the test plan
  can assert client and server agree on one number.
- Correct the stale header comment at `:7` — it says a 1-hour TTL; `:22` is 5 minutes. Editorial.

**Not changed:** `getProfiles` (`:46-131`) keeps its current relay/fallback/caching behavior.
Its timeout-skips-fallback defect is `OPEN.md` row 273 and belongs to the `assistant-profile`
book.

## Out of scope

- **Retiring the five hand-rolled `PROFILE_CHUNK` loops** onto the shared hook. Follow-up.
- **Parallelism across batches.** Sequential matches the proven precedent and is gentler on the
  relays. If a 1,000-author page proves too slow in practice, bounded concurrency is a
  self-contained later change behind the same hook.
- **A retry affordance.** The sentinel is deliberately uncached so a remount re-attempts, but no
  explicit retry button is specified; `prevKeysRef` (`:14`, `:20-21`) still suppresses a refetch
  for an unchanged key set within one mount. Worth revisiting if operators ask for it.
- **`getProfiles`' timeout/fallback behavior** — `OPEN.md` row 273, owned elsewhere.
- **Whether the pages should ask for fewer authors at all** — row bounds were `relay-scan-bounds`
  territory and that book is closed.
