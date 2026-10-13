# PRD Seed: Assistant Duties — the duties an instance offers

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-duties-settings/audit.md`
**Anchor:** the acceptance frame in `book.md` (confirmed at story 1's approval, amended by book Decision 8)
**Confidence:** high for scope (every frame bullet traced to a passing story); medium for the design rules (never
written down as a guide)
**Date:** 2026-10-12

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a strawman for
> the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]` or `[UNKNOWN — product input
> needed]`.

## 1. Product vision

`[FROM FRAME]` An instance's Owner decides what its Assistants offer to do, without a code change. Every Assistant
publishes a Duty Menu: the duties it offers, each at the relay where its insights will be published. Clients and other
instances read these menus to choose which Assistant to give a duty to. The Owner, or an Admin, sets one list of
duties for every Assistant on the instance, from a Settings tab.

`[INFERRED]` The problem it solves: an instance that builds a new kind of insight, or stops building one, can say so on
every Assistant's menu at once. Until now the six duties were hardcoded.

## 2. Personas

- `[FROM FRAME]` **The Owner, or an Admin.** Runs the instance. Edits the list from Settings and is responsible for
  what it offers. Admins are equal to the Owner here.
- `[INFERRED]` **A person with an Assistant** (Owner, Admin or customer). Sees their Assistant's offer change on its Duty
  Menu page, and republishes when it goes Needs attention.
- `[INFERRED]` **Another instance or client** that reads Duty Menus to fill Treasure Map entries.

## 3. Scope (as-built)

- `[FROM FRAME]` **An Assistant Duties tab at `/tapestry/settings/assistant-duties`.** It lists the duties in order,
  each with its kind, category and relay. You can:
  - add a whole kind (five digits) at This instance's relay or a typed public `ws(s)://` relay;
  - remove a duty;
  - change a duty's relay;
  - drag to reorder, or use Move up / Move down;
  - reset to the six defaults.

  Each change saves at once, and a refusal says why.
- `[FROM FRAME]` **Six defaults:** Scores `30382`; Lists `30392`, `30393`, `30394`; Concepts `39998`, `39999`.
- `[FROM FRAME]` **Kept in the instance's settings file** on its persistent volume. It survives redeploys and stays
  hand-editable, and bad entries are dropped and never offered.
- `[FROM FRAME]` **One list for every Assistant.** The Owner's, each Admin's and each customer's Assistant offers the
  same duties, in the list's order.
- `[INFERRED]` **What a change does.** It marks every Assistant Needs attention until it republishes; nothing republishes
  on its own. A listed kind this instance does not publish is offered and never shown as live on Your Assistant's
  Treasure Map.
- `[FROM FRAME]` **Out of scope:**
  - automatic republishing;
  - per-Assistant lists;
  - `not-offered` rows;
  - names or descriptions on duties;
  - a warning on unbuilt kinds;
  - narrower or family keys (book Decision 8).

## 4. Domain model

`[INFERRED]` from the as-built:
- **Assistant Duties list.** An ordered list of **duties**, at most 200, one per instance. Stored as the
  `assistantDuties` setting.
- **Duty.** A **kind** (five digits, a Treasure Map key of the whole kind) and a **relay**: either *This instance's
  relay* or a typed public relay.
  - *This instance's relay* resolves to the instance's public relay address. A Concept kind falls back to the first
    public DList relay when the instance has none.
  - A duty with no reachable relay is left off menus.
- **Offer.** The list resolved into Duty Menu rows: kind and relay, in order. Every Assistant on the instance has the
  same one.
- **Duty Menu.** The kind-39999 event an Assistant signs from the offer (`protocols/drafts/duty-menus.md`). It is
  *current* when its rows match the offer in order.
- `[INFERRED]` **Concept-graph impact:** none. No concept or firmware definition is involved.

## 5. Design rules (as-built)

- `[INFERRED]` **The tab sits in Settings, after Assistant Profile,** and follows the Settings page's look: grouped rows,
  small buttons, a success or error line.
- `[INFERRED]` **Each row shows** the kind in monospace, then its category in muted text, then the relay. This
  instance's relay is shown in muted regular text; a typed relay in monospace.
- `[INFERRED]` **Every change is one save of the whole list.** Controls are disabled while it is out; the server's answer
  is what the tab shows.
- `[INFERRED]` **Words live in one module** (`assistantDutiesCopy.js`), as for the Duty Menu page.
- `[UNKNOWN — product input needed]` No design guide was written for Settings tabs. These rules are read off one tab.

## 6. Carry-forward & open questions

Promoted from the build audit §6:
- **Narrower or family offers** (`30382:rank`, `3038x`, `*`). Wanted? Each would need Your Assistant's Treasure Map to
  read them (audit §4 #1).
- **The key field's words** ("Treasure Map key", "That isn't a Treasure Map key.") now that only kinds are accepted.
- **No warning when a listed kind is not built here.** It was the owner's choice; is it still right once Owners use it?
- **Typed relays without a DNS check,** set by Admins too.
- **The drag handle's accessibility.**
- **Atomic writes of the settings file**, which affects every setting.
- ~~**A signed-in run-through on staging** before promotion.~~ Done on production 2026-10-13 by the Owner: reorder,
  republish and reset work (audit §5). Add, Remove and Change relay not yet tried signed in.

## 7. What product must validate

- [ ] Whether Owners need narrower or family offers (§6), or whether whole kinds are enough.
- [ ] Whether one instance-wide list is right, or Owners will want per-Assistant or per-customer lists.
- [ ] Whether every change should mark every Assistant Needs attention, or the instance should republish for them.
- [ ] The tab's words for the key field and its refusal.
- [ ] Whether offering a kind the instance does not publish should be warned about (book Decision 1 said no).
