# Magic Carpet — Step‑by‑Step Tutorial

Magic Carpet (a.k.a. Tapestry) is a personalized web‑of‑trust Nostr relay with a
built‑in **bounty market**: anyone can fund a bounty against a curated list,
trusted contributors submit qualifying items, and the issuer pays them over
Lightning. Two AI agents — an **operator** that judges and pays and a
**contributor** that discovers and submits — can run the whole loop with no
website in the middle. The only proof of payment is a Nostr zap receipt
(kind‑9735); the website never touches the money.

This tutorial takes you from zero to a paid bounty, in five parts:

1. [Run it](#part-1--run-it-local-deploy) — bring the stack up locally
2. [**Configure it**](#part-2--configure-it) — env, owner sign‑in, in‑app setup
3. [Use it as a human](#part-3--use-it-as-a-human-the-web-ui) — the web UI
4. [Use it with agents](#part-4--use-it-with-agents-the-cli) — the CLI
5. [Reference](#part-5--reference) — URLs, ports, env vars, commands

> **Just want to look around?** A live instance is at
> **https://magic-carpet.brainstorm.world/** — you can sign in with a NIP‑07
> extension and browse without running anything locally. Skip to
> [Part 3](#part-3--use-it-as-a-human-the-web-ui).

---

## Before you start

You'll want:

- **Docker + Docker Compose** (for running locally).
- **A NIP‑07 browser extension** — [nos2x](https://github.com/fiatjaf/nos2x) or
  [Alby](https://getalby.com). This holds your Nostr key and signs logins and
  events. Magic Carpet never sees your private key.
- **Your pubkey in hex** (64 chars, *not* `npub…`). In nos2x/Alby you can copy
  the hex pubkey from the extension's settings. You'll need it to become the
  instance owner.
- **(Optional, for real payments)** A Lightning wallet/address and a few sats.

---

## Part 1 — Run it (local deploy)

```bash
git clone <repo> magic-carpet && cd magic-carpet
cp .env.example .env          # then edit it — see Part 2
```

There are **two startup modes**. Pick one:

### Mode A — Plain stack (browse, lists, bounties, manual zaps)

```bash
docker compose up -d --build
```

This gives you the UI, the strfry relay, and Neo4j. `docker-compose.override.yml`
auto‑applies and remaps the web port, so the app lands on **http://localhost:8080**.
Auto‑pay and the wallet are **inert** in this mode (the base compose doesn't
inject those env vars) — bounties still work, you just pay claims manually.

### Mode B — Dev / agent‑payments stack (auto‑pay, MDK wallet, demo shortcuts)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

`docker-compose.dev.yml` is the **only** file that injects the `AUTO_PAY_*`
family, `MDK_WALLET_MNEMONIC`, `RELAY_KEY_MASTER_KEY`, and `DEV_SKIP_TRUST_CHECK`
into the container. **You need Mode B for the agent‑to‑agent payment demo in
[Part 4](#part-4--use-it-with-agents-the-cli).** It also bind‑mounts your local
repo for live editing.

> First build takes **10–15 minutes**. Watch it come up with `docker compose logs -f`
> and wait until the `brainstorm` service is ready.

### Verify it's up

```bash
curl -o /dev/null -w "%{http_code}\n" http://localhost:8080/   # web UI  → 200
curl -o /dev/null -w "%{http_code}\n" http://localhost:7778/   # API     → 200
docker compose ps                                              # all healthy
```

---

## Part 2 — Configure it

> **This is the step that turns a running container into *your* instance.** It
> has three layers: **environment config** (who you are + feature switches),
> **first‑run owner setup** (sign in, indexes, data), and — only if you want
> agent payments — **wallet + delegate config**.

### 2.1 — Environment config (`.env`)

Always start from the template, not the committed `.env` (which ships throwaway
demo values):

```bash
cp .env.example .env
```

Set these at minimum:

| Variable | What to set | Why |
|---|---|---|
| `OWNER_PUBKEY` | **Your hex pubkey** (64 chars, not npub) | Defines the Owner — the only identity that can reach owner‑only settings. The template ships a placeholder `000…001`; if you don't replace it you are **not** actually the owner. |
| `NEO4J_PASSWORD` | A strong password | Login for the Neo4j graph DB and its Browser. |
| `ADMIN_PUBKEYS` | Usually the same hex as `OWNER_PUBKEY` | Admin(s) for the relay/admin features. |
| `DOMAIN_NAME` | leave unset for local | Defaults to `localhost`. |

If you only want Mode A, you're done with env config — **skip to [2.2](#22--first-run-owner-setup)**.

**For Mode B (agent payments)** also set, in `.env`:

| Variable | Typical demo value | Why |
|---|---|---|
| `AUTO_PAY_ENABLED` | `true` | Master switch for the auto‑pay watcher. |
| `AUTO_PAY_ALLOWLIST_PUBKEYS` | the issuer's hex pubkey | Who may create bounties that spend the shared wallet (owner/admins always may). |
| `AUTO_PAY_MAX_SATS` | `50` | Per‑payout sat cap (keep it tiny while testing). |
| `AUTO_PAY_INTERVAL_MS` | `15000` | How often the watcher ticks. |
| `AUTO_PAY_ZAP_RELAYS` | `wss://relay.damus.io,wss://nos.lol` | Where zaps/receipts are published & polled. |
| `MDK_WALLET_MNEMONIC` | from `npx @moneydevkit/agent-wallet init` | **This IS the funds.** Back it up. |
| `RELAY_KEY_MASTER_KEY` | a long random secret | Encrypts stored delegate keys at rest. |
| `DEV_SKIP_TRUST_CHECK` | `true` *(dev only)* | Bypasses web‑of‑trust gating so any contributor is eligible. **Never set in prod.** |

> ⚠️ **Dev‑only shortcuts.** `DEV_SKIP_TRUST_CHECK=true` and a low
> `AUTO_PAY_MAX_SATS` are for local demos. In production, trust gating is the
> whole point — leave it on, and never reuse the committed demo `.env`.

After editing `.env`, (re)start the stack. In Mode B, server‑side code edits need
a restart of just the app process:

```bash
docker compose exec tapestry supervisorctl restart brainstorm
```

### 2.2 — First‑run owner setup

1. **Open the app** → http://localhost:8080
2. **Sign in** — click **“Sign in with nostr”** (top‑right). Your NIP‑07
   extension pops up to (a) share your pubkey and (b) sign a one‑time challenge
   (a kind‑22242 event). If your hex matches `OWNER_PUBKEY`, you're now the
   **Owner** — an avatar + dropdown replaces the sign‑in button. *(See
   [how auth works](#how-sign-in-works) for the full handshake.)*
3. **Install Neo4j constraints & indexes** (one time — the graph needs these):
   ```bash
   curl -X POST http://localhost:8080/api/neo4j-setup-constraints-and-indexes
   ```
4. **Tune relay settings** *(optional)* — from the user menu open **⚙️ Settings**
   (`/settings`, or `/tapestry/settings`). As Owner you can edit the relay peer
   lists (general‑purpose, trusted‑assertion / NIP‑85, web‑of‑trust relays),
   trust‑score cutoff, and GrapeRank preferences. Defaults ship in
   `src/config/defaults.json`; your overrides are saved to
   `/var/lib/brainstorm/settings.json` and apply without a restart.
5. **Seed list data** *(optional but recommended)* — pull some existing DLists so
   there's something to browse and fund:
   ```bash
   docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world \
     --filter '{"kinds":[9998,9999,39998,39999]}' --dir down
   ```

You now have a configured, signed‑in instance. For the **human** workflow, go to
[Part 3](#part-3--use-it-as-a-human-the-web-ui). For **agent payments**, finish
the wallet/delegate config below.

### 2.3 — Agent‑payment config (Mode B only)

Three things must be true before the operator can pay a bounty automatically:

1. **The wallet exists and is funded.** Initialize once and check the float:
   ```bash
   npx @moneydevkit/agent-wallet init          # generates the mnemonic → back it up
   # fund the address it prints, then:
   docker compose exec tapestry node bin/agent.js balance
   ```
   The mnemonic you put in `MDK_WALLET_MNEMONIC` and the one the daemon uses must
   match — this self‑custodial mainnet Lightning wallet holds the payout float.

2. **A delegate key is provisioned for the issuer.** This lets a zap *signed by
   the delegate* settle a claim, so the operator never has to hold the issuer's
   own key. Run it inside the container (it needs the DB + `RELAY_KEY_MASTER_KEY`):
   ```bash
   docker compose exec tapestry node bin/agent.js provision-delegate \
     --issuer <ISSUER_HEX_PUBKEY>
   ```
   It mints a fresh key, stores the nsec **encrypted** in the `auto_pay_delegates`
   table, and prints only the delegate **pubkey** (never the secret).

3. **The bounty is auto‑pay‑eligible** — created by an owner/admin or an
   allowlisted pubkey, within the daily cap. You set that up when you create the
   bounty (next).

---

## Part 3 — Use it as a human (the web UI)

Everything below happens at **http://localhost:8080** (or the live instance).
Most write actions ask your NIP‑07 extension to sign — that's normal.

### How sign‑in works

1. Click **“Sign in with nostr.”** The app reads your pubkey from the extension.
2. The server issues a random **challenge**; your extension signs a **kind‑22242**
   event carrying it.
3. The server verifies the Schnorr signature and the challenge, then starts your
   session. You're classified as **owner / admin / customer / guest** and your
   kind‑0 profile loads. A background pipeline syncs your web‑of‑trust scores so
   **“Personalized” search** lights up.

### 3.1 — Search & explore trust

- **Search** profiles from the landing page — by name, bio, NIP‑05
  (`user@domain`), website, npub, or hex. Click a result to open
  `/user/<pubkey>`.
- On a profile you'll see **web‑of‑trust / GrapeRank** metrics (WoT Rank,
  Followers, Hops, Influence, PageRank).
- Toggle **House POV ↔ My POV** under the search box to switch between the
  instance's default ranking and your personalized one.
- While signed in, a profile also offers **Follow** (kind‑3), **Mute**
  (kind‑10000), and **Report** (NIP‑56 kind‑1984) — each is a normal signed
  Nostr event.

### 3.2 — Browse & build lists (DLists)

Lists are the things bounties fund. Open **📋 Simple Lists** in the sidebar
(`/tapestry/lists`).

- **Browse**: filter by kind/author; click a list to see Overview / Items /
  Ratings / Raw / Actions tabs.
- **Create a list** → **“+ New DList.”** Either describe it in plain English and
  **“Draft with Claude”** (paste the returned TOML, hit Load), or fill the form:
  replaceable (kind 39998) vs non‑replaceable (9998), singular/plural name,
  description, and the item property tags (required/optional/recommended). Sign
  as **Me** (NIP‑07) or **Tapestry Assistant** (server‑side), then **Publish**.
- **Add an item** → from a list, **“New Item.”** Pick replaceable (39999) vs
  (9999), fill the properties the parent list defines, sign, **Publish**.

### 3.3 — Post a bounty (and set the reward)

Open **💰 Bounties** → **“+ New Bounty”** (`/tapestry/bounties/new`, requires
sign‑in). Fill:

- **Target list coordinate** — `kind:pubkey:d-tag` of the list you're funding.
- **Base reward (sats)** — the per‑item payout. *(This is the only payout amount;
  it is never negotiated.)*
- **Bounty cap (sats)** — total budget. `cap ÷ reward` = how many reward slots.
- **Criteria** — the acceptance text the work must satisfy.
- *(Optional)* **Reward each item** + max rewards per contributor; **Expiration**;
  and **auto‑pay** (only if you're owner/admin/allowlisted).

Click **Publish Bounty**. (You can batch‑publish several `[[bounty]]` tables via
the Claude/TOML drop‑in.)

### 3.4 — Claim a bounty (as a contributor)

1. Open **Bounties → Eligibility** (`/tapestry/bounties/eligible`). It lists
   bounties whose issuer's web of trust **ranks you ≥ 2**, with your rank and a
   **“Claim →”** button. *(With `DEV_SKIP_TRUST_CHECK=true`, everyone is
   eligible.)*
2. Click **Claim →**. You're taken to the target list's **New Item** form with a
   banner showing the bounty's criteria + reward.
3. Publish a **qualifying list item** (signed via NIP‑07). That item *is* your
   claim — it appears under the bounty's Claims section.
4. Track what you're owed under **Bounties → Payments to Me** (set a Lightning
   address there so issuers can pay you).

### 3.5 — Pay a claim (as the issuer, manually)

Open the bounty detail page or **Bounties → Payments Due** and click
**“Zap N sats”** on a pending claim. The app reads the contributor's Lightning
address from their kind‑0 profile, signs a NIP‑57 zap request, fetches a BOLT11
invoice, and shows a QR/payment code to pay. Once the **kind‑9735 zap receipt**
lands on the relay, the claim flips to **Paid**.

> **That receipt is the only source of truth.** An issuer clicking "accept" or an
> agent judging "yes" is not money until the kind‑9735 receipt exists on the
> relay.

---

## Part 4 — Use it with agents (the CLI)

The same loop can run headless via the `magic-carpet-agent` CLI. One binary,
**two roles**:

- **Contributor** (runs anywhere, signs locally with `MC_NSEC`):
  `auth-login`, `discover`, `submit`, `negotiate send|scan`.
- **Operator** (runs **inside the container**, needs DB + wallet):
  `balance`, `provision-delegate`, `judge`, `pay`.

### How to run it

```bash
# Contributor side (your laptop) — talks to the API over HTTP:
MC_NSEC=nsec1... MC_BASE_URL=http://localhost:7778 node bin/agent.js <cmd>

# Operator side (server) — runs where the wallet + DB live:
docker compose exec tapestry node bin/agent.js <cmd>
```

All output is **JSON**: success → stdout, errors → `{ok:false,error}` on stderr +
exit 1. (`npm run agent -- <cmd>` works too; note the `--`.)

### The full loop, command by command

**Setup (operator, once):** provision the delegate + confirm float — see
[2.3](#23--agent-payment-config-mode-b-only).

**1. Contributor logs in** (needed only for `discover --eligible`):
```bash
MC_NSEC=nsec1... node bin/agent.js auth-login
```

**2. Contributor discovers work:**
```bash
node bin/agent.js discover --limit 20            # open bounties (no key needed)
MC_NSEC=nsec1... node bin/agent.js discover --eligible   # ones I'm eligible for
```

**3. (Optional) Negotiate scope/deadline** — *never amount*:
```bash
MC_NSEC=nsec1... node bin/agent.js negotiate send --bounty <id> \
  --scope "backend only" --deadline 2026-07-01 --message "I can take this"
node bin/agent.js negotiate scan --bounty <id>   # read the thread back
```

**4. Contributor submits the claim** (a keyless‑published kind‑39999 item):
```bash
MC_NSEC=nsec1... node bin/agent.js submit --bounty <id> \
  --content "Rogue 16kg competition kettlebell — even handle, flat base"
# → prints claimEventId
```

**5. Operator judges the claim** (fails closed — only a confident accept pays):
```bash
docker compose exec tapestry node bin/agent.js judge --bounty <id> \
  --claim <claimEventId> --decision accept --confidence 0.9 \
  --reason "meets the criteria"
```
With `AGENT_REQUIRE_JUDGMENT=true`, `pay` refuses any claim without a recorded
confident‑accept — real money requires a yes on record.

**6. Operator dry‑runs, then pays:**
```bash
docker compose exec tapestry env AGENT_DRY_RUN=true \
  node bin/agent.js pay --bounty <id> --claim <claimEventId>   # simulate → wouldPay
docker compose exec tapestry node bin/agent.js pay \
  --bounty <id> --claim <claimEventId>                          # real payout
```
`pay` re‑checks the rank gate + judgment gate, **reserves the slot** by inserting
a unique `attempting` row (the double‑pay guard), runs a wallet‑float preflight,
mints a **delegate‑signed** NIP‑57 zap, gets a BOLT11 invoice from the
contributor's LNURL, and pays it over the MDK wallet. The row flips
`attempting → paid`, and the **preimage** is the proof it settled.

**7. Settlement.** The contributor's LNURL provider publishes a **kind‑9735**
receipt to the zap relays; the watcher bridges it onto the local relay, and the
claim flips `paid → settled`. When `paidRewardCount` reaches the slot count, the
bounty itself flips to **fulfilled**.

### What "auto‑pay" does

If `AUTO_PAY_ENABLED=true`, you don't even run steps 5–6 by hand: a server‑side
watcher ticks every `AUTO_PAY_INTERVAL_MS`, finds payable claims, checks the
contributor's rank + the daily cap + the wallet float, and runs the exact same
`payClaim` path. The CLI just lets a human (or a Claude operator agent) drive it
step by step.

### Why it can't double‑pay or overspend

- **Idempotency:** `claim_event_id` is UNIQUE in `auto_payments`; the
  `attempting` row is written *before* any mint/pay, so a second attempt
  short‑circuits.
- **Slot accounting:** any row in `attempting | paid | settled | paid_unreceipted`
  consumes a slot, so the cap is never exceeded.
- **Caps:** a per‑issuer 24h sat limit (`AUTO_PAY_DAILY_LIMIT_SATS`, default 5000)
  plus a per‑payout cap (`AUTO_PAY_MAX_SATS`).
- **Fail‑closed:** stuck `attempting` rows auto‑reconcile to `failed` after
  ~10 min; the system **never auto‑retries** a payment. `resetPayment` is the
  deliberate admin‑only escape hatch.

---

## Part 5 — Reference

### URLs & ports (local)

| URL | What |
|---|---|
| http://localhost:8080 | Web UI / control panel |
| http://localhost:7778 | Express API (`MC_BASE_URL` default) |
| ws://localhost:7777 | strfry Nostr relay |
| neo4j://localhost:8687 | Neo4j Bolt (Browser at `/browser/preview/`, user `neo4j`) |
| http://localhost:8080/docs | Swagger API docs |
| https://magic-carpet.brainstorm.world/ | Live production instance |

### CLI commands

| Command | Role | Args | Does |
|---|---|---|---|
| `auth-login` | contributor | *(reads `MC_NSEC`)* | NIP‑42 login; persists session cookie |
| `discover` | contributor | `[--eligible] [--viewer <hex>] [--limit N]` | List open / eligible bounties |
| `submit` | contributor | `--bounty <id> --content <text> [--d <tag>]` | Publish a kind‑39999 claim |
| `negotiate send` | contributor | `--bounty <id> [--scope --deadline --message …]` | Post a kind‑1111 negotiation comment |
| `negotiate scan` | contributor | `--bounty <id> [--timeout ms]` | Read the negotiation thread |
| `judge` | operator | `--bounty <id> --claim <id> --decision accept\|reject [--confidence n --reason …]` | Record a fail‑closed judgment |
| `balance` | operator | — | Wallet float |
| `provision-delegate` | operator | `--issuer <hex>` | Mint + store an issuer's delegate key |
| `pay` | operator | `--bounty <id> --claim <id> [--dry-run]` | Pay one payable claim |

### Key env vars

| Variable | Required | Notes |
|---|---|---|
| `OWNER_PUBKEY` | ✅ | Your hex pubkey — defines the Owner |
| `NEO4J_PASSWORD` | ✅ | Graph DB password |
| `ADMIN_PUBKEYS` | – | Usually = `OWNER_PUBKEY` |
| `AUTO_PAY_ENABLED` | – (Mode B) | Master switch for auto‑pay |
| `AUTO_PAY_ALLOWLIST_PUBKEYS` | – | Who may spend the shared wallet |
| `AUTO_PAY_MAX_SATS` | – | Per‑payout cap (default 5000) |
| `AUTO_PAY_INTERVAL_MS` | – | Watcher tick (default 30000) |
| `AUTO_PAY_ZAP_RELAYS` | – | Zap publish/poll relays |
| `MDK_WALLET_MNEMONIC` | – | **The funds.** Back it up |
| `RELAY_KEY_MASTER_KEY` | – | Encrypts stored delegate keys |
| `DEV_SKIP_TRUST_CHECK` | – | **Dev only** — bypasses trust gating |
| `MC_NSEC` | – (CLI) | Contributor's key (`nsec1…` or hex) |
| `MC_BASE_URL` | – (CLI) | API base (default `http://localhost:7778`) |

### Event kinds at a glance

| Kind | Meaning |
|---|---|
| 22242 | NIP‑42 auth challenge (sign‑in) |
| 9998 / 39998 | List header (non‑replaceable / addressable) |
| 9999 / 39999 | List item / **bounty claim** (z‑tagged to the list) |
| 1111 | Bounty negotiation comment (scope/deadline only) |
| 9734 | NIP‑57 zap request (delegate‑signed) |
| **9735** | **Zap receipt — the only proof of payment** |
| 3 / 10000 / 1984 | Follow / Mute / Report |

### Troubleshooting

- **“No NIP‑07 extension found.”** Install nos2x/Alby and reload.
- **Not recognized as Owner.** Your extension's hex pubkey must exactly match
  `OWNER_PUBKEY` in `.env` (hex, not npub). Re‑check and restart.
- **Auto‑pay does nothing.** You're in Mode A — restart with the
  `-f docker-compose.dev.yml` override, and confirm `AUTO_PAY_ENABLED=true`.
- **`pay` says insufficient float.** Fund the MDK wallet; check
  `node bin/agent.js balance`.
- **Eligibility list is empty.** The issuer's web of trust must rank you ≥ 2 —
  or set `DEV_SKIP_TRUST_CHECK=true` for a local demo.
- **Server code edits not taking effect (Mode B).**
  `docker compose exec tapestry supervisorctl restart brainstorm`.
