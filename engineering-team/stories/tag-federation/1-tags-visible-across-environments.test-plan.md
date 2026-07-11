# Test Plan: Story 1 (tag-federation) — tag read-union over local + dcosl

**Story:** `engineering-team/stories/tag-federation/1-tags-visible-across-environments.md`
**ADR:** `engineering-team/decisions/tag-federation/0001-tag-read-union-local-and-dcosl.md`
**Date:** 2026-06-17

All tests in `test/tag-read-union.test.js`, registered in `test/test.js` (default `npm test` gate).

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 (read-union) | `federatedScan unions local + DList results` + `the visibility read paths scan via federatedScan` | behavioral-unit + source-contract |
| AC-2 (DList tags surface) | covered transitively by AC-1 (a remote-only event is returned by federatedScan) + AC-1 wiring; full user-facing outcome is a live/ops check (see below) | unit + live |
| AC-3 (local still works) | `federatedScan unions…` (local events present in output) + `still rejects when LOCAL scan fails` | behavioral-unit |
| AC-4 (graceful) | `federatedScan degrades to local-only when the remote source fails` + `dlistFetch returns [] when no DList relay configured` | behavioral-unit |
| AC-5 (dedupe) | `dedupeReplaceable collapses a replaceable present in both` + `federatedScan dedupes a replaceable present in both` | behavioral-unit |
| AC-6 (POV preserved) | not separately tested — federatedScan returns the merged event list and the *existing* POV aggregation consumes it unchanged; covered by the existing profile-tags POV tests, which keep passing | (existing coverage) |
| AC-7 (search untouched) | `the search/meili tag-match path is NOT changed to federate` | source-contract |

## Testability affordances required of the Implementer

Consistent with prior stories (export internals "for tests"):
1. Export `federatedScan`, `dlistFetch`, `dedupeReplaceable` from `src/api/profile-tags/index.js`.
2. `federatedScan(filter, opts?)` accepts injectable `localScan` / `remoteScan` (default to the real `strfryScan` / `dlistFetch`) — so the union/dedupe/graceful logic is testable without the `strfry` binary or a live relay.
3. `dlistFetch(filter, opts?)` accepts an injectable `relays` list (default from config `aRelays.aDListRelays`) — so the no-relay short-circuit is deterministic.

## Why this level mix

The local scan execs the `strfry` binary (absent on host) and the remote leg hits a live relay — neither is deterministic in CI. So the union/dedupe/graceful **logic** is tested via injected scanners (the contract that matters), and the **wiring** (visibility handlers call `federatedScan`) via source-contract. AC-7 is a source-contract guard that federation did not leak into the search/meili path.

## Deferred to live verification (Implementation cycle-local + post-deploy)

- **AC-2 end-to-end** ("staging shows tags.brainstorm.world's real tags") depends on the **ops content-federation step** (router push of tag content onto the DList relay) — outside this code story. During cycle-local, verify the endpoint federates against whatever is on the DList relay today (the dev box can query dcosl, which has a sliver of content + the full definitions).
- A live check that `/api/profile-tags/available-tags` returns DList-relay events not present locally, once content is federated.

## Pre-implementation pass/fail (confirmed 2026-06-17 at commit 37a20d4a)

```
--- tag read-union tests (epic tag-federation, Story 1) ---
  FAIL  dedupeReplaceable is exported and collapses a replaceable present in both sources
  FAIL  federatedScan is exported and accepts injectable local/remote scanners
  FAIL  AC-1: federatedScan unions local strfry results with the DList-relay results
  FAIL  AC-5: federatedScan dedupes a replaceable present in both local and remote
  FAIL  AC-4: federatedScan degrades to local-only when the remote source fails
  PASS  federatedScan still rejects when the LOCAL scan fails   (trivial pre-impl; real post-impl)
  FAIL  dlistFetch is exported and returns [] when no DList relay is configured
  FAIL  AC-1 (wiring): the visibility read paths scan via federatedScan, not bare strfryScan
  PASS  AC-7: the search/meili tag-match path is NOT changed to federate (regression pin)

tag-read-union: 2 passed, 7 failed
```

## How to run
```
node test/tag-read-union.test.js     # suite alone
npm test                             # full gate
```
