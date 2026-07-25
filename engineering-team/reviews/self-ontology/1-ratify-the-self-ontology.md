# Review: Story 1 — Ratify the self ontology into the spec

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-25
**Diff:** `git diff origin/staging...HEAD` (commits `90f9e6cc` story, `132eef20` adr, `2ca99932` impl)
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3 — no test plan; accuracy + consistency audit)

## Quality gates (run by reviewer, not trusted)

- [x] **`bash scripts/harness-lint.sh` — FAIL (1 violation).** `VIOLATION L10 commit:2ca99932 — latest
      harness-definition commit … did not touch engineering-team/CHANGELOG.md`. See Blocking #1.
- [x] **`harness-lint` suite — FAIL (28 passed, 1 failed)**: "the real repo lints clean" fails, the
      test-level mirror of the same violation.
- [~] **`npm test` — did not complete within the review window.** A clean post-edit full run was
      in flight (24+ min, ~233/2786 lines) — the local Docker stack is **down**, so stack-dependent
      suites block on HTTP timeouts. Judged sufficient by targeted differential evidence instead:
  - **Zero non-markdown files changed** (verified: `git diff --name-only` ⇒ all `.md`). No JS, JSON,
    config, or workflow file is touched, so no executable behavior can regress.
  - Every suite that actually **reads the changed docs** was run post-edit:
    `task-queue-semaphore-protection-audit` **PASS** (6/6, asserts on BIBLE §24),
    `treasure-maps-router-preset` **PASS** (5/5, asserts on BIBLE), `scheduled-search-and-house-
    scores-refresh` **PASS** (12/12, asserts on BIBLE), `harness-stats` **PASS** (8/8),
    `session-start` **PASS** (10/10), `harness-lint` **FAIL** (the finding above).
  - The binding regression gate remains CI's stack-free `test.yml` on the PR.
- [ ] _Playwright — not applicable (docs-only)._
- [ ] _Lint / typecheck / build not configured — skipped._

## Spec adherence

- [x] AC-1 … AC-8 (BIBLE §30 content) — **met.** All eight content criteria are present and
      correctly placed; §30 spans `BIBLE.md:1764–1823`.
- [x] AC-9 (CLAUDE.md pointer, ≤190 lines) — **met.** `wc -l CLAUDE.md` = **190** exactly;
      `### 4. Local-first: neo4j is the definitive "me"` at `CLAUDE.md:46`; `scripts/harness-budgets.txt`
      untouched. *(But see Blocking #1 — the AC's "no cap change" was satisfied while a separate,
      unrelated harness rule was violated.)*
- [x] AC-10 (ToC + anchor) — **met.** `BIBLE.md:43` links `#30-the-self-and-its-stores`; computed
      slug matches exactly.
