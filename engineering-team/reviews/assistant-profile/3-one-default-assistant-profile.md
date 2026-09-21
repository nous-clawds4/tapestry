# Review: Story 3 — One default profile for every assistant

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Diff:** `git diff 6fd8759d..HEAD` — `98fb6a96` (ADR) → `345afbe4` (ADR Amendment 1) → `64badda8` (test plan + tests) → `c31fd815` (implementation, HEAD)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — the gate's own record, read with `npm run gate:status -- --label review-assistant-profile-3`:

```
20260921T045901Z-66496-08ed [review-assistant-profile-3] started 2026-09-21T04:59:01.842Z on c31fd815
— FAIL, exit 1, 3490 passed, 94 failed, 35 skipped, 215/215 suites
```

  The record says `dirty: false`, so the run is of clean `c31fd815`. **The verdict is FAIL, and none of
  it comes from this story.** I checked the per-suite results against the run on `98fb6a96`+uncommitted
  tests (`20260921T041720Z-4783-1b49`). Its non-test source is the base's, byte for byte.

  - **33 of the 35 failing suites have identical pass/fail/skip counts in both runs.** Examples:
    `profile-tags` 10/3/0, `summaries-element-count` 7/6/0, `tl-certainty-method` 4/3/0. None of them is
    touched by this diff. They are the live-tier set this box fails from a worktree, because the Docker
    stack at `:7778` bind-mounts the shared checkout.
  - **`author-scoped-inspection-roster`, 10/5/0 in both runs:** its live H1–H5 call
    `/api/assistant/roster`, which the served build (`a55b9631`) predates.
  - **`recognizable-published-ta-profile`, 10/3/0 (it was 5/8/0 before the implementation).** The 3
    failures are its live H1–H3, which assert against `:7778`. I confirmed that `:7778` serves
    `a55b9631`: `docker exec tapestry … git rev-parse` returns that commit, `src/api/assistant/` has no
    `profileDefaults.js`, and an anonymous status call still proposes "a customer's Tapestry Assistant"
    and `website: https://localhost:7777`.
    - **This branch's own handler passes all three.** I mounted the real
      `createAssistantStatusHandler` on express at an ephemeral port and ran the suite's `run()` against
      it (scratch script, not committed). Only the key store and the owner lookup were faked. The name
      lookup, `describeInstance`, the definition and the setup check were the real code.
    - That gave **13 passed, 0 failed, 0 skipped** for three instance shapes: unconfigured (not
      public), `STRFRY_DOMAIN=staging.brainstorm.world` (public) and `192.168.1.50:7777` (LAN).
  - **`one-default-assistant-profile` is 52/0/0.**

  **No suite regressed.** The branch is not pushed, so CI `stack-free` (the binding gate) has not run.
  Every suite this diff adds or re-aims is stack-free, or skips its live class when no stack is present.

- [x] **Stack-free suites, run by hand in the worktree.**
  - `one-default-assistant-profile`: 52/0/0.
  - `assistant-publish-relays`: 39/0/0.
  - `assistant-setup-state`: 28/0/0.
  - `stamped-composite-avatar`: 15/0/0.
  - `recognizable-published-ta-profile` with `BRAINSTORM_BASE_URL=http://127.0.0.1:9`: 8/0/5 (the H-class
    skips).
  - Neither precondition for hermetic runs holds here: there is no `/etc/brainstorm.conf` and no
    `strfry` on PATH.
- [x] **`npm run test:playwright`**, against this worktree's build served by `vite preview` on `:4173`.
  - **Result: 27/27.** That covers `assistant-default-profile` B0–B7, `assistant-setup-prompt` B0–B9,
    `ta-composite-avatar` B0–B4 and `assistant-publish-result` B0–B3. Every `/api` route is mocked.
  - **The bundle is current.** `dist/index.html` (00:39:09) is newer than the last UI source edit
    (00:38:44), and the tree is clean.
  - **It holds the new code.** The bundle contains "Use the default profile" and "no NIP-05 is
    published", and no "robohash".
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped_ (the UI bundle the browser class ran against was built from this tree).

## Spec adherence

- [x] Every acceptance criterion has a passing test. I checked "would it fail on a regression" by
      planting 19 single-edit mutants in a scratch export of HEAD (never in the worktree) and running
      the neighbouring Node suites against each (all five of them for every mutant reported below as
      not caught). The table is below.

