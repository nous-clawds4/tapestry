# Brainstorm Communities (Phase 2) — Product Requirements Document

**Slug:** communities-v2
**Date:** 2026-06-06
**Status:** Draft
**Companion guides:** `guides/communities-v2-style-guide.md`, `guides/communities-v2-design-guide.md` (which extends `guides/communities-design-guide.md`)
**Supersedes for Phase 2 scope:** stands beside `prd/communities.md` (V1, immutable). V1 shipped the skeleton; this document specifies the launchable version.

> Self-contained. A reader understands Phase 2 without opening the phase artifacts or the V1 PRD. No implementation detail in the feature and data sections; the app-as-consumer architecture is described in §7.

## 1. Product Vision

Every online community a person joins is owned by someone else, and that owner (or the platform beneath them) can rename it, ban people, delete it, sell it, or be captured, with no recourse for the members. Brainstorm Communities removes the owner: a community is a stated definition anyone can found, read, fork, and belong to, where belonging is computed from who-vouches-for-whom rather than granted by an admin.

The first build proved that claim in code. A circle can exist with no owner: it can be founded, read, forked, and posted to, and membership is derived from trusted vouches rather than an admin's list. What it could not yet do is **live**. A founded circle was a quiet room: no replies, no reactions, no notifications, no faces, no way for a visitor to tell a living circle from an abandoned one, and no way for a true outsider with no connections to get in at all.

Phase 2 closes that gap. The vision for this release: **let a founder grow a quiet circle into a living one without becoming the owner the model rejects.** A founder can seed the first members, extend a foothold to a true outsider, and generate the first signs of life, and as the circle's own trust fills in, the founder's head start visibly fades. The everyday social texture that makes a community feel alive (conversation, reactions, awareness of what happened) is rebuilt on the trust graph and on the member's own terms, never on an owner and never through attention-capture. This is the release meant to go in front of the public as Brainstorm Communities.

## 2. Positioning & Competitive Context

The communities people use today fail for one structural reason: **membership is a list an authority controls, and identity is owned by the host.** Discord, Slack, Circle, and Geneva each have a single owner/admin tier with absolute power and live on a platform that owns the data. Facebook Groups, WhatsApp, and Reddit make the platform itself the ultimate authority. Forums and mailing lists are more self-hostable but still rest on admin-controlled rosters and server-bound identity. Token-gated communities reduce belonging to holding an asset, which is buyable and sybil-prone. None can be leaderless, portable, impersonation-resistant, or forkable.

Phase 2 sharpens the positioning to the specific machinery of aliveness:

- **The aliveness machinery itself is owned-platform machinery.** Notifications, activity feeds, member directories, and moderation queues are how incumbents make a community feel alive, and each runs through an admin tier and a host that owns the attention. The obvious way to make a circle live is to copy that machinery, which would reintroduce the owner and the attention-extraction loop. Brainstorm Communities rebuilds each of these on the trust graph, with no admin and no host-owned attention. This is the differentiator: a community that *feels* alive without anyone owning it or capturing its members.
- **Cold-start is unsolved precisely because trust is the gate.** Token communities sell entry; owned platforms approve it. A trust-derived community can do neither without betraying its model, so giving a true outsider a first foothold is a genuinely new capability rather than a borrowed one.
- **Caretaking without an admin has no incumbent answer.** Retiring a dead circle and handling a bad actor are done everywhere else with owner or platform power. Phase 2 ships the minimum (retire a circle as a trust-consistent act) and commits to a deliberate, fuller stance later.

**Structural advantage:** the underlying portable-identity and web-of-trust machinery already exists in the Brainstorm/Tapestry platform, which is the missing piece every prior attempt lacked. Computing trust over a decentralized social graph is this team's reason for being; communities are the highest-value application of it.

## 3. User Personas

