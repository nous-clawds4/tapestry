# Story 7: Notification preferences (the sovereignty control)

**Status:** Done
**Created:** 2026-06-06
**Type:** Feature
**Epic:** `communities-notifications` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.6 · **Queue:** `product-team/stories-queue.md` Block C, Story 7

## Background
Phase 2 adds notifications, and the product's sovereignty stance (design principle 8) requires that a person control what may reach them *before* anything is ever sent. This story builds that control: a short list of independent toggles, **everything off by default**, no master "turn on everything" switch. It must ship before the inbox (Story 8) consumes it — defaults-off is the gate that keeps notifications a service the user opted into, not a pull. Q6 is resolved: **in-app only at launch**, so the occasions are in-app surfaces (no email/push), and the control should not imply other channels.

Affected: the Belonger (and every member) — this is how they keep their attention their own.

## User-facing description
As a member, I want to choose exactly which things I hear about, with everything off until I turn it on and nothing I can't turn off, so that notifications serve me rather than pull at me.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] A person sees independent toggles for each occasion: "Someone vouches for you", "New posts in your circles", "Replies to you".
- [ ] Every occasion is **off by default** for a person who has never set a preference.
- [ ] Turning a toggle on or off saves immediately and shows a quiet "Saved" confirmation.
- [ ] There is no master "turn on everything" control.
- [ ] Toggle state is conveyed by switch position **and** an on/off text label, never by color alone.
- [ ] A failed save reverts the toggle to its last saved position and shows an inline retry; it does not silently appear changed.

## Concepts touched
- Notification Preference — a person's own stated rules for which occasions may reach them, each independently enabled, conservative (off) by default. Plain-language; the Architect decides where it is stored and whether it is device-local or portable with the identity.
- The occasions themselves are surfaced (consumed) by the inbox in Story 8 — out of scope here.

## Out of scope
- Generating or showing any notification (Story 8 — the inbox). This story is the control only.
- Channels beyond in-app (email/push) — Q6 resolved to in-app only; the model may leave room for future channels but the launch UI shows none.
- Per-circle notification settings (a single set of global occasion toggles for v1; per-circle granularity is a later consideration).

## Open questions
- Storage: device-local (per browser) vs portable with the identity (so the choice follows the person across devices/clients). The product values portability; the Architect weighs this against simplicity for v1, and the default-off behavior must hold regardless. Resolve in Architecture.
- Whether the absence of any stored preference is represented explicitly or simply read as "all off" — Architecture; the observable behavior (off by default) is fixed.

## Linked artifacts
- ADR: `engineering-team/decisions/communities-notifications/0037-notification-preferences.md` (device-local via localStorage behind a module; pure default/merge core; off-by-default; portability deferred)
- Test plan: `engineering-team/stories/communities-notifications/7-notification-preferences.test-plan.md` (new suite `test/notification-preferences.test.js`: real-source default/merge T1–T5 (off-by-default), UI + route/menu guards T6–T9)
- Review: `engineering-team/reviews/communities-notifications/7-notification-preferences.md` (PASS — 2026-06-06)
