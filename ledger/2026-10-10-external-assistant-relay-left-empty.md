# Giving Scores to an external Assistant on /treasure-map leaves the rank entry's relay empty, and four readers then see no rank entry

**Id:** 2026-10-10-external-assistant-relay-left-empty
**Type:** bug
**Opened:** 2026-10-10 (advisory session on how an instance learns an external Assistant's relay; `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`)
**Status:** OPEN
**Done:** —

When a person gives the Scores card to an Assistant that isn't this instance's own, Save moves the Preferred
`30382:rank` entry to that Assistant in place with an empty relay: `["30382:rank", <external>, ""]`.
`makeRelayFor` (`ui/src/pages/treasure-map/editTreasureMap.js`) returns `''` for any Assistant but the viewer's own,
and test E1 in `test/treasure-map-edit-mode.test.js` pins the move. The code is on `staging` and on `main`.

Four readers then treat the entry as missing (`!rankTag[2]`), with no fallback:

- `ui/src/hooks/useTrustWeights.js` (trust weights from a point of view)
- `ui/src/pages/BrainstormSearch.jsx` (search's WoT status)
- `ui/src/pages/BrainstormSettings.jsx` (the settings check)
- `nip50-proxy/src/wot-pipeline.js` (the observer pipeline)

The house-POV setup (`ui/src/pages/grapevine/SearchPreferences.jsx` → `src/algos/refreshSearchIndex.sh`) also saves the
empty relay and skips its sync. So the person's own trust weights and search setup stop working after the save.

Fix shape:
- **The lasting fix** is the relay lookup in the design handoff's § 6: the external Assistant's self-Map, then its Duty
  Menu.
- **A stopgap that can ship first:** when the Map already gives that Assistant a relay in the same category, reuse it;
  otherwise warn in the save note before writing a Scores entry with no relay.

**Pointer:** `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md` § 6 and § 7.

**Note, 2026-10-11 (ADR `duty-menus-and-self-maps/0003`).** The stopgap above (reuse a relay the Map already gives that
Assistant in the same category) is now a guess that Duty Menus § 6.2 step 5 forbids to any client that fills element 3
automatically (MUST NOT). Filling this instance's own Assistant from Relay Settings conforms where Relay Settings
names the relay the Assistant really publishes those insights to: a client of the service that runs an Assistant may
read the Assistant's menu from that service's own record (Treasure Maps § 3, MAY). Today the code names two relays
for Scores (`BRAINSTORM_NIP85_HOME_RELAY` in kind 10040 creation, `aTrustedAssertionRelays[0]` in `/treasure-map`),
which the handoff's § 8 step 2 reconciles first. The lasting fix is Treasure Maps § 3 (the fill order, and the
read-time fallback for readers, whose last step is the Assistant's kind 10002 write relays) with Duty Menus § 6.2
step 5. The handoff's § 6, named above, is SUPERSEDED by them. The code is the later book's
(`engineering-team/stories/_intake.md` § "2026-10-11 — Duty Menus and Self-Maps in code").
