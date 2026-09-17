# PRD Seed: Growing a Tapestry in place (add-only membership editing)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/add-a-concept-to-a-tapestry/audit.md`
**Anchor:** acceptance frame in `book.md` — **goal-derived** (operational Direction): the frame was transcribed verbatim from the owner-ratified goal `add-a-concept-to-a-tapestry`, not hand-authored and not reverse-engineered at close
**Confidence:** **medium-high** for scope and behavior (the frame is the owner's own ratified words, and everything shipped is verified live on local); **low** for vision and personas (never stated beyond the goal's one-line prompt — inferred and flagged)
**Date:** 2026-07-28

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the goal-derived acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. The product team adopts this as the starting point for the next phase and validates each section.

## 1. Product vision

`[FROM FRAME]` The owner of a Tapestry instance can grow a Tapestry they are looking at: add a concept it doesn't yet have, save, and the Tapestry — at its same address — shows the new concept to them and to anyone who opens it afterwards.

`[INFERRED]` The larger arc this sits in: Tapestries are owner-curated, self-describing collections of concepts (the `tapestries` epic built browse → explore → create → per-concept depth → now the first slice of *edit*). Before this book, membership was frozen at creation; the only way to include one more concept was to create a whole new Tapestry. The vision implied by the goal's prompt (*"let the owner add a concept to a Tapestry from the Tapestry view"*) is a living collection that accretes over time, curated in place.

`[UNKNOWN — product input needed]` Why *adding* came first (vs. remove/rename/integrations), and what the owner ultimately wants a grown Tapestry *for* (presentation? navigation? teaching?) — never stated anywhere in the record.

## 2. Personas

