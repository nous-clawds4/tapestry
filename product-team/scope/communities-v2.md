# Scope: Communities (Phase 2 — the launchable version)

**Slug:** communities-v2
**Date:** 2026-06-06
**Manager phase:** Scope & Prioritization (Phase 3)
**Builds on:** `scope/communities.md` (V1). V1's "MVP" (found/fork/read/post) shipped. V1's "Phase 2 — belonging earned by trust" largely shipped too, but **dark in production**. This document re-baselines the roadmap from here: the work below is the new **Phase 2**, the launchable version, with everything cut assigned to a named Phase 3 or Phase 4.

> Ambition bar (set in discovery): Phase 2 is what gets put in front of the public as Brainstorm Communities. Primary persona: the Convener ("I founded it, now make it live"), with the Newcomer co-primary because cold-start is the founder's growth engine. Every aliveness mechanism must pass the discovery sovereignty test (the user owns their attention, data, and exit).

## Features extracted
Every feature implied by the v2 journeys and the audit carry-forward register, listed flat:

- Turn the trust-membership surface data-live in production (ops config + tag-core promotion) — precondition
- Posting-lock graceful fallback (degraded roster must not kill conversation)
- Cold-start foothold for a true outsider (a first vouch without pre-existing trust)
- Invite / onboarding flow (the invite is the likely carrier of the cold-start vouch)
- Replies / threaded conversation on posts
- Reactions
- Live-ish updates (the room reflects new activity without a manual reload)
- Notifications (you were vouched; new activity in your circles) — sovereign
- Signs-of-life on circles, legible read-only (tell a living circle from a dormant one)
- Member identity legible in roster and posts (faces, not just names)
- Founder standing is bounded and visibly diminishes as the circle grows (head-start decay)
- Ratify founder auto-belong
- Retire / archive a circle (caretaking) — includes removing the 3 legacy test circles
- Per-viewer "people you trust" trust signal (vs house view)
- Trust signal on the discovery grid (batched)
- Applicant role (applied-but-not-yet-member, distinct from member)
- Full member profiles / member directory
- Richer discovery: topic browse, activity sorting, search depth
- Moderation / dispute-resolution beyond raw vouch-vs-dispute counts
- Bespoke (owner-style kind-39999) → Community Declaration migration
- Portable belonging across surfaces and apps
- Emergent canonical community (rosters converging across the same definition)

## MVP boundary
The minimum that lets a **Convener grow a quiet circle into a living one** that a **Newcomer (including a true outsider)** can read, trust, and enter — live in production — without betraying the no-owner thesis. Scoped to touch all four named deadnesses at least once, deepening two of them later.

### In scope (must ship)
- [ ] **Turn the lights on.** The trust-membership surface (roster, trust signal, vouch) is data-live in production: ops config set (`VITE_PROFILE_API_BASE`, `VITE_TAG_RELAY`, CORS for `/api/profile-tags/*`, house-PoV `minRank`) and the tag core promoted staging → prod. *Precondition for everything below; cross-team (Vinney + ops).*
- [ ] **Posting-lock fallback.** A degraded or unreachable roster falls back to a graceful gate so conversation is never dead, including for the founder. *(The known gotcha; small.)*
- [ ] **Cold-start foothold.** A true outsider with no existing trust can earn a first foothold through a path that does not require pre-existing trust and is not an admin-approval queue. Working assumption from discovery: an invite that carries a vouch. This is the Convener's growth engine and the Newcomer's entry.
- [ ] **Invite / onboarding flow.** A founder (or member) can bring someone in; a brand-new person can accept and create a portable identity with intended state surviving the step.
- [ ] **Felt conversation.** Replies/threads and reactions on posts, and the room reflects new activity without a manual reload. *(Touches "nothing happens.")*
- [ ] **Sovereign notifications.** A member can learn that something involving them happened (vouched for; new activity in their circles) only in ways they pulled and configured — nothing scheduled at them, everything turn-off-able. *(Touches "no reason to return"; gated by the sovereignty test.)*
- [ ] **Signs of life, read-only.** A signed-out visitor can tell a living circle from a dormant one (recent activity is legible) and members read as real people (identity in roster and posts). *(Touches "hard to find the good ones" and "can't feel the people" at the minimum bar.)*
- [ ] **Founder head-start decay, made legible.** The founder's special standing is bounded and visibly diminishes as the trust graph inside the circle fills in; a founder can see this happening on a legible rule. Founder auto-belong ratified as intended behavior. *(The mechanic that keeps the founder from becoming an owner; the no-owner promise must be falsifiable.)*
- [ ] **Retire a circle.** A circle can be retired as a trust-consistent act (not a unilateral owner power), which also clears the 3 legacy test circles. *(Minimum caretaking for launch.)*

