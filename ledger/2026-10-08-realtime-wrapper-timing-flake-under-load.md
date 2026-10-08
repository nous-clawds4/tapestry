# tagging-edges-realtime-wrapper fails wall-clock timing checks when two gates share the machine

**Id:** 2026-10-08-realtime-wrapper-timing-flake-under-load
**Type:** meta
**Opened:** 2026-10-08 (treasure-map-edit #3 review, harness friction 3)
**Status:** OPEN
**Done:** —

`test/tagging-edges-realtime-wrapper.test.js` has failed twice, each time while another gate or the browser specs ran
on the same machine, and each time in a different wall-clock timing check. Neither diff touched wrapper code.

- **2026-09-30:** RW15 failed on the base run of my-assistants #1's review, with "the first wrapper's process group
  still had members 3 s after it was SIGKILLed". Two gate containers ran at once on one Docker VM. That review said a
  row was warranted if it recurred.
- **2026-10-08:** RW7 failed in `20261008T022115Z-4735-50c7 [tme3-review-load]`. The second start came 0.64 s after
  the first, against a floor of 0.8 s. That gate ran while the treasure-map-edit browser specs repeated three times.
  The same commit's unloaded gate, `20261008T021451Z-5442-8438`, passed 22/0/0.

The CI workflow's comment claims a zero-flake record with no retries. That holds on an idle runner, but a reviewer who
runs a load gate on purpose sees a red suite that isn't theirs.

**Fix shape.** Either widen RW7's and RW15's windows to allow for scheduler delay (with a recorded reason), or mark the
wall-clock checks as load-sensitive in the suite's header, so a review's load run can tell them apart from real
failures. Never skip them.

**Pointer:** `engineering-team/reviews/treasure-map-edit/3-edit-mode-assign-and-preview.md` § Quality gates and
§ Harness friction 3; `engineering-team/reviews/done/my-assistants/1-the-my-assistants-page.md` § Harness friction 2.
