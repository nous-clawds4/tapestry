# Story 1: The instance's public relay address

**Status:** Approved
**Created:** 2026-10-12
**Type:** Bug
**Epic:** `duty-menu-public-relay`
**Book:** `engineering-team/audits/duty-menu-public-relay/book.md`
**Strictness:** Light (trial), Bug lane: Implementer, then Reviewer; the human gate is Gate B.

## Background

The owner published their Assistant's Duty Menu on staging as `straycat`. The menu had only Concepts (`39998`,
`39999`, at `wss://dcosl.brainstorm.world`), with no Scores and no Lists.

**The cause.**
- ADR assistant-duty-menu/0001 sub-decision 2 takes "this instance's own relay at its public address" from
  `BRAINSTORM_RELAY_URL`, when that URL's host is public.
- Docker deployments set it to the internal address: `docker-compose.yml:82` `RELAY_URL=ws://tapestry:80/relay`,
  rendered as `BRAINSTORM_RELAY_URL` by `config/brainstorm.conf.template:66`.
- `tapestry` is not a public host, so the offer finds no own relay. Scores and Lists then get no row, and Concepts take
  the DList fallback.
- The Outbox Relays page's first suggestion, "this instance's own relay" (`outboxRelays.js` `outboxSuggestions`), uses
  the same rule and has never appeared on a Docker deployment.

The public address is known. `describeInstance()` (`src/api/assistant/profileDefaults.js`) already derives the
instance's public domain from `STRFRY_DOMAIN`: `DOMAIN_NAME`, e.g. `staging.brainstorm.world`. Nginx serves the relay
publicly at `/relay` (`docker/nginx.conf:51-58`).

## User-facing description

As someone with a Tapestry Assistant on a Docker-deployed instance, I want my Assistant's Duty Menu to offer Scores and
Lists at this instance's public relay, so that the menu tells other clients everything my Assistant publishes.

## Acceptance criteria

- [ ] **AC-1: the public address on Docker.** Given `BRAINSTORM_RELAY_URL` = `ws://tapestry:80/relay` and
      `STRFRY_DOMAIN` = `staging.example.org`, this instance's public relay is `wss://staging.example.org/relay`.
  - The Duty Menu offer names it for every Lists and Concepts row, and for the Scores row when the viewer gets Scores.
  - The Outbox Relays suggestions list it first.
- [ ] **AC-2: a public relay URL still wins.** Given `BRAINSTORM_RELAY_URL` whose host is public, that URL is the
      public relay, in its one spelling, whatever `STRFRY_DOMAIN` says. Today's behavior there is unchanged.
- [ ] **AC-3: no public address, no rows.** Given neither a public `BRAINSTORM_RELAY_URL` nor a public `STRFRY_DOMAIN`
      (`localhost`, a private name or IP, a name with no dot, or none set), there is no public relay.
  - The offer has no Scores or Lists rows, and Concepts fall back to the DList relay, as today.
  - The Outbox Relays suggestions don't include an own relay.
- [ ] **AC-4: still recognized as this instance.** The derived address is never read or sent to as an outside relay,
      in the check's lookups or the publisher's fan-out. This instance's relay is scanned and written locally, as
      today.

## Design note (Light; provisional, ratified by the Reviewer at Gate B)

- **Approach.** One helper in `src/api/assistant/profileDefaults.js`, beside `describeInstance`:
  `instanceRelayUrl(options)`. It returns `normalizeRelayUrl(BRAINSTORM_RELAY_URL)` when that host is public. Otherwise
  it returns `normalizeRelayUrl('wss://' + domain + '/relay')` when `describeInstance(options).isPublic`. Otherwise
  `null`.
  - `dutyMenu.js` `resolveOfferInputs` takes `ownRelay` from it.
  - `outboxRelays.js` `outboxSuggestions` takes its first suggestion from it.
- **The rejected alternative.** Change `RELAY_URL` in `docker-compose.yml` to the public address. The control panel
  uses `BRAINSTORM_RELAY_URL` to reach strfry *inside* the container network, and other readers depend on that. This
  fixes the meaning in one place without moving the deploy config.
- **Blast radius.**
  - The three modules above, and the Duty Menu publisher indirectly: its row relays come from the offer, and
    `outsideOnly` already drops a relay whose host is `STRFRY_DOMAIN`.
  - The Outbox Relays page's suggestions.
  - **Not changed:** the 10040 template's relay (ledger `2026-10-11-nip85-home-relay-without-copy`), `outsideOnly`, and
    every other `BRAINSTORM_RELAY_URL` reader.
