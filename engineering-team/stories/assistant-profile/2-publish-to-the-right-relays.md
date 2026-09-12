# Story 2: Publish the assistant's profile to the right relays, and say what happened

**Status:** Approved
**Created:** 2026-09-11
**Type:** Bug
**Epic:** `assistant-profile`
**Book:** `engineering-team/audits/assistant-profile/book.md`

## Background

When a user publishes their assistant's profile, the server writes it to the local relay and then to
five external relays named in code — relay.primal.net, relay.damus.io, nos.lol, wot.grapevine.network
and purplepag.es (`src/api/assistant/index.js:26-32`). That list:

- **is not the instance's relay configuration.** An operator who changes relays in Settings → Relays
  changes where the dashboard *looks* for the profile (the profile relays: purplepag.es,
  profiles.nostr1.com) but not where it is *published*. Only purplepag.es is on both lists;
  profiles.nostr1.com is read from but never written to.
- **ignores local-only publish mode** (`BRAINSTORM_PUBLISH_LOCAL_ONLY`), which other publish paths
  honor.
- **reports success regardless.** The response says `success: true` even when none of the five
  relays accepts, and its message counts successes without naming failures. It also tells Customers
  that "Tapestry Assistant profile" was published, whichever assistant it was.

A read-only probe on 2026-09-11 found staging's and prod's TA profiles on nos.lol, purplepag.es,
profiles.nostr1.com and wot.grapevine.network (plus their own relay); purplepag.es holds neither
instance's customer-assistant profile; relay.damus.io and relay.primal.net were inconclusive from the
probing host.

`honest-publish-reporting` #1 fixes the browser-side publish primitive and explicitly leaves the
server-side publish paths out of scope. This story is the server-side counterpart for assistant
profiles, not a duplicate.

## User-facing description

As a signed-in user publishing my assistant's profile, I want it sent to the relays my instance is
configured to use — the same ones Tapestry checks — and to be told, relay by relay, whether each one
took it, so that my assistant can be found where it should be and I know when it can't.

## Acceptance criteria

- [ ] Given the instance's relay settings, when an assistant profile is published, then it is sent to
      the local relay and to exactly the relays in the configured general-purpose, profile and WoT
      relay lists; changing those lists in relay settings changes where the next publish goes, with no
      code change.
- [ ] Given the relays that story 1's setup check consults, then every one of them is in the publish
      set — a profile this instance publishes is always findable by this instance's own check.
- [ ] Given the instance is in local-only publish mode, when a profile is published, then it goes to
      the local relay only, and the result says it was kept local by configuration.
- [ ] Given a publish, then the user sees one line per relay — accepted, rejected (with the relay's own
      reason), or unreachable / timed out — and the summary names the right assistant and never counts
      a relay as reached unless it accepted the event; if the local write fails, nothing is sent
      outward and the user is told so.
- [ ] Given one or more relays are slow, down, or presenting an invalid certificate, then the publish
      to the others still completes and the user gets the result within a bounded time.

## Concepts touched

- `39998:<TA>:nostr-relay` — Nostr relays, including its relay sets (e.g. `general-purpose-relays`).
  Whether the publish set is read from the relay settings (`aRelays`) or from these concept sets is an
  Architecture question; the settings are what the UI and the dashboard check read today.

## Out of scope

- Publishing a kind 10002 relay list for assistants (epic, Deferred).
- Which relays belong in the default lists, and replacing dead or broken ones (relay.nostr.band times
  out; wot.brainstorm.social serves an expired certificate) → OPEN.md #270.
- The browser-side publish primitive (`honest-publish-reporting`).
- Retrying failed relays later.

## Open questions

None. Resolved at approval (2026-09-11): the publish categories are general-purpose + profile + WoT.
With today's settings that is relay.damus.io, relay.primal.net, nos.lol, purplepag.es,
profiles.nostr1.com and wot.grapevine.network — the current five plus profiles.nostr1.com. The list of
sibling Tapestry instance relays (tapestry, staging, tags) is deliberately left out.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
