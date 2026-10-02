# Test Plan: Story 3 — Disposition on My Assistant rows

**Story:** `engineering-team/stories/list-headers-disposition/3-disposition-on-my-assistant-rows.md`
**ADR:** `engineering-team/decisions/list-headers-disposition/0003-my-assistant-disposition-endpoints-and-panel.md`
**Date:** 2026-10-01

Two files:

- **`test/list-headers-my-assistant-disposition.test.js`** (Node runner, registered in `test/registry.js`). It
  has seven groups:

  | Group | What it covers |
  |---|---|
  | K1–K7 | The pure tag composition. |
  | P1–P2 | Parity with Concept Headers' real handlers, run in an isolated child process with stand-in parts. |
  | H1–H12 | The handler, through injected dependencies. |
  | S1–S4 | Structure guards. |
  | U1 | The "whose row is this?" predicate. |
  | R1 | A guard: Concept Headers keeps its gate. |
  | L1–L2 | Live refusals against the local stack. |

  Everything except L1–L2 is stack-free, and nothing in the suite publishes.
- **`tests/brainstorm/list-headers-my-assistant-disposition.spec.js`** (Playwright). M1–M10 cover what a
  signed-in person sees and does. It is hermetic:
  - a catch-all answers every `/api` call it doesn't name;
  - **every WebSocket is mocked** (`routeWebSocket(/.*/)`), so no test reaches a real relay;
  - the two disposition endpoints are answered by a stand-in that holds header state and applies the story's
    rules.

Stories 1 and 2's specs are the page regression and must keep passing.

## Coverage map

| Criterion | Tests | Level |
|---|---|---|
| AC 1: the button on every 39998 row by the viewer's own Assistant, whatever its state, and nowhere else; it opens the panel, not the list | U1; **M1** (Owner, customer, guest without an Assistant, signed out), **M2** | unit + browser |
| AC 2: Submit signs with the caller's own Assistant, keeps every tag but the marker, adds the self-pointing b, saves to relay then graph, sends to the community relay, updates the row; already self-declared re-sends the existing event | K1–K3, K7, P1, H7, H8, H10; **M3**, **M4**, **M5** | unit + browser |
| AC 3: Keep private on undecided rows, never sent out; unavailable beside a real b, with the reason; "already" when private | K4–K6, P2, H9; **M6**, **M7** | unit + browser |
| AC 4: refusals with nothing signed — no session (including from inside the container), not the caller's own Assistant's header (every role), no Assistant, kind 9998 or missing; Concept Headers unchanged | H1–H6, H10, H12; S1; R1; **M8**; **L1**, **L2** | unit + browser + live |
| AC 5: the honest outcome (published / kept here / not delivered, saved here); Keep private never contacts a relay | **M3**, **M9**, **M6** | browser |
| AC 6: Next undecided → walks the viewer's own Assistant's undecided rows; at the end only Done | **M10** | browser |
| ADR 0003: shell-free scan; two routes; registration; no key material in any answer | S2, S3, S4, H11, H12 | unit |

## Edge cases

- [x] Every role against someone else's Assistant's header (H5):
  - a customer asking about the Owner's Assistant's header;
  - the Owner asking about a customer's Assistant's header;
  - an admin asking about the Owner's Assistant's header;
  - a customer asking about their own *account's* header.
- [x] A no-session request that the middleware has marked trusted, through the **real** sign-in check
      (H2, then L1 live).
- [x] The marker beside a real b-tag (K2, K5); an unreadable b-tag (K5); a self-pointing b of any type (K3).
- [x] A same-second re-sign is still strictly newer (K7).
- [x] A failed relay save leaves the graph untouched and leaks no key (H11).
- [x] Every refused or already-done path signs and saves nothing (H1–H6, H8, H9).
- [x] Local-only deployments open no socket at all (M9).

## Test infrastructure

- **Node runner.** To run one suite by itself, call its exported `run()`. Don't run the full `npm test` on
  this machine without asking. Checked before any run: the suite contains no publish markers (`strfry/publish`,
  `signAs`, `nak`).
- **P1–P2** spawn `node -e` with `cwd` at the repo root. Inside that child, `child_process.exec`, the
  normalize helpers, the assistant-key helpers and the auth middleware are replaced. Nothing leaks into the
  gate process.
