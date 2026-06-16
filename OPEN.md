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
| 1 | cleanup | Review/flip the stale handoff status: `docs/POST_TIMEOUT_FIX_COMPLETION_HANDOFF_2026-05-26.md` is still `🔴 OPEN`, but its "24–48h passive-verification window" (late May 2026) is long past — confirm the verification held and flip to `✅ ADDRESSED`, or capture whatever remains. | 2026-06-14 | DONE | 2026-06-14 | Flipped to ✅ ADDRESSED: timeout series shipped (6 prod PRs), no regression in the ~2.5 wks since, residuals tracked in `_intake.md`; held branch `fix/launch-child-task-protection-audit` retained by design as the ADR 0023 audit trail. |
| 2 | cleanup | Delete the merged branches `feat/reputation-info-popup` and `chore/clarify-gate5-status-flip`. | 2026-06-14 (reputation-info-popup) | DONE | 2026-06-14 | branches deleted; remotes were auto-deleted on merge |
| 3 | docs | Decide whether BIBLE needs a `reputation-info-popup` entry. | 2026-06-14 (reputation-info-popup) | DONE | 2026-06-14 | No — it's a UI explainer, not architecture / protocol / data-model / API; out of BIBLE's scope. Recorded here so the judgment isn't lost. |
| 4 | cleanup | The `live-feed` book's **feature** is merged to `staging` (PR #296, `80a39afd`), but the **post-merge audit trail** (Stage 2–3 journal entries + `completion-report.md` + `tier4-dom-extract.txt` + `audit.md` + `prd-seed.md` + the book-close commit) lives only on the local `feat/live-feed` branch. Merge it to `staging` as a **docs-only PR**, then delete `feat/live-feed` (local + remote). | 2026-06-15 (live-feed) | DONE | 2026-06-15 | Audit trail merged to `staging` via PR #297 (`75a12622`, docs-only); `feat/live-feed` deleted (local + remote — remote was auto-deleted on the #297 merge). Engineering hygiene + deferred scope from this book live in `audits/live-feed/audit.md` §6. |
| 5 | docs | verified-reporters #4 (Report Type + Reported columns) shipped to prod (PRs #299→staging, #300→main) — decide BIBLE/doc impact. | 2026-06-16 (verified-reporters #4) | DONE | 2026-06-16 | **Yes, BIBLE warranted** (it tracks this feature family): added a changelog entry for #4. While in BIBLE, also (a) added the missing **live-feed** changelog entry (it had shipped to prod with no BIBLE line) and (b) corrected stale "On staging; prod held" notes on the verified-followers (#33/#34) and profile (#35/#36) lines — both are on `main`/prod now. Updated `engineering-team/epics/verified-reporters.md` (story #4 + ADR 0004; report-type-breakdown now *partial*). **No** protocol/AGENTS/data-model edit: `report_type`/`timestamp` pre-existed on the `REPORTS` edge (ingestion-set), NIP-56 is an external spec we consume, and BIBLE doesn't enumerate edge properties. |
