# Stories Queue: Communities

**Slug:** communities
**Date:** 2026-06-05
**Source PRD:** `product-team/prd/communities.md` · **Guides:** `guides/communities-design-guide.md`, `guides/communities-style-guide.md`

> Epic-aware backlog. Each block maps onto an engineering epic (suggested `epic-slug` per brief). Dependency-ordered: the first block proves the product end-to-end. The engineering Product Owner promotes each block into `engineering-team/epics/<epic-slug>.md` + `engineering-team/stories/<epic-slug>/`, then runs `/plan-feature` per story. Stories are behavior, not implementation.

## Blocks (dependency order)

1. **Circles as definitions** → `communities-declaration` — found, view, discover. *(MVP, end-to-end proof.)*
2. **Forking & resolved definitions** → `communities-inheritance` — fork, inherited-field display. *(MVP; first consumer of the §25/§26 substrate.)*
3. **Trust legibility** → `communities-trust-signal` — point-of-view trust signal + per-member legibility. *(MVP.)*
4. **Participation** → `communities-participation` — post to a circle (interim gate). *(MVP.)*
5. **Belonging earned by trust** → `communities-membership` — *Phase 2, blocked* (named below, not decomposed).
6. **Emergent & portable** → `communities-emergent` — *Phase 3* (named below).

---

## Block 1 — Circles as definitions  (`communities-declaration`)

### Story 1: Found a circle by declaring its definition
**PRD section(s):** §5.3, §6 · **Persona(s):** Convener · **Block:** Circles as definitions · **Suggested epic-slug:** `communities-declaration`

**Description:** A signed-in person declares a new circle (name, purpose, belonging-bar) and lands in it — the end-to-end proof that a circle exists as a definition.

**Acceptance criteria:**
- [ ] A signed-in user completes a stepper (name, purpose, belonging-bar) and publishes a circle.
- [ ] After publish, the new circle exists and the founder lands on its read-only detail.
- [ ] The founder is shown as a peer; no "owner," "admin," or "moderator" label appears.
- [ ] The belonging-bar is captured as prose (a rule), not as a member list.
- [ ] Sign-in is requested only at the publish step, and typed state survives it.
- [ ] A publish failure shows specific copy (network / signing cancelled), never "something went wrong."

**Dependencies:** none.
**Notes for engineering:** A circle is a definition-bearing concept that maps to the existing `brainstorm-community` concept, evolving it from the owner/signal shape to a declaration shape. No owner semantics. This is the demo milestone for Block 1.

### Story 2: View a circle's definition (read-only)
**PRD section(s):** §5.2 · **Persona(s):** Newcomer · **Block:** Circles as definitions · **Suggested epic-slug:** `communities-declaration`

**Description:** Any visitor, with no account, can open a circle and read what it is and what it takes to belong.

**Acceptance criteria:**
- [ ] A visitor with no account opens a circle and sees its name, purpose, and belonging-bar as prose.
- [ ] If the circle stands on a parent, a "Based on ‹parent›" link is shown.
- [ ] Loading shows a shimmer placeholder, not a bare spinner.
- [ ] A fetch failure shows an error that says what to do, with retry.
- [ ] No "owner/admin/moderator" language appears anywhere on the page.

**Dependencies:** Story 1 (a circle must exist to view).
**Notes for engineering:** Read-only for everyone. Founder sees an edit affordance later; not in this story.

### Story 3: Discover circles (read-only)
**PRD section(s):** §5.1 · **Persona(s):** Newcomer · **Block:** Circles as definitions · **Suggested epic-slug:** `communities-declaration`

**Description:** A visitor with no account browses and searches circles.

**Acceptance criteria:**
- [ ] A visitor with no account sees a grid of circle cards (name, purpose, topics).
- [ ] A search field filters circles by interest.
- [ ] An empty grid shows "No circles yet. Start the first one." with a start action.
- [ ] Loading shows card skeletons.
- [ ] A fetch failure shows an error with retry.

**Dependencies:** Story 1.
**Notes for engineering:** The trust signal on each card is added in Block 3; this story renders the card without it.

---

## Block 2 — Forking & resolved definitions  (`communities-inheritance`)

### Story 4: Fork a circle (stand on a parent's definition)
**PRD section(s):** §5.4, §7 · **Persona(s):** Convener · **Block:** Forking & resolved definitions · **Suggested epic-slug:** `communities-inheritance`

**Description:** A signed-in person creates a new circle that stands on an existing one, overriding only the fields they change.

**Acceptance criteria:**
- [ ] From a circle, a signed-in user starts a fork pre-filled with the parent's resolved definition.
- [ ] Every field is marked "inherited — edit to override."
- [ ] Editing a field overrides only that field; unedited fields stay linked to the parent.
- [ ] Publishing creates a new circle whose parent is the source circle.
- [ ] A persistent "Based on ‹parent›" banner is shown throughout the flow.
- [ ] Sign-in is requested at publish, with state preserved.

**Dependencies:** Story 1 (circles must exist to fork).
**Notes for engineering:** First real consumer of the inherit-from + Resolved Definition substrate (BIBLE §25/§26, ADR 0027/0028). "Resolved definition" = the parent chain merged with child overrides; the resolver itself is a substrate implementation story this consumes.

