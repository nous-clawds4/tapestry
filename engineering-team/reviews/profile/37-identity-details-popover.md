# Review: Story profile #37 — Identity details popover

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-16
**Diff:** `git diff 8765c447..HEAD` (impl commits `9d5cfd64` + `33731edf`; branch `feat/profile-identity-popover`)
**Story:** `engineering-team/stories/profile/37-identity-details-popover.md`
**ADR:** `engineering-team/decisions/profile/0033-identity-details-popover.md`
**Test plan:** `engineering-team/stories/profile/37-identity-details-popover.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. New suite `profile-identity-details-popover`: **14 passed, 0 failed**. Every other suite still green (incl. `profile-website-link`, `profile-verified-counts-owner-pov`, `profile-verified-counts-explainer-and-alarm`, `profile-verified-reporters-count`); **no FAIL anywhere; Overall: PASS**. No regression introduced.
- [x] `npm run test:playwright` — N/A. The Playwright harness is broken (intake 2026-06-06 item 8) and irrelevant here; per ADR 0033 this feature is covered by source-regex sentinels, the established `profile-*` pattern.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured for the runner; the `ui` Vite app compiles (verified live during implementation, see below)._

## Spec adherence

Every acceptance criterion maps to ≥1 passing test (verified against the suite):

- [x] AC1 (control right of name, neutral non-key glyph, floated right) → T2 (`⋯`, not `🔑`/`ⓘ`), T7 (`.bsp-name-row` next to `.bsp-name`), T8 (`.bsp-name-row` CSS). Far-right pinning confirmed live.
- [x] AC2 (a11y label) → T3 (`aria-label="Show account identifiers"`, `IdentityDetails.jsx:18`).
- [x] AC3 (tap-to-open/dismiss, consistent) → T4 (`bsp-confirm-overlay`/`box` + `useState`).
- [x] AC4 (shows npub + pubkey, labelled) → T5 (`Pubkey (hex)` + `npub`, `bsp-id-row`).
- [x] AC5 (copy each, full value, same feedback) → T1 (CopyButton extracted), T6 (`value={pubkey}`/`value={npub}` — full values).
- [x] AC6 (no longer inline) → T9 (no local `CopyButton`, no `<CopyButton value={pubkey/npub}>`, no `Pubkey (hex)` in page body).
- [x] AC7 (Website + Lightning remain) → R1, R2.
- [x] AC8 (empty Identity section collapses) → T10 (`{(profile?.website || profile?.lud16) && (…)}`, `BrainstormProfile.jsx:317`).
- [x] AC9 (purely presentational) → T11 (no `fetch` in IdentityDetails), R3 (`nip19.npubEncode` derivation unchanged).
- [x] No criterion silently dropped; no behavior added beyond the story.

## ADR adherence

- [x] Files changed match ADR 0033's Implementation notes exactly: `ui/src/components/CopyButton.jsx` (new, verbatim extraction), `ui/src/components/IdentityDetails.jsx` (new), `ui/src/pages/BrainstormProfile.jsx` (import + header wrap + Identity-section removal/gate + local CopyButton deleted), `ui/src/styles.css` (`.bsp-name-row`).
- [x] Layering matches: self-contained `IdentityDetails` mirroring `VerificationInfo`/`ReputationInfo` (chosen Option A); `CopyButton` extracted to a shared component and imported by `IdentityDetails`.
- [x] No new dependencies; reuses `bsp-info-btn` / `bsp-confirm-*` / `bsp-id-*` and `nip19` already in scope.
- [x] **Deviation, flagged & sanctioned:** the trigger is pinned to the **far-right edge** (`.bsp-header-info { flex: 1 }`, `styles.css:3366`) rather than immediately adjacent — operator-requested (2026-06-16), recorded in the story's `## Deviations`, and explicitly the alternative ADR 0033 named under "Trigger placement / float right." Not a silent contradiction.

## Concept-graph integrity

- [x] N/A — purely presentational change. No concept/schema touched, no handles introduced, **no firmware reinstall required** (ADR 0033 confirms). npub/pubkey are NIP-19 encodings of the already-known `nostr-user` pubkey, derived client-side as before.

## Things tests can't catch

- [x] No secrets in the diff.
- [x] No leftover debug logging / `console.log`.
- [x] No commented-out code; the obsolete "Copy Button" banner + function were cleanly removed from `BrainstormProfile.jsx` (no orphan).
- [x] `shortPubkey` correctly retained — it's no longer used in the Identity row but is still used for the displayName fallback (`BrainstormProfile.jsx:103`); not wrongly deleted, no dead helper.
- [x] No dead import: `BrainstormProfile.jsx` does **not** import `CopyButton` (only `IdentityDetails` does) — correct, since the page no longer uses it.
- [x] `npub` null-guard preserved (`IdentityDetails.jsx:33` `{npub && (…)}`); a null npub omits its row, the pubkey row always renders.
- [x] `.bsp-header-info { flex: 1 }` has no other consumer (grep: the class is profile-header-only); visually confirmed the name row stretches while nip05/age stay left-aligned.
- [x] Security: no input-handling/injection surface; clipboard write is the unchanged, already-shipped behavior.

## House rules check

- [x] Concept Graph API authority respected (N/A — no concept work).
- [x] No new lint/typecheck/build tooling. Tokens-only styling (no new color tokens — `.bsp-name-row` is layout-only; `flex:1` is layout-only). No new icon library — the `⋯` is a plain unicode glyph. JS-without-build honored.

## Findings

### Blocking
_None._

### Non-blocking
1. **`ui/src/components/IdentityDetails.jsx:30`** — `pubkey.slice(0, 12)` assumes `pubkey` is defined. It always is on the `/user/:pubkey` route (it's a required `useParams` value), and the prior code made the same assumption (`shortPubkey(pubkey)`, `value={pubkey}`), so this is **no regression**. Optional hardening: a defensive guard if `IdentityDetails` is ever reused off-route. Not required for this story.
2. **Branch scope** — the branch also carries `21c57e7f` (docs/PROFILE_IA_REVIEW_2026-06-16.md + an intake entry, the parked "Story B" capture). Doc-only, intentional, and out of scope for this story; noted, not a finding against the implementation.
3. **Keyboard dismissal** — the popover has no Esc/focus-trap, matching the existing `bsp-confirm-*` popovers; ADR 0033 explicitly scopes this out (a future a11y pass could cover all such popovers at once). Not blocking.

### Visual evidence
Verified live against the running local stack (`tapestry-ui` Vite → proxy `:7778`) during implementation: real profile renders the `⋯` control at the far-right of the header (aligned with the two `ⓘ` icons), the "Identifiers" popover opens with both copyable rows, Website + Lightning remain inline, and the layout holds at mobile (375px). No console errors.

## Verdict
**PASS** — the diff matches the story, ADR 0033, and the test plan; all 14 sentinels pass with no regression to any other suite; the one deviation is operator-approved and documented; house rules honored. Mergeable as-is; ready for the deploy chain (`cycle-staging`).
