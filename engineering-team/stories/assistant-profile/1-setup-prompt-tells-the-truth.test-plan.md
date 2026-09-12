# Test Plan: Story 1 — The setup prompt tells the truth

**Story:** `engineering-team/stories/assistant-profile/1-setup-prompt-tells-the-truth.md`
**ADR:** `engineering-team/decisions/assistant-profile/0001-one-setup-state-answer-local-first.md`
**Date:** 2026-09-11

Two files, two halves:

- **`test/assistant-setup-state.test.js`** — the Node runner (registered in `test/test.js`).
  - **U** — `resolveAssistantProfileState` executed with injected fakes (the feedReadPath seam the ADR
    names). Stack-free.
  - **S** — source sentinels on the server.
  - **D** — source sentinels on the dashboard and its new hook. This runner does not transpile JSX.
  - **R** — regressions that pass before and after.
  - **H** — the live contract, GET only.
- **`tests/brainstorm/assistant-setup-prompt.spec.js`** — the Playwright **B** class: what a viewer
  sees on the dashboard. Hermetic: every `/api` route is mocked, so no result depends on what any
  relay holds.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC1 | `U1: a kind 0 on the local relay answers "has a profile" from the local relay alone — no relay query and no import, even when relays are allowed and would fail` | `test/assistant-setup-state.test.js` | unit |
| AC1 | `U6: a publish relay that never answers cannot hold the check — it returns "no profile" within the relay budget` | node | unit |
| AC1 | `D1: the dashboard no longer asks /api/profiles about the instance TA — the pubkeys=null race has nothing left to fire` | node | source |
| AC1 | `D2: the setup check waits for sign-in to resolve, and re-runs when the signed-in user changes` | node | source |
| AC1 | `D5: the dashboard shows the welcome prompt only for a definite "needs setup"` | node | source |
| AC1, AC4 | `B1: a visitor's hard load shows no assistant prompt and no assistant checklist item, and never asks about pubkeys=null` | `tests/brainstorm/assistant-setup-prompt.spec.js` | e2e |
| AC1 | `B2: an Owner whose assistant has a profile never sees the prompt on a hard load — not even for an instant while sign-in resolves` | spec | e2e |
| AC1 (edge) | `B7: when the status check fails, no prompt appears — an error is never "no profile"` | spec | e2e |
| AC2 | `U2: no local profile, but a publish relay has one → "has a profile" (source relay), and exactly the newest valid event is copied to the local relay` | node | unit |
| AC2 (edge) | `U3: if copying home fails, the answer is still "has a profile" …, and the next check tries the copy again` | node | unit |
| AC3 | `U4: no kind 0 by this assistant on the local relay or any publish relay → "no profile", the prompt's trigger` | node | unit |
| AC3 (resolved open question) | `U5: when the publish relays fail, the local relay's answer stands — "no profile", never an error` | node | unit |
| AC3 | `D6: the prompt sends each viewer where they can publish their own assistant's profile — Owner/Admin to /tapestry/settings/assistant, everyone else to /settings` | node | source |
| AC3, AC4 | `B3: an Admin whose own assistant has no profile is prompted about THEIR assistant, is offered no "Surprise me", and is sent to the Tapestry assistant editor` | spec | e2e |
| AC3 | `B4: a Customer whose own assistant has no profile is prompted, and the button leads to /settings — the editor a Customer can reach` | spec | e2e |
| AC3 | `B5: an Owner whose assistant has no profile is prompted, is offered "Surprise me", and is sent to the Tapestry assistant editor` | spec | e2e |
| AC4 | `U7: when the relay fallback is not allowed (an anonymous caller), the answer is the local relay's alone — no relay query, nothing written` | node | unit |
| AC4 | `S2: anonymous status calls stay local-only — the relay fallback is allowed for the assistant's own signed-in user, the operator, or the in-container loopback` | node | source |
| AC4 | `D3: the check asks about the signed-in user's OWN assistant — /api/assistant/status?customerPubkey=<user.pubkey> — never the instance TA` | node | source |
| AC4 | `D4: the check tells "no assistant" (no request) and "unknown" (an error) apart from "needs setup"` | node | source |
| AC4 | `H1: the live status endpoint reports where its answer came from, and an anonymous call is answered from the local relay alone` | node | live |
| AC4 | `B6: a signed-in user with no assistant sees no prompt and no assistant checklist item, and no status request is made` | spec | e2e |
| AC5 | `U8: a "no profile" answer is never sticky — once the profile lands on the local relay (a publish), the very next check says "has a profile"` | node | unit |
| AC5 | `S1: the status endpoint decides hasProfile through the resolver — no kind-0 scan of its own remains` | node | source |
| AC5 | `R1: the editor still reads the same endpoint and field, so the editor and the dashboard share one answer` | node | regression |
| AC5 | `H2: an anonymous call's hasProfile agrees with what the instance's local relay actually holds` | node | live guard |
| AC5 | `B8: after a publish, returning to the dashboard shows no prompt — without a reload` | spec | e2e |
| ADR contract | `U0` (the module exists), `U9` (5-minute negative memo, per assistant), `U10` (the relays asked are the publish relays, `maxWait` 4000), `U11` (`getAssistantPublishRelays()` exported), `S3` (one relay list), `S4` (lazy requires), `S5` (`profileSource`) | node | unit / source |
| Prerequisite | `B0: the served origin runs a build that contains the setup-state check under test` | spec | prerequisite |

