# Test Plan: Story 5 — Disposition on Me rows, signed by your own browser signer

**Story:** `engineering-team/stories/done/list-headers-disposition/5-disposition-on-me-rows.md`
**ADR:** `engineering-team/decisions/done/list-headers-disposition/0005-me-rows-prepare-sign-commit.md` (reuses ADR 0003 and
0004 and their Amendments 1)
**Date:** 2026-10-01

Two files carry story 5:

- **`test/list-headers-me-disposition.test.js`** (new, registered in `test/registry.js`) drives the handler,
  `createMeDispositionHandler(action, phase, deps)`, through injected deps. **Signatures are real.** A throwaway key
  signs the headers and the commits through root `nostr-tools`. The injected verifier is `verifyEvent` on a JSON
  round-trip. So "not signed by you", "doesn't verify" and "the stored header can't be verified" are tested with real
  cryptography, not flags. One live test (ML1) runs in the container.
- **`tests/brainstorm/list-headers-my-assistant-disposition.spec.js`** gains **E1–E10**:
  - a stand-in for the six prepare/commit routes, sharing story 3 and 4's rules through one helper
    (`standInRules`);
  - Me-row fixtures for the Owner, a customer and a guest;
  - a NIP-07 signer stub installed with `addInitScript`. It logs every `signEvent` call, so "asked once" and "never
    asked" are counted, not inferred. Its modes: signs; declines; is on another account; signs as another account;
    no signer at all.

**Re-aimed: browser M1.** Story 5 AC 1 reverses one of its expectations: the account's own kind-39998 rows now carry
the button. M1 now expects it on the Owner's five own 39998 rows, the customer's own row and the guest's own row. It
expects none on the Owner's own 9998 row.

## Coverage map

| Criterion | Tests | Level |
|---|---|---|
| AC 1: a button on every 39998 row the account wrote, any state; none on others' rows, 9998 rows, or signed out | browser **M1** (re-aimed) | browser |
| AC 2: the same three actions and rules; the signer is asked once; saved here, then read back, then the graph; Submit and Wire broadcast; the row updates without a reload; the outcome is honest | MP2, MC1, MC6; browser **E1**, **E2**, **E3**, **E10** | unit + browser |
| AC 2: "already" cases never ask the signer | MP3; browser **E4** (zero `signEvent` calls, no commit) | unit + browser |
| AC 3: no signer, declined, or a signer on another account — nothing saved, with the reason | browser **E5** (all three actions), **E6**, **E7** (both mismatch shapes) | browser |
| AC 4: refused from another site; with no session, including from the container; for another account's header, a 9998, or a missing one; for an unverifiable stored header | MP1 (both phases × three actions × 11 cases), live **ML1** | unit + live |
| AC 4: refused when the new version isn't signed by the account, doesn't verify, or changes anything else | MC2, MC3, MC4, MC5, MC7 | unit |
| AC 4: the instance never receives or holds the private key; Concept Headers is unchanged | SM1 (no key lookup, no `privkey`, no `sign(`, no old bypass); story 3's **R1** stays | unit |
| AC 5: Next from a Me row walks only Me rows; from an Assistant row, only Assistant rows | browser **E9**; **M10** still holds | browser |
| ADR 0005: the Assistant module's exports; an unknown (action, phase) refused; six routes; registration; same-host before requireAuth | X1, X2, SM2, SM3, SM4 | unit |
| ADR 0005: a refusal at prepare never asks the signer; the commit re-derives from the current header | browser **E8**; MC5, MC5b | unit + browser |

## Edge cases

- [x] A header that changed between prepare and commit:
  - wired elsewhere, content edited, already self-declared, or Keep private now refused. Each gets 409 with the change
    sentence, never "already" or a 200 refusal (MC5);
  - kept private meanwhile. Submit's re-derived change is identical, so it is accepted. This pins "re-derived, not
    remembered" (MC5b).
- [x] Another key's signature with `pubkey` relabelled as the account passes the account check, then fails the
  signature check (MC4).
