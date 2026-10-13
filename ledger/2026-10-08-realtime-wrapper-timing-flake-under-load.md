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
- **2026-10-09:** RW7 failed in `20261009T134224Z-32038-d116 [reviewer-outbox-relays-r2]` (a `vite build` and the
  browser specs ran beside it) and again in `20261009T141024Z-14530-8c35 [reviewer-outbox-relays-r3]`, with no
  deliberate load from that session (another session may have shared the machine). Both times the second start came
  0.72 s after the first, against the 0.8 s floor; alone the suite passed 24/0/0 six times out of six. A third time in
  that book's close gate, `20261009T165915Z-27122-2892 [book-close-assistant-outbox-relays]`, again with nothing else
  from that session running: 0.77 s.

- **2026-10-09, book `assistant-trusted-content-status`:** its implementation gate `20261009T140652Z-94503-eca0
  [atcs-impl-final]` ran beside a UI build and 185 browser tests in the same session. 18 of RW's tests failed ("node was
  never started within 5000 ms"), and wall-clock checks in four more suites overran by 30–60×
  (`honest-publish-reporting` B4, `assistant-setup-state` U12, `strfry-count-strict` SC21, `relay-scan-bounds` B3). All
  four re-run alone passed 24/0, 10/0, 28/0 and 23/0. Its merge re-review gate (`review-merge2`) ran while another
  session's gate (`hgi3-impl-baseline`) used the same :7778 stack.

The CI workflow's comment claims a zero-flake record with no retries. That holds on an idle runner, but a reviewer who
runs a load gate on purpose sees a red suite that isn't theirs.

**Fix shape.** Either widen RW7's and RW15's windows to allow for scheduler delay (with a recorded reason), or mark the
wall-clock checks as load-sensitive in the suite's header, so a review's load run can tell them apart from real
failures. Never skip them.

**2026-10-10, story `security-auth-exposure` #8 review (appended at book `admin-action-owner-check`'s close,
2026-10-11).** RW7 failed in `20261010T224631Z-30352-3e98`: the restart came 0.77 s after the first start, against the
0.8 s floor, while the Reviewer ran a CPU-heavy probe beside the gate. The clean rerun, `20261010T225218Z-2967-fdbe`,
passed. That review asked for a row because the flake "has no ledger row", and `2026-10-10-rw7-timing-flake` was filed.
It is closed as a duplicate of this one.

**Recurred 2026-10-12 (`assistant-coming-soon` #1, Gate B review, harness friction 4).** The reviewer's first full
run, `20261012T024525Z-30740-0316`, failed RW7 alone: the first restart came at 0.76 s, below the 0.8 s floor. The
suite then passed alone 24/0, three times out of three, and the full rerun `20261012T025139Z-32472-0dfa` passed
(5753/0). The story's diff touches no server code.

**Pointer:** `engineering-team/reviews/done/treasure-map-edit/3-edit-mode-assign-and-preview.md` § Quality gates and
§ Harness friction 3; `engineering-team/reviews/done/my-assistants/1-the-my-assistants-page.md` § Harness friction 2.

**Occurrence, 2026-10-12** (book `duty-menu-public-relay` close gate).
- **The failing run:** `20261012T022448Z-19090-8004`. RW7, "node exits 1": the first restart came at 0.77 s, below the
  0.8 s floor (starts at `[0, 0.77, 2.8]` s).
- **Afterwards:** the suite passed alone (24/0), and the full rerun `20261012T023059Z-20536-2e11` passed (5753/0).

**Occurrence, 2026-10-12** (review of `duty-menus-and-self-maps` #3, round 2).
- **The failing run:** `20261012T031805Z-5307-95e8 [duty-menus-3-review-r2]`, on `11cc0008`. RW7, "node exits 1": the
  first restart came at 0.77 s (starts `[0, 0.77, 2.81]` s). The Reviewer's Python model runs were on the same machine.
- **Afterwards:** the suite passed alone (24/0), and the quiet full rerun `20261012T032424Z-11118-3178` passed
  (5744/0).

**Occurrence, 2026-10-12** (`assistant-self-map` #1, round 2's Implementation).
- **The failing run:** `20261012T193441Z-10055-0a6c [self-map-round2-impl]`, on `c5d4032f+dirty`. RW7, "node exits 1"
  and "node exits 0": the first restart came at 0.77 s (starts `[0, 0.77, 2.78]` and `[0, 0.77, 2.82]` s). The diff
  touched no wrapper code.
- **Afterwards:** the suite passed alone (24/0), and the quiet full rerun `20261012T194152Z-17351-913e` passed
  (5820/0).

**Occurrences, 2026-10-12** (`assistant-self-map` #1, round 3's Test Design). RW7 failed on two full gates in a row, on
an otherwise idle machine (load average about 0.6 on 4 CPUs, no other job running):
- `20261012T203251Z-14185-1edf` and `20261012T203934Z-21396-0d34`, both on `6316cb4d+dirty`;
- the first restart came at 0.77 s both times, for "node exits 1" and for "node exits 0".

The suite passed alone (24/0). This session's tally is 3 failures in 6 full gates, every one at exactly 0.77 s, the
same reading as the 03:18 occurrence above. A constant 0.77 s looks less like load than like a systematic edge, such as
the backoff or poll clock against the 0.8 s floor, when the suite runs inside the full gate. That is worth checking
before widening the window.

**Occurrence, 2026-10-12** (`assistant-self-map` #2, Test Design).
- **The failing run:** `20261012T231707Z-29937-406a [s2-phase3-real]`, on `66e23820+dirty`. RW7, "node exits 1": the
  first restart came at 0.77 s (starts `[0, 0.77, 2.8]` s). The diff touched only test files and their fixtures, and no
  wrapper code. No other job was running during the gate.
- **Afterwards:** the suite passed alone (24/0). Again exactly 0.77 s, which supports the systematic-edge reading above.

**Occurrence, 2026-10-13** (`assistant-self-map` #2, round 2's Implementation).
- **The failing run:** `20261013T022412Z-18280-09e7 [s2-r2-impl]`, on `0d0c848e+dirty`. RW7, "node exits 1" and
  "node exits 0": the first restart came at 0.70 s (starts `[0, 0.7, 2.74]` s).
  - The first reading not at 0.77 s on this row's 2026-10-12/13 run of occurrences.
  - It came straight after a 6-minute Playwright run on the same machine.
  - The diff touched no wrapper code.
- **Afterwards:** the suite passed alone (24/0). The quiet full rerun is recorded in story 2's round 2 Implementation.

**Occurrence, 2026-10-13** (`assistant-self-map` #2, round 2's Review).
- **The failing run:** `20261013T025711Z-5781-3dae [s2-r2-review]`, on `1249d7f8`, a clean tree. RW7, "node exits 1"
  and "node exits 0": the first restart came at 0.77 s (starts `[0, 0.77, 2.77]` and `[0, 0.77, 2.81]` s). An
  independent read-only reader was running beside it. The diff touched no wrapper code.
- **Again:** the full rerun `20261013T030407Z-11978-bcf9 [s2-r2-review-rerun]`, on `1249d7f8` with the reader still
  running, failed RW7 alone at 0.73 s ("node exits 1") and 0.77 s ("node exits 0").
- **Afterwards:** the suite passed alone (24/0), and the full run on a quiet machine,
  `20261013T031322Z-11940-f663 [s2-r2-review-quiet]`, passed (5948/0).
