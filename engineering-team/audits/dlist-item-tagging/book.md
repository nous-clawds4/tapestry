# Book of Work: DList-item tagging

**Slug:** dlist-item-tagging
**Status:** Open
**Opened:** 2026-09-09
**Closed:** —
**Strictness:** Light (trial) — workflows/light-profile.md

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask (intake entry 2026-09-09), restated and confirmed
at the story-1 Gate A exchange (2026-09-09). Operator additions at that exchange: a
`github-account` firmware concept (epic candidate 6) joins the book after story 2.

Tagging a Decentralized-List item is the same act as tagging a nostr event (the `a`-target form
of the event-tagging wire shape — no new protocol), so this book is about the **app**: finding a
DList, rendering its items from the header's own field definitions, tagging an item, and carrying
tagged items through the existing pin / Trusted-List machinery. Proximal target: the
`github-accounts` list (`39998:b83a28b7…:github-accounts`), so that GitHub accounts can be tagged
("white hat hacker", "scammer", …) and a downstream search index (Vespa, other repo — out of
scope here) can consume those taggings.

### Acceptance frame

- [ ] **Find & read a DList in the app.** A signed-in user can reach a DList by its coordinate
      (`39998:<pubkey>:<d>`) and from an in-app list of DLists, see the header's name and
      description, and page through its items.
- [ ] **Header-driven item rendering.** Item fields are rendered from the header's field
      declarations (`required` / `optional` / `recommended`, plus `field-type` when present) —
      not from a hardcoded column set — with required fields distinguished from optional ones.
      The `github-accounts` list renders `github-username` as a link to the GitHub profile.
- [ ] **Tag an item.** From an item, the user can apply / dispute a tag exactly as on a note; the
      assertion targets the item's `a` coordinate; the item shows its tags under the active POV
      with the viewer's own stance distinguished.
- [ ] **Find tagged items from the tag.** A tag's page lists the DList items tagged with it,
      rendered with their list's fields (a tagged GitHub account shows as a GitHub account, not
      a bare coordinate).
- [ ] **Pins & Trusted Lists cover items.** Pinning a tag that has item taggings yields a
      `30394` (`a`-member) Trusted List under the user's POV, alongside the existing `30392`
      pubkey and `30393` note lists; the Pins page shows it.
- [x] **Votes (decided out, Gate A 2026-09-09).** Existing up/down (kind-7) counts remain visible on
      items; *publishing* votes is orthogonal and outside this book.
- [ ] **Publish discipline.** During the build, taggings publish to local strfry only (the
      existing publish gate); the feature ships to `feat/tags` → tags.brainstorm.world as its
      staging. Production is the operator's separate call.

## Epics in this book
- `dlist-item-tagging` — browse → render → tag → find-by-tag → pin/TL, for DList items.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/dlist-item-tagging/audit.md`
- Product feedback: `engineering-team/audits/dlist-item-tagging/prd-seed.md`
