# Story 3: Another assistant's curation opens read-only, with an offer to curate it here

**Status:** Done
**Created:** 2026-09-12
**Type:** Feature

## Background
A Treasure Map names at most one curating assistant per list, and every instance a user signs in to
reads the same Map (`curated-dlist-update` ADR 0001 Decision §8; `protocols/drafts/assistant-designation.md`
§ "Across instances" — OPEN.md row 267, settled). So a list my assistant curates on one instance is, on
every other instance, a list empowered for another pubkey. The spec lets such an instance show that
curation read-only, and offer to replace the Map entry with one naming its own assistant.

Today that curation cannot be seen anywhere but its own instance:
- My Curated DLists lists the row but does not open it ("Only lists your own assistant curates open
  here."), and a user with no assistant on the instance can open no list at all (`my-curated-dlists`
  #1 AC-4).
- The detail page, reached directly, says the list "is empowered for another pubkey" and shows nothing
  else (`my-curated-dlists` #1 AC-5).

A real case: production's owner has one Treasure Map, and it names staging's Tapestry Assistant
(`8e901369…`) for `dog-breed` — so on production that curation shows as another pubkey's and does not
open (`my-curated-dlists` close, 2026-09-11).

The TA Treasure Map page's DList Curation panel already offers **Replace** for a list whose entry names
another assistant, but its confirmation says the Map update "adds" the entry. It never says that the
other assistant stops curating the list.

## User-facing description
As a user whose Treasure Map empowers an assistant that is not my assistant on this instance — for
example, my assistant on another instance — I want to open that curated list here and see it
read-only, and be offered to curate it here instead, so that I can see what my curation holds wherever I
sign in, and move it on purpose, knowing my Map allows one curating assistant per list.

## Acceptance criteria
- [ ] **AC-1 (every empowered list opens).** On My Curated DLists, a row naming another pubkey is a
      link to the list's detail page, as my own assistant's rows are. It still says who curates the
      list (another pubkey, in short form), and says it opens read-only — in place of "Only lists your
      own assistant curates open here." With no assistant on this instance, every row opens read-only,
      and the page's line says I can view these lists here but not curate them (Planning gate,
      decision 2). Amends `my-curated-dlists` #1 AC-4.
- [ ] **AC-2 (the read-only page shows the curation).** A list my Map empowers for another pubkey —
      reached from the list or directly — opens read-only. It shows:
      - the list's name, kind and d-tag, and "curated by another assistant" with that assistant's short
        pubkey — never "your assistant";
      - a line saying the list is read-only here because my Map names that assistant, not mine on this
        instance;
      - that assistant's header, found here or at the entry's relay hint, with today's not-found and
        couldn't-check states. It is shown as authored by that assistant, with no "not authored by your
        assistant" warning;
      - the shared header that assistant's header links to;
      - the items, judged from that assistant's side: its items by default, and on request the items
        others added and the candidates to copy (a candidate is a shared item that assistant has not
        copied).

      The front door's other cases — signed out, a bad address, a Map error, no Map, not on my Map —
      are unchanged. Amends `my-curated-dlists` #1 AC-5.
- [ ] **AC-3 (nothing on the page acts on another assistant's curation).** On a read-only list:
      - Update list is disabled, with a line saying it runs only on the instance where the list's
        assistant lives — and that I can curate the list here instead, when AC-4 applies;
      - the Curation method panel is not offered; one line says the method is set where that assistant
        lives;
      - no note or warning promises an action this page cannot take. A header with the older link says
        it uses the older link type, without saying Update list will upgrade it;
      - Import to local strfry, for a header found only on a relay, works as it does today. It stores the
        event exactly as signed, and curates nothing (Planning gate, decision 1).
- [ ] **AC-4 (the offer to curate it here instead).** When I have an assistant on this instance, and
      the list is a kind-39998 list whose curating assistant's header names a shared header, the
      read-only page offers to curate it here instead.
      - Before anything is signed, I am told in plain words: my Treasure Map names one curating
        assistant per list, so after this my assistant here curates the list and the other assistant
        (by its short pubkey) no longer does. That assistant's header and copies stay where they are. My
        assistant here curates through its own header for this list.
      - Accepting does what the DList Curation panel's Replace does for that shared list. My assistant's
        header is authored first, or found already existing. Then I review the Map update and sign it
        with my extension.
      - Cancelling at any point changes nothing.
      - After the Map is published, the list opens here as mine.
      - Without an assistant on this instance, for a kind-39999 list, or when the shared header cannot be
        told, the page says why it offers nothing (Planning gate, decision 3).
- [ ] **AC-5 (nothing else moves).**
      - Lists naming my assistant here open exactly as in story 2.
      - The Treasure Map convention, the header endpoint, Map Entries and the Simple Lists pages are
        unchanged.
      - The TA Treasure Map page changes only as far as AC-4's words require.
      - Nothing is signed or published except through AC-4's offer, and only after I confirm.

## Concepts touched
The TA pubkey is per deployment, resolved at runtime (`11f23fe4…` on this machine).
- `39998:<TA>:list` — list (the curated lists; now opened read-only when another assistant curates
  them)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (the assistant a Map entry names; "mine" is the
  signed-in user's own on this instance)
- `39998:<TA>:shared-concept` — shared concept (the community header the curating assistant's header
  links to; what "curate it here instead" curates)
- The Treasure Map itself (kind 10040) has no concept handle.

## Out of scope
- Update list and copying (story 5); the curation method's controls (story 4).
- Telling whether another pubkey is "my assistant on another instance" or someone else: the page
  shows the pubkey and does not guess.
- Moving the other assistant's copies; revoking or deleting its header.
- Offering "curate it here instead" from the list page — only the detail page offers it.
- Curating a kind-39999 list here (the header endpoint takes kind-39998 targets only).
- Any protocol change (row 267 was settled with none).

## Open questions
None. Resolved at the Planning gate (2026-09-12), each as proposed:
1. **Import on a read-only page** stays. "Import to local strfry" is offered for another assistant's
   header when it is found only on a relay, as the shared-header section already offers it for someone
   else's event.
2. **No assistant on this instance:** every list opens read-only.
3. **The offer's reach:** "curate it here instead" is offered only for a kind-39998 list whose shared
   header is known — what the DList Curation panel's Add and Replace already support.

Origin drift at planning: the branch is 2 commits behind `origin/staging`, neither in this story's
areas. The merge waits for the staging PR, where this book's OPEN.md rows are renumbered once.

## Deviations
- **Starting point.** The implementation is the Test Design phase's sketch, copied in unchanged from its
  throwaway worktree (base `8c48e83f`). Every story suite and seven neighbouring suites had passed
  against it.
- **Small choices the ADR does not spell out.**
  - The list page's row prop `explainClosed` is renamed `explainReadOnly`, because its meaning changed.
  - The offer shows nothing while the curating assistant's header is still being checked (`checking` is
    not a reason); after that it shows the button or the reason.
  - The headers module's opening comment now says the import is *this module's* only write, since the
    offer writes from `CurateHereOffer.jsx`.
- **Local check (cycle-local).** This was a UI-only change: the build was copied into the container (it is
  not bind-mounted), with no restart. The served bundle is the new one, carrying the new strings and none of
  the retired ones. Signed-in pages were checked through the fetch stub, as staging's customer, whose real
  Map names `253d40c4…` for `dog-breed`:
  - **Another assistant key:** the list row links, with "Opens read-only here." The detail page shows the
    read-only line, "Its assistant's DList header", "Authored by the curating assistant", "(older link)"
    with "only its own assistant can upgrade it", the method line, and Update's read-only line with the
    offer.
  - **The offer:** its words appear with no request sent. Continue against the real server was refused
    with "Authentication required for this action", so nothing was signed. With the endpoint stubbed in
    the page, the review read "Map update: replaces 253d40c4…6ec0's entry for 39998:dog-breed with your
    assistant @ wss://dcosl.brainstorm.world." Cancel cleared it.
  - **No assistant:** the no-assistant read-only line, the reason "You can't curate it here: you don't have
    a Tapestry Assistant on this instance.", and the list page's line.
  - **As the curating assistant itself:** the list opens as mine, exactly as in story 2.
  - **The DList Curation panel's Replace:** the confirmation says "replaces", followed by the two
    sentences. The TA Treasure Map page's own Map search hit OPEN.md row 260's relay-list race (it
    searched before its relay list arrived), so the real staging Map event was served to its local lookup
    by the stub.
  - **Never done:** Sign & publish was never pressed. A real replacement needs a NIP-07 signer.
- **Regression.** The story's suites and seven neighbouring suites: 231 passed, 0 failed, through their
  `run()` exports; harness-lint clean. Full `npm test`: 169 suites green, 4 skipped, and 3 red with 4
  failing tests — exactly OPEN.md row 191's (three L0 GUARD refusals and the refused prune; this machine
  publishes externally by the operator's choice). Row 261's two LB matrices were skipped this run, not
  failed.

## Linked artifacts
- ADR: `engineering-team/decisions/curated-dlist-update/0003-read-only-curation-and-curate-here.md`
- Test plan: `engineering-team/stories/curated-dlist-update/3-another-assistants-curation-read-only.test-plan.md`
- Review: `engineering-team/reviews/curated-dlist-update/3-another-assistants-curation-read-only.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
