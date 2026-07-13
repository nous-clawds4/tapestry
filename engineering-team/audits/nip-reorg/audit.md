# Build Audit: nip-reorg — the shared-concepts NIP reorganization

**Book:** `engineering-team/audits/nip-reorg/book.md`
**Date:** 2026-07-13
**Branch / commit range:** `5f326fac..fffadd37` (staging; PRs #345–#348; the anchor itself landed just prior via PR #344)
**Provenance:** Acceptance-frame (eager — the handoff doc predates story 1 and every story cites it)
**Confidence:** high

## 1. What shipped

- **Shared Concepts** — the `b`-consuming policy NIP (affiliation, deference, observer-resolved aggregation, clouds, W1 identity trajectory), written under the D2 vocabulary policy; inherit-from § Aggregation reduced to a pointer — `stories/nip-reorg/1-shared-concepts-nip.md` (PR #345).
- **Class Thread Relationships** — the `n`/`s` NIP renamed (file + title + intro guard), substance byte-identical, 13 inbound link targets fixed under the living-vs-historical boundary — `stories/nip-reorg/2-class-thread-relationships-rename.md` (PR #346).
- **Stamping** — the multi-`z` write rule + read contract as their own publisher-policy NIP, extracted from tapestry-concepts (now a two-way pointer); the open layer-selection question (O1) stated on the two-axis framing with worksheet **W14** as its tracker — `stories/nip-reorg/3-stamping-nip.md` (PR #347).
- **Close-out sweep** — worksheet re-aims (W11/W1/W14), consumer specs cite Stamping (incl. the tags.md dual-`z` wire-accuracy fix), BIBLE §22 normative-home pointer + §23 rename, review-nit polish, handoff → ✅ SUPERSEDED — `stories/nip-reorg/4-index-crossref-sweep.md` (PR #348).

## 2. Epics & stories rolled up

### Epic: `nip-reorg`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 shared-concepts-nip | New policy NIP + inherit-from § Aggregation pointer + README row | Done | `reviews/nip-reorg/1-shared-concepts-nip.md` (PASS) |
| #2 class-thread-relationships-rename | git-mv rename + retitle + 13 living-doc link fixes | Done | `reviews/nip-reorg/2-class-thread-relationships-rename.md` (PASS) |
| #3 stamping-nip | New NIP + extraction seam + W14 + user-gated two-axis amendment | Done | `reviews/nip-reorg/3-stamping-nip.md` (CHANGES_REQUESTED → PASS on re-review) |
| #4 index-crossref-sweep | 13-row sweep: re-aims, BIBLE audits, polish, handoff flip | Done | `reviews/nip-reorg/4-index-crossref-sweep.md` (PASS + obligation-trail audit) |

## 3. As-built inventory

**Docs-only book.** No runtime, UI, API, or wire-format change; no concept mutated; no firmware reinstall.

- **Protocol corpus:** two new pre-NIP drafts — `protocols/drafts/shared-concepts.md`, `protocols/drafts/stamping.md`; one rename — `class-thread-tags.md` → `protocols/drafts/class-thread-relationships.md` (history preserved). Normative-home moves: inherit-from § Aggregation → Shared Concepts; tapestry-concepts § Multi-`z` → Stamping (+ Shared Concepts § Clouds for the cloud model). Each fact normative in exactly one place at close (verified by per-story duplication greps and the S4 obligation-trail audit).
- **Vocabulary:** "canonical" and "consensus" retired from living-spec normative text; the deference / convergence / convention split + the observer-relative rule are now in-spec (Shared Concepts § Terminology). Historical records (ADRs, worksheet resolution bodies) deliberately unrewritten.
- **Worksheet:** W14 opened (subset/ancestor stamping, two-axis framing) as W11's successor; W11/W1 re-aimed; W11/W1 histories intact.
- **BIBLE:** §22 gains the Shared Concepts normative-home pointer (selector remains implementation-framed); §23 renamed incl. TOC anchor (old anchor: zero referrers).
- **Index:** `protocols/README.md` carries rows for all three drafts (added in-story at S1/S2/S3).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 3: Stamping opens O1 as "subset/ancestor stamping" with the three original candidate shapes | Section landed as "Open: which layers to stamp (set × branch)" — the two-axis valid-`z` space, principles (a)–(d), smart/dumb interop-floor stakes, plus a MAY-infer read-contract bullet and a privacy sentence | intentional-change (user-gated mid-story scope amendment) | Protocol author + Vinney considerations, 2026-07-12 (ADR 0003 § Amendment; story #3 AC2–AC4 amended at the gate) | Richer, more precise open-question statement; **no normative change** — the ratified write rule was verified untouched (re-review) | Settle via the W14 `/discuss` (§6) |
| 2 | Frame bullet 4 implied README index rows land in S4 | Rows landed in S1/S3 with their specs; zero remained for S4 | intentional-change | Index-every-spec invariant (S1 planning-gate decision, recorded in story #1 AC5) | None | — |
| 3 | Frame bullet 4: consumer specs "reference Stamping rather than restating dual-`z`" | tags.md additionally received a one-sentence wire-accuracy fix ("one or more `z` stamps") — its singular-`z` phrasing was stale against the deployed dual-`z` writers | interpretation | ADR 0004 Decision 1 (cross-reference at an existing touchpoint; boundary rule kept deployment history out) | Spec now matches the deployed wire | — |

**Undocumented work:** none. Every story's review verified its diff against the ADR's enumerated file set; S4's review additionally reconciled the whole obligation trail (13/13 items closed or explicitly O1-scoped).

## 5. Quality state at close

- **Test gate at close:** `harness-lint.sh` clean; `npm test` stack-free portion green. The 11 stack-dependent tag/pin/TL suites fail **environmentally** — the local Docker stack bind-mounts the shared checkout pinned at PR #305 (pre-tags-feature, empty graph); proven pre-existing by clean-base differential at S1 and re-verified at every story. The binding regression gate (CI `stack-free`) was green on all five PRs (#344–#348).
- **Known open issues:** none introduced. The environmental stack staleness is swept to OPEN.md (§7 disposition).
- **Debt:** none new; both ADR-0001-scheduled transient duplications were resolved on schedule (S3, S4); ADR 0003's W11-pointer oddity resolved in S4.

## 6. Carry-forward register

- [ ] **Settle W14** — subset/ancestor stamping (two-axis layer selection), incl. the co-stated read contract; deliberately deferred by design (handoff D6; story #3/#4 Out of scope). Entry point: `protocols/worksheet.md` W14 + `stamping.md` § "Open: which layers to stamp".
- [ ] **Specify the correspondence closure** — reconcile "affiliation-backed indirect `b` reach" (stamping § Open) with Inherit-From's "affiliation never through mere correspondence" (S3 re-review finding 3; consistent today only because the semantics are flagged unspecified). Belongs to the same W14 `/discuss`.
- [ ] **Pins dual-`z` parity** — `publishTagPin.js` still emits a single shared `z`, lagging the tag/assertion writers (`tag-federation` ADR 0003; recorded in stamping.md's implementation header). Eng-team story candidate.
- [ ] **Target-typed tag definitions** — floated 2026-07-12, pushed back (W10's family splits *taggings*, not tags), unresolved; tags/W10 lineage, not reorg scope (handoff O4).
- [ ] **W1** remains the open cross-deployment identity tracker; Shared Concepts states the trajectory without resolving it.
- [ ] **Publication decisions** — all three new/renamed drafts sit at 📝 pre-NIP; moving any to 🧪 publish-ready → 🚀 is a deliberate authoring/product act (README status ladder).
- [ ] **Promote #344–#348 staging→main** — docs-only batch, no prod-hold; one `/cycle-prod` (also OPEN.md row).

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time: 474 phase commits · 89 reviews decided · kick-back rate 2% (churn 2 — nip-reorg #3's CHANGES_REQUESTED→PASS is one) · books open 2 / closed 10 · cycle-time median 0d.

| Finding | Source | Terminal state |
|---|---|---|
| Epic-bookkeeping edits (story-marker flips) must be listed in the implementing story's ADR edit table — S3 did it unlisted (flagged, accepted), S4 listed it (row 13) | reviews/nip-reorg/3 (non-blocking #1) → ADR 0004 row 13 | **declined** (no harness edit): the ADR template's Implementation-notes section already demands a complete edit list; the convention is now precedented across two nip-reorg reviews — revisit only if it recurs |
| Local stack staleness burns a differential `npm test` baseline run per story (11 environmental suite failures + count wobble); shared checkout pinned at #305 while origin advanced ~43 PRs | S1–S4 implementation/review gate runs | **OPEN.md row #27** |
| Mid-story scope amendment handled via user-gated story-AC edit + dated ADR Amendment section + re-review of fix+amendment together (S3) — worked cleanly; kept the ratified/normative boundary intact under new design input | ADR 0003 § Amendment; reviews/nip-reorg/3 re-review | **declined** (no harness edit): pattern conformed to existing gate rules; recorded here as reusable precedent |
