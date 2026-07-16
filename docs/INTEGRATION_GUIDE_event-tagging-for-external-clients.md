# Integration guide — event-tagging on `tags.brainstorm.world`

*For an external client author who wants to (1) create event-tags, (2) have colleagues tag events with
them, and (3) show all events carrying those tags in their own feed.*

**Short answer: yes, all three work today.** Creating tags and tagging events are ordinary signed Nostr
publishes (kind `39999`) to our relay — you construct them with our dependency-free SDK (or from the
wire spec) and sign with your own key. Reading "which events carry tag X" is either a raw relay query
you resolve with the same SDK, or a single call to our read API. Nothing about your stack is assumed
below; everything about *our* side is concrete.

---

## 0. The one rule that will bite you if you skip it

**The Tapestry Assistant (TA) pubkey is per-deployment. Resolve it at runtime; never hardcode it.**
On `tags.brainstorm.world` it differs from every other instance. Fetch it once:

```
GET https://tags.brainstorm.world/api/assistant/pubkey   →  { pubkey: "<64-hex>" }
```

That pubkey is the namespace for the concept handles your events must carry (below). Use the value you
fetch — a hardcoded literal from a different instance will make your tags invisible here.

---

## 1. Deployment facts

| Thing | Value |
|---|---|
| Control-panel / API base | `https://tags.brainstorm.world` |
| TA pubkey | `GET /api/assistant/pubkey` (runtime; see §0) |
| Relay (Nostr websocket) | **`wss://tags.brainstorm.world/relay`** — where you publish and read raw. |
| Source code | Public repo `github.com/nous-clawds4/tapestry`, branch **`feat/tags`** — the SDK (`src/lib/event-tagging/`) and the protocol specs (`protocols/drafts/*.md`) are here; grab them directly. |
| Event kinds | `39999` (tags, taggings, per-tag headers — all parameterized-replaceable), `39998` (concept headers), `1` (the notes you tag) |
| Trust model | Reads are **point-of-view (POV) filtered** — see §6. Publishing is permissionless; *counting* is per-POV. |

