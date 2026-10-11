# The 10040 template names wss://nip85.brainstorm.world for every 30382 row, but nothing copies Scores there by default

**Id:** 2026-10-11-nip85-home-relay-without-copy
**Type:** bug
**Opened:** 2026-10-11 (book `assistant-duty-menu`, ADR `assistant-duty-menu/0001` Consequences)
**Status:** OPEN
**Done:** —

**What happens.** `create-unsigned-kind10040.js:45,79` writes `BRAINSTORM_NIP85_HOME_RELAY` as element 3 of each
`30382:*` row in a person's Treasure Map template. Every Docker deployment sets it to `wss://nip85.brainstorm.world`
(`config/brainstorm.conf.template:49`), and so does `bin/install.js:536`.

**Why that relay can be empty.** Kind `30382` events are written only to this instance's strfry
(`strfry import`, in `src/algos/nip85/publish_kind30382.js` and `src/algos/customers/nip85/publish_kind30382.js`).
They reach `nip85.brainstorm.world` only through the `trustedAssertions` relay-router preset, which is
`defaultEnabled: false` (`setup/router-presets.json`).

**The effect.** On an instance where the operator hasn't turned that preset on, a person's Map points readers at a
relay that holds none of their Scores.

**Where it shows.** The Duty Menu (assistant-duty-menu #1, ADR 0001, relay rule R1) names this instance's own relay
for `30382`, so a person's Map and their Assistant's menu can disagree on that relay. The menu is the true one.

**Fix shape.** Reconcile the two, so the template names a relay that holds the insights. For example:
- default `BRAINSTORM_NIP85_HOME_RELAY` to `BRAINSTORM_RELAY_URL`;
- or write the NIP-85 relay only while the preset is enabled;
- or enable the preset wherever the NIP-85 relay is named.

The design handoff calls this "reconcile first" (`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md` § 8, engineering
step 2).

**Pointer:** `engineering-team/decisions/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md` § Context
and § Consequences.
