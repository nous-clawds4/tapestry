# PRD Addendum: verified-reporters — Verified Reporters MVP

**Reconciles:** `product-team/prd/verified-reporters.md` *(immutable — never edited)*
**Build audit:** `engineering-team/audits/verified-reporters/audit.md`
**Date:** 2026-06-07
**Authored by:** engineering (Reviewer at book scope)

> Stands beside the PRD; never edits it. Records where the built product diverged from the plan, why, and what the next product cycle should pick up. The product team reads this to scope the next phase, then issues a superseding `prd/verified-reporters-v2.md`.

## 1. Summary
The PRD set out the credible negative trust signal: a PoV-filtered Verified Reporters count on the profile, linking to a list of *which* verified users reported the account. All of §8.1 (the MVP) shipped and is reviewed-PASS: the count (parallel to Following/Verified Followers, negative-signal, designed zero/loading/unavailable states), the membership endpoint, and the list page. The headline divergence is about **point of view**: the *count* is per-viewer (as planned), but the *list membership* shipped **House/owner PoV only** — full per-viewer membership is the same customer-observer machinery the follows/followers features already deferred, and it is the main carry-forward. Two PoV-attribution and granularity items were deferred as the PRD itself anticipated.

## 2. Deviations from the PRD

### 2.1 Intentional changes
- **List loading + error UX exceed the precedent.** The list page uses a skeleton loader and an error "Try again" retry (the hook gained a backward-compatible `refetch`), where the sibling follows/followers pages use a text loader and no retry. (PRD §5.2 asked for designed loading/error states; we went a step better.) Recommend the product model treat skeleton + retry as the standard for these list pages.
- **PoV attribution line is honest about House.** Because list membership is House-only in v1 (see 2.4), the list's PoV line always reads as the House view rather than "your web of trust." This keeps the no-global-view principle truthful rather than cosmetic.

### 2.2 Deferred (cut to a later phase)
- **Personalized / customer PoV for the list membership** → next phase. The list and its endpoint resolve the House/owner PoV only. (The count remains per-PoV.) This is the biggest gap vs the PRD's "relative to who is looking" for the *list*.
- **Counts-row PoV indicator** (the shared, tap-friendly marker for Following / Verified Followers / Verified Reporters) → **Phase 4**. No per-count PoV chip shipped; attribution lives on the list page only. (Already PRD §8.3 / §11 decision 5.)
- **Report-type breakdown** → **Phase 2**; **pile-on resistance** → **Phase 3**; **self-view privacy controls** → **Phase 4** — all per the existing PRD roadmap, unchanged.

### 2.3 Added beyond the PRD
- None product-visible. (Internally, the data hook gained a `refetch` to serve the retry — an implementation detail, not a new product capability.)

### 2.4 Constraints discovered
- **"Effective PoV (personal-else-House)" is cheap for the count but expensive for the list.** The count is read from a precomputed, per-PoV Meili field; the *list* must be computed live from the graph, and a per-viewer verified set requires the per-customer trust-metrics traversal that the platform has repeatedly deferred. So the PRD's implicit assumption that the list is per-viewer the same way the count is does not hold in v1 — the list is House-PoV. **Implication for the product model:** treat per-viewer *membership* as its own scoped phase, distinct from the already-shipped per-viewer *count*.
- **Count = list length is a steady-state/House guarantee, not real-time.** The profile count (precomputed Meili) and the list length (live graph) can differ transiently across a refresh. The list page shows its own live count to stay internally consistent. The PRD's success metric (count = list length) should be read as "consistent in steady state at House PoV," not "byte-identical to the profile badge at every instant."

## 3. Impact on the product model
- **Scope / roadmap:** add an explicit phase for **personalized-PoV membership** (the list/endpoint reading per-viewer trust), separate from the shipped per-viewer count. Keep the counts-row PoV indicator (Phase 4) and report-type/pile-on phases as planned.
- **Domain model:** make explicit that the verified-reporter *count* and the verified-reporter *membership* come from two surfaces — a precomputed per-PoV metric vs a live House-PoV graph query — and that personalized membership depends on the customer trust-metrics structure.
- **Design rules:** the PoV line should state House when the data is House (no false "your network" attribution); skeleton + retry are the list-page standard.
- **Personas / journeys:** unchanged. The Cautious Newcomer's House-fallback experience is honored; the Vetting Observer with a *personal* network gets a personal count but a House list until the deferred phase ships — worth naming in the next journey pass.

## 4. Recommended scope for the next phase
Engineering's read — input, not decision:
1. **Personalized-PoV membership** for `/reporters` (and, in parallel, followers) — the cleanest single step toward the PRD's full per-viewer vision (audit carry-forward #1).
2. **Shared counts-row PoV indicator** across all three counts — small, cross-cutting, removes the one known glance-level attribution gap (#2).
3. **DRY `<GrapevineList>` refactor** before piling on more list variants — three near-duplicate pages/endpoints now exist; consolidating also lets follows/followers inherit the skeleton + retry (#3).
4. Then the planned **report-type breakdown** (Phase 2) and **pile-on resistance** (Phase 3).

## 5. Open questions for product
1. **Personalized-PoV membership priority:** is per-viewer list membership the next phase, or do report-type breakdown / pile-on resistance come first? — options: PoV-first / granularity-first.
2. **House-view labeling:** is "Relative to the House (default) web of trust…" the right standing copy for logged-in users with a personal network (until personalized membership ships), or should the page suppress the list for them rather than show a House view? — options: show House + label / gate behind personalized PoV.
3. **Count vs list-length expectation:** ratify "consistent in steady state at House PoV" (not real-time-identical to the profile badge) as the product's stated guarantee. — options: ratify / require real-time parity (would force the count off Meili onto a live query).

---

## Post-close addendum — 2026-07-02

*Appended during the harness-review sweep. The addendum above was written at book close (2026-06-07); one delta landed afterwards.*

- **Story #4 shipped post-close (2026-06-15, prod):** per-row **Report Type** (NIP-56 kind) and **Reported** (timestamp) columns on the `/reporters` list. This partially delivers PRD Phase 2 ("report-type breakdown") — row-level granularity shipped; filtering/grouping/aggregate breakdown remain open scope for the next phase.
- The §5 open questions above remain unconsumed by a product-team cycle as of 2026-07-02.