### Out of scope (deferred)
Each deferred item names its phase.

- **Per-viewer "people you trust" trust signal** → **Phase 3** *(launch ships the house view to everyone; per-viewer needs cross-team trust-graph PoV provisioning — decided in scope).*
- **Trust signal on the discovery grid (batched)** → **Phase 3** *(detail-page trust signal ships now; per-card needs a batched roster path).*
- **Applicant role** (applied-but-not-member, distinct from member) → **Phase 3** *(blocked on Vinney's `selfApplied` per-row flag).*
- **Full member profiles / member directory** → **Phase 3** *(launch shows member identity inline; rich profiles deepen "feel the people" later).*
- **Richer discovery** (topic browse, activity sorting, deeper search) → **Phase 3** *(launch ships signs-of-life + existing search; depth follows).*
- **Moderation / dispute-resolution beyond raw counts** → **Phase 4** *(launch ships retire-a-circle + the existing weightless-dispute mechanic; the real no-admin harm model needs its own discovery — decided in scope).*
- **Bespoke → Community Declaration migration** → **Phase 4** *(strangler coexistence holds; no forced migration for launch).*
- **Portable belonging across surfaces / apps** → **Phase 4** *(carried from V1 Phase 3).*
- **Emergent canonical community** (convergent rosters across the same definition) → **Phase 4** *(carried from V1 Phase 3).*

**Engineering carry-forward (not product scope; routed to the engineering book):** ADR refolder execution + fold ADR-0022; multi-parent fork diamond fence in the resolver before multi-parent claims inheritance; decide whether the roster endpoint accepts a per-call `minRank` override (the inert `influence_cutoff` field).

## Phase roadmap
- **Phase 2 (this book) — "Make it live, honestly."** Lights on in production; a founder can grow past their own network via cold-start; conversation and signs of life make a circle feel alive on sovereign terms; the founder's head start visibly decays; a circle can be retired. The launchable version. Serves the Convener fully and the Newcomer (including the outsider) through entry.
- **Phase 3 — "Personal trust and richer texture."** Per-viewer trust signal everywhere (detail + discovery grid), applicant→member legibility, member profiles/directory, richer discovery. Deepens "feel the people" and "find the good ones" and makes the trust pitch personal.
- **Phase 4 — "Caretaking at scale, portability, convergence."** A real no-admin moderation/dispute-resolution model with its own discovery; bespoke→CD migration; portable belonging across surfaces; emergent canonical communities.

## Success metrics
Observable by inspection, no analytics pipeline required. (Timeframes are placeholders to confirm.)

- **Lights on:** on production `communities.brainstorm.world`, opening a circle shows a real roster and a trust signal (not an empty/dark surface), and conversation works for a founder in a brand-new circle.
- **Cold-start:** ≥1 person who began with no trust connections enters a circle through an extended foothold (invite-carries-vouch), with zero admin-approval action.
- **Aliveness:** ≥1 circle shows a threaded conversation with replies and reactions; a member receives a notification they had configured and none they had not.
- **Signs of life:** a signed-out visitor can correctly distinguish a circle with recent activity from a dormant one without an account.
- **Head-start decay (falsifiability):** in a circle that has grown past its initial seed, a founder's standing is visibly no longer privileged relative to established members (the no-owner claim is inspectable).
- **Caretaking:** the 3 legacy test circles are gone from discovery on production, removed through the retire mechanism.
- **Sovereignty (negative):** there exists no notification or reach-out a user cannot turn off or did not opt into.

## Tradeoffs
- **By deferring per-viewer trust to Phase 3**, we ship the launch on the already-built house view and avoid blocking on cross-team PoV provisioning. **Cost:** the headline "people *you* trust are inside" reads as "established members" at launch; the personal pitch lands a phase later.
- **By cutting the full moderation model to Phase 4** and shipping only retire-a-circle + weightless disputes, we launch without a heavy, stance-dependent build. **Cost:** the public harm story is thin at launch; this is a real risk to name to leadership, and Phase 4 should not slip indefinitely.
- **By making head-start decay legible rather than silent**, we spend design/eng effort to keep the no-owner promise falsifiable. **Gain:** the core differentiator is inspectable, not a claim; **cost:** more work than letting decay be an invisible backend property.
- **By touching all four deadnesses at the minimum bar** (full conversation + notifications; minimum profiles + discovery) rather than going deep on each, we ship a circle that *feels* alive without a sprawling Phase 2. **Cost:** "feel the people" and "find the good ones" are partial at launch and deepen in Phase 3.
- **By keeping the cold-start mechanism as a working assumption (invite-carries-vouch) rather than a locked decision**, we let domain and design validate it. **Risk:** if that mechanism fails review, the Convener's growth engine needs a fast rethink (founder-grant / provisional standing are the fallbacks).
