# Review: Story 9 — Paginate the lists index and count only the visible page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-17
**Branch:** `feat/dlist-item-tagging`
**Diff:** `git show 9b379aed` (5 files, +273/−18)
**Profile:** Light (trial) — `workflows/light-profile.md` § Gate B
**Story:** `engineering-team/stories/dlist-item-tagging/9-paginate-the-lists-index.md`
**ADR:** none (Design note lane) — ratified below
**Book:** `engineering-team/audits/dlist-item-tagging/book.md`

## Quality gates (run by reviewer, not trusted)

Scoped gate per Gate A, run individually in the foreground via `direnv exec .` from the repo root,
`BRAINSTORM_BASE_URL=http://localhost:8778` (the control panel is published on host `:8778`; `:7778`
is occupied by `infra-strfry2-1` on this machine).

| Suite | Expected | Actual | Exit |
|---|---|---|---|
| `test/dlist-index-page-counts.test.js` | 27 | **27 pass, 0 fail, 0 skipped** | 0 |
| `test/dlist-browse.test.js` | 25 | **25 pass, 0 fail, 0 skipped** | 0 |
| `test/strfry-write-assertion-bracket.test.js` (guard) | 6 | **6 pass, 0 fail, 0 skipped** | 0 |

- [x] Scoped gate green, exit codes captured by brace-redirect (no `tail` in the pipeline).
- [x] `cd ui && npx eslint src/pages/Lists.jsx src/api/dlists.js` → clean, exit 0.
- [ ] `npm test` — not run (operator constraint; remains the book-close / promotion gate).
- [ ] `npm run test:playwright` — not applicable (no Playwright spec in the blast radius; the client
      half is pinned by source sentinels, a documented level gap in the story).
- [x] _Typecheck / build not configured — skipped._

**Live endpoint smoke** (local panel, server already restarted with this code):

```
GET /api/dlists/page-counts?coords=39998:b83a…9450:github-accounts
 → {"success":true,"counts":{"39998:b83a…9450:github-accounts":7},"invalid":[],"partial":false}
GET /api/dlists/page-counts                       → 400
GET …?coords=bogus&coords=39998:b83a…:github-accounts
 → {"success":true,"counts":{…:7},"invalid":["bogus"],"partial":false}
```

Count 7 matches the expected figure; the per-coordinate `invalid` path and the request-level 400 both
behave as ruled, on the wire, not just in the harness.

## Gate-A classification — ratified

**Design note (no ADR) is correct.** Walked the irreversibility triggers: no event/wire format (this
endpoint publishes nothing and defines no event shape — it is a read-only HTTP query over strfry);
no auth/trust default (public read, exactly like the neighbouring `item-counts`); no schema or
firmware change (no concept definitions touched → no reinstall owed); no new dependency
(`child_process` is stdlib and already used in this area); no cross-repo contract (the only consumer
is `ui/src/pages/Lists.jsx` in this repo); no middleware ordering change (one `app.get` appended
beside its sibling at `src/api/index.js:270`, nothing reordered); no content-type/header work; no
value duplicated across repos. Blast radius as declared, verified by `git show --stat`: exactly the
five files named in the Design note, plus no test edits at all in Phase 4 — the guard-suite carve-out
held (`test/dlist-browse.test.js` is byte-unchanged in this commit; its S3 re-aim landed in Test
Design, as ruled).

## AC verdict table

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 first 50 newest-first, "showing N of M", next-page control, unknown total | **PASS** | `Lists.jsx:45` `queryRelayBounded({kinds:[9998,39998],limit:50})`; sort at `:47`; `totalLabel` (`:87`) and `Showing {headers.length} of {totalLabel}{… ' (scan was bounded)'}` (`:166`); `hasMore` gate (`:88`). Handles S2, S3 green. |
| AC-2 new bounded endpoint over the page's coordinates, `#z`/`#e`, never walks the relay | **PASS** | `pageCounts.js:filterForCoord` emits `{kinds:[9999,39999],'#z':[coord]}` / `'#e'` and **never** a kinds-only filter; route mounted `src/api/index.js:270`; re-exported `src/api/dlists/index.js:7,11-12`. U1–U4, U10, H4, H5, S1, S4, S6 green. Live smoke confirms O(page). |
| AC-3 `item-counts` unchanged; `/lists` no longer calls it | **PASS** | `itemCounts.js`, `ui/src/pages/List.jsx`, `ui/src/pages/lists/Index.jsx`, `ui/src/utils/dlistFields.js` absent from the commit stat; `grep item-counts ui/src/pages/Lists.jsx` → no hits. R2/R3/R4 + `dlist-browse` S3 green. |
| AC-4 filter narrows the loaded page and says so | **PASS** | `Lists.jsx:135-137` `{visible.length} matching of {headers.length} loaded`; empty state `No lists match on this page.` (`:138`). Both derived from live state, so they recompute after "next page" (E11). S5 green. |
| AC-5 failure/timeout → "—", per-coordinate `invalid`, 400 only for missing/empty/all-malformed | **PASS** | Handler 400s at `pageCounts.js:141,144,147` for exactly those three; per-coordinate isolation in the worker `catch` (`:110-115`); client `loadCounts` is fire-and-forget with `.catch(() => {})` (`Lists.jsx:33-40`) and rows fall back to `'—'` (`:146`). U5, U7, U8, H1–H3, H7, S4 green; live `invalid:["bogus"]` confirms. |
| AC-6 `/list/:ref` untouched | **PASS** | `List.jsx` not in the commit; R1 green. |

