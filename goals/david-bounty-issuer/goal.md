# Goal — Make David Strayhorn a bounty issuer (instruction pack + tested payment script)

## Objective

Produce a tested, self-contained instruction pack that David Strayhorn hands to
HIS OWN Claude so it can, with no other context:

1. Set up the MDK (Money Dev Kit — `@moneydevkit/agent-wallet`, the Lightning
   wallet the payer uses) and fund it.
2. Issue a bounty from a natural-language request. The canonical ask to
   support: *"hey Claude, issue a 100 sat bounty for a random list, like
   cities in a randomly chosen state."*
3. Run a payments-due settlement script on a schedule (cron or systemd timer)
   so claims on David's bounties get paid when they are due.

Every command that goes into the pack must be executed and verified in this
run first — dry-run wherever money or persistent state is involved. **Move no
live sats in this run.** The one live 100-sat proof payment is a step David's
Claude performs, scripted in the pack, not something you do here.

## Who is who

- **David Strayhorn** — instance owner and rank-author. Npub `straycat`,
  hex `e5272de9…`, rank 100 from the issuer's point of view. Lightning address
  `straycat@primal.net`. He will be the NEW issuer.
- **Instance:** https://magic-carpet.brainstorm.world (David's box). Rank
  author / TA pubkey `bd406289…`.
- **House issuer (existing):** `853baa94…`, already in
  `AUTO_PAY_ALLOWLIST_PUBKEYS`. Its auto-pay delegate is `afb6ca29…`.
  David's setup must not disturb either.

## Read these first (they already solve most of this)

- `.claude/skills/magic-carpet-bounty-generator/SKILL.md` — issuer-side
  create-list/create-bounty loop with budget ledger. The "issue a bounty from
  a sentence" recipe should reuse this, not reinvent it.
- `.claude/skills/magic-carpet-bounty-cycle/SKILL.md` — judgment-gated
  settle loop (watch → trust check → judge → pay → receipt). The payment
  script is essentially this skill made non-interactive.
- `.claude/skills/magic-carpet-operator/SKILL.md`
- `bin/agent.js` — the CLI both skills drive (`auth-login`, `create-list`,
  `create-bounty`, `pay --dry-run`, `balance`, `provision-delegate`).
- `src/db/autoPay.js` and the auto-pay watcher source — caps and the
  watcher's judgment-free behavior.
- `phase1-workstream-b-runbook.md`, `phase1-test-plan.md`,
  `demo-notes-david-2026-08-07.md` — proven receipt path and rehearsal record.
- `mdk-support-ticket.md`, `plan-mdk-wallet-swap.html`,
  `notes-mdk-wallet-swap.html` — MDK failure history and wallet plumbing.

## Architecture questions you must resolve from code (not by assumption)

1. **Whose wallet pays David's bounties?** The instance appears to run ONE
   MDK agent wallet (pay/balance run only on the instance box — SQLite DB,
   wallet, audit file; no HTTP pay endpoint). Determine from code whether a
   second issuer can have his own wallet, or whether all issuers spend the
   single instance wallet float. State the answer with file/line evidence and
   design the pack accordingly. If the wallet is shared, the pack must tell
   David how to fund IT (receive invoice path) and must say plainly that the
   float is shared with the house issuer.
2. **What does `provision-delegate --issuer <davidHex>` actually touch?**
   Confirm from code that provisioning a delegate for a NEW issuer cannot
   rotate the house delegate `afb6ca29…` or orphan existing receipt
   validation. If it can, stop and report instead of including the step.
3. **Auto-pay vs judgment-gated settlement for David.** The background
   auto-pay watcher pays payable claims WITHOUT consulting judgments; the
   bounty-cycle path is judgment-gated. Pick one settlement model for David's
   cron script, justify it in one paragraph, and make the pack internally
   consistent (never both against the same bounty).

## Hard constraints — these go in the pack verbatim as warnings

- **NEVER run `configure-prod.yml` with `issuer_pubkey` set.** It rotates the
  house delegate and orphans receipt validation. Allowlist changes go through
  `allowlist_pubkeys` only.
- **Never run the laptop `agent-wallet` daemon while the instance is live.**
  Same seed; it starves the prod node to 0 msat outbound.
- `AUTO_PAY_ZAP_RELAYS` must keep the public relays (damus, nos.lol, primal)
  or Strike never publishes the kind-9735 receipt.
