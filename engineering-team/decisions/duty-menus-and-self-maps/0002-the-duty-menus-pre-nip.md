# ADR 0002: The Duty Menus pre-NIP — one self-signed item per Assistant key under Nous' header

**Status:** Proposed
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
- D1 (offered vs active), D4 (Nous publishes the header, key `15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270`), D5, D7, D8 (the name), D9, D10 (a Shared Concept, adopted into dictionaries by reference);
- the story's out-of-scope answers: no bare `["z", "duty-menu"]`, and no new storefront discovery mechanism;
- the § 4 shapes, which the handoff marks "to be confirmed at ratification". This ADR confirms them, with the changes
  below.

**What the surrounding specs require:**
- **The DList NIP** (`protocols/nips/decentralized-lists.md` § "Declarations of lists and list items"):
  - a header MUST have `names` and SHOULD declare item tags with `required`/`allowed`, each tag listed individually, with an
    optional description element;
  - an item MUST carry a `z` to its header (`39998:<author>:<d>` for a kind-39998 header) and SHOULD carry the item tag
    the header requires;
  - items may carry `name` and `description`.
- **Tapestry Concepts** § "Data storage (json tag)": element data goes in a `json` tag, namespaced by concept slug.
- **Content Categories** § 5.1: a header that requires `p` has subject `p`. A DList-based list over it is a Trusted List
  of pubkeys (`30392:dlist:⟨…⟩`, `treasure-maps.md` § 10.9).
- **Treasure Maps** § 4.7 grammar and § 6 precedence (most specific wins, compared left to right). The § 9 to-do list says
  where duties come from. Self-Maps (story 3) will extend § 9.
- **Inherit-From** § "The `b` tag": Self-declaration, normative since story 1. **Shared Concepts** § "Declared
  affiliation": how a person's header affiliates with Nous'.
- **Stamping**: a deliberately published item carries a "personal `z`", its author's own parent pointer.
- **Worksheet W2**: `q` already means NIP-18 quotes on any event, plus Assistant Designation's curation copies, and "even a
  kind-scoped `#q` query can return quotes along with our copies".

**Concepts:** no definition changes. The Duty Menu concept will exist at `39998:15f7dafc…:duty-menu` once Nous publishes
it. The stack is absent, so nothing was read from a live graph.

## Options considered

### Option A — A standalone pre-NIP, `duty-menus.md`, with the handoff's § 4 shapes and three refinements

- The spec carries everything Duty-Menu-specific: the header, the item, reading rules, the two kinds of menu, finding
  menus, the provider directory, and security notes.
- It points out to the other specs rather than restating them: Treasure Maps for keys and precedence, Inherit-From and
  Shared Concepts for self-declaration and adoption, the DList NIP for item basics.

