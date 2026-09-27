# The tagging-edges handoff said a new database rule "disables Install Firmware" on every existing instance; it disables nothing on an installed one, and the handoff's own review marked the claim "Holds"

**Id:** 2026-09-27-handoff-overstated-constraint-gate
**Type:** meta
**Opened:** 2026-09-27 (tagging-edges #2 Planning, fact-gathering pass)
**Status:** DONE
**Done:** 2026-09-27 (tagging-edges #2 Planning, `feat/tagging-edges-2`: the handoff's §4 decision 3 and §2.4 corrected in the commit that filed this row)

**What was seen.** `docs/TAGGING_EDGES_HANDOFF.md` §4 decision 3 said that adding the `TAGS.address` rule to
`setup/neo4jConstraintsAndIndexes.sh` and `src/api/status/queries/expectedNeo4jSchema.js` "makes every existing
instance report 'not set up', which disables Install Firmware, until the constraints task re-runs". Half of that
holds: `GET /api/status/neo4j-constraints` does report `not set up` while any expected name is missing
(`src/api/status/queries/neo4j-constraints.js:50-53`). But the Install / Complete Install block in
`ui/src/pages/settings/FirmwareExplorer.jsx` renders only while firmware is not fully installed (`{!isInstalled && …}`
at :536), so on staging and production, which are installed, nothing visible changes; and `POST /api/firmware/install`
has no constraint check. The handoff also missed a third, separate list of expected rules,
`ui/src/pages/Dashboard.jsx:223-232` (4 constraints and 1 index, against 7 and 18 in `expectedNeo4jSchema.js`), which
drives the Dashboard's "missing" banner and its only fix button (row `2026-09-27-expected-schema-lists-disagree`).

The real rollout risk was the reverse of the one stated: because nothing visible flips, a writer could run before the
rule exists and no surface would say so. Story 2 therefore requires the rule from deploy (its AC-6).

The handoff's docs-lane review (`engineering-team/reviews/tagging-edges/handoff-doc-2026-09-27.md:52`, item 4.3)
marked the claim "Holds", citing `FirmwareExplorer.jsx:64, :541`: it read the lines that compute and apply the
disabled state, not the render condition around them. Two §2.4 claims were also looser than they read: "reusable as
is" (a registry task must be a bash entry script, `src/manage/taskQueue/launchChildTask.sh:344`, :349), and
"scheduling needs no new code" (true for an entry the operator adds; a shipped seed reaches only instances with no
schedule file, `src/api/scheduled-tasks/index.js:118-125`, OPEN.md row 336).

**The lesson.** A claim about what a UI shows needs the render condition that encloses the cited line, not only the
line; verify it on an instance in the state the claim is about (here: firmware installed).

**Pointer:** `docs/TAGGING_EDGES_HANDOFF.md` §2.4 and §4; `engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md`
AC-6.
