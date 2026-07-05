# Review: Epic note-surfaces — by-author read path + Content section + /notes page (stories #1–#3)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-18
**Diff:** `git diff staging..feat/note-surfaces` (impl commit `98686ddf`) — 8 files, **+472 / −0** (fully additive)
**Stories:** `note-surfaces/{1-by-author-notes-read-path, 2-profile-content-section, 3-per-user-notes-page}.md`
**ADRs:** `note-surfaces/{0001-by-author-notes-read-path, 0002-note-surfaces-ui}.md`
**Method:** Reviewer audit + a 3-lens adversarial sub-review (correctness / ADR-conformance / invariants-security), 10 agents, **each finding independently verified** (7 raw → 5 confirmed real, 2 refuted).

## Quality gates (run by the reviewer, not trusted)

- [x] **`npm test` (new suites)** — `note-surfaces-read-path` **28/28 PASS**, `note-surfaces-ui` **19/19 PASS**.
- [x] **`npm test` (full, regression delta)** — FAIL suites = **exactly the same 12** pre-existing tag/pin *publish-flow* suites as the pre-change baseline (byte-identical list); **zero new regressions**. Those 12 fail on `fetch failed` — they need the live local stack and read none of the edited files (environmental, out of scope).
- [x] **Targeted regression** — all 13 hermetic suites that read the edited files (`profile-*` ×9, both `live-feed`, `reputation-info-popup`) → **0 failures**.
- [x] **Build** — isolated `vite build` of the worktree → **✓ built, exit 0**; all new JSX compiles (no syntax/import errors).
- [ ] **Playwright / rendered-UI** — not run locally (the local Docker stack is in use by a parallel session; per ADR 0002 §Testability the rendered proof — anonymous `/user/<pubkey>/notes` 200 + a visible card, the profile Content section, no 1280px scrollbar — is the **staging** capstone).
- [n/a] Lint / typecheck — not configured (intentional, JS-without-build).

## Spec adherence
- [x] Every acceptance criterion maps to ≥1 passing test (read path: OK/EMPTY/INVALID, newest-first, limit=1/limit=N/over-max cap, kind-6/7 + foreign-author exclusion, item shape, set-vs-fallback, mentions; UI: "Content" label + single card + empty + link, route + 50-list + whose-notes + empty + no-overflow mechanism + pure helpers).
- [x] No criterion silently dropped. No behavior added beyond the stories (the section is kind-1 only; "Content" label future-proofed; no PoV picker; no writes).

