# Epic: treasure-map-user-assistant

**Created:** 2026-08-28
**Status:** Active
**Book:** `engineering-team/audits/treasure-map-user-assistant/book.md` (acceptance-frame,
**Light profile trial** #3 — Bug lane)
**Provenance:** Operator bug report 2026-08-28 (in-session): production team member's
Treasure-Map opt-in published the owner-assistant pubkey instead of his own per-customer
assistant. Root cause diagnosed in-session: the tl-treasure-map surface bound "the local
Tapestry Assistant" to `ConfigContext.taPubkey` (owner) instead of the session's
`user.assistantPubkey` (per-user, `getAssistantKeys`) — indistinguishable on a dev instance
where the operator IS the owner. Escaped-defect attribution: OPEN.md row 188 (Light-trial
comparison line).

## Goal
Every delegation judgment and composition on the TA Treasure Map page is per-POV correct: the
signed-in user's own assistant is the delegate — for the owner (unchanged behavior) and for
every customer (the fix).

## Stories
`stories/treasure-map-user-assistant/`:
1. `1-per-user-assistant-delegate.md` — swap the delegate source, badge semantics, null safety,
   copy/spec corrections, suite re-aims. Bug, Light lane.

## Decisions
None — no irreversibility trigger (the ADR-0001 wire convention is untouched and already
per-user-correct at §2; this fixes which runtime key the UI supplies).
