# Epic: dlist-curation

**Created:** 2026-09-10
**Status:** Open
**Book:** `engineering-team/audits/dlist-curation/book.md` (acceptance-frame)
**Provenance:** Operator request, 2026-09-09/10 in-session, on the TA Treasure Map page. No
`_intake.md` entry — the request went straight into the book and story 1. Design settled in the
same session (see "Settled at kickoff" below); the docs-mode stories carry those decisions into
`protocols/` and the b-tag design handoff.

## Goal
A signed-in user on the TA Treasure Map page can (1) read a Trusted Lists panel that folds to a
one-line status and, when opened, explains why publishing 30392 Trusted Lists matters before
asking them to opt in; and (2) empower their Tapestry Assistant to curate one or more community
DLists — a per-DList kind-10040 entry `["<kind>:<d-tag>", <assistant>, <relay>]` backed by an
assistant-authored header `<kind>:<assistant>:<d-tag>` that inherits the community list's items
via `["b", <community a-tag>, "inherit-items"]` — searching community headers one at a time,
revoking per entry, and seeing each curated DList in Map Entries with a link to its page. The
assistant's header + items are the scaffold a *separate* Tapestry instance can later build a
concept from (Bob, on Alice's instance, curating firmware for his own future instance) without
duplicating items into the community list.

## Stories
`stories/dlist-curation/`:
1. `1-tl-panel-copy-and-collapse.md` — the new prompt copy; the Trusted Lists panel collapsed by
   default with a three-state status line. Feature.
2. *(planned)* `2-per-dlist-map-entry-convention` — the per-DList kind-10040 entry: shape,
   reconstruction rule, first-colon split, `dlist-header` reservation, relay hint, revoke
   semantics, dual-author precedence pointer. Docs-mode (`assistant-designation.md` + ADR).
3. *(planned)* `3-inherit-items-facet` — register `inherit-items` in the `b` type registry;
   additive v1 item algebra; aggregation weight; derived-edge facet; W6. Docs-mode
   (`inherit-from.md` + worksheet + ADR).
4. *(planned)* `4-assistant-curation-header-endpoint` — server: author/refresh the signed-in
   user's assistant header for a chosen community header (snapshot + `inherit-items` `b`), sign
   with the user's assistant key, publish local + community relay, no Neo4j write, idempotent,
   never-clobber. Feature.
5. *(planned)* `5-dlist-curation-panel` — the collapsible panel: community-header search with
   self/assistant exclusion, add (header first, then sign the Map), revoke. Feature.
6. *(planned)* `6-map-entries-dlist-class` — Map Entries: classify `<kind>:<d-tag>` entries,
   show name + community pointer, link to the DList page, missing-header warning. Feature.
7. *(planned, operator to confirm)* `7-treasure-map-merge-preserve` — the NIP-85 export
   generator preserves non-30382 entries. Bug.

## Decisions
`decisions/dlist-curation/`: (none yet)

## Settled at kickoff (2026-09-09/10 session)
- **Entry shape.** `["<kind>:<d-tag>", <assistant pubkey>, <relay>]`, kind ∈ {39998, 39999}
  (the DList NIP keeps 39999-declared headers open); a-tag reconstructed as
  `<kind>:<assistant>:<d-tag>`. Two-segment first element — fits ADR tl-treasure-map/0001's
  parse rule unchanged; readers split at the first colon only (d-tags may contain colons);
  `dlist-header` is reserved for the blanket designation entry.
- **The header is the assistant's.** Authored in the assistant's namespace with the community
  header's d-tag; carries `["b", <community a-tag>, "inherit-items"]`; names/description/schema
  copied at creation; an existing header with a different `b` is surfaced, never re-pointed
  (the firmware pass's never-clobber rule, `src/firmware/install.js` `pass_communityReferences`).
- **Signing and publication.** The signed-in user's assistant key (server-held, per-user;
  `getAssistantKeys(userPubkey)`), never the owner's TA; published to local strfry and the
  community relay; relay hint = first entry of `settings.aRelays.aDListRelays` (empty-string
  fallback, shape preserved). Header first, then the user signs the Map (NIP-07); a cancelled
  signature leaves a harmless header; re-running is idempotent.
- **No Neo4j write on the hosting instance.** Another user's assistant header is a letter in
  the relay, not the instance's graph state; the graph takes in third-party letters only through
  its own lanes (adoption queue, stage-2 ingest). The owner curating on their own instance is
  treated the same in v1; when a curated list enters the owner's graph is the later curation
  feature's call. Map Entries' missing-header check consults strfry and the hinted relay, never
  Neo4j.
- **Candidates.** The community self-declared shared concepts (the "Shared with the community"
  source, `useCommunitySharedConcepts`), keyword-filtered client-side, excluding headers authored
  by the user or the user's assistant; already-curated headers shown but not addable.
- **Revoke** removes the Map entry only; the header and its `b` remain.
- **`inherit-items`.** First facet in the `b` type registry (closed at two values today; new
  values require an ADR): live, parent-authoritative deference over items — neither today's
  `inherit` (definition fields) nor the family table's IMPORT (snapshot, importer-authoritative).
  v1 algebra additive: union of the parent's items and the child's own, both trust-filtered at
  read time; removals/replacements deferred. No aggregation weight (content composition, not
  definition endorsement). Derived edge records the facet (property on INHERITS_FROM, least
  invasive). Unknown types keep reading as `pointer` — the fail-safe that makes facets safe to
  add one at a time. No `inherit-all` (its meaning would vary by reader); `inherit-header`,
  `inherit-subsets`, `inherit-json-schema` wait for a consumer, the rule W6 used. `inherit`
  keeps its meaning.
- **Two statements, two signers.** The Map entry (user-signed) says "my assistant is empowered
  for this header"; the header's `b` (assistant-signed) says "this list inherits the community's
  items". Authorization readers consult the Map; composition readers consult the header.
- **Out of this book.** The curation feature itself (the assistant adding items under its
  header); persistence of panel open/closed state.
