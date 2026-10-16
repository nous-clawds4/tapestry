# Upstream proposal: NIP-52 — a cancelled calendar event stays, marked cancelled

**Target:** [`nostr-protocol/nips`](https://github.com/nostr-protocol/nips) → `52.md`: one bullet in the list of tags common to both calendar event kinds, and one short section after § "Collaborative Calendar Event Requests"
**Issue:** none yet
**Status:** 📝 drafted 2026-10-15; not submitted. Submission is the author's act ([protocols/README.md](../README.md) § Layout); who submits is NosFabrica's call.
**Date drafted:** 2026-10-15
**Sources:** [Event Index](../drafts/event-index.md) § 4.6 and open question 5; `docs/EVENT_INDEX_DESIGN_HANDOFF.md` (an event with RSVPs is cancelled, not deleted); NIP-52 as of `nostr-protocol/nips` `a79e21d` (2026-10-05); [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) § 3.8.1.11 (`STATUS`); schema.org [`eventStatus`](https://schema.org/eventStatus)

## The problem

NIP-52 can't say that a calendar event is cancelled. An author has two ways to do it today, and both lose something:

- **Delete it** ([NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md)). The RSVPs (kind `31925`) and comments ([NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md)) lose the event they point at, a guest who said yes is never told, and a client that had shown the event shows nothing.
- **Edit the title** ("Cancelled: …"). A person reads it, but a client can't: it still lists the event as upcoming and still offers to RSVP.

Calendars outside nostr have said this for decades: iCalendar's `STATUS:CANCELLED` (RFC 5545) and schema.org's `EventCancelled`. A bridge that mirrors iCalendar feeds into NIP-52 (Event Index) meets cancelled events every day and has nowhere to put the fact. Open PR #2351 (NIP-52E/52R) meets the same gap for one occurrence of a recurring event, and suggests publishing a replacement event with a note in its description.

## Proposed spec text (52.md — common tags)

Add to the list of tags common to both types of calendar events, after `r`:

```markdown
* `status` (optional) `tentative`, `confirmed` or `cancelled`: the calendar event's status, as in iCalendar ([RFC 5545](https://www.rfc-editor.org/rfc/rfc5545#section-3.8.1.11) `STATUS`). Clients SHOULD treat an unknown value as absent.
```

## Proposed spec text (52.md — new section after "Collaborative Calendar Event Requests")

```markdown
## Cancelled Calendar Events

To cancel a calendar event, its author republishes it with the same `d` tag and `["status", "cancelled"]`, instead of deleting it, so that RSVPs and comments keep the event they refer to. The author SHOULD NOT change the `title` to say it is cancelled.

Clients SHOULD show a cancelled calendar event as cancelled, and SHOULD NOT prompt users to RSVP to it. Clients MAY leave cancelled calendar events out of lists of upcoming events. RSVPs to a cancelled calendar event are left as they are.

An author who wants the calendar event gone, not marked, deletes it per NIP-09 as before.
```

## PR title and description

**Title:** NIP-52: mark a calendar event cancelled instead of deleting it

**Description:**

> NIP-52 has no way to say a calendar event is cancelled. Deleting it orphans its RSVPs and comments, and editing the title is something only people can read.
>
> This adds an optional `status` tag to both calendar event kinds, with iCalendar's three values (`tentative`, `confirmed`, `cancelled`, RFC 5545 `STATUS`), and a short section saying a cancelled event is republished with `["status", "cancelled"]` rather than deleted. Nothing changes for clients that ignore the tag.
>
> It also gives bridges a place for the fact: iCalendar's `STATUS:CANCELLED` and schema.org's `EventCancelled` map onto it directly.

## How to submit

1. Fork `nostr-protocol/nips`; branch, e.g., `nip52-status`.
2. In `52.md`, add the bullet from § "Proposed spec text (52.md — common tags)" to the common tags list, after `r`.
3. Add the section from § "Proposed spec text (52.md — new section)" directly after § "Collaborative Calendar Event Requests".
4. Open a PR with the title and description above, verbatim. Before opening it, ask Formstr (the most active NIP-52 client) whether it would read the tag; the PR is stronger with a client that does.

## Questions a reviewer may raise

- **Why `status`, when kind `31925` already has a `status` tag?** The two never meet: one sits on a calendar event, the other on an RSVP, and each kind defines its own values. It also keeps iCalendar's own name, so a bridge maps it one to one. The alternative is a new name (`event_status`), at the cost of that mapping.
- **Why three values, not just `cancelled`?** They are iCalendar's, so a bridge carries whatever the source says. Only `cancelled` asks anything of clients.
- **Postponed and rescheduled** (schema.org has both) are left out: a rescheduled event is an edit of its `start`, and a postponed one has no new time to give.

## When it lands

[Event Index](../drafts/event-index.md) § 4.6 prefixes a cancelled event's title with `Cancelled: ` until NIP-52 has a convention. Once this is merged, the index writes `["status", "cancelled"]` and stops prefixing, and § 4.6 and open question 5 are updated.
