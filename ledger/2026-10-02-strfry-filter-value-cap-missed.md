# Sessions and reviews sized strfry's filter limits from strfry.conf and the command line, and missed its 255-byte cap on each filter value

**Id:** 2026-10-02-strfry-filter-value-cap-missed
**Type:** meta
**Opened:** 2026-10-02 (Dictionary: Create New Concept from the finder, wired; its review's harness note)
**Status:** OPEN
**Done:** —

**What was seen.** Two strfry limits on scans were known and taken into account:
- the 128 KiB cap on a single command-line argument, behind the 400-value / 60,000-byte batching in
  `src/api/adoption/assistantOwners.js`;
- `maxTagValSize = 1024` in `strfry.conf`.

Neither is the tightest one. strfry cannot look up any single tag value longer than 255 bytes
(`MAX_INDEXED_TAG_VAL_SIZE`, `src/constants.h:5` in strfry's source, at `/usr/local/src/strfry` in the container).
A filter carrying one fails outright.

The GUM₂ change's review (R2-1) and the wired Create New Concept change's first draft both reasoned from the two
known limits. The new endpoint signed headers whose addresses the Dictionary could then not read. A fresh Reviewer
caught it by reading strfry's source. Nothing in AGENTS.md, BIBLE or OPERATIONS names the 255-byte cap.

**Fix shape:**
- Name all three limits in one place: a short strfry-limits note in BIBLE's strfry section or AGENTS.md. Say which
  one bounds what:
  - 255 bytes per filter value;
  - 1,024 bytes per single-letter tag value at import;
  - 128 KiB per command-line argument;
  - `maxEventSize` per event.
- Optionally, export the 255 as a constant (say `src/lib/strfryLimits.js`) that endpoints and readers import.

**Pointer:** OPEN.md row `2026-10-02-dictionary-read-fails-long-address` (the bug this let through).
