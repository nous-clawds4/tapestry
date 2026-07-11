# ADR 0004 (protocols-directory): Communities pre-NIP — source reconciliation, scope, skeleton

**Status:** Accepted
**Date:** 2026-06-10
**Story:** `engineering-team/stories/protocols-directory/6-communities-spec.md`

> Full ADR (not thin): the epic's first synthesis. Inherits ADR 0001's macro pattern (pointer-first discipline, source map, gates) but its substance is the four-family source reconciliation below.

## Context

Story 6 produces `protocols/drafts/communities.md` from four source families of different dates and authority. Orientation established the chronology that drives every decision here:

1. **May 2026** — `feat/communities` branch specs: `COMMUNITY_RECORDS_DLIST.md` (personal records with engine config: `seed`/`weighting_model`/`endorsement_threshold`; `template-source` lineage; NIP-72 wrapping) and `COMMUNITY_ENDORSEMENTS_DLIST.md` (global endorse/veto DList with deterministic d-tags). **Pre-redesign.**
2. **2026-06-05** — `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` (the capture doc; story-designated **design authority**): no-privileged-center tenet; community = concept; identity = concept identity; **membership = consume the nostr-user-tag**; two-axis sameness; population/ruleset safety split; first-listed-wins ratified. Explicitly supersedes founder-centric framing.
3. **2026-06-05 → 06-08** — branch ADRs 0029–0040, **post-redesign**: the branch's own response. Classified by a 3-agent sweep (full results in the workflow transcript; verdicts below).
4. **BIBLE §22** — the community-*reference* machinery: resolution precedence (`grapevine-resolved → firmware-blessed → none`, explicitly *unratified* — Flaw A accepted temporarily), export invariants, Phase A/B record.

### The 12-ADR classification (wire-format inventory)

| ADR | Verdict | Wire content (if any) |
|---|---|---|
| 0029 declaration shape | **wire** | CD = kind-39998 concept header: `d`=slug (per-founder), `name`/`description`/`belonging`/`founder`/`topic` tags, type-marker `z`-ref to the `brainstorm-community` concept, forward-compatible `b`-forking; strangler coexistence with the frozen bespoke 39999 records |
| 0030 membership-from-tags | **mixed** | CD `claims` = list of tag-element a-coords (`39999:<tagAuthor>:<slug>`); assertion shape **a-primary** (`a`=element identity, `e`=provenance only — corrected 2026-06-05); v1 roster gate: `applications ≥ cutoff AND applications > disputes` (count-based) |
| 0031 roster topology | impl | — |
| 0032 degraded posting | impl | — |
| 0033 reply threading | **wire** | kind-1111 (NIP-22): top-level `["a", communityATag]`; replies add `e`(parent)+`k`+`p`, inherit uppercase `A` |
| 0034 reactions | **wire** | kind-7 (NIP-25) scoped by `A`/`e`/`p`/`k`; `+`/`-` with **latest-per-reactor** aggregation (wire-binding rule) |
| 0035 live updates | impl | — |
| 0036 signs of life | impl | — |
| 0037 notification prefs | impl | — |
| 0038 notification inbox | **wire (sourcing only)** | derives from existing shapes (vouches `#p`+polarity, replies `e`, posts `#A`); defines no new shapes |
| 0039 foothold invite | **wire** | kind-39999 invite: `["a",communityATag]`, `["d","invite-<code>"]`, `["p",issuer]`, `z`→`foothold-invite` |
| 0040 accept foothold | **mixed** | kind-39999 redemption (`"redeem-<code>"`, `z`→`foothold-redemption`) + standard self-tag/vouch assertions per 0030 |

The story's presumption (0031/0032/0037/0038 implementation-side) confirmed, with one correction: 0038's *sourcing rules* reuse wire shapes but define none — implementation-side for the spec.

### Disagreement findings (story rule: surfaced, capture doc authoritative)

