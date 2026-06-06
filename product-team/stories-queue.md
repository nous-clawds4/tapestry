# Stories Queue: Communities (Phase 2 — "Make it live, honestly")

**Slug:** communities-v2
**Date:** 2026-06-06
**Source PRD:** `product-team/prd/communities-v2.md` · **Guides:** `guides/communities-v2-design-guide.md`, `guides/communities-v2-style-guide.md` (each extends its V1 counterpart)

> Epic-aware backlog for Communities Phase 2. Supersedes the V1 queue for engineering pickup; the V1 queue (blocks 1–6, all shipped or carried) is preserved in git history and in `engineering-team/audits/communities/audit.md`. Dependency-ordered: Block A proves the product live end-to-end. The engineering Product Owner promotes each block into `engineering-team/epics/<epic-slug>.md` + `engineering-team/stories/<epic-slug>/`, then runs `/plan-feature` per story. Stories are behavior, not implementation.
>
> **Cross-team reality:** several stories depend on platform-side work (the trust-scoring core promotion and config) and on decisions in the PRD's §11 open questions. Each affected story names what must be resolved first. Do not start a blocked story until its named open question is decided.

## Blocks (dependency order)

- **A — Lights on** → `communities-go-live` *(makes the already-built membership surface real in production; unblocks conversation).* 
- **B — A circle that feels alive** → `communities-aliveness` *(conversation texture + signs of life; independent of the trust engine).*
- **C — Awareness on your terms** → `communities-notifications` *(sovereign notifications).*
- **D — A way in for a stranger** → `communities-coldstart` *(the cold-start foothold; depends on A).*
- **E — Tending without owning** → `communities-caretaking` *(founder standing + retire; depends on A).*

**Order:** A → (B ∥ C) → D → E. B and C depend only on A's posting fallback (B) or on events existing (C), and can run in parallel. D and E depend on A's "lights on".

---

## Block A — Lights on  (`communities-go-live`)

### Story 1: Membership surface shows real data in production
**PRD section(s):** §5.10, §7 · **Persona(s):** Convener, Newcomer, Belonger · **Block:** Lights on · **Suggested epic-slug:** `communities-go-live`

**Description:** Turn on the already-built roster and trust signal so a circle on the production site shows real members instead of an empty surface.

**Acceptance criteria:**
- [ ] On the production site, opening a circle that has members shows a roster of real members, not an empty list.
- [ ] The house trust signal renders on the circle detail with a real count ("N established members").
- [ ] A self-tag ("I'm in") and a vouch made on production are reflected in the roster a reader sees.
- [ ] When the trust source is configured but a circle genuinely has no members, the designed empty state shows, not an error.
- [ ] No regression: discovery, found, fork, and read-only viewing still work on production.

**Dependencies:** none in this queue, but **blocked on cross-team work** (see notes).
**Notes for engineering:** This is a release-gate / configuration-and-verification story, not a feature build. Resolve PRD §11 Q7 first. Cross-team asks: the trust-scoring core promoted staging → prod; deploy config set (the profile API base, the dual-publish relay, CORS for the profile-tags read path, and a house point-of-view rank floor); confirm the dual-publish relay URL with the platform team. Until this lands, the membership surface stays dark and Story 2 governs conversation. Verify on production, not just locally.

### Story 2: Conversation stays open when the trust source is unreachable
**PRD section(s):** §5.2 · **Persona(s):** Convener · **Block:** Lights on · **Suggested epic-slug:** `communities-go-live`

**Description:** When the trust/roster source can't be reached, a signed-in person (including a founder in a brand-new circle) can still post, instead of conversation being locked.

**Acceptance criteria:**
- [ ] When the roster source is unreachable, a signed-in viewer sees a usable composer, not a disabled or absent one.
- [ ] A calm note above the composer states the trust network can't be reached, membership can't be confirmed, and they can still post.
- [ ] A founder in a brand-new circle with an empty/unreachable roster can post.
- [ ] When the source recovers, the normal trust-based gate resumes and the note disappears.
- [ ] The degraded note never reads as an error ("something went wrong" is absent).

**Dependencies:** none. Can ship before Story 1 and resolves the current posting-lock immediately.
**Notes for engineering:** This is the graceful fallback for the known posting-lock gotcha (the composer gate in the circle detail). Falls back to a signed-in gate when the roster is degraded/unreachable. Ships value even while the surface is still dark, so sequence it early.

