# A 10-minute task schedule on staging makes the safe-to-merge check permanently unsafe

**Id:** 2026-10-10-ten-minute-schedule-blocks-merges
**Type:** bug
**Opened:** 2026-10-10 (book `assistant-trusted-content-status`, close PR #833)
**Status:** OPEN
**Done:** —

On 2026-10-10, `staging.brainstorm.world`'s scheduler ran **Sync negentropy presets** (`syncNegentropyPresets`, from
relay-stream-gaps #3) every 10 minutes (01:52:57Z, 02:02:57Z, …). `GET /api/deploy-safety/status` answers `unsafe` with
`NEXT_FIRE_WITHIN_BUFFER` whenever the next fire is inside `bufferMs` (600000, also 10 minutes). Every moment is within 10
minutes of a fire, so `scripts/check-safe-to-merge.sh` can never see `safe` while that schedule is on. Every merge to
staging then needs the owner's recorded override. The close PR #833 (docs only) was merged that way: the owner chose to
merge just after a sync had finished, accepting that the redeploy could cut short the next one.

Fix shape, pick one:
- Exempt short, restartable tasks from the buffer (a per-task flag in the registry). A negentropy preset sync is safe to
  interrupt and runs again at the next fire.
- Measure the buffer against the task's typical duration rather than a flat 10 minutes.
- Make 10 minutes the shortest allowed interval for a task the buffer guards, and say so in the Scheduled Tasks panel.

The check itself behaved as specified (docs/SAFE_TO_MERGE.md).

**Pointer:** `engineering-team/audits/assistant-trusted-content-status/audit.md` § 7 (close PR #833); relay-stream-gaps #3's story

**Update 2026-10-10 (book `relay-stream-gaps` close).** The 10-minute interval was the setting for story 3's AC-5 check
on staging (its test plan, AC-5 step 4, suggests a short interval and step 7 says to set it back). Read at 02:42Z from
`GET /api/scheduled-tasks/list`, the staging entry is switched **off** (`enabled: false`), still at 10 minutes, last run
02:02:58Z. The block is gone while it is off; switching it on at 10 minutes brings it back. Set 6 hours before switching
it on again.
