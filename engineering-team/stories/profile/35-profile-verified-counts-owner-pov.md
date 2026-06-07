# Story 35: Profile Verified Followers/Reporters counts from Neo4j (Owner PoV)

**Status:** Approved
**Created:** 2026-06-07
**Type:** Bug / Refactor
**Epic:** `profile`

## Background
The profile's **Verified Followers** and **Verified Reporters** counts read from Meilisearch (`trustScores.*`, per-PoV `wot_*_<suffix>`). This is unreliable and, in one case, actively wrong:

- On staging, Jack's profile badge showed **"26,711 Verified Followers"** while his `/followers` page showed **568**. The badge code `verifiedFollowerCount ?? followers` found no `verifiedFollowerCount` for the resolved PoV suffix and **silently fell back to raw total followers (26,711), mislabeled as "Verified Followers."**
- **Verified Reporters** has the same Meili dependency and shows **"—"** when the per-PoV field is absent.

Meanwhile the list pages (`/follows`, `/followers`, `/reporters`) already read **live Neo4j, Owner PoV** (the instance owner's GrapeRank: `influence > VERIFIED_*_INFLUENCE_CUTOFF`). So the badge and the table answer the same question from different sources and disagree.

This story brings the two **verified counts** onto the **same Owner-PoV Neo4j source** as the tables, so the profile badge and the corresponding list always reflect the same definition, and a missing value degrades honestly rather than showing a wrong number. This is the near-term, Owner-PoV-only step decided in `docs/POV_RESOLUTION_DESIGN_HANDOFF.md` §7.4; full per-viewer PoV selection is the separate future standard.

## User-facing description
As someone reading a profile, I want the Verified Followers and Verified Reporters counts to show the real verified numbers — consistent with what I'd see if I opened the corresponding list — so the profile never misleads me with a raw or mislabeled figure.

## Acceptance criteria
Testable from the outside.

- [ ] Given a profile, the Verified Followers and Verified Reporters counts are derived from the **Owner-PoV source** (the same definition the `/followers` and `/reporters` tables use), **not** from Meilisearch.
- [ ] Given a verified value that is unavailable or not yet computed, the count shows the unavailable placeholder ("—") — **never raw total followers, and never any other metric mislabeled as "verified."**
- [ ] Given the same account, the Verified Followers count and the `/followers` table are computed from the same Owner-PoV definition (same relationship + influence cutoff), and likewise Verified Reporters vs `/reporters` — so they agree in steady state.
- [ ] The **Following** count is unchanged in source and behavior (it is outdegree, not point-of-view-dependent).
- [ ] The `/reporters` page's point-of-view wording reflects the **Owner** point of view (consistent with the data's actual source), correcting the earlier "House" label; any analogous "House" mislabel of this Owner-sourced data is likewise corrected.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the observed account; its Owner-PoV node properties (`verifiedFollowerCount`, `verifiedReporterCount`, `influence`) and the `[:FOLLOWS]` / `[:REPORTS]` edges back the counts.
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — defines "verified" (Owner-PoV influence above the cutoff).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — the Owner web of trust the counts are relative to.

## Out of scope
- **Per-viewer PoV selection** (House / Personalized) and the 3-way selector — the future three-PoV standard (`docs/POV_RESOLUTION_DESIGN_HANDOFF.md`). This story is **Owner-PoV only**.
- Changing the **Following** count (stays on strfry).
- Changing the list/table pages themselves (they already read Owner Neo4j) — beyond confirming the badge shares their definition.
- Fixing the Meili / kind-30382 publish pipeline, the verified-influence-cutoff inconsistency, or the deploy-interrupts-scoring-batch ops bug — all separate follow-ups.
- Ratifying the three-PoV standard into BIBLE/ADRs (separate docs-mode track).

## Open questions
- **Badge source mechanics (for the Architect):** prefer the `NostrUser` node property vs a count-only live Neo4j query vs extending `/api/get-user-counts`. Weigh the **Verified Followers mega-account scale** issue — a count-only live query on a dense node (Jack ≈ tens of thousands, large inbound degree) is a cost paid on *every profile view*, so a per-view live traversal may be the wrong default for followers. Node-property-with-live-fallback, or a cache, are candidates. The ADR decides.
- **Owner-PoV copy:** the exact wording for the `/reporters` point-of-view line (and whether the profile badge itself needs any PoV label) — settle with the style guide.
- **Supersession:** this changes the count *source* chosen in ADR 0001 (Verified Reporters count from Meili `trustScores`) and the analogous Verified Followers decision (story #33 / ADR 0029). The Architect's ADR should **explicitly supersede/amend** those source choices rather than silently contradict them.

## Linked artifacts
- Design doc: `docs/POV_RESOLUTION_DESIGN_HANDOFF.md` (§7.4 — the decision this story implements; §9 — related ops/data findings).
- Prior ADRs to supersede on count-source: `engineering-team/decisions/verified-reporters/0001-verified-reporters-count.md`, `engineering-team/decisions/profile/0029-profile-verified-followers-count.md`.
- ADR: `engineering-team/decisions/profile/0031-profile-verified-counts-owner-pov.md` (Accepted; supersedes the count-source of ADR 0029 + ADR 0001)
- Test plan: `engineering-team/stories/profile/35-profile-verified-counts-owner-pov.test-plan.md` (suite `test/profile-verified-counts-owner-pov.test.js`)
- Review: (filled in after Review phase)
