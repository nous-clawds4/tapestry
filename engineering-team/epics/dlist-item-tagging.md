# Epic: dlist-item-tagging

**Created:** 2026-09-09
**Status:** Active
**Book:** `engineering-team/audits/dlist-item-tagging/book.md` (acceptance-frame, **Light profile
trial** — workflows/light-profile.md)
**Provenance:** Operator request 2026-09-09 — `stories/_intake.md` entry of that date. Branch
`feat/dlist-item-tagging` off `main`; ships to `feat/tags` (tags.brainstorm.world) as staging.

## Goal
A signed-in user can find a Decentralized List in the app, read its items rendered from the
header's own field definitions, tag an item the way they tag a note (the `a`-target event-tagging
shape — no new wire format), find tagged items from the tag's page, and have tagged items carried
into pins and `30394` Trusted Lists. Proximal target: the `github-accounts` list, so tagged GitHub
accounts can feed a downstream search index.

## Stories
`stories/dlist-item-tagging/`:
1. `1-browse-a-dlist-with-header-driven-fields.md` — find a DList (by coordinate and from an
   index), render its header and items from the header's field declarations, paginate.
2. *(planned)* tag a DList item — the note-tagging affordance on an item, per-POV tags with the
   viewer's stance, `a`-coordinate target.
3. *(planned)* tagged items on the tag page — an Items view rendering each item with its list's
   fields.
4. *(planned)* pins & Trusted Lists for items — `30394` `a`-member lists from pinned tags; Pins
   page coverage. Escalation watch: curation-method `targetTypes` is wire-visible.
5. ~~publish up/down votes~~ — **out of the book** (Gate A 2026-09-09: votes are orthogonal).
6. *(in the book after story 2 — Gate A 2026-09-09)* a `github-account` firmware concept whose manifest
   `communityReference` points at the community header `39998:b83a28b7…:github-accounts` —
   the local twin + seeded pointer-`b` affiliation, so a downstream search indexer can subscribe to
   the shared concept rather than a bare coordinate. **Firmware change = irreversibility trigger:**
   runs Standard with an ADR if taken. Not a prerequisite for stories 1–4.

## Decisions
`decisions/dlist-item-tagging/` — none yet (Light: Design notes live in the story files unless an
irreversibility trigger fires).
