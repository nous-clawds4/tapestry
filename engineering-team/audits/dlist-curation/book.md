# Book of Work: Treasure Map — DList Curation

**Slug:** dlist-curation
**Status:** Open
**Opened:** 2026-09-10
**Closed:** —
**Strictness:** Standard (project default; confirmed by the operator at kickoff, 2026-09-10 —
Light declined). The two protocol stories run Standard docs-mode.

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, settled over the 2026-09-09/10 session on the
TA Treasure Map page (`/tapestry/grapevine/treasure-map`), restated here and confirmed by the operator at kickoff (2026-09-10).

### Acceptance frame

- [ ] **TL prompt copy.** The Trusted Lists panel's prompt reads: "Tags of pubkeys greatly enrich
      Vespa search on brainstorm.world. For this to work, a kind 30392 Trusted List should be
      published for each Tag. Would you like the local Tapestry instance to publish your Trusted
      Lists for pubkeys on your behalf?" (the existing "If so, you will need to update your
      Treasure Map…" continuation kept unless struck at the story gate).
- [ ] **Collapsible TL panel.** Collapsed by default, showing only "Trusted Lists for Pubkeys
      (30392)" plus a status indicator with three states: set to my local Tapestry Assistant ·
      set to a different pubkey that is not my Assistant · not set at all.
- [ ] **DList Curation panel.** A second collapsible panel, collapsed by default, titled
      "DList Curation". Expanded: a keyword search over community shared-concept headers fetched
      from the community relay (the same source as the Shared Concepts pages), **excluding**
      headers authored by me or by my Tapestry Assistant; add one at a time; revoke per entry.
- [ ] **Empowerment convention on the Map.** One entry per curated DList:
      `["<kind>:<d-tag>", <assistant pubkey>, <relay>]`, kind `39998` or `39999`; the header's
      a-tag is reconstructed as `<kind>:<assistant pubkey>:<d-tag>`. Ratified in `protocols/`
      with an ADR: split the first element at the first colon only; `dlist-header` reserved for
      the blanket designation; relay hint from the DList relay group; revoke removes the entry
      and leaves the header in place.
- [ ] **Assistant-authored header.** Adding a DList guarantees the header
      `<kind>:<assistant>:<d-tag>` exists — authored at that moment if absent — carrying
      `["b", <community header a-tag>, "inherit-items"]`, with names/description/schema copied
      from the community header at creation; signed by the **signed-in user's** assistant;
      published to local strfry and the community relay; **no write to the hosting instance's
      Neo4j**; header first, then I sign the Map; an existing header with a different `b` is
      surfaced, never silently re-pointed.
- [ ] **`inherit-items` facet.** Registered in the inherit-from draft as the first facet type:
      live, parent-authoritative deference over a list's items; v1 algebra additive (union of the
      parent's items and the child's own, trust-filtered at read time; removals deferred); no
      aggregation weight; the derived edge records the facet; unknown types keep reading as
      `pointer`. `inherit` keeps its meaning; no `inherit-all`; other facets wait for a consumer.
      Worksheet W6 updated for the additive case.
- [ ] **Map Entries.** DList entries display with the DList's name, the community header they
      point to, a link to the DList's page, and a warning when the assistant's header is missing
      from local strfry and the hinted relay.
- [ ] **Nothing else moves.** Relay presence, the hand-edit panel, the raw-event toggle, the
      no-Map path, and every existing publish path are unchanged. The later curation feature
      (the assistant adding items under its header) is out of this book.
- [ ] *(Operator to include or drop)* **Merge-preserve.** The NIP-85 export page's 10040
      generator rebuilds the Map from config and drops every non-30382 entry, including the
      existing 30392 entry (`src/api/export/nip85/commands/create-unsigned-kind10040.js`).

## Epics in this book
- `dlist-curation` — the two panels, the Map convention, the assistant-authored header, the
  `inherit-items` facet, the Map Entries class.

## Known constraints acknowledged at kickoff
- `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (🔴 OPEN) O7 sequences the b-tag affiliation
  *implementation* work — including the merge-preserve 10040 fix — behind the communities
  three-branch reconciliation (`docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §7). That
  reconciliation concerns the nostr-user-tag membership schema, which this book never touches,
  and the seeding install-pass it also named has since shipped (`community-reference` ADR 0034).
  This book proceeds; the docs-mode stories append their decisions to that handoff so the living
  design doc stays the single capture surface.
- `protocols/drafts/assistant-designation.md` owns the `39998:*` family on kind 10040 (blanket
  `39998:dlist-header`, specified-not-wired). The per-DList entry lands in that draft.
- Per-deployment assistant keys: the delegate everywhere is the signed-in user's assistant
  (`useAuth().user.assistantPubkey` / `getAssistantKeys(userPubkey)`), never the instance
  owner's TA (OPEN.md row 188 pin).

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** (set at close)

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/dlist-curation/audit.md`
- Product feedback: `engineering-team/audits/dlist-curation/prd-seed.md`
