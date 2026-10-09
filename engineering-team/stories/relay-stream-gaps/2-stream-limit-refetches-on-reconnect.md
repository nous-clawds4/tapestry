# Story 2: A stream's Limit refetches recent events whenever it connects

**Epic:** relay-stream-gaps
**Status:** Draft
**Created:** 2026-10-09
**Type:** Bug

## Background

Every router stream has a **Limit** in the Router Management editor. It's 5 in every preset
but `treasureMaps`, and the stream card shows "(limit: 5)". It reads as "fetch this many
recent events," and the operator intended to raise it to make streams catch up.

It does nothing. strfry's router replaces any configured limit with 0 when it subscribes to
an upstream relay (strfry 1.1.0 `cmd_router.cpp`, unchanged in strfry master). So a stream
fetches **no** stored events when it connects, only what is published while it stays
connected. Each time a stream connects, everything published upstream while it was
disconnected is lost for good. That includes when it's first turned on, after any router
restart, after every deploy, and after every dropped connection (epic § Why it matters: 10–16
events lost per deploy on the busy streams).

The operator chose (2026-10-09) to make the Limit work rather than remove it, and to raise
it. With it working, a gap shorter than the limit fills itself the moment the stream
reconnects. The book's scheduled negentropy sync remains the backstop for larger gaps.

## User-facing description

As an **instance operator**, I want a stream's Limit to mean "on every (re)connect, fetch up
to this many of the newest matching events from each relay". Then short outages (deploys,
restarts, dropped connections) refill themselves, and I can set the number per stream.

## Acceptance criteria

- [ ] **AC-1 (the limit is fetched on connect):** Given a download stream (direction down or
      both) with limit N, and events matching its filter that the local relay doesn't have on
      an upstream relay, when the stream connects to that relay, then within 10 seconds the
      local relay has the newest of them, up to N per relay. That covers turning the stream on,
      a router restart, and a deploy. An upstream relay may cap N at its own maximum. strfry's
      default is 500.
- [ ] **AC-2 (deploy holes close):** Given the busy streams set to the default limit, after a
      staging deploy, the minute-by-minute comparison used in the 2026-10-09 diagnosis shows no
      missing events around the deploy for those streams. Their per-deploy hole is a few dozen
      events, well under the limit.
- [ ] **AC-3 (live delivery is unchanged):** While connected, a stream still receives new
      matching events as they're published, as fast as today. Upload streams behave exactly as
      today. Events the local relay already has are not stored twice.
- [ ] **AC-4 (the editor says what it does):** The Limit field explains that it is how many
      recent events each relay re-sends when the stream connects, and that it applies to
      downloads only. New streams and the presets start at the default limit instead of 5.
      A blank or 0 limit is shown as "live only (nothing fetched on connect)".
- [ ] **AC-5 (no surprise floods):** A stream with no limit set behaves as today: live only.
      Nothing is fetched on connect unless a limit is set.

## Concepts touched

- `39998:<this instance's TA>:nostr-relay`: the upstream relay each stream connects to. The
  pubkey differs per deployment; resolve it at runtime. (No local stack this session.)
- None from the tag family. Generic operator tooling.

## Out of scope

- **Gaps bigger than the limit, backdated events, and kinds no stream covers.** The scheduled
  negentropy sync, story 3 in this book, handles these.
- **The upload direction.** The router still never uploads local events written while it was
  down.
- **Changing streams already saved on each instance.** Each instance's streams are its own
  state; the operator raises their limits in the editor (Open question 2).
- **How often the router reconnects** after an upstream drop.

## Open questions

1. **Default limit for new streams and presets.** Proposed: **500**. strfry relays cap a
   request at 500 by default, so a higher number buys nothing from them. On the busiest
   streams (kinds 0/3 at about 20 events a minute), 500 covers about 25 minutes of outage.
   Each reconnect re-sends up to 500 events per relay, and the local relay discards the ones
   it already has.
2. **Existing saved streams on staging and production** keep their limit of 5 unless the
   operator edits them. Proposed: you raise them in the editor after this ships (a few
   clicks per instance). The alternative is for the story to raise every saved limit of 5
   to the default once, on each instance.
3. **Blank limit = live only** (AC-5) keeps today's behavior for `treasureMaps` and for staging's
   `userProfiles`, which have no limit. Proposed: yes. Those streams would still lose deploy
   gaps until a limit is set.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
