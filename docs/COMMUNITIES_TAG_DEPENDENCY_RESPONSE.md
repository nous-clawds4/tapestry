# Response: nostr-user-tag ↔ Communities dependency (settled)

_Draft reply to Avi/David. 2026-06-05._

Agreed on the model — **the Community claims the Tag, not the other way around** (many-to-many). The tag stays exactly as designed: general, person-scoped, community-agnostic. Nothing community-specific goes on it. As David said, the real dependency is just getting the primitive onto the shared branch. Here's everything you need to build against a stable target.

## 1. Confirmed wire shape — consume by `a`

We're resolving the open `e` vs `a` question to a **hybrid `e` + `a`** (ADR-0022, partially supersedes ADR-0001's wire-shape section). The kind-39999 assertion will carry both:

```
["p", "<targetPubkey>"]                    target person
["a", "39999:<tagAuthorPubkey>:<slug>"]    NEW — stable tag identity   ← consume this
["e", "<tagEventId>"]                       version-at-apply-time (provenance)
["z", "39998:<TA>:nostr-user-tag"]          assertion-concept membership
["polarity", "1" | "-1"]                    apply / dispute
```

**Build your roster by scanning `#a` = `39999:<tagAuthor>:<slug>`** — that's the stable identity of the tag and survives the tag author editing the tag-element. Treat `e` as provenance, not identity. Both are single-char indexed tags, so both are fully relay-filterable.

**The "meeting point" you asked about:** the shared label a Community claims is the **tag-element** itself — its `a` coordinate `39999:<tagAuthor>:<slug>`. A Community Declaration names one or more of these coords as its membership signal. No pointer from the tag to the community; the community references the tag.

⚠️ **Two caveats on the wire shape:**
- Assertions published **before** the hybrid lands carry `e` only. A `#a` scan won't see them. Either union `#a` + the legacy `#e` ids during a transition, or we run a one-pass backfill (cheap — assertions are slug-keyed replaceables, so re-emitting with `a` added cleanly replaces them). Volume is small and instance-local. We'll coordinate which you want.
- Because we kept `e`, you can detect tag-definition **drift** in a trust context (compare the live `a`-resolved tag-element against the frozen `e` version). Worth doing for membership, since a tag author can otherwise mutate a tag's meaning under existing assertions.

## 2. Per-POV WoT lookup — how to weight asserters

There is **no single `trust(viewer, target) → score` endpoint.** Trust is pre-computed per delegated pubkey and embedded in Meilisearch profile docs as `wot_<metric>_<8charSuffix>` columns; you gate/sort on it at query time.

- **POV resolution:** `resolvePov({ wotPov, userPubkey })` in `src/api/_shared/pov.js` → `{ delegatedPubkey, povSuffix, minRank }`. `povSuffix` = first 8 chars of the delegated pubkey. `wotPov: 'house'` is the instance default; `wotPov: 'user'` + a `userPubkey` resolves that user's delegated POV.
- **Score field:** read `wot_rank_<povSuffix>` off the asserter's Meili profile doc; gate `>= minRank`.
- **You probably don't need to reimplement the roster math** — `aggregateProfilesTagged({ tagEventId, povSuffix, minRank })` in `src/api/profile-tags/index.js` already scans the assertions, gates asserters by `wot_rank_<suffix> >= minRank`, nets polarity per target, and dedupes replaceables. `applyDisputesFunction(byTarget, cutoff)` does the membership gate. That's exactly the "weight by GrapeRank from the viewer's POV → net polarity → gate by cutoff" you described — over whichever tag-elements the community claims. (We'll generalize it to scan by `#a` as part of the carve-out.)

⚠️ **Caveat:** a `wot_*_<suffix>` column only exists for a POV whose WoT has been **computed/indexed**. The house POV is always there; an arbitrary viewer's POV needs WoT provisioning first. So a per-viewer roster isn't free — that viewer's POV has to exist.

## 3. Delivery — carve-out

We'll **carve out just the tag core** onto staging (not the full profile-tagging UI): the firmware concepts (`tag` / `nostr-user-tag` / `tag-pinning`), `src/api/profile-tags/`, `src/api/_shared/pov.js`, `src/api/trustedList/`, and the publish helpers (relocated to a shared lib). It's cleanly separable — the server core has zero UI imports. That unblocks your membership + trust-signal blocks without waiting on the full branch. We'll bring `feat/pubkey-tagging-target` up to staging right after so the core doesn't double-land.

## 4. ADR refolder

Your `ADR_REFOLDER_RECONCILIATION_PROPOSAL.md` looks right and sits cleanly on the epic-folder scheme already on staging. Ratifying your open items:
- **0007 / 0008** → `search-and-router/` (they're search work).
- **The 4 duplicate ADRs** (`0002/0003/0004/0005`-treasure/scheduled/publish/community) → keep staging's canonical, discard our flat copies (verify no content drift).
- **`brainstorm-communities`** slug for the frozen bespoke-model ADRs — good; understood as frozen, distinct from `community-reference`.
- Note: there's now a new **ADR-0022** (the hybrid `e`+`a` decision above) to fold in alongside the other nostr-user-tag ADRs (→ `profile/`, or a dedicated tagging epic).
