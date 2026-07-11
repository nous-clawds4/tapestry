# Profile page information-architecture review (verified)

**Status:** 🟡 CAPTURED / SET ASIDE — needs further operator discussion before any build. Not scheduled. Resume via `/discuss`.
**Date:** 2026-06-16
**Scope surface:** `ui/src/pages/BrainstormProfile.jsx` (route `/user/:pubkey`)
**Provenance:** Produced by a multi-lens UX review (four perspectives — trust-evaluation job, scannability, nostr-newcomer, mobile — synthesized into one recommendation, then each significant move adversarially pressure-tested against the existing ADRs/comments). This document preserves that work for a later discussion. It is **not** a ratified plan.

This is "Story B" from the 2026-06-16 profile-page conversation. "Story A" (move npub + hex pubkey into a name-adjacent **details-drawer popover**; keep Website + Lightning visible) was approved separately and is being built first; see the `profile` epic. Story B was explicitly deferred by the operator: *"Story B will need significantly further discussion before running with it."*

---

## The dominant finding

The product's whole reason for being — the **trust verdict** — is at the very bottom of the page, rendered as tile #1 of an 11-card grid, visually identical to "GrapeRank Input." A visitor arriving from search to answer *"should I trust this person?"* has to scroll past the bio and identity strings to reach the 0–100 Verification Score that answers it. All four review lenses flagged this independently. Raising the trust signal is the high-value change.

## ⚠️ The correctness gotcha that bounds the headline change (point-of-view mismatch)

The naive fix — "promote the score to a hero directly under the counts row" — **imports a PoV bug**:

- The **counts row** (Following / Verified Followers / Verified Reporters) is sourced from **Neo4j, Owner-PoV** via `useUserCounts` (ADR `profile/0031`, BIBLE §27).
- The **rank / Verification Score** comes from **Meilisearch, and its PoV depends on `?pov=`** — House (instance default) normally, but the **viewer's Personalized PoV** when `?pov=` is set (resolved at `BrainstormProfile.jsx:84,149–186`).

Floating a big "THE score" flush under the counts can therefore show a number that **disagrees with the Verified Followers count right above it** (two different points of view) with no label explaining why — a credibility regression on a trust engine's flagship number. The counts-row `ⓘ` (`VerificationInfo`) explains the *owner-cutoff* definition and must **not** be re-parented onto a `?pov=`-dependent hero (its copy would become false).

**Verified resolution:** keep the score hero **inside the Reputation section**, under the existing "Reputation" heading whose `ReputationInfo` `ⓘ` already frames scores as "House or your personalized view, whichever is selected." That preserves the PoV framing the under-counts placement would strip. The hero must keep **reading the existing Meili `trustScores['rank']`** — the grid data path is a hard regression boundary (ADR `profile/0031` §Consequences, ADR `profile/0034` §Constraints) — and must round/format the value (it is rendered raw today; a hero sized for a clean two-digit integer degrades on a float/absent value).

---

## Verified recommendation — before → after

**Current order:** Header → Counts → Actions → About → Identity (pubkey, npub, website, lightning) → Reputation (flat 11-card grid).

**Proposed order:**
1. **Header** — name + the Story-A details-drawer icon (pubkey/npub).
2. **Counts row** — **untouched** (hard-locked).
3. **Action buttons** — untouched.
4. **About.**
5. **Reputation — promoted up to here**, restructured into two tiers:
   - **Verification Score as a visible headline** at the top of the section (large, formatted 0–100), staying Meili-sourced under the House/Personalized framing.
   - a **default-collapsed "details" disclosure** holding the technical internals (GrapeRank influence/average/confidence/input, PageRank, Muters).
6. **Website + Lightning** — kept **visible and not buried** (a website is a human-legible trust signal); "Identity" heading retired to "Links" **only after** Story A ships. Exact placement is an open decision (see below).

## The moves, with verified verdicts

