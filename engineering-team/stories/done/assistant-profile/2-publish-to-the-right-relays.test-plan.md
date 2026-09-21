# Test Plan: Story 2 — Publish the assistant's profile to the right relays, and say what happened

**Story:** `engineering-team/stories/done/assistant-profile/2-publish-to-the-right-relays.md`
**ADR:** `engineering-team/decisions/done/assistant-profile/0002-publish-to-configured-relays-report-each.md`
**Date:** 2026-09-12

The tests are in two files, plus one change to story 1's suite:

- **`test/assistant-publish-relays.test.js`** — Node runner tests, registered in `test/registry.js`. All
  of them are stack-free.
  - **L — the publish set.** `getConfiguredPublishRelays` and `getAssistantPublishRelays`, with the
    settings and the local-only flag injected. L5 goes through the real settings module and a temp
    settings file instead.
  - **P — the real per-relay publish.** `publishToRelays` runs against throwaway relays on
    127.0.0.1, built with `ws`. One of them is a TLS relay whose certificate no client trusts.
  - **M — the words.** `publishSubject` and `summarizePublish`.
  - **E — the handler, through its seam.** `createPublishProfileHandler(deps)` with recording fakes.
  - **G — the local-only reader.** `isPublishLocalOnly()` in `src/api/publish-policy`.
  - **S — source sentinels.**
- **`tests/brainstorm/assistant-publish-result.spec.js`** — the Playwright **B** class: what the
  editor shows after a publish. It is hermetic: the server's answer is a route mock, so each test
  decides exactly what the relays said.
- **U11 in `test/assistant-setup-state.test.js`**, updated as ADR 0002's testability note asks. It now
  sets `BRAINSTORM_PUBLISH_LOCAL_ONLY` to `false` while it reads the list. Local-only mode now empties
  the publish set, so without this a developer with the flag exported would see U11 fail.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC1 | `L1: the publish set is exactly the configured general-purpose, profile and WoT relays, in that order — no other relay list` | `test/assistant-publish-relays.test.js` | unit |
| AC1 | `L2: a relay named in several lists, or spelled differently, is published to once — in its first spelling` | node | unit |
| AC1 | `L3: changing the relay lists changes the very next publish set — nothing is cached` | node | unit |
| AC1 | `L5: through the real settings module, editing the relay lists in the settings file changes the very next publish set — no code change, no restart` | node | integration (real settings module, temp file) |
| AC1 | `E3: outside local-only mode the event goes to exactly the configured relays, and the response reports each one — counting only acceptances` | node | unit (handler seam) |
| AC1 | `E6: change the relay lists between two publishes and the second goes to the new lists — no restart` | node | unit (handler seam) |
| AC1 | `S1: no relay URL is written into the assistant publish code any more — the publish set comes from the relay settings` | node | source |
| AC2 | `L7: the setup check and the publisher share one list — index.js hands out the configured set, and in local-only mode it names no relay` | node | unit (real `index.js`) |
| AC2 | `S3: the status handler still hands the setup check getAssistantPublishRelays — so the check follows the publish set (guard)` | node | source |
| AC3 | `L6: in local-only publish mode the publish set is empty — whether the caller passes the flag or the module reads it` | node | unit |
| AC3 | `M5: in local-only mode the result is "kept local", and says local-only publish mode kept it on this instance's relay` | node | unit |
| AC3 | `E2: in local-only mode the profile is saved on this instance's relay only, every configured relay reads "skipped", and the result says why` | node | unit (handler seam) |
| AC3 | `G1: isPublishLocalOnly() is true only for the exact string "true"`, `G2: the publish-policy endpoint and the reader agree` | node | unit |
| AC3 | `B2: in local-only mode, the editor says the profile was kept on this instance's relay, and lists every relay as skipped` | `tests/brainstorm/assistant-publish-result.spec.js` | e2e |
| AC4 | `P1: a relay that answers OK true is "accepted", with the relay's own words as the reason` | node | unit (real publish, local relay) |
| AC4 | `P2: a relay that answers OK false is "refused", with the relay's own reason` | node | unit (real publish, local relay) |
| AC4 | `P5: a port where nothing listens is "unreachable", with the connection error as the reason — at once, not at the deadline` | node | unit (real publish) |
| AC4 | `P6: a relay that closes without answering is "unreachable"; one that sends a NOTICE and then closes is "refused", with the NOTICE as the reason` | node | unit (real publish, local relays) |
| AC4 | `P7: an OK for a different event is not an answer — only the OK naming our event counts` | node | unit (real publish, local relay) |
| AC4 | `M1: the result names the right assistant — …`, `M2: a partial result counts only the relays that accepted — "accepted by 1 of 4" …`, `M3`, `M4: when no relay accepts, the result is "not delivered" …` | node | unit |
| AC4 | `E1: when the local write fails, nothing is sent to any relay, no NIP-05 record is written, and the user is told why` | node | unit (handler seam) |
| AC4 | `E4: the local relay is written first — the relays hear about the profile only after this instance holds it` | node | unit (handler seam) |
| AC4 | `E5: the summary names the right assistant — the Tapestry Assistant for the owner, "your" for a Customer, and the named one when the owner publishes for someone else` | node | unit (handler seam) |
| AC4 | `B1: after a publish, the editor shows the summary, then one line per relay — accepted, rejected with the relay's reason, unreachable with the reason, timed out` | spec | e2e |
| AC4 | `B3: when saving on this instance's relay fails, the editor says so — and shows no relay as tried` | spec | e2e (guard) |
| AC5 | `P3: a relay that answers late — but inside the budget — still counts as accepted` | node | unit (real publish, local relay) |
| AC5 | `P4: a relay that takes the event and never answers is "timeout" at the deadline — and does not stop the relay beside it` | node | unit (real publish, local relays) |
| AC5 | `P8: a relay presenting a certificate no client trusts is "unreachable", naming the certificate — and the relay beside it still gets the event` | node | unit (real publish, local TLS relay) |
| AC5 | `P9: silent, refusing, dead and accepting relays together — every one reported, in input order, all inside one shared deadline` | node | unit (real publish, local relays) |
| AC5 | `L0: … bounds the fan-out at 8 s (ADR 0002)` | node | unit |
| ADR contract | `L0` (the module's exports), `L4` (non-URL entries, empty lists), `P10` (never throws), `P11` (sockets are closed), `E7` (the legacy pages' contract), `E8` (authorization unchanged), `S2` (the old helper is gone), `S4` (lazy requires), `U11` (updated) | node | unit / source |
| Prerequisite | `B0: the served bundle is the new editor — the old one-line relay tally is gone` | spec | prerequisite |

