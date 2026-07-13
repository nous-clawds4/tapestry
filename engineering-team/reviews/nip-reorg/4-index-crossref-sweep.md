# Review: Story 4 — Index & cross-reference sweep (epic close-out)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-12
**Mode:** docs-mode (protocol-spec workflow §3 — accuracy/consistency audit; Test Design skipped by design). Closing story: obligation-trail audit included.
**Diff:** `git diff 554f3005..7fccbf25` (commit `7fccbf25`, branch `docs/nip-reorg-s4-sweep`, base `origin/staging` @ `80e8ae47`)
**Files touched:** exactly the 8 files ADR 0004 enumerates — `BIBLE.md`, `docs/NIP_REORG_DESIGN_HANDOFF.md`, `engineering-team/epics/nip-reorg.md`, `protocols/drafts/communities.md`, `protocols/drafts/shared-concepts.md`, `protocols/drafts/stamping.md`, `protocols/drafts/tags.md`, `protocols/worksheet.md` (16 insertions, 20 deletions, 12 hunks — the ADR's "~12 small hunks across 8 files" exactly).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` at `7fccbf25` (worktree, node_modules symlinked from the main checkout, removed after) — **FAIL overall, with exactly the caveated environmental failure set**: 11 suites, per-suite counts identical to the clean-base differential recorded across the S1–S3 reviews (`profile-tags` 10p/3f, `profile-tags-publish` 6p/1f, `tag-detail-publish` 7p/2f, `tag-index-publish` 8p/1f, `profile-tag-polish` 7p/4f, `pin-a-tag-publish` 1p/6f, `tl-publication-from-pins` 9p/1f, `tl-publication-from-pins-publish` 2p/5f, `customize-pin-curation-publish` 0p/3f, `most-pinned-tag-index-publish` 0p/7f, `tag-detail-curated-view-and-pin-polish-publish` 0p/1f), 25 skips. **No new failing suite.** The diff contains no `.js`/`.json`; a docs-only change cannot reach these suites. Binding gate remains CI's stack-free job.
- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**; only the pre-existing recorded waivers fire.
- [x] _Playwright — not applicable (docs only)._
- [x] _Lint/typecheck/build not configured — skipped; no tooling added (no `package.json` change)._

## Spec adherence (AC-by-AC, docs-mode)

- [x] **AC1 — worksheet re-aims.** W11 Status (`protocols/worksheet.md:99`): "Graduated → [stamping spec] (convention) + [shared-concepts spec] § Clouds (cloud model)", raised/resolved trail preserved. W11 Refs (`:105`): resolving-home re-aimed the same way, tapestry-concepts retained as the pointer-trail mention ("via the pointer at…"). W1 Refs (`:21`): shared-concepts appended as "(aggregation-policy home; § Cross-deployment identity states the trajectory)" — the ADR row 3 string verbatim. W14 Refs (`:140`): § "Open: subset/ancestor stamping" → § "Open: which layers to stamp". **Histories unrewritten:** the worksheet diff is exactly 4 line-pairs; W11's resolution record (`:101`, "the derived top-k of the W1 grapevine-resolved consensus signal") and W1's body (`:19`, "the consensus signal counts inherit-typed edges only") survive byte-identical in unchanged context — Option C's rejection honored.
- [x] **AC2 — downstream consumers cite Stamping.** `tags.md:26`: "each carries one or more `z` stamps naming… — stamp selection is specified by [Stamping](./stamping.md)"; the W1 parenthetical intact; the singular-`z` staleness fixed; only line 26 touched — no wire-shape/event-shape section edited. `communities.md:26`: Stamping added to the upstream-primitives list, "for containment items, the multi-`z` stamp selection of [Stamping]" with the boundary parenthetical; the cited § title matches `stamping.md:35` (`## Boundary: containment vs. membership`) exactly, and the claim ("membership assertions keep their single applied-concept handle") is accurate against `stamping.md:37`. Both edits at existing "Relationship to other specs" touchpoints; no new sections.
- [x] **AC3 — BIBLE audits.** §23 heading (`BIBLE.md:1545`) → "## 23. Class Thread Relationships (`n`, `s`)"; TOC row (`:36`) text + anchor regenerated; the new anchor `#23-class-thread-relationships-n-s` matches the GitHub derivation of the new heading. Old anchor `#23-class-thread-membership-tags-n-s`: **0 occurrences in living docs** (sole survivor is ADR 0004:33 itself — a historical record describing the change). §22 (`:1523`): the Decision-3 pointer sentence appended to the Resolution-model paragraph — "The protocol-facing statement of this selector — and the cloud/aggregation model that consumes it — is normative in [protocols/drafts/shared-concepts.md]; this section remains the implementation-and-history record" — one sentence, no rewrite; the neighboring "Accepted compromise (Flaw A)" candidate-exit paragraph is unedited (unchanged context in the diff). No `Multi-z`/`Multi-`z`` references exist in BIBLE (grep = 0, matching the ADR census). Glossary rows `:1486`/`:1487` untouched and still correctly say "See §22" (§22 remains in place); no glossary row names a stale location.
- [x] **AC4 — spec polish nits.** `shared-concepts.md:33`: fenced `["b",…]` example replaced with prose + "wire format specified once, in [Inherit-From](./inherit-from.md) § 'The `b` tag'" — the cited heading exists (`inherit-from.md:18`). "(v1)" scoping on all three zero-weight statements: `:35`, `:49`, `:78` (ADR's pre-edit `:39/:53/:82`, shifted −4 by the example removal). `stamping.md:57`: worked example "branch handles" → "cloud handles"; the read-contract bullet's "branch handles" (`:45`) correctly **retained** per ADR row 11 (two-axis inference vocabulary).
- [x] **AC5 — epic paper trail closes.** `docs/NIP_REORG_DESIGN_HANDOFF.md:3`: Status → ✅ SUPERSEDED with the one-line pointer to the three landed specs + "open questions live on in worksheet W14… and W1" per ADR row 12; `scripts/whats-open.sh` matches the 🔴 marker on Status lines (`:47-48`), so the flipped doc correctly drops out of the OPEN scan. (The line credits "S4" without a PR number — necessarily, since the flip rides S4's own PR; noted, fine.) `engineering-team/epics/nip-reorg.md:17`: S4 marker flipped from `_(planned)_` to the story path in the same format as rows 1–3; all four story rows now cite story files that exist on disk — and the epic-file bookkeeping edit is ADR-listed (row 13), closing S3-review non-blocking 1's ask.
- [x] **AC6 — gates and scope guard.** All relative `.md` links in the 8 changed files resolve on disk (scripted check: **0 broken across all 8 files**, including the handoff's three new `../protocols/` links and BIBLE's new root-relative shared-concepts link); anchor-fragment links verified by heading derivation (W1, W11, §23 TOC). Vocabulary gate: no "canonical"/"consensus" introduced in any touched living-spec sentence (grep over the four touched specs — hits are only the `**Canonical:**` metadata field and pre-existing communities.md negation prose in untouched lines). Historical records untouched: no file under `decisions/`, `reviews/`, `done/`, and no prior-epic handoff, appears in the diff. harness-lint clean; npm test differential clean (gates above); diff = exactly the ADR's 8 files.

## ADR adherence

- [x] **All 13 table rows applied; zero edits outside the table.** Hunk-by-hunk mapping: worksheet 4 hunks = rows 1–4; `tags.md:26` = row 5; `communities.md:26` = row 6; BIBLE TOC `:36` + heading `:1545` = row 7; BIBLE `:1523` sentence = row 8; shared-concepts example = row 9; three `(v1)` = row 10; `stamping.md:57` = row 11; handoff `:3` = row 12; epic `:17` = row 13. 12 hunks, nothing unaccounted.
- [x] **The three pre-approved Decision judgment calls implemented as decided:** (1) tags.md wire-accuracy sentence — dual-`z` un-staled at the existing touchpoint, no deployment history in spec text; (2) communities.md upstream-primitives entry with the containment/membership boundary — the mirror of Stamping's own § Boundary link; (3) BIBLE §22 single-pointer-sentence policy — one appended sentence, §25/§26-precedent framing ("this section remains the implementation-and-history record" parallels §23's "This section covers how this codebase implements it"), glossary rows kept.
- [x] The ADR's Consequences assertion ("the TOC is the only in-repo user of the old anchor") verified true post-edit.
- [x] No new dependencies, no tooling, docs only.

## Obligation-trail audit (closing-story duty)

Every scheduled obligation from the epic's ADRs and reviews, with disposition:

| Obligation | Source | Disposition | Evidence |
|---|---|---|---|
| Transient duplication #1 — cloud prose vs tapestry-concepts § Multi-`z` | ADR 0001 Decision | **Closed in S3** | `tapestry-concepts.md:53` is a two-way pointer (normative → Stamping; cloud → Shared Concepts § Clouds) |
| Transient duplication #2 — §22 selector vs shared-concepts | ADR 0001 Decision | **Closed here** | `BIBLE.md:1523` pointer sentence (ADR 0004 row 8) |
| W11 ref points at a pointer-section (reads oddly) | ADR 0003 Consequences | **Closed here** | `worksheet.md:99,:105` re-aimed (rows 1–2) |
| S1 nit 1 — illustrative `b` wire-shape example staleness risk | S1 review, non-blocking 1 | **Closed here** | `shared-concepts.md:33` (row 9) |
| S1 nit 2 — "zero aggregation weight" unscoped vs primitive's v1 | S1 review, non-blocking 2 | **Closed here** | `:35/:49/:78` (row 10) |
| S1 nits 3–4 — § Security second ¶; inherit-from "(below)" fix | S1 review, non-blocking 3–4 | **Accepted-no-action** (recorded as such at S1; no obligation created) | S1 review `:78-79` |
| S2 nit 3 — §23 heading follows the rename? | S2 review, non-blocking 3 | **Closed here** (decision: yes) | `BIBLE.md:36,:1545` (row 7) |
| S2 nits 1–2 — ADR-prose count/census imprecision | S2 review, non-blocking 1–2 | **Accepted-no-action** (ADR prose is a historical record) | S2 review `:72-73` |
| S3 nit 6 — W14 Refs cites retired § title | S3 re-review, non-blocking 6 | **Closed here** | `worksheet.md:140` (row 4) |
| S3 nit 7 — worked example "branch handles" | S3 re-review, non-blocking 7 | **Closed here** | `stamping.md:57` (row 11) |
| S3 nit 8 — correspondence-closure reconciliation vs inherit-from's affiliation definition | S3 re-review, non-blocking 8 | **O1-scoped, recorded** — deferred to the O1 `/discuss` by design | flagged as unspecified-and-part-of-the-question in `stamping.md:55` and `worksheet.md:138` (W14 body); story Out of scope names it explicitly |
| S3 non-blocking 1 — epic-file bookkeeping should be ADR-listed | S3 review, non-blocking 1 | **Closed here** | ADR 0004 row 13 lists `epics/nip-reorg.md:17` |
| Handoff flip to ✅ SUPERSEDED | protocol-spec workflow §2 / story AC5 | **Closed here**; parses correctly for `/whats-open` | `docs/NIP_REORG_DESIGN_HANDOFF.md:3` |

No dangling obligation found. The deliberately-open remainders (O1/W14 settlement, NostrHub republication, pins dual-`z` lag) are all recorded out-of-scope in the story and tracked in their own surfaces (W14; README publishing note; handoff O4).

## Concept-graph integrity / house rules

- [x] Docs-mode: no concept definitions changed; **no firmware reinstall required** (ADR Consequences, confirmed — no `firmware/` or `src/` file in the diff).
- [x] No hardcoded deployment pubkeys introduced; handle forms in touched text unchanged.
- [x] No secrets, no debug text, no commented-out prose blocks; no new lint/typecheck/build tooling; Concept Graph API authority untouched.

## Findings

### Blocking

None.

### Non-blocking

1. **`protocols/drafts/communities.md:26`** — the upstream list now reads "…; and the membership signal … — specified by [Tags & Taggings](./tags.md); and, for containment items, the multi-`z` stamp selection of [Stamping](./stamping.md) …" — two successive "and"-led items in a semicolon serial list. Grammatically parseable and semantically exact; optional polish whenever the sentence is next touched.
2. **`protocols/drafts/tags.md:26`** — phrasing latitude vs ADR Decision 1's quoted fragment: "selected per [Stamping]" was rendered "stamp selection is specified by [Stamping](./stamping.md)". Semantically identical, arguably clearer; recorded only so the fidelity trail is complete.
3. **`protocols/worksheet.md:140`** — the W14 Refs § citation uses the short form "Open: which layers to stamp" while the live heading is "Open: which layers to stamp (set × branch)" (`stamping.md:48`). This is the exact string ADR row 4 specifies and matches the W14 body's existing citation form (`:138`); a prefix-unique prose citation, not a resolvable-anchor concern. No action.

### Harness friction

1. None new. (The 11-suite environmental failure set is known state — local bind-mounted stack; binding gate is CI stack-free. Same set, same counts, as all three prior reviews in this epic.)

## Verdict

**PASS**

The diff is exactly the ADR's 13-row edit table applied to exactly its 8 enumerated files — 12 hunks, nothing outside the table. All six ACs verified with evidence: the old §23 anchor is extinct in living docs and the new TOC anchor derives correctly; the §22 pointer closes ADR 0001's last scheduled duplication without disturbing the Flaw-A history paragraph or the glossary; both consumer specs now cite Stamping at their existing touchpoints with accurate boundary claims; W1/W11/W14 are re-aimed with their resolution histories byte-identical; the four routed polish nits are fixed while the correctly-retained "branch handles" instance survives; the handoff parses as ✅ SUPERSEDED and the epic's paper trail is complete. The closing-story obligation-trail audit finds every scheduled obligation from ADRs 0001/0003 and the three prior reviews either closed by this diff or explicitly O1-scoped and recorded. Links: 0 broken across all changed files. Gates: harness-lint clean; npm test regression-free against the recorded clean-base differential.

## On PASS (same commit)

- [ ] Story `**Status:**` flip to `Done` — **deferred to the parent agent** (this review session was instructed to write only this report, not edit other files or commit). **Mandatory in the same commit as this review:** with this PASS-final report on disk, `scripts/harness-lint.sh` fires **L1** and the CI stack-free gate will fail until `engineering-team/stories/nip-reorg/4-index-crossref-sweep.md` reads `**Status:** Done`. Also fill the story's `Review:` link.
- [ ] Completion detection — **the book looks complete pending merge.** Against `engineering-team/audits/nip-reorg/book.md`'s acceptance frame: bullets 1–3 shipped in S1–S3 (PRs #345/#346/#347); bullet 4 (index & cross-refs coherent) is satisfied by this diff; the throughline constraints (single normative home; vocabulary policy; histories unrewritten) verified above. "Done looks like: all four stories PASS **and shipped to staging**; the handoff doc flips to ✅ SUPERSEDED" — the PASS and the flip are in hand; the staging merge of this branch is the last condition. **Offer `/close-book` after this PR merges; do not auto-run** — the user's "yes" is the trigger.
