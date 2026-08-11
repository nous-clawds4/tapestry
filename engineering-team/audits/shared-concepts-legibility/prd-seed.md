# PRD Seed: Knowing what you've shared with the community

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/shared-concepts-legibility/audit.md`
**Anchor:** acceptance frame in `book.md` (owner-confirmed at kickoff, 4/4 bullets met)
**Confidence:** medium-high — the frame is a real anchor and every bullet is verified in production, so §3 is solid. §1–§2 are inferred from one owner's walkthrough of their own instance; no other user has touched these surfaces.
**Date:** 2026-08-10

> **Forward pointer (2026-08-10):** the surfaces below are described by the names they carried at
> this book's close. `shared-concepts-seeding` story #2 later retired the "offering" vocabulary —
> **My Offerings → Shared by me**, **Community Offerings → Shared by others**, and the
> declared-but-unsent state became a failure-to-retry rather than a category. This record is left
> accurate as of its close rather than retconned.


> A **reverse-engineered baseline** in the PRD shape, built from what shipped. A strawman for the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A Tapestry instance can publish its concepts to a shared community vocabulary. The instance's operator must be able to tell, at a glance, **what they have offered and whether it actually arrived** — without clicking a button to find out, and without a surface ever claiming more certainty than it has.

`[INFERRED]` The underlying problem is *asymmetry of evidence*. Declaring a concept and broadcasting it are two steps; the second can fail silently. Before this book, the only way to learn a concept's state was to press the button that changes it. The product bet is that a decentralized vocabulary only accumulates if contributors can see their own contributions — otherwise offerings are made, quietly lost, and never retried.

`[UNKNOWN — product input needed]` Whether the goal is *contribution volume* (many instances offering many concepts) or *convergence* (many instances agreeing on few). The surfaces built here serve the first; the Trusted Dictionary serves the second. Nothing states which matters more, and that choice should drive whether the next phase optimizes for offering or for adopting.

## 2. Personas

`[INFERRED]` from the kickoff scenario and the stories' "As the owner" lines. The kickoff used four named instances — an expert (a veterinarian with a cat-breed taxonomy) and three non-experts who want to benefit from her work.

- **The instance operator (primary, and the only one served today).** Runs their own Tapestry, authors concepts, decides what to share. Every surface in this book is theirs, and all are owner-gated for writes.
- **The domain expert** `[INFERRED]` — an operator whose concepts others want. The kickoff's motivating case. **Notably, this book did not make her job easier**: it made her *state visible*, not her *contribution easy*. See §6.
- **The community consumer** `[UNKNOWN]` — instances that adopt others' concepts. Served by pre-existing surfaces (Adoption Queue, Community Offerings), untouched here. No persona work has been done on them.

## 3. Scope (as-built)

`[FROM FRAME]` All four kickoff bullets, verified in production:

1. A concept's page states its sharing state on load, without interaction.
2. One page lists every concept this instance has offered — **including any that never reached the relay**.
3. Surfaces distinguish *declared here* from *reached the community*, and say which they are showing.
4. Labels distinguish **offering** from **adopting** from **cataloguing**.

`[INFERRED]` Two rules the build settled that the frame did not state, and that the product team should treat as candidate product principles:

- **"Shared" means published, not intended.** An owner ruling. It cost a relay round trip per concept-page load and added two user-visible states, and it is the reason the product can be trusted about its own history.
- **Never assert a state you could not confirm.** A relay that cannot be reached yields *unconfirmed*, never *not shared*. Implemented as a tri-state end to end and enforced by test.

`[INFERRED]` **Out of scope as built:** offering a concept from anywhere other than its own page or a buried disposition panel; any bulk "what haven't I offered?" view; anything about *adopting*.

## 4. Domain model

`[INFERRED]` Unchanged by this book — it reads existing structures rather than adding any.

- **Concept header** (`kind 39998`, one per concept, authored by an instance's assistant). Its `b` tags carry the affiliation:
  - **pointing at itself** → *offered* (a self-declaration)
  - **pointing at another header** → *wired* (adopting someone else's)
  - **the reserved `b-tag-deferred` sentinel** → *deliberately private*
  - **absent** → undispositioned
- **Two stores, one question.** The same test — *does this copy carry a b-tag pointing at itself?* — asked of the local relay (*declared here*) and the community relay (*shared*). Their divergence is the product's core new fact.
- **Registry element** (`kind 39999`) — a catalogue entry for someone else's shared concept. Distinct from offering; the vocabulary pass exists because the two were confusable.

`[UNKNOWN — product input needed]` The community relay is hardwired (`wss://dcosl.brainstorm.world`, now six call sites). The owner has said the eventual source is a relay set from the concept graph. Whether "the community" is one relay, a per-concept set, or per-POV is unresolved — and it determines whether "shared" is one boolean or many.

