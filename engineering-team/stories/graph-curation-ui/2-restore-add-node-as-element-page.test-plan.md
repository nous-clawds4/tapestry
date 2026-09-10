# Test Plan: Story 2 — Restore the "Add Node as Element" page

**Story:** `engineering-team/stories/graph-curation-ui/2-restore-add-node-as-element-page.md`
**ADR:** `engineering-team/decisions/graph-curation-ui/0002-shared-author-display-util.md`
**Date:** 2026-09-09

## Test level, and why

There is no jsdom or testing-library in this repo (ADR `graph-curation-ui/0001`), so a React
page cannot be mounted. The harness's two available levels are *executed* pure ESM utils and
*source-level* assertions over JSX (`test/event-page-ui.test.js:10-16`).

This is exactly what ADR 0002 was chosen for. The crash lives entirely inside
`authorDisplayName`, and moving it into a pure util puts the story's central criterion on the
executable side of that line: **U1–U5 genuinely run the code that threw.** Had the fix stayed
in place (Option A), the only available assertion would have been a grep over the file.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 page renders, no error screen | `U1` plain object read without throwing | `test/add-node-as-element-restore.test.js` | unit (executed) |
| AC-1 (edge) | `U2` missing / empty / null profiles degrade, don't throw | same | unit (executed) |
| AC-1 (wiring) | `S1` page imports the util, defines no copy, contains no `.get(` profile read | same | source |
| AC-2 author display | `U3` owner / assistant / Dave badges; stranger unbadged | same | unit (executed) |
| AC-2 fallbacks | `U4` role labels when unnamed; `display_name` when `name` absent; `name` wins | same | unit (executed) |
| AC-2 truncation | `U5` 8-char prefix + `…`; full pubkey never rendered | same | unit (executed) |
| AC-2 narrowing | `R2` candidate Cypher still carries an `n.pubkey` predicate | same | source (sentinel) |
| AC-3 label filter | `R1` candidate Cypher still carries a label predicate | same | source (sentinel) |
| AC-4 already-added marked | `R3` existing-elements query + `existingUuids` still present | same | source (sentinel) |
| AC-5 confirm adds element | `R4` review step still calls `addNodeAsElement({conceptUuid, nodeUuid})` | same | source (sentinel) |
| AC-5 (server half) | `R5` `POST /api/normalize/add-node-as-element` + handler still registered | same | source (sentinel) |
| AC-6 breadcrumb | `S3` crumb reads "Add Node as Element"; route path unchanged | same | source |
| ADR consequence | `S2` `nodes/Index.jsx` adopts the util, drops its copy | same | source |
| ADR decision 3 | `S4` `useProfiles` JSDoc no longer promises a `Map` | same | source |

`U*` and `S*` fail now and must pass after. `R*` pass **before and after** — they exist to
catch working behavior being removed while the page is restored, which is the live risk in a
change that rewrites a component's helper and edits a second, healthy page.

## What this plan does NOT cover — stated plainly

- **No test clicks through the flow.** Nothing here mounts the page or presses Confirm. The
  flow is owner-gated and the automated browser has no NIP-07 signer, so AC-5 is covered by
  wiring sentinels on both sides (`R4`, `R5`), not by an end-to-end exercise. **The Reviewer
  must open `/tapestry/concepts/:uuid/elements/add-node` on `:7778` by hand** and confirm the
  picker renders, the filters narrow, and a confirm lands an element. That manual step is part
  of this story's verification, not an optional extra.
- **No live-API tier, deliberately.** A first draft posted to the endpoint to prove liveness
  and got HTTP 401 — and an *unregistered* path under `/api/normalize/` returns 401 too,
  because auth middleware runs before routing resolves. The assertion could not distinguish
  "route exists" from "route does not exist": it would have looked like coverage while proving
  nothing. Replaced with `R5`, which reads the registration at the source and does
  discriminate. Recorded here so the absence is not mistaken for an oversight.
- **`nodes/Index.jsx`'s rendered dropdown** is covered only by `S2` plus the shared `U*`
  behavior tests. That page is a regression surface this story creates (ADR 0002
  Consequences); a reviewer should eyeball `/tapestry/databases/neo4j/nodes` too.

## Edge cases covered

