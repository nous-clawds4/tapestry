# The negentropy-sync input hotfix is on staging and waits for promotion to production

**Id:** 2026-10-09-negentropy-sync-hotfix-prod
**Type:** bug
**Opened:** 2026-10-09 (book `assistant-outbox-relays`, found by its story 3 review round 1)
**Status:** OPEN
**Done:** —

A pre-existing defect in `POST /api/negentropy-sync` (`src/api/pipeline/batch/commands/negentropySync.js`) was fixed outside
the story cycle, with the owner's approval, as hotfix commit `95876ca` on `staging`: strfry now runs with an argument
list, and a relay that is not a ws(s) address or a filter that is not a JSON object is refused with 400.
`test/negentropy-sync-input.test.js` pins it. The fix is not on `main` yet; promoting it to production is the owner's
decision. Close this row when it is on `main`.

Related, not fixed: the endpoint is open to any signed-in session and makes this instance sync with the relay the
request names. Whether it should be owner-only, or limited to public relays (`src/utils/ssrfGuard.js`), is a separate
decision.

**Pointer:** commit `95876ca`; `engineering-team/reviews/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md` § Out of scope
