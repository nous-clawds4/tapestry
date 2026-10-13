# Story 4: Show your Assistant's raw Treasure Map

**Status:** Approved
**Created:** 2026-10-13
**Type:** Feature (small: one toggle and one panel on an existing page)

## Background

Your Assistant's Treasure Map page (`/assistant/treasure-map`, stories 1–3) describes the version of your Assistant's
kind 10040 that the page's check found: the entries where your Assistant lists its own duties, the count of other
entries (for the Owner), and whether it is up to date. It never shows the event itself.

The owner's ask (2026-10-13, verbatim): "I want to be able to toggle a panel and view my Assistant's raw Treasure Map,
assuming it exists."

The raw event is what an outside client reads, so it is the ground truth behind every line on the page: the exact
tags, their order, the relay hints, the `created_at`, the signature, and, for the Owner, this instance's own entries
that share the event. The TA Treasure Map page (`/tapestry/grapevine/treasure-map`) already has a "Show raw event"
toggle for the person's own Map; this story gives the Assistant's page the same view of the Assistant's Map.

This story is numbered 4 because it is the epic's next story. The upkeep story, called "story 4" until now (and
"story 3" before 2026-10-13), is now story 5; the epic's first cut shifts by one.

## User-facing description

As a person managing my Assistant, I want to open a panel that shows my Assistant's Treasure Map exactly as it was
published, so that I can see for myself what outside clients read, beyond the page's summary of it.

## Acceptance criteria

- [ ] **AC-1. A closed toggle when a version is found.** Given a signed-in viewer with an Assistant here, when the
  page's check has finished and found a version of their Assistant's Treasure Map, then the "Your Assistant's
  published Treasure Map" panel shows a toggle reading § Copy's closed label, and no event text. This holds whether or
  not the version lists any of the Assistant's duties (for the Owner it may hold only this instance's entries), and
  whether it was found on this instance's relay or another relay. The toggle sits after what the panel lists as found,
  before the state line and the buttons.
- [ ] **AC-2. Opening it shows the event, whole and as signed.** Given the closed toggle, when the viewer presses it,
  then a panel opens showing the found version as indented JSON with every field as published (`id`, `pubkey`,
  `created_at`, `kind`, `tags`, `content`, `sig`). Its `id` is the found version's id. The toggle now reads § Copy's
  open label; pressing it again closes the panel. Long lines wrap or scroll inside the panel, so the page never
  scrolls sideways, at phone width included.
- [ ] **AC-3. Nothing to toggle without a version.** Given the page while the answer is on its way, when the check
  could not finish, when it failed, or when it finished and found no version, then neither the toggle nor the panel
  shows. Signed out, or signed in with no Assistant here, the page shows neither (as today, none of its panels show).
- [ ] **AC-4. Never a stale version.** Given the panel is open, when a press asks for the answer again and it finds a
  newer version, then the panel shows the newer version and never the one from before; when the new answer finds no
  version, the toggle and the panel go away. The toggle starts closed each time the page is opened.
- [ ] **AC-5. Nothing else changes.** Given any state the page could be in before this story, when the same state
  arises after it, then every other line, button and mark shows as before, enabled in the same situations; a press
  sends the same request and changes the same things; the hub card, its count line and the Assistant Alert read the
  same. Opening or closing the panel publishes nothing and changes nothing.

## Copy

| Where | Words |
|---|---|
| The toggle, closed | ▸ Show your Assistant's raw Treasure Map |
| The toggle, open | ▾ Hide your Assistant's raw Treasure Map |

Story 3's rule holds: "Treasure Map", never "self-Map". The panel's body is the event itself; it adds no words.

## Concepts touched

- Treasure Map (kind 10040): your Assistant's own, shown read-only. No concept, event shape or tag changes.

## Out of scope

- **The person's own Treasure Map, raw.** That view already exists on `/tapestry/grapevine/treasure-map`.
- **A raw view of what the Map should list.** That list is computed, not a signed event.
- **Extras around the JSON:** a copy button, which relay the version was found on, older versions, or a diff against
  what the Map should list.
- **Editing.** The panel is read-only; the page still never edits the person's Map, and the presses are unchanged.
- **The hub card and the Assistant Alert.** No change.
- **Production.** As with stories 2 and 3, this story reaches `staging` after its Review and production with the
  upkeep story (story 5), unless the owner chooses otherwise.

## Open questions

None. The owner approved the story at the Planning gate (2026-10-13) with the three choices below as drafted, and the
path Standard, all five phases:

1. **Where:** inside the "Your Assistant's published Treasure Map" panel, right after what it lists as found.
2. **When:** whenever a version is found, even one that lists none of the Assistant's duties.
3. **Closed by default,** and not remembered between visits.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-self-map/0003-the-found-version-rides-the-answer.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
