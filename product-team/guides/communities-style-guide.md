# Style Guide: Communities

**Slug:** communities
**Date:** 2026-06-05

> Governs all user-facing text in the product. Binding during engineering review. Built from `product-team/guardrails/language.md` plus this product's voice.

## Voice

Communities sounds like a trusted peer explaining how the place works, not a platform marketing itself. Calm, plain, and concrete. It respects that the user is wary, and it earns trust by being specific rather than enthusiastic.

Three voice commitments:
- **Peer, not platform.** A founder is "a peer here, not an owner." Never address users as an audience ("we're excited to announce").
- **Concrete trust, never badges.** Say "3 people you trust vouch for them," never "verified" or "trusted member" as a label we hand out.
- **Calm about danger.** An impersonator is described, not alarmed about: "no one you trust vouches for them." No red warnings, no scare copy.

## Language rules
- No AI-generated filler ("I'd be happy to help," "Great question," "Let's dive in").
- No marketing superlatives without evidence. None of "seamless," "effortless," "revolutionary."
- No jargon without definition. Avoid protocol terms in user copy (no "declaration," "resolved definition," "vouch tag"); say "circle," "what it takes to belong," "people who vouch for you."
- Active voice over passive.
- Short sentences. If a sentence has more than one comma, consider splitting it.
- Specific over vague ("12 people you trust are inside," not "well-trusted").
- Trust is point-of-view. Personal-view copy says "people **you** trust"; the signed-out house view says "established members" and is labeled as the house view.

## UI copy patterns
- **Button labels:** verb + noun. "Start a circle," "Fork this circle," "Sign in," "Post." Never "Submit."
- **Empty states:** name what will appear and how to start. "No circles yet. Start the first one." "No posts yet. Start the conversation."
- **Loading states:** silent skeletons, no copy needed. Never a bare spinner.
- **Error messages:** what went wrong and what to do. "We couldn't reach the network. Try again?" Never "Something went wrong."
- **Confirmation messages:** confirm the outcome, not the click. "Your circle is live." "Posted to the circle."
- **Sign-in prompts:** state why, at the moment of acting. "Sign in to publish your circle. Your identity is portable — it's how people vouch for you." (One em-dash here is acceptable as a genuine aside, not a default connective.)

## Trust-signal copy (product-specific)
- Signed in: "**N people you trust are inside**."
- Signed out: "**N established members**" plus "Sign in to see who you trust inside."
- Trusted member row: "trusted by people you trust."
- Untrusted/impersonator row: "no one you trust vouches for them." Never "fake," "scam," or "warning."
- Degraded trust network: "Showing names without the trust signal. Retry?"

## Forbidden phrases
Base list in `product-team/guardrails/language.md` applies in full. Extended for Communities:

- "Verified" / "verified member" / any badge-style label of legitimacy.
- "Admin," "moderator," "owner" used to describe a person's power over a circle. A founder is a peer.
- "Members only" gating language that implies an authority's permission. Belonging is earned, not granted.
- "Join now," "Sign up free," and other acquisition-funnel copy.
- Scare copy about impersonators ("Warning: this account may be fake").
- Protocol vocabulary in user-facing text ("Community Declaration," "inherit-from," "kind-1111," "GrapeRank"). Keep it in engineering docs.
