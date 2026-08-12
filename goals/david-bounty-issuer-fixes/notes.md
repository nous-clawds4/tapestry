# Review-fix run — evidence

Date: 2026-08-12.

## Safety

Zero sats moved. No wallet daemon started, no `agent-wallet` binary invoked, no
funding, no payment. No SSH to any host. No GitHub Actions workflow dispatched.
No request other than GET reached `magic-carpet.brainstorm.world`, and in the
end this run made none at all. House issuer `853baa94…` and delegate
`afb6ca29…` untouched.

## Baseline

`npm test` green before any change (`EXIT=0`, 2026-08-12). Re-run green after
every fix.

## P0 and P1 fixes

Each fix below has a regression test. "Method" records how the pre-fix failure
was verified.

### P0-1 — SESSION_SECRET regenerated on every container start

Fix: `docker/entrypoint.sh` now resolves
`SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"`.

Test: `test/session-store.test.js`. It reads the real `SESSION_SECRET=` line out
of `docker/entrypoint.sh`, runs it in bash, writes the generated
`/etc/brainstorm.conf` fragment, and resolves the value the production way
(`resolveSessionSecret({ env: { NODE_ENV: 'production' }, configPath })`). Two
boots with the same env must yield the same secret; two boots with no env must
yield different 64-hex secrets.

Method: stash. `git stash push -- docker/entrypoint.sh` then run the test.
Pre-fix output:

```
AssertionError: Expected values to be strictly equal:
+ '<64-hex freshly minted by the pre-fix entrypoint; redacted — secret-shaped value in a public repo>'
- 'operator-supplied-session-secret-value'
```

### P0-2 — migration closed live house bounties

Three changes:

1. `src/api/bounties.js` — a migrated `legacy:` row reached through
   `legacyByEvent` has a live claim event, so its claimant and stable address
   are both recoverable. Such a row is no longer a block; it holds its own
   reward slot and the other slots stay claimable. Only a legacy row with no
   live event (the durable-only pass) still sets `legacyPaymentBlock`.
2. `src/db/autoPay.js` — `ensureAutoPaymentsSchema({ resolveLegacyIdentity })`
   accepts a synchronous identity resolver and backfills
   `claimant_pubkey`/`claim_address` from it, refusing any result that is not a
   well-formed `39999:<claimant>:<coordinate>` pair.
3. `bin/agent.js repair-legacy-payments [--issuer X] [--dry-run]` — the one-shot
   repair for rows the migration cannot resolve. It reads each row's claim event
   from the relay through the new `scanClaimEvent` export, rebuilds the stable
   address, and updates the row. A claim event that is gone stays
   `unresolvable`; the code never guesses a claimant. The runbook runs it in
   section 1.3, immediately after the first boot of the new image and before any
   issuance or settlement.

Honest limitation: the migration runs synchronously at module load and cannot
reach the relay, so in production the injected resolver is absent and every old
row still lands as `legacy:`. The read-path change is what actually unblocks the
live Arizona bounty; the repair command is what clears the rows behind it. Both
are tested.

Test: `test/auto-pay-migration.test.js` (new, wired into `npm test`). It builds
a pre-migration fixture database — the exact old `auto_payments` schema, a
`settled` row, and two open bounties — stubs `child_process.exec` so
`scanStrfry` serves fixed events, then requires `src/db/autoPay` so the real
`ensureAutoPaymentsSchema` migration runs. It asserts a new claim stays payable
after migration, an unresolvable row still blocks, and the repair path resolves
and writes the right identity.

Method: targeted revert. Restored only the `legacyPaymentBlock` expression in
`src/api/bounties.js` (a whole-file `git stash` reverts to a commit that
predates the phase-1 work and fails for an unrelated reason). Pre-fix output:

```
AssertionError: a resolvable migrated row must not block its bounty
true !== false
```

### P1-3 — one `paid_unreceipted` row failed the timer forever

Fix: the unreceipted state is now bounded.
`AUTO_PAY_RECEIPT_GRACE_SECONDS` (default six hours) sets the window.

- `src/db/autoPay.js` — `listReconciliationPayments(issuer, { now, graceSeconds })`
  keeps a `paid_unreceipted` row in the reconciliation query only while
  `created_at` is inside the window. `created_at`, not `updated_at`: each pass
  rewrites `updated_at`, which would push the deadline forward forever.
