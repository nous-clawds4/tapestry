> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** the protocol author's draft (PR #325); event-tagging epic ADR 0001 (`engineering-team/decisions/event-tagging/0001-protocol-core-and-spec.md`); the dependency-free reference implementation at `src/lib/event-tagging/`; the sibling family spec [Tags & Taggings](./tags.md) and [Decentralized Lists](../nips/decentralized-lists.md).

---

Event Taggings
==============

This protocol defines how to tag Nostr **events** (as opposed to pubkeys). Taggings are ordinary kind-`39999` [Decentralized-List](../nips/decentralized-lists.md) items distinguished by which concepts their `z` tags reference. It is the `nostr-event-tag` member of the taggings family introduced in [Tags & Taggings](./tags.md), which specifies tagging **pubkeys**; this document specifies tagging **events**, beginning with kind-1 notes and the addressable kinds 39998/39999 (DList headers and items).

Throughout, `<TA_pubkey>` denotes a deployment's **Tapestry-Assistant** pubkey — the identity that seeds the firmware concept headers. It differs per deployment and is never hardcoded by implementations; handles are composed from the runtime value.

## The problem

When tagging a Nostr user, we use the `p` tag to refer to the subject being tagged and either the `e` or the `a` tag to refer to the event that defines the tag being applied. Because target (`p`) and descriptor (`a`) occupy different tag slots, there is no ambiguity.

When tagging a Nostr event, the naive approach would be to use the `e` or the `a` tag to refer to the event being tagged. The problem is that this creates ambiguity: we would be using the `e`/`a` tag to refer to two different things — the event being tagged and the event that defines the tag being applied.

This is most stark when tagging a tag. For tags, the `a` tag (rather than `e`) is the standard point of reference. Suppose we have two tags, `Awesome Tag` and `Useful Tag`. Alice wants to tag `Awesome Tag` as a `Useful Tag`; Bob wants the reverse. With both references in `a` tags, there is no way to disambiguate which is the target and which is the descriptor.

## Solution 1: extra a-tag fields (rejected)

One option is to disambiguate with extra positional fields on the a-tag — a `target` field for the event being tagged and a `descriptor` field for the tag being applied:

```json
{
  "kind": 39999,
  "tags": [
    ["a", "<awesome-tag-coord>", "target"],
    ["a", "<useful-tag-coord>", "descriptor"]
  ]
}
```

But to collect all instances of a particular tag being used we would want a single relay filter:

```json
{"kinds": [39999], "#a": ["<descriptor-coord>"]}
```

The positional-field approach defeats that: relays index single-letter tags by value, not by a third positional field, so a consumer would have to fetch every `#a` match and re-filter on the `target`/`descriptor` marker client-side. Rejected on relay-filterability.

## Solution 2: new tags (rejected)

A second option introduces custom tag names — a `target` tag and a `descriptor` tag:

```json
{
  "kind": 39999,
  "tags": [
    ["target", "<target-event-id>"],
    ["descriptor", "<descriptor-event-id>"]
  ]
}
```

Nostr relays (NIP-01) only index **single-letter** tags, so `#target` / `#descriptor` filters are not natively supported. Rejected on the same relay-filterability grounds.

## The proposed solution: indirect tagging

We use a **z-tag** to disambiguate. The `e`/`a` tag continues to refer to **the event being tagged** (the target); a **z-tag** refers to **the tag being applied** (the descriptor), indirectly, by pointing at a per-tag *tagging header* (defined below).

A tagging genuinely *is* "an item on the list of things tagged X", which is exactly what z-tags model. And there is no prohibition on multiple z-tags in one event — indeed it is natural: an event for "Rover" belongs on the list of dogs *and* the list of animals, so it may carry a z-tag for each. An event-tagging carries two z-tags: one naming it a *nostr event tagging* in general, and one naming *which tag* it applies.

## Worked example

We tag a Tag — "Good Tag", authored by Charlie — as an "Awesome Tag" (previously defined by Jack). (Tagging a tag is the hardest case; tagging a kind-1 note is the same shape with the target carried in `e` instead of `a` — see "Targets" below.)

**The tag-elements.** A tag is a kind-`39999` event joining the deployment's `tag` concept; its slug is its `d` tag and its display fields live in `content` (see [Tags & Taggings](./tags.md) § "Tag definitions"). The tag-element is addressable at `39999:<author>:<slug>`.

```json
{
  "kind": 39999,
  "pubkey": "<pubkey_charlie>",
  "content": "{\"tag\":{\"slug\":\"good-tag\",\"name\":\"Good Tag\",\"description\":\"Marks tags that people consider good.\"}}",
  "tags": [
    ["d", "good-tag"],
    ["z", "39998:<TA_pubkey>:tag"]
  ]
}
```

