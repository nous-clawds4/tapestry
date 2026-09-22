# Story 3: Your Assistant's two taggings of you

**Status:** Done
**Created:** 2026-09-22
**Type:** Feature
**Epic:** `assistant-identification-tags`
**Book:** `engineering-team/audits/assistant-identification-tags/book.md`

## Background

Two of the four required taggings are signed by the Assistant, not the person: "My Tapestry Owner" and
"My Human", tagging the person. An Assistant's key lives on this instance, so only the instance can
sign them. Today the only general way to sign as an assistant serves the instance owner alone and
always signs as the instance's own Assistant, so an admin's or customer's Assistant can publish
nothing but its profile (which has its own narrow publish, assistant-profile #5).

This story adds the one narrow action the second card needs (Discovery decisions 2, 3, 9): on the
person's press, this instance signs the checked taggings with that person's own Assistant's key, for
their own Assistant only, writes them to this instance's relay first, sends them to the outside relays
it publishes to, and reports what each relay did, in the profile publish's words. Nothing is published
when an Assistant is created, and nothing else gains the power to sign as an Assistant.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want to press one button and have my
Assistant publish its taggings of me, choosing which, so that outside apps can tell whose Assistant it
is, from the Assistant's side too.

## Acceptance criteria

- [ ] **AC-1: the second card's publish.** Given the second card with at least one checked row, when the
      viewer presses its publish button, this instance signs one tagging per checked row with the
      viewer's own Assistant's key: an ordinary tagging of that row's canonical tag, tagging the viewer,
      as an apply, in the same shape the first card's taggings have.
- [ ] **AC-2: whose Assistant.** The instance decides whose Assistant from the signed-in session: for the
      Owner the instance TA, for an Admin or Customer their own. The request cannot name another person
      or another Assistant. With no signed-in session, or a session with no Assistant on this instance,
      the request is refused with a reason, and nothing is signed.
- [ ] **AC-3: what it signs, and nothing else.** The action signs only the required taggings whose
      signer is the Assistant, named by their entries in the required list. A request naming anything
      else is refused. The action signs no other kind and no other tag; the general sign-as-assistant
      route is unchanged (owner-only, the instance TA) and gains nothing.
- [ ] **AC-4: local-first, each relay reported.** Each tagging is written to this instance's relay first.
      If that write fails, that tagging goes to no other relay and the answer says so. Otherwise it is
      sent to the outside relays this instance is configured to publish to, including the relays it
      reads tags from, and the answer reports each relay's status (accepted, refused, unreachable,
      timeout) with its reason, and the whole result (published, kept local, not delivered). In
      local-only publish mode nothing goes outward and each relay is reported as skipped.
- [ ] **AC-5: the card shows it.** After the press the second card shows, per tagging, the summary and
      each relay's answer in story 2's words, then re-checks its rows, and the hub's answer refreshes so
      the count and the pill change without a reload.
- [ ] **AC-6: a definition that is not found.** A checked row whose canonical tag definition was not
      found is refused for that tagging, with story 2's "tag not found" reason; the other checked rows
      in the same press still publish.
- [ ] **AC-7: never at creation.** Creating an Assistant, on any path (first boot, an admin's key
      provisioning, a customer's signup) publishes no tagging. Only the press does.

## Copy

The card's button: **Have your Assistant publish** (new). Results use story 2's words, with the
tagging's name as the subject. Refusals:

| Refusal | Text |
|---|---|
| Not signed in | Sign in to have your Assistant publish its taggings. |
| No Assistant here | You don't have a Tapestry Assistant on this instance yet. |
| Not a required tagging | That is not one of the taggings your Assistant publishes. |
| Tag not found | story 2's "Tag not found" sentence |

## Concepts touched

- `39998:<TA>:nostr-user-tag` — nostr user tag (what the Assistant signs).
- `39998:<TA>:tag` — tag (the canonical definitions).
- `39998:<TA>:nostr-user` — nostr user (the viewer, tagged by their Assistant).

No concept changes; no firmware reinstall.

## Out of scope

- Publishing at Assistant creation (Decision 3: later, on top of this action).
- Retracting or disputing a tagging as the Assistant.
- Any other kind, tag or purpose for the Assistant's key. A general per-user sign-as-assistant route
  stays with OPEN.md #269.
- Retrying relays later, or a stored publish state.

## Open questions

1. **Which configured relay lists** the Assistant's taggings go to is the Architect's to settle (the
   profile publish uses the general-purpose, profile and WoT lists; taggings are read back from the
   tag-federation relays). The acceptance criterion asks only that the relays this instance reads tags
   from are included.

## Deviations

*The Implementer's log (Phase 4, 2026-09-22): judgment calls too small for an ADR amendment, for the book-close
audit.*

1. **`NOSTR_USER_TAG_Z_TAG` was already exported** from `src/api/profile-tags/index.js`, so ADR 0003 § Implementation
   notes 1 ("add it to `module.exports`") was a no-op; that file is unchanged.
2. **One Tester-lane correction after the suite's first run against the implementation** (a `test:` commit before
   the implementation commit): S2 expected `grep -rl` to list the module itself, but grep matches contents, not
   filenames, and the module does not spell its own name; the one legitimate hit is the route registration.
3. **Notices are per card** (`notices.person`, `notices.assistant`) and so is the publishing state (`publishingCard`),
   so a press on one card never disables or speaks for the other (ADR 0003 sub-decision 9).
4. **A whole-request refusal shows the server's own words as the card's notice** (`data.error`), and a request that
   never answers, or answers without JSON, shows "This instance did not answer; nothing was published." The client
   util throws for the latter; the page turns it into the notice.
5. **The route's per-tagging report omits the signed event** (ADR 0003 sub-decision 6): the page needs the report
   only, and the answer stays free of key material and of the Assistant's pubkey.
6. **The scope claim was reworded after review round 1** (ADR 0003 Amendment 1): the route is not "the only thing
   besides its profile" an Assistant's key signs — the curated-DList and trusted-list routes sign with assistant keys
   too. The module header, the route comment, the OpenAPI description and BIBLE's §11 row and §14 bullet now say what
   is true: another narrow, session-bound route in the shape of `publish-profile`, with the generic signer and the
   other assistant-key signers unchanged (review round 2 dropped a first rewording's ordinal, "the second such route":
   the curated-DList routes came first). The OpenAPI `keys` enum also became a description, since the list grows with the
   app (Discovery decision 7).

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-identification-tags/0003-your-assistant-signs-its-two-taggings-through-one-narrow-route.md`
- Test plan: `engineering-team/stories/assistant-identification-tags/3-your-assistants-two-taggings.test-plan.md`
- Review: `engineering-team/reviews/assistant-identification-tags/3-your-assistants-two-taggings.md`
