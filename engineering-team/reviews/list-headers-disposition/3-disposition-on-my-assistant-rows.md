# Review: Story 3 — Disposition on My Assistant rows

**Reviewer:** Claude (acting as Reviewer), plus an independent adversarial pass by a fresh reviewer agent
**Date:** 2026-10-01
**Diff:** `git diff 9bf749ee..15c960d8` (story 3 since story 2's review; the branch is 0 behind `origin/staging`)

This is the book's first signing story, and the same session wrote its ADR, tests and code. So besides the
reviewer's own checks on a fresh `git archive 15c960d8` build, a separate reviewer agent with no prior context
was asked to break the owner's rule. It worked read-only:
- it ran no session for the Owner, an admin or a customer;
- it signed nothing;
- it ran stand-in probes in a scratch directory.

Each finding below that came from that pass was re-checked in the code by this reviewer before being recorded.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`. **The full run was not made on this machine** (it publishes live tag fixtures; OPEN.md row
      `2026-09-27-test-fixture-taggings-on-prod-relays`). Each suite below was checked for publish markers
      *before* running, and all had none:

  | Suite | Pass | Fail |
  |---|---|---|
  | `list-headers-my-assistant-disposition` (including both live refusals, L1 and L2, against the deployed routes) | 29 | 0 |
  | `list-headers-disposition-column` | 12 | 0 |
  | `list-headers-author-options` | 9 | 0 |
  | `stack-free-npm-test` | 7 | 0 |
  | `relay-scan-bounds` | 28 | 0 |
  | `site-trust-signals` | 28 | 0 |

- [x] Playwright, all three List Headers specs on a `vite preview` of the fresh build: **Chromium, 140 passed
      with `--repeat-each=5`.**
- [x] _Lint, typecheck, build: not configured._ The Vite bundle built cleanly.

## Spec adherence
- [x] **Every acceptance criterion has a passing test, as written:** AC 1 M1, M2 · AC 2 K1–K3, P1, H7, H8, M3–M5 ·
      AC 3 K4–K6, P2, H9, M6, M7 · AC 4 H1–H6, H10, L1, L2, M8 · AC 5 M3, M6, M9 · AC 6 M10.
- [ ] **AC 1 in practice. On a real list, the button often opens a panel the person can't see** (blocking 3).
- [ ] **AC 4's intent, "nobody else's signer", has two gaps the tests don't cover** (blocking 1 and 2).

## ADR adherence
- [x] **Files, routes, handler order, injected dependencies, the shared composition module, the panel and the
      page edits all match ADR 0003's Implementation notes.** Two small deviations are logged in the story's
      `## Deviations`.
- [ ] **The ADR itself missed two checks that a signing endpoint in this codebase needs** (blocking 1 and 2).
  - The ADR cited `dlist-curation/index.js` as the precedent. The newer signing routes already add a same-host
    check: `dlist-curation/update.js:356`, `tagging-edges/index.js:243`, OPEN.md row 326.
  - The ADR assumed the relay's latest header is trustworthy. These are design gaps, so the fix round starts
    with an ADR amendment.

## Concept-graph integrity
- [x] No concept, schema or firmware change.

## Things tests can't catch
- [x] **Who signs is right.** No session, a guest, an admin, and the Owner asking about another person's
      Assistant are all refused before any lookup or signature. Verified by H1–H6 and H10, by the live L1
      and L2, and by the independent pass.
- [x] **No tag or content can be injected from the request.** Only the d-tag comes from the URL. The body is
      ignored.
- [x] **No key material** in responses or logs (H11, H12, independent probe).
- [x] **No shell anywhere** on the request path.
- [ ] **The latest header isn't verified before it's re-signed** (blocking 1).
- [ ] **No cross-site check** (blocking 2).

## House rules check
- [x] Concept Graph API authority respected. No new tooling.

## Findings

### Blocking

1. **`src/api/list-headers/myAssistantDisposition.js:82-95`: the handler re-signs whatever the relay returns
   as the latest header, without checking it.**
   - It never checks the header's signature, its author, its kind, or that its d tag is the one in the URL.
   - Events can enter the relay unverified: `src/api/io.js:363` imports with `strfry import --no-verify`.
   - The independent pass verified, with stand-in parts, that a forged header failing signature verification
     comes back as `declared`. Its content and tags were the forger's, and its signature was valid and made
     by the caller's own Assistant. `b-defer` behaves the same.
   - The local relay holds no invalid headers today: 284 checked, 0 bad. But the path exists.
   - **Asked change:** after the lookup and before composing, refuse with nothing signed unless:
     - `header.pubkey === keys.pubkey`;
     - `header.kind === 39998`;
     - the header's first `d` tag equals the URL's d-tag;
     - the event verifies.

     Inject the verifier as a dependency (default: nostr-tools `verifyEvent` on a JSON round-trip, as
     `publishEvent.js` does), so the tests stay stack-free.
   - **Tests to add:**
     - a forged signature gets refused, with nothing signed or saved;
     - another author's event returned by the lookup gets refused;
     - a header whose first d tag differs from the URL's gets refused.

2. **`myAssistantDisposition.js:61-66`: there's no same-host check.**
   - The session cookie sets no `sameSite` (`bin/control-panel.js:210-219`). CORS reflects any origin with
     credentials (`:114-119`). The handler ignores the body.
   - So a page on another site can submit a form that makes a signed-in person's Assistant re-sign one of its
     headers. Submit drops a keep-private marker, and this feature can't withdraw a b-tag, so that change is
     permanent.
   - Whether the browser sends the cookie on such a cross-site POST depends on the browser. The house answer
     is the per-endpoint `sameHost(req)` check (`dlist-curation/update.js:107-115`, used at `:356`; same in
     `tagging-edges/index.js`), pending row 326's central fix.
   - **Asked change:** apply that check first, before `requireAuth`, with the same 403 answer, and add a test
     with no stack needed: a foreign `Origin` gets 403 with nothing looked up or signed, and a same-host
     request passes.
   - Requiring a JSON content type as well is optional. The UI already sends one.

3. **`ui/src/pages/lists/Index.jsx:353-365`: on a long list the panel opens out of sight.**
   - The panel renders above the table. On `:7778` as the Owner there are 183 **Disposition…** buttons.
   - Clicking the last one, `key migration test`, opened the panel 12,136 px above the viewport
     (`getBoundingClientRect().top = -12136`, viewport 768). To the person, nothing happened.
   - Most of the Owner's 168 undecided rows are in that position. The browser fixtures had nine rows, so no
     test could see it.
   - **Asked change:** bring the panel into view when it opens, and when **Next undecided →** moves it.
   - **Test to add:** with enough rows that the clicked row is well below the panel, the panel is inside the
     viewport after the click.

### Non-blocking
1. **`myAssistantDisposition.js:71`: the handle is decoded twice.** Express already decodes `req.params`. The
   extra `decodeURIComponent` (copied from `bDisposition.js:106`) turns a d-tag of `a%41` into `aA`, which is a
   different header of the caller's *own* Assistant. A lone `%` gives a 500. Recommended: drop the second
   decode in the fix round, with a test.
2. **A header with several `d` tags** would match the relay's `#d` filter under a coordinate that isn't its
   address. Blocking 1's first-d check covers it.
3. **Running both actions in the same second** on one undecided header can leave the relay and the graph
   disagreeing about which version won. This is the caller's own Assistant only, and needs two clicks in one
   second. Noted, not asked.
4. **Concept Headers has the same layout problem.** Its panel is at `ConceptList.jsx:350`, above the table at
   `:397`. The lookup in its handlers is unchecked too (`bDisposition.js:128-129`). These belong with its
   deferred fix (OPEN.md row `2026-10-01-concept-headers-disposition-owner-signer`). The lookup gap has been
   reported to the owner privately; see below.

### A separate security issue (not in this diff)
The independent pass found an app-wide weakness in request handling that predates this book and affects
deployed instances. It does not affect these endpoints, whose checks are inside the handler. Following
`SECURITY.md`, its details are not recorded in this file or in the ledger. They were given to the owner
privately, with a recommendation to file a private GitHub security advisory.

### Harness friction
1. **ADR 0003 picked the older of two precedents for "a route that signs with the caller's own key".**
   - The older one, `dlist-curation/index.js`, has no same-host check. The newer ones do, and OPEN.md row 326
     says to copy that check until it's centralised.
   - Nothing pointed the Architect at row 326 when designing a signing endpoint.
   - Filed as OPEN.md row `2026-10-01-signing-endpoint-precedent-misses-samehost` (meta).
2. **Test Design proved the tests bite with mutants, but every mutant was *a change to the design*, never an
   attack the design didn't anticipate.** The two security gaps and the off-screen panel were found only by a
   fresh adversarial reader and a check on real data. Recorded in the same row: for a signing story, an
   adversarial pass belongs in Test Design, not just Review.

## Verdict
**CHANGES_REQUESTED**

The core of the owner's rule holds: nobody gets someone else's Assistant to sign. But the endpoint will
re-sign a header it never checked (blocking 1), and it can be triggered from another site (blocking 2). Both
must close before this ships. The off-screen panel (blocking 3) makes the feature look broken on any real
list.

**Suggested fix round**, since the asks change the design:
1. An Architect amendment to ADR 0003: the same-host check, the header checks, a single decode, and bringing
   the panel into view.
2. Tester additions (failing first): H13–H16, S5 and M11.
3. Implementation.
4. Re-review.

## On PASS (same commit)
- [ ] Not applicable: the verdict is CHANGES_REQUESTED, and the story stays **Approved**.
