# ADR 0001: One public read for the instance's Owner, Admins and customer count; a section on /about renders it

**Status:** Accepted (operator, Architecture gate, 2026-10-13)
**Date:** 2026-10-13
**Story:** `engineering-team/stories/about-this-instance/1-owner-admins-customer-count.md`
**Book:** `engineering-team/audits/about-this-instance/book.md`

## Context

**What the story asks (short).** AC1: a section "About this Brainstorm Instance" at the bottom of `/about`, for every visitor, reachable as `/about#this-instance`, existing content unchanged. AC2: an Owner card and N Admin cards with N beside the heading; each card shows the profile name and NIP-05 address, or a shortened npub, and opens `/user/<pubkey>`; zero Admins reads 0 with a "No admins" note; an account that is both is shown only as Owner. AC3: the customer count is every account this instance holds an Assistant key for, minus the Owner, the Admins and any account that is itself an Assistant, with no active/inactive distinction; a listed customer with no key is not counted (the worked example reads "2 customers"). AC4: the data loads for visitors, and nothing the page shows or loads reveals a customer's identity or any key material. AC5: a link "About this Brainstorm Instance" on `/about-brainstorm-search` lands on the section. AC6: if the data can't load, the rest of `/about` renders and the section says so.

**Orientation.** The local stack was not running (probe failed), so the Concept Graph could not be consulted. The story touches no concepts, event kinds or firmware. Owner, Admin, Customer and Assistant are instance roles held in config and the key store, not graph concepts, so orientation was from the code.

**What exists.**

| Need | Where it is today | Who can read it |
|---|---|---|
| Owner pubkey | `BRAINSTORM_OWNER_PUBKEY`, via `getConfigFromFile` (`src/utils/config.js`); served by `GET /api/owner-info` (`src/api/owner/ownerInfo.js:13`) | public |
| Admin pubkeys | `getAdminPubkeys()` (`src/utils/config.js:99`): `settings.adminPubkeys`, else `BRAINSTORM_ADMIN_PUBKEYS`; served by `GET /api/admin/list` | owner only (`requireOwnerOnly`; route table `OWNER_READ`, `src/middleware/routeAccess.js:76`) |
| Accounts with an Assistant key | `SecureKeyStorage` (`src/utils/secureKeyStorage.js`), backend `encrypted-file`: one file per account, `<storagePath>/<account hex pubkey>.json`, default `/var/lib/brainstorm/secure-keys`. The Owner's own Assistant (the TA) is stored under the name `tapestry-assistant`, not under the Owner's pubkey. The other two backends (`sqlite`, `vault`) are placeholders whose constructors throw. | server only |
| An account's Assistant pubkey | Inside that account's file. **The whole file is encrypted** (`storeToEncryptedFile` encrypts the JSON envelope; `privkey` and `nsec` are encrypted a second time inside it), so the Assistant pubkey cannot be read without the master key. The TA's pubkey comes from `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js:49`). | server only |
| Names and NIP-05 | `GET /api/profiles?pubkeys=` (`src/api/profiles/fetchProfiles.js`, kind-0 content, 50 per request, 5-minute cache); client seam `fetchProfilesChunked` (`ui/src/utils/profileBatch.js:43`) | public |
| Route access | One route table, default-deny: a route with no entry is the owner's side's, and the route-walk suite (`test/admin-action-sweep.test.js`) fails on any registered route without an entry (ADR `security-auth-exposure/0005`) | — |

**A disclosure fact the story's Background gets wrong.** The story says customer identities "stay private". They are already public, by an earlier deliberate decision: `GET /api/get-customers` is `PUBLIC_READ` (`routeAccess.js:217`) and returns every active customer's pubkey, name and directory to visitors (the customer-or-owner quirk in `src/middleware/auth.js:324` refuses only signed-in non-customers), and `GET /api/assistant/roster` (`src/api/assistant/roster.js`) joins those pubkeys to their Assistant pubkeys for visitors. ADR `author-scoped-inspection/0001` records it: "customers public (`get-customers`), admins owner-only (`/api/admin/list`)". AC4 still holds as written, because it constrains this page and its endpoint, not the instance. This ADR does not change those reads (Out of scope).

