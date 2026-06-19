# Test Plan: Story event-page #1 — Event read path

**Story:** `engineering-team/stories/event-page/1-event-read-path.md`
**ADR:** `engineering-team/decisions/event-page/0001-event-read-path.md`
**Date:** 2026-06-18
**Test file:** `test/event-page-read-path.test.js` (wired into `test/test.js`)

## Scope
Covers **Story #1 only — the backend read path** (`buildEvent` / `handleGetEvent` at `src/api/event/eventReadPath.js`, + the extracted `src/api/_shared/relaySource.js`). The page (#2/#3) is `test/event-page-ui.test.js`.

## Test level & seam
The outcomes are driven as **observable behavior** against `buildEvent`, with the three I/O boundaries injected as in-memory fakes (mirroring `note-surfaces`/`live-feed`, minus House-PoV):

| Boundary | Fake |
|---|---|
| general-purpose relay set | `runCypher() → rows[]` |
| external relay fetch (by-id / by-author / kind-10002 outbox) | `querySync(relays, filter) → events[]` — **records its `relays` arg** so the union is assertable |
| local kind-0 (enrichment) | `scanStrfry(filter) → events[]` |

**Honest verification:** fixtures are **genuinely signed** with `nostr-tools` `finalizeEvent`; "invalid" fixtures flip a sig char on a **clean JSON clone** (nostr-tools memoizes verification via a Symbol that object-spread copies — so clones, not spreads, force a real `verifyEvent` re-check). This was confirmed empirically before writing the suite.

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| module/exports | `S1` eventReadPath exports buildEvent+handleGetEvent | structural |
| Option A extract | `S2` `_shared/relaySource.js` exists + exports (FALLBACK incl. primal/nos.lol/damus) | structural |
| endpoint | `S3` GET /api/event → handleGetEvent | structural |
| reuse | `S4` requires `_shared/relaySource` + `_shared/noteEnrichment` (no re-impl) | structural |
| **by-id** found | `B1` verified kind-1 → OK, feed-shaped item | behavioral |
| **by-id** kind-gate | `B2` verified non-kind-1 → UNSUPPORTED_KIND (carries kind) | behavioral |
| **by-id** verify | `B3` id matches but sig fails → INVALID_EVENT | behavioral |
| **by-id** missing | `B4` no match → NOT_FOUND | behavioral |
| **invalid input** | `B5` no valid id/author → INVALID, queries nothing | behavioral |
| **by-author** | `B6` newest **verified** kind-1; skips unverified-newer + foreign author | behavioral |
| **by-author** none | `B7` no verifiable kind-1 → NO_AUTHOR_NOTE | behavioral |
| **relay union** | `B8` main fetch relays ⊇ hints + outbox-write + well-known; read-marked excluded | behavioral |
| **set vs fallback** | `B9` set→"set"; empty→"fallback" with fixed relays in the union | behavioral |
| fallback on error | `B10` runCypher throws → fallback, no crash | behavioral |
| **outbox** | `B11` newest kind-10002 wins; only write-eligible r-tags | behavioral |
| **item shape** | `B12` feed shape; author name from LOCAL kind-0; mentions map | behavioral |
| handler | `H1` INVALID → 400 (hermetic, no I/O); `H2` source maps INVALID→400 / valid→200 | behavioral/source |
| regression | `R1` feedReadPath untouched; `R2` userNotesReadPath untouched; `R3` enrichNotes seam intact | regression |

## Edge cases
- [x] Tampered/bad-sig event located by id → INVALID_EVENT (B3); unverified-newer skipped for the newest **verified** (B6).
- [x] Foreign-author event excluded in by-author mode (B6).
- [x] Empty / errored relay set → fallback (B9, B10); read-marked + superseded-older outbox relays excluded (B8, B11).
- [x] INVALID short-circuits before any I/O (B5).

### Deliberately NOT covered here
- The page, param decode, search field, `naddr` (Story #2/#3, `event-page-ui.test.js`).
- Live relay/Neo4j round-trip — the **staging** capstone (the reference `nevent`).
- Re-pointing feed/user-notes to `_shared/relaySource` — deferred follow-up (R1/R2 assert they're untouched).

## Test infrastructure
Node runner via `npm test`; new suite exports `run()`, aggregated in `test/test.js`. `nostr-tools` (sign/verify/nip19) resolved via the worktree `node_modules` symlink. No live services; in-memory fakes for all three boundaries.

## How to run
```
npm test
# or just this suite:
node -e "require('./test/event-page-read-path.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

## Verification
Fails with current code — S/B/H fail because `src/api/event/eventReadPath.js` + `_shared/relaySource.js` don't exist (legible "feature not implemented"); R1–R3 PASS (shipped feed/user-notes + enrichNotes present and unmodified). Confirmed 2026-06-18 (isolated run: 3 pass / 18 fail). Output captured in the gate summary.
