# GO — add decentralized tagging to this Jumble fork

You are working in a fork of **Jumble** (jumble.social), a Nostr kind-1 client. Your job is to add
full support for **decentralized tags** (the Tapestry/Brainstorm tagging protocol) using the
self-contained kit in this folder. Everything protocol-shaped is already written for you; your work
is **integration**: wiring the kit's SDK into Jumble's existing relay pool, signer, routing, and UI
idioms.

Work through this document top to bottom. Do not skip the Ground Rules.

---

## 0. What's in the kit

| Path | What it is |
|---|---|
| `CONFIG.json` | Deployment config: tag-hub relays, instance identity, namespace pubkeys, trust settings. **Read it first.** |
| `sdk/event-tagging/` | The protocol core for tagging **events** (notes). Pure ESM, zero deps: builders (unsigned events), filter builders, classifiers, and the `applyEventTagging` orchestrator. `index.js` re-exports everything. |
| `sdk/profile-tagging.js` | The protocol core for tagging **pubkeys** (profiles) — a simpler, direct wire shape. Builders, filters, `applyProfileTagging` orchestrator. |
| `sdk/trust.js` | The trust seam: builds the `(pubkey) => boolean` predicate every classifier takes, from the house's NIP-85 kind-30382 assertions. Also fetches the published content/profile applicability lists. |
| `protocol/event-taggings.md` | Normative wire spec for event-tagging. Reference — the SDK already implements it. |
| `protocol/trusted-lists.md` | Wire spec for the kind-30392/30393/30394 Trusted Lists trust.js reads. |
| `ACCEPTANCE.md` | The manual test script. You are done when every item passes. |

## 1. Ground rules (violating any of these is a bug)

1. **The SDK owns the wire shape. Never hand-roll a kind-39999 event or a discovery filter.** If
   you need a shape the SDK doesn't export, stop and re-read — it almost certainly does. The SDK
   builders return *unsigned partial* events (`{kind, tags, content}`); you add `pubkey` +
   `created_at`, sign, publish.
2. **Pure relay. Never call the Brainstorm REST API from the browser** — it is not CORS-open and
   every call will fail. All reads are Nostr subscriptions; all writes are Nostr publishes.
3. **No protocol literals in source.** Every pubkey, relay URL, and namespace comes from
   `CONFIG.json` through a single config module you create. The two pubkeys in the config have
   precise, different roles — read the `_comment` keys. If you find yourself typing a 64-hex
   literal in a `.ts`/`.tsx` file, stop.
4. **Relay routing:** tag/tagging *reads* query `CONFIG.tagRelays ∪ (user's read relays)`;
   tag/tagging *writes* publish to `CONFIG.tagRelays ∪ (user's write relays)`. Reuse Jumble's
   existing pool/relay infrastructure — do not create a second websocket pool.
5. **Dedupe replaceables before classifying.** Kind 39999/30382/30394 are parameterized-replaceable:
   before feeding events to any classifier, keep only the latest `created_at` per
   `(kind, pubkey, d-tag)`. Write one shared `latestByCoord(events)` helper and use it everywhere.
   (This is also what makes apply→dispute toggles work: same d-tag, latest wins.)
6. **Counts are POV-filtered, presence is not.** The classifiers separate "what exists" from "what
   counts" via the trust predicate. Wire `trust.js` in from the start (see §4) — but remember its
   `predicate` is sync and cache-backed: **`await ensure(asserterPubkeys)` before classifying.**
7. **Follow Jumble's idioms.** Match its component patterns, state management, styling, i18n, and
   routing conventions. This feature should look like it was always part of Jumble. Explore the
   codebase before writing UI.
8. **Signing goes through Jumble's existing signer abstraction** (NIP-07 et al). Never touch keys
   directly.

## 2. The mental model (10 lines)

