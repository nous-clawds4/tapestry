# Discovery Brief: Communities (Phase 2)

**Slug:** communities-v2
**Date:** 2026-06-06
**Strategist phase:** Discovery (Phase 1, second product cycle)
**Builds on:** `product-team/discoveries/communities.md` (V1, immutable)
**Return edge read:** `engineering-team/audits/communities/audit.md`, `engineering-team/audits/communities/prd-addendum.md`

## What shipped, and the shape of what didn't

V1 proved the radical claim: a community can exist without an owner. A circle is a declaration anyone can found, read, and fork; belonging is computed from who-vouches-for-whom rather than granted by an admin. That thesis held up in code.

What V1 left undone is not a scatter of unrelated gaps. It is one shape: **V1 built the skeleton of belonging but not the life inside it.** A founded circle is a quiet room. There are no replies, no reactions, no notifications, no member faces, no way to find the living circles among the dead ones. The trust-membership surface that would let people in is built but dark in production. And a true outsider, the person with no connections, has no way to earn a first foothold. The user V1's own brief named as "the newcomer / the wary" is the one V1 serves least.

## Problem statement

A founder declares a circle and lands in an empty room. Nothing happens in it, no one can feel who else is there, nothing pulls anyone back, and a newcomer cannot tell it apart from an abandoned one or get inside if they have no existing trust. The founder has the conviction to start a place but no honest way to make it live, because the platforms that make communities live (notifications, rosters, moderation, invites) do it through an owner with admin power, and that is the exact thing this product set out to abolish. The problem for Phase 2: **let a founder grow a quiet circle into a living one without becoming the owner the model rejects.**

## User landscape

The personas carry forward from V1; Phase 2 re-centers them around the founder's "make it live" arc.

- **The Convener (PRIMARY for Phase 2)** — founded a circle and is now watching it sit silent. Today their only workaround is to fall back to a Discord or a group chat to actually gather people, then point at the circle as a static artifact. The pain: they have a place that exists but does not breathe, and no honest lever to grow it that does not hand them owner powers they came here to avoid.
- **The Newcomer / the wary** — arrives at a circle and cannot tell if it is alive, cannot see who belongs (the roster is dark), and if they have no existing connections cannot get in at all. Today they fall back to follower counts and gut feel, the exact signals V1 promised to replace. The pain: the door is locked from the inside, and the room behind it looks empty even when it is not.
- **The Belonger** — inside a circle but cannot do the ordinary social things that make belonging feel real: reply, react, see who else is here, learn that someone vouched for them. Today they route around the circle to other tools. The pain: belonging is asserted in the trust graph but not *felt* in the room.

## Competitive landscape

The V1 competitive analysis stands (Discord, Slack, Circle, Facebook/WhatsApp/Reddit, Discourse, token-gated DAOs; the common structural failure is that membership is a list an authority controls and identity is owned by the host). Phase 2 sharpens it to the specific machinery of aliveness:

- **The aliveness machinery itself is owned-platform machinery.** Notifications, activity feeds, member directories, and moderation queues are how Discord and Facebook make a community feel alive, and every one of them runs through an admin tier and a host that owns the data and the attention. The structural trap: the obvious way to make a circle live is to copy that machinery, which would reintroduce the owner and the engagement-extraction loop we exist to reject. Phase 2 has to invent versions of these that serve belonging instead of capture, with no admin and no host-owned attention.
- **Cold-start is unsolved precisely because trust is the gate.** Token-gated communities "solve" newcomer entry by selling entry; owned platforms solve it by an admin clicking approve. A trust-derived community cannot do either without betraying its model, so the first foothold for an unconnected outsider is a genuinely novel problem, not a borrowed one.
- **Caretaking without an admin has no incumbent answer.** Retiring a dead circle, handling a bad actor, resolving a dispute: every existing product does these with owner or platform power. There is no off-the-shelf pattern for doing them as a trust-weighted community act.

## Opportunity

The insight: the things that make a community feel alive can be rebuilt on the trust graph instead of on an owner. A roster, a notification, an invite, a moderation signal, a "this circle is active" badge can each be derived from who-trusts-whom rather than granted by an admin. The founder becomes a **privileged peer whose head start decays**: they can seed the first members and their invite can carry a vouch, but that special standing fades as the trust graph fills in, and caretaking (retiring, moderating, resolving disputes) is a trust-weighted community act rather than a founder button. This is the resolution of the central tension: a founder can be a powerful first-mover without becoming an owner.

**Why now:** V1 shipped the trust-membership substrate; the only blocker to turning it on is deployment config and one cross-team dependency landing in production. The hard architecture exists. **Why this team:** computing trust over a decentralized social graph is Brainstorm's reason for being, and "make a community live on trust instead of on an owner" is the highest-value expression of that capability. Phase 2 is the version meant to go public.