## Edge cases

- [x] Relay events by another author, or of another kind, are ignored (U2, U4).
- [x] Several copies on the relays — the newest by `created_at` is the one copied home (U2).
- [x] Copying home fails (U3) — the profile still counts, and the repair is retried.
- [x] The publish relays throw (U5) or never answer (U6).
- [x] An anonymous caller (U7, S2, H1) — no relay traffic, no write.
- [x] The negative memo expires, and is per assistant (U9); it never masks a fresh local profile (U8).
- [x] The status endpoint fails (B7).
- [x] Sign-in resolves slowly (B2 delays it 400 ms) — no transient prompt.
- [x] A signed-in user with no assistant (B6).
- [ ] Two concurrent checks for the same assistant — not tested. The copy-home is idempotent (strfry
      de-duplicates by event id), so the worst case is a redundant import.
- [ ] Real relay traffic — deliberately not tested: no test writes to, or depends on, a public relay.
      U covers the rule with fakes.

## Test infrastructure

- **Node runner:** `node test/test.js`; the new suite is registered alongside `my-curated-dlists-items`
  (require, run, summary lines including an H-class and a B-class pointer, `overallOk`, skip total).
- **Live H-class:** `BRAINSTORM_BASE_URL`, default `http://localhost:7778`. GET only. **The local
  Docker stack serves the shared checkout, not this worktree**, so H1 stays red until the code runs
  there (deployed to staging, or the local stack refreshed from the merged branch). H2 is a guard.
  When the owner has no assistant key on the instance, H1/H2 have nothing to assert and return early.
- **Browser:** Playwright 1.56.1, chromium (installed on this machine). Every `/api` route is mocked;
  unmocked endpoints answer `success: false`, because the dashboard's panels guard on `success` and a
  guessed payload crashes the page (see Verification).
  - It needs an origin serving the **built** UI. From this worktree:
    `cd ui && npm run build && npx vite preview --port 4173 --strictPort`, then
    `BRAINSTORM_BASE_URL=http://localhost:4173`.
  - The `tests/brainstorm` gate is set by `tests/global-setup.js` from a live probe of the base URL —
    see the note under "How to run".
- **Firmware state:** none — no concept changes.
- **Fixtures:** fixture pubkeys only (`a1…`, `aa…`, `bb…` …), never live keys.

## How to run

```
node -e "require('./test/assistant-setup-state.test.js').run()"
```

