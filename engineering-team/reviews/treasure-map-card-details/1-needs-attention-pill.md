# Review: Story 1 — A Needs attention pill on an unassigned category

**Reviewer:** Claude (acting as Reviewer, Gate B — Light profile)
**Date:** 2026-10-08
**Diff:** `git diff origin/staging...HEAD` on `feat/treasure-map-card-details`. Story 1's code is commit `9c2e3c54`, plus the
test-only follow-up `64998621` (N4 auto-waits). Reviewed at HEAD `64998621`. The hotfix commits `b84484c8` and
`2447d98a` ride the branch and are not under review here.
**Story:** `engineering-team/stories/treasure-map-card-details/1-needs-attention-pill.md` (no ADR: Design note)

## Quality gates (run by reviewer, not trusted)

- [x] **Scoped Node gate** (the exact command in the story header): **exit 0**, `TOTAL_FAIL=0`. Exit code captured by
  brace-redirect to a log, not piped. Results: `treasure-map-needs-attention` 6/0, `manage-treasure-map-cards` 31/0,
  `manage-treasure-map-page` 24/0 (0 skipped), `treasure-map-edit-mode` 48/0.
- [x] **Browser specs** (the story's "How to run" list plus story 2's spec, which is story 2's "How to run" command). I
  ran them against **my own build of HEAD**: `vite build --outDir <scratchpad>` and `vite preview --port 7815`. I did not
  use the existing :7799 server, because I couldn't tell which build it serves. **exit 0: 134 passed, 0 failed, 0
  skipped.** Story 1's 14 tests are N1–N5, N6a–e, N7, N8 at 375 px and at 430 px, and N9.
- [x] **Fail-before spot-check** (not trusted from J2): I built `origin/staging`'s UI and served it on :7816. Against it,
  story 1's spec gives exactly the plan's result: N6b and N6c pass (they are the sentinels), and the other 12 fail.
- [x] **Lint:** `ui/node_modules/.bin/eslint` on `Index.jsx` and `manageTreasureMap.js`. Branch: 1 error,
  `react-hooks/refs`, at `Index.jsx:614:22`. `origin/staging` (the same file passed through `--stdin`): 1 error, the
  same rule, at `:529:22`. It's the same `cards.map` callback, moved down by the story 2 lines. `manageTreasureMap.js`
  is clean on both. **No new lint findings.**
- [x] **Guard suites** (beyond the scoped gate): the four `/assistant` suites that read `actions.js`, because this story
  adds a new importer of it: `assistant-management-page` 24/0, `assistant-attention` 39/0, `assistant-alert` 15/0,
  `assistant-identification-tags-page` 16/0. Also registry completeness, `stack-free-npm-test` 7/0.
- [ ] **Full `npm test`:** not run. Under Light it's at the reviewer's discretion, and it is always run at book close.
  `npm run gate:status` in this worktree says "No gate run records in …/tmp/gate-runs", so I have no run line to quote.
- [x] _Typecheck / build not configured._ The `vite build` above is the only build, and it succeeded.

## Spec adherence — AC verdict table

| AC | Handles | Verdict | Evidence |
|---|---|---|---|
| AC-1 pill on "Not assigned yet" only; all three with no Map | N1, N2, N3, R1 | **Met** | All pass on my build. `Index.jsx:196,205–207` tie the pill to `card.state === 'none'`. |
| AC-2 Edit: a pick hides it, Undo restores it, a successful Save leaves none | N4, N5, N9 | **Met** | Pass. There is no new state: the cards are drawn from `draftAssistants` (`Index.jsx:550`), so the pill follows the draft. |
| AC-3 no pill while loading, on a read error, signed out, or while names load; a failed lookup still draws it | N6a–e | **Met** | Pass. The pill exists only inside `CategoryCard`, which renders only after `settled && namesReady` (`Index.jsx:546–549`). |
| AC-4 SR prefix before the title, outside it; pill hidden; Edit descriptions still read the name | N7, S2 | **Met** | Pass. My own accessibility snapshot reads `"Needs attention: Lists Curated lists…"`, and the Lists picker's `aria-describedby` resolves to `["Lists"]`. |
| AC-5 badge shape; amber ≥ 4.5:1; inside the card at 375/430, no sideways scroll | N8 ×2, S3 | **Met** | Pass. I computed the contrast myself: `#b45309` on `#fffbeb` = **4.84:1**. |
| AC-6 words from `ASSISTANT_COPY` | W1, S1 | **Met** | `manageTreasureMap.js:15,45–46`. There is no retyped literal. |
| AC-7 nothing else moves; the alert count doesn't learn the Map | S4, R2 | **Met** | S4 passes. The 7 regression specs pass, and so do the `/assistant` and alert suites above. |

- [x] Every AC has a passing test. No AC is silently dropped.
- [x] No behaviour beyond the story. The 3 touched files are inside the declared blast radius: `CategoryCard` only,
  `COPY` plus one import, and two CSS rules.

## Gate-A classification — ratified: Design note, no ADR

I checked each irreversibility trigger:
- **Wire format / event shape:** none. Nothing is signed, published or read differently.
- **Auth / trust default:** none. **Schema / firmware:** none. **New dependency:** none. `actions.js` is already in this
  module graph through `myAssistants.js:22`, it imports only `avatarMenuLinks.js`, and there is no cycle.
- **Cross-repo contract, routing / middleware, response headers:** none.
- **A value that exists in more than one repo:** none. The words are deliberately single-sourced through the import.

The Design note is accurate as built. Its rejected alternative is real: `.bs-setup-step-badge` is 1.95:1 on white.

## Adversarial probing beyond the plan

- **POV ("who is this true for?"): sound.**
  - The pill is a judgement about *the viewer's own* kind-10040 Map. The page reads it for the session user only
    (`Index.jsx:755–756`), it is computed at view time from the Map as read, nothing is stored, and the top-bar alert
    count isn't fed (S4).
  - One premise worth stating: "no Map found" means no Map on the relays this instance read. AC-1 then shows three pills
    for a person whose Map may live on a relay the instance didn't check. That matches the owner's AC, and Edit mode's
    existing no-Map warning already names the case. Not a finding.
- **Collateral outside the diff: none found.**
  - Adding the import to `manageTreasureMap.js` adds no module to the bundle, and Node still loads the file as it is:
    every suite in the scoped gate imports it.
  - `/assistant` and its alert suites pass.
- **Error paths:** a failed names lookup still draws the cards with the pill (N6e). So does a Save accepted nowhere (N9).
  A Save with no signer, or a declined one, ends on the same path, which `treasure-map-save.spec.js` SV7/SV8 cover
  (pass).
- **Phone widths:** beyond the plan, I checked **320 px**. The page scrolls sideways by 23 px. The cause is the top bar's
  user-menu avatar (`div.bs-usermenu`, right edge at 343 px), which is the same with every panel closed. None of the
  cards or pills overflow. This is outside the diff and existed before it (see Non-blocking 2).

## Concept-graph integrity
- [x] No concepts, handles or definitions are touched, so there's nothing to reinstall. No new code needs `/summaries`.

## Things tests can't catch
- [x] No secrets, debug logging, `.only`/`.skip`, TODOs or commented-out code in the diff. No hex-key literal in `ui/`.
- [x] No race: the pill is a pure function of the drawn card.
- [x] Security: the text comes from constants only.

## House rules check
- [x] No new lint, typecheck or build tooling. The TA pubkey is not involved; `localPubkey` comes from the session
  (`Index.jsx:767`).

## Product-guide adherence
- N/A (no PRD; acceptance frame). The copy is `/assistant`'s, verbatim, through the import.

## Findings

### Blocking
None.

### Non-blocking
1. **The pill hard-codes the amber that the design palette already names** (`ui/src/styles.css:10239–10248`).
   - `color: #b45309` repeats `.bsd-page`'s `--orange: #b45309` (`styles.css:9499`), so the pill won't follow a palette
     change.
   - The precedent it copies, `.bsd-page .bs-usermenu-role-badge` at `:9603`, is literal too, and S3 pins the literal.
   - Optional: switch to `var(--orange)` and loosen S3 to check the resolved colour, as N8 already does.
2. **The page scrolls sideways at 320 px because of the top bar** (`div.bs-usermenu`, in the shared design shell, which
   this diff doesn't touch).
   - WCAG 1.4.10 Reflow measures at 320 CSS px. The page's own ACs stop at 375 px.
   - Suggest an `OPEN.md` row. It is not this story's.

### Harness friction
1. The review template's quality-gates line asks for the run's `npm run gate:status` line. Light (`light-profile.md` §
   Gate B) leaves the full suite to the reviewer's discretion until book close. When a Light Gate B doesn't run it, there
   is no line to quote, and neither document says what to record instead. I recorded the scoped gates' exit codes and
   that no run record exists. Candidate `meta` row.

## Verdict
**PASS**

**Owner's Gate B verdict (2026-10-08):** PASS, after non-blocking 1 (each toggle described by its card's title) from review 2, and non-blocking 4 (the pill's `--orange` token) from this review, applied in `c41782f7` with their tests; the scoped gate (exit 0), all 134 browser tests and lint were re-run green afterwards. The other findings are ledger rows `2026-10-09-treasure-map-muted-text-contrast`, `2026-10-09-unseen-backup-reloads-cards` and `2026-10-09-light-gate-b-no-gate-status`; the 320 px top-bar overflow is the existing row `2026-10-08-top-bar-scrolls-sideways-at-320`.

## On PASS (same commit — applied by the spawning session)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: story 2 is reviewed alongside this one. Whether the book looks complete goes in the chat.
