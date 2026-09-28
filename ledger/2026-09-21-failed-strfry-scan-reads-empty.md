# A failed `strfry scan` reads as "no events" in two shared readers, so a broken local relay looks empty rather than unreadable

**Id:** 2026-09-21-failed-strfry-scan-reads-empty
**Type:** bug
**Opened:** 2026-09-21 (setup-status-and-alert #1 review, ADR 0001 follow-up a)
**Status:** OPEN
**Done:** —

Two readers settle on `close` whatever strfry's exit code:
- `scanLocal` (`src/api/dlist-curation/index.js:134–157`) resolves with whatever it parsed;
- `/api/strfry/scan` (`src/api/strfry/queries/scan.js:129`) answers `success: true`.

So a scan that exits non-zero, for example with the LMDB locked or the binary broken, reads as
"none here". `fetchCurrentMap` (`src/api/export/nip85/currentMap.js`) takes its local answer from
`scanLocal`. A failed scan there makes it look outside for a Map the local relay may well hold, and
then read "none" as "no Map" (see row 314 for why the outside read cannot tell either). So Map
regeneration can run blind.

**A third reader (added 2026-09-27, tagging-edges #2 Planning):** `GET /api/strfry/scan/stream`
(`src/api/strfry/queries/scanStream.js:24-44`) pipes strfry's stdout into a 200 response and ends it
whatever the exit code, so a scan that dies midway reads as a shorter, complete-looking answer. Anyone
measuring through it (the tagging-edges census did) must pair it with `GET /api/strfry/scan/count`.

**`scanLocalStrict` has two flaws of its own (added 2026-09-27, tagging-edges #2 Architecture):** it decodes each
stdout chunk separately (`out += chunk`, `src/api/setup/status.js:80`), so a multi-byte character split across two
chunks becomes U+FFFD while the line still parses; and it drops lines it cannot parse (:91, pinned by X1 in
`test/setup-status.test.js`). ADR `tagging-edges/0002` therefore adds a separate strict reader,
`src/lib/strfryScanStrict.js`, which the readers here can converge onto once it lands.

`src/api/setup/status.js` (ADR setup-status-and-alert/0001) does not share the flaw: its
`scanLocalStrict` rejects on a spawn error, a non-zero exit or a timeout, and a fake-`strfry` suite
pins that (`test/setup-status.test.js` X1–X4).

**Fix shape:** have both readers treat a non-zero exit as an error, reject or answer
`success: false`, and check each caller's error path. It may be enough to share
`scanLocalStrict`.

**Pointer:** `engineering-team/decisions/done/setup-status-and-alert/0001-one-setup-status-answer.md`
§ Consequences; `engineering-team/reviews/done/setup-status-and-alert/1-setup-shows-where-you-stand.md`
§ Non-blocking 8a.
