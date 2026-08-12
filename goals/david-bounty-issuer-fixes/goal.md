# Goal — Fix the review findings, publish the pack, deploy the Cloudflare site for David

## Objective

An independent review of the David-bounty-issuer work (produced by
`goals/david-bounty-issuer/goal.md`) returned **CHANGES REQUIRED**. This run:

1. Fixes every P0 and P1 finding, with regression tests that fail on the old
   code.
2. Addresses the P2/P3 findings (fix or document — your call, justify each).
3. Commits and pushes the whole implementation on a named branch so a fresh
   checkout can obtain it, and makes the README's branch pin real.
4. Builds and deploys a Cloudflare site that presents the finished
   instruction pack, so Matthias can send David one URL tonight. David's
   agent follows the site (or the repo README it mirrors) start to finish.

Context you must read first:

- `goals/david-bounty-issuer/goal.md` — the original goal and acceptance
  criteria. They still bind, minus the parts only David can do.
- `goals/david-bounty-issuer/notes.md` — build evidence and honest gaps.
- `docs/david-bounty-issuer/README.md` — the pack you are fixing.
- The full review findings below. Treat them as verified: the reviewer
  re-derived each from code and reproduced the P0s in isolation.

## Hard constraints (unchanged from the original goal)

- **Move zero live sats.** No wallet daemon, no funding, no payments.
- **No SSH to the instance box. No `configure-prod.yml` dispatch.** All
  verification is local (tests, isolated SQLite, spawned local HTTP).
- House issuer `853baa94…` and delegate `afb6ca29…` untouched.
- Never run the laptop `agent-wallet` daemon.
- GET-only against https://magic-carpet.brainstorm.world.

## The findings to fix

### P0-1 — SESSION_SECRET regenerated every container start

`docker/entrypoint.sh:13` runs `SESSION_SECRET="$(openssl rand -hex 32)"`
unconditionally, clobbering the value docker-compose passes in
(`docker-compose.yml:17`); it is baked into `/etc/brainstorm.conf` (line
~100) and re-sourced by the generated start script (~305-309). Every
container restart invalidates all signed cookies; the settlement timer's
auth dies; `src/middleware/sessionStore.js` delivers nothing.
**Fix:** `SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"`.
**Test gap to close:** `test/session-store.test.js:79` passes an explicit
`secret`, so restart never exercises env resolution. Add a check that
resolves the secret the way production does (env in, same secret out across
two boots; distinct secrets when env is absent).

### P0-2 — Migration closes live house bounties

`src/db/autoPay.js:37-89`: migrating old `auto_payments` rows writes
`claimant_pubkey = NULL`, `claim_address = "legacy:<event>"`. Then
`src/api/bounties.js:195-197,223` sets `legacyPaymentBlock` and
`src/lib/bounty-policy.js:99,128-134` pushes every unpaid claim to
`closedClaims` (`legacy_payment_reconciliation_required`). First boot after
deploy, every prod bounty with an existing settled/paid_unreceipted row —
including the live Arizona bounty `99c99258…` with 4 open slots — refuses
all new claims, silently, with no repair path.
**Fix (smallest correct):** in the migration, backfill
`claimant_pubkey`/`claim_address` from the claim event when it is still
resolvable, and gate `legacyPaymentBlock` on rows that remain unresolvable.
Ship a one-shot repair command (`bin/agent.js` subcommand) for rows the
migration cannot resolve, and put it in the runbook before the deploy step.
**Test gap to close:** run `ensureAutoPaymentsSchema` against a
pre-migration fixture DB that has a settled row + an open bounty, and assert
new claims stay claimable after migration.

### P1-3 — One `paid_unreceipted` row fails the timer forever

