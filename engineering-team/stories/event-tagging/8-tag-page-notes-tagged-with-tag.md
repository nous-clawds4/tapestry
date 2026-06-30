# Story 8: Tag detail page — notes tagged with this tag

**Status:** Approved
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging

## Background

The event-tagging epic (Stories 1–7) lets people tag kind-1 notes and shows those tags **on the notes themselves**. But the **tag's own page** — where you land when you click a tag — still shows only the **profiles** tagged with that tag (the older pubkey-tagging feature). So when a viewer tags a note and then clicks the tag to see "what else is tagged this way," they see people, not notes — and their own just-tagged note is nowhere on the page. This gap was found during Story-6 browser testing.

The data already exists: an event-tagging references its tag through the tag's header, so "which notes carry this tag" is discoverable. This story surfaces that on the tag page as a **notes view**, alongside the existing profiles view — completing the round trip from "tag a note" → "see the tag's page" → "find that note."

Because notes are rendered through the shared note unit, each note shown here also carries the Story-6 tagging affordance for free.

> **Build invariant (epic):** still in force — every publish stays on the local dev relay only while the epic's local-only invariant holds. This story is read-and-display; any tagging done from a rendered note goes through the existing guarded path.

## User-facing description

As a viewer on a tag's page, I want to see the **notes** that have been tagged with this tag — not just the profiles — so that I can browse what's been labeled this way and find notes I (or others) have tagged. As the person who tagged a note, I want **my own** tagged notes to show up here even if my view's trust scoring doesn't (yet) count me, so the page reflects what I actually did.

## Acceptance criteria

Testable from the outside (given published taggings + a viewer, what the tag page's notes view shows).

- [ ] **Notes tagged with the tag are shown.** Given one or more kind-1 notes tagged with a tag, when I open that tag's page and choose the notes view, then I see those notes (each rendered as a note), POV-filtered like the rest of the epic.
- [ ] **Profiles view is unchanged.** The existing "profiles tagged with this tag" view behaves exactly as before; the notes view is an **additional** way to look at the tag, not a replacement. Switching between them is possible from the tag page.
- [ ] **My own tagged note is shown even when the POV wouldn't count me.** Given I tagged a note but the active POV does not trust me, when I view the tag's notes view, then the note I tagged still appears as mine (mirroring the durable "own stance" behavior from Story 7) — it does not vanish.
- [ ] **Counted vs. mine stays honest.** A note that only I (untrusted) tagged is shown as my own, not implied to be community-endorsed; the community/counted set reflects the POV's trusted asserters only.
- [ ] **Each note carries the tagging affordance.** A note in this view renders as a full note, so it shows its tags and the apply/dispute/add affordance (the Story-6 unit) — no separate, divergent rendering.
- [ ] **Empty state.** Given a tag that no note has been tagged with (only profiles, or nothing), when I open the notes view, then I see a clear empty state, not an error.
- [ ] **Clicking a tag chip from a note lands somewhere that shows the note.** Given I tagged a note and click that tag's chip, when the tag page opens, then the notes view is reachable and shows my note — closing the loop that motivated this story.

## Concepts touched

- `39998:<TA>:nostr-event-tag` — the taggings being discovered for the tag.
- `39998:<TA>:tagging-with-specific-tag` — the per-tag header(s) that identify a tagging as belonging to this tag.
- `39998:<TA>:tag` — the tag whose page this is.
- `39998:<TA>:nostr-event` — the target notes shown.

> Handles use the **local** TA pubkey as a placeholder; the Architect resolves against the target instance's **runtime** TA (never hardcode), per CLAUDE.md.

## Out of scope

- **Changing the profiles view** (rows, pinning, "tag someone", curation) — untouched; this story only adds the notes view.
- **The note-surface tagging affordance** — Story 6 (reused here, not re-built).
- **The viewer's-own-stance read mechanism for a single note** — Story 7 (this story applies the same principle to the by-tag direction).
- **Pinning notes, ranking/scoring changes, NIP-09 deletion** — epic-level out of scope.
- **Tag pages for non-event tags / other surfaces** — only the tag detail page's notes view.
- **External publishing** — the local-only invariant holds.

## Open questions

1. **Aggregating across multiple headers.** A tag can have more than one per-tag header (different authors may have minted one). "Notes tagged with this tag" should span the legitimate headers for the tag, not just one author's — how that union is formed (and which authorities are honored) is the Architect's call, consistent with the epic's sovereignty model. *(Architecture)*
2. **Curation / ordering of the notes list.** Whether the notes view mirrors the profiles view's curated default (net applications over disputes) or uses a different default (e.g. recency), and what sort/filter controls it exposes. *(Design / Architecture)*
3. **Placement.** Whether the notes view is a tab/toggle within the existing "View options", a separate section, or a sub-route — left to design, mirroring the tag page's existing patterns. *(Design)*
4. **Disputed notes.** How a note that's been disputed more than applied is treated in the notes view (shown, de-emphasized, hidden behind an expanded view) — mirror the profiles view unless there's reason to differ. *(Design / Architecture)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0008-tag-page-notes-tagged-with-tag.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
- **Source:** intake entry `engineering-team/stories/_intake.md` (2026-06-30), surfaced during Story-6 browser testing.