| Criterion | Tests | Where the behaviour lives |
|---|---|---|
| **AC1** — the same table for Owner, Admin and Customer; never "a customer's Tapestry Assistant" | Q1, Q2, E5, D1, S1; ta-avatar U3, S2 | `buildDefaultProfile` has no role parameter (`src/api/assistant/profileDefaults.js:205-218`); the status answer builds it at `src/api/assistant/index.js:390,418`, the publish at `:231-233` |
| **AC2** — the name comes from the local relay, else the profile relays; npub forms otherwise | N1–N9, D2, Q3, Q4, E6, E8; ta-avatar S3 | `resolvePersonName` (`profileDefaults.js:132-179`): local first (`:142-145`), the gate (`:148`), the memo (`:151-154`), the relays within ADR 0001's budget (`:158-168`), the newest by `created_at` including local (`:171-174`) |
| **AC3** — website, NIP-05 and the client tag on a public instance; none of them otherwise; NIP-05 and tag on edited profiles too | I1–I6, F1–F3, Q5, Q6, E1–E4, B7; ta-avatar H2 | `describeInstance` (`profileDefaults.js:91-100`); `finalizeAssistantProfile` (`:226-234`), which the only publish path calls (`index.js:240`, tags at `:249`); `nostr.json` mapping only when public (`index.js:278-285`) |
| **AC4** — the picture is always the branded avatar at a loadable URL; nothing the app supplies is loopback, private or relative | D3, D5, D6, I7, S2, W3, B3–B5; ta-avatar U2, S1, H2, H3 | `REFERENCE_TA_AVATAR_URL` (`profileDefaults.js:30`, used only when not public, `:98`); `isPubliclyReachable` delegates to the same rule (`index.js:58-63`), so `avatar.js:110-116` (unchanged) withholds a non-public composite URL; the editor takes only `data.url` (`AssistantProfileEditor.jsx:163-170`) and only the server's picture (`:180-191`) |
| **AC5** — seven editable fields, NIP-05 read-only; every publish path starts from the one definition | R1, R2, B6, E7, W2, B1; story 1's B3/B5 (re-aimed) | The publish handler calls the builder directly, with no seam (`index.js:231-233`); the dashboard posts `{ customerPubkey }` to `publish-profile` (`Dashboard.jsx:756-774`); the legacy pages already send no `content` |

**Mutation results.** "Caught" means at least one Node test failed.

| Planted defect | Caught by |
|---|---|
| a supplied `nip05` kept on a public instance | F2, F3 |
| the status handler looks up the name first, then runs the setup check | Q10 |
| `nostr.json` written on any instance | E3 |
| an edited profile on a public instance skips the name lookup | E2 |
| the client tag only on default publishes | E2 |
| the status call's 400 checks presence only | Q9 |
| `isPublicHost` treats IP literals by suffix | I2, I3, I6, I7 |
| relay events not filtered to the person's pubkey | N3 |
| the old website rule (anything but `localhost`) | I5, I6 |
| the hook drops `defaults=0` | W1 |
| `defaults=0` ignored on the keyed answer | Q7 |
| `useComposite` writes `data.url \|\| data.path` | W3 |
| the branded fallback writes `BRANDED_FALLBACK_SRC` | W3 |
| the editor's "NIP-05: none" line removed | **not caught by Node**; B7 (browser) covers it |
| `useComposite`'s `!data.url` early return removed | **not caught by Node**; B3 (browser) covers it |
| `getPersonName` ignores its flag (`profileDefaults.js:183`) | **not caught** — non-blocking 1 |
| the status dependency `getPersonName` forces relay lookups (`index.js:337`) | **not caught** — non-blocking 1 |
| the no-key branch passes `allowRelayLookup: true` (`index.js:389`) | **not caught** — non-blocking 1 |
| the memo is consulted before the anonymous gate | not caught (not a relay query; only a remembered public name) |

- [x] **No criterion is silently dropped.**
- [x] **No behaviour was added beyond the story and ADR.** The one addition is the editor's "offered no
      branded image" message (`AssistantProfileEditor.jsx:188-189`). It is disclosed in Deviations, and
      no current server can trigger it.
- [x] **The owner's text is verbatim.** I extracted the story's quoted paragraphs programmatically and
      compared them with `defaultAbout`. Both paragraphs match exactly, the no-name sentence reads
      "I am the Tapestry Assistant for ‹npub›.", and the punctuation is ASCII.
- [x] **The reference avatar is real.** A passive GET of `https://tapestry.brainstorm.world/ta-avatar.png`
      returned `200 image/png`, 16,863 bytes. Its SHA-256 (`411ce01b…47d2a8`) is identical to the
      committed `ui/public/ta-avatar.png`.
- [x] **OPEN.md row 148 is closed by the code.**
  - The predicate now rejects RFC1918, ULA, link-local, `.internal` and `.home.arpa` (I2, I3, I7).
  - The ta-avatar mirror `isPubliclyRoutable` moved with it
    (`test/recognizable-published-ta-profile.test.js:110-124`).
  - `website` and NIP-05 are gated too (I5, E3, E4).
