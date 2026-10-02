# Review: Story 1 — Me and My Local Tapestry Assistant in the List Headers Author selector

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-01
**Diff:** `git diff origin/staging...HEAD` (commit `cafb1310`; the branch is 0 behind `origin/staging`)

The same session wrote the ADR, the tests and the code. To make up for that, every check below ran against a
fresh `git archive cafb1310` build, not the Implementer's build or working tree.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **the full run was not made on this machine.** On the Mac Studio it publishes the live
      tag suites' fixtures to public relays (OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays`).
      So there is no `npm run gate:status` line to quote. Instead, the suites this change touches or that
      read the changed page ran one by one through their exported `run()`:
      - `list-headers-author-options`: 9 passed, 0 failed.
      - `stack-free-npm-test` (G5: every suite registered): 7 passed, 0 failed.
      - `relay-scan-bounds`: 28 passed, 0 failed.
      - `site-trust-signals`: 28 passed, 0 failed.

      None of the four publishes anything (checked for `strfry/publish` and `nak`). CI's stack-free gate
      runs the full registry on the PR.
- [x] Playwright: `tests/brainstorm/list-headers-author-options.spec.js` against a `vite preview` of the
      fresh build. **Chromium: 50 passed with `--repeat-each=5`.** The Firefox project couldn't launch
      (`Executable doesn't exist … firefox-1495`): the browser isn't installed on this machine. That's an
      environment gap, not a code result. Every recent plan runs `--project=chromium`.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._ The Vite bundle still built cleanly from `cafb1310`.

## Spec adherence
- [x] **Every acceptance criterion has a passing test.**
  - AC 1: P3, P8, L1.
  - AC 2: P5, L2.
  - AC 3: P5, P6, L3.
  - AC 4: L5.
  - AC 5: P2, P4, L6, L7.
  - AC 6: P9, L8.
- [x] **No criterion is silently dropped.** The three defaults the story's approval confirmed all hold:
  - The entries sit just below **All authors** (`Index.jsx:289-292`).
  - They show even when nothing matches (no row-dependent filtering of `viewerAuthorOptions`).
  - The entry is greyed out, not hidden, when there's no Assistant (`viewerAuthorScope.js:31-35`).
- [x] **No behaviour beyond the story.** The one addition, the reset at `Index.jsx:184-188`, is what the ADR
      requires (§ Consequences and Amendment 1).

## ADR adherence
- [x] **Files match § Implementation notes exactly.** There is one new pure module,
      `ui/src/utils/viewerAuthorScope.js`. It exports `ME = '@me'`, `MY_ASSISTANT = '@my-assistant'`,
      `viewerAuthorOptions` and `resolveAuthorFilter`, and nothing else. The page edits are:
  - `useAuth` (`Index.jsx:46`);
  - the entries right after **All authors** (`:290-292`);
  - `filteredRows` resolving through the module, with `user` in its dependencies (`:173-179`);
  - one reset effect on `[authorFilter, user]` (`:184-188`).

  `authorOptions` and `authorDisplayName` are untouched, including the existing memo dependencies, as the
  ADR requires.
- [x] **The no-fallback rule holds by construction.** `resolveAuthorFilter(value, user)` takes no third
      input, and nothing in the module reads `useConfig()` or the roster (`viewerAuthorScope.js:44-49`).
      The page never passes `TA_PUBKEY` into either function.
- [x] **Layering.** The module has no React and no fetch. The page reads identity from `useAuth()`
      (Option A), not from the roster (Option B).
- [x] **No new dependencies.**

## Concept-graph integrity
- [x] No concept, handle, schema or firmware change. The only concept cited (`39998:<TA>:list`) is read,
      not written. No reinstall is needed.
- [x] N/A: no new code reads concepts.

## Things tests can't catch
- [x] **No secrets.** Fixture pubkeys are synthetic repeats (`'a1'.repeat(32)` and so on). The `sig` values
      in the spec are zero-filled placeholders that only ever go to mocked routes.
- [x] No `console.log` or debug code in `ui/`. The suite's `console.log`s are its runner output, the house
      pattern.
- [x] No commented-out code.
- [x] **Hooks are safe.** The new `useEffect` (`Index.jsx:184`) sits above the early returns (`:214`,
      `:224`), so hook order is stable across loading, error and loaded renders.
- [x] **No race with a valid choice.**
  - `AuthContext.checkStatus` never sets `user` to `null` before its fetch resolves (`AuthContext.jsx`
    `setUser` only after the answer). So a re-check while signed in can't briefly reset a valid **Me**.
  - `refreshUser` keeps the same pubkey (`AuthContext.jsx:166`).
- [x] **Security.** This is a view filter over public relay data. No endpoint, no write and no new input
      reaches the server. A forged selector value (DevTools) is either a reserved value, which resolves
      only from the caller's own session, or a literal pubkey, which is today's behaviour.

## House rules check
- [x] Concept Graph API authority respected (not applicable beyond orientation).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] N/A: the book has no PRD (acceptance frame).

## Findings

### Blocking
None.

### Non-blocking
1. **`ledger/2026-10-01-concept-headers-disposition-owner-signer.md:13-14`**: "A customer gets 403; an
   unauthenticated browser call gets 401 (checked against localhost:7778, 2026-10-01)."
   - Only the 401 was checked live. The 403 is read from `selfDeclare.js:53`, and the auth middleware may
     answer a customer session first, with its own status.
   - Optional improvement: say "a customer is refused (by code reading)" or check it live before the row is
     acted on.
2. **Story AC 2's count example.** "<shown> of <total> lists" is today's format only when something is
   filtered out. If every header on an instance were the person's own, the line would read "<total> lists".
   That's unchanged behaviour and not worth a test. It's noted so story 2 doesn't copy the example as a
   literal rule.

### Harness friction
1. None new. The ADR's wrong rationale for the reset was caught in Test Design by the mutant oracle and
   corrected as Amendment 1, which is the process working. The local Playwright environment lacks the
   Firefox and WebKit browsers that `playwright.config.js` still lists. Every plan already pins
   `--project=chromium`, so this cost nothing here.

## Verdict
**PASS**

The diff is the ADR's implementation, line for line. Every acceptance criterion is covered by a test that
passes on a fresh build. The rule this book exists for holds by construction: a person with no Assistant here
is never shown, and can never filter by, the Owner's Assistant.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed. The result is reported in the chat.
