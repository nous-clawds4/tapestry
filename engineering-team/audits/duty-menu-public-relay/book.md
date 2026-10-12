# Book of Work: The instance's public relay address, for the Duty Menu and Outbox Relays

**Slug:** duty-menu-public-relay
**Status:** Closed
**Opened:** 2026-10-12
**Closed:** 2026-10-12 (production: PR #853, merge `6f75160a`, deploy run 150)
**Strictness:** Light (trial) — workflows/light-profile.md (the owner's choice at intake), Bug lane

## Intent anchor

**Acceptance frame (no PRD)**: the owner's report of 2026-10-12, quoted verbatim in `engineering-team/stories/_intake.md`
(2026-10-12), restated here. The owner chose "go ahead and fix it" after the diagnosis.

### Acceptance frame

- [x] **Scores and Lists come back.** On a Docker deployment (staging, production), the Duty Menu offer names this
      instance's public relay, `wss://<its public domain>/relay`, for Scores (where the viewer gets them) and Lists,
      and for Concepts. Publishing again puts those rows on the menu.
- [x] **Outbox Relays suggests the same address** as "this instance's own relay".
- [x] **Nothing else changes.** An instance whose `BRAINSTORM_RELAY_URL` is already public keeps naming it, and one
      with no public domain still offers no Scores or Lists rows.
- [x] **On staging, then production** with the owner's approval.

## Epics in this book

- `duty-menu-public-relay`: story 1, the instance's public relay address.

## Shared lines

This book touches `src/api/assistant/dutyMenu.js`, `src/api/assistant/outboxRelays.js` and
`src/api/assistant/profileDefaults.js`, and their suites. No other open book edits them (checked at intake: the open
books are docs-only or elsewhere). Before Gate B: `git fetch` and `git merge-tree --write-tree HEAD origin/staging`.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high. The owner's republish is the remaining live check.

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/duty-menu-public-relay/audit.md`
- Product feedback: `engineering-team/audits/duty-menu-public-relay/prd-seed.md`
