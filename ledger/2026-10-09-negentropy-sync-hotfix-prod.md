# The negentropy-sync input hotfix is on staging and waits for promotion to production

**Id:** 2026-10-09-negentropy-sync-hotfix-prod
**Type:** bug
**Opened:** 2026-10-09 (book `assistant-outbox-relays`, found by its story 3 review round 1)
**Status:** DONE
**Done:** 2026-10-09 — PR #830 (`hotfix/negentropy-sync-input` → `main`, a cherry-pick of `95876ca` as `004f1b21`)
merged as `14e140b` after its required `stack-free` check passed and `scripts/check-safe-to-merge.sh` answered SAFE;
`deploy-tapestry.yml` run 139 deployed it; the production smoke test (tiers 1, 2, 3, 5) was clean, including an
anonymous `POST /api/negentropy-sync` answering 401.

A pre-existing defect in `POST /api/negentropy-sync` (`src/api/pipeline/batch/commands/negentropySync.js`) was fixed outside
the story cycle, with the owner's approval, as hotfix commit `95876ca` on `staging`: strfry now runs with an argument
list, and a relay that is not a ws(s) address or a filter that is not a JSON object is refused with 400.
`test/negentropy-sync-input.test.js` pins it. The fix is not on `main` yet; promoting it to production is the owner's
decision. Close this row when it is on `main`.

The access-scope question this fix left open has its own row: OPEN.md row `2026-10-09-negentropy-sync-access-scope`.

**Pointer:** commit `95876ca`; `engineering-team/reviews/done/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md` § Out of scope
