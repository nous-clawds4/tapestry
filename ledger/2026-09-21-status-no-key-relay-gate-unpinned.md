# The assistant status endpoint's anonymous relay gate is unpinned on its no-key branch, and two editor behaviours have no CI-run check

**Id:** 2026-09-21-status-no-key-relay-gate-unpinned
**Type:** cleanup
**Opened:** 2026-09-21 (assistant-profile #3 review, non-blocking 1 and 5)
**Status:** DONE
**Done:** 2026-09-21 (assistant-profile #4, `c0efdd84`; #730, promoted by #731) — Q2 and Q3 in `test/my-assistant-page.test.js` pin the no-key branch's relay gate, Q3 through the real `getPersonName`; W15 and W16 are the CI-run counterparts of story 3's B7 and B3.

Two test gaps. The code is correct in both cases today; the gaps are that nothing would catch a regression.

**1. The anonymous gate on the person's-name lookup.**

ADR assistant-profile/0003 sub-decision 2 lets the name lookup reach the profile relays only for a caller
that ADR 0001 already allows to reach relays. An anonymous GET must stay on the local relay.

- **What is pinned:** the keyed branch of the status handler (Q4) and the resolver itself (N5), in
  `test/one-default-assistant-profile.test.js`.
- **What is not pinned.** Three one-token mutants pass every suite:
  - the no-key branch asks with `allowRelayLookup: true` (`src/api/assistant/index.js:389`);
  - the default `getPersonName` status dependency forces `true` (`:337`);
  - `getPersonName` ignores its flag (`src/api/assistant/profileDefaults.js:182-184`).
- **Why the no-key branch matters most:** it is the path an anonymous GET about an arbitrary pubkey
  actually takes. Story assistant-profile #4 is scheduled to edit that early return (the Owner-copy fix).
- **The review checked the real wiring by hand:** zero relay lookups for anonymous or stranger callers.

Fix shape (Tester's lane, before or with story 4):

- a Q-case for the no-key branch: anonymous and stranger give `false`, self gives `true`;
- one wiring test that drives the real `getPersonName` through the default status dependencies, with
  profileState's `queryRelaysKind0` stubbed.

**2. The test plan calls the W-class "the CI-enforced backstop for the B-class", but two B-tests have no
W counterpart.**

- B7 checks the editor's "NIP-05: none — …" line (`ui/src/components/AssistantProfileEditor.jsx`).
- B3 checks `useComposite`'s early return when the upload gives no public `url`.
- Removing either survives every Node suite, and CI does not run Playwright.

Fix shape: a W4 source check for both.

**Pointer:** `engineering-team/reviews/assistant-profile/3-one-default-assistant-profile.md`, non-blocking
findings 1 and 5 (the mutation table lists the surviving mutants);
`engineering-team/stories/assistant-profile/4-my-assistant-page.md`.
