# Review: Story 2 — Rename to Class Thread Relationships

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-12
**Diff:** `git diff c8b8786e..4ea6e0de -M` (implementation commit `4ea6e0de`, base = ADR commit on `docs/nip-reorg-s2-class-thread-rename`, branch base `origin/staging` @ `31246570`)
**Mode:** docs-mode (protocol-spec workflow §3) — accuracy + consistency audit; Test Design skipped by design.
**Story/ADR:** `stories/nip-reorg/2-class-thread-relationships-rename.md` · `decisions/nip-reorg/0002-class-thread-relationships-rename.md` · Test plan: skipped (docs-mode)

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**, run in the worktree before this report existed on disk (once this PASS-final report is committed, L1 requires the story flipped to Done in the same commit — see "On PASS").
- [x] `npm test` at `4ea6e0de` — **FAIL overall, with exactly the caveated environmental failure set**: 11 suites (`profile-tags` 10p/3f, `profile-tags-publish` 6p/1f, `tag-detail-publish` 7p/2f, `tag-index-publish` 8p/1f, `profile-tag-polish` 7p/4f, `pin-a-tag-publish` 1p/6f, `tl-publication-from-pins` 9p/1f, `tl-publication-from-pins-publish` 2p/5f, `customize-pin-curation-publish` 0p/3f, `most-pinned-tag-index-publish` 0p/7f, `tag-detail-curated-view-and-pin-polish-publish` 0p/1f), 25 skips — **identical suite set and identical per-suite counts to the clean-base differential recorded in `reviews/nip-reorg/1-shared-concepts-nip.md`** (S1 gates section; `profile-tags-publish` landed on the 6p/1f side of its known wobble). Stack-free portion green, including the `harness-lint`, `harness-stats`, `session-start`, `stack-free-npm-test`, and `ci-test-job` suites. The diff contains no source or test files (docs only), so the identity of the failure set is the regression check; the 11 failures are the known stale-bind-mounted-local-stack condition, binding gate is CI's stack-free job. Ran twice (spot-check per the S1-established base differential); consistent.
- [x] _Playwright — not applicable (docs only)._
- [x] _Lint/typecheck/build not configured — skipped._ No tooling added (`package.json` untouched).

## Spec adherence (AC-by-AC, docs-mode)

- [x] **AC1 — rename, history preserved.** `protocols/drafts/class-thread-tags.md` gone from disk (`ls`: no such file); `protocols/drafts/class-thread-relationships.md` exists; `git diff -M` detects the rename (similarity 91%); `git log --follow protocols/drafts/class-thread-relationships.md` reaches the pre-rename history: `a9d6c9fe` (ADR 0029 b-type registry), `6542dfcf` (inherit-from extraction), `db659caf` (the protocols-directory story-4 extraction commit).
- [x] **AC2 — retitle + guard.** Title is `Class Thread Relationships` (`class-thread-relationships.md:8`; setext underline `:9` unchanged — it was already 5 chars, no adjustment needed). The intro guard (`:11`) states the derived-vs-explicit principle exactly as the ADR specifies: relationships (`HAS_ELEMENT`, `IS_A_SUPERSET_OF`) are **derived** — computed from single-char tags on the child's own signed events, never from explicit relationship events, with the cross-reference to Tapestry Concepts § "Derived vs. explicit relationships".
- [x] **AC3 — substance unchanged.** `git diff -M` numstat for the renamed file: **3 insertions / 3 deletions**, a single hunk confined to lines 1–14 — exactly the three sanctioned line-pairs: Sources provenance append (`:4`), title (`:8`), intro guard append (`:11`). Everything from `## Relationship to Tapestry Concepts` (`:13`) down — the `n`/`s` table, value format, multi-parent, retrieval, security rules, direction principle — is byte-identical.
- [x] **AC4 — living links fixed, history untouched (per the gate-ratified refinement).** `grep -rn 'class-thread-tags\.md)'` over the 8 living docs → **0 hits** (was 12 link targets at base). Raw old-filename occurrences remaining in those files are exactly the rename-subject prose mentions the ADR Decision protects: `docs/NIP_REORG_DESIGN_HANDOFF.md:62`, `engineering-team/epics/nip-reorg.md:8` (name without `.md`), `:15`, `engineering-team/audits/nip-reorg/book.md:15`. Historical records untouched: `git show 4ea6e0de --name-only` lists exactly 8 files, none under `engineering-team/decisions/`, `reviews/`, `stories/`, or `audits/`; repo-wide, every other old-name mention sits in historical ADRs/reviews/done-stories/closed handoffs, unmodified.
- [x] **AC5 — index row.** `protocols/README.md:53` — display `Class Thread Relationships (`n`, `s`)` + path `drafts/class-thread-relationships.md` in both the display and target positions; status/notes columns untouched.
- [x] **AC6 — gates + nothing beyond scope.** Gates above. Diff = the rename + 7 living-doc files, all authorized by the ADR edit table; nothing else.

