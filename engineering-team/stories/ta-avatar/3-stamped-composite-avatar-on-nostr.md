# Story 3: The stamped composite avatar, published to nostr

**Status:** Approved
**Created:** 2026-08-06
**Type:** Feature
**Epic:** `ta-avatar`
**Book:** `engineering-team/audits/ta-avatar/book.md`

## Background

This is the ask's chosen end state (book acceptance frame, kickoff decision 1): not just a badge our
own UI paints at render time, but the stamped image itself — the owner's avatar with the
brain-and-lightning mark off to one side, baked into a single picture — published as the TA's
profile picture so that *every* nostr client shows it. Stories 1–2 provide the in-app layer and the
branded fallback this story degrades to.

## User-facing description

As an instance owner, I want to generate the stamped avatar (my picture with the brand mark), see a
preview, and publish it as the TA's profile picture, so that any nostr client anywhere shows my
assistant wearing my avatar with the badge.

## Acceptance criteria

- [ ] Given the owner has a profile picture, when they choose to generate the badged avatar from the
      assistant profile editor, then a preview of their picture stamped with the brand mark on one
      corner appears before anything is published.
- [ ] Given the owner accepts and publishes, then the TA's published profile picture is a URL hosted
      by the instance itself, and on a deployed instance that URL serves the composite image
      publicly.
- [ ] Given the instance is later redeployed or restarted, then the previously generated composite
      is still served at its URL — a published picture never silently dies.
- [ ] Given the owner regenerates later (e.g. after changing their own avatar), then the new
      composite replaces the old, and re-publishing points the TA's profile at the new one.
- [ ] Given the owner has no profile picture, or it cannot be retrieved, then the flow offers the
      branded fallback picture (story 2) instead of failing.
- [ ] Given anyone who is not authorized for the assistant profile (not the owner), then the
      generate/store operations are refused.

## Concepts touched

None known — same note as stories 1–2; the Architect should confirm against the concept graph.

## Out of scope

- Automatic regeneration when the owner's avatar changes — regeneration stays a manual owner action
  for now; automating it is a candidate follow-up (task-scheduler territory), noted for the book
  close.
- Customer assistants' composites — unless the owner flow generalizes with zero extra behavior.
- Hosting the composite anywhere other than the instance itself (external media hosts).

## Open questions

None.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