- **The instance owner (curator).** `[FROM FRAME]` The acting user, strictly. The frame's first person (*"my own key or my assistant one"*) was ratified during the run to mean the owner's key and the instance's Tapestry Assistant (TA) — matching the goal's prompt and story #3's curator precedent. Only a session classified `owner` is ever offered the affordance.
- **Every other visitor (passive beneficiary).** `[FROM FRAME]` Signed-out sessions, guests, non-owner users: they see the grown membership when they open the Tapestry afterwards. They are never offered the edit.
- **The admin-who-is-not-the-owner (excluded, with a recorded seam).** `[INFERRED]` This classification exists in the system and *can create* a Tapestry (story #3's shipped gate admits owner-or-admin) but *cannot add* to one (this story's ratified gate admits the owner only). The asymmetry is deliberate and documented (ADR tapestries/0005), not an accident — but it is a persona-level inconsistency the product team should either ratify or erase.

## 3. Scope (as-built)

`[FROM FRAME]` — all shipped and verified:

- From the existing per-Tapestry Exploration page (`/tapestry/tapestries/<uuid>`), the owner can add **one concept per save** that is not already a member; the flow repeats to add more.
- Works on Tapestries authored under the **owner's key or the TA's**; the save republishes under the Tapestry's **existing author key** through the publish paths that already existed (owner key → signed in the browser; TA → assistant-signed via the existing publish endpoint).
- After save, the page **re-reads the published truth** (no optimistic UI) and shows the new member; any other session opening the same address afterwards sees it too.
- A Tapestry published by anyone else, or any non-owner viewer: **the option is simply not offered**.
- **No new page, no new route, no new server endpoint, no new dependency.**

`[FROM FRAME]` — explicitly out of scope (the boundary's own words):

- Removing a concept; changing how concepts connect (integrations); editing title/description or any non-membership field.
- Editing a Tapestry published by someone else — including *whose key* could republish it (an unsettled question with its own goal).

`[INFERRED]` — additional as-built properties worth knowing:

- A **graph-less legacy Tapestry** (one published without any `graph` block — the instance's only real Tapestry was exactly this) gets a first-add offer that creates the minimal envelope; the first add "un-degrades" it. A *malformed* graph gets no affordance.
- Duplicate members are impossible by construction (picker excludes members; the transform independently refuses duplicates and slug collisions).
- "Everything else unchanged" is structural: the replacement event is a verbatim copy plus exactly one appended member (+ its import) — authored integrations, unknown fields, tag order, title/description all pass through byte-identical.
- Batch-add is not offered (the frame's promise is singular); repeat-the-flow is the supported path.

## 4. Domain model

`[INFERRED]` from the concepts touched and the stored shapes (all handles use the runtime-resolved TA pubkey — never a literal):

- **Tapestry** — `39998:<TA>:tapestry`. An *instance* of one is a kind-39999 addressable element z-tagged to this handle; its identity is the coordinate `39999:<author>:<d-tag>`, which survives edits (relay-native replacement: same kind + author + d-tag, newer `created_at` wins — there is no reindex step; the graph database is not in the read path).
- **Membership** — the element's own `json.graph` block: a member is a node (`uuid: 39998:<TA>:<slug>`) plus an import (`39999:<TA>:<slug>-concept-graph`, resolved at read time by the Exploration page). Same member shape create uses.
- **The signing branch is data, not a decision** — the Tapestry's author pubkey selects owner-browser-signing vs assistant-signing.
- **Concurrency model** — last-write-wins at whole-event granularity (accepted: the actor is a single owner).
- No concept definitions changed; no firmware reinstall; no schema change; no new event kinds.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI and the review record (no product-team design guide exists for this surface):

- **The affordance lives inside the existing page** (sidebar "Concepts" section), reusing the create screen's typeahead idiom and CSS — a textbox named by the ask's own words ("Add a concept"), matches rendered as `Add <name>` buttons; **picking a result performs the save**.
- **Absence over explanation:** ineligible viewers/tapestries get no affordance at all — nothing disabled, nothing to explain.
- **Truth over optimism:** post-save visibility comes from re-reading the same coordinate every other session reads — the owner's view *is* the published truth.
- **Errors are inline and legible**, in the transform's/publish path's own words; membership is untouched on every failure path; a busy-guard prevents double-submit.
- `[UNKNOWN — product input needed]` No visual-design or copy rule was ever recorded for this surface beyond "follow the sibling idiom"; if Tapestry editing grows, a real guide is owed.

## 6. Carry-forward & open questions

Promoted from build audit §6 (see there for sources):

- **The rest of Edit a Tapestry** (the epic's own future list): remove a member; author/alter integrations; edit title/description.
- **Editing Tapestries published by someone else** — whose key may republish is unsettled and separately goaled; deliberately not answered here.
- **The two-curator-gates seam:** admin-not-owner can create (#3) but not add (#5). Harmonizing "who curates" epic-wide is separately-goaled work.
- **Demonstrations deliberately left to the operator:** a live add on staging (smoke there was read-only by rule) and the owner's real NIP-07 click-through (no signer in any automation browser — covered by mocked browser tests + the real-data local add).
- **Promotion to `main`** — nothing from this book is on production; that call is the operator's.
- **External co-publish for TA-signed tapestries** remains out (inherited from create); a TA tapestry's reach is the local relay.
- **Legacy `name`-tag divergence** (slug vs title on old events) passes through unchanged — normalizing it would be an edit beyond adding.
- **~71 unread Tapestry rows in Neo4j** — recorded on the evidence goal; explicitly nobody's problem in this book.
- **POV/WoT filtering** of the directory / who sees what (epic-level continuity, untouched).

## 7. What product must validate

- [ ] **The owner-strict gate vs #3's owner-or-admin create gate** — ratify the asymmetry or unify it (it is currently a documented inconsistency an admin will eventually hit).
- [ ] **One-concept-per-save** — acceptable as the long-term interaction, or is batch-add wanted?
- [ ] **Non-owner users editing their *own* tapestries here** — currently excluded by the ratified reading of "my" (owner only); is that the product intent for a multi-user instance?
- [ ] **What comes next in Edit a Tapestry** — remove? integrations? rename? (each is separately-goaled work under the owner's Direction model).
- [ ] **Whether the Tapestry surface needs a design/copy guide** before more editing affordances accrete idiom-by-idiom.
- [ ] **Persona ground truth** — §1/§2's inferences about what Tapestries are *for* have never been validated with the owner.
