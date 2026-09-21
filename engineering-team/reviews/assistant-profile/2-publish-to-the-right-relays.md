# Review: Story 2 — Publish the assistant's profile to the right relays, and say what happened

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-20
**Diff:** `git diff 9ea0cbaf..HEAD` — `9027a534` (tests) → `31792e69` (test fix, kicked back from Phase 4) → `90f54a09` (implementation)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — the gate's own record:

```
20260921T004752Z-8991-c9d3 [review-assistant-profile-2] started 2026-09-21T00:47:52.653Z on 90f54a09
— FAIL, exit 1, 3397 passed, 87 failed, 45 skipped, 212/212 suites
```

  **The verdict is FAIL, and none of it is this story.** The three suites this diff bears on all pass
  inside that run: `assistant-publish-relays` 39/0 (207/212), `assistant-setup-state` 28/0 (206/212),
  `global-publish-gate` 8/0 (91/212). The 33 failing suites are the live-tier set this box always
  fails from a worktree: the local Docker stack at `:7778` bind-mounts the **main** checkout, so every
  live assertion there is made against another branch's build (memory: "Worktree sessions: :7778 serves
  the MAIN checkout"; OPEN.md rows 27 / 192-era environmental set).

  Checked rather than assumed — the same suites on the untouched shared checkout, without any of this
  story's code:

  | Suite | Baseline (shared checkout) | In this run |
  |---|---|---|
  | `profile-tags` | 10 passed, 3 failed | 10 passed, 3 failed |
  | `capture-a-goal-and-see-it` | 24 passed, 3 failed | 24 passed, 3 failed |
  | `summaries-element-count` | 7 passed, 6 failed | 7 passed, 6 failed |
  | `tl-weighted-sum-method` | 5 passed, 3 failed, 1 skipped | same |
  | `tl-certainty-method` | 4 passed, 3 failed | same |
  | `tl-membership-method-selector` | 11 passed, 1 failed | same |

  `profile-lookup-bounds` has no baseline (it arrived with staging, after the shared checkout's
  commit); its single failure is its own `E2 (live, AC5)` assertion against `:7778` — "got
  limit=undefined" — i.e. the older build the stack serves, not this diff, which touches nothing in
  that path. CI `stack-free` is the binding gate for this branch.

- [x] `npm run test:playwright` — the two specs that bear on this diff, against a fresh build of this
  worktree served by `vite preview`: `assistant-publish-result` **4/4** (B0–B3) and
  `ta-composite-avatar` **5/5** (it renders the same editor). The rest of the Playwright suite needs a
  live instance, which a worktree does not have.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build_ — `cd ui && npm run build` exits 0 (the browser class runs against that build).

## Spec adherence

- [x] Every acceptance criterion has a passing test.

| Criterion | Tests | Where the behaviour lives |
|---|---|---|
| **AC1** — exactly the configured general-purpose, profile and WoT relays; changing the lists changes the next publish, with no code change | `L1`–`L5`, `E3`, `E6`, `S1` | `src/api/assistant/profilePublish.js:62-90` reads the three lists through `getSettings()` on every call; `src/api/assistant/index.js:353-357` publishes to it. `L5` proves it through the real settings module and a temp settings file; `S1` proves no relay URL is left in code. |
| **AC2** — every relay the setup check consults is in the publish set | `L6`, `L7`, `S3` | One function: `getAssistantPublishRelays` (`profilePublish.js:98-104`), exported from `index.js:553` and handed to the resolver at `index.js:440`. `L7` runs both sides and compares; with local-only on, both are empty. |
| **AC3** — local-only publishes locally and says so | `L6`, `M5`, `E2`, `G1`, `G2`, `B2` | `index.js:353-357` builds `skipped` rows and opens no socket; `profilePublish.js:216-231` writes the sentence. One reader for the flag: `src/api/publish-policy/index.js:22-36`. |
| **AC4** — a line per relay, an honest summary, and nothing sent outward if the local write fails | `P1`, `P2`, `P5`–`P7`, `M1`–`M4`, `E1`, `E4`, `E5`, `B1`, `B3` | `profilePublish.js:108-176` classifies each relay from what it did; `:212-216` counts acceptances only; `index.js:336-347` returns 500 with `stage: 'local'` before any socket. |
| **AC5** — slow, dead or bad-certificate relays don't stop the others, and the result is bounded | `P3`, `P4`, `P8`, `P9`, `L0` | One deadline for the whole fan-out (`profilePublish.js:180-187`), default 8 s. `P9` proves three silent relays share it rather than queueing. |

