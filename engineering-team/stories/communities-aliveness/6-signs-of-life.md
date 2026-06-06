# Story 6: Signs of life on a circle

**Status:** Done
**Created:** 2026-06-06
**Type:** Feature
**Epic:** `communities-aliveness` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.1, §5.8 · **Queue:** `product-team/stories-queue.md` Block B, Story 6

## Background
A visitor evaluating a circle can't currently tell a living circle from a dormant one without signing in and reading the conversation. This is the Newcomer's first-read decision (their journey step 2). Signs of life is a single, plain, read-only line that states a circle's recent activity in concrete terms, so a visitor can judge it before any account exists. Per the design guide (principle 11) the line is **calm about quiet** — a dormant circle is stated plainly, never shamed or hyped, and there is no "hot"/"trending"/urgency styling. It derives from the activity already in the circle (posts, replies, reactions).

This is the last Block B story; it makes "find the good ones" legible and closes out the aliveness surface.

Affected: the Newcomer (deciding whether to engage) on both discovery and the circle page.

## User-facing description
As a visitor with no account, I want each circle to show in plain terms whether it's active or quiet, so that I can tell a living circle from an abandoned one before I invest any effort.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] Given a circle with recent activity, when viewed with no account, then it shows a concrete activity line (e.g. "Active today · 6 posts this week").
- [ ] Given a dormant circle, then it shows a plain line stating how long it's been quiet (e.g. "Quiet lately · last post 3 weeks ago"), with no alarm or hype styling.
- [ ] Given a brand-new circle with no activity, then it shows "New circle · founded today" (or an equivalent founded-recently line).
- [ ] The signs-of-life line renders on both the circle detail page and the discovery cards.
- [ ] Given activity data can't be loaded, the line is omitted entirely rather than shown wrong (no guessed or zeroed claim).
- [ ] The line conveys recency by text (a date/relative phrase), never by color alone.

## Concepts touched
- The circle's activity (derived from its posts/replies/reactions) — a read-only "most recent activity + recent volume" summary. Plain-language; the Architect resolves how it's computed and, for the grid, fetched efficiently.
- The Circle Card (discovery) and the circle detail page — where the line renders.

## Out of scope
- Real-time activity updates (Story 5 covers offered live updates on the detail conversation; signs of life is a read-on-load summary).
- Sorting/filtering discovery by activity (richer discovery is Phase 3) — this story only shows the line, it does not re-order the grid.
- Trust signal on the discovery grid (Phase 3) — separate concern.
- Any per-circle write or account requirement.

## Open questions
- Discovery-grid efficiency: a per-card activity fetch would be N requests. The Architect should find a batched path (e.g. one recent-activity query bucketed per circle) so the grid stays fast — the same batching concern the audit flagged for the discovery trust signal.
- Thresholds for "active" vs "quiet" vs "new" (e.g. what window counts as active, what counts as a founded-recently "new" circle) — Architecture, kept legible and plain.
- Whether reactions/replies count toward "activity" or only top-level posts — Architecture; the line should reflect genuine recent life.

## Linked artifacts
- ADR: `engineering-team/decisions/communities-aliveness/0036-signs-of-life.md` (pure describeActivity; one batched grid query; coarse-on-grid / precise-on-detail tradeoff)
- Test plan: `engineering-team/stories/communities-aliveness/6-signs-of-life.test-plan.md` (new suite `test/signs-of-life.test.js`: real-source describeActivity T1–T8, fetch/render guards T9–T11)
- Review: `engineering-team/reviews/communities-aliveness/6-signs-of-life.md` (PASS, 2026-06-06)
