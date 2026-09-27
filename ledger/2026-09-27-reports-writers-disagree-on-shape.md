# The stream and the reconcile tasks write REPORTS in two different shapes, so one report can become two edges

**Id:** 2026-09-27-reports-writers-disagree-on-shape
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #1, the book's kickoff orientation of the follows pipeline; epic § Key facts / guardrails; review Blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** The stream consumer writes `MERGE (pub)-[:REPORTS]->(r)` for each `p` tag of a kind 1984
(`src/pipeline/stream/redis-consumer.js:98-104`). The edge gets no `report_type` and no `timestamp`, and the pattern
matches any REPORTS edge already between the two users. The reconcile tasks (`reconcileRecent.sh:205`,
`reconcileNetwork.sh:194`, `reconcileAll.sh:137`, `reconcileAuthor.sh:127` and `reconciliation.sh:310`, all under
`src/pipeline/reconciliation/`) all run `apocCypherCommands/apocCypherCommand1_reportsToAddToNeo4j`, whose edge step
is `MERGE (u1)-[r:REPORTS {report_type: line.report_type}]->(u2) ON CREATE SET r.timestamp = line.timestamp`
(`:22-23`). The batch path's `src/pipeline/batch/apocCypherCommand1_reports:22-23` is the same statement.
`report_type` is the `p` tag's third element: `other` when there is none, `unspecified` when it is empty
(`kind1984EventsToReports.js:95-98`). On the reconcile path `timestamp` is the run's wall-clock time, not the event's
(`calculateReportsUpdates.js:59`).

The two paths meet badly in either order. **Stream first:** the reconcile's extractor reads the untyped edge back as
`unspecified` (`getCurrentReportsFromNeo4j.js:165-166`), which never equals the type the converter derives from the
event unless the tag's third element is empty. The diff therefore calls the report missing and adds a typed edge beside
the untyped one. Reports are add-only (`calculateReportsUpdates.js` has no delete step), so the untyped edge stays.
**Reconcile first:** the stream's untyped MERGE matches the typed edge and writes nothing, so a later report of the same
user under another type waits for the next reconcile.

Readers of `report_type` see the difference. The reporters list returns one row per edge
(`src/api/grapevineInteractions/queries/reportersWithMetrics.js:100-109`), so a reporter written stream-then-reconcile
appears twice, once with no type and no timestamp. `src/algos/reports/calculateReportScores.sh:79` and `:88` match on
`{report_type: …}`, so an edge that only the stream wrote counts toward no type. The stream also passes `p` values
through unchanged (`redis-consumer.js:94`), where the converter lowercases them (`kind1984EventsToReports.js:96`);
whether strfry ever stores a `p` that is not lower-case was not checked. All of this is from the code: the local graph
has no REPORTS edges, and production's Cypher endpoint is owner-gated, so no duplicate has been counted on a live
graph.

**Fix shape.** One REPORTS contract for both writers. The stream MERGEs on the same key, `report_type`, derived by one
function shared with the converter (same defaults, same lower-casing). Both writers set `timestamp` the same way: the
event's `created_at`, as the batch converter already does (`src/pipeline/batch/kind1984EventsToReports.js:72`), is the
obvious choice. Then a one-off cleanup, run after a `reconcileAll`: delete each untyped REPORTS edge that has a typed
edge between the same two users, since the typed edge carries the same report. Record the chosen property set where
OPEN.md row `2026-09-27-social-edge-properties-undocumented` asks for it.

**Pointer:** epic `engineering-team/epics/tagging-edges.md` § Key facts / guardrails (the "Known defects in the
follows pipeline" bullet: "the stream and reconcile writers disagreeing on REPORTS' shape"); review
`engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md` Blocking 4; related OPEN.md row
`2026-09-27-social-edge-properties-undocumented`.
