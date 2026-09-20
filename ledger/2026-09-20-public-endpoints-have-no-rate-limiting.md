# No endpoint in the repo is rate-limited, and there is no pattern to follow when one needs to be

**Id:** 2026-09-20-public-endpoints-have-no-rate-limiting
**Type:** feature
**Opened:** 2026-09-20 (nip05-ssrf-guard #1 — the intake's ask #2, resolved as "not here")
**Status:** OPEN
**Done:** —

Asked during nip05-ssrf-guard #1 whether `GET /api/nip05/verify` should be throttled. The finding,
confirmed against the tree: **no rate-limiting infrastructure exists anywhere.** No
`express-rate-limit`, `express-slow-down`, `axios` or `got` in `package.json` (only `express`), and
no `rate.?limit` / `429` / `throttl` reference under `src/`. Every unauthenticated endpoint is
equally unthrottled — `/.well-known/nostr.json`, `/api/search/profiles/meili`, `/api/auth/*`,
`/api/nip05/verify`.

Throttling one endpoint was deliberately **not** folded into an SSRF bugfix: it is a cross-cutting
concern affecting every public surface, it needs either a new dependency or a hand-rolled limiter,
and the house rule is that new tooling gets an ADR. The operator ratified that disposition at the
story's Planning gate on 2026-09-20.

**Shape when taken up:** its own story with an ADR — pick a mechanism (dependency vs. in-process
token bucket), decide what is limited (per-IP, per-endpoint, per-POV), decide what happens behind a
reverse proxy where the client IP arrives in a header that can be spoofed unless nginx is trusted to
set it, and apply it once across the public surface rather than endpoint by endpoint.

Note what this row is *not*: a claim that any endpoint is currently being abused. It records a
capability the codebase does not have, and the decision not to invent it inside an unrelated fix.

**Pointer:** `engineering-team/stories/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md`
§ Out of scope; `engineering-team/stories/_intake.md` lines 77–146 (intake ask #2 and the
Architect's call item 4).
