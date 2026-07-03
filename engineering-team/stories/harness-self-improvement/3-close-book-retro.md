# Story 3: close-book-retro — every process lesson ends somewhere

**Status:** Draft
**Created:** 2026-07-02
**Type:** Feature (docs-mode deliverable — workflow/template/role prose; no runtime code)

## Background

The Director role routes process lessons "to the post-mortem" in two places (`roles/director.md:41`, `:145`) — and no post-mortem step, template section, or trigger exists anywhere. The cost is documented: the live-feed run's journaled lesson ("amendment labels should be process-neutral," `audits/live-feed/journal.md:57`) survives nowhere else; the reputation-info-popup run's Gate-5 lesson survived only because the Director volunteered extra work (it became `f314bbba` — the one time the loop closed end-to-end). Meanwhile the same failure class exists in the human-gated flow: the 2026-05-24 "Meta: origin-sync check" intake entry asked for a drift preflight at PO/Architect phase entry, sat unimplemented for 5+ weeks, while Direction mode independently built the identical check into its Stage-0 — harness fixes don't propagate between the harness's own variants. On the product side, both guardrails files promise enforcement that reviews now do, but nothing folds resolved guardrail tensions (the verified-reporters "iconography ruling") back into the guardrails.

This is the **route** stage of the loop (review §5.2): one defined ratification moment where lessons land, with no silent fourth state. The book already has its first two inputs queued: story 1's verdict-rule edge (Deviations + waiver) and story 2's review findings.

## User-facing description

As an operator closing a book of work, I want a defined post-mortem step that forces every journaled process note, review-flagged friction, and proposed amendment into exactly one terminal state — ratified harness commit, OPEN.md `meta` row, or recorded decline — so that no lesson can die silently again.

## Acceptance criteria

*Docs-mode: verified by inspection at Review + mechanically by harness-lint (L8 link integrity, L10 changelog-touch) — no test plan (see Classification note below).*

- [ ] Given `workflows/6-book-close.md`, its Input list names `journal.md` (when the book has one), the reviews' "Harness friction" lines, and the book's OPEN.md `meta` rows; and a numbered **Post-mortem / harness retro** step states the terminal-state rule verbatim: every process note and proposed amendment ends in exactly one of **{operator-ratified harness commit · OPEN.md `meta` row · explicit decline recorded in the audit}** — no fourth state — plus the propagation question ("does this port to the other flow — Direction ↔ human-gated?") and a pointer to cite `scripts/harness-stats.sh` output *when available* (story 5).
- [ ] Given `templates/build-audit.md`, it carries a **"Process findings (harness)"** section: one line per finding — what surfaced, where (journal/review/deviation), and its terminal state with pointer (commit SHA, OPEN.md row #, or "declined: <reason>").
- [ ] Given `.claude/commands/close-book.md`, it mirrors the step (wiring parity with the workflow — no restatement drift: a pointer plus the one-line rule).
- [ ] Given `roles/director.md`, its two "post-mortem" references point at the now-defined step in `workflows/6-book-close.md` — the dangling referent is closed.
- [ ] Given `workflows/1-planning.md` and `workflows/2-architecture.md`, each carries an **origin-drift preflight** at phase entry: `git fetch` + compare the working base against `origin/staging`; on drift, surface it to the user before proceeding (warn-and-surface — the hard halt stays Direction-only). This ports Direction Stage-0's check into the human-gated flow.
- [ ] Given `engineering-team/stories/_intake.md`, the 2026-05-24 "Meta: origin-sync check at PO + Architect phase entry" entry is marked **PICKED UP** → this story.
- [ ] Given `product-team/workflows/7-story-decomposition.md`, its gate carries the mirrored **3-question product retro**: which template sections went unused; which guardrail was fought or overridden (propose the amendment); what did the consuming team need that the artifacts lacked — answers recorded as OPEN.md `meta` rows (same inbox, no new surface).
- [ ] Given this story's commits (all def paths), the CHANGELOG carries its row and `harness-lint.sh` stays clean (L8 across all new cross-references; L10 satisfied).

## Concepts touched

None — harness prose only. (Stack not required.)

## Classification note (for the gate)

Docs-mode adaptation of the Feature path, mirroring the protocol-spec variant: **Test Design skipped** — the deliverable is workflow/template prose with no runtime surface; the mechanical guards are harness-lint's L8 (every new cross-reference must resolve) and L10 (changelog row), and the Reviewer audits accuracy/consistency by inspection. **Architecture kept, light** — the no-fourth-state rule's exact wording, the audit-section shape, and the six-file wiring are small but genuinely cross-cutting design calls worth one short ADR.

## Out of scope

- The meta-escalation aging/clustering rule and CLAUDE.md capture sentence (story 4).
- `scripts/harness-stats.sh` itself (story 5) — this story only writes the forward-compatible citation.
- Retro automation of any kind — the step is prompt-and-human; scripts only surface inputs.
- Actually *running* the first retro — that happens at this book's own close (frame bullet 9), by design.
- Re-litigating story 1's verdict-rule edge — it becomes this retro's first agenda item at book close, not a change now.

## Open questions

1. **Classification** — ratify the docs-mode adaptation above (skip Test Design; keep a light ADR)? *(Recommend: yes — precedent: task-queue #20 and the protocols-directory stories.)*
2. **Terminal-state record shape** — a three-column table in the audit's "Process findings" section (finding · source · terminal state + pointer)? *(Recommend: yes — table rows match the house ledger idiom and are greppable by story 5.)*
3. **Preflight strictness** — warn-and-surface in the human-gated flow (the operator decides whether to rebase first), hard-halt stays Direction-only? *(Recommend: warn-and-surface — the human gate IS the halt mechanism.)*

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: n/a — docs-mode (see Classification note)
- Review: (filled in after Review phase)
