# `**DONE**` and `**REASSIGNED**` were used in `_intake.md` and read by nothing

**Id:** 2026-09-20-intake-markers-done-and-reassigned-unread
**Type:** bug
**Opened:** 2026-09-20 (work packet `h-rollup-scanner`; story `rollup-scanner-fidelity` #1)
**Status:** DONE
**Done:** 2026-09-20 (PR #706) — both markers retire an entry, and `0-intake.md` says so.

`engineering-team/stories/_intake.md` had grown eight marker spellings; the two readers knew two of
them. `**DONE** 2026-07-17 …` (`_intake.md:1564`) and `**REASSIGNED (2026-08-27)** …` (`:2207`) both
mean the entry is finished, and neither retired it.

Latent rather than live on 2026-09-20: a later session had backfilled a `**RESOLVED**` line above
each, so both entries read as retired today by coincidence of the repair rather than by the rule. A
future entry marked only `**DONE**` would have shown as open forever.

The vocabulary is now written down once, in `scripts/lib/collect-intake.sh`'s header, and
`workflows/0-intake.md` names all four retiring markers. Pinned by the 13-case marker table in
`test/rollup-scanners.test.js`, which includes both spellings as they actually appear.

**Pointer:** `scripts/lib/collect-intake.sh` (the grammar table); `engineering-team/workflows/0-intake.md` step 1; `_intake.md:1564` and `:2207`.
