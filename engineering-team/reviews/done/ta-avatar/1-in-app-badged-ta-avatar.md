# Review: Story 1 — In-app badged TA avatar

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-06
**Diff:** `git diff origin/staging...HEAD` (commit `9bcd2ed8`, branch `feat/ta-avatar`)
**Story:** `engineering-team/stories/ta-avatar/1-in-app-badged-ta-avatar.md`
**ADR:** `engineering-team/decisions/ta-avatar/0001-shared-avatar-with-ta-badge-overlay.md`
**Test plan:** `engineering-team/stories/ta-avatar/1-in-app-badged-ta-avatar.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **Node source class** — `node -e "require('./test/in-app-badged-ta-avatar.test.js').run()"` → **13 passed, 0 failed**.
- [x] **Playwright browser class** — rebuilt `ui/` myself, served it at `:4173`, ran
      `BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/ta-badged-avatar.spec.js --project=chromium`
      → **7 passed (9.1s)**. Rebuilding was not optional: B0 exists precisely because a source-only
      edit is invisible to this class, and I needed the gate to be mine, not inherited.
- [x] **Neighbouring suites** that assert on the changed files — `admin-tools-dashboard-panel` (9/0),
      `nip51-list-export-from-pins` (8/0), `nip05-checkmark-verification` (4/0),
      `profile-website-link` (5/0). No regression.
- [x] `harness-lint` — clean (0 violations).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build: no server build step; the `ui/` Vite build ran clean as part of the browser gate._

Full `npm test` was **not** used as the gate: it is environmentally red on this machine independent
of this diff (OPEN.md rows 27 and 143), so it cannot distinguish a regression from the standing
failure. The targeted suites above plus CI's `stack-free` job are the binding checks.

## Spec adherence

- [x] Every acceptance criterion has a passing test.

| AC | Test | Verified |
|---|---|---|
| AC1 — TA shows the owner's picture, badged, distinct from the owner's own | `B1` | ✓ — and the fixture gives both rows the *identical* picture, so the badge is provably the only differentiator |
| AC2 — identifies itself as the assistant of the owner, by name | `B2` | ✓ |
| AC3 — no picture / failed picture → branded placeholder, still badged | `B3`, `B4` | ✓ |
| AC4 — any author with a dead picture URL gets a letter, not the glyph | `B5` | ✓ |
| AC5 — the TA's own user page header carries the same badged avatar | `B6` | ✓ |

- [x] No criterion silently dropped.
- [x] No behavior added beyond the story except one logged deviation (below), which I accept.

## ADR adherence

- [x] Files changed match the ADR's implementation notes exactly: `Avatar.jsx` (new),
      `AuthorCell.jsx`, `UserDetail.jsx`, `ConfigContext.jsx`, `styles.css`, `ta-badge.svg` (new).
- [x] Layering respected — the ADR's Option A (one shared component) and sub-decision A1 (owner
      profile resolved once in `ConfigContext`, not per-Avatar) are both implemented as written.
      `ConfigContext.jsx:33-40` chains a single `/api/profiles` call off the existing owner-pubkey
      fetch; no `useProfiles` call was added to `Avatar`, so the thundering-herd the ADR rejected
      A2 to avoid does not exist.
- [x] No new dependencies.
- [x] `AuthorCell`'s signature is unchanged and R1 re-derives the census from disk — ≥33 call sites,
      each still passing `pubkey` + `profiles`.
- [x] The ADR's context-locality rule is honoured: the `-8px` row compensation sits on
      `.author-cell .avatar-wrap` (`styles.css:1081-1083`), not inside the shared component.

### Deviations (both logged in the story; both verified here, not taken on trust)

1. **Mark scaled 0.86 rather than the ADR's "≈70–75%"** (`ui/public/ta-badge.svg:20`). The ADR's
   stated *requirement* for that number was "so the mark never touches or clips at the disc edge",
   and that requirement still holds. **Verified rigorously, not by eye:** I transformed every
   control point of both paths and measured the furthest from the disc centre — **166.3 against a
   radius of 187.5, i.e. 11.3% clearance**. Because a Bézier curve is contained in the convex hull
   of its control points, all control points being inside the circle *proves* the curve is, rather
   than sampling it. Accepted. (One precision note: the story and the SVG comment say "161" /
   "~14%"; that is the x-extreme only. The true worst case is the point at source (375, 234.7),
   giving 166.3 and 11.3%. The conclusion is unchanged — see non-blocking finding 2.)
2. **The TA name fallback extended to `UserDetail.jsx:63-65`.** The ADR named only `AuthorCell`, but
   `UserDetail` computes its own display name, so the assistant's own page — the destination AC5
   names — still titled itself with a truncated pubkey. Same two lines, same rationale the ADR gives
   for `AuthorCell`. Within the story's intent; accepted. Untested, though — see finding 1.

## Concept-graph integrity

- [x] No concept handles appear in the diff; nothing constructs one.
- [x] No concept definitions changed → **no firmware reinstall required**. Confirmed at Architecture
      against the live graph (48 concepts; nothing models the assistant identity).
- [x] No code re-derives concepts from `BIBLE.md` or firmware JSON.

## Things tests can't catch

- [x] **No hardcoded TA pubkey** — no 64-hex literal anywhere in the diff (checked over the whole
      diff, not just `Avatar.jsx`, which S2 covers). Both new identity checks go through
      `useConfig()`. This is the house rule with the worst blast radius, and it is respected.
- [x] **No secrets, no debug leftovers.** The only `console.log` additions are in `test/test.js`'s own
      suite-runner scaffolding, matching every neighbouring suite.
- [x] **No commented-out code.** The comments that are present explain *why* (the CJS/ESM-free asset
      derivation, the dedupe rationale, the context-locality of the margin) — the kind that survives.
- [x] **No conditional-hook violation.** `AuthorCell.jsx:18-21` calls `useNavigate` and `useConfig`
      *before* the `if (!pubkey)` early return. This is the bug I most expected from adding a hook to
      a component with an early return, and it is not present.
- [x] **The failover state machine is sound.** Failures are tracked by URL, not by index
      (`Avatar.jsx:35,60`), so no reset logic is needed when the candidate list changes — the
      index-cursor bug the ADR warned about is avoided. Walked the A-fails→B-fails→letter sequence:
      React rebinds `onError` with the new `src` closure on each re-render, so each candidate is
      marked dead exactly once. `B4` confirms it end to end.
- [x] **No new security surface.** `src` is still an attacker-controllable kind-0 `picture` URL, as
      before this diff; `javascript:` URLs do not execute in `<img src>`. The one new value class —
      the *owner's* picture rendered on TA rows — is the same kind of data from the same API.
- [x] **No stray files.** `.claude/launch.json`, created during implementation, is covered by
      `.gitignore:110` and correctly absent from the commit.
- [x] **The superseded CSS is genuinely still live, not dead weight.** R4 asserts `.author-avatar*`
      was left in place; I checked *why* it must be — `ui/src/pages/users/Index.jsx:94,96` still uses
      both classes. Keeping them was correct.

## House rules check

- [x] Concept Graph API authority respected (oriented there first at Architecture; nothing in this
      diff needs it).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA pubkey resolved at runtime everywhere.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/pages/users/UserDetail.jsx:63-65` — deviation 2 ships untested.** The TA name fallback
   on the user page is real, correct, and screenshot-verified, but no assertion covers it; `B6`
   checks that page's *avatar* only, and `B2`'s name assertion is scoped to the table row. A
   regression here would be silent. *Ask (next story, not this one):* add one assertion to `B6`
   mirroring `B2`'s.
