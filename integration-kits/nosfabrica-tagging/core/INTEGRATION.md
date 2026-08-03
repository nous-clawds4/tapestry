# INTEGRATION — add decentralized tagging to any Nostr client

This is the **target-agnostic core** of the Tapestry/Brainstorm tagging integration kit. It tells
you how to wire decentralized tags (kind-39999 tag events, permissionless publish, POV-filtered
read) into a host application **without assuming anything about that application's framework, UI,
or feature set**. Everything protocol-shaped is already written for you in `sdk/`; your work is
integration: connecting the SDK to the host's relay access, signer, config, and (eventually)
whatever surfaces the host chooses to render tags on.

A per-target kit (a `Start.md` next to this folder) tells you *where* in a specific codebase to
wire each seam and *which* surfaces to build first. If you have one, read it after this document —
it overrides nothing here; it only specializes it. If you don't have one, this document plus
`ACCEPTANCE.md` is sufficient to integrate the machinery end to end.

Work through this document top to bottom. Do not skip the Ground Rules.

---

## 0. What's in the core

| Path | What it is |
|---|---|
| `CONFIG.template.json` | Deployment config template: tag-hub relays, instance identity, namespace pubkeys, trust settings. **Read its `_comment` keys first.** A per-target kit ships a filled-in `CONFIG.json`; without one, the template's defaults point at the reference deployment and work as-is. |
| `sdk/event-tagging/` | The protocol core for tagging **events** (notes). Pure ESM, zero deps: builders (unsigned events), filter builders, classifiers, and the `applyEventTagging` orchestrator. `index.js` re-exports everything. |
| `sdk/profile-tagging.js` | The protocol core for tagging **pubkeys** (profiles) — a simpler, direct wire shape. Builders, filters, `applyProfileTagging` orchestrator. |
| `sdk/trust.js` | The trust seam: builds the `(pubkey) => boolean` predicate every classifier takes, from the house's NIP-85 kind-30382 assertions. Also fetches the published content/profile applicability lists. |
| `protocol/` | Normative wire specs, for reference — the SDK already implements them: `event-taggings.md` (event-tagging), `tags.md` (tags + profile-tagging), `trusted-lists.md` (the kind-30392/30393/30394 Trusted Lists trust.js reads). |
| `ACCEPTANCE.md` | The generic acceptance script: "tagging is integrated," verified at the wire/console level with **no UI assumptions**. A per-target kit may add its own UI-coupled acceptance doc on top. |

## 1. Ground rules (violating any of these is a bug)

1. **The SDK owns the wire shape. Never hand-roll a kind-39999 event or a discovery filter.** If
   you need a shape the SDK doesn't export, stop and re-read — it almost certainly does. The SDK
   builders return *unsigned partial* events (`{kind, tags, content}`); you add `pubkey` +
   `created_at`, sign, publish. *One sanctioned composition:* for batching you may MERGE
   SDK-built filters of the same shape by unioning their value lists (e.g. many
   `filterTagsAppliedToEvent` results → one filter with `'#e': [all ids]`) — that is combining
   SDK output, not hand-rolling.
2. **Pure relay by design. Never build tagging features on a Brainstorm instance's REST API from
   the client.** Some instances answer cross-origin today; treat that as incidental, not
   contractual. Depending on it couples the client to one instance's uptime and API surface and
   breaks the decentralized model. All reads are Nostr subscriptions; all writes are Nostr
   publishes. (If the host app has its own backend, that backend MAY proxy relay traffic — the
   rule is about the Brainstorm REST API, not about where your websockets terminate.)
3. **No protocol literals in source.** Every pubkey, relay URL, and namespace comes from the
   config file through a single config module you create. The pubkeys in the config have
   precise, different roles — read the `_comment` keys. If you find yourself typing a 64-hex
   literal in a source file, stop.
4. **Relay routing — two lanes.** *Tags/taggings* (kind 39999): reads query
   `CONFIG.tagRelays ∪ (user's read relays)`; writes publish to `CONFIG.tagRelays ∪ (user's
   write relays)`. If the host has no per-user relay lists, the CONFIG lists alone are the
   lanes. *House trust artifacts* (kinds 30382/30392/30393/30394): read from
   `CONFIG.trustRelays` — they live on the house relay ONLY, not the hub (verified; see the
   config comments). Reuse the host's existing relay/pool infrastructure — do not create a
   second websocket pool if one exists.
