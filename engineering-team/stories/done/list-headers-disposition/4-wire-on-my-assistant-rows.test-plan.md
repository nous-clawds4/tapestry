# Test Plan: Story 4 — Wire to an external shared concept on My Assistant rows

**Story:** `engineering-team/stories/done/list-headers-disposition/4-wire-on-my-assistant-rows.md`
**ADR:** `engineering-team/decisions/done/list-headers-disposition/0004-wire-on-my-assistant-rows.md` (extends ADR 0003 and
its Amendment 1)
**Date:** 2026-10-01

Story 4 extends story 3's two files, because it reuses their fixtures, stand-ins and parity harness:

- **`test/list-headers-my-assistant-disposition.test.js`** (already registered) gains:
  - **W1–W4:** `composeWire`;
  - **P3:** parity with Concept Headers' `handleBAppend`, in the same isolated child process;
  - **HW1–HW6:** the handler's `b-append` action.

  It also re-aims three earlier tests for the third action:
  - **S3** now expects three routes;
  - **H2** (the real sign-in check) and **L1** (live, in the container) now cover `b-append` too.
- **`tests/brainstorm/list-headers-my-assistant-disposition.spec.js`** gains **W1–W7**. The stand-in server learns
  Wire's rules, and `GET /api/relay/external` serves two community Shared Concepts. It counts reads, and can hold them
  to show the searching state.

## Coverage map

| Criterion | Tests | Level |
|---|---|---|
| AC 1: the Wire section (field, a **Wire** button disabled while empty, the community pick-list by name with descriptions, "Searching…" while loading, picking fills the field) | browser **W1** | browser |
| AC 2: Wire signs with the caller's own Assistant, keeps every tag but the marker, adds a pointer b, saves to the relay then the graph, broadcasts, updates the row, then offers Next / Done; a second target keeps both | W1, W2, P3, HW3, HW5; browser **W2**, **W3**, **W6** (kept here) | unit + browser |
| AC 3: already wired to that target — nothing signed, the existing event re-sent, "already" said | W3, HW4; browser **W4** | unit + browser |
| AC 4: a non-address or the header's own address — nothing signed, a reason given, Submit named for the own address | W4, HW2; browser **W5** (no request at all) | unit + browser |
| AC 5: every story-3 refusal applies to Wire; Concept Headers unchanged | HW1, H2, R1, live L1 | unit + live |
| ADR 0004: the target is checked before the relay is read; verification before "already-wired"; Submit and Keep private ignore a body; the pick-list read once per panel session | HW2, HW4, HW6; browser **W7** | unit + browser |

## Edge cases

- [x] The target with surrounding spaces is trimmed (HW3).
- [x] Target forms that aren't addresses: empty, spaces only, a short pubkey, a bare event id, a missing body (HW2).
- [x] An already-wired header that fails verification is refused (409), not answered "already-wired" (HW4).
- [x] Wiring a self-declared row keeps the self-declaration (browser W3, W2 composition).
- [x] Kept-private rows lose the marker when wired (W2, HW3, browser W3).

## The threat list

This step comes from story 3's review: a meta ledger row asks for an adversarial pass at Test Design on a story that
signs. Each threat maps to a test:

| Threat | Test |
|---|---|
| Wiring someone else's Assistant's header | HW1 |
| No session, including from inside the container | HW1, H2, L1 |
| Another site | HW1 |
| A forged or foreign header in the relay | HW1 (verify → 409), HW4 (before "already") |
| The wrong key | HW3 |
| A crafted target | HW2. A non-string target becomes text and is refused unless it is an address. |
| Arbitrary tags or content | Only the target comes from the request, composed as a `pointer` b (W1, P3) |

## Test infrastructure

- **Node runner.** Run one suite by itself through its exported `run()`, and check it for publish markers first. It
  has none, and no hand-formatted curl status. L1 goes through `test/helpers/stackHttp.js`.
- **The full gate runs isolated at Test Design** (ledger row `2026-09-30-npm-test-step-leaks-fixtures`), so guard
  suites see the new tests before Review does.
- **Playwright** uses the same hermetic mocks, with the additions above. Markup the spec relies on:
  - the Wire field's placeholder contains `kind:pubkey:d-tag`;
  - a button named exactly **Wire**;
  - pick-list entries are buttons named by the Shared Concept's name, with its description as `title`.

## How to run

```
node -e "const m=require('./test/list-headers-my-assistant-disposition.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
BRAINSTORM_BASE_URL=<a vite preview of a build, or :7778 after /cycle-local> npx playwright test tests/brainstorm/list-headers-my-assistant-disposition.spec.js tests/brainstorm/list-headers-disposition-column.spec.js tests/brainstorm/list-headers-author-options.spec.js --project=chromium
```

## Verification

### The new tests fail with the current code

Confirmed 2026-10-01 at `fd312135`, plus these tests.

- **Node, on the host:** 31 passed, 13 failed:
  - W1–W4 and P3: `composeWire` is missing;
  - HW1–HW5 and H2: `unknown disposition action: b-append`;
  - S3: two routes, not three;
  - L1, live: `a no-session loopback b-append must answer 401, got HTTP 404`.

  Story 3's tests all still pass. HW6 passes too, as a guard: Submit already ignores a body.
