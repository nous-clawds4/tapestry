# Story 2: Turning your Assistant's self-Map on and off

**Status:** Approved
**Created:** 2026-10-12
**Type:** Feature
**Epic:** `assistant-self-map`
**Book:** `engineering-team/audits/assistant-self-map/book.md`

## Background

Story 1 built the read-only **Your Assistant's Treasure Map** page and its check. For the viewer's Assistant, the page
shows three things:
- which duties are live;
- what its self-Map should say;
- the self-Map found now.

The hub card is **Done** only when the found self-Map says exactly what this instance can truly claim (book
Decision 2). Nothing can publish a self-Map yet, so every Assistant with a live duty needs attention.

This story adds the buttons (book Decision 1: on once, then automatic; story 3 makes it automatic). As for the Duty
Menu (assistant-duty-menu #2), this instance signs as the person's own Assistant, because only it holds the
Assistant's key. It is the first time this instance signs a kind 10040 with an Assistant's key.

**The event is not the self-Map's alone.** A self-Map is the Assistant's kind 10040, read for its self-entries: the
entries whose element 2 is the Assistant itself (`protocols/drafts/treasure-maps.md` § 9, § 9.2). The same event can
carry:
- **entries naming other keys**, which are the Assistant's own requests (§ 9.2, No order, no copies). For the Owner's
  Tapestry Assistant (TA) these are this instance's own Treasure Map (§ 9.2, Keys the observer runs);
- **private entries** in its content (§ 9.2, Private duties).

So the publisher owns only the self-entries, and keeps everything else as it found it (book frame, "Nothing else is
lost"; CLAUDE.md principle 4). Nothing regenerates a kind 10040 blind.

**Turning it off retracts nothing.** Draft ADR `duty-menus-and-self-maps/0005` sub-decision 2 (**Proposed** at this
planning) says that removing or narrowing a self-entry while the key keeps publishing is "no stop". It ends the
claim, readers stop counting those insights as confirmed or maintained, and nothing else follows: no List
retraction, and no change to the Assistant's Scores, Lists or Concepts.

**What "on" would publish today** (book § Facts found at intake; story 1's worked example):
- Neither deployment's TA has a kind 10040 yet. So the Owner's first **Turn on** on staging creates this instance's own
  Treasure Map.
- It would hold one self-entry, Concepts at the staging relay. Scores aren't landing (ledger row
  `2026-10-12-ta-scores-stopped-landing`), and no List is claimed on this instance (story 1 § Deviations).

**Shared lines at this planning** (2026-10-12, `origin/staging` at `d6dcda0b`, merged into the branch as `19b6dd1`):
- **Draft ADR `duty-menus-and-self-maps/0005`** is still Proposed. If it changes before Review, this story follows it.
- **Book `assistant-duties-settings`, ADR 0001, is Accepted.**
  - The offered duties move into instance settings, each with its own relay.
  - Its sub-decision 6 edits `readUpkeep` in story 1's check.
  - A change on its Assistant Duties tab, a relay move included, changes what the self-Map should say. Until story 3,
    an "on" self-Map then reads out of date until the person presses **Update now**.
  - Whichever of the two lands second merges with the other.

**Carried to the Architect:**
- Story 1's review note R3-N2: filter the self-Map lookup's relay hints through the key reader, since this story reads
  the same hints.
- The new signing route needs its entry in the route access table, and the ADR names it (ledger
  `2026-10-11-adr-template-misses-route-table`).

**Show and Tell** (`design-philosophies/show-and-tell.md`): a self-entry is the key's own report of what it publishes,
never a choice of provider. Turning it on is not counted as a signal for anyone else; story 4 applies § 9.2's Counting
Maps rule to this instance's counters.

Who is affected: everyone with a Tapestry Assistant on this instance. Then the people and clients who read that
Assistant's self-Map before moving a duty to it.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want to turn my Assistant's self-Map on with one button,
bring it up to date when it drifts, and turn it off, without losing anything else my Assistant's Treasure Map holds,
so that anyone switching a duty to my Assistant can see which duties it really publishes.

## Acceptance criteria

- [ ] **AC-1: the remembered choice.** Each Assistant on this instance has a self-Map setting, **on** or **off**. It
      is off until its person turns it on.
  - **It belongs to this instance.** It is state that this instance authors, with no event behind it. It survives
    restarts, upgrades, firmware reinstalls and imports, and nothing rebuilds it from the relays (CLAUDE.md
    principle 4, BIBLE §30).
  - **The page can read it.** This action's answer carries it, for the viewer's own Assistant only.
  - **When it changes.** An accepted press (AC-3) changes it, even if this instance's relay then refuses the write.
    The report says what was published, and AC-2 keeps the button that fixes it available. A refused press changes
    nothing.
  - **What reads it.** In this story it changes only what the page shows and offers. Story 3 acts on it.
- [ ] **AC-2: the buttons and the report.** For a viewer with an Assistant, the page shows:
  - **One state line:** on or off (§ Copy). It also shows when the check did not finish.
  - **While off: Turn on.** It remembers on, and publishes what the self-Map should say (story 1 AC-3) when that differs
    from the self-Map found. When they already match, including when there is nothing to claim and no self-entry is
    found, it publishes nothing and says why.
  - **While on: Update now and Turn off.**
    - **Update now** publishes what the self-Map should say now. It is disabled while the self-Map is up to date, and
      enabled when it is out of date or the check did not finish.
    - **Turn off** remembers off and removes the self-entries (AC-5).
  - **Turn off while off.** It also shows while off whenever the self-Map found still has self-entries, so no claim
    can be stuck.
  - **While a press is under way,** every button is disabled and the pressed one shows **Publishing…**.
  - **The report.** It uses the Duty Menu's shape and the Outbox Relays page's per-relay words: one summary line, then
    one line per relay. A refusal, or a request that never answers, is one line saying nothing was published.
  - **After a press,** the page asks for the instance's answer again. Its panels, state and status lines, the hub card,
    the count line and the Assistant Alert all reflect the result. The report stays until the next press or a
    navigation.
  - **Nobody else sees them.** A visitor who is not signed in, or a viewer with no Assistant here, sees no button, as
    in story 1 AC-6.
- [ ] **AC-3: whose key, and what is signed.** The request says only which button was pressed. Whose Assistant signs
      comes from the session: for the Owner it is the instance's TA, and for anyone else their own Assistant.
  - **Refusals come first**, before any key is read: not signed in; no Assistant on this instance.
  - **What it signs.** One kind 10040 and nothing else. This instance builds it at publish time:
    - the self-entries are exactly what the self-Map should say, computed then (story 1 AC-3);
    - the rest is kept from the current version (AC-4).

    Nothing in the request can add, drop or change an entry, choose the relays, or pick another Assistant.
  - **Nothing else gains the power.** No other route can sign a kind 10040 as an Assistant. In this story, nothing
    publishes a self-Map on a schedule, at Assistant creation, or when something changes.
  - **Read back.** After **Turn on** or **Update now** has reached this instance's relay, story 1's check reads the
    self-Map as up to date. After **Turn off**, the found self-Map has no self-entries.
- [ ] **AC-4: nothing else is lost.** The new version is built from the newest version of the Assistant's kind 10040
      found at publish time, found as story 1 AC-4 finds it.
  - **What it owns.** It owns exactly the entries whose element 2 is the Assistant: § 9's self-entries, including any
    that readers ignore. It replaces them.
  - **What it keeps.** Every other tag is kept byte-for-byte, in its original order relative to the others. The
    content, where private entries live, is kept unchanged. For the Owner, that is all of this instance's own Treasure
    Map.
  - **One exception.** When the new version carries a self-entry, an `expiration` tag is dropped (§ 9.2, No
    expiration).
  - **Later than the last.** Its `created_at` is later than that of the newest version found (§ 9.2, When it changes).
  - **Never blind.** Sometimes this instance can't finish reading what a press needs:
    - for any press, the Assistant's current kind 10040;
    - for Turn on and Update now, also what the self-Map should say (story 1's check finishing).

    Then nothing is published, the remembered choice is unchanged, and the person is told why. "None found" is a
    finished read, and the new version then starts empty.
- [ ] **AC-5: off.** Turn off publishes a new version with every self-entry removed, and everything else kept, as
      AC-4 says.
  - **It retracts nothing:**
    - no List retraction;
    - no deletion request;
    - no change to anything the Assistant publishes (draft ADR `duty-menus-and-self-maps/0005` sub-decision 2).
  - **When nothing is left**, the new version has no tags and keeps its content. That is an empty Map, not a deletion.
  - **When the found self-Map has no self-entries**, Turn off remembers off and publishes nothing, and says so.
  - **The card**, by book Decision 2 (Done means on and true). While off, the card is **Needs attention** whenever
    there is something to claim, and **Done** when there is nothing to claim. Story 1's marking rules are unchanged.
- [ ] **AC-6: where it goes.** The new version is written to this instance's relay first. If that write fails, it is
      sent nowhere else, and the person is told. Then it goes, once to each relay, to the places § 9.2 (Finding a
      self-Map) asks:
  - the Assistant's outbox (write) relays, from its newest relay list;
  - every relay the new version's self-entries name;
  - every relay that a self-entry of the version found at publish time named, so that a removal reaches every relay
    that held the claim.

  **The Duty Menu's rules apply:**
  - In local-only mode, it is kept on this instance's relay, and the report says so.
  - A relay that comes from an event is connected to only when its address is public, and at most 50 such relays are
    tried.
  - A relay counts as reached only when it accepted the event. A slow, down or broken relay costs only its own line,
    and the report arrives within a bounded time.

## Copy

- **Buttons:**
  - **Turn on your Assistant's self-Map**;
  - **Update your Assistant's self-Map now**;
  - **Turn off your Assistant's self-Map**;
  - while a press is under way, **Publishing…** (the Duty Menu's word).
- **State line:**
  - on: "Your Assistant's self-Map is on."
  - off: "Your Assistant's self-Map is off."
  - off, with self-entries still found: "Your Assistant's self-Map is off, but the version found still claims duties."

  While on, story 1's status line follows, unchanged. While off, the state line replaces it.
- **For the Owner only,** by the buttons: "Turning your Assistant's self-Map on or off changes only its self-entries in
  this instance's own Treasure Map. Its other entries stay as they are."
- **Summary**, with the subject **Your Assistant's self-Map**, in the Duty Menu publish's sentence shapes:
  - "Your Assistant's self-Map was saved on this instance's relay and accepted by {a} of {n} relays." When some did not
    accept it, add " {n − a} did not accept it; see below."
  - "Your Assistant's self-Map was saved on this instance's relay, but none of the {n} relays accepted it; see below."
  - "Your Assistant's self-Map was saved on this instance's relay only: local-only publish mode is on, so it was not
    sent to any other relay."
  - "Your Assistant's self-Map was saved on this instance's relay. There was no other relay to send it to."
  - "Your Assistant's self-Map could not be saved on this instance's relay ({reason}), so it was not sent to any other
    relay."
- **After the summary:** after Turn off, "Your Assistant's self-Map now claims no duties."
- **When nothing was published:**
  - Turn on, nothing to claim: "Your Assistant's self-Map is on. Nothing is live to claim yet, so nothing was
    published."
  - Turn on, already matching: "Your Assistant's self-Map is on, and it already says what is live now, so nothing was
    published."
  - Turn off, nothing claimed: "Your Assistant's self-Map is off. It claimed nothing, so nothing was published."
- **Refusals:**
  - "Sign in to change your Assistant's self-Map."
  - "You don't have a Tapestry Assistant on this instance yet."
  - When AC-4's read did not finish: "Nothing was published: your Assistant's current Treasure Map could not be read,
    and publishing without it could lose its other entries."
  - For a request that fails or never answers: "This instance did not answer; nothing was published."
- **Per-relay lines:** the Outbox Relays page's, including "not sent: not a public address".

## Concepts touched

- `39998:<TA>:nostr-user`: nostr user. Whose Assistant signs: the viewer's own.
- `39998:<TA>:nostr-relay`: Nostr relays. Where each version goes, and the self-entries' relays.

No concept changes, and no firmware reinstall. The Architect resolves handles if needed: there is no live stack here.

## Out of scope

- **Keeping it true by itself (story 3).**
  - That covers adding a self-entry once a first full set lands, narrowing or removing one before upkeep stops, and
    hearing the stop points (book § Design notes). It also covers where a List retraction at a stop goes.
  - In this story an "on" self-Map changes only when its person presses.
- **Readers and counters (story 4), and `/treasure-map`'s badges (story 5).**
- **Choosing the self-entries.** The person can't edit, add or drop a self-entry, or claim less than is live. They
  publish what this instance computes, as with the Duty Menu.
- **The Owner turning another person's self-Map on or off** (owner, at this planning).
- **Any change to the entries the self-Map doesn't own**, this instance's own Treasure Map choices included, and to
  private entries. They are carried as found.
- **Changing what is live, or where it is published.** Scores not landing (ledger row
  `2026-10-12-ta-scores-stopped-landing`), customers' Lists (`_intake.md` 2026-10-11) and Lists' `d` tags (ledger row
  `2026-10-12-list-d-tags-not-treasure-maps`) all stay out.
- **Story 1's follow-ups** (owner, at this planning): ledger rows
  - `2026-10-12-stopped-timer-counts-as-upkeep`,
  - `2026-10-12-live-unclaimed-when-unclaimable` and
  - `2026-10-12-self-map-profiles-category-lines`.
- **A production release of this story alone.** It reaches production together with story 3 (owner, at this
  planning).
- **Any change under `protocols/`.** If § 9.2 or draft ADR 0005 changes before Review, this story follows it.

## Open questions

**Answered by the owner, 2026-10-12, at planning.** Each was answered as recommended. The owner approved the story
as drafted the same day ("Ready for architecture"), with six ACs kept as one story.

1. **Ship alone, or with story 3?** Story 2 reaches staging by a PR after its Review, so the owner can try on and off
   there. Production waits and goes out with story 3.
   - **The cost.** Until story 3 ships, another book's production promotion pinned after story 2's staging merge
     carries story 2 too.
   - **Why that's accepted:** no outside client reads self-Maps yet.
   - *(Chosen from: staging now and production with story 3 / production on its own / held on the branch until story
     3.)*
2. **What "on" means.** A choice this instance remembers for each Assistant, which story 3 acts on (AC-1). "On" holds
   while nothing is live, so story 3 knows to add a duty once it lands. *(Chosen from: a remembered choice / whatever
   the relays show.)*
3. **Off.** It removes the self-entries only, keeps every other entry and the content byte-for-byte and in order,
   and retracts nothing. When nothing remains, the new version is empty (AC-5). *(Chosen from: remove the self-entries
   only / the same, plus a deletion request.)*
4. **Who presses.** The viewer, for their own Assistant only, the Owner and customers alike (AC-3). *(Chosen from: the
   viewer for their own / also the Owner for customers.)*
5. **The buttons.** Turn on while off; Update now and Turn off while on. Turn off also shows whenever self-entries are
   still found. A press that would change nothing publishes nothing (AC-2). *(Chosen from: On, Update now and Off /
   just On and Off / Turn on always publishes.)*
6. **Story 1's three follow-ups** stay on the ledger (§ Out of scope). *(Chosen from: leave all three / fold in
   live-unclaimed / fold in all three.)*
7. **The branch.** `origin/staging`'s one new commit (`assistant-duties-settings` ADR 0001 accepted) is merged into
   the branch before this story is committed. *(Chosen from: merge it in / leave it.)*

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-self-map/0002-one-narrow-route-turns-the-self-map-on-and-off.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
