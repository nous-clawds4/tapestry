# Story 3: The stamped composite avatar, published to nostr

**Status:** Done
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

None. **Confirmed at Architecture** against the live concept graph: `39998:<TA>:image` resolves to a
bare node (no description, and `…:image-schema` returns `No node found`) and models images as
knowledge-graph nodes, not files on a volume — see ADR 0003. No firmware reinstall.

## Out of scope

- Automatic regeneration when the owner's avatar changes — regeneration stays a manual owner action
  for now; automating it is a candidate follow-up (task-scheduler territory), noted for the book
  close.
- Customer assistants' composites — unless the owner flow generalizes with zero extra behavior.
- Hosting the composite anywhere other than the instance itself (external media hosts).

## Open questions

None.

## Deviations

1. **`getInstanceWebsite` and `isPubliclyReachable` are now exported from
   `src/api/assistant/index.js`.** ADR D4 requires the composite's publishable URL to reuse story 2's
   reachability rule rather than fork a second one; exporting the two helpers is the mechanism. No
   behavior change to either — additive exports only.
2. **The canvas maths lives in `ui/src/utils/compositeAvatar.js`, not inline in the editor.** The ADR
   said "the editor" draws the composite; the editor is already ~300 lines and the cover-fit +
   badge-placement geometry is self-contained and worth reading on its own. The editor still owns the
   flow (fetch → build → preview → accept); only the pixel maths moved one file over.
3. **The kind-0 helper is named `getOwnerKind0PictureUrl`.** Prompted by the test that checks the
   proxy's URL provenance: the original name (`getOwnerPictureUrl`) left it ambiguous whether the URL
   came from the request or from the owner's own event. The name now says which.
4. **The composite source allow-list is raster-only, narrower than the ADR's `image/*`.** ADR D2 says
   "`content-type: image/*` allow-list"; the implementation admits PNG/JPEG/WebP/GIF/AVIF/BMP and
   refuses `image/svg+xml`. Taken on the review's second ask: SVG can carry script, and this response
   is served from our own origin, so echoing that content-type back would make the endpoint a
   same-origin script-execution vector. The composite source is only ever drawn into a canvas, so no
   raster capability is lost. Narrower than the ADR, in the safer direction.

*(The review's first ask was **not** a deviation — it restored the "at most one redirect" bound ADR D2
already specified. `redirect: 'manual'` with a one-hop loop, and each hop re-validated by the same
`parseFetchableUrl` used on the owner's published URL, so a redirect cannot reach a scheme or shape
the original check would have refused.)*

## Linked artifacts

- ADR: `engineering-team/decisions/ta-avatar/0003-owner-composited-avatar-hosted-by-the-instance.md`
- Test plan: `engineering-team/stories/ta-avatar/3-stamped-composite-avatar-on-nostr.test-plan.md`
  (tests: `test/stamped-composite-avatar.test.js` + `tests/brainstorm/ta-composite-avatar.spec.js`)
- Review: `engineering-team/reviews/ta-avatar/3-stamped-composite-avatar-on-nostr.md` — **PASS** 2026-08-07
  (two rounds; the first returned two asks on the outbound fetch, both fixed in `fe613e46`)
