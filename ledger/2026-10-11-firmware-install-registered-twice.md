# `POST /api/firmware/install` is registered twice, by two modules

**Id:** 2026-10-11-firmware-install-registered-twice
**Type:** cleanup
**Opened:** 2026-10-11 (book `admin-action-owner-check` close; ADR `security-auth-exposure/0005` Out of scope)
**Status:** OPEN
**Done:** —

`src/api/firmware/index.js:226` and `src/api/normalize/index.js:5532` both register
`app.post('/api/firmware/install', handleFirmwareInstall)`. Express runs the first one it reaches, so the other is dead.
Access is the same either way: the route table keys the path once (`owner`), and the router walk sees both
registrations (383 registrations, 382 distinct keys). ADR 0005 left the cleanup out of scope because it changes no
access.

Remove the registration in `normalize/index.js`. Then check the walk's count and any suite that counts registrations
or pins either line.

**Pointer:** ADR `security-auth-exposure/0005` § Out of scope; `engineering-team/audits/admin-action-owner-check/inventory.md`
§ Found on the way.
