# Story 47: Retire the interim posting gate (trust-based posting)

**Status:** DONE (2026-06-05). Declaration circles gate the composer on real roster membership; bespoke circles keep the interim `joined` flag (no roster).
**Type:** Refactor/Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
MVP posting is gated on `signedIn && joined` (an interim local-state check, PRD Open Q#5). Once the real roster exists, posting (and other member actions) gate on **actual membership** from the viewer's PoV.

## User-facing description
As a **member**, I want to post because I belong (trust-derived), not because of a local flag, so that participation matches real membership.

## Acceptance criteria
- [x] The composer gates on the derived roster (member) rather than the interim `joined` flag — `viewerIsMember = rosterState.members.some(m => m.pubkey === viewer)`; bespoke circles keep `joined`.
- [x] A non-member sees a peer-framed affordance pointing at the membership path — "Members post here. Add yourself on the People tab, or earn a vouch." (no approve/admit).
- [x] No regression to the kind-1111 posting + CD anchor (Story 41) — `handleSendPost`/`communityATag` untouched.

## Build notes (2026-06-05)
- `CommunityDetail.jsx`: `canCompose = isDeclaration ? (signedIn && viewerIsMember) : (signedIn && joined)`; `composePrompt` branches signed-out / declaration-non-member / bespoke. Signed-out now reads "Sign in to post." (was "Join this circle to post.").
- Tests `test/posting-gate.test.js` (6/6, pure-eval of the gate + source-guard); full suite green; eslint + `vite build` clean.

## Out of scope
Reply threads. Reactions. Moderation (Phase 3). Auto-self-tagging the founder on founding (small follow-up so a founder belongs to their own circle without a manual "I'm in").

## Linked artifacts
ADR 0030; Stories 44 (roster) + 43 (assertions).
