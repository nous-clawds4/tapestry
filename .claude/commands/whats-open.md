---
description: Roll up everything still open across the repo, from any session — derived from the tracking surfaces plus the OPEN.md ledger. Read-only.
---

You are producing a **unified "what's still open" report** across the whole repo, spanning every session — bugs, features, protocol changes, doc updates, and small cleanups alike. Read-only: do not change any file or close anything.

## Steps

1. Run the deterministic roll-up and read its output:
   ```bash
   bash scripts/whats-open.sh
   ```
   It scans: the `OPEN.md` ledger (homeless/cross-cutting items), `🔴 OPEN` handoffs, open books, intake entries with no `PICKED UP`/`RESOLVED` marker (heuristic), `protocols/worksheet.md`, open PRs, and unmerged feature branches.

2. Add the judgment the script can't:
   - **Triage the intake heuristic.** The script flags intake entries lacking a done-marker, but some are partially done or stale. Open `engineering-team/stories/_intake.md` for any that look ambiguous and say what's actually open.
   - **Cross-reference.** If an `OPEN.md` ledger row or an open book is already covered by a handoff or PR, note it once, not twice.
   - **Flag stale.** Anything whose context implies it should already be closed (e.g. a handoff whose verification window has long passed) — call it out as "review status."

3. Present a single report grouped by **type** (bug · feature · protocol · docs · cleanup · meta), each item one line with its source surface and a pointer. Lead with anything stale or surprising. Keep it scannable — this is a status read, not a plan.

## Boundaries
- **Read-only.** Do not edit `OPEN.md`, flip statuses, or close items here — surface them. Updating the ledger happens at session-end / `/close-book`, not in this report.
- Don't invent items; report only what the surfaces actually show. If a surface is empty, say so.

$ARGUMENTS
