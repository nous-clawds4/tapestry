# Review: Story 6 — Take a concept out of a Tapestry (remove-only, on the existing Exploration page)

**Reviewer:** Claude (acting as Reviewer; fresh context, not the Implementer)
**Date:** 2026-07-30
**Diff:** `git diff 90c6d930..ab4cf64c` (Gate-3 post-repair baseline → impl boundary; `ab4cf64c` = HEAD, working tree clean)
**Story:** `engineering-team/stories/tapestries/6-take-a-concept-back-out.md`
**ADR:** `engineering-team/decisions/tapestries/0006-remove-concept-remove-only-republish.md`
**Test plan:** `engineering-team/stories/tapestries/6-take-a-concept-back-out.test-plan.md`
**Book:** `engineering-team/audits/take-a-concept-back-out/book.md` (operational Direction run)

**Diff surface.** Production code: `ui/src/pages/tapestries/tapestryDraft.mjs` (+2 exports, docstring refresh), NEW `ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx` (129 lines), `ui/src/pages/tapestries/TapestryDetail.jsx` (gate rename + wiring). Non-code in range: the story's `## Deviations` section (Implementer's lane), one CHANGELOG row + journal correction + two gate logs (Director's book-keeping, commits `f299c942`/`39b3de9e` and the log attachments — context, not implementation). **No test file changes in range** (verified: `git diff --name-only 90c6d930..ab4cf64c -- test/ tests/` is empty) — the Gate-3 test repair landed at the baseline commit `90c6d930` itself, in the Tester's lane, exactly as the story's Deviations section describes.

## Quality gates (run by reviewer, not trusted)

- [x] **Full `npm test`** — **PASS, exit 0.** Router quiesced first per book rule (`docker exec tapestry supervisorctl stop strfry-router` → `strfry-router: stopped`) and restarted after (`strfry-router: started`). Output: `Overall: PASS`; `take-a-concept-back-out suite: PASS (22 passed, 0 failed)`; `add-a-concept-to-a-tapestry suite: PASS (23 passed, 0 failed)`; `Total skipped: 31` (all pre-existing env-gated skips). Exit code 0 evidenced by the runner's own exit branch (`test/test.js:1195–1196` — the `Overall: PASS` print and `process.exit(0)` are the same `overallOk` branch) and by the captured log ending at the `Overall:` line with no npm failure trailer.
- [x] **Story Node suite, isolated** — `node -e "require('.../test/take-a-concept-back-out.test.js').run()..."` → **0 failed / 22 passed, EXIT:0** (P1–P15, S1–S4, R1–R3 all green).
- [x] **Shipped add suite, isolated** (S3/S4 sentinels guarding the shipped add path) — **0 failed / 23 passed, EXIT:0**.
- [x] **`npx playwright test tests/brainstorm/tapestry-remove-concept.spec.js --project=chromium`** (`BRAINSTORM_SERVER_ACCESSIBLE=true`) — **14 passed (3.6s), EXIT:0** (E1–E14).
- [x] **Shipped add Playwright spec** (`tapestry-add-concept.spec.js`, regression) — **13 passed (2.7s), EXIT:0**.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped (JS-without-build by design)._

## Spec adherence

- [x] **Every acceptance criterion has a passing test** (all runs mine, above):
  - **AC-1 offered/not-offered:** E1 (owner + TA-authored → per-member controls, same URL), E9 (owner-authored editable); negatives E2 (guest), E3 (unauthenticated), E4 (admin — owner-strict, the #5 Director ruling), E5 (foreign author, even for the owner); S4 pins ONE gate `canEdit` (`TapestryDetail.jsx:191–192`, the renamed `canAdd`; `grep` confirms zero remaining `canAdd` in the file).
  - **AC-2 last concept refused up-front:** E6 (refusal sentence visible, no control exists, publish sink empty), P8 (transform backstop `/keeps at least one concept/i`; superset/property nodes don't count), P13 (the count's single source `authoredConceptMembers`). Component renders the refusal *instead of* any control at `RemoveConceptFromTapestry.jsx:85–94`; transform backstop at `tapestryDraft.mjs:296–299`.
  - **AC-3 confirm-before-publish:** E7 (arming publishes nothing; Cancel → idle, nothing published). Same coordinate: P1 (bare-hex `b0b48b00` d-tag verbatim), E8. Existing publish paths, no new endpoint: E8 (TA → `signAs:"assistant"`), E9 (own key → NIP-07 + `signAs:"client"`), S3, P15. Everything else intact: P2, P14 (order-preserved tags/nodes/imports, unknown keys, relationships, input not mutated), P6 (unattributable import passes through), P7 (shared import stays), E8. Solely-carried entries leave (ratified reading 4): P3 (live dog divergence via matcher b), P4 (deleted-header via matcher a), P5 (short-slug via matcher c). Strictly newer: P12, E8. Publish failure: E12 (inline error, membership unchanged), P10 (unpreservable structures refused).
  - **AC-4 gone for me:** E10 — removed member is the *selected* one; element re-read count grows; no stale detail pane; the mock serves back the actually-published body with the removed member's concept-graph still resolvable, so keeping the import would re-materialize the member and fail the test (Decision 2-A's functional guarantee, exercised end-to-end). Page wiring `TapestryDetail.jsx:198–203` (`handleRemoved`: selected-reset iff slugs match + `reload()`).
  - **AC-5 gone for anyone else:** E11 (fresh unauthenticated session, same uuid, member absent, others render, still no affordance) + the structural argument audited below.
- [x] **No criterion silently dropped** — coverage map in the test plan traces all five ACs; every named test ran green in my runs.
- [x] **No behavior added that isn't in the story** — production diff is exactly the three ADR-named files; no route changes, no server files, no batch-removal, no undo, no title/description editing (the transform copies all non-json tags verbatim, `tapestryDraft.mjs:352–353`).

### Manual sweeps the test plan assigned to the Reviewer

1. **Double-submit busy guard** — three layers, strictly stronger than the shipped add component's: closure re-entry check `if (busy) return` (`RemoveConceptFromTapestry.jsx:42`), `disabled={busy}` on the member controls (`:106`), and the confirm block *unmounts* while busy (`{armed && !busy && …}`, `:113`) so the in-flight save's confirm button has no DOM target for a second click. React flushes the discrete-event state update before the next click dispatches. Adequate; same accepted class as #5.
2. **Mid-confirm re-pick** — choosing a different member while armed swaps the armed target (`:107` `setArmed(m); setError(null)`) rather than "returns to idle" (ADR Decision 5's parenthetical letter). The safety property holds exactly: nothing publishes without a confirm click, and the confirm copy (`:116`) and the save target (`:120` `save(armed)`) read the same `armed` object — no desync window in which the copy names one member and the save removes another. Test plan pre-classified this as "cosmetic ADR detail"; recorded as non-blocking finding 1.
3. **Live cross-relay AC-5 (structural argument)** — holds. The replacement reuses the exact coordinate (P1/E8 pin d-tag + `39999:<author>:<dTag>` uuid, `tapestryDraft.mjs:365–366`); kind-39999 replacement is relay-native NIP-01 behavior, verified live by the epic's evidence goal and proven in production by shipped #5, which uses byte-identical publish paths; and the read every other session performs is the same exact-coordinate `readByUuid` scan (`useTapestryGraph.js`) that E10 exercises against the actually-published body. One mechanism, two consumers — no separate code path exists for "other sessions" to diverge on.

### Deviations audit (story `## Deviations`, Implementer 2026-07-30)

All six judgment calls verified against the code and judged sound:

- **Matcher (b) truthiness guard** (`tapestryDraft.mjs:328` `o.conceptGraphSlug &&`) — prevents a malformed option composing a literal `undefined-concept-graph` uuid. Errs toward *keeping* an import (pass-through = "everything else stays"), never toward wider removal. Sound.
- **Refusal prose** — the ADR-pinned last-member sentence is used verbatim in both places (transform `:298`, component `:91`), each matching the ADR's own e.g. wording for that position and the pinned `/keeps at least one concept/i`. Other refusal messages mirror `buildAddConceptDraft`'s style (compare `:262`/`:266` with the add builder's `:127`/`:130`) — within the ADR's "messages the UI shows verbatim" delegation.
- **Placement above `AddConceptToTapestry`** (`TapestryDetail.jsx:253–254`) — inside the ADR's "above/beside". Reused classes all exist: `tapestry-concept-option`/`tapestry-concept-add` (`ui/src/styles.css:8286–8302`), `btn`/`btn-primary` (`ui/src/styles.css`); zero new CSS files in range.
- **Defensive input normalization** (`:318–319`) — bad *evidence* arrays contribute no evidence; refusals stay reserved for the unpreservable event. Consistent with Decision 2-A's evidence framing.
- **`removed.node` verbatim** (`:368`) — consumers verified: P1 reads `.uuid`, `handleRemoved` reads `.slug`.
- **Docstring refresh** — comment-only, accurate.

The Deviations section's Phase-3 defect account also verifies: the two unsatisfiable sub-assertions (the `liveEvent({}, undefined)` default-parameter trap; the Playwright quote-in-regex `.first()` chain break) were repaired at the baseline commit `90c6d930` (`test: repair absent-graph fixture reachability + E7 locator`) — the `OMIT_GRAPH` sentinel (`test/take-a-concept-back-out.test.js:94`) and the quote-free `\W?` regex without `.first()` (`tests/brainstorm/tapestry-remove-concept.spec.js:363`) are the fixes, and both repaired assertions now pass in my runs (P10/P13 full, E7 green). The Implementer touched no test file.

## ADR adherence

- [x] **Files changed match the ADR's implementation notes exactly** — EDIT `tapestryDraft.mjs` (adds `authoredConceptMembers` `:213`, `buildRemoveConceptDraft` `:248`, handle parsers `pubkeyOf`/`dTagOf` `:188/:194` splitting on the first two colons per the `parseUuid` rule), NEW `RemoveConceptFromTapestry.jsx`, EDIT `TapestryDetail.jsx` (rename + render + `handleRemoved`). The ADR's "NO changes" list holds: `useTapestryGraph.js`, `useConceptOptions.js`, `useCreateTapestry.js`, `AddConceptToTapestry.jsx`, `tapestryGraphModel.js`, `Index.jsx`, and all server files are untouched (name-only diff), enforced further by R2.
- [x] **Decisions implemented as chosen:** 1-A verbatim copy + one subtraction (only the first `json` tag's value changes, `:342/:353`; order preserved — P2/P14); 2-A union-of-evidence matcher (`carriedFor` `:320–331`: containment ∪ options derivation ∪ short-slug) with the solely-on-its-behalf guard and unattributable pass-through (`:338–349`); 3-A membership from the authored block via the one shared helper, ghost refusal `:293–295`, last-member `:296–299`, shared-slug `:300–304`; Decision 4 — gate renamed to a single `canEdit` gating both affordances, publish branch duplicated byte-for-byte in shape from `AddConceptToTapestry.jsx:64–82` (side-by-side compared), no extraction, shipped sentinel S3 still green; Decision 5 — idle list / refusal / inline confirm / busy guard / inline errors / re-read + selected-reset, degraded branches unchanged (`TapestryDetail.jsx:224` still gates only first-add; E13/E14 green).
- [x] **Layering respected** — transform stays pure and React-free (dynamic-importable; proven by the stack-free suite); component owns UI state; page owns the gate and the re-read.
- [x] **No new dependencies** — component imports only existing modules (`react`, `ConfigContext`, `publishProfileTag`, `signerGuard`, `tapestryDraft.mjs`, `useConceptOptions`); `package.json` untouched.
- [x] **`created_at` rule** — `Math.max(now, base+1)` at `:359`, same as add (`:177`); P12 covers same-second, skewed, and old bases.

## Concept-graph integrity

- [x] **Handles in `kind:pubkey:slug` form** — all composed handles derive from runtime values: `39999:${event.pubkey}:${dTag}` (`:366`), `39999:${pubkeyOf(...)}:${...}-concept-graph` (`:328–330`). The transform takes no `taPubkey` parameter at all — attribution pubkeys come from the handles themselves (Decision 2-A).
- [x] **Firmware reinstall: not required** — no concept definition changes anywhere in the diff (the republished tapestry is an element, not a definition; ADR Consequences states this and the diff confirms it — no firmware/setup files touched).
- [x] **Orientation via `/summaries`** — the ADR records the three-call orientation against the live Concept Graph API (Context section); no new code re-derives concept semantics from BIBLE.md.

## Things tests can't catch

- [x] **No secrets** — no keys/tokens/credentials in the diff. The 64-hex fixture pubkeys live in test files only (explicitly allowed by CLAUDE.md); grep of the three production files finds zero 64-hex literals.
- [x] **No leftover debug logging / `console.*` / `debugger`** — grep clean across all three production files.
- [x] **No commented-out code, no TODO/FIXME** — grep clean.
- [x] **Error paths** — every transform refusal surfaces verbatim as the inline error (`RemoveConceptFromTapestry.jsx:76–77`); publish failure keeps `armed` set so the owner can retry or cancel (`setArmed(null)` only on success, `:74`); error cleared on re-arm (`:107`). E12/P10 exercise the paths.
- [x] **Concurrency / races** — post-save re-read races nothing: the TA endpoint awaits `strfry import` before responding and `publishOrThrow` requires local acceptance, so `reload()` reads the accepted event (same as shipped #5). Double-submit: three-layer guard (sweep 1 above). One benign residual recorded as non-blocking finding 2.
- [x] **Security / injection** — member names, refusal copy, and error messages render as React text nodes (auto-escaped); the interpolated `aria-label` (`:105`) is attribute-escaped; no `dangerouslySetInnerHTML`; the JSON payload is re-serialized via `JSON.stringify`, never string-spliced. Write-side authority unchanged: the server's owner-403 gate on `signAs:'assistant'` remains the second line of defense (R3 in the shipped suite still green); the render gate is an affordance, not write-time gating — architecture invariant 2 respected.
- [x] **TA pubkey discipline** — client compares `event.pubkey === taPubkey` from `useConfig()` (`RemoveConceptFromTapestry.jsx:32,54`; `TapestryDetail.jsx:181,192`); nothing hardcoded. ADR-0015 `LEGACY_*` constants untouched (no diff in `src/api/profile-tags/` or `ui/src/utils/publishTagPin.js`).
- [x] **Scope creep** — none: production diff = exactly the three files the ADR names; engineering-team changes in range are the story's own Deviations section and the Director's book-keeping (CHANGELOG L2-waiver row, journal correction, gate logs), each in its author's lane.

## House rules check

- [x] Concept Graph API authority respected (orientation recorded in the ADR; no source-derived concept semantics added).
- [x] No new lint/typecheck/build tooling; no new dependencies; JS-without-build preserved.
- [x] No new page, no new route, no new server endpoint (the boundary): the only fetch is the existing `POST /api/strfry/publish` (`RemoveConceptFromTapestry.jsx:57`); no router/App changes in the diff.

## Product-guide adherence

_N/A — Direction-mode book with an acceptance frame; no PRD, no style/design guide traces._ The ADR-pinned refusal/confirm copy is used verbatim (verified above).

## Findings

### Blocking

_None._

### Non-blocking

1. **`ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx:107`** — picking a different member while armed re-arms for the new member instead of the ADR parenthetical's "returns to idle." Every safety property holds (nothing published; confirm copy and save target are the same `armed` object); the test plan itself classed this as cosmetic. Optional: note it in the story Deviations at some later touch; no code change asked.
2. **`ui/src/pages/tapestries/TapestryDetail.jsx:198–203`** — `handleRemoved` captures `selected` by closure; if the owner changes the selection *during* the sub-second in-flight publish to exactly the member being removed, the reset is skipped and the pane degrades to the designed "⚠️ Not in the graph" placeholder (`TapestryDetail.jsx:152–159` via the null-handle path at `:103`), recoverable with one click. Same closure semantics as the shipped add path; no action required.
3. **`ui/src/pages/tapestries/RemoveConceptFromTapestry.jsx:96`** — `nameOf(m) = m.name || m.slug` yields `undefined` for a pathological authored node carrying neither field; unreachable via any shipped builder (create/add always write `slug`+`name`, `tapestryDraft.mjs:154`). No action.

### Harness friction

_None. Orientation docs, ports, and commands were accurate this phase._

## Verdict

**PASS**

The diff is remove-only by construction, lands on the same coordinate, reuses the shipped gate and publish paths without touching a line of the add path, refuses everything it cannot remove cleanly, and every acceptance criterion is covered by tests I ran myself — full suite, both story suites isolated, and both shipped-add regressions — all green with explicit exit 0.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/tapestries/6-take-a-concept-back-out.md`); Linked-artifacts Review line filled.
- [x] Completion detection run: the book `take-a-concept-back-out` now looks **complete** — every acceptance-frame bullet is satisfied by story #6 (take-out shipped; gone-for-me AC-4; gone-for-others AC-5; everything-else-intact AC-3/P2/P14; removing-only with the add path untouched R1/R2; last-concept refused AC-2; owner/TA-only AC-1; no new page/endpoint verified), with 1 of the 2-story cap consumed. **Offering — not auto-running — `/close-book`**; the Director/operator's "yes" is the trigger. (Reminder from the book: the L2 lint waiver for `epics/tapestries.md` is owed removal at close.)
