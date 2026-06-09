# Story 1: Scaffold the protocols/ directory

**Status:** Done
**Created:** 2026-06-09
**Type:** Doc
**Epic:** protocols-directory — realizes `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md`

## Background

Protocol-level material — wire formats an independent implementation would need to interoperate — is scattered across BIBLE.md sections, two unmerged branches, and a published NostrHub Custom NIP whose local draft has silently diverged ahead of it. There is no single place to see what protocol specs exist, what state each is in, or where the open protocol problems live. The design handoff (`docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md`, 🔴 OPEN) settled the remedy: a dedicated `protocols/` directory at the repo root with a boundary rule, a status ladder, and a per-spec migration plan.

This story creates the **container only** — the directory, its index, and the worksheet — so that the six migration stories that follow each have a defined place to land. No spec content moves yet.

## User-facing description

As a protocol author (or a contributor orienting on the project), I want a single directory that indexes every protocol spec we author — published, draft, or planned — with its current status and the location of its content today, so that I can tell at a glance what exists, what's diverged, and what's unsolved, without spelunking through the BIBLE, old branches, and NostrHub.

## Acceptance criteria

- [ ] Given a fresh clone of `staging`, when a reader opens `protocols/README.md`, then it states the BIBLE-vs-protocols boundary rule (the "signed events on the wire" test, including the grey-zone notes from handoff §2) and the five-step status ladder from handoff §3.
- [ ] Given `protocols/README.md`, when a reader consults its spec index, then all seven specs from the handoff's migration map (§4) appear, each with: proposed target file, current status, and a pointer to where the content lives **today** (BIBLE section, branch path, or NostrHub naddr).
- [ ] Given that stories 2–7 have not yet run, when a reader follows the index, then no entry presents a dead link — not-yet-migrated specs are explicitly marked planned, and the BIBLE/branches remain identified as the current source of truth.
- [ ] Given `protocols/worksheet.md`, when a reader opens it, then entries W1–W7 from handoff §7 are present, each self-contained enough to pick up cold (problem statement plus the ADR/BIBLE references it relates to).
- [ ] Given `CLAUDE.md`, when a new session starts and follows the "Also check at session start" list, then it is directed to `protocols/README.md` alongside the existing handoff/intake pointers.
- [ ] Given the full change, when `npm test` runs, then it passes unchanged (docs-mode quality gate: no code, no tooling, no firmware).
- [ ] Given BIBLE.md, when this story is complete, then it is byte-identical to before — no wire-format content moves in this story, and nothing is normative in two places.

## Concepts touched

None. Docs-only scaffold; no events, kinds, or concept handles are defined or modified. (Concept Graph API was unreachable during planning; irrelevant here.)

## Out of scope

- Migrating or reconciling any spec content (stories 2–7 of the handoff's §8 plan).
- Any edit to BIBLE.md.
- Republishing anything to NostrHub (owner's act, story 2's tail).
- Deleting the stray spec files from `feat/communities` (noted in handoff §8 logistics; belongs to that branch's next touch).
- Any code, firmware, or tooling change.

## Open questions

- **Does this story take the Architecture phase?** Recommendation: no — per the project type table, Doc changes run Implementer + Reviewer only, and the design (layout, ladder, boundary rule) is already recorded in the handoff doc, which serves as this epic's design record. An ADR here would duplicate it. Confirm at the gate.
- Handoff §9 Q1–Q2 (final spec filenames; `nips/` as working copy vs. verbatim mirror) are settled *provisionally* per the handoff for the purposes of the index; each migration story's gate may still revise its own entry.

## Linked artifacts

- Design record: `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` (this epic's capture doc)
- ADR: (recommended skipped — see open questions)
- Test plan: skipped (docs-mode)
- Review: `engineering-team/reviews/protocols-directory/1-scaffold-protocols-directory.md` — PASS (after one-citation kickback, fixed in `764c5a90`)
