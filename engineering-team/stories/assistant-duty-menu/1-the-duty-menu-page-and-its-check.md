# Story 1: The Duty Menu page and its check

**Status:** Approved
**Created:** 2026-10-11
**Type:** Feature
**Epic:** `assistant-duty-menu`
**Book:** `engineering-team/audits/assistant-duty-menu/book.md`

## Background

The Assistant Management hub's **Duty Menu** card leads to a placeholder page and is always marked **Needs
attention** (assistant-duty-cards #1). The protocol behind it is now written: `protocols/drafts/duty-menus.md` passed
review (`duty-menus-and-self-maps` #2). The book's intake found it ready on the publisher's side (book § Readiness).

A **Duty Menu** says what one Assistant key *offers* to publish, and where (`duty-menus.md` § 1):
- **What it is.** It is one replaceable event per Assistant key, signed by that key, filed under one shared header
  that Nous publishes (§§ 3–4).
- **Its rows.** Each row is a Treasure Map key and the relay where the insights under that key will be published
  (§ 5).
- **What it doesn't say.** It says *offered*, never *active*. It creates no duty: duties come only from the
  person's own Treasure Map.
- **Who reads it.** Other instances and clients read it to fill the relay of a Map entry that names this Assistant,
  and to show what each Assistant offers.

The owner chose at intake (book Decisions 1 and 2):
- **What the page does.** It shows the menu this instance would publish for the person's Assistant, built from
  what the instance really does, beside the menu found for it now. One button publishes it, and the person does not
  edit the rows.
- **When the card is Done.** When a valid menu is found and it matches what this instance offers now.

This story is the reading half: what the instance offers, what is published, whether they match, the hub's real
mark, and the page that shows all three. Story 2 adds the button that has the Assistant sign and publish its menu.
The split follows the Outbox Relays epic (a check, then a page, then publishing; `assistant-outbox-relays` #1–#3).

**What this instance publishes today** (found at intake; the Architect confirms it):
- **Scores.** Kind `30382` only, for the Owner (signed by the instance's Tapestry Assistant) and for each active
  customer (signed by their own Assistant). They go to this instance's own relay. A copy goes to an outside relay
  only through a relay-router setting that is off by default.
- **Lists.** Kinds `30392`–`30394`, signed only by the instance's Tapestry Assistant, which is the Owner's
  Assistant. A customer's Assistant signs none.
- **Concepts.** Kinds `39998` and `39999`, signed by the person's own Assistant when they curate, sent to the DList
  relays in Relay Settings.

So, from today's publishing alone, menus would differ from viewer to viewer: the Owner's Assistant would offer more
than a customer's, and an admin who is not an active customer would get no Scores. At approval the owner settled Lists
(open question 2): every Assistant's menu offers Lists, a customer's included, because this instance commits to
building that support. The rest of the offer follows today's publishing.

Who is affected: everyone with a Tapestry Assistant on this instance. Later, the people and clients who look up that
Assistant to assign it duties.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want to see which duties my Assistant offers and where each
is published, next to the Duty Menu it has published, so that I know whether what other clients and Assistants are
told about my Assistant is up to date.

## Acceptance criteria

- [ ] **AC-1: the answer is about the viewer's own Assistant, and only theirs.** Given a signed-in viewer who has an
      Assistant on this instance (the same answer the hub's other checks use: for the Owner the instance's Tapestry
      Assistant, for anyone else their own), when the instance is asked, it answers for this action with three
      things:
  - **the offer:** what this instance offers for that Assistant (AC-2);
  - **the published menu:** the menu found for that Assistant now, or none, with whether the check finished and a
    reason when it did not (AC-3);
  - **current or not:** whether the published menu matches the offer (AC-4).

  The answer follows the session, and nothing in the request can change whose Assistant it is about. A visitor who
  is not signed in, or a signed-in viewer with no Assistant here, gets nothing for this action.
- [ ] **AC-2: the offer.** The offer is a list of rows in `duty-menus.md` § 5's terms, each offering one duty for
      *that* Assistant at one relay. It holds:
  - **Today's duties.** Every duty this instance publishes for that Assistant today (§ Background), each at a relay
    where others can find those insights now. Concepts count, though they are published when the person curates
    rather than on a schedule (open question 1).
  - **Lists, for every Assistant.** A customer's Assistant included, though today only the instance's Tapestry
    Assistant signs Lists: the owner commits this instance to building that support (open question 2). A List row
    names the relay where this instance publishes Lists.
  - **Nothing else.** Given a duty this instance neither publishes for that Assistant nor has committed to, such as
    Scores for an admin who is not an active customer, the offer has no row that covers it.
  - **Valid on its own.** Each row's key is a Treasure Map key that a person's Map could use to give that duty to
    this Assistant. No key is `39998:` or `39999:` (the trailing-colon forms § 5.3 tells readers to ignore). No
    two rows share a key, and no row has an empty relay.
  - **Public relays only.** A relay others can't reach, such as a local address or an instance with no public
    address, is not offered. Where that leaves a duty with no reachable relay, the duty has no row.
  - **When there are several relays.** Where a duty's insights can be found at more than one relay, the row names
    one, chosen by a single rule that the Architect states.
  - **No code change needed.** Changing the setting that decides where a duty's insights go (Relay Settings, or
    turning an outside copy on or off) changes the offer at the next check. *(Amended at Architecture, 2026-10-11;
    see § Deviations.)*
- [ ] **AC-3: which menu is "published".** The menu found for the Assistant is looked up as `duty-menus.md` § 8.1's
      reader rule says, with this instance's own relay asked too. Among the answers, the latest version counts.
  - If that version is not a menu by § 6.1 (kind `39999`, `d` = `duty-menu`, exactly one `p` equal to its author,
    Nous' `z`), the Assistant has no menu, even when an older version is one.
  - **Finished**: at least one relay asked, this instance's own relay included, answered. A relay that does not
    answer in time is skipped.
  - Reasons when the check did not finish: no relay answered; the instance itself did not answer.
- [ ] **AC-4: current, and the hub's mark.**
  - **Current** means that the published menu has the same rows as the offer, compared after § 5.3's key
    normalization and in any order. A row is a key, whether it is offered, and its relay. Name, description and
    per-duty details are not compared.
  - The card is **Done** when the check finished, a menu was found, and it is current. Otherwise it is marked
    **Needs attention**, including while the check is running and when it did not finish. It shows the hub's
    **Done** badge for checked actions when done.
  - The hub's count line counts the card the same way it is marked.
  - The Assistant Alert counts the action only on the confident reading: the check finished, and either no menu
    was found or the menu found is not current.
  - The other actions are marked and counted as today. Your Assistant's Treasure Map stays an always-marked
    placeholder. Visitors and viewers without an Assistant see no marks and no pill, as today.
- [ ] **AC-5: the page.** `/assistant/duty-menu` replaces its placeholder, styled like the hub's other built pages.
      It has the back link to Assistant Management, the title **Duty Menu** and the card's description.
  - **Signed out, or no Assistant here.** A visitor who is not signed in sees the sign-in line and button. A
    signed-in viewer with no Assistant here sees the hub's no-assistant line and its link to Account Setup.
    Neither sees the panels.
  - **The offer.** A panel **What your Assistant offers** shows the offer, one line per row. Each line shows which
    of the Treasure Map's categories the row belongs to (Scores, Lists or Concepts, as `/treasure-map` names
    them), its key and its relay, or "not offered" for an exception. When the offer is empty, the panel says so.
  - **The published menu.** A panel **Your Assistant's published Duty Menu** shows **Checking…** while the answer
    is on its way, then one of these:
    - the reason, when the check did not finish;
    - a line saying none is published;
    - the found menu's rows, shown like the offer's.

    It carries the hub's **Needs attention** or **Done** mark for this action, the same answer the hub card
    shows.
  - **One status line**, from AC-4: up to date, not published yet, or out of date.
  - **One line saying that the menu is public.** Anyone can find it and list it among every Duty Menu
    (`duty-menus.md` § 12).
- [ ] **AC-6: read-only, one request.** Nothing is published, signed or stored by this story. The answer comes with
      the other actions' answers, in the one request the hub already makes once per full page load for a signed-in
      viewer with an Assistant. There is no polling.

## Copy

- Page title and description: the card's (assistant-duty-cards #1 § Copy).
- **From the hub:** the back link, sign-in button, no-assistant line and link, and **Needs attention**
  (assistant-management #1 § Copy). The **Done** badge, with the screen-reader prefix **Done: **
  (assistant-profile-checklist #1 § Copy).
- Signed-out line: "Sign in to see your Assistant's Duty Menu."
- Offer panel heading: **What your Assistant offers**
  - Under it: "Duties this instance publishes for your Assistant, and the relay where each is published."
  - Empty: "This instance publishes no duties for your Assistant yet."
  - Exception: "not offered".
- Published panel heading: **Your Assistant's published Duty Menu**
  - Checking: **Checking…**
  - None: "Your Assistant has not published a Duty Menu yet."
  - Could not check: "No relay answered, so your Assistant's Duty Menu could not be checked." / "Could not
    check: this instance did not answer."
- Status lines:
  - "Your Assistant's Duty Menu is up to date."
  - "Your Assistant has not published a Duty Menu yet."
  - "Your Assistant's published Duty Menu is out of date: it differs from what your Assistant offers now."
- Public line: "Your Assistant's Duty Menu is public. Anyone can find it, and list it among every Assistant's Duty
  Menu."
- Category names: **Scores**, **Lists**, **Concepts** (`/treasure-map`'s).

## Concepts touched

- `39998:<TA>:nostr-user`: nostr user. Whose Assistant: the viewer's own.
- `39998:<TA>:nostr-relay`: Nostr relays. The offer's relays come from where the instance publishes.
- `39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu`: the Duty Menu header, Nous'
  Shared Concept. Its address is read in a menu's `z`. It is not published yet, and nothing here needs it to be.

No concept changes and no firmware reinstall. Nous' pubkey is a fixed community constant, not the per-deployment TA
pubkey (epic § Key facts).

## Out of scope

- **Publishing the menu**, the button and its report: story 2.
- **Per-duty details** (description, update interval, algorithm), `name`, `description` and the `storefront` link:
  whether story 2 publishes any of them is that story's question. This story neither shows nor compares them.
- **Changing what this instance publishes**, or where: for example turning on outside copies of Scores. Building List
  publishing for customers' Assistants, which their menus already offer (open question 2), is tracked in
  `engineering-team/stories/_intake.md` (2026-10-11, "Customers' Assistants publish Lists").
- **Your Assistant's Treasure Map** (self-Maps aren't ratified), `/treasure-map`, and the empty-relay fix (ledger
  `2026-10-10-external-assistant-relay-left-empty`).
- **Other Assistants' menus, the directory of providers, and the "all menus" query** (`duty-menus.md` §§ 8.2–9).
- **Any change under `protocols/`.** If `duty-menus.md` §§ 4–6.1 or § 8.1 change before Review (book
  `duty-menus-and-self-maps` stories 3–4), this story follows them.

## Open questions

**Answered by the owner, 2026-10-11, at story approval:** 1 (a); 2, the owner's own answer, below; 3 (b).

1. **Concepts on request.** A person's Assistant publishes Concept headers and items when the person curates, not on
   a schedule. Is that an offer?
   - (a) Yes. A menu says what the key will publish if a Map gives it the duty, and this is what the instance does.
   - (b) No, only duties the instance keeps up to date by itself.

   **Recommended: (a).** *Owner: (a).*
2. **Lists for a customer's Assistant.** The hub's Lists card says "your Assistant will publish kinds 3039x events
   on your behalf", but today only the instance's Tapestry Assistant signs Lists. So under AC-2 a customer's menu
   offers no Lists.
   - (a) Accept it: the menu tells the truth. Record the Lists card's wording as a separate follow-up.
   - (b) Hold the menu until customers' Assistants publish Lists.

   **Recommended: (a).** *Owner, in their own words: "Act as if the customer's menu does publish Lists. Our plan is
   to build support for it, even if we haven't yet."* AC-2 follows. The commitment is tracked in `_intake.md`
   (2026-10-11), and the hub's Lists card keeps its wording.
3. **When the offer is empty.** If this instance publishes nothing for an Assistant, should the card need attention
   until that Assistant publishes an empty menu?
   - (a) No. With an empty offer, no menu at all also counts as current. A found menu that still has rows is out of
     date, so a menu can be withdrawn.
   - (b) Yes. Done always needs a published menu, an empty one included.

   **Recommended: (a).** Asking someone to announce that they offer nothing is noise. A stale menu still gets
   flagged. *Owner: (b).* AC-4 stands as written: Done needs a found menu, and with an empty offer an empty menu
   is current.

## Deviations

- **AC-2, "no code change needed" (Architecture, 2026-10-11; the owner chose relay rule R1 at ADR 0001's gate).**
  Each row names this instance's own relay at its public address, which holds every offered insight. Without a
  public address, Concepts take the first public DList relay, and Scores and Lists get no row.
  - The settings that change the offer are therefore: the instance's relay address, the viewer's customer status,
    and Relay Settings' DList relays (only when there is no public address).
  - Turning a relay-router copy on or off does not change it. The bullet's example of an outside copy no longer
    applies; "no code change" still does.
- **AC-2, which List kinds (Architecture, 2026-10-11; the owner chose key rule K1).** Lists are offered as the kinds
  built today, `30392`, `30393` and `30394`, not the whole `3039x` family.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md`
- Test plan: `engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.test-plan.md`
- Review: (filled in after Review phase)