## ADR adherence (edit table, row by row)

- [x] `git mv` + in-file edits confined to the three sanctioned lines (see AC3). Sources append (`:4`) renders the ADR's string with backticks around `class-thread-tags.md`/`nip-reorg`, matching the header line's existing backtick convention — faithful, not a deviation.
- [x] `protocols/README.md:53` — row updated, both occurrences (display + target). ✔ per table.
- [x] `protocols/drafts/inherit-from.md:16,34,47` — **target only**; display "class-thread tags" kept (it names the tags). ✔
- [x] `protocols/drafts/inherit-from.md:105` — target + display → "class-thread relationships spec". ✔
- [x] `protocols/drafts/shared-concepts.md:28` — **target only**; display "Class-thread membership tags" kept. ✔
- [x] `protocols/worksheet.md:27,29,55,71` — target + display → "class-thread-relationships spec", all four. ✔
- [x] `BIBLE.md:1547` — target + display (path is the display) → new path. ✔
- [x] `docs/NIP_REORG_DESIGN_HANDOFF.md:6` — target + display (path is the display) → new path; `:62` prose untouched. ✔
- [x] `engineering-team/epics/nip-reorg.md` — lines 8/15 prose untouched; S2's `_(planned)_` marker flipped to the story-file path (`:15`), mirroring S1's row format. ✔
- [x] `engineering-team/audits/nip-reorg/book.md:15` — untouched (file not in diff). ✔
- [x] **No edits outside the table.** Every hunk in the diff maps to a table row; base→post occurrence counts reconcile (18 raw old-name occurrences in the 8 living docs → 3, all protected prose).
- [x] Option B (redirect stub) correctly not taken; Option C (deferred links) correctly not taken — no dangling window.
- [x] No new dependencies or tooling (docs only).

## Accuracy audit (are the claims true?)

