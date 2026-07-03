# Story 4: meta-escalation — the capture inbox can't silt up

**Status:** Approved
**Created:** 2026-07-02
**Approved:** 2026-07-02 (operator, in-session gate — approved as drafted incl. all three recommendations + the classification note)
**Type:** Feature (script section + ledger/command/CLAUDE.md prose)

## Background

OPEN.md has had a `meta` type since its creation (2026-06-14) and it had **never been used** until this book — the one genuine meta item before it (the 2026-05-24 origin-sync check) sat in `_intake.md` for five weeks at "Priority: Low" while the identical fix shipped independently in Direction mode. A capture inbox without an escalation rule silts up: items age, cluster, and never convert into harness stories. Stories 1–3 built capture points that now write `meta` rows (review harness-friction lines, the close-book retro, the product Phase-7 retro) — this story makes the inbox **demand action**: aging and clustering are counted mechanically at every session start; the judgment ("are these related? what story would fix them?") stays with the triage layer and the human.

This is the escalation half of the **ratify** stage (review §5.4). The capture sentence in CLAUDE.md completes §5.1's inbox wiring — under the constraint the book frame sets: CLAUDE.md must not grow.

## User-facing description

As a contributor running `/whats-open`, I want open harness lessons listed with their age and an explicit "propose a harness story" trigger when they accumulate or go stale, so that captured lessons convert into fixes instead of anniversaries.

## Acceptance criteria

- [ ] Given OPEN.md's "How to use this ledger" section, it documents the **meta escalation rule**: `meta` items get their own `/whats-open` section; any OPEN `meta` item **older than 30 days**, or **3 or more** open meta items (relatedness judged at triage), triggers a "propose a harness story" line at the top of the roll-up.
- [ ] Given `scripts/whats-open.sh`, a new **"Meta items (harness lessons)"** section lists: OPEN rows of type `meta` from OPEN.md (with age in days, computed from the Opened date), plus `## … — Meta:` intake entries lacking a PICKED UP/RESOLVED marker. When the escalation condition holds (count ≥ 3, or any age > 30d), a banner prints **at the top of the report** naming the trigger.
- [ ] Given `.claude/commands/whats-open.md`, its triage step instructs the judgment half: group related meta items; when the banner fires (or ≥3 items are related), propose a concrete harness story (title + the items it would close) rather than re-listing the items.
- [ ] Given `CLAUDE.md`, its OPEN.md write-discipline text gains the capture sentence — *an orientation doc that misled the session, or any observed harness defect, gets a `meta` row before the session ends* — **without increasing CLAUDE.md's total line count** (condense in place; the frame's budget constraint, ahead of story 7's formal cap).
- [ ] Given the current repo state, the section verifiably shows the **quiet path** (the open meta rows print with ages; no banner — none is >30d and fewer than 3 are open); the **firing path** is demonstrated against a fixture tree (a copied OPEN.md with an aged row) at Review.
- [ ] Given this story's commits (def paths), the CHANGELOG carries its row and `harness-lint.sh` stays clean.

## Concepts touched

None — harness tooling and ledger prose. (Stack not required.)

## Classification note (for the gate)

Feature; **Test Design skipped** per whats-open precedent (display/roll-up logic has no unit suite — stories R-W1 and #2 shipped whats-open sections with reviewer-run verification; the firing path is demonstrable on a fixture tree since the script tolerates non-git directories). **Light ADR kept** — three small but real design calls: which signals count, where the age math lives, banner placement mechanics (the script prints sections in order, so a top-of-report banner needs a pre-pass).

## Out of scope

- `scripts/harness-stats.sh` (story 5) and any metrics beyond age/count.
- The SessionStart hook that will surface this automatically (story 6).
- The formal CLAUDE.md/AGENTS.md line-count caps and their lint check (story 7) — this story merely refuses to grow CLAUDE.md.
- Auto-generating the proposed harness story — the proposal is prompt-level judgment, by design.
- Retro-triaging the existing open meta rows (9, 16) — they're 13d and 0d old; the rule will catch them if they age.

## Open questions

*All resolved at the Planning gate (2026-07-02, operator):*

1. **Which signals count — RESOLVED:** both OPEN.md `meta` rows and un-marked intake `Meta:` entries.
2. **Banner placement — RESOLVED:** top of the report, via a pre-pass.
3. **Age source — RESOLVED:** first ISO date in the Opened column; skip-don't-guess on unparseable rows.

## Linked artifacts

- ADR: `engineering-team/decisions/harness-self-improvement/0004-meta-escalation.md` (Accepted 2026-07-02)
- Test plan: n/a — reviewer-run verification (see Classification note)
- Review: (filled in after Review phase)
