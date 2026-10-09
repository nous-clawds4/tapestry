# Review: Story 5 — Disposition on Me rows, signed by your own browser signer

**Reviewer:** Claude (acting as Reviewer), plus an independent adversarial reviewer agent
**Date:** 2026-10-01
**Diff:** `git diff 6d7c6eb3..3487301d` (tests at `d7a027d0`, implementation at `3487301d`)

This is a signing story: the server saves an event the person's browser signed. So it got the same treatment as
stories 3 and 4:
- an isolated full gate on the commit;
- browser specs on a fresh `git archive` build;
- an independent adversarial pass. That reviewer worked read-only and signed nothing on the stack. It ran 45
  in-process attacks on the handler with real `nostr-tools` signatures, and drove a bundled `ui/src/utils/meDisposition.js`
  with a fake signer and `fetch`.

Each finding from that pass that is recorded below, I re-checked in the code or by running it.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, reproduced as CI, with no network during the run** (ledger row
      `2026-09-30-npm-test-step-leaks-fixtures`), on a clean `--no-local` clone at `3487301d`:

  > `20261002T023628Z-20-5da8 [impl-lhd-5] started 2026-10-02T02:36:28.369Z on 3487301d — PASS, exit 0, 4554 passed, 0 failed, 594 skipped, 258/258 suites · /w/repo/tmp/gate-runs/20261002T023628Z-20-5da8.json`

  - **The record:** `node: v22.23.3`, `git: { commit: 3487301d…, branch: feat/list-headers-disposition, dirty: false }`.
  - **Per suite:**

    | Suite | Verdict | Pass / fail / skipped |
    |---|---|---|
    | `list-headers-me-disposition` | PASS | 17 / 0 / 1 (ML1 skips with no network) |
    | `list-headers-my-assistant-disposition` | PASS | 49 / 0 / 2 |
    | `list-headers-disposition-column` | PASS | 12 / 0 / 0 |
    | `list-headers-author-options` | PASS | 9 / 0 / 0 |
    | `gate-result-record` | PASS | 33 / 0 / 1 |
    | `harness-lint` | PASS | 76 / 0 / 0 |
    | `stack-free-npm-test` | PASS | 6 / 0 / 1 |

  - This run was started at Implementation. It is on the same clean commit this review audits, so it is this review's
    gate run too.
- [x] **Playwright**, all three List Headers specs on a fresh `git archive 3487301d` build: **240 passed with
      `--repeat-each=5`**.
- [x] **On the host, live:**
  - `list-headers-me-disposition` 18/0/0, with ML1 executed against the deployed handler;
  - `list-headers-my-assistant-disposition` 51/0/0, with L1 and L2 executed.
  - A throwaway guest session on all six routes got 404 for its own missing header, 403 for the TA's header, and
    403 cross-site. Nothing was written.

## Spec adherence
- [x] **Every acceptance criterion has a passing test:**
  - AC 1: browser M1 (re-aimed);
  - AC 2: MP2, MP3, MC1, MC6, and browser E1–E4 and E10;
  - AC 3: browser E5–E7;
  - AC 4: MP1, MC2–MC7, SM1, live ML1, and story 3's R1;
  - AC 5: browser E9, and M10.
- [ ] **AC 1 and AC 5 don't hold once the viewer signs out in the page, or switches account, with the panel open**
      (blocking 1).
- [ ] **AC 3's "the person declines in their signer" is only phrased as the story asks when the decline happens at the
      signature step** (non-blocking 2).
- [x] **Nothing beyond the story was added.**

## ADR adherence
- [x] **The change matches ADR 0005's Implementation notes:**
  - the six exports, added to `module.exports` only (`src/api/list-headers/myAssistantDisposition.js:198-200`);
  - `createMeDispositionHandler(action, phase, deps)` (`src/api/list-headers/meDisposition.js:42`). Steps 0, 1, 3, 4,
    4b, 5, 5b and 6 run in the ADR's order (`:50-85`);
  - prepare's template (`:91-101`);
  - commit's checks, in order: the account (`:105-108`), "already" or a refusal at commit means the header changed
    (`:111`), the exact change (`:112-118`), the signature (`:119`);
  - the relay, read-back, graph tail (`:121-132`);
  - the six routes (`:140-144`) and the registration line (`src/api/index.js:654-656`);
  - `submitAsMe`, `keepPrivateAsMe` and `wireAsMe` (`ui/src/utils/meDisposition.js`);
  - the panel's `signer` prop (`ui/src/pages/lists/ListHeaderDispositionPanel.jsx:26-31`, `:40-41`);
  - `rowSigner` and `nextUndecided(afterId, signer)` (`ui/src/pages/lists/Index.jsx:202-205`, `:216-217`).
