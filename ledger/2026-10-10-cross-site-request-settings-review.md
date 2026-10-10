# Review the control panel's cross-origin and session-cookie settings

**Id:** 2026-10-10-cross-site-request-settings-review
**Type:** bug
**Opened:** 2026-10-10 (found while sizing story 8 of `security-auth-exposure`, book `admin-action-owner-check`)
**Status:** OPEN
**Done:** —

While sizing the admin-action sweep, the coordinator looked at how the control panel answers requests from other sites
and how its session cookie is set. The settings deserve a review of their own. The owner decided (2026-10-10) to plan it
as its own story once the sweep ships, not to fold it into story 8. The details are in the sweep's private notes and are
written up when the story is planned (book `admin-action-owner-check` ground rule 1 applies until then).

**Pointer:** book `admin-action-owner-check`; story 8 of `security-auth-exposure`.