- A **tag** is itself a Nostr event (kind 39999, "tag-element"), addressed `39999:<author>:<slug>`.
  Anyone can mint one. Tags are shared, not namespaced-per-user: "psychology" minted by Alice is
  THE psychology tag others apply.
- Tagging a **pubkey** is direct: one kind-39999 assertion with `p` (target) + `a` (the tag) +
  `nostr-user-tag` concept z-handles + polarity (+1 apply / −1 dispute).
- Tagging an **event** is *indirect*: the assertion's descriptor z points at a per-tag **tagging
  header**, which points at the tag. The SDK's orchestrator creates missing intermediates
  automatically (1–3 publishes); the classifiers resolve the chain on read. You never manage
  headers manually.
- Publishing is permissionless; **filtering happens at read time**: classifiers take
  `honoredAuthorities` (= `CONFIG.zHandlePubkeys`) for *legitimacy* and a trust predicate for
  *whose assertions count*. There is no global truth — every count is a view from a POV; this
  client ships the house POV (see `sdk/trust.js` header).

## 3. Config + service layer (build this first)

Create a small `tagging/` module in Jumble's source (name/place it per Jumble's conventions):

- **`config.ts`** — loads `CONFIG.json` values (bake at build time or import the JSON), exposes
  `tagRelays`, `zHandlePubkeys`, `localTaPubkey`, trust settings, plus a **Settings UI** entry
  letting the user edit the tag-relay list (persist like Jumble persists its other settings).
- **`relays.ts`** — `tagReadRelays()` / `tagWriteRelays()` implementing rule §1.4 on top of
  Jumble's pool. Export `fetchTagEvents(filter)` (one-shot query across `tagReadRelays()`,
  deduped via `latestByCoord`) — this is also the `fetchEvents` you inject into `trust.js`.
- **`publish.ts`** — `publishTagEvent(signed)` to `tagWriteRelays()`; success = accepted by ≥1
  relay (report partial failures like Jumble reports other publish results).
- **`sign.ts`** — adapter from Jumble's signer to the SDK's `deps.sign(unsigned)` contract
  (fills `created_at` if absent; `now = () => Math.floor(Date.now()/1000)`).
- **`trust.ts`** — instantiate `createHouseTrustSource` + `fetchApplicabilityLists` from
  `sdk/trust.js` with the config; export a singleton used by every read surface.
- Copy `sdk/` into the source tree wherever Jumble keeps framework-agnostic libs. It is plain
  ESM JavaScript with JSDoc; if the project enforces TS, add a thin `.d.ts` or enable
  `allowJs` — do **not** rewrite the SDK.

## 4. The read pipeline (shared by every surface)

For any set of candidate assertion events:

```
candidates = latestByCoord(await fetchTagEvents(filter))
headers    = latestByCoord(await fetchTagEvents(headerFilter))   // event-tagging surfaces only
await trust.ensure(candidates.map(c => c.pubkey))                 // THEN classify (predicate is sync)
result     = classify…({ candidates, headers,
                         honoredAuthorities: CONFIG.zHandlePubkeys,
                         isAsserterTrusted: trust.predicate,
                         viewerPubkey })
```

