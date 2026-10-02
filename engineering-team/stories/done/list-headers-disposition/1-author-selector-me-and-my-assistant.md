# Story 1: Me and My Local Tapestry Assistant in the List Headers Author selector

**Status:** Done
**Created:** 2026-10-01
**Type:** Feature
**Epic:** `list-headers-disposition`
**Book:** `engineering-team/audits/list-headers-disposition/book.md`

## Background

The List Headers page (Simple Lists › List Headers) lists every list header in the instance's
relay, from every author. Its Author selector names authors by who they are on the instance: the
Owner, the Owner's Assistant, and everyone else by profile name. Nothing in it means "me." A
signed-in person who wants to find their own headers has to know their own pubkey, or their
Assistant's, and pick it out of the list.

This book builds a Disposition feature on this page, and its rule is that a person can act only on
headers they wrote or their own Assistant wrote. So the page needs a way to say "mine" first. This
story adds it, and changes nothing else.

## User-facing description

As a signed-in person, I want to choose **Me** or **My Local Tapestry Assistant** in the Author
selector, so that I can see just the list headers I wrote, or just the ones my Assistant on this
instance wrote, without knowing either pubkey.

## Acceptance criteria

- [ ] Given a signed-in person who has an Assistant on this instance, when they open the Author
      selector, then it reads, in order: **All authors**, **Me**, **My Local Tapestry
      Assistant**, then the same author entries it shows today, in today's order.
- [ ] Given that person, when they choose **Me**, then the table lists only headers (kind 9998 and
      39998) whose author is the person's own account, and the count line reads
      "<shown> of <total> lists".
- [ ] Given that person, when they choose **My Local Tapestry Assistant**, then the table lists
      only headers whose author is the Assistant this instance holds *for that person*. When the
      person isn't the Owner, no header signed by the Owner's Assistant appears.
- [ ] Given a signed-in person with no headers under one of the two options, when they choose it,
      then the option is still there and the table shows today's "No DLists match your filters"
      message. The option is never hidden just because nothing matches.
- [ ] Given a signed-out visitor, when they open the Author selector, then neither option appears
      and the selector is exactly as it is today. Given a signed-in person with no Assistant on this
      instance, then **Me** appears, and **My Local Tapestry Assistant** appears but can't be
      chosen, labelled as having none on this instance.
- [ ] Given two people signed in on the same instance, each in their own session, when each chooses
      **Me** (or **My Local Tapestry Assistant**), then each sees only their own rows. Neither
      ever sees the other's.

## Concepts touched

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:list` — **list**, "a list
  header with associated list items" (the rows this page lists). Handle as it reads in this
  machine's graph; the pubkey part differs per instance.
- The signed-in person's Assistant on this instance. The same "local" Assistant the My Assistants
  page marks as **Local**. Not a concept-graph node; the Architect resolves where it comes from.

## Out of scope

- The 🧭 b-disposition column (story 2) and the Disposition panel (stories 3 and 4).
- Remembering the chosen author across visits.
- Changing the existing author entries: the 👑 Owner, 🧑‍💻 Dave and 🤖 Assistant entries stay as
  they are. For the Owner, **Me** and **👑 Owner** pick the same rows, and so do **My Local
  Tapestry Assistant** and **🤖 Assistant**. That's fine; one is relative, one is absolute.
- The Kind selector, and the Author selector on any other page (Concept Headers included).

## Open questions

None. Three choices were made as defaults when this draft was written, and the owner confirms them
by approving the story:

1. The two options sit just below **All authors**, which stays first and stays the default.
2. They appear even when nothing matches (AC 4), so a person can find out they have none.
3. A person with no Assistant here sees **My Local Tapestry Assistant** greyed out, not hidden
   (AC 5).

## Linked artifacts
- ADR: `engineering-team/decisions/done/list-headers-disposition/0001-me-and-my-assistant-from-the-signed-in-user.md`
- Test plan: `engineering-team/stories/done/list-headers-disposition/1-author-selector-me-and-my-assistant.test-plan.md`
- Review: `engineering-team/reviews/done/list-headers-disposition/1-author-selector-me-and-my-assistant.md`