- Per-issuer daily cap is 5,000 sats, hardcoded
  (`AUTO_PAY_DAILY_LIMIT_SATS` in `src/db/autoPay.js`); per-payment cap is
  `AUTO_PAY_MAX_SATS` (default 5000). The pack must not promise budgets past
  them.
- Judgment gate stays on (`AGENT_REQUIRE_JUDGMENT` unset). Trust gate: rank
  ≥ 2. Self-dealing: an issuer is never paid on his own bounty.

## Tasks

### 1. Recon and decisions

Read the files above, resolve the three architecture questions, and write the
answers (with evidence) into `goals/david-bounty-issuer/notes.md` as you go.

### 2. Payments-due settlement script

Prefer wiring existing code over writing new code. If the auto-pay watcher or
an existing script already IS the settlement loop, the deliverable is the
configuration + invocation for David, not a new program. Only if nothing
non-interactive exists: write the smallest script that

- lists David's bounties' payable claims (`GET /api/bounties/mine/payments-due`
  or equivalent),
- enforces the trust and self-dealing checks via `pay --dry-run` first,
- pays, logs one line per action to a file, and is idempotent across runs,
- exits non-zero on any unexpected state so cron mail/logs surface it.

Test it here with `--dry-run` end to end. Give it a runnable self-check.

### 3. Schedule entry

The instance box is Linux: provide the exact systemd service + timer (or
crontab line if the box already uses cron for siblings — match what exists),
with log location and a one-line "how to check it ran" command.

### 4. The bounty-issuance recipe

Exact command sequence for the canonical ask, reusing the bounty-generator
skill's conventions (ledger, dedupe, criteria rule):

- pick a random US state locally (e.g. `shuf` over a 50-state list — include
  the list),
- `create-list` with singular/plural/description templates filled for that
  state,
- `create-bounty` with amount 100, cap 500 (5 slots), and a one-sentence
  objectively checkable criterion ("Submit a city located within the state of
  Tennessee to earn the reward." is the model),
- verify the bounty is live via the API and print its URL.

Execute the sequence here against the instance as a REAL verification with
the house issuer key (secrets in `.fallow/secrets.env`) — creating a list and
bounty is cheap and reversible; note the created ids in `notes.md` so Matthias
can clean up. Do not fund or pay anything.

### 5. The instruction pack (the deliverable David asked for)

Write `docs/david-bounty-issuer/README.md`, addressed to David's Claude,
self-contained for a fresh repo checkout. Sections, in order:

0. What you need before starting (repo checkout, `MC_NSEC` = David's key,
   `MC_BASE_URL`, SSH to the instance box, which steps MUST run on the box).
1. One-time setup: MDK wallet (per the architecture decision), funding it,
   allowlisting David's npub, `provision-delegate`, and how to verify each
   step worked.
2. Issuing a bounty from a sentence (the Task-4 recipe, generalized past
   "cities in a state" to any category).
3. Installing the settlement script + schedule, and how to confirm the first
   scheduled run fired.
4. The live proof: one 100-sat bounty, one claim, payment + kind-9735 receipt
   confirmed — the checklist that says "you are now a working issuer".
5. Troubleshooting: receipt missing (`paid_unreceipted`), rank 0 everywhere
   (TA data not loaded), wallet "insufficient outbound capacity" (see
   `mdk-support-ticket.md` history), claim invisible (rank < 2 or published
   to public relays).
6. The hard-constraint warnings, verbatim.

Write it in plain STE-style prose. Every command in a fenced block, copy-paste
ready, no placeholders left unexplained.

## Acceptance criteria

- Every command in the pack was run in this session (dry-run where money or
  prod state is involved) and the evidence lives in
  `goals/david-bounty-issuer/notes.md`.
- Zero live sats moved; house delegate and laptop wallet daemon untouched.
- The three architecture questions are answered with file/line evidence.
- The settlement script (or configured existing equivalent) has a recorded
  dry-run pass and a self-check.
- A Claude with only the repo, David's nsec, and box SSH could follow the
  pack start to finish.

## Out of scope

Locking down the exposed Meilisearch port, the four-person Avi/team run, the
post-demo wallet burn-down, and any frontend work.

## Report

End with: the shared-vs-own-wallet decision in two sentences, files written,
bounty/list ids created during verification, dry-run evidence summary, and
any open questions only David or Matthias can answer.