- `src/services/autoPayWatcher.js` — a row that ends a pass unreceipted and is
  already past the window reports `ok: true`, `status: 'paid_unreceipted_final'`,
  `reason: 'receipt_grace_elapsed'` instead of failing the run.
- `docs/david-bounty-issuer/README.md` section 5.3 states the bounded behaviour
  and replaces "Reconcile until a receipt appears".

Test: `test/auto-pay.test.js`, "reconcileIssuerPayments makes paid_unreceipted
terminal once the receipt grace window closes". A fresh row still reports
`reconciliation_unresolved`; the same row past the window drops out of the
queue; a row that ages out during a pass reports `paid_unreceipted_final`. Two
neighbouring tests now pass an explicit `now` so their fixtures stay inside the
window and keep testing what they used to test.

Method: targeted revert. Restored the pre-fix WHERE clause,
`listReconciliationPayments` signature, and the watcher's final branch, then
re-ran. Pre-fix output: `actual: false, expected: true` on
`assert.equal(afterGrace.ok, true, 'an aged unreceipted payment must stop
failing the run')`.

### P1-4 — runbook remote blocks executed on the wrong machine

Fix: every remote block in `docs/david-bounty-issuer/README.md` is now one
`ssh "$SSH_HOST" 'bash -s'` call with a quoted heredoc. Blocks that need local
values prepend them with `printf 'export NAME=%q\n' "$NAME"` and pipe the whole
script into that one ssh call, so the heredoc stays quoted and nothing expands
on the wrong side. David's nsec travels the same way: inside the script on
stdin, never in a process argument.

Every `read -rp` and `read -rsp` is gone. Section 0 requires `SSH_HOST` and
`MC_NSEC` in the environment and refuses without them. The ledger import gate is
`LEDGER_RECONCILE_ACK=RECONCILE`. Judgment input is `DECISION`, `CONFIDENCE`,
`REASON`, `QUEUE_INDEX`. Reset input is `BOUNTY_ID`, `CLAIM_ID`. The wallet
top-up no longer waits on an Enter key; it polls the wallet record for five
minutes.

Test harness rework, `test/david-bounty-runbook.test.js`:

- The `ssh` stub exits 65 when it gets no remote command. The old stub returned
  0, which is how it graded the bug as a pass.
- `docker`, `systemctl`, `systemd-analyze` and `journalctl` exit 70 unless
  `RUNBOOK_REMOTE=1`, which only the `ssh` stub sets. A remote-only command in a
  local block now fails.
- Three mutation checks prove those rules bite: drop the ssh from a heredoc
  block, drop the ssh from a piped block, and keep the ssh but drop its command.
  All three must fail.
- A static check requires every fence containing `docker compose`, `systemctl`,
  `systemd-analyze` or `journalctl` to be an ssh heredoc.
- Static checks ban `npx`, `read -rp` and `read -rsp` from all fences.
- Fence behaviour is now declared in a named table and driven by environment
  variables instead of fence numbers, so reordering the runbook cannot silently
  mismatch a fixture.

Method: mutation. The three mutations above reconstruct the exact pre-fix shapes
and the harness fails on each. The old README is not recoverable from git (the
directory was untracked), so a whole-document before/after run was not possible.

### P1-5 — bare `npx` in the container

Fix: all four call sites now use
`node /usr/local/lib/node_modules/brainstorm/node_modules/.bin/agent-wallet`.
Subcommands and JSON keys unchanged.

Test: `test/david-bounty-runbook.test.js` asserts no fence contains `npx`. The
container prerequisite check no longer requires `npx` either.

## P2 and P3 decisions

- **P2-6 — `readLocalReceipt` matched only `claim.event.id`. Fixed.** It now
  also matches `paymentClaimEventId`, so a replaced claim event no longer
  orphans its receipt lookup.
- **P2-7 — rank gate skipped whenever any payment row existed. Fixed.** The skip
  is scoped to `paymentConsumesSlot(payment)`, so a plain `failed` row can no
  longer carry an untrusted claim into `payments-due`.
- **P2-8 — settle script timeout below the worst case. Fixed.** `AGENT_TIMEOUT_MS`
  is 300 s, above the 220 s worst case (160 s send plus 60 s receipt poll), and
  the README's stated inner limits now say 300 s.
- **P2-9 — `updatePaymentState` could throw inside a catch block. Fixed.** The
  catch path uses `markState`, which swallows and logs a write failure so the
  `ambiguous_send` marker always lands instead of being replaced by a scope
  error.
