# ADR 0002: The Duty Menus pre-NIP — one self-signed item per Assistant key under Nous' header

**Status:** Accepted; amended by A1 (2026-10-11)
**Date:** 2026-10-10
**Story:** `engineering-team/stories/duty-menus-and-self-maps/2-duty-menus-pre-nip.md`

## Context

**The story** asks for a new pre-NIP, `protocols/drafts/duty-menus.md`:
- AC1: exists and is indexed in `protocols/README.md`;
- AC2: Nous' shared header, self-declared, with its tag declarations and the dictionary path;
- AC3: one replaceable item per key, every one pointing at Nous' header (D9), `[key, relay]` rows meaning *offered*,
  only the key's own item counting, no price or tier (D5);
- AC4: reading rules (the Treasure Map most-specific rule, finding menus, storefront versus per-customer, the provider
  directory, providers who stay out of it);
- AC5: the offered/active boundary, a W1 note, D2 vocabulary;
- AC6: gates, and only `duty-menus.md`, `README.md` and `worksheet.md` change.

It is docs-mode.

**Settled inputs** (`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`):
- D1 (offered vs active), D3 (kind 10002 is no container, but stays useful as a fallback locator), D4 (Nous publishes
  the header, key `15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270`), D5, D7, D8 (the name), D9, D10
  (a Shared Concept, adopted into dictionaries by reference);
- the story's out-of-scope answers: no bare `["z", "duty-menu"]`, and no new storefront discovery mechanism;
- the handoff's § 6 rule that a menu is "a hint, never a gate";
- the § 4 shapes, which the handoff marks "to be confirmed at ratification". This ADR confirms them, with the changes
  below.

**What the surrounding specs require:**
- **The DList NIP** (`protocols/nips/decentralized-lists.md` § "Declarations of lists and list items"):
  - a header MUST have `names`, and SHOULD declare item tags with `required`, `allowed`, `recommended` or `disallowed`,
    each tag listed individually, with an optional description element. `required` means "child items must make use
    of" the tag;
  - an item MUST carry a `z` to its header and SHOULD carry the item tag the header requires;
  - items may carry `name` and `description`.
- **Tapestry Concepts** § "Data storage (json tag)": element data goes in a `json` tag, namespaced per concept. The code
  keys that namespace by the camelCase singular (`oKeys.singular`, `src/api/normalize/index.js:1329`, e.g. `coffeeHouse`),
  so the Duty Menu namespace is `dutyMenu`.
- **Content Categories** § 5.1: a header that requires `p` has subject `p`. A DList-based list over it is a Trusted List
  of pubkeys (`30392:dlist:⟨…⟩`, `treasure-maps.md` § 10.9).
- **Treasure Maps:**
  - § 4.1: naddrs and nevents are canonicalized before comparison;
  - § 4.4: omitted and empty trailing segments mean "any", so `30396:tag` = `30396:tag::`;
    *(Amended by A1-1: in a Score or List key, an empty segment means "any" in any position, not only at the end.)* (See A1-10.)
  - § 4.5: `39998:dlist-header` = `39998`;
  - § 4.7: the key grammar;
  - § 6: the most specific matching key wins, compared left to right;
  - § 3: an empty element 3 is allowed and still names a provider;
  - § 9: duties, and "One key per observer". Self-Maps (story 3) will extend § 9.
- **Inherit-From** § "The `b` tag": Self-declaration, normative since story 1. **Shared Concepts** § "Declared
  affiliation": how a person's header affiliates with Nous'.
- **Stamping**: a deliberately published item carries a "personal `z`", its author's own parent pointer under the base NIP.
- **Worksheet W2**: `q` already means NIP-18 quotes on any event, plus Assistant Designation's curation copies. Merging
  readers also collapse an item into the 39999 address its `q` names (`assistant-designation.md` § "Curation copies";
  `stamping.md`). So `q` cannot also mean "my storefront".
- **What the editor writes.** `/treasure-map` assigns *scope* keys as well as exact ones: the families `3038x`, `3039x`,
  `39998`, `39999` and `*` (`ui/src/pages/treasure-map/editTreasureMap.js`, `FAMILY`). Resolution must therefore answer
  for any Map key, not only an exact one.
- **Relays.** dcosl (strfry 1.0.4) honours a deletion's `e` but not its `a` (`engineering-team/audits/my-assistants/
  audit.md` § 4 #3), and kind-5 deletions do not ride `#z`-scoped sync (`docs/TAG_FEDERATION_OPS.md`, caveat 4).

**Concepts:** no definition changes. The Duty Menu concept will exist at `39998:15f7dafc…:duty-menu` once Nous publishes
it. The stack is absent, so nothing was read from a live graph.

## Options considered

### Option A — A standalone pre-NIP, `duty-menus.md`, with the handoff's § 4 shapes, revised

The spec carries everything Duty-Menu-specific: the header, the item, reading rules, storefronts, finding menus, the
provider directory, publishing, and security. It points out to the other specs rather than restating them.

It revises the handoff's § 4 in five ways:
1. Resolution is defined for any Map key, scope keys included.
2. A self-pointing `storefront` tag marks storefronts, replacing `q`, and fails closed.
3. Exceptions use an explicit `not-offered` tag.
4. The withdrawal rules are safe against stale copies coming back.
5. `z` and Stamping are reconciled.

Pros:
- One normative home for a new wire format, next to its siblings in `drafts/`.
- It answers exactly what the shipped editor needs.

Cons:
- One more spec in the index.

### Option B — A new section inside `treasure-maps.md`

Pros: menus exist to fill Treasure Map entries, so the reader sees both in one place.

Cons:
- It breaks AC1 and AC6.
- `treasure-maps.md` already runs to 14 sections and is story 3's file.
- A menu is a DList item, a different wire family from the 10040 grammar.

### Option C — The handoff's § 4 verbatim

Pros: no reinterpretation.

Cons:
- It resolves exact keys only, so the editor's family entries would still get `''`. That is the very defect in OPEN.md
  row `2026-10-10-external-assistant-relay-left-empty`.
- `q` adds a third meaning to an overloaded letter, and readers would collapse menus as if they were copies.
- A per-customer menu without its `q` would pose as a storefront.
- Deletion is offered as a withdrawal, and deletions don't travel.

## Decision

We chose **Option A**.

**Sub-decisions** (the wire shape the Implementer writes):

1. **The header**, `39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu`, signed by Nous:
   ```
   ["d", "duty-menu"]
   ["names", "duty menu", "duty menus"]
   ["description", "What one Assistant key offers to publish: Treasure Map keys and the relay for each. Offered, not active. No price or tier."]
   ["b", "39998:<Nous>:duty-menu", "pointer"]
   ["required", "p", "The Assistant: the item's own author"]
   ["recommended", "duty", "A Treasure Map key and the relay this Assistant publishes it to"]
   ["allowed", "not-offered", "A Treasure Map key this Assistant does not offer"]
   ["allowed", "storefront", "On a storefront: its own address. On a per-customer menu: its provider's storefront"]
   ["allowed", "name"]
   ["allowed", "description"]
   ["allowed", "json", "Per-duty details under dutyMenu, keyed by Treasure Map key. No price or tier."]
   ```
   - The `b` self-declares the header (Inherit-From § "The `b` tag").
   - `required p` gives subject `p`.
   - `duty` is `recommended`, not `required`, so a menu that offers nothing is valid.
   - A person adds Duty Menu to their dictionary by publishing their own header with a pointer-`b` to this one (Shared
     Concepts § "Declared affiliation"). Copies keep these declarations, so Nous publishes them on the header before
     anyone adopts it.
2. **The item.** One replaceable kind `39999` per Assistant key, signed by that key, `d` = `duty-menu`, so its address is
   `39999:<key>:duty-menu`. `duty-menu` is reserved as a kind-39999 `d` for menus: writers MUST NOT use it for any other
   39999.
   - It MUST carry exactly one `p`, its own pubkey.
   - It MUST carry `["z", "39998:<Nous>:duty-menu"]` (D9). That `z` is its parent pointer under the base NIP, and so
     Stamping's personal `z`.
   - Other `z` tags are allowed and ignored by menu readers, but a menu MUST NOT carry a header-declaring `z`
     (DList Header Declaration).
   - Because every conforming menu carries Nous' `z`, a `#z` query on Nous' handle finds them all. This is a deliberate
     exception to Stamping's read contract, which says not to rely on one shared handle being complete.
   - It MAY carry `name` and `description` (DList NIP).
3. **Rows.**
   - **`["duty", "<Treasure Map key>", "<relay>"]`** says *offered*: the key is a § 4.7 key, and the relay is where the
     insights will be published. A `duty` row with a missing or empty relay is invalid and ignored. This deliberately
     differs from Treasure Maps § 3, where an empty relay still names a provider.
   - **`["not-offered", "<Treasure Map key>"]`** states an exception, such as "every Score except `30385`". It takes
     part in precedence like any row (confirmed by the owner, 2026-10-10).
   - Keys are normalized before any comparison, duplicate check or details lookup: naddrs and nevents canonicalized
     (§ 4.1), omitted or empty trailing segments dropped (§ 4.4), `39998:dlist-header` read as `39998` (§ 4.5).
     *(Amended by A1-8: Concept keys are not trimmed; rows keyed `39998:` or `39999:` are ignored until story 3.)*
   - At most one row per normalized key; on duplicates the first row wins. Unparseable keys are ignored, and elements
     after those defined here are reserved.
   - A row creates no duty and never says *active*.
4. **What counts as a menu.** A reader treats an event as a Duty Menu only when all of these hold: kind `39999`,
   `d` = `duty-menu`, a single `p` equal to its author, and Nous' `z`. This is a *validity* rule, like "only your own
   kind 10002 is your relay list". It is not a trust claim; point-of-view filtering is separate (sub-decision 9). An item
   under the header with `p` = X signed by someone else is not a menu. Under the DList NIP it acts as a nomination of X,
   toward a DList-based list over Duty Menus.
