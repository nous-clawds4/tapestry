# Contextual Pins — Write Integration & the Server Boundary

**Companion to** `CONTEXTUAL_PINS_INTEGRATION_GUIDE.md` (the read side). This doc covers
*writing* — creating tags, taggings, and pins (including contextual pins and unpins) — and draws
the line between what a client can do by itself and what requires a Tapestry instance. Read §0
first; it answers "can we update the pinned list on our own backend?"

Placeholders are as in the read guide: `<CTX>` (context slug), `<CTX_NS>` (context namespace
pubkey — §4), `CONTEXT_COORD` = `"39998:<CTX_NS>:<CTX>"`, `<TA>` (a deployment's runtime TA
pubkey), `<LEGACY_TA>` = `82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833`
(lineage constant for the base `tag` / `tag-pinning` / `nostr-event-tag` stamps), `<8>` = first
8 hex of a pubkey. Concrete examples used for readability (all generic): context
`english-speaking-nostr` (sibling `german-speaking-nostr`), users **Alice** and **Bob**, tag
`bitcoin`.

---

## 0. The question this answers: "Can we update the pinned list on our side?"

Two different things are both loosely called "the pinned list," on **opposite sides of a trust
boundary:**

1. **The pin itself** (kind 39999) is **user-signed and permissionless.** When a user pins a tag
   — including stamping it into a context — the event is signed by *their own* Nostr key, not by
   any server. **✅ Your client can create, update, and delete pins entirely on your side.** This
   is what populates your chip set, and it's how each user gets *their own* curation (§5).

2. **The materialized Trusted List** (kind 30392 / 30393) is **TA-signed and server-computed.** A
   Tapestry instance runs the Web-of-Trust computation and signs the curated list with the **TA
   private key**, which lives only on that server. **❌ Your client cannot reproduce these** — no
   TA key, no WoT engine.

**So you can write pins/tags/taggings freely; you cannot produce TA-signed TLs — but you usually
don't need to.** Either a Tapestry instance already materializes them on a schedule (piggyback —
§3 Strategy B), or you compute the equivalent yourself from raw taggings under your own trust
model (§3 Strategy A). You do **not** need your own TA. Your own namespace/backend is needed
only for deliberate independence.

---

## 1. The boundary, as a table

| Artifact | Kind | Signed by | Who can create it | Needs a Tapestry server? |
|---|---|---|---|---|
| Tag (element) | 39999 | **the user** | anyone | no |
| Per-tag header | 39999 | **the user** | anyone | no |
| Tagging (apply/dispute) | 39999 | **the user** | anyone | no |
| Pin (incl. context stamp) | 39999 | **the user** | anyone | no |
| Unpin | 5 (NIP-09) | **the user** | the pin's author | no |
| **Web of Trust** (`wot_rank_*`) | — | (instance) | **the instance only** | yes (or roll your own trust) |
| **Trusted List** (materialized) | 30392 / 30393 | **the TA** | **the instance only** | yes (to consume theirs) |

Everything in the top block is yours to write, standalone. The bottom block is the instance's —
reproduce the *effect* with your own trust model, or interoperate.

---

## 2. What you can write yourself (all user-signed)

All are kind-39999 events your user signs and publishes to your relay(s). The **pure builders**
that produce them live in `src/lib/event-tagging/builders.js` (`@tapestry/event-tagging`) — lift
them (§6). `conceptZTags` emits one `z` per namespace you pass — `[<LEGACY_TA>]` for the
canonical namespace, or `[<LEGACY_TA>, <localTA>]` to dual-stamp for cross-deployment discovery.

### 2.1 A tag element (only if the tag is new) — `buildTagElement`
```jsonc
{ "kind": 39999, "pubkey": "<user>",
  "tags": [ ["d","<slug>"], ["z","39998:<LEGACY_TA>:tag"] ],
  "content": "{\"tag\":{\"slug\":\"<slug>\",\"name\":\"<Name>\",\"description\":\"...\"}}" }
```
Slug derives from the name via `slug()` (`[a-z0-9-]`). Coordinate: `39999:<user>:<slug>`.