---

## Block B — A circle that feels alive  (`communities-aliveness`)

### Story 3: Reply to a post
**PRD section(s):** §5.1 · **Persona(s):** Belonger, Convener · **Block:** A circle that feels alive · **Suggested epic-slug:** `communities-aliveness`

**Description:** A signed-in member can reply to a post, and the reply shows nested one level under it.

**Acceptance criteria:**
- [ ] A signed-in member can reply to a post and the reply appears nested one level beneath the parent.
- [ ] A reply shows author, body, and relative time.
- [ ] Replies do not nest beyond one level (a reply to a reply attaches at the same single level).
- [ ] Signed out, the reply action is replaced by a "sign in to reply" prompt, not a disabled control.
- [ ] A failed reply shows an inline error with retry; the parent post stays visible.

**Dependencies:** Story 2 (posting must be reliable, including the degraded path).
**Notes for engineering:** Posting already exists. Threading is the new behavior. One level only is a deliberate design constraint for mobile readability (design guide). Reuse the existing composer scoped to the parent.

### Story 4: React to a post
**PRD section(s):** §5.1 · **Persona(s):** Belonger · **Block:** A circle that feels alive · **Suggested epic-slug:** `communities-aliveness`

**Description:** A signed-in member can add or remove a lightweight reaction to a post, with an honest visible count.

**Acceptance criteria:**
- [ ] A signed-in member can add a reaction to a post and see the count increase.
- [ ] Tapping their own reaction again removes it and the count decreases.
- [ ] The viewer's own reaction is visually distinct from others'.
- [ ] Reaction counts are exact (not rounded or inflated).
- [ ] Signed out, reactions are visible but the add action prompts sign-in.

**Dependencies:** Story 3 (shares the post-interaction surface).
**Notes for engineering:** Counts must be honest and small — no vanity inflation (design principle 7 / style guide). Optimistic toggle is fine; reconcile on failure.

### Story 5: New posts are offered, not forced
**PRD section(s):** §5.1 · **Persona(s):** Belonger · **Block:** A circle that feels alive · **Suggested epic-slug:** `communities-aliveness`

**Description:** When new posts arrive while a member is reading, a single "N new" affordance appears that they tap to load, rather than content being injected into their view.

**Acceptance criteria:**
- [ ] When new posts arrive while the conversation is open, a single "N new" affordance appears at the top.
- [ ] New content loads only when the member taps the affordance; nothing is injected automatically.
- [ ] The content the member is currently reading does not jump or shift when new posts are available.
- [ ] When there is nothing new, no affordance is shown.
- [ ] If the live channel drops, the affordance simply stops appearing and a manual reload still loads new posts.

**Dependencies:** Story 3 (a conversation to update).
**Notes for engineering:** This is the design's sovereignty constraint made concrete (principle 7): live updates are offered, never auto-played. The "N new" pill is the only live surface. Announce the pill politely to assistive tech (non-interrupting).

### Story 6: Signs of life on a circle
**PRD section(s):** §5.1, §5.8 · **Persona(s):** Newcomer · **Block:** A circle that feels alive · **Suggested epic-slug:** `communities-aliveness`

**Description:** A circle shows a plain, read-only line that tells a visitor whether it is active or quiet, on both the detail page and discovery cards.

**Acceptance criteria:**
- [ ] A circle with recent activity shows a concrete line (e.g. "Active today · 6 posts this week") with no account.
- [ ] A dormant circle shows a plain line (e.g. "Quiet lately · last post 3 weeks ago"), stated calmly.
- [ ] A brand-new circle shows "New circle · founded today".
- [ ] The line appears on the circle detail and on discovery cards.
- [ ] If activity data can't be loaded, the line is omitted rather than shown wrong.

**Dependencies:** Story 3, Story 4 (activity is derived from posts, replies, and reactions).
**Notes for engineering:** Read-only, no account. Honest about quiet — no "hot"/"trending"/urgency styling (design principle 11). Derived from recent posts/reactions/assertions.

---

## Block C — Awareness on your terms  (`communities-notifications`)

### Story 7: Notification preferences (the sovereignty control)
**PRD section(s):** §5.6 · **Persona(s):** Belonger · **Block:** Awareness on your terms · **Suggested epic-slug:** `communities-notifications`