### The Convener (primary)
The person who gathers people. They have done the brave part (declared a circle) and now stand in an empty room they made. They want to make it live without becoming its owner, having fled the platforms where activating a community meant becoming its admin.
- **Goal:** grow a quiet circle into a living one that can outlive them and cannot be rug-pulled, including by themselves.
- **Core loop:** declare the circle → seed people they trust → reach beyond their own network so an outsider can get a foothold → generate the first signs of life → watch their head start fade as the circle's trust fills in → tend as a peer, caretaking as a community act → fork or step back, the circle surviving either.
- **Friction / won't tolerate:** permanent founder power (the owner trap); being dropped at zero with no head start (cold-start wall); making the room feel alive only by importing attention-capture; a circle that stays a correct, dead artifact; being unable to clean up a circle without seizing owner power.

### The Newcomer (primary)
Someone evaluating whether and how to join, who splits into two cases the product serves differently: the **connected newcomer** already in the broad web of trust (served by the first build via "I'm in"), and the **true outsider** who trusts no one and is trusted by no one (served not at all today). Both are wary of impersonators, and both now also ask: is this circle even alive?
- **Goal:** find a real, living circle, tell real members from impersonators, and earn a legitimate first foothold even starting with no connections.
- **Core loop:** discover circles → read whether a circle is alive and who is inside → for the outsider, get a first foothold that does not require pre-existing trust → introduce themselves and earn vouches → cross into belonging.
- **Friction / won't tolerate:** a circle that looks abandoned with no way to tell; the cold-start wall as a dead end; a foothold that is just the old admin-approval queue renamed; joining and staying invisible.
- **Why primary in Phase 2:** cold-start is the Convener's growth engine seen from the other side. A founder cannot grow past their own network unless an outsider can get in.

### The Belonger (secondary)
An active member who shows up, contributes, and vouches. The first build made their belonging *true* in the trust graph; Phase 2 makes it *felt* in the room. The gap they feel: membership real in data, invisible in experience.
- **Goal:** belong durably among people they trust, and experience that belonging as a living, legible thing.
- **Core loop:** participate (reply, react) → learn when something involving them happens, on terms they control → see who else is here → standing deepens as trusted people vouch → vouch for newcomers, shaping who belongs.
- **Friction / won't tolerate:** belonging that is real in data but dead in experience; being pulled back by attention-capture (a notification they did not ask for, cannot configure, or cannot turn off); a meaningless vouch; losing the group or their standing if the founder leaves or they switch apps.

## 4. User Journeys

### Primary journey — the Convener: empty room to living circle
1. **The empty room (just founded).** They look at their own circle, alone. The circle reads as freshly born and ready, with a clear first thing to do, not a silent void that looks like failure. *Proud but exposed.*
2. **Seed the people they trust.** They bring in a few people they already trust by vouching for them; the circle gains its first members with no approval queue. The founder's head start lets them seed standing a brand-new member could not yet earn alone. *Empowered.*
3. **Reach beyond their own trust (cold-start).** They bring in someone who trusts no one yet, through a foothold that does not require that person to already be trusted (working assumption: an invite that carries a vouch). The outsider gets in because the founder extended it, not because an admin approved a queue. *Relieved that growth is possible without gatekeeping.*
4. **Generate the first signs of life.** They post; members reply and react; activity accumulates. The circle starts to read as alive to a visitor. Members can be reached when something involving them happens, on terms they control. *Encouraged.*
5. **The head start decays.** As the circle's internal trust fills in, the system quietly reduces the founder's elevated standing toward that of any peer, and the founder can see this on a legible rule. *A complicated relief: letting go is the point, and the product proves it meant it.*
6. **Tend as a peer, including caretaking.** They participate and vouch like any member; caretaking (handling a bad actor, retiring a circle) happens as trust-weighted community acts, not founder buttons. *Lighter.*
7. **Fork or step back.** They fork the definition carrying forward the people who agree, or step back; the circle survives either. *Free.*

### Supporting journey — the Newcomer (true outsider): the cold-start foothold
1. **First encounter (no account).** Browse circles read-only. 2. **Read whether the circle is alive (no account).** Tell a living circle from a dormant one and read the house trust signal for who belongs; impersonators carry no weight. 3. **Hit the trust wall.** They trust no one and no one trusts them; the wall is presented as a path, not a dead end. 4. **Earn a first foothold.** A founder or member extends entry that does not require pre-existing trust; they accept and create a portable identity. 5. **Cross into belonging.** They participate, accumulate vouches, become a Belonger.

