# Scope: Communities

**Slug:** communities
**Date:** 2026-06-05
**Manager phase:** Scope & Prioritization (Phase 3)

## Features extracted
Every feature implied by the journeys, listed flat:

- Browse/discover circles **read-only, no account**
- Read a circle's **trust signal** read-only (who belongs, how many people *you* trust are inside, impersonators carry no weight)
- Sign in with a portable identity
- **Found a circle by declaring its definition** (purpose + what it takes to belong)
- **Stand on / fork another circle's definition** (inherit it, with your own overrides)
- Seed a circle (vouch in the first few people)
- Join a circle (self-assert "I'm in")
- Vouch for a newcomer
- **Compute the roster** — belonging earned by trusted vouches, applicant→member, untrusted disputes weightless, per-viewer
- Participate (post) in a circle
- Portable belonging across surfaces/apps
- Step back / hand off (circle survives the founder leaving)
- Moderation / safety without a central admin
- Cold-start: a first-vouch path for a true outsider

## MVP boundary
The minimum that delivers core value to the **primary persona we can serve unblocked (the Convener)** plus the **Newcomer's first-visit value** — without depending on the mid-integration trust-membership engine.

### In scope (must ship)
- [ ] **Found a circle by declaring its definition** — purpose + belonging-bar, in plain language (no admin control panel).
- [ ] **Stand on / fork another circle's definition** — inherit an existing circle's definition with your own overrides; the convener can split and carry forward.
- [ ] **Read-only discovery + trust signal** — a person with **no account** can browse circles and read who belongs and how much their own/known trust is inside (impersonators visibly carry no weight).
- [ ] **Sign in** with a portable identity (required to found, fork, or participate).
- [ ] **Participate (post)** in a circle. *(Already shipped; gated on an interim/simple "in this circle" check until trust-membership lands.)*
- [ ] **Step back without collapse** — a circle persists when its founder leaves (falls out of "no privileged center"; verify it holds).

### Out of scope (deferred)
- **Trust-based membership** — join/vouch and the trust-weighted, per-viewer roster (applicant→member, weightless untrusted disputes) → **Phase 2** *(gated on the trust/identity capability that's mid-integration across teams)*.
- **Cold-start first-vouch path** for true outsiders → **Phase 2** (it's a property of the membership engine).
- **Portable belonging across surfaces** → **Phase 3**.
- **Emergent canonical community** — rosters converging across people who stand on the same definition → **Phase 3**.
- **Moderation / safety without a central admin** (harmful-content + bad-actor story) → **Phase 3** (needs a deliberate stance; see Discovery Q4).
- **Retiring the interim owner-style membership** in the existing surface → **Phase 2** (swap to trust-based when the engine lands; run in parallel until then, per Discovery Q2).

## Phase roadmap
- **MVP — "A circle is a definition you can stand on, fork, read the trust of, and talk in."** Serves the Convener fully and the Newcomer's first visit; ships entirely on already-ratified/unblocked capability.
- **Phase 2 — "Belonging earned by trust."** Activates the Belonger's full loop: join, vouch, trust-weighted roster, applicant→member, weightless disputes, and the cold-start first-vouch path. Begins when the trust/identity membership capability lands on the mainline; retires the interim membership.
- **Phase 3 — "Emergent & portable."** Convergent canonical communities, portable belonging across surfaces, and the no-central-admin moderation/safety stance.

## Success metrics
Observable by inspection — no analytics pipeline required. (Timeframes are placeholders to confirm.)

- **MVP:** ≥3 circles founded by ≥3 distinct conveners within 2 weeks of launch; ≥1 circle that was *forked* from another's definition exists; a person with **no account** can open any circle and see its members + a trust signal; ≥1 circle shows active posts.
- **MVP (negative/safety):** a founder can step back and the circle remains usable (no dead-circle-on-founder-exit).
- **Phase 2:** ≥1 member admitted to a circle **purely through earned vouches, with zero admin action**; a known impersonator/disputed account visibly accrues **no** standing from a typical viewer's point of view.
- **Phase 3:** two people who independently stand on the same definition see substantially the same roster (convergence is visible).

## Tradeoffs
- **By cutting trust-based membership from the MVP**, we don't block the entire product on the cross-team trust/identity dependency — the Convener and the Newcomer's first visit ship now on already-ratified ground. **Cost:** the Belonger (a primary persona) isn't fully served until Phase 2, and MVP "membership" is interim/owner-style or simply absent for posting gates.
- **By shipping founding + forking first** (the unblocked, differentiating mechanic), we prove the "no-owner, forkable circle" thesis early, even before trust-weighted rosters exist.
- **By keeping the existing surface in parallel** rather than ripping it out, we avoid a hard cutover and let the right-way model arrive incrementally.
