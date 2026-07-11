# PRD Seed: Verified Muters (profile negative-reputation metric)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/verified-muters/audit.md`
**Anchor:** acceptance frame in `book.md` *(Direction-mode, operator-armed + operator-ratified)*
**Confidence:** high *(grounded in a tight, operator-confirmed acceptance frame plus live staging evidence; the `[INFERRED]` items are the product framing around a well-specified build, not guesses about behavior)*
**Date:** 2026-06-21

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. The product team adopts this as the starting point for `/discover` on the next phase and validates each section.

## 1. Product vision

`[FROM FRAME]` **Verified Muters** is a fifth point-of-view-filtered metric on the user profile, alongside Following / Verified Followers / Hops / Verified Reporters. It shows how many *verified* users — those clearing the same GrapeRank verification bar the sibling metrics use — have **muted** the observed account, and links to a page listing exactly who they are.

`[INFERRED]` The opportunity: muting is a *negative reputation signal*, and a viewer assessing a profile wants the same trustworthy, point-of-view-filtered read on "who-trusted-by-the-house has muted this account" that they already get for follows and reports. By restricting to *verified* muters (trusted accounts), the signal is meaningful rather than noisy — being muted by trusted users is rare and informative. Verified Muters is presented as a "bad" indicator, but deliberately **neutrally**: its negative character is conveyed only by *grouping* (a line break placing it with Verified Reporters), never by alarm styling.

`[UNKNOWN — product input needed]` The underlying user problem/job-to-be-done was never stated as a problem statement — it was specified directly as a feature ("mirror Verified Followers, for the mute relationship"). Whether the priority is moderation triage, trust assessment, or symmetry/completeness of the reputation row is a product judgment to confirm.

## 2. Personas

`[INFERRED]` from the story "As a..." lines and the frame:

- **Profile viewer / trust assessor** — someone reading a profile to judge its standing, who already reads Verified Followers and Verified Reporters and wants the mute signal in the same familiar shape. (Story 2: "so that I can read a profile's negative reputation signals the same familiar way I already read its verified followers.")
- `[INFERRED]` **Surface-builder / downstream engineer** — Story 1's "As someone building the Verified Muters profile surface" persona is an internal/implementation audience, not an end user; it reflects the backend/frontend story split, not a distinct product persona.

`[UNKNOWN]` Whether moderators / instance operators are a distinct persona with different needs (e.g. wanting the *unverified* or *full* muter set for moderation) — not addressed in v1.

## 3. Scope (as-built)

`[FROM FRAME]` In scope, shipped and verified on staging:

- A **"Verified Muters" counts-row metric** on the profile, positioned **after Hops, before Verified Reporters**, with a **visual line break** separating the good indicators (Following / Verified Followers / Hops) from the bad ones (Verified Muters / Verified Reporters).
- The badge renders **neutrally, like Verified Followers** — always a plain clickable link, no red alarm icon, no negative/red styling. Its "bad" status is conveyed only by the line-break grouping.
- The metric **links to a list page** at its own bookmarkable URL (`/user/:pubkey/muters`), parallel to the followers/reporters sub-pages, listing the verified users who muted the account.
- The list page shows the **same columns and default sort as the Verified Followers list** — **no** report-specific columns (no Report Type, no Reported timestamp) — with the same empty-state treatment (not an error) when there are none.
- The count is determined by the **same verification bar** (the GrapeRank muter influence cutoff) and **equals the number of rows** on the linked list page.
- **Owner/House point-of-view only** in v1 — the `?pov=` param does not alter these counts.

`[FROM FRAME]` Explicitly **out of scope** for v1 (deferred, see §6):
- Per-point-of-view / customer (personalized) muter counts.
- Any muter alarm threshold or red-flag styling (neutral by design).
- An unverified / all-muters view.
- Any change to mute ingestion, the `:MUTES` projection, the count precompute, or the GrapeRank config (all consumed as-is).

## 4. Domain model

`[INFERRED]` from the concepts touched, ADRs, and stored shapes:

