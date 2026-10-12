# Epic: duty-menu-public-relay — the instance's public relay address

**Status:** Active
**Created:** 2026-10-12
**Book:** `engineering-team/audits/duty-menu-public-relay/book.md` (no PRD — acceptance frame; Light trial, Bug lane)

## Goal

Name this instance's public relay, `wss://<public domain>/relay`, wherever the code means "this instance's own relay,
as outsiders reach it". That covers the Duty Menu's offer and the Outbox Relays suggestions. Docker deployments set
`BRAINSTORM_RELAY_URL` to the internal address `ws://tapestry:80/relay`, so today both treat the instance as having no
public relay.

## Stories

`stories/duty-menu-public-relay/`.

1. `1-the-instances-public-relay-address.md`: the shared rule, and its two callers.
