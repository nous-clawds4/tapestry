# Story 4: Is each Assistant's NIP-05 genuine, and a way into each Assistant's profile

**Status:** Done
**Created:** 2026-10-01
**Type:** Feature
**Epic:** `my-assistants`
**Book:** `engineering-team/audits/my-assistants/book.md`

## Background

Stories 1–3 are on staging. Using the page during the shipping checks, the owner hit two gaps (2026-10-01):

- **A NIP-05 is shown, but nothing says whether it's genuine.** A profile can claim any NIP-05. It means something
  only when that domain confirms the identifier belongs to this profile. Telling a real Assistant from an impostor
  depends on that, and the page doesn't say.
- **There's no way from an Assistant to its profile page.** To check whether the tags on an Assistant are right, the
  owner needs that Assistant's profile page. It shows the tags applied to the profile and the taggings it authored.
  Today that means copying an npub and pasting it somewhere else.

The book adds this story before it closes (book decision 14), so the page ships to production with both.

The app already checks NIP-05s on its profile pages, which show a "verified" mark or nothing. That can't say "this is
wrong" apart from "the domain didn't answer". This page says which (§ Resolved at the story gate 1). It follows the
same honesty rule as story 3: nothing claims a verdict it doesn't have.

## User-facing description

As someone keeping track of my Assistants, I want to see whether each Assistant's NIP-05 is confirmed by its domain,
and to open any Assistant's profile page from the My Assistants page, so that I can tell genuine Assistants from
look-alikes, and check that the tags on each one are right.

## Acceptance criteria

- [ ] **AC-1: a NIP-05's status, in three honest states.** Given an Assistant whose profile has a NIP-05, the page
  shows, beside that NIP-05:
  - **Verified**, when the NIP-05's domain confirms that identifier belongs to this Assistant's profile;
  - **Not valid**, when the domain gave a readable answer and it doesn't list that identifier for this profile. This
    covers an identifier that isn't a well-formed NIP-05 at all;
  - **Couldn't check**, when the domain gave no readable answer: it didn't answer, timed out, or answered with
    something that isn't a NIP-05 listing.

  While the check is under way, the page says it's checking, never a verdict. It never shows **Not valid** for a
  check that didn't get a readable answer.
- [ ] **AC-2: where it shows.** The status appears everywhere the page shows an Assistant's NIP-05:
  - each row of the Assistants list, your own Assistant here included;
  - each Assistant in **On your Treasure Map, but not tagged**.

  An Assistant with no NIP-05 shows "—" as today, with no status. The search results are unchanged.
- [ ] **AC-3: the status says what it means.** Each status can be told apart without colour alone. A screen reader
  hears the status with its NIP-05, and pointing at a status explains it (§ Copy).
- [ ] **AC-4: a link to each Assistant's profile.** Every Assistant the page shows can be opened on its Brainstorm
  profile page (`/user/<its pubkey>`), which shows the tags applied to it and the taggings it authored:
  - in an open row of the Assistants list, your untagged Assistant here included;
  - in **On your Treasure Map, but not tagged**, for each Assistant;
  - in an open duty on the Duties tab, for each of its Assistants, Preferred and Alternates.
- [ ] **AC-5: the link opens a new tab.** The profile opens in a new tab, so `/assistants` stays where it was. A screen
  reader hears which Assistant each link is for, and that it opens a new tab.
- [ ] **AC-6: nothing else changes.** Opening, tagging, changing, removing and the Treasure Map work as before. Pressing
  a profile link doesn't open or close the row it's in.

## Copy

**New** unless marked. Curly apostrophes, as on the rest of the page.

| Element | Text |
|---|---|
| Verified | Verified (with a check mark) |
| Verified, on pointing at it | Its domain confirms this NIP-05 belongs to this profile. |
| Not valid | Not valid |
| Not valid, on pointing at it | Its domain doesn’t list this NIP-05 for this profile. |
| Couldn't check | Couldn’t check |
| Couldn't check, on pointing at it | Its domain didn’t answer, so this NIP-05 couldn’t be checked. |
| While checking | Checking… |
| Profile link | View profile ↗ |
| Profile link, for a screen reader | View profile of {name} (opens in a new tab). **Changed at the ADR gate** (ADR 0004 sub-decision 5): an accessible name must contain the visible words. |

## Concepts touched

- **NIP-05** (the nostr identifier protocol), not a concept in the graph. The page reads a domain's answer and
  publishes nothing.
- `39998:<TA>:nostr-user-tag`, nostr user tag. Unchanged: the profile page the link opens is where these taggings are
  shown. Resolve the TA at runtime.

## Out of scope

- **Changing the profile pages,** including their own "verified" mark, which keeps showing a mark or nothing.
- **NIP-05 status in the search results.**
- **Re-checking on demand.** A status is checked when the page shows the Assistant, and again on the next load.
- **Anything about what the profile page shows,** or editing tags from it.

## Open questions

None open. The four raised with the request were answered by the owner on 2026-10-01, below.

## Resolved at the story gate

The owner's answers, 2026-10-01:

1. **Three states, Verified, Not valid and Couldn't check,** rather than a mark or nothing. A failed check is never
   called invalid.
2. **The status shows in the Assistants list and in the not-tagged section,** not in the search results.
3. **The link goes to the Brainstorm profile page** (`/user/<pubkey>`), not the Tapestry users page.
4. **The link appears everywhere an Assistant shows,** opening in a new tab: the list's open rows, the not-tagged
   section, and the Duties tab's open duties.

## Deviations

Small judgment calls made in Implementation (2026-10-01):

- **Where the status sits.** In the list it's on its own line under the NIP-05, because a row's NIP-05 field stacks
  its label and value. In the not-tagged section it follows the NIP-05 on the same line. Both read as "NIP-05, then
  its status".
- **Where the link sits.** In an open row it's after Manage on Treasure Map, before Change and Remove. In the section
  it's first in each item's actions, before the Tag buttons. In an open duty it's at the end of each Assistant's line.
- **An answer that is an array,** like any other answer without one of the three statuses, reads Couldn't check.
- **openapi** documents `GET /api/nip05/verify` for the first time, under Profiles, in the "Search / Profiles"
  section.
- **Checked against real domains, from Node, reads only.**
  - Nous's Brainstorm Assistant's NIP-05, `matrix_end_178d@brainstorm.world`, is listed for `4b7ba0a1…`. It reads
    verified for that key and invalid for another.
  - An unlisted name on the same domain reads invalid.
  - A domain that doesn't exist reads unchecked.

  The page itself was checked with the mocked answers, at desktop and 375 px. The local container wasn't updated
  (it has no bind mount), so the server change reaches an instance only by deploy.


After review 1 (2026-10-01), fixed before shipping by the owner's choice:

- **A status belongs to the NIP-05 it was checked for** (NB1; ADR 0004 Amendment 1). Each answer is kept with its
  (pubkey, NIP-05) and drawn only for that pair. When a drawn row's NIP-05 changes, it shows "Checking…", never the
  old verdict (N7).
- **How often the page asks is now stated exactly** (NB2): a definite answer once per page load; a Couldn't check again
  each time it's drawn again (N6).
- **The DNS-rebinding row says what `status` adds** (NB3).
## Linked artifacts
- ADR: `engineering-team/decisions/my-assistants/0004-nip05-status-from-the-verify-endpoint-and-plain-profile-links.md`
- Test plan: `engineering-team/stories/my-assistants/4-nip05-validity-and-profile-links.test-plan.md`
- Review: `engineering-team/reviews/my-assistants/4-nip05-validity-and-profile-links.md`
