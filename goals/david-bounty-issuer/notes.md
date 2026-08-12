# David bounty issuer implementation notes

Date: 2026-08-12

## Safety result

The full assignment changed code, tests, the production workflow, systemd units, and documentation.
It moved zero sats. It did not fund a wallet, provision David, dispatch a workflow, install units, or activate a timer.
The final hardening also changed settlement tests, the runbook harness, package test wiring, and these documents.

The earlier run recorded one house-issued list and one house-issued bounty.
That issuance moved no sats. The bounty has `auto_pay: 0`, no claims, and no payments.
This pass did not repeat or change that issuance.

The earlier run used a temporary cookie and ledger under `/tmp`.
The revised runbook does not treat those files as durable David state.

## Architecture decisions and evidence

### Shared wallet

David and the house issuer share one MDK (Money Dev Kit — the Lightning wallet) wallet.

- `bin/agent.js:14-17` classifies balance and payment as server-side commands.
- `src/lib/wallet.js:11-14,26-28` resolves and invokes one process-wide `agent-wallet` binary.
- `src/services/autoPayWatcher.js:153-154` sends invoices through that wallet.
- `docker-compose.yml:28-40` supplies one wallet configuration and one bounty data volume.
- `src/db/autoPay.js:131-140,302-310` scopes rolling commitments by issuer, not wallet.

The runbook verifies the mainnet invoice, its payment hash, and one exact completed inbound wallet record.
It records before/after spendable balances as information only.

### Issuer-specific delegate

`src/db/autoPay.js:98-104` keys delegate rows by `issuer_pubkey`.
`src/api/bounties.js:85-89` resolves accepted receipt keys from the bounty issuer and that issuer's delegate.
`bin/agent.js:142-160` reuses an issuer's existing delegate row.

The runbook provisions only an absent David row and requires an unchanged house row.

### Judgment-gated settlement

The watcher can pay `auto_pay` without judgment. David keeps `auto_pay: 0` and uses settlement.

`src/services/paymentService.js:27-65` enforces self-dealing, stable identity, rank, judgment, dry-run, and payment-state gates.
`scripts/david-bounty-settle.js:228-377` owns issuer-scoped decisions, state, preflight, judgment, and payment order.
`src/services/autoPayWatcher.js:222-383` reconciles wallet and receipt state without sending a new payment.

Accepted order is preflight, judgment append, then live payment.
Dry-run writes no judgment or payment state.
Only `settled` and `paid_unreceipted` are terminal duplicates.
A nonterminal `failed` row needs explicit reset. Ambiguous outcomes never reset or resend automatically.
Payment identity is `(bounty ID, claimant pubkey, z list coordinate)`.
The code proves the claim `z` tag equals the bounty list coordinate before it derives this identity.
A replacement event for the same claimant and list cannot create a second payment.
Decision and settlement state use `(bounty ID, current claim event ID)`, so corrected replacement content can receive a new judgment.
An unresolved migrated legacy payment blocks its whole bounty. The code never guesses a missing claimant.
An `ambiguous_send` row consumes issuer, bounty, and contributor capacity until a reviewed forced reset removes it.


### Durable session and ledger

Production sessions default to `/var/lib/brainstorm/sessions.db`. Development uses `data/sessions.db`.
Production also requires a stable `SESSION_SECRET` of at least 32 UTF-8 bytes.
The workflow preserves a strong value or creates one 64-hex value before the new image starts.
The cookie jar uses the data volume. Name-only Compose propagation keeps David's nsec out of host process arguments.

The ledger stays outside the checkout and requires explicit all-status import when missing.
Budget authority is `max(server committed caps, durable ledger commitment)`.
Open inventory controls capacity. All-status inventory controls dedupe.

## Instruction defects closed


