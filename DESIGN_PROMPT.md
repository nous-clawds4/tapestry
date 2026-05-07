# Design Prompt — Brainstorm Communities

This document holds the prompt to give Claude Design (claude.ai/design) for the initial visual design of `communities.brainstorm.world`. It is the deliverable of the planning phase documented in [PLAN.md](./PLAN.md). When iterating on this prompt, update both files together so they stay in sync.

**To use:** copy the prompt-text section below (everything between the `--- PROMPT START ---` and `--- PROMPT END ---` markers) and paste it into Claude Design.

---

## --- PROMPT START ---

I want you to design the initial UI for **Brainstorm Communities**, a new web app that will live at `communities.brainstorm.world`.

### What Brainstorm Communities is

Brainstorm Communities is a place to discover, join, and create **self-curating, leaderless** online communities on the nostr protocol.

The differentiator: **a community is a convergent membership set, not an entity owned by anyone.** Members algorithmically endorse each other; multiple mirror relays compute membership independently from those endorsements; the community survives any single member leaving or going hostile. There's no admin who can rug-pull. Think of it as Bitcoin's decentralization applied to social membership — independent computation from different starting points converges on the same answer because the protocol is well-shaped.

It's a sibling product to **Brainstorm Search** at `brainstorm.world` (a trust-weighted nostr profile search engine). Same brand family, same dark visual vocabulary, but a distinct surface for a more social use case.

### Visual style

- **Sibling to Brainstorm Search.** Dark theme. Same color palette, typography, button/form styles, and iconography as `brainstorm.world`. (If you don't have direct visual reference, assume: a serious, technical, dark-mode aesthetic — think Linear or Notion's dark mode, not playful or rounded like Discord.)
- **Differentiation is typographic only.** "Brainstorm Communities" wordmark sits in the same family as the "Brainstorm Search" wordmark. No new logo mark needed for v1.
- **Cross-product navigation.** Header includes a link to brainstorm.world (and brainstorm.world will gain a reciprocal link to communities.brainstorm.world). Simple, not a heavy product switcher.
- **Mobile-first.** Social products live and die by mobile. Design mobile-first; desktop responsive treatments expected, but mobile is the primary target.
- **Tone.** Clear, honest, trust-engineering aware. This is a serious product for serious users — not gamified, whimsical, or pushy. Convey "you're in control of who you trust."

### Pages to design

