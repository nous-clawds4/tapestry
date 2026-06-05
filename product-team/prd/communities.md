# Communities — Product Requirements Document

**Slug:** communities
**Date:** 2026-06-05
**Status:** Draft
**Companion guides:** `guides/communities-style-guide.md`, `guides/communities-design-guide.md`

> Self-contained. A reader understands the product without opening the phase artifacts.

## 1. Product Vision

Every online community a person joins is owned by someone else. One owner, or the platform beneath them, can rename it, ban people, delete it overnight, sell it, or be captured. Members have no recourse and no way to leave with the group intact.

Communities makes a different bargain. A community here is a *definition* that anyone can stand on, and belonging is *earned among peers* rather than granted by an authority. There is no owner to rug-pull. Membership becomes a per-person view of "the people my web of trust agrees belong here," so impersonators carry no weight and a group can outlive, or fork away from, whoever started it.

The insight that makes this viable now: the portable identity and web-of-trust scoring that every prior attempt lacked already exists in the Brainstorm platform. Communities is the natural application of that capability.

## 2. Positioning & Competitive Context

Discord, Slack, Circle, and Geneva give rich group spaces, but each has a single owner tier with absolute power and lives on a platform that owns the data. Facebook Groups, WhatsApp, and Reddit add reach, and make the platform the ultimate authority over the group, the admin, and the member. Forums (Discourse and kin) are more self-hostable and still run on admin-controlled rosters and server-bound identity. Token-gated and DAO communities attempt decentralization and reduce belonging to holding an asset, which is buyable and sybil-prone.

The structural failure common to all of them: membership is a list an authority controls, and identity is owned by the host. That single fact is why none of them can be leaderless, portable, impersonation-resistant, or forkable.

Communities' structural advantage: belonging is computed from who-vouches-for-whom over portable trust. No central roster exists to capture, and identity travels with the person.

## 3. User Personas

**The Convener (primary).** Gathers people and feels responsible for them, without wanting to rule them. Goal: convene a circle that can outlive them and resist capture, including by themselves. Core loop: define the circle, seed it by vouching in a few trusted people, tend norms as a peer, then fork or step back when needed. Friction: becoming an unaccountable admin, a platform that can seize the circle, no way to split without losing everyone, impersonators diluting the group.

**The Belonger (primary, served in Phase 2).** An active member who participates and vouches for others, and who collectively *is* the governance. Goal: belong durably among trusted peers, with belonging that is portable and theirs. Core loop: participate, vouch for newcomers they trust, deepen their own standing as trusted people vouch for them, shape who else belongs. Friction: removable by one admin, group dies if the founder leaves, standing evaporates across apps, a bad actor's dispute counting as much as a trusted vouch.

**The Newcomer (secondary).** Evaluating whether and how to join, wary of scams. Goal: find the real circle, tell members from impersonators, join honestly. Core loop: discover circles, assess who is inside and whether they trust those people, earn vouches, cross into belonging. Friction: cannot tell real from fake, a join process that is either a closed door or a free-for-all, investing effort then getting ghosted.

## 4. User Journeys

**Convener.** A founder frustrated that their group is owned by a platform lands on Communities and browses circles without signing in. They see circles with no owner and membership shown as people vouching for people. They sign in to declare their own circle, describing its purpose and what it takes to belong. They seed it by vouching in a few people they trust. Newcomers arrive, and members' vouches admit them, so the convener participates as a peer rather than a gatekeeper. When the circle grows or disagrees, they fork its definition and carry forward the people who agree, or they step back and the circle continues without them.

**Newcomer.** Searching for a circle around an interest, a brand-new visitor opens one without signing in. They see who belongs and how many people they already trust are inside. Real members are legible, and an impersonator visibly carries no weight because no trusted person vouches for them. The visitor signs in, introduces themselves, and earns vouches from trusted members until they cross into membership, then begins participating and vouching themselves.

## 5. Feature Specification

