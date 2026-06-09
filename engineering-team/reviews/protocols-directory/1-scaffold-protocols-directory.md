# Review: Story 1 — Scaffold the protocols/ directory

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-10
**Diff:** commit `b29df49d` (3 files, +134/-0: `protocols/README.md`, `protocols/worksheet.md`, `CLAUDE.md`)
**Mode:** docs-mode (Protocol-Spec workflow). Architecture skipped per approved story — design record is `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md`. Test Design skipped.
**Method note:** the implementation was authored in this same session, so the accuracy audit was fanned out to 12 independent agents across five dimensions (acceptance criteria, README facts, worksheet facts, link/anchor integrity, handoff consistency), with every non-note finding adversarially verified. Quality gates were run directly by the Reviewer.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (full suite, `Overall: PASS`)
- [x] `npm run test:playwright` — skipped: docs-only change, no UI surface touched
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._
- [x] `BIBLE.md` byte-identical — `git diff b29df49d~1 b29df49d -- BIBLE.md` is empty (hard story criterion)
- [x] Diff scope — exactly the three intended files; no code, firmware, or tooling

## Spec adherence (acceptance criteria, audited independently)

- [x] AC1 — README states boundary rule + grey-zone notes + five-step ladder (handoff §2–§3).
- [x] AC2 — all seven specs from handoff §4 indexed with planned file, status, today's source.
- [x] AC3 — no dead links; planned files are plain text; all seven BIBLE anchors verified against GitHub slugification; branch refs are `git show`-able code text.
- [x] AC4 — worksheet W1–W7 present, self-contained, with refs. **One mis-citation found — see Blocking #1.**
- [x] AC5 — CLAUDE.md session-start list gains the `protocols/README.md` bullet.
- [x] AC6 — `npm test` green.
- [x] AC7 — BIBLE.md byte-identical.
- [x] No criterion silently dropped; no behavior beyond the story (two pre-disclosed authorial choices — worksheet status convention, `branch:path` notation — accepted as within the "pick up cold" criterion).

## Design-record adherence (handoff in lieu of ADR)

- [x] Layout, ladder, boundary rule, index statuses match handoff §2–§4; W1–W7 match §7 in substance.
- [x] Factual claims verified at source: BIBLE §5/§8/§9/§22/§23/§25/§26 titles and content; ADRs 0011/0027/0028 on staging; ADRs 0001/0009/0015 and firmware concepts `tag`/`nostr-user-tag`/`tag-pinning` on `feat/pubkey-tagging-target`; all four spec files on `feat/communities`; NostrHub naddr reachable.
- [x] No new dependencies.

## Concept-graph integrity

- [x] N/A — docs-only; no concepts defined or modified, no firmware reinstall needed. Handles appearing in prose are illustrative, correctly in `kind:pubkey:slug` form.

## Things tests can't catch

- [x] No secrets committed (the one pubkey literal discussed is already public wire data).
- [x] No debug artifacts / commented-out content.

## Findings

Audit produced 8 raw findings; adversarial verification confirmed 5, refuted 2, and 1 was a note.

### Blocking

1. **protocols/worksheet.md:51 (W5)** — says BIBLE **§22** "lists it on the flaw-A exit path." Wrong section: §22's Deferred list names REFERENCES only as a reserved-future candidate; it is **§23** (BIBLE.md:1631, future-candidate tags) that ties REFERENCES to the flaw-A exit (`REFERENCES (Story #8 community-reference; flaw-A exit)`). Substance correct, citation wrong. Asked change: cite §23 for the flaw-A-exit linkage (one-phrase edit).

### Non-blocking

1. **protocols/worksheet.md:45 (W4)** — "the compat companion mandates `a`-tags for kind-34550 items because they're replaceable" is true of **Method 2** specifically (Method 3 uses `z` tags on the 34550 event itself). Optional: add "(Method 2)".
2. **protocols/README.md:50–56 (index, "Content lives today" column)** — four rows (specs #2, #3, #4, #6) drop the handoff §4 scope parentheticals (e.g. what the compat companion's "complete" covers; §5's "kind unification, a-tag addressing…"). Two sibling findings of the same flavor were refuted on the grounds that an index points rather than describes, and the handoff is one link away — I concur, and judge all six the same way: acceptable index design, not information loss. Optional improvement only: restore the short scope notes if the index is meant to stand alone after the handoff is eventually marked SUPERSEDED. Worth revisiting when the epic closes.

## Verdict

~~**CHANGES_REQUESTED**~~ → **PASS** (see re-review below)

Initial verdict CHANGES_REQUESTED — solely for Blocking #1, a one-phrase citation fix in `protocols/worksheet.md` (W5: §22 → §23). Everything else passed: all seven acceptance criteria met, quality gates green, BIBLE untouched, factual claims verified at source.

## Re-review (2026-06-10, commit `764c5a90`)

Blocking #1 fixed as asked: W5 now cites §23 (BIBLE.md:1631) for the flaw-A-exit linkage, with §22's deferred list correctly characterized as carrying REFERENCES only as a reserved-future candidate. Non-blocking #1 folded in: W4 now scopes the `a`-tag mandate to Method 2 and notes Method 3's `z`-tag form. Diff verified to touch only the two phrases asked; `npm test` re-run green. Per the initial verdict's terms, the review converts to **PASS**.