### 2.2 A per-tag header (once per tag) — `buildTaggingHeader`
```jsonc
{ "kind": 39999, "pubkey": "<user>",
  "tags": [
    ["d","tagging:<slug>-tagging"],
    ["names","<slug> tagging","<slug> taggings"], ["description","..."],
    ["z","39998:<LEGACY_TA>:tagging-with-specific-tag"],
    ["a","39999:<tagAuthor>:<slug>"]
  ], "content": "" }
```

### 2.3 A tagging — apply/dispute a tag on a note — `buildEventTaggingAssertion`
```jsonc
{ "kind": 39999, "pubkey": "<user>",
  "tags": [
    ["d","event-tag-<slug>-<target8>-<asserter8>"],
    ["e","<noteId>","<relay-hint?>"],                    // or ["a","<coord>"] for an addressable target
    ["z","39998:<LEGACY_TA>:nostr-event-tag"],
    ["z","39999:<headerAuthor>:tagging:<slug>-tagging"],
    ["polarity","1"]                                     // 1 = apply, -1 = dispute
  ], "content": "" }
```
Re-publishing at the same `d` flips the stance (replaceable).

### 2.4 A pin — including the context stamp — `pinTag` shape
```jsonc
{ "kind": 39999, "pubkey": "<user>",
  "tags": [
    ["d","tag-pin-<slug>-<tagAuthor8>-<user8>-in-<CTX>"], // "-in-<CTX>" ⇒ contextual (omit for neutral)
    ["e","<tagEventId>"], ["a","39999:<tagAuthor>:<slug>"],
    ["z","39998:<LEGACY_TA>:tag-pinning"],                // base pin stamp
    ["z","<CONTEXT_COORD>"],                              // ← CONTEXT STAMP (omit for a neutral pin)
    ["curation-method","{\"observer\":\"<user>\",\"method\":\"nip85:rank\",\"cutoff\":1,\"targetTypes\":[\"profile\",\"note\"],\"noteMethod\":\"notes:net-endorsed\"}"]
  ], "content": "{\"tagPinning\":{\"tagEventId\":\"<tagEventId>\",\"curationMethod\":{...}}}" }
```
- **`observer` is the user themselves.** This is what makes pins *per-user*: the pin is a signed,
  portable record of *this user's* curation choice for this tag in this context — which tags they
  include, their `cutoff`, their `noteMethod`. Any client can read it to reconstruct that user's
  feed (§5); a Tapestry instance materializes it into that user's own TA-signed TL.
- The `curation-method` is a *request* to a materializer. If you don't consume TA-signed TLs it's
  inert metadata — keep it valid for interop.
- **Neutral and contextual pins of the same tag coexist** (distinct `d`). To add a tag to a
  context, publish the contextual variant; the neutral one is unaffected.

### 2.5 Unpin — NIP-09 deletion
```jsonc
{ "kind": 5, "pubkey": "<user>", "tags": [ ["e","<pinEventId>"] ], "content": "unpinned" }
```
Or re-publish the pin at the same `d` to change its curation. A tag leaves a context's chip set
when its last contextual pin (from an honored pinner) is deleted.

---

## 3. Two ways to get curated lists (piggyback vs. roll your own)

You cannot mint a valid **kind-30392/30393 TL** or compute `wot_rank_*` yourself — but you rarely
need to. Pick one:

### Strategy B — Piggyback on TA-signed TLs (simplest; no infrastructure of your own)

Publish user-signed pins (+ taggings) into a Tapestry instance's relay with **its** TA context
stamp, and **read its TA-signed TLs**. Its cron re-materializes **every** pin it sees, on a
schedule, so your lists stay current with no work on your side. **Four conditions**, all about
*reaching that relay with the right stamp* (you run nothing):

1. **Pins reach the instance's relay.**
2. **Pins stamp the instance's TA context handle** — `39998:<TA>:<CTX>` (not your own key — §4).
   That's what makes it recognize them as context pins and emit the `-in-<CTX>` TL, and it's the
   same coordinate your chip scan reads.
3. **Taggings reach the instance's relay** too — TL members come from taggings it can scan.
4. **You accept its POV** as baked into each TL (next paragraph).