### 5.1 Discover
- **Purpose:** let anyone find circles and read their trust signal before any account exists.
- **Content:** a search field, and a grid of circle cards. Each card shows the circle name, a one-line purpose, topic chips, and the trust signal.
- **Behavior:** fully usable signed out. The trust signal shows a house view ("128 established members") with a prompt to sign in for the personal view. Loading shows card skeletons. An empty grid invites founding the first circle. A fetch failure shows a retry.
- **Actions (logged-in users):** open a circle, start a new circle.

### 5.2 Circle detail
- **Purpose:** show what a circle is, who belongs (with trust legible), and its conversation.
- **Content:** the circle's purpose and its belonging-bar as plain prose. If the circle stands on another, a "Based on ‹parent circle›" link. A people list with per-person trust legibility. The conversation. A fork action.
- **Behavior:** read-only to everyone. Signed in, the trust signal personalizes to "N people you trust are inside," each member row carries a trusted/untrusted label paired with a color cue, and an impersonator shows "no one you trust vouches for them." If the trust network is unreachable, the page shows names without the signal and offers retry.
- **Actions (logged-in users):** post to the conversation, fork the circle. (Joining and vouching arrive in Phase 2.)

### 5.3 Found a circle
- **Purpose:** let a convener declare a circle as a definition.
- **Content:** a short stepper: name, purpose, belonging-bar, review.
- **Behavior:** the belonging-bar is the circle's rule stated in plain language, not a member list. Sign-in is requested only at the final publish step, and typed state is preserved across it. Publish errors are specific.
- **Actions (logged-in users):** publish the circle, which lands the founder in it.

### 5.4 Fork a circle
- **Purpose:** let anyone stand on an existing circle's definition with their own changes.
- **Content:** the same stepper, pre-filled from the parent circle's resolved definition, every field marked "inherited — edit to override," with a persistent "Based on ‹parent›" banner.
- **Behavior:** editing a field overrides only that field; unedited fields stay linked to the parent and update if the parent updates. Sign-in is requested at publish.
- **Actions (logged-in users):** publish the forked circle.

### 5.5 Sign-in prompt
- **Purpose:** request identity at the moment of acting, never as a wall on arrival.
- **Content:** a short explanation that identity is portable and is how people vouch for you.
- **Behavior:** appears inline when a signed-out user tries to found, fork, or post. Preserves the user's in-progress state. Errors are specific ("We couldn't reach the network. Try again?", "Signing cancelled.").

## 6. Data Model

- **Circle** — a community expressed as a stated definition (name, purpose, belonging-bar, founder, topics, optional parent). Maps to the existing `brainstorm-community` concept, evolving from an owner/signal shape to a definition-bearing one. The founder is a peer, not an owner.
- **Person** — an identity that founds, forks, participates, and (Phase 2) belongs. Maps to the existing `nostr-user` concept (portable public-key identity, with display name and picture from their profile).
- **Post** — a message scoped to a circle (author, circle, body, time). A standard note primitive; no dedicated concept.
- **Trust Signal** — a per-viewer, derived measure of how much a viewer's web of trust vouches for a person. Maps to the existing `web-of-trust` / `graperank` capability. Never absolute; always relative to a point of view.
- **Resolved Definition** — a circle's effective definition after following its parent chain and applying the child's overrides. Newly established protocol substrate; computed, not stored.

**Relationships:** Person founds Circle. Circle stands on Circle (child to parent). Person posts in Circle. Person trusts Person (per-viewer). Resolved Definition derives from a Circle and its parent chain.

**Lifecycle:** a Circle moves drafted → declared (live) → optionally forked-from or stepped-back-from, and it persists after its founder steps back. A Post moves composed → published. Membership states (applicant → member) belong to Phase 2.

## 7. Trust System Architecture

Trust is the spine of the product, and it is always point-of-view relative. The platform's existing web-of-trust scoring (`web-of-trust` / `graperank`) computes, for a given viewer, how strongly that viewer's network vouches for any person.

Two behaviors are load-bearing:

1. **Read-only, pre-account legibility.** A brand-new visitor with no identity must still see a meaningful trust signal. Before sign-in, the signal uses a house point of view and is labeled as such. After sign-in, it re-resolves to the viewer's personal point of view.
2. **Weightless untrusted assertions.** An impersonator gains no standing because no trusted person vouches for them, and a bad actor's dispute carries little weight when it comes from outside the viewer's trust. The interface conveys this calmly, with a plain label rather than an alarm.

The full trust-based *membership* engine (earning belonging through trusted vouches, the applicant-to-member roster, weightless disputes computed per viewer) depends on a portable trust assertion capability that is mid-integration across teams. The MVP therefore reads the trust signal and defers the write-side membership engine to Phase 2.

## 8. Scope Boundaries

### 8.1 In Scope (must ship)
- Found a circle by declaring its definition.
- Stand on / fork another circle's definition with overrides.
- Read-only discovery and trust signal, working with no account.
- Sign in with a portable identity (to found, fork, or post).
- Participate (post) in a circle.
- A circle persists when its founder steps back.

### 8.2 Stretch
- Personalized discovery ranking by the viewer's trust.
- Founder edit of a forked circle's inherited fields after publish.

### 8.3 Out of Scope (Phase 2+)
- Trust-based membership: join, vouch, the per-viewer roster, applicant → member, weightless disputes (Phase 2; gated on the trust-assertion capability landing on the mainline).
- Cold-start first-vouch path for true outsiders (Phase 2).
- Portable belonging across surfaces (Phase 3).
- Emergent canonical community via converging rosters (Phase 3).
- Moderation and safety stance without a central admin (Phase 3).
- Retiring the interim owner-style membership in the existing surface (Phase 2).

## 9. Phase Roadmap
- **MVP — "A circle is a definition you can stand on, fork, read the trust of, and talk in."** Serves the Convener fully and the Newcomer's first visit. Ships on already-ratified, unblocked capability.
- **Phase 2 — "Belonging earned by trust."** Join, vouch, the trust-weighted per-viewer roster, applicant → member, weightless disputes, and the cold-start first-vouch path. Begins when the trust-assertion membership capability lands on the mainline. Retires the interim membership.
- **Phase 3 — "Emergent and portable."** Convergent canonical communities, portable belonging across surfaces, and the no-central-admin moderation stance.

## 10. Success Metrics
Observable by inspection. Timeframes are placeholders to confirm.

- At least 3 circles founded by 3 distinct conveners within 2 weeks of launch.
- At least 1 circle that was forked from another's definition exists.
- A person with no account can open any circle and see its members and a trust signal.
- At least 1 circle shows active posts.
- A founder can step back and the circle stays usable.
- Phase 2: at least 1 member admitted purely through earned vouches with zero admin action; a known impersonator visibly accrues no standing from a typical viewer's point of view.

## 11. Open Questions

1. **Membership dependency timing.** The trust-assertion capability that Phase 2 needs is mid-integration across teams. Decision: hold Phase 2 until it lands on the mainline, versus build Phase 2 against it on a shared branch and merge later. Options carry different coordination risk.
2. **Transition of the existing surface.** A simpler owner-style community surface already runs. Decision: evolve it in place into the definition-bearing model, versus run both in parallel during the transition. Recommendation leans parallel to avoid a hard cutover.
3. **Cold-start first vouch.** A genuine outsider with no trust connections may never earn a first vouch. Decision for Phase 2: founder-granted initial vouches, time-bounded provisional standing, or an invite link that carries a vouch. Options to be evaluated when Phase 2 is scoped.
4. **Moderation without a central admin.** When "who belongs" is emergent and per-viewer, the harmful-content and bad-actor story needs a deliberate stance. Decision deferred to Phase 3; flagged now because it affects launch communications.
5. **MVP posting gate.** With trust-based membership in Phase 2, MVP posting needs an interim gate. Decision: open posting to any signed-in viewer of a circle, versus restrict to the founder's seeded people. Options trade reach against early spam exposure.