### Supporting journey — the Belonger: belonging that is felt
1. **Arrive inside.** The room reads as a place with people and activity. 2. **Participate.** Post, reply, react; the room responds. 3. **Learn that something involving them happened**, only in ways they pulled and configured. 4. **Standing deepens** as trusted people vouch. 5. **Vouch for others**; their vouch visibly matters.

## 5. Feature Specification

All screens build on the existing Communities visual identity and components. Every screen has a designed empty, loading, and error state per the design guide. Read-only surfaces render with no account.

### 5.1 Circle detail — alive (conversation, reactions, live updates, signs of life)
- **Purpose:** turn a circle's conversation from a flat post list into a room that reads as alive. *(Convener journey 4; Belonger journey 2; Newcomer journey 2.)*
- **Content:** the circle definition (carried from the first build); a conversation of posts with one level of threaded replies; an honest reaction row under each post showing exact, un-inflated counts; a single "N new" affordance at the top of the conversation when new posts have arrived; a plain signs-of-life line ("Active today · 6 posts this week" or "Quiet lately · last post 3 weeks ago").
- **Behavior:** replying opens the composer inline, scoped to the parent post; reacting is a single toggle. New posts are **offered** behind the "N new" affordance the user taps, never injected into the view they are reading. The signs-of-life line renders read-only with no account, and is honest about quiet.
- **Actions (signed-in members):** post, reply, react. Posting follows the trust-based membership gate, with the degraded fallback below.

### 5.2 Posting when the trust source is unreachable (degraded state)
- **Purpose:** never let conversation die because the trust network is briefly unreachable, including for a founder in a brand-new circle. *(Convener journey 1 and 4; resolves the known posting-lock.)*
- **Content:** a calm note above the composer: the trust network can't be reached, membership can't be confirmed, and the person can still post.
- **Behavior:** when the trust/roster source is unreachable, the composer falls back to a signed-in gate rather than blocking. When the source recovers, the normal trust-based gate resumes and the note disappears. This degradation keeps the room open; it never reads as an error.

### 5.3 Foothold invite (extend a first foothold)
- **Purpose:** let a founder or member give a true outsider a legitimate way in. *(Convener journey 3; Newcomer journey 4.)*
- **Content:** an "Invite someone in" panel reached from the circle's People area, explaining plainly that the invite vouches for the person so they can join even if no one else knows them yet; an optional note; a "Create invite" action yielding a shareable link.
- **Behavior:** issuing an invite creates a vouch carried with the invite that activates when the recipient accepts. It is worded as a personal act of trust, not an approval, and reminds the issuer their vouch stands behind the person.
- **Actions (signed-in members):** create an invite, view invites issued.

### 5.4 Onboarding accept (the outsider's first foothold)
- **Purpose:** bring a true outsider in through a person's extended trust. *(Newcomer journey 4.)*
- **Content:** the screen an invited outsider lands on, naming who invited them and the circle in plain prose, then the portable-identity step; the path from "just arrived" to "fully belong" is stated.
- **Behavior:** accepting creates the person's portable identity and activates the carried vouch, so they enter through trust rather than approval. Intended state survives the identity step. An expired invite shows a path ("ask whoever shared it for a new one"), never a dead end.

### 5.5 Notification inbox (pulled awareness)
- **Purpose:** let a person learn what happened that involves them, without being pulled. *(Belonger journey 3; Convener and Newcomer benefit.)*
- **Content:** a calm list reached from a quiet new-marker in the nav (a small accent dot when there is something new, never a numeric count badge). Each item is one plain sentence with actor, occasion, circle, and relative time.
- **Behavior:** opening the inbox clears the new-marker; each item links to its source. Nothing auto-marks-urgent and nothing nags.

