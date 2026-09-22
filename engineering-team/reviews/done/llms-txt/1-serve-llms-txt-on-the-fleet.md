# Review: Story 1 — Serve llms.txt on the fleet

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Diff:** `git diff origin/staging..feat/llms-txt` (4 commits: plan `eb08b102`, adr `30c6f4ad`, test `eb23f4a0`, impl `d228393e`; HEAD `d228393e`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — full 220-suite gate run to completion (label `reviewer-llms-txt`). Quote of the `npm run gate:status` line:

  ```
  20260922T023031Z-28769-2aea [reviewer-llms-txt] started 2026-09-22T02:30:31.422Z on d228393e — FAIL, exit 1, 3607 passed, 87 failed, 46 skipped, 220/220 suites; failed: profile-tags, profile-tags-publish, tag-detail, tag-detail-publish, tag-detail-write-publish, tag-index-publish, profile-tag-polish, pin-a-tag, tl-publication-from-pins, tl-publication-from-pins-publish, customize-pin-curation-publish, most-pinned-tag-index-publish, deploy-safety-status, event-less-create-set, capture-a-goal-and-see-it, tapestry-per-concept-detail-views, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, brain-first-tapestry-authoring, tl-membership-method-selector, tl-weighted-sum-method, tl-certainty-method, not-yet-shared-filter, concept-count-canonical, summaries-element-count
  ```

  A FAIL exit is expected here (per the harness's own convention) — what matters is whether the failing set is new. I programmatically diffed this 32-suite failing set against the pre-existing baseline (Meilisearch dependency / stale Neo4j fixtures / live-corpus drift, unrelated to this story): **the two sets are identical — zero new failures, zero resolved.** `llms-txt.test.js` is recorded `PASS, 27 passed, 0 failed, 0 skipped, 1220ms` inside this same run; `site-trust-signals.test.js` (the sibling suite this story's plumbing extends) is recorded `PASS, 28 passed, 0 failed, 0 skipped` inside the same run. Neither appears anywhere in the failing set.
  - Also ran `node test/llms-txt.test.js` standalone: 27 passed, 0 failed, 0 skipped — including all 12 `L1` live-network link checks (this environment has outbound network right now, so AC-7 was independently re-confirmed live, not just at Test Design time).
  - Also ran `node test/site-trust-signals.test.js` standalone (regression check on the sibling suite): 28 passed, 0 failed, 0 skipped.
  - `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)` — every `WAIVED`/`INFO` line is pre-existing and unrelated to this story.
- [x] `npm run test:playwright` — not run. This story has no browser/UI surface: the diff touches only `bin/control-panel.js` and `src/utils/siteTrust.js`; no file under `ui/` changed.
- [x] _Lint not configured — skipped (per role file)._ Ran `harness-lint.sh` anyway as a house-rule check (see above) — clean.
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

Verified each of the story's 8 ACs against both the actual served output and the actual test bodies (not just the test plan's coverage-map claim about them):

- **AC-1** (200, `text/plain; charset=utf-8`) — `H1` asserts this; independently re-confirmed live: `curl -D- :7778/llms.txt` → `200`, `Content-Type: text/plain; charset=utf-8`, body byte-identical to `buildLlmsTxt()` (3249 bytes both).
- **AC-2** (llmstxt.org format order) — `U1` structurally checks H1 → blockquote → `##` sections, including "only blank lines between H1 and blockquote." I read the actual shipped content directly and confirmed every list item under every `##` section really is `- [name](url): note` shaped, matching the format's list-link requirement (see Non-blocking #2 for a coverage-tightness note, not a defect).
- **AC-3** (exact 12-link inventory, 3 sections) — `U3`×3 / `U4` / `U5`. I additionally extracted the ADR's "Content sketch" fenced block and diffed it programmatically against the shipped `LLMS_TXT` constant: **byte-identical, 3249/3249 chars** — genuine transcription, zero drift.
- **AC-4** (blockquote/notes required facts) — `U2`'s regexes are substantive, not tautological (its wording differs from the source prose); I read the preamble and confirmed all three required facts (GrapeRank from a chosen POV; JS SPA returning an empty shell to non-JS clients; no global trust score) are genuinely present.
- **AC-5** (production `robots.txt` unchanged) — `U6` (byte-exact). Confirmed the diff leaves the indexing branch's source line (`'User-agent: *\nAllow: /\n'`) completely untouched, and confirmed by direct call that `buildRobotsTxt({allowIndexing:true})` still returns exactly that string.
- **AC-6** (non-production `robots.txt` exempts `/llms.txt`) — `U7` (ordering + all 3 falsy-arg forms) + `H2` (live). Independently re-confirmed live: this instance's `/robots.txt` returns `User-agent: *\nAllow: /llms.txt\nDisallow: /\n`.
- **AC-7** (every link resolves 2xx) — `L1`×12, all passed live in this environment. `OPEN.md` row 172 correctly extended to name `llms.txt`'s links in the renewal ritual, and proactively documents that an all-SKIP `L1` run isn't itself a clean bill of health (see the L-class design discussion below).
- **AC-8** (no regression to honest-404/SPA-passthrough) — `H3` + the full, untouched `test/site-trust-signals.test.js` suite (28/28 green). I went beyond the story's own tests and adversarially probed the live route: case variants (`/LLMS.TXT`, `/Llms.Txt` → 200, matching the pre-existing case-insensitive behavior already present on `/ROBOTS.TXT`), trailing slash (`/llms.txt/` → 200, same pre-existing tolerance as `/robots.txt/`), percent-encoded dot (`/llms%2Etxt` → 404 — correctly falls through to the honest-404 deny rule, confirming the percent-encoding-bypass fix from `site-trust-signals`' own review generalizes correctly to this new path rather than exposing a new bypass), double slash (`//llms.txt` → 404), query string (`/llms.txt?foo=bar` → 200). No regression found; probe paths (`/.env`, `/wp-login.php`, `/foo.json`) still 404, SPA passthrough (`/some/spa/route`) still 200, `/api/` routes still handled by the API layer.