```json
{
  "kind": 39999,
  "pubkey": "<pubkey_jack>",
  "content": "{\"tag\":{\"slug\":\"awesome-tag\",\"name\":\"Awesome Tag\",\"description\":\"Marks tags that people consider awesome.\"}}",
  "tags": [
    ["d", "awesome-tag"],
    ["z", "39998:<TA_pubkey>:tag"]
  ]
}
```

**The `nostr-event-tag` list header** — the firmware-seeded DList of all event taggings, authored by the deployment TA:

```json
{
  "kind": 39998,
  "pubkey": "<TA_pubkey>",
  "content": "",
  "tags": [
    ["d", "nostr-event-tag"],
    ["names", "nostr event tagging", "nostr event taggings"],
    ["description", "An event that applies a specific Tag to a specific event (referenced by e or a)."]
  ]
}
```

**The `tagging-with-specific-tag` list header** — the firmware-seeded DList *type* whose members are the per-tag tagging headers. Each member must carry an `a` (preferred) or `e` tag pointing at the tag-element it is "for":

```json
{
  "kind": 39998,
  "pubkey": "<TA_pubkey>",
  "content": "",
  "tags": [
    ["d", "tagging-with-specific-tag"],
    ["names", "tagging with specific tag", "taggings with specific tags"],
    ["description", "A DList header for taggings that use a specific Tag. Each item points to the Tag being used via an a-tag (preferred) or e-tag."],
    ["recommended", "a"],
    ["allowed", "e"]
  ]
}
```

**The per-tag tagging header** — "taggings of events as an Awesome Tag", authored by Jack alongside the Awesome Tag tag-element. It is *simultaneously* a DList header (it carries `names`, `description`, `d`) **and** a DList item (it carries a `z` joining `tagging-with-specific-tag`, and is kind-`39999`). [Decentralized Lists](../nips/decentralized-lists.md) permits a kind-`39999` event to act as a list header when it meets the header criteria; this one must be kind-`39999` precisely so it can be an item on the `tagging-with-specific-tag` list. Its `a` tag points at the tag-element it applies:

```json
{
  "kind": 39999,
  "pubkey": "<pubkey_jack>",
  "content": "",
  "tags": [
    ["d", "tagging:awesome-tag-tagging"],
    ["names", "Tagging of an event as an Awesome Tag", "Taggings of events as Awesome Tags"],
    ["description", "Applies the Awesome Tag to an event."],
    ["z", "39998:<TA_pubkey>:tagging-with-specific-tag"],
    ["a", "39999:<pubkey_jack>:awesome-tag"]
  ]
}
```

**The tagging assertion** — Alice tags Charlie's "Good Tag" as an "Awesome Tag". The target (`Good Tag`) is in the `a` tag; the descriptor is referenced **indirectly** through Jack's tagging header in a `z` tag:

```json
{
  "kind": 39999,
  "pubkey": "<pubkey_alice>",
  "content": "",
  "tags": [
    ["d", "event-tag-awesome-tag-<pubkey_charlie[0:8]>-<pubkey_alice[0:8]>"],
    ["a", "39999:<pubkey_charlie>:good-tag"],
    ["z", "39998:<TA_pubkey>:nostr-event-tag"],
    ["z", "39999:<pubkey_jack>:tagging:awesome-tag-tagging"],
    ["polarity", "1"]
  ]
}
```

## Tag references: `z` is membership; `a`/`e` name a specific thing

These three tags play distinct roles, and conflating them is the easiest mistake to make here:

- **`z`** means *membership* — "this event is an element of that list/concept." It never means "which tag."
- **`a`** names *which addressable thing* — e.g. a tag-element at its coordinate `39999:<author>:<slug>`, and it tracks that thing through edits.
- **`e`** names *one specific event version* by id.

Consequently the two event types reference their tag **differently**:

- A **tagging header** names its tag with a direct **`a`** tag (`["a","39999:<author>:<slug>"]`, as in the header above). It has no target, so the `a` slot is free. (A `z` here would be wrong — it would assert the header is itself *a thing tagged X*, instead of the machinery *for* tagging things as X.) The `tagging-with-specific-tag` header's `recommended a` / `allowed e` rule governs **exactly this** reference — the header→tag pointer — preferring the stable `a` coordinate over a frozen `e` version.
- A **tagging assertion** cannot use `a`/`e` for its tag, because those slots are occupied by the **target** event. So it reaches its tag **indirectly**, via a `z` to the per-tag header. This indirection exists *only* to free `a`/`e` for the target — it is the entire reason the per-tag header exists.

