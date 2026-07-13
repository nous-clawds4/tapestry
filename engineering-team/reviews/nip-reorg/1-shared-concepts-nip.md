# Review: Story 1 — Author the Shared Concepts NIP

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-12
**Mode:** docs-mode (protocol-spec workflow §3 — accuracy/consistency audit; Test Design skipped by design)
**Diff:** `git diff a34358c7..14be2631` (commit `14be2631`, branch `docs/nip-reorg-s1-shared-concepts`, base `origin/staging` @ `5f326fac`)
**Files touched:** `protocols/drafts/shared-concepts.md` (new, 84 lines), `protocols/drafts/inherit-from.md` (2 hunks), `protocols/README.md` (1 row) — exactly the three files ADR note 4 authorizes; no non-`.md` file in the diff (verified by `--name-only`).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` at `14be2631` — **FAIL overall, with exactly the caveated environmental failure set**: 11 suites (`profile-tags` 10p/3f, `profile-tags-publish` 6p/1f, `tag-detail-publish` 7p/2f, `tag-index-publish` 8p/1f, `profile-tag-polish` 7p/4f, `pin-a-tag-publish` 1p/6f, `tl-publication-from-pins` 9p/1f, `tl-publication-from-pins-publish` 2p/5f, `customize-pin-curation-publish` 0p/3f, `most-pinned-tag-index-publish` 0p/7f, `tag-detail-curated-view-and-pin-polish-publish` 0p/1f), 25 skips.
- [x] `npm test` at clean base `a34358c7` — **identical**: same 11 suites, same per-suite pass/fail counts, same 25 skips. The failures are the known stale-bind-mounted-Docker-stack condition (empty graph, #305 checkout), not regressions; the diff contains no source or test files, and the differential run proves zero new failures. Binding gate is CI's stack-free job.
- [x] No new failure appears on the branch vs base.
- [x] _Playwright — not applicable (no browser/UI change; docs only)._
- [x] _Lint/typecheck/build not configured — skipped._ No tooling added (no `package.json` change in diff).

## Spec adherence (AC-by-AC, docs-mode)

- [x] **AC1 — the spec exists.** `protocols/drafts/shared-concepts.md:1-5` carries the repo-metadata header: Status 📝 pre-NIP (`:2`), Canonical: not yet published (`:3`), Implementation line mirroring inherit-from's (`:4` vs `inherit-from.md:4` — implemented pointer-`b` seed / not-implemented resolver+aggregation+cloud), and Sources naming all five required items (`:5`): `community-reference` ADR 0033, inherit-from.md § Aggregation as extraction origin, worksheet W1, `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`, `docs/NIP_REORG_DESIGN_HANDOFF.md`.
- [x] **AC2 — required content, as identifiable sections.**
  - What a shared concept is, D2 convention-as-outcome vocabulary: `:12` (intro), `:20` (Terminology — "A shared concept is a concept whose handle is in conventional use").
  - Declared affiliation (pointer-`b`): `:31-41`.
  - Deference (inherit-`b`): `:43-47`.
  - Aggregated deference, observer-resolved, with the deference-aggregation vs discovery-walk distinction migrated from inherit-from: `:49-56`.
  - Cloud model per ADR 0033: `:58-68` — derived top-k `:60`; never a published manifest `:62`; mutual pointer-`b` navigation-not-gate `:63`; emergent rotation `:64`; firmware-blessed cold-start precedence `:65`; bootstrap-from-singleton `:66`.
  - Cross-deployment identity trajectory with W1 explicitly named as the open tracker: `:70-78` (`:72` "tracked as worksheet W1"; `:78` "does not resolve W1").
  - Explicit no-new-wire-format statement: `:12`.
- [x] **AC3 — vocabulary policy.** `grep -in 'canonical\|consensus' protocols/drafts/shared-concepts.md` → exactly one hit: `:3` — the `**Canonical:**` metadata field name inside the block marked "not part of the spec text" (`:1`). Zero hits in normative text. `grep -in 'consensus' protocols/drafts/inherit-from.md` → zero hits post-edit. Every description of the aggregated-deference signal carries the observer-relative qualifier: `:12` ("how an observer resolves"), `:22` (the normative observer-relative rule), `:49` (section title "(observer-resolved)"), `:53` ("the observer weighs … from the observer's point of view"), `:60` ("an observer's aggregated deference"), `:65` ("the observer's trust-weighted aggregate"), `:84` ("from the observer's point of view").
- [x] **AC4 — single normative home.** `inherit-from.md:88-90`: § "Aggregation: who defers to a definition" retains its heading and is reduced to a pointer at Shared Concepts plus the one mechanical relay fact (type element non-indexed; `#b` returns both types; filter locally) — exactly ADR note 2. The migrated distinctions now live only in `shared-concepts.md:51-54`.
- [x] **AC5 — discoverable.** `protocols/README.md:58` — index row in the spec-index table, 📝 pre-NIP, format mirrors neighboring rows and ADR note 3 (backticks around `b`/`nip-reorg` are the table's existing convention).
- [x] **AC6 — nothing else moves.** Diff stat: 3 files only; `tapestry-concepts.md` § Multi-`z` untouched (S3); no other `protocols/` file changed. `npm test` differential vs base: identical (see gates).

## ADR adherence

- [x] **Section outline (ADR note 1) followed exactly:** header `:1-5`; intro `:9-12`; Terminology with the three defined terms + the observer-relative rule stated once, normatively `:14-22`; Relationship to other specs `:24-29` (DList, Tapestry Concepts, Inherit-From, class-thread-tags **by current filename** `:28` per the ADR — S2 renames, S4 sweeps; Tags/Communities as downstream `:29`); Declared affiliation `:31-41` (firmware seeding = brief cite of ADR 0034 / tag-federation ADR 0002, not a restatement); Deference `:43-47` (trust-coupling by pointer to Inherit-From § Security considerations at `:18`); Aggregated deference `:49-56` (migrated text; old "Consensus (deference)" label → "Deference aggregation"; rationale sentence "a bookmark is not agreement" carried along `:53`); Clouds `:58-68` with the italic design-only callout `:68` mirroring tapestry-concepts'; Cross-deployment identity `:70-78`; Security considerations `:80-84`.
- [x] **O2 resolution honored:** the ratified selector precedence is stated normatively (`:65`), the unresolved identity question is stated as open and pointed at W1 (`:72`, `:78`); W1 remains the sole tracker (worksheet untouched by this diff — its re-pointer is S4 per the story's out-of-scope).
- [x] **inherit-from edits (ADR note 2):** § Aggregation body → pointer + mechanical fact (`:88-90`); § Scope (v1) "zero **consensus** weight" → "zero **aggregation** weight" (`:82`). Nothing else in the file changed (diff shows exactly two hunks).
- [x] No unauthorized dependencies/tooling (docs only).
- **Deviations (flagged, judged non-blocking — see Findings):** (1) § Security's second paragraph (`:84`, observer-weighting as sybil gate) goes beyond the ADR outline's single point; (2) `inherit-from.md:82` also rewrites "In aggregation (below)" → "In aggregation ([Shared Concepts](./shared-concepts.md))", one word beyond the ADR's stated single vocabulary alignment in that section.

## Accuracy audit (are the claims true?)

- [x] **Implementation-status claims (`:4`, `:41`).** Verified in source: the pointer-`b` firmware emitter exists — `src/firmware/install.js:1001` (`pass_communityReferences`), `:1059` (`['b', cr.headerATag, 'pointer']` appended), `:1057` (never-clobber), `:1261` (`seededB` stub gate) — matching `community-reference` ADR 0034's decision; `tag-federation` ADR 0002 is precisely the "applied to the tag concepts" manifest step the spec cites. The "resolver … not implemented" claim matches inherit-from.md:4 and ADR 0033's design-only framing.
- [x] **Fidelity of the migrated Aggregation text** (vs `git show a34358c7:protocols/drafts/inherit-from.md` § Aggregation, visible in the diff hunk): the child→target preamble, the inherit-only counting rule with "everyone who defers to this definition", the "a bookmark is not agreement" rationale, and the both-types discovery-walk bullet (incl. the `#z`-union example) are preserved at `shared-concepts.md:51-54`; only D2 vocabulary changed ("Consensus (deference) aggregation" → "Deference aggregation"; "masquerade as consensus" → "masquerade as deference", per the handoff §4 table). The original's W1 sentence moved to § Cross-deployment identity (`:72`) — its ADR-designated home. The added GrapeRank parenthetical (`:53`) is sourced (ADR 0033 Option A: "GrapeRank-weighted from the observer's PoV") and correctly marked reference-deployment-specific.
- [x] **Cloud model fidelity** (vs `community-reference` ADR 0033 Decision 1-2/7-8 and `tapestry-concepts.md:53-57`): all five bullets map 1:1 to ratified fixed points; no invented properties; no dropped *cloud* properties (ADR 0033's items 3-6 — affiliation anchor, stamping rule, lazy re-emit, containment-only — are stamping-side and belong to S3 per this story's ADR outline; correctly absent here). The design-only callout (`:68`) matches tapestry-concepts' (`:55`) including the deferred cap (~5)/formula/cold-start list (ADR 0033 Decision 7 confirms "~5"). "Gated on on-wire inherit-typed `b` tags" is an accurate refinement of ADR 0033's "on-wire `b`-tags" now that pointer-`b` is on-wire (ADR 0034/tag-federation 0002).
- [x] **W1 trajectory** (vs `protocols/worksheet.md:9-21`): the three stages match W1's candidate directions (firmware-blessed pointer "accepted temporarily" `:74`≈W1:17; registry-as-DList, "Grapevine-ranked" rendered observer-relative `:75`≈W1:18; deference aggregation `:76`≈W1:19) and the handoff D3 trajectory. Openness preserved: "Candidate end state" (`:76`), "does not resolve W1" (`:78`) — consistent with W1's "none ratified".
- [x] **W1 anchor:** `../worksheet.md#w1--cross-deployment-concept-identity` matches the actual heading `## W1 — Cross-deployment concept identity` (worksheet.md:9; em-dash collapses to the double hyphen). Same style as the pre-existing W6 link, whose heading (worksheet.md:57) is unchanged.

## Cross-references

- [x] Every relative link target in the three changed files exists on disk (verified: `nips/decentralized-lists.md`, `drafts/tapestry-concepts.md`, `drafts/class-thread-tags.md`, `drafts/tags.md`, `drafts/communities.md`, `drafts/inherit-from.md`, `drafts/shared-concepts.md`, `worksheet.md`).
- [x] Links use current filenames — `class-thread-tags.md` (`:28`), not the future S2 rename.
- [x] Prose §-citations name real sections: Inherit-From § Security considerations (inherit-from.md:84), § "Aggregation" (`:88`), § "Resolution"; Tapestry Concepts § "Multi-`z` stamping" (tapestry-concepts.md:53, a bold run-in heading — the corpus's own citation style for it).

## Boundary / duplication audit

- [x] The two **scheduled transient duplications** are present exactly as the ADR's Decision acknowledges: cloud prose vs `tapestry-concepts.md:55-57` (until S3), selector vs BIBLE §22's framing (until S4).
- [x] No additional normative duplication: `b` resolution semantics, override rules, first-listed-wins, closure — all pointered, never restated (`:27` "This NIP defines no `b` semantics of its own"; `:45`, `:56`). Relay mechanics summarized in one parenthetical with the normative home named (`:56`).
- [ ] Two *illustrative* restatements noted (non-blocking, below): the wire-shape example at `:36` and the absent-type parenthetical at `:45`.

## Concept-graph integrity / house rules

- [x] Docs-mode: no concept definitions changed; **no firmware reinstall required** (ADR Consequences, confirmed — no `firmware/` or `src/` file in diff).
- [x] Handle forms in examples are correct `kind:pubkey:slug` shapes with placeholders (`:36`, `:72`); no hardcoded deployment pubkeys (grep for `82b75e47`/`919ba08a` → none) — the spec practices the key-neutrality it preaches.
- [x] No new lint/typecheck/build tooling; Concept Graph API authority untouched.
- [x] No secrets, no debug text, no scope creep beyond the three authorized files.

## Findings

### Blocking

None.

### Non-blocking

1. **`protocols/drafts/shared-concepts.md:36`** — the fenced `["b", "39998:<sharedHeaderAuthor>:<d-tag>", "pointer"]` example restates the `b` wire shape whose normative home is `inherit-from.md:25`. Clearly illustrative (the spec twice disclaims defining `b` semantics), but if the primitive's format ever changed this example goes stale silently. Optional: S4's sweep should include examples in its cross-check list.
2. **`protocols/drafts/shared-concepts.md:39,53,82`** — "zero aggregation weight" is stated unqualified, while the primitive scopes it "in v1; graded weighting is deferred to the future registry ADR" (`inherit-from.md:82`). `:82`'s "hard rule inherited from the primitive" correctly delegates authority, but if the registry ADR ever grades pointer weight, three sentences here need revision. Optional: add "in v1" once (e.g. at `:53`).
3. **`protocols/drafts/shared-concepts.md:84`** — § Security's second paragraph (observer weighting as the sybil gate) exceeds the ADR outline's single stated point. It is accurate (grounded in ADR 0033's GrapeRank-from-observer-PoV design) and materially improves the security section; flagged only as an ADR-outline deviation.
4. **`protocols/drafts/inherit-from.md:82`** — "In aggregation (below)" → "In aggregation ([Shared Concepts](./shared-concepts.md))" is one edit beyond the ADR note 2's stated single vocabulary alignment in § Scope. It is necessary (leaving "(below)" would dangle after the § Aggregation body moved) and consistent with the ADR's intent.

### Harness friction

1. None new. (The 11-suite environmental failure of the local bind-mounted stack is already-known state — see the local-dev-stack memory note; the binding gate is CI's stack-free job.)

## Verdict

**PASS**

The diff is exactly the three files the ADR authorizes; all six ACs verified with evidence; the migrated text preserves meaning with only the D2 vocabulary change; every corpus claim checked out against ADR 0033/0034, tag-federation ADR 0002, `src/firmware/install.js`, tapestry-concepts § Multi-`z`, and worksheet W1; all cross-references resolve; the vocabulary gate is clean; and the test gate is regression-free (differential run against the clean base shows an identical failure set). The four non-blocking notes are polish/S4-sweep candidates, not defects.

## On PASS (same commit)

- [ ] Story `**Status:**` flip to `Done` — **deferred to the parent agent** (this review session was instructed to write only this report and not to edit other files or commit). **Mandatory in the same commit as this review:** harness-lint **L1** fires (`review …/1-shared-concepts-nip.md is PASS-final but story status is 'Approved'`) and `npm test`/CI stack-free will FAIL until `engineering-team/stories/nip-reorg/1-shared-concepts-nip.md` reads `**Status:** Done` (verified by running `scripts/harness-lint.sh` with this report on disk). Also fill the story's `Review:` link.
- [ ] Completion detection — the book/epic is **not** complete: S2 (class-thread rename), S3 (Stamping NIP), S4 (index & cross-ref sweep) remain open per the handoff §5 plan. No close-book offer.
