# Story 7: Event-tagging read — the viewer's own stance

**Status:** Approved
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging

## Background

Story 6 (the note-tagging UI) surfaced a point-of-view gap in the Story-4 read. When the app reads the tags on a note, it scores every asserter against the active point of view (the "house" POV by default) and only counts the ones that POV trusts. That is correct for the **community** tally — but it silently drops the **viewer's own** assertion when the viewer isn't (yet) trusted by that POV. The visible bug: a logged-in viewer applies a tag, sees it appear, reloads the page, and watches their tag **disappear** — because the read no longer returns their own contribution.

The pubkey-tagging (profile) feature already solved exactly this: its read returns the viewer's own applications/disputes **separately** from the trust-filtered community counts, so "you applied this" is always visible and durable, even before anyone else (or the POV) counts it. Event-tagging's read has no such channel. This story adds it.

The principle is a core invariant of the system: **from my own point of view, I always count myself.** A viewer must be able to see and rely on their own stance regardless of how any POV scores them.

This is a small, additive read enhancement. It unblocks Story 6 and changes nothing for existing consumers.

## User-facing description

As a logged-in viewer reading the tags on a note, I want my **own** stance on each tag — whether I've applied it or disputed it — to be reflected whenever I'm identified to the read, so that my contribution is always visible to me and does not appear to vanish on reload, even if my view's trust scoring doesn't (yet) count it.

## Acceptance criteria

Testable from the outside (given a starting state of published assertions + an identified viewer, the read's response reflects the viewer's own stance).

- [ ] **My applied tag is reflected — even when the POV wouldn't count me.** Given a viewer who has applied a tag to a note, and a POV that does **not** trust that viewer, when the note's tags are read with the viewer identified, then the response reflects the viewer's own **applied** stance for that tag.
- [ ] **My disputed tag is reflected — same condition.** Given the viewer has disputed a tag, when the note's tags are read with the viewer identified, then the response reflects the viewer's own **disputed** stance for that tag.
- [ ] **My stance is distinct from the community count.** The viewer's own stance is returned **separately** from the POV-counted set, so a tag the viewer asserted but that the POV does not count is still identifiable as the viewer's own — not conflated with counted tags, and not implying the community counted it.
- [ ] **Latest-wins reflects a flip.** Given the viewer applied and then disputed the same tag on the same note (or vice-versa), when the read returns their stance, then it reflects only their **current** (latest) stance, not both.
- [ ] **My own stance does not inflate the community tally.** Given a viewer not trusted by the POV, when the note's tags are read, then the POV-counted applications/disputes numbers are **unchanged** by the viewer's own untrusted assertion (it is surfaced as "mine," never leaked into the counted totals).
- [ ] **Backward-compatible when no viewer is identified.** When the read is called **without** a viewer identified (e.g. logged-out), the response is unchanged from today — no viewer-stance information, and the existing POV-counted behavior is identical.
- [ ] **Additive for existing consumers.** The POV-counted set and the unverifiable surfacing behave exactly as before for everyone; this story only **adds** the viewer's-own-stance information.

## Concepts touched

- `39998:<TA>:nostr-event-tag` — the event-tagging assertion whose author is matched against the viewer.
- `39998:<TA>:tagging-with-specific-tag` — the per-tag header (the legitimacy/identity context of a tagging).
- `39998:<TA>:tag` — the tag the stance is about.
- `39998:<TA>:nostr-event` — the target note.

> Handles use the **local** TA pubkey as a placeholder; the Architect resolves against the target instance's **runtime** TA (never hardcode), per CLAUDE.md.

## Out of scope

- **The note UI that consumes this** — Story 6 (this only provides the data; the UI reads it).
- **Changing the POV-counted classification itself** (which asserters count, the authority/trust rules) — unchanged; this is purely additive.
- **The write path** — Story 5 (unchanged).
- **The unverifiable bucket** — its behavior is unchanged here; surfacing it in the UI is a separate deferred follow-up (logged in `_intake.md`).
- **Pubkey-tagging (profile) read** — it is only the precedent; not modified.

## Open questions

1. **Scope of "my stance."** Does the viewer's own stance cover a tag they asserted whose **header isn't locally resolvable** (the "unverifiable" case), or only tags whose tagging is otherwise well-formed? The viewer should reliably see *their own action*; whether that extends to the unverifiable case is an edge to resolve. *(Architecture)*
2. **How the viewer is identified to the read.** Whether the viewer's identity rides on the existing read or a related mechanism — left to the Architect (the profile-tagging read is the precedent). *(Architecture)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0007-event-tagging-read-viewer-own-stance.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
- **Unblocks:** `engineering-team/stories/event-tagging/6-event-tag-affordance-on-note-surfaces.md` (BLOCKED on this story).
