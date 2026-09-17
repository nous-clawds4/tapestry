# Test Plan: Story 1 — TL membership-method selector (Count only)

**Story:** `engineering-team/stories/trusted-lists/1-tl-method-selector.md`
**ADR:** `engineering-team/decisions/trusted-lists/0001-tl-membership-method-selector.md`
**Date:** 2026-08-27

## Contract pinned by these tests

The ADR leaves the resolver's home open ("exported from `refreshPinnedTags.js` or a small
`membershipMethods.js`"). The tests pin the testable choice: **`src/api/trustedList/membershipMethods.js`**
exporting:

- `METHOD_IDS` — `['count', 'input', 'certainty', 'score']` (all four rungs, wire-stable order)
- `IMPLEMENTED_METHOD_IDS` — `['count']` in this story (rungs 2–4 append here as they land)
- `resolveMembershipMethod()` — reads `getSettings().trustedLists?.membershipMethod`; returns
  it iff it is in `IMPLEMENTED_METHOD_IDS`, else `'count'`. Never throws.

A valid-but-unimplemented id (e.g. `'input'` in settings today) resolves to `'count'` — the
ADR's fail-safe generalized: the pipeline only ever executes a method it implements.

## Coverage map

| Criterion | Test | Test file | Level |
|---|---|---|---|
| AC-5 Default is Count | `U1 defaults.json ships trustedLists.membershipMethod='count'` | `test/tl-membership-method-selector.test.js` | unit (source) |
| AC-2 (contract) | `U2 membershipMethods exports METHOD_IDS (4, ordered) + IMPLEMENTED (count)` | same | unit |
| AC-5 / fail-safe | `U3 no settings file → 'count'` | same | unit |
| AC-5 / fail-safe | `U4 valid-but-unimplemented 'input' → 'count'` | same | unit |
| AC-5 / fail-safe | `U5 garbage string → 'count'`, `U6 malformed settings JSON → 'count' (no throw)` | same | unit |
| AC-2 durable, server-side | `U7 override file 'count' honored per fresh read (disk-read-per-call = no-restart switching)` | same | unit |
| AC-1 Selector exists | `S1 TrustDetermination.jsx renders the panel: all 4 ids present, 3 disabled` | same | source contract |
| AC-2 Pipeline-wide | `S2 panel writes { trustedLists: { membershipMethod } } via PUT /api/settings` | same | source contract |
| AC-6 Local-only | `L0 GUARD /api/publish-policy allowExternalPublish=false — hard FAIL (not skip) if external` | same | live |
| AC-3 Pipeline honors + unchanged output | `L1 pin + apply → refresh → TL publishes with member present, endorsements/disputes counts, cutoff/min-rank tags as today` | same | live |
| AC-4 Auditable on wire | `L2 published TL carries ['membership-method','count']` | same | live |
| edge: settings auth gate | `L3 unauthenticated PUT /api/settings → 401/403` | same | live |

## Edge cases

- [x] Missing settings file (U3), malformed JSON (U6), garbage value (U5).
- [x] Valid-but-future method id stored before its rung ships (U4).
- [x] Unauthenticated settings write (L3).
- [ ] Container-restart durability — architectural property of the persistent-volume
      `settings.json` (ADR Option A); disk-read-per-call is proven at U7; the restart itself is
      operator-verified at the cycle-local smoke, not automated here.
- [ ] Byte-identity vs. pre-story TLs — L1 asserts the full today-shape (members, counts,
      cutoff/min-rank/metric/d-tag); the only permitted delta is the new `membership-method`
      tag (L2). Reviewer should confirm the count path is untouched in the diff.

## Test infrastructure

- Framework: repo's hand-rolled runner — suite registered in `test/test.js`, exports
  `run() → {pass, fail, skipped}`. No new frameworks.
- Live layer mirrors `test/tl-publication-from-pins-publish.test.js`: ephemeral keys via `nak`,
  publish through `POST /api/strfry/publish` (`signAs:'client'`), refresh via docker-exec
  loopback (`http://127.0.0.1:7778` **in-container** — unchanged by host port remaps), TL read
  back via `strfry scan` in the container.
- Unit layer mirrors `test/search-api-result-type-settings.test.js`: `TAPESTRY_SETTINGS_PATH`
  temp file + require-cache bust so `src/config/settings.js` re-reads per test.
- Skips: live tests skip when `nak` missing or control panel unreachable; L0 guard FAILS (not
  skips) if the panel is reachable and publish policy is not local-only.
- Firmware state: none required (no concept definitions change).
- **This machine:** control panel is remapped to `localhost:8778` (see ADR context) — run live
  layer with `BRAINSTORM_BASE_URL=http://localhost:8778`.

## How to run

```
# full gate
BRAINSTORM_BASE_URL=http://localhost:8778 npm test

# just this suite
BRAINSTORM_BASE_URL=http://localhost:8778 node -e \
  "require('./test/tl-membership-method-selector.test.js').run().then(r=>process.exit(r.fail?1:0))"
```

## Verification

The new tests fail with the current code. Confirmed on 2026-08-27 at commit `843ed61b`
(live layer against the running local stack at :8778):

```
▶ tl-membership-method-selector suite (trusted-lists Story 1)
  ✗ U1 defaults.json ships trustedLists.membershipMethod="count" (AC-5)
      defaults.json must ship trustedLists.membershipMethod="count" — got undefined, expected "count"
  ✗ U2 membershipMethods exports METHOD_IDS (4 rungs, ordered) and IMPLEMENTED=["count"]
      src/api/trustedList/membershipMethods.js must exist (ADR 0001 implementation notes; contract pinned by the test plan)
  ✗ U3 resolver: no settings file → "count" (AC-5)                    (same missing-module reason)
  ✗ U4 resolver: valid-but-unimplemented "input" → "count" (fail-safe) (same)
  ✗ U5 resolver: garbage value → "count" (fail-safe)                   (same)
  ✗ U6 resolver: malformed settings JSON → "count", no throw           (same)
  ✗ U7 resolver: override "count" honored on a fresh per-call read     (same)
  ✗ S1 TrustDetermination.jsx renders the TL membership-method panel: 4 ids, 3 disabled (AC-1)
      TrustDetermination.jsx must reference membership-method id "count"
  ✗ S2 panel writes { trustedLists: { membershipMethod } } via the settings API (AC-2)
      the panel must persist through /api/settings (server-side, not localStorage)
  ✓ L0 GUARD publish policy is local-only (AC-6) — pre-existing guard, correctly green
  ✗ L1+L2 pin + apply → refresh → TL keeps today's shape AND carries ["membership-method","count"] (AC-3, AC-4)
      TL must carry a ["membership-method", …] tag (AC-4)
  ✓ L3 unauthenticated PUT /api/settings is rejected — pre-existing auth gate, correctly green
  tl-membership-method-selector: 2 passed, 10 failed, 0 skipped
```

Notably, L1+L2 ran the full live pipeline (tag + apply + pin published, refresh executed, TL
found) and failed **only** on the missing `membership-method` tag — the unchanged-shape
assertions (member, counts, cutoff/min-rank/observer/metric tags) all hold against current
code, pinning "identical to today + one new tag" precisely. The two green tests are
pre-existing guards, not premature passes.
