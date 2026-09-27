# The Dashboard's constraints check expects 4 constraints and 1 index; the server's expects 7 and 18, so the Dashboard never reports most missing rules

**Id:** 2026-09-27-expected-schema-lists-disagree
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #2 Planning, fact-gathering pass)
**Status:** OPEN
**Done:** —

**What was seen.** Two hand-kept lists say which Neo4j constraints and indexes an instance should have:
- `src/api/status/queries/expectedNeo4jSchema.js:10-39`: 7 constraints and 18 indexes. `GET /api/status/neo4j-constraints`
  compares against it, and Settings › Firmware gates Install / Complete Install on its answer (while firmware is not
  fully installed).
- `ui/src/pages/Dashboard.jsx:223-232` (`ConstraintsCheck`): 4 constraints and 1 index. It drives the Dashboard's
  "Neo4j Constraints & Indexes Missing" banner, the only React control that installs them ("🔧 Install Constraints &
  Indexes", owner only), and the onboarding checklist item.

So an instance missing, say, `nostrUserWotMetricsCard_unique_combination_1` or `nostrUser_hops` gets a server "not set
up" (and, before firmware is fully installed, a disabled Install button with no fix offered) while the Dashboard says
everything is present. The Dashboard's list dates from `e4f62886` (2026-03-12); the server's from `14b5448d`
(2026-05-04); neither was updated when the other grew.

tagging-edges story 2 (AC-6) adds its one-per-tagging rule to both lists; it does not reconcile the rest.

**Fix shape.** One list: the Dashboard reads the expected names from the server's answer (the endpoint already returns
what is missing) instead of keeping its own; or a test that pins the two lists equal.

**Pointer:** `src/api/status/queries/expectedNeo4jSchema.js`; `src/api/status/queries/neo4j-constraints.js:50-59`;
`ui/src/pages/Dashboard.jsx:223-341`; row `2026-09-27-handoff-overstated-constraint-gate`.
