# Story 1: The Assistant Duties tab

**Status:** Approved
**Created:** 2026-10-12
**Approved:** 2026-10-12, by the owner ("Ready for Architecture"), as drafted
**Type:** Feature
**Epic:** `assistant-duties-settings`
**Book:** `engineering-team/audits/assistant-duties-settings/book.md`

## Background

Every Assistant on this instance publishes a **Duty Menu**: what it *offers* to publish, and where
(`protocols/drafts/duty-menus.md` § 1). Each row is a Treasure Map key and the relay where the insights under that
key will be published (§ 5). The `assistant-duty-menu` book built the page that shows it, `/assistant/duty-menu`, and
the button that has the Assistant publish it.

Which duties every menu offers is fixed in code today: one Scores duty (`30382`), three Lists duties (`30392`,
`30393`, `30394`) and two Concepts duties (`39998`, `39999`), the kinds this instance publishes (ADR
`assistant-duty-menu/0001` K1). Each is offered at this instance's own relay, and Scores only to the Owner's Assistant
and active customers' Assistants. The Owner cannot change any of it without a code change.

The owner wants the Owner or an Admin to choose the duties this instance offers, from a new **Assistant Duties** tab
on the Settings page. The list is kept on the server in the instance's settings, where the Relays tab's settings
already live. A new instance starts with today's six.

The owner settled at intake (book § Decisions):
- **Any kind can be added**, including a duty this instance does not publish yet, with no warning. This knowingly
  relaxes the closed book's "Honest rows" rule. *(Amended at review round 1, 2026-10-12, book Decision 8: a whole
  kind, five digits such as `30383`. It was "any Treasure Map key". Your Assistant's Treasure Map reads offers by kind,
  so a narrower key such as `30382:rank` or a family key such as `3038x` made the two pages disagree.)*
- **One list for every Assistant.** The Owner's, each Admin's and each customer's Assistant offer the same duties.
  Scores is no longer held back from anyone. The only visible change is for an Admin who is not also a customer: their
  Assistant's menu now offers Scores. Inactive customers sign in as guests and cannot open the Assistant pages, today
  and after.
- **Each duty names its relay**: either this instance's relay, chosen as today, or one typed in.
- **The Owner or Admin sets the order** by dragging, and every menu lists the duties in that order.

Who is affected:
- The Owner and Admins, who now control the list.
- Everyone with an Assistant here, whose Duty Menu follows it.
- Anyone reading those menus to assign duties.

**Another page reads the same offer.** Your Assistant's Treasure Map (`assistant-self-map` #1, on `staging` since
2026-10-12) takes the relay for each duty from the Duty Menu offer. It calls a duty live only when this instance has
actually published it. Today the offer holds only kinds this instance publishes, for the Assistants it publishes them
for. After this story, it may hold any key. This story lands second, so it keeps that page working (AC-6).

## User-facing description

As the Owner or an Admin of this instance, I want to add, remove, order and choose the relay of the duties my
instance's Assistants offer, from the Settings page, so that every Assistant's Duty Menu says what this instance
offers without anyone changing code.

## Acceptance criteria

- [ ] **AC-1: the tab, and who may use it.**
  - The Settings page has an **Assistant Duties** tab at `/tapestry/settings/assistant-duties`, after **Assistant Profile**,
    and opening that URL directly opens the tab.
  - The Owner and Admins see the list and can change it.
  - Anyone else sees the Settings page's existing refusal and no list.
  - The instance refuses any change to the list from anyone but the Owner or an Admin, however the request is made,
    and the list is left as it was.
- [ ] **AC-2: the list, and its six defaults.**
  - The tab lists the offered duties in their order. Each line shows:
    - its Treasure Map key;
    - its category (Scores, Lists or Concepts, named as `/treasure-map` and the Duty Menu page name them), or none
      for a key in no category;
    - its relay, or **This instance's relay**.
  - On an instance where no one has changed the list, it holds Scores `30382`, Lists `30392`, `30393` and `30394`,
    and Concepts `39998` and `39999`, in that order, each at **This instance's relay**.
  - With that list, the Owner's Duty Menu offers exactly what it offers today.
- [ ] **AC-3: adding a duty.**
  - The Owner or an Admin enters a kind (five digits, such as `30383`) and a relay (**This instance's relay** by
    default, or a typed relay) and adds it. It joins the end of the list and is saved. Spaces around the kind are
    ignored.
  - Refused, with the reason shown and nothing saved:
    - anything but a whole kind: a narrower key (`30382:rank`), a family key (`3038x`), `*`, a Concept key with a
      `d` (`39999:my-list`), or anything that is not five digits *(amended at review round 1, 2026-10-12, book
      Decision 8; it was "a key readers would drop")*;
    - a kind already on the list;
    - a typed relay that is not a `wss://` or `ws://` address;
    - a typed relay others cannot reach, such as a local or private address.
- [ ] **AC-4: removing, changing a relay, reordering, and resetting.**
  - **Removing.** Any duty can be removed, including all of them. An empty list is saved, and every menu then offers
    no duties.
  - **Changing a relay.** A duty's relay can be changed between **This instance's relay** and a typed relay, under
    AC-3's relay rules. Choosing **Another relay** with the field left empty is refused, as it is when adding. The
    relay saved is always that duty's own, whatever else was moved or removed while the change was open *(both
    added at review round 1, 2026-10-12)*.
  - **Reordering.** The duties can be put in any order by dragging. The same moves can be made from the keyboard
    alone.
  - **Resetting.** **Reset to defaults**, once confirmed, puts back AC-2's six in their order.
  - **Saving.** Each change is saved when it is made, the tab says so, and a refused change leaves the list as it
    was.
