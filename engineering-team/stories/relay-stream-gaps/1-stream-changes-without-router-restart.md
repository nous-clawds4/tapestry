# Story 1: Changing streams doesn't interrupt the other streams

**Epic:** relay-stream-gaps
**Status:** Approved
**Created:** 2026-10-09
**Type:** Bug

## Background

The Router Management tab (`/tapestry/settings/relays`) has three ways to change the
instance's router streams:
- turn a stream on or off;
- save streams: add, edit, delete, or import a preset;
- Restore Defaults.

Every one of them restarts the whole router process. While it restarts, **every** enabled
stream is disconnected, not just the one being changed. Staging runs 11.

Router streams are live only (epic `relay-stream-gaps` § Why it matters). A stream is never
sent what was published upstream while it was disconnected. So each change on the tab opens
a small permanent hole in every stream at once. On a busy stream that is a few seconds of
lost events. Today only a manual negentropy sync recovers them.

The restart isn't needed for the change to take effect. The router already picks up a
modified config on its own, and reconnects only the streams whose settings changed. The
control panel's startup already relies on this after every deploy: it writes the config
without restarting, and the streams come up. On staging on 2026-10-09 the router had
been running since the 23:50:46 UTC deploy with all its streams delivering, and nothing had
restarted it since.

## User-facing description

As an **instance operator**, I want to turn streams on and off, edit them, and restore the
defaults without knocking out the streams I didn't touch. That way, managing one stream
never costs me events on all the others.

## Acceptance criteria

- [ ] **AC-1 (a toggle touches only its own stream):** Given the router running with several
      enabled streams, when the operator turns one stream off or on, then:
      - the router process is not restarted (the uptime shown by router status keeps counting
        and does not reset);
      - every other enabled stream stays connected and keeps receiving events throughout;
      - within 10 seconds, the toggled stream has stopped (off) or started (on) receiving events
        that match its filter.
- [ ] **AC-2 (saves and Restore Defaults are the same):** Given the same running router, when
      the operator saves stream changes (add, edit, delete, or import a preset) or uses Restore
      Defaults, then the router process is not restarted. Streams whose settings didn't
      change stay connected and keep receiving events. Within 10 seconds, the running streams
      match what the tab shows: added or changed streams run with their new settings, and
      removed or switched-off streams stop.
- [ ] **AC-3 (never a false "done"):** If the router does not take up a change, the operator
      sees that the change did not take effect. Success is not reported, and the router
      keeps running the streams it had.
- [ ] **AC-4 (manual restart still works; the wording matches):** The tab's Restart button
      still restarts the router on demand (the uptime resets). No confirmation or message on
      the tab says that toggling, saving, deleting or restoring streams restarts the router.
- [ ] **AC-5 (regression: deploys and container restarts):** After a deploy or a container
      restart, the router comes back running every stream that was on before, with its saved
      settings, as it does today.

## Concepts touched

- `39998:<this instance's TA>:nostr-relay`: the remote relay each stream connects to. The
  handle pubkey differs per deployment; resolve it at runtime, never hardcode it. (No local
  stack this session, so the Architect should resolve the handle via
  `/api/concept-graph/summaries` if it matters.)
- None from the tag family. The Router Management tab is generic operator tooling.

## Out of scope

- **Holes left by deploys and container restarts.** The router process necessarily restarts
  with the container. The book's scheduled negentropy-sync story closes those holes.
- **The Limit setting** in the stream editor: its own story in this book (the operator chose
  to make it work).
- **Upstream disconnects**, and how quickly the router reconnects after one.
- **Recovering what was already missed.** A manual negentropy sync does that today, and the
  scheduled sync will do it going forward.
- **Changes to strfry itself.**
- **The order or contents of the presets.**

## Open questions

None at draft. AC-3 is the one behavior that is new, not just preserved. Today a change
the router rejects leaves the router stopped (every stream off), and the tab reports an error.
After this story the router would keep its previous streams. AC-3 keeps the operator from
being told it worked.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