### Story 5: Show inherited vs overridden fields on a forked circle
**PRD section(s):** §5.2, §7 · **Persona(s):** Newcomer, Convener · **Block:** Forking & resolved definitions · **Suggested epic-slug:** `communities-inheritance`

**Description:** A forked circle's detail makes clear what it inherits and what it changed, and stays live with its parent.

**Acceptance criteria:**
- [ ] A forked circle's detail shows a "Based on ‹parent›" link that opens the parent.
- [ ] Inherited fields are visually marked as inherited; overridden fields show the child's value.
- [ ] When the parent updates an inherited field, the child reflects the new value.
- [ ] A circle with no parent shows none of the inheritance affordances.

**Dependencies:** Story 4, Story 2.
**Notes for engineering:** This is the read-side of §26 made visible to users. Live resolution (not a snapshot) is the intended behavior.

---

## Block 3 — Trust legibility  (`communities-trust-signal`)

### Story 6: Trust signal on discovery and circle detail
**PRD section(s):** §5.1, §5.2, §7 · **Persona(s):** Newcomer · **Block:** Trust legibility · **Suggested epic-slug:** `communities-trust-signal`

**Description:** Circles show a point-of-view trust signal that works before any account exists.

**Acceptance criteria:**
- [ ] Signed out, each circle shows "N established members" labeled as the house view, with a "sign in to see who you trust" hint.
- [ ] Signed in, the signal re-resolves to "N people you trust are inside."
- [ ] The signal renders with no account (read-only first visit holds).
- [ ] Loading shows a shimmer.
- [ ] If the trust network is unreachable, members show without the signal, with retry.

**Dependencies:** Story 2, Story 3.
**Notes for engineering:** Maps to the existing `web-of-trust` / `graperank` capability. Trust is per point-of-view; the signed-out house view re-resolves to the personal view on sign-in.

### Story 7: Per-member trust legibility
**PRD section(s):** §5.2, §7 · **Persona(s):** Newcomer · **Block:** Trust legibility · **Suggested epic-slug:** `communities-trust-signal`

**Description:** Each member is shown with how much the viewer's trust vouches for them, so impersonators read as weightless.

**Acceptance criteria:**
- [ ] A member trusted by people the viewer trusts shows a trusted label paired with a color cue.
- [ ] An untrusted/impersonator member shows "no one you trust vouches for them," with no alarm styling.
- [ ] Trust state is conveyed by text and color together, never color alone.
- [ ] Signed out, rows show the house view.
- [ ] If trust is unreachable, rows degrade to plain names.

**Dependencies:** Story 6.
**Notes for engineering:** Calm treatment per the style guide — no "fake/scam/warning" copy. Accessibility: color-independence is a hard requirement.

---

## Block 4 — Participation  (`communities-participation`)

### Story 8: Post to a circle (interim gate)
**PRD section(s):** §5.2, §5.5 · **Persona(s):** Convener, Newcomer · **Block:** Participation · **Suggested epic-slug:** `communities-participation`

**Description:** A signed-in viewer posts to a circle's conversation.

**Acceptance criteria:**
- [ ] A signed-in viewer posts to a circle and sees the post appear with author, body, and relative time.
- [ ] Signed out, a "sign in to post" prompt replaces the composer (no disabled-button tease).
- [ ] An empty conversation shows "No posts yet. Start the conversation."
- [ ] Loading shows post skeletons.
- [ ] A post failure shows an inline error with retry.

**Dependencies:** Story 2.
**Notes for engineering:** Posts already use the standard note format in the existing app. **PRD Open Question #5** must be resolved first: the MVP posting gate is interim (open to any signed-in viewer vs. founder-seeded). Trust-based gating replaces it in Block 5 (Phase 2).

---

## Block 5 — Belonging earned by trust  (`communities-membership`) — Phase 2, BLOCKED

Not decomposed here. Activates the Belonger persona's full loop: join, vouch, the trust-weighted per-viewer roster, applicant → member, weightless disputes, and the cold-start first-vouch path. **Blocked** on the portable trust-assertion capability landing on the mainline (PRD Open Question #1 — the cross-team reconciliation). When unblocked, decompose into: assert membership, vouch for a member, compute the per-viewer roster, applicant→member progression, weightless-dispute handling, retire the interim posting gate, and a cold-start first-vouch path (PRD Open Question #3).

## Block 6 — Emergent & portable  (`communities-emergent`) — Phase 3

Not decomposed here. Convergent canonical communities (overlapping rosters), portable belonging across surfaces, and the no-central-admin moderation/safety stance (PRD Open Question #4).

---

## Handoff notes for the engineering Product Owner

- **Order:** Block 1 → (Block 2 ∥ Block 3) → Block 4. Blocks 2 and 3 both depend only on Block 1 and can run in parallel. Block 4 depends on Block 1.
- **Substrate already ratified:** the §25 inherit-from tag and §26 Resolved Definition (ADR 0027/0028) are in the BIBLE. Block 2 consumes them; the *resolver implementation* is a substrate engineering story Block 2 depends on (the BIBLE defines the contract; no code exists yet).
- **Resolve before building:** PRD Open Question #5 (MVP posting gate) gates Story 8; Open Question #2 (evolve vs parallel surface) shapes how Block 1 relates to the existing community surface.
- **Existing surface:** a frozen owner-style community app exists. Per PRD Open Question #2, run it in parallel during transition rather than a hard cutover.