2. **`ui/public/ta-badge.svg:16-17` — the comment's clearance figures are the x-extreme, not the
   worst case.** It says the widest point "lands 161 from the centre"; the true furthest control
   point is 166.3. Harmless — the claim it supports (no clipping) is true either way — but the
   number is the kind of thing a later reader would trust and re-use. *Optional:* correct to 166.3 /
   11.3%.
3. **`ui/src/pages/users/Index.jsx:88-99` — the users directory hand-rolls AuthorCell's exact markup
   and therefore gets none of this.** It renders `.author-cell` + `.author-avatar` /
   `.author-avatar-placeholder` + `.author-name` inline rather than using `<AuthorCell>`, and it
   lists every pubkey found in Neo4j and strfry — **so the TA appears there, unbadged, with the
   broken-image bug intact**. This is not an AC violation: AC1 enumerates specific surfaces and this
   is not among them. But it is the most conspicuous inconsistency the diff leaves — click a user
   from that directory and the detail page *is* badged — and it was invisible to R1's census, which
   counts `<AuthorCell` usages and cannot see a copy of its markup. It is also a near-trivial fix:
   the markup is AuthorCell's, minus the click-through. Notably, the ADR's deferred-sites list
   (NoteCard, BrainstormProfile, search, user menu, TagChip, PinnedListPanel) **omits this one**, so
   it is an unrecorded gap rather than a knowing deferral. *Ask:* record it — an OPEN.md row or a
   line in the epic's out-of-scope — so the next story in this epic does not rediscover it.

### Harness friction

1. **The Implementer hit a dev-tooling defect that cost a detour and filed it properly** — OPEN.md
   row 145: the Vite **dev** server cannot load the `@tapestry/event-tagging` CJS tree, so
   `npm run dev --prefix ui` renders a blank page on every route. Pre-existing, unrelated to this
   diff (verified: the diff touches none of it), and correctly logged rather than worked around
   silently. No new row needed from this review.

## Verdict

**PASS**

Every acceptance criterion is covered by a test that I ran myself, in a browser, against a bundle I
built myself. The ADR's two structural decisions — one shared component, owner profile resolved once
in context — are implemented as agreed, and the house rule with the worst blast radius (never
hardcode the per-deployment TA pubkey) is respected throughout. Both deviations are logged, and both
survive independent checking: the geometry one I re-derived from the path data rather than accepting
the number in the comment.

The three non-blocking findings are all follow-ups, not defects in what shipped. The most valuable
is finding 3 — a surface that copies `AuthorCell`'s markup instead of using it, which no census in
this test plan could have caught, and which the ADR's deferral list did not record.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not here.
