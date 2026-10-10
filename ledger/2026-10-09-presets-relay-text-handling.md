# The presets runner passes a relay's NOTICE text into the log raw and lets it feed the event counts

**Id:** 2026-10-09-presets-relay-text-handling
**Type:** cleanup
**Opened:** 2026-10-09 (relay-stream-gaps #3 review round 2, R2-1 and R2-2)
**Status:** OPEN
**Done:** —

**What was seen.** Since ADR relay-stream-gaps/0003 Amendment 2, `relayMessageOf` (`src/api/strfry/negentropySync.js`
:262–265) JSON-decodes a relay's NOTICE/CLOSED text.
- **Log forging.** A `\n` in that text reaches the panel log raw through `src/api/strfry/negentropyPresets.js:276`,
  so a relay can forge a log line (the review probe confirmed it).
- **Inflated counts.** `parseSyncOutput` still runs its count patterns over relay lines (`:143–153`). A NOTICE that
  mimics a `DOWN:` or `Writer: added:` line inflates the counts: the probe recorded 902 for a real 2. Test plan choice 7
  says relay lines don't change the counts.
- **Startup lines as the cause.** strfry's unprefixed `Redis error: Connection refused` startup line (printed only
  when Redis is unreachable, `patches/strfry-redis/redis.cpp:11`) can become the named cause of a timeout when
  nothing later is a candidate. Accepted at review: the timeout clause still says what happened, and Redis being down
  is a real fault.

Impact is low: the owner chose the relay, the text is capped at 300 characters, and it reaches only the owner's own
log and count display.

**Fix shape.** Replace control characters in `relayMessageOf`'s result; `continue` past a line once it is recognised as
a relay line, so it never feeds the counts; optionally take no error candidates from strfry's startup lines.

**Pointer:** `engineering-team/reviews/done/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md` § Round 2 (R2-1,
R2-2).
