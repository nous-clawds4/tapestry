# No document gives the properties on FOLLOWS, MUTES and REPORTS, and their writers store different things: nothing, the event's `created_at`, the reconcile run's clock time, or 0

**Id:** 2026-09-27-social-edge-properties-undocumented
**Type:** docs
**Opened:** 2026-09-27 (tagging-edges #1, story review Blocking 2; ADR 0001 follow-up 4)
**Status:** OPEN
**Done:** —

**What was seen.** BIBLE §6's Social Graph Relationships table (added by tagging-edges #1) lists FOLLOWS, MUTES and
REPORTS by direction and source kind only. OPEN.md row 5 (DONE, 2026-06-16) noted that BIBLE doesn't enumerate edge
properties and made no data-model edit. The one document that does, `src/pipeline/README.md:108`, says all three
carry `timestamp` equal to the event's `created_at`. The code, read 2026-09-27:

- **Stream consumer.** `src/pipeline/stream/redis-consumer.js:52`, `:81` and `:103` run `MERGE (pub)-[:FOLLOWS]->…`
  (and the same for MUTES and REPORTS) with no properties. The MERGE matches any existing edge between the pair and
  leaves it unchanged. A new edge gets no `timestamp`, and a new REPORTS edge gets no `report_type`.
- **Batch transfer** (`src/pipeline/batch/transfer.sh`). `timestamp` = `created_at` (`kind3EventsToFollows.js:68`,
  `kind10000EventsToMutes.js:68`, `kind1984EventsToReports.js:72`; `SET r.timestamp` at `apocCypherCommand1_follows:22`
  and `apocCypherCommand1_mutes:22`). REPORTS are merged per `report_type`, which is the `p` tag's third element or
  `'other'` (`kind1984EventsToReports.js:65-67`), and get `timestamp` only on create (`apocCypherCommand1_reports:22-23`).
  `eventsToRelationships.js:110`, through `processNostrEvents.sh:57`, writes `created_at` for all three and no
  `report_type`. No code calls that script.
- **Reconcile queue.** `src/pipeline/reconcile/processReconciliationQueue.js:167` and `:173` set `timestamp` =
  `created_at`. REPORTS get no `report_type`.
- **Reconciliation calculators** (`reconcileRecent.sh`, `reconcileAuthor.sh`, `reconcileNetwork.sh`,
  `reconciliation.sh`, and `reconcileAll.sh` for MUTES and REPORTS). `timestamp` = the run's wall-clock second
  (`calculateFollowsUpdates.js:119`, `calculateMutesUpdates.js:119`, `calculateReportsUpdates.js:59`), applied by
  `reconciliation/apocCypherCommands/apocCypherCommand1_*ToAddToNeo4j:22-23`. REPORTS are merged per `report_type`,
  and `timestamp` is set on create only.
- **`reconcileAll.sh` for FOLLOWS.** `timestamp: 0` (`src/pipeline/reconciliation/reconcileAll.sh:181`), on purpose
  according to its comment at `:175-179`.

So a FOLLOWS edge's `timestamp` can be its event's date, the time a reconcile ran, 0, or missing, depending on which
writer created it. The stream's property-less MERGE and the other writers' per-type MERGE also let one pair hold an
untyped REPORTS edge beside typed ones. Readers depend on these properties:
- the reporters table's Report Type and Reported columns read `rel.report_type` and `rel.timestamp`
  (`src/api/grapevineInteractions/queries/reportersWithMetrics.js:108-109`);
- report scoring matches `REPORTS {report_type: …}` (`src/algos/reports/calculateReportScores.sh:79`, `:88`), so an
  untyped edge is not counted there;
- `src/api/neo4j/neo4jStatus.js:208` counts "recent relationships" by `r.timestamp` across every type.

A correction to the story review's Blocking 2: `calculateFollowsUpdates.js:265` and `calculateMutesUpdates.js:265` are
in the deletion pass. That `timestamp` goes into the delete file, and `apocCypherCommand1_*ToDeleteFromNeo4j` never
reads it.

**Fix shape.** First decide the intended shape. The README's shape (`timestamp` = `created_at`, plus `report_type` on
REPORTS) is one candidate. Then document it in BIBLE §6 in its own table under the Social Graph Relationships table.
The AC-5 test (`test/tagging-edge-contract.test.js:776-788`) rejects `timestamp` or `report_type` on the line that names
each of the three with its kind, so the properties either go elsewhere or that test changes with the doc. Until the
writers agree, record what each one writes, and correct `src/pipeline/README.md:108`. Making the writers agree is code
work. For REPORTS it is OPEN.md row `2026-09-27-reports-writers-disagree-on-shape`, which proposes `created_at` and
`report_type` and points back here for the record. FOLLOWS and MUTES have no such row yet: the stream's missing
`timestamp`, the calculators' clock time and `reconcileAll`'s 0 are open until the shape is decided.

**Pointer:** review `engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md` § Blocking 2; ADR
`engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md` § Context (the existing FOLLOWS / MUTES /
REPORTS writers) and § Consequences, "New debt / follow-ups" item 4; OPEN.md row 5; related OPEN.md row
`2026-09-27-reports-writers-disagree-on-shape`.