5. **Dedupe replaceables before classifying.** Kind 39999/30382/30394 are parameterized-replaceable:
   before feeding events to any classifier, keep only the latest `created_at` per
   `(kind, pubkey, d-tag)`. Write one shared `latestByCoord(events)` helper and use it everywhere.
   (This is also what makes apply→dispute toggles work: same d-tag, latest wins.)
6. **Counts are POV-filtered, presence is not.** The classifiers separate "what exists" from "what
   counts" via the trust predicate. Wire `trust.js` in from the start (see §4) — but remember its
   `predicate` is sync and cache-backed: **`await ensure(asserterPubkeys)` before classifying.**
7. **Follow the host's idioms.** Match its component patterns, state management, styling, i18n,
   and routing conventions. Tagging should look like it was always part of the app. Explore the
   codebase before writing UI.
8. **Signing goes through the host's existing signer abstraction** (NIP-07 et al). Never touch
   keys directly. If the host has no signing at all yet, adding NIP-07 support is a prerequisite
   for the write capabilities (C3+) — the read capabilities (C1–C2) need no signer.

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
  kit ships the house POV (see `sdk/trust.js` header).

## 3. Config + service layer (build this first)

Create a small, self-contained tagging module in the host's source (name/place it per the host's
conventions — a per-target kit names the exact directory). Five files, whatever extension the
host uses:

- **`config`** — loads the kit's `CONFIG.json` values (bake at build time or import the JSON),
  exposes `tagRelays`, `zHandlePubkeys`, `localTaPubkey`, trust settings. If the host has a
  Settings surface, add an entry letting the user edit the tag-relay list (persist like the host
  persists its other settings); if it doesn't, keep the relay list in one obvious place a
  developer can edit.
- **`relays`** — `tagReadRelays()` / `tagWriteRelays()` implementing rule §1.4 on top of the
  host's relay access. Export `fetchTagEvents(filter)` (one-shot query across `tagReadRelays()`,
  deduped via `latestByCoord`) **and** `fetchTrustEvents(filter)` (same, but across
  `CONFIG.trustRelays ∪ tagReadRelays()`).
- **`publish`** — `publishTagEvent(signed)` to `tagWriteRelays()`; success = accepted by ≥1
  relay (report partial failures the way the host reports other publish results).
- **`sign`** — adapter from the host's signer to the SDK's `deps.sign(unsigned)` contract
  (fills `created_at` if absent; `now = () => Math.floor(Date.now()/1000)`).
- **`trust`** — instantiate `createHouseTrustSource({ fetchEvents: fetchTrustEvents,
  assertionAuthorPubkeys: CONFIG.nip85AuthorPubkeys, ...CONFIG.trust })` and
  `fetchApplicabilityLists({ fetchEvents: fetchTrustEvents, houseAssistantPubkey:
  CONFIG.localTaPubkey })` from `sdk/trust.js`; export a singleton used by every read
  surface. Note the two different identity params — 30382s are authored by the (rotatable)
  keys in `nip85AuthorPubkeys`; the applicability TLs by the current TA.
- Copy `sdk/` into the source tree wherever the host keeps framework-agnostic libs. It is plain
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
viewer's *own* just-published stance visible regardless of trust — any UI must render from
`tags`/`targets` (counted) **overlaid with** `mine` (the viewer's stance).

Count arithmetic: a tag's display count = `applications.length − disputes.length`; hide tags ≤ 0
except when `mine` says the viewer has a stance (then show it dimmed/struck — their stance must
never silently vanish).

## 5. The capability ladder (build in this order; each is independently verifiable)

These are **capabilities, not UI features**. Each one names the machinery that must work and the
SDK pieces that do the heavy lifting; what the host *renders* with each capability is the
per-target kit's (or the integrator's) decision. `ACCEPTANCE.md` has one section per rung —
verify each rung before climbing to the next.

