# Story 2: Conversation stays open when the trust source is unreachable

**Status:** Done
**Created:** 2026-06-06
**Type:** Bug (live posting-lock) with a small graceful-degradation behavior
**Epic:** `communities-go-live` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.2 · **Queue:** `product-team/stories-queue.md` Block A, Story 2

## Background
Posting in declaration circles gates on real roster membership (shipped under the MVP's story 47). The roster is read from the platform's trust engine cross-origin, which is **not yet reachable in production** (that is Story 1). The consequence today: the roster reads empty, so conversation in new circles is locked **even for the founder**. This is a known live gotcha. Until the trust source is live (Story 1), and whenever it is briefly unreachable thereafter, conversation must not be dead. A signed-in person should still be able to post, with a calm explanation, falling back to the interim membership check rather than blocking.

Affected: every Convener founding a new circle on production right now, and any member during a transient trust-source outage.

## User-facing description
As a signed-in member of a circle (including a founder in a brand-new circle), when the trust network can't be reached, I want to still be able to post with a clear explanation, so that conversation is never dead just because membership can't be confirmed at that moment.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] Given the roster/trust source is unreachable, when a signed-in viewer opens a declaration circle, then a usable composer is shown (not disabled, not absent).
- [ ] Given the roster source is unreachable, then a calm note above the composer states that the trust network can't be reached, membership can't be confirmed, and they can still post.
- [ ] Given a founder in a brand-new circle whose roster is unreachable, when they post, then the post succeeds.
- [ ] Given a circle whose roster loads successfully but is genuinely empty (source reachable, zero members), then the degraded fallback does NOT apply and the normal trust-based gate governs (no open posting on a healthy-but-empty roster).
- [ ] Given the roster source recovers, when the viewer returns or reloads, then the normal trust-based gate resumes and the degraded note disappears.
- [ ] The degraded note never reads as an error; "something went wrong" and error-tone copy are absent (matches the Phase 2 style guide).

## Concepts touched
- The per-viewer membership roster read (derived from the platform's web-of-trust; consumed cross-origin) — its *reachability/health* is the trigger for this story.
- The declaration circle (Community Declaration) composer gate — the behavior being made resilient.

## Out of scope
- Turning the trust surface data-live in production (that is Story 1 / the cross-team gate).
- Bespoke (frozen owner-style) circles — they keep their existing flag-based gate, unchanged.
- Any change to the trust-based gate itself when the source is healthy (only the unreachable/degraded path is added).

## Open questions
- **Degraded vs. empty distinction (the crux — for the Architect).** The fallback must fire on "source unreachable / errored," not on "source reachable but the roster is empty." A healthy-but-empty roster must keep the normal gate (otherwise a real empty circle would silently become open-to-all). The Architect should define how the roster read surfaces a `degraded`/`unreachable` state distinct from a successful-but-empty result, and how the composer gate consumes it. (Resolve in Architecture, not here.)
- Founder-specific path: in a brand-new circle the founder auto-belongs, so once Story 1 lands the founder posts via normal membership. This story keeps them unblocked in the interim/degraded window via the fallback gate; confirm the interim gate (signed-in + joined) is the intended fallback rule.

## Linked artifacts
- ADR: `engineering-team/decisions/communities-go-live/0032-degraded-posting-fallback.md` (Option B — degraded falls back to founder-or-joined)
- Test plan: `engineering-team/stories/communities-go-live/2-posting-fallback.test-plan.md` (tests extend `test/posting-gate.test.js`: T7–T11 + updated source guard T6)
- Review: `engineering-team/reviews/communities-go-live/2-posting-fallback.md` (PASS, 2026-06-06)
