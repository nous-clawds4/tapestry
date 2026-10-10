# The picture fetch and the NIP-05 lookup stop their timer before reading the body

**Id:** 2026-10-10-abort-timer-cleared-before-body-read
**Type:** bug
**Opened:** 2026-10-10 (book `assistant-profile-checklist` close; review 1 of stories 1 and 3)
**Status:** OPEN
**Done:** —

Two outbound fetches clear their abort timer as soon as headers arrive, so the body read that follows has no time limit:

- **`src/api/assistant/avatar.js`, `handleMyPicture`.** The 5 s abort is cleared in the `finally` around the hop loop,
  before `readBounded` reads the body. An upstream that answers with an allowed image type and then trickles its body
  can hold the request open, with up to 5 MB buffered. This dates from ta-avatar/0003, when only the Owner could reach
  it; since `assistant-profile-checklist` #3 every provisioned Admin and Customer can.
- **`src/api/nip05.js:148-150`.** The 5 s abort is cleared before `resp.json()`. The profile check uses it once per page
  load for this instance's own domain, so the exposure is small.

**Fix shape:** keep the abort armed until the body is read (clear it after `readBounded` / `resp.json()` returns).

Hygiene in the same area, from the same review (defense in depth, no exploit path known):
- `bin/control-panel.js:159` says "Only the owner-gated upload writes here"; every provisioned Admin and Customer can now.
- `/generated` is served without `X-Content-Type-Options: nosniff`, while any of them can store up to 2 MB of bytes that
  start with the PNG signature.
- `src/utils/ssrfGuard.js`'s header accepts the DNS-rebinding window partly because guarded callers never return the
  body; `my-picture` does. https with certificate validation still closes the practical path. Say so in the header.

**Pointer:** `engineering-team/reviews/done/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md`
round 1 non-blocking 1–4; `…/1-the-profile-check-and-the-hubs-done-mark.md` non-blocking 1.