No criterion silently dropped. Scope-creep check: the implementation commit (`d228393e`) touches **exactly** `bin/control-panel.js` and `src/utils/siteTrust.js` — verified via `git show --stat` in isolation on that commit — matching the ADR's Implementation Notes file-for-file. The two comment-block edits in `control-panel.js` ("Two" → "Three well-known documents", plus a new paragraph explaining why `llms.txt` shares the registration block despite having no dotfile problem) are necessary accuracy fixes — the old comment would otherwise misstate the file once a third route landed — not scope creep. The `OPEN.md` row 172 edit landed in the Test Design commit, exactly where the ADR's own Consequences section asked for it ("Test Design's to place").

## ADR adherence

- [x] Files changed match the ADR's implementation notes.
- [x] Layering / module boundaries respected.
- [x] No new dependencies the ADR didn't authorize.

The ADR's load-bearing claim — `isBlockedProbePath('/llms.txt') === true`, making route-registration order load-bearing — was independently re-verified, not trusted: called the function directly (`node -e "require('./src/utils/siteTrust').isBlockedProbePath('/llms.txt')"` → `true`). Read the actual registration order in `bin/control-panel.js` (line numbers, not assumption): `/.well-known/security.txt` route `:183`, `/robots.txt` route `:188`, **`/llms.txt` route `:198` (new)**, session middleware starts `:210`, `/docs` (Swagger) `:296`, `authMiddleware` `:301`, `api.register(app)` `:325` (inside the async IIFE), the honest-404 deny-rule's actual `isBlockedProbePath` call site `:353` (also inside the async IIFE — registered only after `api.register` resolves), SPA catch-all `:361`. The new route sits well before all of these, so it always wins the match. It also sits before `authMiddleware` and the session middleware — same intentional bypass pattern as its two siblings (per the updated comment), and I confirmed no unintended interaction: CORS middleware (registered earlier, `:114`) only adds headers / handles preflight and doesn't gate a plain `GET`, so nothing between static-asset serving and this route interferes.

