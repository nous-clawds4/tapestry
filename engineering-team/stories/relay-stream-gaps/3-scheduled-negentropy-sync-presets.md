# Story 3: Saved negentropy-sync presets, run on a schedule

**Epic:** relay-stream-gaps
**Status:** Approved
**Created:** 2026-10-09
**Type:** Feature

## Background

Stories 1 and 2 shrink the router's gaps but can't close them. A stream is live only, plus
whatever its Limit refetches on connect. Content still goes missing when:
- a gap holds more events than the Limit;
- an event is backdated;
- a kind or concept isn't covered by any download stream at all. On 2026-10-09 production
  lacked 258 `food-and-drink-places` items and 18 concept headers (epic § Why it matters).

Today the only fix is for the operator to notice, open the **Negentropy Sync** tab, fill in a
relay, a direction and a filter, and press Start. Negentropy compares both sides' event sets,
so it catches everything matching the filter that one side lacks.

The Scheduled Tasks panel can already run tasks on a cron or an interval, with an on/off
switch and a run history. But its only syncs are two fixed tasks (`syncWoT`, `syncProfiles`)
with hard-coded relays and kinds.

The operator's ask (2026-10-09): "Under the Negentropy Sync tab, we might add support to save
a neg sync command as a preset; then each preset can be toggled on or off, and if it is toggled
on, then it gets included in the Negentropy Sync Scheduled Task."

## User-facing description

As an **instance operator**, I want to save the syncs I keep running by hand as named presets,
switch each one on or off, and have the switched-on ones run on a schedule. That way, content
the router missed arrives by itself, and I only open the Negentropy Sync tab to change what's
synced.

## Acceptance criteria

- [ ] **AC-1 (save, list, manage):** On the Negentropy Sync tab, the operator can save the
      current form as a named preset (relay, direction, kinds, authors, tag filters) under
      the same checks a one-shot sync applies. Saved presets are listed on the tab with name,
      relay, direction, a filter summary and an on/off switch. The operator can load a preset
      into the form (to run it once, or to change and re-save it) and delete it. Since/until
      aren't saved, because the schedule's window sets them (Product decision 1). Presets are this
      instance's own and survive restarts and deploys.
- [ ] **AC-2 (no runaway presets):** A preset must narrow what it syncs. It needs at least
      event kinds, authors or a tag filter, so an unfiltered "everything from this relay"
      sync can't be scheduled (OPEN.md row 25: about 1.3M junk events on dcosl). The tab
      says why when it refuses.
- [ ] **AC-3 (the scheduled task):** The Scheduled Tasks panel offers a **Negentropy Sync
      presets** task. When it fires, it syncs every switched-on preset with that preset's
      relay, direction and filter, over the window in Product decision 1. Presets run one at a
      time, switched-off presets are skipped, and a run that is still going when the next one
      is due is not started twice. Its runs appear in the panel's history like any other
      task's.
- [ ] **AC-4 (results are visible):** For each preset, the tab shows its last scheduled run:
      when, whether it succeeded, how many events it brought in (and sent, for up or both), or
      why it failed (e.g. the relay doesn't support negentropy, or is unreachable). One preset
      failing doesn't stop the others.
- [ ] **AC-5 (it closes the gap, verified on staging):** With a switched-on preset covering
      content staging lacks, the missing events arrive on staging after the next scheduled run,
      with no manual sync. Example: the dcosl concept headers (kind 39998) or a concept's items.
      This is the book's "verified on staging" bullet for this story.

## Concepts touched

- `39998:<this instance's TA>:nostr-relay`: the relay each preset syncs with. The handle
  pubkey differs per deployment; resolve it at runtime. No local stack this session, so the
  Architect should resolve the handle if it matters.
- None from the tag family. Like the one-shot panel (relay-management epic guardrail), presets
  are generic tooling: a `#z` value is just a string.

## Out of scope

- **A separate schedule per preset.** All presets share the one task's schedule.
- **Turning router streams into presets** automatically, or the reverse.
- **Changing or retiring the fixed `syncWoT` / `syncProfiles` tasks.**
- **Sharing presets between instances.**
- **Shipping starter presets.** Every instance starts with none.
- **Fixing which relays support negentropy.** A failing relay is reported (AC-4), not worked
  around.

## Product decisions (settled at Planning, 2026-10-09)

1. **Each scheduled run looks back to that preset's last successful run, with an hour's
   overlap.** A preset's first run (or any run with no earlier success) covers the last 7
   days. It's cheap on both relays, and nothing is skipped as long as the task keeps running.
2. **The task ships switched off.** The operator turns it on in Scheduled Tasks and picks the
   cadence; the panel suggests every 6 hours.
3. **A preset needs at least one of: event kinds, authors, a tag filter** (AC-2's floor).

## Open questions

None.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