- **D1 — Endorsements DList superseded for membership.** The May endorsements layer (endorse/veto items, engine-config-driven aggregation) and the June design (membership = nostr-user-tag, disputes = `polarity:-1`, trust-weighted) solve the same problem incompatibly. Capture doc *and* the branch's own latest (0030) both take the tags route. **Verdict: superseded.** Not ratified into the spec; recorded here and in the spec's header sources line.
- **D2 — Records layer reframed by strangler coexistence.** The May records spec survives, but as the **deployed coexistence layer** (0029's "frozen bespoke" records), not the go-forward declaration. The CD (kind-39998, 0029) is the declaration wire format. Spec presents both, framed exactly so.
- **D3 — `founder` field vs the founding tenet.** Capture §1 bans privileged-center *default fields*; 0029 (post-redesign) still carries `founder`. Resolution: the field survives as **informational-only** with normative teeth — "MUST NOT confer any algorithmic privilege" (the records spec's own "no algorithmic privilege" language, promoted to a requirement) — and the tension is flagged in the source map.
- **D4 — nostr-user-tag shape drift (binding on story 7).** Three variants exist: tags-branch ADR 0001 (`e`-primary), capture doc (`['e', concept]`), communities 0030 (**`a`-primary, `e`-provenance** — the 2026-06-05 correction, load-bearing for communities' `#a` roster reads). This spec's membership section describes the assertion via the story-7 pending marker *and notes the a-primary correction*; **story 7 must reconcile the variants, with 0030's correction as the latest word.**
- **D5 — Roster rule: deployed vs designed.** 0030's v1 gate is count-based (`applications ≥ cutoff AND applications > disputes`, house PoV); the capture doc's design is GrapeRank-weighted net-assert-vs-dispute per PoV. Both are real (one shipped, one ratified-in-design). The spec states the v1 rule as deployed wire-binding aggregation, states the designed direction, and marks the reconciliation **open** → new worksheet entry.

## Options considered (the §22 scoping question — the story's central call)

### Option A — Spec references §22's resolution model; BIBLE untouched (chosen)

The only §22 content the spec needs is the resolution-precedence *concept* for identity selection — which §22 itself marks unratified (Flaw A "accepted temporarily"; registry "not ratified here"). A pre-NIP must not ratify what its source declines to. The spec's identity section therefore states identity = concept identity, cites the precedence direction non-normatively, and points the canonical-selection question at worksheet W1 (which owns it). **Zero BIBLE edits this story.**

### Option B — Extract a "resolution kernel" from §22, pointer-first rewrite

Rejected: creates a normative home for an explicitly-unratified mechanism, and §22's remaining body (export invariants, Phase A/B) is implementation record that would survive anyway — the rewrite would be ceremony without separation.

### Option C — Fold all of §22 into the spec

Rejected outright: §22 is dominated by Tapestry implementation (firmware passes, materialization invariants, smoke-gate lessons).

## Decision

**Option A**, plus the scope list, skeleton, and treatments below.

### Spec scope (what the inventory marks settled)

The founding tenet (normative principle); community-as-concept and identity-as-concept-identity (incl. powerless referent, bootstrap, two-axis sameness with non-transitivity, population/ruleset split); the CD shape (0029, with D3's informational-founder requirement); membership (claims a-coords; assertion consumption with the story-7 pending marker + D4 note; self-tag vs vouch = `pubkey == p`; disputes; the v1 roster rule as deployed + designed direction marked open per D5; roles as predicates, admin OFF v1); the personal-records coexistence layer (index header, record shape, `template-source` snapshot lineage, NIP-72 `a`-wrapping); posts/threading (0033's kind-1111 layout); reactions (0034's latest-per-reactor rule); foothold invitations (0039/0040 shapes). Security considerations: the live-`b` retroactive-lever caveat with distance-weighted-overlap mitigation and the population/ruleset split as a safety property (capture §3), cross-referencing the inherit-from spec's trust-coupling.

### Skeleton (fixed, 11 headings)

```
(header: 📝 pre-NIP · in-flight note: feat/communities + feat/pubkey-tagging-target unmerged,
 three-branch reconciliation OPEN (capture doc §7) · sources: the four families, with
 COMMUNITY_ENDORSEMENTS_DLIST.md marked superseded-for-membership per this ADR)
---
Communities
=====
## Founding tenet: no privileged center
## Relationship to other specs
## A community is a concept
## The Community Declaration
## Sameness: two axes
## Membership
## Personal community records (coexistence layer)
## Posts, threading, and reactions
## Foothold invitations
## Security considerations
## Open questions
```

"Open questions" is a first-class spec section this time (the story demands open things stay visibly open): three-branch reconciliation (org decision, capture §7); engine-config carriage (D2 residue: where `seed`/`weighting_model`/`threshold` live post-redesign — records? CD? resolved definition?); roster-rule reconciliation (D5); canonical concept identity (→ W1).

### Other treatments

- **Capture doc status line:** updated to "🔴 OPEN — design (§1–§6) ratified into `protocols/drafts/communities.md` (protocols-directory story 6); remaining open item: §7 three-branch reconciliation." Nothing else in that doc changes (its audience is Avi + Vinney).
- **Worksheet:** two new entries — **W8 engine-config carriage** (D2 residue) and **W9 roster-rule reconciliation** (D5: count-based v1 vs WoT-weighted design; plus capture §5's threshold mechanics) — plus the proactive sweep (W1's §22 refs survive untouched since BIBLE is untouched).
- **README row 6:** working copy here; source column notes the endorsements spec's supersession.
- **Story-7 pending marker form:** "specified by the Tags & Taggings pre-NIP (story 7, pending; until then the latest wire word is `feat/communities` ADR 0030's a-primary correction)".
- **Spec title:** "Communities" (deployment-neutral); "Brainstorm Communities" appears once as the reference deployment's name.

## Consequences

- The settled Communities design gains a single readable home; the genuinely open items become *visible* spec text instead of tribal knowledge.
- Story 7 inherits a binding instruction (D4) — reconcile the assertion-shape variants with 0030's correction as the latest word.
- The endorsements layer's supersession is now written down; if Avi's branch still builds on it, the spec surfaces that conversation rather than hiding it.
- **Firmware reinstall required?** No.

## Implementation notes

- Files: `protocols/drafts/communities.md` (new, per skeleton); `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` (status line only); `protocols/worksheet.md` (+W8, +W9, sweep); `protocols/README.md` (row 6). **BIBLE.md: untouched.**
- Source map required: spec section → capture-doc §, branch-spec section, or branch ADR (by number), with **D1–D5 each flagged where they shaped prose**.
- Gates: `npm test`; diff scope = the four files; zero BIBLE diff; dual-normativity sweep (CD shape, roster rule, foothold shapes appear only in the spec); link/anchor checks incl. the two new worksheet anchors.

## Out of scope

- Deciding §7 (three-branch reconciliation), W1, W8, W9.
- Story 7 (beyond the pending marker + D4 instruction).
- Any code, branch, or firmware change; publishing.
