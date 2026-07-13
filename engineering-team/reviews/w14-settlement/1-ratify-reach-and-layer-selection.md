# Review: Story 1 — Ratify Reach and the layer-selection rule (settle W14)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-13
**Mode:** docs-mode (protocol-spec workflow §3 — accuracy + consistency audit; Test Design skipped by design)
**Diff:** `git diff a0f29758..b5b2dcd4` (spec commit `b5b2dcd4`, branch `docs/w14-settlement-s1`, base `origin/staging` @ `778a00b0`)
**Inputs:** story `stories/w14-settlement/1-ratify-reach-and-layer-selection.md` · ADR `decisions/w14-settlement/0001-reach-and-layer-selection.md` · acceptance frame `audits/w14-settlement/book.md` § Acceptance frame

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**; pre-existing waivers only.
- [x] `npm test` — **Overall: FAIL, fully accounted for by the known environmental caveat.** Exactly 11 failing suites (profile-tags, profile-tags-publish, tag-detail-publish, tag-index-publish, profile-tag-polish, pin-a-tag-publish, tl-publication-from-pins, tl-publication-from-pins-publish, customize-pin-curation-publish, most-pinned-tag-index-publish, tag-detail-curated-view-and-pin-polish-publish) — the tag/pin/TL stack-dependent family documented in OPEN.md #27, all with environmental causes (`fetch failed`, strfry scan against the stale local stack, missing Meili docs). **No new failing suite**; `stack-free-npm-test`, `harness-lint`, `harness-stats`, and `ci-test-job` suites all PASS. The diff touches zero source files (4 markdown files), consistent with a docs-only non-regression.
- [x] `npm run test:playwright` — n/a (no browser/UI surface; docs-only).
- [x] _Lint/typecheck/build not configured — skipped._

Mechanical checks from ADR note 5 (verification plan), all run:

- [x] Diff file set = **exactly** the 4 ADR files (`git diff --stat`: inherit-from.md +2, shared-concepts.md +23/−1, stamping.md +11/−20, worksheet.md +5/−3).
- [x] `inherit-from.md:53` (the "Affiliation rides the closure … never through mere correspondence" paragraph) **byte-identical** base vs head — md5 `91ded541…` matches on both sides; the hunk only appends one standalone sentence + blank line after it (`inherit-from.md:55`).
- [x] Stamping write-rule **floor items 1–2: zero diff hunks** — both appear only as context lines (`stamping.md:22-23`); the ratified floor is verbatim-unchanged.
- [x] `grep -i "candidate|none.*normative|open design question" protocols/drafts/stamping.md` → **0 hits** (whole file, stronger than the "settled parts" requirement).
- [x] Vocabulary gate: `canonical|consensus` in added diff lines → **0 hits** (the metadata `Canonical:` field is untouched context).
- [x] Links/anchors resolve: `shared-concepts.md § Reach` exists (`:56`, between § Aggregated deference `:47` and § Clouds `:75` per ADR Option A); table targets `§ "Declared affiliation"` (`:33`) and `inherit-from.md § "Resolution: the resolved definition"` (`inherit-from.md:49`) exist; `stamping.md § "The write rule"` (`:18`) exists; the W14 anchor `#w14--subsetancestor-stamping-z-expansion-across-class-thread-structure` still derives from the unchanged worksheet heading (`worksheet.md:134`); relative paths (`./drafts/…`, `../worksheet.md`, `./shared-concepts.md`) all correct.
- [x] W14 Status parses `Resolved → <homes> · raised 2026-07-12 · resolved 2026-07-13` (`worksheet.md:136`), matching the W11 precedent shape (`worksheet.md:99`); W11 untouched (no hunks outside the W14 block).

## Spec adherence (AC-by-AC)

