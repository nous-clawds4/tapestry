# Two session-bound Assistant signing routes join OPEN.md row 326's cross-origin question

**Id:** 2026-10-11-assistant-signing-routes-csrf-scope
**Type:** bug (security posture)
**Opened:** 2026-10-11 (assistant-duty-menu #2 review, NB4)
**Status:** OPEN
**Done:** —

**What's affected.** `POST /api/assistant/outbox-relays/publish` and `POST /api/assistant/duty-menu/publish` have the
Assistant sign as the session's viewer, with no `Origin` check and no token. That is the same posture OPEN.md row 326
describes for the whole instance (implicit `sameSite`, and `Origin` checked per endpoint).

**Why it's limited.** Neither route takes request input that shapes the event. The relay list's draft does, through
its body; the Duty Menu takes none. So a forged request can at most republish what the instance already offers, or
the relay list a page sent.

**Fix shape.** Whatever row 326 decides (an explicit `sameSite`, or a central `Origin` check) should cover these
routes. Until then, they are listed here so row 326's fix doesn't miss them.

**Pointer:** OPEN.md row 326; `engineering-team/reviews/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.md`
(NB4).
