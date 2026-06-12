# Bounty e2e tests (real money, human-in-the-loop)

Two Playwright specs that walk a bounty from creation through a **real Lightning
payment** and assert that payment tracking + cap enforcement behave. Neither can
run in CI: each needs the live stack (rank() + strfry), a WoT rank edge, a real
tracked Lightning address, and a human to pay one or two real invoices. Both are
**skipped by default** and enabled by an env flag.

| Spec | Flag | What it proves |
|------|------|----------------|
| `receiving-lifecycle.spec.js` | `RECEIVING_E2E=1` | The **receiving-method setup UI**: claimant sets a tracked lud16 via Settings → Receiving, issuer pays, receipt flips Payments-to-Me to "paid". |
| `bounty-payment.spec.js` | `BOUNTY_E2E=1` | The **bounty/payment/cap machine**: assumes the claimant already has a tracked address; covers the happy path and cap enforcement. |

`helpers.js` holds the shared signer / publish / poll plumbing both specs use.

## How payment tracking works (what we assert)

There is no payments table — paid-ness is derived live from Nostr events:

- A **bounty** (SQLite, `src/db/bounties.js`) is keyed to a list coordinate
  `30000:<issuer>:<d-tag>` with `amount_sats` and `bounty_cap_sats`. Slots =
  `floor(cap / amount)`.
- A **claim** is a kind-39999 event tagged `#z = listCoordinate`.
- A claim is **paid** iff a kind-9735 zap receipt `#e`-tags the claim and its
  embedded zap-request `.pubkey` is the issuer.
- A claim only **surfaces** if `rank(issuer, claimant) >= 2`
  (`src/api/bounties.js`).
- `calculateBountyPaymentState()` turns claims + receipts into
  payable / paid / closed(`cap`|`contributor`) plus a `fulfilled` flag
  (`src/lib/bounty-policy.js`).

With real money the kind-9735 is published by the **claimant's LNURL provider**
when the human pays the invoice the issuer's zap created — the exact production
path.

## Preconditions

1. **App + stack running**, reachable at `BRAINSTORM_BASE_URL` (defaults to the
   Playwright config, `http://localhost:7778`).
2. **WoT rank ≥ 2, issuer → each claimant.** A claim is invisible otherwise.
   Either:
   - publish a real kind-30382 from the issuer's configured `rankAuthor` giving
     each claimant rank ≥ 2 (the honest, production-shaped path), **or**
   - run the app with `DEV_SKIP_TRUST_CHECK=true` (`src/lib/trust-rank.js`) to
     make `rank()` return 100.

   If this is missing, the first claim-visibility poll fails with a message that
   says exactly this.
3. **The claimant's kind-0 profile already carries a tracked lud16.** The zap
   reads the recipient address from the profile (`ui/src/utils/zap.js`), *not*
   from `CLAIMANT_LUD16`. `bounty-payment.spec.js` checks this in `beforeAll`
   and **skips** with a precise message if the profile has no lud16 or it
   doesn't match `CLAIMANT_LUD16`. (To set one, run the receiving spec once, or
   set it through Settings → Receiving.)
4. **A funded Lightning wallet** to pay the printed invoice(s).

## Environment variables

| Var | Used by | Meaning |
|-----|---------|---------|
| `BOUNTY_E2E=1` | bounty-payment | enable the spec |
| `RECEIVING_E2E=1` | receiving-lifecycle | enable the spec |
| `BRAINSTORM_BASE_URL` | both | app base URL |
| `ISSUER_NSEC` | both | issuer key (`nsec1…` or 64-hex); must rank claimants ≥ 2 |
| `CLAIMANT_NSEC` | both | primary claimant key |
| `CLAIMANT_LUD16` | both | the claimant's real, tracked `name@host` (must match their profile lud16) |
| `CLAIMANT2_NSEC`, `CLAIMANT3_NSEC` | bounty-payment | extra claimants for the cap test (rank ≥ 2). Unset → cap test skips |
| `PAY_TIMEOUT_MS` | both | how long each checkpoint waits (default `600000` = 10 min) |
| `CAP_FULFILL=1` | bounty-payment | also pay the **2nd** invoice to assert `fulfilled` (claimant2 then also needs a tracked profile lud16; claimant3 must be login-authorized) |

## Running

Always pin a **single browser project** — otherwise Playwright runs the file
once per configured project (5×) and you'd be asked to pay 5× the invoices.

```sh
# Happy path only (one real 21-sat payment):
BOUNTY_E2E=1 \
ISSUER_NSEC=nsec1… CLAIMANT_NSEC=nsec1… CLAIMANT_LUD16=name@host \
npx playwright test tests/bounties/bounty-payment.spec.js --project=chromium --headed

# …or via the npm script (same thing, env still required):
ISSUER_NSEC=… CLAIMANT_NSEC=… CLAIMANT_LUD16=… npm run test:bounties

# Add the cap test (still one real payment — the split assertion is free):
BOUNTY_E2E=1 ISSUER_NSEC=… CLAIMANT_NSEC=… CLAIMANT_LUD16=… \
CLAIMANT2_NSEC=… CLAIMANT3_NSEC=… \
npx playwright test tests/bounties/bounty-payment.spec.js --project=chromium --headed

# Cap test asserting `fulfilled` too (a SECOND real payment):
… CAP_FULFILL=1 npx playwright test tests/bounties/bounty-payment.spec.js --project=chromium --headed

# The receiving-setup walkthrough:
RECEIVING_E2E=1 ISSUER_NSEC=… CLAIMANT_NSEC=… CLAIMANT_LUD16=… \
npx playwright test tests/bounties/receiving-lifecycle.spec.js --project=chromium --headed
```

When the run reaches a checkpoint it prints a banner with the BOLT11 invoice:

```
========================= PAY THIS INVOICE =========================
Happy path: single 21-sat reward.
lnbc210n1...
(waiting up to 600s for the kind-9735 receipt…)
====================================================================
```

Pay it from your wallet. The spec polls the bounty until the kind-9735 receipt
lands (≤ `PAY_TIMEOUT_MS`), then asserts the tracked state.

## What the cap test asserts (and what it costs)

A 2-slot bounty (`amount=21`, `cap=42`) with 3 staggered claims:

- **Before any payment** (free): exactly **2 payable**, the oldest two; the
  **newest** claim is `closed` with `closedReason: 'cap'`.
- **After one real payment** (21 sat): `paidRewardCount=1`,
  `remainingRewardSlots=1`, still 1 payable + 1 closed(cap), not `fulfilled`.
- **With `CAP_FULFILL=1`** (a second 21 sat): `fulfilled=true`, 0 payable, the
  3rd claim still closed(cap), and claimant3's claim shows in
  `payments-to-me` `closed[]`.

So the default cap run spends **21 sat**; `CAP_FULFILL=1` spends **42 sat**.

## Notes / gotchas

- **Real sats leave your wallet.** Amounts are tiny (21 sat) on purpose.
- **Persistence.** Bounty rows persist in `data/bounties.db`
  (`BOUNTIES_DB_PATH`). Specs use run-unique d-tags, and the Payments-Due
  selector is scoped to the run's list coordinate so old bounties are never
  zapped by accident.
- **Receipt latency / relays.** The kind-9735 must reach the **local** strfry
  that `strfry scan` reads. The zap request carries the recipient's relay list
  (kind-10002), falling back to `wss://localhost:7777`. If receipts never land,
  check that the claimant's relays include the local relay. All reads are
  polled, never bare asserts.
