# ADR 0002: Move gate history out of judge-read surfaces

**Status:** Accepted
**Date:** 2026-08-04
**Story:** `engineering-team/stories/harness-gate-integrity/2-move-gate-history-out-of-judge-read-surfaces.md`

## Context

Direction mode's blinded gate judge is the strongest control in the autonomous flow, and its blinding is currently enforced by spawn-prompt wording over a shared filesystem. The story's acceptance criteria, quoted back:

1. **Gate-1 epic channel closed** — no epic file among the Gate-1 judge's required inputs (derived existence/`Status:` assertion instead); epic files receive no verdict outcomes during runs.
2. **Artifact hygiene, forward-only** — new/changed stories and ADRs carry no gate-outcome vocabulary; a mechanical check flags a seeded violation and stays silent on the grandfathered corpus.
3. **Commit-subject discipline** — the stated convention: subject carries story/gate identity, outcome lives in the body a judge never reads.
4. **Partial-read channel dispositioned, not duplicated** — ratify #133's pinned line-range read as the structural answer or ship stronger; no harness doc still instructs a judge to stop reading at a heading.
5. **Role scoping** — unblinded roles stop receiving run meta-state they don't need; no mandated section of a judged artifact embeds it.
6. **Stats tally** — `scripts/harness-stats.sh` derives a per-book APPROVE/KICK_BACK/HALT/ANSWER tally from journal `**Decision:**` lines, tested against the store-and-show fixture.

**Constraints.** (i) Epic design constraint: no new tooling — every mechanism extends the journal, the `harness-lint` invariant set, or `harness-stats.sh`. (ii) `roles/director.md` § Gate rubrics, the judge protocol, the Stopping rules, and `.claude/agents/gate-judge.md` are goalpost-class — frozen *mid-run*; this story edits them **between runs** through the operator-gated harness, which is the sanctioned path. No Direction run is in flight (take-a-concept-back-out Closed 2026-08-04; task-timeline pre-registered but unarmed). (iii) Every implementation file except the tests is a harness-definition path (`scripts/harness-def-paths.txt`), so each implementation commit carries a `CHANGELOG.md` row (L10 touch-rule). (iv) Concept-graph orientation: N/A — the story names no domain concepts (stated in the story; stack is up, deliberately unused).

**Measured facts the design rests on** (verified live this session):

