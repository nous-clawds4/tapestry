# Light books put gate outcomes in commit subjects, which every later judge reads through git log

**Id:** 2026-10-09-light-gate-outcomes-in-commit-subjects
**Type:** meta
**Opened:** 2026-10-08 (treasure-map-card-details book close, retro finding 1)
**Status:** OPEN
**Done:** —

The treasure-map-card-details book (Light trial) committed its gate boundaries with outcome-bearing subjects:
"j1: … design APPROVE", "test: J2 round 1 — story 1 kicked back …", "j3: … readiness APPROVE". Every gate-judge that
ran `git log` to orient itself saw them and disclosed it as a blinding break. None changed a verdict, but a judge
should not learn the earlier gates' outcomes at all.

Direction mode already settled this. ADR `harness-gate-integrity/0002` (§ 3, "commit-subject discipline") and
`roles/director.md` § "The decision journal" keep verdict outcomes in the journal and make gate commit subjects
outcome-free. `workflows/light-profile.md` says "the standard blinding rules apply", but a Light book has no journal and
no stated subject convention, so nothing told the session where outcomes go.

**Fix shape:** give the Light profile the same rule. Gate commits use an outcome-free subject such as
`gate: J2 (<epic> #<n>)`, and outcomes go in the commit body or a Light record a judge isn't pointed at. Optionally
extend lint L14 (or `harness-stats`) to flag `APPROVE|KICK_BACK` in the subjects of a Light book's commits. Ports both
ways: this is Direction's rule, borrowed.

**Pointer:** `engineering-team/audits/treasure-map-card-details/audit.md` §7 finding 1; commits `2aaa2f67`,
`70b0709e`, `d53fd1ea`, `2d09809e`, `64998621` on `feat/treasure-map-card-details`.
