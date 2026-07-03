# ADR 0003: close-book-retro — the post-mortem as a numbered book-close step, an audit §7, and pointer-only mirrors

**Status:** Accepted (gate passed 2026-07-02, operator — Option A)
**Date:** 2026-07-02
**Story:** `engineering-team/stories/harness-self-improvement/3-close-book-retro.md`

## Context

Docs-mode story: six prose surfaces must gain the retro without creating a new lesson surface or restating the rule six times. The no-fourth-state rule needs exactly one normative home; everything else points. Current shape of the targets: `workflows/6-book-close.md` has 10 numbered steps (audit written at step 5, feedback doc at 6, `npm test` gate at 7, Closed-flip 8, OPEN.md sweep 9, gate question 10); `templates/build-audit.md` ends at §6 (carry-forward register); the `/close-book` command already delegates to the workflow with a "House rules" block; `director.md` dangles "the post-mortem" at :41 and :145; workflows 1–2 have no phase-entry preflight; product workflow 7's mandatory gate is the handoff pause.

Gate-ratified: docs-mode (no test plan; L8/L10 are the mechanical guards); three-column terminal-state table; warn-and-surface preflight.

## Options considered

### Option A — retro as a new numbered step 7 in workflow 6; findings land in a new audit §7; all other surfaces are pointers
Insert **step 7 "Post-mortem / harness retro"** between the feedback doc (6) and the test gate (renumbered 8): by then the roll-up (step 2) has already collected deviations/friction, and the audit draft exists in the working tree, so the retro fills the new **§7 "Process findings (harness)"** before anything is committed. Steps 7–10 renumber to 8–11. The rule text lives ONCE in workflow step 7; the command, director.md, and the product mirror carry one-line pointers.
**Pros:** single normative home; retro output and audit commit atomically (the existing per-phase commit already bundles the audit); the OPEN.md loose-end sweep (now step 10) stays distinct — work follow-ups vs harness lessons don't conflate. **Cons:** renumbering touches cross-references to steps 7–10 — an L8-class risk handled by grepping for "step 9"/"step 10" references at implementation (`0-intake.md` references "workflows/0-intake.md step 4" style pointers exist elsewhere; verified: `6-book-close.md` step numbers are referenced from `whats-open`-era docs as "step 9" — those move to "step 10" and must be updated in the same commit).

### Option B — a separate `workflows/7-post-mortem.md` file
**Pros:** no renumbering. **Cons:** a seventh workflow file for a sub-step of book close inflates the phase model (CLAUDE.md, README, and the commands all enumerate the phases); the retro is not a phase — it has no own gate, role, or artifact; rejected.

### Option C — fold the retro into the existing step-9 OPEN.md sweep
**Pros:** no new step. **Cons:** conflates loose work-ends with harness lessons — precisely the ambiguity that let lessons die in the sweep's shadow; the terminal-state rule would hide inside a step about branch deletions. Rejected.

## Decision

**Option A.** The retro is a first-class numbered step in the one place book closes actually happen, its record is a first-class audit section, and every other surface points instead of restating.

## Consequences

- The book-close per-phase commit now atomically carries the retro record (audit §7) — no separate retro artifact to forget.
- Renumbering obligations: any in-repo reference to workflow-6 steps 7–10 updates in the same commit (grep `6-book-close` + "step 9"/"step 10"/"step 7" at implementation; `OPEN.md`'s surface table and `0-intake.md` cite the file, not step numbers — verified low blast radius).
- The preflight lands as **step 0** in workflows 1–2 (before "Restate the request" / "Read the story"), keeping existing step numbers intact there.
- Story 5's stats output slots into workflow-6 step 7's "cite when available" line without further wiring.
- `_intake.md` gets the PICKED UP marker (record change — no CHANGELOG row needed for that file, but the same logical change's row covers the whole story).
- **Firmware reinstall required?** No.

## Implementation notes

- **`workflows/6-book-close.md`** — Input list adds: `journal.md` (Direction books), the reviews' "Harness friction" sections, and the book's OPEN.md `meta` rows. New step 7 (normative text): harvest process notes/proposed amendments from those inputs; for each, record in audit §7 exactly one terminal state — **operator-ratified harness commit (SHA) · OPEN.md `meta` row (#) · declined (reason)** — no fourth state; ask per finding "does this port to the other flow (Direction ↔ human-gated)?"; cite `scripts/harness-stats.sh` output when available (story 5). Renumber old 7–10 → 8–11; fix intra-file references.
- **`templates/build-audit.md`** — new §7 after the carry-forward register:
  `## 7. Process findings (harness)` + the ratified table: `| Finding | Source (journal/review/deviation) | Terminal state (commit <sha> · OPEN.md row <n> · declined: <reason>) |` + a one-line pointer at workflow step 7 for the rule.
- **`.claude/commands/close-book.md`** — one added line in the gate block: "run the post-mortem/harness retro (workflow step 7): every process lesson ends in ratified commit, `meta` row, or recorded decline — no fourth state", and the gate question gains "retro dispositions recorded in audit §7".
- **`roles/director.md`** — :41 and :145: "for the post-mortem" → "for the post-mortem (the harness-retro step — `workflows/6-book-close.md` step 7)".
- **`workflows/1-planning.md` + `workflows/2-architecture.md`** — new step 0 "Origin-drift preflight": `git fetch origin staging` (quiet, tolerate offline); if `origin/staging` (else `origin/main`) is ahead of the merge-base with HEAD, say so with the behind-count and ask whether to rebase/re-branch before proceeding — warn-and-surface; the hard halt stays Direction-only (Stage-0). One sentence of origin: ports the check the 2026-05-24 Meta intake entry requested and Direction Stage-0 already runs; the #24 stale-base incident is the case study.
- **`product-team/workflows/7-story-decomposition.md`** — the mandatory gate gains the 3-question retro (unused template sections; guardrail fought/overridden → proposed amendment; what the consuming team lacked); answers become root-OPEN.md `meta` rows (the shared ledger — not a product-team file, so the write-boundary holds).
- **`engineering-team/stories/_intake.md`** — PICKED UP marker on the 2026-05-24 Meta entry → this story.
- **`engineering-team/CHANGELOG.md`** — one row for the story.
- Verification: `bash scripts/harness-lint.sh` clean (L8 over the new cross-references; L10 satisfied by the CHANGELOG row in the same commit); reviewer inspects each AC against the diff.

## Out of scope

- Running the first retro (this book's own close — frame bullet 9).
- Stories 4 (escalation) and 5 (stats).
- Any automation of the retro judgment itself.
