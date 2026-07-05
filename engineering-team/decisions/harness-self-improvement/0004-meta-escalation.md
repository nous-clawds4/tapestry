# ADR 0004: meta-escalation — one pre-pass in whats-open, banner before sections, judgment stays in the command

**Status:** Accepted (gate passed 2026-07-02, operator — Option A)
**Date:** 2026-07-02
**Story:** `engineering-team/stories/harness-self-improvement/4-meta-escalation.md`

## Context

The escalation must print **at the top** of the whats-open report (gate decision 2), but the script prints sections in order as it computes them — so the meta condition has to be computed **before** any section prints. Two consumers need the same data (the banner and the meta section); parsing OPEN.md rows twice would be the drift-in-miniature this book keeps killing. Signals (gate decision 1): OPEN rows of type `meta` + un-marked intake `Meta:` headings. Age (gate decision 3): first ISO date in the Opened column, skip-don't-guess.

CLAUDE.md constraint: the capture sentence must land without growing the file (191 lines today). The write-discipline text lives in one long bullet (line 14) — editable in place without a line-count change.

## Options considered

### Option A — a `collect_meta()` pre-pass in whats-open.sh; banner printed before the first section; the meta section reuses the collected data
One function runs before any `hr` output: parses OPEN.md `meta` rows (id, age from the first ISO date in the Opened column, skipping unparseable), greps `_intake.md` for un-marked `Meta:` headings, stores lines + count + max-age in shell variables. If `count ≥ 3 || max_age > 30`, an escalation banner prints at the very top naming the trigger; the "Meta items (harness lessons)" section (placed right after the OPEN.md ledger section) prints the collected lines. Judgment (relatedness, story proposal) goes in `.claude/commands/whats-open.md`'s triage step — the command layer, not the script.
**Pros:** single parse, two consumers; top placement structurally guaranteed; mechanical/judgment split lands exactly where the frame drew it. **Cons:** the script gains its first stateful pre-pass — mitigated by keeping it one function with three output variables.

### Option B — compute inline in the meta section; print the banner at the bottom as a "summary"
**Pros:** no pre-pass. **Cons:** violates the ratified top-placement decision; a trailing escalation is exactly the buried-signal failure mode. Rejected.

### Option C — put the escalation in harness-lint.sh as an L11-style check
**Pros:** reuses the violation machinery. **Cons:** lint asserts pass/fail invariants; an aged meta item isn't a *violation* (the fix may legitimately be "propose a story next week") and failing the lint exit code on it would poison the story-6 hook and the real-repo test with time-bombs. Advisory triage belongs in the roll-up. Rejected.

## Decision

**Option A.** Count mechanically once, surface loudly at the top, and keep every judgment call in the command layer where the triage already lives.

## Consequences

- Story 6's SessionStart hook inherits the banner for free (it runs whats-open).
- The 30d/≥3 thresholds live in the script (one place) and are quoted, not restated, by OPEN.md's rule text.
- An aged meta item can never fail `npm test` or the lint exit code — escalation is advisory by construction (the Option-C rejection, made structural).
- The intake-side signal reuses the existing un-marked-entry heuristic — no new marker convention.
- **Firmware reinstall required?** No.

## Implementation notes

- **`scripts/whats-open.sh`** — `collect_meta()` before the first `hr`: (1) OPEN rows: `grep -E '^\|' OPEN.md | awk -F'|'` type-column == `meta` && status-column == OPEN; age = today − first `20[0-9]{2}-[0-9]{2}-[0-9]{2}` in the Opened column via the existing `date -d` guard (skip row's age silently if unparseable or non-GNU date, still count it); (2) intake: the existing awk heuristic filtered to headings matching `— Meta:`. Sets `META_LINES`, `META_COUNT`, `META_MAX_AGE`. Banner (top, before the ledger section): `⚠ META ESCALATION — <n> open harness lessons / oldest <d>d (>30d): propose a harness story at triage (see OPEN.md § How to use)`. New section "Meta items (harness lessons)" after the OPEN.md ledger section prints `META_LINES` (or "(none)").
- **`OPEN.md`** § "How to use this ledger" — one bullet: the meta escalation rule (thresholds quoted from the script; judgment at triage; pointer to the whats-open command).
- **`.claude/commands/whats-open.md`** — triage step addition: group related meta items; when the banner fires or ≥3 are related, propose a concrete harness story (title + items it closes) instead of re-listing.
- **`CLAUDE.md:14`** — in-place rewrite of the write-discipline sentence to add: a misleading orientation doc or observed harness defect ⇒ `meta` row before session end. Same single line; total line count unchanged (191).
- **`engineering-team/CHANGELOG.md`** — one row.
- **Verification (reviewer-run):** live quiet path (rows 9 & 16 print with ages, no banner); firing path on a fixture tree — copy OPEN.md into a temp dir with one row's Opened date set >30d back, run the script there (it tolerates non-git dirs), observe the banner; `wc -l CLAUDE.md` unchanged; lint clean.

## Out of scope

- Stats (story 5), hook (story 6), formal budget caps (story 7).
- Any auto-generated story text — proposal stays prompt-level.
