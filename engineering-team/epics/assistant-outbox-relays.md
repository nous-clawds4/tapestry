# Epic: assistant-outbox-relays — your Assistant's outbox relays, and the hub's third persona card

**Status:** Done (book closed 2026-10-09; the folders sit under `done/`; in production 2026-10-09 via PR #829)
**Created:** 2026-10-09
**Book:** `engineering-team/audits/assistant-outbox-relays/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-10-09, quoted verbatim in the book, settled through four questions
at intake (book § Decisions). It follows two patterns: `assistant-identification-tags` (an action page
whose card gets a real "needs attention" answer from `GET /api/assistant/attention`, and a narrow,
session-bound server publish signed with the viewer's own Assistant's key) and `assistant-profile` #2
(local relay first, then the configured relays, each relay's answer reported). It picks up one item
`assistant-profile` deferred: "A kind 10002 relay list for assistants".

## Goal

**The hub gains an eleventh action, Outbox Relays, the third card in "Your Assistant's Public
Persona".** A Tapestry Assistant publishes on its person's behalf around the clock; NIP-65 (kind 10002)
is how other clients learn where to find what it publishes. The card needs attention until the
Assistant's relay list names at least one outbox relay. Its page lets the person edit that list — add by
hand, add suggested relays one at a time or all at once, remove — and have the Assistant publish it.

## Stories

`stories/done/assistant-outbox-relays/`. All three are features, so all three take all five phases (Standard).
They travel through each phase together.

1. `1-the-outbox-check-and-the-hubs-outbox-relays-card.md`: the action entry, the server's answer for the
   viewer's own Assistant's kind 10002, and the hub's card, count line and pill reading it.
2. `2-the-outbox-relays-page.md`: the page — the Assistant's outbox relays, adding by hand, the suggested
   relays (one at a time or all), removing — as an on-screen draft. Depends on #1.
3. `3-your-assistant-publishes-its-relay-list.md`: the narrow server action that signs the Assistant's
   kind 10002 for the signed-in person's own Assistant, and the page's publish button and report. Depends
   on #1 and #2.

## Key facts / guardrails

- **"Whose Assistant?" is this epic's POV question, as it was the hub's.** Every answer and the one
  publish are about the viewer's own Assistant: `user.assistantPubkey`, the one main→delegate mapping.
  For the Owner it is the instance TA; for anyone else it never is. The TA pubkey is resolved at runtime,
  never hardcoded.
- **NIP-65 as written; no new wire format.** A kind 10002 is a replaceable event of `r` tags, each a relay
  URL with an optional `read` or `write` marker; no marker means both. An *outbox* relay is one with no
  marker or `write`. This epic writes standard kind 10002 events and invents no tag; nothing goes through
  `protocols/`.
- **The outbox, not the inbox.** The page manages write relays only. Inbox-only entries an existing list
  carries survive every publish from this page untouched (book Decision 3).
- **Publication stays permissionless.** The server gates nothing about relay lists except what it will
  *sign with keys it holds*: only the signed-in person's own Assistant, only a kind 10002, only from this
  route.
- **Local-first, honest reporting.** The relay list is written to this instance's relay first; if that
  fails nothing goes outward. Every relay's answer is reported, in the profile publish's words. Local-only
  publish mode keeps it here and says so.
- **Nothing is published without a press.** No creation-time hook, no retry, no auto-publish of the
  suggestions.
- **Open work this epic touches:**
  - **assistant-profile-checklist** (open book, opened the same day): changes the same hub answer and adds
    the hub's **Done** badge for checked actions. Whichever story is built first adds the badge; the other
    reuses it. Re-check the shared line before Implementation and before Review (book § Shared lines).
  - **OPEN.md #270** (dead or broken relays in the default lists) bears on the suggestions, which come from
    the same Relay Settings lists. This epic does not change those lists.

## Deferred / out of scope

- The inbox (`read`) side of the relay list, and a page to manage it (for when the Assistant handles DMs).
- Publishing a relay list at Assistant creation, or republishing it when Relay Settings change.
- The person's own kind 10002.
- Telling the Assistant's other publishers (trusted assertions, trusted lists, DLists) to publish to the
  relays the list names. The list says where the Assistant publishes; making every publisher follow it is
  a separate decision.
- The other actions' answers and pages.

## ADRs

`decisions/done/assistant-outbox-relays/`, created per story at Architecture.
