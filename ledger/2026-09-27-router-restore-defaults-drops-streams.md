# Settings › Relays' "Restore Defaults" replaces every router stream with the presets, so on production it would silently cut tag federation

**Id:** 2026-09-27-router-restore-defaults-drops-streams
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #2 Planning, fact-gathering pass)
**Status:** OPEN
**Done:** —

**What was seen.** `POST /api/strfry/router-restore-defaults` (`handleRestoreDefaults`, `src/api/strfry/routerConfig.js:325-361`)
builds a new router state from `setup/router-presets.json` alone, saves it and applies it. Every stream that is not a
preset is dropped. The button is "↩ Restore Defaults" in Settings › Relays (`ui/src/pages/settings/RelaySettings.jsx:382-395`,
:483-486); its confirm dialog says "Custom streams will be removed", but nothing says which of them carry federation.

On production the taggings, tags and pins travel on custom `#z` streams held only in `/var/lib/brainstorm/router-state.json`
(`nostrUserTag`, `tag`, `tagPinning`, `taggingWithSpecificTag`, `nostrEventTag`, per row
`2026-09-27-revokes-do-not-travel`, read 2026-09-25). No preset carries them: the presets' only 39999 streams, `dcosl`
and `dcosl2`, are unfiltered by `z`, `limit 5`, and `defaultEnabled: false`. So one click would stop tag federation to
and from production, and the streams could be rebuilt only from memory or from that ledger row's list. Whether the
route is owner-only was not examined.

**Fix shape.** Any of: keep custom streams on restore (reset presets only); snapshot the current state before
replacing it, with a way back; make the confirm dialog list the custom streams it will drop; or move the tagging
streams into the presets (with `defaultEnabled: false`) so a restore keeps their definitions.

**Pointer:** `src/api/strfry/routerConfig.js:325-361`; `ui/src/pages/settings/RelaySettings.jsx:382-395`;
row `2026-09-27-revokes-do-not-travel` (the production stream list).