## Edge cases

- [x] The same relay in several lists, or spelled with different case or a trailing slash (L2, E3).
- [x] Entries that aren't relay URLs, missing lists, and no `aRelays` at all (L4). No relays configured
      outside local-only mode (M6).
- [x] A relay that answers late but inside the budget (P3).
- [x] Each failure on its own: a silent relay (P4), a dead port (P5), an early close or a NOTICE (P6),
      an `OK` for another event (P7), an untrusted certificate (P8). All of them together, under one
      deadline (P9).
- [x] A malformed URL, and an empty relay list (P10).
- [x] Sockets are closed once each relay is settled (P11).
- [x] The owner publishing a Customer's assistant (M1, E5).
- [x] A caller who is neither the assistant's user nor the owner (E8).
- [x] A publish with no content, as the legacy pages send (E7).
- [ ] A relay whose `OK` arrives after the deadline. It counts as `timeout`, the same path as P4's
      silent relay, so there is no separate test.
- [ ] NIP-42 `auth-required:`. This is an `OK false` with a reason, the same path as P2, so there is no
      separate test.
- [ ] Real public relays — deliberately not tested. No test writes to, or depends on, a public relay.
- [ ] The legacy pages' rendering. They print `data.message`, and story 5 retires them; E7 pins the
      fields they read.

## Test infrastructure

