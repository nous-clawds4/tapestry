# Test Plan: Story 1 — The one answer, and the hub's first real mark

**Story:** `engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md`
**ADR:** `engineering-team/decisions/assistant-identification-tags/0001-one-assistant-attention-answer.md`
**Date:** 2026-09-22

Two halves, as the previous books' plans: a Node suite for everything the runner can execute or read, and a
browser spec for what a viewer sees. The approved words, the four taggings, the canonical author and the canned
answers live in one fixture both halves require, `test/helpers/identificationTagsFixtures.js`, so they cannot
disagree about what was approved.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 the required list | L2 the canonical author and addresses; L3 the four in order with name, slug, signer, target, address; L4 the d-tag and signer/target composers | `test/assistant-attention.test.js` | unit (the shared library) |
| AC-2 whose Assistant, and only theirs | U1 no session asks nothing; U2 no assistant; U14 the Owner's is the TA, a Customer's their own; U15 no query parameter changes the answer; U16 no pubkeys in the answer | same | dependency-injected |
| AC-3 present | U3 all local: present, finished, local, no relay read, ≤ 3 scans by address; U4 a local miss asks the tag relays with only the missing address, newest counts; U5 latest stance wins, tie by lowest id; U6 polarity; U7 another author's same-named tag counts; U8 others' stances do not; U11 own-relay exclusion; L5 the polarity reader | same | dependency-injected |
| AC-4 finished, with a reason | U9 local-unreadable, no-outside-relays, outside-unreachable; U10 a hanging relay loses the budget | same | dependency-injected |
| AC-5 the hub reads it, for this action only | C2 CHECKED_ACTIONS; C3 the two readings of `assistantAttention(user, attention)`; C4 the picker's `assistantPhase`; D3 the hub and the slot read the answer; B1 done → nine marks, "9 actions", pill 9; B2 pending → ten, 10; B3 unfinished → hub ten, pill 9; B4 the fetch fails → hub ten, pill 9; B5 no pill while the answer is on its way, then the answered count only | same; `tests/brainstorm/assistant-attention.spec.js` | ESM in Node; browser |
| AC-6 the definitions, reported, never gating | U12 found, not found, with its eventId; U9 unfinished definitions | `test/assistant-attention.test.js` | dependency-injected |
| AC-7 read-only, one request | S2 the module never writes, reads no query, reads strictly; D1 the provider fetches once with no parameters and re-checks on a published tagging; B6 one GET per full load, no parameters, nothing but GETs, nothing new inside the app | same; the spec | source; browser |
| ADR sub-decisions 1, 3, 8, 9 | L1 the library is dependency-free CommonJS; D4 the Vite alias and CommonJS include; S3 reuses `setup/status`'s strict pieces and leaves that file alone; S4 the tag-relay category; C4 the picker's default; S1 the route is registered and documented; D2 the provider is mounted inside `SetupStatusProvider` | same | source |
| Guards that pass before and after | R1 the publisher's d-tag rule; R2 the one-argument answer (assistant-management #1 D7) | same | regression |
| The live contract | H1 an anonymous GET answers `{ success: true, signedIn: false }` (skips when no instance answers, or on a Node without `fetch`) | same | live |

## Edge cases

- [x] No session, an empty session, `authenticated` not exactly `true`, a non-hex session pubkey (U1).
- [x] A viewer with no assistant: nothing scanned, nothing read (U2).
- [x] Two events at one address on an outside relay: the newest wins; a `created_at` tie goes to the lexically lowest id (U5).
- [x] Polarity absent, `"1"`, `"-1"`, `"0.2"`, junk (U6, L5).
- [x] A tagging pointing at a community member's same-named tag (U7); another person's dispute and apply (U8).
- [x] A failed local scan; no tag-federation relay configured (this dev stack); every relay unreachable, throwing, or silent past the budget (U9, U10).
- [x] Loopback and this instance's own host in the relay list; a duplicate spelling; a non-URL entry (U11).
- [x] A definition found locally with its id; not found after a relay answered; unfinished (U12, U9).
- [x] The action's flags across five mixes of present, missing and unfinished, with the invariants (U13).
- [x] The merge with no answer, a failed fetch, a `checking` phase, done, pending, unfinished, and for a visitor or a viewer without an assistant (C3).
- [x] The picker while the answer is on its way, with setup first, and with no `assistantPhase` given (C4, B5).
- [ ] Concept Graph API unavailable: not applicable; nothing here reads the graph.