- The only remaining "instruction-bounded" partial read in the harness definition is `roles/director.md:83` — "the book path with the instruction to read *the acceptance frame section only*". The #133 ratification (2026-08-04) already added the pinned line-range mechanism at `:82` and its judge-side exact-and-exclusive rule in `gate-judge.md`; `:83` still carries the old phrasing beside it.
- The Gate-1 rubric line requiring the epic file is `roles/director.md:102`; the spawn-prompt input list is `:81-88`.
- Active-path epic files contain **zero** bare verdict tokens today; the epic channel is about *future-run accumulation* (kick-back counts, prior-verdict summaries), not existing corpus.
- The two active-path artifacts matching the `Supersedes`-with-verdict shape are both **backticked mentions** (the intake proposal and story #2 itself — artifacts *about* the mechanism), which forces a mention-vs-use distinction on any mechanical check.
- The review template's mandated On-PASS line (`templates/review-checklist.md:62`) requires completion detection *recorded in the review file* — the exact channel through which cap arithmetic reached a Gate-5 judge (add-a-concept audit §7 F3).
- `scripts/harness-stats.sh` sections (a)–(d) parse commits, review files, and book files — never journals. Fixture counts for the store-and-show journal, counted directly: APPROVE 17, KICK_BACK 8, ANSWER 5, HALT 3, INFO 15.
- The next free `harness-lint` check ID is **L14** (`check_L13` is the current max).
- Existing suites `test/harness-lint.test.js` and `test/harness-stats.test.js` are the extension points — no new test frameworks or suites required.

## Options considered

### Option A — Pin-and-relocate (chosen)

Generalize #133's **pinned partial read** from line ranges to **field extractions**, and relocate all verdict history into the journal:

- Gate 1's epic check becomes a **judge-run pinned extraction**: the spawn prompt supplies `grep -m1 -o '^\*\*Status:\*\* *[A-Za-z-]*' engineering-team/epics/<epic-slug>.md`; the judge runs it, an empty result fails the item, and the epic file is never opened. Two sub-options here: **A1 — the judge runs the pinned command** (chosen); A2 — the Director computes the assertion and states it in the prompt. A2 re-introduces trusting the invested party on a rubric item — rejected.
- Verdict outcomes become **journal-only by written rule** (director.md § decision journal), with commit subjects outcome-free by stated convention.
- A **narrow hygiene check** (`check_L14`) enforces the two known token *shapes* in stories/decisions/epics, with inline-code mentions exempt and `done/` excluded.
- `harness-stats.sh` gains a journal-parsing section, closing the instrument gap.

Pros: every piece extends existing machinery (epic constraint honored); the judge stays independent on every rubric item; blinding on the epic and book channels becomes structural (the judge *cannot* see history through a pinned extraction); corpus-silent today, so no grandfather list at all. Cons: pinned commands are still commands a judge could disobey — but #133's exact-and-exclusive rule plus the void-on-over-read sanction already governs that, with a measured record of holding (10+ clean spawns across two books after pinning).

### Option B — Generated sidecar excerpts

The book gains a generated `frame.md` sibling (and each epic a generated status stub); judges read whole files, never partial ones.

Pros: no partial-read mechanics at all; file-level blinding. Cons: **new generated-artifact machinery** (violates the epic constraint); a sync-drift hazard — a stale excerpt silently mis-frames every judge (the same staleness class the derived-section rule exists to prevent, director.md:40); a standing hand-edit temptation on a generated file; and it addresses only the book/epic channels — commits, artifact hygiene, role scoping, and stats still need Option A's pieces. Named as the **fallback**: if a future judge ever discloses over-reading past a pinned command, the revisit trigger fires and this option is the escalation.

### Option C — Status-quo-plus

Keep handing files over; rely on #133-style instructions plus judge honesty and self-reporting.

Rejected: the record is the refutation — the leak channels were catalogued across three closed books *with* careful spawn prompts, and the story's premise (operator-ratified 2026-07-28) is that instruction-level blinding is structurally dead on these channels.

## Decision

We chose **Option A (A1)**: pin-and-relocate, with the judge running every pinned extraction itself. Where the intake proposal's wording ("a derived existence/`Status:` assertion") permits either A1 or A2, A1 is chosen deliberately: a Director-computed assertion would move a rubric item from the independent party to the invested one, which is the exact trust direction this story exists to eliminate.

## Consequences

- **Enables:** structural blinding on the epic and book channels; an outcome-free `git log` for future runs; Direction-mode rework finally visible to the retro instrument (store-and-show reports 8 kick-backs instead of 0); AC-4 resolved as *ratify-#133* — after the `:83` amendment, a def-path grep for stop-at-a-section instruction phrasing returns zero, and that assertion is testable.
- **Constrains:** goalpost-class files change between runs only; this branch must merge with no Direction run in flight (verified true now; the task-timeline book is unarmed, and its eventual pre-arming refresh inherits the new protocol automatically — armed books pin governing SHAs at arming, so arming after this merge pins the new versions).
- **Debt / honest limitations:** prose-shaped history ("this epic has already spent two Planning rounds") is mechanically uncatchable — L14 pins the two known *token* shapes only; the templates' guidance line and the judge's self-report duty remain the backstop for prose. PASS/FAIL are deliberately **not** L14 tokens: they are legitimate status/review vocabulary (`**Status:** Done — PASS` reconciliation is row #38's lane, not blinding's).
- **Test impact (hypothesis, to be executed, not trusted — row #107's discipline):** `test/harness-lint.test.js` gains L14 cases (seeded violation flags; current corpus silent; backticked mention exempt); `test/harness-stats.test.js` gains journal-tally assertions against the store-and-show fixture (exact counts above — the file is frozen history, so exact-match is safe) and a journalless-book absence check; one S-class def-path grep pins the instruction-phrasing extinction. The Tester verifies each prediction by running it.
- **Firmware reinstall required?** No.

## Implementation notes

1. **`engineering-team/roles/director.md`**
   - `:83` (every-gate item): replace "the book path with the instruction to read *the acceptance frame section only*" with "the book path with its **pinned frame-read command** (per the partial-reads rule above) — a partial read is never phrased as an instruction to stop at a section."
   - `:84` (Gate-1 item): append the pinned epic extraction: "also the pinned epic-status extraction `grep -m1 -o '^\*\*Status:\*\* *[A-Za-z-]*' engineering-team/epics/<epic-slug>.md` — run it; empty output fails the item."
   - `:102` (Gate-1 rubric): "…the epic file `epics/<epic-slug>.md` exists with a `**Status:**` line, **verified only via the spawn prompt's pinned extraction — the judge never opens the epic file**."
   - § "The decision journal": add two short rules — **(journal locality)** "Verdict outcomes, kick-back counts, and gate tallies live only in this journal. They never land in the epic file, the story, or the ADR; rule 7 ('Journaling is not recording') carries *product decisions* into role-read artifacts, never verdicts." — and **(subject convention)** "Journal/gate commits use the subject `journal: gate decision (<epic> #<n>, gate <G>)`; the Decision value appears in the entry, never in the subject."
   - § "What you do" (role spawning): one line — role spawns that need the acceptance frame receive it via the same pinned partial-read mechanism as judges; run meta-state (deadline, cap, budgets, gate tallies) reaches a role only if its phase function requires it, and none does.
2. **`.claude/agents/gate-judge.md`** — extend the #133 bullet: "a line-range **or field-extraction** command (e.g. `sed -n '1,36p'`, `grep -m1 -o '…'`) … is exact and exclusive" — same over-read-voids semantics, unchanged otherwise.
3. **`engineering-team/templates/review-checklist.md`** `:62` — replace the On-PASS completion-detection line with: "Completion detection performed; the result and any book arithmetic are recorded in the run journal (Direction) or the chat (human-gated) — **never in this file**."
4. **`scripts/harness-lint.sh`** — new `check_L14` (verdict-vocabulary hygiene). Scope: `engineering-team/{stories,decisions,epics}/**/*.md`, excluding any `done/` path segment and `stories/_intake.md`. Preprocess each file: strip fenced code blocks and inline code spans (mention-vs-use exemption). Flag a line iff it matches **(i)** `Supersedes` + any of `KICK_BACK|CHANGES_REQUESTED|APPROVE`, or **(ii)** (`Gate [0-9]` or `[Rr]ound`) + any of `KICK_BACK|CHANGES_REQUESTED`. Existing waiver machinery applies unchanged. Calibration bar (tested): zero hits on the current corpus.
5. **`scripts/harness-stats.sh`** — new section **(b2) "Direction-mode gate outcomes"** after (b): for each `engineering-team/audits/*/journal.md` and `audits/done/*/journal.md`, count `^\*\*Decision:\*\* <V>` for V in APPROVE/KICK_BACK/ANSWER/HALT/INFO; print one line per book plus totals; add one summary-block line (`direction gates — approve: N · kick-back: N · halt: N`). Books without a journal never appear; the instrument principle holds (always `exit 0`, degrade to "n/a").
6. **Test-file changes belong to Phase 3** (template rule): the two suite extensions and the S-class grep above are the Tester's lane, specified here only as the hypothesis to execute.
7. **Each def-path commit carries its `engineering-team/CHANGELOG.md` row** (L10) — one logical-change row for the protocol relocation, one for each script check if committed separately.

## Out of scope

- Scrubbing existing artifacts or rewriting git history (story Out of scope; forward-only).
- Any change to rubric *standards*, stopping rules, arming semantics, or the staging ceiling.
- The completion-report tally rule (OPEN.md #64), the heartbeat-watch procedure (#74), and the other pending director/skill amendments — the ratification-batch story's lane, not this one's.
- The L2 reopen carve-out (#129) and the sibling intake proposals (meta-sweep #2, file-per-row migration).
- Prose-level history-leak detection beyond the two L14 shapes (accepted limitation, per Consequences).