## Constraints

- **Budget:** Internal build on existing Brainstorm/Tapestry infrastructure. No separate budget identified.
- **Timeline:** No hard external date, but Phase 2 is gated by an ops/deploy step and a cross-team dependency. The trust-membership surface stays dark in production until `VITE_PROFILE_API_BASE`, `VITE_TAG_RELAY`, CORS for `/api/profile-tags/*`, and a house web-of-trust threshold are configured, and until the tag core (PR #246) is promoted from staging to prod. A known posting-lock follows from this and is folded into Phase 2 scope. Cross-team asks sit with Vinney (a `selfApplied` flag, tag-core promotion, dual-publish relay URL) and ops/David (the env and CORS config).
- **Team:** Small; spans the communities surface and the underlying trust/identity layer, so the founder-head-start-decay and cold-start mechanisms require coordination across that boundary, not a one-team decision.
- **Technical:** Tapestry / Nostr (decentralized, no central server-of-record) and Brainstorm's web-of-trust scoring. The app reads trust and membership from brainstorm.world's engine cross-origin; it does not recompute trust (app-as-consumer). Two community models coexist (frozen bespoke kind-39999 and the new Community Declaration kind-39998) via a strangler migration.
- **Regulatory:** A public launch raises the content-moderation and liability stance that V1 deferred. "Who handles harmful content when there is no admin" moves from theoretical to launch-blocking. Needs a deliberate position, not yet examined.

## Anchoring decisions (settled in this discovery)

1. **Primary user for Phase 2:** the Convener (founder of a quiet circle). The spine is "I founded it, now make it live."
2. **Scope of "alive":** all four felt deadnesses are in play — nothing happens (no replies/reactions/live updates), you cannot feel the people (no profiles/directory), no reason to return (no notifications), hard to find the good ones (thin discovery).
3. **Founder power model:** privileged peer whose head start decays as the trust graph fills in. No permanent admin powers; caretaking is a trust-weighted community act.
4. **Ambition bar:** the launchable version. Phase 2 is what gets put in front of the public as Brainstorm Communities.

## Open questions

Carried into later phases (scope, domain, design). Several map to the addendum's "open questions for product" and the carry-forward register.

1. **Cold-start mechanism.** Given the founder-head-start-decays model, which concrete mechanism gives a true outsider their first foothold: a founder-granted initial vouch, time-bounded provisional standing, or an invite link that carries a vouch? (Addendum Q1; ADR 0030 Q#3.) The founder-centric framing biases toward invite-carries-a-vouch, to be validated in scope.
2. **How does the head start actually decay?** What is the user-visible rule by which a founder's special standing fades — a member-count threshold, elapsed time, a trust-density measure? This is the mechanism that keeps the founder from becoming an owner and needs a legible definition.
3. **Aliveness without extraction.** Which "alive" mechanisms (replies, reactions, notifications, activity signals, directory) serve belonging, and how do we shape them so they do not become the attention-capture loop of owned platforms? Which, if any, do we deliberately leave out? **Guiding principle (set in discovery): every aliveness mechanism must honour user sovereignty.** The operational test is who controls the loop: the user owns their attention (they pull and configure it, it is not scheduled at them), their data, and their exit. A mechanism that quietly takes back any of those three is the owned-platform pattern in disguise and does not ship. Later phases apply this test feature by feature.
4. **Caretaking as a community act.** What are the trust-weighted mechanisms for retiring a circle, handling a bad actor, and resolving a dispute, with no admin button? This subsumes the immediate need to retire three legacy test circles and the larger moderation-for-launch stance (addendum Q4 territory; V1 open question #4).
5. **Default belonging threshold.** Is the product default 1 vouch (open) or 2+ (safer space), and is it founder-configurable at declaration time? (Addendum Q2; ADR 0030 Q#4.)
6. **Founder auto-belong.** Ratify founder-auto-self-tag-on-founding as intended product behavior, or keep founding and belonging as separate acts? (Addendum Q3.)
7. **House vs. personal trust view at launch.** Is showing everyone the house point-of-view acceptable for a public launch, or is per-viewer trust a launch blocker? (Addendum Q4.)
8. **Bespoke circles.** Leave the frozen owner-style circles indefinitely, or commit to a migration path into the trust model? (Addendum Q5.) Includes the question of whether legacy-circle removal is a one-off cleanup or a reusable "retire a circle" capability.
9. **Two-sided dependency timing.** Which Phase 2 value can ship before the ops config and tag-core promotion land, and what is strictly blocked until they do? (Mirrors V1 open question #1, now concrete.)
