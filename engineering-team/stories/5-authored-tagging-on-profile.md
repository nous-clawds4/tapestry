# Story 5: Authored-tagging section on profile pages

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background
Today a profile page shows what tags *others* have applied to this person (the `TAGS` section from Story 1). But there's no surface for the inverse: what tagging has *this person done to others*? That information lets a viewer assess a profile owner's curation behavior — what they think other people are, who they've contested. It also makes tagging itself a more visible social activity.

Like every personalized surface in the app, this section is POV-scoped: the viewer only sees authored taggings whose TARGET is in their active POV's WoT. This is intentional — one of the project's differentiators is trimming "all of Nostr" down to "what your POV thinks matters." A profile's authored history outside the viewer's POV is omitted entirely. Per Story 1's POV-first principle (active POV's WoT, default house POV).

## User-facing description
As a Brainstorm user viewing someone's profile, I want a scroll section that shows the tags this person has authored on people in my POV — which they've applied and which they've disputed, on whom — so I can see their curation history and explore the people and tags they've touched. If they've tagged me, I want that highlighted distinctly.

## Acceptance criteria

- [ ] Given I am viewing a profile page that has at least one authored `nostr-user-tag` assertion whose target is in my active POV's WoT, when I scroll past the existing sections, then I see a new section (heading TBD by Architect — e.g. "Tags they've applied", "Authored Tagging", "Tagging activity"). If I am authenticated and any of those taggings are about me, they appear in a pinned sub-block at the top of the section (see the "tagged YOU" criterion).
- [ ] Given the section renders, when I look at each row, then I see the polarity (applied / disputed), the tag's name (clickable → tag-detail page), the target profile (name + avatar, clickable → that user's profile page), and a relative timestamp (e.g. "2d ago").
- [ ] Given the list is rendered, when I look at the sort controls, then they reuse the sort-facility delivered by Story 4 (same component, same backend contract). The available sort modes for this list are:
  - **Most recent** — descending by createdAt. **Default.**
  - **Most applied** — sort each row by its parent tag's WoT application count, descending.
  - **Most disputed** — sort each row by its parent tag's WoT dispute count, descending.
  - **Most divisive** — sort each row by its parent tag's divisiveness score (Story 2/4 formula).
- [ ] Given the section has applied and disputed assertions, when I view it, then the polarity is visually distinguishable (e.g. green for applied, red for disputed, or text labels) so I can tell at a glance which is which.
- [ ] Given I am viewing the authored-tagging section, when the list renders, then it shows ONLY assertions whose target profile is in my active POV's WoT. Taggings on profiles outside my POV are omitted entirely (not greyed out, not collapsed — gone). If switching POV would reveal more, the empty / partial state hints at that ("Switch POV to see more").
- [ ] Given the profile has zero authored assertions visible under my POV, when the page loads, then this section is hidden entirely (not rendered as an empty box).
- [ ] Given the profile is the same as the viewer's own pubkey, when I view it, then the section still renders normally — I see my own authored history.
- [ ] Given I am NIP-07-authenticated and viewing someone's profile, and that profile has authored at least one assertion whose target is my own pubkey AND that assertion is visible in my active POV's WoT, when the authored-tagging section renders, then those "about me" taggings appear as a clearly-distinct sub-block pinned to the top of the section (e.g. "Tags they've applied to YOU" / "Tags they've disputed on YOU"), separated from their tagging of others.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag`
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag`
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user`

## Out of scope
- Filtering controls within the section beyond sort (no text-filter for v1).
- Revoking from this section (still done via the existing Manage dialog on the viewer's own assertions).
- Pagination / virtualization for very prolific authors (deferred until we see one; tracked alongside Story 4's pagination work).
- Cross-referencing with the existing `TAGS` section (e.g. "this person tagged that person who tagged this person") — tracked as a future "community tag-activity surfaces" story in `engineering-team/follow-ups.md`.
- A standalone "my tagging activity" route — the section is on the profile, not a separate page.

## Open questions
- Whether to split the section into two sub-blocks ("Applied" vs "Disputed") or interleave them with polarity badges. **Architect.**
- Exact section heading wording. **Architect.**
- Whether to show kind-5 deletions as "revoked" rows or just silently omit them. PO lean: silently omit; the section shows the *current* state.
- Exact phrasing for "tagged YOU" sub-block (mirror-second-person vs first-person), and whether the count of "tagged YOU" entries belongs in the section header as a badge. **Architect.**
- Story 5's sort modes that aggregate over the parent tag (Most applied etc.) — should the sort be by the tag's WoT score, or by the score just of THIS assertion's parent-tag-on-this-target? The first reads as "what tags this person tends to use that are themselves popular"; the second is closer to "which of their taggings are most agreed-with." **Architect** to pick, with PO available for product framing.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
