# Agent-to-agent bounty payments — E2E

Two layers of test, matching Phase 6 of `plan-agent-to-agent-payments.md`.

## 1. Automated CLI integration (no sats) — runs in CI

`npm run test:agent-e2e` drives the real `bin/agent.js` binary through the
user-agent loop (auth-login → discover → submit → negotiate) against an
in-process stub server, asserting the published kind-39999 claim and kind-1111
negotiation events are validly signed and correctly tagged. No wallet, no relay,
no real money. This is the regression guard for the agent tool surface.

## 2. Manual signet run (real sats) — two Claude Code sessions

This is the real end-to-end: an **operator** session pays a **user-agent**
session over Lightning and the claim flips to paid from a real kind-9735.

### Prerequisites

- A Brainstorm server with the bounty backend running, `AUTO_PAY_ENABLED=true`,
  and `RELAY_KEY_MASTER_KEY` set.
- A funded MDK Agent Wallet on the operator box (`npx @moneydevkit/agent-wallet
  init`, fund it on signet/mainnet, verify `node bin/agent.js balance`).
- `AUTO_PAY_ZAP_RELAYS` set to a **publicly-reachable** relay the LNURL provider
  can publish the kind-9735 to (not `wss://localhost`) — the bridge imports it
  back onto the local relay the state machine scans.
- The user agent's kind-0 profile has a working `lud16` Lightning address.
- Trust: `rank(issuer, claimant) ≥ 2`, or run with `DEV_SKIP_TRUST_CHECK=true`.

### Steps

Start with safety on: `AGENT_DRY_RUN=true AGENT_REQUIRE_JUDGMENT=true`.

1. **Operator, once**: `node bin/agent.js provision-delegate --issuer <issuerHex>`
   and create an auto-pay bounty (UI or API) with a `criteria` string.
2. **User agent**: follow the `magic-carpet-user-agent` skill —
   `auth-login`, `discover --eligible`, then `submit --bounty <id> --content …`.
3. **Operator**: follow the `magic-carpet-operator` skill — read the claim,
   `judge --decision accept --confidence 0.9`, then `pay --bounty <id> --claim
   <claimEventId>` (dry-run first, confirm `wouldPay`, then drop AGENT_DRY_RUN).
4. **Assert paid**: re-fetch the bounty; the claim's `paymentStatus` becomes
   `paid` (a `zapReceipt` is present) once the kind-9735 is bridged onto the
   local relay. `settled` in the pay result confirms the receipt landed.

### What proves success

The claim flips to `paid` driven **only** by a real on-relay kind-9735 — not by
the operator's accept, not by the dry-run log, not by the wallet preimage. The
zap receipt is the single settlement truth.
