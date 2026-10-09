# llms-txt's live test H1 still expects the domainless body, so it fails by design against any host with DOMAIN_NAME set

**Id:** 2026-10-05-llms-txt-h1-expects-domainless-body
**Type:** cleanup
**Opened:** 2026-10-05 (information-for-agents #1 review)
**Status:** OPEN
**Done:** —

ADR `information-for-agents/0001` made `buildLlmsTxt` take an optional `domain`. When `DOMAIN_NAME` is set and isn't
`localhost`, `/llms.txt` opens with a "## Start here" section linking that host's `/information-for-agents.md`.
`test/llms-txt.test.js` H1 (`:273–282`) still asserts the live body equals `buildLlmsTxt()` with no domain.

Today that holds: every workflow and deploy skill runs the suite against a local stack, where `DOMAIN_NAME` defaults to
`localhost`, and none sets `BRAINSTORM_BASE_URL` to a deployed host. Pointing it at staging or production, for
example during the information-for-agents book's live check, makes H1 fail even though nothing is wrong. The ADR left
the decision to Test Design, and the test plan recorded none.

**Fix shape.** Loosen H1 to the rule `test/information-for-agents.test.js` H4 already uses: the live body is either
`buildLlmsTxt()` exactly, or that body plus one "## Start here" section, placed before "## Protocols", linking
`https://<domain>/information-for-agents.md`.

**Pointer:** `test/llms-txt.test.js` H1; `test/information-for-agents.test.js` H4; review
`engineering-team/reviews/information-for-agents/1-information-for-agents-page-and-briefing.md` (non-blocking finding 2).
