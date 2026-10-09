# applicability-republish BK1 finds the fresh-install seeds within a fixed 1,800-character window, and only 45 are left

**Id:** 2026-10-09-bk1-seed-match-char-window
**Type:** cleanup
**Opened:** 2026-10-09 (relay-stream-gaps #3 review, non-blocking 6)
**Status:** OPEN
**Done:** —

**What was seen.** `test/applicability-republish.test.js:177` matches `freshInstallEntries` with `[\s\S]{0,1800}?`.
After relay-stream-gaps #3 added the `seed:syncNegentropyPresets` seed (written compactly to fit), the span is
about 1,755 characters. The next seed, in any form, will fail BK1 with a misleading "must define
freshInstallEntries".

**Fix shape.** Anchor the match on the function's `return [` … `];` rather than a character count.

**Pointer:** `engineering-team/reviews/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md` non-blocking 6;
`src/api/scheduled-tasks/index.js` (`freshInstallEntries`).
