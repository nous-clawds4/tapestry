# ADR 0001: nostr-event-tag — wire format and stack-complete slice for tagging kind-1 notes

**Status:** Proposed — **WIRE FORMAT BLOCKED** pending protocol ratification (worksheet W13). Do **not** implement wire-dependent parts.
**Date:** 2026-06-18
**Story:** `engineering-team/stories/event-tagging/1-publish-and-read-event-tags.md`
**Epic:** event-tagging (book 1)

## ⚠ Superseding direction — read first (2026-06-18)

The design discussion moved past this ADR's wire format. The tag-element is **no longer** referenced by a dedicated letter (`a`/`T`/`o`/`w`); a tagging is modeled as **membership** — the assertion `z`-points at the applied tag-element (the *predicate*), reinterpreted by a **header-declared tag-role schema**, with the **subject** on `e`/`a`. This dissolves the dual-`a` collision *by construction* (predicate on `z`, subject on `e`/`a` → one `a` max, articles included) and spends **no new letter**. The mechanism — *the concept header is the interpretation authority for its items' tags* — is captured in **worksheet [W13](../../../protocols/worksheet.md#w13)** and is a Tapestry-concepts-wide protocol decision, larger than this book.

**Per the protocol author (2026-06-18): ratify W13 with the team BEFORE implementing — no provisional/interim wire** (provisional shapes are exactly how the pubkey-tagging reference model calcified into legacy). This engineering book is therefore **paused at the Architecture gate** until W13 lands, after which this ADR is revised to the ratified shape (or superseded).

**What survives W13 unchanged** (non-wire structural decisions, still good): Option A — extract shared scan/federate/dedupe/WoT primitives to `src/api/_shared/`; a sibling `src/api/event-tags/` module; reuse of the `tag` + `tag-pinning` concepts; the POV/no-write-gating model; federation via the existing read-union; the encryption-reader tolerance contract; the generic `{target, …}` content envelope. **What is mooted by W13:** the dedicated-letter wire shape and the `TAG_ELEMENT_LETTER`/`T` stand-in below — superseded by predicate-as-`z`-membership.

## Context

Tapestry can tag **pubkeys** today (`nostr-user-tag`): anyone publishes a kind-39999 assertion that a pubkey belongs to a community-creatable `tag`, and a POV aggregates those assertions WoT-filtered at read time. The protocol reserves a *taggings family* (`protocols/drafts/tags.md`) whose next member, `nostr-event-tag`, targets **events** — starting with kind-1 notes — with its wire format explicitly unspecified.

This ADR designs the **stack-complete first slice**: protocol → firmware → client write → client read → federation, so the feature is live-validatable, not write-only. Kind 1 is only the first target; nothing in the wire format may be kind-1-specific. The approved story locks the high-level shape; this ADR ratifies the exact form and resolves the five Architect questions.

### Existing assets the design reuses or mirrors

- **Concepts (concept-graph confirmed).** `39998:<TA>:tag` (categories) and `39998:<TA>:tag-pinning` are **reused unchanged**; the `tag` header already declares it categorizes "initially nostr relays, but eventually also profiles, **notes**, and other concepts." A `nostr-event` concept already exists (`firmware/active/concepts/nostr-event/`), aligning with our `target.type:"nostr-event"`. `nostr-relay-tag` exists as a *declared* family member (in the concept graph) but is **not** a built stack (only referenced in `src/utils/customerManager.js`, absent from the active manifest) — not a usable template, but confirms the family's "link a target event id to a tag event id" pattern.
- **Reference implementation.** `src/api/profile-tags/index.js`:
  - scan/federation/dedupe primitives — `strfryScan` (69), `dlistFetch`/`getTagFederationRelays` (95-122), `federatedScan` (131-139), `dedupeReplaceable` (162-173), `dTagOf` (154), `readPolarity` (141)/`bucketize` (148), `isHexPubkey` (65);
  - the read template `handleTagsForProfile` (214-289) — POV resolve (`resolvePov`, `src/api/_shared/pov.js`), `federatedScan` by `kinds/#z/#p`, dedupe, WoT-filter by **asserter** via `meiliFetchProfilesByPubkey` (387) + `wot_rank_<suffix> >= minRank`, polarity-bucket into applications/disputes;
  - `handleAvailableTags` (175-212) — lists tag-elements by `#z=[TAG_Z_TAG]`, **target-agnostic**.
- **Client.** `ui/src/utils/publishProfileTag.js` (`publishProfileTagAssertion`, dual-z, `tag.authorPubkey` guard), `ui/src/hooks/useProfileTags.js` (`createTag` publishes a target-agnostic `tag` element; `useConfig().taPubkey` is the runtime-local z source), `components/ProfileTagsSection.jsx` (inline chip + apply/dispute surface to mirror).
- **Firmware.** Concept defs at `firmware/active/concepts/<slug>/{concept-header.json,json-schema.json}`, mirrored in `firmware/versions/v1.0.0/concepts/`, registered in both `manifest.json` files. Content payload is keyed by the concept's `oKey` (e.g. `nostrUserTag`). Reinstall: `curl -X POST http://localhost:$TAPESTRY_PORT/api/firmware/install` (AGENTS.md §6).
- **Z-tag literal exception.** `LEGACY_Z_TAG_PUBKEY` (`src/api/profile-tags/index.js:49`, ADR-0015) — the canonical pubkey for z-composition of the tag family, distinct from the runtime `TA_PUBKEY` used for author filtering / signing.

### Structural inversion (the one non-obvious correctness point)

In `nostr-user-tag` the target is a pubkey (`#p`) and the tag-element is referenced by `a` (+legacy `e`). In `nostr-event-tag` the **target is the `e` tag** and the tag-element is referenced by **the dedicated letter `T`** (provenance demoted to content). So the read endpoint filters targets by `#e` and reads the tag-element from the **`T` tag** — the mirror of `handleTagsForProfile`, which reads the tag-element from `e`. Copy-paste without this inversion (and without switching the tag-element letter) is the predictable bug.

## Options considered

The wire-format specifics (target=`e`, tag-element=`a`, demoted provenance, dual-z, polarity, d-tag identity, encryption marker) were ratified in planning; this ADR fixes their exact form in §Decision. The genuine architectural fork is **how to structure the server code** relative to the deployed pubkey stack.

### Option A — Sibling module + extract shared primitives to `src/api/_shared/` (chosen)
New `src/api/event-tags/index.js`. Extract the **target-agnostic** primitives now private to `profile-tags/index.js` — `strfryScan`, `dlistFetch`, `getTagFederationRelays`, `federatedScan`, `dedupeReplaceable`, `dTagOf`, `readPolarity`, `bucketize`, `isHexPubkey`, and a `wotAuthorFilter({authorPubkeys, povSuffix, minRank})` (the asserter→meili→`wot_rank` check) — into `src/api/_shared/tagScan.js`. Both modules consume it. `pov.js` is already shared there.
- **Pros:** No drift on subtle correctness logic (federation graceful-degrade, replaceable dedupe, polarity buckets are easy to diverge and hard to notice). Directly advances the stated long-term goal of unifying the tagging strategies. The extraction is pure-function, behavior-preserving.
- **Cons:** Touches the deployed pubkey stack (regression surface) — mitigated by keeping it a mechanical move of pure functions and re-running profile-tags coverage.

### Option B — Sibling module + copy primitives
New `src/api/event-tags/index.js` with its own copies of the scan/dedupe/polarity helpers; `profile-tags` untouched.
- **Pros:** Zero risk to the deployed stack; fastest.
- **Cons:** Two copies of federation/dedupe/polarity logic that must be kept in sync by hand; entrenches divergence right as the family is meant to converge.

### Option C — Generalize `profile-tags` into one target-parametrized module now
Refactor the 1600-line module into a single engine parametrized by target type (`p` vs `e`, profile-meili vs event-hydration enrichment).
- **Pros:** Maximal DRY; one place for the whole family.
- **Cons:** A big-bang refactor of live, deployed, multi-story code (pins, TL export, authored-by, index) for a v1 that needs only one new read path. High regression risk, poor effort/reward, premature before the family's shape is proven by a second member. This is the eventual direction, not this book's.

## Decision

**Option A.** Sibling `src/api/event-tags/` module consuming extracted shared primitives in `src/api/_shared/`. Reuse `tag` + `tag-pinning` concepts and the `available-tags` endpoint; add exactly one new read endpoint and one new concept. The full wire format and resolutions:

### Wire format — `nostr-event-tag` assertion (kind 39999)

```jsonc
{
  "kind": 39999,
  "tags": [
    ["d", "event-tag-<tagAuthor[0:8]>-<tagSlug>-<targetEventId[0:8]>-<asserter[0:8]>"],
    ["e", "<targetEventId>"],                         // TARGET note — standard nostr letter (e=event)
    ["T", "39999:<tagAuthorPubkey>:<tagSlug>"],       // TAG-ELEMENT — dedicated letter (glyph TBD; T is a stand-in)
    ["p", "<noteAuthorPubkey>"],                      // optional: author of the tagged note
    ["z", "39998:<LEGACY_Z_TAG_PUBKEY>:nostr-event-tag"], // canonical — federation identity
    ["z", "39998:<runtimeTaPubkey>:nostr-event-tag"],     // local — runtime TA (omitted if missing)
    ["polarity", "1"]                                 // "1" apply / "-1" dispute (absent = apply)
  ],
  "content": "{\"nostrEventTag\":{\"target\":{\"type\":\"nostr-event\",\"id\":\"<targetEventId>\",\"author\":\"<noteAuthorPubkey>\"},\"tag\":{\"address\":\"39999:<tagAuthorPubkey>:<tagSlug>\",\"version\":\"<tagEventId>\"}}}"
}
```

> **⚠ Provisional glyph — `T` is a stand-in, not ratified.** The tag-element rides a **dedicated single-letter tag** (see resolution (b) and worksheet **W12**), shown here as `T` purely for readability (it replaces the earlier `‹X›`). The final letter is undecided and `T` itself is already claimed (NIP-CC geocaching) and cuts against the W2 lowercase-direction principle — so it will likely change. **The letter MUST be settled before any `nostr-event-tag` events are published** (net-new ⇒ zero migration for us). Implementation that doesn't depend on the glyph may proceed; the publisher/reader must read the glyph from one named constant so a later change is a one-line edit.

### Resolutions to the story's five questions

**(a) d-tag identity — keyed on the tag-element, not the slug.** `event-tag-<tagAuthor[0:8]>-<tagSlug>-<targetEventId[0:8]>-<asserter[0:8]>`. This yields exactly one live stance per **(asserter, target note, tag-element)**. The pubkey shape keys on `slug` alone (`publishProfileTag.js:58`), so two same-slug tag-elements from different authors collide for one asserter+target — a latent bug; `nostr-event-tag` includes `tagAuthor[0:8]` to fix it here. (Fix-forward for the pubkey shape is noted as a follow-up, **out of scope**.)

**(b) Family target disambiguation + the dedicated tag-element letter (strengthened — see W12).** The planning-phase "over-fetch is fine" framing was upgraded after recognizing the collision is *not* a `dlist-tag`-only edge case: **longform articles (kind 30023) are addressable events tagged by THIS concept**, so the dual-reference collision lands the moment we tag an article (imminent), and it is bidirectional (tagging a tag is meaningful). Decision — layer references by whose semantics they are:
- **Target → standard nostr letters, never overloaded:** `e` (event), `a` (addressable: articles/dlist items), `p` (pubkey), `r` (URL). Generic nostr tooling reads these correctly. (Aligns target *vocabulary* with NIP-32 Labeling; **diverges on semantics** — we keep `polarity`, the `z` concept handle, and WoT aggregation; NIP-32's `L`/`l` namespace/label model is not adopted.)
- **Tag-element → a dedicated Tapestry single-letter tag** (`T` stand-in, glyph TBD), used uniformly across the family. This is what makes the hot aggregation path (`#T=[tagCoord]`) relay-filterable and collision-free for *every* target type, in both directions, with no over-fetch. Per NIP-01 only single-letter tags are relay-indexed, so a dedicated letter is the *only* way to keep this filterable. The inner `content.target` envelope stays authoritative for *reading* the target.

This is wire-format and cross-NIP-consequential, so the **glyph choice and whether deployed `nostr-user-tag` migrates from `a` to the letter are routed to the protocol-spec lane (worksheet W12)** for the protocol author + team to ratify; they are *not* decided in this engineering ADR. What this ADR fixes: net-new `nostr-event-tag` references its tag-element by the dedicated letter (not `a`), read from one named constant, and the letter is settled before any such event is published. `nostr-user-tag` is untouched by this story regardless of the migration outcome.

**(c) Encryption forward-compatibility (reserved, not built).** v1 publishes only public taggings and **never emits** an encryption marker. The contract:
- **Reserve** `["encrypted", "<scheme>"]` as a top-level marker; its *absence* means plaintext/public.
- **Tolerant reader (all read/aggregate paths):** skip any event that (i) carries an `encrypted` marker, (ii) has `content` that fails to parse as the expected envelope, or (iii) is missing the references it needs (`a`, or `e` for target scans) — *skip, never throw, never count*. "Cannot read it" ⇒ omit.
- **Counted fields stay top-level** (`a`, `e`, `z`, `polarity`, author) — the aggregator must never depend on anything that lives *only* in `content` (provenance there is read for display only). This makes future encrypted variants opt out of cross-author aggregation gracefully; in the POV model they are simply visible only from a key-holder's POV. Key distribution is orthogonal and out of scope.

**(d) Tag picker — reuse.** Tag *selection* and *creation* are target-agnostic. Reuse the existing `GET /api/profile-tags/available-tags` endpoint for the picker, and a shared tag-element publisher for "create tag" (see Implementation). No new picker endpoint/UI; the new `EventTagsSection` composes the existing selection affordance. (Naming debt — `profile-tags/available-tags` serving event surfaces — is accepted for v1 and folded into the eventual family-unification refactor, Option C territory.)

**(e) Provenance is point-in-time — confirmed.** `content.tag.version` records the tag-element event id **at apply time** and is never updated when the tag-element is later edited. `content.tag.address` (the a-coord) is the stable identity that tracks edits. Matches the pubkey precedent (`e`=version, `a`=stable).

### Concept & content-key reconciliation

New concept **`nostr-event-tag`** with `oKey.singular = "nostrEventTag"`. To satisfy both the firmware content-key convention (top-level key = concept `oKey`) **and** your goal of a reusable, target-generic schema: the content is **concept-keyed on the outside, generic on the inside** — `{ "nostrEventTag": { "target": {…}, "tag": {…} } }`. The **inner `{target, tag}` envelope is identical across the whole family** (a future `url-tag` differs only in `target.type`/payload and its outer `oKey`), so the schema *is* reusable; the outer key is just the per-concept discriminator every family member already carries. This directly answers the planning concern ("the key should be generic like `target`, not `nostrEventTag`"): both — `target` is the reusable inner envelope, `nostrEventTag` is the firmware-required outer wrapper.

### ADR-0015 extension (authorization)

This ADR **extends ADR-0015's named-literal exception** to add `nostr-event-tag`: its canonical `z` handle is composed with `LEGACY_Z_TAG_PUBKEY` (`39998:<LEGACY_Z_TAG_PUBKEY>:nostr-event-tag`), exactly as `tag`/`nostr-user-tag`/`tag-pinning` are, so independent deployments agree on the concept identity and it federates. A runtime-local `z` (`39998:<runtimeTaPubkey>:nostr-event-tag`) is *also* emitted (W11 dual-z). Every *other* use of the TA pubkey (author filtering, signing) uses the runtime resolver. Per CLAUDE.md, this ADR is the required authorization for the literal in the new publisher/server constants; a reviewer must check the literal appears only in z-composition.

## Consequences

- **Enables** publishing and reading WoT-filtered tags on kind-1 notes on David's Profile-Feed and event-ID-search surfaces, federating via the existing opt-in read-union; establishes the reusable `{target, tag}` content envelope and the family target-reference rule for future members (events→URLs).
- **Constrains / debt:**
  - Extraction touches the deployed `profile-tags` stack — bounded to a behavior-preserving move of pure functions; Tester re-runs existing profile-tags coverage as a regression guard.
  - `profile-tags/available-tags` now serves event surfaces under a profile-namespaced URL (accepted naming debt → family-unification refactor).
  - The pubkey-shape `d`-tag slug-collision bug is *not* fixed here (fix-forward follow-up).
  - **Two protocol decisions are pushed to the W12 spec lane and gate first-publication, not implementation:** the final tag-element glyph (`T` is a provisional stand-in, already-claimed) and whether deployed `nostr-user-tag` migrates from `a` to the letter. The code isolates the glyph behind one named constant so ratification is a one-line change.
- **Firmware reinstall required?** **Yes** — a new `nostr-event-tag` concept is added (header + schema + manifest registration). Reinstall via the AGENTS.md §6 curl after the files land; concept-graph orientation must then show the new handle.
- **Protocol spec:** `protocols/drafts/tags.md` § "Event tagging (planned)" is ratified from placeholder to normative (docs-mode companion) describing the wire format above.

## Implementation notes

Concrete targets for the Implementer. Mirror the cited `profile-tags` code; apply the structural inversion.

**Shared extraction (server):**
- New `src/api/_shared/tagScan.js` — move (behavior-preserving) from `src/api/profile-tags/index.js`: `strfryScan`, `dlistFetch`, `getTagFederationRelays`, `federatedScan`, `dedupeReplaceable`, `dTagOf`, `readPolarity`, `bucketize`, `isHexPubkey`. Add `wotAuthorFilter({ authorPubkeys, povSuffix, minRank })` returning an `allowed(pubkey)` predicate (extracted from `handleTagsForProfile:244-254` + `meiliFetchProfilesByPubkey`). Keep `meiliFetchProfilesByPubkey` shared too (it's a generic pubkey→profile-doc fetch). Export `LEGACY_Z_TAG_PUBKEY` or keep per-module constants — Implementer's choice, but the literal's sole use stays z-composition.
- `src/api/profile-tags/index.js` — replace the moved private fns with imports from `_shared/tagScan.js`. No behavior change.

**New server module:**
- New `src/api/event-tags/index.js`:
  - Constants: `NOSTR_EVENT_TAG_Z_TAG = 39998:<LEGACY_Z_TAG_PUBKEY>:nostr-event-tag`; **`TAG_ELEMENT_LETTER = 'T'`** — the single named constant for the dedicated tag-element letter (W12; glyph provisional, change in one place). Use it everywhere instead of a literal `'T'`.
  - `GET /api/event-tags/tags-for-event?eventId=<hex>&wotPov=&userPubkey=` — mirror `handleTagsForProfile` with the **inversion**: `federatedScan({ kinds:[39999], '#z':[NOSTR_EVENT_TAG_Z_TAG], '#e':[eventId] })`; `dedupeReplaceable`; `wotAuthorFilter` by asserter; for each surviving event read the **tag-element from the `T` tag** (`tagAddress`, via `TAG_ELEMENT_LETTER`) and, defensively, `content.nostrEventTag.tag.version` (`tagEventId`, optional); apply the **tolerant-reader skips** (encrypted marker / unparseable content / missing tag-element ref); bucket by polarity into `applications`/`disputes`, each entry `{ eventId, authorPubkey, tagAddress, tagEventId, polarity, createdAt }`. Return `{ success, eventId, povSuffix, minRank, applications, disputes }`.
  - Register `registerEventTagsRoutes(app)` and wire it where `registerProfileTagsRoutes` is wired (find its call site).
  - **Picker:** no new endpoint — client reuses `/api/profile-tags/available-tags`.

**Client publisher:**
- New `ui/src/utils/publishEventTag.js` — `publishEventTagAssertion({ tag, targetEventId, targetEventAuthor, polarity, localTaPubkey })`, mirroring `publishProfileTag.js`: keep the `tag.authorPubkey` 64-hex guard (no e-only fallback); `export const NOSTR_EVENT_TAG_HANDLE = 39998:<LEGACY>:nostr-event-tag`; **`export const TAG_ELEMENT_LETTER = 'T'`** (single source for the glyph — W12, provisional); build `d` per (a); tags `e=targetEventId` (target), `[TAG_ELEMENT_LETTER, '39999:'+tag.authorPubkey+':'+tag.slug]` (tag-element — **not `a`**), optional `p=targetEventAuthor` (only if 64-hex), canonical `z` + conditional local `z`, `polarity`; `content = { nostrEventTag: { target:{type:'nostr-event', id:targetEventId, author:targetEventAuthor||undefined}, tag:{address, version: tag.eventId} } }`; reuse `publishOrThrow`. Never emit an `encrypted` tag. Keep the server's `TAG_ELEMENT_LETTER` and this one in sync (or share one source) — they MUST match.
- Shared tag-element create: extract `createTag`'s body from `useProfileTags.js:106-141` into a shared util (e.g. `ui/src/utils/publishTagElement.js`) consumed by both hooks, OR have `useEventTags` import `createTag` logic — Implementer's call; avoid duplicating the dual-z tag-element publish.

**Client read hook + surface:**
- New `ui/src/hooks/useEventTags.js` — mirror `useProfileTags`: params `(targetEventId, targetEventAuthor, viewerPubkey)`; fetch `/api/profile-tags/available-tags` + `/api/event-tags/tags-for-event?eventId=…` with the same POV-param logic (`wotPov=user`+`userPubkey` when logged in, else `house`); expose `availableTags, applications, disputes, my*, loading, error, refetch, applyTag, disputeTag, createTag`. `applyTag/disputeTag` call `publishEventTagAssertion({…, localTaPubkey: taPubkey})` then `refetch()`. **No pin/TL re-export** (`syncPinnedExportsForTag`) — pinning is out of scope for events.
- New `ui/src/components/EventTagsSection.jsx` — inline chip row + add/dispute affordance for one note, mirroring `components/ProfileTagsSection.jsx`. Props: `{ eventId, eventAuthor, viewerPubkey }`. Self-contained so David mounts it per kind-1 note on the Profile Feed and event-ID-search renderers. Match chips to display metadata by `(authorPubkey, slug)` from `available-tags` (the `a` coord), falling back to `tagEventId`.
- **Integration contract for David:** `<EventTagsSection eventId={note.id} eventAuthor={note.pubkey} viewerPubkey={user?.pubkey} />`. Coordinate mount points; this ADR does not edit his in-progress feed/search files.

**Firmware concept:**
- New `firmware/active/concepts/nostr-event-tag/concept-header.json` + `json-schema.json`, and the mirror under `firmware/versions/v1.0.0/concepts/nostr-event-tag/`. Copy `nostr-user-tag/` and adapt: `oKey.singular="nostrEventTag"`, slugs/names "nostr event tag(s)", description ("…assertion that a specific nostr event belongs to a tag category; links a target event id (`e`) to a tag-element (the `T` tag, glyph provisional per W12) with optional polarity…"). Schema: `required:["nostrEventTag"]`; `nostrEventTag` object with nested `target` (`{type, id, author?}`, required `type`+`id`) and `tag` (`{address, version}`, required `address`).
- Register `./concepts/nostr-event-tag/` in **both** `firmware/active/manifest.json` and `firmware/versions/v1.0.0/manifest.json` (alongside the `tag`/`nostr-user-tag`/`tag-pinning` entries).
- After files land: `curl -X POST http://localhost:$TAPESTRY_PORT/api/firmware/install`, then verify `GET /api/concept-graph/node/39998:<TA>:nostr-event-tag`.

**Protocol spec (docs-mode):**
- `protocols/drafts/tags.md` — replace the "Event tagging (planned)" placeholder with a normative section for `nostr-event-tag` matching the wire format above (target via standard letters `e`/`a`/`p`/`r`, tag-element via the dedicated letter `T`, demoted provenance in the `{target,tag}` content envelope, dual-z, polarity, d-tag identity, reserved `encrypted` marker, family target-reference convention). Carry the W12 stand-in caveat (glyph provisional) and update the family-tree note and worksheet cross-refs (W2/W4/W10/W12). **This spec edit and the glyph ratification are the docs-mode companion's job and gate first-publication; see the Decision note that the letter must be settled before any `nostr-event-tag` event is published.**

## Out of scope

- `/tag-page` event rows, sorts/filters, and event pin curation (later books).
- Target types beyond kind-1 (articles/`dlist-tag`/addressable, URLs) — the format's target-reference convention (standard letters) + dedicated tag-element letter *cover* them by design, but no non-kind-1 target surface is *built* here. (The convention exists precisely so articles slot in without a wire change.)
- The W12 protocol decisions themselves (final glyph; `nostr-user-tag` migration stance) — owned by the protocol-spec lane, not this engineering ADR.
- Building any encryption (self / ring / recipient) — only the reader/marker contract is reserved.
- Fixing the pubkey-shape `d`-tag slug-collision (fix-forward follow-up).
- Option C family-unification refactor of `profile-tags`.