- **Playwright,** on a build of `fd312135`: 7 failed (W1–W7), each with a sentence, for example
  `the panel has a Wire address field` or `the pick-list offers "somebody elses concept"`. M1–M11 passed.
- **The isolated full gate** (`20261002T011719Z-20-6842`, on `fd312135` plus these test files): FAIL, 4518 passed,
  12 failed, 593 skipped, 257/257 suites. **The only failing suite is this one** (30/12/2), so no guard suite trips
  on the new tests.

### The tests can pass, and they catch the defects they're meant to catch

A throwaway build of ADR 0004 was made outside the repo: `composeWire`, the `b-append` action with step 4b,
`wireAndBroadcast`, the host and the Wire section. It isn't committed.

- **Node:** 42 of 42 pass (L1 and L2 skip, because the oracle isn't deployed).
- **Playwright:** 36 of 36 for all three List Headers specs, and 180 of 180 with `--repeat-each=5`.

Each mutant below changes one rule of that build. The unmutated control passes 42 of 42, and every mutant fails at
least one test:

| Mutant | Fails |
|---|---|
| m1: the pick-list hook back inside the keyed panel, so Next refetches | browser W7 |
| m2: no client-side target checks | browser W5 (`no request is sent`) |
| m3: Wire reported with Submit's messages | browser W2, W3, W4, W6 |
| n1: Wire keeps the marker | W2, P3, HW3 |
| n2: the target checked after the lookup | HW2 |
| n3: no own-address check | HW2 |
| n4: the target not trimmed | HW3 |
| n5: "already-wired" answered before verification | HW4, H14 |
| n6: Wire writes the `inherit` type | W1, P3, HW3 |

## Review round 1 (ADR 0004 Amendment 1)

| Ask | Tests | Level |
|---|---|---|
| The target is a string (§1) | **HW7**: a number, an array, an object with a `toString`, `null`, a missing body. Each gets 400 before the lookup. | unit |
| No control or format characters (§1) | **HW8**: NUL, ESC, TAB, U+202E, U+200B; browser **W8**, with no request | unit + browser |
| At most 1024 UTF-8 *bytes* (§1) | **HW9**: exactly 1024 bytes passes; 1025 fails; 548 multibyte characters that are 1025 bytes fail. Browser **W8**. | unit + browser |
| Only list headers: the literal kind 39998 (§2, owner decision) | **HW10**: kind 1, 39999, `039998`, 9998; browser **W8**, and **W5** with its new sentence | unit + browser |
| The own address compared by parts (§3) | **HW11**: plain and padded. It already passes on today's code as a guard: with the exact-kind rule, comparing parts and comparing strings agree. | unit |
| Read back before the graph, for all three actions (§4) | **HW12**: the order is sign, relay, read back, graph. The read asks for the signed id. Not kept gives 502 with no graph write; a failed read gives 502 with no graph write. Browser **W9** shows the 502 with the row unchanged; it already passes on today's code, since the panel already shows server errors. | unit + browser |
| The guard sentence (review non-blocking 4) | **W5**, Node | unit |

**Re-aimed in this phase:**
- **HW2** expects the new "…list header's address…" sentence.
- **Browser W5** expects it too.
- **`deps()`** injects `isStored`, "stored" unless a test says otherwise.
- **The browser stand-in server** applies the amended target rules.

### Verification, round 1

**The new tests fail with the current code.** Confirmed 2026-10-01 at `994e0666`, plus these tests.

- **Node, on the host:** 44 passed, 7 failed:
  - HW2, HW7: the old sentence;
  - W5: `{"refused":"self"}`;
  - HW8, HW9, HW10: control characters, 1025 bytes and kind 1 were all `wired`;
  - HW12: no read-back, so the order was `sign, publishLocal, importToGraph`.
- **Playwright,** on a build of `994e0666`: 18 passed, 2 failed. W5 has the old sentence. W8's oversized target sent a request.
- **The isolated full gate** (`20261002T014752Z-20-0616`, on `994e0666` plus these files): FAIL, 4530 passed, 7 failed,
  593 skipped. **The only failing suite is this one** (42/7/2).

**The tests can pass, and they catch the defects they're meant to catch.** Amendment 1 was applied to a throwaway
build outside the repo. It isn't committed.

- **Node:** 49 of 49 pass (L1 and L2 skip, because the oracle isn't deployed).
- **Playwright:** 190 of 190 for all three specs with `--repeat-each=5`.

| Mutant | Fails |
|---|---|
| m1: the panel without the byte check | browser W8 (`no request is sent`) |
| r1: no type check (the target turned into a string) | HW7 |
| r2: no control or format check | HW8 |
| r3: characters counted instead of bytes | HW9 |
| r4: any kind | HW10 |
| r5: no read-back | HW12 |
| r6: the graph written before the read-back | HW12 |
| r7: a failed read-back still writes the graph | HW12 |