- [x] **No key on the Me path.** No `getAssistantKeys`, `privkey` or `sign(`, and no old bypass. SM1 pins this, and
      the independent pass confirmed it on every path.
- [x] **No new dependencies.**
- [x] **One addition beyond the ADR's letter:** the panel's `signer` defaults to `'my-assistant'`. It's harmless,
      since `Index.jsx` always passes it. But see blocking 1: `null` doesn't take the default.

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form; no concept, schema or firmware change, so no reinstall.

## Things tests can't catch
- [x] **No secrets in committed files.**
- [x] **No leftover debug logging.** The two `console.error` lines match the Assistant handler's.
- [x] **No commented-out code.**
- [ ] **Not every error path is handled** (blocking 1; non-blocking 1 and 2).
- [x] **Concurrency.** A header that changes between prepare and commit is re-derived (MC5, MC5b). The inherited
      same-address race is re-scoped in its ledger row (see "Ledger" below).
- [x] **Security.** The independent pass tried 45 attacks on the handler; every attempt to save anything but the
      action's exact change, signed by the account, was refused.

## House rules check
- [x] **The TA pubkey is never hardcoded.** The Me path never needs it.
- [x] **No new tooling.**

## Findings

### Blocking

1. **`ui/src/pages/lists/Index.jsx:216-217` and `:362-367`, `ListHeaderDispositionPanel.jsx:40-41`: once the panel's
   row stops being the viewer's, **Next** walks other people's rows, and the panel's buttons throw.**

   When the viewer signs out in the page, or signs in as someone else, nothing closes the panel (`panelId` is
   kept). Then `rowSigner(panelRow)` becomes `null`:
   - `nextUndecided(afterId, null)` matches every undecided row whose `rowSigner` is also `null`, which means every
     row that *isn't* the viewer's;
   - `ACTIONS_BY_SIGNER[null]` is `undefined`, because a `null` prop doesn't take the default.

   **Reproduced in the browser,** on the review build with the spec's own mocks:
   1. Act on a Me row, then sign out. **Next undecided →** is still shown. Clicking it opens
      "Disposition: ta undecided a", which is the Owner's Assistant's row, offered to a signed-out viewer.
   2. Sign out with the panel open, then click **Submit**. You get an uncaught page error, "Cannot read properties of
      undefined (reading 'submit')", and no message in the panel.

   No request is sent in either case, and the server would refuse one anyway. But it breaks story 5's AC 1 ("no
   button … on rows written by anyone else, or on any row when signed out") and AC 5 ("Next stays with one signer").
   It is also a regression: on story 3's code, **Next** offered nothing once signed out, and a click got a visible
   401 refusal.

   **Asked change:**
   - When the panel's row has no signer for the current viewer, the panel goes away (render the host only while
     `rowSigner(panelRow)` is set).
   - `nextUndecided` never matches a `null` signer.

   **Test asked:** a browser case for both orders (act then sign out; sign out with the panel open), proven against a
   mutant of each half.

### Non-blocking

1. **`src/api/list-headers/meDisposition.js:98` against `:117`: a header dated in the future gets a template the
   commit can never accept.** Re-run by me:
   - a header at now+700 gets a template at now+701;
   - committing exactly that template gets 409 "…isn't exactly this action's change…".

   So the person is prompted to sign something doomed, against ADR 0005's "a doomed request never prompts", and the
   409 message misleads. It's reachable without any import: the relay accepts ordinary publishes up to 900 s ahead,
   so a skewed clock can produce such a header.

   **Optional improvement:** refuse at prepare, with an honest sentence, when the template's `created_at` would be
   more than now + 600. This needs a line in an ADR 0005 amendment.
2. **`ui/src/utils/meDisposition.js:30-35`, `ListHeaderDispositionPanel.jsx:61-62`: a decline at the signer's "share
   your public key" step isn't phrased like a decline at the signature step.**
   - `getActiveSignerOrThrow` calls `getPublicKey`. Only "No NIP-07 extension detected." is mapped; any other error
     reaches the panel raw. An `Error('User rejected')` shows just "User rejected", with no "nothing was saved".
   - If the extension rejects with `undefined`, `run`'s own `catch` throws on `err.message`. The panel then stays
     busy with every button disabled.
   - The independent pass verified both by driving the bundled module.

   Nothing is saved in any of these cases. **Optional improvement:** map any error there other than
   `SignerMismatchError` to a "nothing was saved" sentence, and make `run`'s `catch` tolerate a non-`Error`.
