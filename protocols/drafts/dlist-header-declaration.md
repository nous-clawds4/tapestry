> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** [`decentralized-lists.md`](../nips/decentralized-lists.md) (§ Nonstandard methods to declare a list; § Retrieval); `tapestry-concepts.md`; the companion drafts [Content Categories](./content-categories.md), [Spawning](./spawning.md), [Treasure Maps](./treasure-maps.md).
> **Why this exists:** the DList NIP lets a kind-`39999`/`9999` event act as a list header, but gives no rule for *telling* whether a given one does. Trusted List kinds (`30396` vs `30397`), content categories and spawning all depend on the answer.

---

DList Header Declaration
========================

`draft` `optional`

A **DList header** is an event that other events can join as items with a `z` tag. The Decentralized Lists NIP allows headers in four kinds. This NIP says how a reader decides whether an event is a header.

## 1. The rule (normative)

| Kind | Is it a header? |
|---|---|
| `39998`, `9998` | **Always.** These kinds exist to declare lists. |
| `39999`, `9999` | **No, by default.** It is a list item. It is a header **only if** it declares itself one (§ 2). |

Carrying a `names` tag, `required` / `allowed` tags, or having items that point at it does **not** make a `39999`/`9999` event a header. Only the declaration does.

## 2. Declaring a `39999` / `9999` header

A kind-`39999` or `9999` event declares itself a header by being an item of the **list of lists**, using either `z` form the DList NIP allows:

```json
["z", "list"]
```

```json
["z", "39998:<community pubkey>:concept-header"]
```

- **Either form is sufficient**, and an event MAY carry both. Readers MUST accept both.
- The **string form** (`"list"`) is the DList NIP's own convention. It needs no deployment, but can't be curated or federated.
- The **a-tag form** names the deployment's **Concept for Concept Headers** (§ 4). It is curatable, trust-rankable and federable like any other list membership. Publishers SHOULD include it.
- Other `z` tags on the same event are unaffected. A header that is also an item of another list keeps that `z` too: *Restaurants in NYC* can be an item of *Lists of restaurants* **and** a header.

A declared header SHOULD carry `names` (singular and plural), as every header must under the DList NIP.

## 3. Retrieval

All headers:

```json
{"kinds": [39998, 9998]}
{"kinds": [39999, 9999], "#z": ["list", "39998:<TA>:concept-header"]}
```

This matches the DList NIP's own retrieval section. Headers from other deployments are found by adding their Concept for Concept Headers handles to the second filter (federation, as in Event Taggings § Concept namespaces).

## 4. The Concept for Concept Headers

- **What it is.** The shared DList header for "the list of all lists", with `d` = **`concept-header`**. It already exists in Tapestry firmware as the Concept for Concept Headers.
- **The community version.** The shared-concept handle is straycat's, submitted as a Shared Concept and self-declared canonical with a self-pointing `b` ([Amendments proposal](./amendments-2026-09.md) § 3):

  ```
  39998:8e901369d45081cf05fe17ba802441dd731f73e000149c333daf4880a58e5fb1:concept-header
  ```
  (published by straycat's Tapestry Assistant, staging)
- **Affiliating a deployment.** Each deployment's own `concept-header` header wires to the community version with a pointer-typed `b` (Shared Concepts § Declared affiliation). Nous's Tapestry instance already does: *Concept Header* appears among its active `b`-tags.
- **Which handle a publisher's `z` names.** A declaring `39999`/`9999` header SHOULD name the community handle. It MAY also name its own deployment's handle (repeatable `z`, Event Taggings § Concept namespaces).
- **Which handles readers union.** The community handle, plus the handles of deployments they honor.
- **Kind-`39998`/`9998` headers** need not join it, since they are headers by kind. They MAY join it, for example to be curated onto it.

## 5. What follows from the rule

### 5.1 Trusted List kinds: items vs lists

A Trusted List's kind says what its members are (Treasure Maps § 4.2):

| Members are… | Member tag | A client… | List | Score |
|---|---|---|---|---|
| **lists** | `z` value (coordinate, event id or string) | **unpacks** each one: queries `#z` for its items | `30397` | `30387` |
| **DList items** | `a` (`39999`) or `e` (`9999`) | fetches each one as a record, read through its parent header | `30396` | `30386` |
| pubkeys | `p` | fetches the profile | `30392` | `30382` |
| events | `e` | fetches the event | `30393` | `30383` |
| addressable events | `a` | fetches the event | `30394` | `30384` |
| external things | `i` | resolves the identifier | `30395` | `30385` |

- A member is a **list** when it is a header by § 1. Otherwise a `39999`/`9999` member is a **DList item**.
- **One event, two roles.** A declared `39999` header is also an item of its parent list. In a `30396` it is a record (fetch it, show it); in a `30397` it is a list (unpack it). The list's kind tells the client which role is meant.

### 5.2 DList-based lists

A DList-based Trusted List (Spawning § 3.1) lists the **subjects** of D's accepted items (Content Categories § 5.1). Its kind follows each subject:

- a subject that is a **header** (the item itself, or what it points at) → `30397`;
- the item itself, not a header → `30396`;
- a pointer item → its target's type: `p` → `30392`, `e` → `30393`, `a` → `30394`, `i` → `30395`.

So a **list of lists** comes out as `30397` automatically, whether its items are declared `39999` headers or `e`/`a` pointers to headers (the DList NIP's Example 5). A list whose subjects are mixed spawns one list per kind, under the same key but a different kind. Assertion lists (`["items", "assertion"]`) spawn no DList-based list.

### 5.3 Content categories

The *DList headers* category (Content Categories § 1.3) contains exactly the events that § 1 says are headers. Its identifier is `39998`, whatever the header's kind.

## 6. Migration

- Existing Tapestry `39999` events that act as headers are Pins, per-tag tagging headers, content-category items used as headers, and Tags (under the Tags review's option B). They SHOULD add `["z", "list"]` and the Concept for Concept Headers `z`.
- Until then, a reader MAY treat the Tapestry firmware kinds it knows (a `39999` with `z` → the deployment's `pin` concept, `tagging-with-specific-tag`, …) as headers. This exception is limited to known firmware concepts; it is not a general `names` rule.

## 7. Open questions

1. ~~The Concept for Concept Headers `d`~~ — resolved: `concept-header`; the community handle is straycat's (§ 4).
2. **Should `39998` headers also join** the Concept for Concept Headers by default, so one `#z` query finds every header?
3. **Declaring by `z` alone makes a header "a list of lists" item.** Is that the intended reading, i.e. is every header an item of the list of lists? The DList NIP's nonstandard section implies yes.
