# Story 1: harness-lint — the harness checks its own invariants

**Status:** Draft
**Created:** 2026-07-02
**Type:** Feature

## Background

The harness review (`docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md` §5.3) found that every class of drift it catalogued — wrong ports surviving 5+ weeks after being documented as wrong, PASS-reviewed stories reading Draft, Closed books with Active epics, one contributor's home directory baked into a shared skill — was mechanically detectable the whole time. Nothing was looking. OPERATIONS.md §11 already establishes the in-repo pattern (drift sentinels as tests) for runtime config; this story extends it to the harness itself. Every invariant below was violated at review time, so the script pays for itself on first run.

This is the **enforce** stage of the self-improvement loop and the foundation the other stories cite (the changelog touch-rule, the session-start budget rule, and the SessionStart hook all run through it).

## User-facing description

As a contributor (human or Claude session), I want every session start to mechanically verify the harness's own bookkeeping invariants, so that drift surfaces the day it's introduced instead of accumulating until an audit finds it.

## Acceptance criteria

- [ ] Given the repo root, when `bash scripts/harness-lint.sh` runs, it checks each of the following invariants and prints **one line per violation** naming the invariant id and the offending file/path:
  - **L1 status-flip:** every review in `engineering-team/reviews/<epic>/` (active, non-`done/`) whose final verdict is PASS has a matching story in `stories/<epic>/` with `**Status:** Done`.
  - **L2 epic-retirement:** every book with `Status: Closed` has all epics listed in its "Epics in this book" section at `Status: Done`.
  - **L3 epic-umbrella:** every active `stories/<epic>/` folder has a matching `epics/<epic>.md`.
  - **L4 review-has-story:** every active review file has a matching story file (same epic, same `<n>`).
  - **L5 no-hardcoded-port:** no `localhost:8877` (or other literal control-panel port URL outside `$TAPESTRY_PORT` form) in wiring files — `.claude/`, `engineering-team/{roles,workflows,templates}/`, `product-team/{roles,workflows,templates}/`, CLAUDE.md. AGENTS.md (the port's single home) is exempt; historical artifacts (stories/reviews/decisions/audits/docs) are exempt.
  - **L6 no-machine-paths:** no `/Users/` or `/home/<name>/` absolute paths in the same wiring set.
  - **L7 verdict-enum:** `.claude/commands/review-changes.md`, `roles/reviewer.md`, `workflows/5-review.md`, and `templates/review-checklist.md` agree on exactly `PASS | CHANGES_REQUESTED` (no `FAIL` as a verdict).
  - **L8 dead-links:** every relative markdown link in the wiring set + CLAUDE.md + AGENTS.md + the two team READMEs resolves to an existing file.
  - **L9 stale-headers:** any hand-maintained `**Last updated:**` header (BIBLE.md, OPERATIONS.md) within 14 days of that file's `git log -1` date, else flagged.
- [ ] Given zero violations, the script exits `0` and prints a one-line clean summary; given ≥1 violation, it exits `1`.
- [ ] Given a waiver file `scripts/harness-lint-waivers.txt` (one waiver per line: `<invariant-id> <path-or-pattern> <OPEN.md-row-or-reason>`), when a listed violation is encountered, it is reported as `waived` (visibly, with its citation) and does not affect the exit code. A waiver whose path no longer violates anything is flagged as stale. The live-feed post-close anomaly (OPEN.md row 16) ships as the first waiver.
- [ ] `scripts/whats-open.sh` runs harness-lint as its own section, so every `/whats-open` (and any future SessionStart hook) surfaces violations at session start.
- [ ] `npm test` includes a `harness-lint` suite that (a) runs the script against **synthetic fixtures** (a temp tree with one seeded violation per invariant) and asserts each is detected, (b) asserts the waiver mechanism works and stale waivers are flagged, and (c) runs the script against the **real repo** and asserts exit 0 (i.e., the repo is lint-clean at story close, modulo shipped waivers).
- [ ] The script needs no network, no running stack, and no dependencies beyond bash + git + coreutils (it must work in remote/web sessions — same constraint whats-open.sh already honors).

## Concepts touched

None — this story is harness tooling only. No concept-graph handles, no firmware, no product source. (Concept-graph orientation not applicable; the stack is not required.)

## Out of scope

- **L10 changelog-touch** (harness-path commits must touch CHANGELOG.md) — Story 2 adds this check once CHANGELOG.md exists.
- **Budget-rule check** (CLAUDE.md/AGENTS.md line caps) — Story 7 adds it when the caps are set.
- **Gate-"not run" streak detection** (a quality gate marked "not run" in N consecutive reviews auto-files an intake item) — needs review-file parsing conventions that Story 5 (stats) establishes; revisit there.
- Fixing any violations the script finds beyond what the Appendix A sweep already fixed — new findings become OPEN.md rows or waivers, not scope creep here.
- Any CI wiring (R-E3 / OPEN.md row 13).

## Open questions

1. **L1 verdict parsing:** reviews express the final verdict as prose ("**PASS.**", "### Final verdict", "Revised verdict — … CHANGES REQUESTED"). Proposed rule for the Architect to ratify: *the last verdict-shaped line in the file wins* (the sweep used the same rule and it matched all 57 reviews, including #22's PASS-then-CHANGES_REQUESTED history). Alternative: require a machine-readable `**Verdict:**` line going forward and grandfather old reviews via waiver.
2. **L9 threshold:** 14 days proposed; or drop the manual headers entirely (the review's alternative) and delete the check — Architect's call.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
