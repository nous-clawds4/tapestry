# Epic: Communities — Awareness On Your Terms (Phase 2, Block C)

**Status:** Ready to plan — Story 7 gated on PRD §11 Q6 (launch channels)
**Created:** 2026-06-06
**Book:** `engineering-team/audits/communities-v2/book.md`
**Source:** PRD `product-team/prd/communities-v2.md` §5.5, §5.6 + `stories-queue.md` Block C. Design: `guides/communities-v2-design-guide.md` principles 7 & 8 (the sovereignty control).

## What this is
Sovereign notifications: a person learns what happened involving them without being pulled. The preferences control (everything off by default, individually turn-off-able) is the enforcement point for user sovereignty, and it must exist before any notification is sent.

## Stories (`stories/communities-notifications/`)
- **7 — Notification preferences (the sovereignty control).** Off-by-default toggles, no master switch, state by position + label. **Plan first.** Gated on Q6 (which channels at launch).
- **8 — Notification inbox.** Calm list, a quiet new-marker (a dot, never a count badge), filtered by preferences.

## Dependencies
- Story 8 depends on Story 7 (preferences gate what appears, and defaults must exist first).
- Block C depends only on events existing (vouches, posts, replies) — can run in parallel with Block B.

## Notes
No numeric badge, no nag, no urgency styling — the style guide's Phase 2 forbidden list (urgency/capture copy) is enforced here. Defaults-off is non-negotiable.
