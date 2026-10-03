# The curation-header endpoint copies only names, slug and json, so an assistant's copy of a list loses its field declarations

**Id:** 2026-10-03-dlist-curation-drops-header-schema
**Type:** bug
**Opened:** 2026-10-03 (cross-session review for Brainstorm-UI's Dictionary work; branch `docs/declarative-dlist-rendering`)
**Status:** OPEN
**Done:** —

**What was seen.** `POST /api/dlist-curation/header` composes the assistant's curation header from the community header with `COPIED_TAGS = ['names', 'slug', 'json']` (`src/api/dlist-curation/index.js:30`, the same on `staging` and `feat/tags`). It does not copy `description`, the field declarations (`required` / `recommended` / `optional` / `allowed` / `disallowed`) or `field-type`. Our own spec says it should: [Assistant Designation](../protocols/drafts/assistant-designation.md) § Per-DList curation entries, the header contract, "SHOULD copy the community header's names, description, and schema at creation".

Effect: a curated copy of GitHub Accounts (`39998:b83a28b7…:github-accounts`, which declares `["required","github-username"]` and its `field-type`) declares no fields at all, so a schema-driven renderer ([Opinionated Views](../protocols/drafts/opinionated-views.md) § 2.1) has nothing to show from the copy. The same gap would drop the provisional display hints, header `image` and `link` tags ([W27](../protocols/worksheet.md#w27--declarative-rendering-hints-for-dlist-headers)). Brainstorm-UI's builder's guide already documents the gap as a Tapestry divergence.

**Fix shape.** Widen `COPIED_TAGS` to the description and the schema tags (never `b`, never `concept-graph`, as ADR `dlist-curation/0004` sub-decision 2 requires), update `test/dlist-curation-header-endpoint.test.js`, and decide whether an existing curation header is refreshed or left alone (the endpoint's "exact / older / conflict" branches). Tags not yet ratified (W27's) wait for W27.

**Pointer:** `src/api/dlist-curation/index.js:30`; ADR `engineering-team/decisions/dlist-curation/0004-assistant-curation-header-endpoint.md`; assistant-designation.md § Per-DList curation entries.
