# A preset's catch-up result disappears from the Negentropy Sync tab at the next quiet run

**Id:** 2026-10-10-presets-keep-last-productive-run
**Type:** feature
**Opened:** 2026-10-10 (relay-stream-gaps #3, staging AC-5 check)
**Status:** OPEN
**Done:** —

**What was seen.** Each preset keeps only its latest run (`lastRun`, ADR relay-stream-gaps/0003). On staging the
`dcosl headers` preset (`wss://dcosl.brainstorm.world`, down, kind 39998) ran on a 10-minute test interval. The first
run (2026-10-10 01:32:58 UTC, 7-day window) brought in the 3 concept headers staging lacked. The second run, ten
minutes later, found nothing new and replaced it, so the tab read `✓ 0 in, 0 out` and the operator couldn't see that
the catch-up had worked. The Scheduled Tasks history doesn't help either: it carries no per-preset counts (and
shows every script task as a success, OPEN.md row `2026-10-09-task-history-misses-script-failures`).

**Why it matters.** At the suggested 6-hour cadence most runs bring in nothing, so the one run that closed a gap is
visible for at most one interval. The operator then can't tell "nothing was missing" from "the catch-up worked".

**Fix shape.** Keep, next to `lastRun`, the last run that brought anything in or sent anything out (e.g.
`lastProductiveRun { startedAt, added, sent }`), and show it on the preset's row ("last brought in 3 on <date>").
Alternatively keep a short per-preset history (last N runs). Either is a small change to `negentropyPresets.js`'s
record step and the tab's last-run line; through the per-story cycle (ADR amendment + tests).

**Pointer:** `src/api/strfry/negentropyPresets.js` (record step); `ui/src/pages/settings/RelaySettings.jsx` (preset
row); story `engineering-team/stories/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md` AC-4.