- [ ] **AC-5: kept on the server.**
  - The list is no longer fixed in code: the six come from the instance's shipped defaults.
  - A changed list is kept in the instance's settings file on its persistent volume. It survives a restart and a
    redeploy.
  - A new version of the shipped defaults does not overwrite a list the Owner or an Admin has changed.
  - A change reaches every Duty Menu check and publish made after it, with no restart.
- [ ] **AC-6: every Assistant's Duty Menu follows the list.**
  - For every Assistant on this instance (the Owner's, an Admin's, a customer's), **What your Assistant offers** on
    `/assistant/duty-menu` shows exactly the listed duties, in the list's order. The offer is the same whoever the
    Assistant belongs to.
  - Each duty is offered at its typed relay, or, for **This instance's relay**, at the relay today's offer would name
    for a duty of its category. Where that rule leaves a duty with no reachable relay, the duty is left off, as today.
  - Pressing **Have your Assistant publish its Duty Menu** publishes exactly those rows, in that order.
  - An Assistant whose published menu no longer matches the list is marked **Needs attention** on the hub, and its
    page says the menu is out of date, until it is published again.
  - Nothing is republished automatically.
  - Your Assistant's Treasure Map page keeps working with any list. A listed duty this instance does not publish is
    shown there as offered but not live, never as live.
  - The Duty Menu page's two sentences that say "publishes" now say "offers" (§ Copy).

## Copy

- Tab label: **📋 Assistant Duties**
- Heading: **Assistant Duties**
- Under it: "The duties every Assistant on this instance offers on its Duty Menu, in this order, and the relay where
  each is published. Changes apply to every Assistant's Duty Menu."
- Relay choice: **This instance's relay** / **Another relay**, with the field placeholder `wss://`
- Add: field label **Treasure Map key**, button **Add duty**
- Remove: **Remove**
- Reorder, for the keyboard: **Move up** / **Move down**
- Reset: **Reset to defaults**. Confirmation: "Replace this list with the six default duties?"
- Saved: "Saved. Each Assistant's Duty Menu now needs publishing again from its Duty Menu page."
- Refusals:
  - "That isn't a Treasure Map key."
  - "That key is already on the list."
  - "A relay must start with wss:// or ws://."
  - "That relay can't be reached by others."
  - "Could not save: this instance did not answer."
- Empty list: "No duties are offered. Every Assistant's Duty Menu lists none."
- Duty Menu page (`assistant-duty-menu` #1 § Copy), two changes:
  - Under **What your Assistant offers**: "Duties this instance offers for your Assistant, and the relay where each
    is published." *(was "publishes")*
  - Empty offer: "This instance offers no duties for your Assistant." *(was "publishes no duties for your Assistant
    yet")*

## Concepts touched

- `39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu`: Nous' Duty Menu header (every
  menu's `z`; its wire shape is unchanged).
- Treasure Map keys (`protocols/drafts/treasure-maps.md`): what each listed duty is.
- No concept-graph node or firmware concept is added or changed. The live Concept Graph was not reachable at
  planning (stack absent), so the Architect confirms this.

## Out of scope

- Republishing any Assistant's Duty Menu automatically after a change. Each person publishes from their Duty Menu
  page, as today.
- Making this instance publish an added duty. The menu says *offered*, never *active*, and by the owner's choice it
  may offer a duty that is not built.
- Marking a duty this instance does not publish. The owner declined a warning (book Decision 1).
- `not-offered` rows (exceptions), and a name, description or other per-duty detail on a menu.
- Different lists for different Assistants.
- Changing how the other Settings tabs, `/treasure-map` or Your Assistant's Treasure Map work.

## Open questions

None open. The seven questions were settled at intake (book § Decisions). The owner approved the draft as written
(2026-10-12), which settled the three points put to them at the gate:
- An Admin who is not a customer now gets Scores on their Assistant's menu (§ Background).
- The Copy stands.
- One story: drag-to-reorder is not split off.

## Deviations

- *(Implementation, 2026-10-12)* **Two Tester-side fixes to the Phase-3 tests.** Both were test defects, not changed
  expectations.
  - **U24 in `test/assistant-duty-menu-check.test.js`.** Its "a row more" variant appended a second `30382`. Once the
    six include `30382`, that is a duplicate key readers merge away (§ 5.3), so the variant now appends `30383`.
  - **A2 in `test/assistant-duties-settings.test.js`.** It now reads `src/api/index.js` raw. Its `codeOnly` helper took
    the `/*` in the string `'/api/settings/*'` for a comment opener and blanked the lines after it.
- *(Implementation, 2026-10-12)* **Two words the story's § Copy does not give.** The tab shows them while its first read
  is out, or when that read fails: "Loading…" and "Could not load the duties: this instance did not answer.". They live
  in `assistantDutiesCopy.js` with the rest.
- *(Implementation, 2026-10-12)* **The `getCustomer` dependency is gone from `src/api/assistant/dutyMenu.js`.** The offer
  no longer looks the viewer up (ADR sub-decision 3), and nothing else in that module used it.
- *(Implementation round 2, 2026-10-12)* **One more Tester-side fix.** In R3 of
  `test/assistant-duties-settings.test.js`, round 2's test design missed re-aiming the duplicate case. Its
  `30382::` is now refused as `bad-key` before it can be a duplicate, so the case uses `' 30382 '` instead, as L6 does.
  The fix has its own commit (`903c10e98`).
- *(Implementation, 2026-10-12)* **A follow-up ledger row.** `settings.json`'s in-place write, per ADR § Consequences, is
  ledger row `2026-10-12-settings-json-written-in-place`.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-duties-settings/0001-the-offered-duties-live-in-the-instance-settings.md`
- Test plan: `engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.test-plan.md`
- Review: `engineering-team/reviews/assistant-duties-settings/1-the-assistant-duties-tab.md`
