# The session-start stack probe reports "concept-graph API answering" when the API is not there

**Id:** 2026-10-03-session-start-probe-false-positive
**Type:** meta
**Opened:** 2026-10-01 (dlist-items-tl planning session; first logged on branch `feat/dlist-items-tl` as a numbered row, re-minted here after the table froze)
**Status:** OPEN
**Done:** —

**What was seen.** `scripts/session-start.sh:41-48` curls `http://localhost:7778/api/concept-graph/summaries` with `-sf` and treats any 2xx as the API. On the Mac Studio, host port 7778 serves a strfry HTML page that answers 200 for any path, while the `tapestry` container maps its control panel to host port **8778** (`docker port tapestry 7778`), and the host has no `/etc/brainstorm.conf` to read a port from. The digest printed "stack present at :7778 — concept-graph API answering", and the session's first concept-graph call returned HTML. AGENTS.md § 1's discovery reads the same missing file and then the code default, so it gives the same wrong port.

**Fix shape.** Find the host port from the container mapping (`docker port tapestry 7778`, falling back to the conf file and then 7778), and check that the body parses as JSON, not only the status. The digest then names the port the session should use. `scripts/session-start.sh` is a harness-definition path, so the change owes a CHANGELOG row.

**Pointer:** `scripts/session-start.sh:41-48`; AGENTS.md § 1; the numbered row on `feat/dlist-items-tl` (to be removed there in favour of this file).
