# Book: Unified Tagging UI + Write pass

**Status:** Open
**Opened:** 2026-06-30
**Intent anchor (acceptance frame):** Turn the unified tag *universe* (built server-side in Stories 9–11) into a coherent app experience, and add the one missing write capability (note-pins) — so the tag surfaces stop meaning "profiles only," shipped as ONE non-confusing step (operator: don't ship a partially-unified UI). Done = `/tags`, the tag-detail page, and profiles' "Tagging Activity" all reflect notes + profiles; pinning works for note-tags too; then the deploy chain (explicit go).

## Foundation already shipped (server/core, reviewed, all local/unpushed)
- Story 9 — unified tag index (`/api/tags/index`), PASS.
- Story 10 — search, subsumed by 9.
- Story 11 — `/api/event-tags/notes-by-author`, PASS.
- Pure core: `normalizeTaggings` + `taggingMembers` registry + `indexByTag` + `taggingsByAsserter`.

## Decomposition (build order — lowest-risk / highest-value first; ship at the end)
1. **Story 13 — Unified `/tags` directory (UI + endpoint controls).** Wire `Tags.jsx` to `/api/tags/index`; extend the endpoint with the controls the page needs so nothing regresses (pinnedCount + used/endorsed/most-pinned sorts + authoredBy/pinnedByMe filters), now spanning notes + profiles. Directly fixes the original `/tags`-is-confusing complaint. *(No pin-affordance change → no confusion.)*
2. **Story 14 — Profile "Tagging Activity" spans notes (UI).** Wire `AuthoredTaggingSection` to `/api/event-tags/notes-by-author` (Story 11's held UI): show the notes a person has tagged.
3. **Story 12 — Generalized (target-typed) pinning.** The note-pin affordance + a kind-30003 bookmark-set materializer (note analog of the kind-30392 TL / kind-30000 export), reusing `for-tag` + the registry projection. Removes the "pinning only works for profiles" confusion. Biggest; write + UI.
4. **Ship** — local → staging → (explicit go) prod.

## Return edge
On close, write `audit.md` (as-built) + `prd-addendum.md` (deltas). The unified-taggings design/ADR (0009) + this book are the record.
