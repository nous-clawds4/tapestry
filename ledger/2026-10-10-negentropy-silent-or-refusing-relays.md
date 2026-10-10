# A manual negentropy Start against a refusing relay still holds the sync slot for 10 minutes, and a relay that ignores NEG-OPEN is indistinguishable from a slow sync

**Id:** 2026-10-10-negentropy-silent-or-refusing-relays
**Type:** feature
**Opened:** 2026-10-10 (relay-stream-gaps #3, ADR 0003 Amendment 2 follow-up candidates)
**Status:** OPEN
**Done:** —

**What was seen.** ADR relay-stream-gaps/0003 Amendment 2 stops a *scheduled preset* sync when the relay sends a
NOTICE/CLOSED and then nothing follows for 60 s (strfry 1.1.0's `sync` only logs such messages and waits). Two cases
were left out on purpose:
- **The one-shot Start** (Negentropy Sync tab) has no stall rule. Against a relay with negentropy off, strfry waits
  until the 10-minute kill, and the slot is held for that long (scheduled presets wait for it). The operator does see
  the relay's NOTICE in the live output.
- **A relay that ignores `NEG-OPEN` without answering** prints nothing at all (Architect's live probe), so a preset
  against it costs the full 10 minutes and reads as a plain timeout.

**Fix shape.** Offer the same opt-in `stallMs` to the one-shot path (perhaps only after a relay line), and/or a short
"no reconcile line within N s of connecting" rule for presets. Both need evidence that a long silent reconcile on an
unwindowed sync isn't cut off.

**Pointer:** ADR `engineering-team/decisions/done/relay-stream-gaps/0003-negentropy-sync-presets.md` Amendment 2 and
Verified evidence 7–14; `src/api/strfry/negentropySync.js` (`runStrfrySync`, the one-shot handlers).
