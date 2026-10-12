# The self-Map check counts the bare-metal Score timer while its unit file exists, even when it is stopped

**Id:** 2026-10-12-stopped-timer-counts-as-upkeep
**Type:** bug
**Opened:** 2026-10-12 (book `assistant-self-map`, review of story 1, finding N6; ADR 0001 Amendment 2 item 9)
**Status:** OPEN
**Done:** —

**What happens.** `scheduleIntervals` in `src/api/assistant/selfMap.js` uses the systemd timer as its fallback
whenever `/etc/systemd/system/processAllTasks.timer` exists. The control panel can stop that timer with
`systemctl stop processAllTasks.timer` (`setup/configure-control-panel-sudo.sh:64`), and a stopped timer still has its
unit file. So on bare metal, Scores can read as live for up to two intervals after the timer stops.

**Why it's not in story 1.** ADR 0001 chose "the unit exists" on purpose, and only bare metal is affected.

**Fix shape.** Read whether the timer is active (`systemctl is-active processAllTasks.timer`, or the timer's state
file), behind the check's injectable deps, in an amendment to sub-decision 6.

**Pointer:** `engineering-team/reviews/assistant-self-map/1-the-self-map-page-and-its-check.md`, N6.
