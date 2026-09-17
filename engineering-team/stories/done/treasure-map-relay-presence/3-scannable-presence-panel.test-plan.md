# Test Plan: Story 3 — Make the presence panel scannable

**Story:** `engineering-team/stories/treasure-map-relay-presence/3-scannable-presence-panel.md`
**ADR:** `engineering-team/decisions/treasure-map-relay-presence/0003-scannable-presence-panel.md`
**Date:** 2026-09-07

## Coverage map

All tests live in `test/treasure-map-panel-summary.test.js`, registered in `test/test.js`.
Classes: **M** the precedence rule, **S** structure, **R** sentinels.

| Criterion | Test | Level |
|---|---|---|
| AC-1 collapsed by default, openable | `S1` (defaults closed, page idiom), `S5` (only the rows collapse) | structure |
| AC-2 summary names the most serious finding, not a count | `M1`–`M3`, `M7`–`M9` (the full precedence table), `S2` (comes from the helper; the coverage count is gone) | unit + structure |
| AC-3 differing version's age visible without hovering | `S4` | structure |
| AC-4 no summary asserted before it is known | `M4`, `M5`, `M6` | unit |
| AC-5 nothing already working is disturbed | `R1`, `R2`, `R3` | sentinel |

The precedence table is this story's whole deliverable, so `M1`–`M10` carry the suite. Everything
else is rendering.

## Edge cases

- [x] **The ordering the two criteria don't settle between them** (`M4`). One relay divergent,
      others still pending. AC-2 says divergence outranks everything; AC-4 says don't assert while
      checking. `M4` pins the ADR's resolution — `divergent` **above** `checking`, because a
      divergence is already true and no later answer can revoke it. Read the other way, the most
      important finding would be suppressed for the whole check (~10s on a dead relay).
- [x] **The complement of M4** (`M5`). Everything *else* stays below `checking`: a missing count
      can still fall from 3 to 2, and an all-clear can obviously be withdrawn — so neither may be
      shown early. Three sub-cases: pending+missing, pending+all-agreeing, pending+unreachable.
- [x] **A pending relay is not an agreeing relay** (`M6`) — the counting mistake that would make
      `M5`'s all-clear case pass for the wrong reason.
- [x] **An *older* differing version is divergent** (`M7`). The stale-copy case the story cares
      about most is a relay *behind* local, and an implementation that only checks "newer" would
      miss precisely it.
- [x] **No local copy ⇒ no divergence** (`M8`). With nothing local to differ from, a relay's copy
      is not a divergence; calling it one would raise a caution the user can do nothing with.
- [x] **Empty, null, undefined and garbage input** (`M10`) — the helper runs on every render.
      Also pins `total: 0` on empty input, so an empty panel reports "nothing to say" rather than
      an all-clear over zero relays.
- [x] **Counts survive even when they are not the headline** (`M2`) — AC-2 permits mentioning a
      lower condition alongside a higher one, which is impossible if the helper discards it.
- [x] **The local strfry row participates** (`S3`) — it is one of the reported locations and the
      comparison base, so a summary that skipped it would contradict the rows beneath it.
- [x] **The status light is outside the collapsed region** (`S5`) — a light you must open the
      panel to see is not a light. Pinned by source position, not just presence.

## Test infrastructure

- **Framework:** Node built-in runner — `node test/test.js`. No new framework or dependency.
- **Hermetic:** pure-function and source-level assertions only. No socket, no `nostr-tools`, no
  relay writes — so this suite cannot join the drift/residue classes in OPEN.md rows 13, 75, 126,
  128, 141.
- **Contract pinned:** `summarizePresence(localEvent, rowStates) → { level, counts }` with
  `level ∈ {divergent, checking, missing, unreachable, ok}` and
  `counts = { divergent, missing, unreachable, agreeing, pending, total }`.
- **Concept Graph / firmware:** not used, no precondition.
- **Local full-suite note:** `npm test` is red-by-default here on three unrelated `trusted-lists`
  suites (OPEN.md row 191) — server posture, not code.

## A note on the S-class

`S1`–`S5` are source-level pins, because the deliverable they guard is JSX with no Node-reachable
surface. They are deliberately narrow: `S5` asserts the summary appears *before* the `{open &&`
gate rather than merely existing, and `S4` strips the existing `title={detail}` occurrence before
looking for `{detail}`, so it proves a *second, visible* use rather than passing on the tooltip
that already exists. Neither can pass vacuously — the panel file exists, so an empty read cannot
satisfy them.

Behavioral coverage of the rendered output would need a DOM renderer, which this repo does not
have and which no ADR authorizes adding. Flagged for the Reviewer as the known limit of this plan.

## How to run

```bash
node -e "require('./test/treasure-map-panel-summary.test.js').run().then(r => console.log(r))"
```

Full gate:

```bash
npm test
```

## Verification

Confirmed 2026-09-07 at commit `09407917`:

```
=== 3 passed, 15 failed ===
```

The **15 failures** are the new behavior, each failing because the code does not exist:

```
  ✗ M1..M10  ADR 0003 § Implementation notes 1: ui/src/utils/treasureMap.js must export
             summarizePresence(localEvent, rowStates)
  ✗ S1       AC-1: the panel must default to closed
  ✗ S2       ADR 0003 § Decision: the precedence rule must come from the testable helper
  ✗ S3       ADR 0003 § Decision: local strfry is one of the reported locations …
  ✗ S4       AC-3: `detail` must be rendered as visible text …
  ✗ S5       AC-1: the row list must be gated on the open state
```

The **3 passes** are the sentinels (`R1`–`R3`) — every helper from stories 1 and 2 still exported
and still behaving, the panel's story-1/story-2 surface intact (targets from config, the import
affordance, `probeOne`, `planRelaySync`, the publish gate, no settled batch, no relay or 64-hex
literal), and the page still mounting all four Treasure-Map panels. They pass before and after by
design and fail only on collateral damage.

`node --check test/test.js` passes; the suite is registered at all four touchpoints.
