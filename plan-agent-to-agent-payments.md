# Plan — Agent-to-agent bounty payments for Magic Carpet

Move the bounty loop off the website into two Claude Code agents: an **operator
agent** that judges + pays, and a **user agent** that discovers + negotiates +
submits. Both are Claude Code with their own Nostr identity, settling over the
existing Nostr rails so nothing downstream changes.

Reviewed by gpt-5.5 (pirev): foundation confirmed real, verdict **Rework** — the
six fixes are folded in below.

## The key fact

~80% is already built and parked on `fix/bounty-cap-enforcement` — reverted off
this branch for a boot-crash deploy incident on 2026-06-15, **not a logic bug**
(`notes-deploy-incident.html`). gpt-5.5 verified the primitives do what's
claimed: server-side kind-9734 signing (`zap-node.js:97-123`), delegate-key zap
settlement (`acceptedZapPubkeysForBounty` = issuer ∪ delegate), keyless
`signAs:'client'` publish (`publishEvent.js:51-56`), paid-ness derived only from
kind-9735. So the work is: restore + boot-guard that backend, add the two things
that genuinely don't exist (negotiation, criteria judgment), wrap it in a thin
agent CLI.

## Roles

- **Operator agent** — issuer's agent / the house. Holds a delegate signing key
  + the funded MDK Agent Wallet. Judges, negotiates, pays.
- **User agent** — claimant (Bob). Holds Bob's Nostr key + lud16 in his kind-0.
  Discovers, negotiates, submits, collects.

## Decisions (made)

1. **Negotiation channel** — public **kind-1111** comment; the envelope carries
   `bountyId`, not just the list `#z` (bounties are SQLite rows and several can
   share one list coordinate, so `#z` alone is ambiguous). NIP-17 private DMs
   later if terms must be hidden.
2. **Price-fixed negotiation** — agents negotiate **scope / deadline /
   accept-reject, never amount**. Payout is always `bounty.amount_sats`
   (`bounty-policy.js:110-113`). A negotiated price has no durable home and would
   contradict "9735 is the only settlement truth", so variable payouts are out
   until a first-class negotiated-amount record exists.
3. **Tool surface** — one thin CLI `magic-carpet-agent`, split by locality:
   `discover` / `submit` / `negotiate` run anywhere (the user agent signs locally
   and does the Nostr auth login flow: `verify-user` → sign kind-22242 →
   `login-user`); `pay` / `provision-delegate` run **server-side** with DB +
   wallet access, owner/admin/allowlist-gated. (`/api/bounties/eligible` is NOT
   keyless — `bounties.js:286-290,130-137`; there is no existing pay/delegate
   route — `upsertDelegate` has zero callers.)
4. **Operator runtime** — a Claude Code loop driving the restored primitives via
   the CLI. Move `processAutoPayClaim()` into a `paymentService` module; retire
   `autoPayWatcher`'s blind `setInterval`. Keep `db/autoPay.js` for caps /
   idempotency / delegate keys.
5. **Dry-run first** — ship `AGENT_DRY_RUN=true`: negotiate + judge + log the
   would-be payment to a **separate dry-run audit channel, never a spend-capable
   `auto_payments` row** (an `attempting` row reserves slots and suppresses
   re-payment — `bounty-policy.js:53-55,97-100` — so a naive dry-run would close
   bounty slots without paying).

## Lifecycle (reuse vs new)

1. **Discover** — user agent auths (login flow), then filters bounties.
   *(auth subcommand NEW; rank/slot filter reuse)*
2. **Negotiate** — ≤2–3 rounds of a `{bountyId, scope, deadline}` envelope over
   kind-1111; operator replies accept / counter / reject(reason) within rank +
   remaining cap + wallet float. *(NEW)*
3. **Submit** — user agent signs a kind-39999 list item locally, publishes via
   keyless `/api/strfry/publish`, z-tagged to `list_coordinate`. *(reuse)*
4. **Judge** — operator LLM-judges the submission vs `criteria`, re-checks rank;
   reject → reason → revise/resubmit; accept → pay. Records the judgment prompt +
   result as an audit row tied to the claim. *(NEW)*
5. **Pay** — `mintZapInvoice(… signerPrivateKey: delegate_nsec)` → `getBalance()`
   float preflight → `payBolt11()` via the MDK Agent Wallet. Delegate-signed 9734
   → 9735 accepted by issuer ∪ delegate. *(restore)*
6. **Settle** — the kind-9735 lands in the relay the server scans →
   `calculateBountyPaymentState` flips payable → paid. *(reuse + relay ingress)*

The kind-9735 zap stays the **only** "paid" signal. The negotiation envelope and
the dry-run log are advisory — they never gate or double-count payment.

## Phases

0. **De-risk + boot-safety (hard gate).** Only `require()`/start the auto-pay
   modules when feature-enabled (the watcher require eager-loads wallet/zap-node
   — `api/index.js:501-502`). Don't decrypt delegate secrets for read-only
   receipt matching (`getDelegate()` → `SecureKeyStorage` throws with no master
   key, and it's reached from plain bounty reads). Boot smoke tests: server
   starts with the wallet binary absent **and** with the master key absent. (This
   exact backend 502'd prod; without this it re-breaks.)
1. **Restore the payment backend.** Cherry-pick `zap-node.js`, `wallet.js`,
   `db/autoPay.js`, and the `bounties.js` delegate/receipt generalization, behind
   Phase-0 guards. Add the missing safety wiring: `getBalance()` float preflight
   before `payBolt11()`; make the 24h cap **per-issuer** (add an `issuer_pubkey`
   predicate — today the sum is global, `autoPay.js:49-54`); stuck-`attempting`
   reconciliation / admin reset (a crashed attempt otherwise blocks a claim
   forever). Keep `test/wallet.test.js` + `test/auto-pay.test.js`.
2. **Receipt relay ingress.** Ensure the claimant's LNURL-published kind-9735
   reaches the relay this server scans — a bridge import (as the existing e2e
   demo does) or a publicly-reachable local relay used in the zap request's
   `relays` tag (`zap-node` defaults to `wss://localhost:7777`). Without this,
   settlement is invisible to the state machine.
3. **Thin agent CLI:** `auth-login`, `discover`, `submit`, `negotiate
   send|scan`, `balance`, plus server-side `provision-delegate` + `pay`.
4. **Operator judgment + policy:** `judge(criteria, submission)` (fail-closed on
   low confidence) + `negotiate(offer)` accept/counter/reject within rank + cap +
   float. Wire the operator Claude Code loop; `AGENT_DRY_RUN` first.
5. **User agent loop:** discover → negotiate → submit → watch for the 9735. A
   Claude Code skill + the CLI.
6. **E2E on signet:** two Claude Code sessions run the full loop; assert the
   claim flips to paid from a real kind-9735.

## Safety envelope (all must hold before live sats)

Funded float + `getBalance()` preflight · `AUTO_PAY_MAX_SATS` per-payment cap ·
per-issuer 24h cap · rank ≥ 2 gate · idempotent `claim_event_id` + stuck-row
recovery · LLM-judgment audit record · fail-closed on judgment uncertainty ·
`AGENT_DRY_RUN` proven first. Negotiation ≠ settlement; the 9735 is the only
paid signal.

## Out of scope (parked)

Variable negotiated payouts (needs a new settlement record) · NIP-17 private
negotiation · dispute/refund/arbitration · webhook/SSE push (agents poll) · MCP
server · proof-of-work claim attachments.