## Test infrastructure

- **Framework:** the Node runner (`test/registry.js` → `test/helpers/gateRunner.js`; every suite exports `run()`) and
  Playwright (`playwright.config.js`). A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- **Node:** the host has Node 16, which has no `fetch` (H1 skips) and cannot run Playwright. Every run below used the
  scratchpad Node 22.23.2 x64 (memory `host-gate-at-ci-parity`).
- **Stack-free by design:** the U-class drives `src/api/assistant/attention.js` through the five dependencies ADR 0001
  names; the fake relay and the fake local scan answer a filter by its `kinds`, `authors` and `#d`, so the suite
  also pins *what* is asked. The L- and C-classes are pure modules loaded in Node (the ESM ones through
  `import(pathToFileURL(…))`). The S- and D-classes read source.
- **Live:** H1 GETs `/api/assistant/attention` on `BRAINSTORM_BASE_URL` (else `localhost:7778`). It answers 404 on
  this dev stack until the backend is restarted with the route (the repo is bind-mounted; the server process is not
  reloaded on a source edit).
- **Browser:** `BRAINSTORM_BASE_URL` must serve the *built* UI under test (B0 guards it); every `/api` route is mocked.
  `/api/setup/status` always answers "all done" so the Assistant pill has its turn.
- **Concept graph / firmware:** none. No concept changes.
- **Fixtures:** `test/helpers/identificationTagsFixtures.js` (new): the four required taggings, the canonical author
  (hex and npub), `canonicalTagAddress`, `taggingDTag`, and the canned answers `SIGNED_OUT`, `NO_ASSISTANT`, `DONE`,
  `PENDING`, `UNFINISHED`. `test/helpers/assistantManagementFixtures.js` (the hub's words) is reused.

### Re-aims (the Tester's lane, as ADR 0001 § Notes for Test Design asks)

- `tests/brainstorm/assistant-alert.spec.js` and `tests/brainstorm/assistant-management-page.spec.js`: their mocks
  now answer `GET /api/assistant/attention` with the `PENDING` fixture, so every "10" those classes pin stays true
  (a checked action counts only from a finished answer; the catch-all's failure would have read as nine).
- `test/registry.js`: `assistant-attention.test.js` registered after `assistant-alert.test.js`.
- Nothing else changed. `test/assistant-management-page.test.js` D7 and `test/assistant-alert.test.js`'s picker tests
  hold as they are (ADR 0001 sub-decisions 6 and 8 keep the one-argument answers); R2 here re-states D7.

## How to run

The Node suite alone (never `node test/x.test.js`; call `run()`), with the scratchpad Node 22 first on the PATH:

```
PATH=<node22>/bin:$PATH node -e "require('./test/assistant-attention.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

The browser class, after `scripts/dev-refresh.sh --ui` (the UI must be rebuilt: a source edit is invisible to it):

```
BRAINSTORM_BASE_URL=http://localhost:7778 npx playwright test tests/brainstorm/assistant-attention.spec.js --project=chromium
```

After the change, run the *whole* of every suite the re-aims touch, not only their re-aimed tests (ledger
`2026-09-22-parallel-books-no-shared-line-recheck`): `assistant-alert.spec.js`, `assistant-management-page.spec.js`,
and the setup book's `setup-alert.spec.js`, `setup-alert-polish.spec.js` and `setup-status.spec.js`, which share the
top bar.

**The book's gate.** One gate-engine run, read back with `npm run gate:status -- --label <label>`. The full
`npm test` is not the gate here: it is red by default on this host (memory `host-gate-at-ci-parity`). The
Implementer runs a labelled baseline before changing code and compares the two records suite by suite.

```
GATE_LABEL=assistant-identification-tags-1 PATH=<node22>/bin:$PATH node - <<'EOS'
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';   // the two env vars test/test.js sets
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';
const { execSync } = require('child_process');
const { runGate } = require('./test/helpers/gateRunner');
const { suites } = require('./test/registry');
const PAT = "App\\.jsx|avatarMenuLinks|pages/assistant|styles\\.css|api/assistant/index|api/assistant/?[^/]|topBarAlert|TopBarAlert|BrainstormUserMenu|components/Header|DevPage|assistantManagementFixtures|identificationTagsFixtures|identification-tags|assistantAttention|AssistantAttentionContext|api/assistant/attention|setup/status|SetupStatusContext|setupStatus|vite\\.config|openapi|api/index\\.js|SetupAlert|setup-alert";
const named = execSync(`/usr/bin/grep -lE '${PAT}' test/*.test.js`).toString().trim().split('\n').map((p) => p.replace(/^test\//, ''));
const walkers = execSync('/usr/bin/grep -l readdirSync test/*.test.js').toString().trim().split('\n').map((p) => p.replace(/^test\//, ''));
const want = new Set([...named, ...walkers]);
const missing = [...want].filter((f) => !suites.some((s) => s.file === f));
if (missing.length) { console.error('not in test/registry.js:', missing.join(', ')); process.exit(2); }
runGate({ suites: suites.filter((s) => s.file && want.has(s.file)), label: process.env.GATE_LABEL });
EOS
```

### Pinned gate list (computed 2026-09-22 on `e83f1bf5`, 119 suites)

- **The filename grep finds 107 suites.** Its pattern covers every path the story touches (the app root, the menu
  constants, the assistant pages, the slot and its mounts, the assistant API and its index, the setup status modules
  and provider, the Vite config, the OpenAPI document, the shared fixtures) and the setup book's pill suites.
- **The walkers** are `grep -l readdirSync test/*.test.js` (24 suites, 12 of them not already named): the suites that
  read every file under `ui/src`, `src`, `public`, BIBLE, `ledger/` or `test/`.
- All 119 are in `test/registry.js`. The command computes its list when it runs.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-22 at base `e83f1bf5` plus this phase's test files
(uncommitted at the time of the run), with Node 22.23.2.

**`test/assistant-attention.test.js`:** 2 passed, 35 failed, 0 skipped. The two passes are the guards R1 and R2.
Every failure names what is missing:

```
FAIL  L1–L5        src/lib/identification-tags/index.js does not exist. ADR 0001 sub-decision 1 creates it: …
FAIL  U1–U17       src/api/assistant/attention.js does not exist. ADR 0001 § Implementation notes 2 creates it: …
FAIL  C1, C3       ui/src/utils/assistantAttention.js does not exist. ADR 0001 § Implementation notes 3 creates it: …
FAIL  C2           CHECKED_ACTIONS: want ["identification-tags"], got undefined
FAIL  C4           checking: want none, got {"pill":"assistant","count":9}
FAIL  S1           src/api/index.js must register app.get('/api/assistant/attention', …)
FAIL  S2           src/api/assistant/attention.js does not exist
FAIL  S3           requires ../setup/status for scanLocalStrict / outsideOnly / RELAY_BUDGET_MS
FAIL  S4           src/api/assistant/attention.js does not exist. …
FAIL  D1           ui/src/context/AssistantAttentionContext.jsx does not exist — ADR 0001 § Implementation notes 4 creates it
FAIL  D2           imports { AssistantAttentionProvider } from ./context/AssistantAttentionContext
FAIL  D3           the hub: no useAssistantAttention(); the hub: assistantAttention(user, …) must take the answer; the slot: …
FAIL  D4           ui/vite.config.js aliases @tapestry/identification-tags
FAIL  H1           expected 200 {"success":true,"signedIn":false} for a request with no session; got 404 null
PASS  R1, R2
assistant-attention: 2 passed, 35 failed, 0 skipped
```

**`tests/brainstorm/assistant-attention.spec.js`** against the build `localhost:7778` serves today (which predates
the story): 1 passed, 6 failed. B2 passes by coincidence (the current build marks ten and counts ten whatever the
answer). The failures:

```
✘ B0  the bundle served by http://localhost:7778 does not ask /api/assistant/attention (searched 11 JS chunks) …
✘ B1  the hub with the check done: expected { marks: 9, count: 9, idMarked: false }, received ten marked
✘ B3  the pill counts a checked action only from a finished, missing answer: Expected 9, Received 10
✘ B4  Expected 9, Received 10
✘ B5  no Assistant pill while the attention answer is on its way: Expected 0, Received 1
✘ B6  one attention read for the load: Expected length 1, Received length 0
```

The two re-aimed browser classes were not re-run at this phase (their mocks gained one route; nothing they assert
changes until the build does). The Implementer runs them whole after the UI rebuild, per § How to run.
