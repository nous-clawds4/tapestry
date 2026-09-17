# ADR 0002: Trusted-List discovery tags — `z` names what the list is about

**Status:** Accepted (amended twice on 2026-09-10 — see "Amendment" below)
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md`

## Context

A Trusted List (TL) is a replaceable DList in the 3039x family: kind **30392** (pubkey members, `p`), **30393** (note members, `e`), **30394** (addressable members, `a`), **30395** (identity members, `i`). Per `protocols/drafts/trusted-lists.md`, "member tags — one per member, of the type the kind denotes."

Story 5 adds pins and Trusted Lists for **DList items** (addressable targets), i.e. kind **30394**. That surfaces a tag-slot collision:

- A TL also wants a **relay-filterable pointer to what the list is about** — the pinned tag, and the observer. Relays (NIP-01) index single-letter tags by *value only*, with no notion of role, so a metadata `a` and a member `a` are indistinguishable inside a single `#a` filter.
- For 30394 the natural "what is this about" letter is `a` (the tag's coordinate) — already the member letter.
- For 30392 the observer axis wants `p` — already the member letter. Consequently **30392 carries no relay-filterable discovery tag today at all**: `runOnePin` (`src/api/trustedList/refreshPinnedTags.js` ~:209–226) emits only `observer` / `source-tag` / `cutoff` / `min-rank`, all multi-letter and therefore unfilterable. Cross-observer discovery of pubkey TLs is currently impossible without scanning every 30392.
- 30393 escapes the collision by luck (members are `e`, metadata is `a` + `p`) and `runOneNotePin` (~:364–378) emits exactly that pair; `protocols/drafts/trusted-lists.md` ~:66–70 documents it as the convention.

This is **the same collision** `protocols/drafts/event-taggings.md` already solved. Its problem statement: "we would be using the `e`/`a` tag to refer to two different things — the event being tagged and the event that defines the tag being applied." It rejected **Solution 1** (positional `target`/`descriptor` fields on the `a` tag — "relays index single-letter tags by value, not by a third positional field") and **Solution 2** (custom `target`/`descriptor` tag names — "only single-letter tags are indexed"), landing on **indirect tagging**: the descriptor moves to a `z` pointing at a per-tag **tagging header** (`39999:<author>:tagging:<slug>-tagging`), which is itself an item on the firmware-seeded **type header** `39998:<TA>:tagging-with-specific-tag`.

**The structural lesson we take from that spec is its two-level anatomy, not its anchor.** `event-taggings.md` § "Tag references: `z` is membership; `a`/`e` name a specific thing" is explicit that a `z` means *membership* and nothing else: "this event is an element of that list/concept. It never means 'which tag.'" It even names the exact mistake — putting a `z` on a tagging *header* "would be wrong — it would assert the header is itself *a thing tagged X*, instead of the machinery *for* tagging things as X."

Two facts that make the `z` mechanism safe here (verified in-session):

- A `z` tag on a kind-3039x event is **inert for the graph**. `src/api/neo4j/eventSync.js` `kindToLabel` (~:154–158) returns null for any kind outside 9998/39998/9999/39999/7, and `src/api/strfry/tapestryBrainWrite.js:37` returns false unless `kind === 39999`. No TL is imported as a DList item or as a tagging, no matter what it z-tags.
- `#z` filters are relay-native (single-letter, value-indexed), and a `#z` filter takes an array, so multi-namespace reads are one query.

Concepts touched: **two new firmware concepts** (`trusted-list` and `trusted-list-for-tag`) — see Consequences; the 3039x list events themselves are not concept definitions.

One further gap, closed by the second amendment of 2026-09-10: an event-tagging carries **two** `z` tags — `["z","39998:<TA>:nostr-event-tag"]` (*what kind of thing it is*) and `["z","39999:<headerAuthor>:tagging:<slug>-tagging"]` (*which tag it is about*); `protocols/drafts/event-taggings.md` § "The proposed solution: indirect tagging" says so explicitly (worked example ~:156–157). The first version of this ADR gave a Trusted List only the per-tag `z`, so a TL never said **what kind of thing it is**. The missing analogue of `nostr-event-tag` is a **concept of Trusted Lists**.

## Options considered

### Option A — `z` → a per-tag **Trusted-List header**, itself an item on a firmware-seeded type header (chosen)

Mirror the taggings anatomy exactly one level up. A type header names the *kind of list*; a per-tag header names *this tag's* Trusted Lists; the TLs are its members:

```
39998:<TA>:trusted-list                      concept z (firmware-seeded), the analog of
                                             39998:<TA>:nostr-event-tag — "I am a Trusted List"
39998:<TA>:trusted-list-for-tag              type header (firmware-seeded), the analog of
                                             39998:<TA>:tagging-with-specific-tag
  └─ 39999:<TA>:tl:<slug>-tls                per-tag TL header; z → the type header;
                                             carries names/description + an a-tag naming
                                             the tag-element it is for
       ├─ kind 30392 pubkey TL   z → 39998:<TA>:trusted-list  +  39999:<TA>:tl:<slug>-tls
       ├─ kind 30393 note TL     z → same pair
       └─ kind 30394 item TL     z → same pair
```

Every Trusted List therefore carries **two** `z` tags, exactly as an event-tagging does: a **concept `z`** naming what kind of thing it is, and a **per-tag `z`** naming what it is about.

Members keep the kind's lowercase letter (`p`/`e`/`a`/`i`), untouched.

Pros:
- **The `z` is a true membership claim.** A Trusted List genuinely *is* an item on "the Trusted Lists for tag X." That is exactly what `event-taggings.md` says a `z` models, and it is the property the withdrawn variant lacked (see Amendment).
- **No kind filter is needed for correctness.** `{"#z":["39999:<TA>:tl:<slug>-tls"]}` returns Trusted Lists and nothing else. Adding `kinds:[30394]` narrows by *member type* — a different question, asked because the consumer wants item lists, not because the filter would otherwise be wrong.
- Corpus-native: the same two-level header/type anatomy the project already ratified for taggings, with the same naming style.
- Uniform family-wide (30392/30393/30394/30395) — the rule does not depend on which letter the kind claims for members.
- Gives 30392 the discovery axis it silently lacks.
- **Deployment-wide discovery**: `{"#z":["39998:<TA>:trusted-list"]}` returns every Trusted List regardless of tag — an axis that exists nowhere today.
- **The concept `z` is the federation seam.** `protocols/drafts/event-taggings.md` § "Concept namespaces & federation" attaches the multi-`z` federation primitive at the concept level: publish both a canonical namespace's `z` and your own, and a consumer reading *either* namespace sees the event. That is what makes the per-deployment per-tag header tolerable (see the con below and Decision 2).
- **Symmetry with the taggings family**: one mental model — concept `z` + subject `z` — covers taggings and Trusted Lists alike.
- Inert for the graph (verified above), so it cannot be mistaken for a DList membership assertion.
- The per-tag TL header is a normal DList header, so it carries human-readable `names`/`description` and an `a` pointer to the tag-element — a consumer that discovers the header learns what the lists are about without resolving anything else.

Cons:
- One more event class to create and keep alive (mitigated by lazy creation on first publish — see Consequences).
- Indirect: the pointer is to a header, not to the tag-element. Derivable from author + slug, so no signed-id lookup.
- Authoring the per-tag header under the deployment TA makes **that** coordinate per-deployment. Mitigated rather than merely conceded: the **concept `z`** is the federation seam — a TL may carry a canonical namespace's `trusted-list` concept `z` alongside its own, so cross-deployment consumers read one axis (see Decision 2 and Consequences).
- The observer axis is still not covered by `z`; observers stay on the multi-letter `observer` tag for 30392/30394 (`p` is the member letter on 30392). Cross-observer discovery is `#z` + client-side observer split.

### Option B — uppercase single-letter tags (`A` = tag coordinate, `P` = observer)

NIP-22 precedent: uppercase letters mark the root/scope while lowercase marks the immediate reference. Relays index `a-zA-Z`, so `#A` / `#P` filters are natively supported and no indirection is needed; the observer axis gets a filterable letter that Option A does not provide.

Rejected because:
- It imports a convention foreign to this corpus and would sit directly beside the `z` indirection that taggings on the same tag already use — two answers to one question, in adjacent events, for the same "what is this about" role.
- **Verification is incomplete and this ADR says so plainly:** I confirmed only that the relay **accepts** a `#A` filter (returns an empty result set, no error). End-to-end indexing — publish an event with an `A` tag, then retrieve it by `#A` — was **not** proven. Adopting it would mean betting the discovery path on an unverified index behaviour.
- The uppercase/lowercase pair reads as "same axis, different scope" (NIP-22's meaning); here the two are different *roles* (metadata vs membership), which is not what the precedent encodes.

If Option A's indirection later proves painful, Option B is the natural revisit — but it needs the end-to-end index proof first.

### Option C — keep lowercase `a` on 30394 anyway

Sketch: emit `["a", "39999:<tagAuthor>:<slug>"]` as metadata alongside the `a` member tags, mirroring 30393's current shape.

Rejected: on 30394 the metadata `a` is **indistinguishable from a member** in any relay filter. `{kinds:[30394], "#a":[X]}` would match both "lists about X" and "lists containing X as a member" — precisely the ambiguity `event-taggings.md` rejected Solution 1 over. It also cannot be salvaged with a positional marker, for the reason that spec already gives.

### Option D — `["e", tag.eventId]` (the earlier Story-5 draft)

Sketch: point at the tag element's event id.

Rejected: a tag element is an **addressable, replaceable** event. Its id churns on every republish, so lists published before a republish are orphaned from discovery while lists published after use a different id — the axis silently fragments over time. The `source-tag` fallback does not rescue it: `source-tag` is multi-letter and therefore not relay-filterable.

### Not an option — `b`

`b` expresses **definitional deference / correspondence between concept definitions** (`protocols/drafts/inherit-from.md`). A Trusted List is a computed membership snapshot, not a definition, so a `b` here would be a category error that pollutes the deference graph.

## Decision

We chose **Option A**. Every kind-3039x Trusted List carries **two** `z` tags:

1. `["z", "39998:<TA>:trusted-list"]` — the **concept `z`**: "I am a Trusted List."
2. `["z", "39999:<TA>:tl:<slug>-tls"]` — the **per-tag `z`**: a genuine membership claim on the tag's Trusted-List header.

Members keep the kind's lowercase letter. The rule applies **family-wide** to 30392/30393/30394/30395.

The five sub-decisions, made here and not deferred:

**1. The `d` of the per-tag TL header: `tl:<slug>-tls`.** It mirrors `tagging:<slug>-tagging` structurally — a `<role>:` namespace prefix, the tag slug, a role suffix that pluralizes what the header collects ("the TLs for white-hat-hacker"). `tl:` and the `-tls` suffix are already this codebase's vocabulary for the object (`tl-pin-`, `tl-pin-notes-`, `tl-pin-items-` d-prefixes in `refreshPinnedTags.js`; `buildAndPublishTL`). Rejected alternatives: `trusted-list:<slug>-trusted-lists` (accurate but three times the length, and diverges from the in-repo `tl` shorthand) and `tl:<slug>` (no role suffix — collides in spirit with a tag slug that happens to start with `tl:`, and loses the "these are lists *of* something" reading). Compose it with a new `tlHeaderAddr(authorPubkey, slug)` in `src/lib/event-tagging/handles.js` next to `taggingHeaderAddr` — never hand-format the string.

**2. Author of the per-tag TL header: the deployment TA, resolved at runtime.** `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js`) server-side; never a literal (CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode"). Rationale: the TA already signs *every* Trusted List in this deployment (`runOnePin`, `runOneNotePin`, and Story 5's item publisher are all TA-signed server-side jobs), so anchoring the header under the same key introduces **no new signing identity and no header plurality** — there is exactly one TL header per (deployment, tag slug), and the publisher can derive its coordinate from inputs it already has. The tag author was the alternative; it was rejected because the tag author is a stranger to this pipeline (they never sign a TL, may not exist as a local key, and a tag with several author-headers would reintroduce exactly the plurality that made the old header-pick rule necessary).

The honest cost, and its answer: **the per-tag coordinate is per-deployment.** Deployment X's TL header for `white-hat-hacker` is not deployment Y's. A cross-deployment consumer does what `event-taggings.md` § "Concept namespaces & federation" already prescribes for the TA-rooted concepts: treat each deployment's coordinate as one **authority namespace**, and either scan the namespace it honors or union several in one query (`"#z": [<X's coord>, <Y's coord>]` — a `#z` filter takes an array), merging at read time under its own POV. **But the concept `z` is where federation actually attaches.** `event-taggings.md` § "Concept namespaces & federation" makes the multi-`z` primitive concept-level: an event may carry a canonical namespace's concept `z` *and* its own, and a consumer scanning either namespace sees it. Trusted Lists inherit that verbatim — a deployment that wants to federate emits `["z","39998:<canonicalTA>:trusted-list"]` beside `["z","39998:<localTA>:trusted-list"]`, and cross-deployment discovery becomes a single-namespace read instead of a union of per-tag coordinates the consumer would first have to enumerate. The per-tag `z` stays local and precise; the concept `z` carries the cross-deployment traffic. Federation stays **opt-in and unenforced**; nothing here fixes a canonical authority, and the open cross-deployment-identity question (worksheet W1) is untouched.

**3. Lazy creation.** The per-tag TL header is created **on first publish if absent**, exactly as `applyEventTagging` (`src/lib/event-tagging/apply.js`) already mints a missing tagging header inside its 1/2/3-publish sequence: build and sign everything up front, then publish in dependency order (header before the event that `z`-references it) — safe because every reference is an addressable coordinate, known before signing. Landing spot: a single `ensureTLHeader({ slug, tagAuthorPubkey, taPubkey })` helper in `src/api/trustedList/refreshPinnedTags.js`, called by `runOnePin` (~:130), `runOneNotePin` (~:315) and Story 5's item publisher *before* they hand off to `buildAndPublishTL`, and memoized per refresh cycle so `refreshAllPinnedTags` does not re-check the same slug three times. Absent-header detection is a strfry scan for the coordinate; on a publish failure for the header, publish the TL **without** the `z` and log — an unanchored list is still valid, just undiscoverable by axis.

**4. Migration.** 30393 **dual-emits**: add the new `z`, keep the legacy `a`/`p` pair through a transition window, drop it in a follow-up story. 30392 and 30394 get the `z` outright (30392 has no discovery tag to preserve; 30394 is new). **No migration job**: TLs are replaceable and re-derive on the next refresh cycle, so the fleet converges on its own.

**5. `trusted-list` is a NEW firmware concept — no existing concept is its home.** Checked in-session against `firmware/active/concepts/`. `list` is "A list header with associated list items" — the generic DList-*header* concept, so it names the machinery of listing, not a derived membership snapshot, and is far too broad to serve as a discovery axis. `curated-dlist` is "the Decentralized Lists that I am delegating to my community for active curation… requires a Trust Determination method, a publication method, and a publication schedule" — the *delegation of curation to humans*, whereas a Trusted List is a machine-derived, observer-scoped, replaceable snapshot with no delegation semantics; z-tagging TLs as curated-dlists would assert a governance relationship that does not exist. `web-of-trust` is the *reputation-scoring system* (GrapeRank, follow/mute propagation) — the input that produces a TL, not the TL itself; conflating them would make `#z` on `web-of-trust` return snapshots rather than trust machinery. None fits, so **`trusted-list` is minted new**. Marginal cost is near zero: it is a second concept directory inside the firmware reinstall this ADR already requires — one reinstall either way.

Discovery becomes:

```json
{"kinds": [30394], "#z": ["39999:<TA>:tl:white-hat-hacker-tls"]}
```

and, deployment-wide across all tags:

```json
{"#z": ["39998:<TA>:trusted-list"]}
```

Ratified by the operator in session on 2026-09-10.

## Worked example

Tag slug `white-hat-hacker`; tag-element authored by Charlie; deployment TA elided as `<TA>` (this ADR keeps the `protocols/` convention of never writing a literal 64-hex pubkey). Only load-bearing tags are shown.

**The concept header** — new firmware concept, TA-authored, the analog of `nostr-event-tag`:

```json
{
  "kind": 39998,
  "pubkey": "<TA>",
  "tags": [
    ["d", "trusted-list"],
    ["names", "trusted list", "trusted lists"],
    ["description", "A replaceable DList (kind 30392/30393/30394/30395) whose members were derived from a Web-of-Trust computation performed from a specific observer's point of view."]
  ]
}
```

**The type header** — new firmware concept, TA-authored, the analog of `tagging-with-specific-tag`:

```json
{
  "kind": 39998,
  "pubkey": "<TA>",
  "tags": [
    ["d", "trusted-list-for-tag"],
    ["names", "trusted list for tag", "trusted lists for tags"],
    ["description", "A DList header for Trusted Lists derived from a specific Tag. Each item points to the Tag it is derived from via an a-tag (preferred) or e-tag."],
    ["recommended", "a"],
    ["allowed", "e"]
  ]
}
```

**The per-tag TL header** — TA-authored, lazily created; simultaneously a DList header (it has `d`/`names`/`description`) and a DList item (kind-39999 with a `z` joining the type header), exactly as the per-tag tagging header is:

```json
{
  "kind": 39999,
  "pubkey": "<TA>",
  "tags": [
    ["d", "tl:white-hat-hacker-tls"],
    ["names", "Trusted List for White Hat Hacker", "Trusted Lists for White Hat Hacker"],
    ["description", "Trusted Lists derived from the White Hat Hacker tag."],
    ["z", "39998:<TA>:trusted-list-for-tag"],
    ["a", "39999:<pubkey_charlie>:white-hat-hacker"]
  ]
}
```

**The three Trusted Lists** — members keep the kind's lowercase letter; the **`z` pair** is identical across all three:

```json
{
  "kind": 30392,
  "tags": [
    ["d", "tl-pin-<observer8>-<tagAuthor8>-white-hat-hacker"],
    ["p", "<pubkey_member>"],
    ["z", "39998:<TA>:trusted-list"],
    ["z", "39999:<TA>:tl:white-hat-hacker-tls"]
  ]
}
```

```json
{
  "kind": 30393,
  "tags": [
    ["d", "tl-pin-notes-<observer8>-<tagAuthor8>-white-hat-hacker"],
    ["e", "<note_event_id>"],
    ["z", "39998:<TA>:trusted-list"],
    ["z", "39999:<TA>:tl:white-hat-hacker-tls"],
    ["a", "39999:<pubkey_charlie>:white-hat-hacker"],
    ["p", "<observer_pubkey>"]
  ]
}
```

(The trailing `a`/`p` on the 30393 are the **legacy** pair, retained only for the dual-emit window.)

```json
{
  "kind": 30394,
  "tags": [
    ["d", "tl-pin-items-<observer8>-<tagAuthor8>-white-hat-hacker"],
    ["a", "39999:<pubkey_author>:<item_slug>"],
    ["z", "39998:<TA>:trusted-list"],
    ["z", "39999:<TA>:tl:white-hat-hacker-tls"]
  ]
}
```

Every `a` on the 30394 is a member address — the tag's own coordinate never appears there (Story 5 edge case E1 holds).

## Amendment (2026-09-10)

### Second amendment — the concept `z` was missing

**Added:** every Trusted List now carries a **second `z`**, `["z", "39998:<TA>:trusted-list"]`, alongside the per-tag `z`. Ratified by the operator in session on 2026-09-10, after the first amendment below.

Why: an event-tagging carries two `z` tags — `39998:<TA>:nostr-event-tag` (what kind of thing it is) and `39999:<headerAuthor>:tagging:<slug>-tagging` (which tag it is about) — and `protocols/drafts/event-taggings.md` § "The proposed solution: indirect tagging" says so in as many words. The first version of this ADR gave a TL only the per-tag `z`, so a Trusted List never stated *what kind of thing it is*. That cost two things: (a) there was no deployment-wide "give me every Trusted List" axis, and (b) — the important one — the multi-`z` federation primitive attaches at the **concept** level in that same spec, so without a concept `z` this ADR's own conceded weak point (the per-tag header is per-deployment because the TA authors it) had no clean answer beyond an enumerated union. The concept `z` is the federation seam, mirroring event-taggings exactly.

`trusted-list` is a **new** firmware concept — see Decision 5 for why `list`, `curated-dlist` and `web-of-trust` were each checked and rejected as its home. Firmware reinstall was already required by the first amendment; this adds a second concept directory to that same reinstall.

Unchanged by this amendment: the per-tag header `39999:<TA>:tl:<slug>-tls`, the type header `39998:<TA>:trusted-list-for-tag`, TA authorship, lazy creation, the 30393 dual-emit posture, Options B/C/D and the `b` non-option, and the Status (**Accepted**).

### First amendment — the per-tag `z` was pointed at the wrong header

**Superseded:** the originally-accepted form of Option A pointed the TL's `z` at the **per-tag tagging header** (`39999:<headerAuthor>:tagging:<slug>-tagging`) and relied on a `kinds` filter to separate lists from taggings sharing that anchor. The operator withdrew it in session on 2026-09-10.

Why: it was a **false membership claim**. A `z` asserts "I am an item on that list"; the tagging header's list is "taggings that use tag X"; **a Trusted List is not a tagging**. The query only appeared to work because the kind filter papered over the error — any consumer who queried that header's `#z` without a kind filter would get taggings and Trusted Lists mixed in one result set. That is precisely the incoherence this ADR exists to remove, and it contradicts `event-taggings.md` § "Tag references: `z` is membership", which states the rule and even names this class of mistake.

Also withdrawn with it: **the `pickHeader`-based header-author rule**. It existed only to disambiguate the plural, user-authored tagging headers; with a TA-authored TL header there is exactly one coordinate per (deployment, slug) and nothing to pick. Implementations must not carry `pickHeader` into the TL publisher.

Unchanged by this amendment: Options B, C, D and the `b` non-option, and their rejections; the family-wide scope; the 30393 dual-emit posture; and the Status (**Accepted**).

## Consequences

**Firmware reinstall required?** **Yes** — **two new concept directories, one reinstall.** (1) `firmware/versions/v1.0.0/concepts/trusted-list-for-tag/{concept-header.json,json-schema.json}` mirroring `tagging-with-specific-tag/` (including its `headerTags` `["recommended","a"] / ["allowed","e"]` pair); (2) `firmware/versions/v1.0.0/concepts/trusted-list/{concept-header.json,json-schema.json}` modeled on `nostr-event-tag/` — the concept-`z` target. Both need a matching `manifest.json` entry. (`v1.0.0` is the live version — `firmware/active` symlinks it; verified 2026-09-10.) After that, `POST /api/firmware/install` must be run on every deployment before the TL publisher is enabled — a TL whose header joins a type header that does not exist locally is unanchored in the graph. This **reverses the previous "No firmware reinstall" line.**

**Irreversibility trigger.** The firmware change trips the irreversibility trigger (new permanent concept handle + permanent `tl:<slug>-tls` d-form once published). Already satisfied: Story 5 runs **Standard** governed by this ADR.

**Per-deployment coordinate, and the federation seam.** See Decision 2. The per-tag header coordinate is per-deployment; the **concept `z` is where cross-deployment federation attaches**, per `event-taggings.md` § "Concept namespaces & federation" — a federating deployment emits a canonical namespace's `trusted-list` concept `z` beside its own, and consumers read one namespace instead of enumerating per-tag coordinates. No canonical authority is fixed here; emitting the extra namespace `z` is opt-in and out of Story 5's scope.

**Migration for the note TL (30393).** Dual-emit — add `z`, keep `a`/`p` — for a transition window, then drop the lowercase pair in a follow-up. No migration job; replaceable lists re-derive on the next refresh cycle. The pubkey TL (30392) has nothing to migrate and gains `z` outright.

**Spec updates required** (name only; writing them is a separate task): `protocols/drafts/trusted-lists.md` — the "optional relay-filterable discovery tags" bullet (~:66–70) is superseded and becomes the family-wide `z` → per-tag TL header convention, documenting the two-level anatomy, the TA-authored header, and the 30393 `a`/`p` pair as legacy-during-transition. The same file must also document the **two-`z` shape** (concept `z` + per-tag `z`) and the concept `z` as the federation seam. `protocols/drafts/event-taggings.md` — **yes, a cross-reference is warranted but small**: one line in or near § "Tag references: `z` is membership" noting that Trusted Lists reuse this two-level header pattern *and* the same concept-`z`-plus-subject-`z` shape, with their own type header, and that the tagging header is *not* their anchor. No change to any tagging wire shape.

**What breaks:** nothing published. `z` is additive; existing 30393 consumers keep working through the dual-emit window. Anything relying on 30393's `a`/`p` must move to `#z` before the pair is dropped. Deployments that install the code without reinstalling firmware publish valid-but-unanchored headers.

**What this enables:** cross-observer discovery for 30394, the first filterable discovery axis for 30392, a **deployment-wide "every Trusted List" axis** (`{"#z":["39998:<TA>:trusted-list"]}`) that exists nowhere today, a concept-level federation seam that answers the per-deployment-coordinate weakness, one uniform rule across the family instead of per-kind luck, and a discovery filter that is correct without a kind filter.

**New debt:** the observer axis remains multi-letter (`observer`) and unfilterable on 30392/30394; if cross-observer-by-observer discovery becomes a real query, that needs its own decision (Option B is the candidate, pending the index proof). Lazy header creation adds one strfry existence check per (cycle, slug) — memoize it.

**Scope:** Story 5 (`engineering-team/stories/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md`) runs **Standard** — this ADR escalated it, and the firmware change is now in its scope.

## Implementation notes

- `src/lib/event-tagging/handles.js` — add `conceptTrustedList(taPubkey)` → `39998:<TA>:trusted-list`, `conceptTrustedListForTag(taPubkey)` → `39998:<TA>:trusted-list-for-tag`, and `tlHeaderAddr(authorPubkey, slug)` → `39999:<author>:tl:<slug>-tls`, alongside the existing composers. Pure string composition, pubkey as a parameter.
- `src/api/trustedList/refreshPinnedTags.js` — add `ensureTLHeader({ slug, tagAuthorPubkey })`: scan for `tlHeaderAddr(taPubkey, slug)`; if absent, build/sign/publish the kind-39999 header (with `z` → type header and `a` → tag-element) *before* the list. Memoize per refresh cycle. Call it from `runOnePin` (~:130), `runOneNotePin` (~:315), and Story 5's item publisher.
- `runOnePin` (~:209–226, kind 30392): add **both** `['z', conceptTrustedList(taPubkey)]` and `['z', tlHeaderAddr(taPubkey, slug)]`. `runOneNotePin` (~:364–378, kind 30393): add the same `z` pair, **keep** the existing `['a', ...]` and `['p', observer]` during the transition window.
- Story 5's item-TL publisher (kind 30394): emit the same two `z` tags; members stay lowercase `a`. Do **not** emit a metadata `a`.
- TA pubkey via `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js`) at module init. No literal pubkeys. Do **not** import `pickHeader` here — it is withdrawn for this path (see Amendment).
- Firmware: new `trusted-list-for-tag` concept dir (modeled on `tagging-with-specific-tag`) **and** new `trusted-list` concept dir (modeled on `nostr-event-tag`), both with manifest entries; then one `POST /api/firmware/install`.

## Out of scope

- Whether uppercase single-letter tags (Option B) are viable in this stack — needs an end-to-end `#A` index proof; deferred.
- A filterable **observer** axis for 30392/30394.
- The timing of dropping 30393's legacy `a`/`p` pair (a follow-up story).
- Any change to how taggings themselves are published or imported.
- Choosing a canonical cross-deployment authority namespace for `trusted-list` / `trusted-list-for-tag`, and emitting that second namespace's concept `z` (worksheet W1) — the seam is established here; using it is opt-in and later.
