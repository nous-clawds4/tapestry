> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Companion to:** [NIP-85: Trusted Assertions](https://nips.nostr.com/85) and [Treasure Maps](./treasure-maps.md) (kind `10040`); built on [Decentralized Lists](../nips/decentralized-lists.md).
> **Implementation (reference deployment):** none. Nous' header is not yet published, and nothing publishes or reads menus.
> **Sources:** [`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md) (the owner's decisions D1–D10, 2026-10-10); `duty-menus-and-self-maps` ADR 0001 (self-declaration, which the header relies on) and ADR 0002 (this spec).

---

Duty Menus
==========

`draft` `optional`

A **Duty Menu** says what one Assistant key offers to publish, and where. Each Assistant key — a NIP-85 service key — publishes one menu: a DList item under a single shared header. Each row of a menu is a Treasure Map key and the relay where the insights under that key will be published. An instance reads menus to fill the relay of a Treasure Map entry that names an Assistant it doesn't run, to show what each Assistant offers, and to list the service providers its community trusts.

## At a glance

```
header   39998:<Nous>:duty-menu                          the shared header, a self-declared Shared Concept
item     39999:<key>:duty-menu                           one per Assistant key, signed by that key
rows     ["duty", "<key>", "<relay>"]                    offered: these insights, at this relay
         ["not-offered", "<key>"]                        an exception
mark     ["storefront", "39999:<own key>:duty-menu"]     this menu is a provider's storefront
link     ["storefront", "39999:<S>:duty-menu", "<relay>"] a per-customer menu's storefront (optional)
```

- A menu says what is **offered**. The key's own Treasure Map says what is **active** (§ 10).
- Only a key's own menu speaks for it.
- A menu is a hint, never a gate.

## 1. Principles

1. **Offered, not active.** A menu lists what a key will publish if a Treasure Map asks it to. It does not say that anything is being published now, and it creates no duty: duties come only from the observer's Map ([Treasure Maps](./treasure-maps.md) § 9).
2. **Only the key speaks for itself.** Anyone may publish under the header, but a key's offers come only from its own menu (§ 6.1).
3. **A hint, never a gate.** A client MAY warn that a key doesn't offer a duty. It MUST NOT refuse to write a Treasure Map entry naming that key for that duty.
4. **One shared header.** Every menu files under one header, so one query finds them all (§ 8.2).
5. **What and where, with no price and no settings.** A menu carries no price and no tier. Unlike a Treasure Map, which names no algorithm (Treasure Maps § 1, principle 3), a menu may name the algorithm behind a duty (§ 5.4), the way NIP-85 asks a service key's kind 0 to describe its algorithm. A method's parameters, point of view and cutoffs stay off the menu.

## 2. Terms

- **Assistant key** — a NIP-85 service key: the key that signs insights. It is element 2 of a Treasure Map entry.
- **Provider** — whoever runs Assistant keys, such as a WoT service.
- **Per-customer key** — an Assistant key that serves one observer. NIP-85 requires a separate key for each user of a personalized algorithm (Treasure Maps § 9, "One key per observer").
- **Storefront** — a provider's main-key menu, for comparing providers before signing up (§ 7).
- **Per-customer menu** — the menu of a per-customer key.
- **Row** — a `duty` or `not-offered` tag (§ 5).
- **Offered** — the key will publish the insights under a row's key, at the row's relay, if a Treasure Map assigns them to it.
- **Active** — the key is publishing and maintaining the insights now. A menu never says this (§ 10).
- **Nous** — the key `15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270`, which publishes the header.

## 3. The header

There is one shared header: kind `39998`, signed by Nous, `d` = `duty-menu`.

```json
{
  "kind": 39998,
  "pubkey": "15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270",
  "content": "",
  "tags": [
    ["d", "duty-menu"],
    ["names", "duty menu", "duty menus"],
    ["description", "What one Assistant key offers to publish: Treasure Map keys and the relay for each. Offered, not active. No price or tier."],
    ["b", "39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu", "pointer"],
    ["required", "p", "The Assistant: the item's own author"],
    ["recommended", "duty", "A Treasure Map key and the relay this Assistant publishes it to"],
    ["allowed", "not-offered", "A Treasure Map key this Assistant does not offer"],
    ["allowed", "storefront", "On a storefront: its own address. On a per-customer menu: its provider's storefront"],
    ["allowed", "name"],
    ["allowed", "description"],
    ["allowed", "json", "Per-duty details under dutyMenu, keyed by Treasure Map key. No price or tier."]
  ]
}
```

- **Self-declared.** Its `b` names its own coordinate, which offers the header as a shared concept that other authors may affiliate with ([Inherit-From](./inherit-from.md) § "The `b` tag", Self-declaration).
- **Subject `p`.** Because the header requires `p`, a menu's subject is the Assistant key ([Content Categories](./content-categories.md) § 5.1). A DList-based list over Duty Menus is therefore a Trusted List of Assistant pubkeys, `30392:dlist:⟨Duty Menu⟩` (Treasure Maps § 10.9).
- **`duty` is recommended, not required**, so a menu that offers nothing is valid (§ 11).
- **Adding it to a dictionary.** A person adds Duty Menu to their own dictionary by publishing their own header that affiliates with this one: a pointer-typed `b` naming it ([Shared Concepts](./shared-concepts.md) § "Declared affiliation"). Such a header keeps the `required`, `recommended` and `allowed` declarations it copies, so this header carries them from its first publication.
- **Menus point here.** A menu's `z` names this header, never a dictionary copy of it. A reader that starts from a copy follows the copy's `b` to this header.

## 4. The item

Each Assistant key publishes one replaceable kind-`39999` event with `d` = `duty-menu`, signed by itself. Its address is `39999:<key>:duty-menu`.

- **`p`** — exactly one: the key itself.
- **`z`** — `["z", "39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu"]`, required. It is the item's parent pointer under the [base NIP](../nips/decentralized-lists.md), and so its "personal `z`" in the sense of [Stamping](./stamping.md). Other `z` tags are allowed and ignored by menu readers. A menu MUST NOT carry a `z` that declares it a header ([DList Header Declaration](./dlist-header-declaration.md)).
- **Rows** — `duty` and `not-offered` tags (§ 5).
- **`storefront`** — required and self-pointing on a storefront; optional on a per-customer menu (§ 7).
- **`name`, `description`** — optional, as in the base NIP.
- **`json`** — at most one: per-duty details (§ 5.4).
- **Reserved `d`.** `duty-menu` is reserved as the `d` of a kind-`39999` menu. A key MUST NOT use it for any other kind-`39999` event.
- **The shared handle is complete.** Every conforming menu carries Nous' `z`, so a `#z` query on that handle finds them all. This is a deliberate exception to Stamping's read contract, which tells readers not to rely on one shared handle being complete.

## 5. Rows

### 5.1 `duty`

`["duty", "<Treasure Map key>", "<relay>"]`

- Element 2 is a key in the Treasure Maps § 4.7 grammar, exact or scope.
- Element 3 is the relay where the insights under that key will be published.
- A `duty` row with a missing or empty relay is invalid and ignored. This differs from Treasure Maps § 3, where an entry with an empty relay still names a provider.
- A `duty` row says *offered* (§ 1).

### 5.2 `not-offered`

`["not-offered", "<Treasure Map key>"]`

- An exception: the key does not offer the insights under this key. For example, `["duty", "3038x", "<relay>"]` with `["not-offered", "30385"]` offers every Score except Scores about external things.
- It takes part in precedence like any row (§ 6.2).

### 5.3 Keys

- Keys are normalized before any comparison, duplicate check or details lookup:
  - every naddr and nevent decoded and re-encoded (Treasure Maps § 4.1);
  - omitted or empty trailing segments dropped (§ 4.4), except in Concept keys, whose `d` is taken verbatim and may end in `:` (§ 4.5);
  - `39998:dlist-header` read as `39998` (§ 4.5).
- A row whose key does not parse is ignored.
- At most one row per normalized key, whatever its tag. On duplicates the first row wins.
- Elements after those defined here are reserved and ignored.

### 5.4 Details

At most one `json` tag. As with any concept's data in a `json` tag ([Tapestry Concepts](./tapestry-concepts.md) § "Data storage (json tag)"), the JSON is namespaced by the concept, here under its camelCase key `dutyMenu`, and keyed by normalized Treasure Map key:

```json
["json", "{\"dutyMenu\":{\"30382:rank\":{\"description\":\"GrapeRank influence\",\"interval\":\"PT6H\",\"algorithm\":\"graperank\"}}}"]
```

- `description` — text.
- `interval` — an ISO 8601 duration: the expected update cadence.
- `algorithm` — a name, such as the `d` of a `score-algorithm` item where one exists.
- A duty's details are those of its answering row's key (§ 6.2).
- A menu carries no price and no tier. Readers ignore unknown fields.

## 6. Reading a menu

### 6.1 What counts as a menu

A reader treats an event as a Duty Menu only when all of these hold:

- it is kind `39999`;
- its `d` is `duty-menu`;
- it has exactly one `p`, equal to its author;
- it carries Nous' `z`.

This is a validity rule, like "only your own kind 10002 is your relay list". It is not a judgment of trust. Whose menus a reader shows is a separate choice, made per point of view (§ 8.2).

An item under the header whose `p` names a different key is not a menu. Under the base NIP it nominates that key, and counts toward a DList-based list over Duty Menus like any item.

### 6.2 Resolution

For a Treasure Map key K, exact or scope, and a menu:

1. A row **covers** K when its key is K or broader than K: a family wildcard covers its kinds (Treasure Maps § 4.2), an omitted or empty trailing segment covers any value (§ 4.4), and a bare Concept kind covers that kind's Concept keys (§ 4.5).
2. The **answering row** is the most specific covering row, by Treasure Maps § 6, among `duty` and `not-offered` rows together.
3. If the answering row is a `duty` row, K is **offered** at its relay. If it is a `not-offered` row, or no row covers K, K is **not offered as a whole**.
4. K is **partly offered** when another row wins, by Treasure Maps § 6, for some of the insights under K and answers them differently: with another relay, with `not-offered`, or with an offer where K has none. Such a row may be narrower than K, or merely overlap it, as `*:tag` overlaps `3039x` when `*` answers K. A client then either:
   - writes, for each such row, an entry for the part of K that the row wins, so that the Map's own § 6 gives each insight its relay. That part's key is the row's own key when the row is narrower than K; otherwise it names, segment by segment, whichever value either key names (`3039x` with `*:tag` gives `3039x:tag`); or
   - writes K with the answering row's relay, if there is one, and leaves per-insight relays to read-time resolution.

   Where no row covers K, the client writes only the entries for the parts that are offered (§ 13.3, `3039x`). For a part that is `not-offered`, the client says that those insights won't come from this key, so the observer can give them to another Assistant.
5. A Treasure Map entry built from a menu names the menu's author and takes the relay of the row that answers its key: `[K, <menu author>, <answering row's relay>]`.

§ 13.3 works an example.

## 7. Storefronts and per-customer menus

- **Storefront.** A provider's main-key menu, for comparing providers before signing up. It marks itself with a self-pointing `["storefront", "39999:<own key>:duty-menu"]`. Only a menu so marked is a storefront. The marker fails closed: no menu becomes a storefront by leaving something out.
- **Per-customer menu.** The menu of a key that serves one observer. It MAY name its provider's storefront: `["storefront", "39999:<storefront key>:duty-menu", "<relay>"]`. A provider may decline to publish that link. The link is the per-customer key's own claim; it does not prove that the storefront's author runs the key.
- **Rows mean different things on the two.**
  - A per-customer menu's rows say what this key will publish for the one observer it serves.
  - A storefront's rows say what the provider offers, and where its per-customer keys will publish. Readers MUST NOT turn a storefront's rows into Treasure Map entries naming the storefront key, unless that key is the observer's own Assistant.
- **One key per algorithm.** NIP-85 requires a separate service key for each algorithm, so each key has its own menu, and a provider with two algorithms publishes two storefronts.

## 8. Finding menus

### 8.1 One key's menu

The filter is `{"kinds":[39999], "authors":["<key>"], "#d":["duty-menu"]}`. Look, in order:

1. on any relay hint already in hand: a Treasure Map entry's element 3, or a `storefront` link's relay;
2. on the key's NIP-65 (kind 10002) write relays;
3. on the relays where Nous' header is published, found through Nous' own kind 10002 write relays.

Publishers SHOULD publish their menu to their write relays and to the relays where Nous' header is published.

### 8.2 All menus

The filter is `{"kinds":[39999], "#z":["39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu"]}`.

Anyone may publish under the header. Readers apply § 6.1, then filter what remains per point of view.

## 9. The provider directory (non-normative)

The storefronts under the header (§ 7), read through their authors' kind 0 profiles (name, website) and grouped by website, list the service providers. Filtered per point of view, they list the providers a community trusts.

- A provider that publishes no storefront is not listed.
- Candidate signals for the filter:
  - **What trusted people say:** their reactions to storefront menus, and a DList-based list over Duty Menus (§ 3).
  - **What trusted people do:** how many trusted observers' Treasure Maps name keys linked to a storefront (§ 7). Each of those observers chose an Assistant for their own reasons, so counting it for others raises the usual questions. Do they know it is counted? Can they opt out? Would they endorse this reading of it?
  - **Trust in the author:** a weak signal, because NIP-85 service keys are seldom followed.
- While signals of what people do are scarce, a directory can start from what they say, used as a hint.

## 10. Offered and active

A menu says what a key offers. Whether the key is publishing those insights now is for the key's own Treasure Map to say: see Treasure Maps § 9. A client that switches a duty between two Assistants can read both: the menu for *offered*, the key's own Map for *active*.

## 11. Publishing and withdrawing

- Publish the menu where § 8.1 says.
- Change the offers by republishing the one replaceable item.
- Withdrawing every offer SHOULD be done by republishing the menu with no `duty` rows. The empty menu still carries Nous' `z`, so it travels by the same `#z`-filtered relay sync as the old one, and replaces it wherever it arrives.
- A NIP-09 deletion MAY follow that republish. It MUST name `["a", "39999:<key>:duty-menu"]`, `["k", "39999"]`, and an `["e", "<id>"]` for each earlier version being removed, never for the empty menu that replaced them. Some relays apply only the `e`, and a deletion naming the empty menu would remove the very version that keeps a stale copy from coming back. Deletions also don't travel with `#z`-filtered relay sync, so a deletion on its own can let an older copy return.

## 12. Security and privacy

- **Listing.** Every menu carries Nous' `z`, so anyone can list every Assistant key that publishes one, per-customer keys included. A customer's own Treasure Map already links them to their key.
- **Staying out of the directory** (§ 9) is a courtesy that directories following this spec honor. It is not privacy: a provider's per-customer menus, the relays in their rows, and their kind 0 profiles can still point to it.
- **Claims.** A `storefront` link and a kind 0 website are claims. Any key can copy a real provider's name. A directory SHOULD check that a kind 0's NIP-05 domain matches its website.
- **Private duties** never appear in a menu (§ 14).
- **No price or tier** appears in a menu.

## 13. Examples

### 13.1 A storefront

```json
{
  "kind": 39999,
  "pubkey": "<S>",
  "content": "",
  "tags": [
    ["d", "duty-menu"],
    ["z", "39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu"],
    ["p", "<S>"],
    ["storefront", "39999:<S>:duty-menu"],
    ["name", "Example WoT Service"],
    ["duty", "3038x", "wss://scores.example"],
    ["duty", "3039x", "wss://lists.example"],
    ["duty", "39998", "wss://concepts.example"],
    ["duty", "39999", "wss://concepts.example"],
    ["json", "{\"dutyMenu\":{\"3038x\":{\"description\":\"Scores from your web of trust\",\"interval\":\"PT6H\",\"algorithm\":\"graperank\"}}}"]
  ]
}
```

### 13.2 A per-customer menu with an exception

```json
{
  "kind": 39999,
  "pubkey": "<A>",
  "content": "",
  "tags": [
    ["d", "duty-menu"],
    ["z", "39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu"],
    ["p", "<A>"],
    ["storefront", "39999:<S>:duty-menu", "wss://concepts.example"],
    ["name", "Alice's Assistant"],
    ["duty", "3038x", "wss://scores.example"],
    ["not-offered", "30385"],
    ["duty", "3039x:tag", "wss://lists.example"],
    ["duty", "39998", "wss://concepts.example"]
  ]
}
```

### 13.3 Resolving Treasure Map keys against 13.2

| Treasure Map key K | Answering row | Result |
|---|---|---|
| `30382:rank` | `3038x` | Offered: `["30382:rank", "<A>", "wss://scores.example"]` |
| `30385:rank` | `not-offered 30385` | Not offered |
| `3038x` | `3038x` | Partly offered: write `["3038x", "<A>", "wss://scores.example"]`, and say that Scores about external things (`30385`) won't come from `<A>` |
| `3039x` | none (`3039x:tag` is narrower) | Not offered as a whole; partly offered through `3039x:tag`. Write `["3039x:tag", "<A>", "wss://lists.example"]` instead |
| `39998` | `39998` | Offered: `["39998", "<A>", "wss://concepts.example"]` |

## 14. Open questions

1. **Private duties.** May a per-customer menu list duties meant only for its observer, NIP-44-encrypted? NIP-85 lets a kind 10040 carry entries encrypted in its `.content`, but Treasure Maps keeps its delegation entries public for now (Treasure Maps § 13, question 8). Until this is settled, menus list only public duties.
2. **Identical menus.** May a per-customer key whose offers match its storefront exactly skip publishing its own menu, with readers falling back to the storefront? The link is optional (§ 7), so a reader would not always know which storefront applies.
3. **Non-personalized providers.** NIP-85 lets a provider of a non-personalized algorithm serve every observer from one key. If that key marks itself a storefront, § 7 forbids filling Treasure Map entries from its rows, though the key itself is the one that publishes. Should a storefront row be able to say that this key itself publishes the duty for every observer?