- [x] `profiles` absent (`undefined`) — the first render of every page using `useProfiles`.
- [x] `profiles` empty (`{}`) — the pre-fetch state, and the exact shape that made `?.` useless.
- [x] `profiles` `null`.
- [x] A pubkey with no profile at all → truncated-pubkey fallback.
- [x] `display_name` present but `name` absent; both present (`name` wins).
- [x] A pubkey matching none of owner / TA / Dave → no badge.
- [x] Full pubkey must never reach the dropdown label.

Not covered: concurrent calls (the util is pure and synchronous) and Concept-Graph-API
unavailability (this story makes no concept-graph call).

## Test infrastructure

- Framework: Node built-in runner, `node test/test.js`. No new infrastructure added.
- New suite `test/add-node-as-element-restore.test.js`, wired into `test/test.js` at all five
  registration points (require, `run()`, summary line, `overallOk` gate, skip aggregate).
- No stack required — every test in this suite is stack-free and runs with Docker down.
- Firmware state: none. This story changes no concept definition; **no `POST /api/firmware/install`.**
- Fixtures: throwaway non-secret constant pubkeys defined in the suite. No real identity, and
  no TA pubkey literal — the util takes every identity as a parameter, per CLAUDE.md.

## How to run

```
node -e "require('./test/add-node-as-element-restore.test.js').run()"
```

Full suite:

```
npm test
```

## Verification

Confirmed failing for the right reasons on 2026-09-09 at commit `bda2cad6`. Every `U*` failure
names the missing export; every `S*` failure names the unchanged source and quotes it. No
failure is an import error or a typo.

```
  ✗ U1 (AC1): authorDisplayName reads a PLAIN OBJECT of profiles without throwing — the crash that killed the page
      ui/src/utils/authorDisplay.js must export authorDisplayName({ profiles, pubkey, ownerPubkey, taPubkey, davePubkey }) — not implemented yet (ADR graph-curation-ui/0002, decision 1).
  ✗ U2 (AC1): missing, empty, or null profiles degrade to the short pubkey instead of throwing
      ui/src/utils/authorDisplay.js must export authorDisplayName(...) — not implemented yet (ADR graph-curation-ui/0002, decision 1).
  ✗ U3 (AC2): owner / assistant / Dave each get their badge; a stranger gets none
      ui/src/utils/authorDisplay.js must export authorDisplayName(...) — not implemented yet (ADR graph-curation-ui/0002, decision 1).
  ✗ U4 (AC2): each identity falls back to its role label when no profile name is known, and uses display_name when name is absent
      ui/src/utils/authorDisplay.js must export authorDisplayName(...) — not implemented yet (ADR graph-curation-ui/0002, decision 1).
  ✗ U5 (AC2): the pubkey is truncated to 8 characters plus an ellipsis, never rendered in full
      ui/src/utils/authorDisplay.js must export authorDisplayName(...) — not implemented yet (ADR graph-curation-ui/0002, decision 1).
  ✗ S1 (AC1): AddNodeAsElement consumes the shared util and no longer carries its own copy or a .get() profile read
      AddNodeAsElement.jsx must import authorDisplayName from the shared util (ADR 0002 decision 2) — the util being correct does not help while the page keeps its own broken copy.
  ✗ S2 (ADR 0002 consequence): nodes/Index adopts the same util — the second copy goes too
      nodes/Index.jsx must import the shared authorDisplayName (ADR 0002 decision 2). Wiring only the broken page would leave the divergence that caused this bug.
  ✗ S3 (AC6): the breadcrumb for the add-node route reads "Add Node as Element"
      the crumb must read 'Add Node as Element' — "Add Node" reads as "add a node to Neo4j", the opposite of what the page does (story AC6). Route line is currently: { path: 'elements/add-node', element: <AddNodeAsElement />, handle: { crumb: 'Add Node' } },
  ✗ S4 (ADR 0002 decision 3): the useProfiles docstring no longer promises a Map
      the JSDoc must stop claiming Map<pubkey, ...> — it returns useState({}), a plain object. That false docstring is what invited the bad copy-paste (ADR 0002 "The contract question").
  ✓ R1 (AC3): the candidate query still narrows by Neo4j label
  ✓ R2 (AC2): the candidate query still narrows by author pubkey
  ✓ R3 (AC4): nodes already elements of this concept are still identified for marking
  ✓ R4 (AC5): the review step still wires Confirm to the add-node-as-element endpoint
  ✓ R5 (AC5): the add-node-as-element route is still registered server-side

add-node-as-element-restore: 5 passed, 9 failed, 0 skipped
```
