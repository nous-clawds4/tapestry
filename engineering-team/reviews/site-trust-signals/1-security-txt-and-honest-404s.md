# Review: Story 1 — security.txt, robots.txt, and honest 404s

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-12
**Diff:** working tree vs `origin/staging`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. `Overall: PASS`, no failing suites, 53 skipped (stack-optional suites).
      Re-run after the encoding fix below; result recorded in chat.
- [x] `node test/site-trust-signals.test.js` — **PASS** (25 passed, 0 failed, 0 skipped).
- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**.
- [x] Browser verification — app renders, no console errors, `/developers/nip-50` resolves on direct load.
- [ ] `npm run test:playwright` — not applicable; no UI change.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test. Coverage map in the test plan; all 11 ACs mapped.
- [x] No criterion silently dropped.
- [x] No behavior added that isn't in the story. The `ALLOW_INDEXING` compose passthrough is not extra
      scope — it is what makes AC-5 true on the one host where AC-5 matters.

## ADR adherence

- [x] Files changed match ADR 0036's implementation notes: `src/utils/siteTrust.js` (new, three
      exports as specified), `bin/control-panel.js` (two routes + deny rule), `SECURITY.md` (new).
- [x] Layering respected. The document builders are pure and unit-testable without booting Express;
      `control-panel.js` holds only wiring.
- [x] No new dependencies.
- [x] The rejected options stayed rejected — no SPA route allow-list, nothing pushed into nginx.
- [x] `Canonical` rendered from `process.env.DOMAIN_NAME`, omitted when unset or `localhost`
      (verified: local instance serves the document with no `Canonical` line).
- [x] `Host` header not consulted.

## Concept-graph integrity

- [x] N/A. No concepts touched, no handles, no firmware change. The story sits at the HTTP layer and
      is POV-independent by design — it asserts something about the *operator of the server*, not
      about any POV's view of the graph. Consistent with CLAUDE.md's invariants rather than an
      exception to them.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No debug logging added. (The pre-existing `console.log` in the `express.static` MIME handlers is
      untouched and out of scope.)
- [x] No commented-out code.
- [x] Error paths: a malformed percent-escape cannot throw out of `isBlockedProbePath` — verified both
      by unit test and live (`/%zz%` → 400 from Express's own URL parser, not a 500).
- [x] Concurrency: none. Both handlers are pure functions of configuration; no shared mutable state.
- [x] Security: the deny rule sits after `express.static`, so it cannot 404 a real asset; it exempts
      `/api/`; and it returns a bare `Not found` with no path echo, so there is no reflection vector.

## House rules check

- [x] Concept Graph API authority respected (not applicable — no concept work).
- [x] No new lint/typecheck/build tooling.
- [x] **No per-deployment value hardcoded.** Both the hostname (`DOMAIN_NAME`) and the indexing policy
      (`ALLOW_INDEXING`) are configuration. Sentinel `S4` guards this, and it is the house rule most
      at risk in a story whose whole subject is deployment hostnames.

## Findings

### Blocking

1. **`src/utils/siteTrust.js` — percent-encoding bypassed the deny rule.** Express does not
   percent-decode `req.path`, so classifying the raw string let encoded probes through: `/%2Eenv`,
   `/wp-login%2Ephp`, and `/config%2Ejson` all returned **200** with the SPA shell, which is precisely
   the signal the story exists to remove. Found by adversarial probing at review, not by the
   happy-path suite. No security exposure — the response is the SPA shell, and traversal was already
   blocked — but a trivially-bypassable rule does not satisfy the intent of AC-7.
   **Asked change:** decode before classifying, tolerating malformed escapes.
   **Status: FIXED in this cycle.** `decodeURIComponent` inside a `try`, falling back to the raw path.
   Covered by new test `U12`, which also pins that decoding does not start flagging real routes
   (`/user/abc%20def`, `/pin/my%2Epinned%2Etag`). Re-verified live: all four encoded probes now 404,
   all prior 200s and 404s unchanged. A welcome side effect — `/%2e%2e/etc/passwd` decodes to `/../…`,
   whose `..` segments the dotfile rule catches, so it 404s too.

### Non-blocking

1. **`src/utils/siteTrust.js` — `ESTATE_ATTESTATION` is duplicated across three repositories.**
   `Brainstorm-UI` and (pending) the relay configs carry their own copies; they are separate repos and
   cannot import it. Divergence is a real risk, and a wrong entry undermines the exact claim the file
   exists to make. Mitigated by an explicit note on the export and by OPEN.md row 173, which proposes
   a resolve-check so the attestation cannot silently rot. Not blocking: no mechanism exists today to
   share code across these repos, and inventing one is out of scope.
2. **`EXPIRES` is a static date that will fail the suite on 2027-08-11.** This is by design, not an
   oversight — the alarm is the point, and auto-rolling the value would defeat what the field means.
   Recorded as OPEN.md row 172 so it is discoverable before the test goes red rather than after.
3. **Extensionless unmatched paths (`/foobar`) still return the SPA shell.** Explicitly accepted in
   ADR 0036's Decision, and re-affirmed at the Test Design gate. Noted so a future reader does not
   mistake it for an omission.

### Harness friction

1. **A source-order sentinel located the `require` instead of the call site.** `S2` used
   `src.search(/isBlockedProbePath/)`, which returns the first occurrence — the top-level import,
   which necessarily precedes `express.static` — making the assertion unsatisfiable against a correct
   implementation. The tempting response was to reshape the implementation around the broken proxy.
   Fixed with `lastIndexOf`. Filed as **OPEN.md row 174** (`meta`), noting it is the mirror image of
   row 169: there, tests passed against broken code; here, a test failed against correct code. Both
   stem from asserting on a proxy for the property rather than the property itself.

## Verdict

**PASS**

The one blocking finding was found, fixed, covered by a new test, and re-verified live within this
cycle. Both defects that mattered — the encoding bypass and the `ALLOW_INDEXING` compose gap — were
caught by probing beyond the acceptance criteria rather than by the criteria themselves, which is
worth remembering for stories in this shape: the ACs described the happy path competently and neither
defect violated one as written.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done`.
- [x] Completion detection performed — result recorded in chat, not here.

## Deploy obligations (carried out of this review)

These are **not** code changes and will not be caught by CI. They must accompany the promotion:

1. **`ALLOW_INDEXING=true` in `.env` on the `tapestry.brainstorm.world` droplet only.** Without it,
   production serves `Disallow: /` and drops out of search results. Every other host must be left
   unset.
2. **`DOMAIN_NAME` must be set on each droplet** (it already is, per `docker-compose.yml`) or
   `Canonical` will be silently omitted. Verify per host after deploy.
3. **Per-host smoke:** `curl -sI https://<host>/.well-known/security.txt` → `text/plain`;
   `curl -s -o /dev/null -w '%{http_code}' https://<host>/.env` → `404`.
