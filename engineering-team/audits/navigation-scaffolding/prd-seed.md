# PRD Seed: Dictionaries and Trusted Agents

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/navigation-scaffolding/audit.md`
**Anchor:** acceptance frame in `book.md`, amended once mid-book
**Confidence:** **medium** — see the warning below
**Date:** 2026-09-08

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the
> product team**, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or
> `[UNKNOWN — product input needed]`.
>
> **Read the confidence honestly.** What this book *built* is high-confidence: navigation and seven
> placeholder pages, all shipped and verified in production. What this book *implies about the
> product* is not. Six of the seven pages are deliberately empty, so almost everything below §3 is
> inference from page titles and one paragraph of prose. The single substantial product input is the
> operator's dictionary-model text — and that arrived as a design statement, not a validated
> requirement. **The honest summary: this book delivered an information architecture and one
> written model. It did not deliver, or discover, a product.** That is the correct starting posture
> for `/discover`, not a deficiency to paper over.

## 1. Product vision

`[INFERRED]` Two product areas were given a shape in the navigation before either was designed.

**Dictionaries** `[FROM FRAME + operator prose]` — a dictionary is the shared vocabulary a trust
network *demonstrably uses*, as opposed to the vocabulary anyone has merely published. Three are
named: Tags, DLists, Concepts. The operator's own framing (verbatim on `/tapestry/dictionaries`,
baseline in `stories/done/navigation-scaffolding/3-*.md`):

- Each dictionary **is a concept**; each entry is an **element** of that concept. For users without
  their own neo4j, the fallback shape is: each dictionary is a **DList Header**, each entry an
  **item** on that dlist.
- The primary criterion for entry is **usage and acceptance by the community**. How that is
  measured varies per dictionary and may change over time — for Tags, plausibly direct usage,
  b-tags, and/or pins.
- Because those criteria are computed, entries can be added and removed **automatically** — which
  requires a property on the DList/Concept Header flagging entries no longer considered valid.
- A second route in is **hand-curation by the dictionary's steward** (for Tapestry, typically the
  instance owner), which **overrides** community criteria — which requires a per-entry
  added-by-hand field so automated scripts don't undo it.

**Trusted Agents** `[UNKNOWN]` — three page titles (Mine, All, Set Up) and one sentence: Set Up is
where a **Sponsor** is paired with an **Agent**. Neither term exists in the concept graph. Nothing
else about this area has been stated.

`[UNKNOWN — product input needed]` The problem either area solves for a user was never articulated.
Dictionaries has an implicit one ("which vocabulary is real?"); Trusted Agents has none on record.

## 2. Personas

`[INFERRED]`, thinly — the stories were written "as the operator," which is a role, not a persona.

- **The instance owner / steward** `[FROM FRAME]` — has their own neo4j, curates dictionaries by
  hand, and is the only actor whose behaviour the shipped work actually models.
- **A signed-in user without their own neo4j** `[INFERRED]` — explicitly named in the dictionary
  prose as needing the DList-header fallback. This book made every navigation destination visible to
  them, but built nothing that treats them differently.
- **A signed-in user with no provisioned assistant** `[INFERRED from as-built]` — sees "My
  Assistant's Profile" disabled with an explanation. A real state with a real dead end (§7).

`[UNKNOWN]` Whether a "Sponsor" is a persona, a role, or an entity.

## 3. Scope (as-built)

`[FROM FRAME]` **In scope and shipped:**

- Two collapsible sidebar sections below Shared Concepts, un-gated: Dictionaries (Dictionaries ·
  Tags · DLists · Concepts) and Trusted Agents (Mine · All · Set Up).
- Seven placeholder pages; six state plainly that they are placeholders.
- The dictionary-model explainer on the Dictionaries index, verbatim.
- One shared destination list across all three avatar menus: five personal destinations (My Profile,
  My Assistant's Profile, My Treasure Map, My Trusted Agents, Dictionaries) and three front doors
  (Brainstorm Landing Page, Tapestry Dashboard, Legacy Dashboard).
- Every one of those visible to **every signed-in user** — previously three were owner/admin-only.
- Legacy page navigation untouched.

`[FROM FRAME]` **Explicitly out of scope, and genuinely absent:** any data access, POV filtering, or
trust scoring on the new pages; any definition of what a Dictionary or a Trusted Agent *is*; the
pairing flow; and everything the explainer describes — the validity flag, the added-by-hand field,
the usage measures, the DList fallback. Review #3 confirmed the diff touches no file outside `ui/`
and harness markdown.

## 4. Domain model

`[INFERRED]` from the operator's prose only. **Nothing below is implemented.**

| Entity | Shape | Relationships | State |
|---|---|---|---|
| **Dictionary** | A concept (owner) *or* a DList Header (no-neo4j user) | has many Entries | proposed |
| **Dictionary Entry** | An element of that concept *or* an item on that dlist | belongs to one Dictionary | proposed |
| **Entry validity flag** | A property **on the header**, marking entries no longer valid | per-entry, header-specified | proposed — required by automatic removal |
| **Added-by-hand flag** | A per-entry field recording steward curation | per-entry | proposed — required so scripts don't undo curation |
| **Steward** | For Tapestry, typically the instance owner | curates a Dictionary | proposed |
| **Sponsor**, **Agent** | — | Sponsor is *paired with* Agent | `[UNKNOWN]` |

Existing concepts in the neighbourhood, none wired: `tag`, `list`, `concept header`,
`trusted dictionary snapshot` (the shipped precedent for a dated, attributed materialization),
`tapestry assistant`.

**Two modelling hazards the engineering reviewer flagged for whenever this is built** (audit §6 #5) —
these are architecture-invariant questions, not wording quibbles:

1. **"usage and acceptance by the community" is POV-relative.** There is no global "the community"
   (CLAUDE.md §1). It resolves through the active POV's WoT columns, and two POVs will legitimately
   see different dictionaries. A single stored dictionary per instance would contradict the
   architecture.
2. **"the steward … will override community-based criteria" reads as an admin gate.** Under
   CLAUDE.md §2, publishing is permissionless: hand-curation should be modelled as *anyone's*
   publishable assertion that a given POV may or may not weigh, with the instance owner's
   assertions simply being the ones the house POV weighs heavily.

Both are resolvable, and both should be settled in whatever ADR implements the flags — deliberately,
not by inheriting this page's phrasing.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI:

- **A section appears in the navigation before its pages exist**, and each page says so plainly
  rather than rendering an empty shell. Rationale on record: the operator wanted the information
  architecture visible and arguable ahead of the surfaces.
- **New sections are not owner-gated**, matching the Shared Concepts group they sit beneath.
- **A group whose children have no index redirects its bare prefix** rather than 404-ing.
- **The same destinations appear in every avatar menu**, from one list, differing only in where
  profile links point (`/user` on the Brainstorm side, `/tapestry/users` on the Tapestry side).
- **An unavailable item stays visible and explains itself** rather than disappearing — so the menu
  reads identically for every signed-in user.
- **Visibility is not a security control.** Owner/admin gating was removed from navigation on the
  explicit reasoning that hiding a link never restricted access.

`[UNKNOWN]` No design guide was ever written. These are patterns read off one book.

## 6. Carry-forward & open questions

Promoted from build audit §6:

1. **Assistant provisioning for non-owner users** — the menu advertises the destination and explains
   its absence, but nothing gets a user from one state to the other.
2. **Sponsor/Agent pairing is undefined** — three pages now promise it.
3. **The dictionary model exists only as page prose** — not an ADR, schema, concept, or protocol
   note. Ratify it into a binding form before building against it.
4. **Four pairs of same-named surfaces**: Dictionaries→Concepts vs 🧩 Concepts; Dictionaries→Tags vs
   `/tags`; Dictionaries→DLists vs 📋 Simple Lists; Dictionaries vs Shared Concepts→Trusted
   Dictionary. **This is the sharpest product question this book leaves.** A user now sees two
   things called "Tags" in one app.
5. **The POV and permissionless-publication hazards in §4** — settle in the implementing ADR.
6. **`/legacy/*.html` has no server-side auth check** — gate-or-retire, now that every signed-in user
   can see the link (`_intake.md`, 2026-09-08).

## 7. What product must validate

- [ ] **What problem does a Dictionary solve, for whom?** The mechanism is well-specified; the need
      is not stated anywhere.
- [ ] **How does a Dictionary differ from the existing Trusted Dictionary** (`shared-concepts/dictionary`,
      backed by the shipped `trusted dictionary snapshot` concept)? If it doesn't, one of them should
      go. If it does, the names must.
- [ ] **Is a dictionary per-POV or per-instance?** §4 hazard 1 makes this a fork in the architecture,
      not a detail.
- [ ] **What is a Trusted Agent, and what is a Sponsor?** Everything here is `[UNKNOWN]`.
- [ ] **What does "Mine" vs "All" mean for agents** — my WoT's view vs the instance's, or mine vs
      everyone's?
- [ ] **Should hand-curation be an owner privilege or a publishable assertion?** §4 hazard 2.
- [ ] **What are the usage/acceptance measures for each of the three dictionaries**, concretely
      enough to compute? The prose names candidates for Tags only (direct usage, b-tags, pins).
- [ ] **Do non-owner users get dictionaries at all**, given the DList-header fallback is described
      but unbuilt?
- [ ] **Should a user without an assistant be able to get one?** (§6 #1)
