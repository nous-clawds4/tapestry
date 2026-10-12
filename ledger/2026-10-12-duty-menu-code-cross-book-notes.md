# The assistant-duty-menu book's shipped code makes four tracking texts of book duty-menus-and-self-maps stale, and diverges from Duty Menus § 6.1 on one edge

**Id:** 2026-10-12-duty-menu-code-cross-book-notes
**Type:** docs
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #3 review, cross-book notes; auditor findings S1, CONF-3, IN-3 to IN-6, C11)
**Status:** OPEN
**Done:** —

Book `assistant-duty-menu` shipped Duty Menu code while story `duty-menus-and-self-maps` #3 was in flight:
- `b2477a93` (#1) added `src/lib/duty-menu/index.js` (`isDutyMenu`, `readMenuRows`), `src/api/assistant/dutyMenu.js`
  (`lookupPublishedMenu`) and the `/assistant/duty-menu` page.
- `6ac4aa87` (#2) added `POST /api/assistant/duty-menu/publish` (`src/api/assistant/dutyMenuPublish.js`), which signs
  and publishes the signed-in viewer's Assistant's menu.

On the wire rules story 3 added, that code agrees with the specs:
- `isDutyMenu` rejects `["z","list"]` and a `z` to any author's `concept-header` (Duty Menus § 6.1, fifth condition).
- `buildMenuTags` emits only Nous' `z` (Duty Menus § 4).

So none of the items below is a defect in either book's deliverable. They are follow-ups.

**1. Stale tracking text.** Each says, in whole or in part, that nothing is built:
- `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`:3, Status: "code NOT built".
- `protocols/drafts/duty-menus.md`:5, metadata: "Implementation (reference deployment): none … nothing publishes or
  reads menus".
- `protocols/README.md`:73, the Duty Menus row: "Nothing publishes or reads menus yet".
- `engineering-team/stories/_intake.md` § "2026-10-11 — Duty Menus and Self-Maps in code". Step 1 (Nous' constant,
  menu lookup) and the Duty Menu half of step 2 are built. The Duty Menu card in "Replaces, does not add" is no longer
  a placeholder (`engineering-team/audits/assistant-duty-menu/book.md` decisions 1–2 settle two of its prd-seed § 7
  questions).
- *Fix shape:* one dated line on the intake entry naming what `assistant-duty-menu` built, so that the later code book
  extends it rather than replacing it. What remains is self-Maps, the readers' fallback, counting, the `/treasure-map`
  fill and swap, and automatic per-key publishing. Then the handoff Status line becomes "code partly built", with
  the same pointer. Story `duty-menus-and-self-maps` #4, or that book's owner, updates `duty-menus.md`:5 and the README
  row.

**2. A relay to reconcile that the intake does not name.**
- The published menu gives the viewer's Assistant's relay as `BRAINSTORM_RELAY_URL` for all three families: `resolveOfferInputs`
  (`src/api/assistant/dutyMenu.js`:100–103) and `buildOffer` (`src/lib/duty-menu/index.js`:132–140).
- `/treasure-map` fills the same Assistant from `aTrustedAssertionRelays[0]`, `aTrustedListRelays[0]` and
  `aDListRelays[0]` (`ui/src/pages/treasure-map/editTreasureMap.js`:29, :209–215).
- Under Treasure Maps § 3 and Duty Menus § 6.2 step 5, the own-Assistant fill conforms only where the two agree.
  Treasure Maps § 9.2 (Its relay) also ties a later self-Map's relays to the menu's rows.
- *Fix shape:* the intake entry's step 2 reconcile list names `BRAINSTORM_RELAY_URL`, the published menu's rows, and
  the Lists and Concepts settings beside `BRAINSTORM_NIP85_HOME_RELAY` and `aTrustedAssertionRelays`.

- *2026-10-12, from book `duty-menu-public-relay`:* the relay in the first bullet is no longer `BRAINSTORM_RELAY_URL`
  as written. It is `instanceRelayUrl()` (`src/api/assistant/profileDefaults.js`): `BRAINSTORM_RELAY_URL` when
  public, otherwise `wss://<public domain>/relay`. On Docker deployments that is `wss://staging.brainstorm.world/relay`
  or `wss://tapestry.brainstorm.world/relay`. The reconciliation with `/treasure-map`'s Relay Settings source still
  stands.

**3. The hub's self-entry reading.**
- Ledger row `2026-10-11-self-entry-reads-as-another-assistant` (`categoryAssistants`;
  `src/api/assistant/trustedContent.js`:68–69) waits on "when the self-maps rule reaches code".
- The intake entry does not point back at it.
- *Fix shape:* name that row in the intake entry's step 4 (Readers) or its Related bullet.
- Related naming gap: the shipped code calls the instance-run per-customer key the viewer's "own assistant", while
  Duty Menus § 2 now defines "the observer's own Assistant" as a key the observer itself runs. The later code book should
  not conflate them when it implements § 7's fill exception.

**4. One edge divergence.**
- `CONCEPT_HEADER_Z` (`src/lib/duty-menu/index.js`:29) is case-insensitive (`/i`). So the code rejects a menu that
  carries a `z` naming an uppercase-hex `concept-header` address.
- Duty Menus § 6.1 names "the address of a kind-`39998` event", and NIP-01 pubkeys are lowercase hex. So by the spec,
  such a `z` names no event, and the event is still a menu.
- *Fix shape:* drop the `/i`, or have the spec say that any case variant counts. This is only reachable through a
  malformed tag.

**Pointer:** `engineering-team/reviews/duty-menus-and-self-maps/3-self-maps.md` § Findings, non-blocking 17; book
`assistant-duty-menu`; ledger rows `2026-10-11-self-entry-reads-as-another-assistant` and
`2026-10-10-external-assistant-relay-left-empty`.