- [x] AC-11 (ADR records decision + rejected alternative + what's open) — **met.**
- [x] AC-12 (handoff stays 🔴 OPEN, annotated) — **met.** Status line is `🔴 OPEN`; the two
      `SUPERSEDED` occurrences are forward-looking instructions ("flip … once they ratify"), not a flip.
- [ ] AC-13 (`npm test` green **and** `harness-lint` clean) — **NOT met.** harness-lint fails.
- [x] No criterion silently dropped; no behavior added beyond the story.

## ADR adherence

- [x] Files changed match ADR §"Implementation notes" — `BIBLE.md`, `CLAUDE.md`,
      `docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md`, plus the three harness artifacts. Nothing extra.
- [x] **Three-block structure, in the ADR's order** — `### The ontology (ratified)` (1768),
      `### How this relates to principles 1–3` (1789, **required subsection present**),
      `### Obligations this creates (binding; not yet enforced)` (1799), `### Deliberately open` (1812).
- [x] **Exactly 4 `*Status:*` lines** in block 2, one per obligation (1804, 1806, 1808, 1810).
- [x] CLAUDE.md condensation executed as designed: +4 (principle 4) / −4 (the "non-technical journey"
      block), plus the two zero-cost in-line edits (preamble "four principles" + opposite-drift
      caution; reflex-check closing line).
- [ ] **The ADR's own instruction was wrong** — its Decision and "Out of scope" both assert *no
      CHANGELOG row*. That is incorrect (Blocking #1). The implementation faithfully followed the
      ADR; the defect originates in the ADR, not in the implementation.

## Accuracy audit (docs-mode core — claims verified against source, not trusted)

- [x] **Deriver label list** — §30:1810 claims Set, Superset, ListItem, ListHeader, ConceptHeader,
      JSONSchema, Property. Verified against `registeredLabels()` at runtime: **exact match**, and
      `NostrUser` confirmed **absent**, so the social-graph coverage-gap claim is true.
- [x] **"live instances report `derived: 0`"** (§30:1808) — verified live against
      `tapestry.brainstorm.world/api/tapestry-key/status`: `{"derived":0,"empty":0,"missing":2822}`. True.
- [x] **Cross-references resolve and are semantically correct** — §5 "The Tapestry Protocol" (its
      line 201 does document derived/implicit relationships materialized from event structure, as
      cited), §6 "The Concept Graph Data Model", §10 "Normalization Rules", §27 "Point of View (PoV)
      Resolution", §29 "Derived-JSON Store". All five match their citation context.
- [x] **No overclaiming.** Block 2 is guarded three ways: the heading says "binding; not yet
      enforced", the lead sentence says "**None of them is enforced today**", and each item carries
      its own `*Status:*` gap line. The obligations are phrased deontically ("no pipeline **may**
      destroy…"), which is a prohibition, not a description of current behavior. Correct.
- [x] **No implied repeal of the architecture invariants.** §30:1789–1797 states they are "**not
      repealed**", that publication is "never gated at write time", that this section "grants no
      license to reject events from unknown or untrusted authors", and that trust filtering stays
      read-time per POV. CLAUDE.md principle 4 repeats the non-repeal. No sentence anywhere licenses
      write-time gating.
- [x] **Guiding rule honored** (BIBLE = definitions and rules; reasoning stays in the handoff). No
      "why we came to believe" derivation was smuggled in; the "most-compact-me" conjecture and the
      conversational derivations correctly stayed out. See Non-blocking #2 on the one borderline case.

## Concept-graph integrity

- [x] N/A — no concept handles cited, no concept definitions changed. The local stack was down; the
      story/ADR correctly took the AGENTS.md §2 stack-absent branch and flagged it.
- [x] **Firmware reinstall required? No** — pure spec, as the ADR states.

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code (docs-only diff).
- [x] No TA-pubkey literals introduced.
- [x] Deletion seam verified clean: `CLAUDE.md:124–127` reads blank → "When in doubt…" → blank →
      `## Engineering Team Mode`. No double-blank or missing-blank artifacts anywhere in the file.
- [x] The deleted "non-technical journey" block carried **no unique normative content** — each of
      its four claims is independently stated elsewhere in the same file (natural-language-primary
      at :72; plain-language register at :86; conversational gates at :89; the routing tables).

## House rules check

- [x] Concept Graph API authority respected (stack-absent branch taken and disclosed).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

1. **`engineering-team/CHANGELOG.md` (missing row) — `harness-lint` L10 violation, repo is not
   lint-clean.** `CLAUDE.md` is the **first entry** in `scripts/harness-def-paths.txt`, so *any*
   commit touching it must also touch `engineering-team/CHANGELOG.md`. Commit `2ca99932` touched
   CLAUDE.md and did not. This fails AC-13 and leaves `main`-bound CI red.

   **Root cause — an ADR defect, not an implementation slip.** ADR 0001 reasoned *"no cap change ⇒
   no `harness-budgets.txt` edit ⇒ no CHANGELOG row."* That conflates two independent rules: the
   budgets-file header's *cap-change* rule, and **L10**, which fires on *any* def-path commit
   regardless of the cap. The Implementer followed the ADR exactly; the ADR was wrong.

   **Why it wasn't caught earlier (ordering trap):** the Implementer ran `harness-lint.sh` while the
   edits were still **uncommitted**, and L10 inspects the latest *commit* touching def paths
   (`git log -1 … -- <def paths>`). Pre-commit that was an older compliant commit → clean. The
   violation only exists post-commit. Any docs-mode story touching CLAUDE.md will hit this.

   **Asked change:** add a `engineering-team/CHANGELOG.md` row for this change, following the
   existing 4-column format (`| date | **title** — what changed | why | origin |`). Origin should
   cite `self-ontology #1 / ADR 0001`. Note `CHANGELOG.md` is itself a def path, so a **follow-up
   commit that adds only the row satisfies L10** (it becomes the latest def-path commit and does
   touch the changelog) — amending `2ca99932` also works since nothing is pushed. Recommend the
   follow-up commit (no history rewrite). **Also correct ADR 0001** — its Decision and "Out of
   scope" sections must stop asserting "no CHANGELOG row"; the accurate statement is "no *cap*
   change, therefore no `harness-budgets.txt` edit — but the CLAUDE.md edit is a def-path commit and
   does require a CHANGELOG row." Then re-run `bash scripts/harness-lint.sh` to confirm clean.

### Non-blocking

1. **`BIBLE.md:1772`** — "A Neo4j backup restores the self in full." True *definitionally* (Neo4j is
   the complete self by ratification), but a reader could infer an operational, verified
   backup/restore capability. None exists yet — the handoff's consequence map lists "verified
   restore drill" as deferred work. Optional improvement: a short clause such as "(no verified
   restore drill exists yet — see Deliberately open)", or leave to the backup story, which will
   naturally state it.
2. **`BIBLE.md:1776`** — "A letter is derivable from me; a letter is not me." Borderline against the
   ADR's "definitions and rules, not reasoning" rule: it is an analogy rather than a definition.
   Judged acceptable — it is a compact *definitional* analogy that does the work of a definition,
   not a derivation of belief. No change asked.
3. **`docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md:6`** — the original Provenance line still carries the
   generic boilerplate "flip this to ✅ SUPERSEDED once they land", which sits in mild tension with
   the new line-4 annotation instructing that it stays OPEN until §4/§7/§8 ratify. Line 4 precedes
   it and is explicit, so a reader is unlikely to be misled. Optional tidy on a future pass.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **L10 is structurally uncatchable pre-commit, and it bit an ADR that had explicitly reasoned
   about the adjacent rule.** The lint reports clean while def-path edits are staged/uncommitted,
   then fails immediately after the phase-boundary commit — so the harness's own "commit at each
   phase boundary" convention is what *creates* the red state, and the Implementer's pre-commit gate
   run cannot see it. Two candidate fixes worth considering: (a) have `harness-lint.sh` additionally
   consider *uncommitted* def-path changes in the working tree and warn; (b) add a line to
   `templates/adr.md` (or workflow 4's per-phase-commit section) noting that any diff touching a
   `scripts/harness-def-paths.txt` path requires a CHANGELOG row in the *same* commit — independent
   of whether a budget cap moved. This story's ADR is direct evidence: it reasoned about the cap
   rule and concluded "no CHANGELOG row", which the cap rule alone does license.

## Verdict

**CHANGES_REQUESTED**

The substance of the story is in excellent shape — every accuracy, conformance, structure,
non-overclaim, and non-repeal check passes, and the two claims most likely to rot (the deriver label
list and `derived: 0`) were verified against the running system rather than taken on trust. The
single blocking item is a mechanical, one-row omission caused by an incorrect instruction in ADR
0001, and it currently leaves the repo not lint-clean, which AC-13 forbids and which would land red
in CI. Fix Blocking #1 (add the CHANGELOG row, correct the ADR's two "no CHANGELOG row" assertions),
re-run `harness-lint.sh`, and this is a PASS.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. *(Withheld at first pass — see RE-REVIEW.)*
- [ ] Completion detection run. *(Withheld at first pass — see RE-REVIEW.)*

---

# RE-REVIEW (2026-07-25) — fix commit `1867ea53`

Focused re-audit of the fix for the single blocking finding. The first pass's accuracy and
conformance checks on `BIBLE.md` §30 and `CLAUDE.md` are not re-derived from scratch; they were
spot-checked for disturbance instead (see (d)).

## (a) Blocking finding — RESOLVED

- `bash scripts/harness-lint.sh` (run by reviewer, **post-commit**): **clean (0 violations)**.
- `harness-lint` test suite (run by reviewer): **PASS (29 passed, 0 failed)** — recovered from 28/29.
- L10 mechanism verified directly: the latest def-path commit is now `1867ea53`, and it **does**
  touch `engineering-team/CHANGELOG.md`, satisfying the touch-rule. The fix works because
  `CHANGELOG.md` is itself a def path, exactly as the first pass predicted.

## (b) CHANGELOG row — well-formed and accurate

- Appended at the **bottom**, **chronological** (prior row `2026-07-18` → new row `2026-07-25`),
  correct **4-column** shape (5 pipes).
- Every factual claim in the row independently verified against the tree: principle 4 exists in
  `CLAUDE.md` under that exact heading; `BIBLE.md` §30 exists under that exact title; the
  "non-technical journey" block is gone; `CLAUDE.md` is **190** lines; `scripts/harness-budgets.txt`
  is untouched; principles 1–3 are explicitly "not repealed". No overstatement.

## (c) ADR 0001 correction — accurate and complete

- **Zero surviving assertions** of "no CHANGELOG row" as a *claim*. `0001-…md:219` now reads
  "there is no cap change" (correct — the cap genuinely did not move), and a new bullet at :220–225
  states the CHANGELOG requirement, names `scripts/harness-def-paths.txt` and **L10**, requires the
  row in the *same commit*, and records the pre-commit blind spot.
- `0001-…md:242–244` ("Out of scope") now explicitly says the rejected cap change does **not** exempt
  the work from the touch-rule.
- The one grep hit at `:226–227` is the **corrective note quoting the old error** for provenance, not
  a live assertion. Correct and desirable.
- `scripts/harness-budgets.txt` confirmed untouched — there is genuinely no cap change.

## (d) Fix-commit scope — disciplined

`1867ea53` touches exactly two files: `engineering-team/CHANGELOG.md` and
`engineering-team/decisions/self-ontology/0001-ratify-the-self-ontology.md`. **`BIBLE.md` and
`CLAUDE.md` were not re-touched**, so the first pass's accuracy findings on them stand unchanged.

## (e) Regression — differential confirmed independently

The completed full run finished `Overall: FAIL`, 48 skipped, **13 FAIL suites vs the session
baseline of 12**. That run **straddled** the fix. Differential by suite *name*, re-derived here
rather than accepted:

- **`+ harness-lint`** — the L10 violation, captured pre-fix. Now verified **29/29 PASS** directly.
  Straddle artifact.
- **`+ teach-it-what-matters`** (22 passed, 5 failed) — **not attributable to this story**, proven
  three ways: (1) it originates in `72b50aa9` ("test: failing tests for teach-it-what-matters
  (second-brain #7)"), verified an **ancestor of `origin/staging`** — inherited, not introduced;
  (2) it appears **0 times** in this branch's diff, and its file is **byte-identical** to
  `origin/staging:test/teach-it-what-matters.test.js`; (3) it contains **zero** references to any
  file this story changed.
- **`- relationship-primitives-probe`** — cleared vs baseline (environmental).

Decisive backstop: this branch's diff is **100% `.md`** — no JS, JSON, config, or workflow file is
touched, so no executable behavior can regress. The binding regression gate remains CI's stack-free
`test.yml` on the PR.

## Completion detection

**No book covers the `self-ontology` epic.** All 26 `engineering-team/audits/*/book.md` files were
enumerated; the three Open books are `second-brain`, `task-timeline`, and `unified-tagging-ui`, none
of which names `self-ontology` (grep: 0 hits). **`/close-book` is therefore not offered** — there is
no book to close, and inventing one here would be wrong. See Non-blocking #4.

## Findings (re-review)

### Blocking
None.

### Non-blocking
4. **No book was opened for the `self-ontology` epic at intake.** CLAUDE.md's "Books of work" section
   calls for an *eager anchor* — a `book.md` with an intent anchor or acceptance frame — opened at
   intake, warning that without it "completion can't be detected across sessions and the close drops
   to low confidence." This epic anticipates six stories, so a book with an acceptance frame would be
   worth opening before story 2. Not blocking story 1: the epic file
   (`engineering-team/epics/self-ontology.md`) records intent and the story is self-contained.
5. Non-blocking items 1–3 from the first pass stand unchanged (the "restores the self in full"
   definitional-vs-operational nuance at `BIBLE.md:1772`; the letter analogy at `:1776`; the handoff's
   line-6 boilerplate tension). None was asked to change.

### Harness friction *(candidate OPEN.md rows, type `meta`)*
1. *(carried from the first pass)* **L10 is structurally uncatchable pre-commit** — the gate reads
   clean while def-path edits are uncommitted and fails only after the phase-boundary commit, so the
   harness's own commit convention creates the red state. Two candidate fixes proposed there.
2. ~~**`second-brain/7-teach-it-what-matters.md` is `Status: Done` while its suite fails 5 tests** —
   the owner should confirm whether the implementation landed on `staging`.~~
   **RETRACTED (2026-07-25, same session) — the flag was raised on an incomplete diagnosis and is
   wrong.** The story is legitimately complete: impl commit `03a8af9c` and review `af7e45be`
   ("PASS") are both on `origin/staging`, alongside the Phase-3 test commit `72b50aa9`. The 5
   failures are **local-environment artifacts**, not a process-integrity defect — two fail with
   `Concept "tapestry owner goal" not found` (incomplete local graph) and two with
   `Cannot POST /api/normalize/record-priority-signal` returning a 404 HTML page (the running
   container predates `03a8af9c`). That is precisely the already-logged condition in **OPEN.md #27**
   ("Local dev stack is stale vs origin … stack-dependent suites fail environmentally — missing
   endpoints + empty graph") and **#69** (stale container image missing the ETL). No new ledger row
   was opened, because the ledger is for items with **no other surface** and this one has two.
   Retained here rather than deleted: a reviewer flag that turned out to be wrong is part of the
   audit trail, and the lesson — *diagnose an inherited failure before characterizing it* — is the
   reusable part.

## Verdict

**PASS**

The single blocking finding is genuinely resolved — verified by running the gate myself, post-commit,
and by confirming the L10 mechanism (latest def-path commit now touches the CHANGELOG). The fix was
scoped to exactly the two files it should touch, the CHANGELOG row's every claim checks out against
the tree, and the ADR correction is complete and additionally records the pre-commit blind spot so
the next docs-mode story does not repeat it. The one new full-run failure is proven inherited from
`origin/staging` and byte-identically untouched by this branch, whose diff is entirely markdown.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run: **no book covers this epic**; `/close-book` correctly not offered.
