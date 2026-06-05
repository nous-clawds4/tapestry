# Story 35: Discover circles (read-only)

**Status:** Done
**Created:** 2026-06-05
**Type:** Feature
**Epic:** `communities-declaration` · **Product source:** PRD §5.1 / stories-queue Block 1, Story 3 (Newcomer).
**Architecture:** No new ADR — covered by **ADR 0029**. Story 33 already added the discovery union (`getDiscoverableCommunitiesFromRelay` unions Declarations + bespoke records). This story ratifies that the Discover surface renders that union with no account, and fills any gaps.

## Background
A visitor with no account must be able to browse and search circles, including Community Declarations created by anyone. Story 33 wired the relay union into the discovery read path; the Discover page already renders cards with loading/error/empty/ready states and a search filter. This story confirms the end-to-end discover experience for CD circles and closes any gaps.

## User-facing description
As a **Newcomer**, I want to browse and search circles without signing in, so that I can find the real circle for my interest.

## Acceptance criteria
- [ ] Given no account, when a visitor opens Discover, then circles render (no auth gate blocks the grid).
- [ ] Given Community Declarations exist on the relay, then they appear in Discover (the discovery read path unions Declarations).
- [ ] Given a search query, then the grid filters by name/description/topic.
- [ ] Given no circles, then an empty state invites starting the first one.
- [ ] Loading shows skeletons; a fetch failure shows an error with retry.

## Concepts touched
- `39998:<TA>:brainstorm-community` (Declarations) + the bespoke `39999` records — both surfaced via the union.

## Out of scope
- Trust signal on cards (Block 3). Personalized ranking (stretch). The card's per-member trust legibility (Block 3).

## Open questions
Resolved: the union + Discover surface exist from Story 33; this story verifies CD discoverability + no-account rendering and adds nothing architecturally new.

## Linked artifacts
- PRD §5.1 · ADR 0029.
- Test plan: `35-discover-circles.test-plan.md` + `test/discover-circles.test.js`.
- Review: [`../../reviews/communities-declaration/35-discover-circles.md`](../../reviews/communities-declaration/35-discover-circles.md) — **PASS** (6/6, delivered via Story 33 union).