**Description:** A person controls which occasions may reach them, with everything off by default and individually turn-off-able.

**Acceptance criteria:**
- [ ] A person sees independent toggles for each occasion (someone vouches for you; new posts in your circles; replies to you).
- [ ] Every occasion is off by default for a new person.
- [ ] Turning a toggle on or off saves immediately with a quiet confirmation.
- [ ] There is no master "turn on everything" control.
- [ ] Toggle state is conveyed by switch position and an on/off text label, not color alone.
- [ ] A failed save reverts the toggle to its last saved position and shows an inline retry.

**Dependencies:** none (defaults must exist before any notification is sent, so this ships before Story 8).
**Notes for engineering:** Resolve PRD §11 Q6 (which channels at launch) before building — the toggles must reflect the actual launch channel set, defaulting conservative. This is the enforcement point for the sovereignty principle; defaults off is non-negotiable.

### Story 8: Notification inbox
**PRD section(s):** §5.5 · **Persona(s):** Belonger, Convener · **Block:** Awareness on your terms · **Suggested epic-slug:** `communities-notifications`

**Description:** A person can open a calm list of things that happened involving them, reached from a quiet new-marker.

**Acceptance criteria:**
- [ ] A person sees a new-marker (a quiet dot, not a numeric count) when there is something new, respecting their preferences.
- [ ] Opening the inbox shows one plain sentence per item with actor, occasion, circle, and relative time.
- [ ] Opening the inbox clears the new-marker; each item links to its source.
- [ ] Occasions the person has turned off do not appear.
- [ ] An empty inbox shows the designed empty state; a load failure shows an error with retry.

**Dependencies:** Story 7 (preferences gate what appears here).
**Notes for engineering:** No numeric badge, no nag, no urgency styling (style guide forbidden list). The new-marker needs a text equivalent for assistive tech. Derive items from vouch/reply/new-activity events filtered by the person's preferences.

---

## Block D — A way in for a stranger  (`communities-coldstart`)

### Story 9: Extend a foothold invite
**PRD section(s):** §5.3 · **Persona(s):** Convener · **Block:** A way in for a stranger · **Suggested epic-slug:** `communities-coldstart`

**Description:** A founder or member can create an invite that carries their vouch, so an outsider can join even with no existing trust.

**Acceptance criteria:**
- [ ] A signed-in member can create an invite from a circle and receive a shareable link.
- [ ] The invite flow states plainly that the invite vouches for the recipient and that the issuer's vouch stands behind them.
- [ ] An issuer can see the invites they have created.
- [ ] An empty state explains what an invite is for before any exist.
- [ ] A failed invite creation shows an inline error with retry.

**Dependencies:** Story 1 (membership must be live for a carried vouch to mean anything).
**Notes for engineering:** Resolve PRD §11 Q1 (cold-start mechanism) before building — the design assumes the invite carries a vouch; founder-grant and provisional standing are the named fallbacks. Worded as a personal act of trust, never an approval (style guide).

### Story 10: Accept a foothold and enter as a newcomer
**PRD section(s):** §5.4 · **Persona(s):** Newcomer · **Block:** A way in for a stranger · **Suggested epic-slug:** `communities-coldstart`

**Description:** A true outsider opens an invite, creates a portable identity, and enters the circle through the carried vouch.

**Acceptance criteria:**
- [ ] An invited outsider sees who invited them and which circle, in plain prose, before signing in.
- [ ] Accepting creates a portable identity and the carried vouch takes effect, so they appear as a new member.
- [ ] After accepting, the path from "just arrived" to fuller belonging is stated.
- [ ] An expired invite shows a path forward ("ask whoever shared it for a new one"), never a dead end.
- [ ] Intended state survives the identity step; a signing failure shows specific copy, not "something went wrong".

**Dependencies:** Story 9 (an invite must exist to accept).
**Notes for engineering:** This is the cold-start payoff — entry through a person's extended trust, not an admin approval. Reuse the V1 sign-in/identity prompt pattern and copy stance. Verify the accepted vouch produces membership a reader can see (ties to Story 1).

---

## Block E — Tending without owning  (`communities-caretaking`)

### Story 11: Founder sees their head start fade
**PRD section(s):** §5.7 · **Persona(s):** Convener · **Block:** Tending without owning · **Suggested epic-slug:** `communities-caretaking`

