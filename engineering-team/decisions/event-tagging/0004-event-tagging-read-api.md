# ADR 0004: Event-tagging read API

**Status:** Proposed
**Date:** 2026-06-29
**Story:** `engineering-team/stories/event-tagging/4-event-tagging-read-api.md`

## Context

The read endpoints surface, for an event, which tags have been applied and by whom — POV-filtered at read time — plus the discovery a writer needs. The proven template is `src/api/profile-tags/index.js` (pubkey-tag reads): local `strfry scan` (`:72`), replaceable dedup (latest-wins per author+d-tag, `:162`), POV via `resolvePov` from `src/api/_shared/pov` (`:228`) → `wot_rank_<suffix> >= minRank` checked against Meili author docs, polarity read (`:142`) + bucketize (`:148`, `≥0.5` apply / `≤−0.5` dispute / between dropped, default 1), response `{ applications, disputes }` of `{ eventId, authorPubkey, …, polarity, createdAt }`.

Facts that shape this design:

- **The Story-1 core is CommonJS** (`src/lib/event-tagging/index.js` `module.exports`; `require()` verified). The server consumes it **directly** — `filterTagsAppliedToEvent`, `filterTaggingHeadersForTag`, and the handle composers. No ESM shim. (The "ESM problem" does not exist; ADR 0001 chose CJS canonical precisely for this.)
- **The descriptor is indirect (the real divergence from pubkey-tags).** A pubkey-tag assertion names its tag directly in `a`/`e`. An event-tagging assertion's `e`/`a` is the **target**; the tag is reached through a `z` pointing at a per-tag header `39999:<author>:tagging:<slug>-tagging`, which in turn names the tag via its own `a`. So the read must **resolve that header and verify it is legitimate** before it knows which tag (if any) a candidate applies.
- **Sovereignty is a hard AC, not a detail.** Whether a header is "legitimate" = whether it joins a `tagging-with-specific-tag` namespace the **reader honors**. That honored-authority set MUST be a per-POV/reader **parameter** (default canonical + local, overridable), never a hardcoded canonical — else the read silently centralizes the meaning of "a real tagging" (Story-4 AC; spec § "Reading: which taggings count is reader-determined"). And a header that can't be resolved locally is **unverifiable**, distinct from one that resolves and isn't a member (**illegitimate**).

No concept/firmware changes (read-only) → no reinstall.

## Options considered

### Where the legitimacy authority comes from

