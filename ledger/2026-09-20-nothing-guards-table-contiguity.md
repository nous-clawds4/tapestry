# Nothing checks that `OPEN.md`'s table is still a table, and it rendered broken for 67 days

**Id:** 2026-09-20-nothing-guards-table-contiguity
**Type:** meta
**Opened:** 2026-09-20 (doc-lane review of the one-table fix, non-blocking finding; proposed by the Reviewer, filed by the caller under the row-80 sweep)
**Status:** DONE
**Done:** 2026-09-20 (PR #700) — built as `harness-lint` L16 in the same PR that made the table contiguous again.

`OPEN.md`'s Items table rendered broken on GitHub from 2026-07-15 to 2026-09-20 — 37 rows as a
table, 305 as raw pipe-text — and no check could see it. Every mechanical reader is deliberately
layout-blind: `harness-lint` L15, `scripts/lib/collect-meta.sh` and `scripts/whats-open.sh` all
filter to `^\|` lines, so a row hidden from human readers is still perfectly visible to them. The
operator found it by looking at the file.

**Freezing the table does not close this.** A note, a heading or a stray paragraph between rows
still hides every row below it, and a blockquote is worse: GFM lazy continuation swallows the
following rows *into* the quote. That had happened to 142 of the 305 rows.

**The incident argues for a check rather than a convention.** The break was not caused by anyone
adding a blank line to the table. The table-terminating blank was already there, legitimately,
separating the table from that day's merge note (`235e9e16`: row 36 at line 64, blank at 65, the
note at 66). The break appeared when `8786f131` inserted a row at line 66 — below the blank, above
the note. A rule phrased "don't put blank lines in the table" would have permitted that diff, and a
human reviewing two added lines at the end of a table would have been right to wave it through.

**Proposed fix shape:** one `harness-lint` check that every line between the `| # |` header and the
`<!-- ledger-table-frozen -->` marker starts with `|` — about three lines of awk beside L15, reusing
the scan it already performs. Message names the first offending line. The cost of not doing it is
another silent, months-long regression in the single ledger every session reads.

**Built as L16, and it differs from the sketch in two ways.** It is about twenty lines of awk, not
three; and the region ends at the table's **last row**, not at the marker, because the lines between
them are the closing prose ("The table above is closed…") and flagging those would be wrong. A row
confirms the pending non-row lines above it as being inside the table, which is what draws that
line. The message names and quotes the first offender and counts the rest. Silent where there is no
`OPEN.md` or no header, so fixture trees are unaffected.

**Pointer:** `engineering-team/reviews/harness-self-improvement/open-md-one-table-2026-09-20.md`
(rounds 1–3); commits `187df161`, `c5a92115`, `4328e0ab`; the numbering-notes section of `OPEN.md`.
