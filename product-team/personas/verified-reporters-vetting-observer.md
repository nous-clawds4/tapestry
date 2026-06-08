# Persona: The Vetting Observer

**Slug:** verified-reporters-vetting-observer
**Priority:** Primary
**Date:** 2026-06-07

## Who they are
An established Tapestry user with a calculated web of trust. They habitually check a stranger's profile before following, replying to, or amplifying them. They read trust signals fluently and already use Following and Verified Followers as part of a snap judgment. They are constitutionally skeptical of raw counts and trust only signals filtered through their own network. They act on evidence, not vibes.

## What they want
To know at a glance whether people *they* trust have flagged this stranger, before deciding to engage.

## Their core loop
Encounter a stranger (mention, feed, search) → open their profile → scan the trust signals, including Verified Reporters → if the count is non-zero, drill into the list to weigh *who* reported and whether they respect those reporters → decide to engage, ignore, or avoid → sharper instincts on the next encounter.

## What they won't tolerate
- A count they can't trust — global or unfiltered noise carries no information.
- A number with no way to see who is behind it.
- Ambiguity about *whose* PoV the number reflects.
- Latency that breaks the snap judgment.

## Notes
This is the anchor persona; every core design decision should serve it. Moderators and transactors are deferred inheritors of the same signal — at MVP scope they would see and want exactly what this persona does, so they are intentionally not modeled separately.

Open edge cases for downstream phases:
- **Self-view:** when this user views their *own* profile, do they see their own count and who reported them? This carries retaliation risk.
- **Zero-state:** "0" must read as "no verified reports," never as "feature missing" or "not computed."
