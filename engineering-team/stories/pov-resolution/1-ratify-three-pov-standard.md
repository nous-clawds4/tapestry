# Story 1: Ratify the three-PoV resolution standard into the spec

**Status:** Done
**Created:** 2026-06-08
**Type:** Doc
**Epic:** `pov-resolution`
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3 — Test Design skipped)

## Background
Tapestry surfaces trust metrics (counts, scores, lists) from several uncoordinated sources,
so the *same* metric can read differently depending on which source — and which PoV
"suffix" — a surface hits. The concrete failure (staging, 2026-06-07): Jack's profile badge
showed "26,711 Verified Followers" while his /followers page showed 568 — a Meili-suffix miss
silently falling back to raw followers, compounded by a half-finished Owner scoring batch.

The fix for that one badge already shipped (profile #35/#36, ADR 0031/0032 — Owner-PoV counts,
badge==table). But fixing instances doesn't generalize. The design work in
`docs/POV_RESOLUTION_DESIGN_HANDOFF.md` (Status OPEN) settled the *standard*; this story
ratifies the settled pieces into the canonical spec (BIBLE) so future surfaces have one
authority to build against, instead of the standard living only in a handoff doc.

This is a **docs-mode** change: the deliverable is BIBLE prose + an ADR, not code.

## User-facing description
As a Tapestry contributor (or fork operator) reading the spec, I want a single canonical
definition of the three Points of View, which source is authoritative for each, and how
selection/fallback is meant to work — so I build new trust surfaces against one standard
rather than rediscovering it per-feature.

## Acceptance criteria
Testable from the outside (doc-level inspection).

- [ ] BIBLE gains a new top-level section "Point of View (PoV) Resolution" defining exactly
      **three** PoVs — Owner, House, Personalized — each with its authoritative source
      (Owner→Neo4j node props + live traversals; House→kind 30382 → Meili `wot_*_<houseSuffix>`;
      Personalized→kind 30382 per-user → Meili `wot_*_<userSuffix>`) and its availability condition.
- [ ] The section states that the **Following count stays on strfry** (kind-3 p-tags) and is
      **non-PoV** (freshest, immune to the GrapeRank batch).
- [ ] The section carries the **naming correction**: Neo4j-sourced grapevine data is the
      **Owner** PoV, not "House"; prior "House (default)" labels for Neo4j data were mislabeled.
- [ ] The section describes the **selection/persistence model** and the **fallback model** as
      *target* direction (clearly marked target/aspirational, not present-tense fact), including
      that data **health/freshness** is part of "availability" (stale/partial is a state, not absence).
- [ ] The section includes a **per-feature current→target** view for the profile counts, the
      grapevine tables, and the search page; and notes the profile Verified Followers/Reporters
      badges **already** use Owner PoV (shipped: profile #35/#36).
- [ ] The section explicitly lists the **open questions** (design-doc §8) as *open / not yet
      decided* — default PoV for anonymous users, resolver shape, freshness signaling, exact
      per-feature fallback chains, Personalized source, count=list-length guarantee.
- [ ] The Table of Contents links to the new section and the anchor resolves.
- [ ] `docs/POV_RESOLUTION_DESIGN_HANDOFF.md` is flipped to **✅ SUPERSEDED** with a pointer to
      the BIBLE section (its open questions preserved as the epic's deferred work).
- [ ] An ADR (0033) records the ratification decision and what was deliberately left open.
- [ ] `npm test` stays green (no regression from the docs change).

## Concepts touched
(Concept Graph API was unreachable at planning — Architect to confirm handles via
`/api/concept-graph/summaries`.)
- `…:graperank` — the rank/influence + the verified cutoffs the PoVs are computed from.
- `…:nostr-user` — carries the Owner-PoV node properties (influence, verified*Count, hops).
- `…:web-of-trust` — the per-PoV web of trust each metric is relative to.

## Out of scope
- **Any code.** No resolver, no endpoint, no selector UI, no preference store — spec only.
- **Deciding the open questions** — they are *documented as open*, not resolved here.
- **Re-litigating the shipped Owner-PoV badge change** (profile #35/#36) — only *documented*.
- Changing cutoff values; report-type breakdown; pile-on discounting.

## Open questions
- **Test Design is skipped** (docs-mode — no executable behavior). The only gate is
  `npm test` staying green + the Reviewer's accuracy/consistency audit.
- Section number/placement (likely §27, after §26 Resolved Definition) and exact anchor text
  are the Architect's call (ADR 0033).
- Which sub-pieces are **normative** ("MUST/standard") vs **aspirational** ("target") — the
  Architect draws that line in ADR 0033.

## Deviations
- None. Implemented exactly per ADR 0033 (Option B structural split): BIBLE §27 with four
  blocks (The standard / Status today / Target direction / Open questions) + TOC entry; the
  handoff doc flipped to ✅ SUPERSEDED with a BIBLE §27 pointer, body preserved.
- Optional §11/§14 cross-refs were **skipped** (ADR marked them optional; kept the diff focused).
- `npm test` Overall PASS, no suite regressed (docs-only change; no tests touched). Note: this
  branch was cut from `staging` before profile #35/#36 merged, so its suite counts predate
  those stories' #36 updates — irrelevant to this docs change.

## Linked artifacts
- Design handoff: `docs/POV_RESOLUTION_DESIGN_HANDOFF.md` (flipped to ✅ SUPERSEDED → BIBLE §27)
- ADR: `engineering-team/decisions/pov-resolution/0033-three-pov-resolution-standard.md` (Accepted)
- Test plan: N/A (docs-mode — Test Design skipped)
- Review: `engineering-team/reviews/pov-resolution/1-ratify-three-pov-standard.md` — **PASS** (2026-06-08)