**Two operational things to confirm with the operator (Vinney) before your colleagues start:**
1. **Relay write access.** The relay may have a write policy. Confirm your + your colleagues' pubkeys
   are allowed to publish (or that it's open).
2. **Relay read access.** Confirm the `wss://` endpoint is publicly reachable for subscriptions.

---

## 2. The data model (how a "tag on an event" is actually stored)

Tagging is **indirect** — this is the part to internalize. Three event shapes, all kind `39999`:

1. **Tag-element** — the tag itself (e.g. "psychology"). Addressed by its *a-coordinate*
   `39999:<tagAuthor>:<slug>`.
   - `d` = the slug; `content` = `{ "tag": { "slug", "name", "description" } }`
   - carries `["z", "39998:<TA>:tag"]` (the concept handle that files it into this instance's tag graph)
   - **optionally** `["z", "tag-for-nostr-event"]` — a pubkey-free *hint* that the tag was born for
     tagging events (helps it show up in the "tags for events" list; never required).

2. **Per-tag tagging header** — created **once per tag**, the indirection anchor. Addressed
   `39999:<headerAuthor>:tagging:<slug>-tagging`.
   - `d` = `tagging:<slug>-tagging`; carries `["z", "39998:<TA>:tagging-with-specific-tag"]` and an
     `["a", "39999:<tagAuthor>:<slug>"]` pointing at the tag-element it applies.

3. **Tagging assertion** — the actual "this note has this tag" claim.
   - points at the target note: `["e", "<noteId>"]` (a kind-1 note) or `["a", "<coord>"]` (an
     addressable target)
   - carries **two** `z` tags: the `nostr-event-tag` concept-z **and** a descriptor-z that references
     the *header* from (2) — that indirection is what a reader resolves to learn *which* tag this is.
   - **polarity**: `+1` = apply, `-1` = dispute.

A reader only *counts* an assertion if its descriptor resolves to a **legitimate** header (a real member
of `tagging-with-specific-tag` under an honored authority). That's the "aggregate at read time" rule —
you don't have to gate writes; trust filtering happens on read.

Full normative wire spec: **`protocols/drafts/event-taggings.md`** — in the public repo,
`github.com/nous-clawds4/tapestry`, branch **`feat/tags`**.

---

## 3. Use our SDK — don't hand-roll the wire shape

We ship the tagging protocol as a **dependency-free, framework-agnostic CJS core**:
`src/lib/event-tagging/`. It's in the **public repo** — grab it directly from
`github.com/nous-clawds4/tapestry`, branch **`feat/tags`** (a handful of files, no npm deps, no
network, no framework). It builds *unsigned* events and Nostr filters; you supply the signer and
transport. Key exports:

- **Builders** — `buildTagElement({name, description, taPubkeys, applicabilityZ})`,
  `buildTaggingHeader(...)`, `buildEventTaggingAssertion(...)` → return unsigned `{kind, tags, content}`.
- **`applyEventTagging({ tagInput, target, polarity, asserterPubkey, taPubkeys, deps })`** — the
  orchestrator. It decides the **1–3 event publish sequence** (mint the tag-element only if new; mint
  the per-tag header only if none exists; then the assertion), signs each via your `deps.sign`, and
  publishes in dependency order via your `deps.publish`. `deps.findHeaders` is a relay lookup it calls
  to decide whether a header must be created.
- **Filters** — `filterTaggingHeadersForTag`, `filterTaggingsUsingTag`, `filterTagsAppliedToEvent` →
  plain Nostr filter objects for your relay subscription.
- **`classifyEventTaggings(...)`** — resolves the indirection + applies a trust predicate → counted /
  illegitimate / unverifiable. This is what turns raw relay events into "these notes carry this tag."
- **Applicability helpers** (`deriveApplicabilityMembers`, `applicabilityHintFilter`) — optional; for
  computing "which tags are for events" yourself.

Everything is parameterized by `taPubkeys` (pass the value from §0). If you'd rather reimplement from
`event-taggings.md`, the SDK is your reference for exact byte shapes.

---

## 4. Writing — create tags, then tag events

Both are client-side: **build the unsigned event (SDK) → sign (your key) → publish (to the relay).**

**Create a tag** (do this for your handful of tags):
```
taPubkey = GET /api/assistant/pubkey
unsigned = buildTagElement({ name: "Psychology", description: "...",
                             taPubkeys: [taPubkey], applicabilityZ: "tag-for-nostr-event" })
signed   = yourSigner.sign(unsigned)          // NIP-07 window.nostr, or an nsec lib
publish(signed, "wss://tags.brainstorm.world/relay")
```

**Tag an event** (what your colleagues do — each signs with their own key):
```
applyEventTagging({
  tagInput: { authorPubkey: <tagAuthor>, slug: "psychology" },   // the existing tag, by a-coordinate
  target:   { id: "<noteId>" },                                   // the kind-1 note being tagged
  polarity: 1,                                                    // +1 apply, -1 dispute
  asserterPubkey: <colleaguePubkey>,
  taPubkeys: [taPubkey],
  deps: { findHeaders, sign, publish, now },                      // your relay-read, signer, transport, clock
})
```
The SDK handles the header indirection automatically. Colleagues need only the tag's a-coordinate
(`39999:<tagAuthor>:<slug>`) — share your tags' coordinates with them, or let them discover tags via §5.

Signing: any Nostr signer works — a browser extension (NIP-07 `window.nostr`), or an nsec with a
library like `nostr-tools`. Transport: any relay client that can `publish` to the `wss://` endpoint.

---

## 5. Reading — show all events carrying your tags (your feed)

Two ways. **For a browser client, prefer Option A** — our REST API is **same-origin (no CORS)**, so a
cross-origin browser fetch will be blocked; a websocket to the relay is not.

### Option A — raw relay + SDK (decentralized, CORS-free, recommended)
1. Subscribe to the relay with `filterTaggingsUsingTag({...})` (and `filterTaggingHeadersForTag`) for
   each of your tags → you get the raw assertion + header events.
2. Run `classifyEventTaggings(...)` with your chosen trust predicate → the set of note ids carrying
   each tag (apply-minus-dispute), plus which are legitimate.
3. Fetch those kind-1 notes by id (`{ kinds:[1], ids:[...] }`) from the relay and render them in your
   feed however you like.

This owns the whole path client-side and matches the decentralized model — anyone's taggings count if
your trust predicate says so.

### Option B — our read API (easiest, but same-origin / server-side only)
One call per tag returns the tagged notes, already resolved and enriched:
```
GET https://tags.brainstorm.world/api/event-tags/for-tag?tagAuthor=<hex>&slug=<slug>
    [&viewerPubkey=<hex>] [&wotPov=house|user&userPubkey=<hex>] [&sort=recent|applied|disputed|divisive]
→ { success, notes:[…NoteCard-ready…], members:[{id, applications, disputes, createdAt}], total, truncated, limit }
```
- `notes` = resolved kind-1 notes for the tag; `members` = the deterministic id+counts set (use this if
  you want a stable list independent of flaky external note-fetches).
- **Caveats:** it's POV-filtered (§6) and **capped at the 50 most-recent** tagged notes per tag
  (`limit`/`truncated` tell you when it's clipped — pagination is not yet exposed). Because our API
  isn't CORS-open, call it from *your* server (proxy), not directly from a browser on your origin.

Merge the per-tag results to build "all events carrying *any* of my tags."

---

## 6. POV / trust filtering — the part that decides *whose* taggings count

This is the crux for a membership-scoped feed, so read carefully. Every server-side read (`for-tag`,
`for-event`, `tags/index`) counts a tagging only if its author is trusted under a **point of view (POV)**.
Three things to know before you rely on that:

1. **The default POV is "house," and it is not selectable from our app UI.** The in-app tag surfaces on
   tags.b.w read under the deployment's **house** POV; there is no POV picker. You can read under a
   *different* POV only by calling the API directly with `?wotPov=user&userPubkey=<pov-pubkey>` — and
   only if that POV is *provisioned* (see #2).

2. **An un-provisioned POV silently counts _everyone_.** Filtering is active only when the POV has (a) a
   delegated pubkey, (b) a finite minimum-rank threshold, and (c) computed trust scores on tags.b.w. If
   any is missing, the predicate falls back to "all authors count" — i.e. **no filtering at all.** A
   half-configured POV won't hide non-members; it shows all of them. Don't assume "I selected a POV,
   therefore non-members are hidden" — verify it's fully provisioned.

3. **The "which tags are for events" list is house-POV only.** `tags/applicability` (and the picker it
   drives) always computes under house POV; a selected POV does not re-scope it.

**What this means for you:** the reliable way to guarantee *only your members' taggings show* is **not**
to depend on tags.b.w selecting an LFO POV (the UI doesn't expose it, and it silently no-ops if
un-provisioned). It's to **filter client-side by an explicit member set** — read raw taggings off the
relay and, in your `classifyEventTaggings` predicate (or a post-filter), keep only authors in your LFO
member list. You own the trust decision; nothing on our side must be perfectly provisioned for it to be
correct. (Your *own* taggings always show via the trust-unfiltered `mine` channel, regardless of POV —
by design.)

---

## 7. Scoping to your members — the LFO membership pattern

Your app already computes "who is a member." Here's how that plugs in — now, and later.

**Publish your member list as a Trusted List.** Take your computed member set and publish it as a Nostr
Trusted List — a kind-`30392` **pubkey list** (one `p`-tag per member) — to **tags.b.w's relay** (it must
live there to be usable there). So it stays fresh when you're offline, run an **LFO House Assistant**: a
small server-side process holding an nsec that **re-publishes the member TL on a schedule** (and can
publish your other lists too). This is your side to build; a generic Brainstorm-hosted TL-publication
service may come later, but don't wait on it.

**Two ways to use that member TL:**

- **(Available now — recommended) Client-side author filter.** Your feed reads raw taggings off the relay
  and counts only authors present in your member TL. Zero dependency on any Brainstorm-side POV
  provisioning; you are the arbiter. Given §6, this is the robust path.
- **(Future — Brainstorm-side) POV "Trust Determination".** Brainstorm can score an **LFO POV** using your
  member TL as its trust basis, so the *server-side* reads filter to members automatically. **This is not
  fully wired yet** — it requires the LFO POV to be provisioned/computed on tags.b.w with your TL as the
  scoring input. Treat it as a later upgrade and confirm timing with the operator. The member TL you
  publish now is exactly its input, so nothing is wasted.

**Curate the tags in your feed — a *separate* filter from membership.** "Which tags" and "whose taggings"
are two independent axes. For the tag set, don't rely on the broad house-POV "tags-for-events" list —
**hand-pick the tags you want and publish them as your own DList** (a curated list of tag a-coordinates),
then use that DList as the tag filter in your pipeline. **Combine the two:** show a note when *(a tag in
your DList)* was applied by *(an author in your member TL)*. This also lets tags.b.w keep issuing generic
event-tags while your feed stays LFO-specific.

---

## 8. Optional — the instance's maintained lists (if you don't want to compute)

The instance publishes TA-signed **Trusted Lists** you can read instead of computing:
- **`tag-applicability-nostr-event`** (kind `30394`, `a`-tag members) — "which tags are for events,"
  **house-POV** (see §6.3): `{ kinds:[30394], authors:[<TA>], "#d":["tag-applicability-nostr-event"] }`.
  Broad — for an LFO-specific feed you'll likely prefer your own curated tag DList (§7).
- **Note Trusted Lists** (kind `30393`, `e`-tag members, `d` = `tl-pin-notes-<obs8>-<tagAuthor8>-<slug>`)
  — "the trusted notes for tag X under an observer's POV." Exist only *after someone pins the tag*.

Kind convention (matches NIP-85): `30392` = pubkey lists (`p`), `30393` = event lists (`e`), `30394` =
addressable lists (`a`). Spec: `protocols/drafts/trusted-lists.md` (public repo, branch `feat/tags`).

For discovery you can also use `GET /api/tags/index` and `GET /api/tags/applicability?type=event`
(house-POV, same-origin/server-side).

---

## 9. Gotchas checklist

- [ ] **Resolve the TA pubkey at runtime** (`/api/assistant/pubkey`) — never hardcode (§0).
- [ ] **Confirm relay write + read access** with the operator (§1).
- [ ] **POV filtering silently no-ops if the POV isn't fully provisioned** — for a members-only feed,
      **filter client-side by your member TL**, don't rely on selecting an LFO POV (§6–7).
- [ ] **Membership and tag-set are two different filters** — your member TL scopes *authors*; your curated
      DList scopes *tags*; combine them (§7).
- [ ] **Publish + refresh your member TL from an LFO House Assistant** (server-side nsec) so it stays live
      when you're offline; it must sit on tags.b.w's relay (§7).
- [ ] **API is same-origin (no CORS)** — from a browser, read the relay directly or proxy the API (§5).
- [ ] **`for-tag` caps at 50 most-recent** notes per tag — for a fuller feed, aggregate from the relay (§5A).
- [ ] **Tagging is indirect** (assertion → header → tag) — use the SDK so you don't mis-shape the wire (§2–3).
- [ ] **Share tag a-coordinates** (`39999:<author>:<slug>`) with colleagues, or let them discover via §8.

---

## Your exact scenario, end to end

1. Fetch the TA pubkey (§0).
2. **Publish your LFO member Trusted List** (kind-30392, `p`-tag per member) to tags.b.w's relay from your
   **LFO House Assistant** (server-side nsec) — and set it to re-publish on a schedule (§7).
3. **Curate your feed's tags into a DList** (hand-picked tag a-coordinates) (§7).
4. Create your handful of tags with `buildTagElement(..., applicabilityZ:"tag-for-nostr-event")`, sign,
   publish (§4). Note each tag's a-coordinate (put the ones you want in the DList from step 3).
5. Give colleagues the a-coordinates; they `applyEventTagging({tagInput:{authorPubkey,slug}, target:{id:noteId}, polarity:1, ...})` with their own keys (§4).
6. **Your feed** (client-side, the robust path): subscribe to the relay with `filterTaggingsUsingTag` for
   each tag in your **DList** → `classifyEventTaggings` with a predicate that trusts **only authors in your
   member TL** → fetch those kind-1 notes → render (§5A, §6–7). Membership scopes authors; the DList scopes
   tags.

That's the whole loop. Write side: "sign a 39999 with the right z-tags." Read side: "keep taggings whose
*tag* is in my DList **and** whose *author* is in my member TL." The SDK does both halves; you own the two
filters, so nothing depends on tags.b.w having your POV perfectly provisioned.

*(Later upgrade, when Brainstorm wires it: hand your member TL to a server-side LFO POV "Trust
Determination" and let the API filter authors for you — §7. Same TL, no rework.)*