5. **Resolution, for any Map key K, exact or scope.**
   - The **answering row** is the most specific row (by § 6, among `duty` and `not-offered` rows together) whose key
     *covers* K. A row key covers K when it is K or broader than K under § 4.4 scopes.
     *(Amended by A1-1: "covers" is defined by matching. A1-2 restates the answering row, unchanged.)*
   - If the answering row is a `duty` row, K is **offered at its relay**. If it is `not-offered`, or no row covers K, K is
     **not offered as a whole**.
   - If rows *narrower* than K give a different relay or say `not-offered`, K is **partly offered**. A client then either
     writes the narrower Map entries as well, so that the Map's own § 6 gives each insight its relay and the exceptions
     their own entries, or writes K with the answering row's relay and leaves per-insight relays to read-time resolution
     (story 3's fallback).
     *(Amended by A1-3 and A1-4: every row within K is listed, and a client writes one entry per key the observer
     chooses, never added entries.)*
   - A Map entry built from a menu is `[K, <menu author>, <answering row's relay>]`.
     *(Amended by A1-4: when the answering row is not a `duty` row, the menu gives K no relay. If the observer keeps
     K for A, the entry takes the one relay A's offering rows within K share, or the empty string.)*
   - The spec carries a worked example: a menu with `3038x` → R1 and `not-offered 30385`, resolved against Map entries
     `3038x` and `30382:rank`.
6. **Details.** At most one `["json", "{\"dutyMenu\": {\"<normalized key>\": {…}}}"]`.
   - Defined fields: `description` (text), `interval` (an ISO 8601 duration, the expected update cadence), and
     `algorithm` (a name, such as the `d` of a `score-algorithm` item where one exists).
   - A duty's details come from its answering row's key. A menu carries no price and no tier (D5). Readers ignore unknown
     fields.
7. **Storefronts and per-customer menus.**
   - **A storefront** is a provider's main-key menu, for comparing providers before signing up. It marks itself with a
     **self-pointing** `["storefront", "39999:<own key>:duty-menu"]`, the same idiom as self-declaration. Only menus so
     marked are storefronts, so the marker fails closed: no menu poses as a storefront by leaving something out.
   - **A per-customer menu** is the menu of a key that serves one observer (Treasure Maps § 9, "One key per observer").
     It MAY carry `["storefront", "39999:<storefront key>:duty-menu", "<relay>"]` naming its provider's storefront (owner,
     2026-10-10: MAY, not MUST). That link is the key's own claim, not proof that the storefront's author
     runs it.
   - **Row meaning differs by menu.** A per-customer menu's rows say what *this key* will publish for the one observer
     it serves. A storefront's rows say what the provider offers and where its per-customer keys will publish. Readers
     MUST NOT turn storefront rows into Map entries naming the storefront key, unless that key is the observer's own
     Assistant.
   - **One key per algorithm** (D7, NIP-85) means one menu per key: a provider with two algorithms has two storefronts.
8. **Finding a key's menu.**
   - The filter is `{"kinds":[39999], "authors":["<key>"], "#d":["duty-menu"]}`.
   - Readers look first wherever they already hold a relay hint, then on the key's NIP-65 (kind 10002) write relays
     (D3), then on the relays where Nous' header is published.
     *(Amended by A1-7: found through Nous' kind 10002 write relays.)* (See A1-12.)
   - Publishers SHOULD publish the menu to its own write relays and to the relays where Nous' header is published.
     *(Amended by A1-7: the key's own kind 10002 write relays, the relays its `duty` rows name, and Nous' kind 10002
     write relays.)* (See A1-12.)
9. **Listing all menus and the provider directory.**
   - `{"kinds":[39999], "#z":["39998:<Nous>:duty-menu"]}` lists all menus. Anyone may publish there, so readers filter
     the results per point of view (CLAUDE.md invariants 2 and 3).
   - **The provider directory** is non-normative, the owner's addition. It is the self-marked storefronts under the
     header, read through their authors' kind 0 profiles (name, website) and grouped by website.
   - The section names candidate per-point-of-view signals and leans on the Show and Tell philosophy's H3 (a Tell covers
     cold start, as a hint):
     - **Tell:** trusted reactions to storefront menus, and a DList-based list over Duty Menus;
     - **Show:** how many trusted observers' Treasure Maps name keys linked to a storefront, with the reuse hazard's three
       questions;
     - **author trust:** weak, because NIP-85 service keys are seldom followed.
   - A provider that publishes no storefront is not listed.
10. **A hint, never a gate.** A client MAY warn that a key doesn't offer a duty, but MUST NOT refuse to write a Map entry
    naming it (CLAUDE.md invariant 2). Duties come only from the observer's Map (Treasure Maps § 9).
    *(Amended by A1-4: the relay such an entry carries.)*
11. **Offered versus active.** The menu says offered; the key's own Treasure Map says active. The spec points to Treasure
    Maps § 9 and defines nothing about it (Self-Maps are story 3).
12. **Publishing and withdrawing.**
    - Change offers by republishing the one replaceable item.
    - Withdrawal SHOULD be a republished menu with no `duty` rows: it carries Nous' `z`, rides the sync and replaces older
      copies.
    - A NIP-09 deletion MAY follow that republish, and it MUST name `["a", "39999:<key>:duty-menu"]`, `["e", "<id>"]` and
      `["k", "39999"]`. That follows Assistant Designation's curation-copy removal, since some relays honour only the
      `e`.
      *(Amended by A1-6: the deletion's `created_at` is strictly earlier than the empty menu's.)* (See A1-12.)
13. **Security and privacy** (the spec's § 11 content):
    - Under D9, per-customer keys are listable under Nous' header (accepted).
    - Staying out of the directory is a courtesy that directories following this spec honour. It is not privacy: a
      provider's per-customer menus, the relays in their rows and their kind 0s can still point to it.
    - A `storefront` link and a kind 0 website are claims; any key can copy a real provider's name. A directory SHOULD
      check that the kind 0's NIP-05 domain matches its website.
    - Menus never list private duties (open question, handoff Q4).
14. **Spec layout** (`duty-menus.md`):
    - metadata header: Status 📝 pre-NIP; Canonical: not yet published; Implementation: none (the header is not yet
      published; nothing publishes or reads menus); Sources: the handoff, ADRs 0001–0002;
    - title, a one-paragraph summary, and "At a glance";
    - § 1 Principles (including "a hint, never a gate"); § 2 Terms (provider, storefront, per-customer menu, offered,
      active); § 3 The header; § 4 The item; § 5 Rows; § 6 Reading a menu (validity, resolution); § 7 Storefronts and
      per-customer menus; § 8 Finding menus; § 9 The provider directory (non-normative); § 10 Offered and active;
      § 11 Publishing and withdrawing; § 12 Security and privacy; § 13 Examples (a storefront; a per-customer menu with a
      `not-offered` row; the resolution example from sub-decision 5); § 14 Open questions (private duties; whether a
      per-customer menu identical to its storefront may be omitted).
    - No "canonical" or "consensus" in normative text, and no "root".
15. **README and worksheet.**
    - A `protocols/README.md` index row: "Duty Menus (what an Assistant key offers to publish, and where; Nous' shared
      header)", `drafts/duty-menus.md`, 📝 pre-NIP, "Working copy here. Nothing publishes or reads menus yet; Nous' header
      is not yet published.", origin `duty-menus-and-self-maps` #2.
    - A dated note at the end of worksheet W1, before its **Refs** line: the Duty Menu header is held by Nous' key, a
      deliberately held community key, offered as a self-declared Shared Concept and adopted into dictionaries by
      pointer-`b`, with no per-deployment firmware copy.

**Owner confirmations at the gate (2026-10-10), all three as recommended:**
- **(a) Exceptions: yes.** Menus may state them with the explicit `["not-offered", "<key>"]` tag.
- **(b) The per-customer → storefront link is MAY.** A provider can decline it. The storefront marker is self-pointing and
  fails closed.
- **(c) "Don't want to be found"** means staying out of directories that follow the rule, by publishing no storefront. It
  does not mean being unfindable: under D9, per-customer menus still sit under Nous' header.

## Consequences

- **Any instance can fill a Treasure Map relay for an Assistant it doesn't run,** for exact and scope keys alike,
  knowing only the pubkey. That is the lasting fix for OPEN.md row `2026-10-10-external-assistant-relay-left-empty`, in a
  later code book.
  *(Amended by A1-4: for a scope key the relay is exact for the answering row's part; insights in a differing row's part
  resolve at read time. A key the menu does not offer gets an entry only if the observer keeps it, with A1-4's
  insisted-key relay.)*
- **A provider directory falls out of D9.** It fails closed and offers named per-point-of-view signals.
- **Exceptions are expressible** without overloading an empty relay.
- **Story 3 carries forward:**
  *(Amended by A1-4 and A1-8: further carry-forwards, in A1's Implementation notes.)*
  - make sure the Concept key `39999:duty-menu` (§ 4.5, § 5.3) is never read as a menu. It names a 39999-declared Concept
    header, which a menu never is. Do **not** reserve `duty-menu` as a general Concept `d`: that would forbid Nous'
    header and every dictionary copy;
  - point § 9's Self-Maps text at this spec.
- **New wire surface:** three multi-letter tags, `duty`, `not-offered` and `storefront`. None is relay-indexed, and none
  takes a letter (W2 unaffected).
- **Departures from the handoff's § 4 example:**
  - its `q` becomes a self-pointing or linking `storefront`;
  - `duty` is `recommended` rather than `required`;
  - the details namespace is `dutyMenu`;
  - exceptions get their own tag;
  - the description keeps "No price or tier" and leaves the pointer to kind 10040 to the spec's § 10.
- **Follow-up:** once a directory is built, add a worked example to `design-philosophies/show-and-tell.md`, via an OPEN.md
  row at that time.
- **Firmware reinstall required?** No.

## Implementation notes

Docs-mode: the Implementer authors exactly these.

1. **`protocols/drafts/duty-menus.md`**, laid out per sub-decision 14, carrying sub-decisions 1–13 as normative text
   (sub-decision 9's directory as non-normative), with the owner's answers (a)–(c) applied. Examples use the full Nous
   pubkey and placeholder keys `<A>` (a per-customer key) and `<S>` (a storefront key).
2. **`protocols/README.md`:** the index row from sub-decision 15, placed after the DList Auxiliary Events row and before
   the Amendments row.
3. **`protocols/worksheet.md` W1:** the dated note from sub-decision 15, before **Refs**.

**Gates (AC5, AC6):**
- `grep -n -i -E "canonical|consensus"` over the new spec finds only the metadata label `**Canonical:** not yet published`.
- Every link and § reference resolves.
- `bash scripts/harness-lint.sh` is clean.
- The stack-free `npm test` shows no regression against the clean-tree baseline.
- `git diff --stat` touches exactly these three `protocols/` files, plus the story's Linked artifacts.

## Out of scope

- Self-Maps and the § 4.5 / § 5.3 care for `39999:duty-menu` (story 3).
- Nous publishing the header.
- Private duties (open question in the new spec).
- Any code: publishing menus, reading them on `/treasure-map`, the directory page.
- An upstream NIP-85 proposal.

## Amendment A1 — one Map entry per chosen key, and the deletion's timestamp (review round 2 kick-back, 2026-10-11)

**Why.** Review round 2 of story 2 found two blockers in the spec's § 6.2. Both come from sub-decision 5. An auditor
found a third defect, in sub-decision 12:
- **B3, "covers"** (review `2-duty-menus-pre-nip.md:306–310`). The spec spelled "covers" out from this ADR's Context
  paraphrase (:44): only an omitted or empty *trailing* segment covers any value, and there is no bare `*`. But Treasure
  Maps § 4.4 lets an empty segment sit anywhere (`30396:tag::⟨Vegan⟩`, `treasure-maps.md:155–156`), and § 4.2 lists `*`
  on its own (`:96`). A bare `*` also reaches Concepts. No `*:<scope>` key does (`:162`, `:531`).
- **B4, extra entries** (review :311–322). Sub-decision 5 lets a client write "the narrower Map entries as well, so that
  the Map's own § 6 gives each insight its relay". That promise fails. In review cases C and D (:258–259) an insight gets
  one relay from the menu and another from the written Map. Case D fails under this ADR's own wording: a narrower row
  that answers with K's relay gets no entry, so a broader written row claims its insights.
- **The deletion's timestamp.** Sub-decision 12 lets a NIP-09 deletion *follow* the empty menu, and makes it name the
  `a`. NIP-09 says: "When an `a` tag is used, relays SHOULD delete all versions of the replaceable event up to the
  `created_at` timestamp of the deletion request event" (NIP-09, `09.md:35` in `nostr-protocol/nips`, fetched
  2026-10-11). So a deletion made after the empty menu deletes the empty menu too, on every relay that applies the `a`.

The story came back to Architecture. Every passage above that A1 supersedes or qualifies carries an
"(Amended by A1-n.)" marker. Where any sentence above conflicts with A1, A1 governs.

**Revision 1** (2026-10-11) answers an independent skeptic review of A1's first text. It adds the meet and lists every
row within K (A1-3, A1-4). It calls A1's rows "differing rows", because "exception" already names a `not-offered` row.
It replaces the insisted key's guessed relay (A1-4), states the deletion rule by timestamps (A1-6), restores a
publishing target (A1-7), and fixes A1-8's Concept readings. It also corrects how the model evidence is described.

**Revision 2** (2026-10-11) answers a second skeptic review. A1-8 now reads a bare `39998` as Treasure Maps § 4.5's
words and the shipped card rule do, orders it below `39999`, and drops revision 1's false claim about the shipped
editor. A1-1 judges § 4.3 agreement from the key alone. A1-4 says exactly when a differing row's own key does nothing.
"How it was settled" limits the several-keys result to keys a `duty` row answers. After a final check, A1-1 judges § 4.3
agreement from the category segment's value, not its type.

**Revision 3** (2026-10-11) answers the round-3 kick-back: four questions that came up while the spec took in A1, and
that A1 does not decide. A1-9 says which kinds category `39998` agrees with. A1-10 reads an empty category in a
`30392` or `30382` key as Treasure Maps does, and says what follows for meets. A1-11 says where A goes when K's
providers are carried onto a new key. A1-12 keeps a replaced menu from surviving at the relays an earlier version
named. A skeptic review then revised them. A1-9's cost now names the keys that a narrower reading would offer whole.
A1-10 gives its real reason for reading the carve-out per key, and asks Treasure Maps about family and `*` keys too.
A1-11's order no longer depends on which differing row led to the new key: the providers that offer it keep K's order,
and a provider that partly offers it is offered keys that keep it where it offers. A1-12 says which relays a reader
asks, and sends each version to the relays that earlier `duty` rows named. A second skeptic review then found that
A1-11 could still carry K's order onto insights another Map entry held, that a nested meet lay within two Map keys
that gave two orders, and that a new Assistant that replaced no one went last. A1-11 now carries the providers of the
one entry a new key takes insights from, names every entry it takes insights from, carries nothing when there are
several, builds a nested meet from the Map before the new key, and puts a new Assistant that replaces no one first.
A1-9 to A1-12 are proposed and await the owner's approval. The rest of A1 stands as approved.

**Revision 4** (2026-10-11) is the owner's gate on A1-9 to A1-12. A1-11 was replaced there, and A1-4's Backups bullet
with it, by a short rule: which providers a new key has, and in what order, is the observer's choice, and the spec sets
no default. The earlier text made a client's suggestion normative, and after two revisions two blocking findings
against it were still open. The passages that relied on it are rewritten or removed.

**Approved** by the owner, 2026-10-11: A1-9, A1-10 and A1-12 as written; A1-11 replaced by the short rule below
(revision 4).

**After approval.** Fix pass 5 of story 2 (the Implementer) added "unless they are listed on it" to A1-11's rule and
to its four restatements below. Without those words the SHOULD is false once one of K's other providers is listed on
the new key, which the rule leaves to the observer. The words come from A1-11's own Why: "They do not, unless the
observer lists them on the new key." The owner's substance is unchanged, but these words were not on the gate, and
they await the Architect's ratification. Fix pass 5 also corrected the implementation note on A1-4's Backup offer. The
client may still offer to add K's providers. A1-11 dropped A1-4's SHOULD that it offer to carry them over in K's order.

**How it was settled.** The orchestrator built a brute-force model of Treasure Maps matching and precedence, in the
session scratchpad (`model/check.py`, `model/check2.py`; not durable). It models § 4.4 (an empty or omitted segment
means any) and § 6 (kind-slot rank, then the left-most difference). Its kind slot is a reduced § 4.2: exact kinds
`30382`, `30392` and `30396`; a `3038x` with one member, `30382`; a `3039x` with two; and `*`. It has no Concept keys
and no kind–category agreement (§ 4.3). It also makes some keys with an empty system slot, which § 4.4 forbids.
Skeptics then built a fuller model (`model/tm_ext.py`): multi-kind families, § 4.3 agreement, Score metrics and
Concept keys. It fixes each DList's subject in advance.
- **Writing K plus every narrower `duty` row, unchanged,** with K alone when an overlapping row wins part of K. It fails
  because narrower by coverage is not more specific by § 6. Say K names an exact kind, and a row names a family but
  reaches only insights under K. Then the row is narrower than K, yet K beats it in the Map, because § 6 compares the
  kind slot first (`treasure-maps.md:243, 273`). In the menu, the same row can beat K's answering row, when that is a
  family or `*` row. Treasure Maps has such rows wherever the kind and the category must agree (§ 4.3, `:135–142`).
  - The evidence is this hand example. `3039x:tag:1` reaches only `30393` lists, because only `30393` takes a
    non-addressable event kind such as `1`. With a menu `3039x` → R0 and `3039x:tag:1` → R1, and K = `30393`, writing
    `30393` → R0 and `3039x:tag:1` → R1 gives the Tag-based lists of notes R0 in the Map, while the menu gives them R1.
  - The fuller model reproduces it (`model/tm_ext_cases.py`): 6 mismatches in 37,141 cases. Each needs § 4.3: a
    model with real families but no § 4.3 finds none (below).
  - `check.py` also stops at six mismatches, after 10,134 cases, but only because its `3038x` has one member. That
    stands in for § 4.3, which it does not model. With a real `3038x` family it finds none
    (`model/skeptic_cite_fullfam.py`). It checks the model, not Treasure Maps.
- **The rule below.** In the reduced model (`check2.py`), across 60,000 random menus, covering rows never tie, the
  answering row is the same for every insight under K, and the one entry `[K, <author>, <answering row's relay>]` gives
  the menu's relay for every insight the answering row answers (0 mismatches). Revision 1 re-checks the rule in the
  fuller model (`arch/a1r1.py`): 40,000 menus under each of two readings of `39998:` (A1-8), with no tie, no wrong
  relay outside a listed differing row, and the meet behaving as A1-3 says. Revision 2 re-checks it (`arch/a1r2.py`),
  40,000 menus per run, in eight runs: A1-8's revised reading and revision 1's, fixed DList subjects and § 4.3 judged
  from the key alone (A1-1), and each reading of `39998:`. Every run gives the same zeros, and no two rows that share
  an insight tie.
- **Extra entries also compete with the observer's other Assistants** (`check2.py`, last lines). A's menu is `3039x` →
  R0 and `3039x:tag:⟨D1⟩` → R1, and the observer's Map already has `3039x:tag` → B. Adding `3039x:tag:⟨D1⟩` → A takes
  D1's Tag-based lists away from B, which the observer never chose. With K alone they stay with B.
- **Several chosen keys.** Every insight whose winning chosen key is answered by a `duty` row gets the menu's relay, or
  is listed in one of that key's differing rows: 0 failures in 6,588 checks (`arch/a1r1.py`, fuller model) and in each
  of `arch/a1r2.py`'s eight runs (3,287 to 5,377 checks each). `arch/cases.py` (reduced model) found 0 in 154,073
  checks, but it scores a winning key that no `duty` row answers as writing no entry.
  - Insisted keys are excluded. Their guarantee is A1-4's weaker one, which `a1r2.py` also checks (0 failures). The
    stronger statement fails for them: an insisted `3039x` in § 13.2 gives `30392:dlist:⟨D⟩` to A at
    `wss://lists.example`, though the menu offers it nowhere and no differing row lists it.

The owner approved proceeding on this proposal at the review round 2 gate, 2026-10-11. The proposal said "or none when the
answering row is not a duty row". A1-4 reads that as: the menu gives K no relay. Sub-decision 10 still lets the observer
keep K for A, so A1-4 decides that entry's relay (the insisted key). A1 also goes beyond the proposal in four places: the
meet and the Backup offer (A1-4; A1-11 has since replaced the offer), A1-7's restored publishing target, and A1-8's
reader rules, order and SHOULD. A1-8 also takes a side on an open owner question (ledger row
`2026-10-09-draft-grammar-bare-39999`; see A1-8). A1 itself is proposed and awaits approval at this gate.

**Approved** by the owner, 2026-10-11, with both gate points confirmed: A1-4's insisted-key relay (the offering rows'
shared relay, else the empty string), and A1-8 as the spec's reading of the bare Concept kinds until story 3.

**What stays.**
- Sub-decisions 1, 2, 4, 6, 7, 9, 11 and 13–15. Sub-decision 3 gains A1-8's reader rule and writer advice, and
  sub-decision 10 gains A1-4's relay rule.
- The answering row (A1-2), and the entry's shape `[K, <menu author>, <answering row's relay>]`.
- "A hint, never a gate".
- No new wire surface: no tag, kind or field.

### The rules

**A1-1 — "Covers" is defined by matching.** *(Supersedes: sub-decision 5's "A row key covers K when it is K or broader
than K under § 4.4 scopes"; the Context paraphrase of § 4.4 (:44); spec § 6.2 step 1.)*
- A row covers K when the row's key matches every insight K could match under Treasure Maps §§ 4.2–4.5, kind–category
  agreement (§ 4.3) included. That means every such insight in principle, not only the observer's supported sets
  (§ 8, `treasure-maps.md:289`). Covering must not change when the observer's supported sets do.
- § 4.3 agreement is judged from the key alone, from the category segment's own value:
  - an event-kind number agrees with the kinds § 4.3 gives that number: `30393` for a non-addressable kind, `30394` for
    an addressable one, `30397` for `39998` (*DList headers*). (See A1-9.)
  - a NIP-73 type agrees with `30395` (and its Score kind);
  - an empty segment means any category (§ 4.4), not the Profiles type. (See A1-10.)
  - a DList's naddr or nevent agrees with every Score and List kind that § 4.3 lets a DList yield.

  A reader never fetches a header or items to decide covering.
  - Why: a DList's kind follows its header's subject, and a DList with mixed subjects spawns one list per kind
    (`treasure-maps.md:144`, `:149`). The header can change, and anyone may publish items. Covering judged from them
    would go stale, as covering judged from supported sets would.
  - Example: a menu `3039x` → R0, `30392` → R1, and K = `3039x:tag:⟨D⟩`, where D's subject is `p`. Judged from D's
    header, `30392` covers K and the entry is R1. If D later yields `30396` lists too, they get R1 from the Map and R0
    from the menu, and no differing row listed them. Judged from the key, the answering row is `3039x`: the entry is
    R0, and `30392` → R1 is a listed differing row, with meet `30392:tag:⟨D⟩`.
- Examples, not a closed list:
  - a bare `*` covers every key, Concept keys included (§ 4.2, `treasure-maps.md:96`);
  - a family wildcard covers its kinds (§ 4.2);
  - in a Score or List key, an empty segment covers any value in any position, so `30396:tag::⟨T⟩` covers
    `30396:tag:⟨D⟩:⟨T⟩` (§ 4.4). (See A1-10.)
  - an omitted trailing segment covers any value (§ 4.4);
  - a row can cover K through § 4.3: `30393` covers `3039x:tag:1`, because only `30393` takes category `1`;
  - a bare `39998` covers every Concept key, `39999` and `39999:<d>` included, and a bare `39999` covers the
    `39999:<d>` keys, in A1-8's reading;
  - no `*:<scope>` key covers a Concept key (`treasure-maps.md:162`, `:531`).
- What a key matches stays Treasure Maps' to define. Where Treasure Maps leaves it open, A1-8 says which reading the spec
  uses until story 3. (See A1-9 and A1-10.)
- A key that matches no insight, because its kind and category disagree (§ 4.3), has nothing to resolve.

**A1-2 — The answering row, unchanged.**
- The answering row for K is the most specific covering row by Treasure Maps § 6, among `duty` and `not-offered` rows
  together. If it is a `duty` row, K is offered at its relay. If it is `not-offered`, or no row covers K, K is not
  offered as a whole.
- It is well-defined, and it is the same row for every insight under K. That holds for every Score and List key, and for
  Concept keys among the rows a reader keeps and in the readings A1-8 sets:
  - § 6 compares two keys by their own segments only (`treasure-maps.md:241–245`). So the order of two keys that both
    match an insight does not depend on the insight.
  - Every covering row matches every insight under K. So any two covering rows share an insight. Their kind slots nest
    (`*`, then a family, then its kinds; for Concepts, `*`, then a bare `39998`, then `39999`, by A1-8), and wherever
    both name a value, the values agree. So their first difference is the kind slot's rank, or a value against an empty
    or omitted segment, and § 6 decides it, with A1-8's order for the two Concept kinds. Two covering rows never tie
    (`:246`).
  - The answering row therefore beats every other covering row on every insight under K. Any other row that wins an
    insight under K does not cover K: it is narrower than K, or it overlaps K.
- Without A1-8 the claim fails for Concept keys. Rows `39998` and `39998:` would both cover `39998:<d>`, or the header
  whose `d` is empty, and neither names a value. Rows `39998` and `39999` both cover `39999:<d>`, since a bare `39998`
  reaches 39999-declared headers, and § 6 alone cannot order two exact kinds. A1-8's order does.

**A1-3 — Rows within K, the meet, and differing rows.** *(Supersedes: sub-decision 5's third bullet, "If rows narrower
than K give a different relay …"; spec § 6.2 step 4's first paragraph.)*
- A **row within K** is a row, other than the answering row, that wins at least one insight under K (by § 6, over all
  of the menu's rows). By A1-2 it never covers K. It is narrower than K (`not-offered 30385` within `3038x`), or it
  overlaps K (`*:tag` within `3039x` when `*` answers K).
- The **meet** of K and a row within K is the key for the insights both keys match. It takes the narrower kind slot, and
  every value either key names. The two keys share an insight, so their kind slots nest and their named values agree.
  So the meet is always defined, and it is a § 4.7 key. Examples: `3039x` and `*:tag` give `3039x:tag`; `30396` and
  `3039x:tag:⟨D⟩` give `30396:tag:⟨D⟩`; `*` and `39998:<d>` give `39998:<d>`; `39998` and `39999:<d>` give
  `39999:<d>` (A1-8). (See A1-10.)
- The meet is K made more specific, so it beats K by § 6. Resolved afresh, its answering row is the row itself.
- A row's **part** is the insights under K that it wins: the insights of its meet, except those that a row within K
  beating it (§ 6) also matches. A part may have no key of its own. In case D, `3039x:tag`'s part is the Tag-based lists
  of every List kind but `30396`.
- A row within K is **differing** when it answers its part differently from the answering row:
  - with another relay;
  - with `not-offered`, where K is offered;
  - with an offer, where K is not offered as a whole.
- A row within K with the same answer is not differing. Case D's `30396:tag` → R0 is one.
- K is **partly offered** when it has at least one differing row. The spec keeps the term.
- The spec says "differing row", never "exception", for this. The spec and this ADR already call a `not-offered` row an
  exception (§ 5.2; sub-decision 3), which is a different thing: a `not-offered` row that answers K is not a differing
  row of K.

**A1-4 — Writing the Map: one entry per key the observer chooses.** *(Supersedes: sub-decision 5's two options, its
entry bullet, and its "writes the narrower Map entries as well"; spec § 6.2 steps 4 and 5. Qualifies sub-decision 10.)*
- **One entry per chosen key.** For each key K the observer chooses for Assistant A, a client building from A's menu
  resolves K (sub-decision 7 still limits which menus may fill entries):
  - when the answering row is a `duty` row, it writes `[K, <A>, <answering row's relay>]`;
  - otherwise the menu gives K no relay. The client warns that A does not offer K as a whole (sub-decision 10). If the
    observer keeps K for A, the client writes the insisted-key entry (below). If not, it leaves the Map as it was.
- **Menus supply relays, never keys.** A client MUST NOT turn a menu's rows into Map entries the observer did not
  choose, for differing rows or anything else. An entry the observer picks some other way, such as the family entry an
  editor adds when a category is assigned, is the observer's choice.
- **Every row within K is listed.** For each row within K, the client shows its meet with K and its answer. Each applies
  to its meet's insights, except where a listed row that beats it (§ 6) also matches. So no nested row is hidden. Take
  the menu `3039x` → R0, `not-offered 3039x:tag`, `30396:tag` → R0, and K = `3039x`. The client lists `30396:tag` → R0
  inside `3039x:tag`, so it does not say that Tag-based lists of DList items won't come from A.
  - For a `not-offered` part, the client says those insights won't come from A, so the observer can give them to
    another Assistant.
  - The client MAY note that another entry in the observer's Map wins a part (§ 6). It still lists it, because the
    observer may later remove that entry.
- **A new key within K.** For each differing row, the client offers the row's meet with K as a key the observer may
  choose: for A when the row offers, or for another Assistant when it is `not-offered`. The observer may choose it, or
  any other key. The client resolves the chosen key afresh by A1-1 to A1-4, and lists the rows within it. (See A1-10
  and A1-11.)
  - The meet beats K. So when the row offers, choosing its meet for A gives the row's part the row's relay, unless
    another Map entry beats the meet.
  - The row's own key is no substitute when K beats it by § 6: K's kind slot is narrower, or, with the same kind slot,
    K names a value at the first segment where the two keys differ. K then wins every insight they share. Case C shows
    both. Under K = `30396`, choosing `3039x:tag:⟨D⟩` changes nothing; its meet, `30396:tag:⟨D⟩`, gives D's other
    Tags R2. Under `30396:tag:⟨D⟩`, choosing its differing row's key, `30396:tag::⟨T⟩`, changes nothing, because
    `30396:tag:⟨D⟩` names D at the third segment; its meet, `30396:tag:⟨D⟩:⟨T⟩`, gives that list R1.
  - When the row's key beats K, choosing it also gives the row's part its relay, unless another Map entry beats it.
    It may reach insights outside K as well. (`arch/a1r2.py`: the row's key does nothing exactly when K beats it.)
  - A new key can take insights that K's entry already got right. They show up among the new key's differing rows. In
    case D, choosing `3039x:tag` gives `30396:tag:⟨D⟩:⟨T⟩` R1 in the Map. Resolving `3039x:tag` lists `30396:tag` → R0
    as its differing row, whose meet the observer may choose in turn.
  - **Backups.** Replaced by A1-11: which providers a new key has, and in what order, is the observer's choice.
- **The guarantee, and no more.**
  - For each chosen key K whose answering row is a `duty` row, the entry's relay is the menu's relay for every insight
    under K except those in a differing row's part. The client lists every differing row.
  - An insisted key's guarantee is weaker (below).
  - Whether the Map gives an insight to K's entry at all depends on the observer's other, more specific entries
    (Treasure Maps § 6). That is the observer's choice.
  - Exact relays for insights in a differing row's part come from read-time resolution, which Treasure Maps does not
    yet define (story 3; see the Implementation notes).
- **The insisted key.** Sub-decision 10 forbids refusing to write an entry for a key the menu does not offer. When the
  answering row is `not-offered` or absent, and the observer keeps K for A, the entry is `[K, <A>, R]`:
  - R is the relay of the rows within K that offer something, when they all name the same one. Then R is the menu's
    relay for every insight under K that A offers. In § 13.2, an insisted `3039x` gets `wss://lists.example`, right for
    every list A offers under it.
  - Otherwise R is the empty string, as the handoff's § 6 step 4 says. Treasure Maps § 3 allows it
    (`treasure-maps.md:77`).
  - The client still warns that A does not offer K as a whole.
- **Set aside for the insisted key:**
  - A's kind 10002 write relays, or the relay where the client found A's menu. Both are guesses. A kind 10002 lists
    general relays too (D3), and NIP-65 gives its `r` tags no order (`65.md:11–33`, same repository). A guess also
    looks like a real relay on the wire. A reader then has no cue to look further, and a later real offer stays hidden.
    The empty string says "no known relay", which story 3's read-time resolution can act on, afresh on every read
    (CLAUDE.md invariant 3). D3's fallback locator belongs there.
  - The relay the Map already gives A in the same category (handoff § 6 step 3, the ledger row's stopgap). "Same
    category" is undefined, and there may be none.
- **Why the multi-entry option is removed.**
  - Case C (review :258): intersecting with K raises an overlapping row's kind slot, and § 6 then orders two written
    parts the other way round. `30396:tag:⟨D⟩:⟨T⟩` gets R1 from the menu and R2 from the written Map.
  - Case D (review :259): a nested row that answers with K's relay gets no entry, so a broader written row claims its
    insights. `30396:tag:⟨D⟩:⟨T⟩` gets R0 from the menu and R1 from the Map. The gap is in sub-decision 5's own wording.
  - Writing every narrower `duty` row unchanged fails too ("How it was settled"), because narrower by coverage is not
    more specific by § 6.
  - Added entries compete with the observer's entries for other Assistants (the `3039x:tag` → B case).
  - The intersection key's kind slot was never defined, and a `not-offered` row can have no entry (B4 iii and iv). A1-3
    now defines the meet, but only as a key the client offers the observer, resolved afresh like any chosen key.

**A1-5 — § 13.3's `3039x` row.** *(Supersedes: spec § 13.3's `3039x` row, "Write `["3039x:tag", "<A>",
"wss://lists.example"]` instead".)*
- In § 13.2 no row covers `3039x`: `3039x:tag` is narrower. So the menu gives `3039x` no relay.
- The new row: answering row "none (`3039x:tag` is narrower)"; result "Not offered as a whole; partly offered through
  `3039x:tag`. No entry from the menu. The client offers the meet, `3039x:tag`, which resolves to `["3039x:tag", "<A>",
  "wss://lists.example"]`. If the observer keeps `3039x` for `<A>`, the entry is `["3039x", "<A>",
  "wss://lists.example"]`, the one relay its offering rows share".
- The other four rows stand. `3038x` already writes one entry and lists its differing row.

**A1-6 — The deletion is older than the empty menu.** *(Supersedes: sub-decision 12's third bullet, "A NIP-09 deletion
MAY follow that republish"; spec § 11's last bullet.)*
- A NIP-09 deletion MAY accompany a withdrawal. Its `created_at` MUST be strictly earlier than the empty menu's. The
  timestamps decide, not the order of publishing or of arrival. (See A1-12.)
- If an empty menu is already out, publish a new empty menu with a `created_at` later than the deletion's.
- Why: NIP-09's `a` rule, quoted under **Why**. A deletion older than the empty menu removes every earlier version and
  spares the empty menu, whichever reaches a relay first. "Strictly", because "up to" does not say whether an equal
  timestamp counts.
- The deletion carries `["k", "39999"]`, so it travels by Tapestry's `tagDeletions` stream (`#k` 39999,
  `docs/TAG_FEDERATION_OPS.md:110–131`), not with the menu's `#z` streams. It may arrive before or after the empty menu.
  The timestamp rule makes both orders safe.
- Kept, and clarified for an older empty menu: the deletion MUST carry `["a", "39999:<key>:duty-menu"]`,
  `["k", "39999"]`, and an `["e", "<id>"]` for each earlier version with `duty` rows. The `e` tags never name an empty
  menu, old or new. Some relays apply only the `e` (`docs/TAG_FEDERATION_OPS.md:129`), and removing an empty menu there
  can let an older copy come back. Withdrawal stays a SHOULD: republish the menu with no `duty` rows.
- **Assistant Designation's curation-copy removal** (`assistant-designation.md:108`), which sub-decision 12 follows, does
  not have this defect. A removed copy has no replacement at its address: deleting every version up to the deletion's
  `created_at` is what removal means. A later re-copy at the same address (its `d` derives from the original, `:104`)
  carries a later `created_at` and survives. (A re-copy within the same second is a corner that "up to" leaves
  open, too small for a row.) No ledger row is needed.

**A1-7 — Nous' relays, and where menus are published.** *(Supersedes: sub-decision 8's second and third bullets.)*
- Readers find "the relays where Nous' header is published" as Nous' own kind 10002 write relays (D3, NIP-65). Spec
  § 8.1 step 3 already says so (review NB10, :326–329). A1-7 ratifies it. It assumes Nous publishes its header to its own
  write relays, as NIP-65 expects of any author (`65.md:31–33`).
