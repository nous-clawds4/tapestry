# Review: Story 1 — Live-feed read path: hermetic tests, legible degrade

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-05
**Diff:** `git diff e265d772..HEAD` (commits `3c22fbc4` failing tests, `76f751c4` implementation)

Story: `engineering-team/stories/test-hermeticity-ci/1-feed-hermeticity.md` (AC-1 amended at Test Design 2026-07-05, inline note).
ADR: — (Architecture skipped per the ratified book plan; design contract = story Background "Design direction" + `engineering-team/audits/test-hermeticity-ci/book.md` frame bullet 1).
Test plan: `engineering-team/stories/test-hermeticity-ci/1-feed-hermeticity.test-plan.md`.

## Quality gates (run by reviewer, not trusted)

- [x] **Suite alone (installed checkout):** `{"pass":37,"fail":0}` — matches the plan's post-implementation expectation. Suite output contains **no** `brainstorm.conf` / `BRAINSTORM_RELAY_PUBKEY` lines (AC-4's observable), only the two intentional degrade lines B11/H6 exercise.
- [x] **Bare-copy procedure (test plan §How to run — REQUIRED at review):** ran via `git archive HEAD` into a scratchpad dir outside the repo tree (not a `.claude/worktrees/` path). Result `{"pass":32,"fail":0,"skipped":5}` — **B9 PASSES (does not skip)**; exactly the 5 fixture-dep skips (M1/M2/M4/M5/E2), each printing its reason. The SKIP messages themselves ("fixture dep nostr-tools not installed") prove `nostr-tools` was genuinely unresolvable from that dir.
- [x] **Red-first (re-verified, not trusted):** rebuilt commit `3c22fbc4` (new tests, old module) in an installed-shaped scratch tree → `{"pass":31,"fail":6}`, H1–H6 failing on their own assertion messages, H7 passing as the standing guard — exactly what the test plan §Verification recorded.
- [x] **`npm test` (full aggregate, local Docker stack up with near-empty graph):** exit 1 — the documented half-alive-environment churn this book exists to fix (stories 2–4). **`live-feed-read-path suite: PASS (37 passed, 0 failed)`** in the aggregate. Failing suites (16): `profile-tags`, `profile-tags-publish`, `tag-detail-publish`, `tag-index-publish`, `profile-tag-polish`, `pin-a-tag-publish`, `tl-publication-from-pins`, `tl-publication-from-pins-publish`, `customize-pin-curation-publish`, `most-pinned-tag-index-publish`, `tag-detail-curated-view-and-pin-polish-publish` (live-API/publish class vs the empty local graph — OPEN.md row 13(b), story 2's scope), plus `harness-lint` (L9 GNU-date — row 19), `harness-stats` (book-throughput date math — row 19), `session-start` (`.claude/settings.json does not exist` — row 20; story 3's scope). **Grep-verified: none of the 16 failing suites references `feedReadPath`** (0 matches in every failing test file). The four suites that do reference it (`live-feed-read-path`, `live-feed-feed-page`, `note-surfaces-read-path`, `event-page-read-path`) all PASS.
- [x] `bash scripts/harness-lint.sh` — exit 0, clean (known waivers only).
- [x] `npm run test:playwright` — not applicable (no browser/UI change).
- [x] _Lint/typecheck/build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has passing coverage:
  - **AC-1 (bare-copy hermeticity, as amended):** bare-copy procedure passed above (zero failures, B9 passes, only fixture-dep skips, each visible with a reason) + `H4` as the in-suite deterministic proxy for the MODULE_NOT_FOUND class.
  - **AC-2 (doubles observably exercised):** `H1` (query built from the *injected* TA pubkey; injected runCypher runs; `relaySource === 'set'`), `H2` (invocation counters — both doubles must run before the empty-set fallback; a bypassed double is a failure, not a silent pass).
  - **AC-3 (legible degrade):** `H3` (runCypher throw → fallback + sentinel message + the word "fallback" in the log), `H4` (TA-read MODULE_NOT_FOUND-class throw → fallback + logged cause), `H6` (null TA → clean fallback, no `39999:null:…` handle queried).
  - **AC-4 (unchanged installed results; no host-config noise):** all 30 pre-existing tests green (37 total), `H5` asserts a fully-injected run emits no `brainstorm.conf`/`BRAINSTORM_RELAY_PUBKEY` output; confirmed absent from the actual suite output.
  - **AC-5 (no TA literal; runtime resolution):** `H7` standing guard (no 64-hex literal in the module source) **+ reviewer diff audit** — `grep -ciE '[0-9a-f]{64}'` over the full diff = **0** (sanity-checked the grep against a known token). Production default `realGetTaPubkey()` (`src/api/feed/feedReadPath.js:81–84`) lazily requires `../../utils/assistantKeys` and calls `getOwnerAssistantPubkey()`, whose chain I verified at `src/utils/assistantKeys.js:49–82`: env `TA_PUBKEY` → `brainstorm.conf` `BRAINSTORM_RELAY_PUBKEY` → SecureKeyStorage JSON → null. House rule intact.
