# Discovery Brief: Communities

**Slug:** communities
**Date:** 2026-06-05
**Strategist phase:** Discovery (Phase 1)

## Problem statement

Every online community a person joins is owned by someone else. A single owner (or the platform beneath them) can rename it, ban people, delete it overnight, sell it, or quietly be captured — and the members have no recourse and no way to leave with the group intact. Belonging is granted and revoked by an authority rather than earned among peers, newcomers can't tell a real member from an impersonator, and a community that outgrows or disagrees with its founder cannot split and continue on its own terms. People want durable places to belong with others they trust; what they get are spaces they rent from a landlord who can change the locks.

## User landscape

- **The founder / convener** — starts a group on Discord, a Facebook/WhatsApp group, a Circle/Geneva/Slack, or a subreddit. Today they shoulder all the governance: approving members, policing impersonators, moderating, and being the single point of failure and control. The pain: it's exhausting and unaccountable — they hold power they often don't want, and if they burn out or turn bad, the group has no continuity without them.
- **The member who belongs** — joins to be among people who share an interest or values. Today their standing is an opaque admin decision and their identity is per-platform. The pain: they can be removed without appeal, they can't prove "the people here vouch for me" anywhere else, and the group they invested in can vanish or be taken over.
- **The newcomer / the wary** — wants to join the *real* group and avoid scams and impersonators. Today they rely on follower counts, blue checks, or gut feel. The pain: no trustworthy signal of who actually belongs vs. who's faking it.
- **The dissenter / would-be forker** — disagrees with how a community is run and wants to take the part that agrees with them and continue. Today their only option is "start from zero" and beg people to re-join. The pain: there is no way to fork a community and carry its membership and norms forward.

## Competitive landscape

- **Discord / Slack / Circle / Geneva** — feature-rich group spaces, but each has a **single owner/admin tier with absolute power** and lives on a platform that owns the data. Structural reason they can't solve it: governance is centralized by design and identity is non-portable — the group cannot outlive, constrain, or fork away from its owner or its host.
- **Facebook Groups / WhatsApp / Reddit** — large reach, but the **platform** is the ultimate authority (it can remove the group, the admin, or the member), and membership/identity never leave the walled garden. Structural reason: the host is the landlord; members are tenants with no ownership and no exit-with-continuity.
- **Mailing lists / forums (Discourse, etc.)** — more self-hostable, but still **admin-controlled rosters** and **server-bound identity**; trust is "the admin let you in," not "the people here vouch for you." Structural reason: membership is a list someone edits, not an emergent property of who-trusts-whom, so it can't be portable, forkable, or impersonation-resistant.
- **Token-gated / DAO communities** — attempt decentralization, but typically reduce belonging to **holding an asset** and governance to **token-weighted voting**, which is buyable and sybil-prone. Structural reason: money is the membership signal, so trust and belonging aren't actually what's measured.

The common structural failure across all of them: **membership is a list an authority controls, and identity is owned by the host** — so communities can't be leaderless, portable, impersonation-resistant, or forkable.

## Opportunity

The insight: a community doesn't need an owner if **belonging is computed from who-vouches-for-whom** rather than granted by an admin, and if **identity and trust are portable** rather than host-owned. Then a community becomes a definition anyone can stand on (or fork), and its membership becomes an emergent, per-person view of "the people my web of trust agrees belong here" — no central roster, no rug-pull, no single point of capture, impersonators carry no weight because no one trusted vouches for them.

**Why now:** the underlying portable-identity and web-of-trust machinery (the layer Brainstorm/Tapestry already builds — trust scoring across a social graph) now exists, which is the missing piece every prior attempt lacked. **Why this team:** Brainstorm's whole reason for being is computing trust over a decentralized social graph; communities are the natural, high-value application of that capability, and a community surface already exists to evolve.

## Constraints

- **Budget:** Internal build on existing Brainstorm/Tapestry infrastructure; no separate budget identified. Confirm.
- **Timeline:** No hard external date. A foundational identity/trust dependency is mid-integration (see Open Questions #1), which paces the trust-based-membership piece.
- **Team:** Small; spans the community surface and the underlying trust/identity layer (more than one owner across that boundary — coordination is required).
- **Technical:** Built on Tapestry / Nostr (decentralized, no central server-of-record) and Brainstorm's web-of-trust scoring. This is the operating envelope, not a solution choice.
- **Regulatory:** Decentralized/no-central-authority posture has content-moderation and liability implications worth a deliberate stance; not yet examined.

## Open questions

1. The trust-based-membership capability depends on a portable per-person trust/identity primitive that is **mid-integration across teams** — the membership experience can't fully ship until that lands. How firm is that dependency's timing, and what can ship independent of it?
2. An existing community surface already runs on a simpler, owner-style model. Is the goal to **evolve** that surface into the trust-based model, or run them in parallel during transition?
3. What is the smallest version of "belonging earned by trust" that delivers real user value — is the v1 a *single* community done right, or the *forking/standing-on-a-definition* mechanic from day one?
4. Moderation/safety without a central admin: when the answer to "who belongs" is emergent and per-person, what is the user-facing story for handling bad actors and harmful content?
5. Who is the v1 primary user — a founder convening a new circle, or a member trying to find and join the real one?
