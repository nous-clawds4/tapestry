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
