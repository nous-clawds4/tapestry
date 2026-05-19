# Story 10: Pin a tag (foundational)

**Status:** Approved
**Created:** 2026-05-18
**Type:** Feature

## Background

Foundational story of the **Pin a tag** epic (see `engineering-team/epics/pin-a-tag.md`). Pinning is the user's opt-in to make a tag part of their personal curated set: a pinned tag becomes the basis for downstream features — periodic Trusted List publication (Story 12), "Most pinned" sort on the tag index (Story 13), and more.

This story ships the primitive only: the user can pin or unpin a tag, see what they've pinned, and the Pin is stored as a kind-39999 list-element event signed by the user, carrying a default `curation-method`. No TL is published yet, no curation customization yet, no aggregation across users yet — those are subsequent stories.

Per the decentralized-first invariant: any logged-in user can pin or unpin any tag. No author gate, no admin curation. A user's pinned-tag events are owned and signed by *them*; they are personal data, not POV-derived.

## User-facing description

As a NIP-07-authenticated user viewing a tag's detail page, I want to pin (or unpin) the tag to my personal pins, and visit a dedicated `/pins` page that lists everything I have pinned — so that the system knows which tags I have opted in to use as the basis for downstream features, and I have one place to browse and manage them.

## Acceptance criteria

- [ ] Given I am NIP-07-authenticated and on a tag detail page (Story 2), when the page renders, then I see a **Pin** affordance whose state reflects whether I currently have an active Pin event for this tag.
- [ ] Given I click **Pin** on a tag I have not pinned, when the publication succeeds, then a kind-39999 Pin event is published to local strfry and external relays, carrying (a) a `z` tag to the firmware "tag-pinning" ConceptHeader, (b) an `a` and `e` reference to this tag, and (c) a `curation-method` tag containing the default JSON `{"observer":"<my pubkey>","method":"nip85:rank","cutoff":2,"includeScoreInTL":false}`. The affordance updates to **Unpin** in place without a full page reload.
- [ ] Given I click **Unpin** on a tag I have pinned, when the publication succeeds, then the Pin event is retracted (mechanism — kind-5 delete vs. replacement-with-status — is the Architect's call); the affordance updates to **Pin** in place.
- [ ] Given I am NIP-07-authenticated and on a tag detail page, when the page renders, then I also see a small link from that page to my `/pins` page.
- [ ] Given I navigate to my `/pins` page, when the page renders, then I see one row per tag I have currently pinned — each showing the tag's name, description, and a link to that tag's detail page.
- [ ] Given I am on the Settings page (or the existing user-prefs surface), when I look, then I see a link to my `/pins` page.
- [ ] Given I am not NIP-07-authenticated, when I view a tag detail page, then no Pin affordance and no `/pins` link are rendered; the page behaves identically to Story 2's read-only view.
- [ ] Given I am not NIP-07-authenticated, when I attempt to visit `/pins` directly, then I see a "sign in to manage your pins" empty state (consistent with existing auth-gated routes in the app).
- [ ] Given publishing my Pin event (or its retraction) fails on both local strfry and external relays, when I attempt to pin or unpin, then an error surface on the page tells me the failure happened.

## Concepts touched

- `39998:<TA pubkey>:tag` — the tag being pinned/unpinned (existing).
- `39998:<TA pubkey>:tag-pinning` — **new firmware concept** to be added by the Architect; its kind-39999 elements are the user-authored Pin events. Implies a firmware reinstall per `AGENTS.md §6`.

## Out of scope

- **Customizing curation parameters at pin time.** → Story 11.
- **Periodic TL publication from Pins.** → Story 12.
- **"Most pinned" sort / filter on the tag index.** → Story 13.
- **Treasure Map (kind 10040) integration.** → Story 14.
- **Encryption option for Pin events.** → Story 15.
- **DM alerts on TL deltas.** Explicitly out-of-epic; see `engineering-team/follow-ups.md`.
- **Pin-state indicator on tag-index rows** — parked in Story 13.
- **Pinning anything other than a tag** (DLists, content, profiles directly).

## Open questions

- Exact slug for the new firmware concept (`tag-pinning`? `pinning`? `pinned-tag`?). **Architect.**
- Unpin mechanism — kind-5 delete vs. replacement-with-status, given that kind-39999 is addressable replaceable. **Architect.**
- Visual placement of the Pin affordance on the tag detail page (header chip, beside the title, sidebar, etc.). **Architect.**
- `/pins` URL convention (`/pins`, `/tapestry/pins`, `/tapestry/grapevine/pins`). **Architect.**
- Whether the existing strfry-subscription path for the logged-in user already covers the new kind-39998 ConceptHeader and its kind-39999 elements, or needs a new subscription. **Architect.**

## Linked artifacts

- Epic: `engineering-team/epics/pin-a-tag.md`
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