This mirrors pubkey-tagging, where the target is a `p` tag, leaving `a`/`e` free to name the tag directly — no indirection needed.

## Targets

The target event is carried in the `a`/`e` slot, chosen by the **target's own kind** (independent of the `tagging-with-specific-tag` rule above, which is about a *header's* reference to its tag, not the assertion's reference to its target):

- **Addressable target** (a tag, a DList, any replaceable/addressable event): an `a` tag with the target's coordinate `<kind>:<author>:<d>`, as above.
- **Non-addressable target** (a **kind-1 note**, or any plain event): an `e` tag with the target event id. Everything else about the assertion is identical.

## Polarity

`polarity` is `"1"` (apply) or `"-1"` (dispute); an **absent** `polarity` tag means apply. v1 interpretation buckets values: `≥ 0.5` counts as applied, `≤ −0.5` as disputed, and the open interval between is reserved for a future graded-valence arc (worksheet [W3](../worksheet.md)) and not counted in v1. Because `polarity` is a multi-letter tag, it is **not relay-filterable**; excluding disputes is therefore a read-time operation (see "Reading is per-POV").

## The assertion d-tag (normative)

An assertion's `d` tag is deterministic, giving each asserter exactly one live stance per (descriptor, target): republishing at the same address replaces the prior assertion, including flips between apply and dispute.

```
d = event-tag-<descriptor>-<target8>-<asserter8>
```

- `<descriptor>` — the applied tag's slug (e.g. `awesome-tag`).
- `<target8>` — the first 8 characters of the target's identifier: the **event id** for an `e` target, or the **author-pubkey segment of the coordinate** (`<coord>.split(":")[1][0:8]`) for an `a` target.
- `<asserter8>` — the first 8 characters of the asserting pubkey.

The per-tag tagging header's `d` is likewise deterministic: `tagging:<slug>-tagging`.

## Discovery

The filters below return **candidate** events. Whether each candidate counts is a read-time, per-POV decision (see the next section) — the filters are how you *find* taggings, not how you decide which are true.

**All taggings that apply a given tag** (forward) — a single `#z` over the tag's tagging header:

```json
{"kinds":[39999], "#z":["39999:<pubkey_jack>:tagging:awesome-tag-tagging"]}
```

**Was a specific event tagged as an Awesome Tag?** — add the target to the forward filter (`#a` for an addressable target, `#e` for a note):

```json
{"kinds":[39999], "#z":["39999:<pubkey_jack>:tagging:awesome-tag-tagging"], "#a":["39999:<pubkey_charlie>:good-tag"]}
```

**All tags applied to a given event** (reverse) — scan candidate taggings whose target is the event, then resolve each candidate's descriptor:

```json
{"kinds":[39999], "#a":["39999:<pubkey_charlie>:good-tag"]}
```

(for a kind-1 note, use `{"kinds":[39999], "#e":["<note-id>"]}` instead). For each returned candidate, read its descriptor `z` tag and confirm that the referenced header is itself a member of `39998:<TA_pubkey>:tagging-with-specific-tag` — i.e. a legitimate tagging header. That membership test is a per-result resolve; the descriptor headers are bounded and cacheable.

**Which tags is a given tag-element event-taggable as / who has set it up** — the per-tag headers that exist for a tag:

```json
{"kinds":[39999], "#a":["39999:<pubkey_jack>:awesome-tag"], "#z":["39998:<TA_pubkey>:tagging-with-specific-tag"]}
```

Events are tagged **only indirectly** (through a `z`-referenced tagging header). A `z`-less `a`/`e` reference to an event is undefined under this protocol and MUST NOT be interpreted as a tagging.

## Reading is per-POV (candidates, not truth)

Publication is permissionless: anyone may publish a tagging asserting anything. The discovery filters above therefore yield **candidates**, not a global membership set. Whether a given tagging *counts* — and thus whether an event "is" tagged as X — is computed from a specific point of view (POV) at **read time**, by applying that POV's web-of-trust scoring to the asserters and bucketing by `polarity`. There is no global "the event is tagged X"; different POVs may legitimately disagree, and the same filter result is interpreted differently per POV. Consumers MUST NOT treat a raw filter hit as established truth.

## Concept namespaces & federation