- **NostrUser** — both the observed account and each muter; identified by pubkey, carrying runtime metrics `influence`, `hops`, and the precomputed `verifiedFollowerCount` / `verifiedMuterCount` / `verifiedReporterCount`.
- **MUTES edge** — a first-class Neo4j relationship `(muter:NostrUser)-[:MUTES]->(mutee:NostrUser)`, projected from kind-10000 mute lists, symmetric with `:FOLLOWS` (kind 3) and `:REPORTS` (kind 1984). Unlike `:REPORTS`, a `:MUTES` edge carries **no per-edge sub-type or timestamp** — which is why the list mirrors Verified *Followers*, not Verified Reporters.
- **Verification bar** — the GrapeRank `VERIFIED_MUTERS_INFLUENCE_CUTOFF` (default 0.05): a muter "counts" iff `muter.influence > cutoff`. The same cutoff governs both the precomputed count and the live list, which is what makes count == list length hold within the read path.
- **Point of view** — "verified" is computed from the owner/House GrapeRank vantage in v1; a non-owner observer is refused (400) rather than served a wrong-PoV answer (POV-first invariant).
- `[INFERRED]` Concept-graph status: the named concepts (`web-of-trust`, `graperank`, `nostr-user`) are abstract class-thread definitions; the muter edge, the count property, and the cutoff are runtime Neo4j properties — **no concept/schema/firmware change** was needed.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI and the ADRs/reviews:

- **Mirror the sibling, don't invent.** Verified Muters mirrors Verified **Followers** in every delegated detail — list title, empty-state and loading copy, default-visible columns, default sort, URL scheme — so a viewer sees a shape they already know.
- **Negative signal by grouping, not by alarm.** "Bad" indicators are separated onto their own row via a zero-size `flex-basis:100%` line break; the badge itself stays neutral (no red, no icon, always a link, never hidden at 0). The Verified Reporters red-alarm treatment is deliberately **not** ported.
- **Owner/House-PoV consistency.** The new metric carries the same v1 PoV limitation as its siblings; behavior is consistent across the whole counts row.
- **Isolation over premature DRY.** Each metric's read path and list page is an isolated near-copy (zero regression risk to live siblings); consolidation is a deliberate later refactor, not a v1 cost.
- `[UNKNOWN]` No formal design-system / styling guide was recorded for the counts row beyond "mirror Verified Followers"; the rules above are read off the as-built and the ADR rationale.

## 6. Carry-forward & open questions

Promoted from build audit §6:

- **DRY consolidation** — the `<GrapevineList>` + shared-cypher-builder refactor now has a 4th near-duplicate set (follows/followers/reporters/muters); strongest candidate yet to absorb them.
- **Per-PoV / customer (personalized) muter counts** — the `?pov=` path, deferred across all four sibling metrics; the obvious next increment if personalized reputation is a goal.
- **Unverified / all-muters view** — only the verified set ships; a full or unverified muter view is unbuilt and unscoped.
- **Cutoff source-of-truth** — the verified-influence-cutoff inconsistency (0.01 vs 0.05 vs "score>2") and the batch-precompute-vs-live-query skew are sibling-wide questions inherited, not resolved (noted in the profile-followers handoff lineage).
- **Prod promotion** — live on staging, prod-held; stacks behind other staging-held bundles. Sequencing is a release decision.

## 7. What product must validate

- [ ] **The underlying problem/job** behind Verified Muters (moderation triage vs trust assessment vs reputation-row symmetry) — never stated; confirm before this seed becomes a real PRD. (`[UNKNOWN]` §1)
- [ ] **Whether a moderator/operator persona** needs the *unverified* or *full* muter set — v1 surfaces verified-only. (`[UNKNOWN]` §2)
- [ ] **Whether personalized (per-PoV) muter counts** are a near-term product goal or remain deferred indefinitely. (carry-forward §6)
- [ ] **Whether the deliberate neutrality** (no alarm, signal-by-grouping-only) is the intended long-term treatment for negative indicators, or a v1 stance to revisit. (design rule §5)
- [ ] **The cutoff-consistency decision** — whether unifying the verified-influence cutoff across metrics is product-visible or purely internal. (carry-forward §6)
