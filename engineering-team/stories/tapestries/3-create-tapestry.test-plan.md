# Test Plan: Story 3 — Create a Tapestry (members-only authoring)

**Story:** `engineering-team/stories/tapestries/3-create-tapestry.md`
**ADR:** `engineering-team/decisions/tapestries/0003-create-tapestry-authoring.md`
**Date:** 2026-07-24

## Strategy

Two levels, matching the ADR's testability guidance and the exploration-page precedent:

- **`test/create-tapestry.test.js`** — the **binding, stack-free** Node suite (`node test/test.js`). It
  unit-tests the pure wire-shape builder `tapestryDraft.mjs` via dynamic `import()` (the highest-value
  coverage — the exact kind-39999 element the directory + Exploration page must render), plus source
  sentinels on the page/hook/index (the shape a browser exercises fully), plus regression guards.
  Fixtures are grounded in **live** concept-header data (TA `e00ed090…df36`), and ADR Decision 2-A's
  dedup invariant was confirmed live (concept `dog` `word.slug` == its `dog-concept-graph` header-node
  slug), so `test P5` pins real behavior.
- **`tests/brainstorm/tapestry-create.spec.js`** — the Playwright round-trip (network-mocked),
  `BRAINSTORM_SERVER_ACCESSIBLE`-gated → skipped in stack-free CI, run in the cycle-staging smoke
  (same pattern as `tapestry-exploration.spec.js` / `admin-tools-dashboard-panel`).

## Coverage map

| Acceptance criterion | Test(s) | File | Level |
|---|---|---|---|
| **Owner-gated** (owner sees form; non-owner blocked) | `S1`, `S5` / `S6`; `E1`, `E2` | `test/create-tapestry.test.js`; `tests/brainstorm/tapestry-create.spec.js` | source + e2e |
| **Compose** (title req., desc opt., pick ≥1 concept by name) | `P3`; `S3`; `E1`, `E4` | both | unit + source + e2e |
| **Publish shape** (kind-39999, z-tag, one node+import/member) | `P1`,`P2`,`P4`,`P5`,`P6`; `E4` | both | unit + e2e |
| **Signing selector, owner-enforced** (own-key → client; TA → assistant; non-owner TA refused) | `S2`,`S4`; `R3` (server 403 half); `E4`,`E6` | both | source + e2e |
| **Round-trips** (navigate to new tapestry; appears + explorable) | `P2` (uuid); `E5` | both | unit + e2e |
| **Validation & failure visible** (no title / no concept blocks; nothing published) | `P7`,`P8`; `E3` | both | unit + e2e |

Regression guards (PASS pre and post): `R1` (shipped read-path model `composeGraph`/`inferNodeType`
untouched), `R2` (directory query intact), `R3` (server's TA-sign 403 gate preserved — the server half
of the signing AC).

## Edge cases

- [x] Empty title → `buildTapestryDraft` throws (`P7`) and the form blocks (`E3`).
- [x] Zero selected concepts → throws (`P8`) / blocked (`E3`).
- [x] **Clean dedup** — member node uses the descriptive `word.slug` so it merges with its resolved
  import instead of rendering twice (`P5`; ADR Decision 2-A, verified live).
- [x] Non-owner cannot mint a TA-signed event (`R3` server 403 + `E2` no affordance).
- [ ] Empty concept graph (picker returns `[]`) → empty-state, not a crash. *(Behavioral; covered by the
  hook's empty-state + manual/cycle-staging check — the Node suite pins the source path in `S3`.)*
- [ ] Relay/publish failure surfaces an error, no partial tapestry. *(AC covered by `E3`-style handling;
  full failure-injection deferred to the cycle-staging smoke — mock returns success here.)*

## Test infrastructure

- **Framework:** Node built-in runner (`node test/test.js`) + Playwright (`npm run test:playwright`). No
  new frameworks.
- **Registration:** `test/create-tapestry.test.js` is required and run in `test/test.js`, wired into the
  **live** `overallOk` chain (before the severed terminator — OPEN.md #43) so its failures gate.
- **Live-API dependency:** none required to run the tests. Fixtures were *grounded* against the live
  graph at `localhost:7778` (TA `e00ed090…`), but the committed tests are self-contained (no live calls).
- **Playwright mocks:** `/api/strfry/scan` (kind-39998 → concept headers), `/api/strfry/publish`
  (captures body), `/api/assistant|owner/pubkey`, `/api/relays`, `/api/status`, `/api/auth/*`,
  `/api/profiles`, and an injected `window.nostr` for the own-key path.
- **Fixtures:** two real concepts — `dog` and `golden-retriever` — with their live `word.slug` /
  `oNames.singular` shapes.

## How to run

```
npm test
```

Browser round-trip (operator smoke; needs a running server):
```
BRAINSTORM_SERVER_ACCESSIBLE=true npm run test:playwright -- tapestry-create
```

## Verification

New tests fail with the current code (feature unimplemented). Confirmed 2026-07-24 by running the suite
in isolation — **15 fail for the right reason, 3 regression guards pass**:

```
✗ P1..P9  Cannot import ui/src/pages/tapestries/tapestryDraft.mjs — the Implementer must create this … module
✗ S1,S2   NewTapestry.jsx does not reference hasAdminAccess / the signing selector (still the inert placeholder)
✗ S3,S4   ui/src/pages/tapestries/useCreateTapestry.js missing
✗ S5      Index.jsx does not gate the create button with hasAdminAccess
✗ S6      NewTapestry.jsx still carries the placeholder markers ("Coming soon" / aria-disabled)
✓ R1,R2,R3  regression guards pass (read-path model, directory query, server TA-sign 403 gate intact)
RESULT: {"pass":3,"fail":15}
```
