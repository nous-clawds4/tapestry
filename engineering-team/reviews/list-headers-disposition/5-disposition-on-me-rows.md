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