- [x] **AC1 — Reach defined, once.** `shared-concepts.md:56-73`: definition at `:66` ("the set of headers connected to the author's own header through `b` edges of *either* type, followed transitively — the author's own edges and third parties' alike"); the three-construct split explicit as the table (`:58-64`) with the deference-closure row cross-referencing Inherit-From § Resolution; permission-shaped property at `:70` ("expand … opening a handle as a candidate stamp — but nothing in reach acts on the author's behalf … at write time … enables; it never routes"); publisher-side SHOULD / never a reader gate at `:71` ("A reader MUST NOT treat an out-of-reach stamp as invalid: there is no global stamp validity to check … observer-weighted trust … not … path validation"). D2 vocabulary (pointer-typed / inherit-typed / any-type) used throughout; observer-relative rule restated in-section (`:73`).
- [x] **AC2 — write rule extends.** Floor items 1–2 verbatim (zero hunks, above); new item 3 (`stamping.md:25`): demand-selected extras = ancestor set-layers × branch layers within the author's **reach**, "selected by **anticipated filter demand**", "within the cap", "**Ancestors are never required**; extras are a discoverability optimization, not membership". The former "affiliation-backed" reach phrasing is gone from stamping (the old Open-section bullet was replaced; the settled section and item 3 now use the Reach term with § Reach citations).
- [x] **AC3 — read contract completes.** New bullet `stamping.md:48`: breadth queries **MUST** walk `IS_A_SUPERSET_OF` and union `#z` per subset "— or knowingly accept the **defined floor**: a non-expanding client sees the direct layer's members only. That floor is a specified outcome of this contract, not a defect." MUST-NOT bullet updated (`:46` — ancestor stamps "are the *optional* tier of the write rule (item 3), never guaranteed"); MAY-infer bullet cites § Reach for branch inference (`:47`). Mutually consistent: MAY-infer covers capability-dependent recovery generally; breadth-MUST-expand covers the specific "all X including subsets" intent; the unchanged Query-strategy bullet (`:49`) is concept-rooted (cloud + correspondence-graph walk) and does not conflict with author-rooted Reach.
- [x] **AC4 — question closes.** `§ "Open: which layers to stamp (set × branch)"` → `## Layer selection (set × branch) — settled` (`stamping.md:51`) with provenance line (`:53` — 2026-07-13 ratification, W14, `w14-settlement` ADR 0001); two-axis space + dynamic-ladder facts kept as normative context (`:55`); the rule stated (`:57` — floor per items 1–2, extras per item 3, ancestors never required); grep for candidate/none-normative/open-design-question = 0. W14 flips to Resolved (`worksheet.md:136`) with both normative-home pointers; Resolution block appended (`:140`); question body preserved (`:138` — only the live § citation retitled, matching the nip-reorg #4 precedent of retitling live citations while leaving history unrewritten).
- [x] **AC5 — Inherit-From intact.** One appended standalone sentence (`inherit-from.md:55`): "The **any-type** counterpart — *reach*, the closure over both `b` types — is a distinct construct defined in [Shared Concepts](./shared-concepts.md) § Reach; it feeds stamp selection, never resolution." Line 53 byte-identical (md5-verified). No other change to the file.
- [~] **AC6 — gates and scope guard.** Reach normative in exactly one place (below); vocabulary gate clean; links/anchors resolve; historical records untouched (all remaining "Open: which layers to stamp" strings live in `engineering-team/` history: nip-reorg audit/ADRs/stories/reviews — correctly left alone); harness-lint clean; `npm test` = known-caveat baseline, no new failures; diff limited to the 4 ADR files. **However** the file-set limit leaves two *live* corpus surfaces stale — see Blocking finding 1. AC6 is met to the letter; the corpus-consistency goal behind it is not.

## Frame fidelity (the heart of this audit)

**(A) Reach** — every clause present, normative, and accurate:

| Frame clause | Where | Fidelity |
|---|---|---|
| Affiliation = one-hop declared `b` claim | table row `shared-concepts.md:62` ("no — one declared hop"); § Declared affiliation sentence `:37` ("Affiliation is the **single hop**") | exact |
| Deference closure = inherit-typed transitive, unchanged | table row `:63` ("inherit-typed only … pointer breaks the chain"); `inherit-from.md:53` byte-identical | exact |
| Reach = any-type transitive `b` closure **from the author's own header** | `:66` | exact |
| Third-party edges expand the candidate set — enable, never route; author selects at write time | `:70` | exact ("Growth of the graph enables; it never routes" is a restatement, not a strengthening) |
| Publisher-side SHOULD; never a reader-side validity gate | `:71`; echoed by `stamping.md:25` ("A publisher SHOULD stamp only handles within its reach; readers do not enforce this") | exact, no contradiction between the two sites |
| Reader MUST NOT treat out-of-reach stamps as invalid | `:71` | exact |
| Spam control = observer-weighted trust | `:71` ("spam control belongs to observer-weighted trust (§ 'Aggregated deference'), not to path validation") | exact |

**(B) Layer selection** — every clause present:

| Frame clause | Where | Fidelity |
|---|---|---|
| Floor (personal `z` + joined-concept cloud handles) verbatim | items 1–2 zero hunks | exact |
| Optional demand-driven intersections (ancestor set-layers × reached branches) within the cap, drawn from reach | `stamping.md:25`, `:57` | exact |
| Ancestors never required | `:25`, `:57` (bold both times) | exact |
| Breadth queries MUST expand via superset walk or knowingly accept floor-level recall | `:48` | exact |
| Non-expanding floor is a **defined** outcome (direct-layer members only) | `:48` ("a specified outcome of this contract, not a defect"), referenced from `:59` | exact |

Nothing ratified was dropped, weakened, strengthened, or invented. Retained context facts (dynamic ladder, ~2-slots cap pressure, lazy re-emit staleness, smart/dumb recovery framing) carry over from the prior Open section without normative drift.

## ADR adherence

- [x] Files changed = the ADR's 4, edits match implementation notes 1–4 (placement, table shape, gloss position near the observer-relative paragraph `shared-concepts.md:22`, item-3 content, retitle + provenance, W14 flip format per the W11 precedent as the ADR chose).
- [x] No new dependencies/tooling; docs-only.
- [x] **Firmware reinstall:** ADR says No — correct; no concept definitions changed (no wire-format change; Reach is a read-side construct over existing `b` edges).

**Deviations assessed (both fine):**

1. **"candidate stamp" → "possible stamp"** (`stamping.md:55`). Beyond the ADR's literal text but *required* by AC4/ADR note 5's grep gate (`candidate` → 0 in the settled section); meaning-preserving. Note the word "candidate" survives once in `shared-concepts.md:70` ("opening a handle as a candidate stamp") — that is frame-(A) language ("expand an author's candidate set"), in a normative sentence, in a different file; AC4's ban scopes to stamping's settled parts. Compliant.
2. **ADR note 2's "header W14 tracking note updated to resolved" reduced to Sources-append** (`stamping.md:5`). Verified against base `778a00b0`: the stamping metadata header never contained a W14 tracking note (the W14 tracking line lived in the now-replaced Open section). Appending the ratification ADR to Sources is the correct minimal realization of a note written against a mistaken premise. Non-blocking; recorded here as the deviation log.

## Single normative home

- [x] Full Reach definition exists **once** (`shared-concepts.md § Reach`). Elsewhere: Terminology gloss + pointer (`:22`), one-hop pointer sentence (`:37`), inherit-from pointer sentence (`inherit-from.md:55`), stamping citations (`:25`, `:47`, `:55`), worksheet Resolution summary + pointer (`worksheet.md:140`). None restates the definition or its properties beyond a compressed appositive.
- [x] No cloud or deference property restated anywhere new (cloud mechanics stay in § Clouds; aggregation stays in § Aggregated deference / Inherit-From § Aggregation — all cited, not copied).
- [x] W14's Resolution block summarizes A+B in two sentences with pointers; the normative text lives in the two specs.

## Concept-graph integrity

- [x] No concept handles touched; no schema/concept-definition change; no code — `/summaries` orientation n/a. Handles appearing in unchanged context remain `kind:pubkey:slug`.

## Things tests can't catch / house rules

- [x] No secrets, no debug artifacts, no commented-out prose blocks.
- [x] No new lint/typecheck/build tooling.
- [x] Historical engineering-team records untouched (verified by grep: every remaining old-title reference is under `engineering-team/` history or the ✅-SUPERSEDED nip-reorg handoff).
- [x] Scope: no edits to tags.md/communities.md (story out-of-scope respected; ADR confirmed no strictly-required touchpoint there — correct, those specs cite stamping's convention, not the open question).

## Findings

### Blocking

1. **`protocols/drafts/tapestry-concepts.md:53` + `protocols/README.md:59` — two live corpus surfaces still declare the question open after this diff settles it.**
   - `tapestry-concepts.md:53`: "The convention — the write rule, re-stamping, the read contract, and **the open layer-selection question** — is normative in [Stamping](./stamping.md)" — now false: stamping contains no open question, and the settled rule *is* normative there.
   - `protocols/README.md:59` (Stamping row, Notes): "(extraction of tapestry-concepts § Multi-`z`; **open subset question → W14**)" — now false; this README is the CLAUDE.md-designated per-spec status index that protocol work is required to consult first, so a stale "open" note here defeats the exact purpose of this book.
   - Both sentences were *true before this diff and false after it* — this change introduces the inconsistency; it is not pre-existing drift. Precedent cuts the same way: nip-reorg #3 updated the tapestry-concepts pointer phrase in-story when this very section was created (`reviews/nip-reorg/3-stamping-nip.md:102`), and nip-reorg #4 swept `protocols/README.md` cross-refs. The gap is in the ADR's site enumeration (its Out of scope considered only tags.md/communities.md), not an Implementer error — but as the last gate I can't pass a settlement ratification that leaves two live surfaces saying "open."
   - **Asked change:** Architect amends ADR 0001's edit plan (+ verification-plan file count) to add the two one-line touchpoints; Implementer updates the two phrases (e.g. `tapestry-concepts.md:53` "…the read contract, and the settled layer-selection rule…"; `README.md:59` "…§ Multi-`z`; layer-selection question settled → W14 resolved"). Re-review will be fast — everything else in this diff is clean. (Alternative, if the user explicitly rules the sweep out of this book's scope: an OPEN.md row logging the two stale pointers before the book closes — but the in-story fix is recommended, since this single-story book closes immediately after and would otherwise close over a known live inconsistency.)

### Non-blocking

1. **`stamping.md:25`** — "readers do not enforce this (see the read contract)": the reader-side rule (MUST NOT treat out-of-reach stamps as invalid) normatively lives in `shared-concepts.md:71` § Reach, not in the read contract, and the read contract correctly does not restate it. The ADR's own phrasing was "(per § Reach; readers don't enforce)". No contradiction — § Reach is already cited earlier in the same item — but the parenthetical points a reader at the wrong home. Optional improvement on next touch: "(per § Reach)".
2. **ADR 0001 note 2 premise slip** (nonexistent header W14 tracking note) — handled correctly by the Implementer; recorded under Deviations above. No action.

### Harness friction

1. None. (The stale local stack / 11-suite caveat is already tracked as OPEN.md #27 and behaved exactly as documented.)

## Verdict

**CHANGES_REQUESTED** — one blocking issue (Finding 1: the two stale live "open" pointers at `protocols/drafts/tapestry-concepts.md:53` and `protocols/README.md:59`). The diff itself is otherwise fully frame-faithful, AC-complete, mechanically verified, and gate-clean; on resolution of Finding 1 the verdict flips at re-review.

## On approval (same commit)

- [ ] Not applicable this round — story `**Status:**` left as `Approved`; no completion detection run.
