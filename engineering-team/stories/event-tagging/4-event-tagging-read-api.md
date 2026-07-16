# Story 4: Event-tagging read API

**Status:** Draft
**Created:** 2026-06-29
**Type:** Feature
**Epic:** event-tagging

## Background

Stories 1–3 laid the foundation: the protocol + dependency-free core (the discovery filters), the publish guard, and the two concepts now seeded in the graph. Nothing yet *reads* event-taggings back. This story adds the **server read endpoints** that surface, for a given event, which tags have been applied to it and by whom — POV-filtered at read time — plus the discovery a writer needs to know whether a tag is already set up for event-tagging.

It is the event analog of the existing pubkey read path (`src/api/profile-tags/index.js` → `tags-for-profile`), and should mirror its POV-filtering and polarity contract. The one genuinely new wrinkle: for pubkey-tags the descriptor (which tag) is read directly off the assertion's `a` tag, but for **event**-tags the descriptor is reached **indirectly** — the assertion `z`-references a per-tag *tagging header*, which in turn names the tag. So the read must resolve that indirection and **verify the referenced header is a legitimate tagging header** (a member of `tagging-with-specific-tag`) before counting the tagging. This enforces the architecture invariant directly: the relay scan returns *candidates*; whether each counts is decided at read time.

Story 5 (write path) and Story 6 (UI) consume these endpoints.

## User-facing description

As the event-tagging UI (and, later, a third-party reader), I want to ask "what tags have been applied to this note, from my point of view?" and "does this tag already have a tagging header?", so that I can show a note's tags with apply/dispute standing and decide what a new tagging needs to create.

## Acceptance criteria

Testable from the outside. POV params and polarity bucketing mirror `tags-for-profile`.

- [ ] **Tags for a note.** Given a kind-1 note id with event-taggings on the local relay, when I request the taggings-for-event read with that id, then I get the tags applied to that note, each with its apply/dispute standing — polarity bucketed (`≥ 0.5` applied, `≤ −0.5` disputed, between → dropped; absent polarity defaults to applied), exactly as `tags-for-profile` does.
- [ ] **Addressable targets too.** Given an addressable target (an a-coordinate, e.g. a tag or DList), when I request the read for that coordinate, then I get the same shape — the target is matched by `#a` instead of `#e`.
- [ ] **Indirection is resolved and verified.** A candidate tagging counts only if its descriptor `z`-tag points at a **legitimate** per-tag tagging header (one that is itself a member of `tagging-with-specific-tag`); a candidate whose `z` references a non-header (or nothing) is **excluded**. The response identifies *which tag* each counted tagging applies (resolved through the header to the tag-element).
- [ ] **POV-filtered at read time.** With the house POV (default), results reflect the house WoT; with a user POV (`wotPov=user` + the viewer's pubkey), only asserters within that POV's web of trust (rank at/above the POV threshold) count. The same relay data yields different results per POV; switching POV requires no re-index. (House is the default, never the *only* path — a user POV is always accepted.)
- [ ] **Legitimacy authority is a POV choice, not a hardcode (sovereignty).** Which `tagging-with-specific-tag` namespace(s) define a *legitimate* tagging header is a per-POV / per-reader parameter — defaulting to the canonical + local namespaces, but **overridable** — never a single hardcoded canonical. The raw candidate scan (`#e`/`#a`) is namespace-agnostic, so a splinter's taggings are always *present* in the candidate set; only whether they *count* depends on the reader's chosen authority set. This keeps legitimacy per-POV (invariant #1) and preserves exitability: a deployment/user who honors a different authority is readable by anyone who chooses to honor it. *(Rung 3 of the exit ladder — without it, the canonical authority silently defines "a real tagging" for everyone.)*
- [ ] **Unverifiable ≠ illegitimate.** When a candidate tagging's header cannot be resolved on the local relay (e.g. it hasn't propagated yet), the read reports it as **unverifiable/unknown** — distinct from a header that resolves and is confirmed *not* a member of `tagging-with-specific-tag` (**illegitimate**, excluded). A real tagging is never silently erased merely because its header hasn't synced; a consumer can tell "not a tag" from "can't see far enough to tell yet."
- [ ] **Tagging-header discovery for a tag.** Given a tag (its author + slug), when I request the tagging-headers-for-tag read, then I get the per-tag tagging header(s) that exist for that tag (empty when none) — enough for a caller to decide whether a header must be created before applying.
- [ ] **Applicable tags list.** There is a read that lists the tags usable as event-tags (reusing the existing shared `tag` concept rather than a parallel list), so a UI can offer "search existing tags."
- [ ] **Empty / invalid inputs.** A missing or malformed target identifier returns a clear error (not a 500); a valid target with no taggings returns an empty result (not an error).
- [ ] **Read-only.** The endpoints perform no writes and publish nothing.

## Concepts touched

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-event-tag` — the assertions being read.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tagging-with-specific-tag` — the membership test for a *legitimate* tagging header.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` — the descriptor tags (reused; the "applicable tags" list).
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-event` — the target events.

> Architect resolves handles against the runtime TA and reuses the Story-1 core's discovery-filter builders (`filterTagsAppliedToEvent`, `filterTaggingHeadersForTag`) and the existing POV-resolution helper (`resolvePov`) rather than re-deriving them.

## Out of scope

- **Writes / publishing** — the 3-publish sequences are Story 5; this story only reads.
- **UI** — Story 6.
- **Actively fetching a *remote* relay's data for the read** (reaching out to a canonical deployment's relay at read time). This story reads the **local** relay only. Honoring multiple legitimacy-authority namespaces over the **locally-available** events is in scope (the AC above); *fetching* a remote namespace's events to union them is a later refinement.
- **Performance/caching of the reverse-lookup.** The "tags of an event" path is a per-candidate resolve-and-verify (heavier than the direct `a`-read of pubkey-tags); document the cost, but optimization (caching the bounded tagging-header set, etc.) is deferred unless measured to be unacceptable.
- **Graded-polarity valence** (the open interval) — reserved (worksheet W3), as in the pubkey path.

## Open questions

1. **Response shape** — per-tag aggregated counts vs. per-asserter `applications`/`disputes` arrays (as `tags-for-profile` returns). Mirror the pubkey path unless the UI needs aggregation; Architect decides. *(Architecture)*
2. **Applicable-tags reuse** — reuse `profile-tags/available-tags` directly, or expose an event-tagging-namespaced read that points at the same `tag` concept? Prefer reuse. *(Architecture)*
3. ~~Header-membership namespace~~ — **resolved into the "Legitimacy authority is a POV choice" AC above:** the authority namespace(s) are a per-POV parameter (default canonical + local, overridable). The Architect designs *how* the parameter is expressed/defaulted, but not *whether* it exists — it must. Ties to W1.

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0004-event-tagging-read-api.md`
- Test plan: `engineering-team/stories/event-tagging/4-event-tagging-read-api.test-plan.md` (suite: `test/event-tagging-read-api.test.js`)
- Review: `engineering-team/reviews/event-tagging/4-event-tagging-read-api.md` — **PASS**