Always pass `viewerPubkey` (when logged in): the classifiers' `mine` channel is what keeps the
viewer's *own* just-published stance visible regardless of trust — the UI must render from
`tags`/`targets` (counted) **overlaid with** `mine` (the viewer's stance).

Chip arithmetic: a tag's display count = `applications.length − disputes.length`; hide chips ≤ 0
except when `mine` says the viewer has a stance (then show it dimmed/struck — their stance must
never silently vanish).

## 5. Features to build

### F1 — View tags on pubkeys and events

- **Notes** (feed cards + thread view): show a compact tag-chip row per note.
  - Query: `filterTagsAppliedToEvent({target:{id}})` — but **batched**: one subscription with
    `'#e': [visible note ids]` per rendered page/chunk, not one per note. Group results by target
    with `groupTaggingsByTarget` or by bucketing candidates per `e`-tag before `classifyEventTaggings`.
  - Headers for resolution: collect the descriptor z-coords from candidates, fetch those headers
    by coordinate (`kinds:[39999]`, authors + `#d` derived from the coords) — cache headers
    globally; they're tiny and reusable.
- **Profiles**: on the profile page, a tag-chip row from
  `filterTagsAppliedToPubkey({targetPubkey, zHandlePubkeys})` → normalize/count (use
  `normalizeTaggings` + `indexByTag` from the SDK, or group manually by `a`-coordinate) → chips.
- Each chip shows the tag name (from its tag-element; fetch tag-elements by `a`-coordinate,
  cache them) and the net count; the viewer's own stance is visually distinct.

### F2 — Apply existing tags (with search + content/profile separation)

- A **tag picker** (popover/sheet per Jumble's idiom) opened from a "Tag" action on notes
  (note action menu) and profiles (profile page action).
- Data: fetch tag-elements with `filterTagElements({zHandlePubkeys})` (cache; refresh
  lazily), search client-side by name/slug/description substring.
- **Two sections: "Content tags" and "Profile tags"** — the separation comes from
  `fetchApplicabilityLists` (house-published) with a client-side fallback to the SDK's
  `deriveApplicabilityMembers` / hint-z scan (`applicabilityHintFilter(context)`) when the lists
  are empty. When tagging a note, the event-applicable section leads; when tagging a profile,
  the pubkey-applicable section leads — the other section stays reachable (collapsed), because
  applicability is a hint, not a gate.
- Selecting a tag on a **note** → `applyEventTagging({tagInput:{authorPubkey, slug}, target:{id},
  polarity: 1, asserterPubkey, taPubkeys: CONFIG.zHandlePubkeys, deps})`. The `deps.findHeaders`
  you inject wraps `fetchTagEvents(filterTaggingHeadersForTag(...))` — query once per honored
  authority in `zHandlePubkeys` and concatenate — returning `[{author}]` per the orchestrator's
  contract.
- Selecting a tag on a **profile** → `applyProfileTagging({tagInput:{authorPubkey, slug, eventId},
  targetPubkey, polarity: 1, ...})` (pass the cached tag-element's event id for provenance).
- After a successful apply, optimistically update the chip row (the `mine` overlay makes this
  natural).

### F3 — Dispute tags

- Every chip (on notes and profiles) opens a small stance popover: counts, who-applied (avatars
  if cheap), and **Apply / Dispute** actions for the viewer.
- Dispute = the same orchestrators with `polarity: -1`. Same d-tag → replaces the viewer's prior
  stance (latest-wins). The UI toggles accordingly: applying overwrites a dispute and vice versa.

### F4 — Create a NEW tag on the fly

- The tag picker's search, when no exact match exists, offers **"Create tag '<query>'"** → a
  minimal form (name required, description optional) → then:
  - on a note: `applyEventTagging({tagInput:{name, description}, ...})` — mints tag-element +
    header + assertion (3 publishes) in order, automatically.
  - on a profile: `applyProfileTagging({tagInput:{name, description}, ...})` — mints tag-element +
    assertion (2 publishes).
- Surface multi-publish progress/failure honestly (the orchestrators return `published`/`failedAt`).

### F5 — Tag pages (click a tag → everything tagged with it)

- A new route (follow Jumble's routing conventions), addressed by the tag coordinate — e.g.
  `/tags/<authorPubkey>/<slug>` (accept and normalize an `naddr` too if Jumble has entity-URL
  handling).
- Content: the tag's name + description (from its tag-element), then two views (tabs or
  sections, per Jumble idiom):
  - **Notes** — headers via `filterTaggingHeadersForTag` (per honored authority) → candidates via
    `filterTaggingsUsingTag` per header → `groupTaggingsByTarget` → fetch the kind-1 notes by id
    (Jumble's existing note-fetch machinery; assertions may carry relay hints in their `e` tag)
    → render as a standard Jumble note list, most-recently-tagged first.
  - **People** — `filterProfileTaggingsUsingTag` → count per `p` target (trust-filtered, net
    apply−dispute > 0) → render as Jumble profile list items.
- Every tag chip anywhere in the app links here.

## 6. Suggested build order (verify each step before the next)

1. Config + service layer (§3) — smoke-test with a console query: fetch tag-elements from
   dcosl, log names. **You should see a substantial list of existing tags; if you see zero,
   stop and debug relay connectivity before building UI.**
2. F1 profiles (simplest read: direct shape, no headers), then F1 notes (adds header resolution
   + batching).
3. F5 tag pages (reuses F1's machinery in the forward direction) + chip → page links.
4. F2 picker with existing tags, apply on profile then on note. Verify on-wire shape after each
   first publish (§7 checklist).
5. F3 disputes (stance toggle).
6. F4 create-new-tag flows.
7. Trust wiring hardening: confirm `ensure()` batches, degraded mode (kill tag relays → app
   still renders, counts unfiltered).
8. Run ACCEPTANCE.md end to end.

## 7. Verify-on-wire checklist (after your first publish of each type)

Fetch your published event back from the relay and check, byte for byte:

- Tag-element: `d` = slug; one `z` = `39998:<pk>:tag` **per** configured namespace pubkey;
  applicability hint z present (`tag-for-nostr-event` / `tag-for-nostr-pubkey`); content JSON
  `{tag:{slug,name,description}}`.
- Event assertion: `d` = `event-tag-<slug>-<target8>-<asserter8>`; `e` (or `a`) = target;
  concept z per namespace; **descriptor z** = `39999:<headerAuthor>:tagging:<slug>-tagging`;
  `polarity`.
- Profile assertion: `d` = `profile-tag-<slug>-<target8>-<asserter8>`; `p` = target; `a` =
  `39999:<tagAuthor>:<slug>`; `e` = tag-element id; concept z per namespace; `polarity`;
  content JSON `nostrUserTag`.
- Re-applying with opposite polarity replaces (same `d`), never duplicates.

## 8. Explicitly OUT of scope (do not build; do not preclude)

- **Legacy `#hashtag` bridging** — "agree with a hashtag → decentralized tagging," and
  intercepting `#` in the composer. Phase 2. Keep the tag-picker component reusable so the
  composer can host it later.
- **Tag pinning / Trusted-List publication** from this client (kinds 30392/30393 writes).
- **POV switching UI** — the trust source is the house POV; the seam in `trust.js` is where
  user POVs plug in later. Don't build UI for it.
- **Editing/deleting tag-elements**, moderation surfaces, tag merging.

## 9. Known traps

- Nostr filters AND across keys, OR within a list — `{'#z': [a, b]}` means "z=a OR z=b". The
  dual-namespace reads depend on this.
- Some events carry BOTH namespaces' z-handles (federated), some only one (older). Never require
  both; `honoredAuthorities` membership of ANY is what legitimizes.
- `classifyEventTaggings` returns `unverifiable` for assertions whose header didn't resolve —
  usually your header fetch missed a relay. Log them in dev; don't render them as counted.
- Don't subscribe per-note in a feed (relay-connection blowup) — batch `#e` filters per viewport
  chunk and reuse Jumble's subscription lifecycle.
- The `polarity` tag may be absent (defaults to +1) or fractional; the SDK's bucketing handles
  it — don't reimplement.
- 30382 lookups: only ever by `authors + '#d': [specific pubkeys]` (lazy). An unfiltered
  `kinds:[30382]` subscription can pull hundreds of thousands of events.

## 10. Done means

Every item in `ACCEPTANCE.md` passes, `npm run build` (or Jumble's equivalent) is clean, and the
feature reads like native Jumble UI. Summarize what you built, any deviations you had to make
(with reasons), and anything you left flagged.
