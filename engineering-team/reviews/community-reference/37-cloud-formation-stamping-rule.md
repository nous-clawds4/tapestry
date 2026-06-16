# Review: Story 37 — Cloud formation & multi-z stamping rule (W11)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-13
**Diff:** `git diff abaaf388~1..abaaf388` (commit abaaf388) — base staging; story 3684602b + ADR ee5ce910 precede.
**Mode:** Docs-mode (Protocol-Spec workflow), design-only ratification. Test Design skipped by design. Audit = accuracy + consistency + ADR conformance; tests run only to confirm no regression.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. All 33 suites green; `Overall: PASS`. No regression.
- [x] `npm run test:playwright` — n/a (no browser/UI surface; documents only).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Scope guard (design-only)

- [x] `git diff --stat` shows exactly 3 files: `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`, `protocols/drafts/tapestry-concepts.md`, `protocols/worksheet.md` (19 insertions / 6 deletions).
- [x] **NO source files changed** — `git diff --name-only` filtered against `src/ firmware/ public/ views/ routes/ test/` returns NONE. `firmware/active/manifest.json` untouched. ADR 0029 and all prior stories/reviews (immutable) untouched.

## Spec adherence (acceptance criteria — each testable by reading the ratified docs)

- [x] **ADR exists** ratifying the frame, citing the scope conversation, the handoff (D1 rev 2, O11/O12), and building on ADR 0029 + §22 (ADR 0033, lines 6–7).
- [x] **Cloud formation (O11)** — derived top-k of the W1 grapevine-resolved consensus (incoming inherit-typed edges, GrapeRank-weighted from observer's PoV); **never a published object/manifest** (no curator; no-privileged-center); membership is consensus rank; mutual pointer-`b` = navigation, not a gate. (tapestry-concepts.md:57.)
- [x] **Rotation (O11) emergent** — nobody governs it; nothing to "detect"; author/consumer recompute; §22 trajectory `grapevine-resolved top-k → firmware-blessed (cold-start) → none`; organic clouds bootstrap from singletons. (tapestry-concepts.md:58.)
- [x] **Write-time anchor: affiliation-anchored** — stamp the *declared* community's cluster, not the concept-global top-k. (tapestry-concepts.md:59.)
- [x] **Stamping rule (O12)** — personal `z` required (≥1, may point at a private header) + up to a cap of cloud handles; order not load-bearing; "**consumers MUST NOT depend on order**" present verbatim. (tapestry-concepts.md:60.)
- [x] **Re-stamp (O12): lazy author re-emit** (ADR 0022 pattern, same `d`-address, kind 39999); named lossiness (foreign-authored / inactive-author / kind-9999) present. (tapestry-concepts.md:61.)
- [x] **Consistency note — containment-only**: this cloud is for containment items; membership assertions keep the single shared applied-concept handle ("tag against it"); two non-overlapping mechanisms; membership design not reopened. (tapestry-concepts.md:62.)
- [x] **Deferred tuning named as NOT ratified** — exact cap `k` (~5), ranking formula, firmware cold-start cluster contents. (tapestry-concepts.md:55; worksheet.md:103; ADR 0033 §Decision pt 7.)
- [x] **Lands in tapestry-concepts.md** — the position-only paragraph expanded into the ratified frame; kept as a *convention* on top of the base NIP's already-permitted multi-`z`. (tapestry-concepts.md:53–64.)
- [x] **Worksheet W11 graduated** (Open → `Graduated → [tapestry-concepts spec] · resolved 2026-06-13`), W5 graduation format matched; **handoff O11/O12 marked resolved**. (worksheet.md:99–104; handoff:185–186.)
- [x] **Honest target/not-wired framing** — explicit not-yet-wired carve-out: "reads the W1 grapevine-resolved consensus signal, which (like the resolver) does not exist on this deployment. Implementation is gated on on-wire `b`-tags and the three-branch reconciliation." (tapestry-concepts.md:55.) No claim the cloud / W1 consensus aggregation / resolver is implemented anywhere in the diff. Worksheet closes with "Design-only, gated on the resolver + on-wire `b`-tags behind the three-branch reconciliation." (worksheet.md:103.)

## ADR conformance (inventoried sites)

- [x] **tapestry-concepts.md** — the ~line-53 paragraph expanded exactly as the Implementation-notes site prescribes (cloud=derived top-k, never-a-manifest, mutual-`b`=navigation, affiliation-anchored, personal-`z`-required + ≤cap, order-non-binding, rotation emergent + §22 + singletons, lazy re-emit + named lossiness, containment-only note, deferred tuning + target/not-wired). Convention framing preserved.
- [x] **worksheet.md (W11)** — Status flip + Resolution paragraph + refreshed Refs (community-reference ADR 0033; scope conversation; D1 rev 2), W5 format.
- [x] **handoff** — O11/O12 marked resolved (community-reference ADR 0033 / story #37); header stays 🔴 OPEN per ADR (gated code remains). No spurious header flip.
- [x] **Checked-clean list honored** — BIBLE untouched (convention's home is tapestry-concepts; §5 multi-`z` pointer already exists and stays accurate); `inherit-from.md` / membership design not reopened; ADR 0029 + prior stories/reviews immutable; `firmware/active/manifest.json` untouched; `src/` no code.
- [x] **Nothing beyond scope** — no W8/registry-as-DList/seeding/resolver code touched; deferred tuning not pinned; membership design only referenced for the boundary.

## Consistency cross-checks

- [x] **vs ADR 0029 consensus-aggregation semantics** — the spec's "incoming inherit-typed `b` edges, weighted by each child author's GrapeRank influence from the observer's PoV" matches `inherit-from.md` § Aggregation (line 91: "incoming `INHERITS_FROM` edges … a trust-weightable signal an observer can rank"; pointer-typed = zero weight v1) and is verbatim-faithful to BIBLE §22 line 1454.
- [x] **vs §22 trajectory** — `grapevine-resolved top-k → firmware-blessed cluster (cold-start) → none` matches BIBLE §22 line 1450 exactly (firmware as cold-start default).
- [x] **vs communities.md containment-vs-membership boundary** — membership rides the pubkey-tagging primitive with a single shared applied-concept handle (`["a","39999:<tagAuthor>:<slug>"]`, communities.md:67/75), distinct from the multi-`z` containment cloud. The spec text does NOT reopen or contradict the single-shared-handle "tag against it" design; it explicitly states the two do not overlap.
- [x] **vs base-NIP Rule 2 (BIBLE §10)** — "personal `z` required — at least one parent pointer per the base NIP / BIBLE §10 Rule 2" matches BIBLE §10 Rule 2 line 375 ("Every ListItem MUST have at least one valid parent pointer (z-tag)").

## Cross-references resolve

- [x] **W11 anchor** `#w11--cloud-formation--multi-z-stamping-rules` resolves to the `## W11 — Cloud formation & multi-z stamping rules` heading (worksheet.md:97); cited from tapestry-concepts.md:64 and handoff:185.
- [x] **W11 → tapestry-concepts § "Multi-`z` stamping"** back-link present in worksheet Refs (worksheet.md, resolving home).
- [x] **inherit-from.md § Aggregation** and **communities.md** links target existing files / sections.
- [x] **Citation hygiene** — community-reference 0033 is epic-qualified throughout the durable spec homes (tapestry-concepts: "`community-reference` ADRs 0029, 0033"; worksheet: "`community-reference` ADR 0033"; handoff O11: "`community-reference` ADR 0033 / story #37"), correctly disambiguated from the different-epic `pov-resolution/0033` cited in BIBLE §27 (lines 1308/1546/1595). The one bare "(ADR 0033)" in handoff O12 sits inside the same bullet pair already epic-qualified by O11 and the doc's own epic context — unambiguous, non-blocking.

## Things tests can't catch

- [x] No secrets, debug logging, commented-out code, or TODOs introduced (prose-only diff).
- [x] No overclaiming: nowhere does the text assert the cloud, the W1 consensus aggregation, the resolver, or on-wire `b`-tags exist — every operative claim is fenced behind the design/not-wired carve-out and the gating note.
- [x] No scope creep: the deferred tuning is left explicitly open; the membership design is not reopened.

## House rules check

- [x] Concept Graph API authority respected — no concepts touched, no events emitted, no firmware reinstall needed (documents only; ADR §Consequences and story both confirm).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:186** — O12's resolved annotation reads "(ADR 0033)" without the `community-reference` epic prefix that O11 (line 185) and the spec homes use. Unambiguous in context (same bullet pair, b-tag-affiliation handoff). Optional: epic-qualify for symmetry on a later touch. Not blocking.

## Verdict
**PASS**

The diff is exactly the three inventoried sites, prose-only, no source touched, `npm test` green. Every story acceptance criterion is satisfied; the ADR's fixed points and checked-clean list are honored; all four consistency cross-checks hold against their sources (inherit-from § Aggregation, BIBLE §22, communities.md, BIBLE §10 Rule 2); cross-refs resolve and the community-reference 0033 citation is epic-qualified in the durable spec homes. Critically for a design-only ratification, the new text is honestly framed as design/target/not-wired and never claims the cloud or W1 consensus machinery is implemented. Mergeable as-is.