- clones and fetches the pinned branch from `https://github.com/nous-clawds4/tapestry.git`;
- checks Node.js 18 or newer, `npm ci`, binaries, GitHub, and random selection;
- preserves enable and cap values during an allowlist-only dispatch;
- correlates dispatch by the before/after run identifier set difference;
- establishes a strong stable session secret before the production build;
- asserts exact allowlist membership and unchanged payment settings;
- reuses David's delegate and preserves the house delegate;
- verifies the invoice network, amount, payment hash, and exact completed inbound wallet record;
- separates all-status dedupe, open queue capacity, and maximum budget authority;
- keeps the ledger outside a disposable checkout;
- defines all seven bounty inputs and gives a non-state example;
- uses `jq -e` for exact API assertions;
- keeps the timer disabled through checks, review, and dry-run;
- pins one branch SHA through install, workflow, and remote build;
- targets one proof claim and documents bounded operations inside the infinite-timeout unit;
- asserts damus, nos.lol, and primal before each live payment path;
- proves authentication across a container restart;
- documents non-sending reconciliation and explicit reset;
- requires `paymentStatus == "paid"` and a kind-9735 receipt;
- labels focused self-checks as mocked, not end-to-end.

## Prior state-only issuance evidence

The earlier run selected Mississippi and created:

- List event: `54f1b4b3cedf173fd9f9a8fca6a8248a232d158da34a2b55f5dc4000f2263f14`
- Coordinate: `39998:853baa94b4b12d23931ade03ceb854a2b36cf1e24b5e3a82e68c8ca3a8ced2ba:mississippi-city-david-issuer-proof-20260812`
- Bounty: `14ec286a-bc47-4def-b400-9c905f4e1519`
- Issuer: `853baa94b4b12d23931ade03ceb854a2b36cf1e24b5e3a82e68c8ca3a8ced2ba`
- Amount and cap: 100 and 500 sats
- Slots: 5
- Auto-pay: 0
- Criterion: `Submit a city located within the state of Mississippi to earn the reward.`
- URL: https://magic-carpet.brainstorm.world/tapestry/bounties/14ec286a-bc47-4def-b400-9c905f4e1519

On 2026-08-12, a fresh public API read showed that the bounty is still open.
It still has the house issuer, recorded coordinate, 100-sat amount, 500-sat cap, five slots, `auto_pay: 0`, and zero claims or payments.
The public list page still showed the recorded event ID and coordinate.
It showed the names `Mississippi city` and `Mississippi cities` with the expected description.
These reads changed no state and moved zero sats.

## Local evidence and limits


| Check | Result | Evidence class |
|---|---|---|
| Wallet and agent help | Passed | Local syntax |
| House authentication and inventory | Passed | Production read |
| House list and bounty issuance | Passed | Real state-only write |
| Bounty API and public page | Passed | Production read |
| `npm ci` | Passed | Locked tree installed 364 packages |
| `npm test` after clean install and final harness wiring | Passed | Full suite, including 32 runbook fences and 9 refusal or decision scenarios |
| David settlement self-check | 22 passed | Direct CommonJS checks plus one spawned CLI dry-run with local HTTP and fake agent |
| Configure-production workflow checks | 5 passed | Local workflow behavior, including weak-secret replacement |
| Session-store check | 1 passed | Local SQLite behavior |
| `systemd-analyze verify` | Passed | Debian with Docker executable and unit stubs |
| Authenticated agent commands | Passed | Local cookie forwarding and exit behavior |
| Auto-pay focused checks | 32 passed | Stable identity, legacy block, ambiguous cap, payment, and reconciliation behavior |
| Agent CLI focused checks | 5 passed | Includes bounty-and-claim-scoped reset |
| Runbook command harness | 32 fences and 9 scenarios | Isolated stubbed control flow with no network, production, or real secret |

The settlement suite includes a spawned process that runs the real CLI parser and dry-run flow.
It uses local HTTP and a fake agent. It is not production end-to-end evidence.
The runbook harness executes every fence with isolated command stubs. It is also not production end-to-end evidence.

Reproduction showed `curl --cookie` parsed the JSON jar as Netscape text and returned HTTP 401 after valid login.
The runbook now uses authenticated `payments-due` and `reset` CLI commands with exact JSON assertions.

A production read-only `agent.js payments-due` used house authentication.
It returned `success:true` with 10 items and moved no sats.
A deliberate David-issuer dry-run with the house session exited 1.
It returned 10 `unexpected_issuer` refusals.
This proves fail-closed issuer matching. It is not a David dry-run pass.


## Unexecuted command classes

Acceptance is not met.
The isolated harness does not satisfy the required production start-to-finish run.
Each applicable class below remains a blocker:

