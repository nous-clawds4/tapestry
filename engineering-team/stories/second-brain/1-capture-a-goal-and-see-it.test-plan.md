# Test Plan: Story 1 — Capture a goal and see it

**Story:** `engineering-team/stories/second-brain/1-capture-a-goal-and-see-it.md`
**ADR:** `engineering-team/decisions/second-brain/0001-goal-capture-and-goals-view.md`
**Date:** 2026-07-22

## Coverage map

One suite: `test/capture-a-goal-and-see-it.test.js` (registered in `test/test.js`'s live gating chain, before the severed terminator — OPEN.md #43). Classes per test-hermeticity-ci/0001: U = executed stack-free (always gates), S = source assertions (always gate), H = live local stack (per-test SKIP when absent), R = regression sentinels (pass before and after).

| Criterion | Test(s) | Level |
|---|---|---|
| AC 1 — capture recorded (name, statement, origin, capture date) | **H4** capture round-trip via the create-element contract, asserted by **read-back** through `GET /api/brain/goals` (not response success — publishToStrfry silent-drop bug); **U2** row→record mapping; **U5** capture-date resolution (capturedOn wins; created_at fallback; null degrade) | live + unit |
| AC 2 — goal renders with standing word `captured` | **U4** deriveStanding; **H1** every returned goal carries `standing:'captured'`; **S7** the view renders only the canonical lowercase word | unit + live + source |
| AC 3 — legacy goals adopted; strays never render as goals; no parallel store | **H1** the three legacy goals present by name; **H2** no `superset for the concept…` name / no `*-superset` uuid in the response; **U3** non-goal rows classified out; **S2** import-surface pin (the read rides Neo4j only) | live + unit + source |
| AC 4 — canonical cold-start empty state, one action | **S5** byte-exact style-guide sentence in `Goals.jsx` | source |
| AC 5 — privacy line verbatim, indicator not control | **S5** byte-exact line; **S5b** no toggle/checkbox/switch vocabulary in the view | source |
| AC 6 — no banned jargon; canonical standing words only | **S8** jargon scan over quoted strings + JSX text (unambiguous subset — see Limits); **S7** later-story standings absent | source |
| ADR d2 — schema extended (optional origin/capturedOn; required unchanged) | **H3** live schema node assertion | live |
| ADR d3 — owner-gated read; host-remote refused | **H5** host-side unauthenticated GET → structured 403; **S2** in-handler gate pattern present | live + source |
| ADR d3 — response contract | **H6** every goal has `{uuid,name,statement,origin,capturedOn,createdAt,standing}` | live |
| ADR d4 — core surface + sort | **U1** exports pinned (story 2 reuse surface); **U6** capture-date-descending sort | unit |
| ADR d5 — route/nav/gate/hook wiring | **S9** `/tapestry/goals` route + `ownerOnly:true` nav; **S6** platform pair-check gate; **S10** hook fetches the endpoint with AbortController; **S12** skeleton + retry states | source |
| ADR d7 — no publish machinery; house rules | **S11** no nostrPublish/publishEverywhere in new UI files; **S4** no 64-hex literal in any new file; **S1** dependency-free core; **S3** module registered | source |
| Regression | **R1** Layout ownerOnly filter (the nav mechanism); **R2** create-element route (the capture contract's ride) | sentinels |

## Edge cases

- [x] Malformed / missing / alien json tag on a class-thread row → classified out, never thrown (U3).
- [x] Record with neither capturedOn nor created_at → null date, never "Invalid Date" (U5).
- [x] Mixed date sources sort correctly (U6).
- [x] Host-side (remote-class) caller → 403, structured body (H5).
- [x] Strays (incoming HAS_ELEMENT edges) excluded structurally (H2).
- **Concept-absent instance** (staging/second-operator): `{success:true, goals:[]}` per ADR d3 — *not locally testable* (the concept exists here and deleting it is forbidden test behavior). Covered structurally at review; the staging deploy smoke is the natural live check (staging lacks the concept).
- **Empty-state render**: source-level only (S5) — no jsdom in this harness by design.

## Test infrastructure

- Node built-in runner via `npm test` (suite also runnable alone: `node test/capture-a-goal-and-see-it.test.js`).
- H-class reaches the stack both ways (relationship-primitives plumbing): host `http://localhost:7778` + container loopback `docker exec tapestry curl http://127.0.0.1:7778`. Both must answer or H tests SKIP.
- TA pubkey resolved at runtime per test run via `/api/assistant/pubkey` — never hardcoded.
- Firmware state: none required. No firmware reinstall is involved (ADR: the concept is runtime-created).
- **Fixture (H4):** one goal element, fixed sentinel name `harness capture round-trip goal` (deterministic uuid `39999:<TA>:harness-capture-round-trip-goal-1903378a`). Pre-cleaned idempotently, created via the capture contract, torn down in `run()`'s `finally` — Neo4j `DETACH DELETE` + `strfry delete --filter='{"ids":[…]}'` with a **verified** zero-count; teardown failure surfaces as a loud suite failure with the manual cleanup command (residue would otherwise resurface via strfry→Neo4j sync). Teardown plumbing was exercised for real during test-design verification (one residue event created and fully removed; graph verified clean).

## Tester notes / deviations

1. **Core module format:** the ADR sketch says "pure ESM"; the tests pin **CommonJS with zero require/import** instead — the core is consumed by the CJS server module, and the binding property is purity (S1), not module format. Flagged at the Phase-3 gate.
2. **Jargon scan scope (S8):** only the unambiguous banned words (`superset, pubkey, payload, concept header, acceptance criteria, lease`) are asserted mechanically — `element/kind/event/schema` occur in legitimate code identifiers (`addEventListener`…) and cannot be scanned without false positives. The Reviewer's style-guide audit owns the full list (AC 6 stays review-enforced; the test is the tripwire).
3. **AC 1's confirmation sentence** (*"Goal captured."*) is uttered by the conversational agent, not by code this story ships — not automatable here; verified at review/demo per the ADR (API responses are not owner-facing).
4. **H tests currently fail against the live stack** (route 404, schema unextended) — that is the correct pre-implementation state, not a skip.

## How to run

```
npm test
```

Suite alone (fast iteration):

```
node test/capture-a-goal-and-see-it.test.js
```

## Verification

The new tests fail with the current code. Confirmed 2026-07-22 at commit `83e43d39` (stack present, so H-class ran live rather than skipping):

```
--- capture-a-goal-and-see-it tests (epic second-brain, Story 1) ---
  FAIL  U1…U6            (src/lib/brain/goals.js does not exist yet)
  FAIL  S1…S12           (API module, page, hook, route/nav wiring absent)
  FAIL  H1/H2/H4/H6      (loopback GET /api/brain/goals → HTML 404 "Cannot GET /api/brain/goals")
  FAIL  H3               (schema extension not applied: tapestryOwnerGoal.properties.origin missing)
  FAIL  H5               (got 404 — route not registered yet; expected the in-handler 403)
  PASS  R1               (Layout ownerOnly filter — sentinel)
  PASS  R2               (create-element route — sentinel)

capture-a-goal-and-see-it: 2 passed, 25 failed, 0 skipped
```

Fixture hygiene verified post-run: strfry count 0, Neo4j count 0 for the fixture pattern. `node --check` clean on both the suite and the edited `test/test.js`.
