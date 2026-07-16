# Design (v1): Unified Taggings — one tag universe, read-time only

**Status:** ✅ Ratified → `engineering-team/decisions/event-tagging/0009-unified-taggings-normalization.md` (2026-06-30). Scope confirmed **Phase 1 only** (unify live profile-tagging endpoints later, post-ship).
**Date:** 2026-06-30
**Context:** Surfaced from the Story-8 parity audit. The `/tags` index (and search, and profile "tagging activity") is profiles-only; event-taggings are a separate stack. We want ONE tag universe spanning profiles, events, and future tagging types — the crux of tagging itself.

## The three constraints (operator, non-negotiable)

1. **No protocol change.** This does **not** change how taggings are written / published / constructed. Wire shapes, concept-`z`s, per-tag headers, the write paths — all untouched. This is a **read/aggregation** layer only.
2. **The proto-SDK inherits it.** The normalization lives in the **dependency-free core** (`src/lib/…`), so a third party who lifts the core gets unified reads for free — not app-specific glue.
3. **No constraints on others.** This is **opinionated, local** aggregation. We publish nothing new, define no required format, force no other publisher to do anything. Exactly CLAUDE.md invariant #2: *publishing is permissionless; aggregation is opinionated.*

All three point to the same shape: **normalize at read time, in the core, as our own interpretation of events that already exist.**

## The problem, precisely

Two tagging stacks that share only the tag-*element*:

| | profile-tagging | event-tagging |
|---|---|---|
| concept-`z` | `nostr-user-tag` | `nostr-event-tag` |
| target ref | `p` (pubkey) | `e` / `a` (event / addr) |
| **tag ref** | **direct** (`e`/`a` = tag-element) | **indirect** (descriptor-`z` → per-tag header → tag-element) |
| reads | `/api/profile-tags/*` | `/api/event-tags/*` |

Two kinds of divergence are tangled:
- **Target reference** (`p` vs `e`/`a`) — *legitimate*; different target types genuinely differ.
- **Tag reference + separate endpoints** — *accidental*; two protocols authored at different times.

The spec already anticipates the fix: `protocols/drafts/tags.md` calls this the **"taggings family"** (worksheet **W10** — family naming & expansion). What's missing is the unified **read model**.

## The model

Normalize every tagging — regardless of family member — to one tuple:

```
Tagging = {
  tag:      { authorPubkey, slug },   // the SHARED tag-element identity (canonical, edit-stable)
  target:   { type, ref },            // type: 'profile'|'event'|'address'|…  ref: pubkey|eventId|aCoord
  stance:   'apply' | 'dispute',      // from polarity
  asserter: pubkey,                   // who asserted
  eventId, createdAt,                 // the assertion's own id/time (dedupe, latest-wins, display)
}
```

Canonical tag key = **`authorPubkey:slug`** (the coordinate), NOT the tag-element's event id — the coordinate survives edits, and `available-tags` already maps `eventId ↔ (authorPubkey, slug)`. This is what lets a tag used on a profile AND a note merge into one row.

### The family registry — the extensibility seam

```
TaggingFamilyMember = {
  name,                                    // 'nostr-user-tag' | 'nostr-event-tag' | future
  conceptZ(taPubkey),                      // concept handle marking this member's assertions
  extractTag(assertion, ctx) → {authorPubkey, slug} | null,   // ctx carries resolved headers etc.
  extractTarget(assertion) → {type, ref} | null,
}
```

Each member encapsulates how to pull the tag + target out of **its own wire shape** — so we normalize *existing* events without changing them:

- **`nostr-user-tag`** — `extractTag` reads the direct `a`/`e` tag-element ref; `extractTarget` reads `p` → `{type:'profile', ref:pubkey}`.
- **`nostr-event-tag`** — `extractTag` resolves descriptor-`z` → header → header's `a` (tag-element coord); `extractTarget` reads `e`/`a` → `{type:'event'|'address', ref}`. (This is exactly the gating `classifyEventTaggings` already does.)
- **future** (`nostr-article-tag`, `nostr-community-tag`, tag-of-tag…) — register a member; nothing else changes.

### Read-time normalization (pure core, SDK-inherited)

```
normalizeTaggings({ assertions, headers, members, honoredAuthorities }) → Tagging[]
```

Pure, dependency-free, in the core. Given kind-39999 assertions (scanned by the union of member concept-`z`s) + any resolved headers, it maps each to the tuple via the matching member, applying the shared legitimacy gate (honored authority) once.

Then **generic aggregators** over the normalized stream (also pure core), replacing the per-type ones:

- `indexByTag(taggings, { isAsserterTrusted, viewerPubkey })` → per-tag counts **across all target types** → feeds `/tags`.
- `forTag(taggings, tag)` / `groupByTarget(…)` → per-tag and per-target reads, target-type-agnostic (subsume `classifyEventTaggings` + `groupTaggingsByTarget` + the profile-tag aggregations).
- `searchTags(taggings, q)` → name search over the unified set.

The shared machinery — **POV trust, honored-authority, `mine`, latest-wins dedupe** — runs **once** over the normalized stream, not re-implemented per member.

## How the app consumes it (thin adapters)

- **Server**: a scan of `{kinds:[39999], '#z':[…all member conceptZs…]}` (+ header resolution for members that need it) → `normalizeTaggings` → the aggregator the endpoint needs. New unified reads (the `/tags` index that counts notes) use this directly. Existing per-type endpoints can be **refactored onto it behavior-preservingly** — later, and only if their output contracts stay identical.
- **UI**: unchanged surfaces keep working; `/tags` and search start showing the whole universe.

