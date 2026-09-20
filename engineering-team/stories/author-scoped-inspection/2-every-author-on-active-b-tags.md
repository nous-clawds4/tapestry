# Story 2: Active b-tags shows every author, and every row names its own

**Status:** Approved
**Created:** 2026-09-20
**Type:** Feature

## Background

Active b-tags is a **wire inspector** — the page you open to see what the relay actually holds.
It currently shows only concept headers signed by this instance's own assistant, and it says so
nowhere. A reader has no way to tell the page is narrow.

The gap is not theoretical. On this dev instance the table shows **12** rows while the local relay
holds **16** b-tag-carrying concept headers. The four it hides are signed by an upstream firmware
author, by the production instance's assistant, and by a peer — which is precisely the federation
evidence an operator opens this page to find.

Widening it creates a second problem immediately: with one author, the author was implicit; with
many, a row that does not name its signer cannot be read. The page already has an *author (shared)*
column — the author of the event a b-tag **points at** — so the new column has to be distinguishable
from it at a glance.

Affected: operators debugging federation, developers learning the wire format, and anyone who
assumed this page showed them everything.

## User-facing description

As someone inspecting b-tags, I want to see every b-tag event my relay holds and know who signed
each one, so that I can see what actually arrived instead of only what my own assistant filed.

## Acceptance criteria

- [ ] Given a local relay holding b-tag-carrying concept headers signed by several different
      authors, when Active b-tags loads, then every one of those events is listed — including
      events whose author is not this instance's assistant and is unknown to this instance.
- [ ] Given the table, when a row is read, then it names the author of the **local** event that
      carries the b-tag, presented the same way authors are presented elsewhere on the page, and
      labelled so it cannot be confused with the existing author of the event the b-tag points at.
- [ ] Given a row whose b-tag carries the deferred-disposition sentinel, when the table loads,
      then it is still skipped — widening the author set changes nothing about which b-tag values
      count.
- [ ] Given the row count shown above the table, when the page loads, then it reports the number of
      rows now listed, and the page's own description no longer claims the list is limited to
      locally-authored events.
- [ ] Given the local dev instance today, when Active b-tags loads, then it lists 16 rows where it
      previously listed 12, and the four newly-visible rows are the ones signed by `253d40c4…`,
      `82b75e47…` (two) and `919ba08a…`.

## Concepts touched

- `39998:<TA>:concept-header` — concept header (the kind-39998 event behind every row; now read
  across all authors rather than one).
- `39998:<TA>:shared-concept` — shared concept (what a b-tag points at; unchanged by this story).

## Out of scope

- Any narrowing control. This story widens and attributes; the person and author-type selectors
  are story 3. **Ship them together** — story 2 alone leaves a reader with no way back to a narrow
  view.
- Kinds other than 39998. The page's existing bound is unchanged; no b tags exist on any other
  kind in the local relay today (verified across kinds 0, 1, 39999, 30382 and 10000).
- Any change to how b-tag targets are looked up, or to the two columns that report them.
- The scan's unbounded/untruncated behavior — a known finding, deferred by the owner this session.

## Open questions

None.

## Linked artifacts
- ADR: `engineering-team/decisions/author-scoped-inspection/0002-author-scoped-views-on-active-b-tags.md`
- Test plan: `engineering-team/stories/author-scoped-inspection/2-every-author-on-active-b-tags.test-plan.md`
- Review: (filled in after Review phase)
