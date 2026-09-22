# Story 1: The one answer — which identification taggings are missing for your Assistant — and the hub's first real mark

**Status:** Approved
**Created:** 2026-09-22
**Type:** Feature
**Epic:** `assistant-identification-tags`
**Book:** `engineering-team/audits/assistant-identification-tags/book.md`

## Background

The Assistant Management hub at `/assistant` marks all ten actions as needing attention for anyone
with an Assistant, because nothing is checked yet (assistant-management #1). Its count line and the
Assistant Alert count the same marks (assistant-management #2). The owner's alert criteria for the
Identification Tags action: "if any of the required Taggings are missing".

A tagging is a signed assertion that a pubkey belongs to a tag. Four taggings make the handshake
between a person and their Tapestry Assistant (Discovery decisions 5–7, 9):

| # | Tagging | Who signs | Whom it tags |
|---|---|---|---|
| 1 | My Tapestry Assistant | you | your Assistant |
| 2 | My Agent | you | your Assistant |
| 3 | My Tapestry Owner | your Assistant | you |
| 4 | My Human | your Assistant | you |

This story gives the instance one answer to "which of the four are present for this viewer's own
Assistant", and makes the hub's Identification Tags card, its count line and the Assistant Alert read
that answer, while the other nine actions still count as they do today. It follows the `/setup`
pattern: one server answer for the signed-in viewer, shared by the page and its alert
(setup-status-and-alert #1). The page itself, and publishing, are stories 2 and 3.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want the hub to tell me whether the four
identification taggings between me and my Assistant exist, and to stop asking once they do, so that
the hub's marks, its count and the reminder in the top bar tell the truth for this action.

## Acceptance criteria

- [ ] **AC-1: the required list.** The app holds one list of required taggings, the same on every
      instance and shipped with the app: the four in the table above, in that order. Each entry names
      the tag (its name, its slug, and its canonical address: the owner's key plus the slug), the
      direction, and the signer. Adding a tagging later is one entry.
- [ ] **AC-2: the answer is about the viewer's own Assistant, and only theirs.**
  - Given a signed-in viewer who has an Assistant on this instance (the same answer that marks
    `/setup`'s first step done: for the Owner the instance TA, for anyone else their own), when the
    instance is asked, it answers for each of the four: **present** or **missing**, whether the check
    **finished**, and whether the tag's canonical **definition was found**.
  - There is no way to ask about another person or another Assistant: the answer follows the session,
    and no parameter changes whose it is.
  - Given a visitor who is not signed in, the answer says so and reports no taggings.
  - Given a signed-in viewer with no Assistant here, the answer says so and reports no taggings.
- [ ] **AC-3: present.** A required tagging is present when the required signer's latest live tagging
      of a tag with the required name, targeting the required pubkey, applies it (in either shape the
      tagging protocol allows today).
  - Whoever authored the tag definition it points at: a same-named tag by another author counts.
  - A dispute by anyone other than the required signer changes nothing. The required signer's own
    latest stance being a dispute, or their tagging having been retracted, makes it missing.
  - Where: this instance's relay first. Only when it holds no such tagging by that signer for that
    target are the outside relays this instance reads tags from asked, and then the newest found
    counts.
- [ ] **AC-4: finished, as `/setup` means it.** A tagging's check is finished when this instance's relay
      answered and held one, or when it held none and at least one outside relay answered. An
      unfinished check says why (this instance's relay could not be read; no outside relay is
      configured; no outside relay answered). An unfinished tagging is neither present nor missing.
- [ ] **AC-5: the hub reads it, for this action only.**
  - The Identification Tags card is marked **Needs attention** unless the check finished and all four
    are present. While the check is running, or when it did not finish, the card stays marked, as
    `/setup` shows a step as not done until it knows.
  - The hub's count line counts the card the same way.
  - The Assistant Alert counts this action only when the check finished and at least one tagging is
    missing (the confident reading, as the Setup Alert counts a step). Once the check finishes, the
    card, the count line and the pill agree.
  - The other nine actions are marked and counted exactly as today. So a viewer whose four taggings
    are all present, check finished, sees the Identification Tags card unmarked, **9 actions need
    attention** on the hub, and 9 in the pill.
  - Visitors and viewers without an Assistant see no marks and no pill, as today.
- [ ] **AC-6: the definitions are reported, and do not gate "present".** For each required tagging the
      answer says whether its canonical tag definition was found, on this instance's relay or the
      outside relays it reads tags from. A definition that is not found leaves "present" as AC-3
      computes it; story 2 uses this to say the tag cannot be published yet.
- [ ] **AC-7: read-only, one request.** Nothing is published, signed or stored. The answer is fetched
      once per full page load for a signed-in viewer, when a page that needs it is open, and again on
      demand after a publish (story 2). No polling.

## Copy

None new for this story. The hub's count line already reads "{n} actions need attention" and "1 action
needs attention". The placeholder page behind the action is unchanged until story 2 replaces it.

## Concepts touched

- `39998:<TA>:nostr-user-tag` — nostr user tag (the taggings this story reads).
- `39998:<TA>:tag` — tag (the four canonical definitions this story looks for).
- `39998:<TA>:nostr-user` — nostr user (whose Assistant; the viewer's own).

No concept changes; no firmware reinstall.

## Out of scope

- The page at `/assistant/identification-tags` (story 2) and any publishing (stories 2 and 3).
- The other nine actions' answers.
- A stored opt-out, an "optional" tagging, caching, polling, or a server-sent refresh.
- A public lookup for outside clients ("whose Assistant is this pubkey?"). The taggings are readable
  by anyone on the relays already; a convenience endpoint is not part of this book.
- Publishing the four canonical tag definitions. The owner does that with their own key (book
  § Prerequisite outside the code).

## Open questions

1. **The canonical author key** — *settled 2026-09-22 at approval:* the owner's own key, the npub
   BIBLE §20 lists for wds4/straycat, `npub1u5njm6g5h5cpw4wy8xugu62e5s7f6fnysv0sj0z3a8rengt2zqhsxrldq3`
   (hex `e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f`). The app names the four
   canonical tags by that key plus the slugs `my-tapestry-assistant`, `my-agent`, `my-tapestry-owner`,
   `my-human`.
2. **Does "present" need the tagging to have reached an outside relay?** This story says no: a tagging
   on this instance's relay is present, and the per-relay report at publish time (stories 2 and 3)
   shows how far it went. The purpose of the tags is broadcast, so the owner may later want a
   "broadcast" reading too. *Settled 2026-09-22 at approval: local suffices for now.*

## Deviations

*The Implementer's log (Phase 4, 2026-09-22): judgment calls too small for an ADR amendment, for the book-close
audit.*

1. **Two Tester-lane corrections after the suite's first run against the implementation,** committed on their own
   as `test:` before the implementation commit. U11 asserted one outside read across the whole request, but ADR 0001
   reads each relay once *per lookup* and there are three lookups (the viewer's, the assistant's, the canonical
   author's); it now asserts the distinct relays read, and at most three reads. S1 stripped comments from
   `src/api/index.js` with the UI files' helper, which reads the glob string `'/api/settings/*'` as the start of a
   block comment and swallowed the registration line; it now reads the raw source.
2. **No action-level `reason`.** AC-4 asks each tagging's check to say why it did not finish; the four rows carry the
   reason, and the action itself carries only its three flags. Nothing reads an action-level reason.
3. **Rows name their signer and target as the words `person` and `assistant`,** never as pubkeys, so the answer
   carries no viewer or assistant pubkey (the `/api/setup/status` precedent). Story 2's page already has both
   pubkeys from sign-in.
4. **The provider fetches only for a viewer with an assistant** (`user.assistantPubkey` set), as ADR 0001
   § Implementation notes 4 says; a viewer without one has nothing to check, and the hub shows no marks for them
   whatever the answer.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