## Constraint check

- **No protocol/write change** ✅ — writes (`publishProfileTag`, `applyEventTagging`), wire shapes, concept-`z`s, headers all untouched; we only *read* them differently.
- **SDK inherits** ✅ — normalizer + registry + aggregators are dependency-free core; a third party lifting the core gets unified reads.
- **No constraints on others** ✅ — pure local interpretation; nothing published, nothing required of other publishers.

## Compatibility / migration (profile-tagging is LIVE)

Non-negotiable: don't break the live profile-tagging reads.

- The unified core is **additive** — new modules, no change to existing endpoints' contracts.
- **Phase 1**: build the core (normalizer + registry + two members + aggregators) with its own tests. Wire ONLY the new unified reads (the `/tags` index counting notes; unified search).
- **Phase 2 (optional cleanup, later)**: migrate `/api/profile-tags/*` and `/api/event-tags/*` internals onto the normalizer, output contracts unchanged, deleting the duplicated per-type aggregation. Never a big-bang.

## Decisions to make (let's resolve these in discussion)

1. **Core location/naming.** Extend `src/lib/event-tagging` (already the SDK seed) into a `taggings` normalization module, or a new `src/lib/taggings` that event-tagging + the new profile-tag extractor both live under? (Leaning: a `taggings` normalization layer in the same core folder, so there's one SDK.)
2. **Canonical tag key = `authorPubkey:slug`** (coordinate) — agreed? (vs the tag-element eventId profile-tags currently key on.)
3. **Header resolution for the index.** Event-tag extraction needs the per-tag headers; the index scan must resolve them across the whole set. Bounded/cheap (headers are few per tag) — confirm acceptable.
4. **`mine` in the index.** Should `/tags` also reflect the viewer's own taggings (a tag you used on a note appears even if the POV doesn't count you), consistent with Stories 7–8? (Leaning: yes — same principle.)
5. **How much to migrate now.** Phase 1 only (new unified reads), or also refactor the live endpoints in the same effort? (Leaning: Phase 1 now; Phase 2 as a separate, low-risk cleanup.)
6. **Presentation on `/tags`.** Combined total with a profile/note breakdown, or separate figures? (Design, deferrable.)

## Implementation stories that derive from this (once ratified)

- **Story 9 — Unified tag index**: the core normalizer + registry + `indexByTag`; `/tags` counts notes + profiles. (The tactical Story-9 draft becomes the *first consumer* of the unified core.)
- **Story 10 — Unified tag search** (`searchTags`; the `match` surface spans both).
- **Story 11 — Profile "Tagging Activity" spans notes** (the same normalizer, filtered by asserter).
- **(later) Cleanup** — migrate the existing per-type endpoints onto the normalizer.

## Extension: generalized (target-typed) pinning

Pinning a tag is **the same concept regardless of target type**: freeze a point-in-time snapshot of a tag's curated members into a portable NIP-51 list. The only per-type difference is the **list's element type**:

- profile-tag pin → a list of **pubkeys** → kind-30000 follow-set / the kind-30392 Trusted List (elements are `p`).
- note-tag pin → a list of **note ids** → kind-30003 **bookmark set** (elements are `e`).

Today pinning exists only on the profile side — historical, not conceptual (event-tagging was built create→read first). The unified model absorbs it cleanly: **pinning is another projection over the normalized tagging stream.** Each family member gains its list projection:

```
member.nip51ListKind          // 30000 (profiles) | 30003 (notes) | …
member.targetToListTag(target) // profile → ['p', pubkey] ; event → ['e', id]
member.defaultCuration         // per-type default (rank for people; net-endorsed/recency for notes)
```

Then "pin tag X" = take the normalized taggings for X (grouped by target, POV-filtered / curated) and materialize the member's NIP-51 list kind under the user's key — reusing the existing pin / Trusted-List / export plumbing (`refresh-pinned-tag`, `publishNip51ExportForPin`), generalized. Without unification this would be a third parallel pin stack; with it, it's "register the projection." → **Story 12.** Built in the unified-UI/write pass (operator, 2026-06-30) — pinning is write+UI, so it lands with its consumer, not as a standalone read-core slice.

## Rollout / UI sequencing (operator decision, 2026-06-30)

**Do not ship a partially-unified UI.** A `/tags` (or tag page) that shows the merged universe but keeps pins working only for profiles — or drops pins entirely — is *more* confusing, not less. So:

- **Build the unified server/core first** across the read-parity stories (9 index, 10 search, 11 activity) **and generalized pinning (12)** — all as additive core/endpoints over the normalized stream, live per-type endpoints untouched.
- **Then wire the UI as one coherent pass** — the unified `/tags` list, note-side pins, tag-detail parity — so the app goes from "profile-only" to "unified" in a single, non-confusing step.
- The epic is all-local/unpushed, so this is purely a **sequencing** decision: no unified UI is merged (and nothing ships to staging/prod) until the model is complete. Story 9's server + endpoint are done and tested; its `Tags.jsx` wiring is **held** for the unified UI pass.

## Open risks

- Profile-tag's exact tag-reference shape (the ADR-0022 hybrid `e`+`a`) must be read correctly by its extractor — verify against the live wire.
- Scan cost: unioning all member concept-`z`s over kind-39999 is a broader scan than either alone; bound/paginate the index like Story 8's cap.
