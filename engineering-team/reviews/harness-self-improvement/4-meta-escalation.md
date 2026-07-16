# Review: Story 4 — meta-escalation

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-02
**Diff:** story-4 impl commit — `scripts/whats-open.sh` (pre-pass + banner + section), OPEN.md rule bullet, `.claude/commands/whats-open.md` triage step, CLAUDE.md in-place rewrite, CHANGELOG row

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — reviewer-run: **harness-lint suite 25/25 PASS**; full-run failing set identical to the pre-book baseline — zero regression.
- [x] `bash scripts/harness-lint.sh` — **clean** (L8 over the new cross-references; L10 via the riding CHANGELOG row).
- [x] **Quiet path, live:** the "Meta items (harness lessons)" section lists rows 9 (14d) and 16 (1d); no banner at the top of the report — correct (2 items, both <30d).
- [x] **Firing path, reviewer's own fixture** (not the Implementer's): a temp tree with 3 young meta rows + 1 non-meta row + 1 DONE meta row → banner fires on the **count trigger** ("3 open harness lesson(s), oldest 2d") at the very top, before any section; only the 3 OPEN meta rows list in the section — DONE and non-meta correctly excluded. The **age trigger** was separately demonstrated in-session (aged row → "oldest 44d"). Both trigger arms exercised.
- [x] **Budget-neutrality:** `wc -l CLAUDE.md` = **191** — unchanged; the capture sentence landed via in-place rewrite of the write-discipline bullet, as the ADR specified.
- [ ] Playwright / lint / typecheck — n/a.

## Spec adherence (AC-by-AC)

- [x] **AC-1** OPEN.md § "How to use this ledger" documents the escalation rule — and deliberately *paraphrases* the thresholds ("aged past ~a month, or several open at once"), honoring the ADR's quote-don't-restate consequence.
- [x] **AC-2** whats-open.sh: `collect_meta()` pre-pass (one parse, two consumers); section lists OPEN `meta` rows with ages (ISO date from the Opened column, `?` on unparseable — skip-don't-guess as ratified) plus un-marked intake `Meta:` entries (age from the heading's own date — a small improvement over the story's letter); banner prints before the first section when count ≥3 or age >30d.
- [x] **AC-3** the command's triage step owns the judgment half: group related items; propose a concrete harness story (title + items it closes) at the top of the report.
- [x] **AC-4** CLAUDE.md capture sentence present; line count exactly unchanged.
- [x] **AC-5** both verification paths demonstrated (quiet live; firing on fixture — reviewer-reproduced independently).
- [x] **AC-6** CHANGELOG row present; lint clean.

## ADR adherence

- [x] Option A implemented precisely: single pre-pass, top placement structurally guaranteed (banner code precedes the first `hr`), meta section placed after the ledger section, judgment in the command layer, escalation advisory by construction (no exit-code effect — verified: the script's exit behavior is untouched).
- [x] No arrays in the new code — bash-3.2 safe without needing the length-guard pattern; the `date -d` guard degrades correctly on non-GNU date (ages become `?`, `META_MAX_AGE` stays 0, the count trigger still works).
- [x] No deviations from the ADR.

## Concept-graph integrity

- [x] n/a — harness tooling and ledger prose only.

## Things tests can't catch

- [x] DONE-status meta rows and non-meta rows excluded by the awk column filter (`$3 ~ /meta/ && $6 ~ /OPEN/`) — verified against the fixture.
- [x] No secrets, no debug residue; read-only over the tree.

## Findings

### Blocking
_None._

### Non-blocking
1. **`.claude/commands/whats-open.md` (triage step)** — restates the numeric thresholds "(≥3) or age (>30d)" while the ADR's single-source consequence formally binds only OPEN.md. If the script's thresholds ever change, this parenthetical goes stale. One-word fix ("at the script's thresholds") whenever the file is next touched; not worth a kick-back.
2. **`collect_meta()` awk column indexing** — a future OPEN.md row whose *Item* cell contains an escaped pipe (`\|`) would shift the Opened/Status columns for that row (awk splits on the pipe character regardless of the backslash). No current row does this (verified), and the failure mode is a mis-aged/missed single row, not a crash. Worth a header comment in OPEN.md ("avoid literal pipes in cells") or a smarter parse if it ever bites.

### Harness friction *(→ OPEN.md `meta` rows)*
1. None new this story.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run: the book is **not** complete — **4 of 7** stories Done; frame bullets 6–9 open (stats, enforcement, session-start restructure, the first live retro). No `/close-book` offer. Next per dependency order: **story 5, harness-stats**.
