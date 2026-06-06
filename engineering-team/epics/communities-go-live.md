# Epic: Communities — Lights On (Phase 2, Block A)

**Status:** Ready to plan — Story 2 unblocked; Story 1 BLOCKED on cross-team (PRD §11 Q7)
**Created:** 2026-06-06
**Book:** `engineering-team/audits/communities-v2/book.md`
**Source:** PRD `product-team/prd/communities-v2.md` §5.2, §5.10, §7 + `stories-queue.md` Block A.

## What this is
Make the membership/trust surface that shipped (but stayed dark) in the MVP show real data in production, and make conversation resilient when the trust source is unreachable. This is the demo milestone: after this epic, a founder can open a circle on production, see a real roster and trust signal, and hold a conversation.

## Stories (`stories/communities-go-live/`)
- **1 — Membership surface shows real data in production.** Release-gate / config-and-verify, not a feature build. **BLOCKED on Q7 + cross-team:** trust-scoring core promoted staging→prod; deploy config set (profile API base, dual-publish relay, CORS for the profile-tags read path, house PoV rank floor). Verify on production.
- **2 — Conversation stays open when the trust source is unreachable.** The graceful posting-lock fallback (degraded roster → signed-in gate). Independent; ships value even while the surface is dark. **Sequence first.**

## Dependencies
- Story 1: the cross-team asks in the book + PRD §11 Q7.
- Story 2: none.

## Notes
Story 2 resolves the current live posting-lock (founders can't post in new circles) and should be planned first. Story 1 is verification-heavy and gated on ops/platform; do not start until Q7 is resolved.
