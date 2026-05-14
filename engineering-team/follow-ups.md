# Engineering Team — Tracked Follow-ups

Lightweight backlog of work surfaced during a phase but deferred. Each item is a candidate for a future `/plan-feature` story.

## Tag-aware Meilisearch profile search

**Surfaced during:** Story 1 (Tag user profiles), Implementation phase, 2026-05-08.

**Idea:** Tags applied to a `nostr-user` should feed the existing Meilisearch profile index so that searching a term like "bird" returns:

- Profiles whose name/display-name contains "bird" (existing behavior; ranked first).
- Profiles tagged with a tag whose name/slug matches "bird" (new; ranked after name matches).

The matched tag should be rendered prominently on the profile line item in the typeahead results, making it clear *why* that profile appeared (e.g. a chip-style marker with the tag name on the result row).

**Sketch (not committed design):**
- A pipeline step that, on `nostr-user-tag` event arrival, updates the target's Meili document with an `appliedTags: ["bird", "podcaster", …]` field built from the union of WoT-network applications.
- Meili `searchableAttributes` includes `appliedTags` after `name`/`display_name`.
- Result documents return `_matchedTags` so the UI can highlight the triggering tag inline.
- WoT-author filtering (rather than "all assertions") would gate which tags count toward a profile in a given user's POV.

**Open questions for the eventual story:**
- Do disputes subtract from the index? (Probably yes once polarity-aware GR scoring lands.)
- Re-index strategy: full rebuild vs. document-level update on each assertion event.
- How to handle a tag whose `name` differs from its `slug` (search both; surface canonical name).

**Status update (2026-05-13):** the core of this — tags surfaced in profile search with `_matchedTags` and POV-filtering — shipped as part of Story 1 (commit `b6d2fbb8`). The remaining open questions (disputes subtracting, indexing strategy) are still open for a future story.

## Tags as a result type in the root app's main search

**Surfaced during:** Story 4 planning, 2026-05-14.

Once the tag index + tag-detail pages exist, the root app's main search bar should also return tags as a result type alongside profiles and NIP-05. Click-through goes to the tag's detail page. Same POV-aware ranking rules apply. Likely small — fold into the same Meili proxy that already does query-time tag-match for profile results (Story 1).

## Community tag-activity surfaces

**Surfaced during:** Story 5 planning, 2026-05-14.

Future story (loose scope, to be brainstormed when we get there): richer relationships derivable from the tag graph. Sketches:

- "This person tagged that person who tagged this person" — chained tagging traversals.
- Reciprocal tags — tightly-knit networks where members tag each other similarly.
- Cluster discovery via overlapping tag patterns.
- Tagger reputation ("this person's tags get agreed with often / their disputes hold up under scrutiny").

Will revisit and brainstorm more relationships before writing acceptance criteria.
