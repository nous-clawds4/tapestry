# PRD Seed: Reputation explainer (profile point-of-view transparency)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/reputation-info-popup/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high *(explicit acceptance frame; small, fully-verified feature)*
**Date:** 2026-06-14

> A reverse-engineered baseline in the product-team PRD shape, built from what shipped. A strawman for the product team — not a ratified spec. Sections are tagged `[FROM FRAME]` (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. Adopt as the starting point for `/discover` on the next phase and validate each section.

## 1. Product vision
`[FROM FRAME]` Make the reputation numbers on a profile **self-describing**: a reader should be able to learn, in plain language, where the scores come from without leaving the page. `[INFERRED]` The underlying opportunity: the profile shows Web-of-Trust reputation scores that *shift with the selected point of view* (House vs Personalized), and nothing on the page previously explained that — leaving the numbers opaque or easy to misread as a single global truth. `[INFERRED]` This extends an existing pattern: the page already had a "Verified" ⓘ explainer; this brings the same affordance to "Reputation."

## 2. Personas
`[FROM FRAME / INFERRED]` Story line: *"As someone viewing a public profile page…"* — the primary persona is a **profile visitor** (both authenticated and anonymous), not the profile owner or an operator. They want to understand what the reputation numbers mean and that they reflect a point of view. `[UNKNOWN]` Whether distinct sub-personas (e.g. newcomers vs. power users who already grok the Grapevine) warrant different treatment.

## 3. Scope (as-built)
`[FROM FRAME]` In scope, shipped:
- A circled-"i" ⓘ control beside the profile "Reputation" heading, visually/behaviorally consistent with the existing "Verified" control.
- A dismissible popup (acknowledgement button + overlay-click to close).
- Static explanatory copy: the scores reflect a Web-of-Trust point of view — either the House (default) or the viewer's Personalized PoV, depending on which is currently selected.
- Accuracy boundary: the copy is scoped to the Reputation-section scores and makes no claim about the separate Following / Verified Followers / Verified Reporters counts (which are Owner-PoV, a different source).
- Additive/presentational only — no change to how scores are computed, fetched, namespaced, or displayed.

`[FROM FRAME]` Explicitly **out of scope** this phase: dynamically naming the *active* PoV; any backend/API change; adding the explainer to other pages.

## 4. Domain model
`[INFERRED]` from the Concept Graph orientation and ADR 0034:
- **Web of Trust** (`web-of-trust`) — the reputation model; "each user sees a personalized view of the network weighted by the people they trust."
- **GrapeRank** (`graperank`) — the contextual WoT scoring algorithm behind the Reputation-grid numbers.
- **House point of view** vs **Personalized point of view** — product/UI notions (NOT modeled as Concept Graph nodes). House = the instance default (its delegated pubkey); Personalized = the viewer's own, selected via the `?pov=` URL parameter. Per BIBLE §27 / ADR 0033, the profile's Meilisearch-sourced Reputation grid is legitimately House/Personalized, whereas the top-of-page counts are **Owner** PoV (Neo4j) — a distinction this feature is careful to preserve.

## 5. Design rules (as-built)
`[INFERRED]` from the shipped UI + ADR 0034 + review:
- Info-explainers reuse the shared `bsp-info-btn` trigger + `bsp-confirm-overlay`/`bsp-confirm-box`/`bsp-confirm-ok` ("Got it") popup pattern, tap-to-open and mobile-friendly.
- A new explainer that needs no instance data is a self-contained, prop-free, hook-free component (no fetch).
- `[INFERRED]` Placement convention is unsettled: this ⓘ right-aligns at the heading edge (matching the Verified ⓘ's behavior); a "snug after the word" convention was considered but not adopted. `[UNKNOWN]` whether a single placement rule should be standardized for all info-controls.

## 6. Carry-forward & open questions
*(promoted from build audit §6)*
- Dynamic "which PoV is active" variant of the popup.
- Extract a shared `InfoPopover` primitive once a third explainer appears.
- PoV consistency across the rest of the profile — esp. Personalized PoV for the follows/followers *tables* (open intake 2026-06-06, item 6), which this feature's House-vs-Personalized framing now sits beside.
- Optional snug ⓘ placement; standardize an info-control placement rule.

## 7. What product must validate
- [ ] **Copy ownership:** the popup wording was chosen by the engineering Director under the book's delegation. Does the product team want to own/refine the final copy (tone, length, terminology like "Web of Trust" vs "Grapevine")?
- [ ] **Dynamic PoV naming:** is "explain in general" sufficient, or should the popup state which PoV the viewer is currently seeing? (Deferred this phase.)
- [ ] **PoV transparency strategy:** should this explainer be part of a broader, consistent treatment of House-vs-Personalized across the whole profile (counts + tables), rather than the Reputation section alone?
- [ ] **Reach:** should the same explainer appear on other surfaces that show PoV-dependent scores (e.g. `/reporters`, search results)?
- [ ] `[UNKNOWN]` Success signal: is there any measurable goal (comprehension, reduced confusion) the product team wants to attach, or is this purely a clarity improvement?
