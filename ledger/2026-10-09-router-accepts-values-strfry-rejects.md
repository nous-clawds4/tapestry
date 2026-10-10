# The router's save checks accept filter values strfry 1.1.0 rejects, and such a saved value can leave the router down after a rejected change

**Id:** 2026-10-09-router-accepts-values-strfry-rejects
**Type:** bug
**Opened:** 2026-10-09 (relay-stream-gaps #1 review round 2, R2-1; relay-stream-gaps #2 review, non-blocking 1)
**Status:** OPEN
**Done:** —

**What was seen.** `sanitizeStreamFilter` (`src/api/strfry/routerConfig.js`) enforces a filter's shape, not its
values (ADR relay-management/0001/0002). strfry 1.1.0's router rejects a whole config over a single bad value, and
these pass the save checks:
- `ids`/`authors` that aren't hex. `"authors":["nothex"]` → `Failed to parse router config: error parsing authors:
  unexpected character in from_hex` (ADR relay-stream-gaps/0001, Verified evidence 5).
- Negative `since`/`until`. These break the config the same way a negative `limit` does
  (`error parsing limit`, relay-stream-gaps #2 review sandbox). Story 2 now drops negative `limit` only; OPEN.md row
  31(b) understates this as "harmless".

**Why it matters now.** Since relay-stream-gaps #1, a change strfry rejects is rolled back and reported, and the
router keeps the streams it was running (ADR relay-stream-gaps/0001 Amendment 1). A bad value saved **before** a
rollback is a different case. If the previous config already holds one, the rollback's own reload is rejected, and
the fallback restart fails too, because strfry exits when its first config doesn't parse. The operator then sees "…
restarting it to put the previous streams back failed … Press Restart", and Restart can't help either: it rebuilds
the same saved config. This is no worse than before the book, when every save restarted the router onto the bad
config. But the message's advice is wrong in this one case.

**Fix shape.**
- Validate values at ingress: `ids`/`authors` 64-char lowercase hex, `since`/`until`/`limit` ≥ 0. Re-validate saved
  state the way PR #787 does for URLs and plugins, leaving an invalid stream out of the config and listing it under
  `skipped`.
- When the restart after a rejected rollback fails, say the saved streams hold a value strfry rejects and point at
  the server log, not "Press Restart".
- Fold OPEN.md row 31(b) into this row.

**Pointer:** `engineering-team/reviews/done/relay-stream-gaps/1-stream-changes-without-router-restart.md` § Round 2
(R2-1); `engineering-team/reviews/done/relay-stream-gaps/2-stream-limit-refetches-on-reconnect.md` non-blocking 1;
ADR relay-stream-gaps/0001 Amendment 1 and Verified evidence 5.
