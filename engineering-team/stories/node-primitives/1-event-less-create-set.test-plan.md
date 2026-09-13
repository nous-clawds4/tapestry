# Test Plan: Story 1 — Create a set with no event behind it (strfry-free create-set)

**Story:** `engineering-team/stories/node-primitives/1-event-less-create-set.md`
**ADR:** `engineering-team/decisions/node-primitives/0001-event-less-add-subset-primitive.md`
**Date:** 2026-09-12

## Coverage map

One suite, `test/event-less-create-set.test.js`, registered in `test/test.js`. U and S classes run
everywhere and gate CI; the H class runs live over container loopback and SKIPs unless the target
container serves this feature's probe.

| Criterion | Test | Level |
|---|---|---|
| AC-1 Create | H1 — 200 `created` at the lettered address, registered under `set`, durability `note`, no event id, the five would-be tags with importEventDirect's uuids, and an unchanged TA-authored strfry count | live (H) |
| AC-1 | U5 — no TA pubkey → 500 naming it; nothing written | unit (U) |
| AC-1 | U6 — `set` concept unresolvable → 500 naming it and firmware install; nothing written | U |
| AC-1 | U7 — `set` concept's superset absent → 500, before the parent lookup (ADR decision 3); nothing written | U |
| AC-1 | U8, U9 — `buildSubsetTags`: order d, name, z, s (then description); tag uuids by importEventDirect's formula | U |
| AC-1 | S1 — `nodes.js` requires exactly crypto, neo4j-driver, ./firmware, middleware/auth, lib/dtag; no signing or strfry names | structural (S) |
| AC-1 | S4 — the module header states the event-less contract and the durability note | S |
| AC-2 No duplicates | H2 — identical repeat → `already-existed`, `hasEvent:false`, no `note`; still one node, one parent edge, five tags | H |
| AC-2 | H3 — the name with other case and padding → the same set | H |
| AC-2 | H4 — a lettered set of that name under the parent → `already-existed` naming it, `hasEvent:true`; no twin created | H |
| AC-3 Guards | U1 — authenticated non-owner → 403 before any Cypher | U |
| AC-3 | U2 — unauthenticated-shaped caller → 403 before any Cypher | U |
| AC-3 | U3 — a trusted local operator passes the gate and reaches the graph checks | U |
| AC-3 | U4 — missing or malformed fields → 400 naming the field; no Cypher | U |
| AC-3 | H6 — missing parent → 404 naming it; blank name → 400; parent neither Superset nor Set → 400; nothing created | H |
| AC-3 | H7 — unauthenticated host-side POST → 401 (default container only; a regression guard that passes pre-implementation) | H |
| AC-4 Behaves like any set, stays private | H8 — the Organization (Sets) view's own query lists the set with direct and total counts; the canonical count includes a member held only by the set; the publish traversal omits the set | H |
| AC-5 Survives reinstall | H10 — under a manifest concept's superset (`nostr-kind`), after firmware install: the set (still no event id), its parent link, its `set` membership, and its member links | H (scratch only, opt-in) |
| Book frame — shipped | U10, S2, S3, H0 — the probe's exact body, zero requires, both routes registered in `registerNormalizeRoutes`, every advertised operation a registered POST | U / S / H |
| ADR decision 6b | H5 — an address held by an unplaced node → 409 naming it; nothing linked | H |

## Edge cases

- [x] Name variants: other case and padding (H3); a lettered twin (H4); a slug collision with an unplaced node (H5).
- [x] Parent that doesn't exist, or is neither a Superset nor a Set (H6); non-string fields (U4).
- [x] TA pubkey, `set` concept, or its superset unavailable (U5–U7).
- [x] A member reachable only through the set is counted (H8).
- [x] Set Detail's own lookup finds the event-less set, with the TA as author (H9 — the ADR's reason for keeping the `NostrEvent` label).
- [ ] Concurrent identical calls — not tested. The ADR makes the write MERGE-idempotent; the surface is a single-operator tool.
- [ ] Zero rows from the write statement → 500 — an internal guard, unreachable without scripting lookups (below).

## Test infrastructure

