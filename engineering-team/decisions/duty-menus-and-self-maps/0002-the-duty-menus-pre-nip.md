# ADR 0002: The Duty Menus pre-NIP — one self-signed item per Assistant key under Nous' header

**Status:** Accepted
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
   - If the answering row is a `duty` row, K is **offered at its relay**. If it is `not-offered`, or no row covers K, K is
     **not offered as a whole**.
   - If rows *narrower* than K give a different relay or say `not-offered`, K is **partly offered**. A client then either
     writes the narrower Map entries as well, so that the Map's own § 6 gives each insight its relay and the exceptions
     their own entries, or writes K with the answering row's relay and leaves per-insight relays to read-time resolution
     (story 3's fallback).
   - A Map entry built from a menu is `[K, <menu author>, <answering row's relay>]`.
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
   - Publishers SHOULD publish the menu to its own write relays and to the relays where Nous' header is published.
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
11. **Offered versus active.** The menu says offered; the key's own Treasure Map says active. The spec points to Treasure
    Maps § 9 and defines nothing about it (Self-Maps are story 3).
12. **Publishing and withdrawing.**
    - Change offers by republishing the one replaceable item.
    - Withdrawal SHOULD be a republished menu with no `duty` rows: it carries Nous' `z`, rides the sync and replaces older
      copies.
    - A NIP-09 deletion MAY follow that republish, and it MUST name `["a", "39999:<key>:duty-menu"]`, `["e", "<id>"]` and
      `["k", "39999"]`. That follows Assistant Designation's curation-copy removal, since some relays honour only the
      `e`.
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
- **A provider directory falls out of D9.** It fails closed and offers named per-point-of-view signals.
- **Exceptions are expressible** without overloading an empty relay.
- **Story 3 carries forward:**
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
