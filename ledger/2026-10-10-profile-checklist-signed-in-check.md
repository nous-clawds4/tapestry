# The profile checklist has not been used signed in on any live instance

**Id:** 2026-10-10-profile-checklist-signed-in-check
**Type:** cleanup
**Opened:** 2026-10-10 (book `assistant-profile-checklist` close)
**Status:** OPEN
**Done:** —

Book `assistant-profile-checklist` is on `staging.brainstorm.world` (deploy run 547, `1229c154`) and on
`tapestry.brainstorm.world` (PR #829, merge `cfcd83c4`, deploy run 140). Its anonymous surfaces were checked on both at
the close: `/assistant/profile` answers 200, anonymous `GET /api/assistant/my-picture` answers 401 `not-signed-in`,
anonymous attention answers `{"success":true,"signedIn":false}`, and the bundles carry the round-3 guard. The signed-in
flow has not been seen anywhere, because no session had a browser with a nostr signer. Every browser test mocks the API.

To check, signed in as someone with an Assistant there (an Admin or a Customer as well as the Owner, if possible):
1. `/assistant/profile` shows seven panels; the background image reads "Coming soon"; the others read Done or Needs
   attention with a line that matches the Assistant's real profile.
2. Press one fix, for example **Set website to {url}**. The panel shows the local save and one line per relay, and the
   panel turns Done. Only the website changed in the Assistant's kind 0.
3. **Make my personalized avatar** shows the person's own picture with the Tapestry mark; **Publish this avatar**
   publishes it, and the avatar panel turns Done.
4. When every counted item is Done, the hub card on `/assistant` reads Done and the pill drops by one.

Close this row with the date and what was seen on each instance.

**Pointer:** `engineering-team/audits/assistant-profile-checklist/audit.md` § 5 and § 6 #1.
