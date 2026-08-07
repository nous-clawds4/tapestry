# Story 2: Recognizable published TA profile defaults

**Status:** Approved
**Created:** 2026-08-06
**Type:** Feature
**Epic:** `ta-avatar`
**Book:** `engineering-team/audits/ta-avatar/book.md`

## Background

The TA's published nostr profile is owner-triggered, and its defaults today carry no picture and a
generic name ("Tapestry Assistant"). Any third-party nostr client that encounters the TA shows a
blank avatar with a name that links it to nothing. Story 1 fixes our own UI; this story makes the
*published defaults* recognizable, and provides the branded fallback picture that story 3's
composite degrades to.

## User-facing description

As an instance owner, I want the TA's default published profile to carry a branded picture and a
name that ties the assistant to me, so that anyone encountering it in any nostr client can tell
what it is and whose it is — even before the full stamped composite (story 3) exists.

## Acceptance criteria

- [ ] Given the owner views the assistant profile defaults (e.g. "reset to defaults" in the profile
      editor), then the proposed name reads "<owner's name>'s Tapestry Assistant" when the owner has
      a published name, and a generic assistant name otherwise.
- [ ] Given those defaults, then the proposed picture is a branded TA image (the brain-and-lightning
      mark) hosted at the instance's own public address.
- [ ] Given a deployed instance with a public domain, when the default profile is published, then
      the published picture URL resolves publicly to that branded image.
- [ ] Given an instance with no public address (local/dev), when defaults are published, then no
      picture is included in the published profile — a dead link is never published.
- [ ] Given a customer's assistant (not the owner's), then its defaults carry the same branded
      picture under the same public-address rule.
- [ ] Given an instance whose assistant profile was already published, then nothing about it changes
      until the owner explicitly re-publishes.

## Concepts touched

None. **Confirmed at Architecture** against the live concept graph (48 concepts; `/summaries` then
the three-call pattern on `39998:<TA>:image`). An `image` concept exists but models images as
knowledge-graph nodes, not static brand assets served over HTTP — see ADR 0002 for why it does not
apply. No firmware reinstall.

## Out of scope

- The composite of the owner's own photo (story 3).
- Any change to how the assistant's verified address (NIP-05) is derived or displayed.
- Backfilling / auto-republishing existing instances' profiles.

## Open questions

None.

## Linked artifacts

- ADR: `engineering-team/decisions/ta-avatar/0002-branded-published-profile-defaults.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
