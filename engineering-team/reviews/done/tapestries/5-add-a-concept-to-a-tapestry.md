# Review: Story 5 — Add a concept to a Tapestry (add-only, on the existing Exploration page)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-28
**Diff:** `git diff db7c5a7a...e3e9de51` (baseline = origin/staging; phase commits c1a0920e story,
1dad85c4 ADR, cd938861 failing tests / Gate-3 anchor, e3e9de51 impl = HEAD; working tree clean)
**Story:** `engineering-team/stories/tapestries/5-add-a-concept-to-a-tapestry.md`
**ADR:** `engineering-team/decisions/tapestries/0005-add-concept-add-only-republish.md`
**Test plan:** `engineering-team/stories/tapestries/5-add-a-concept-to-a-tapestry.test-plan.md`
**Mode:** operational Direction book `audits/add-a-concept-to-a-tapestry/book.md` (Director at the
gates; owner-strict affordance gate is a recorded gate ruling — ADR Decision 3).

## Quality gates (run by reviewer, not trusted)

- [x] New Node suite, isolated (`node -e "require('./test/add-a-concept-to-a-tapestry.test.js').run()…"`)
  — **23 passed / 0 failed** (P1–P13, S1–S6, R1–R4). Run by me at HEAD.
- [x] Sibling Node suites touched by this diff, isolated, run by me: `create-tapestry` **22/0**
  (the sentinel-tension suite — green through the docstring, see Findings #1),
  `tapestry-per-concept-detail-views` **20/0**, `tapestry-key-put-await` **3/0**.
- [x] New Playwright spec (`BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test
  tests/brainstorm/tapestry-add-concept.spec.js --project=chromium`) — **13 passed / 0 failed**
  (3.5s) against the live local control panel. A passing E1 also proves the served bundle contains
  the new source (the affordance could not render from a stale build).
- [x] Sibling Playwright specs (`tapestry-create` + `tapestry-exploration` +
  `tapestries-nav-and-directory`) — **18 passed / 1 failed**. The 1 failure is
  `tapestries-nav-and-directory.spec.js:191` AC-5 (story #1's inert-placeholder assertion),
  **verified pre-existing, not this diff's doing**: the spec was last touched in #1's test commit
  (`f070d0ee`), `NewTapestry.jsx` last touched in #3 (`526dc645`) — both at/before the baseline —
  and this diff touches neither that spec nor `NewTapestry.jsx`/`Index.jsx`. Story #3 deliberately
  removed the placeholder AC-5 asserts (its own S6 sentinel forbids it). Outside the `npm test`
  gate. Filed as OPEN.md #116 (see Harness friction).
- [x] Full `npm test` — not re-runnable inside one review command (~32 min > tool ceiling); the
  binding gate is corroborated on committed primary evidence instead: Gate-4 log
  `audits/add-a-concept-to-a-tapestry/gate4-full-npm-test-2026-07-28.log` shows **`GATE4_EXIT=0`,
  `Overall: PASS`, `add-a-concept-to-a-tapestry suite: PASS (23 passed, 0 failed)`**, identical
  full-suite command. My own isolated runs above independently cover every suite this diff can
  touch; the `test/test.js` registration diff is purely additive and complete (require, run,
  summary line, `overallOk` term, skip roll-up — all five verified in the diff).
- [x] Test-path integrity: `git diff cd938861..HEAD -- test/ tests/` is **empty** — the Implementer
  touched no test file after the Gate-3 anchor (verified by me, not taken from the journal).
- _Lint / typecheck / build — not configured; skipped per house rules._

## Spec adherence

- [x] **AC-1 offered only where editing is possible** — E1 (TA-authored, owner, same URL), E8
  (owner-authored); negatives E2 (guest), E3 (unauthenticated), E4 (**admin — owner-strict**, the
  Director's recorded ruling), E5 (foreign author, even for the owner); S4 pins the gate expression
  (`classification === 'owner'`, `hasAdminAccess` forbidden, runtime `taPubkey`). Gate code at
  `TapestryDetail.jsx:188-189` matches the ADR expression exactly; negatives are non-vacuous (each
  first asserts members render). All pass.
- [x] **AC-2 only non-members addable** — E6 (member excluded, non-member offered), P6
  (duplicate-member throw), P7 (slug-collision throw). Picker excludes by uuid
  (`AddConceptToTapestry.jsx:34-44`, Decision 2-A: the event's own graph block, not the composed
  graph); transform throws independently (defense in depth). All pass.
- [x] **AC-3 save = adding only, published as tapestries already are** — P1 (same coordinate on the
  bare-hex `b0b48b00`), P2/P3/P5 (envelope, tag order, byte-identical pass-through, input not
  mutated), P4/P11 (create-shaped member, divergent `conceptGraphSlug`, import dedup), P8
  (`created_at` strictly newer — the tie-loss failure class the evidence goal existed for), P9
  (refusals), P12 (coordinate follows the event's author), E7 (TA branch: `signAs:"assistant"`,
  same d-tag, prior nodes + relationships intact, one append, no navigation), E8 (own-key branch:
  NIP-07 + `signAs:"client"` under the existing author key), E11 (failed publish → inline error,
  membership unchanged), R3 (server 403 gate intact). No new endpoint (no `src/api` change in the
  diff); no new page/route (no router change in the diff). All pass.
- [x] **AC-4 visible to me** — E9 (element-scan count grows after save + member renders: re-read,
  not optimism), S5 (`useTapestryGraph` exposes `event` + `reload`). Pass.
- [x] **AC-5 visible to anyone else afterwards** — E10 (fresh unauthenticated session, same uuid,
  member renders, still no affordance). Pass.
- [x] No criterion silently dropped; no behavior beyond the story (diff surfaces = exactly the
  ADR's six named files + Tester files + harness artifacts).
- [x] Disclosed automation gaps (test plan, recorded for me): **double-submit busy-guard** —
  manually verified in source: re-entry guard `AddConceptToTapestry.jsx:57`, input
  `disabled={busy}` (line 102), and the results panel hidden while busy (line 104), so no second
  pick is clickable mid-publish. **Live directory non-duplication** — accepted as structural:
  P1/E7/E12 pin the verbatim d-tag (same kind + author + d-tag), NIP-01 replacement was verified
  live by the book's evidence goal, and the directory reads by `#z` scan of the same relay. Both
  gaps are legitimately not-automated, not coverage holes.

## ADR adherence

- [x] Files changed match ADR §Implementation notes one-for-one: edit `tapestryDraft.mjs` (new
  export `buildAddConceptDraft`, `buildTapestryDraft` untouched — R1), new `useConceptOptions.js`
  (extraction is verbatim — diff-compared removed lines against the new file), edit
  `useCreateTapestry.js` (`create()` unchanged — R4 + create-suite S4/S7), new
  `AddConceptToTapestry.jsx`, edit `useTapestryGraph.js` (`event` + `reload` only; parsing,
  import resolution, `composeGraph` untouched — R2), edit `TapestryDetail.jsx` (gate + sidebar
  render + `rawGraph === null` degraded first-add branch; `notFound`/error/malformed get nothing).
- [x] Layering respected: transform pure and React-free; signing branch keyed on the event author
  (data, not a decision); both publish paths verbatim #3's.
- [x] No new dependencies (`package.json`/lockfile untouched), no new tooling.
- [x] **Story `## Deviations` audited against the ADR, all three accepted:**
  1. *`useAuth()` dropped from the component* — correct call: the render gate lives in
     `TapestryDetail`, the signing branch keys off `event.pubkey`, and `getActiveSignerOrThrow(author)`
     pins the extension to the author key; an unused hook call would be noise. Every normative
     Decision-3 behavior is implemented as written.
  2. *Docstring documents the delegated picker contract* — the cross-suite sentinel tension; ruled
     on the merits in Findings #1 (accepted, with a follow-up).
  3. *Refusals slightly broader than the ADR's named list* (non-object `json` parse; `imports`
     present-but-not-array; `graph: null` treated as absent) — all inside Decision 1-A's "refuse
     what can't be preserved" principle, and the `graph: null` reading is exactly aligned with the
     page's `rawGraph === null` first-add gate (`useTapestryGraph.js:61` maps a falsy graph to
     `null`; the transform's `existing != null` check agrees). Coherent, not drift.

## Concept-graph integrity

- [x] Handles are `kind:pubkey:slug` throughout (`39998:<TA>:<slug>` headers,
  `39999:<TA>:<cg>-concept-graph` imports, `39999:<author>:<dTag>` tapestry coordinate).
- [x] No concept definitions changed → **no firmware reinstall needed** (ADR states it with the
  correct reason; the republished tapestry is an element, not a definition; diff confirms).
- [x] Picker reads strfry kind-39998 headers rather than `/summaries` — the ADR-sanctioned
  canonical picker source (ADR tapestries/0002), carried over verbatim by the extraction; the
  design itself oriented via the three-call concept-graph pattern (ADR §Context).

## Things tests can't catch

- [x] No secrets: pubkey/sig literals are synthetic fixtures in test files only (test-plan-sanctioned).
- [x] No `console.log`/debug/`TODO`/commented-out code in any changed production file (swept).
- [x] No XSS: all new rendering is React text interpolation; error messages rendered as text.
- [x] Error paths: TA branch surfaces `data.error` or status; own-key branch surfaces signer-guard
  and co-publish failures; transform throw messages are user-legible and shown inline; membership
  untouched on every failure path (nothing optimistic anywhere).
- [x] Concurrency: double-submit guarded (see AC-3 note); stale in-flight reads cancelled
  (`cancelled` flag); two-tab edits are last-write-wins with whole-event granularity — accepted
  explicitly in ADR §Consequences (single-owner actor).
- [x] Architecture invariants: publication stays permissionless (only TA-*impersonation* is
  server-gated — the same 403 create has); no global trusted-set precompute; membership judged
  from the event being edited, re-derived on every read.

## House rules check

- [x] TA pubkey runtime-resolved everywhere in production code (`useConfig().taPubkey` —
  `AddConceptToTapestry.jsx:24`, `TapestryDetail.jsx`, `useConceptOptions.js:45`); no literals;
  `LEGACY_*` constants untouched (ADR 0015 respected).
- [x] No new lint/typecheck/build tooling.
- [x] Owner's boundary held verbatim: adding only (structural, by verbatim-copy construction), no
  new page, no new server endpoint, existing publish paths, affordance never offered on foreign
  tapestries or to non-owners.

## Product-guide adherence

- N/A — no PRD behind this book (operational Direction, acceptance frame). Copy follows the
  sibling NewTapestry idiom and reuses its CSS classes.

## Findings

### Blocking

None.

### Non-blocking

1. **Cross-suite sentinel tension — accepted on the merits; follow-up filed.**
   `test/create-tapestry.test.js` S3/S8 (story #3, committed) regex-require picker terms
   (`queryRelay`, `39998`, `searchText`, `oSlugs`, `oKeys`, `description`) in
   `useCreateTapestry.js`; ADR 0005's sanctioned extraction moved that code to
   `useConceptOptions.js`, and the Implementer satisfied the old sentinels with a docstring
   (`useCreateTapestry.js:12-19`) while touching no test file. Ruling: **acceptable here** —
   (a) the docstring is *truthful* (it documents the delegated contract, which I verified matches
   the extracted code line-for-line); (b) the behavioral pin did not evaporate, it moved: new-suite
   S6 regex-pins `queryRelay`/`39998`/`searchText` in `useConceptOptions.js` itself, R4 + create
   E-specs prove create still works, and create-S8's page half still pins real code in
   `NewTapestry.jsx`; (c) the alternative — the Implementer editing a committed test file — is the
   worse violation under this harness (Gate-3 anchor integrity is the stronger protection).
   Residue: S3/S8 are now prose-satisfied location-pins that would stay green even if
   `useConceptOptions.js` later changed its source — dead weight as sentinels. **Asked follow-up
   (Tester's lane, next touch of that suite):** relax S3/S8 to probe the shared hook, per the
   story's own Deviations suggestion. Tracked in OPEN.md #116.
2. **`tests/brainstorm/tapestries-nav-and-directory.spec.js:191` (AC-5) is a standing false alarm**
   — pre-existing, permanent failure since #3 replaced the placeholder it asserts; outside the
   `npm test` gate; verified not-this-diff (see Quality gates). Rewrite or retire it against the
   shipped create form; fold with OPEN.md #89(b), same file. Tracked in OPEN.md #116.
3. **`engineering-team/epics/tapestries.md:37`** — the story list annotates #5 *(Draft)*; stale the
   moment this review flips the story to Done. Cosmetic; the epic close-out sweep (branch merge)
   should refresh it. Not worth a commit of its own.
4. **`useTapestryGraph.js` `reload()` doesn't reset `loading`** — during the post-save re-read the
   page shows the previous state until the fresh read lands. Arguably the better UX (no flash),
   and E9 proves the eventual state is the published truth. Observation only; no change asked.

### Harness friction (→ OPEN.md, type `meta`)

1. Committed test artifacts from earlier stories are brittle across later *sanctioned* changes, and
   no phase owns amending them — two instances converged on this story (the S3/S8 prose-satisfied
   sentinels; #1's permanently-failing AC-5 spec). Lesson: when an ADR sanctions moving or
   replacing behavior an older suite pins, the ADR/story should name the affected old tests so the
   Tester can amend them inside the same cycle instead of leaving the Implementer a
   letter-vs-spirit dilemma. Filed as **OPEN.md #116** with both instances and the asked fixes.

## Verdict

**PASS** — every acceptance criterion has passing coverage I ran myself; the diff matches the ADR's
decisions and named surfaces exactly (deviations audited and accepted); the owner's boundary is
honored verbatim; house rules clean; test files untouched since the Gate-3 anchor; no blocking
issues. Mergeable as-is.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (review link filled in Linked artifacts).
- [x] Completion detection run: book `audits/add-a-concept-to-a-tapestry/book.md` — **the book now
  looks complete.** Every acceptance-frame bullet is satisfied by this story's shipped ACs
  (add-a-non-member → AC-2/3; visible to me → AC-4; visible to anyone afterwards → AC-5; adding
  only → structural transform + Out of scope; own/TA keys only + foreign-not-offered → AC-1;
  no new page/endpoint → verified in diff; the surrendered-items bullet is discharged by the book's
  own generated section). One story used of the operator's cap of two. Per workflow the close is
  **offered, not auto-run**: the Director/operator's "yes" triggers `/close-book` (Reviewer at book
  scope writes `audit.md` + `prd-seed.md`). Epic `tapestries` stays Active until the branch merges
  (epic close-out moves the folders under `done/` then).
