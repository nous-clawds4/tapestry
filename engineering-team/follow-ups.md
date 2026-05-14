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

## Login-button loading state

**Surfaced during:** Story 4 implementation, 2026-05-14.

The "Sign in with nostr" button (in `BrainstormUserMenu` / the local `UserMenu` in `BrainstormSearch`) gives no visible feedback while the NIP-07 auth handshake is in flight. Users can't tell whether the click registered, whether the extension prompt is loading, or whether something failed silently. Add a loading state — disable the button, swap label to "Signing in…" or similar, and surface errors inline. Pick up in a future small-fixes round alongside other UX polish.

## Community tag-activity surfaces

**Surfaced during:** Story 5 planning, 2026-05-14.

Future story (loose scope, to be brainstormed when we get there): richer relationships derivable from the tag graph. Sketches:

- "This person tagged that person who tagged this person" — chained tagging traversals.
- Reciprocal tags — tightly-knit networks where members tag each other similarly.
- Cluster discovery via overlapping tag patterns.
- Tagger reputation ("this person's tags get agreed with often / their disputes hold up under scrutiny").

Will revisit and brainstorm more relationships before writing acceptance criteria.

## Agree/disagree framing — UX normalization across tag surfaces

**Surfaced during:** Story 5 ADR (ADR-0005), 2026-05-14.

Story 5 introduces a per-row peer annotation (`+N agree` / `−M disagree`) and a `Most-backed` sort key on the new TAGGING ACTIVITY section. The underlying concept — WoT peer-count for a `(tag, target)` pair — already lives in the other tag views, but is labelled inconsistently:

- **Tag-detail page (Tag.jsx):** row counts `+N / −M` are exactly the peer counts for `(this tag, this row's target)`. The `applied` / `disputed` sort modes are de-facto "most-backed (applied)" / "most-backed (disputed)". Could be relabelled or have the agree/disagree framing added inline.
- **Profile TAGS chips (ProfileTagsSection):** chip counts are peer counts for `(this tag, this profile)`. Popover shows asserter lists split into "applied by" / "disputed by." Could reframe as "N agree, M disagree" intro line for legibility.

Either light copy work (re-label) or richer affordances (e.g., adopt the same `<span class="...-peer">` annotation pattern from Story 5). Defer until Story 5 lands in production and we can see how the new annotation reads on a real profile.

**Bundle candidate:** could ride Story 6's polish pass, or its own small story.

## WoT-author filter on profile TAGS chips

**Surfaced during:** Story 5 ADR (ADR-0005), 2026-05-14.

`GET /api/profile-tags/tags-for-profile` (the endpoint that feeds the chip-row on `ProfileTagsSection`) does **not** WoT-filter assertion authors — it returns every assertion against the target pubkey regardless of who authored it. This predates the POV-first invariants becoming explicit (CLAUDE.md), and violates them: the chip counts are not POV-scoped.

Fix: extend `handleTagsForProfile` to accept `wotPov` + `userPubkey`, resolve POV via `resolvePov` (the same helper Story 2/3/4 use), and filter applications/disputes to authors whose `wot_rank_<povSuffix> >= minRank`. Mirror the fallback rule (no POV → all assertions count, matches existing endpoints' degradation).

Same pattern as the WoT-author filter in `handleProfilesTagged` and `handleTagIndex`. Small server-side change; the UI already passes the user's pubkey via `viewerPubkey` (we'd add the POV resolution alongside it).

**Bundle candidate:** standalone bug-fix story, or fold into a "POV-correctness audit" sweep that re-checks every read endpoint against the POV-first invariant.

## Local dev-loop polish — kill the six-step CSS edit ritual

**Surfaced during:** Story 5 implementation, 2026-05-14.

The current local dev loop (documented in `OPERATIONS.md` §9) for tweaking the UI is: `docker cp` source into the container → `npm run build` inside the container → check bundle hash → hard-refresh browser. Each CSS tweak is ~15–20 seconds of build + 5–10 seconds of shell ritual. A one-line CSS fix turns into a 30-second cycle, several times per visual iteration.

Two tracked candidates, both already named in OPERATIONS.md §9:

1. **`docker-compose.dev.yml` overlay with bind-mounts** — mounts host `./src` and `./ui/src` into the container at the same paths. Combined with `vite --watch`, this would give true hot-reload for UI work. Right long-term fix; needs design thought for HMR + Express static-file serving co-existence.
2. **`bin/dev-sync-ui.sh` one-liner wrapper** — stop-gap until #1 lands. Wraps the `docker cp` + `npm run build` + bundle-hash echo. ~10 lines of bash. Turns the six-step ritual into one command.

**Bundle candidate:** standalone small story, or fold into an "ops polish" sweep with the agree/disagree framing UX work above.

## Revisit nostr-user-tag wire shape: `e` vs `a` (vs `u`) for the parent-tag reference

**Surfaced during:** /discuss session, 2026-05-14.

ADR-0001 shipped the `nostr-user-tag` assertion using an `e`-tag to reference the parent tag-element. The tag-element itself is kind 39999 (parameterized replaceable), so by NIP-01 convention an `a`-tag (`39999:<tagAuthor>:<slug>`) would address the slot rather than pin a specific frozen event. Trade-offs:

- `e` (current) — survives author edits as a fixed reference to the version-at-apply-time; doesn't survive kind-5 deletion of that specific event id; matches the pre-Story-1 relay-tag precedent.
- `a` — NIP-01 conventional for replaceable events; survives tag-author edits and per-event deletes; loses "which version did I apply" provenance.
- `u` (uuid) — not Nostr-native; skip unless `a` can't carry the load.
- Hybrid (`e` + `a` together) — small wire overhead, future-proof, lets read endpoints choose grouping granularity. Probably the right answer if revisited before too many assertions accumulate.

Slug-collision behavior is the same under either reference scheme (both commit to a specific author).

**Bundle candidate:** standalone ADR that partially supersedes ADR-0001's wire-shape section. Modest migration cost, scales with assertion volume — better sooner than later if a switch is on the table.
