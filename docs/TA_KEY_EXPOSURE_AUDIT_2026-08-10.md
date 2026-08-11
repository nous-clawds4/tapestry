# Tapestry Assistant key exposure audit

**Status:** ✅ ADDRESSED — investigation complete, verdict below; follow-ups dispositioned to OPEN.md #161–#165 and `_intake.md` (2026-08-10)
**Date:** 2026-08-10
**Scope:** Read-only investigation. No code was changed. No mutating git command was run.
**Question asked:** *Is there a hardcoded Tapestry Assistant nsec anywhere in the Tapestry repository?* The owner's stated intent is that the owner, each admin, and each customer get their **own** TA nsec; the concern was that a single hardcoded key may have shipped with the repo long ago and never been pruned.

---

## Verdict

**No. There is no hardcoded Tapestry Assistant nsec in the repository, in any representation, and there never was.**

The repository has never contained TA private key material. The per-deployment generation guarantee in `CLAUDE.md` ("Per-deployment TA pubkey — NEVER hardcode") holds on the **secret** side without exception. The known hardcoded-**pubkey** issues (ADR 0015 `LEGACY_*` constants) are a separate, already-tracked concern and are out of scope here.

Four real items were found along the way. None of them is a hardcoded TA nsec; all are recorded below and dispositioned.

---

## 1. Method, and one defect in it

Six independent search modalities were run over the working tree and the full object store, each candidate finding then adversarially verified by three separate lenses (*is it actually secret material? does it ship with the repo? is it a TA credential?*), followed by a completeness pass that searched for what the six had missed.

**Coverage achieved:**

| Surface | Result |
|---|---|
| `nsec1…` bech32, case-insensitive, across **all 12,125 blobs** (reachable *and* unreachable objects) | zero |
| **2,351** distinct 32-byte candidates — hex (incl. uppercase, `0x`-prefixed, line-split) + 414 base64 tokens decoding to exactly 32 bytes — run through secp256k1 derivation against 4 known TA/owner pubkeys | **zero matches** |
| **2,331,355** sliding 32-byte windows across every binary blob in the object store and working tree | zero |
| Deleted files (`--diff-filter=D`), pickaxe (`log -S`) on `nsec`/`PRIVKEY`/`secretKey`/`master-key`, unreachable objects, reflog, `git fsck` | zero |
| The one committed archive (`magic-carpet-contributor-kit.zip`) — extracted and audited | clean; `MC_NSEC=` is empty, read from `process.env` |
| Submodules, `refs/stash`, `refs/notes`, `packed-refs` beyond `rev-list --all` | none exist / all covered |
| 7 GitHub Actions workflows, 15 secret names | all `${{ secrets.* }}`; zero literals |

**The method defect, recorded because it produced a wrong intermediate conclusion.** The first working-tree sweep reported "zero `nsec1` hits" and that was **false**. In this environment `grep` is not GNU/BSD grep — it is a shell function (`~/.claude/shell-snapshots/snapshot-zsh-*.sh`) that execs the `claude` binary as `ugrep` with `--ignore-files`, which makes it **silently honor `.gitignore`**. Re-run with `/usr/bin/grep`, two gitignored files on disk *do* contain a plaintext nsec (§2). The repository-level conclusion was unaffected — those files were never committed — but it was correct by luck, not by method. `git grep` is unaffected (it is git's own implementation), so the history results never depended on the broken tool. **Any future secret sweep must use `/usr/bin/grep`, or drive `find`/`git ls-files`.** Tracked as OPEN.md #165.

---

## 2. Legacy relay key on disk, and a Docker bake-in path

`setup/nostr/keys/brainstorm_relay_keys` and `…_keys.sh` hold a **plaintext privkey + nsec** (pubkey `32bbb3c5…342b`, mtime 2026-03-04).

**Not a repository finding, and not the current TA:**

- Gitignored via `.gitignore:83` (`**/keys/`) and **never committed** — `git log --all -- 'setup/nostr/keys/*'` returns **0** entries.
- Its pubkey appears in **zero** tracked files. Nothing reads the path.
- It is not the TA. This instance's live secure-keys directory contains `tapestry-assistant.json` (the owner's slot) and one customer slot — neither is `32bbb3c5…`.
- `BIBLE.md:1056` already declares it obsolete: *"The legacy plaintext key file (`brainstorm_relay_keys.sh`) is no longer created on new installs."*

**But it is not inert.** `.dockerignore` does **not** exclude `setup/nostr/keys/`, and `Dockerfile:92` is `COPY . /usr/local/lib/node_modules/brainstorm/`. Every image built **from this working copy** bakes the plaintext key in. CI builds from a clean checkout where the untracked file does not exist, so published images are unaffected — the exposure is local and dev-image only.

