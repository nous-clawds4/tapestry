# Test Plan: Story 5 — Trusted dictionary

**Story:** `engineering-team/stories/shared-concepts-adoption/5-trusted-dictionary.md`
**ADR:** `engineering-team/decisions/shared-concepts-adoption/0005-trusted-dictionary.md`
**Date:** 2026-08-07
**Suite:** `test/trusted-dictionary.test.js` (registered in `test/test.js`, the standard five-touch)

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| AC-1 membership (≥ N distinct qualifying; exclusions; below-N absent; defaults) | `U2`, `U3` + `H1` (default cutoff 0.01 / N 2 exercised live: 0.5/0.5 in, 0.001 out) + `S1` (the two config knobs with their defaults) | unit + live + structural |
| AC-2 evidence (qualifying/total split, sort) | `U4`, `U6` + `H1` (2-of-3 split) | unit + live |
| AC-3 POV (house default; personalized cards; no-cards fallback disclosed; read-time switch) | `H2` (the card-scored view provably differs from house — fixture C flips in; `pov.branch`; `fellBackToHouse`) + `H1` (`pov.branch === 'house'`) + `S3` (`usePov()` on the page) | live + structural |
| AC-4 read-computed public view | `H3` (a new qualifying carrier enters on a plain re-read, no republish step) + `H1` (unauthenticated host GET 200) + `S3` (route/nav under Shared Concepts, own page) | live + structural |
| AC-5 snapshot (owner-gated, params embedded, explicit act only) | `H4` (unauthenticated refusal 401/403; loopback mint; `pov`/`cutoff`/`threshold`/`computedAt`/`memberCount` in the json section; the snapshots strip) + `S2` (gate + concept name) | live + structural |
| AC-6 snapshot hygiene (sentinel never rides; view keeps it marked) | `U5` (the flags) + `H1` (fixture B in view, marked) + `H4` (fixture B absent from the mint) + `S2` (the drop site) | unit + live + structural |
| AC-7 consensus firewall (usage-derived, no b creation) | `H4` (`derivation === 'z-usage'`; the minted element carries no `b` tags) + `U7` (zero-require core) + `S2` (the marker in the handler) | live + unit + structural |
| AC regression (F1/F2 untouched) | `S4` + `H5` (both pass pre AND post) | structural + live |

## Edge cases

- [x] Empty inputs (`U1`).
- [x] The header's own author and the TA excluded even when nominally in the qualifying set (`U3` — exclusions beat qualifying membership).
- [x] Real-b headers stay in the dictionary unmarked — it is not the worklist (`U5`).
- [x] Foreign and TA-authored headers both eligible (S3b spans both populations — `U2`).
- [x] Qualifying-count ties break by total-event count (`U6`).
- [x] Multiple events per author counted once for authors, each for events (`U4`).
- [x] Personalized observer whose trust *disagrees* with house (fixture C: house-out, cards-in — `H2`).
- [x] Stack down → every H row SKIPs (recorded).

## Test infrastructure

- The established idioms: docker-exec loopback writes, host-fetch reads, bounded settle-polls with
  self-describing predicates, **`nextStamp` on every fixture header/carrier write** (OPEN.md #144).
- **Neo4j fixture rows** (new for this suite): trust scores are written via the localTrusted
  loopback `POST /api/neo4j/query` — `NostrUser` rows for the three carrier identities
  (influence 0.5 / 0.5 / 0.001, straddling the 0.01 default cutoff) and two
  `NostrUserWotMetricsCard` rows for the fixture observer (scoring the house-untrusted carrier
  0.9 — the discriminating personalized view). Teardown DETACH-DELETEs exactly these fixture
  pubkeys. Local graph data is NOT assumed representative (OPEN.md #6) — the fixtures carry the
  entire trust surface the suite needs.
- Identities: five deliberately NON-SECRET throwaway keys (fill(11)–fill(15)): two house-trusted
  carriers, one house-untrusted carrier, the personalized observer (cards only, no events), and a
  no-cards observer (the fallback probe).
- strfry fixtures (stable d-tags; teardown republishes bare): four TA headers
  (`trusted-dictionary-fixture-f3a/b/c/d`; `f3b` carries the F5 sentinel) and nine kind-39999
  z-carriers (`td-z-*`).
- **Self-cleaning mints** (amended by story #6, 2026-08-07 — originally "documented residue"):
  each full run mints ONE `trusted dictionary snapshot` element to prove the publish path (H4),
  and teardown then bares every fixture-membered snapshot element (this run's and any earlier
  residue), so the strip shows only deliberate publishes. Graph-side element nodes remain (no
  delete primitive, by design); spike-verified that the bare republish has no re-import side
  effect (the OPEN.md #142 class does not fire on plain strfry publishes).
- No firmware precondition; no Playwright row (the page is fetch+render over the server assembly;
  the publish action is the H-covered normalize endpoint; review-phase manual walk covers the
  visual pass).

## How to run

```
node test/trusted-dictionary.test.js
```

## Verification

The new tests fail with the current code. Confirmed 2026-08-07 at commit `6378b9d8`
(stack up at :7778, so the H rows executed rather than skipping):

```
  ✗ U1..U6  — "src/lib/trustedDictionary.js must exist (ADR 0005) — implement the pure core first"
  ✗ U7      — "src/lib/trustedDictionary.js unreadable — the pure core must exist"
  ✗ S1      — "GET /api/trusted-dictionary must be registered in the adoption module (ADR 0005)"
  ✗ S2      — "POST /api/normalize/trusted-dictionary-snapshot must be registered"
  ✗ S3      — "ui/src/pages/shared-concepts/TrustedDictionary.jsx is missing"
  ✓ S4 (regression, passes pre AND post): the F1/F2 surfaces stay untouched
  ✗ H1..H3  — "GET /api/trusted-dictionary must answer 200 success:true as a PUBLIC read (got 404)"
  ✗ H4      — "the owner-side mint must succeed: … Cannot POST /api/normalize/trusted-dictionary-snapshot"
              (the unauthenticated-refusal half of H4 already passes: the middleware 401s, accepted as 401/403)
  ✓ H5 (regression, passes pre AND post): the adoption queue is untouched — then teardown

trusted-dictionary: 2 passed, 14 failed, 0 skipped
```