- [x] **OPEN.md row 154 is closed by the code.** The `'a customer'` fallback is gone (S1), and the
      no-name form is the npub form (Q3, U3, H3).
  - Both rows still read `OPEN` in the ledger. Flipping them is close-out work, not part of this diff.
- [x] **The Deviations are honest and small.** I checked each one against the diff.
  - The non-object second argument is ignored: `index.js:118`.
  - The no-picture message: `AssistantProfileEditor.jsx:185-190`.
  - The warning on a relay-helper throw: `profileDefaults.js:166-168`.
  - The `child_process` require is dropped. Nothing else in `index.js` used it.
  - The dashboard keeps its alert, exactly as ADR sub-decision 6 wrote it.

## ADR adherence

- [x] **The files match ADR 0003's implementation notes one for one.**
  - The new module holds the constants, `isPublicHost`, `isPublicDomain`, `getInstanceDomain` (moved
    unchanged, with a dependency), `describeInstance`, `nameFromProfileEvent`, `resolvePersonName`,
    `getPersonName`, `personNpub`, `defaultAbout`, `buildDefaultProfile` and `finalizeAssistantProfile`.
  - `profileState.js` exports the budget, backstop, `withinBudget` and the two real helpers, with no
    behaviour change (`:188-196`).
  - `profilePublish.js` gains `readConfiguredRelays`, and `getConfiguredPublishRelays` delegates to it
    (`:59-61, :70-98`). Story 2's L1–L7 are unchanged and green.
- [x] **Amendment 1 is honoured.**
  - `defaultStatusDeps` has no `getPublishRelays` (`index.js:332-341`).
  - The inner handler passes `getPublishRelays: getAssistantPublishRelays` literally (`index.js:402`),
    so story 2's S3 holds for the reason it was written.
  - The publish handler keeps the literal `getAssistantPublishRelays(` (`index.js:289`).
- [x] **Story 1's guards still hold, for the right reasons.** `functionBody(…, 'handleAssistantStatus')`
      now finds the inner `async function handleAssistantStatus` (`index.js:351`) and stops at the
      top-level `const handleAssistantStatus =` (`:433`). So S1, S2 and S5 read the real handler body:
  - the resolver call is there, and there is no `strfry scan`;
  - `allowRelayFallback`, `localTrusted` and `sessionPubkey === customerPubkey` are there;
  - `profileSource` is there.
  - D3's regex still matches the hook with `&defaults=0` appended.
- [x] **The layering follows the ADR.**
  - "Public" is one composition of ssrfGuard's synchronous classifiers, with no second copy (S4).
  - The builder is pure, and the publish handler cannot swap it out (E7).
  - Relay settings have one reader.
  - `avatar.js` is unchanged, and follows the rule through `isPubliclyReachable`.
- [x] **No new dependencies.**
  - `net` is Node core, and ssrfGuard already exists.
  - `nostr-tools`, the config module, `profileState` and `profilePublish` are required lazily (S3).
- [x] **Lane discipline held.**
  - `64badda8` touches only tests, the test plan and the story's links.
  - `c31fd815` touches no test file.
- [x] **The superseded-in-part ADRs are named, not edited.** ADR 0003 names `done/ta-avatar/0002` and
      `0003 D4` in Consequences, and leaves them unedited. The re-aimed ta-avatar tests say so in their
      header. The re-aimed U2, U3, S1–S3 and H1–H3 still test that suite's intent (the published profile
      is recognizable and never dead), under the rules that replaced it.

## Concept-graph integrity

