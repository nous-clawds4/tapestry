# `/whats-open` computed open-book ages with GNU `date -d`, so no age ever printed on a Mac

**Id:** 2026-09-20-rollup-book-ages-gnu-date-only
**Type:** bug
**Opened:** 2026-09-20 (work packet `h-rollup-scanner`; story `rollup-scanner-fidelity` #1)
**Status:** DONE
**Done:** 2026-09-20 (PR #706) — `scripts/whats-open.sh` calls `date_to_epoch` from `scripts/lib/date-epoch.sh`.

`scripts/whats-open.sh`'s open-books loop guarded its age arithmetic with
`date -d "$opened" +%s >/dev/null 2>&1`. `-d` is a GNU extension; BSD/macOS `date` answers
`date: illegal option -- d` and exits non-zero, so the guard failed and `age` stayed empty. Measured
2026-09-20 on `origin/staging` `a55b9631`, macOS 25.6.0: all six open books printed with no age at all.

This is row 19's defect in its second copy. Row 19 fixed the same GNU-only call in
`scripts/lib/collect-meta.sh` on 2026-07-06 by adding `scripts/lib/date-epoch.sh`, the portable
GNU/BSD converter; the copy in `whats-open.sh` was never changed, and nothing pointed one at the
other. Three of story `rollup-scanner-fidelity` #1's six defects have that same shape — a rule
living in two files, one of them fixed — which is why ADR `rollup-scanner-fidelity/0001` gives each
of them a single home.

Pinned by `test/rollup-scanners.test.js` AC-4 ("an open book prints its opened date and a real age,
on a `date` that rejects -d") and AC-5 (an unparseable Opened date still lists the book, without
inventing an age).

**Pointer:** `scripts/whats-open.sh` (the open-books loop); `scripts/lib/date-epoch.sh`; OPEN.md row 19.
