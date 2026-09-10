# Review: Story 1 — Trusted Lists panel: new prompt copy, collapsed-by-default status line

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-10
**Diff:** `git diff origin/staging...HEAD` (base `f850b07d`, HEAD `3e1526fd`; branch `feat/dlist-curation`)
**Story:** `engineering-team/stories/dlist-curation/1-tl-panel-copy-and-collapse.md`
**ADR:** `engineering-team/decisions/dlist-curation/0001-tl-panel-disclosure-and-copy.md`
**Test plan:** `engineering-team/stories/dlist-curation/1-tl-panel-copy-and-collapse.test-plan.md`

Branch commits audited (oldest first): `5ad72bb9` book open · `7b7dc1cb` story · `bacefa2e` ADR · `39f3d731` failing tests · `8d8e2027` Tester-lane S5 amendment · `3e1526fd` implementation. Nine files: two source (`ui/src/utils/treasureMap.js`, `ui/src/pages/grapevine/TlOptInCard.jsx`), two test (`test/dlist-curation-tl-panel.test.js` new, `test/test.js` registration), five harness artifacts (book, epic, story, ADR, test plan). `TrustedAssertions.jsx` is not in the diff, as the ADR requires.

## Quality gates (run by reviewer, not trusted)

- [x] **Story-scoped gate** (the test plan's "How to run" command: the new suite + `tl-treasure-map-optin-publish`, `tl-treasure-map-panel`, `treasure-map-panel-summary`, `treasure-map-relay-presence`, `treasure-map-relay-sync`) — **exit 0, `TOTAL_FAIL=0`**, 135 assertion lines ✓ / 0 ✗. Per-suite: dlist-curation-tl-panel 19/0 · tl-treasure-map-optin-publish 23/0 · tl-treasure-map-panel 18/0 · treasure-map-panel-summary 18/0 · treasure-map-relay-presence 35/0 · treasure-map-relay-sync 22/0.
- [x] **Full `npm test`** — run detached with the exit code captured by brace-redirect into a log (`{ npm test; echo "NPM_TEST_EXIT=$?"; } > log 2>&1`; no `tail` pipe, OPEN.md row 157); ~41 minutes wall-clock on this machine. Result: `Overall: FAIL`, `NPM_TEST_EXIT=1`, `Total skipped: 55`; 159 suite lines PASS, 3 FAIL:
  - `tl-membership-method-selector` (11 passed, 1 failed) — `L0 GUARD publish policy is local-only … got {"success":true,"allowExternalPublish":true}`
  - `tl-weighted-sum-method` (6 passed, 1 failed, 2 skipped) — same L0 GUARD
  - `tl-certainty-method` (4 passed, 3 failed) — L0 GUARD, plus `LP` (the prune script refuses under the same policy: "publish policy is NOT local-only — refusing to prune") and `LB` (the known-value matrix runs over fixtures the guard never seeded)
  **Interpretation:** all three are OPEN.md row 191 — the guard reads the running container's `/api/publish-policy`, which I confirmed answers `{"success":true,"allowExternalPublish":true}` right now; the machine's posture is deliberately external-on and is not to be changed. None of the three suites touches, imports, or renders anything in this diff, and the diff's only test-runner change is the additive registration of the new suite. **Not attributable to this story.** The new suite reports `dlist-curation-tl-panel suite: PASS (19 passed, 0 failed)` inside the same run.
- [x] **Live browser check (B-class, which the suite says it cannot cover)** — headless Chromium via the repo's Playwright against the local stack at `:7778`, with `/api/auth/status`, `/api/auth/user-classification` (per-user `assistantPubkey`) and the kind-10040 `/api/strfry/scan` lookup mocked by `page.route` (synthetic `'1'…`/`'2'…`/`'3'…` pubkeys; no NIP-07 needed). **78 checks, 0 failures**, across absent / external / local / null-assistant / no-Map: collapsed on load with `aria-expanded="false"`, one `<h4>` reading `▸ Trusted Lists for Pubkeys (30392)`, the exact label per state, nothing of the body in the DOM while folded; click expands (`▾`) to the pre-fold body and click collapses; the control is focusable, real `Enter` expands, real `Space` collapses without scrolling; open state does not survive `page.reload()`; the null-assistant viewer gets no panel while the raw toggle still renders; the no-Map path still says "No Trusted Assertions event found"; relay presence, raw toggle and the hand-edit panel present in every scenario; zero page errors. ARIA snapshot of the control: `button "Trusted Lists for Pubkeys (30392) — ○ Not set"` (and the two other labels), containing the level-4 heading. Screenshots of each state were inspected: the collapsed panel is visually one line — title left, coloured label right.
- [ ] `npm run test:playwright` — not run as a suite (no Playwright half for this story per the test plan); note that the installed driver (1.56.1) wants Chromium build 1194, which is absent from `~/Library/Caches/ms-playwright` (1187/1223/1228 present) — see Harness friction 2. The live check above used `executablePath` → chromium-1228.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations) before this review; re-run after the story flip (see On PASS).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test.
  - **AC-1 copy** → S7 (`test/dlist-curation-tl-panel.test.js:184-187`) pins the four sentences verbatim as one string; source at `TlOptInCard.jsx:139-141`. The old two-sentence prompt is a contiguous suffix, so `tl-treasure-map-optin-publish` S1 still passes unchanged (confirmed in both gates).
  - **AC-2 collapsed by default** → S2 (`:140-147`, control + `{open && …}` gate), S3 (`:149-155`, `useState(false)`), S5 (`:164-175`, exactly one `<h4>` and it carries the title + both glyphs). Source: `TlOptInCard.jsx:36`, `:106`, `:112`. Live: collapsed on load in all three states, including local.
  - **AC-3 three-state indicator** → U3/U4/U5 (`:78-100`, exact labels and tones), U6 (`:102-109`, never throws), U7 (`:111-124`, composed with `findGenericTlDelegation` incl. named-only inert and first-occurrence-wins), S1 (`:134-138`, card calls the helper), S6 (`:177-182`, no label text in the card). Source: `treasureMap.js:60-66`, `TlOptInCard.jsx:56-57`, `:107-109`. Baseline is `useAuth().user.assistantPubkey` (`:33-34`); no state until it resolves (`:54`); `taPubkey` absent (R3 `:214`). Live: `○ Not set` / `⚠️ Another publisher · 33333333…3333` / `✅ Your Tapestry Assistant`.
  - **AC-4 expand / collapse** → S2, S4 (`:157-162`, `onKeyDown`, Enter + Space, `preventDefault`), S5 (aria-label), R2 (`:200-208`, every body affordance survives). Source: `TlOptInCard.jsx:89-110`. Live: mouse and real keyboard both toggle; no persistence across reload.
  - **AC-5 null assistant** → U2 (`:69-76`, helper returns null with no baseline), R3 (`:210-218`, guard `!assistantPubkey → return null` at `TlOptInCard.jsx:54`). Live: no panel.
  - **AC-6 rest of the page** → R1 (`:191-198`, single mount, `onPublished={search}`, page order), R4 (`:220-227`, neighbouring panels), R5 (`:229-239`, util exports + upsert semantics). `TrustedAssertions.jsx` is not in the diff. Live: neighbours present; no-Map path intact.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story. The only additions beyond the ACs are the ADR-prescribed `TONE_COLOR` map (`TlOptInCard.jsx:10-12`; `none` = muted `#8b949e`) and JSDoc. No persistence of open state, no change to what the opt-in composes/signs/publishes (`handlePublish` `:59-74` byte-identical to before).