- [x] No concept definition, handle or schema changes. The kind 0 is a nostr event, not a graph node.
      The ADR records its orientation (staging's `39998:<TA>:nostr-user`). I did not re-verify that; it
      is not load-bearing for a change with no concept work.
- [x] **Firmware reinstall: not required.**
- [x] N/A — no new concept-reading code.

## Things tests can't catch

- [x] **No secrets.** Fixture pubkeys only; signing keys are generated per test. No TA pubkey literal.
- [x] **No debug leftovers.** The added `console.*` lines are the two re-indented NIP-05 mapping logs and
      the disclosed relay warning.
- [x] **No commented-out code.**
- [x] **Error paths are handled.**
  - A malformed kind 0 means no name (N1).
  - A relay failure means no name (N7).
  - A hung helper is cut off by the backstop, at about 5 s (N8).
  - A throwing `getProfileRelays` is caught inside the `.then` (`profileDefaults.js:161`).
  - A failure in either status lookup still answers 500, as before.
- [x] **Concurrency.**
  - The name lookup and the setup check run under one `Promise.all` (`index.js:397-404`; Q10).
  - The memo has no in-flight de-duplication (non-blocking 3).
- [x] **Security.**
  - **Anonymous callers never reach the relays through the real wiring.** I built the status handler
    with its real `getPersonName` and `describeInstance`, and stubbed profileState's relay helper
    (scratch, not committed). That gave 0 relay lookups for each of:
    - an anonymous call about an arbitrary pubkey with no key;
    - an anonymous call about the keyed Owner;
    - a signed-in stranger asking about an arbitrary pubkey.
  - The one lookup came from a signed-in person asking about themselves, and it went to exactly
    `wss://purplepag.es` and `wss://profiles.nostr1.com`.
  - **No caller-supplied URL is fetched.** The relays come from owner-editable settings through the
    one reader.
  - **Relay events are verified.** The pool checks signatures (nostr-tools `abstract-relay.js:302`),
    and events are filtered to the person's pubkey (N3).
  - **The status call validates its pubkey** (Q9), with one coercion edge (non-blocking 2).
- [x] **Principles 1 and 4.**
  - The default always describes the assistant's own person (E8).
  - Nothing is copied into the local relay.
  - An existing `nostr.json` mapping is never deleted off a public instance.

## House rules check

- [x] Concept Graph API authority respected (no concept work in this diff).
- [x] No lint/typecheck/build tooling added.
- [x] **No per-deployment TA pubkey is hardcoded.** The one deployment literal is the reference avatar
      URL, a domain, ratified in the story. It is written once (S2; ta-avatar S1).

## Product-guide adherence *(when the story traces to a PRD)*

- [x] N/A — the book is an acceptance frame, not a PRD.

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/assistant/index.js:389`, `:337` and `src/api/assistant/profileDefaults.js:182-184` — the
   anonymous relay gate is correct but not pinned where it matters most.**
   - The suite pins it in two places: the keyed status branch (Q4) and the resolver itself (N5).
   - It does not pin it in three others. Each of these one-token mutants passes every suite:
     - the no-key branch asks with `allowRelayLookup: true`;
     - the default dependency forces `true`;
     - `getPersonName` ignores its flag.
   - **The no-key branch is the one an anonymous GET about an arbitrary pubkey actually takes.** So a
     regression there would silently reopen the path ADR 0003 sub-decision 2 closes.
   - **Story 4 is scheduled to edit exactly that early return** (the epic's Owner-copy finding).
   - I verified the current wiring behaviourally (see Security above), and story 1's review rated the
     same kind of gap non-blocking, so this does not block.
   - **Ask (Tester's lane), before or with story 4:**
     - a Q-case for the no-key branch: anonymous and stranger give `false`, self gives `true`;
     - one wiring test that drives the real `getPersonName` through the default status dependencies,
       with profileState's `queryRelaysKind0` stubbed.
   - Otherwise, file an OPEN.md row.
2. **`src/api/assistant/index.js:355` — `?customerPubkey[]=<hex>` passes the new 400 check.** The regex
   coerces the array to a string, and the handler then answers 500 ("hex string expected, got object")
   instead of 400.
   - No security impact: the caller only loses privileges, and every field is public.
   - The publish handler (`:183`) has the same shape, from before this diff.
   - Optional: add `typeof customerPubkey === 'string'` to the check.
3. **`src/api/assistant/profileDefaults.js:151-177` — the memo has no in-flight de-duplication.** I
   measured it: 5 concurrent misses for one person produced 5 relay queries.
   - The memo `Map` is never pruned.
   - Any signed-in pubkey, including a guest with no assistant, can start a lookup about itself through
     the no-key branch.
   - All of this is within the ADR's rule, and the cost is bounded by sessions.
   - Optional: memoize the in-flight promise.
4. **Two comments now overstate NIP-05.**
   - `src/api/assistant/index.js:37-40` says "the publish handler always sets nip05 itself".
   - `ui/src/components/AssistantProfileEditor.jsx:11-13` says the server writes the `nostr.json` entry
     at publish time.
   - Both now happen only on a public instance. Optional: reword both.
5. **The test plan's W-class is a partial backstop, not a full one.** It says W is "the CI-enforced
   backstop for the B-class".
   - B7 (the "NIP-05: none" line) and B3's early return have no W counterpart. Their mutants survive
     every Node suite, and CI does not run Playwright.
   - Optional: add a W4 source check.
6. **The legacy pages call `/status` without `defaults=0`** (`public/pages/nip85.html:164`,
   `public/pages/customers/customer.html:872`). They never read `defaults`, so a signed-in visit now
   waits for the name lookup on a memo miss. Story 5 retires both pages; noted only.

### Harness friction

1. None.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result and any book arithmetic recorded in the run journal (Direction) or the chat (human-gated) — never in this file. `/close-book` offered if the book looks complete.