The three refinements:
1. **A multi-letter `provider` tag replaces `q`** for the per-customer → storefront link. It also marks a menu as
   per-customer even when there is no storefront (AC4's last bullet).
2. **A row with no relay means "not offered".** It wins by § 6 like any other row, so exceptions such as "all Scores
   except `30385`" can be stated.
3. **`z` and Stamping are reconciled.** The required `z` is Nous' handle, and extra `z` tags are allowed and ignored by
   readers.

Pros:
- One normative home for a new wire format, next to its siblings in `drafts/`.
- It grows independently of `treasure-maps.md`.

Cons:
- One more spec in the index.

### Option B — A new section inside `treasure-maps.md`

Pros: menus exist to fill Treasure Map entries, so the reader sees both in one place.

Cons:
- It breaks AC1 and AC6 (`duty-menus.md` and the README row).
- `treasure-maps.md` already runs to 14 sections and is story 3's file.
- A menu is a DList item, a different wire family from the 10040 grammar, so it belongs beside the DList-family drafts.

### Option C — The handoff's § 4 verbatim

Pros: no reinterpretation.

Cons:
- `q` adds a third meaning to an already overloaded letter (W2).
- A provider with no storefront would have per-customer menus that look like storefronts, which breaks AC4's last bullet.
- It cannot state exceptions.
- It is silent on how its `z` relates to Stamping's personal `z`.

## Decision

We chose **Option A**.

**Sub-decisions** (the wire shape the Implementer writes):

1. **The header**, `39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu`, signed by Nous:
   ```
   ["d", "duty-menu"]
   ["names", "duty menu", "duty menus"]
   ["description", "What one Assistant key offers to publish: Treasure Map keys and the relay for each. Offered, not active."]
   ["b", "39998:<Nous>:duty-menu", "pointer"]
   ["required", "p", "The Assistant: the item's own author"]
   ["required", "duty", "A Treasure Map key and the relay this Assistant publishes it to"]
   ["allowed", "name"]
   ["allowed", "description"]
   ["allowed", "provider", "On a per-customer menu: its provider's storefront menu, or empty"]
   ["allowed", "json", "Per-duty details, keyed by Treasure Map key"]
   ```
   - The `b` self-declares it (Inherit-From § "The `b` tag").
   - `required p` gives subject `p`.
   - A person adds Duty Menu to their dictionary by publishing their own header with a pointer-`b` to this one (Shared
     Concepts § "Declared affiliation"). Such copies keep the `required`/`allowed` declarations, so Nous publishes them
     on the header before anyone adopts it.
2. **The item.** One replaceable kind `39999` per Assistant key, signed by that key, `d` = `duty-menu`, so its address is
   `39999:<key>:duty-menu`.
   - It MUST carry `["z", "39998:<Nous>:duty-menu"]` (D9) and `["p", "<its own pubkey>"]`.
   - It MAY carry `name` and `description` (DList NIP).
   - Extra `z` tags are allowed, for example the author's own dictionary copy, so Stamping's personal `z` is satisfied
     where it applies. Readers find and read menus by Nous' handle alone.
3. **Rows.** `["duty", "<Treasure Map key>", "<relay>"]`.
   - Element 2 is a key in the `treasure-maps.md` § 4.7 grammar; a row whose element 2 does not parse is ignored.
   - Element 3 is one relay URL.
   - A row with no element 3, or an empty one, means **not offered**.
   - Elements after 3 are reserved and ignored.
   - At most one row per key: on duplicates, the first row wins.
   - A row says *offered*: "this key will publish insights under this key, at this relay, if a Treasure Map assigns them
     to it." It never says *active*, and it creates no duty.
4. **Authority.** A reader uses an item as a Duty Menu only when its author equals its `p`. It ignores items under the
   header whose `p` names another key, and it uses no third party's rows.
5. **Resolution.** For a duty (an exact Treasure Map key), the answering row is the one whose key wins under
   `treasure-maps.md` § 6 among the menu's row keys. No winning row, or a winning row with no relay, means not offered. A
   row turns into a Map entry as `[key, <menu author>, relay]`, with the key narrowed to the duty when the duty is
   narrower.
6. **Details.** At most one `["json", "{\"duty-menu\": {\"<Treasure Map key>\": {…}}}"]`, namespaced by the concept
   slug.
   - Defined fields: `description` (text), `interval` (an ISO 8601 duration, the expected update cadence), and
     `algorithm` (a name, such as the `d` of a `score-algorithm` item where one exists).
   - A menu carries no price and no tier (D5). Readers ignore unknown fields.
7. **Two kinds of menu.**
   - **A storefront menu** is a provider's main-key menu. It carries no `provider` tag.
   - **A per-customer menu** is the menu of a key that serves one customer (Treasure Maps § 9, "One key per observer").
     It MUST carry `["provider", "39999:<storefront key>:duty-menu", "<relay>"]`, or `["provider", ""]` when its provider
     publishes no storefront.
   - Readers treat any menu with a `provider` tag as per-customer, so a per-customer menu never poses as a storefront.
   - When filling a Map entry for a per-customer key, readers use that key's own menu. A storefront is for comparing
     before signing up.
   - The `provider` value is the per-customer key's own claim, not proof that the storefront's author runs it.
   - One key per algorithm (D7, NIP-85) means one menu per key: a provider with two algorithms has two storefronts.
8. **Finding menus.**
   - One key's menu: `{"kinds":[39999], "authors":["<key>"], "#d":["duty-menu"]}`. It needs only the pubkey, so a Map
     entry's element 2 is enough.
   - All menus: `{"kinds":[39999], "#z":["39998:<Nous>:duty-menu"]}`. Anyone may publish there, so readers filter the
     results per point of view (CLAUDE.md invariants 2 and 3).
9. **The provider directory** (non-normative, the owner's addition): the storefront menus under the header, filtered per
   point of view and read through their authors' kind 0 profiles (name, website), list the service providers a community
   trusts.
   - A provider that publishes no storefront is not listed, since its per-customer menus carry `provider`.
   - Its per-customer keys stay listable under the header (D9, accepted).
10. **Offered versus active.** The menu says offered; the key's own Treasure Map says active. The spec points to Treasure
    Maps § 9 for that, and defines nothing about it (Self-Maps are story 3).
11. **Publishing and withdrawing.** Publish to the relays the menu names and where the author publishes DList items.
    Change offers by republishing the one replaceable item; withdraw them all by republishing with no `duty` rows, or by
    deleting it (NIP-09).
12. **Spec layout** (`duty-menus.md`):
    - metadata header: Status 📝 pre-NIP; Canonical: not yet published; Implementation: none (the header is not yet
      published; nothing publishes or reads menus); Sources: the handoff, ADRs 0001–0002;
    - title, a one-paragraph summary, and "At a glance";
    - § 1 Principles; § 2 Terms; § 3 The header; § 4 The item; § 5 Reading a menu; § 6 Storefront and per-customer menus;
      § 7 Finding menus; § 8 The provider directory (non-normative); § 9 Offered and active; § 10 Publishing and
      withdrawing; § 11 Security and privacy; § 12 Examples (a storefront, a per-customer menu with an exception row, and
      the Map entry it produces); § 13 Open questions (private duties, handoff Q4; whether a per-customer menu identical to
      its storefront may be omitted).
    - No "canonical" or "consensus" in normative text, and no "root".
13. **README and worksheet.**
    - A `protocols/README.md` index row: "Duty Menus (what an Assistant key offers to publish, and where; Nous' shared
      header)", `drafts/duty-menus.md`, 📝 pre-NIP, "Working copy here. Nothing publishes or reads menus yet; Nous' header
      is not yet published.", origin `duty-menus-and-self-maps` #2.
    - A dated note at the end of worksheet W1, before its **Refs** line: the Duty Menu header is held by Nous' key, a
      deliberately held community key, offered as a self-declared Shared Concept and adopted into dictionaries by
      pointer-`b`, with no per-deployment firmware copy.

## Consequences

- **Any instance can fill a Treasure Map relay for an Assistant it doesn't run,** knowing only the pubkey. That is what
  OPEN.md row `2026-10-10-external-assistant-relay-left-empty` needs for its lasting fix, in a later code book.
- **A provider directory falls out of D9** at no extra cost.
- **Exceptions are expressible** ("not offered" rows), so menus don't overclaim.
- **Story 3 must** reserve `duty-menu` in `treasure-maps.md` § 4.6 (`39999:<d-tag>` is a Concept key) and point § 9's
  Self-Maps text at this spec.
- **New wire surface:** two multi-letter tags, `duty` and `provider`. Neither is relay-indexed, and neither takes a letter
  (W2 unaffected).
- **Departures from the handoff's § 4 example:** the `q` there becomes `provider`; the header's `required p` description
  is reworded; the `description` drops its pointer to kind 10040, which the spec's § 9 states instead.
- **Firmware reinstall required?** No. Nothing in firmware changes, since D10 replaces a per-deployment copy.

## Implementation notes

Docs-mode: the Implementer authors exactly these.

1. **`protocols/drafts/duty-menus.md`**, laid out per sub-decision 12, carrying sub-decisions 1–11 as normative text.
   Examples use the full Nous pubkey and placeholder keys `<A>` and `<S>`.
2. **`protocols/README.md`:** the index row from sub-decision 13, placed after the DList Auxiliary Events row and before
   the Amendments row.
3. **`protocols/worksheet.md` W1:** the dated note from sub-decision 13, before **Refs**.

**Gates (AC5, AC6):**
- `grep -n -i -E "canonical|consensus"` over the new spec finds only the metadata label `**Canonical:** not yet published`.
- Every link and § reference resolves.
- `bash scripts/harness-lint.sh` is clean.
- The stack-free `npm test` shows no regression against the clean-tree baseline.
- `git diff --stat` touches exactly these three `protocols/` files, plus the story's Linked artifacts.

## Out of scope

- Self-Maps and the § 4.6 reservation (story 3).
- Nous publishing the header.
- Private duties (open question, § 13 of the new spec).
- Any code: publishing menus, reading them on `/treasure-map`, the directory page.
- An upstream NIP-85 proposal.
