# No phase owns flipping an ADR from Proposed to Accepted, so approved ADRs read Proposed until someone notices

**Id:** 2026-09-22-adr-status-flip-unowned
**Type:** meta
**Opened:** 2026-09-22 (assistant-identification-tags #1, review § Harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** ADR assistant-identification-tags/0001 was approved at its gate on 2026-09-22 and committed
with `**Status:** Proposed`; it still read so at Review, and the review commit flipped it. Earlier books' ADRs
read `Accepted`, but `engineering-team/workflows/2-architecture.md` (steps 8–9 and the per-phase commit) and
`.claude/commands/design-architecture.md` say nothing about who sets the status or when, and the ADR template
offers `Proposed | Accepted | Superseded` with no rule.

**Fix shape.** One sentence in `2-architecture.md`'s per-phase commit: on approval the Architect sets
`**Status:** Accepted (approved <date>)` before committing. Optionally a lint check (L-series) that an ADR
linked from a `Done` story does not read `Proposed`.

**Pointer:** review `engineering-team/reviews/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md`
§ Harness friction 1.
