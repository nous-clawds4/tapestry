# Context for a Parallel Brainstorm Communities Design Pass

This document is for someone doing an independent design pass for **Brainstorm Communities** using Claude Design (claude.ai/design). David has already started a first pass; this is parallel exploration, not a replacement. The goal is to compare approaches and pull the best ideas from each.

**If you only have 5 minutes:** read [DESIGN_PROMPT.md](./DESIGN_PROMPT.md), paste the section between the `--- PROMPT START ---` and `--- PROMPT END ---` markers into Claude Design, see what it produces.

**If you have 30 minutes:** read this file, then DESIGN_PROMPT.md, then skim PLAN.md.

---

## What's already on this branch

| File | What it is |
|---|---|
| [DESIGN_PROMPT.md](./DESIGN_PROMPT.md) | The actual prompt to paste into Claude Design. Self-contained. |
| [PLAN.md](./PLAN.md) | The planning artifact behind the prompt. Captures every decision (with reasoning), open questions, the data model, the scoring system, status board, and pre-launch concerns. Read this if you want to understand *why* the prompt is shaped the way it is. |
| `firmware/versions/v1.1.0/` | JSON-schema skeleton for the two new firmware concepts (`brainstorm-community` and `brainstorm-community-signal`). Staged, not yet active. Less relevant for design work, more for implementation. |

Repo-level companion docs that matter:

- [BIBLE.md](./BIBLE.md) — architecture, protocol, data model for the entire Tapestry/Brainstorm system. For Communities purposes the load-bearing sections are §1 (what Tapestry is), §5 (the Tapestry Protocol — DList event kinds), §7 (Firmware), §8 (Word-Wrapper JSON), §13 (React UI structure).
- [ROADMAP.md](./ROADMAP.md) — strategic vision for Brainstorm Search. Communities is one of the candidate "next categories" listed there.

---

## The differentiator in plain English

Other community systems (NIP-72, Reddit, Discord, Twitter/X) all have someone in charge — an owner, an admin, a moderator. That person can rug-pull the community, ban members capriciously, or just disappear and take everything with them. We just saw this happen on X.

**Brainstorm Communities work differently.** Membership in a community is computed by an algorithm from member-issued endorsements and vetoes. Multiple "mirror relays" can run that algorithm independently from different starting points; trust-graph theory predicts they all converge on roughly the same membership set. So the community survives any individual leaving, going hostile, or being de-platformed. There's no single point of failure because there's no single point of authority.

### Anchor scenario: the Meshtadelians

> Alice goes to `communities.brainstorm.world/create` and starts a community of Meshtadelians. She gives it a name and a description, picks some options, clicks a button. She gets a relay with read/write access restricted by default to community members. She handpicks a few seed members. From there, membership is determined dynamically — members endorse other npubs as members, others can veto. A simple algorithm interprets these signals to produce a member whitelist that gates the relay.
>
> Bob then sets up his own "mirror" relay using his own seed users (and optionally tweaked algorithm parameters). Trust-graph theory predicts his whitelist will closely match Alice's. If 10 members each run mirror relays, it almost doesn't matter who the leader is. Maybe there isn't one. The community curates itself.

This is the same convergence trick Bitcoin pulls with the longest chain — independent computation from different starting points, converging on the same answer because the protocol is well-shaped. It's GrapeRank applied to membership instead of search ranking.

---

## Vocabulary

- **nostr** — decentralized social protocol; see nostr.com. Each user has a public/private key pair; events are signed and propagated via relays.
- **DList / Decentralized List** — a nostr custom NIP for lists. Kind 39998 list headers + kind 39999 list items. Items declare with `p` (pubkey), `e` (event), `t` (string), or `a` (addressable event). Headers can declare schema with `["required", "<tagname>"]` etc.
- **NIP-07** — browser-extension authentication for nostr (Alby, nos2x). Sign-in without passwords; the extension holds the user's private key.
- **Concept (Tapestry)** — a DList that's been promoted to a richer, schema-validated form. Has 8 "core nodes" and a JSON schema; integrates with Tapestry's normalization/audit pipeline. Brainstorm Communities uses BOTH layers — DList tags primarily, Concept word-wrapper JSON additionally.
- **GrapeRank** — Tapestry's web-of-trust scoring algorithm. PageRank-like, propagates trust from a seed set across follow/mute/report ratings. Already powers the brainstorm.world search ranking.
- **GR Community** — a NEW scoring system tailored for community membership. Each rating's confidence weight is `baseline_GR(rater) × community_GR(rater)` — so the rater must be both real on nostr AND already a community member for their endorsement to count meaningfully. Output: score in [0, 1]; threshold (default 0.5) decides member vs. not.
- **Personal projection** — every user has their OWN record of each community (their own copy of the metadata + engine config). The community-as-thing is the convergent overlap of everyone's projections. There is no canonical record anywhere. When the user edits, they edit *their* projection, not "the community."
- **Mirror relay** — any nostr relay running the membership algorithm for a given community, gating access to its own write privileges. Multiple mirrors per community is the design intent — that's how rug-pull resistance happens.

