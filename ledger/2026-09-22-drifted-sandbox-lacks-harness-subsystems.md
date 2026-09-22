# An extremely-drifted long-lived sandbox branch lacks entire harness subsystems, not just diverged content — and nothing says how to sync a feature onto one

**Id:** 2026-09-22-drifted-sandbox-lacks-harness-subsystems
**Type:** meta
**Opened:** 2026-09-22 (llms-txt book close, retro §7)
**Status:** OPEN
**Done:** —

Syncing `llms-txt` #1 to `feature-magic-carpet` (2,834 commits behind `staging`) found that the branch has **none** of three harness systems the rest of the estate now assumes:

- **No `OPEN.md`.** Never existed on this branch's history at all (not deleted — never merged in).
- **No `test/registry.js`.** `test/test.js` is still the *original* hand-written runner this repo replaced — the honest-test-gate epic's registry-and-engine system never reached this branch.
- **No `engineering-team/stories/_intake.md`.**

This is a more extreme case of what OPEN.md row 195 already named for `feat/tags` (a sandbox's `test/test.js` *content* differs from `staging`'s, so the next sync conflicts there) — but row 195's fix shape ("take staging's test/test.js wholesale") assumes the *file exists* to be replaced. Here there is nothing to replace; the whole surrounding system is absent, and force-introducing one file (a lone `OPEN.md` row, a `test/registry.js` entry pointing at an engine — `test/helpers/gateRunner.js` — this branch doesn't have) would be actively wrong, not just incomplete.

**A related, narrower version of this same drift was already fixed once, for a different subsystem.** OPEN.md row 73 (closed 2026-09-18) documents `feat/tags` having no `deploy-safety` endpoint until a targeted backport merge fixed it permanently. `feature-magic-carpet` has the identical gap today — `GET /api/deploy-safety/status` 404s — and nothing generalized row 73's fix into "check for this on every long-lived sandbox," so it had to be rediscovered from scratch on a different branch.

**Resolved for this sync by dropping the three missing files** from the cherry-pick (operator-confirmed) and pushing without a safe-to-merge check (operator-confirmed, reasoning that a deployment this old likely predates the scheduled-task system the check protects against). Both were one-off judgment calls, not a rule anyone can reuse next time.

**Fix shape, two candidates, not mutually exclusive:**
1. **A written playbook** for "sync one feature to a long-lived sandbox branch," covering: which harness files to check for before attempting a cherry-pick (ledger, registry, intake, deploy-safety endpoint), and the default judgment when a file is absent (drop it, don't force it) versus present-but-diverged (row 195's existing guidance).
2. **A periodic drift-and-gap audit** across the named long-lived sandbox branches (`scripts/long-lived-branches.txt`) that reports, per branch: commits behind `staging`, and which of {`OPEN.md`, `test/registry.js`, `_intake.md`, `deploy-safety` endpoint} are present. Would have surfaced `feature-magic-carpet`'s gap without anyone needing to hit it mid-sync.

**Pointer:** `engineering-team/audits/llms-txt/audit.md` §4 #2/#3, §7; OPEN.md rows 73 (closed, precedent) and 195 (open, narrower sibling case); `scripts/long-lived-branches.txt`.