- The publisher sentence becomes: "Publishers SHOULD publish their menu to their own kind 10002 write relays, to the
  relays their `duty` rows name, and to Nous' kind 10002 write relays." Spec § 11's "Publish the menu where § 8.1 says"
  then agrees with it. (See A1-12.)
- The middle clause restores the handoff's "at least the relays the menu names" (§ 4, `:114`). Sub-decision 8 dropped
  it without logging the change. It makes § 8.1 step 1 work: every non-empty relay in an entry built from a menu is
  one the menu names, so a reader holding that entry finds the menu there. The handoff's other target, "the DList
  relays" (`aDListRelays`), is a deployment setting. The spec names Nous' kind 10002 write relays instead. (See A1-12.)
- The story logs the Nous locator as its own deviation, no longer under "Smaller fixes from round 1".

**A1-8 — Concept keys: two readings and an order, until story 3.** *(Qualifies: sub-decision 3's normalization
bullet, and A1-1.)*
- Treasure Maps leaves two questions open:
  - whether `39998:` is the bare kind with an empty segment ("any", § 4.4) or a Concept key with an empty `d` (§ 4.5)
    (review NB11, :330–333). `39999:` has the same question;
  - what a bare `39999` means, and whether a bare `39998` still covers headers declared as kind-39999 items. § 4.5 says
    a bare `39998` means "all of the observer's Concept headers" (`treasure-maps.md:162`; § 10.1, `:330`), but never
    defines a bare `39999` (§ 10.12, `:460`). Ledger row `2026-10-09-draft-grammar-bare-39999` (OPEN) asks the owner
    exactly this, because the editor writes both kinds on every Concepts assignment.
