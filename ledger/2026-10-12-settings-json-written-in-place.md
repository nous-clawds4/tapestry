# The instance settings file is rewritten in place, so a crash mid-write would lose every override

**Id:** 2026-10-12-settings-json-written-in-place
**Type:** bug
**Opened:** 2026-10-12 (`assistant-duties-settings` #1, ADR `assistant-duties-settings/0001` § Consequences)
**Status:** OPEN
**Done:** —

`saveOverrides` (`src/config/settings.js`) writes `settings.json` with one `fs.writeFileSync` over the old file. A crash,
a full disk or a container kill during that write can leave a truncated file. `loadOverrides` then fails to parse it,
logs a warning and answers `{}`, so every override is silently gone: relays, the admin list, NIP-05 names, and since
`assistant-duties-settings` #1 the Assistant Duties list (the instance would offer the six defaults again).

This predates that story; the ADR left it out of scope rather than widen the story.

**Fix shape:** write to `settings.json.tmp` in the same directory, `fsync`, then `rename` over `settings.json` (atomic on
the same filesystem). Optionally keep the previous file as `settings.json.bak`. A test can kill nothing, but can pin
that a failed write leaves the old file readable.

**Pointer:** `src/config/settings.js` `saveOverrides`; ADR `assistant-duties-settings/0001` § Consequences.