Edge cases E1, E2, E4, E5, E7–E11 all carry a green handle; E3 and E6 are the story's declared
not-covered/level-gap entries and are unchanged here (E3's React key is still `h.id`, `Lists.jsx:144`).

## Adversarial probes (beyond the plan)

- **Shell injection via a coordinate.** `spawn('strfry', ['scan','--count', JSON.stringify(filter)], …)`
  (`pageCounts.js:52`) is argv-based — no shell, no string interpolation. A coordinate containing
  quotes/newlines is JSON-escaped into one argv element and is inert. The Design note's explicit
  rejection of `scanCount.js`'s `exec` shell string is honoured.
- **Child leak on deadline.** Each spawn carries `opts.timeoutMs` and is `SIGKILL`ed by its own timer
  (`:58`); the timer is cleared on both `error` and `close` (`:61,63`). No orphan, no dangling timer.
- **Double-response / reject-after-response.** `countsForCoords` resolves through a single
  `Promise.race([done, deadline])` with the deadline timer cleared immediately after (`:119-122`); the
  handler awaits once and returns once, with everything inside a `try/catch` that answers JSON (H7).
  Workers that finish after the deadline mutate `out.counts`, but the handler serialises a **copy**
  (`{ ...out.counts }`, `:153`) — no post-response mutation of the sent body.
- **Concurrency bound is real.** `for (let i = 0; i < Math.min(CONCURRENCY, total); i++) worker()`
  (`:117`) with a shared `next` cursor — at most 8 awaits outstanding; U4 asserts both the ceiling and
  that work is not serialised.
- **Paging cannot loop.** `until = Math.min(...created_at)` + id de-dupe + `fresh.length === 0 →
  setExhausted(true)` (`Lists.jsx:64-74`), and `hasMore` is `!exhausted && …` (`:88`) — idiom-for-idiom
  identical to `List.jsx:104-110,127-128`, which I diffed by eye line-for-line. Worst case a repeated
  boundary header re-renders once; it cannot re-arm the control indefinitely.
- **Architecture invariants.** This is raw relay membership for everyone alike — no POV column, no
  trust gate, no authorship check anywhere in the handler (validation is shape-only, `COORD_RE`/`ID_RE`
  at `:31-32`), so principle 2 is respected and nothing pretends to a global "trusted" view. No neo4j
  state is read or destroyed (principle 4 untouched).
- **TA pubkey.** No literal anywhere in the diff (`grep 82b75e47` → no hits); the endpoint never needs
  an identity.

## Concept-graph integrity
- [x] Coordinates stay in `kind:pubkey:slug` form; the validator accepts an empty final segment (E4),
      which is legal nostr.
- [x] No concept definitions changed → **no firmware reinstall owed** (as the Design note states).
- [x] No new code re-derives domain facts from BIBLE.md.

## Things tests can't catch
- [x] No secrets committed.
- [x] No debug logging (the single `console.error` at `pageCounts.js:158` is the 500 path, matching
      house style) and no commented-out code.
- [x] Error paths covered where it matters; race conditions examined above.
- [x] Input validation at the boundary; no injection vector.

## House rules
- [x] Concept Graph API authority respected (no domain concepts touched).
- [x] No new lint/typecheck/build tooling.
- [x] Local dev only; nothing published to any relay.

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/pages/Lists.jsx:34-37`** — `loadCounts` drops the `cancelled` guard the removed
   `item-counts` fetch had, so a counts response landing after unmount calls `setCounts` on a dead
   component. Harmless under React 18 (no warning, no leak of consequence), but the surrounding
   effect still threads `cancelled`; passing it in would keep the file internally consistent.
2. **`src/api/dlists/pageCounts.js:52`** — the endpoint is public and unauthenticated, and each
   request may spawn up to 8 concurrent `strfry` processes; there is no *global* ceiling across
   concurrent requests. Strictly better than the whole-relay endpoint it replaces (O(page) vs
   O(relay), and `item-counts` is equally unauthenticated), so this is not a regression — but if the
   index ever faces the open internet, a process-wide semaphore is the natural next bound.
3. **`src/api/dlists/pageCounts.js:110-112,124`** — a coordinate whose scan *fails* (vs times out) leaves
   `partial: false` with no key and no `invalid` entry, so the client cannot distinguish "failed" from
   "not asked". Matches U7 and the story's ruled contract exactly; noting only because the response
   shape gives the client no lever if that distinction is ever wanted.
4. **`src/api/openapi.yaml`** — the new route is not documented. The Design note called this optional,
   and the sibling `/api/dlists/item-counts` is likewise absent from that file, so the diff is
   internally consistent.

### Harness friction
1. The invoking brief named `engineering-team/templates/review.md`; the actual template is
   `engineering-team/templates/review-checklist.md`. Cosmetic, but it is the second such path drift in
   this epic — worth a `meta` row if it recurs.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/dlist-item-tagging/9-paginate-the-lists-index.md`).
- [x] Completion detection performed; result reported in chat, not recorded here.
