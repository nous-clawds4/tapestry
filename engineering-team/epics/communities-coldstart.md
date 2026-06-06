# Epic: Communities — A Way In For A Stranger (Phase 2, Block D)

**Status:** BLOCKED to plan on PRD §11 Q1 (cold-start mechanism) + depends on Block A
**Created:** 2026-06-06
**Book:** `engineering-team/audits/communities-v2/book.md`
**Source:** PRD `product-team/prd/communities-v2.md` §5.3, §5.4 + `stories-queue.md` Block D. This is the MVP's deferred story 46, now central.

## What this is
The cold-start foothold: a way for a true outsider with no existing trust to earn a first foothold through a person's extended trust, rather than an admin's approval. The Convener's growth engine seen from the Newcomer's side.

## Stories (`stories/communities-coldstart/`)
- **9 — Extend a foothold invite** (a founder/member creates an invite that carries their vouch; shareable link; worded as a personal act of trust).
- **10 — Accept a foothold and enter as a newcomer** (the outsider sees who invited them, creates a portable identity, the carried vouch takes effect; expired-invite path; reuses the V1 sign-in pattern).

## Dependencies
- **Q1 (cold-start mechanism)** must be resolved first. Design assumes invite-carries-a-vouch; founder-grant and provisional standing are the named fallbacks.
- Both stories depend on Story 1 (`go-live`) — membership must be live for a carried vouch to mean anything and be visible.
- Story 10 depends on Story 9.

## Notes
The payoff must be verifiable end-to-end: an accepted vouch produces membership a reader can see (ties to Story 1). Never frame the invite as an approval (style guide).