---

## v1 design summary

DESIGN_PROMPT.md has the canonical version. Quick orientation:

- **6 pages:** Landing / Discover, Community detail, My Communities, Create flow (with a soft-canonicalization step), Edit Community Record, Member detail drawer
- **5 user journeys:** Discover (no auth), Join, Curate (endorse/veto), Found, Participate (post kind-1 notes to community relays)
- **Sibling visual identity** to brainstorm.world — same dark theme, color palette, typography, button styles. Typographic-only sub-brand mark.
- **Mobile-first.** Social products live and die by mobile.
- **Cross-product navigation** via header link in both directions (← Brainstorm Search / → Brainstorm Communities). Not a heavy product switcher.
- **Out of scope for v1:** mirror-relay-running tooling, long-form content, threads, polls, sub-communities, custom scoring systems, moderator-role UI (the whole point is no moderators).

---

## Tactical UX questions Claude Design should answer

These were deliberately *not* pre-decided in the planning conversation, because they're better resolved by visual exploration. Worth focusing on in your pass:

- **Exact button labels.** Is it "Join"? "Add to my list"? "Curate"? Different framings imply different mental models.
- **How to surface algorithm transparency.** Members should be able to see WHY each person is or isn't a member. What's the right affordance — a per-member detail drawer with their endorsements/vetoes? Expandable rows? Inline scores?
- **How to communicate the convergence story to non-technical users.** Maybe a small "Run by N mirror relays · Curated by M users in your network" indicator? An explainer modal? Trust the copy?
- **The "your projection" framing.** When a user edits a community record, the UI must make clear they're editing THEIR view, not THE community. How is that conveyed without lecturing?
- **Soft canonicalization step layout.** The "we found 3-5 similar communities — join one of these, fork one, or start fresh" moment is the most important UX in the create flow. How do you make it feel helpful, not blocking?
- **Member-status indicator.** "You are a member" / "You are not a member" / "Membership uncertain" (when score is between thresholds) — should this be prominent on every community detail page? Only when signed in? How prominent?

---

## Common pitfalls to avoid

- **Don't invent moderator UI.** The whole point is no moderators. If the design has a "moderators" tab, an "appoint moderator" button, or a "ban member" affordance for any single user, it's wrong.
- **Don't make creation feel like centralized account creation.** Founders are configuring a personal community-record event, not registering with a service. The UX should reflect that — no "Welcome to Brainstorm Communities!" sign-up funnel.
- **Don't hide the algorithm.** Algorithm transparency is a feature. Anyone should be able to see why a given person is or isn't a member of a given community.
- **Don't push sign-in.** Visiting without an account should be fully usable. Sign-in (NIP-07) appears as a quiet option, not a wall.
- **Don't conflate the two products.** brainstorm.world (search) and communities.brainstorm.world (communities) are sibling products in the same brand family, but distinct. Header link cross-navigation, yes. Unified product switcher / shared shell, no — at least not for v1.
- **Don't design for the "owner" mental model.** Every user is curating *their own* projection of every community they're in. There's no "the owner" to design for.

---

## External references

- **The DList NIP** (the protocol foundation for everything below the UI): [njump.me/naddr1qvzqqqrcvy...](https://njump.me/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qythwumn8ghj7erpwe5kgtnwdaehgu339e3k7mf0qqfkgetrv4h8gunpd35h5ety94kxjum5wv4px7v6) — useful if you want to understand the underlying nostr event schema we're building on.
- **brainstorm.world** — the existing search engine. Visit it to absorb the visual vocabulary you're matching.
- **NIP-72** (existing nostr community spec — what we are explicitly NOT doing): [github.com/nostr-protocol/nips/blob/master/72.md](https://github.com/nostr-protocol/nips/blob/master/72.md). Brainstorm Communities supports wrapping NIP-72 communities via an `external_ref` field, but a Brainstorm Community is a structurally different primitive.
- **NIP-07** (browser sign-in spec): [github.com/nostr-protocol/nips/blob/master/07.md](https://github.com/nostr-protocol/nips/blob/master/07.md).
- **GrapeRank** — see BIBLE.md §13 "WoT Score Architecture" and the GrapeRank section therein.

---

## Status

- **The feature is in design.** Pre-implementation. No CI/CD or deploy droplet yet for `communities.brainstorm.world`.
- **David has a first interactive prototype from his Claude Design pass** — looking promising but not yet ready to merge into the repo.
- **Your pass is parallel and exploratory.** Bring your own opinions. We'll compare approaches and pull the best ideas from each.
- **Branch home:** `feat/communities`. PRs into it can come from any fork or branch.
- **Eventual deploy target:** `communities.brainstorm.world` (DigitalOcean droplet + CI/CD to be set up).

When you have something worth sharing, push it (or a fork of `feat/communities`) and let David know — even at sketch level, before it's perfect.