| Move | Verdict | Note |
|---|---|---|
| Promote Verification Score to a headline | ✅ do it — **inside Reputation, not under the counts row** | the PoV gotcha above; keep Meili-sourced; round the value |
| Move Reputation section up (after About) | ✅ do it — low risk | no ADR fixes its bottom placement (mutable) |
| Progressive disclosure for grid internals | ✅ do it — **as 2 tiers; do not collapse the whole block** | collapsing everything would hide the headline score too; needs a `tier` field on `TRUST_METRICS` |
| Grid renders "Verified Followers" **twice** (defect) | ✅ remove **one**, not both | the grid value is Meili-PoV and genuinely diverges from the Owner-PoV counts (prod: 26,711 vs 22,981) — a *different* number, not a dupe. Prefer keeping `verifiedFollowerCount` (line 52), drop `followers` (line 45); disambiguate its tooltip. Already catalogued: 2026-06-06 item 4 |
| Remove the grid "Reporters" card | ✅ proceed — **with a required test edit** | counts-row is the canonical alarm-bearing home (ADR 0032). BUT regression sentinel **R3** in `test/profile-verified-reporters-count.test.js:156–160` asserts the card must stay → must be updated, and the reversal of ADR 0001's retention noted, or `npm test` goes red |
| Relabel "Identity"→"Contact" + move to page bottom | ❌ mostly **reject** | premature pre-Story-A; and burying Website under PageRank floats demotes a key trust signal. At most a one-word "Identity"→"Links" rename **after** Story A, keeping the block high |
| Keep "Muters" in the disclosure only | ✅ | do **not** add a 4th count to the counts row — that breaks the locked parallel three-count set (ADR 0029/0031) |

## Open decisions (must be settled in `/discuss` before planning)

1. **Contact links placement** — leave Website/Lightning where Identity is now (after About, above the trust internals), or elsewhere? Lean: keep them visible and high, not buried.
2. **Hops** — show alongside the headline score (more legible than GrapeRank) or tuck in the collapsed details? Lean: collapsed.
3. **Bottom-block heading wording** — "Trust details" / "How this score is computed" / keep "Reputation". Must avoid the style guide's forbidden phrasings; the `ReputationInfo` PoV scope must stay bounded to the grid scores only.
4. **Sequencing** — confirm Story A ships first (or in the same change), since the Identity relabel and the header drawer both assume it.

## Hard constraints any reorder must respect (mined from ADRs/comments)

Do **not** touch / must preserve (mutable:false):
- **Counts data source** = Neo4j Owner-PoV via `useUserCounts`; never re-derive from the Meili grid, never substitute raw follower count (ADR `profile/0031`).
- **Count states** `—` vs `0` vs loading; Verified Reporters: `>0`→link, genuine `0`→neutral non-link, unavailable→`—` ("zero is reassurance") (ADR `verified-reporters/0001`, design guide).
- **Reporter alarm** red+🚩 only at the popularity-adjusted dynamic threshold `≥ 3 + floor(verifiedFollowers/750)`, never color alone, never replicated onto any promoted element (ADR `profile/0032`).
- **Counts row** stays a parallel three-count set; **no per-count PoV chip / no 4th count** (ADR 0029/0031, ADR 0033/0034 — counts are Owner-PoV and must not be labeled "House").
- **`ReputationInfo` popover** scope stays bounded to the Reputation-grid scores; its House/Personalized wording must never bleed onto the counts (ADR `profile/0034`).
- **Reputation grid data path** (Meili `trustScores`, `?pov=` namespacing) is the **regression boundary** — visual reorder only, no data-path change (ADR 0031/0034).
- **Canonical user-facing copy** for the reporters feature is verbatim-locked; no rephrasing (style guide; ADR `verified-reporters/0001`).
- **House rules**: JS-without-build, tokens-only (`bsp-*` classes / CSS custom properties), no new icon library, no new tooling, no firmware reinstall for a presentational reorder.

Sanctioned to change (mutable:true — explicitly invited):
- **Reputation section vertical position** (no ADR defends the bottom placement).
- **Grid card order / curation**, incl. removing the duplicate Verified-Followers row (named as a deferred cleanup across ADRs 0029/0030/0031).
- **`VerificationInfo` physical position** within the counts row.

## Relationship to existing work

- **Absorbs** the 2026-06-06 follow-up item 4 (duplicate "Verified Followers" `TRUST_METRICS` row) into a coherent IA story.
- **Touches** the Reporters grid card → must update R3 in `test/profile-verified-reporters-count.test.js` and note the ADR `verified-reporters/0001` retention reversal.
- **Depends on** Story A (the pubkey/npub details drawer) for the Identity→Links relabel; otherwise independent.
- Will need an **ADR** (touches reputation presentation, the PoV boundary, and a ratified test sentinel) — not a fast-track change.

**Next step:** `/discuss` to settle the four open decisions and confirm the PoV-safe headline placement, then Planning → Architecture (ADR) → Test Design → Implementation → Review.
