# Duty Menus and Self-Maps — Design Handoff

**Status:** 🔴 OPEN — design captured 2026-10-10; name and header model decided (D8–D10). Ratification started 2026-10-10 as book `duty-menus-and-self-maps` (`engineering-team/audits/duty-menus-and-self-maps/book.md`); nothing landed in `protocols/` yet.
**Created:** 2026-10-10
**Provenance:** Scoped in one advisory session on 2026-10-10, started by the owner's question about the new external-Assistant support on `/treasure-map`. This is the Capture step of the Protocol-Spec workflow (`engineering-team/workflows/protocol-spec-workflow.md`): what is decided, what is proposed but not yet confirmed, and what is still open. Flip to ✅ SUPERSEDED once the pieces land in `protocols/`.

> **Audience:** the session that ratifies this into `protocols/drafts/`, and then the sessions that build it.

---

## 1. The problem

- A Treasure Map entry is `["<key>", "<assistant>", "<relay>"]` (`protocols/drafts/treasure-maps.md` § 3). Element 3 tells clients where to find the insight.
- `/treasure-map` now lets a person give duties to Assistants on other services, such as their Brainstorm Assistant. For this instance's own Assistant, the page fills element 3 from Relay Settings. For any other Assistant it writes `''` (`makeRelayFor`, `ui/src/pages/treasure-map/editTreasureMap.js`).
- So the question: **how does an instance learn which relay goes with an external Assistant?** Today each provider publishes to one relay. Later the relay may differ per duty (Trusted Assertions on one relay, Trusted Lists on another) and per customer.
- A second need came up in the discussion (the owner's scenario). A customer who switches a duty, such as Trusted Assertion publication, between Assistant 1 and Assistant 2 wants to know two things:
  - does each Assistant offer that duty?
  - is it **already** publishing it? If so, the switch is instant instead of waiting 5–10 minutes for a first computation.
- A live defect sits next to this; see § 7.

## 2. Decided

| # | Decision | Source |
|---|---|---|
| D1 | **Two things, two events.** A **Duty Menu** (a DList item) says what an Assistant key *offers* and the relay for each duty. The Assistant's **own Treasure Map** (its kind 10040, naming itself: a *self-Map*) says which duties it is *actively* publishing now. | the owner's plan, 2026-10-10 |
| D2 | **Not kind 0.** It would have two owners (the person edits their Assistant's profile; the operator owns the relays), a kind 0 is replaced whole, and NIP-85 already gives the service key's kind 0 a job: describing the key for people. | the owner, 2026-10-10 |
| D3 | **Not kind 10002.** The Assistant fills its NIP-65 list like any user, including general relays (e.g. purplepag.es) that have nothing to do with its duties. It stays useful as a fallback locator. | the owner, 2026-10-10 |
| D4 | **Nous publishes the shared Duty Menu header**, with Nous' key `15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270` (the same key that authored the "My Tapestry Assistant" tag, `src/lib/identification-tags/index.js`). Not published yet; the design assumes it will be. | the owner, 2026-10-10 |
| D5 | **No price or tier in the menu.** | the owner, 2026-10-10 |
| D6 | **No expiration on self-Maps.** | the owner, 2026-10-10 |
| D7 | **One key per algorithm is acceptable.** NIP-85 requires a separate service key for each algorithm, so a provider offering two algorithms for one metric uses two keys, each with its own menu and self-Map. | the owner, 2026-10-10 |
| D8 | **The name is "Duty Menu".** | the owner, 2026-10-10 |
| D9 | **Every menu points at Nous' header:** storefront and per-customer menus alike carry `["z", "39998:<Nous>:duty-menu"]`. One query under that header therefore lists every provider's Assistant keys, per-customer keys included. Accepted: the link between a customer and their Assistant key is already public through the customer's own Map. | the owner, 2026-10-10 |
| D10 | **Nous proposes the header as a Shared Concept**, self-declaring it with a pointer-typed `b` that names its own coordinate. People add "Duty Menu" to their own dictionaries by referencing it. That is the existing adoption flow: their Assistant publishes its own header that points `b` at Nous'. No per-deployment firmware copy. | the owner, 2026-10-10 |

## 3. Considered and set aside

Kept so the reasoning isn't lost.

- **A new replaceable kind (an "Assistant Declaration": rows of `[map-key, relay, …]`).** Recommended early in the session, then withdrawn. It needs a new kind number and adoption by relays and clients, and the offered/active split (D1) does the job with kinds that already exist.
- **The Assistant's own 10040 as the whole menu** ("an Assistant acts as its own Assistant", listing everything it offers). A Map says what is *in use*; a menu says what is *available*. Under § 9 every entry naming an Assistant is a duty. A self-Map listing everything offered would therefore do one of two things:
  - make the Assistant publish every offered insight from its customer's point of view, including duties the customer gave to someone else, and even after the customer drops it; or
  - name insights nobody publishes.

  Splitting offered (the menu) from active (the self-Map) removes the tension.
- **A NIP-85 change that depends on knowing which pubkeys are Assistants.** The owner pointed out that outsiders can't always tell. With self-Maps listing only active duties, every self-entry has events behind it, so no reader needs to classify keys (§ 5, last bullet).
- **A Duty Menu header per Assistant.** Each customer has their own Assistant key (treasure-maps § 9, "One key per observer"), so this would mean a header per customer. Two problems:
  - it clutters every reader that lists all headers (e.g. `ui/src/pages/lists/Index.jsx`, `src/api/adoption/index.js`);
  - under `assistant-designation.md` § "Dual-author lookup and precedence", a header signed by a person's Assistant can be read as that person's own concept.
- **One menu item per duty.** Withdrawing a duty would need NIP-09 deletions, and kind-5 deletions don't ride the `#z`-scoped relay sync (`docs/TAG_FEDERATION_OPS.md`, caveat 4), so withdrawn offers could come back. One replaceable item per key is one fetch and a consistent snapshot.
- **The name "Treasure Map Template"** (the owner's working name). "Template" already means two things here:
  - the unsigned 10040 handed to the signer (`buildTreasureMapTemplate`, `src/lib/treasureMapMerge.js`);
  - public methods that others inherit (`trust-determination-methods.md` § 6).

  It also suggests copying a whole Map, while customers pick a different Assistant per card. "Assistant Offer" was also considered, but the `offer` stem is retired (`test/retire-offering-vocabulary.test.js`) and it reads like a one-time deal. "Duty Menu" was chosen (D8).
- **A firmware copy of the header in every deployment** (the concept-header precedent, `dlist-header-declaration.md` § 4). Replaced by D10: the header is a Shared Concept that people add to their dictionaries.

## 4. Proposed: Duty Menus

The name, the publisher and the header model are decided (D4, D8–D10). The shapes below were proposed in the session and are to be confirmed at ratification.

### 4.1 The header

- One shared header, `39998:<Nous>:duty-menu`, signed by Nous (D4), proposed as a Shared Concept (D10).
- Proposed tags:
  ```
  ["d", "duty-menu"]
  ["names", "duty menu", "duty menus"]
  ["b", "39998:<Nous>:duty-menu", "pointer"]
  ["description", "What one Assistant key offers to publish: Treasure Map keys and the relay for each. Offered, not active; the key's own kind 10040 says what is active."]
  ["required", "p", "The Assistant: equals the item's author"]
  ["required", "duty", "A Treasure Map key (treasure-maps § 4.7) and the relay this Assistant publishes it to"]
  ["allowed", "name"]
  ["allowed", "description"]
  ["allowed", "q", "For a per-customer key: its provider's storefront menu"]
  ["allowed", "json", "Per-duty details: description, update interval, algorithm. No price or tier."]
  ```
- `required p` makes the item's subject `p` (`content-categories.md` § 5.1). A DList-based list over Duty Menus then reads as "the Assistants my trusted community accepts".
- The `b` names the header's own coordinate, which self-declares it: it offers the header as one others may affiliate with. That rule is proposed in `amendments-2026-09.md` § 3 and not yet in `inherit-from.md`. Its proposed wording says "canonical", which the D2 vocabulary policy (`docs/NIP_REORG_DESIGN_HANDOFF.md`) keeps out of normative text, so ratification rewords it (story 1 of the book). The code already writes it: Create New Concept, with no target, points `b` at the new header itself (`src/api/adoption/newConcept.js`).
- **Publishing it.** Create New Concept with the singular name "duty menu" gives `d` = `duty-menu` (`headerDTag`, `src/lib/dtag.js`). But it writes only `d`, `names`, `description` and `b`. The `required` and `allowed` declarations above have to be added another way: published by hand, or by a later edit to the header.
- **Adding it to a dictionary** (D10). A person's Assistant publishes its own header, `39998:<their Assistant>:duty-menu`, that copies Nous' tags and points `b` at Nous' header (`copiedHeaderTags`, `src/lib/conceptHeaderCopy.js`). It is the same "Add to My Dictionary" flow as any Shared Concept (`ui/src/pages/dictionaries/Concepts.jsx`). Because the copy keeps the `required`/`allowed` declarations, they must be on Nous' header before people adopt it.
- **Items point at Nous' header, not at dictionary copies** (D9). A reader that starts from someone's dictionary copy follows its `b` to Nous' header and queries `#z` there.
- Nous' pubkey is a fixed community constant, like the identification-tag authors, not a per-deployment Tapestry Assistant key. The CLAUDE.md rule against hardcoding the TA pubkey doesn't apply, but the constant should be defined once in shared code.

### 4.2 The item

- Each Assistant key publishes **one** replaceable kind 39999, signed by itself, at the fixed `d` `duty-menu`.
- Example, a per-customer key `A`:
  ```json
  {"kind": 39999, "pubkey": "<A>", "content": "", "tags": [
    ["d", "duty-menu"],
    ["z", "39998:<Nous>:duty-menu"],
    ["p", "<A>"],
    ["name", "Brainstorm Assistant"],
    ["duty", "30382:rank", "wss://nip85.brainstorm.world"],
    ["duty", "30382:followers", "wss://nip85.brainstorm.world"],
    ["duty", "3039x:tag", "wss://nip85.brainstorm.world"],
    ["duty", "39998", "wss://dcosl.brainstorm.world"],
    ["q", "39999:<provider's storefront key>:duty-menu", "wss://dcosl.brainstorm.world"]
  ]}
  ```
- Rules:
  - A row is `["duty", "<Treasure Map key>", "<relay>"]`. The Assistant is implicit: it is the item's author. A row becomes a Map entry as `[key, A, relay]`.
  - At most one row per key. The relay for a duty comes from the winning row under the Map's own most-specific rule (treasure-maps § 6). No winning row means not offered.
  - Rows mean **offered**, never active.
  - Readers take rows only from an item whose author equals its `p`. Anyone may publish under the header, but only a key's own word says what it offers. This is filtered at read time (CLAUDE.md invariants 2 and 3).
  - Per-duty details go in a `json` tag keyed by Treasure Map key: description, update interval, algorithm. No price or tier (D5).
- **Storefront and per-customer menus.**
  - A provider's main key publishes a *storefront* menu for people comparing Assistants before they sign up, when no per-customer key exists yet.
  - Each per-customer key publishes its own menu, with the rows that apply to that customer, and a `q` pointing at the storefront.
- **Lookup.**
  - One key's menu, knowing only its pubkey: `{"kinds":[39999], "authors":[A], "#d":["duty-menu"]}`.
  - All menus under the header: `{"kinds":[39999], "#z":["39998:<Nous>:duty-menu"]}`, filtered per point of view. Every menu carries this `z` (D9).
- **Where published:** at least the relays the menu names, and the DList relays (`aDListRelays`, default `wss://dcosl.brainstorm.world`).
- Reserve `duty-menu` in treasure-maps § 4.6, since `39999:<d-tag>` is also a Concept key (§ 4.5).

## 5. Proposed: Self-Maps

- **Terms.** A *self-entry* is a Map entry whose element 2 is the Map's own author. An Assistant's *self-Map* is its own kind 10040.
- **Meaning.** A self-entry says: "this key is now publishing and keeping up to date the insights under this key, at this relay." It means published and maintained, not merely assigned.
- **Timing.**
  - Add the entry once the first full set of insights has landed on the named relay.
  - Keep it through brief gaps.
  - Remove it before upkeep stops (revocation, non-payment, retirement).
  - Then retract Lists by the existing convention: an empty replacement with `["status", "retracted"]` (`trusted-lists.md`). Scores have no retraction convention, so removing the self-entry is their "stopped" signal.
- **Content.** Copy the customer's winning key verbatim, one entry per key. Name only itself. Never copy the customer's Preferred/Backup order or other providers. Element 3 is the relay where the insights actually are.
- **No duty, no designation.** Proposed § 9 text:
  > **Self-entries.** An entry that names the Map's own author is a *self-entry*: the author's report that it is already publishing and maintaining that insight at that relay (§ 9.2). A self-entry creates no duty and designates no one; an Assistant takes duties only from entries naming it in the Map of the observer it serves.

  Without this, a customer dropping an Assistant would change nothing: the Assistant's own Map would keep the duty alive.
- **A person who runs their own key as their own Assistant** keeps their pending requests in their own local state (CLAUDE.md invariant 4). Their Map then reports what is live, like any self-Map, so "a self-entry means active" holds for every key.
- **Confirmed duties.** A customer entry naming A, plus a matching self-entry in A's own Map, is a confirmed duty. "Matching" means the same key, or one that wins for it under § 6. A confirmed Backup is a ready standby.
- **Readers.**
  - When element 3 is empty or unreachable, a client MAY take the relay from the named key's most specific matching self-entry, then from its Duty Menu.
  - A key that lists a duty in its self-Map counts as maintained, whatever the insights' age. This refines § 7's "older than they'll accept". NIP-85 asks providers to republish only when the content changes, so stable scores look old.
  - Before switching to a Backup, a client SHOULD spot-check a few insights on that relay. The self-entry is a claim; the events are the proof.
  - Using a self-Map as a point of view is coherent: one key per observer means the Assistant's view is its customer's view. It shows only that key's slice.
- **Counting.** Adopter, participation and POV-enumeration counts skip Maps made only of self-entries: `src/api/export/nip85/queries/get-nip85-participation-data.js`, `get-all-10040-authors-locally.js`, `public/pages/about-trusted-assertions.html`. Say so in the spec for outside clients.
- **Private duties** never go in public tags (treasure-maps § 13 Q8).
- **The instance's Tapestry Assistant (TA)** publishes a self-Map too: what it actually publishes for the owner. It is never the TA's source of duties.
  - `assistant-designation.md` § Authorship says "A TA cannot designate itself." Narrow it to "…on anyone else's behalf."
  - If the instance, as its own person (BIBLE §31), ever names other providers in its Map, those are ordinary entries.
- **No expiration** (D6).
- **NIP-85.** No change that needs readers to classify keys. One sentence covers it: a Map entry names who is asked to publish, not a promise that the insight exists. § 7's fallback already handles "can't be found".

## 6. How `/treasure-map` uses them

- **Filling element 3** when a person gives key K to Assistant A, in order:
  1. the winning self-entry in A's self-Map;
  2. the winning `duty` row in A's Duty Menu;
  3. the relay the Map already gives A in the same category;
  4. otherwise `''`, with a note that A doesn't say it offers this duty. This is a hint, never a gate (invariant 2).
- **Read relays only from the Assistant being assigned:** `useAuth().user.assistantPubkey`, or the external pick. Never `taPubkey` (OPEN.md row 188 is the precedent).
- **Per Assistant, per card:** *Not offered* / *Offered* / *Active*, and "Standby ready" for an active Backup.
- **Switching should be a reorder, not a reassignment.** § 7 already makes a Backup "a standby that is already up to date". Today, picking your Backup on a card doesn't swap:
  - `editedTags` (`ui/src/pages/treasure-map/editTreasureMap.js`) moves the Preferred entry to the Backup's key;
  - so `[rank→A1, rank→A2]` becomes `[rank→A2, rank→A2]`;
  - § 7 ignores the duplicate, and A1 drops off the Map.

  This needs a "Make preferred" swap that keeps the old Preferred as Backup.

## 7. Related live defect

OPEN.md row `2026-10-10-external-assistant-relay-left-empty`.
- Assigning Scores to an external Assistant on `/treasure-map` writes `["30382:rank", <external>, ""]`; test E1 in `test/treasure-map-edit-mode.test.js` pins this.
- Four readers treat an empty relay as "no rank entry", with no fallback:
  - `ui/src/hooks/useTrustWeights.js`
  - `ui/src/pages/BrainstormSearch.jsx`
  - `ui/src/pages/BrainstormSettings.jsx`
  - `nip50-proxy/src/wot-pipeline.js`
- The house-POV setup (`SearchPreferences.jsx` → `src/algos/refreshSearchIndex.sh`) also skips its sync.

§ 6 fixes this for good. A stopgap can ship first.

## 8. Ratification plan (docs-mode)

Thin story → ADR → Test Design skipped → spec edits → accuracy review → staging.

- **`protocols/drafts/treasure-maps.md`:**
  - § 3: element 3 is a write-time hint; readers fall back to the self-Map, then the menu.
  - § 4.6: reserve `duty-menu`.
  - § 7: a confirmed Backup is a ready standby; the maintained-whatever-age rule.
  - § 9: the self-entry sentence.
  - New § 9.2: Self-Maps.
  - § 13 Q5: if `p` tags are adopted, skip Maps you authored.
  - The counting rule.
- **New `protocols/drafts/duty-menus.md`** (header, item, rules, lookup), plus a row in `protocols/README.md`.
- **`protocols/drafts/assistant-designation.md`** § Authorship: narrow "A TA cannot designate itself".
- **Self-declaration** (`amendments-2026-09.md` § 3) into `inherit-from.md` § "The `b` tag" and `shared-concepts.md` § Declared affiliation, if it hasn't landed by then. D10 relies on it; the code already writes it.
- **`protocols/worksheet.md` W1:** note that Nous holds the Duty Menu header, a Shared Concept rather than a per-deployment firmware copy.
- **BIBLE:** a pointer later, when code ships.

Outside the repo: Nous publishes the header, with its `required`/`allowed` declarations in place before anyone adopts it (§ 4.1). Publishing is the author's act.

Then engineering, roughly:
1. Nous' header coordinate as one shared constant, and reader helpers: menu lookup, self-Map lookup, and § 6 resolution over both. A dictionary entry for Duty Menu comes from the existing adoption flow, so no firmware change is needed.
2. This instance publishes a Duty Menu and a self-Map for each of its Assistant keys (the TA and customer keys). Both must name the relays the insights really go to. Reconcile `BRAINSTORM_NIP85_HOME_RELAY`, `aTrustedAssertionRelays` and the router presets (off by default) first.
3. `/treasure-map`: the relay fill order, the Offered/Active states, and the "Make preferred" swap (§ 6).
4. Readers: the empty-relay fallback (§ 7) and the counting rule (§ 5).
5. Ask NosFabrica to publish menus and self-Maps for Brainstorm's keys.

## 9. Open questions

1. ~~**Name.**~~ Resolved: "Duty Menu" (D8).
2. ~~**Firmware copy or direct reference** to Nous' header.~~ Resolved: neither. Nous' header is a Shared Concept, and people add it to their dictionaries through the adoption flow (D10).
3. ~~**Per-customer menus and enumeration.**~~ Resolved: every menu carries the `z` to Nous' header, and per-customer keys being listable is accepted (D9; worksheet W12).
4. **Private duties** in a self-Map's `.content` (NIP-44)? (treasure-maps § 13 Q8, W22.)
5. **A bare `["z", "duty-menu"]`**, with no pubkey in it, as a meeting point alongside Nous' handle?
6. **NosFabrica adoption:** who raises it, and when.
7. **Finding a storefront** for a provider the person hasn't joined: the key's kind 0 website (NIP-85 Appendix 1), or the storefront query under Nous' header.

## 10. Where we paused

2026-10-10: design captured. The owner answered the session's four open questions (D4–D7) and asked for this doc, then settled the name and the header model (D8–D10). Next: start the docs-mode ratification (§ 8). Q4–Q7 can be settled along the way.
