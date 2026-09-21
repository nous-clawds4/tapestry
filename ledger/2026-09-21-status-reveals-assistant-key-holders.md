# The assistant status endpoint tells an anonymous caller which pubkeys hold an assistant key on this instance

**Id:** 2026-09-21-status-reveals-assistant-key-holders
**Type:** bug
**Opened:** 2026-09-21 (assistant-profile #4 review, non-blocking 2)
**Status:** OPEN
**Done:** —

This was here before assistant-profile #4, and that story neither created nor widened it.

- **What is exposed.** `GET /api/assistant/status?customerPubkey=‹any pubkey›` answers `hasRelayKey: true` and
  the `assistantPubkey` to any caller, signed in or not, whenever that pubkey holds a key
  (`src/api/assistant/index.js:400-431`, the keyed branch).
- **Why that matters.** Customers are public anyway (`/api/get-customers`, per ADR
  author-scoped-inspection/0001). So a pubkey that holds a key but is not on that list is an admin, or a
  guest who kept a key from an earlier role. The admin roster is otherwise owner-only (`/api/admin/list`,
  behind `requireOwnerOnly`).
- **What already holds the line.** ADR assistant-profile/0004 rejected adding "who may create an assistant"
  to this answer for the same reason (Option C, a membership oracle). This row covers the part that was
  already there.

Fix shape — a decision first:

- answer the keyed fields (`hasRelayKey`, `assistantPubkey`, `assistantNpub`, `profile`) only to the callers
  that `allowRelayFallback` admits: the person, the Owner, an Admin, or the in-container operator;
- answer anyone else with a shape that doesn't tell key-holders apart.

Before changing it, check the anonymous readers of this endpoint. The dashboard's setup hook asks only about
the signed-in user. Story 1's live H-class makes anonymous calls. The legacy pages go away in story 5.

**2026-09-21 (assistant-profile #5):** the legacy pages did not go away. Their assistant panels stay, read-only
(ADR assistant-profile/0005 sub-decision 5), and ask `/api/assistant/status` only about the signed-in person, with
`defaults=0`. So they are not anonymous readers, and a fix to this row does not have to account for them. Story 5
left this row open by the owner's choice: it gets its own story.

**Pointer:** `engineering-team/reviews/done/assistant-profile/4-my-assistant-page.md`, non-blocking finding 2.
