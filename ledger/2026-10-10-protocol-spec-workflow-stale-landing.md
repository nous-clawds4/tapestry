# The Protocol-Spec workflow still says specs land in the BIBLE, and doesn't describe the worksheet-to-draft path the recent pre-NIPs took

**Id:** 2026-10-10-protocol-spec-workflow-stale-landing
**Type:** meta
**Opened:** 2026-10-10 (DList Auxiliary Events pre-NIP session; found by the doc-plan sweep, left out of that batch as a "could")
**Status:** OPEN
**Done:** —

`engineering-team/workflows/protocol-spec-workflow.md` contradicts itself. Its "Where the spec lands" paragraph
(amended by `protocols-directory` ADR 0001) says ratified wire-format specs land under `protocols/`, with the BIBLE
keeping a short pointer. But two other lines still name the BIBLE as the spec's home:

- line 5: the flow evolves "the protocol / spec — `BIBLE.md` and its ADRs";
- line 38: "Artifacts land in the normal homes: ADRs in `engineering-team/decisions/<epic>/`, the canonical spec in
  `BIBLE.md`, …".

It also doesn't describe the path the recent pre-NIPs actually took: a worksheet entry, then a `📝 pre-NIP` draft
in `protocols/drafts/` with the header block `protocols/README.md` asks for, a README index row, and a worksheet
"Graduated →" line. There was no story and no ADR; the story-and-ADR cycle comes later, when a draft is ratified into
the BIBLE and code. Treasure Maps, Pins, Spawning, Opinionated Views and DList Auxiliary Events all went this way.
A session following the workflow file as written would look for a story and ADR the practice doesn't use.

**Fix shape.** Point lines 5 and 38 at `protocols/` plus a BIBLE pointer, in line with "Where the spec lands". Add a
short paragraph describing the worksheet-to-draft path and when the docs-mode cycle starts. The file is a
harness-definition path (`scripts/harness-def-paths.txt`), so the same commit needs an `engineering-team/CHANGELOG.md`
row (L10).

**Pointer:** `engineering-team/workflows/protocol-spec-workflow.md` (lines 5, 30, 38); `protocols/README.md` § Status
ladder and § Worksheet; `protocols/worksheet.md` line 5 (entry format, "Graduated → <spec>").