- **Node runner:** `npm test` runs every suite in `test/registry.js` through the gate engine, and this
  suite is one line there, right after `assistant-setup-state` (honest-test-gate #1). A run's verdict is
  read with `npm run gate:status`.
- **Local relays (P):** `ws` servers on 127.0.0.1, on ephemeral ports.
  - P8's TLS relay is an `https` server with a self-signed certificate generated by `openssl` at test
    time. P8 skips, and says so, if `openssl` isn't installed. It is installed on this Mac and on the
    CI image (`ubuntu-latest`).
  - The P tests pass a `budgetMs` of 1500 ms to keep the suite quick. L0 pins the real 8 s default.
    The timing bounds allow 1 s of scheduling slack.
- **Settings (L5):** a temp `settings.json`, selected through `TAPESTRY_SETTINGS_PATH`
  (`src/config/settings.js:16-17`). The variable and the require cache are restored afterwards.
- **Local-only flag:** `BRAINSTORM_PUBLISH_LOCAL_ONLY` is set and restored around each test that reads
  it (L7, G1, G2, U11). The E-class injects `isLocalOnly` instead.
- **No live class:** nothing here depends on a running stack. A publish writes, so a live test would
  have to publish.
- **Browser:** Playwright 1.56.1 with chromium. Every `/api` route is mocked, using the pattern that
  `ta-composite-avatar.spec.js` has proven on the same page (`/tapestry/settings/assistant`, signed in
  as the owner). The spec needs an origin serving the **built** UI.
- **Firmware state:** none — no concept changes.
- **Fixtures:** fixture pubkeys (`bb…`, `cc…`, `dd…`) and freshly generated nostr keys for signing.
  No live keys.

## How to run

```
node test/assistant-publish-relays.test.js
```

The whole gate is `npm test`, and its verdict is read with `npm run gate:status`. On this machine about 33
suites fail for environmental reasons (the local dev stack), so run this suite on its own and treat CI
`stack-free` as the binding gate.

For the browser class, build and serve the UI under test, then run the spec:

```
cd ui && npm run build && npx vite preview --port 4173 --strictPort
BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/assistant-publish-result.spec.js --project=chromium
```

## Verification

The new tests fail against the current code. First confirmed on 2026-09-12 at `48896819` (the ADR commit).
**Re-confirmed on 2026-09-20 at `9ea0cbaf`**, after merging `origin/staging` (266 commits) into the branch:
the same 39 tests, the same 1 pass and 38 failures. That merge also moved where a suite is registered — the
hand-written runner became `test/registry.js` plus a gate engine (honest-test-gate #1) — so the registration
is now one line in the registry.

**Node suite** — 1 passed, 38 failed, 0 skipped. Every failure names what is missing:

```
FAIL  L0–L7, P1–P11, M1–M6, S4   src/api/assistant/profilePublish.js does not exist. ADR 0002 creates it: the
                                 publish set (getConfiguredPublishRelays, getAssistantPublishRelays), the
                                 per-relay publish (publishToRelays) and the words (publishSubject, summarizePublish).
FAIL  E1–E8   src/api/assistant/index.js does not export createPublishProfileHandler(deps). ADR 0002 gives the
              publish handler a dependency seam (the dlist-curation way) …
FAIL  G1–G2   src/api/publish-policy/index.js does not export isPublishLocalOnly() …
FAIL  S1      AC1: src/api/assistant/index.js still names relays in code: 'wss://relay.primal.net',
              'wss://relay.damus.io', 'wss://nos.lol', 'wss://wot.grapevine.network', 'wss://purplepag.es'
FAIL  S2      ADR 0002: src/api/assistant/index.js still defines publishToRelay …
PASS  S3      (guard: the status handler already passes getAssistantPublishRelays)
assistant-publish-relays: 1 passed, 38 failed, 0 skipped
```

**Browser class**, run against this worktree's own build (`vite preview`, every `/api` route mocked):

```
B0  FAIL  the served bundle still contains "Pushed to local strfry", the tally ADR 0002 removes
B1  FAIL  AC4: "one line per relay" — expected a line reading wss://nos.lol — accepted
B2  FAIL  AC3: each configured relay reads skipped, because of local-only mode
B3  pass  (guard: the editor already shows data.error; it pins that the new message reaches the user)
```

**The test relays behave as the P tests assume.** Most Node tests stop at the missing module, so
their assertions haven't run yet. To make sure that, after implementation, they fail only on
behaviour, a scratch script pointed a raw `ws` client at the same throwaway relays. It doesn't use
the feature's code.

```
TLS self-signed : error "self-signed certificate", then close 1006 — the socket never opens
close, no answer: open, then close 1005
NOTICE then close: open, NOTICE "rate-limited: slow down", then close 1005
malformed URLs  : the ws constructor throws "Invalid URL: …"
terminate       : the server's open-client count drops from 1 to 0 in 26 ms
```

**Regression checks:**

- Story 1's suite passes 28 of 28 on 2026-09-20, with both live checks executed, and the updated U11 passes.
  (On 2026-09-12 H1 failed for an environmental reason: the local stack serves the main checkout, which at
  that moment still predated story 1.)
- `test/global-publish-gate.test.js` passes 8 of 8. Its source pins on `src/api/publish-policy/index.js`
  stay valid, because ADR 0002 keeps the read inside that file.

**Amended in a Phase-3 kick-back (2026-09-20), during implementation.**

- **What failed:** G2 failed against a correct implementation — "with true: allowExternalPublish false vs
  isPublishLocalOnly false".
- **Why:** `withEnv` restores the variable synchronously, so an `async` body reads the restored value
  after its first `await`. The endpoint was called correctly inside the window and answered correctly;
  the assertion's own second read happened outside it.
- **The fix:** a `withEnvAsync` helper holds the variable until the body settles, and G2 uses it.
  Nothing about what G2 asserts changed, and it does not assume the handler is synchronous.
- **Still a judge:** with the endpoint patched to answer a constant instead of consulting the reader,
  G2 fails ("with true: allowExternalPublish true vs isPublishLocalOnly true"). Restored, the suite is
  39 of 39.