- [x] A non-object, `null`, a string, or a missing event gets 403 (MC2).
- [x] A stored header by another author, or whose first `d` differs, gets 409 (MP1).
- [x] Wire's target is re-checked at commit. A target other than the one signed gets 409 (MC7). A bad target gets 400
  before the lookup, in both phases (MP1).
- [x] A far-future `created_at` (now + 601) and a stale one (equal to the header's) are both refused (MC3).
- [x] Keep private beside a real b is refused at prepare (MP3), and Keep private is never broadcast (E2).

## The threat list

This is the adversarial pass a story that signs gets at Test Design (story 3's review). Story 5 lets a browser hand
the server a signed event to save, so the threats are about what it will accept. Each threat maps to a test:

| Threat | Test |
|---|---|
| Saving a version signed by a different key | MC2 (403). A relabelled pubkey gets 400 (MC4). |
| Saving anything but the action's change: extra or missing tags, a `p` tag smuggled in, changed content, another kind, the wrong b-type | MC3 |
| Replaying an old signature, or pre-signing a far-future one | MC3 (stale and +601 s), MC5 (the header moved on) |
| A signature that doesn't verify, or a cached `verifiedSymbol` vouching for an edited event | MC4. The verifier round-trips JSON. |
| Re-signing someone else's header, or your own Assistant's, through the Me path | MP1 (403) |
| No session, including from inside the container (the old `localTrusted` bypass) | MP1 (`localTrusted` stamped, still 401), live ML1 |
| Another site driving the routes | MP1 (403, before `requireAuth`), SM2 |
| A forged header in the relay being "upgraded" | MP1 (409: signature, author, `d`) |
| The server touching a private key on this path | SM1 (`getAssistantKeys`, `privkey`, `finalizeEvent`, `sign(`, the Owner-only key helpers) |
| The browser committing when the signer is on another account, or signs as one | browser E7 (no commit in either shape) |
| The person being prompted for a request that can only fail | browser E8 (a prepare refusal gets zero `signEvent` calls), MP1 (everything checkable runs at prepare) |
| A Me walk silently switching to the Assistant's rows, or the other way | browser E9 |

## Test infrastructure

- **Node runner.** Run one suite by itself through its exported `run()`. I checked it for publish markers first: it
  has none, and no hand-formatted curl status.
  - It needs root `nostr-tools` (a devDependency, present after `npm ci`). It never reaches the stack except in ML1.
  - ML1 goes through `test/helpers/stackHttp.js` and skips without the stack or Docker. Its handle is the TA's own
    header, because a no-session call is refused before the author is looked at.
- **The full gate runs isolated at Test Design** (ledger row `2026-09-30-npm-test-step-leaks-fixtures`). It runs on a
  clone of HEAD with these four files on top, `--network none`.
- **Playwright** uses the same hermetic mocks as stories 3 and 4. Markup and copy the spec relies on, beyond theirs:
  - the panel heading reads exactly `Disposition: <name>`;
  - the four AC 3 sentences:
    - "Signing your own headers needs a NIP-07 browser signer — nothing was saved";
    - "Signing was cancelled in your signer — nothing was saved";
    - the existing `SignerMismatchError` text, matched by "Your signer is on a different account";
  - the Me routes are `POST /api/list-headers/me/<encoded handle>/<action>/<prepare|commit>`. Wire sends `{ target }`
    to both phases, and commit sends `{ event }`.

## How to run

```
node -e "const m=require('./test/list-headers-me-disposition.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
BRAINSTORM_BASE_URL=<a vite preview of a build, or :7778 after /cycle-local> npx playwright test tests/brainstorm/list-headers-my-assistant-disposition.spec.js tests/brainstorm/list-headers-disposition-column.spec.js tests/brainstorm/list-headers-author-options.spec.js --project=chromium
```

## Verification

### The new tests fail with the current code

Confirmed 2026-10-01 at `6d7c6eb3`, plus these tests.

- **Node, on the host:** 0 passed, 18 failed. Every failure names what's missing:
  - X1: `myAssistantDisposition.js must export sameHost`;
  - X2, MP1–MP3, MC1–MC7, SM3: `src/api/list-headers/meDisposition.js must exist and load stack-free`;
  - SM1, SM2: `meDisposition.js must exist`;
  - SM4: `src/api/index.js must call require('./list-headers/meDisposition').register(app)`;
  - ML1, live: `a no-session self-declare prepare from inside the container must answer 401, got HTTP 404`.

  Story 3 and 4's suite still passes, 51/0/0, with L1 and L2 executed live.
- **Playwright,** on a build of `6d7c6eb3`: 11 failed, 19 passed. M1 and E1–E10 fail on
  `"owner own list" has a Disposition… button` (expected 1, received 0). The re-aimed M1 fails on the same missing
  button for the Owner. M2–M11 and W1–W9 pass, so the shared stand-in helper changed nothing for stories 3 and 4.
- **The isolated full gate** (`20261002T022945Z-20-009d`, on `6d7c6eb3` plus these five files, `--network none`): FAIL,
  4537 passed, 17 failed, 594 skipped, 258/258 suites. **The only failing suite is this one** (0/17/1; ML1 skips with no
  stack). The guard suites pass: `gate-result-record` 33/0/1, `harness-lint` 76/0/0, `stack-free-npm-test` 6/0/1. So
  do the other List Headers suites: 49/0/2, 12/0/0 and 9/0/0.

### The tests can pass, and they catch the defects they're meant to catch

A throwaway build of ADR 0005 was made outside the repo:
- the six exports;
- `meDisposition.js` with both phases;
- the registration line;
- `ui/src/utils/meDisposition.js`;
- the panel's `signer` prop;
- `rowSigner` and `nextUndecided(afterId, signer)`.

It isn't committed.

- **Node:** 17 of 18 pass. ML1 fails with 404 because the oracle isn't deployed; as with stories 3 and 4, it is
  proven at Implementation after the deploy. Story 3 and 4's suite passes 51 of 51 against the oracle's new exports.
- **Playwright:** 30 of 30 for this spec. For all three List Headers specs, 240 of 240 with `--repeat-each=5`.

Each mutant below changes one rule of that build. The unmutated control passes, and every mutant fails at least one
test.

**Server mutants (25):**

| Mutant | Fails |
|---|---|
| no same-host check | MP1, SM2 |
| requireAuth before same-host | MP1, SM2 |
| a loopback (`localTrusted`) bypass | MP1, SM1 |
| looks up the Assistant's keys | MP1–MP3, MC1–MC5, MC7, SM1 |
| no author check (handle pubkey vs session) | MP1 |
| no kind-39998 check | MP1 |
| Wire's target checks skipped | MP1 |
| no stored-header verification / author check / first-`d` check | MP1 (each) |
| template without `pubkey` | MP2 |
| template not strictly newer | MP2, MC1, MC4, MC5b, MC6 |
| no account check on the signed event | MC2 |
| "already" at commit answered 200 | MC5 |
| no kind equality | MC3 |
| no content equality | MC3, MC5 |
| no tags equality | MC3, MC5, MC7 |
| tags compared on b-tags only | MC3 |
| no "newer than the header" / "no more than 600 s ahead" | MC3 |
| no signature check on the signed event | MC4 |
| no read-back | MC6 |
| the graph before the read-back | MC1, MC6 |
| no phase check | X2 |
| decodes the handle twice | SM1 |

**UI mutants (10):**

| Mutant | Fails |
|---|---|
| Next ignores the signer | browser E9 |
| an "already" answer still asks the signer | browser E4 |
| no active-signer check (`getActiveSignerOrThrow`) | browser E7 |
| no check of the signed event's pubkey | browser E7 |
| "No NIP-07…" not mapped to the story's sentence | browser E5 |
| a declined prompt not mapped to the story's sentence | browser E6 |
| the panel ignores `signer` (Submit through the Assistant route) | browser E1, E4–E8, E10 |
| the button on the account's 9998 rows | browser M1 |
| Wire's commit without the target | browser E3 |
| Keep private broadcast | browser E2 |

## Review round 1 (ADR 0005 Amendment 1)

| Ask | Tests | Level |
|---|---|---|
| §1: the panel exists only while its row is the viewer's; `panelId` is cleared, so the panel doesn't return at the next sign-in; Next never matches a missing signer (blocking 1) | browser **E11** (act, then sign out: panel gone, no Next, no row button, no page error), **E12** (sign out with the panel open: gone, no page error; sign back in: it doesn't return, the row's button does) | browser |
| §2: the Me rows' own stored-header sentence, in both phases (non-blocking 3) | **MA1**: all three actions × both phases, 409 "…couldn't be verified as yours, so nothing was saved", never "Assistant" | unit |
| §3: a header dated too far ahead is refused in both phases before anyone signs; at commit, after the account check (non-blocking 1) | **MA2**: prepare for all three actions answers 409 with no template, nothing written. A version signed anyway gets the same sentence at commit, not "isn't exactly this action's change". Another key's version still gets 403 first. | unit |
| §3: the limit itself still works; "already" is unaffected | **MA3**: a header at now + 599 prepares a version at now + 600, and it commits. An already self-declared header dated now + 700 still answers "already". It passes on today's code, as a guard. | unit |
| §4: any failure at the signer's account step gives the cancelled sentence; the panel never stays busy (non-blocking 2) | browser **E13**: `getPublicKey` rejecting with an `Error`, and with `undefined`. Each shows the cancelled sentence, the buttons are enabled again, there are zero `signEvent` calls, and no commit. | browser |

**Spec infrastructure added:**
- `mockStack`'s session can now end and start again in the page: `/api/auth/logout`, `verify-user` and `login-user`
  are mocked, and every auth answer reads the current session.
- The signer stub gains the `pk-decline` and `pk-undefined` modes.

### Verification, round 1

**The new tests fail with the current code.** Confirmed 2026-10-01 at `7458c334` (the code of `3487301d` plus the
amendment), with these tests on top.
- **Node, on the host:** 19 passed, 2 failed:
  - MA1 got the old sentence, "…as your Assistant's, so nothing was signed";
  - MA2's prepare answered 200 `sign` with a template at now + 701.
- **Playwright,** on a build of `7458c334`: E11, E12 and E13 fail, and the other 30 pass.
  - E11 and E12 fail on "signed out, the panel is gone" (expected 0 headings, received 1).
  - E13 fails on "the cancelled sentence" (not found).
- **The isolated full gate** (`20261002T030755Z-20-8577`, on `7458c334` plus these three files, `--network none`):
  FAIL, 4555 passed, 2 failed, 594 skipped, 258/258 suites. **The only failing suite is this one** (18/2/1: MA1 and
  MA2). The guard suites pass: `gate-result-record` 33/0/1, `harness-lint` 76/0/0, `stack-free-npm-test` 6/0/1.

**The tests can pass, and they bite.** A throwaway build of Amendment 1 was made outside the repo:
- the two sentences and the date check in `meDisposition.js`;
- the `signAsMe` mapping;
- the tolerant `run` catch;
- the render guard, the clearing effect and Next's signer guard in `Index.jsx`.

Results:
- **Node:** 21 of 21, with ML1 live.
- **Playwright:** 33 of 33. All three List Headers specs pass 255 of 255 with `--repeat-each=5`.
- **Story 3 and 4's Node suite** still passes 51 of 51.

| Mutant | Fails |
|---|---|
| the sentence still "…as your Assistant's…" | MA1 |
| no date check | MA2 |
| the date check at prepare only | MA2 |
| `>=` instead of `>` | MA3 |
| the date check before the "already" answer | MA3 |
| the date check before the account check at commit | MA2 |
| no clearing effect (render guard kept) | browser E12 |
| neither the effect nor the render guard (today's code) | browser E11, E12 |
| the effect without `user` in its dependencies | browser E12 |
| signer errors passed through raw | browser E13 |
| only `Error` objects mapped | browser E13 |
| `undefined` passed through, and `run`'s catch not tolerant | browser E13 |

**Two mutants survive, and both are equivalent:**
- no render guard, with the effect kept;
- no signer guard in Next, with the effect and render guard kept.

The effect closes the panel as soon as its row loses its signer, so neither guarded state can be reached. Both guards
stay as defence in depth, as the amendment specifies.