3. **`src/api/list-headers/meDisposition.js:82`: the stored-header refusal says "couldn't be verified as your
   Assistant's, so nothing was signed" on a Me row.** ADR 0005 prescribes reusing the Assistant handler's sentence,
   and the Implementer flagged it. On a Me row there is no Assistant. At commit, "nothing was signed" is also untrue:
   the person has already signed in their browser, but nothing was *saved*. No test pins the sentence.

   **Optional improvement:** use its own sentence, for example "The stored header couldn't be verified as yours, so
   nothing was saved". This needs a line in an ADR 0005 amendment.
4. **Notes from the independent pass; I checked the reasoning, and none is harmful:**
   - Extra top-level fields on the signed event reach `publishLocal`. strfry rebuilds the stored JSON from the seven
     known fields, and `importEventDirect` reads only known fields.
   - An uppercase `sig` verifies and would be stored uppercase. It is still the person's own valid signature.
   - The handle `039998:…` is read as kind 39998.
   - An `Origin` on the same hostname but another port passes `sameHost`. This is inherited from story 3.
   - A signer whose `getPublicKey` returns `null` skips the pre-sign check. The post-sign check still refuses, with a
     "(unknown)" account in the sentence.

### Ledger

- **`2026-10-01-list-headers-readback-hardening`** said its three items affect only the Assistant's headers. The Me
  path reuses the same `isStored`, Wire target check and relay-then-graph tail, so the row is re-scoped in this
  commit with a dated update.

### Harness friction
1. None this story. The Test Design oracle and mutants caught every rule the ADR wrote down. The blocking defect sits
   in a state the ADR didn't describe: the panel's row stops being the viewer's.

## Verdict
**CHANGES_REQUESTED**

Blocking 1 is a demonstrated, story-5-introduced break of AC 1 and AC 5. It's small, and the fix is in the browser
only. The server side held against every attack, and the gate is green. Non-blocking 1–3 are cheap and could ride
along in the same fix round, at the owner's choice. Each needs a line in an ADR 0005 amendment.

**Suggested fix round:**
1. An ADR 0005 amendment covering blocking 1, plus whichever of non-blocking 1–3 the owner chooses.
2. Tester additions, proven against mutants.
3. Implementation.
4. Re-review.

## On PASS (same commit)
- [ ] Not applicable: the verdict is CHANGES_REQUESTED, and the story stays **Approved**.

---

## Re-review, round 2

**Date:** 2026-10-01
**Diff:** `git diff d246f61f..4ad6e553`:
- ADR 0005 Amendment 1 at `7458c334`;
- the round-1 tests at `bfc52a55`;
- the implementation at `917f15af`;
- the plan's gate record at `4ad6e553`.

I checked each fix as a fresh claim. The same independent reviewer was resumed to re-attack the amended code, under
the same rules: read-only, no writes to the stack, no logins with real accounts.

### Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, reproduced as CI, with no network,** on a clean `--no-local` clone at `917f15af`. The commits
      after it change only the test plan.

  > `20261002T031041Z-20-9bd6 [impl-lhd-5-r1] started 2026-10-02T03:10:41.827Z on 917f15af — PASS, exit 0, 4557 passed, 0 failed, 594 skipped, 258/258 suites · /w/repo/tmp/gate-runs/20261002T031041Z-20-9bd6.json`

  - **The record:** `git: { commit: 917f15af…, dirty: false }`.
  - **Per suite:**
    - `list-headers-me-disposition` 20/0/1 (ML1 skips with no network);
    - `list-headers-my-assistant-disposition` 49/0/2;
    - `list-headers-disposition-column` 12/0/0;
    - `list-headers-author-options` 9/0/0;
    - `gate-result-record` 33/0/1;
    - `harness-lint` 76/0/0;
    - `stack-free-npm-test` 6/0/1.
- [x] **Playwright,** all three List Headers specs on a fresh `git archive 917f15af` build: **255 passed with
      `--repeat-each=5`**.
- [x] **On the host, live:** `list-headers-me-disposition` 21/0/0, with ML1 executed against the redeployed
      `meDisposition.js`.

### Each ask, checked as a fresh claim

