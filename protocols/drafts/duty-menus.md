> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Companion to:** [NIP-85: Trusted Assertions](https://nips.nostr.com/85) and [Treasure Maps](./treasure-maps.md) (kind `10040`); built on [Decentralized Lists](../nips/decentralized-lists.md).
> **Implementation (reference deployment):** none. Nous' header is not yet published, and nothing publishes or reads menus.
> **Sources:** [`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md) (the owner's decisions D1–D10, 2026-10-10); `duty-menus-and-self-maps` ADR 0001 (self-declaration, which the header relies on) and ADR 0002 with Amendment A1 (this spec).

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
3. **A hint, never a gate.** A client MAY warn that a key doesn't offer a duty. It MUST NOT refuse to write a Treasure Map entry naming that key for that duty. § 6.2 says which relay such an entry carries.
4. **One shared header.** Every menu files under one header, so one query finds them all (§ 8.2).
5. **What and where, with no price and no settings.** A menu carries no price and no tier. Unlike a Treasure Map, which names no algorithm (Treasure Maps § 1, principle 3), a menu may name the algorithm behind a duty (§ 5.4), the way NIP-85 asks a service key's kind 0 to describe its algorithm. A method's parameters, point of view and cutoffs stay off the menu.

## 2. Terms

- **Observer**, **insight** — as in [Treasure Maps](./treasure-maps.md) § 2: the author of a Treasure Map, and one Score, List or Concept that a Map entry can name.
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
- A row keyed `39998:` or `39999:` (the kind, a colon, and nothing more) is also ignored, until Treasure Maps settles what that key means (open question 5 below). Whether it is read as the bare kind with an empty segment (Treasure Maps § 4.4) or as a Concept key with an empty `d` (§ 4.5), it would tie with the bare kind's row under Treasure Maps § 6. Writers SHOULD write the bare kind, `39998` or `39999`, instead.
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

In the examples below, `<key>` → R stands for the row `["duty", "<key>", "R"]`, and `not-offered <key>` for `["not-offered", "<key>"]`.

For a Treasure Map key K, exact or scope, and a menu:

1. A row **covers** K when the row's key matches every insight that K could match, under Treasure Maps §§ 4.2–4.5, kind–category agreement (§ 4.3) included. That means every such insight in principle, not only the observer's supported sets (Treasure Maps § 8), so covering does not change when the supported sets do. What a key matches is Treasure Maps' to define. Where it leaves the Concept kinds open, this spec reads them as below.
   - § 4.3 agreement is judged from the key alone, from the category segment's own value:
     - an event-kind number agrees with the List kinds § 4.3 gives that number, and with their Score kinds: `30393` for a non-addressable kind, `30394` for an addressable one, `30397` for `39998` (*DList headers*);
     - a NIP-73 type agrees with `30395`, and with its Score kind `30385`;
     - an empty segment means any category (§ 4.4), not the Profiles type;
     - a DList's naddr or nevent agrees with every Score and List kind that § 4.3 lets a DList yield. So `30392` does not cover `3039x:tag:⟨D⟩`, even when D's subject is `p`.
   - A reader never fetches a header or items to decide covering. A DList's header can change, and anyone may publish items, so covering judged from them would go stale.
   - Examples, not a closed list:
     - a bare `*` covers every key, Concept keys included (§ 4.2);
     - a family wildcard covers its kinds (§ 4.2);
     - in a Score or List key, an empty segment covers any value in any position, so `30396:tag::⟨T⟩` covers `30396:tag:⟨D⟩:⟨T⟩` (§ 4.4);
     - an omitted trailing segment covers any value (§ 4.4);
     - a row can cover K through § 4.3: `30393` covers `3039x:tag:1`, because `30393` is the only List kind that takes category `1`;
     - no `*:<scope>` key covers a Concept key (§ 4.5; Treasure Maps § 13, question 12).
   - The Concept kinds, until Treasure Maps settles them (open question 5 below):
     - a bare `39998` covers every Concept key, `39999` and `39999:<d>` included;
     - a bare `39999` covers the `39999:<d>` keys: the headers declared as kind-`39999` items;
     - a `39999` kind slot beats a bare `39998`, as an exact kind beats a family. This order holds wherever this spec compares keys by Treasure Maps § 6, Map keys included.
   - A key that matches no insight, because its kind and category disagree (§ 4.3), has nothing to resolve.
2. The **answering row** is the most specific covering row, by Treasure Maps § 6 with step 1's order for the Concept kinds, among `duty` and `not-offered` rows together. Two covering rows never tie, and the same row answers for every insight under K.
3. If the answering row is a `duty` row, K is **offered** at its relay. If it is a `not-offered` row, or no row covers K, K is **not offered as a whole**.
4. **Rows within K.** Other rows can still win some of the insights under K.
   - A **row within K** is a row, other than the answering row, that wins at least one insight under K, by Treasure Maps § 6 over all of the menu's rows. It never covers K. It is narrower than K, as `not-offered 30385` is within `3038x`, or it overlaps K, as `*:tag` overlaps `3039x` when `*` answers K.
   - The **meet** of K and a row within K is the key for the insights both keys match. It takes the narrower kind slot, and every value either key names. It is always a Treasure Maps § 4.7 key, except for a Map key `39998:` or `39999:`, whose meets wait on Treasure Maps (open question 5 below). The meet is K made more specific, so it beats K by Treasure Maps § 6. Resolved on its own, its answering row is the row itself.
     - Example: `3039x` and `*:tag` give `3039x:tag`; `30396` and `3039x:tag:⟨D⟩` give `30396:tag:⟨D⟩`; `*` and `39998:<d>` give `39998:<d>`; `39998` and `39999:<d>` give `39999:<d>`.
   - A row's **part** is the insights under K that it wins: the insights of its meet, less those also matched by a row within K that beats it (Treasure Maps § 6). A part may have no key of its own.
   - A row within K is a **differing row** when it answers its part differently from the answering row: with another relay; with `not-offered`, where K is offered; or with an offer, where K is not offered as a whole. A row within K with the same answer is not a differing row.
   - K is **partly offered** when it has at least one differing row. That includes a K whose every insight is offered, some at another relay.
   - For example, take a menu `3039x` → R0, `3039x:tag` → R1, `30396:tag` → R0, and K = `3039x`. The answering row is `3039x`. `3039x:tag` is a differing row: its part is the Tag-based lists of every List kind but `30396`, which has no key of its own. `30396:tag` is a row within K, but not a differing row.
   - "Differing row" is not another name for an exception (§ 5.2). Every `not-offered` row is an exception. Whether a row is a differing row depends on K, and a differing row may offer. `not-offered 30385` is a differing row of `3038x`, but a `not-offered` row that answers K is not a differing row of K.
5. **Writing the Map.** Entries come only from keys the observer chooses: one entry for each key and Assistant.
   - **One entry per chosen key.** For each key K the observer chooses for an Assistant A, a client that fills the entry from A's menu resolves K (§ 7 limits which menus may fill entries):
     - when the answering row is a `duty` row, it writes `[K, <A>, <answering row's relay>]`;
     - otherwise the menu gives K no relay. The client MAY warn that A does not offer K as a whole (§ 1, principle 3). If the observer keeps K for A, the client writes the insisted-key entry (below). If not, the Map stays as it was.
   - **Menus supply relays; only the observer chooses keys.** A client MUST NOT turn a menu's rows into Map entries the observer did not choose, for differing rows or anything else. An entry the observer picks some other way, such as a whole-class entry (Treasure Maps § 10.1) that an editor writes when the observer gives A all of their Scores, Lists or Concepts, is the observer's choice.
   - **Every row within K is listed.** For each row within K, the client shows its meet with K and its answer. Each applies to its meet's insights, except where a listed row whose own key beats this row's key (Treasure Maps § 6) also matches, so no nested row is hidden. The client compares the rows' own keys, not their meets, which can order the other way.
     - Example: with a menu `3039x` → R0, `not-offered 3039x:tag`, `30396:tag` → R0, and K = `3039x`, the client lists `30396:tag` → R0 inside `3039x:tag`, so it does not say that Tag-based lists of DList items won't come from A.
     - Example: with a menu `3039x` → R0, `30396:tag::⟨T⟩` → R1, `3039x:tag:⟨D⟩` → R2, and K = `30396`, the row `30396:tag::⟨T⟩` beats `3039x:tag:⟨D⟩`, so `30396:tag:⟨D⟩:⟨T⟩` is R1, not R2. Their meets, `30396:tag::⟨T⟩` and `30396:tag:⟨D⟩`, order the other way.
     - For a `not-offered` part, the client says that those insights won't come from A, so the observer can give them to another Assistant.
     - The client MAY note that another entry in the observer's Map wins a part (Treasure Maps § 6). It still lists the part, because the observer may later remove that entry.
   - **A new key within K.** For each differing row, the client offers the row's meet with K as a key the observer may choose: for A when the row offers, or for another Assistant when the row is `not-offered`. The observer may choose it, or any other key. The client resolves a chosen key afresh, by steps 1–5, and lists the rows within it.
     - The meet beats K. So when the row offers, choosing its meet for A gives the row's part the row's relay, unless another Map entry beats the meet.
     - The row's own key is no substitute when K beats it by Treasure Maps § 6: K's kind slot is narrower, or, with the same kind slot, K names a value at the first segment where the two keys differ. K then wins every insight they share.
       - Example: with a menu `3039x` → R0, `3039x:tag:1` → R1, and K = `30393`, choosing `3039x:tag:1` changes nothing, because K's kind slot is narrower. Its meet, `30393:tag:1`, gives the Tag-based lists of notes R1.
       - Example: with a menu `3039x` → R0, `30396:tag::⟨T⟩` → R1, `3039x:tag:⟨D⟩` → R2, and K = `30396:tag:⟨D⟩`, choosing `30396:tag::⟨T⟩` changes nothing, because K names D at the third segment. Its meet, `30396:tag:⟨D⟩:⟨T⟩`, gives that list R1.
     - When the row's own key beats K, choosing it also gives the row's part the row's relay, unless another Map entry beats it. It may reach insights outside K as well.
     - A new key can take insights that K's entry already got right. They show up among the new key's differing rows.
       - Example: under step 4's menu, choosing `3039x:tag` gives the Tag-based lists of DList items R1 in the Map, though the menu gives them R0. Resolving `3039x:tag` lists `30396:tag` → R0 as its differing row, whose meet the observer may choose in turn.
     - **Alternates.** An entry with a less specific key is never a fallback for a more specific one (Treasure Maps § 7). So when the observer chooses a new key within K, the client SHOULD offer to carry K's other providers onto it, in K's order, each resolved from its own menu the same way. If the observer declines, the client says that the new key has no fallback provider.
   - **What the entry guarantees, and no more.** For each chosen key K whose answering row is a `duty` row, the entry's relay is the menu's relay for every insight under K except those in a differing row's part. The client lists every differing row.
     - Whether the Map gives an insight to K's entry at all depends on the observer's other, more specific entries (Treasure Maps § 6). That is the observer's choice.
     - The exact relay for an insight in a differing row's part comes from read-time resolution, which Treasure Maps does not yet define (open question 4 below).
     - An insisted key's guarantee is weaker (below).
   - **The insisted key.** K is an **insisted key** when the menu does not offer K as a whole (step 3), and the observer keeps K for A anyway. § 1, principle 3, forbids refusing to write its entry. The entry is `[K, <A>, R]`:
     - R is the relay of the rows within K that offer something, when they all name the same one. Then R is the menu's relay for every insight under K that A offers. § 13.3's `3039x` row is an example.
     - Otherwise R is the empty string, which Treasure Maps § 3 allows. The empty string says that no relay is known. The client does not replace it with a guess, such as one of A's kind 10002 write relays or the relay where it found the menu: a guess looks like a real relay, and gives a reader no cue to look further.
     - The client MAY still warn that A does not offer K as a whole.

§ 13.3 works an example.

## 7. Storefronts and per-customer menus

- **Storefront.** A provider's main-key menu, for comparing providers before signing up. It marks itself with a self-pointing `["storefront", "39999:<own key>:duty-menu"]`. Only a menu so marked is a storefront. The marker fails closed: no menu becomes a storefront by leaving something out.
- **Per-customer menu.** The menu of a key that serves one observer. It MAY name its provider's storefront: `["storefront", "39999:<storefront key>:duty-menu", "<relay>"]`. A provider may decline to publish that link. The link is the per-customer key's own claim; it does not prove that the storefront's author runs the key.
- **Rows mean different things on the two.**
  - A per-customer menu's rows say what this key will publish for the one observer it serves.
  - A storefront's rows say what the provider offers, and where its per-customer keys will publish. Readers MUST NOT fill a Treasure Map entry naming the storefront key from a storefront's rows, unless that key is the observer's own Assistant.
- **One key per algorithm.** NIP-85 requires a separate service key for each algorithm, so each key has its own menu, and a provider with two algorithms publishes two storefronts.

## 8. Finding menus

### 8.1 One key's menu

The filter is `{"kinds":[39999], "authors":["<key>"], "#d":["duty-menu"]}`. Look, in order:

1. on any relay hint already in hand: a Treasure Map entry's element 3, or a `storefront` link's relay;
2. on the key's NIP-65 (kind 10002) write relays;
3. on the relays where Nous' header is published, found through Nous' own kind 10002 write relays.

Publishers SHOULD publish their menu to their own kind 10002 write relays, to the relays their `duty` rows name, and to Nous' kind 10002 write relays.

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
- A [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) deletion MAY accompany a withdrawal.
  - Its `created_at` MUST be strictly earlier than the empty menu's. The timestamps decide, not the order of publishing or of arrival. NIP-09 says that "when an `a` tag is used, relays SHOULD delete all versions of the replaceable event up to the `created_at` timestamp of the deletion request event". So the `a` removes the versions up to the deletion's own `created_at`, and spares the empty menu, whichever reaches a relay first. The `e` tags (below) name every earlier version with `duty` rows. "Strictly", because "up to" does not say whether an equal timestamp counts.
  - If an empty menu is already out and its `created_at` is not later than the deletion's, publish a new empty menu with a `created_at` later than the deletion's.
  - The deletion MUST name `["a", "39999:<key>:duty-menu"]`, `["k", "39999"]`, and an `["e", "<id>"]` for each earlier version with `duty` rows. The `e` tags never name an empty menu, old or new. Some relays apply only the `e`, and removing an empty menu there can let an older copy come back.
  - Deletions also don't travel with `#z`-filtered relay sync, so a deletion on its own can let an older copy return.

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
| `3039x` | none (`3039x:tag` is narrower) | Not offered as a whole; partly offered through `3039x:tag`. No entry from the menu. The client offers the meet, `3039x:tag`, which resolves to `["3039x:tag", "<A>", "wss://lists.example"]`. If the observer keeps `3039x` for `<A>`, the entry is `["3039x", "<A>", "wss://lists.example"]`, the one relay its offering rows share |
| `39998` | `39998` | Offered: `["39998", "<A>", "wss://concepts.example"]` |

## 14. Open questions

1. **Private duties.** May a per-customer menu list duties meant only for its observer, NIP-44-encrypted? NIP-85 lets a kind 10040 carry entries encrypted in its `.content`, but Treasure Maps keeps its delegation entries public for now (Treasure Maps § 13, question 8). Until this is settled, menus list only public duties.
2. **Identical menus.** May a per-customer key whose offers match its storefront exactly skip publishing its own menu, with readers falling back to the storefront? The link is optional (§ 7), so a reader would not always know which storefront applies.
3. **Non-personalized providers.** NIP-85 lets a provider of a non-personalized algorithm serve every observer from one key. If that key marks itself a storefront, § 7 forbids filling Treasure Map entries from its rows, though the key itself is the one that publishes. Should a storefront row be able to say that this key itself publishes the duty for every observer?
4. **Read-time resolution.** Where does a reader look for an insight in a differing row's part (§ 6.2), or under an entry whose relay is the empty string? Treasure Maps does not yet define read-time resolution. Until it does, a reader that follows the Map alone looks for such an insight at the relay of the entry that wins it, and may not find it there; an empty relay gives it nowhere to look. Meanwhile the observer can choose a differing row's meet as a key (§ 6.2, step 5).
5. **The Concept kinds.** Treasure Maps leaves three things open: whether `39998:` and `39999:` are the bare kind with an empty segment (Treasure Maps § 4.4) or a Concept key with an empty `d` (§ 4.5); what a bare `39999` covers, and whether a bare `39998` covers the headers declared as kind-`39999` items; and how its § 6 orders a `39999` key against a bare `39998`. Until Treasure Maps settles them, this spec ignores rows keyed `39998:` or `39999:` (§ 5.3), reads a bare `39998` as covering every Concept key and a bare `39999` as covering the `39999:<d>` keys, and ranks a `39999` kind slot above a bare `39998` (§ 6.2, step 1). What a Map key `39998:` or `39999:` matches, and so its meets, follows Treasure Maps' answer.