**Option A — `authorities` request parameter, default `[canonical, localTA]` (recommended).** The endpoint accepts an optional `authorities` (CSV of 64-hex pubkeys); the honored `tagging-with-specific-tag` namespaces are `{39998:<A>:tagging-with-specific-tag | A ∈ authorities}`. Default = `unique([CANONICAL, runtime TA])`.
- **Pros:** Satisfies the sovereignty AC directly — authority is reader-chosen, default convenient, fully overridable. The default still federates around canonical (consistent with the rest of the epic).
- **Cons:** One more param to thread; the `CANONICAL` literal is an app constant (the ADR-0015 legacy pubkey) living in server read code — acceptable (it is *a default*, not the only value; same posture as `profile-tags`' z-composition literal).

**Option B — hardcode the canonical namespace.** Rejected by the story AC: collapses the per-POV property, makes splinters unreadable.

**Option C — derive the authority only from runtime TA (local-only).** Rejected: a non-canonical deployment would then *not* count canonical taggings by default — breaks the federation default the epic chose. The parameter (Option A) subsumes this (`authorities=<ownTA>` gives local-only when desired).

### Candidate scan breadth

**Option D — scan by target only (`#e`/`#a`), classify by descriptor at read time (recommended).** Namespace-agnostic candidate set (spec requirement); a candidate is an event-tagging iff it carries a descriptor `z` (`/^39999:[0-9a-f]{64}:tagging:.+-tagging$/`); legitimacy is then decided by resolving that header against the honored set.
- **Pros:** A divergent publisher's taggings are always *present*; only "counts" depends on the honored authority — exactly the sovereignty model. No namespace gate at scan time.
- **Cons:** The scan may return unrelated kind-39999 events that `#e` the target; they're filtered out by "has no descriptor z". Acceptable; a later optimization MAY narrow by honored `nostr-event-tag` `#z` *as a performance hint only* — never as the legitimacy gate.

## Decision

**Option A + Option D.** A new CJS module `src/api/event-tags/` mirroring `profile-tags`, consuming the Story-1 core directly. Legitimacy authority is the `authorities` parameter (default `[CANONICAL, runtime TA]`, dedup'd). Candidate scan is target-keyed and namespace-agnostic; classification resolves each candidate's descriptor header and verifies honored-authority membership at read time, distinguishing **counted / illegitimate / unverifiable**. POV filtering and polarity bucketing reuse the `profile-tags` machinery verbatim.

Open questions resolved: **(1) response shape** — per-tag grouping of `applications`/`disputes` (same entry shape as `tags-for-profile`) plus a top-level `unverifiable` list; **(2) applicable tags** — **reuse `GET /api/profile-tags/available-tags`** (same shared `tag` concept), no new endpoint.

## Consequences

- **Enables** Story 5 (write path) and Story 6 (UI) to read a note's tags per-POV and to check whether a tag already has a header.
- **Sovereignty preserved in code:** the honored-authority set is a parameter; the default federates but anyone can override; unverifiable is never silently dropped. The Reviewer must reject any diff that hardcodes a single authority or conflates unverifiable with illegitimate.
- **Cost:** the reverse path is a per-distinct-descriptor header resolve (extra scans vs the direct `a`-read of pubkey-tags). Bounded by the number of *distinct tags* on the target and cached within a request. Heavier-than-pubkey-tags is expected; optimization deferred (story out-of-scope) unless measured.
- **Local relay only**, read-only; no external fetch, no writes, no firmware. The `CANONICAL` default literal is an app constant (ADR-0015 lineage), used only as a *default authority* — not a hardcoded gate.
- **Firmware reinstall required?** No.

## Implementation notes

### Module: `src/api/event-tags/index.js` (CJS), wired in `src/api/index.js`
`const core = require('../../lib/event-tagging')` for filter builders + handle composers. `const { resolvePov } = require('../_shared/pov')`. Reuse `profile-tags`' `scanStrfry`, `dedupeReplaceable`, `readPolarity`, `bucketize`, and the Meili author-rank check (extract to a shared helper or mirror; Implementer's call — keep it DRY where cheap).

### Authority resolution (shared helper)
`resolveAuthorities(req)` → from `req.query.authorities` (CSV of `/^[0-9a-f]{64}$/`) if present, else `unique([CANONICAL, getOwnerAssistantPubkey()])`. `CANONICAL` = the ADR-0015 legacy literal (app constant, documented as *a default authority*, overridable). Honored header namespaces = `authorities.map(core.conceptTaggingWithSpecificTag)`.

### `GET /api/event-tags/for-event`
Params: `eventId` (kind-1 note) **or** `address` (a-coordinate); `wotPov` (`house`|`user`, default house), `userPubkey`; `authorities` (optional).
1. `filter = core.filterTagsAppliedToEvent({ target: eventId ? {id:eventId} : {address} })`; validate exactly one target; malformed → 400, not 500.
2. `scanStrfry(filter)` → `dedupeReplaceable`.
3. For each candidate, find its descriptor `z` matching `/^39999:[0-9a-f]{64}:tagging:.+-tagging$/`. No descriptor → not an event-tagging, skip.
4. Resolve each **distinct** descriptor header once (cache per request): scan `{ kinds:[39999], authors:[<author>], '#d':['tagging:<slug>-tagging'] }`, dedup. Classify:
   - **legit** if the header carries a `z` ∈ honored namespaces → read the header's `a` → the tag-element coord/slug (the tag identity).
   - **illegitimate** if header resolves but no honored `z` → exclude.
   - **unverifiable** if header not found locally → collect into `unverifiable`.
5. POV-filter asserters (`resolvePov` → Meili `wot_rank_<suffix> >= minRank`; when no POV, mirror `profile-tags` default).
6. Group legit, POV-passing candidates by tag; bucket by polarity.

Response:
```
{ success, target: {id}|{address}, povSuffix, minRank, authorities: [<pk>…],
  tags: [ { tag: { authorPubkey, slug }, applications: [entry…], disputes: [entry…] } … ],
  unverifiable: [ { eventId, authorPubkey, descriptor: '<header coord>', createdAt } … ] }
```
`entry = { eventId, authorPubkey, polarity, createdAt }` (mirrors `tags-for-profile`). Illegitimate candidates are excluded (optionally a `dropped` count); unverifiable are surfaced, never dropped.

### `GET /api/event-tags/headers-for-tag`
Params: `tagAuthor` (64-hex), `slug`; `authorities` (optional). Uses `core.filterTaggingHeadersForTag({ tagAuthorPubkey, slug, taPubkey })` per honored authority (or scan the headers by their `a` → tag-element and filter to honored `z`). Returns `{ success, headers: [ { author, headerCoord, authorities: [<which honored z it carries>] } … ] }` — empty when none, so a writer can decide whether to create a header. Distinguish unverifiable here too if relevant.

### Applicable tags
No new endpoint — clients call the existing `GET /api/profile-tags/available-tags` (same `tag` concept). Document the reuse.

## Out of scope
- Writes/publishing (Story 5); UI (Story 6).
- Fetching a **remote** relay's events (local relay only); honoring multiple authorities over locally-available data is in scope, remote union is not.
- Reverse-lookup caching/perf optimization (deferred unless measured); graded-polarity valence (W3).
