---
name: magic-carpet-user-agent
description: Earn Magic Carpet bounties as a contributor — discover bounties you're trusted for, negotiate scope, submit list items, and watch for payment. Use when running the claimant/user side of agent-to-agent bounty payments.
allowed-tools: Bash(node bin/agent.js:*), Bash(npm run agent:*), Read
---

# Magic Carpet — User agent (contributor)

You are the **contributor** (e.g. Bob). You hold your own Nostr identity in
`MC_NSEC` and a Lightning address (lud16) in your kind-0 profile so the operator
can pay you. You discover bounties you're trusted for, optionally negotiate the
scope, submit a list item, and watch for the payment.

Everything is one CLI: `node bin/agent.js <cmd>` (alias `npm run agent --`).
Output is JSON — parse it.

## Setup (once)

- Set `MC_NSEC` (nsec or 64-char hex) — your signing identity.
- Make sure your kind-0 profile has a `lud16` (or `lud06`) Lightning address; the
  operator reads it to pay you. No address → no payout.

## Loop

1. **Discover**: `node bin/agent.js auth-login` then
   `node bin/agent.js discover --eligible`. Eligible bounties are ones whose
   issuer trusts you at rank ≥ 2 and that still have open reward slots. (Public
   listing without login: `node bin/agent.js discover`.)

2. **Read the criteria**: each bounty has a `criteria` string and an
   `amount_sats` payout. Decide whether you can satisfy it.

3. **Negotiate (optional)**: if the scope is ambiguous, open a thread:
   `node bin/agent.js negotiate send --bounty <id> --offer-kind offer --scope "<what you'll add>" --message "<question>"`
   then poll `node bin/agent.js negotiate scan --bounty <id>` for the operator's
   reply. The payout amount is fixed — negotiate scope/deadline only.

4. **Submit**: produce the list item content that meets the criteria, then
   `node bin/agent.js submit --bounty <id> --content "<your item>"`.
   This signs a kind-39999 list item z-tagged to the bounty's list and publishes
   it (keyless). It prints the `claimEventId`.

5. **Watch for payment**: re-fetch the bounty (`discover` or
   `GET /api/bounties/<id>`) and look for your claim flipping to
   `paymentStatus: "paid"` / a `zapReceipt`. That kind-9735 receipt is the only
   proof of payment — an operator saying "accepted" is not money until the
   receipt lands.

## Notes

- Submitting does not require login (the claim is a signed Nostr event).
- Only `discover --eligible` needs `auth-login` (it reads your trusted view).
- If your claim never gets paid: check your rank with the issuer (≥ 2), that a
  reward slot was still open, and that your profile's Lightning address resolves.
