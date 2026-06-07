# Discovery Brief: Verified Reporters

**Slug:** verified-reporters
**Date:** 2026-06-07
**Strategist phase:** Discovery (Phase 1)

## Problem statement
When an observer lands on a user's profile, they can already read two trust signals — who that user follows, and who *within the observer's web of trust* follows them back (Verified Followers). What's missing is the credible **negative** signal: whether trustworthy people have formally flagged this account. NIP-56 report data already exists on the network, but in raw form it is worthless and effectively invisible — a bad actor can manufacture an unlimited number of reports, drowning any honest flag in noise. The observer most in need of this signal is **someone deciding whether to follow or engage a stranger**, who today has no at-a-glance way to learn "N people I'd actually trust have reported this account." (Moderation, transaction-vetting, and other observer roles inherit the same signal later, but the stranger-engagement case is the anchor.)

## User landscape
The types of people affected. For each: how they cope today, and what they hate about it.

- **The engaging observer (anchor)** — someone deciding whether to follow, reply to, or engage a stranger. Today they eyeball follower counts, profile content, and gut feel; credible warnings that *do* exist in the report data are buried beneath bad-actor noise, so they can't be used. The pain: getting burned by accounts that trusted people had already flagged, with no way to have seen it.
- **The moderator / community steward (later)** — needs to triage accounts at scale. Inherits the same signal; out of anchor scope but should not be designed against.
- **The transactor (later)** — vetting a counterparty before value changes hands. Same signal, higher stakes; also later.

## Competitive landscape
What exists today and the **structural** reason it fails.

- **Raw NIP-56 report counts (other Nostr clients)** — some clients can tally reports against an account, but the count is global and unfiltered. Structural failure: with no identity cost and no trust filter, reports are infinitely sybil-able, so the number carries no information and is rightly ignored or hidden. The metric is broken at the root, not in its presentation.
- **Centralized platform "report" / trust-and-safety systems** — a platform aggregates reports and acts on them opaquely behind the scenes. Structural failure: the observer never sees the signal and cannot apply their *own* standard of whose judgment to trust; the platform's PoV is imposed as a single global truth. (General characterization of centralized moderation; specific competitor behaviors not individually verified.)
- **Tapestry's own Verified Followers** — proves the positive-signal pattern works (a count filtered to the observer's web of trust, linking to a list). The gap is simply that no negative-signal counterpart exists yet.

## Opportunity
The web of trust is exactly the filter that converts an ungameable-in-raw-form metric into a credible one. A report only counts if the reporter is a **verified** user — inside the observer's calculated web of trust — so manufactured pile-ons from bad actors stay invisible no matter how many reports they file. The count is therefore **relative to who is looking** (`pov`): there is deliberately no global "verified reporters" number, in keeping with the principle that for most WoT measures *there is no such thing as a global view*. When the viewer has no calculated WoT yet, the House PoV is the fallback — used as sparingly as possible, as the closest thing to a shared baseline. Why now: the positive-signal pattern (Verified Followers) is already shipped and proven, so the negative-signal counterpart is a natural, legible extension. Why this team: only a system that already computes per-observer webs of trust can produce this metric at all.

## Constraints
The operating envelope.

- **Budget:** Not specified; treat as a focused incremental feature, parallel to existing profile counts.
- **Timeline:** Not specified.
- **Team:** Tapestry / Brainstorm engineering team (downstream of this product flow).
- **Technical:** Built on Tapestry / Nostr. Reuses the existing web-of-trust / "verified" notion (per-observer `pov`, House PoV fallback) and NIP-56 report data. Parallel in placement and behavior to the existing Following and Verified Followers counts on the profile.
- **Regulatory:** None identified. Note the social/abuse dimension below.

## Open questions
Anything unresolved that later phases need to know. Numbered.

1. **Report-type aggregation:** All NIP-56 report types are lumped into a single count for now. Separating by type (spam, impersonation, illegal, etc.) is explicitly deferred to a future phase — but the domain model should not foreclose it.
2. **Pile-on by verified users:** Even verified users can pile on; this is human nature. The roadmap remedy — tagging pile-on-prone users and discounting their reports — is explicitly **out of scope now** but is a known future direction the design should not contradict.
3. **House PoV fallback semantics:** Confirm in domain/scope phases exactly when the fallback engages (viewer has no calculated WoT available) and how it is signaled to the observer, so the "no global view" principle stays legible rather than silently defaulting.
4. **Self-view and edge cases:** Behavior when the observer views their own profile, when the count is zero, and when WoT is still computing — to be settled downstream.
