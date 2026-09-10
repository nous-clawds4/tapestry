# ADR 0002: Trusted-List discovery tags — `z` names what the list is about

**Status:** Accepted
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md`

## Context

A Trusted List (TL) is a replaceable DList in the 3039x family: kind **30392** (pubkey members, `p`), **30393** (note members, `e`), **30394** (addressable members, `a`), **30395** (identity members, `i`). Per `protocols/drafts/trusted-lists.md`, "member tags — one per member, of the type the kind denotes."

Story 5 adds pins and Trusted Lists for **DList items** (addressable targets), i.e. kind **30394**. That surfaces a tag-slot collision:

- A TL also wants a **relay-filterable pointer to what the list is about** — the pinned tag, and the observer. Relays (NIP-01) index single-letter tags by *value only*, with no notion of role, so a metadata `a` and a member `a` are indistinguishable inside a single `#a` filter.
- For 30394 the natural "what is this about" letter is `a` (the tag's coordinate) — already the member letter.
- For 30392 the observer axis wants `p` — already the member letter. Consequently **30392 carries no relay-filterable discovery tag today at all**: `runOnePin` (`src/api/trustedList/refreshPinnedTags.js` ~:209–226) emits only `observer` / `source-tag` / `cutoff` / `min-rank`, all multi-letter and therefore unfilterable. Cross-observer discovery of pubkey TLs is currently impossible without scanning every 30392.
- 30393 escapes the collision by luck (members are `e`, metadata is `a` + `p`) and `runOneNotePin` (~:364–378) emits exactly that pair; `protocols/drafts/trusted-lists.md` ~:66–70 documents it as the convention.

This is **the same collision** `protocols/drafts/event-taggings.md` already solved. Its problem statement: "we would be using the `e`/`a` tag to refer to two different things — the event being tagged and the event that defines the tag being applied." It rejected **Solution 1** (positional `target`/`descriptor` fields on the `a` tag — "relays index single-letter tags by value, not by a third positional field") and **Solution 2** (custom `target`/`descriptor` tag names — "only single-letter tags are indexed"), landing on **indirect tagging**: the descriptor moves to a `z` pointing at a per-tag **tagging header**, `39999:<headerAuthor>:tagging:<slug>-tagging` (`taggingHeaderAddr`, `src/lib/event-tagging/handles.js:27-29`). Event-tagging assertions already z-tag exactly that anchor.

Two facts that make the reuse safe (verified in-session):

- A `z` tag on a kind-3039x event is **inert for the graph**. `src/api/neo4j/eventSync.js` `kindToLabel` (~:154–158) returns null for any kind outside 9998/39998/9999/39999/7, and `src/api/strfry/tapestryBrainWrite.js:37` returns false unless `kind === 39999`. No TL is imported as a DList item or as a tagging, no matter what it z-tags.
- The kind itself disambiguates lists from the taggings that share the anchor: `{kinds:[30394], "#z":[headerCoord]}` returns lists; `{kinds:[39999], "#z":[headerCoord]}` returns taggings.

Concepts touched: none. This ADR changes *tag layout on published 3039x list events*, not any 39998/39999 concept definition.

## Options considered

### Option A — `z` → the per-tag tagging header (chosen)

Every TL in the family carries `["z", "39999:<headerAuthor>:tagging:<slug>-tagging"]` naming what the list is about; members keep the kind's lowercase letter untouched.

Pros:
- Corpus-native. It is the indirection this project already ratified for the identical collision, so there is one answer to "how do I name a descriptor when the natural letter is taken."
- Same anchor as the taggings themselves: a consumer holding a tag's header coordinate can fetch both the assertions and the lists derived from them with two filters that differ only in `kinds`.
- Uniform family-wide (30392/30393/30394/30395) — the rule does not depend on which letter the kind claims for members.
- Gives 30392 the discovery axis it silently lacks.
- Inert for the graph (verified above), so it cannot be mistaken for a DList membership assertion.

Cons:
- Indirect: the pointer is to a *tagging header*, not to the tag element, so a consumer must resolve the header coordinate before querying. (It is derivable from author + slug — no signed id lookup.)
- Inherits **header plurality** from event-taggings: a tag may have several headers, one per author (`pickHeader` / `findHeaders`, `src/lib/event-tagging/apply.js:63-73`). See Consequences.
- The observer axis is not covered by `z`; observers stay on the multi-letter `observer` tag for 30392/30394 (`p` is the member letter on 30392). Cross-observer discovery is `#z` + client-side observer split.

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

We chose **Option A**. Trusted Lists carry a `z` tag naming what the list is about, pointing at the tag's per-tag tagging header `39999:<headerAuthor>:tagging:<slug>-tagging`; members keep the kind's lowercase letter. The rule applies **family-wide** to 30392/30393/30394/30395.

Cross-observer discovery becomes:

```json
{"kinds": [30394], "#z": ["39999:<headerAuthor>:tagging:<slug>-tagging"]}
```

and the kind disambiguates lists from the taggings that share the anchor.

Ratified by the operator in session on 2026-09-10.

## Consequences

**Header plurality — the wrinkle, and the rule.** Tagging headers are per author, so a tag may have several. The TL publisher **must reuse the existing `pickHeader` rule** (`src/lib/event-tagging/apply.js:63-73`): prefer a header authored by the canonical TA pubkey (`taPubkeys[0]`, resolved at runtime — never hardcoded, per CLAUDE.md), otherwise the valid header with the lowest lexicographic author. Justification: this is *by construction* the same header the observer's own taggings anchored on, because those taggings were applied through this very function with the same inputs. Reusing it makes the TL's `z` and its source assertions agree without any extra bookkeeping, and it is deterministic across refreshes (so a replaceable list keeps a stable `z` and does not thrash its discovery axis). A "most-used header" heuristic was considered and rejected: it is non-deterministic under a moving corpus and would let a burst of assertions re-anchor existing lists.

Consumers that hold a *different* header for the same tag: resolve the tag's header set with `findHeaders` and query `#z` with **all** header coordinates (a `#z` filter takes an array), then merge. This plurality is **inherited from event-taggings, not invented here** — a consumer of assertions already faces it and already has the tool.

**Migration for the note TL (30393).** It carries lowercase `a` + `p` today. Posture: **dual-emit** — add `z`, keep `a`/`p` — for a transition window, then drop the lowercase pair in a follow-up. No migration job is needed: TLs are replaceable and re-derive on the next refresh cycle, so the fleet converges on its own. The pubkey TL (30392) has nothing to migrate; it gains `z` outright.

**Spec updates required** (name only; writing them is a separate task): `protocols/drafts/trusted-lists.md` — the "optional relay-filterable discovery tags" bullet (~:66–70) is superseded and becomes the `z` convention stated family-wide, with the 30393 `a`/`p` pair recorded as legacy-during-transition. `protocols/drafts/event-taggings.md` may gain a cross-reference noting the shared anchor.

**What breaks:** nothing published. `z` is additive; existing 30393 consumers keep working through the dual-emit window. Anything relying on 30393's `a`/`p` must move to `#z` before the pair is dropped.

**What this enables:** cross-observer discovery for 30394, the first filterable discovery axis for 30392, and one uniform rule across the family instead of per-kind luck.

**New debt:** the observer axis remains multi-letter (`observer`) and unfilterable on 30392/30394; if cross-observer-by-observer discovery becomes a real query, that needs its own decision (Option B is the candidate, pending the index proof).

**Scope:** Story 5 (`engineering-team/stories/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md`) now runs **Standard** — this ADR escalated it.

**Firmware reinstall required?** **No.** No concept definition changes; only tag layout on published 3039x list events.

## Implementation notes

- File: `src/api/trustedList/refreshPinnedTags.js` — `runOnePin` (~:209–226, kind 30392): add `['z', taggingHeaderAddr(headerAuthor, slug)]` to the emitted tags. `runOneNotePin` (~:364–378, kind 30393): add the same `z`, **keep** the existing `['a', ...]` and `['p', observer]` during the transition window.
- Story 5's new item-TL publisher (kind 30394): emit `['z', taggingHeaderAddr(headerAuthor, slug)]`; members stay lowercase `a`. Do **not** emit a metadata `a`.
- Header author resolution: reuse `pickHeader` from `src/lib/event-tagging/apply.js` (export it if not already exported) fed by `findHeaders` and the runtime TA pubkey list from `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js`). No literal pubkeys.
- Coordinate construction: use `taggingHeaderAddr(author, slug)` from `src/lib/event-tagging/handles.js` — do not hand-format the string.
- If no header exists for the tag (`pickHeader` returns null), publish the TL **without** the `z` rather than inventing a coordinate, and log it; a list with no anchor is still valid, just undiscoverable by axis.

## Out of scope

- Whether uppercase single-letter tags (Option B) are viable in this stack — needs an end-to-end `#A` index proof; deferred.
- A filterable **observer** axis for 30392/30394.
- The timing of dropping 30393's legacy `a`/`p` pair (a follow-up story).
- Any change to how taggings themselves are published or imported.