- Until story 3 settles them, the spec reads:
  - **A row keyed `39998:` or `39999:`** (the kind, a colon, and nothing more) is ignored, like a row whose key does not
    parse. Under either reading it would tie with the bare kind's row: one segment is omitted, the other empty, and § 6
    has no rule for that. Writers SHOULD write the bare kind (`39998` or `39999`), not the kind followed by a colon and
    nothing else.
  - **A bare `39998` covers every Concept key**, `39999` and `39999:<d>` included. That is § 4.5's wording, and the
    card rule's reading: it hides a bare `*` from the Concepts card whenever the Map has a `39998` entry, `39999` or not
    (`src/lib/treasureMapCategories.mjs:17`, `:69–75`). **A bare `39999` covers the `39999:<d>` keys**: the headers
    declared as kind-39999 items.
  - **A `39999` kind slot beats a bare `39998`**, as an exact kind beats a family. Otherwise rows `39998` and `39999`
    would tie on every 39999-declared header: two exact kinds, which § 6 cannot order. The order holds wherever the
    spec compares keys, Map keys included. Treasure Maps § 6 does not have it yet.
- **Not taken: revision 1's reading**, in which a bare `39998` covers only the `39998:<d>` keys.
  - It reads § 4.5 against its words, and the card rule assumes the opposite. Revision 1 said the shipped editor reads
    the kinds so, because it writes them as two family entries (`ui/src/pages/treasure-map/editTreasureMap.js:23`).
    That was wrong. The two entries were the owner's request about what to write (`:9`; ledger row
    `2026-10-08-concepts-assignment-adds-39999`), not a reading of what `39998` covers.
  - It leaves the editor's `39999` entry with an empty relay in the spec's own example. § 13.2's menu offers `39998`
    and no `39999`. Under that reading the menu offers `39999` nothing, and no row lies within it. So if the observer
    keeps `39999` for `<A>`, A1-4 writes `["39999", "<A>", ""]`. Under A1-8 the answering row is `39998`, and the
    entry is `["39999", "<A>", "wss://concepts.example"]`.
  - Keeping it as provisional and adding a `39999` row to § 13.2 would fix only the example. Every real menu that
    offers `39998` alone would still leave the editor's `39999` entry empty.
