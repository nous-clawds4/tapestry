# Style Guide: Communities (Phase 2)

**Slug:** communities-v2
**Date:** 2026-06-06
**Extends:** `guides/communities-style-guide.md` (V1 — binding, not superseded). All V1 voice, rules, and trust-signal copy carry forward. This guide is self-contained for the Phase 2 surfaces and adds the patterns Phase 2 introduces.

> Governs all user-facing text in the product. Binding during engineering review. Built from `product-team/guardrails/language.md` plus this product's voice.

## Voice

Communities sounds like a trusted peer explaining how the place works, not a platform marketing itself. Calm, plain, concrete. It respects that the user is wary, and it earns trust by being specific rather than enthusiastic.

Four voice commitments (the first three carried from V1; the fourth is new for Phase 2):
- **Peer, not platform.** A founder is a peer here, not an owner. Never address users as an audience ("we're excited to announce").
- **Concrete trust, never badges.** Say "3 people you trust vouch for them," never "verified" or "trusted member" as a label handed out.
- **Calm about danger.** An impersonator is described, not alarmed about: "no one you trust vouches for them." No red warnings, no scare copy.
- **Calm about quiet, and never pulling.** A dormant circle is stated plainly ("Quiet lately. Last post 3 weeks ago"), never shamed or hyped. Copy never manufactures urgency to pull a user back. No "you have 5 unread", no "don't miss out", no "people are waiting for you".

## Language rules
- No AI-generated filler ("I'd be happy to help," "Great question," "Let's dive in," "That said," "It's worth noting").
- No declarative-negative constructions ("It's not just X, it's Y", "This isn't a delete button"). State the positive fact instead.
- No marketing superlatives without evidence ("seamless," "effortless," "revolutionary").
- No jargon without definition. Avoid protocol terms in user copy; say "circle," "what it takes to belong," "people who vouch for you."
- Active voice over passive.
- Short sentences. If a sentence has more than one comma, consider splitting it.
- Specific over vague ("14 members vouch for each other," not "well-established").
- Trust is point-of-view. Personal-view copy says "people **you** trust"; the house view says "established members" and is labeled as the house view. *(At launch the trust signal is the house view for everyone.)*

## UI copy patterns
- **Button labels:** verb + noun. "Create invite," "Retire circle," "Accept and create your identity," "Reply," "Post." Never "Submit."
- **Empty states:** name what will appear and how to start. "Nothing new. When someone vouches for you or a circle you're in gets active, it shows up here."
- **Loading states:** silent skeletons, no copy. Never a bare spinner.
- **Error messages:** what went wrong and what to do. "Couldn't create the invite. Retry?" Never "Something went wrong."
- **Confirmation messages:** confirm the outcome, not the click. "Your circle is live." "Posted to the circle." "Saved."
- **Sign-in / identity prompts:** state why, at the moment of acting. "Your identity is portable — it's how people vouch for you." (One em-dash as a genuine aside is acceptable; never as a default connective.)

## Phase 2 copy patterns (product-specific)

### Notifications and the new-marker
- The new-marker is a state, not a count: "new updates". Never a number engineered to create urgency.
- Notification lines are one plain sentence: "maya vouched for you in Sunset Hikers." "New posts in Code & Coffee."
- Preferences header states the stance: "Choose what you hear about. Everything here is off until you turn it on. You can turn any of it off again."
- Toggle labels are plain on/off, paired with the switch: "On" / "Off". Never rely on color.

### Cold-start: foothold invite and onboarding
- Invite framing is an act of personal trust: "Your invite vouches for them. They can join even if no one else here knows them yet."
- Issuer reminder, calm: "Your vouch stands behind this person."
- Onboarding names the inviter and the way in: "maya invited you into Sunset Hikers. Her vouch is your way in."
- The path forward is stated: "You'll start as a new member, and you belong more fully as people here get to know you."
- An expired invite gives a path, never a dead end: "This invite has expired. Ask whoever shared it for a new one."

### Founder standing (legible decay)
- State the concrete reality, founder-facing: "14 members now vouch for each other. The circle runs on its own trust, not on you."
- Just-founded: "It's just you so far. As people join and vouch for each other, your head start fades on purpose."
- Frame the fade as the point, not a loss. Never "you're losing control."

### Caretaking: retire a circle
- Frame retirement as a community act: "Retiring asks the people who vouched here to release it."
- State what happens plainly and positively: "A retired circle stops appearing in discovery. Its history stays on the network. Nothing is erased."
- Confirm step restates the outcome: "Retire Sunset Hikers? It will stop appearing in discovery. Its posts and history stay on the network."
- Retired view: "This circle has been retired. Its history is still here."

### Signs of life
- Active: "Active today · 6 posts this week." Quiet: "Quiet lately · last post 3 weeks ago." New: "New circle · founded today."
- Concrete counts and dates only. No "hot," "trending," or "popular."

### Degraded posting (trust source unreachable)
- State the situation and what the user can still do: "We can't reach the trust network right now, so we can't confirm membership. You can still post."
- Never an error tone. This keeps the room open; it does not report a failure.

## Forbidden phrases
Base list in `product-team/guardrails/language.md` applies in full. Carried from V1 and extended for Phase 2:

- "Verified" / any badge-style label of legitimacy.
- "Admin," "moderator," "owner" to describe a person's power over a circle. A founder is a peer.
- "Members only" gating language implying an authority's permission. Belonging is earned, not granted.
- "Join now," "Sign up free," and acquisition-funnel copy.
- Scare copy about impersonators ("Warning: this account may be fake").
- Protocol vocabulary in user-facing text ("declaration," "inherit-from," "vouch tag," kind numbers, "GrapeRank").
- **New for Phase 2 — urgency and capture copy:** unread counts as pressure ("5 unread"), FOMO ("don't miss out," "people are waiting"), nags to enable notifications, "turn on everything," and any "delete" framing for retiring a circle (it is released by the people who vouched, and history is kept).
- **New for Phase 2 — owner framing for caretaking:** copy that implies one person can unilaterally remove the circle or its people.