1. Canonical fresh-checkout Node, `npm ci`, local binaries, GitHub, and selector checks.
2. SSH (Secure Shell — remote access), host binaries, Docker Compose, and container checks.
3. David key derivation and authentication.
4. Payment-setting and allowlist reads.
5. Allowlist dispatch, session-secret setup, run correlation, watch, and conclusion check.
6. Exact post-workflow allowlist, secret strength, and unchanged enable/cap assertions.
7. Canonical remote fetch, detached checkout, SHA assertion, and Docker image rebuild.
8. Production wallet configuration, mainnet, and initial spendable balance.
9. Invoice creation, validation, external payment, payment-history proof, and final informational balance.
10. Delegate reads, conditional David provisioning, and house equality check.
11. Durable login, container restart, and authenticated-session check.
12. David all-status and open inventory reads.
13. Durable ledger creation or explicit all-status reconciliation.
14. David list, cap commitment, bounty, and exact API assertions.
15. Focused self-check inside the rebuilt container.
16. Systemd unit install and Linux unit verification.
17. Disabled-timer assertions and real judgment review.
18. Real payments-due fetch, queue review, and decision append.
19. Real settlement dry-run, wallet preflight, queue, and log.
20. Deployed receipt-relay assertions.
21. Timer activation after the exact payment and receipt proof.
22. Scheduled-run status, journal, queue, and log checks.
23. Dry-run and live non-sending reconciliation.
24. Ordinary or proven-failed ambiguous reset, if required.
25. One intentional 100-sat payment.
26. Exact paid claim and kind-9735 API proof.
27. Final wallet balance, log, and timer checks.

The proof also needs a trusted non-David claimant with rank 2 or more.
No class completed against David's production identity and host in this pass. The local checks above covered syntax and isolated behavior only.

The production name resolves to `68.183.114.219`; the local Magic Carpet key was denied for `root`.
The configured legacy host `159.223.141.132` accepts that key but has no `/opt/tapestry` checkout.
Production SSH host, user, and key access remain unresolved.

## Remaining validation gates

The pack is not production-accepted. These gates remain:

1. Push one named implementation branch and capture its exact canonical remote commit SHA.
2. Dispatch the pinned workflow before the new image starts.
3. Prove that it established a strong session secret without printing it.
4. Fetch and build only that canonical SHA, with local, workflow, and remote equality checks.
5. Run the CommonJS checks in the rebuilt container.
6. Prove the production session database uses the data volume and mode `0600`.
7. Restart the container and prove David's cookie remains authenticated.
8. Prove exact allowlist membership and unchanged enable/cap values.
9. Prove David's delegate is reused and the house delegate is unchanged.
10. Fund the approved amount and prove one exact completed inbound wallet record.
11. Install and verify the infinite-timeout unit while the timer stays disabled.
12. Review all real queue rows and record explicit decisions.
13. Pass targeted settlement dry-run and receipt-relay assertions.
14. Make one targeted 100-sat live payment while the timer remains stopped.
15. Verify the receipt, then enable the timer.
16. Exercise reconciliation for any visible reconciliation row.
17. Exercise reset only for a conclusively failed wallet outcome.

A timeout, crash, or missing receipt does not prove payment failure.
An ambiguous outcome blocks settlement until reconciliation resolves it.

## Red-pen record
Original README: 2,261 words.
Corrected hardening draft: 3,989 words.
Pinned-deployment draft: 4,215 words.
Final-review README draft before red pen: 4,682 words.
Final README: 4,954 words.

Original notes: 1,427 words.
Hardening notes draft: 1,642 words.
Final-evidence notes draft before red pen: 1,735 words.
Final notes: 1,916 words.

The final pass kept all mandatory warnings verbatim.
It used strict STE (Simplified Technical English — short controlled instructions) for the runbook.

## Report

David shares the instance wallet with the house issuer.
His issuer row has a separate delegate and accounting cap, not a separate wallet.

The full assignment changed code, tests, the configure-production workflow, systemd units, and documentation.
This final hardening changed the runbook, its isolated harness, package test wiring, and these notes.
The earlier run created the identifiers above.
The full assignment moved zero sats and made no live production configuration change.
Only David or Matthias can supply the production SSH credential, David's secret key, approved top-up amount, and live claimant.