- **This takes a side on the open owner question.** The owner confirmed it at the gate, 2026-10-11, until story 3. If the owner decides that a bare `39998`
  does not cover 39999-declared headers, story 3 changes Treasure Maps and the spec follows it.
- Otherwise § 5.3 stays as round 2 wrote it: Concept keys are not trimmed, because their `d` is verbatim
  (`treasure-maps.md:162`).
- What a Map key `39998:` or `39999:` matches, and so its meets, follows story 3's answer.
- Story 3 settles both readings, and the order, in Treasure Maps.

**A1-9 — Category `39998` agrees with `30393`, `30394` and `30397`, until story 3.** *(Qualifies: A1-1's first
agreement bullet, "`30397` for `39998` (*DList headers*)"; spec § 6.2 step 1.)*
- **The rule.** Judged from the key alone (A1-1), a category segment `39998` agrees with `30393`, `30394` and `30397`,
  and so with `30383`, `30384` and `30387`. Every other event-kind number keeps A1-1's rule: `30393` for a
  non-addressable kind, `30394` for an addressable one. So `30397` does not cover `3039x:tag:39998`.
- **Treasure Maps leaves it open.** § 4.3 gives `30394` "an addressable event kind" and `30397` "the *DList headers*
  category (`39998`)" (`treasure-maps.md:139`, `:142`). It never says whether naming `39998` under `30397` takes it
  away from the other kinds. Content Categories, whose slot values § 4.3 uses, makes *DList headers* "one content
  category, of the event-kind type" over kinds `39998`, `9998`, `39999` and `9999`, always spelled `39998`
  (`content-categories.md:58`, `:61`). Its list-kind table gives an event-kind category `30393` when items are
  referenced by id, `30394` when by address, and `30397` when the members are lists, naming *DList headers* there
  (`:82–86`). A `9998` or `9999` header has only an id, a `39998` or `39999` header has an address, and any header can
  be a list. So the category can yield all three kinds.
- **Why all three.** It is A1-1's rule for a DList category: agree with every kind the category can yield, since the
  key alone cannot say which. It is also the only reading that keeps A1-4's guarantee however story 3 settles § 4.3.
  `r4/k1k2.py` resolves menus under one reading and checks the entries against another reading's insights:
  - read as `30397` only, 801 of 6,171 duty-answered keys get an unlisted wrong relay when `30394` also takes
    `39998`, and 1,050 of 5,713 when `30393` does too;
  - read as `30394` and `30397`, 419 of 6,171 fail when `30393` does too;
  - read as all three, none fail against either narrower reading (0 of 6,274, and 0 of 6,710).
- **The kick-back's example.** Menu `3039x` → R0, `30397` → R1; K = `3039x:tag:39998`. Under A1-9 the answering row is
  `3039x`, the entry is `[3039x:tag:39998, A, R0]`, and `30397` → R1 is a differing row, with meet `30397:tag:39998`.
  Read as `30397` only, the entry would be R1, with no row listed. If `30394` does take `39998`, the
  `30394:tag:39998:⟨T⟩` lists would then get R1 from the Map while the menu gives them R0, and nothing would say so.
- **A1-2 and A1-4 still hold.** In `r4/k1k2.py`, under each reading of `39998` and of A1-10, no two keys that share an
  insight tie (checked over every pair of the model's keys), and the answering row is the same for every insight
  under K. The guarantee, the insisted-key check and the several-keys check fail 0 times (40,000 menus per pair of
  readings).
- **The cost.** If story 3 settles that `39998` agrees with `30397` alone, a key with a family or `*` kind slot and
  category `39998` fares worse under A1-9 than under that reading, in two ways:
  - The client lists a `30397` row as differing where that row answers all of K, and offers meets such as
    `30393:tag:39998` that match nothing.
  - A menu that offers all of K, read narrowly, can leave K not offered as a whole. Three menus, each giving the entry
    R1 when read narrowly:
    - `30397` → R1 alone, and K = `3039x:tag:39998`. No row covers K, since none matches its `30393` and `30394` lists;
    - `30397:tag` → R1 and `30393` → R0, and K = `3039x:tag:39998:⟨T⟩`;
    - `not-offered 3039x`, `30397` → R1 and `30394` → R2, and K = `3039x:tag:39998`.
  - Under A1-9 the client then warns, and writes no entry unless the observer keeps K for A. The insisted relay is R1
    in the first case and the empty string in the other two. The observer can still choose the meet with the `30397`
    row (`30397:tag:39998`, or `30397:tag:39998:⟨T⟩`), which resolves to R1 (`r4/sk/sk_k1simple.py`).
  - Of 40,000 sampled family or `*` keys with category `39998`, 3,193 go from offered (read narrowly) to not offered
    as a whole (A1-9), and 439 of those get the empty insisted relay. None gets a wrong relay that is not empty, so
    A1-4's weaker guarantee holds (`r4/sk/sk_k1cost.py`).
- **Why A1-9 stays.** Its costs show: a warning, a listed row, an empty relay. The narrower readings' cost is silent:
  the unlisted wrong relays above. The owner weighs both. Such keys are rare. The editor adds only bare family entries
  (`FAMILY`, `ui/src/pages/treasure-map/editTreasureMap.js:23`), and Treasure Maps' own category-`39998` keys name
  `30397` or `30387` exactly (§ 8, § 10.10). Nothing reads menus yet, so no entry is written meanwhile.
- **Until story 3.** The spec reads `39998` this way, and says so in § 6.2 step 1 and in a new § 14 question. Story 3
  settles § 4.3 in Treasure Maps, and the spec follows it.
- **Not taken:**
  - *`30397` and `30387` only.* It reads § 4.3's `30397` bullet as a mapping, and matches § 10.10's examples. But it
    breaks A1-4's guarantee if story 3 settles any wider reading, and it leaves out Content Categories' rule.
  - *`30394`, `30397` and their Score kinds.* The literal § 4.3 reading, since `39998` is an addressable kind number.
    It breaks the guarantee if story 3 counts `9998` and `9999` headers, as Content Categories does.
  - *Ignoring rows with category `39998` under a family or `*` kind slot*, as A1-8 ignores `39998:`. That settles rows
    only. `3039x:tag:39998` is also a Map key an observer may choose, and its insights still need one reading.

**A1-10 — In a `30392` or `30382` key, an empty category is the Profiles category.** *(Qualifies: A1-1's "an empty
segment means any category (§ 4.4), not the Profiles type" and its example of an empty segment in any position;
A1-3's "the meet is always defined, and it is a § 4.7 key"; A1-4's "A new key within K"; spec § 6.2 steps 1, 4 and
5.)*
- **The rule.** After trimming (sub-decision 3; spec § 5.3), an empty category segment in a `tag` or `pin` key whose
  kind slot is `30392` or `30382` is the Profiles category, not "any". It matches only insights whose category is
  Profiles. So `30392:tag::⟨T⟩` is exact, and does not cover `30392:tag:⟨D⟩:⟨T⟩`.
  - An omitted category means any category. So does an empty one in every other key: a family or `*` kind slot, any
    other kind, or the `dlist` system, whose slot names a DList. For family and `*` keys that is the per-key reading
    (below), which Treasure Maps neither states nor rules out.
  - A trailing empty category is trimmed, so `30392:tag::` is `30392:tag`.
  - Where A1-1's words say otherwise, A1-10 governs.
- **Why: the spec defers to Treasure Maps.** A menu row is a Treasure Maps key (spec § 5.1), and the entry a client
  writes is read by Treasure Maps § 6. Treasure Maps reads `30392:tag::⟨T⟩` as exact in four places:
  - § 4.4's last bullet: "For profiles the category slot is always empty and doesn't count" (`treasure-maps.md:158`);
  - the § 6 table, whose "Its exact key" column gives `30392:tag::⟨Podcaster⟩` (`:263`);
  - § 10.5, whose row for it lacks the "except where this Map says otherwise" that ends every scope key (`:321`,
    `:376`);
  - § 13 question 2: "an empty category is always a scope (except for profiles)" (`:521`).

  Content Categories spells the Profiles category's slot value "empty" (`content-categories.md:70`). A1-1's "not the
  Profiles type" was written against family keys such as `3039x:tag::⟨T⟩`: revision 2's check
  (`model/skeptic4_type.py`) set aside reading an empty category as the Profiles type in every key. It did not
  consider the profile kinds.
- **Family and `*` keys: Treasure Maps does not say.** § 4.4's profiles bullet does not say whether it reaches a key
  whose kind slot is a family or `*`. Its general rule makes an empty segment "any" (`:155`), and its middle-segment
  example, `30396:tag::⟨Vegan⟩` (`:156`), names an exact kind that is not a profile kind. Two readings fit its words:
  - *per key*, A1-10's: the carve-out holds only where the key's own kind slot is `30392` or `30382`. So
    `3039x:tag::⟨T⟩` matches T's profile lists in every category, `30392:tag:⟨D⟩:⟨T⟩` included;
  - *per insight*: an empty category in any key matches only the Profiles category among profile-kind insights. So
    `3039x:tag::⟨T⟩` matches T's lists in every category for the other kinds, but only the Profiles list of `30392`.
- **Why per key.** A key then has one meaning, decided from its own segments, as A1-1 judges agreement from the key
  alone. And a meet never reaches outside K:
  - Read per insight, a meet can. With K = `3039x:tag::⟨T⟩` and a row `3039x:tag:⟨D⟩`, the meet `3039x:tag:⟨D⟩:⟨T⟩`
    matches `30392:tag:⟨D⟩:⟨T⟩`, a list K does not match (`r4/k2_variants.py`). An observer who chose that meet would
    take an insight outside K without being told.
  - Read per key, a meet can only fall short, which the client sees and says (below).
  - In `r4/sk/sk_b2checks.py` (40,000 menus each), per-insight meets reach outside the two keys' shared insights in
    311 menus, and per-key meets fall short in 60. Both readings keep A1-2 (no tie between keys that share an insight,
    checked over every pair; a stable answering row) and A1-4's guarantee, with 0 failures each.
  - Neither reading is safe against the other. In `r4/sk/sk_b2cross.py`, resolving per key where the Map is read per
    insight leaves an unlisted wrong relay for 918 of 11,786 duty-answered keys, and the reverse for 624 of 10,933.
    With menu `3039x` → R0, `3039x:tag::⟨T⟩` → R1 and K = `3039x:tag:⟨D⟩:⟨T⟩`, the entry is R1 per key, with no
    differing row; per insight it is R0, with `3039x:tag::⟨T⟩` as a differing row.
  - Story 3 settles this with the rest of § 4.4's profiles bullet (below).
- **Why not keep "any".** The same key would mean one thing in a menu and another in the Map, and A1-4's promises
  would fail in the Map's own reading.
  - The kick-back's example: menu `30392` → R0, `30392:tag::⟨T⟩` → R1; K = `30392:tag:⟨D⟩:⟨T⟩`. Read as "any", the
    answering row is `30392:tag::⟨T⟩`, and the entry R1. Under A1-10 it is `30392`, and the entry R0. A publisher who
    wrote that menu from Treasure Maps offers D's T list at R0.
  - A meet such as `30392:tag::⟨T⟩`, offered under "any" for T's lists in every category, would give only the
    Profiles list its relay once it is in the Map.
  - Neither reading is safe against the other, so the spec takes the one Treasure Maps writes. In `r4/k1k2.py`,
    resolving with "any" where the menu and the Map mean the carve-out leaves an unlisted wrong relay for 3 of 6,953
    duty-answered keys (the example first), and the reverse for 50.
- **Some meets have no key.** Treasure Maps has no key for a named Tag, Pin or metric in every category of a profile
  kind. So when a meet would be a `30392` or `30382` `tag` or `pin` key with an empty category, and neither K nor the
  row has the Profiles category, its spelling means the Profiles category only, while the insights both keys match
  span every category. Then:
  - A1-3: the meet is a § 4.7 key except in this case and A1-8's Concept case. A meet that has a key still beats K,
    and, resolved afresh, its answering row is still the row.
  - A1-4's listing: the client still lists the row, its part and its answer, and describes the part ("Tag-based lists
    of profiles tagged T, in every category") in place of a key.
  - A1-4's new key: the client offers the row's own key when it beats K (§ 6), with A1-4's note that it may reach
    outside K. Otherwise it says that Treasure Maps has no key for the part as a whole. The observer may still choose
    keys for some of its categories, such as `30392:tag::⟨T⟩` for the Profiles category, each resolved afresh.
  - Examples. K = `3039x:tag::⟨T⟩`, with menu `3039x` → R0, `30392` → R1: the differing row `30392` takes T's profile
    lists in every category; the meet has no key; `30392` beats K and may be chosen, though it also takes `30392`
    lists outside K. K = `30392:tag`, with menu `3039x` → R0, `3039x:tag::⟨T⟩` → R1: the part is again T's profile
    lists in every category, K beats the row's key, and no one key gives the part its relay.
- **The model.** `r4/k1k2.py` has five Score and five List kinds; categories Profiles, `1`, `30023`, `39998` and two
  DLists; `tag`, `dlist` and native keys (`pin` keys share the `tag` layout, Treasure Maps § 4.3); and Concepts as
  A1-8 reads them. Under A1-10, each meet whose key misses part of the two keys' shared insights (58 to 60 per 40,000
  menus) is in the case above, and none is outside it. The row's own key beats K in 31 to 35 of them; in 25 to 29 no
  key does. A1-2's no-tie (over every pair of keys) and stable answering row, the listing by true intersections, the
  guarantee, the insisted-key check and the several-keys check all give 0, under each reading of `39998`.
