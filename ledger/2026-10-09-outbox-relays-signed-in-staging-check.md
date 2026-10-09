# The Outbox Relays publish has not been exercised signed in on any live instance

**Id:** 2026-10-09-outbox-relays-signed-in-staging-check
**Type:** cleanup
**Opened:** 2026-10-09 (book `assistant-outbox-relays` close)
**Status:** OPEN
**Done:** —

Book `assistant-outbox-relays` is deployed to `staging.brainstorm.world` (deploy run 541, commit `79f17935`). Its anonymous
surfaces were checked there at the close: `/assistant/outbox-relays` answers 200, anonymous `GET /api/assistant/attention`
answers `{"success":true,"signedIn":false}`, and an anonymous `POST /api/assistant/outbox-relays/publish` answers 401. The
signed-in flow has not been seen on any live instance, because no session had a browser with a nostr signer. Every
browser test mocks the API, and the route's live test skips without a stack.

To check, signed in on staging as someone with an Assistant there:
1. `/assistant` shows Outbox Relays as the third persona card, marked "Needs attention", and the pill counts it.
2. On `/assistant/outbox-relays`, add one suggested relay and press "Have your Assistant publish". The report shows the
   local save and one line per relay.
3. The card turns "Done", the pill drops by one, and the Assistant's kind 10002 is on this instance's relay with the
   relay marked `write`.
4. Typing `ws://192.168.1.20` is refused with "That relay is not on the public internet."

Close this row with the date and what was seen; repeat on production after the promotion.

**Pointer:** `engineering-team/audits/assistant-outbox-relays/audit.md` § 5 and § 6 #3.
