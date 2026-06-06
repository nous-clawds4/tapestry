# Book of Work: Brainstorm Communities (Phase 2 — "Make it live, honestly")

**Slug:** communities-v2
**Status:** Open
**Opened:** 2026-06-06
**Closed:** —

## Intent anchor
**PRD-backed** — `product-team/prd/communities-v2.md`, §8.1 In Scope (the launchable version). Completion is *computed*: every story tracing to §8.1 is `Done` and its epic is closed, the Phase 2 success metrics in §10 are observably met (notably: real rosters live in production, a true outsider enters via a foothold, conversation feels alive on sovereign terms, founder head-start decay is inspectable, and the three legacy test circles are gone from production discovery).

Companion product artifacts (read for context, do not edit — one-directional seam): `guides/communities-v2-design-guide.md`, `guides/communities-v2-style-guide.md`, and `product-team/stories-queue.md` (the Phase 2 queue).

## Epics in this book
- `communities-go-live` — turn the already-built membership surface data-live in production + the posting-lock graceful fallback. Stories 1–2. *(Demo milestone.)*
- `communities-aliveness` — replies, reactions, offered live updates, signs of life. Stories 3–6.
- `communities-notifications` — sovereign notifications: preferences (off-by-default) + inbox. Stories 7–8.
- `communities-coldstart` — the foothold invite (carries a vouch) + the outsider's onboarding accept. Stories 9–10.
- `communities-caretaking` — legible founder head-start decay, founder auto-belong ratification, retire a circle. Stories 11–13.

## Open questions that gate stories (from PRD §11)
These must be decided before the named story is planned. Several need cross-team input.
- **Q7 cross-team dependency timing** → gates Story 1 (`go-live`). Needs the trust-scoring core promoted staging→prod + deploy config.
- **Q6 notification channels at launch** → ✅ **RESOLVED 2026-06-06: in-app only** for launch (no email/push). Story 7's preference toggles reflect in-app occasions only; the Preference model keeps room for future channels but launch ships none. Story 7 (`notifications`) is now unblocked.
- **Q1 cold-start mechanism** → gates Story 9 (`coldstart`). Design assumes invite-carries-a-vouch.
- **Q2 head-start decay rule** → gates Story 11 (`caretaking`).
- **Q4 founder auto-belong** → shapes Story 12 (`caretaking`).
- **Q5 retirement mechanism + one-off vs durable** → gates Story 13 (`caretaking`).
- **Q3 default belonging threshold** → settle before launch; blocks no single story.

## Cross-team asks to relay (from the product queue handoff)
- **Platform team (Vinney):** promote the trust-scoring core to production; add the per-row self-applied flag (unblocks the Phase 3 applicant role); confirm the dual-publish relay URL.
- **Ops (David):** set the deploy config — profile API base, dual-publish relay, CORS for the profile-tags read path, house point-of-view rank floor.

## Engineering carry-forward (housekeeping, not Phase 2 stories — from the close audit)
- ADR refolder execution + fold ADR-0022.
- Multi-parent fork diamond fence in the resolver before multi-parent claims inheritance.
- Decide whether the roster read endpoint accepts a per-call rank override (the inert `influence_cutoff` field).

## Provenance
- **Mode:** PRD-backed *(anchor captured eagerly at kickoff)*.
- **Confidence at close:** — *(to be set by `/close-book`)*.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/communities-v2/audit.md`
- Product feedback: `engineering-team/audits/communities-v2/prd-addendum.md`