- **P3-10 — one claim event payable once per bounty. Documented.** Section 2 of
  the runbook now says to give every bounty its own list coordinate and states
  that identity is `(bounty id, claim address)`, so two bounties sharing a
  coordinate can each pay the same claim event once, by design.

## Test result

`npm test` green after all fixes: 34 runbook fences, 3 remote-placement
mutations and 13 refusal scenarios, 33 auto-pay checks, the new migration
checks, 22 settlement checks, and the rest of the suite.

## Commit and push

- Remote: `upstream https://github.com/nous-clawds4/tapestry.git`.
  `gh api repos/nous-clawds4/tapestry` reports `push: true` for
  `matthiasdebernardini`, so no fork was needed.
- Branch: `david-bounty-issuer`.
- Implementation commit: `8b2880e7a6e9bc8def807b73747e2601e2cbe87a`.
- Pin commit: `e6c9286ed44cdca6f9319127edb988487860a1ab`.
- Branch tip: `9fb659721e956f8f8b77ca784290752cfe3acf20`.
- The runbook pins the implementation commit and enforces "or later on that
  branch" with `git merge-base --is-ancestor`. The first pin attempt checked out
  the implementation commit directly, which served a README older than the one
  being read. Section 0 now deploys the branch tip and refuses it unless the
  reviewed commit is an ancestor. `test/david-bounty-runbook.test.js` asserts
  both the pin block and the ancestor check, and a `RUNBOOK_ANCESTOR=0` scenario
  proves the refusal fires.

## Fresh-clone verification

```
$ git clone --branch david-bounty-issuer https://github.com/nous-clawds4/tapestry.git repo
$ cd repo && git rev-parse HEAD
9fb659721e956f8f8b77ca784290752cfe3acf20
$ git merge-base --is-ancestor 8b2880e7a6e9bc8def807b73747e2601e2cbe87a HEAD && echo ancestor
ancestor
$ diff -q docs/david-bounty-issuer/README.md <local working tree copy>
(no output: identical)
$ npm ci
EXIT=0
$ npm test
EXIT=0
34 runbook shell fences passed in isolated simulation; 3 remote-placement and 14 refusal scenarios passed
```

An earlier clone of the implementation commit `8b2880e7` alone also matched the
local working tree byte for byte on every source and test file checked
(`src/db/autoPay.js`, `src/api/bounties.js`, `src/services/autoPayWatcher.js`,
`docker/entrypoint.sh`, `scripts/david-bounty-settle.js`, `bin/agent.js`, and
the three new or reworked test files).

## Cloudflare site

- Live URL: **https://magic-carpet-david-issuer.matthias-4ff.workers.dev**
- Source: `NostrFabrica/david-issuer-site/` (outside the tapestry checkout, next
  to `phase1-site/`). Committed to the outer `NostrFabrica` repository as
  `76a5006`, then rebuilt and redeployed after the pin change.
- `build.js` renders `docs/david-bounty-issuer/README.md` into
  `site/index.html`. The page is never hand-edited, so the site and the
  repository cannot drift. Rebuild after every runbook commit:
  `node build.js && wrangler deploy`.
- The page has a sticky table of contents, a copy button on all 34 command
  blocks, the honesty box and the hard constraints in red, and a header giving
  the clone URL, branch, and commit. No framework, no external assets, one
  system font stack.
- Secrets scan before deploy, blocking, both runs clean:
  `rg -i 'nsec1|SESSION_SECRET=|Cookie:' site/` returns two hits and both are
  names, not values: the literal prefix test `raw.startsWith("nsec1")` and the
  sed pattern `s/^SESSION_SECRET=//p`. A stricter value-shaped scan
  (`nsec1[bech32]{20,}`, `SESSION_SECRET=<value>`, `-----BEGIN`, `connect.sid=`,
  dotted-quad IP addresses) returns nothing. The only long hex literals on the
  page are the two public issuer pubkeys and the pinned commit.
- Served HTML fetched back and diffed against the local file: identical
  (71,575 bytes, `diff` silent).

## Still needs Matthias or David

- The production SSH host, user, and key. The runbook cannot be executed against
  the box without them.
- David's secret key, held only by David.
- The approved wallet top-up amount.
- One trusted non-David claimant with issuer-relative rank 2 or more.
- The one live 100-sat payment and its kind-9735 receipt. That is section 4 and
  it is David's step.