The full runner is `npm test`. Locally it crashes at suite #2 before printing a summary (OPEN.md
#192), so run this suite on its own and treat CI `stack-free` as the binding gate.

For the browser class, build and serve the UI under test, then:

```
BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/assistant-setup-prompt.spec.js --project=chromium
```

`tests/global-setup.js` sets `BRAINSTORM_SERVER_ACCESSIBLE=true` whenever the base URL answers. A bare
`vite preview` origin does; its `/api/neo4j-health` probe only logs a warning. If the base URL does not
answer at all, global setup throws and the run fails outright, so nothing is silently skipped.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-11 on `feat/assistant-profile-setup-prompt`
at `e3ee5014` (the ADR commit) plus these files.

**Node suite** — 2 passed, 24 failed, 0 skipped; H-class 2 executed. Every failure names what is
missing:

```
FAIL  U0–U10  src/api/assistant/profileState.js does not exist. ADR 0001 creates it and exports
              resolveAssistantProfileState — the one place that decides whether an assistant has a profile.
FAIL  U11     ADR 0001: src/api/assistant/index.js must export getAssistantPublishRelays()
FAIL  S1      AC5: handleAssistantStatus must ask resolveAssistantProfileState (ADR 0001)
FAIL  S2      ADR 0001: handleAssistantStatus must hand the resolver an allowRelayFallback decision
FAIL  S3      ADR 0001: the EXTERNAL_RELAYS constant must go
FAIL  S4      src/api/assistant/profileState.js does not exist (see U0).
FAIL  S5      ADR 0001: /api/assistant/status adds profileSource ('local' | 'relay' | null)
FAIL  D1      AC1: Dashboard.jsx still fetches /api/profiles?pubkeys=… for the setup check
FAIL  D2–D4   ui/src/hooks/useAssistantSetupState.js does not exist
FAIL  D5      AC1: Dashboard.jsx must read setup state through useAssistantSetupState (ADR 0001)
FAIL  D6      AC3: no /settings destination — a Customer's prompt leads to a dead end today
PASS  R1      (regression guard)
FAIL  H1      ADR 0001: /api/assistant/status must report profileSource; http://localhost:7778 does not
PASS  H2      (live guard: status agrees with the local relay today)
assistant-setup-state: 2 passed, 24 failed, 0 skipped
```

**Browser class**, run against `http://localhost:7778`. The control panel's build is from 2026-09-10,
which is the current code. Every `/api` route was mocked, so this exercises only the build's UI:

```
B0  FAIL  the bundle does not contain "needs-setup" (searched 11 JS chunks)
B1  FAIL  AC1: the dashboard asked /api/profiles?pubkeys=null        — the reproduced bug
B2  FAIL  AC1: the prompt appeared for an assistant that HAS a profile (asked /api/profiles for
          ?pubkeys=null and the owner's own pubkey; never asked /api/assistant/status)
B3  FAIL  AC4: the check must ask about the Admin's own pubkey — it asked nothing
B4  FAIL  AC3: a Customer must be sent to /settings — received /tapestry/settings/assistant
B5  pass  (coincidence: the old build prompts every Owner, which is the right outcome for an Owner
          whose assistant genuinely has no profile)
B6  FAIL  AC4: a user with no assistant must not be prompted — the prompt showed
B7  FAIL  a failed check must render nothing — the prompt showed
B8  —     depends on timing against the old build (failed in the full parallel run, passed alone);
          it guards the new hook, which re-asks on every mount, so it is deterministic once implemented
```

**Harness note, for the next browser spec that touches the dashboard.** The first run crashed the
whole page, with "Unexpected Application Error! Cannot read properties of undefined (reading 'derived')".
The catch-all mock answered `success: true` with an array, and the key-status panel rendered per-label
`derived` counts from it. The dashboard has no error boundary, so one panel's unexpected payload
blanks every panel. Fixed in the spec by answering unmocked endpoints `success: false` and giving
`/api/neo4j/query` the shape `cypher()` parses.
