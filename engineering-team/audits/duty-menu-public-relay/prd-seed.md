# PRD Seed: The instance's public relay address

**Mode:** reconstructed from as-built *(no prior PRD)*; a small bug-fix book
**Build audit:** `engineering-team/audits/duty-menu-public-relay/audit.md`
**Date:** 2026-10-12

## 1. Product vision

`[FROM FRAME]` A person's Duty Menu tells others everything their Assistant publishes, at an address outsiders can
reach. This book makes that true on our Docker deployments, where it wasn't.

## 2. Personas

`[INFERRED]` The same as book `assistant-duty-menu`: people with an Assistant on this instance, and the clients that
read their menus.

## 3. Scope (as-built)

- `[FROM FRAME]` The Duty Menu offer and the Outbox Relays suggestion name `wss://<public domain>/relay` on Docker
  deployments.
- `[INFERRED]` Menus published before the fix read **out of date** until republished.

## 4. Domain model

`[INFERRED]` Unchanged. "This instance's public relay" is now one rule, `instanceRelayUrl()`.

## 5. Design rules (as-built)

- `[INFERRED]` A public `BRAINSTORM_RELAY_URL` wins. Otherwise the public domain plus `/relay`, which nginx serves.
  Otherwise none.

## 6. Carry-forward & open questions

1. Republish the menus (the owner, and every person with an Assistant). Whether menus should republish themselves is
   already in `assistant-duty-menu`'s seed §7.

## 7. What product must validate

- [ ] **Should the hub nudge people whose published menu went out of date because of this fix,** or is the card's
      **Needs attention** enough? `[UNKNOWN — product input needed]`
