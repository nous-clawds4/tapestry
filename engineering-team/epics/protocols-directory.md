# Epic: Protocols Directory

**Status:** Done (epic file created retroactively 2026-07-02 during the harness backfill — see docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md Appendix A; the epic itself ran 2026-06 and its book closed 2026-06-10)
**Book:** `engineering-team/audits/protocols-directory/book.md` (acceptance-frame)

## What this is

The `protocols/` directory: a single home for every protocol spec this project authors (published Custom NIPs and local pre-NIPs), with per-spec status, plus `protocols/worksheet.md` for open protocol problems. The stories extracted normative protocol content out of BIBLE.md into standalone specs (BIBLE sections became pointers + implementation detail per the normative-in-exactly-one-place rule) and reconciled the decentralized-lists NIP.

This epic ran docs-mode (Protocol-Spec Workflow): no test plans; the Implementer authored spec prose; the Reviewer audited accuracy and cross-reference consistency.

## Stories

`stories/done/protocols-directory/` — all seven shipped with PASS reviews (2026-06-08 → 2026-06-10):

1. Scaffold the protocols directory
2. Decentralized-lists reconciliation
3. Tapestry-concepts extraction
4. Class-thread-tags extraction
5. Inherit-from extraction
6. Communities spec
7. Tags spec

## Why this file exists

The epic predates the rule that every `stories/<epic>/` folder has an `epics/<epic>.md` umbrella; it was the only story folder without one (a harness-lint invariant violation). Created at retirement time so the umbrella exists in the record.