- [x] No criterion silently dropped. The AC-1 amendment (30 tests, not the recon's 23; 5 fixture-bound skips allowed) is inline, dated, and honored by the plan and the diff.
- [x] No behavior added beyond the story: the seam's fifth dependency, the degrade logging (required by AC-3 — spec, not leftover debug), and one small pinned improvement: a null TA now short-circuits before the Cypher query instead of querying a nonsense `39999:null:…` handle (pinned by H6; strictly less wasted work in production).

## ADR adherence (design contract = story Background + book frame bullet 1)

- [x] Files match: exactly `src/api/feed/feedReadPath.js` + `test/live-feed-read-path.test.js` (plus the story's own artifacts: AC amendment + test plan — proper phase artifacts, committed at the test phase).
- [x] The seam contract is implemented verbatim: `deps?.getTaPubkey ?? options.getTaPubkey ?? realGetTaPubkey` (`feedReadPath.js:226`), same shape as its four peers; `resolveGeneralPurposeRelays(runCypher, getTaPubkey)` threading at `:157`/`:239`.
- [x] Lazy, runtime-resolved default — production callers (`buildFeed({ sessionPubkey })` with no deps) get the real helper chain unchanged.
- [x] No new dependencies, no new frameworks (suite-local helpers only: `requireFixtureDep`/`skip`/`requireNip19OrSkip`/`withCapturedConsole`).
- [x] Structural sentinels in the three sibling suites that regex-pin this module (`live-feed-feed-page` R2, `note-surfaces-read-path` R1, `event-page-read-path` R1: `resolveGeneralPurposeRelays` present, `FEED_CAP = 50`, export shape, four status literals) all still hold — confirmed by their aggregate PASS.

## Concept-graph integrity

- [x] No concepts created/renamed/re-parented; no event kinds, API routes, or wire formats changed. The relay-set handle is still runtime-composed `39999:<ta>:the-set-of-general-purpose-relays` (`kind:pubkey:slug`).
- [x] Firmware reinstall: not needed (no concept definitions changed).
- [x] No new code re-derives from BIBLE.md; no orientation change.

## Things tests can't catch

- [x] No secrets in committed files (diff scanned).
- [x] No leftover debug logging — the `console.error` in `logRelaySetDegrade` (`feedReadPath.js:144–148`) is **required by AC-3** (legible degrade); it is the spec. One line, names stage + message + optional error code + the fallback decision.
- [x] No commented-out code.
- [x] Error paths: TA-read throw, falsy TA, and query throw are guarded separately (`feedReadPath.js:157–190`) so a packaging failure is no longer indistinguishable from an empty set. The genuinely-empty-set path stays unlogged — correct: an empty set is a legitimate outcome, not a failure (AC-3 covers failure paths; H2 pins the fallback without demanding a log).
- [x] `requireFixtureDep` re-throws non-`MODULE_NOT_FOUND` errors — a broken fixture dep still fails loudly instead of masquerading as a skip.
- [x] `withCapturedConsole` restores console in `finally` — exception-safe; tests run sequentially so the global swap cannot race.
- [x] `run()`'s new return shape (`skipped` only when nonzero) is compatible with the aggregator: `test/test.js:262/489/620` read only `.pass`/`.fail`; in installed environments skipped=0 so the shape is literally unchanged. (Surfacing skips in the summary is story 2's scope, per the plan.)
- [x] Test-design integrity: the 5 modified fixture tests still **run** when `nostr-tools` is present — verified by gate 1 (37 pass, 0 skips in the installed checkout). Nothing weakened in installed environments.
- [x] Scope: the two sibling silent catches deferred by the story's Out of scope are untouched — `resolveSource`'s settings-read catch (`feedReadPath.js:114–116`) and `enrichNotes`' author-enrichment (`src/api/_shared/noteEnrichment.js`, absent from the diff). No creep elsewhere (4 files total, all in-scope).

## House rules check

- [x] Concept Graph API authority respected (nothing domain-conceptual touched).
- [x] No new lint/typecheck/build tooling.
- [x] TA-pubkey house rule: intact and *strengthened* — the read is now injectable in tests and runtime-resolved in production, with H7 as a standing guard against future literals in this module.

## Product-guide adherence

- N/A — no-PRD book (acceptance frame); no UI copy or design surface touched.

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/feed/feedReadPath.js:217–218`** — `buildFeed`'s `@param` JSDoc still lists only the original four injectable deps ("getSettings, scanStrfry, runCypher, querySync"); the module header (`:19–34`) correctly lists five. Optional: add `getTaPubkey` to the `@param` line on the next touch.
2. **`test/live-feed-read-path.test.js:412` (B11), `:866` (H6)** — these exercise the new degrade logging without `withCapturedConsole`, so the suite output now carries two intentional `[feed] relay-set resolution failed…` lines. Cosmetic (not host-config noise; AC-4 bans only `brainstorm.conf`/`BRAINSTORM_RELAY_PUBKEY` output). Optional: wrap both in `withCapturedConsole`.
3. **`src/api/_shared/relaySource.js:66–86` and `src/api/notes/userNotesReadPath.js:116`** — cross-module clones of the *pre-fix* `resolveGeneralPurposeRelays` (non-injected TA read inside the same silent catch; `eventReadPath.js` consumes the `_shared` copy). Same hazard class this story just fixed, but **not** in this story's scope (frame bullet 1 names `feedReadPath.js` specifically) and not on the story's Out-of-scope list either — the deferral list only names the two in-module sibling catches. The diff correctly did not creep into them. Recommend an `engineering-team/stories/_intake.md` entry (or fold into the deferred "legibility pass") so the clones don't silently miss the book.

### Harness friction

1. **Book recon's test-count claim was empirically wrong (23 vs 30).** `book.md` frame bullet 1 says the suite "passes 23/23"; at Test Design the suite was found to have 30 tests, 5 of them fixture-bound to `nostr-tools` and unpassable bare. **Adequately self-corrected in-cycle:** AC-1 was amended with a dated inline note, and the test plan carries the empirical counts and the amended bare-copy expectation (`32 pass / 0 fail / 5 skipped`). No new OPEN.md meta row warranted — the amendment is the durable record. One residual for the book-close Reviewer: the frame text still reads "23/23" and must be read through the story's amendment when judging bullet 1 at close (the build audit is the natural place to reconcile the number).

## Verdict

**PASS**

## On PASS (same commit)

- [ ] Story `**Status:**` flip to `Done` — deferred to the main loop per this session's instructions (Reviewer wrote only this file).
- [x] Completion detection run: book `test-hermeticity-ci` checked — frame bullet 1 is now satisfied; bullets 2–4 (stack-free `npm test`, portable harness suites, CI job) are not. **The book is not complete; no `/close-book` offer.**
