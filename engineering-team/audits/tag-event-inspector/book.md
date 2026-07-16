# Book of Work: Inspect the nostr event behind a tag

**Slug:** tag-event-inspector
**Status:** Open
**Opened:** 2026-07-16 (eagerly at intake, per workflows/0-intake.md step 4)
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the operator's 2026-07-16 ask, restated below from the verbatim request that opened this book. Anchor inputs: the raw ask (below); the live tag-detail surface it names (`https://tags.brainstorm.world/tag/stoicism/225d62905785e379e70c258490dee2c8813db289c66f694a4a030bb9e60dc908`); and the existing per-row `⋯` menu the ask says to emulate (`ui/src/components/NoteActionsMenu.jsx`).

This is deliberately a **new book**, not an addition to an open one. The two open books are `unified-tagging-ui` (frame: "tag surfaces stop meaning profiles only" + note-pinning; one story left) and `task-timeline` (unrelated). Neither frame covers inspecting the definitional event — this is a new capability on the tag detail page, not a continuation of either.

**Raw ask (verbatim, 2026-07-16):**

> I would like to add a feature to a page such as this one: https://tags.brainstorm.world/tag/stoicism/225d62905785e379e70c258490dee2c8813db289c66f694a4a030bb9e60dc908 that will allow me to view the raw nostr event that provides the definition of the tag. The raw nostr event itself should be positioned below the 'Pin' button and above the 'Profiles - Notes' button. I will want to toggle it between visible and hidden, and by default it should be hidden. To find the toggle button, I would like to emulate the use of the three-dot `...` icon that currently is floated to the right of each individual Profile or Note. We will add a new three-dot icon, but it will float to the right of the tag name, close to the top of the page. When I click the three-dot icon, I will toggle a menu with these options:
> * Copy Note ID (event id)
> * Copy Note Addr (if it is a replaceable event)
> * Show Raw Event (or Hide Raw Event if it is currently already being shown)

### Acceptance frame

- [ ] **The raw nostr event that defines a tag is viewable on that tag's page.** It renders the signed event as published — id, pubkey, created_at, kind, tags, content, sig — not a summary of it.
- [ ] **It is hidden by default and toggles visible/hidden**, and when shown it sits **below the Pin button and above the Profiles|Notes switch**.
- [ ] **A new three-dot `⋯` menu floats to the right of the tag name**, near the top of the page, emulating the `⋯` menu already on each Profile and Note row.
- [ ] **That menu offers exactly three options:** Copy Note ID (event id), Copy Note Addr, and Show Raw Event / Hide Raw Event (label reflecting current state).

**Done looks like:** story #1 of epic `tag-event-inspector` passes review and ships to `staging`; the operator can open `tags.brainstorm.world`'s `stoicism` tag page, hit the `⋯` beside the tag name, and read the kind-39999 event that defines it. Per the kickoff plan the change then promotes to `feat/tags`, where the tag data is rich enough to exercise it properly — **prod and the tags branch are the operator's call, not this session's**.

## Epics in this book

- `tag-event-inspector` — story #1 (`stories/tag-event-inspector/1-tag-actions-menu-and-raw-event.md`). New epic: making the events behind tag surfaces directly inspectable in-product.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** *(filled by `/close-book`)*

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/tag-event-inspector/audit.md`
- Product feedback: `engineering-team/audits/tag-event-inspector/prd-seed.md`