- **Treasure Maps is stale here.** § 4.4's "always empty" predates § 13 question 3, which made a DList whose subject is
  `p` a category of `30392` (`:522`; § 10.5's `30392:tag:⟨Nashville Chefs⟩:⟨Vegan⟩`, `:377`). The spec reads it as
  above until story 3. Story 3 says in § 4.4 whether an empty category in a profile-kind key is the Profiles category,
  whether `30392:tag::` equals `30392:tag`, whether a profile kind gets a key for a Tag in every category, and whether
  an empty category in a family or `*` key reaches a profile kind's DList categories, judged per key (the spec's
  reading meanwhile) or per insight. A new § 14 question records it.
- **Not taken:**
  - *Keep "any", and name the conflict in § 14* (the kick-back's option (a)). The spec would have one reading, but the
    menu and the Map would read the same key two ways, and the meet's promise would fail in the Map.
  - *The carve-out judged per insight*, in family and `*` keys too. Its meets can reach outside K, in about five times
    as many menus as per-key meets fall short, and a key's meaning would vary with the insight it is read against
    (above).
  - *A trailing empty category as the Profiles category too*, so that `30392:tag::` would differ from `30392:tag`. It
    conflicts with the spec's trimming and with § 4.4's "`30396:tag` and `30396:tag::` both mean" the same.

**A1-11 — Alternates on a new key are the observer's choice.** *(Supersedes: A1-4's Backups bullet; the earlier
A1-11 text (commit cf2085d1); spec § 6.2 step 5's Alternates bullet.)*
- **The rule.** A less specific key is never a fallback for a more specific one (Treasure Maps § 7,
  `treasure-maps.md:282`). So when the observer chooses a new key within K, the client SHOULD show which providers the
  new key will have, and say that K's other providers do not back it up unless they are listed on it. It MAY offer to
  add them. Which providers the new key has, and in what order, is the observer's choice. The spec sets no default.
  *("Unless they are listed on it" was added after approval; see "After approval", under revision 4.)*
  - Example: K = `3039x` → [B, A], and the observer chooses for A the meet of one of A's differing rows. The client
    shows that the meet will have A alone, and that B does not back it up there. The observer may add B, before A or
    after it, or leave it off.
- **Why.**
  - The order of a key's providers is the observer's: the first is Preferred, the rest are Alternates, in order
    (Treasure Maps § 7, `:279`).
  - Every reader reads the saved Map alone, by Treasure Maps § 6 and § 7, whatever a client suggested. So two clients
    that suggest different providers, or a different order, are no interoperability defect, and the spec need not
    prescribe what a client suggests.
  - What a client must not leave unsaid is the gap: an observer may assume that K's other providers still back up the
    new key's insights. They do not, unless the observer lists them on the new key.
- **Set aside:** the earlier rules that carried K's providers onto the new key. A1-4's Backups bullet carried them in
  K's order. The earlier A1-11 then placed the chosen Assistant among them, found the new key's **holders** (the Map
  entries it takes insights from), carried from one holder only, built nested meets from the Map before the new key,
  and gave steps for a provider that partly offers it. Each made a client's suggestion normative. Each revision raised
  new cases, and after two revisions two blocking findings were still open.

**A1-12 — A replaced menu does not survive where readers look first.** *(Qualifies: A1-6, A1-7, and sub-decision 8's
reader order; spec § 8.1, § 11 and § 12.)*
- **Publishers.** A key SHOULD send each new version of its menu, the empty menu included, to every relay that a `duty`
  row of an earlier version named, as well as where A1-7 says. A deletion that accompanies a withdrawal (A1-6) SHOULD
  go wherever the empty menu goes.
  - Why those relays: entries built from an earlier version carry its relays as element 3 (A1-7), and § 8.1 step 1
    looks there first. The key's and Nous' former write relays are no § 8.1 place, so the rule leaves them out.
  - A publisher may drop a relay it knows is gone.
  - A publisher that no longer knows its earlier versions' relays, such as a key moved to new software, sends to those
    it can still find, and relies on the reader rule for the rest. It may not be able to read them back: a relay need
    keep only the latest version at the address (NIP-01).
- **Readers.** A reader SHOULD ask every relay in all three § 8.1 places, and use the latest version among the answers:
  the latest `created_at`, and on a tie the lowest id (NIP-01, `01.md:99–101` in `nostr-protocol/nips`).
  - The relays are every relay hint in hand for the key (step 1), every write relay in the key's kind 10002 (step 2),
    and every write relay in Nous' kind 10002 (step 3).
  - A relay that does not answer within the reader's own timeout is skipped. If none answers, no menu is found.
  - The order of § 8.1's list says where to look first, not where to stop.
  - A reader may ask fewer relays, to save queries or to keep Nous' relays from seeing its lookups (§ 12). It may then
    get an older version.
  - If the latest version is not a menu by § 6.1, the key has none, as on a relay, which keeps only the latest version
    at the address.
- **The reader's cost.** Two kind 10002 lookups, the key's and Nous', then the hint relays, the key's write relays and
  Nous' write relays. With one hint and NIP-65's "2-4 relays of each category" (`65.md:39`), that is 5 to 9 relays per
  key, where a reader that stopped at the first menu asked one. Nous' kind 10002 is the same for every key and can be
  cached, and step 3 can ask for many keys in one REQ, with `authors` listing them. Every lookup now reaches Nous'
  write relays, which § 12 notes.
- **Why both.** The publisher rule replaces the old copy at the hints in entries built from the key's own menu. The
  reader rule makes a stale copy harmless whenever A's or Nous' write relays answer, even for a publisher that skips
  the SHOULD. `r4/k4_stale.py` models a withdrawal, a withdrawal with a deletion, a moved relay, two moves and then a
  withdrawal, and a hint at a middle relay, each with places 2 and 3 reachable and unreachable. Its hints are relays
  that earlier `duty` rows named:
  - With A1-7 alone, a reader that stops at the first menu reads the stale offers in every case. A reader that keeps
    the newest reads the right menu only while places 2 and 3 answer.
  - Adding the replaced version's `duty`-row relays (the kick-back's option 1, as worded) covers one move but not two.
    After `wss://scores.example` → `scores2` → `scores3` → withdrawal, the first relay keeps the `scores2` version,
    and a reader that holds it and stops there writes `["30382:rank", "<A>", "wss://scores2.example"]`.
  - With every relay an earlier version went to, either reader is right in every case, places 2 and 3 down included.
    So is it with every relay that an earlier version's `duty` rows named, the narrower set above (`r5/k4_p3.py`).
  - A relay that applies only a deletion's `e` (Context: dcosl) still gets the empty menu, which replaces the old one.
- **Other hints.** The publisher rule does not reach a hint that is not taken from the key's own menu: a `storefront`
  link's relay, or element 3 of an entry not built from the menu, such as a hand-written entry or one filled before the
  menu was found. The key may never have sent there, and a copy that reached such a relay by `#z` sync stays stale.
  There only the reader rule protects a reader. One that stops at the first menu can still read the stale copy
  (`r4/skK4lens/k4_skeptic_b.py`).
