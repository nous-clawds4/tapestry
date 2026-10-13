# Three small test tidy-ups the Assistant Duties reviews left non-blocking

**Id:** 2026-10-12-duty-settings-test-cleanups
**Type:** cleanup
**Opened:** 2026-10-12 (`assistant-duties-settings` book close)
**Status:** OPEN
**Done:** —

- **AD4's title overclaims.** In `test/assistant-self-map-check.test.js`, AD4 says "no true claim is flagged false", but
  its world publishes no self-Map, so that part holds whatever the code does. Either drop the phrase or add a published
  `30382:rank` claim. With one, the line is flagged false, which ADR `assistant-self-map/0001` A2 item 4 calls correct
  for a kind that is not offered. Review round 2 note 1.
- **An unused fixture constant.** `test/helpers/assistantDutiesFixtures.js` still exports `MAX_KEY_LENGTH = 512`,
  which nothing uses since ADR 0001 Amendment 1. Review round 2 note 3.
- **A2 reads raw source.** `test/assistant-duties-settings.test.js` A2 reads `src/api/index.js` raw, so a
  commented-out registration would satisfy it. Return it to a stripped source once ledger row
  `2026-10-12-codeonly-reads-string-slash-star` is fixed. Review round 1 note 5.

**Pointer:** `engineering-team/reviews/assistant-duties-settings/1-the-assistant-duties-tab.md`.