Residual scaffolding from the same era is still in the generator: `create_nostr_identity.sh:69-70` still does `mkdir -p "$KEYS_DIR"`, and `:159-160` echo `$KEYS_FILE` / `$KEYS_SH_FILE` — **variables never assigned anywhere in the current script**, printing empty strings.

**Note before deleting:** removing a private key is irreversible. That identity signed events that persist on relays; discarding the key forfeits any future ability to sign as it (including publishing a deletion). Prefer `trash` or an out-of-repo archive over `rm`. → OPEN.md #161, #162.

## 3. Committed test-fixture private keys (44)

Real, functional secp256k1 keys — **proven**, not inferred: every `sk` was run through `getPublicKey()` and derives exactly the `pk` stored beside it.

| Location | Count | Provenance |
|---|---|---|
| `test-data/dwarves-test-data.json` | 35 | `e4f62886`, 2026-03-12 |
| `test/helpers/livePov.js:36-43` | 8 | `39936028`, 2026-07-18 |
| `test-data/mint-dwarves.js:78` (`NOUS_SK`) | 1 | same key as the dwarves `listOwner` |

**None is a TA key** — all 44 were cross-derived against the ADR-0015 legacy TA, the live TA, the legacy relay key, and the owner pubkey, with no match. They are exactly the class an `nsec1` regex cannot see (raw hex, never bech32-encoded).

**Deliberate non-action.** These confer no authority under the permissionless-publish invariant (architecture principle 2 — a bare pubkey grants nothing). They are already public and already in history, so deleting them from the tree would not unpublish anything; genuine removal would require a history rewrite across 4,500+ commits, which is wildly disproportionate for throwaway identities.

One asymmetry worth preserving: `livePov.js` was a *deliberate, documented* decision (file header + OPEN.md row 53). The 35 in `test-data/` were not — they simply happened. If this is ever revisited, the work is to bring the latter up to the former's standard of documented-on-purpose, not to remove either. → OPEN.md #163.

## 4. Assistant-key architecture — as-built vs. intent

The per-principal design is **already ~80% built** and is the documented intent at `BIBLE.md:1046`: *"Every owner, admin, and customer has an assistant."*

**Storage imposes no obstacle.** `SecureKeyStorage` is a flat store: each identity is `<slot>.json`, where the slot is only ever used as a filename. The parameter is spelled `customerPubkey` but is never validated as a pubkey.

**All four provisioning sites (exhaustive, via `storeRelayKeys` grep):**

| Principal | Slot | Site | Trigger |
|---|---|---|---|
| Owner | `'tapestry-assistant'` (a **name**) | `create_nostr_identity.sh:127` | automatic, first container start |
| Customer | their **hex pubkey** | `customerRelayKeys.js:66` | automatic, on signup / owner-add |
| Admin (and fallback) | their **hex pubkey** | `src/api/assistant/index.js:522` | **manual only** — a UI button |
| Restore | pubkey | `customerManager.js:1080` | backup re-hydration |

Guests get none and cannot provision (403) — correct.

### The name-keyed / pubkey-keyed asymmetry

This instance's live secure-keys directory shows it directly:

```
6086b083…bfcf.json        ← a customer, keyed by WHO THEY ARE
tapestry-assistant.json    ← the owner,  keyed by A ROLE NAME
```

The resolver is `if (pubkey === BRAINSTORM_OWNER_PUBKEY) → 'tapestry-assistant'` (`assistantKeys.js:22`). So **the owner's assistant is bound to the role, not the person.** If `BRAINSTORM_OWNER_PUBKEY` ever changes — ownership transfer, or the owner rotating their key — the new owner silently **inherits the previous owner's assistant nsec and its entire published history**, while the outgoing owner is left with none. No key is stolen; the pointer simply moves underneath it. A customer, by contrast, carries their assistant with them, because the slot *is* their identity.

Second-order: the filename records no owner, so after such a change nothing on the filesystem distinguishes the current owner's assistant from a predecessor's. The longer this runs, the harder the eventual migration — it is a one-way door.

### Gaps

1. **Admins get nothing automatically** — manual button only.
2. **Deprovisioning covers only customer hard-delete.** `deleteRelayKeys` has exactly one caller: `customerManager.removeCustomerSecureKeys` (`:666`), reached only from the delete path (`:524`). Customer *deactivation* (`:295`/`:370`) and admin *demotion* (`api/admin/index.js:221`) leave a fully working signing identity in place.
3. **Owner slot is name-keyed** (above) — needs a re-key plus a one-time migration.
4. **No test coverage** for any of it.