**Constraints.** The project is JS without a build step. The TA pubkey is resolved at runtime, never hardcoded (CLAUDE.md). The one main-to-Assistant mapping lives in `src/utils/assistantKeys.js`, and nothing returns an object that could carry private material (ADR `author-scoped-inspection/0001`). The page is the same for every viewer: these are instance facts, so nothing is computed per point of view.

## Options considered

### Option A — A dedicated public read, `GET /api/about-this-instance` *(chosen)*

One handler returns exactly `{ success, ownerPubkey, adminPubkeys, customerCount }`. The count is computed server-side by scanning the key store. The page fetches this, then the names for the Owner and Admins from the existing profiles read.

- **Pro:** the response shape *is* AC4. It carries two kinds of pubkey and one number, so no customer identity can reach the page however it is rendered.
- **Pro:** the count matches the operator's rule literally (who holds a key), not an approximation of it.
- **Pro:** only `/about` pays for the key-store scan.
- **Con:** one more route, table entry and API-reference entry.

### Option B — Extend `GET /api/owner-info` with `adminPubkeys` and `customerCount`

ADR `profile/0032` set the precedent of growing `owner-info` for instance-level facts.

- **Pro:** no new route.
- **Con:** `owner-info` is fetched on every profile page (`ui/src/hooks/useVerificationInfo.js`), so every profile view would pay for a key-store scan and decryption it never displays.
- **Con:** it mixes a cheap config read with a scan that can fail on its own, and its existing shape is pinned by tests (`profile/36` R4).

### Option C — Compose it in the browser from existing reads

The owner from `owner-info`; the customer count from `get-customers` or the roster.

- **Con:** the Admins aren't public anywhere (the roster leaves them out for non-owners), so this can't meet AC2 without a new read anyway.
- **Con:** both customer reads list *active customers on the customer list*, not key holders, so the count would be wrong under AC3 (inactive customers missing; key holders not on the list missing).
- **Con:** the page would load every customer's identity to count them, which AC4 forbids.

### Sub-decision for the count — scan the key store *(chosen)* vs filter the customer list by key presence

Filtering `customers.json` (all statuses) by whether each entry has a key is close, but it misses key holders who are not on the list: a former Admin who kept their key, or a key left behind when a customer entry was removed without removing keys. The operator defined a customer by the key ("if an npub has an Assistant nsec, it is a customer"), so the count starts from the key store.

## Decision

**Option A**, with the count taken from the key store.

