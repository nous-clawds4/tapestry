# The shared config reader logs the value of every variable it reads, credentials included

**Id:** 2026-09-27-config-reader-logs-values
**Type:** security
**Opened:** 2026-09-27 (tagging-edges #2 Architecture, ADR `tagging-edges/0002` § Consequences, candidate row 1)
**Status:** OPEN
**Done:** —

`getConfigFromFile` (`src/utils/config.js`) writes a log line with the value it found for each variable it reads,
so any credential read through it reaches process output and whatever log captures that output. The shared Neo4j
helper reads its connection settings through it (`src/lib/neo4j-driver.js:29-41`). ADR `tagging-edges/0002` keeps
the new gap-filling pass off this path (it builds its own driver from the environment), but the control panel and
other callers still use it.

**Fix shape.** Log variable names and whether a value was found, never the value; or redact known secret names.
Pointer-level here by the house rule; anything sharper belongs in the private advisory SECURITY.md describes.

**Pointer:** `src/utils/config.js` (`getConfigFromFile`); `src/lib/neo4j-driver.js:29-41`; ADR
`engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md` § Consequences.
