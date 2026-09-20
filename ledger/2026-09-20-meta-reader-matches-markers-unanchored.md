# The meta reader matched `PICKED UP|RESOLVED` unanchored, so `**NOT PICKED UP**` retired an entry

**Id:** 2026-09-20-meta-reader-matches-markers-unanchored
**Type:** bug
**Opened:** 2026-09-20 (work packet `h-rollup-scanner`; story `rollup-scanner-fidelity` #1)
**Status:** DONE
**Done:** 2026-09-20 (PR #706) — both readers now share `scripts/lib/collect-intake.sh`.

`scripts/lib/collect-meta.sh`'s intake loop tested `/PICKED UP|RESOLVED/` with no anchor, so it also
matched the substring inside `**NOT PICKED UP**` — the standard phrasing for an entry that is
explicitly still open — and any prose mention of either phrase.

`scripts/whats-open.sh` carried the identical bug and fixed it on 2026-09-13, where it had hidden 8
entries; the sibling in `collect-meta.sh` was left. Measured 2026-09-20 on `origin/staging`
`a55b9631`: the unanchored reader sees 27 open entries where the anchored one sees 33 — a
disagreement of 6 about the same file. None of those 6 is a `— Meta:` entry today, so the escalation
count was not wrong; the defect was latent for meta and live for the class, and it would have gone
live the first time anyone filed a `— Meta:` entry and marked it `**NOT PICKED UP**`.

Fixed by giving the marker grammar one home: `scripts/lib/collect-intake.sh`, which both scripts now
read. Pinned by `test/rollup-scanners.test.js` — a `— Meta:` entry marked `**NOT PICKED UP**` must be
counted by the digest, and no entry in the real `_intake.md` may be retired by a `**NOT …` line.

**Pointer:** `scripts/lib/collect-intake.sh` (the grammar); `scripts/lib/collect-meta.sh` (the loop that carried the copy); ADR `rollup-scanner-fidelity/0001`.