| Round-1 finding | Fixed? | Evidence |
|---|---|---|
| Blocking 1: the panel outlives a sign-out; Next opens others' rows; the buttons throw | **Yes** | `ui/src/pages/lists/Index.jsx:216-223` and `:364`. The host renders only while `rowSigner(panelRow)` is set, an effect clears `panelId`, and `nextUndecided` returns null for a missing signer. Browser E11 reproduces my round-1 probe exactly: act, sign out, then no panel, no Next, no row button, no page error. E12 covers signing out with the panel open, then signing back in: the panel doesn't return. Proven by mutants: the effect alone, the effect's `user` dependency, and both guards. |
| Non-blocking 1: a header dated too far ahead prompts a doomed signature | **Yes** | `src/api/list-headers/meDisposition.js:92` (the check), `:98` (prepare) and `:120` (commit, after the account and header-changed checks). MA2 and MA3. The independent pass checked the boundaries: headers at now+598 and +599 prepare, now+600 up to 2^53 get 409, and "already" and refusals still answer. |
| Non-blocking 2: a decline at the account step is unmapped; the panel can stick busy | **Yes** | `ui/src/utils/meDisposition.js:33-36` and `ListHeaderDispositionPanel.jsx:61-66`. E13 covers both an `Error` and an `undefined` rejection. The mismatch and no-signer sentences are unchanged. |
| Non-blocking 3: "as your Assistant's … nothing was signed" on Me rows | **Yes** | `meDisposition.js:38` and `:87`. MA1 covers both phases. |

### ADR adherence
- [x] **The implementation matches Amendment 1's notes line for line:** the two constants, the date check at the two
      places named, the `signAsMe` mapping order, the tolerant `run` catch, the render guard, the effect, and Next's
      guard.
- [x] **Two equivalent mutants are recorded in the plan:** no render guard, and no Next guard. The effect makes both
      guarded states unreachable. They stay as defence in depth, as the amendment says.

### Findings

#### Blocking
None.

#### Non-blocking
1. **`ui/src/utils/meDisposition.js:29-47`: a request already in flight at sign-out or account switch can still bring
   up a signer prompt for a panel that has closed.** The independent pass verified it in the bundled module, and I
   confirmed the code path.
   - After sign-out, the session pubkey is `null`, so the pre-sign check passes vacuously. `signEvent` prompts, and
     the after-sign check then refuses with an "(unknown)" mismatch. No commit is sent.
   - After a switch to B with the signer on B, B signs A's template. The server refuses the commit with 403.

   Nothing is saved or broadcast in either case. It's reachable only by signing out during the brief prepare
   request. **Filed** as ledger row `2026-10-01-me-disposition-inflight-signer-prompt`, with the fix shape: compare
   the session to `template.pubkey` before and after signing.
2. **Note, accepted at the amendment gate:** any failure at the signer's account step reads as "cancelled", even when
   the extension failed rather than the person declining. The "nothing was saved" half is always true.
3. **Note:** if the server's clock steps *backwards* by a second between prepare and commit on a header at exactly
   now+599, the person signs and then gets 409 TOO_FAR_AHEAD. Only a backward clock adjustment at that exact moment
   triggers it. Not filed.

#### Harness friction
1. None. The round-1 fix round ran ADR amendment, tests with mutants, implementation and re-review, each gated. The
   only friction was the lint's last-token verdict rule, which caught my round-1 report ending on "On PASS". That
   was fixed in the same commit, the way story 4's review already ends.

### What held (independent pass, round 2)
- **The panel lifecycle,** reasoned from the React code; E11 and E12 run it.
  - No render ever shows a panel for a row that isn't the viewer's.
  - Headers load once and keep their routeIds, so the panel can't come back.
  - Filter changes don't drop `panelRow`, because it comes from `rows`, not `filteredRows`.
  - A commit that succeeded and resolves after sign-out stores the version really saved.
- **Server refusals:** a commit after sign-out gets 401, and session B on A's handle gets 403, both before anything
  is read or written.
- **Stories 3 and 4:** the Assistant handler is unchanged, and its suite passes. The new guards close Assistant panels
  on sign-out too, which is correct.

### Verdict
**PASS**

All four round-1 asks are met, each with a test that a mutant proves. The gate is green on the clean commit. The
browser specs pass 255/255 on a fresh build. The independent re-attack found nothing blocking. The one leftover
can't save anything, and it is filed with a fix shape.

### On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] **Completion detection: judged against the book's acceptance frame.**
  - Bullets 1–5 are now met by stories 1–5, and the Concept Headers and New DList rows are filed.
  - Bullet 6, "shipped to staging", is not yet met.
  - So the book is complete in code but not yet shipped. Offer staging first, then `/close-book`.
