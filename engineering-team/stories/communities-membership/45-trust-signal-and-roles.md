# Story 45: Trust signal + applicant/member display (Block 3)

**Status:** Design-ahead (BLOCKED — rides Story 44's roster engine)
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030. **This is Block 3 (trust signal), folded here because it reads the same engine.**

## Background
The trust signal and per-member legibility the PRD/design specified, now backed by the real roster: "N people you trust are inside" (signed-in) / "N established members" (house, signed-out); each member shown with their trusted/untrusted standing from the viewer's PoV; impersonators weightless. Plus the applicant→member role on the People tab.

## User-facing description
As a **Newcomer**, I want to see how many people I trust are inside and tell real members from impersonators, so I can judge a circle before joining.

## Acceptance criteria
- [ ] Discovery + detail show the point-of-view trust signal (house view signed-out; personal on sign-in) — works with **no account**.
- [ ] The People tab renders the derived roster with **applicant vs member** roles.
- [ ] Each member shows trusted/untrusted standing (text + color, never color alone); an impersonator reads "no one you trust vouches for them."
- [ ] If the WoT/roster is unreachable, degrade to names + retry (no blank/blocked page).

## Out of scope
The roster math (Story 44). Posting gate (Story 47).

## Linked artifacts
ADR 0030; design guide (Trust Signal component); BLOCKED on Story 44.
