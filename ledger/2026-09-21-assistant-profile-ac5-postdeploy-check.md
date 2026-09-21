# Assistant-profile #5's AC5 ("no existing published profile changes") still needs its after-deploy check

**Id:** 2026-09-21-assistant-profile-ac5-postdeploy-check
**Type:** cleanup
**Opened:** 2026-09-21 (assistant-profile #5 review, non-blocking 5)
**Status:** DONE
**Done:** 2026-09-21 (after #733 and #734 on staging and their promotion by #735) — AC5 holds on both instances:
every assistant profile is the same event after each deploy as before it. Results below.

AC5 holds by construction: the story adds no migration and no republish, and nothing publishes on load. The
test plan adds a passive before/after check against the live relays. Only its first half could run before the
deploy.

**Step 1 — done, read-only, before the staging merge (the review, 2026-09-21).** The staging TA's newest kind 0 on
its instance relay (`nak req -k 0 -a ‹staging TA› wss://staging.brainstorm.world/relay`):

- `id` `1c20ca9519743bc0934964da8ba2ab5c1218f8312d30621d4b5f61abc99ab5dd`;
- `created_at` `1783819533` (2026-07-12T01:25:33Z): name "Tapestry Assistant", no tags.

**Steps 2 and 3 — as planned, read-only, no session.**

1. After the staging deploy, run the same query. It must return the same event.
2. Query one customer assistant on staging, before and after if you can.
3. After promotion, do the same for production's TA (`wss://tapestry.brainstorm.world/relay`).

Resolve each TA pubkey at runtime (`GET /api/assistant/pubkey` on that instance); never hardcode it. Close this
row with the results.

**Results (2026-09-21).** Every assistant came from `GET /api/assistant/roster` on its instance, and each query
read the newest kind 0 on that instance's own relay.

- **Step 2 — staging, after the #733 deploy (run 35653798692) and again after #734's (run 35657939163).**
  - The TA's newest kind 0 is still `1c20ca95…` (`created_at` `1783819533`).
  - The five customer assistants have no kind 0, before and after, so the customer check has nothing to compare
    on staging.
- **Step 3 — production.** The baseline was taken before #735 merged and re-taken after its deploy
  (run 35659924584). The two snapshots are identical:
  - TA `919ba08a…`: `267ecd8c31dd3cf3713fc4410937b6f27de66b5bf513525f87272479f24abd89`, `created_at`
    `1784336429` (2026-07-18T01:00:29Z), no tags;
  - customer assistant `f54325f4…`: `d9abf7fd…` (`1776040442`);
  - customer assistant `29833f45…`: `48e9d331…` (`1776405663`);
  - `81d62adb…` and `cd6829d4…`: no kind 0.

**Pointer:** `engineering-team/reviews/done/assistant-profile/5-one-writer-for-assistant-profiles.md`, § "Things tests
can't catch" (the baseline) and non-blocking finding 5; the test plan's "Passive post-deploy check".