**Description:** A founder sees a legible, founder-only panel showing their share of the circle's trust shrinking as the circle grows.

**Acceptance criteria:**
- [ ] A founder sees a founder-only panel stating the circle's current state in concrete terms and a proportion of their standing.
- [ ] In a just-founded circle, the panel explains the head start fades on purpose as people join and vouch.
- [ ] As the circle's internal trust grows, the founder's shown share decreases.
- [ ] The panel is not shown to non-founders.
- [ ] If the figure can't load, the panel is hidden rather than shown broken.

**Dependencies:** Story 1 (trust data must be live to compute and show the share).
**Notes for engineering:** Resolve PRD §11 Q2 (the legible decay rule) before building — the rule must be explainable in one plain sentence to the founder. This makes the no-owner promise inspectable (design principle 9). Read-only, no action.

### Story 12: Founder auto-belong, confirmed
**PRD section(s):** §11 Q4 · **Persona(s):** Convener · **Block:** Tending without owning · **Suggested epic-slug:** `communities-caretaking`

**Description:** Founding a circle makes the founder a member, ratified as intended behavior so a new circle is never empty of its founder.

**Acceptance criteria:**
- [ ] Founding a circle results in the founder appearing as a member of it.
- [ ] The founder is shown as a peer member, with no owner/admin/moderator label.
- [ ] The behavior holds for both newly founded and forked circles.

**Dependencies:** Story 1 (membership must be live to observe the founder as a member).
**Notes for engineering:** The founder auto-self-tag already ships (it landed under the V1 work). This story ratifies and verifies it against PRD §11 Q4 — confirm it is the intended product behavior and that it reads correctly once the surface is live. If the decision is to separate founding from belonging, this story flips to that instead.

### Story 13: Retire a circle
**PRD section(s):** §5.9 · **Persona(s):** Convener · **Block:** Tending without owning · **Suggested epic-slug:** `communities-caretaking`

**Description:** A circle can be retired as a trust-consistent act so it stops appearing in discovery while its history is kept, and this is used to clear the three legacy test circles.

**Acceptance criteria:**
- [ ] A founder can retire a circle through a flow worded as a community act, with a confirm step that restates the outcome.
- [ ] A retired circle no longer appears in discovery.
- [ ] A direct link to a retired circle resolves to a clearly-marked retired view stating its history is still present.
- [ ] The three legacy test circles are retired and gone from production discovery.
- [ ] A failed retirement shows an inline error with retry.

**Dependencies:** none (can build independently; uses the live site to clear the test circles).
**Notes for engineering:** Resolve PRD §11 Q5 (retirement mechanism, and one-off vs durable feature) before building — the design assumes a durable feature. Copy must never imply unilateral owner authority (style guide forbidden list). First enumerate the three legacy test circles on the live relay (their slugs, author pubkeys, and kind) before retiring them.

---

## Handoff notes for the engineering Product Owner

- **Order:** Block A first (it is the demo milestone — a live circle with a real roster you can post in). Then Blocks B and C in parallel (neither needs the trust engine beyond posting). Then D and E (both need A's "lights on").
- **First demoable moment:** after Story 1 + Story 2, a founder can open a circle on production, see a real roster and trust signal, and hold a conversation. That is the proof the product is alive.
- **Resolve-before-building (PRD §11):** Q7 gates Story 1; Q6 gates Story 7; Q1 gates Story 9; Q2 gates Story 11; Q4 shapes Story 12; Q5 gates Story 13. Q3 (default belonging threshold) is a configuration decision that should be settled before launch but does not block a specific story.
- **Cross-team asks to relay:** platform team — promote the trust-scoring core to production, add the per-row self-applied flag (unblocks the deferred applicant role in Phase 3), confirm the dual-publish relay URL. Ops — set the deploy config (profile API base, dual-publish relay, CORS for the profile-tags path, house point-of-view rank floor).
- **Engineering carry-forward (not stories here; from the close audit):** the ADR refolder execution, the multi-parent fork diamond fence before multi-parent claims inheritance, and the decision on a per-call rank override for the roster read. Route these through the engineering harness as housekeeping.
- **Deferred to later phases (do not build now):** per-viewer trust signal, discovery-grid trust signal, applicant-role surfacing, member profiles/directory, richer discovery → Phase 3. Full moderation/dispute-resolution, bespoke→declaration migration, portable belonging, emergent canonical communities → Phase 4.