- **Classification.** Design note: no irreversibility trigger fires. No wire format, auth default, schema, dependency,
  routing or cross-repo value changes; the menu's shape is unchanged and only its relay values become right. It
  supersedes ADR assistant-duty-menu/0001 sub-decision 2's source for `ownRelay`, and ADR
  assistant-outbox-relays/0002 sub-decision 1's source for the own-relay suggestion. Both ADRs keep their decisions:
  only the address they read changes.

## Edge cases (regression sentinels)

- **A port in `STRFRY_DOMAIN`** (`localhost:7777`, a dev box) is not public, so there is no public relay.
- **`BRAINSTORM_RELAY_URL` public but different from the domain** (a non-Docker install naming `wss://relay.example.org`)
  keeps its own URL (AC-2).
- **`STRFRY_DOMAIN` with a trailing dot or capitals** gives the address in its one spelling.
- **The derived relay and a configured DList relay are the same address:** one row each, as today.
- **Not covered:** whether nginx really serves `/relay` on a given install. That's deployment config, and AC-1's
  address is the one `docker/nginx.conf` serves.

## AC → handles

The Implementer adds these to the existing suites; IDs are in the next free slots.

- **AC-1** → `assistant-duty-menu-check` U-docker (the offer names `wss://<domain>/relay` for Lists, Concepts and
  Scores); `assistant-outbox-check` the suggestions-first test.
- **AC-2** → `assistant-duty-menu-check` U-public-wins; a `profileDefaults` helper unit test.
- **AC-3** → `assistant-duty-menu-check` U-no-domain (no Scores or Lists, the DList fallback); `assistant-outbox-check`
  no own suggestion; helper unit tests for `localhost:7777`, a private IP and an unset domain.
- **AC-4** → `assistant-duty-menu-check` (the derived relay is never read outside); `assistant-duty-menu-publish` (the
  derived relay is never sent to).

## Scoped gate (Gate B and J3 run this)

```
for s in assistant-duty-menu-check assistant-duty-menu-publish assistant-duty-menu-page assistant-outbox-check \
         assistant-outbox-relays-page one-default-assistant-profile recognizable-published-ta-profile my-assistant-page; do
  node -e "require('./test/'+process.argv[1]+'.test.js').run().then(r=>process.exit(r.fail?1:0))" $s || exit 1
done
```

The full `npm test` runs at book close.

## Out of scope

- The 10040 template's Scores relay (ledger `2026-10-11-nip85-home-relay-without-copy`).
- `docker-compose.yml`, and the other `BRAINSTORM_RELAY_URL` readers.
- Republishing menus automatically. The person presses again; the card shows out of date by itself.

## Deviations

- **Implementation, 2026-10-12 (small judgment calls):**
  - **Where the suggestion tests live.** `outboxSuggestions` is tested in `assistant-outbox-relays-page` (G1–G5), so
    AC-1's and AC-3's suggestion handles are G6–G8 there, not in `assistant-outbox-check`. Both suites are in the scoped
    gate.
  - **A trailing-dot `STRFRY_DOMAIN`** gives `wss://staging.example.org./relay`, `normalizeRelayUrl`'s one spelling,
    which keeps the dot. `outsideOnly` (unchanged, outside the blast radius) compares hosts as `STRFRY_DOMAIN` writes
    them, so dropping the dot would let the check read the derived relay as an outside one (AC-4). A relay *named*
    without the dot under a dotted domain isn't recognized as this instance, before or after this fix.
  - **The seam.** In `dutyMenu.js` and `outboxRelays.js` the `isPublicHost` seam, used only by the replaced line, is
    replaced by an `instanceRelayUrl` seam that reads the injected config.
  - **One handle beyond the list:** W13 checks AC-1 at the publisher (the signed rows name the derived relay).
  - **Re-aimed, minimally:** `assistant-duty-menu-check` U9, U10, U13, U14, U26, U28, U29 and U32. Their "no public
    address" configs set a private `BRAINSTORM_RELAY_URL` but kept the fixture's public `STRFRY_DOMAIN`
    (`tapestry.example`), which is the Docker shape this story fixes. Each now also sets `STRFRY_DOMAIN: 'localhost'`.
    In U13's private case and U32, this instance is then `localhost` alone, so their own-relay checks name `localhost`,
    and U32's fixture names it as the Map's own-relay entry.

## Linked artifacts

- ADR: none (Design note above; Light)
- Test plan: the edge cases and AC → handles above (Light)
- Review: (filled in after Review)
