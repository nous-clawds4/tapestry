# llms-txt's link check reads a cloud egress 403 as a broken link, so the gate fails in cloud sessions

**Id:** 2026-10-04-llms-txt-egress-403-false-fail
**Type:** meta
**Opened:** 2026-10-04 (the V4V Songs views session; `npm test` in a Claude Code cloud container)
**Status:** OPEN
**Done:** —

**What was seen.** `test/llms-txt.test.js` L1 fetches each `llms.txt` link with Node's global `fetch`. In the cloud
container that fetch doesn't go through the agent proxy, and `https://api.brainstorm.world/openapi.json` answered 403;
curl through the proxy, and `NODE_USE_ENV_PROXY=1 node …`, both got 200. L1 SKIPs on "no network" but treats any
HTTP status as the link's own answer, so the whole gate reported FAIL (4860 passed, 2 failed) on a change that didn't
touch it. The other failure, harness-lint, is the pre-existing L10 violation on commit a04f95a. *(2026-10-09: not a real
violation. `a04f95a` was the shallow clone's boundary; see OPEN.md row `2026-10-07-shallow-clone-trips-lint-l10`, fixed by
`harness-gate-integrity` #3.)*

**Fix shape.** Make L1's fetch honour `HTTPS_PROXY` (an undici `EnvHttpProxyAgent`, or `NODE_USE_ENV_PROXY=1` in the
gate's environment), or treat a 403 that carries no body from the site itself as "no network" (SKIP) rather than FAIL.

**The same class in a sibling suite (book `admin-action-owner-check` close, 2026-10-11, audit §7 #7).**
`test/information-for-agents.test.js` L1 checks every link in the agents' briefing with the same kind of fetch. It
already SKIPs a 403 whose body is the egress gateway's (`isEgressRefusal`), but it reads a 502 or 504 that the proxy
writes as the link's own answer. The book's coordinator saw its github.com links fail that way, intermittently, during
full runs on changes that did not touch the suite. The fix shape above should cover both suites, and treat a
gateway-written 5xx (no answer from the site itself) as "no network" too. Row 172's renewal ritual relies on both
checks; it does not cover a flaky run.

**Pointer:** `test/llms-txt.test.js` (`fetchForLinkCheck`, L1); OPEN.md row 172 (the renewal ritual that relies on L1).