## 5. Design rules (as-built)

`[INFERRED]` — no design guide exists; these were derived during the build and are worth ratifying or overriding.

- **Name a surface for the verb that produces its data.** Registry / Add to Registry / My Offerings / Community Offerings / Adoption Queue all follow it.
- **Except wire inspectors, which are named for the tag.** `Active b-tags` / `Active z-tags` were reviewed and kept: for a tool whose job is showing raw tags, the mechanism *is* the question, and a friendlier name would hide what the page is.
- **State before action.** A surface offering an action states the current state first, and the action's wording derives from it (*Submit* vs *Re-submit to the community*).
- **A confirmation must say why it is unnecessary.** The re-submit dialog states both that the concept is already submitted and that re-submitting is typically not needed.
- **Distinguish "no data" from "could not ask."** Applied per-row and, where a single failure explains every row, once at page level.

## 6. Carry-forward & open questions

Promoted from audit §6, in the order the product team is likeliest to care:

- [ ] **The expert still can't easily contribute.** The kickoff's motivating persona ends the book able to *see* that her cat-breed concept is unshared — and with no surface inviting her to share it. The capability exists (concept page, disposition panel) but nothing suggests it. **A successor book is already scoped and owner-ratified**: an "Offer a concept…" affordance on My Offerings, a bulk "not yet offered" filter, and a defect fix (below).
- [ ] **One offering path currently lies.** `declareAndBroadcast` reports *"Submitted as a shared concept"* whether or not the broadcast reached the relay — it discards the publish result, including the local-only gate flag. The concept page's own handler gets this right; the disposition panel does not. This is the exact state the book built two surfaces to reveal, misreported by a third.
- [ ] **Is one relay "the community"?** See §4.
- [ ] **Nothing is measured.** No instrumentation was added, so there is no evidence whether these surfaces change behavior — whether operators offer more, or retry failed broadcasts. If contribution volume is the goal (§1), this is the gap that matters most.
- [ ] Engineering debt that does not need product input: story 1's local-read swallow, `fetchFromRelays`'s tri-state for eight callers, the community directory's fetch-everything, the unsafe `stateOf` fall-through, the blank concept page (OPEN.md #159).

## 7. What product must validate

- [ ] **§1 — contribution volume or convergence?** The single choice most likely to redirect the next phase.
- [ ] **§2 — is the domain expert a real persona or a scenario device?** The whole kickoff rested on her, and the book served the *operator* instead. If she is real, the seeding successor is the priority; if she was a narrative device, the priority may be adopting rather than offering.
- [ ] **§5 — ratify or override the naming rules.** They were settled mid-build by engineering, not by product, and they now govern eight nav entries.
- [ ] **§6 — should anything be instrumented?** No telemetry exists on any of these surfaces.
- [ ] **§3 — is "shared = published" the right bar for every future surface?** It cost a relay round trip per page load. Somewhere there is a surface where that cost outweighs the honesty, and no rule says where.