> **The trust caveat:** each pin's TL is computed under **that pinner's** POV via the instance's
> WoT. If a pinner's POV isn't provisioned on the instance (most arbitrary pubkeys aren't), the
> computation **falls back to "all assertions count"** — it still applies the pin's `cutoff` +
> net-endorsed rule, but **without WoT rank filtering**. So for unprovisioned pinners, a TL
> effectively means "cutoff-filtered, everyone's taggings."

### Strategy A — Roll your own curation (for independence or a custom trust model)

Don't consume TLs. For each chip's tag, take the raw taggings, apply **your** trust model (your
member roster / follow graph / pubkey filter — which you already have), and render. Reuse
`curateNotes(notes, method, cutoff)` (§6) to match net-endorsed / most-applied / cutoff semantics
exactly. Fully standalone — no server, no dependency on anyone's uptime, relay, or WoT. *(You may
publish your OWN curated lists signed by your OWN key — e.g. a NIP-51 kind-30003 bookmark set —
for other clients; that's a normal user-signed list, simply not TA-signed.)*

**Rule of thumb:** want it to "just stay fresh" and cutoff/net-endorsed trust is fine →
**Strategy B**. Want trust in your own hands, or zero coupling → **Strategy A**.

### 3.1 A third axis: freshness / timeliness

Independent of *trust*, decide how *fresh* content must be. TA-signed TLs are **snapshots**
re-materialized by a cron, so Strategy B has inherent lag. Options:

1. **Wait for the cron.** Zero integration; staleness = the schedule interval.
2. **Trigger a refresh on in-app activity** (the server-side twin of a "re-materialize after a
   tagging" hook): `POST /api/trusted-list/refresh-pinned-tag` (per pin) or
   `…/refresh-pinned-tags-for-viewer?viewerPubkey=<pk>`. **Caveat:** these require a
   **signature-verified session** against the instance — its `/api/auth` signed-challenge →
   cookie flow (`session.authenticated === true`; **no NIP-98, no API token**) — and enforce
   **ownership** (you can refresh only *your own user's* pins). Timely piggyback thus means
   implementing that auth flow and holding a per-user session.
3. **Compute live yourself (Strategy A).** Inherently timely — you read raw taggings at query
   time. No cron, no auth, no coupling.

Timeliness pushes toward **Strategy A**: fresh TLs cost an auth integration; rolling your own is
live by construction.

### 3.2 If you already filter client-side, the trust axis (and the TLs) mostly fall away

If your client already filters pubkeys/events/taggings down to your members, then **the instance
POV/WoT adds little for you** — and a TL can even be **lossy**: its membership is
POV × cutoff/net-endorsed, so reading it and re-applying your filter inherits **its subset**,
which may have **dropped a member tagging you'd keep**. Rolling your own from **raw taggings +
your filter** yields the **complete** member-tagged set — live and dependency-free. So for a
member-filtered feed, **Strategy A wins on all three axes at once** — timely, spam-free, and
complete — sidestepping the instance POV, its TLs, its cron, and its auth. TLs then matter only
if you want a **pre-computed cache** (perf) or the **WoT rank *scores*** for ranking.

---

## 4. The context namespace decision

The context handle you stamp and scan — `39998:<CTX_NS>:<CTX>` — is a **string namespace**. The
`#z` filter matches it opaquely; `<CTX_NS>` need not be a running server, and the kind-39998
header need not exist as a published event for the index to work (publish one only for a
human-readable name). Choose by goal:

- **Standalone (no dependency):** use **a key you control** as `<CTX_NS>`
  (`39998:<yourKey>:<CTX>`). Writers stamp it, readers scan it — nothing else need exist.
- **Interop with a Tapestry deployment** (so its users' pins share your bucket and its cron
  materializes TLs): use **that deployment's TA pubkey** (`GET /api/assistant/pubkey`) —
  `39998:<TA>:<CTX>`.

**Writers and readers must use the same coordinate** — the only hard requirement. The base
`tag-pinning` / `tag` / `nostr-event-tag` stamps keep the `<LEGACY_TA>` lineage constant
regardless; only the *context* stamp is your namespace choice.

---

## 5. Per-user pins → per-user feeds (the "take over your algorithm" mechanism)

Because a pin's `observer` is the user and it carries their curation knobs, **pins are how each
user gets their own algorithm** — no extra machinery. See the read guide §7 for the full adoption
path; the write side is simply:

- **Phase 1 (fixed feed):** a single curator (Alice) or a seed member set publishes the pins;
  every user reads those. You may not need any per-user writes yet.
- **Phase 2 ("take over your algorithm"):** let a logged-in user (Bob) publish **his own** pins
  into `english-speaking-nostr` — his tag choices, his `cutoff`, his `noteMethod` (§2.4). The
  reading client then keys off Bob's pins, so Bob sees a feed shaped by his own choices. The only
  change is *whose* user-signed pins get written and read; the wire shape and the (optional)
  materialization are identical.
- **Phase 2.5 (blend):** union Bob's own pins over the community set (Alice's), Bob's taking
  precedence.

Feeds "differ slightly" exactly along the pin's knobs — **which tags** the user pinned, the
**cutoff**, the apply/dispute **method** — all captured in each user-signed pin.

---

## 6. Recipe & liftable write builders

**Pin a tag into a context:**
```
ensure the tag exists:  if new, publish buildTagElement(...) then buildTaggingHeader(...)  // §2.1–2.2
publish the pin (user-signed):
    d   = "tag-pin-<slug>-<tagAuthor8>-<user8>-in-<CTX>"
    z's = ["39998:<LEGACY_TA>:tag-pinning", contextHandle(CTX_NS, CTX)]
    → sign with the user's key, publish to your relay(s)     // §2.4
```
The tag now appears in the context's chip set for every reader honoring this pinner. No server
call required.

**Liftable builders** (same pure module; inject your signer/transport):

| function | builds |
|---|---|
| `buildTagElement({ name, description, taPubkeys })` | §2.1 tag element |
| `buildTaggingHeader({ tagAuthorPubkey, slug, names, description, taPubkeys })` | §2.2 header |
| `buildEventTaggingAssertion({ headerAuthorPubkey, slug, target, polarity, asserterPubkey, taPubkeys })` | §2.3 tagging |
| `applyEventTagging({ tagInput, target, polarity, asserterPubkey, taPubkeys, deps:{ findHeaders, sign, publish, now } })` | orchestrates the tag→header→assertion sequence (publishes element+header+assertion, header+assertion, or assertion-only based on what exists); returns `{ sequence, published, failedAt }` |
| `contextHandle(nsPubkey, ctxSlug)` | the context `z` value for the pin |
| `pinVariantKey({ contextSlug })` | the `-in-<CTX>` d-tag suffix |
| `curateNotes(notes, method, cutoff)` | Strategy-A note curation matching the TLs |

> There is no `buildPin` in the module today (the reference client composes it inline in
> `ui/src/utils/publishTagPin.js` `pinTag`). Copy that structure (§2.4); ~15 lines, user-signed.

---

## 7. Publish targets (relays)

- Publish pins/tags/taggings to the relay(s) **your readers read** — the only hard requirement
  for your own feed to see them.
- For **Strategy B**, additionally publish to a relay the target **Tapestry instance** ingests.
- Pins are parameterized-replaceable; relays keep the newest per `(author, d)`. Publish kind-5
  deletions (NIP-09) to the same relays for live unpin.

---

## 8. Reference — write-side wire summary

| Action | Kind | `d` | key tags |
|---|---|---|---|
| create tag | 39999 | `<slug>` | `z:39998:<LEGACY_TA>:tag` · content `{tag:{slug,name,description}}` |
| create header | 39999 | `tagging:<slug>-tagging` | `z:39998:<LEGACY_TA>:tagging-with-specific-tag` · `a:39999:<author>:<slug>` |
| apply/dispute | 39999 | `event-tag-<slug>-<target8>-<asserter8>` | `e\|a` target · `z:39998:<LEGACY_TA>:nostr-event-tag` · `z:39999:<headerAuthor>:tagging:<slug>-tagging` · `polarity:1\|-1` |
| pin (contextual) | 39999 | `tag-pin-<slug>-<tagAuthor8>-<user8>-in-<CTX>` | `e:<tagEventId>` · `a:39999:<tagAuthor>:<slug>` · `z:39998:<LEGACY_TA>:tag-pinning` · `z:<CONTEXT_COORD>` · `curation-method` |
| unpin | 5 | — | `e:<pinEventId>` |

**Bottom line:** users can pin, tag, and unpin entirely through your own client and backend —
those are user-signed Nostr events, and each user's pins are their own algorithm. The one thing
you can't self-produce is a TA-signed Trusted List, and for a member-filtered feed you don't need
one: curate with your own trust model (Strategy A) and never touch a Tapestry server.
