# Book of Work: Inspect the nostr event behind a tag

**Slug:** tag-event-inspector
**Status:** Closed (2026-07-16)
**Opened:** 2026-07-16 (eagerly at intake, per workflows/0-intake.md step 4)
**Closed:** 2026-07-16 — audit + prd-seed written; epic `tag-event-inspector` retired. Range `0bc77ee1..acbf5cca`.

## Intent anchor

**Acceptance frame (no PRD)** — the operator's 2026-07-16 ask, restated below from the verbatim request that opened this book. Anchor inputs: the raw ask (below); the live tag-detail surface it names (`https://tags.brainstorm.world/tag/stoicism/225d62905785e379e70c258490dee2c8813db289c66f694a4a030bb9e60dc908`); and the existing per-row `⋯` menu the ask says to emulate (`ui/src/components/NoteActionsMenu.jsx`).

This is deliberately a **new book**, not an addition to an open one. The two open books are `unified-tagging-ui` (frame: "tag surfaces stop meaning profiles only" + note-pinning; one story left) and `task-timeline` (unrelated). Neither frame covers inspecting the definitional event — this is a new capability on the tag detail page, not a continuation of either.

**Raw ask (verbatim, 2026-07-16):**

> I would like to add a feature to a page such as this one: https://tags.brainstorm.world/tag/stoicism/225d62905785e379e70c258490dee2c8813db289c66f694a4a030bb9e60dc908 that will allow me to view the raw nostr event that provides the definition of the tag. The raw nostr event itself should be positioned below the 'Pin' button and above the 'Profiles - Notes' button. I will want to toggle it between visible and hidden, and by default it should be hidden. To find the toggle button, I would like to emulate the use of the three-dot `...` icon that currently is floated to the right of each individual Profile or Note. We will add a new three-dot icon, but it will float to the right of the tag name, close to the top of the page. When I click the three-dot icon, I will toggle a menu with these options:
> * Copy Note ID (event id)
> * Copy Note Addr (if it is a replaceable event)
> * Show Raw Event (or Hide Raw Event if it is currently already being shown)

### Acceptance frame

- [x] **The raw nostr event that defines a tag is viewable on that tag's page.** It renders the signed event as published — id, pubkey, created_at, kind, tags, content, sig — not a summary of it. — *Met.* All 7 canonical NIP-01 fields, verified rendered on staging, tags.brainstorm.world and production.
- [x] **It is hidden by default and toggles visible/hidden**, and when shown it sits **below the Pin button and above the Profiles|Notes switch**. — *Met, with one recorded interpretation:* the ordering is honored, but the panel is a page-level sibling rather than strictly *adjacent* to Pin — the POV banner and tab strip already sat between the two named elements, and a literal placement would have made the panel vanish on the Pinned tab. See audit §4 #1.
- [x] **A new three-dot `⋯` menu floats to the right of the tag name**, near the top of the page, emulating the `⋯` menu already on each Profile and Note row. — *Met.* Reuses the emulated menu's glyph, classes and conventions; the emulated component is byte-unchanged (audit §4 #3).
- [x] **That menu offers exactly three options:** Copy Note ID (event id), Copy Note Addr, and Show Raw Event / Hide Raw Event (label reflecting current state). — *Met.* Exact labels, exact order, label flips in place. The "Note" wording was queried at Planning and **ratified by the operator at close** — "note" is synonymous with nostr event here (audit §4 #7).

**Done looks like:** story #1 of epic `tag-event-inspector` passes review and ships to `staging`; the operator can open `tags.brainstorm.world`'s `stoicism` tag page, hit the `⋯` beside the tag name, and read the kind-39999 event that defines it. Per the kickoff plan the change then promotes to `feat/tags`, where the tag data is rich enough to exercise it properly — **prod and the tags branch are the operator's call, not this session's**.

## Epics in this book

- `tag-event-inspector` — story #1 (`stories/done/tag-event-inspector/1-tag-actions-menu-and-raw-event.md`). New epic: making the events behind tag surfaces directly inspectable in-product.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** **high** — the anchor is the operator's ask captured verbatim at intake, not a reconstruction, and all four frame bullets were verified by driving the running product on three deployments rather than inferred from the diff. *(The `prd-seed`'s confidence is separately **medium**: the scope is near-fact, but the product reasoning under it — who this is for, what job it does — was never stated and is read backwards off one feature.)*

## Outcome

Shipped past the frame's "done" line, on the operator's explicit call (the frame reserved both decisions to them): `staging` (PR #370) → `feat/tags` / tags.brainstorm.world (PR #371, a back-merge) → `main` / production (PR #373). Product code delta: 4 files, +210/−3. Reviewer verdict **PASS**, no blocking findings.

## Close artifacts

- Build audit: `engineering-team/audits/tag-event-inspector/audit.md`
- Product feedback: `engineering-team/audits/tag-event-inspector/prd-seed.md`
- Retro dispositions: audit §7 (6 findings — 2 → OPEN.md #43/#44, 1 → commit `d05a35be`, 1 → OPEN.md #46, 1 declined, 1 escalation deferral)