- [x] No criterion silently dropped.
- [x] No behaviour added beyond the story: the diff touches the publish path, the flag reader and the
      editor's result block. Nothing else.

## ADR adherence

- [x] Files match ADR 0002's implementation notes one for one: new `src/api/assistant/profilePublish.js`;
      `isPublishLocalOnly()` exported from `src/api/publish-policy/index.js`; `index.js` loses the
      literal relay list, the old `publishToRelay` and the now-unused `ws` require, and gains
      `createPublishProfileHandler(deps)`; the editor renders a line per relay.
- [x] The seam carries exactly the dependencies the ADR named, and the per-relay table (`accepted |
      refused | unreachable | timeout`, plus `skipped`) matches its rows, including "a NOTICE then a
      close is the relay refusing" and "an OK for another event is not an answer".
- [x] Layering: the vocabulary is reused, not re-implemented — the outcome comes from
      `classifyBroadcast` (`src/lib/broadcastOutcome.js`), and the per-relay words are the browser
      chokepoint's (ADR honest-publish-reporting/0001).
- [x] No new dependencies. `ws`, `nostr-tools` and the settings module are all required lazily inside
      their functions (`S4`), so the module still loads in a bare checkout.
- **One deviation, in the tests and recorded there:** the ADR suggested a stand-in WebSocket object for
  AC5's certificate case; the Tester used a real TLS relay with an openssl-generated certificate
  (test plan § Test infrastructure). That is stronger evidence and constrains the implementation less.
  Accepted.

## Concept-graph integrity

- [x] No concept definition, handle or schema changes. The ADR cites `39998:<TA>:nostr-relay` as
      orientation only.
- [x] **Firmware reinstall: not required.**

## Things tests can't catch

- [x] No secrets, keys, TODOs or debug statements added (diff scanned for all of them).
- [x] Every socket path settles exactly once — the `settled` guard in `finish()`
      (`profilePublish.js:114-124`) — and settling clears the timer and terminates the socket, which
      `P11` confirms from the server's side. A late error, a late close, or an OK for another event
      cannot change a settled row.
- [x] Concurrency: the fan-out is one `Promise.all` over independent sockets, after the local write.
      Two concurrent publishes can only write two signed kind 0s that strfry de-duplicates by id.
- [x] Security: the publish set is owner-editable configuration (`PUT /api/settings` is owner-only) and
      ws/wss-only; the payload is a server-signed public profile; the endpoint's authorization is
      unchanged and `E8` pins it.
- [x] Backward compatibility: both legacy pages read only `success`, `message` and `error`
      (`public/pages/nip85.html:219-226`, `public/pages/customers/customer.html:931-939`) — all three
      still present, and `E7` pins the shape for a content-less publish.

## House rules check

- [x] Concept Graph API authority respected (no concept work in this diff).
- [x] No lint/typecheck/build tooling added.
- [x] No hardcoded TA pubkey anywhere in the diff.

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/assistant/index.js:356`** — the skipped rows are built from the literals `'skipped'` and
   `'local-only publish mode'`, while the module that owns the vocabulary exports `RELAY_STATUS`.
   Optional: use `RELAY_STATUS.SKIPPED`, or move the row construction into `profilePublish.js` so the
   vocabulary has a single home.
2. **`src/api/assistant/index.js:354-355`** — in local-only mode the settings are read twice: once for
   the (empty) publish set and once for the configured list the answer lists as skipped. Harmless on a
   path that already shells out to `strfry import`.
3. **`src/api/assistant/profilePublish.js:166-171`** — a relay that sends a NOTICE and then keeps the
   socket open is reported as `timeout` with the NOTICE as its reason (only a close turns it into
   `refused`). That follows the ADR's table; worth knowing when reading logs.

### Harness friction

None. The one kick-back stayed in its lane: G2 failed against a correct implementation because the
test's own `withEnv` restores the variable synchronously, Phase 4 stopped rather than editing the test,
and the Tester fixed it and re-checked that it still fails when the endpoint stops consulting the reader
(`31792e69`, recorded in the test plan).

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result is in the chat (the book's acceptance frame still has
      two unmet bullets — the My Assistant page and the single default profile — so the book stays open
      and `/close-book` was not offered).