- **Runner:** Node's built-in runner, `node test/test.js`.
- **U-class stubs:** `src/lib/neo4j-driver` (every call answers no rows) and `src/api/normalize/firmware.js` (a
  fake TA built at runtime) sit in `require.cache` only while a fresh `nodes.js` loads; the real entries are
  then restored, so no later suite inherits them. The real `auth` and `dtag` modules load first, so they never
  capture a stub.
- **Why graph outcomes aren't U-class:** the ADR fixes the order of the checks but not the shape of each
  lookup. Scripting rows for 404, 409, `already-existed` or `created` would pin implementation details
  (roles/tester.md), so those run live against real Neo4j.
- **H-class target:** `TAPESTRY_CONTAINER` (default `tapestry`). Every request — including the TA-pubkey lookup
  and the strfry count — goes over container loopback, so the suite works on a scratch container with no
  published ports (the host's `:7778` is the shared stack). The class SKIPs, never fails, unless the target
  serves `GET /api/normalize/node-primitives`.
- **Scratch instance:** `scripts/scratch-stack.sh up` (built in Phase 4, per the ADR) boots a throwaway instance
  running this checkout's `src/`, with firmware installed, and prints its container name.
- **Firmware state:** the target must have had firmware installed (the `set` and `nostr-kind` concepts must
  exist). H10 installs it again.
- **Fixtures:** throwaway nodes prefixed `test-nodeprim-<stamp>` — a concept header and superset, three
  members, a lettered set, and an unplaced node holding one address — plus every set the suite creates,
  and H10's two throwaway members (placed under the target's `nostr-kind` superset, because a fresh
  instance has no `nostr-kind` elements of its own), all removed in `run()`'s `finally`.
- **No-event bracket:** author-scoped to the target's own TA (ADR test-suite-hermeticity/0001).

## How to run

```
npm test
```

The suite alone:
```
node -e "require('./test/event-less-create-set.test.js').run()"
```

The live matrix on a throwaway instance (after Phase 4):
```
TAPESTRY_CONTAINER=$(bash scripts/scratch-stack.sh up) node -e "require('./test/event-less-create-set.test.js').run()"
```

Adding the firmware-reinstall check (criterion 5) — never against `tapestry`:
```
NODE_PRIMITIVES_REINSTALL=1 TAPESTRY_CONTAINER=<scratch container> node -e "require('./test/event-less-create-set.test.js').run()"
```

Tear the scratch instance down with `bash scripts/scratch-stack.sh down`.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-12 at commit `3258a0c6` (the suite itself not yet
committed), against the shared stack, which does not serve the probe:

```
--- event-less-create-set tests (epic node-primitives, Story 1) ---
  FAIL  U1 (AC-3): an authenticated NON-owner session gets 403 before any Cypher runs, with zero child_process calls
        src/api/normalize/nodes.js does not exist yet — the event-less add-subset primitive (ADR node-primitives/0001 Option A) is not implemented.
  FAIL  U2 … U9 — the same "nodes.js does not exist yet" message
  FAIL  U10 (book frame "shipped"): the probe handler answers 200 with the exact static evidence body, byte-identical on repeat
        src/api/normalize/nodePrimitivesProbe.js does not exist yet — the node-primitives deployment probe (ADR node-primitives/0001 decision 1) is not implemented.
  FAIL  S1 — nodes.js does not exist yet
  FAIL  S2 — nodePrimitivesProbe.js does not exist yet
  FAIL  S3 (AC-1, AC-3): POST /api/normalize/add-subset and GET /api/normalize/node-primitives are registered in registerNormalizeRoutes, and every advertised operation is a registered POST
        registerNormalizeRoutes must require ./nodes inline (ADR Implementation notes).
  FAIL  S4 — nodes.js does not exist yet
  NOTE  live matrix skipped: container 'tapestry' does not serve GET /api/normalize/node-primitives (status 404) — it runs code without this feature. To run it against a throwaway instance: TAPESTRY_CONTAINER=$(bash scripts/scratch-stack.sh up)
  SKIP  H0 … H9
  NOTE  H10 runs only with NODE_PRIMITIVES_REINSTALL=1 and TAPESTRY_CONTAINER naming a scratch container (never `tapestry`): a firmware reinstall must not touch the shared stack.
  SKIP  H10 (AC-5)

event-less-create-set: 0 passed, 14 failed, 11 skipped
```

Every failure names the missing feature; none is a syntax or import error in the suite. The H class runs for the
first time in Phase 4, against a scratch instance.
