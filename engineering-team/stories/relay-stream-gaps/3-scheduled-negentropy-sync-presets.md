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

## Deviations

Implementation judgment calls (Implementer, 2026-10-09); none changes the ADR's design.

- `runStrfrySync` also takes `presetName` in its options and resolves `{ exitCode, output, timedOut }`, so a sync killed at 10 minutes is recorded as "did not finish within 10 minutes and was stopped" (AC-4's "why it failed"), not "exited with code null".
- `/status` also returns `source: 'preset'` and `presetName` while a scheduled preset holds the slot; the tab's status line reads the name there (the test plan left the source open).
- `failed` counts presets that ran and failed. A preset skipped because a manual sync held the slot for 10 minutes is reported as `skipped`, not failed, so the operator's own manual sync doesn't fail the task in history (open in the test plan).
- A create honors `enabled: true` in the body (the ADR lists `enabled?`); without it a new preset starts off. A replace ignores it and keeps the switch.
- An unreadable or unparseable presets file is never overwritten: every endpoint answers 500 naming the problem (the corrupt-file case was unspecified; BIBLE §30, local state is not disposable).
- A successful run doesn't set `lastSuccessAt` when the preset was re-saved with another relay, direction or filter during the run (the ADR's own "a changed target clears `lastSuccessAt`" rule).
- Unknown id on toggle or delete answers 404. Empty kinds/authors/tag arrays count as absent, so the floor applies; numeric-string kinds are refused. A reordered kinds list counts as a change (it only widens the next window).
- `#p/#P/#e/#E` values are accepted as 64-character hex in either case, as the ADR words it; authors must be lowercase, as the ADR words it.
- `parseSyncOutput` sums `UP:`, `DOWN:` and `Writer: added:` lines across strfry's batches. Exit 0 without the reconcile line reads "strfry sync exited with code 0 without completing the reconcile".
- The task script appends to `${BRAINSTORM_LOG_DIR}/syncNegentropyPresets.log`, the file the registry's new `monitoring.logFiles` entry names.
- The tab polls `/status` every 5 s only while a scheduled preset holds the slot, so the status line clears and the last-run lines refresh when it ends. Load picks the matching kinds radio (or Custom) and also fills the preset name, so a re-save replaces it.
- The fresh-install seed is written compactly on two lines: `applicability-republish` BK1 matches `freshInstallEntries` within 1,800 characters, and the function is now 1,757.

## Linked artifacts
- ADR: `engineering-team/decisions/relay-stream-gaps/0003-negentropy-sync-presets.md`
- Test plan: `engineering-team/stories/relay-stream-gaps/3-scheduled-negentropy-sync-presets.test-plan.md`
- Review: (filled in after Review phase)