- **L1–L2 (live)** skip unless `GET /api/assistant/pubkey` answers on `localhost:$TAPESTRY_PORT`, and L1 also
  needs `docker exec tapestry`. They send only requests that must be refused:
  - **L1:** a no-session in-container POST, for both actions. It expects 401, and the header's latest id is
    unchanged.
  - **L2:** a fresh throwaway guest session (verify-user, then a signed kind 22242, then login-user, then
    logout). It expects 403 "no Tapestry Assistant", and the header is unchanged.

  `getCustomerRelayKeys` only reads, so a guest never gets an Assistant (`src/utils/customerRelayKeys.js`).
  CI's stack-free gate skips both.
- **Playwright.** Mocks as in stories 1 and 2, plus:
  - `/api/publish-policy` (open or local-only);
  - the two POST routes;
  - the WebSocket mock, which accepts, rejects, or drops each `EVENT`.

  Markup the spec relies on:
  - the 🧭 cell's button is named **Disposition…**;
  - the panel shows **Disposition: <name>** and buttons **Submit as a Shared Concept**, **Keep private**,
    **Next undecided →**, **Done** and a ✕ close;
  - marks are `span[title]`.

## How to run

```
node -e "const m=require('./test/list-headers-my-assistant-disposition.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
BRAINSTORM_BASE_URL=<a vite preview of a build, or :7778 after /cycle-local> npx playwright test tests/brainstorm/list-headers-my-assistant-disposition.spec.js tests/brainstorm/list-headers-disposition-column.spec.js tests/brainstorm/list-headers-author-options.spec.js --project=chromium
```

## Verification

### The new tests fail with the current code

Confirmed 2026-10-01 at `f7f4f2df`, plus these tests.

- **Node suite:** 1 passed (R1, the guard), 28 failed:
  - K, P and H: the modules don't exist (`src/lib/headerDispositionCompose.js …`,
    `src/api/list-headers/myAssistantDisposition.js … Cannot find module`);
  - U1: `viewerAuthorScope.js must export authorRole`;
  - L1: `a no-session loopback self-declare must answer 401, got 404`;
  - L2: `a guest with no Assistant must get 403 …, got 404`.

  Both live tests ran against the local stack. The routes don't exist yet, so they answer 404.
- **Playwright,** on a build of `f7f4f2df`: 10 failed. M1 fails with
  `for the Owner, "ta undecided a" has Disposition… button`; M2–M10 fail with
  `story AC 1: "<row>" has a Disposition… button`.

### The tests can pass, and they catch the defects they're meant to catch

A throwaway build that does exactly what ADR 0003 describes was made outside the repo: the compose module,
the handler, the registration, `authorRole`, the actions module, the panel and the page edits. It isn't
committed.

- **Node:** 27 of 27 pass. L1 and L2 were skipped, because the oracle's server isn't in the container. They're
  proven at Implementation, after `/cycle-local` deploys the real routes.
- **Playwright:** 10 of 10 pass, and 50 of 50 with `--repeat-each=5`. Stories 1 and 2's specs pass on the
  same build (18 of 18).

Each mutant below changes one rule of that build. The unmutated control passes 27 of 27, and every mutant
fails at least one test:

| Mutant | Fails |
|---|---|
| m1: the button follows the Owner's Assistant for everyone | M1 (`for a customer, "ta undecided a" has no Disposition… button`) |
| m2: acting doesn't update the row | M3, M4, M6, M9, M10 |
| m3: Keep private broadcasts too | M6 (`Keep private never sends anything to a relay`) |
| m4: Keep private is never disabled | M7 |
| n1: a trusted no-session call is treated as the Owner | **H2**, S1 |
| n2: no Assistant falls back to the Owner's | **H3** |
| n3: no author check | **H5** |
| n4: Submit keeps the marker | K2, P1, H7 |
| n5: Submit writes the `inherit` type | K1, P1. This shows parity isn't vacuous: Concept Headers' real handler disagrees |
| n6: the graph is written before the relay | H7, H11 |
| n7: key material in an error answer | H11 |
| n8: the shell-quoted scan | S2 |

A first run of the server mutants showed H2 and U1 failing in *every* mutant. The cause was my scratch tree,
which had no `node_modules` (the real sign-in check needs it) and no `ui/`. The table above is from the
corrected tree, where the unmutated control passes.

## Review round 1 (ADR 0003 Amendment 1)

