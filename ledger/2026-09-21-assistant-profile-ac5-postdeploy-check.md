# Assistant-profile #5's AC5 ("no existing published profile changes") still needs its after-deploy check

**Id:** 2026-09-21-assistant-profile-ac5-postdeploy-check
**Type:** cleanup
**Opened:** 2026-09-21 (assistant-profile #5 review, non-blocking 5)
**Status:** OPEN
**Done:** —

AC5 holds by construction: the story adds no migration and no republish, and nothing publishes on load. The
test plan adds a passive before/after check against the live relays. Only its first half could run before the
deploy.

**Step 1 — done, read-only, before the staging merge (the review, 2026-09-21).** The staging TA's newest kind 0 on
its instance relay (`nak req -k 0 -a ‹staging TA› wss://staging.brainstorm.world/relay`):

- `id` `1c20ca9519743bc0934964da8ba2ab5c1218f8312d30621d4b5f61abc99ab5dd`;
- `created_at` `1783819533` (2026-07-12T01:25:33Z): name "Tapestry Assistant", no tags.

**Steps 2 and 3 — to do, read-only, no session.**

1. After the staging deploy, run the same query. It must return the same event.
2. Query one customer assistant on staging, before and after if you can.
3. After promotion, do the same for production's TA (`wss://tapestry.brainstorm.world/relay`).

Resolve each TA pubkey at runtime (`GET /api/assistant/pubkey` on that instance); never hardcode it. Close this
row with the results.

**Pointer:** `engineering-team/reviews/assistant-profile/5-one-writer-for-assistant-profiles.md`, § "Things tests
can't catch" (the baseline) and non-blocking finding 5; the test plan's "Passive post-deploy check".