`src/services/autoPayWatcher.js:365-378`: an unreceipted row yields
`ok:false, status:'reconciliation_unresolved'` on every pass;
`scripts/david-bounty-settle.js:408-451,480` counts it as a failure and
exits 1. Strike has genuinely produced this state before. The oneshot
systemd unit then reports failed on every run, and the runbook's own gate
(`README.md:486`, `test "$DRY_RUN_STATUS" -eq 0`) can never pass again.
**Fix:** make `paid_unreceipted` terminal after a bounded wait (fixed age or
N receipt attempts) — report `ok:true` with an informational status — or add
an explicit acknowledge command that removes the row from the reconciliation
query (`src/db/autoPay.js:192-198`). Update `README.md:622` ("Reconcile
until a receipt appears") to the bounded behavior.

### P1-4 — Runbook remote blocks execute on the wrong machine

`docs/david-bounty-issuer/README.md:151,228,406` open sections with a bare
`ssh "$SSH_HOST"`; sections 4-5 (`:526,567,598`) use `docker compose exec`
with no ssh at all. Driven non-interactively (any agent shell), the deploy,
systemctl, and exec commands run on David's laptop, or `read -rp`
(`:154-155`) eats the following lines.
**Fix:** every remote block becomes a single
`ssh "$SSH_HOST" 'bash -s' <<'REMOTE' … REMOTE` heredoc; replace every
`read -rp` with variables exported before the heredoc. Sections 4-5 get the
same treatment.
**Test gap to close:** `test/david-bounty-runbook.test.js:109` stubs ssh as
`if test "$#" -le 1; then exit 0; fi` — it reproduces the bug and calls it a
pass. Rework the harness so a bare `ssh` with no command FAILS the test, and
remote-only commands (docker compose, systemctl) fail if they appear outside
a remote heredoc.

### P1-5 — Bare `npx` in the container

`README.md:169,181,196,611`: `docker compose exec -T tapestry npx
@moneydevkit/agent-wallet …`. The image has no WORKDIR; CWD is `/`; npx
falls through to a registry install — unpinned wallet code against the live
seed, or a hang on the prompt.
**Fix:** use the absolute path the rest of the runbook uses:
`node /usr/local/lib/node_modules/brainstorm/node_modules/.bin/agent-wallet …`.
(The subcommands and JSON keys themselves were verified correct — do not
change them.)

### P2/P3 — fix or document, one line of justification each

- **P2-6:** `readLocalReceipt` matches on `claim.event.id`
  (`autoPayWatcher.js:349,49-52`); a replaced claim event orphans the
  receipt lookup forever (compounds P1-3). Prefer matching on
  `claimAddress`/`paymentClaimEventId`.
- **P2-7:** `src/api/bounties.js:180` skips the rank gate whenever any
  payment row exists; scope the skip to rows where
  `paymentConsumesSlot(payment)` is true. (No money risk — pay paths
  re-check rank — but `payments-due` misleads.)
- **P2-8:** settle script timeout 180 s (`david-bounty-settle.js:148`) <
  worst-case 220 s (160 s send + 60 s receipt poll). Raise above 240 s and
  fix the numbers stated at `README.md:421`.
- **P2-9:** `updatePaymentState` throws on 0 changes (`autoPay.js:417`) and
  is called inside catch blocks (`autoPayWatcher.js:176,206,217`); wrap
  those calls in their own try so the ambiguous-send marker always lands.
- **P3-10:** one claim event can now be paid once per bounty when two
  bounties share a list coordinate (identity is `(bounty_id,
  claim_address)`, `autoPay.js:28`). Intended design change — add one line
  to the runbook saying so.

## Tasks

### 1. Fix, test, verify

Apply the fixes above. Every P0/P1 fix gets a regression test that fails on
the pre-fix code (verify that claim by stashing or by reasoning from the
test body — state which in notes). `npm test` must end green. Record
evidence in `goals/david-bounty-issuer-fixes/notes.md` as you go.

### 2. Commit and push

- Verify push access: `git remote -v` currently shows only
  `upstream https://github.com/nous-clawds4/tapestry.git`. Push a branch
  named `david-bounty-issuer` there if permitted; otherwise push to
  whatever remote Matthias's `gh auth status` account can write (fork it
  with `gh repo fork` if needed) and use that in the pin.
- Stage ONLY what belongs to this deliverable: the modified tracked files
  from the phase-1/issuer work, `scripts/david-bounty-settle.js`,
  `src/middleware/sessionStore.js`, `systemd/david-bounty-settlement.*`,
  `docs/david-bounty-issuer/`, the new tests, and the two goals folders. Do
  NOT sweep in screenshots, demo captures, `.cap` dirs, `data/`,
  `undefined/`, ledgers, or unrelated HTML notes. Never commit
  `.fallow/` or anything containing a secret — check the diff for nsec/hex
  secrets before committing.
- Update `docs/david-bounty-issuer/README.md:36-44` so the pinned
  remote/branch/commit is REAL and fetchable, then amend/commit so the
  pinned commit statement is accurate (pin the parent commit and say
  "or later on this branch", to escape the chicken-and-egg).

### 3. The Cloudflare site

Model: `../phase1-site/` (a Workers static-assets site — `wrangler.jsonc`
with `assets.directory: ./site`, deployed via `wrangler deploy`; wrangler is
installed and authenticated on this machine).

- Create `david-issuer-site/` next to `phase1-site/` (repo root
  `NostrFabrica/`, NOT inside magic-carpet-v2): `wrangler.jsonc` with name
  `magic-carpet-david-issuer`, `site/index.html`.
- `index.html` renders the FINAL committed README as a clean single-page
  doc: sticky table of contents, monospace copy-button code blocks, the
  hard-constraint warnings visually loud (red/bordered), a header line
  giving the repo + branch + commit to clone. Static HTML/CSS/minimal JS,
  no framework, no external assets except a system font stack.
- Generate the HTML FROM the README (a small build script checked in next
  to it is fine) so the two cannot drift; regenerate after the final
  commit so the pinned commit hash on the page is the real one.
- **Secrets scan before deploy (blocking):** the page is public. Verify the
  README/HTML contain no nsec, no hex private keys, no session cookies, no
  `.fallow` contents, no internal IPs. `rg -i 'nsec1|SESSION_SECRET=|Cookie:'`
  over the site dir must be clean (variable NAMES are fine, values are not).
- Deploy with `wrangler deploy` from `david-issuer-site/`. Record the
  `*.workers.dev` URL. Fetch it once and diff the served HTML against the
  local file.

### 4. Update the pack's honesty box

The README must state plainly, near the top, what has NOT been executed:
no dry-run under David's identity yet, and the one live 100-sat proof is
his step. Keep the review's fixed gates intact (disabled-timer-first,
dry-run-before-live).

## Acceptance criteria

- All P0/P1 findings fixed; each has a regression test; `npm test` green.
- P2/P3 each fixed or documented with a one-line justification in notes.
- Branch pushed; `git clone` + checkout of the pinned ref yields the exact
  implementation, README pin verified by actually fetching it fresh into a
  temp dir.
- Cloudflare site live; served HTML matches the committed README; secrets
  scan clean; URL recorded in notes.
- Zero live sats; no SSH; no workflow dispatch; house delegate untouched.

## Report

End with: the live site URL, the branch + pinned commit, the P0/P1 fix
list with test names, what you chose for each P2/P3, and anything that
still needs Matthias or David (SSH access decision, the live proof).