The review (`engineering-team/reviews/list-headers-disposition/3-disposition-on-my-assistant-rows.md`) asked for
three fixes and recommended a fourth. These tests pin them:

| Ask | Tests | Level |
|---|---|---|
| A request from another site is refused first, before the sign-in check; same-host and no-`Origin` requests go on (Amendment 1 §2) | **H13**, **S5** | unit |
| The relay's latest header must verify before anything is signed, saved, or answered "already" (§1). Covered cases: a forged signature; another author; kind 9998; a first `d` that differs from the URL; already self-declared or private but forged. All answer 409 with nothing signed, and a sound header is verified exactly once | **H14** | unit |
| The handle is used as Express decoded it: `a%41` stays `a%41`, and a lone `%` is a 404, not a 500 (§3) | **H15**, **S5** | unit |
| On a 70-row list, **Disposition…** on the last row opens a panel inside the viewport, below the fixed 48 px bar, and **Next undecided →** keeps it there (§4) | **M11** | browser |

**Re-aimed helpers.** These are test changes, so they belong to this phase:
- `request()` now passes the *decoded* handle as `req.params.handle`, which is what Express hands over. It used to
  pass the raw path segment. It also takes `origin` and `host`.
- `deps()` now injects `verify`, "valid" unless a test says otherwise. The default verifier loads nostr-tools from
  the container path, which the host doesn't have.
- The browser fixtures take an `extraOwnRows` count.

All 29 earlier Node tests and all 10 earlier browser tests still pass after the re-aim.

### Verification, round 1

**The new tests fail with the current code.** Confirmed 2026-10-01 at `f05bcfd8`, plus these tests.

- **Node:** 29 passed, 4 failed:
  - H13: `a foreign Origin (self-declare) must answer 403 …, got 200 … "declared"`;
  - H14: `a forged signature (self-declare) must answer 409 …, got 200 … "declared"`;
  - H15: `a d-tag of "a%41" is looked up as "a%41", not "aA" — got ["aA"]`;
  - S5: `the module defines sameHost(req)…`.
- **Playwright,** on a build of `f05bcfd8`: 10 passed, 1 failed. M11 fails with
  `the panel for "ta bulk 070" is inside the viewport after the click`.

**The tests can pass, and they catch the defects they're meant to catch.** Amendment 1 was applied to the
throwaway build outside the repo. It isn't committed.

- **Node:** 31 of 31 pass (L1 and L2 were skipped, because the oracle isn't in the container).
- **Playwright:** 145 of 145 for all three List Headers specs with `--repeat-each=5`.

| Mutant | Fails |
|---|---|
| r1: the same-host check after the sign-in check | H13, S5 |
| r2: "already" answered before verification | H14 |
| r3: no first-`d` check | H14 |
| r4: no author check on the looked-up header | H14 |
| r5: the second decode put back | H15, S5 |
| r6: the verifier without the JSON round-trip | S5 |
| today's UI (no scroll into view) | M11 |

The first S5 draft compared against the *first* `requireAuth(` in the file, which is the default dependency, not
the handler's call. So it failed on a correct oracle. It now looks inside the handler factory's body. That was a
test fault, caught on the oracle before the gate.

## Review round 2 → round 3 (test-only)

Review round 2's blocking item 4: L1 formatted curl's status itself (`docker exec … curl -w '%{http_code}'`). The
gate guard `test/gate-result-record.test.js` C9 forbids that, under ADR honest-test-gate/0001 §6.

- **The re-aim:** L1 now calls `loopbackRequest({ container, method: 'POST', url, body: {}, timeoutS: 20 })` from
  `test/helpers/stackHttp.js`, and asserts `r.status === 401` with `describeResponse(r)` in its message. The
  "header unchanged" check stays. Nothing else in the suite changes, and no source file changes.
- **Checked on the host:**
  - the suite passes 33/0/0, with both live refusals executed against the deployed handler;
  - `gate-result-record` passes 34/0/0, C9 included;
  - the suite has no remaining `%{http_code}` or `__STATUS__`;
  - pointed at a dead port, the helper reports "no response from the stack", so L1 fails honestly when the stack
    is down, instead of reading a status that was never sent.
- **The isolated full gate (ledger row `2026-09-30-npm-test-step-leaks-fixtures` recipe)** runs on a clone with
  the re-aimed suite copied in. The record is therefore `dirty: 1`. Review re-runs it on the commit.
