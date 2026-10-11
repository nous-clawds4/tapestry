# Story 2: Your Assistant publishes its Duty Menu

**Status:** Approved
**Created:** 2026-10-11
**Type:** Feature
**Epic:** `assistant-duty-menu`
**Book:** `engineering-team/audits/assistant-duty-menu/book.md`

## Background

Story 1 built the Duty Menu page. It shows what this instance offers for the viewer's Assistant beside the menu found
for it now, and the hub card is **Done** only when a valid menu is found and matches the offer. Nothing can publish
a menu yet, so every card needs attention.

This story adds the button (book Decision 1: preview and publish; the person doesn't edit the rows). As on the Outbox
Relays page (assistant-outbox-relays #3), this instance signs as the person's own Assistant, because only it holds
the Assistant's key. What it signs is a Duty Menu as `protocols/drafts/duty-menus.md` defines it:
- one replaceable kind-`39999` event;
- `d` = `duty-menu`;
- `p` = the Assistant;
- Nous' `z`;
- one row per duty.

The spec also says where a publisher sends each version (§ 8.1), and that withdrawing is a republish with no rows
(§ 11).

The book's Decision 2 and the owner's answer 3(b) to story 1 make an empty menu meaningful: when this instance offers
nothing for an Assistant, Done still needs a published menu, an empty one.

Story 1's review left three things for this story (epic, story 2's carry-forwards):
- **Hub latency.** Every hub load waits up to 8 s for the slowest outside relay, even when this instance's relay holds
  the menu. Once this story writes every menu here first, this instance's relay is where the newest version lives. The
  spec lets a reader ask fewer relays (§ 8.1, "Fewer relays").
- **An empty menu shows nothing.** A found menu with no rows shows only its heading and mark.
- **For the Architect: the author check.** The validity check takes the author as given and never compares it with
  the event's signer, so a publisher or reader must not rely on it alone.

Who is affected: everyone with a Tapestry Assistant on this instance. Then the people, instances and clients that look
the Assistant up to give it duties.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want to press one button and have my Assistant publish its
Duty Menu, and see which relays took it, so that other clients and Assistants learn what my Assistant offers and
where, and my hub card shows Done.

## Acceptance criteria

- [ ] **AC-1: the button and its report.** The Duty Menu page has one button, **Have your Assistant publish its Duty
      Menu**, for a viewer with an Assistant.
  - **When it's enabled.** When the published menu is not current: none was found, it differs from the offer, or the
    check did not finish. It is disabled while the menu is up to date, and shows **Publishing…** (disabled) while a
    publish is under way.
  - **The report.** When the publish answers, the page shows one summary line and one line per relay, in the words
    and styles of the Outbox Relays page's report: accepted, refused (with the relay's own reason), unreachable or
    timed out, not sent because the address isn't public, or kept local by configuration. A whole-request refusal, or
    a request that never answers, is one line saying nothing was published.
  - **After a write.** When a menu was written, the instance's answer is asked for again, so the page's panels, its
    status line, the hub card, the count line and the Assistant Alert all reflect the new menu. The report stays
    until the next press or a navigation.
