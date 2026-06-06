# Review: Story 2 — Conversation stays open when the trust source is unreachable

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** `git diff` (uncommitted working tree)
**Story:** `engineering-team/stories/communities-go-live/2-posting-fallback.md`
**ADR:** `engineering-team/decisions/communities-go-live/0032-degraded-posting-fallback.md` (Option B)

## Quality gates (run by reviewer, not trusted)

- [x] `node test/test.js` — **PASS** (Overall: PASS). `posting-gate suite: PASS (11 passed, 0 failed)`. All 39 suites green.
- [x] `npx eslint src/pages/CommunityDetail.jsx` — **clean** (exit 0, no output).
- [ ] _Playwright — not applicable to this change._
- [ ] _Typecheck / build — not configured (JS-without-build); skipped._

## Spec adherence
- [x] **AC1 (refined)** usable composer when unreachable, narrowed to founder/joined — `CommunityDetail.jsx:346-348`; tests T7/T8.
- [x] **AC2** calm degraded note above the composer — `CommunityDetail.jsx:359` (copy), `537-539` (render); pinned by T6.
- [x] **AC3** founder in a brand-new degraded circle can post — T7 (`members:[]`, `joined` absent, `degraded:true`, `founder=viewer`).
- [x] **AC4** healthy-but-empty stays gated — T10; verified structurally below.
- [x] **AC5** self-healing on recovery — T11 flips `degraded` true→false.
- [x] **AC6** no error tone — T6 asserts absence of "something went wrong" in the note constant; copy matches the style guide verbatim.
- [x] No criterion silently dropped; AC1's narrowing to founder/joined is the ADR's deliberate refinement (Decision §, flagged for PO confirmation — already accepted into this story's Option B linkage).
- [x] No behavior added beyond the story. Bespoke branch unchanged (`:348`), `composePrompt` unchanged (`:351-355`), `getRoster`/`roster.js` untouched.

## ADR adherence
- [x] **Files match** the ADR implementation notes exactly: only `CommunityDetail.jsx`, `CommunityDetail.module.css`, and `test/posting-gate.test.js`.
- [x] **Gate expression** at `CommunityDetail.jsx:344-348` is byte-for-byte the ADR Option B expression. `isFounder = isDeclaration && !!viewer && viewer === c.founder` keys on the **real founder** (`c.founder`), the same source as the a-tag author at `:182`. `rosterDegraded = isDeclaration && rosterState.degraded`.
- [x] Note rendered above the composer inside `tab === 'conversation'`, before the `canCompose ?` form, gated `rosterDegraded && canCompose` (`:537`). Matches ADR note placement.
- [x] **Token-based styling**, not the error color: `.degradedNote` uses `var(--bg-elevated)`, `border-left: 3px solid var(--accent)`, `var(--text-secondary)` (`CommunityDetail.module.css:247-255`). No hardcoded colors.
- [x] No new dependencies, no new tooling. No concept changes; firmware reinstall not required (ADR confirms).

## Concept-graph integrity
- [x] No concepts touched (client gate logic only). Handles unaffected. No firmware change.

## The crux (AC4) — verified structurally, not just by test
When `rosterState.degraded === false`, `rosterDegraded` is `false`, so the fallback term `(rosterDegraded && (joined || isFounder))` short-circuits to `false`; `canCompose` collapses to `signedIn && viewerIsMember` — the unchanged healthy gate. A healthy-but-empty roster (`members:[]`) therefore yields `viewerIsMember === false` → **gated**. T10 confirms this even for a non-rostered founder with `joined:true`. No path opens posting on a healthy empty roster. ✓

## Edge cases examined
- **Loading / idle window.** `rosterState` initializes `degraded:false` (`:53`) and the loading transition preserves it (`setRosterState(prev => ({ ...prev, status: 'loading' }))`, `:136`). `degraded` only becomes true after the `.catch()` at `:144`. So during `idle`/`loading` the fallback does not fire and the note is hidden — no premature open posting before reachability is known. ✓
- **Note can never show to a gated viewer.** The render guard requires `canCompose` (`:537`), so the note is structurally impossible to display when the viewer cannot post. ✓
- **AC1 stranger during outage.** T9 confirms a signed-in non-member/non-founder/non-joined viewer stays gated when `degraded:true`. The trust posture is preserved. ✓
- **Self-healing requires no code change** — confirmed by reading the expression; recovery flips `degraded` and the rule reverts. ✓

## Test integrity (T6 source guard)
- [x] The mirror `canCompose` (`test/posting-gate.test.js`) gained `degraded`/`founder` inputs and the Option B expression, matching source.
- [x] T6 pins the new gate to source whole-file: `viewer === c\.founder`, `rosterState\.degraded`, and a whitespace-tolerant regex for the full `viewerIsMember || (rosterDegraded && (joined || isFounder))` expression. These remain whole-file scans, so drift is caught.
- [x] **The corrected "something went wrong" guard is sound, not a weakening.** The Implementer scoped the error-tone check to the `DEGRADED_NOTE = "..."` literal via `src.match(/DEGRADED_NOTE = "([^"]*)"/)`. This is correct: the explanatory source comment at `CommunityDetail.jsx:357-358` literally contains the phrase "something went wrong", so a whole-file `!/something went wrong/` scan would false-fail against a perfectly clean note. Scoping to the note constant tests exactly what AC6 requires (the user-facing copy), while the gate-structure pins stay whole-file. The note copy presence checks ("can't reach the trust network", "You can still post") are likewise correctly scoped to the constant. No coverage was lost.

## Things tests can't catch
- [x] No secrets, no debug logging, no `console.log` added.
- [x] No commented-out code. Comments added are explanatory and accurate.
- [x] No security/injection surface (pure boolean gate over existing client state).
- [x] No race conditions introduced (derived render value; `getRoster` effect unchanged).

## House rules check
- [x] Concept Graph API authority respected (no concept reads/writes).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **`CommunityDetail.jsx:359`** — The `DEGRADED_NOTE` constant name doubles as the contract the source guard pins on. That coupling is intentional and documented in T6, so this is fine; just noting that renaming the constant would require updating the guard. No action needed.

## Verdict
**PASS** — The implementation is a faithful, minimal realization of ADR-0032 Option B. The gate expression matches the ADR byte-for-byte and keys `isFounder` on the real founder; the crux (AC4) holds by construction and by T10; the degraded fallback is correctly narrowed to founder/joined (T9 confirms strangers stay gated); the note is calm, token-styled, and can never render to a gated viewer; self-healing needs no code change. All quality gates are clean (full suite PASS, posting-gate 11/11, eslint exit 0). The T6 source-guard scoping correction is a genuine fix to an over-broad guard, not a weakening — the gate-structure pins remain whole-file. No blocking issues.

PASS