- **Why every relay, and place 3 always.**
  - A relay of a place may have missed the newest version. With 20% of sends failing, a reader that asks one relay per
    place is wrong in 6 to 21 of 2,000 trials per scenario, and one that asks every relay in 0 or 1 (`r5/k4_p3.py`, on
    `r4/skK4lens/k4_skeptic.py`'s model).
  - A key may publish no kind 10002. A stale copy at a hint the publisher did not update (other hints, above, or a
    skipped SHOULD) then answers place 1, and only place 3 holds the newest version. A reader that asks place 3 only
    when places 1 and 2 find nothing reads the stale copy in each such scenario (`r5/k4_p3.py`). With 20% of sends
    failing, it is wrong in 10 to 15 of 2,000.
- **What the reader then writes.** After `3038x` → `wss://scores.example` is withdrawn, the menu gives K =
  `30382:rank` no relay. There is no entry, unless the observer keeps K for A, when the insisted-key entry is
  `["30382:rank", "<A>", ""]` (A1-4). An old relay keeps a stale copy only if it is not also one of A's or Nous' kind
  10002 write relays.
- **No new wire surface.** Both rules say where events go and which copy counts. NIP-09 already asks clients to
  "broadcast deletion request events to other relays which don't have it" (`09.md:33`).
- **Not taken:**
  - *The reader rule alone* (the kick-back's option 2). It fails when only the hint answers, and it leaves stale copies
    for readers that follow no such rule.
  - *The publisher rule alone.* A publisher that skips the SHOULD, or a relay that missed the update, leaves a reader
    that stops at the first menu wrong.
  - *The replaced version's `duty`-row relays only*, the kick-back's option 1 as worded: one move back only (above).
  - *Every relay an earlier version went to* (revision 3's text). It adds the key's and Nous' former write relays, which
    are no § 8.1 place, and it needs a log of past sends that a publisher may have lost.
  - *Place 3 only when places 1 and 2 find nothing.* It saves queries and keeps more lookups from Nous' relays, but it
    reads a stale hint copy for a key with no kind 10002 (above).
  - *Checking only step 2 after a step-1 hit.* A key may publish no kind 10002, and then step 3 holds the newest copy.

### Consequences of A1

- **The Map stays the observer's.** A client writes only the entries the observer chose, so a menu cannot move insights
  away from another Assistant. A new key's providers, and their order, are the observer's choice too (A1-11).
- **Insights in a differing row's part get their relay at read time.** Until story 3's read-time resolution exists, a
  reader that follows the Map alone looks for them at K's relay, and may not find them there. Meanwhile the observer can
  choose a differing row's meet as a key. That gives the row's part its relay, unless another entry beats the meet.
- **No empty relay for an offered key.** An entry for a key the menu offers carries its answering row's relay. That
  closes OPEN.md row `2026-10-10-external-assistant-relay-left-empty` for offered keys wherever a menu is found, in the
  later code book. An insisted key carries its offering rows' shared relay or the empty string. A key whose menu is not
  found stays with the handoff's § 6 steps 3–4 and story 3.
- **The handoff's § 6 fill order**, for a key whose menu is found. Step 1 (the self-entry) is story 3's and stays first.
  A1-4 replaces steps 2–4: the answering row's relay; for an insisted key, the offering rows' shared relay, or else the
  empty string with the warning. Step 3's same-category relay is not used.
- **The owner's "or none".** The approved proposal writes no entry when the answering row is not a `duty` row. A1-4
  keeps that as the default, and adds the insisted-key entry that sub-decision 10 requires when the observer keeps K.
  The owner confirmed this reading at the gate, 2026-10-11.
- **A1-8 takes a side on an open owner question.** It reads a bare `39998` as § 4.5's words and the card rule do, gives
  a bare `39999` a meaning, and orders the two. Ledger row `2026-10-09-draft-grammar-bare-39999` asks the owner to
  decide these. The owner confirmed A1-8 as the reading until story 3 (gate, 2026-10-11), which settles it in Treasure
  Maps.
- **Withdrawal with a deletion needs two timestamps in order.**
- **Category `39998` is read broadly until story 3 (A1-9).** Under a family or `*` kind slot it may list `30393`,
  `30394` and `30397` rows as differing. If Treasure Maps settles a narrower reading, a key that a `30397` or `30387`
  row offers whole, read narrowly, can be reported as not offered as a whole: the client warns, writes no entry unless
  the observer keeps the key, and may then write the empty relay. The observer can choose the meet instead. If story 3
  narrows Treasure Maps § 4.3, the spec narrows with it.
- **Menus and Maps read a profile key alike (A1-10).** `30392:tag::⟨T⟩` is exact in both. Some parts of K then have no
  key of their own: a Tag, Pin or metric in every category of a profile kind. The client lists them and says so. Unless
  the row's own key beats K, only keys for some of their categories, or read-time resolution (story 3), give such a
  part its relay.
- **A new key's Alternates are the observer's choice (A1-11).** The client shows which providers a new key within K
  will have, says that K's other providers do not back it up unless they are listed on it, and may offer to add them.
  The spec sets no default, so clients may suggest differently; every reader reads the saved Map alike.
- **Readers ask every relay in all three places (A1-12):** 5 to 9 relays per key with one hint, and every lookup
  reaches Nous' write relays (§ 12). Publishers keep sending each menu to every relay that an earlier version's `duty`
  rows named, and may drop a relay they know is gone.
- **Story 3 carries forward two more Treasure Maps questions:** § 4.3 for category `39998` (A1-9), and § 4.4's
  profiles bullet, family and `*` keys included (A1-10).
- **No new wire surface. Firmware reinstall required? No.** No concept definition changes. A1-9 to A1-12 add no
  tag, kind or field either.

### Implementation notes for round 3

Docs-mode. AC6 holds: inside `protocols/`, round 3 may change only `drafts/duty-menus.md`, `README.md` and
`worksheet.md`. A1 needs no change to the last two.

**`protocols/drafts/duty-menus.md`:**
- **§ 5.3** (:118): A1-8. Rows keyed `39998:` or `39999:` are ignored until Treasure Maps settles their reading, and
  the writers' SHOULD.
- **§ 6.2 step 1** (:157): A1-1. State the rule by matching, citing Treasure Maps §§ 4.2–4.5: every insight in
  principle, not only supported sets. § 4.3 agreement is judged from the key alone, from the category segment's own
  value (A1-1's list): an empty segment means any category, and a DList category agrees with every kind a DList can
  yield. No header or item is fetched. Examples: the bare `*`; an empty middle segment in a Score
  or List key; a row that covers through § 4.3; A1-8's reading of the bare Concept kinds, and its order. Say "no
  `*:<scope>` key covers a Concept key", not only `*:tag` and `*:dlist`.
- **§ 6.2 step 2** (:158): keep it. Add that the same row answers for every insight under K (A1-2).
- **§ 6.2 step 4** (:160–164): A1-3. Define rows within K, the meet, a row's part, and differing rows. Remove the two
  options and "Where no row covers K, the client writes only the entries for the parts that are offered". Keep the
  `*:tag` example, as an overlapping row within K. Say "differing row", never "exception", for this.
- **§ 6.2 step 5** (:165): A1-4. One entry per chosen key; menus supply relays, never keys; every row within K listed
  with its meet; the meet offered for each differing row, and why the row's own key may not do (in A1-4's words: K
  beats it by § 6, at the kind slot or at a later segment); the Backup offer (since replaced by A1-11, below); the
  guarantee in A1-4's words, no stronger; the insisted key's relay.
  - Write "read-time resolution, which Treasure Maps does not yet define". Do not cite Treasure Maps § 3 for a fallback
    it does not have (`treasure-maps.md:77`), and do not name a story, which a spec can't cite (review round 1,
    Deviation 3).
- **§ 8.1** (:188): A1-7's publisher sentence.
- **§ 11** (:216): A1-6. The deletion's `created_at` is strictly earlier than the empty menu's; timestamps decide, not
  order; NIP-09's `a` rule is the reason; the `e` tags never name an empty menu, old or new. Keep the `a`, `e` and `k`
  rules and the reason for the `e` rule.
- **§ 13.3** (:278): A1-5's `3039x` row. No other row changes.
- **§ 14**: add two open questions. (1) Read-time resolution: where a reader looks for an insight in a differing row's
  part, or under an entry with an empty relay. (2) The two Concept readings of A1-8 and its order, and that the spec
  reads them as A1-8 says meanwhile.
- The vocabulary gate still applies: no "canonical" or "consensus" in normative text, and no "root".

**The story's Deviations** (`stories/duty-menus-and-self-maps/2-duty-menus-pre-nip.md`):
- The round-2 bullet "§ 6.2 resolution, generalized …": its detection part stands as A1-3. Its intersection key is
  withdrawn as an entry the client writes. It survives as the meet, a key the client offers (A1-4).
- Move "Nous' relays are found through Nous' kind 10002" out of "Smaller fixes from round 1". Log it as its own
  deviation, added in round 2 and ratified by A1-7.
- The round-1 bullet on a narrower `not-offered` row is now A1-4's listing of rows within K. Say so.
- Add a round-3 block: B3 (A1-1, A1-8), B4 (A1-3 to A1-5), the deletion's timestamp (A1-6), NB10 (A1-7), NB11 (A1-8).

**The epic's story-3 carry-forwards** (`epics/duty-menus-and-self-maps.md:20–23`):
- Replace the first bullet. Treasure Maps § 3's read-time relay fallback must cover:
  - an insight in a differing row's part (A1-3). The Map entry that wins it carries a relay that is reachable but wrong
    for it. So the fallback must not fire only when element 3 is "empty or unreachable" (handoff § 5, `:134`). When an
    insight is not found at element 3, a reader re-resolves it against A's current self-Map and Duty Menu;
  - an insisted key with the empty string (A1-4);
  - a key whose Assistant has no menu found, which A1 leaves to the handoff's § 6 steps 3–4;
  - A's kind 10002 write relays, D3's fallback locator, as a last resort at read time.
- Add: settle A1-8's two Concept readings (`39998:` and `39999:`; what a bare `39998` and a bare `39999` cover) and the
  order of `39998` and `39999` keys in Treasure Maps § 6, and say how `duty-menus.md` § 5.3 and § 6.2 follow. This is
  the owner's decision in ledger row `2026-10-09-draft-grammar-bare-39999`.

**For A1-9 to A1-12**, as the owner approved them, 2026-10-11 (A1-11 in its revision 4 form, with the words added
after approval; see "After approval", under revision 4). AC6 still holds: inside `protocols/`, only
`drafts/duty-menus.md` changes.

`protocols/drafts/duty-menus.md`:
- **§ 6.2 step 1** (:161–179):
  - The lead's "Where it leaves the Concept kinds open, this spec reads them as below" covers every question the spec
    reads ahead of Treasure Maps: the Concept kinds, category `39998` and the profiles category slot (open questions 5
    to 7 below).
  - The event-kind bullet (:163): A1-9. Category `39998` (*DList headers*) agrees with `30393`, `30394` and `30397`,
    and their Score kinds `30383`, `30384` and `30387`, because its headers may be of four kinds, referenced by id, by
    address or as lists (Content Categories § 1.3 and § 2). Point to open question 6.
  - The empty-segment bullet (:165): A1-10. An empty category means any category, not the Profiles type, except in a
    `tag` or `pin` key whose kind slot is `30392` or `30382`. There, after § 5.3's trimming, it is the Profiles
    category, so `30392:tag::⟨T⟩` is exact (Treasure Maps § 4.4). An omitted category means any. In a family or `*`
    key an empty category means any, a profile kind's DList categories included. Point to open question 7.
  - The example at :171 gains the exception: `30392:tag::⟨T⟩` does not cover `30392:tag:⟨D⟩:⟨T⟩`.
- **§ 6.2 step 4** (:184): the meet's exception gains A1-10's case, with a one-sentence reason: a `30392` or `30382`
  `tag` or `pin` meet with an empty category, from two keys neither of which has the Profiles category, has no key.
- **§ 6.2 step 5:**
  - "Every row within K is listed" (:196): where the meet has no key, the client describes the part.
  - "A new key within K" (:201–208): A1-10's case. The client offers the row's own key when it beats K, and otherwise
    says that Treasure Maps has no key for the part as a whole; the observer may still choose keys for some of its
    categories. Use A1-10's two examples.
  - "Alternates" (:209): A1-11. Keep its first sentence. Replace the rest with: "So when the observer chooses a new
    key within K, the client SHOULD show which providers the new key will have, and say that K's other providers do
    not back it up unless they are listed on it. It MAY offer to add them. Which providers the new key has, and in what
    order, is the observer's choice; this spec sets no default." Drop the offer to bring K's providers over in K's
    order, and the sentence for a declined offer. The bullet needs no example.
- **§ 8.1** (:234–240): A1-12.
  - "Look, in order:" becomes: ask every relay in all three places (every hint in hand for the key, every write relay
    in the key's kind 10002, every write relay in Nous' kind 10002), and use the latest version among the answers (the
    latest `created_at`, and on a tie the lowest id, as NIP-01 keeps). A relay that does not answer within the
    reader's timeout is skipped. The order says where to look first, not where to stop. A reader may ask fewer relays,
    and may then get an older version. If the latest version is not a menu (§ 6.1), the key has none.
  - One sentence gives the cost: two kind 10002 lookups, then 5 to 9 relays with one hint and NIP-65's 2–4 per list.
    Nous' kind 10002 can be cached, and step 3 can ask for many keys in one REQ.
  - The publisher sentence adds "and to every relay that a `duty` row of an earlier version named", with its reason:
    entries built from an earlier version carry its relays, and readers look there first. A publisher may drop a relay
    it knows is gone. One that no longer knows those relays sends to those it can still find.
  - Say that a hint not taken from the key's own menu, such as a `storefront` link's relay, may hold a stale copy that
    only the reader rule guards against.
- **§ 11** (:265–272): "Publish the menu where § 8.1 says" now includes those relays. A deletion goes wherever the
  empty menu it accompanies goes.
- **§ 12:** a new bullet, **Lookups**. Every lookup asks Nous' write relays (§ 8.1), so their operators can see which
  keys a client looks up, and when. A reader may skip them, to keep its lookups private or to save queries, at the
  risk of an older version. § 8.1 gives the cost of asking them all.
- **§ 14:** add two questions.
  - (6) Category `39998`: which List and Score kinds take the *DList headers* category. This spec reads `30393`,
    `30394` and `30397` meanwhile (§ 6.2 step 1).
  - (7) The profiles category slot: Treasure Maps § 4.4's "always empty" predates its § 13 question 3. Is an empty
    category in a `30392` or `30382` key the Profiles category? Does `30392:tag::` equal `30392:tag`? Does a profile
    kind get a key for a Tag in every category? Does an empty category in a family or `*` key reach a profile kind's
    DList categories, judged per key or per insight? This spec reads A1-10's carve-out, per key, meanwhile.
- The spec names no story, ADR or deployment, and the vocabulary gate applies.

**The story's Deviations:** a block after "Fix pass 3", headed "Fix pass 4 (owner gate, 2026-10-11)":
- the four questions kicked back in fix passes 1 to 3, each answered:
  - category `39998` → A1-9: it agrees with `30393`, `30394` and `30397`, so Fix pass 2's example gives R0, with
    `30397` → R1 as a differing row;
  - the profiles category slot → A1-10: `30392:tag::⟨T⟩` is exact, so Fix pass 2's example gives R0;
  - where A goes on a new key → A1-11: neither answer is prescribed. The observer chooses the new key's providers and
    their order, and the client shows them and says that K's other providers do not back the new key up unless they
    are listed on it;
  - the stale menu → A1-12: both of Fix pass 3's options, widened. Publishers send each version to every relay an
    earlier version's `duty` rows named, and readers ask all three § 8.1 places and keep the latest version;
- what each changed in the spec: § 6.2 steps 1, 4 and 5; § 8.1; § 11; § 12's Lookups bullet; § 14's questions 6 and 7;
- the Fix pass 3 example, tightened on two points. The newest-copy reader writes `["30382:rank", "<A>", ""]` only if
  the observer keeps K for A (the insisted key); otherwise it writes no entry. And the old relay keeps the stale copy
  only when it is not also one of A's or Nous' kind 10002 write relays;
- Fix pass 2's last bullet, settled: A1-9 and A1-10 add § 14's questions 6 and 7 and two story-3 carry-forwards.
  A1-11 and A1-12 add neither;
- Fix pass 2's note that A1's model has no `30394`, no `30397` and no category `39998`, and reads an empty profiles
  category as "any": A1-9 and A1-10 were checked on a model that has all of these (ADR 0002, A1-10's "The model").

Round 3's judgment call on A1-4's "Backup" offer also gets an inline "*Fix pass 4:*" note: A1-11 replaced the offer.
Step 5's Alternates bullet keeps Treasure Maps § 7's words. It no longer has the client offer to carry K's providers
onto the new key in K's order; the client MAY offer to add them, and the observer chooses which, and in what order.

**The epic's story-3 carry-forwards** (`epics/duty-menus-and-self-maps.md:20–28`): A1-11 and A1-12 add none. A1-9 and
A1-10 add two bullets, after the last (:28):
- settle which List and Score kinds take the *DList headers* category (`39998`) in Treasure Maps § 4.3, in line with
  Content Categories § 1.3 and § 2, and say how `duty-menus.md` § 6.2 step 1 follows (A1-9; the spec reads `30393`,
  `30394` and `30397` meanwhile);
- restate Treasure Maps § 4.4's profiles bullet in the light of § 13 question 3: whether an empty category in a
  `30392` or `30382` key is the Profiles category, whether `30392:tag::` equals `30392:tag`, whether a profile kind
  gets a key for a Tag in every category, and whether an empty category in a family or `*` key reaches a profile
  kind's DList categories (per key, as the spec reads it meanwhile, or per insight); and say how `duty-menus.md` § 6.2
  follows (A1-10).

**This ADR:** done at the owner's gate, 2026-10-11. The status line is "**Status:** Accepted; amended by A1
(2026-10-11)", and the approval of A1-9 to A1-12 is recorded after the Revision 3 paragraph (revision 4).

**Gates:** as in Implementation notes above, except the scope line: `git diff --stat` touches, inside `protocols/`, only
`drafts/duty-menus.md`; outside it, the story and the epic.

### Verification for review round 3

- **A1-1.** Re-derive "covers" for a bare `*` (Concept keys included), `30396:tag::⟨T⟩` against `30396:tag:⟨D⟩:⟨T⟩`, a
  family wildcard, `30393` against `3039x:tag:1` (§ 4.3), and A1-8's bare Concept kinds. Check that no `*:<scope>` key
  covers a Concept key, and that `30392` does not cover `3039x:tag:⟨D⟩` for a DList D (§ 4.3 from the key alone).
- **§ 13.2 against `39999`**, the entry the editor adds on every Concepts assignment: the answering row is `39998`, and
  the entry is `["39999", "<A>", "wss://concepts.example"]` (A1-8).
- **Review cases A–D** (review :256–259), under A1:
  - **A.** Menu `*` → R0, `*:tag` → R1; K = `3039x`. The answering row is `*`; the entry is `[3039x, A, R0]`. The
    differing row is `*:tag` → R1, with meet `3039x:tag`, which resolves to `*:tag` → R1.
  - **B.** Menu `3039x` → R0, `3039x:tag:⟨D⟩` → R2; K = `30396:tag`. The entry is R0. The differing row is
    `3039x:tag:⟨D⟩` → R2, with meet `30396:tag:⟨D⟩`.
  - **C.** Menu `3039x` → R0, `30396:tag::⟨T⟩` → R1, `3039x:tag:⟨D⟩` → R2; K = `30396`. The entry is R0. The differing
    rows are `30396:tag::⟨T⟩` → R1, which takes `30396:tag:⟨D⟩:⟨T⟩`, and `3039x:tag:⟨D⟩` → R2 (meet `30396:tag:⟨D⟩`),
    for D's other Tags. Choosing `3039x:tag:⟨D⟩` changes nothing. Choosing `30396:tag:⟨D⟩` gives D's other Tags R2,
    and lists `30396:tag::⟨T⟩` as its own differing row. Choosing that row's key, `30396:tag::⟨T⟩`, changes nothing
    either; its meet, `30396:tag:⟨D⟩:⟨T⟩`, gives that list R1.
  - **D.** Menu `3039x` → R0, `3039x:tag` → R1, `30396:tag` → R0; K = `3039x`. The entry is R0. The rows within K are
    `3039x:tag` → R1, differing, for Tag-based lists of kinds other than `30396`; and `30396:tag` → R0, listed but not
    differing. Choosing `3039x:tag` gives `30396:tag:⟨D⟩:⟨T⟩` R1 in the Map, and resolving it lists `30396:tag` → R0 as
    its differing row.
  - **Nested.** Menu `3039x` → R0, `not-offered 3039x:tag`, `30396:tag` → R0; K = `3039x`. The client lists
    `30396:tag` → R0 inside `3039x:tag`.
  - **§ 4.3.** Menu `3039x` → R0, `3039x:tag:1` → R1; K = `30393`. The differing row is `3039x:tag:1`, with meet
    `30393:tag:1`. Choosing the row's own key changes nothing; choosing the meet gives the notes' Tag-based lists R1.
  - **The other-Assistant case.** Nothing is added for `3039x:tag:⟨D1⟩`, so `30392:tag:⟨D1⟩:⟨T1⟩` stays with B.
- **The model scripts**, run with `python3 -I` from the scratchpad's `arch/` and `model/` folders, if still present:
  - `arch/a1r1.py` (fuller model; 40,000 menus under each reading of `39998:`) prints 0 for `ties`, `unstable`,
    `within_covers`, `meet_set`, `meet_beats`, `meet_ans`, `listing`, `guarantee`, `insisted_bad`, `rowkey_beats`,
    `meet_fixes_bad` and `unlisted wrong`. `meet_none` is 0 under the empty-`d` reading and 13 under the "any" reading,
    all for a Map key `39998:` or `39999:` (A1-8). `arch/a1r1_cases.py` prints the named cases above.
  - `arch/a1r2.py` (revision 2) runs eight variants: A1-8's reading and revision 1's, fixed DList subjects and § 4.3
    from the key alone, and each reading of `39998:`. Each prints 0 for `ties`, `unstable`, `within_covers`,
    `meet_set`, `meet_beats`, `meet_ans`, `listing`, `guarantee`, `insisted_bad`, `rowkey_iff_bad` and
    `any_tie_shared`, and 0 duty-answered "unlisted wrong". `meet_none` is non-zero only under the "any" reading, all
    for a Map key `39998:` or `39999:`. It ends with the named cases, § 13.2 against `39999` among them.
  - `model/check.py` and `model/check2.py` check the reduced model, not Treasure Maps. `check.py`'s six mismatches come
    from its one-member `3038x`. `model/tm_ext_cases.py` reproduces the removed option's failure through § 4.3.
  - The scratchpad is not durable. If the scripts are gone, rebuild the fuller model from "How it was settled", with
    multi-kind families and § 4.3 agreement (category `1` only with `30383` and `30393`; a DList with every kind).
- **A1-4's insisted key.** The spec names the offering rows' shared relay, else the empty string, and keeps the warning.
  It names no kind 10002 relay.
- **A1-6.** § 11 states the `created_at` MUST (strictly earlier than the empty menu's), says timestamps decide and not
  order, cites NIP-09's `a` rule, says the `e` tags never name an empty menu, and keeps the `a`, `e` and `k` rules.
- **A1-7.** § 8.1's reader step 3 and its publisher sentence both name Nous' kind 10002 write relays. The publisher
  sentence also names the relays the menu's `duty` rows name.
- **A1-8.** § 5.3 ignores rows keyed `39998:` or `39999:` and carries the SHOULD. § 6.2 step 1 carries the bare-kind
  reading and the order. § 14 carries both questions. Nothing in the spec says a bare `39998` covers only `39998:<d>`.
- **§ 13.3.** Only the `3039x` row changed. The other four re-derive as in round 2.
- **Scope.** AC6, and the vocabulary gate.
- **A1-9.** § 6.2 step 1 gives category `39998` the kinds `30393`, `30394` and `30397`, with their Score kinds, cites
  Content Categories, and points to open question 6. The kick-back's example re-derives: menu `3039x` → R0, `30397` →
  R1, K = `3039x:tag:39998`; the entry is R0, and `30397` → R1 is a differing row, with meet `30397:tag:39998`.
- **A1-10.** § 6.2 step 1 carries the carve-out and its limits (`tag` and `pin` keys of `30392` and `30382`, after
  trimming; an omitted category means any). Menu `30392` → R0, `30392:tag::⟨T⟩` → R1, K = `30392:tag:⟨D⟩:⟨T⟩`: the
  answering row is `30392`, and the entry R0. Step 4 names the meet with no key, and step 5 handles it, with A1-10's
  two examples. § 14 has question 7, which also asks about family and `*` keys. Read per key, menu `3039x` → R0,
  `3039x:tag::⟨T⟩` → R1 and K = `3039x:tag:⟨D⟩:⟨T⟩` give R1, with no differing row.
- **A1-11.** Step 5's Alternates bullet keeps Treasure Maps § 7's "never a fallback". When the observer chooses a new
  key within K, the client SHOULD show the new key's providers and say that K's other providers do not back it up
  unless they are listed on it, and MAY offer to add them. The providers and their order are the observer's choice,
  with no default. Nothing else in step 5 says which providers a new key gets, or in what order.
- **A1-12.** § 8.1 asks every relay in all three places, keeps the latest version (lowest id on a tie), skips a relay
  that does not answer, allows fewer relays at the risk of an older version, and states the cost. Its publisher
  sentence adds every relay that a `duty` row of an earlier version named, with the way out and the case of a
  publisher that no longer knows them, and says that only the reader rule guards a hint not taken from the key's own
  menu. § 11 sends a deletion wherever the empty menu goes, and § 12 has the Lookups bullet. The story's Fix pass 3
  example carries both corrections.
- **The revision 3 scripts**, run with `python3 -I` from the scratchpad's `r4/` folder, if still present:
  - `k1k2.py` prints the two kick-back examples: category `39998` read as `30397` only, as `30394` and `30397`, and as
    all three gives R1, R0 and R0; the profiles slot read as "any" and as A1-10 gives R1 and R0. For each of the six
    pairs of readings it prints 0 for `ties`, `unstable`, `any_tie_shared`, `within_covers`, `meet_none`,
    `meet_wrong_outside_class`, `meet_beats`, `meet_ans`, `listing`, `guarantee`, `insisted_bad` and
    `rowkey_iff_bad`, and 0 several-keys "unlisted wrong". `meet_wrong` is 0 under "any" and 58 to 60 under A1-10.
    The cross-reading lines give 0 wherever the spec's reading of `39998` is at least as wide as the world's, non-zero
    wherever it is narrower, and non-zero both ways for the profiles slot.
  - `k2_variants.py` shows the per-insight carve-out's meet matching a list its first key does not.
  - `k4_stale.py` prints the stale-menu table. Every row for "every relay an earlier version went to" (`P2`) reads
    "ok".
  - `sk/sk_k1simple.py` and `sk/sk_k1cost.py` give A1-9's cost. `sk/sk_b2checks.py` and `sk/sk_b2cross.py` compare
    A1-10's per-key and per-insight readings. `skK4lens/k4_skeptic.py` and `skK4lens/k4_skeptic_b.py`, run from their
    own folder, model failed sends, the readers, and a stale hint the publisher never sent to.
  - From the scratchpad's `r5/` folder: `k4_p3.py` shows that the relays earlier `duty` rows named do what `P2` does,
    that a reader asking place 3 only when places 1 and 2 find nothing fails for a key with no kind 10002, and how each
    reader fares when 20% of sends fail.
  - A1-11 sets no rule that a model could check, so no script covers it.
  - The scratchpad is not durable. If the scripts are gone, rebuild them from A1-9, A1-10 and A1-12.