Gaps 1 and 2 are one story, not two: shipping auto-provisioning without deprovisioning means every admin ever appointed accumulates a permanent signing identity that survives demotion. → `_intake.md` (2026-08-10).

## 5. A booby trap in `createAllCustomerRelays.js`

`src/manage/customers/createAllCustomerRelays.js` writes **plaintext `_RELAY_PRIVKEY` and `_RELAY_NSEC` into `/etc/brainstorm.conf`** (`:72-73`), then `console.log`s the entire resulting conf (`:81`) — and separately logs the full keypair at `:63`. This directly contradicts the design that `create_nostr_identity.sh:141-142` enforces (it actively *strips* such lines).

It cannot fire today: `processAllCustomers` calls `customerHasRelayKeys` (`:125`) and `createSingleCustomerRelay` (`:129`), **neither of which is defined or imported** — only `*_deprecating` variants exist (`:26`, `:55`). It `ReferenceError`s on the first customer.

**But it is reachable, not dead.** `src/api/customers/commands/create-all-customer-relays.js:21` execs it from a live API endpoint, wired to a UI button (`public/pages/customers/create-customer-relays.html:27`). So an operator can invoke it and get a crash — and anyone who later "fixes" the crash by renaming the calls to the `_deprecating` functions turns on plaintext-nsec-to-disk **and** secrets-to-logs in one edit. It should be deleted, not repaired. → OPEN.md #164.

## 6. Dead fallback in `getOwnerAssistantPubkey()`

`assistantKeys.js:66-79` (fallback 3) reads `tapestry-assistant.json` and expects a plaintext `keys.pubkey`. That file is an **AES-256-GCM envelope** — `create_nostr_identity.sh:17-32` must decrypt it to reach `inner.pubkey`. The branch can never succeed. Harmless today because fallbacks 1 (`TA_PUBKEY`) and 2 (`brainstorm.conf`) cover it, but it will fail silently if they ever do not. → OPEN.md #164.

---

## Corrections to the audit's own intermediate claims

Recorded so they are not propagated from the working notes:

1. **"`deleteRelayKeys` has zero callers" — wrong.** It has one (`customerManager.js:673`). Customer deprovisioning exists; the gap is narrower and is specifically *role change without deletion* (§4, gap 2).
2. **"`createAllCustomerRelays.js` is unreachable dead code" — wrong.** It is reachable via a live API endpoint and a UI button (§5). This makes it more dangerous, not less.
3. **"Zero `nsec1` in the working tree" — wrong**, and the reason is the tooling defect in §1.

## Residual uncertainty

Bounded, and none of it changes the verdict:

- **Hard-pruned objects.** Anything removed by a prior `git gc --prune` is unrecoverable and invisible to every method. Irreducible without mutating state.
- **Remote-only objects.** Force-pushed or server-side-deleted branches never fetched into this clone are out of reach. Closing this needs a fresh mirror clone or GitHub secret scanning.
- **`node_modules`** excluded by design — a third-party embedded secret would be missed, but could not be the TA key.
- **Non-contiguous / masked key material** (split, XOR'd, or encrypted inside an image) would evade the binary scan. No evidence suggests it; cost to close is unbounded.
- **Runtime state outside the repo** — `/var/lib/brainstorm/secure-keys/`, `/etc/brainstorm.conf`, Docker volumes — holds the real TA secret **by design**. Not a repo finding.
- **Concurrency.** The object store grew from 12,110 → 12,125 blobs during the audit (a concurrent session was committing). Results are a snapshot at 12,125; both worktrees were clean when checked.

## Disposition

| § | Item | Where |
|---|---|---|
| 1 | `grep` shim honors `.gitignore` — harness lesson | OPEN.md #165 (`meta`) |
| 2 | Prune legacy key + dead generator scaffolding | OPEN.md #161 (`cleanup`) |
| 2 | `.dockerignore` does not exclude `setup/nostr/keys/` | OPEN.md #162 (`cleanup`) |
| 3 | 44 committed test-fixture keys — recorded, deliberate non-action | OPEN.md #163 (`docs`) |
| 4 | Assistant-key lifecycle: admin auto-provision, deprovision on role change, owner slot re-key | `engineering-team/stories/_intake.md` (2026-08-10) |
| 5, 6 | Delete `createAllCustomerRelays.js`; fix or drop the dead fallback | OPEN.md #164 (`cleanup`) |