The two TA-rooted concepts — `39998:<TA>:nostr-event-tag` and `39998:<TA>:tagging-with-specific-tag` — are **namespaced by an authority pubkey** `<TA>` (in this protocol, a deployment's designated assistant). The per-tag tagging header, by contrast, is rooted in the *user's* own pubkey (`39999:<author>:tagging:<slug>-tagging`) and so is the same everywhere.

A tagging assertion (and a tagging header, and a tag-element) **MAY carry more than one concept `z`-tag for the same concept** — one per authority namespace it wishes to join. This is the federation primitive:

- **Federate:** publish both a shared/canonical namespace's `z` and your own namespace's `z` (e.g. `z = 39998:<canonical>:nostr-event-tag` **and** `z = 39998:<own>:nostr-event-tag`). The event then aggregates in both — consumers reading either namespace see it.
- **Splinter:** publish only your own namespace's `z`. The event lives solely on your island.
- **Partial:** any subset of namespaces a publisher chooses.

Federation is therefore **opt-in and unenforced** — which authority namespace(s) an implementation joins is a deployment policy, not a fixed part of the wire format. A reader likewise chooses which namespace(s) to scan and may union across them at read time (still subject to the per-POV interpretation above). How independent deployments agree on a shared canonical namespace is the open cross-deployment-identity question tracked in [Tags & Taggings](./tags.md) (worksheet W1); this spec only fixes the *mechanism* (repeatable concept `z`-tags), not the choice of canonical authority.

## Reading: which taggings count is reader-determined

Two reader-side parameters decide whether a candidate tagging counts. The protocol fixes **neither** — both are the reader's choice:

1. **Trust (per-POV).** Asserters are scored by the reader's POV web-of-trust; an out-of-trust asserter does not count for that reader (above).
2. **Legitimacy authority.** A candidate counts as a *tagging* only if its descriptor `z` resolves to a header that is a member of a `tagging-with-specific-tag` namespace the reader **honors**. The set of honored authority namespaces is a **reader parameter** (e.g. a shared canonical namespace, the reader's own, or both) — not a single value baked into the protocol or hardcoded by a consumer. Because the candidate scan keys on the **target** (`#e`/`#a`), which is namespace-agnostic, a tagging published under *any* authority is always **present** in the candidate set; only whether it **counts** depends on the honored set. A reader honoring a different or additional authority therefore sees taggings that a canonical-only reader would not.

**Unverifiable ≠ illegitimate.** A candidate whose header is **not resolvable** on the data the reader has (e.g. it has not propagated) is **unverifiable** — distinct from a header that resolves and is confirmed *not* a member of the honored authority (**illegitimate**). Implementations SHOULD surface this distinction rather than silently dropping unverifiable candidates: "cannot determine" is not "not a tagging."

Consequently, disagreement is expressible at several independent layers, none of which requires permission from — or is foreclosed by — any canonical authority: distrust the asserters (POV scoring); publish a counter-assertion or use a different tag (both permissionless); honor a different legitimacy authority (reader parameter); or run a separate deployment that seeds/federates its own authority (the most complete form). An implementation that hardcodes a single legitimacy authority collapses these layers and removes the per-POV property invariant #1 requires.

## Firmware seeding

Each TA-rooted concept (`nostr-event-tag`, `tagging-with-specific-tag`) is established under its authority pubkey at deployment time (in this implementation, via firmware). A deployment composes its **own** namespace handle from its runtime authority pubkey — never a hardcoded literal — and, to federate, additionally references a shared canonical namespace (which may bridge to it via a community-reference pointer). The tag-elements and per-tag tagging headers are user-authored and permissionless — anyone may create them.

## Applicability hint on new tag-elements

When the event-tagging flow **mints a brand-new tag-element** (the 3-publish sequence), the
tag-element SHOULD additionally carry the additive, pubkey-free hint `["z", "tag-for-nostr-event"]` —
recording that the tag was born in an event-tagging context. Normative rules for the hint (additive
only; hint-never-gate; the operative source is the derived HINT ∪ USAGE applicability view) are in
[Tags & Taggings → Applicability hints](./tags.md#applicability-hints-optional-additive). The
reference implementation's `applyEventTagging` emits it automatically; assertions and per-tag
headers never carry it.

## Relationship to other specs

- **[Tags & Taggings](./tags.md)** — defines tag-elements and the taggings family. This spec is its `nostr-event-tag` member; the tag-element shape (`d = <slug>`, `z` → the deployment's `tag` concept, display fields in `content`) is defined there and reused here unchanged — including the optional **applicability hint** `z` (above). The `tagging-with-specific-tag` header makes concrete the `e`-vs-`a` parent-reference question that spec tracks as worksheet [W4](../worksheet.md) (here: `a` preferred, `e` allowed). The family's naming and expansion are worksheet [W10](../worksheet.md).
- **[Decentralized Lists](../nips/decentralized-lists.md)** — the kind-39998/39999 list mechanics, including the kind-39999-as-list-header allowance the per-tag tagging header relies on.