### C0 — Service layer online

§3 built and smoke-tested from a dev console (or a throwaway test route):
(a) `fetchTagEvents(filterTagElements({zHandlePubkeys}))` logs a substantial list of existing
tag names — **if you see zero, stop and debug relay connectivity before anything else**;
(b) `fetchApplicabilityLists(...)` and one `trust.ensure([...])` batch via `fetchTrustEvents`
both return data (the applicability lists are known-published; 30382s exist under the retired
author key — see the config comments).

### C1 — Read tags on pubkeys

Given a target pubkey, produce its counted tag list:
`filterTagsAppliedToPubkey({targetPubkey, zHandlePubkeys})` → `latestByCoord` → trust ensure →
normalize/count (`normalizeTaggings` + `indexByTag`, or group by `a`-coordinate). Resolve tag
names by fetching tag-elements by `a`-coordinate (cache them — they're tiny and immutable in
practice). This is the simplest read: direct shape, no headers.

### C2 — Read tags on events

Given target event id(s), produce counted tag lists per event:
`filterTagsAppliedToEvent({target:{id}})` — **batched**: one query with `'#e': [ids]` per
rendered page/chunk, never one subscription per event. Resolve the descriptor z-coords from
candidates → fetch those headers by coordinate (`kinds:[39999]`, authors + `#d` from the
coords) → `classifyEventTaggings` (or `groupTaggingsByTarget` for many targets). Cache headers
globally.

### C3 — Apply an existing tag (write path; needs a signer)

- Tag discovery for pickers: `filterTagElements({zHandlePubkeys})`, cached, searched client-side
  by name/slug/description. **Content vs profile applicability** comes from
  `fetchApplicabilityLists` (house-published) with a client-side fallback to the SDK's
  `deriveApplicabilityMembers` / hint-z scan (`applicabilityHintFilter(context)`) when the lists
  are empty. Applicability is a hint, not a gate — never hard-block applying a tag to the
  "wrong" target type.
- Apply to an **event**: `applyEventTagging({tagInput:{authorPubkey, slug}, target:{id},
  polarity: 1, asserterPubkey, taPubkeys: CONFIG.zHandlePubkeys, deps})`. The `deps.findHeaders`
  you inject wraps `fetchTagEvents(filterTaggingHeadersForTag(...))` — query once per honored
  authority in `zHandlePubkeys` and concatenate — returning `[{author}]` per the orchestrator's
  contract. When the host knows which relays the target event was seen on, pass
  `target:{id, relays:[...]}` — the assertion then carries a NIP-01 relay hint.