**1. Landing / Discover** *(no auth required)*
- Hero: explains what Brainstorm Communities is in 1-2 sentences with a CTA to browse
- Trust-ranked feed of communities (default trust root for unsigned visitors is brainstorm.world's pubkey)
- Search bar (by name, topic)
- Filter / sort options
- Sign-in CTA (NIP-07 browser extension) appears as a quiet option, not pushed

**2. Community detail page**
- Hero: banner image, community name, short description
- **Member status indicator:** "You are a member" / "You are not a member" / "Membership uncertain" (when score is between thresholds). Show prominently — this is the core promise.
- **Engine info** (collapsible — interesting but not clutter): relay set, seed members, scoring system identifier (e.g. "gr-community-default-v1"), threshold value
- Members section: list of computed members, each with their membership score (0.0–1.0)
- Content feed: recent kind-1 notes from the community's relays
- "Join" CTA for non-members (signed-in users only)
- "Endorse" / "Veto" actions next to each member (signed-in members only)
- Optional small indicator: "Run by N mirror relays · Curated by M users in your network" — communicates the distributed nature without overwhelming

**3. My Communities page** *(signed-in only)*
- List of communities the user has joined (their personal `brainstorm-communities` list)
- Quick stats per community: member count, when the user joined, recent activity
- Click a community → detail page

**4. Create Community flow** *(signed-in only)*
A multi-step flow:
- Step 1: Name and description
- Step 2 (CRITICAL): **Soft canonicalization check.** System surfaces 3-5 similar communities from the user's trust network. Three explicit choices, framed neutrally:
  - **Join** one of these existing communities
  - **Fork** one of these (start from it but with my own tweaks)
  - **Start fresh** (proceed with a new community)
- Step 3: Configure topics, banner, language (if proceeding to create)
- Step 4: Pick relay set (default: a small list of brainstorm.world-managed relays)
- Step 5: Pick seed members (search and select pubkeys)
- Step 6: Review and create
- Outcome: new community appears in the user's My Communities list

**5. Edit Community Record page** *(signed-in only, for any community in My Communities)*
- Edit metadata (name, description, image, topics, language)
- Edit engine config (relay set, seed members, threshold value)
- Important framing: this edits the user's **personal projection** of the community, not a global record. Use copy like "your relay set" rather than "the community's relays" — make this clear.

**6. Member detail / profile drawer** *(opens from member lists)*
- Member's pubkey, baseline GrapeRank score, GR Community score for this community
- List of endorsements/vetoes about this member from other community members (with reasons if provided)
- Endorse / Veto buttons (for signed-in members) with optional free-text reason field

### User journeys to support

1. **Discover** (unsigned visitor): land → browse → view a community → optionally sign in to join
2. **Join** (signed-in): find a community → click Join → see it appear in My Communities
3. **Curate** (signed-in member): view a community → endorse or veto specific members → see how that affects scores
4. **Found** (signed-in): go to /create → soft-canonicalization check → configure and create → it appears in My Communities and is discoverable by others
5. **Participate** (signed-in member): view a community → read the kind-1 feed → post a note → see it appear in the feed

### Make the differentiator visible

The killer feature is leaderless self-curation. Design must make this **tangible**, not just functional:

- **Algorithm transparency.** When viewing a community, members can see WHY each person is or isn't a member: their endorsements, vetoes, and computed score. This pays off the "no top-down moderator" promise — anyone can see and verify the membership math.
- **The "your projection" framing.** When a user edits a community record, the UI should make clear they're editing THEIR view, not THE community. Phrases like "your relay set" and "your endorsements" matter.
- **No moderator role exists.** There is intentionally no "moderator" or "owner" UI in this product. Design accordingly — don't accidentally invent moderator panels.

### Explicitly OUT of scope for v1 design

Don't design these:
- Run-your-own-mirror-relay flow (deferred to v1.1)
- Long-form content / kind-30023 articles
- Polls, reactions, threads, structured posts
- Custom scoring system configuration (everyone uses the default `gr-community-default-v1`)
- Sub-communities / hierarchy
- Cross-community feeds ("what's happening across all my communities")
- Per-community moderator-role UI (the whole point is no moderators)

### Technical / data context (so designs feel native)

- All data lives in nostr events (no centralized DB). Specifically: kind 39998 list headers + kind 39999 list items, following the Decentralized Lists NIP convention.
- Authentication is NIP-07 (browser extensions like Alby or nos2x). No traditional username/password.
- Each community is represented by:
  - A `brainstorm-community` record event on the user's `brainstorm-communities` list
  - A per-(user, community) signals list holding their endorsements and vetoes
- Membership is computed from the union of all members' signals via a GrapeRank algorithm; result is a score in [0, 1] per pubkey per community, with a configurable threshold (default 0.5).
- Designs don't need to expose the data model — but they should feel native to nostr (pubkeys, relays, NIP-07) rather than imitating a centralized SaaS.

### Deliverables

- Mobile-first mockups of all six pages above
- Desktop responsive treatments
- A short style/component guide (color palette, typography, key components — buttons, inputs, member rows, feed items, etc., spacing primitives)
- Identification of any tactical UX questions you think need user input before further iteration

## --- PROMPT END ---

---

## Iteration notes (not part of the prompt)

- This prompt is the v1 of what we send to Claude Design. Expect to iterate after seeing first-pass designs.
- Key tactical questions deliberately left to Claude Design: exact button labels (Join? Add? Curate?), how to render the membership score visualization, microcopy for the "your projection" framing, exact layout of the soft-canonicalization step, how to present the 3-5 similar communities at create time.
- If Claude Design pushes back on a spec choice (e.g. "you should consider X for the create flow"), bring that feedback back here and update PLAN.md if it changes a design decision.
- Pages we may need later but not in v1: relay-attestation UI, content-curation lists, sub-community navigation, moderation/abuse-reporting flows. See PLAN.md §7.
