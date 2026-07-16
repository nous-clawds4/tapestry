# Review: Story 6 — Communities pre-NIP (synthesis)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-10
**Diff:** commit `383ebd6e` (4 files, +131/−2: `protocols/drafts/communities.md` new; `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` status line only; `protocols/worksheet.md` +W8/+W9; `protocols/README.md` row 6)
**Contract:** `protocols-directory` ADR 0004 (full — four-family reconciliation, findings D1–D5, 11-heading skeleton, Option A: BIBLE untouched); story ACs; synthesis traceability rule
**Method note:** implementation authored in this same session; audit fanned out to 10 independent agents across five dimensions (ADR conformance, boundary, traceability against all four source families via `git show`, references/anchors, term-coverage as first-class per the story), all non-note findings adversarially verified — zero unverified this time (the orchestration null-filter fix from story 5's incident held). Gates run directly by the Reviewer.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (full suite)
- [x] Playwright — skipped: docs-only
- [x] Diff scope — exactly the ADR's four files; **BIBLE absent from the commit** (Option A verified); capture-doc change is exactly one replaced line
- [x] _Lint/typecheck/build not configured — skipped._

## ADR adherence

- [x] Skeleton: exactly the 11 fixed headings; "Open questions" first-class with the ADR's items (a fifth, CD field encodings, added — judged in-scope: it is the spec's own honest-gap marker, noted, accepted).
- [x] D-resolutions applied in substance: D1 (endorsements omitted from body; supersession in header sources + README row), D2 (coexistence framing), D3 (founder MUST-NOT requirement), D4 (a-primary assertion + story-7 marker), D5 (both roster rules; reconciliation → W9).
- [x] **AC1/endorsements judgment (explicit):** the story's coverage minimum names the endorsement layer but is qualified by "the wire formats the ADR's inventory marks settled"; ADR D1 marks it superseded. The omission is **contract-conformant**.
- [x] Capture-doc treatment: status line only; §7 remains open; audience-respecting.
- [x] W8/W9 per the ADR's definitions, with D2/D5 citations.

## Boundary discipline

- [x] Zero stack machinery; all `z` type-handles deployment-neutralized; "Brainstorm Communities" appears once as the reference deployment's name; generic "observer's trust" phrasing for the designed rule (no GrapeRank-as-pipeline).
- [x] Dual-normativity: capture doc's full design prose coexists as a *design record* (ADR-like role, now status-marked as ratified-into-spec) — judged acceptable non-normative coexistence; BIBLE §22 verified untouched and non-contradicting.

## Traceability (synthesis rule) — the source map (durable copy, D-flags per row)

| Spec section | Source | D-flag |
|---|---|---|
| Founding tenet | capture doc §1, near-verbatim | — |
| Relationship to other specs | connective + pending marker | **D4** |
| A community is a concept | capture §3 (identity, bootstrap, safety property) + W1 | — |
| The Community Declaration | branch ADR 0029 (fields) + 0030 (`claims`); encodings marked "not yet formalized" (0029 verified to contain no literal tag arrays) | **D2** (CD as go-forward), **D3** (founder MUST-NOT) |
| Sameness: two axes | capture §3 (incl. overlap-coefficient example and non-transitivity — verified sourced) | — |
| Membership | assertion block verified **exact** vs 0030:50–54 modulo neutralized `z`; claims semantics per 0030; both roster rules faithful (count-based gate verbatim; weighted formula faithful) | **D4**, **D5** |
| Personal records (coexistence) | records spec (index, fields, `template-source` snapshot rationale, NIP-72 wrap) framed per 0029 | **D2**; engine config → W8 |
| Posts/threading/reactions | 0033 layout; 0034 latest-per-reactor (verified) | — |
| Foothold invitations | 0039/0040 shapes, neutralized handles | — |
| Security considerations | capture §3 (live-`b` lever, distance-weighting, population/ruleset) — verified sourced | **D5** stake (no-veto asymmetry) |
| Open questions | §7 / W8 / W9 / W1 / encoding gaps — all sourced as open | **D1** recorded in header sources line, not body |

Audit verdict: all normative claims traced; no silent resolution of disagreements; no inventions.

## Findings

Audit: 5 non-note findings raised → 4 confirmed (all minor), 1 refuted, 0 unverified; 2 notes.

### Resolved by this report (no spec change)

1. **Source-map artifact + D-flags** (adr-conformance) — ADR 0004 requires a source map with D1–D5 flagged where they shaped prose; the implementation delivered it in the (ephemeral) gate report, and inline D-codes in a publishable spec would violate the spec's own boundary discipline. Resolution: the source map with per-row D-flags is embedded **above, in this review** — the durable artifact. ADR requirement satisfied; no kickback.

### Blocking (consolidated — one kickback, one file)

2. **Pending-marker wording drift** (communities.md:63) — the Membership section's marker ("wire format owned by…") deviates from the ADR's fixed form used at first instance. Asked change: align to the prescribed form.
3. **`tag-element` / `a-coordinate` undefined at first use** (:48, :76) — one sourced sentence: a *tag-element* is the kind-39999 tag event itself, addressed by its a-tag form (`39999:<author>:<slug>` — addressing per Tapestry Concepts); "a-coordinate" = that address.
4. **`influence cutoff` undefined** (:76) — one sourced, deployment-neutral sentence: the minimum trust an asserter must have, from the evaluating observer's point of view, for their assertions to count; preset values are deployment policy (carriage already tracked in W8).

### Non-blocking

1. Posts/replies "both carry the community `a` scope" explicitness — refuted (the quoted layouts state it: top-level `a`, replies inherit uppercase `A`).
2. The fifth open question (CD encodings) beyond the ADR's four — accepted, see ADR adherence.

## Verdict

~~**CHANGES_REQUESTED**~~ → **PASS** (see re-review below)

Initial verdict CHANGES_REQUESTED — solely for the three one-line fixes (items 2–4). Everything structural passed on first audit: skeleton, all five D-resolutions in substance, exact assertion-shape fidelity, boundary spotless, zero BIBLE diff, references clean.

## Re-review (2026-06-10, commit `cee2ed54`)

Targeted re-check of the three passages (+4/−2 lines, one file):

2. Pending marker at Membership intro now matches the ADR's fixed form ("specified by the Tags & Taggings pre-NIP (story 7, pending; until then the latest wire word is…)"). Fixed as asked.
3. *tag-element* / *a-coordinate* defined in one sourced sentence directly under the assertion block, grounding both in Tapestry Concepts addressing. Fixed as asked.
4. *influence cutoff* defined inline at its first roster use, deployment-neutral, with preset values left as deployment policy (W8 carriage untouched). Fixed as asked.

`npm test` re-run green. The review converts to **PASS**.