- Apply to a **pubkey**: `applyProfileTagging({tagInput:{authorPubkey, slug, eventId},
  targetPubkey, polarity: 1, ...})` (pass the cached tag-element's event id for provenance).
- After a successful apply, the `mine` overlay makes optimistic update natural.

### C4 — Dispute / stance toggle

Dispute = the same orchestrators with `polarity: -1`. Same d-tag → replaces the asserter's prior
stance (latest-wins). Applying overwrites a dispute and vice versa; re-applying never
duplicates. Verify on the relay: one assertion per (asserter, tag, target), latest polarity.

### C5 — Create a new tag on the fly

When no existing tag matches, mint one and apply it in a single flow:
- on an event: `applyEventTagging({tagInput:{name, description}, ...})` — mints tag-element +
  header + assertion (3 publishes) in order, automatically.
- on a pubkey: `applyProfileTagging({tagInput:{name, description}, ...})` — mints tag-element +
  assertion (2 publishes).
Surface multi-publish progress/failure honestly. Two failure modes, by design: the orchestrators
**throw** when the signer rejects before anything hit the wire (clean all-or-nothing abort);
they **return `{published, failedAt}`** when something already published (report what landed —
leftovers are reusable tag-elements/headers, never a dangling assertion).

### C6 — Tag → targets (the forward direction)

Given a tag coordinate (`39999:<authorPubkey>:<slug>`), produce everything tagged with it:
- **Events**: headers via `filterTaggingHeadersForTag` (per honored authority) → candidates via
  `filterTaggingsUsingTag` per header → `groupTaggingsByTarget` → fetch the target events by id
  (assertions may carry relay hints in their `e` tag).
- **Pubkeys**: `filterProfileTaggingsUsingTag` → count per `p` target (trust-filtered, net
  apply−dispute > 0).
This is what powers any "tag page" / "browse by tag" surface, and it reuses C1/C2's machinery in
reverse.

### C7 — Trust hardening + degraded mode

Confirm `ensure()` batches (`authors + '#d'` lookups only — never an open-ended
`kinds:[30382]` subscription), and that the app degrades gracefully: tag relays unreachable →
surfaces render with tags simply absent, nothing crashes or wedges; trust relays unreachable →
counts fall back to `unknownPolicy` (count-everyone), recovering when connectivity returns
(failed chunks retried, not negatively cached).

## 6. Verify-on-wire checklist (after your first publish of each type)

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

## 7. Known traps

- Nostr filters AND across keys, OR within a list — `{'#z': [a, b]}` means "z=a OR z=b". The
  dual-namespace reads depend on this.
- Some events carry BOTH namespaces' z-handles (federated), some only one (older). Never require
  both; `honoredAuthorities` membership of ANY is what legitimizes.
- `classifyEventTaggings` returns `unverifiable` for assertions whose header didn't resolve —
  usually your header fetch missed a relay. Log them in dev; don't render them as counted.
- Don't subscribe per-event in a list view (relay-connection blowup) — batch `#e` filters per
  viewport chunk and reuse the host's subscription lifecycle.
- The `polarity` tag may be absent (defaults to +1) or fractional; the SDK's bucketing handles
  it — don't reimplement.
- 30382 lookups: only ever by `authors + '#d': [specific pubkeys]` (lazy). An unfiltered
  `kinds:[30382]` subscription can pull hundreds of thousands of events.
- House trust artifacts (30382/3039x) are on the HOUSE relay (`trustRelays`), not the hub —
  a trust reader pointed at the hub alone silently finds nothing (degrades to count-everyone).
- The 30382 corpus may be signed by a RETIRED house key (it is, today — see
  `nip85AuthorPubkeys` in the config): honor every configured author, latest-per-subject wins.
  `trust.js` already does this; don't "simplify" it to a single author.
- If your publishes are rejected (relay `OK false`), the relay's write policy may be closed to
  your pubkey — surface the relay message and have the operator confirm write access; don't
  silently retry.

## 8. Explicitly OUT of scope for the core (do not build; do not preclude)

- **Legacy `#hashtag` bridging** and composer interception. Keep any tag-picker component
  reusable so a composer can host it later.
- **Tag pinning / Trusted-List publication** from the client (kinds 30392/30393 writes).
- **POV switching UI** — the trust source is the house POV; the seam in `trust.js` is where
  user POVs plug in later. Don't build UI for it.
- **Editing/deleting tag-elements**, moderation surfaces, tag merging.

A per-target kit may pull items back *into* scope explicitly (e.g. migrating a host's existing
hardcoded labels onto the protocol) — that's its call, not the core's.

## 9. What a per-target `Start.md` adds (for kit authors and integrators)

The core deliberately doesn't know the host. A per-target overlay specializes exactly these
points — nothing else:

1. **Seam map** — which existing host modules provide relay access, signing, publish-result UX,
   settings persistence; the concrete directory for the §3 service layer and the `sdk/` copy.
2. **A filled-in `CONFIG.json`** — the instance identity the fork points at.
3. **Surface choices** — which capabilities get UI, where, and in what order; the host-idiom
   notes (components, routing, styling) for each.
4. **An interview** — questions the integrator answers before building (scope floors, migration
   of pre-existing host features onto the protocol, naming).
5. **A coupled acceptance doc** — end-to-end checks through the host's actual UI, layered on
   top of the core `ACCEPTANCE.md` (which still applies verbatim).

## 10. Done means

Every item in the core `ACCEPTANCE.md` passes for the capabilities you built (C0–C2 minimum for
a read-only integration; C0–C5 for a writing one), the host's build is clean, and any UI reads
like native host UI. Summarize what you built, any deviations you had to make (with reasons),
and anything you left flagged.