> **Phase-4 test edit judged (commit `8d8e2027`, story `## Deviations`).** Not a test-deliverable story, so the standing rule applies: test edits belong to the Tester's lane. Verified on the merits, not on trust:
> - *Was S5 wrong relative to the ADR?* Yes. ADR 0001 §2 step 1 puts the title into the control's `aria-label`, which precedes the `<h4>` in the file. Replaying the original anchor (`card.indexOf(TITLE)` + glyphs within the preceding 120 chars) against the final card: first occurrence is the `aria-label` at `TlOptInCard.jsx:93`, no glyph precedes it — the original S5 **would fail an ADR-verbatim implementation**.
> - *Stricter or weaker?* Stricter: it keeps `h4s === 1` and the `aria-label=` check, and binds the title *and both glyphs* to the content of the single `<h4>` element instead of "title text anywhere, glyphs somewhere in the 120 chars before it".
> - *Still a failing judge before implementation?* Yes. I rebuilt the tree at `8d8e2027` (`git archive` into the scratchpad) and ran the amended suite: 6 passed / 13 failed, identical to the test plan's record, with S5 failing on "exactly one `<h4>` … found 2".
> - *Handling acceptable under `templates/adr.md`'s note?* Yes: a separate `test:` commit labelled as a Tester kick-back, landed *before* the `impl:` commit, confined to this story's own new suite (no other story's guard suite touched), recorded in the story's Deviations with the rationale also in the test comment (`:168-170`). The rule's purpose — the Implementer must not weaken their own judge — is preserved; the judge got stronger.

> **Second deviation ("Live keyboard check").** The Implementer reported that the automated browser's key action reached neither this control nor the shipped relay-presence one, and verified via dispatched `keydown` events. My Playwright run drives real `Enter`/`Space` key presses at the focused control and both toggle it — so the earlier limitation was the MCP browser tool, not the control. AC-4's keyboard path is verified for real here.

## ADR adherence
- [x] Files changed match the ADR's implementation notes: §1 additive export `describeTlDelegation` beside `findGenericTlDelegation` (`treasureMap.js:52-66`, body identical to the ADR's snippet, JSDoc in the file's style); §2 the card (import `:4`, `open` state `:36` beside `showPreview`, guard kept `:54`, `desc`/`status` replace the inline ternary `:56-57`, one shell `:80-84` whose border/background/padding follow the status as before, header control `:89-110` with the exact semantics of `TreasureMapRelayPresence.jsx:238-262` — `role="button"`, `tabIndex={0}`, `aria-expanded`, aria-label `Trusted Lists for Pubkeys (30392) — <label>`, Enter/Space/`'Spacebar'` with `preventDefault`, `cursor: pointer`, `marginBottom: open ? '0.5rem' : 0` — the only `<h4>` `:106`, label span `:107-109`, body under `{open && (…)}` `:112-193` carrying the previous per-state content verbatim); §3 `TrustedAssertions.jsx` untouched; §4 the suite is the three-class pattern the ADR sketched. **No deviation from the implementation notes found.**
- [x] Layering / module boundaries respected: the verdict + labels are a pure helper in the epic's util (ESM-importable, exercised by the U class); the card composes and colours; the page is untouched.
- [x] No new dependencies the ADR didn't authorize (no `package.json` change; imports are the existing util/context modules).

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form — the only handle in play is the story/ADR's orientation reference `39998:<TA>:tapestry-assistant`; no code composes or parses a concept handle. Confirmed via the authority: `GET /api/concept-graph/summaries` on the local stack lists `39998:11f23fe4…:tapestry-assistant` ("tapestry assistant"); that pubkey is this deployment's, differs from the other dev machine's, and appears nowhere in the diff (R3 hex-literal sweep on both source files; my own sweep too).
- [x] Firmware reinstall: **not required** — this story touches no concept definition, schema, or property (ADR "Firmware reinstall required? No"). Confirmed by the diff: no `firmware/`, no `src/`, no concept JSON.
- [x] New code orients via `/api/concept-graph/summaries` rather than re-reading BIBLE.md — the new code reads no concepts at all; the ADR records the orientation calls it made.

## Things tests can't catch
- [x] No secrets in committed files (added lines swept for `nsec`/`secret`/hex-64; test fixtures are `'a'.repeat(64)` and a repeated hex pattern).
- [x] No leftover debug logging or `console.log` in source (the only `console.log`s in the diff are the runner's own reporting lines in the suite and `test.js`).
- [x] No commented-out code.
- [x] Error paths and edge cases handled where it matters: the helper never throws (U6); the publish error still renders inside the open body (`:182-191`; `onPublished` is not called on failure, so the card stays mounted and open); hooks all precede the early return (`:36-49` before `:54`), so the hook order is stable across the guard.
- [x] Concurrency / race conditions considered: none new — `open` is local component state; the late-resolving assistant mounts the card folded (E2; live null-assistant scenario).
- [x] Security: no new input boundary; the label's short form slices a pubkey the existing `findGenericTlDelegation` already validated as a string; React escapes the text.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling without an ADR (the only tooling touch is the additive suite registration in `test/test.js:275-276`, `:682-683`, `:1192`, `:1432-1433`, `:1476`).
- [x] Per-user assistant baseline (OPEN.md row 188): `useAuth().user.assistantPubkey` only; `taPubkey` absent; no 64-hex literal.

## Product-guide adherence *(when the story traces to a PRD)*
- N/A — acceptance-frame book, no PRD. The copy matches the operator's verbatim text approved at the story gate (S7; seen on screen).

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/pages/grapevine/TlOptInCard.jsx:54-57`** — `describeTlDelegation` returns `null` for a non-string baseline, while the guard at `:54` is truthiness-based; a truthy non-string `assistantPubkey` (not something `/api/auth/user-classification` produces today) would reach `desc.status` and throw. The ADR prescribed this exact shape, so it is not a deviation. Optional hardening when next touched: `if (!desc) return null;`.
2. **`test/dlist-curation-tl-panel.test.js:160`** — the Space half of S4 (`/['"] ['"]/`) is already satisfied by the pre-existing JSX whitespace literal `{' '}` at `TlOptInCard.jsx:131`, so it does not discriminate; the `onKeyDown`, `'Enter'` and `preventDefault(` halves do, and the live check proves the behaviour. Tester's lane, next time the suite is opened: `e\.key\s*===\s*' '`.
3. **`test/test.js:1473-1474`** (pre-existing, not introduced here) — the skip aggregate lists `retireOfferingVocabularyResult, siteTrustSignalsResult, tlTreasureMapPanelResult, tlTreasureMapOptinResult` twice, so `Total skipped:` (55 in this run) double-counts those four suites. Informational only (`overallOk` never consults `.skipped`). Candidate OPEN.md row, type `bug`, low.
4. **Post-publish behaviour, for the operator's awareness** — `onPublished={search}` (`TrustedAssertions.jsx:44-48`) nulls the event and sets `loading`, which unmounts the card; it remounts *folded* reading `✅ Your Tapestry Assistant`. That is AC-2 applied to a re-load of a found Map and the status line is the confirmation; before this story the green body stayed on screen. Consistent with the story; no change asked.
5. **Accessibility, same as the settled idiom** — the `<h4>` inside a `role="button"` element is presentational to assistive tech (ARIA children-presentational), and the accessible name is the `aria-label`, which contains the visible text (label-in-name holds). Identical to `TreasureMapRelayPresence.jsx:238-262`; if the shared-disclosure chore (ADR 0001 Option B / ADR relay-presence 0003 Option C) ever lands, that is the place to consider a native `<button>` header.
6. **`engineering-team/epics/dlist-curation.md:52`** — `## Decisions` still reads "(none yet)" although ADR 0001 landed in `bacefa2e`. Update at the next harness commit.

### Harness friction *(each a candidate OPEN.md `meta` row; not edited by me)*
1. **"Run the full `npm test` in the foreground" is unsatisfiable from the agent Bash tool** (600 s ceiling) when a full run takes ~41 minutes here (the publish-flow suites waited on relays for ~20 of them; row 191's "~30-minute" figure was optimistic today). Ran detached with the brace-redirected log and polled the log for the exit line — row 157's intent (real exit code, full log, no `tail` pipe) is honoured either way. The reviewer command text should say that, not "foreground".
2. **`npm run test:playwright` cannot launch on this machine as installed**: the repo's Playwright 1.56.1 expects Chromium build 1194; the cache holds 1187/1223/1228. The Reviewer role lists Playwright as a gate. Worked around with `executablePath` → chromium-1228 for the live check; either re-run `npx playwright install chromium` or pin.
3. **Story status vocabulary vs. workflow** — `templates/user-story.md:3` offers `In Progress`, but no workflow step flips it, so this story read `Approved` through Phases 2–4 (the review brief assumed `In Progress`). Add the flip to `workflows/4-implementation.md` or drop the state.
4. **No architecture-phase step appends the ADR to the epic's `## Decisions` list** (`workflows/2-architecture.md`) — finding 6 above is the symptom.
5. **Row 191 restated** — a 41-minute full gate to relearn that three suites are red-by-default here; the skip-with-reason shape that row proposes would make the full gate readable on this posture. Already on the ledger; not a new row.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place; the story's "Linked artifacts" review placeholder replaced with this file's path. No files moved (retirement is per-epic).
- [x] Completion detection performed; the result and the book arithmetic are recorded in the chat, not here. The book (`engineering-team/audits/dlist-curation/book.md`) is not complete — this story satisfies the frame's first two bullets only; stories 2–7 remain — so `/close-book` is not offered.