No stray static `llms.txt` shadows the route — checked directly (`find -iname llms.txt` across the repo, outside `node_modules`) returns nothing under `dist/`, `public/`, or `ui/public/`, matching the ADR's explicit Guardrail and `S3`'s own check. `LLMS_TXT_PATH` is referenced inside `buildRobotsTxt`'s body before its own `const` declaration appears later in the same file — I checked whether this is a genuine hazard: it is not, because `buildRobotsTxt`'s body only *reads* `LLMS_TXT_PATH` when the function is *called*, and nothing in the module calls it during module evaluation — by the time any caller (`control-panel.js`, or either test file) invokes `buildRobotsTxt()`, the whole module has already finished loading top-to-bottom and `LLMS_TXT_PATH` is long since initialized. Confirmed empirically (direct call returns the exemption correctly). No new dependencies (diff doesn't touch `package.json`/`package-lock.json`). Only three files in the whole repo reference `buildLlmsTxt`/`LLMS_TXT_PATH` at all: `src/utils/siteTrust.js`, `bin/control-panel.js`, `test/llms-txt.test.js` — no hidden consumer, and grepping for any `siteTrust`/`buildRobotsTxt`/`buildSecurityTxt` reference across the whole `test/` tree turns up only the two expected files, so the `buildRobotsTxt` template-literal change has no other consumer to regress.

## Concept-graph integrity

- [x] N/A — story states "Concepts touched: None." Independently confirmed: the diff touches only `bin/control-panel.js` and `src/utils/siteTrust.js`, neither of which calls the Concept Graph API, defines a concept handle, or touches firmware-adjacent code. No `kind:pubkey:slug` handles involved anywhere in this diff. No firmware reinstall needed.

## Things tests can't catch

- [x] No secrets in committed files (grepped the implementation diff — clean).
- [x] No leftover debug logging or `console.log` added by this diff.
- [x] No commented-out code.
- [x] Error paths: `buildLlmsTxt()` is a pure function returning a module-level constant — it cannot throw, so there's no missing error path.
- [x] Concurrency: content is static, computed once at module load; no shared mutable state.
- [x] Security: the new route accepts no input (no params, no query parsing, nothing reflected); adversarial probing (case/encoding/trailing-slash/query-string variants, see AC-8 above) found no bypass — if anything it positively confirmed the prior percent-encoding fix now correctly covers this new path too.

One minor, non-blocking code-quality note found while reading the test file in full: `test/llms-txt.test.js`'s `fetchForLinkCheck` (~line 119) doesn't `clearTimeout(t)` in its `catch` block, so an early network failure (e.g. a fast DNS error, well before the 15s abort fires) leaves a harmless dangling timer alive for up to 15s. Not a correctness bug — it can't produce a false pass or fail, and the suite's `run()` doesn't wait on the event loop to drain — just avoidable untidiness (`finally` would fix it).

## House rules check

- [x] Concept Graph API authority respected — N/A (no concepts touched).
- [x] No new lint/typecheck/build tooling without an ADR — confirmed; `harness-lint.sh` clean.

## Product-guide adherence

N/A — this story does not trace to a PRD (sourced from `engineering-team/stories/_intake.md`'s 2026-08-18 entry, not the product team's `stories-queue.md`).

## Findings

### Blocking
None.

### Non-blocking
1. **`test/llms-txt.test.js:119-129`** (`fetchForLinkCheck`) — the `catch` block doesn't `clearTimeout(t)`, leaving a harmless dangling ~15s timer on an early network failure. Optional improvement: move the `clearTimeout(t)` call into a `finally` block.
2. **`src/utils/siteTrust.js:165-195`** (`LLMS_TXT` content) / **`test/llms-txt.test.js`** `U1`/`U3` — no single test pins that every section's list items follow the full `- [name](url): note` shape (leading list marker plus trailing note); `U3` only checks that the required URL appears as a `](url)` substring somewhere in the section body. I confirmed by direct reading that the actual shipped content is correctly shaped throughout, so this is a coverage-tightness observation on static, low-drift content, not a live defect. Optional improvement: a dedicated per-item regex assertion.
3. **L-class SKIP-vs-FAIL line** (`test/llms-txt.test.js`'s `fetchForLinkCheck`, story AC-7) — my own judgment call, since the task asked for it: any network-level exception (DNS failure, 15s timeout, TLS handshake failure, connection refused) SKIPs rather than FAILs; only a *completed* HTTP response with a non-2xx status FAILs. That means a link whose target host goes fully dark (DNS removed) or develops a persistent TLS misconfiguration would silently SKIP forever rather than ever alarm. I judge this proportionate, not a blocker: the single most realistic link-rot scenario the ADR itself names — one of the four referenced repos renaming its default branch away from `main` — produces an ordinary `404` HTTP response from `raw.githubusercontent.com`, not a network exception, so it **would** correctly `FAIL` under this design, not silently SKIP. The narrower residual gap (fully-dark host, persistent TLS failure) is also the one this diff's own `OPEN.md` row 172 edit explicitly names ("an all-SKIP `L1` run is not itself a clean bill of health, so re-check by hand at renewal time") rather than silently assuming away. No action requested.
4. **`engineering-team/stories/_intake.md`**, 2026-08-18 entry ("Serve llms.txt on the tapestry fleet") — still reads "**NOT PICKED UP**," which is now stale (the epic's own provenance line records it picked up 2026-09-22). Out of this review's write scope (`engineering-team/stories/**` was explicitly off-limits for this pass); flagging for the orchestrating session's bookkeeping.
5. The implementation commit's own message discloses that the four phase commits were briefly made directly on local `staging` before being moved onto `feat/llms-txt`, with local `staging` then force-reset back to `origin/staging`. Independently verified this holds: local `staging` (`4e568edf`) is exactly `origin/staging`, no divergence, no stray commits left behind. Recorded for transparency; not a defect in the diff under review.

### Harness friction
None. No stale doc, wrong port/path, or contradictory instruction was hit while running this review. (Finding #5 above was a workflow execution slip, self-corrected before reaching Review, not a defect in the harness itself.)

## Verdict
**PASS**

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place — **not performed by this review pass.** This review was run under an explicit task brief that scoped edits away from `engineering-team/stories/**`, `OPEN.md`, and `ledger/**`, reserving that bookkeeping for the orchestrating session. The verdict above is unconditional PASS; the flip should be applied on that basis.
- [x] Completion detection performed. Per this checklist's own instruction, the result and any book arithmetic are reported in the chat response to the orchestrating session, not recorded in this file.
