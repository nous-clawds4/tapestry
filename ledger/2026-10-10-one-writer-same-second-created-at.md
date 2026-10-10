# The one writer of an Assistant's profile can lose a second publish made in the same second

**Id:** 2026-10-10-one-writer-same-second-created-at
**Type:** bug
**Opened:** 2026-10-10 (book `assistant-profile-checklist` close; review 2 round 3, R3-3)
**Status:** OPEN
**Done:** —

`POST /api/assistant/publish-profile` (`src/api/assistant/index.js:264`) signs the kind 0 with
`created_at = floor(now / 1000)` and no `max(now, previous + 1)`. Two publishes in the same second get the same
`created_at`, and strfry keeps the replaceable event with the lowest id, so the later one can be dropped on this
instance's relay. `src/api/concept/bDisposition.js:140-144` records this tie-break and skews for it; the relay-list publish uses
`max(now, newest + 1)`. Whether `strfry import` then reports an error, and whether the writer would notice, was not
checked (no stack in the reviewing session).

Reaching it from the checklist or the editor needs two full round-trips inside one second, and the re-check would show
the item still unfinished, so it is unlikely in practice. **Fix shape:** read the newest local kind 0's `created_at` and
sign with `max(now, newest + 1)`, as the relay-list publish does.

**Pointer:** `engineering-team/reviews/done/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md`
round 3, R3-3.