### 5.6 Notification preferences (the sovereignty control)
- **Purpose:** give the person full control over what may reach them. *(Belonger "won't tolerate" being pulled; the design's sovereignty principle.)*
- **Content:** a short list of occasions, each an independent labeled toggle: someone vouches for you, new posts in your circles, replies to you. A one-line header states that everything is off until turned on and can be turned off again.
- **Behavior:** every occasion is off or conservative by default and individually turn-off-able. There is no master "turn on everything" switch. Changes save immediately with a quiet confirmation. Toggle state is conveyed by position and an on/off text label, never color alone.

### 5.7 Founder standing (legible head-start decay)
- **Purpose:** make the no-owner promise inspectable to the founder. *(Convener journey 5; founder-only.)*
- **Content:** a quiet founder-only panel stating the current reality in concrete terms ("14 members now vouch for each other. The circle runs on its own trust, not on you.") with a simple proportion bar showing the founder's shrinking share of the circle's trust.
- **Behavior:** read-only and informational; no action attached. Just-founded copy explains the head start fades on purpose. If the figure can't load, the panel is hidden rather than shown broken (it is reassurance, not critical data).

### 5.8 Signs of life on discovery
- **Purpose:** let a visitor tell a living circle from a dormant one before signing in. *(Newcomer journey 2.)*
- **Content:** the signs-of-life line on each circle card, under the trust signal, in plain concrete terms.
- **Behavior:** renders read-only, honest about quiet, with no "hot"/urgency styling. A brand-new circle reads "New circle · founded today."

### 5.9 Retire a circle (caretaking)
- **Purpose:** let a circle be retired as a trust-consistent act, and clear the legacy test circles. *(Convener journey 6.)*
- **Content:** a "Retire this circle" surface in the circle's caretaking area, worded as a community act: retiring asks the people who vouched here to release it; a retired circle stops appearing in discovery; its history stays on the network and nothing is erased. A confirm step restates the outcome.
- **Behavior:** moves the circle to a retired state and drops it from discovery; direct links resolve to a clearly-marked retired view. Copy never implies one-person authority. This surface is used to remove the three legacy test circles.

### 5.10 Turn the lights on (production data-live) — release gate
- **Purpose:** make the already-built membership surface (roster, trust signal, vouch) show real data in production. *(Underpins every membership-dependent feature; a release gate, not a screen.)*
- **Behavior:** the membership/trust surface reads real rosters and trust signals on the production site rather than rendering empty. This depends on cross-team configuration and a platform-side promotion described in §7 and §11; until it lands, the membership surface stays dark and the degraded posting state (§5.2) governs conversation.

## 6. Data Model

The product knows about the following. Several are derived per viewer and never stored as a roster.

- **Circle** — a community expressed as a stated definition: name, purpose, a plain belonging-bar (a rule, not a list), founder (a peer, not an owner), topics, an optional parent it stands on, the membership tag(s) it claims, a belonging-threshold (how many trusted vouches it takes), and a lifecycle state (active or retired).
- **Person** — a portable identity that founds, forks, participates in, vouches within, and belongs to circles; carries a display name and picture from their profile.
- **Post** — a message in a circle's conversation: author, circle, body, time, and an optional in-reply-to another post (one level of threading).
- **Reaction** — a lightweight response a person attaches to a post: author, post, symbol, time.
- **Membership Assertion** — a signed statement that a person does or does not belong, against a circle's claimed tag. One shape unifies three acts by who-about-whom and polarity: a self-tag ("I'm in", about oneself), a vouch (positive, about another), and a dispute (negative, weightless when from a source the viewer does not trust).
- **Membership / Standing** *(derived, not stored)* — whether a person belongs to a circle from a viewer's point of view, computed from the assertions the viewer trusts. The rule: a person belongs when trusted vouches meet the belonging-threshold and exceed trusted disputes. **At launch the viewer is the house point of view** (per-viewer is a later phase). Lifecycle: outsider → applicant (self-applied but below the bar) → member. The applicant state exists in the model; surfacing applicants distinctly is deferred (§8.3).
- **Trust Signal** *(derived, not stored)* — how much a viewer's web of trust vouches for a person or stands behind a circle's roster; the house view at launch.
- **Founder Standing** *(derived, not stored)* — the founder's bounded share of a circle's trust, which diminishes as the circle's internal trust fills in, with a human-readable basis so the decay is inspectable.
- **Foothold Invite** — an entry a founder or member extends to an outsider that confers a first foothold without requiring pre-existing trust: issuer, circle, whether acceptance carries an initial vouch, an optional bound recipient, and a state (issued → accepted → expired). The exact mechanism is an open question (§11).
- **Notification** *(derived)* — a surfaced awareness that something involving a person happened (vouched for, replied to, new activity), with the occasion, the source it derives from, a time, and whether it has been seen.
- **Notification Preference** — a person's own rule for which occasions may reach them and how, each independently enabled, conservative by default.
- **Activity (signs of life)** *(derived)* — a legible indication a circle is alive: its most recent activity and recent volume.
- **Resolved Definition** *(derived)* — a circle's effective definition after following its parent chain and applying the child's overrides, including inherited claims and belonging-threshold.

**Relationships:** a Person founds a Circle; a Circle stands on / forks a Circle; a Circle claims a membership tag (many-to-many; the tag never points back); a Person posts in a Circle; a Post replies to a Post; a Person reacts to a Post; a Person asserts membership about a Person; Membership and Trust Signal derive from trusted assertions (house view at launch); Founder Standing derives from the founder relationship and the circle's internal trust; a Person extends a Foothold Invite to a Person; a Notification derives from an event for a Person, gated by that Person's preferences; Activity derives from a Circle's posts, reactions, and assertions; a Resolved Definition derives from a Circle and its parent chain.

**Lifecycle:** a Circle goes drafted → active → retired (and may be forked-from or stepped-back-from, persisting when its founder steps back). Membership goes outsider → applicant → member. Founder Standing goes privileged (seed) → decaying → peer. A Foothold Invite goes issued → accepted → expired.

## 7. Architecture notes (app-as-consumer trust)

The communities app **reads** trust and membership from the Brainstorm platform's trust-scoring engine; it does not recompute trust. This is a deliberate topology with a product consequence: the membership surface needs platform-side data and configuration to show anything, so "shipped to the branch" is not the same as "members see rosters."

Concept mapping for engineering: Circle, Person, Post, Reaction, and the trust-derived signals map to existing platform concepts (the community, user, event, and web-of-trust concepts). The membership tag and the membership assertion are **external concepts owned by the platform's tag engine**, consumed cross-origin. The stands-on/fork relationship and the Resolved Definition are platform substrate. The genuinely new product notions in this phase are the Foothold Invite, Notification and Notification Preference, Activity (signs of life), post threading, the retired circle state, and the legible founder-standing decay.

Two community models coexist by design: the frozen original owner-style circles and the new declaration-based circles run side by side, and existing circles are not auto-converted. Migration is deferred (§8.3).

## 8. Scope Boundaries

### 8.1 In scope (must ship)
1. Turn the lights on in production (the membership/trust surface shows real data) — release gate (§5.10).
2. Posting-lock graceful fallback (§5.2).
3. Cold-start foothold for a true outsider (§5.3) and the onboarding accept (§5.4).
4. Felt conversation: replies, reactions, and offered live updates (§5.1).
5. Sovereign notifications: the inbox (§5.5) and the preferences control (§5.6).
6. Signs of life, read-only (§5.1, §5.8).
7. Founder head-start decay, made legible (§5.7), and founder auto-belong ratified (§11).
8. Retire a circle (§5.9), used to clear the three legacy test circles.

### 8.2 Stretch
- Discovery-grid signs-of-life on every card (the line ships on detail and cards; richer per-card treatment can follow).
- A documented public stance on how harm is handled without an admin (the tooling is Phase 4; a written position is cheap and de-risks launch).

### 8.3 Out of scope (deferred, with phase)
- **Per-viewer "people you trust" trust signal** → Phase 3 (launch ships the house view; per-viewer needs cross-team point-of-view provisioning).
- **Trust signal on the discovery grid (batched)** → Phase 3.
- **Applicant role surfacing** (applied-but-not-member as a distinct view) → Phase 3 (the state is modeled; surfacing needs a platform-side per-row flag).
- **Full member profiles / member directory** → Phase 3 (launch shows member identity inline).
- **Richer discovery** (topic browse, activity sorting, deeper search) → Phase 3.
- **Moderation / dispute-resolution beyond raw counts** → Phase 4 (launch ships retire-a-circle and the existing weightless-dispute mechanic; the real no-admin model needs its own discovery).
- **Bespoke → declaration migration** → Phase 4.
- **Portable belonging across surfaces** and **emergent canonical community** (convergent rosters) → Phase 4.

## 9. Phase Roadmap
- **Phase 2 (this release) — "Make it live, honestly."** Lights on in production; cold-start growth; felt conversation and signs of life on sovereign terms; legible founder head-start decay; retire a circle. The launchable version, serving the Convener fully and the Newcomer (including the outsider) through entry.
- **Phase 3 — "Personal trust and richer texture."** Per-viewer trust signal everywhere, applicant→member legibility, member profiles/directory, richer discovery.
- **Phase 4 — "Caretaking at scale, portability, convergence."** A real no-admin moderation/dispute-resolution model with its own discovery, bespoke→declaration migration, portable belonging across surfaces, emergent canonical communities.

## 10. Success Metrics
Observable by inspection; no analytics pipeline required. (Timeframes are placeholders to confirm.)
- **Lights on:** on the production site, opening a circle shows a real roster and trust signal (not a dark surface), and conversation works for a founder in a brand-new circle.
- **Cold-start:** at least one person who began with no trust connections enters a circle through an extended foothold, with zero admin-approval action.
- **Aliveness:** at least one circle shows a threaded conversation with replies and reactions; a member receives a notification they had configured and none they had not.
- **Signs of life:** a signed-out visitor can correctly distinguish a circle with recent activity from a dormant one with no account.
- **Head-start decay (falsifiability):** in a circle that has grown past its seed, the founder's standing is visibly no longer privileged relative to established members.
- **Caretaking:** the three legacy test circles are gone from production discovery, removed through the retire mechanism.
- **Sovereignty (negative):** there exists no notification or reach-out a user cannot turn off or did not opt into.

## 11. Open Questions
Each names a decision and its options. Several require cross-team coordination.

1. **Cold-start mechanism.** Which concrete mechanism gives a true outsider their first foothold: (a) an invite that carries a vouch (the working assumption), (b) a founder-granted initial vouch, or (c) time-bounded provisional standing? The design assumes (a); domain and engineering must validate it, with (b)/(c) as fallbacks.
2. **How head-start decay is computed.** What is the legible, user-visible rule by which a founder's standing fades: a member-count threshold, elapsed time, or a measure of the circle's internal trust density? The rule must be explainable in one plain sentence to the founder.
3. **Default belonging threshold.** Is the product default one trusted vouch (open) or two or more (safer space), and is it founder-configurable at declaration time?
4. **Founder auto-belong.** Ratify founder-auto-belong-on-founding as intended behavior (the assumption in this PRD), or keep founding and belonging as separate acts?
5. **Retirement mechanism.** How is a circle "released" trust-consistently, and is retirement a one-off cleanup capability or a durable, reusable feature? The wording and behavior in §5.9 assume the durable feature; the underlying mechanism is an engineering decision.
6. **Notification delivery channels at launch.** Is the launch in-app only, or does it include other channels? The preferences control (§5.6) is built to hold channels; the launch set must be named so defaults stay conservative.
7. **Cross-team dependency timing (release gate).** Turning the lights on (§5.10) depends on platform-side configuration and a promotion of the trust-scoring core to production, plus a platform-side per-row flag for the deferred applicant role. What is the firm timing, and which Phase 2 value can ship before it lands (conversation, signs of life, and the degraded posting state do not depend on it; the roster, trust signal, and cold-start do)?
