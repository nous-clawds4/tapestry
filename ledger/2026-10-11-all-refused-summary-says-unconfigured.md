# When every relay is refused by the address guard, a publish says no relays are configured

**Id:** 2026-10-11-all-refused-summary-says-unconfigured
**Type:** bug
**Opened:** 2026-10-11 (assistant-duty-menu #2 review, NB1)
**Status:** OPEN
**Done:** —

**What happens.** `summarizePublish` (`src/api/assistant/profilePublish.js:234-238`) words "nothing was attempted"
as "…saved on this instance's relay only: no general-purpose, profile or WoT relays are configured." The Duty Menu
publish (`src/api/assistant/dutyMenuPublish.js:175`) and the Outbox Relays publish (`relayListPublish.js`) both reach
that branch when relays *were* named but the DNS guard refused every one. The sentence is then false. The report rows
show each refusal correctly; only the summary is wrong.

**Fix shape.** Give "every named relay was refused" its own sentence, for example "…saved on this instance's relay. No
other relay named for it is on the public internet, so it was not sent anywhere else." This needs an ADR amendment
and test re-aims for both routes; W11 (`test/assistant-duty-menu-publish.test.js:587-589`) pins today's behavior on
purpose.

**Pointer:** `engineering-team/reviews/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.md` (NB1).