## ADR adherence
- [x] Files changed match ADR 0001/0002 implementation notes (read-path module + endpoint; shared hook; Content component + last-section insertion; page + route; minimal CSS).
- [x] **Relays sourcing** with set/fallback discriminator — mirrors the feed (correct per the empirical 0-local-kind-1 finding).
- [x] **`enrichNotes` reused unchanged** (`require('../_shared/noteEnrichment')`), not re-implemented; item shape identical to the feed → `NoteCard` renders it unmodified.
- [x] **`INVALID`→400, OK/EMPTY→200**, validation before any I/O; `NOTES_CAP=50` default+cap; `clampLimit` handles string/absent/non-numeric/≤0/over-max.
- [x] **Additive:** `src/api/feed/feedReadPath.js` and `ui/src/components/NoteCard.jsx` are **byte-unchanged** (regression sentinels `R1`/`R2` green); `NoteCard` reused with **no variant prop** (Option C deferred, as decided).
- [~] **Deviation (nit #4):** ADR 0002 §Impl line 89 wrote `<section className="bsp-section bsp-content-section">`; the impl uses `<div className="bsp-section bsp-content-section">` (`ProfileContentSection.jsx:27`). The `<div>` form is **more consistent with the existing profile sections** (`BrainstormProfile.jsx` uses `<div className="bsp-section">` throughout) — the ADR note was slightly off vs the codebase convention. Cosmetic; no test or behavior depends on it.

## Architecture invariants (CLAUDE.md)
- [x] **POV-first:** correct — these surfaces show the **viewed user's own** kind-1 posts (selection by author). There is no per-POV "truth" being computed; the only POV-namespaced data (reputation grid) is untouched. No global denormalization introduced.
- [x] **No hardcoded TA pubkey:** the relay-set handle resolves the TA at runtime via `getOwnerAssistantPubkey()` (`userNotesReadPath.js:120`) — honored. No `82b75e47…`/literal anywhere.
- [x] **Decentralized / filter-at-read:** read-only scan of relay events + local enrichment; no write-time gating, no "approved author" list.
- [x] **No firmware change** (defines no concepts); concept handles in the docs are `kind:pubkey:slug`.

## Things tests can't catch
- [x] No secrets; no `console.log`/debug; no commented-out or dead code.
- [x] Input validation at the boundary — `HEX64` checked **before** any relay/Neo4j query (`buildUserNotes` step 1); the `strfry scan` shell construction is the copied-verbatim feed helper and is only reached with a validated author + local pubkeys (same exposure as the shipped feed).
- [~] **Error/edge handling:** one real edge bug (finding #1 below) + two state-reset nits (#3) + an untested 500 path (#5). See Findings.

## Findings

### Required before merge (1)
1. **`ui/src/pages/BrainstormUserNotes.jsx:40–55` — stale subject name across param-only navigation (real, narrow).** The route element has no `key`, so `/user/A/notes` → `/user/B/notes` re-runs the effect without remounting. The subject-name effect sets state only inside `if (p) setSubjectName(...)` and never resets it, so navigating from a user **with** a local kind-0 (`subjectName='Alice'`) to one **without** leaves `subjectName` stale-truthy → `displayName = subjectName || shortNpub` keeps showing **'Alice' on B's page**, defeating Story #3's "whose notes" AC. Reachability is narrow (every in-app link out of the page unmounts it; only back/forward or manual URL hits notes→notes) and it faithfully mirrors the **identical latent pattern in `BrainstormProfile.jsx:130–142`** — hence the adversarial grade of *non-blocking*. **But the fix is one line and the new code should be correct against its own AC.** Asked change: reset on pubkey change — set `subjectName` unconditionally from the response (`setSubjectName(p ? (p.display_name||p.name||null) : null)`), or `setSubjectName(null)` at the top of the effect.

### Non-blocking (fix recommended alongside #1, same root cause)
2. **`ui/src/hooks/useUserNotes.js:24–49` — stale `data` not cleared on `[pubkey, limit]` change** → a brief flash of the *previous* user's note(s) during the in-flight re-fetch (the helpers gate the loading line on `loading && !data`, so truthy stale data skips it). Self-corrects on resolve; mirrors the `useFeed.js` precedent (which has no params, so the case never arises there). Optional: `setData(null)` at the top of the effect — clears the flash and is the same hygiene as #1.

### Nits (optional)
3. **`ui/src/pages/BrainstormUserNotes.jsx:97–99`** — the explicit `status === 'EMPTY'` branch is redundant (the defensive guard above already renders the identical empty block). Correct and **ADR-prescribed** (0002:98 keeps it explicit to mirror the OK/EMPTY/defensive contract); no behavior change. Leave or collapse.
4. **`ui/src/components/ProfileContentSection.jsx:27`** — `<div>` vs the ADR note's `<section>` (see ADR adherence above). Recommend leaving `<div>` (matches the profile-section convention) or aligning the ADR note.
5. **`src/api/notes/userNotesReadPath.js:197–203`** — the handler's `catch → 500` branch has no test (mirrors the feed, whose 500 path is likewise untested). Optional: add a `handleGetUserNotes` test that injects a throwing dep and asserts 500.

### Refuted (raised by the sub-review, verified NOT defects)
- **1280px no-overflow tested only at the CSS-mechanism level (not a rendered scrollbar assertion)** — *not a defect:* this is exactly ADR 0002 §Testability's plan (rendered proof = staging capstone); the node harness can't render.
- **500 path returns raw `err.message` to the client** — *not a defect this change introduces:* byte-identical to the shipped `feedReadPath.js:227`; a pre-existing cross-cutting consideration, not a regression here.

## Verdict (initial)
**CHANGES_REQUESTED** — a single small required fix (finding #1: a real wrong-data bug against Story #3's "whose notes" AC). Recommend folding in #2 (same root cause). Everything else optional; all other gates pass.

## Re-review (post-fix) — 2026-06-18, commit `80443ba5`
Operator chose "fix now." The Implementer applied the minimal, same-root-cause fix:
- **Finding #1 (required) — resolved.** `BrainstormUserNotes.jsx` now `setSubjectName(null)` on `pubkey` change and sets it **unconditionally** from the response (`p ? (display_name||name||null) : null`) — so a param-only A→B navigation clears the prior name and the npub fallback engages for users with no local kind-0. "Whose notes" now holds in every case.
- **Finding #2 (recommended) — resolved.** `useUserNotes.js` now `setData(null)` on `[pubkey, limit]` change — the loading line shows during re-fetch instead of the previous user's notes.

Re-verification: `note-surfaces-ui` **19/19** and `note-surfaces-read-path` **28/28** still green; both edited files compile (`node --check` + esbuild JSX transform). The fix touches only these two files, which only the `note-surfaces-ui` suite reads — so the full-suite delta is unchanged (12 pre-existing environmental + my 2 green). Remaining nits (#3 redundant-but-ADR-prescribed EMPTY branch, #4 `<div>` vs ADR's `<section>`, #5 untested 500 path mirroring the feed) accepted as-is — optional, non-blocking.

## Verdict
**PASS** — all acceptance criteria covered by passing tests; ADR-conformant; architecture invariants (POV-first, no TA hardcode) honored; strictly additive (`feedReadPath.js`/`NoteCard.jsx` unchanged); the one real finding fixed and re-verified. Ready for the deploy chain (`cycle-staging`).
