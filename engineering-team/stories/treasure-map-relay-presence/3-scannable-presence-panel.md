# Story 3: Make the presence panel scannable

**Status:** Approved
**Created:** 2026-09-07
**Type:** Feature

## Background

The presence panel earns its space when something is wrong and wastes it the rest of the time. On
this instance it is ten rows tall — and on a healthy day every one of them says the same thing.
It sits between the Map header and the Map Entries panel, so the user scrolls past ten rows of
"Has this version" to reach the content they came for.

The panel should be closed by default and open on demand. But that only works if the closed state
answers the question the panel exists to answer: **is there anything here I need to do?**

The summary it shows today — `7 of 10 hold a copy` — is the wrong answer to that question. It is a
*coverage statistic*, and coverage is not the thing that matters. One relay serving a **stale**
version is worse than three relays not having the Map at all: a missing Map means a reader finds
nothing and moves on, while a stale one means a reader is confidently pointed at a delegation the
user has already revoked. A count of 7 of 10 treats those two situations as interchangeable, and
hides the dangerous one inside the number.

So the closed state should read as a **status light, not a statistic**: it names the most
serious thing found, in words, coloured to match. If nothing is wrong it says so and the user
never opens the panel at all.

The same reasoning applies inside the panel. When a relay holds a different version, *when* that
version was made is what tells the user whether it is a stale copy they should overwrite or a
newer one they should pull. The Map's own creation time is shown plainly at the top of the page;
the relay's is currently available only by hovering, which means in practice it is not available.

Affected: everyone who visits the page — most of all on the ordinary days when nothing is wrong
and the panel should be quiet.

## User-facing description

As a Brainstorm user opening my Treasure Map page, I want the relay panel closed by default with a
one-line summary that tells me whether anything needs my attention, so that I can ignore it when
all is well and open it only when it tells me something is wrong — and when I do open it, I want
to see when a differing version was created, so I can tell a stale copy from a newer one.

## Acceptance criteria

- [ ] **Closed by default, and openable.** Given the Map is found, when the page first renders,
      then the relay panel is collapsed to its summary line. The user can open it and close it
      again, and opening it reveals the panel exactly as it behaves today.

- [ ] **The closed summary names the most serious finding, not a count.** Given the check has
      finished, the summary states the single most actionable condition, chosen by this precedence
      and coloured to match:

      1. **a relay holds a different version** — the highest-priority condition even if only one
         relay is affected, because a stale copy actively misdirects readers *(caution)*;
      2. **relays are missing the Map** — actionable, but a reader simply finds nothing *(neutral)*;
      3. **relays could not be reached** — coverage is unknown and the user cannot fix it
         *(informational)*;
      4. **everything agrees** — an explicit all-clear *(good)*.

      A lower-priority condition may be mentioned alongside, but never in place of a higher one.

- [ ] **A differing version's age is legible without hovering.** Given a relay holds a version
      other than the one displayed, when the panel is open, then that row shows when the relay's
      version was created — as visible text, in the same form as the Map's own creation time at
      the top of the page — alongside whether it is older or newer.

- [ ] **A summary is never asserted before it is known.** Given the per-relay check is still
      running, the closed summary says that it is still checking rather than reporting an
      all-clear or a count that is about to change. A relay that has not answered yet is not
      counted as agreeing.

- [ ] **Nothing already working is disturbed.** Given the panel is open, then every behavior it
      has today is unchanged: per-relay rows with their group labels, the local strfry row with
      its import affordance, the sync actions and their direction labels, and the publish-policy
      wording.

## Concepts touched

- `39998:<TA>:nostr-relay` — nostr relay. Unchanged; this story is presentation only.
- The kind-10040 Treasure Map has no concept-graph handle.

## Out of scope

- **Remembering the open/closed choice across page loads.** Default closed, every visit. If it
  turns out to be annoying, that is a one-line follow-up.
- Changing which relays are checked, how they are checked, or what any row says about status.
- Changing the sync behavior added in story 2.
- Any summary on a page other than this one.
- Reconciling the relay list between settings and the concept graph — a separate, larger piece of
  work tracked at `follow-ups.md:131`.

## Open questions

*(None blocking.)* One judgement made while drafting: **an unreachable relay ranks below a missing
one** in the precedence above. Both leave coverage incomplete, but a missing Map is something the
user can fix in one click, while an unreachable relay is not actionable at all. If unreachable
relays should shout louder than that, the precedence is a one-line change.

## Linked artifacts

- ADR: `engineering-team/decisions/treasure-map-relay-presence/0003-scannable-presence-panel.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