1. **The read.** `GET /api/about-this-instance` answers 200 with:

   ```json
   { "success": true, "ownerPubkey": "<hex>|null", "adminPubkeys": ["<hex>", "..."], "customerCount": 12 }
   ```

   - `ownerPubkey`: `BRAINSTORM_OWNER_PUBKEY`, lowercased, or `null` when unset or not 64-hex.
   - `adminPubkeys`: `getAdminPubkeys()`, lowercased, deduplicated, invalid entries dropped, **the Owner removed** (AC2's "shown only as Owner"), configured order kept.
   - `customerCount`: a number, or `null` when the key store could not be read (point 3).
   - Nothing else: no names, no Assistant pubkeys, no customer pubkeys.

   A thrown error outside the count answers 500 `{ success: false, error }`. Route table entry: `'GET /api/about-this-instance': PUBLIC_READ` (a read; no `why` needed).

2. **The count.** `customerCount = |H \ ({owner} ∪ A ∪ S)|`, where:
   - **H** is the account pubkeys with a stored Assistant key: the file names in the key store matching `^[0-9a-f]{64}\.json$`. This skips `.master-key` and `tapestry-assistant.json` by construction.
   - **A** is the Admins as in point 1.
   - **S** is the Assistants this instance holds keys for: the TA pubkey, plus the stored Assistant pubkey of every member of H.

   Status on the customer list plays no part, and an entry on the list with no key file is not in H.

3. **The key store reads only what it needs, and never decrypts private keys.** Two new `SecureKeyStorage` methods:
   - `listStoredAccounts()` returns H. For `encrypted-file` it lists the directory and returns `[]` when the directory does not exist (a fresh instance has no customers). The placeholder backends throw "not yet implemented", like their siblings.
   - `getStoredPubkey(accountPubkey)` decrypts the file's outer envelope and returns its `pubkey` field only. It never calls `decrypt` on `privkey` or `nsec`, so private keys are never decrypted for this feature.

   A file whose envelope won't decrypt still counts as a key holder (it *is* a stored key); it just contributes nothing to S. If the store can't be opened at all (no master key, an unreadable directory), the count is `null` and the Owner and Admins are still returned.

4. **Where the count lives.** A new `countInstanceCustomers(deps = {})` in `src/utils/assistantKeys.js`, beside the mapping it reads, returns a number or `null`. It opens one `SecureKeyStorage` per call and does not go through `getAssistantPubkeyFor` per account. That path (`getCustomerRelayKeys`) re-reads `/etc/brainstorm.conf` at a hard-coded path, builds a new store, and decrypts the private fields on every call, writing a log line each time. On a public read that would be N log lines and N private-key decryptions per visit. The function returns a number only, so the narrowing rule of ADR `author-scoped-inspection/0001` holds.

5. **"Itself an Assistant" means one this instance holds the key for.** That is the TA or any key holder's Assistant. An Assistant run by another instance can't be recognised from here, the same limit the roster states (`roster.js`). If such an account holds a key here, it counts as a customer.

6. **The section.** A new `ui/src/components/AboutThisInstance.jsx`, rendered by `BrainstormAbout.jsx` after the existing content, as `<section id="this-instance">`:
   - The title and subtitle render at once, so the anchor exists before data arrives.
   - It fetches `/api/about-this-instance`, then `fetchProfilesChunked([owner, ...admins])` for `display_name || name`, `nip05` and `picture`.
   - **Cards:** a react-router `Link` to `/user/<hex>` (as `TagPageRow.jsx:287` does), with the avatar picture or else the name's initial on a filled circle, the name, the NIP-05 line when present, and a chevron. The name falls back to a shortened npub (`npub1` plus the first 4 and last 4 characters).
   - **Admins:** the count shown beside the heading; zero shows a "No admins" note.
   - **Customers:** a large number with "customer" or "customers"; a `null` count reads "Customer count unavailable".
   - **Failure (AC6):** a failed fetch or `success: false` shows "Couldn't load this instance's details."; a failed profile lookup only drops names to npubs. All of this state is local to the component, so the rest of `/about` is never affected.
   - **Hash (AC1, AC5):** an effect scrolls `#this-instance` into view when `location.hash` is `#this-instance`, on mount and again once data has rendered. The browser's own jump happens before the single-page app has drawn the section, and the section grows when data arrives.
   - **Look:** the design's layout in the page's existing dark styling (the `bsp-page` background, `#a5b4fc` accent as on the page's links, cards with a faint border and fill), per the story's "Look and wording".

7. **The link.** `BrainstormAboutSearch.jsx` gains a closing paragraph with `<a href="/about#this-instance">About this Brainstorm Instance</a>`, a plain anchor like the page's other links. The full navigation it causes is handled by the hash effect in point 6.

## The operator's decisions at the gate (2026-10-13)

1. **Option A as written**, including Decision 5: "itself an Assistant" means an Assistant this instance holds the key
   for; one run by another instance is not recognised and, if it holds a key here, counts as a customer.
2. **Correct the story and epic**: their claim that customer identities stay private is replaced with the fact in
   Context (already public through `get-customers` and the roster). The acceptance criteria are unchanged.
3. **Queue the open question** of whether customer identities should stay public, as its own intake entry
   (`_intake.md`, 2026-10-13), outside this book.

## Consequences

- **Enables** the operator's disclosure exactly: the Owner, the Admins and one number, for every visitor, on every instance, each showing its own.
- **Admins become public.** `GET /api/admin/list` stays owner-only (it is the management read). The roster's practice of hiding Admins from non-owners no longer protects anything, but it is left as is; it still answers its own question.
- **The count can differ from the admin pages' customer list.** That is by design (story Out of scope): it counts inactive customers and key holders not on the list, and leaves out listed customers without keys.
- **Cost per visit:** one directory listing plus N envelope decryptions (AES-GCM; N is the number of key holders). No cache is added: this is cheaper than public reads the instance already serves (search, the read backbone), and a cache would delay admin changes for no measured gain.
- **No debt** in the placeholder key-store backends: if one is ever built, `listStoredAccounts` must be built with it, and the count reads `null` until then.
- **Firmware reinstall required?** No.
- **Deployment:** a feature, not a security fix. It ships `staging` → `main` through the usual cycle. The long-lived sandboxes (`tags`, `magic-carpet`) pick it up when they next merge `staging`. No branch-specific preparation is needed.

## Implementation notes

- **`src/utils/secureKeyStorage.js`:** add `listStoredAccounts()` and `getStoredPubkey(accountPubkey)` as in Decision 3. `getStoredPubkey` validates the argument as 64-hex before building a path from it.
- **`src/utils/assistantKeys.js`:** add and export `countInstanceCustomers(deps = {})`. Defaults are required lazily, as `attention.js` `defaultDeps()` does:
  - `openStore: () => new SecureKeyStorage({ storagePath: '/var/lib/brainstorm/secure-keys' })`
  - `getOwnerPubkey`
  - `getAdminPubkeys`
  - `getTaPubkey: getOwnerAssistantPubkey`

  A throw from `openStore` or `listStoredAccounts` returns `null`.
- **New `src/api/owner/aboutThisInstance.js`:** `handleGetAboutThisInstance(req, res, deps = {})`, merging `deps` over lazily-required defaults the same way, so Express's `next` in the third position is harmless (`attention.js:318`). Export it from `src/api/owner/index.js`.
- **`src/api/index.js`:** register `app.get('/api/about-this-instance', …)` beside `GET /api/owner-info` (line 349).
- **`src/middleware/routeAccess.js`:** `'GET /api/about-this-instance': PUBLIC_READ`, in key order near `owner-info`.
- **`src/api/openapi.yaml`:** document the route beside `/api/owner-info` (line 4164): public, the four fields, `customerCount` nullable, and a sentence stating that it never returns customer identities.
- **New `ui/src/components/AboutThisInstance.jsx`**, rendered at the end of `ui/src/pages/BrainstormAbout.jsx`'s content column. Use `fetchProfilesChunked` from `ui/src/utils/profileBatch.js` (not a bare `/api/profiles` fetch) so a long admin list is batched at the shared cap. Shorten npubs with `nip19.npubEncode` from `nostr-tools`, as `useVerificationInfo.js` does.
- **`ui/src/pages/BrainstormAboutSearch.jsx`:** the closing link paragraph (Decision 7).
- **For the Tester (Phase 3, not the Implementer):**
  - **The count.** Exercise `countInstanceCustomers` against a temp key store: a temp `storagePath` with `RELAY_KEY_MASTER_KEY` set, fixture files written through the real `storeRelayKeys` so the encryption is real. Pass owner, admins and the TA pubkey through `deps`. `getOwnerAssistantPubkey` caches at module level, so inject it rather than relying on `TA_PUBKEY`. AC3's worked example must read 2. Add cases for:
    - a missing store directory (0);
    - an unopenable store (`null`);
    - a file that fails to decrypt (still counted);
    - an Owner who is also an Admin.
  - **The private-key boundary is a code property, pinned by a source check:** `getStoredPubkey` never decrypts `privkey`/`nsec`, and `countInstanceCustomers` returns a number or `null`. This mirrors the S-tests in `test/author-scoped-inspection-roster.test.js`.
  - **The handler, through `deps`:** the exact four keys; the Owner removed from `adminPubkeys`; invalid admin entries dropped; a `null` count still returns the Owner and Admins.
  - **The route table:** the new entry exists and is `public`/`read`. The existing route-walk suite then covers registration with no new test.
  - **The UI:** source-level checks on the section id, the title and subtitle strings, the `/user/` link, the empty-admins note, the failure message, and the `/about#this-instance` link on `/about-brainstorm-search`. Rendering is browser-verified at Review (`/cycle-local`, then staging).
  - **Registration:** new suites go in `test/registry.js`.

## Out of scope

- **Whether customer identities should stay public.** `GET /api/get-customers` and `GET /api/assistant/roster` serve them to visitors today, by ADR `author-scoped-inspection/0001`. Narrowing them is a product and security decision with its own consumers (the scheduled-tasks panel, the roster's "Mine"), and belongs in its own story.
- Changing `GET /api/admin/list`, the roster, sign-in classification, or how roles are assigned.
- Recognising Assistants run by other instances (Decision 5).
- Caching the read.
- Any change to `/about`'s existing content or to the top-bar "About" link.
