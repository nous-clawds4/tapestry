# Open Items Ledger

The single home for **small or cross-cutting open items that have no other surface** — one-off cleanups, "should we update BIBLE?" decisions, follow-ups too small for a handoff doc, anything that would otherwise be remembered only by the session that noticed it.

**This is NOT the whole backlog.** Big, triaged work lives in its proper surface, and those are *derived* into one view by [`scripts/whats-open.sh`](scripts/whats-open.sh) / the `/whats-open` command:

| Kind of open work | Lives in |
|---|---|
| Triaged-but-unbuilt features / bugs / refactors | [`engineering-team/stories/_intake.md`](engineering-team/stories/_intake.md) |
| Session-to-session "I left this open" notes | `docs/*HANDOFF*.md` (`**Status:** 🔴 OPEN`) |
| Per-book deferred scope | `engineering-team/audits/<slug>/audit.md` §6 + `prd-seed.md` §7 |
| Open protocol problems | [`protocols/worksheet.md`](protocols/worksheet.md) |
| In-flight code | open PRs / unmerged branches (git) |
| **Small / cross-cutting / homeless items** | **this file** |

Run **`/whats-open`** (or `bash scripts/whats-open.sh`) for the unified roll-up across all of the above plus this ledger.

## How to use this ledger
- Add a row when you finish a session with a small loose end that has no other home. Keep it one line; link to detail if it has any.
- Flip **Status** to `DONE` (don't delete) when handled — the closed rows are the audit trail.
- **Type:** `bug` · `feature` · `protocol` · `docs` · `cleanup` · `meta`.
- **Opened / Done:** ISO date + the session/book/PR that raised or resolved it.

## Items

| # | Type | Item | Opened | Status | Done | Pointer |
|---|---|---|---|---|---|---|
| 1 | cleanup | Review/flip the stale handoff status: `docs/POST_TIMEOUT_FIX_COMPLETION_HANDOFF_2026-05-26.md` is still `🔴 OPEN`, but its "24–48h passive-verification window" (late May 2026) is long past — confirm the verification held and flip to `✅ ADDRESSED`, or capture whatever remains. | 2026-06-14 | OPEN | — | the handoff doc |
| 2 | cleanup | Delete the merged branches `feat/reputation-info-popup` and `chore/clarify-gate5-status-flip`. | 2026-06-14 (reputation-info-popup) | DONE | 2026-06-14 | branches deleted; remotes were auto-deleted on merge |
| 3 | docs | Decide whether BIBLE needs a `reputation-info-popup` entry. | 2026-06-14 (reputation-info-popup) | DONE | 2026-06-14 | No — it's a UI explainer, not architecture / protocol / data-model / API; out of BIBLE's scope. Recorded here so the judgment isn't lost. |