- [ ] **AC-2: whose key, and what is signed.** The request names nothing. Whose Assistant signs comes from the
      session (for the Owner the instance's Tapestry Assistant, for anyone else their own).
  - **Refusals come first,** before any key is read: not signed in; no Assistant on this instance.
  - **What it signs.** A kind-`39999` Duty Menu and nothing else, built by this instance at publish time from the
    offer as story 1 computes it. Nothing in the request can add, drop or change a row. No other route gains the
    power to sign as an Assistant, and nothing publishes a menu at Assistant creation or on a schedule.
- [ ] **AC-3: the event.** A kind-`39999` event signed by the viewer's own Assistant, with empty content:
  - **Required tags:** `d` = `duty-menu`; exactly one `p`, the Assistant itself; and Nous' `z`,
    `39998:<Nous>:duty-menu`. It passes `duty-menus.md` § 6.1, all five conditions;
  - **The rows:** one `["duty", "<key>", "<relay>"]` per row of the offer, in the offer's order. When the offer is
    empty, the menu has no rows and is still published (§ 11);
  - **Other tags:** none (rows only: open question 1);
  - **A newer version wins everywhere.** Its `created_at` is later than the newest version found at publish time,
    so it replaces that version on every relay.

  Read back by story 1's check, the new menu is current, so the card is **Done**.
- [ ] **AC-4: where it goes.** It is written to this instance's relay first. If that write fails, it is sent nowhere
      else, and the person is told so. Then it goes, each relay once, to the places § 8.1 asks a publisher to send
      every version:
  - the Assistant's outbox (write) relays, from its newest relay list;
  - every relay the new menu's rows name;
  - every relay that the rows of the menu found at publish time named, so no relay keeps an older offer;
  - Nous' write relays, when Nous' relay list is found.

  **Further rules:**
  - **Local-only mode.** The menu is kept on this instance's relay, and the report says so.
  - **Public addresses only.** A relay that comes from an event (the relay lists, or the menu found) is never
    connected to unless its address is public, and its report line says it was not sent. As in story 1, at most 50
    such relays are tried.
  - **What counts as reached.** A relay counts only when it accepted the event. A slow, down or broken relay costs
    its own line and nothing else, and the person gets the report within a bounded time.
- [ ] **AC-5: this instance's relay first, when reading** (story 1's carry-forward; it replaces story 1 AC-3's "the
      latest version among every answer").
  - **When this instance's relay holds the menu.** If it holds any version of the Assistant's menu, the newest there
    counts and no outside relay is asked.
  - **When it holds none.** Only then are § 8.1's places asked, and the newest found counts. If the version that
    counts is not a menu by § 6.1, the Assistant has none, as before.
  - **"Finished"** keeps story 1's meaning.
  - **The effect:** after a publish, a hub load no longer waits on outside relays for this action.
- [ ] **AC-6: an empty menu says so.** When the menu found has no rows, the published panel says so in a line (§ Copy),
      under its heading and mark.

## Copy

- **Button:** **Have your Assistant publish its Duty Menu**. While publishing: **Publishing…** (the Identification
  Tags page's word).
- **Summary,** with the subject **Your Assistant's Duty Menu**, in the profile publish's sentence shapes:
  - "Your Assistant's Duty Menu was saved on this instance's relay and accepted by {a} of {n} relays." When some did
    not accept it, add " {n − a} did not accept it; see below."
  - "Your Assistant's Duty Menu was saved on this instance's relay, but none of the {n} relays accepted it; see below."
  - "Your Assistant's Duty Menu was saved on this instance's relay only: local-only publish mode is on, so it was not
    sent to any other relay."
  - "Your Assistant's Duty Menu could not be saved on this instance's relay ({reason}), so it was not sent to any other
    relay."
- **Empty menu,** after the summary: "Your Assistant's Duty Menu now lists no duties."
- **Refusals:**
  - "Sign in to have your Assistant publish its Duty Menu."
  - "You don't have a Tapestry Assistant on this instance yet."
  - For a request that fails or never answers: "This instance did not answer; nothing was published."
- **Per-relay lines:** the Outbox Relays page's, including "not sent: not a public address".
- **AC-6,** the published panel: "Your Assistant's Duty Menu lists no duties."

## Concepts touched

- `39998:<TA>:nostr-user`: nostr user. Whose Assistant signs: the viewer's own.
- `39998:<TA>:nostr-relay`: Nostr relays. Where the menu goes.
- `39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu`: the Duty Menu header (Nous'
  Shared Concept). Named in every menu's `z`. Not published yet, and nothing here needs it to be.

No concept changes and no firmware reinstall.

## Out of scope

- **Publishing automatically:** at Assistant creation, when the offer changes, or on a schedule. Retrying failed
  relays later.
- **A NIP-09 deletion beside a withdrawal** (§ 11 makes it optional).
- **A `storefront` tag.** This instance has no storefront key.
- **The person editing rows** (book Decision 1). **Changing what this instance offers** (`_intake.md`, 2026-10-11,
  customers' Lists).
- **Your Assistant's Treasure Map** (self-Maps), and `/treasure-map`'s relay fill.
- **The rest of story 1's review notes** that change no behavior (header comments, the BIBLE row's detail, the
  security sentinel's shape). The Architect may fold them into this story's ADR, or leave them on the epic.

## Open questions

**Answered by the owner, 2026-10-11, at story approval:** 1 (a), rows only.

1. **What a menu carries besides its rows.** § 5.4 and the base NIP allow a `name`, a `description` and per-duty
   details (a description, an update interval and an algorithm per key).
   - (a) Rows only. The Assistant's profile (kind 0) already names it, and this instance has no agreed descriptions,
     intervals or algorithm names for its duties yet.
   - (b) Rows and a `name`, the Assistant's profile name.
   - (c) Rows, a `name`, and per-duty details, with the words agreed at approval.

   **Recommended: (a).** It keeps the menu to what this instance can state truthfully today. Details can follow in
   their own story.

## Deviations

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-duty-menu/0002-the-assistant-signs-its-duty-menu-through-one-narrow-route.md`
- Test plan: `engineering-team/stories/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.test-plan.md`
- Review: (filled in after Review phase)