- [x] **Guard sentence vs the corpus.** `protocols/drafts/tapestry-concepts.md:207` § "Derived vs. explicit relationships" exists (the anchor's referent) and says: derived relationships are computed by consumers from event structure; only editorial/provenance relationships are explicit events. The guard's claim that `HAS_ELEMENT`/`IS_A_SUPERSET_OF` are derived, never from explicit relationship events, is consistent with that section, with the spec's own tags table (`:21-26`, derived in the consumer's graph), and with the unchanged § Security authorship gate (`:48` — derive only from events signed by the curator, i.e. the child's own signed events). No semantic drift introduced.
- [x] **Provenance line (`:4`)** correctly cites `nip-reorg` ADR 0002 and the date; prior extraction provenance retained verbatim.
- [x] **Kept display text stays truthful:** "class-thread tags" at `inherit-from.md:16,34,47` and "Class-thread membership tags" at `shared-concepts.md:28` still name the `n`/`s` tags themselves — correct English after the rename, exactly the ADR's target-vs-display rationale.

## Cross-references

- [x] Every relative link target in all 8 changed files resolves on disk (scripted check over `BIBLE.md`, handoff, epic, README, the renamed spec, inherit-from, shared-concepts, worksheet: **all resolve**).
- [x] No `class-thread-relationships.md#anchor` or `class-thread-tags.md#anchor` links exist anywhere in the corpus (ADR Context claim re-verified post-diff), so no anchor breakage was possible.
- [x] The renamed file's own outbound links (`./tapestry-concepts.md`, `./inherit-from.md`, `../worksheet.md#w2…`, `#w5…`) resolve; same directory, unchanged body.

## Concept-graph integrity

- [x] Docs-only; no concept definitions changed; no handles touched.
- [x] Firmware reinstall: **not required** (ADR Consequences, confirmed — no schema/concept change).

## Things tests can't catch / house rules

- [x] No secrets, no debug code, no commented-out code (prose diff only).
- [x] No scope creep: 8 files, all in the ADR table; the story's out-of-scope items (redirect stub, semantic re-pointers, `n`/`s` semantics) untouched.
- [x] Concept Graph API authority respected; no new lint/typecheck/build tooling.

## Findings

### Blocking

None.

### Non-blocking

1. **`decisions/nip-reorg/0002-class-thread-relationships-rename.md:24`** — the Decision says "the 3 prose mentions" and lists handoff:62 / epic:15 / book:15, while the edit table (`:51`) also protects `epics/nip-reorg.md:8` (which names the file *without* `.md` — hence outside the Decision's count). The table is operative; the implementation followed it; all four rename-subject mentions survive. Count-phrasing nit only, no action.
2. **`decisions/nip-reorg/0002-class-thread-relationships-rename.md:9`** — Context tallies "13 link occurrences"; the base state has 12 link *targets* plus 3 path-as-display occurrences (BIBLE:1547, README:53, handoff:6) = 15 in-link occurrences of the string. Non-operative census imprecision; the operative zero-target rule is what was checked, and it holds.
3. **`BIBLE.md:1545`** — the §23 *heading* still reads "Class-Thread Membership Tags (`n`, `s`)" (and README's notes column still says "BIBLE §23 holds implementation + pointer"). Correct for S2 — the heading is not a filename reference — but S4 ("BIBLE pointer consistency") should decide whether the heading follows the rename.

### Harness friction

1. None. Every ADR file:line reference matched the tree as found; the 11-suite environmental failure is already-documented state (local-dev-stack memory note; binding gate = CI stack-free).

## Verdict

**PASS**

The diff is exactly the rename plus the ADR's authorized edit list — every table row applied precisely, including the target-vs-display distinction; the renamed file's body is byte-identical beyond the three sanctioned line-pairs; zero old-filename link targets remain in the 8 living docs while all rename-subject prose mentions and all historical records are preserved; the added guard sentence is accurate against tapestry-concepts § "Derived vs. explicit relationships" and the unchanged Security section; git history follows through the rename to the original extraction commits; all cross-references resolve; harness-lint is clean and the test gate is regression-free (failure set identical to the recorded clean-base differential). The three non-blocking notes are ADR-prose nits and an S4 handle, not defects.

## On PASS (same commit)

- [ ] Story `**Status:**` flip to `Done` — **deferred to the parent agent** (this review session was instructed to write only this report, not edit other files or commit). **Mandatory in the same commit as this review:** with this PASS-final report on disk, `scripts/harness-lint.sh` fires **L1** (`review …/2-class-thread-relationships-rename.md is PASS-final but story status is 'Approved'`) and the CI stack-free gate will fail until `engineering-team/stories/nip-reorg/2-class-thread-relationships-rename.md` reads `**Status:** Done`. Also fill the story's `Review:` link.
- [ ] Completion detection — the book is **not** complete: S3 (Stamping NIP) and S4 (index & cross-ref sweep) remain open per `audits/nip-reorg/book.md` / handoff §5. No close-book offer.
