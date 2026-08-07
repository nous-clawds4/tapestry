# PRD Seed: The Community Dictionary Loop

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/shared-concepts-adoption/audit.md`
**Anchor:** acceptance frame in `book.md` (owner's S-subset taxonomy, intake 2026-08-05, owner-confirmed at book open)
**Confidence:** high for §1–§4 (frame-grounded, all shipped); medium for §5 (rules read off the built surfaces)
**Date:** 2026-08-07

> A **reverse-engineered baseline** in PRD shape, built from what shipped. A strawman for the product team, not a ratified spec — adopt it as the starting point for `/discover` on the next phase and validate each section.

## 1. Product vision

`[FROM FRAME]` The owner's stated intent, verbatim from intake: *"prompting users to auto publish lots of shared concepts, the result being an ever-growing community dictionary."* The suite closes the loop in both directions between a personal knowledge graph and a community vocabulary: the system **observes** organic usage (z-tags), **nominates** concepts to adopt or offer (queues), lets the owner **ratify** every step (nothing auto-acts), makes published items **discoverable from both sides** (dual-z stamping), and distills the community's demonstrated usage into a **trust-gated dictionary** the owner can mint as a dated, signed offering.

`[INFERRED]` The differentiating stance vs. any centralized taxonomy product: no write-time gating, no canonical authority — trust is per-POV and computed at read time; the dictionary is *a POV's* dictionary, published deliberately, never a global truth.

## 2. Personas

- `[FROM FRAME]` **The instance owner** — curates their own concept headers, decides per concept: adopt / offer / keep private; the only writer of stances and snapshots. Every shipped action surface addresses this persona.
- `[INFERRED]` **The community author** — anyone publishing headers or filing z-usage; never gated, only aggregated. Their usage is the evidence every queue and the dictionary run on.
- `[INFERRED]` **The visiting reader** — consumes the public read surfaces (queues, dictionary, raw events); with a computed personalized POV, sees the dictionary through their own trust lens (house fallback disclosed honestly).
- `[UNKNOWN — product input needed]` Whether "customer" instances (enrolled POVs) are a distinct persona with their own dictionary-publication rights, or readers only.

## 3. Scope (as-built)

`[FROM FRAME]` — all six frame features shipped: the identity doctrine (BIBLE §31); coverage audit + guided disposition with the keep-private sentinel; the adoption queue (adopt/recognize/decline with a reversible dated ledger); the inverse queue ("mine to publish," evidence-split); publish-time dual-z stamping in the fixed-surface writers; the trusted dictionary (live per-POV view + owner-minted snapshots).

`[INFERRED]` — shipped beyond the frame, owner-driven: per-view explainers and tooltips in the owner's own words; click-through to raw events from every queue row; the twin picker constrained to *wireable* concepts (graph ∩ has-event); test residue made self-cleaning.

Explicitly out (recorded, not silent): the client-built-writer stamping sweep (stage 2, mapped); cross-instance snapshot consumption; W1 cross-deployment identity; ADR-0015 re-parenting; auto-publication of anything.

## 4. Domain model

`[INFERRED]` from concepts touched and stored shapes:

- **Concept header** (kind 39998, `39998:<pubkey>:<slug>`) — the unit of vocabulary; the owner's headers vs. foreign headers are the two populations every surface splits on.
- **b-tag postures** on a header: *wired* (pointer-b to an external shared concept), *self-declared* (pointer-b to itself = offered), *deliberately private* (the `b-tag-deferred` sentinel, W16), *undispositioned*. Pointer ≠ inherit: correspondence never implies definitional deference or consensus weight (ADR 0029 boundary, honored by every aggregate here).
- **z-usage** — an event carrying `["z", <header coord>]` files under that concept; the cross-author rule (author's own filings never count) defines "community usage" everywhere.
- **Adoption stance** — a dated, supersedable, local element (`adoption disposition` concept): declined / requeued per foreign concept; newest-per-target wins.
- **Registry record** (`shared concept` concept) — "known and catalogued," identifier-linked, no affiliation claimed.
- **Trusted dictionary** — derived, never stored: headers with ≥ N *distinct qualifying authors* (influence above the verified cutoff, from the active POV; header-author and TA excluded). **Snapshot** — a dated TA-signed element (`trusted dictionary snapshot`) embedding members + parameters + `derivation: 'z-usage'`.
- **Twin** — one of the owner's own wireable headers (graph-present ∧ event-present), the target a pointer-b lands on at adoption.

## 5. Design rules (as-built)

- `[FROM FRAME]` **The proposal loop:** the system nominates, the owner ratifies; *"Nothing happens on its own"* is on the page itself. Publication (snapshots, offers) is always an explicit click.
- `[INFERRED]` **Per-POV honesty:** every trust-scored read disclosures what ran (`pov.branch`, `fellBackToHouse`) rather than silently substituting.
- `[INFERRED]` **Visibility over deletion:** declines are reversible and listed; kept-private-but-used sits behind a reveal, never vanishes; raw events are one click away from any row.
- `[INFERRED]` **Explainers in owner voice:** each view says what it is and what the buttons do (the owner personally worded the adoption explainer); columns and actions carry hover semantics (z-tag mechanics spelled out).
- `[UNKNOWN — product input needed]` No recorded rule for information density / progressive disclosure beyond these instances — a style-guide decision if the area grows.

## 6. Carry-forward & open questions

Promoted from audit §6: the F4 stage-2 writer sweep (mapped, owner-extendable); snapshot lifecycle (consumption of others' snapshots, retention, diffing); personalized-POV enrollment/UX; wire-archaeology cleanup (ledgered); queue polish seeds (declined-then-wired listing, event-id recognition staleness, raw-event links elsewhere, element retraction); cutoff consolidation (parked cross-book); W1/W13/ADR-0015 protocol trajectories.

## 7. What product must validate

- [ ] **Dictionary positioning:** is the snapshot a private offering, a public artifact other instances should *consume*, or the seed of a federated vocabulary? (Consumption is unbuilt by design.)
- [ ] **Threshold semantics as defaults:** N=2 distinct trusted authors and the batch-side 0.01 cutoff were engineering-ratified defaults — do they match the product's bar for "the community uses this"?
- [ ] **Cadence:** click-to-mint only, or does any workflow want scheduled/reminded snapshots (explicitly rejected for v1 — revisit deliberately)?
- [ ] **The customer story:** do enrolled POVs get their own dictionaries/offers, or is this owner-only? (§2 unknown.)
- [ ] **Stage-2 stamping reach:** which client-built writers matter enough to sweep next (ADR 0004's map is priority-ready)?
- [ ] **Community-side surfaces:** everything shipped serves the owner's side of the loop; what does the *community author* see of adoption/usage of their concepts (beyond raw events)?
