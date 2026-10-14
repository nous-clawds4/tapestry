# Test Plan: Story 1 — About this instance: Owner, Admins, and Customer count on /about

**Story:** `engineering-team/stories/about-this-instance/1-owner-admins-customer-count.md`
**ADR:** `engineering-team/decisions/about-this-instance/0001-public-instance-roles-read.md` (accepted 2026-10-13)
**Date:** 2026-10-13

## Coverage map

There are two halves and one shared fixtures module:

- **`test/about-this-instance.test.js`** is the Node suite, stack-free and registered last in `test/registry.js`. It covers:
  - the key store's two new reads (K);
  - the count (C);
  - the read's handler through its deps (H);
  - the route (R);
  - the page sources (S).
- **`tests/brainstorm/about-this-instance.spec.js`** is the browser spec (B). It runs against a built UI with every `/api` route stubbed, and renders the page for real.
- **`test/helpers/aboutThisInstanceFixtures.js`** holds the page's words (story § Look and wording), the anchor, the forbidden reads, the fixture people, `shortNpub` and `customerWord`. Both halves use it.

**How K, C and H work.** Each test builds a temporary key store with its own master key. The fixture key files are written through the real `storeRelayKeys`, so the encryption is real. The owner, admins and TA reach the code under test only through `deps`. Nothing under `/etc` or `/var/lib` is read or written.

The **AC-3 world** contains:
- key files for the Owner, an Admin, an active customer and an inactive customer;
- a key file for an account that is itself an Assistant (the active customer's own Assistant);
- a key file for the TA's pubkey;
- the TA's key under its real store name, `tapestry-assistant`;
- `.master-key` and a stray file.

A customer on the customer list with no key appears nowhere in the store.

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** the section, below unchanged content, for every visitor, at `#this-instance` | **S1** imported and rendered after `/about`'s three existing paragraphs, which are still there<br>**S2** `id="this-instance"`, the title and the subtitle<br>**S3** a hash effect with `scrollIntoView`<br>**B1** a visitor sees it below the existing content<br>**B6** title and subtitle drawn while the read is still on its way<br>**B8** a signed-in customer sees the same section<br>**B9** a fresh load of `/about#this-instance` lands on it (with a fixture check that it starts below the fold without the anchor) | Node + browser | source + browser |
| **AC-2** Owner and Admin cards, the count beside the heading, name and NIP-05 or a shortened npub, `/user/<pubkey>`, "No admins", the Owner shown once | **H2** the read lower-cases, de-duplicates, drops junk, removes the Owner, keeps order<br>**S4** the read, `fetchProfilesChunked`, `/user/${…}`, `nip05`, `npubEncode`, "No admins"<br>**B1** Owner card (name + NIP-05), "Admins 2", a named Admin and an unknown one shown as `shortNpub`, exactly three cards<br>**B2** clicks open `/user/<hex>`<br>**B3** "Admins 0", "No admins", Owner card alone<br>**B7** profile lookup fails → every card on its shortened npub | Node + browser | unit + browser |
| **AC-3** the customer count | **K1** H is exactly the 64-hex file names (not `tapestry-assistant`, `.master-key` or other files)<br>**K2** a missing directory is `[]`<br>**K3** an account's stored Assistant pubkey, null with no key<br>**C1** the worked example reads **2**<br>**C2** an Admin in any case, among junk, is excluded; an Owner also listed as Admin is excluded once; with no Admins the Admin's key counts (3)<br>**C3** empty store 0; directory gone 0<br>**C4** unopenable or unlistable store → `null`<br>**C5** a key file that won't decrypt still counts (3)<br>**C6** the count never loads the customer list (`Module._load` watched), paired with the count of 2<br>**H3** a `null` count still answers the Owner and Admins<br>**S5** "customer" / "customers" / "Customer count unavailable"<br>**B1** "12 customers"<br>**B4** "1 customer", "0 customers", "Customer count unavailable" | Node + browser | unit + browser |
| **AC-4** public, and nothing about customers or keys | **R1** the table entry is `public`/`read`; GET and HEAD resolve `public` (no entry would resolve `owner`)<br>**R2** the route is registered<br>**H1** exactly the four fields<br>**H5** over the real AC-3 store, `customerCount` is 2 (the path ran) and the JSON carries no customer, Assistant or TA pubkey, npub, privkey or nsec<br>**K4** `getStoredPubkey` refuses non-64-hex input, even `tapestry-assistant`, a readable key file in that store<br>**K5** `getStoredPubkey` never decrypts `privkey` or `nsec` (the store's `decrypt` is watched; the path ran)<br>**K6** an undecryptable file answers `null`<br>**S7** the section never names a forbidden read, paired with its fetch of the route<br>**B5** *(re-aimed at Implementation, see Amendment 1)* the section adds no forbidden read to the shell's own: each forbidden endpoint is read as many times on `/about` as on `/about-brainstorm-search`, the same shell without the section. It also asks profiles only for the Owner and Admins, and only GETs, paired with ≥1 read of the route | Node + browser | unit + browser |
| **AC-5** the link on `/about-brainstorm-search` | **S8** `<a href="/about#this-instance">About this Brainstorm Instance</a>`, with the page's three existing links kept<br>**B10** the link is visible, its href is right, and clicking it lands on the section | Node + browser | source + browser |
| **AC-6** a failed load is contained | **H6** a failure outside the count → 500 `{ success: false, error }`<br>**S6** the failure line<br>**B6** 500, `success: false` and a dropped connection each show the failure line with no cards and `/about`'s content intact; a hanging read is not a failure<br>**B7** a failed profile lookup is not a failure | Node + browser | unit + browser |

**Gate coverage.** The existing route-walk suite (`test/admin-action-sweep.test.js`) also fails if the route is registered without a table entry. That needs no new test.

## What these tests pin beyond the ADR

The Implementer must meet these. Each follows from the story or the ADR, but the ADR doesn't spell it out.

1. **The handler's test seam.** `handleGetAboutThisInstance(req, res, deps)` with `deps` = `{ getOwnerPubkey, getAdminPubkeys, countInstanceCustomers }`, merged over lazily-required defaults. The count's seam is the ADR's own: `{ openStore, getOwnerPubkey, getAdminPubkeys, getTaPubkey }`.
2. **`getStoredPubkey` decrypts through the store's own `this.decrypt`.** K5 can only watch decryption that goes through it.
3. **The title is a heading** inside `#this-instance`. B1 finds it by role.
4. **Cards are links** `a[href="/user/<hex>"]` inside the section. A react-router `Link` renders that.
5. **The shortened npub** is `npub1` plus the next four characters, `…`, and the last four (`shortNpub` in the fixtures). This is the ADR's "first 4 and last 4" made exact.
6. **The count line.** "N customers", with "1 customer" for one. The count sits right after the Admins heading text (`Admins` then the number).
7. **The words** are the fixtures' `COPY`, verbatim. The failure line may use a typographic apostrophe or `&apos;` in source (S6); the browser half matches the rendered text.

## Amendment 1 — B5 re-aimed at Implementation (operator-approved, 2026-10-13)

As first written, B5 required that `/about` make **none** of the forbidden reads. It failed against the implementation for a reason outside this story: the app shell's `AssistantRosterProvider` (`ui/src/App.jsx`, around every page) reads `/api/assistant/roster` on every page load. `/about-brainstorm-search` and `/how-search-works` make the same read, and neither has the section. The section itself never makes it (S7).

B5 now counts each forbidden endpoint on `/about` and on `/about-brainstorm-search` and requires the counts to be equal, so the section adds nothing. Story AC-4 was clarified to "the section" at the same time.

**The re-aimed B5 is not vacuous.** A temporary change to the section that also fetched the roster was built and run. B5 failed with `"/api/assistant/roster": 2` against the baseline's `1`. The change was reverted, the original restored with no diff, and the spec re-run: 11/11.

## Amendment 2 — regression tests from review round 1 (2026-10-13)

The round-1 review (`reviews/about-this-instance/1-owner-admins-customer-count.md`) asked for a failing test before each fix.

| Finding | Test | File | What it requires |
|---|---|---|---|
| **Blocking 1:** a non-string profile name crashed all of `/about` | **B11** | browser | Owner `{ name: 42 }`, an Admin `{ display_name: { text: 'x' }, name: 'adam' }` and an Admin `{ display_name: '', name: true }`:<br>- `/about`'s own content is visible, there is no "Unexpected Application Error" and no uncaught page error;<br>- the cards read the Owner's shortened npub (with its NIP-05 still shown), "adam", and the second Admin's shortened npub.<br>This pins "the first of `display_name` and `name` that is non-empty text, else the shortened npub". |
| **Non-blocking 1:** an emoji-first name showed half a character | **B12** | browser | The Owner's `display_name` is `"🧠 Nous"`:<br>- the card shows the name (the path ran);<br>- the card's text holds no lone surrogate;<br>- the emoji appears twice, once as the initial and once in the name. |
| **Non-blocking 2:** a stored Assistant pubkey was not lowercased | **C7** | Node | The AC-3 world, plus the inactive customer's key rewritten with its Assistant pubkey in upper case (a fixture check confirms it is stored that way), plus that Assistant's own key file. The count must stay 2. |

**Verified failing, 2026-10-13, before the fix** (UI built from `993750e5`):
- **C7:** "expected 2, got 3". The Node suite read 28 passed, 1 failed.
- **B11:** the section never drew; the page had crashed.
- **B12:** "no half emoji anywhere in the card: \"\ud83e\n🧠 Nous\n›\"".
- **B0–B10:** still pass.

## Edge cases

- [x] Empty store, and a store whose directory is gone (K2, C3).
- [x] A store that cannot be opened or listed (C4): `null`, never a throw.
- [x] An undecryptable key file (K6, C5): not a pubkey, but still a key holder.
- [x] The TA's store name (`tapestry-assistant`) and the master key file are not accounts (K1, K4).
- [x] An account that is itself an Assistant, and the TA's pubkey holding a key (C1).
- [x] Admin entries in upper case, duplicated, junk, or equal to the Owner (C2, H2).
- [x] An unset, empty, malformed or upper-case Owner (H4).
- [x] The read hanging, failing, refusing or dropping (B6); the profile lookup failing (B7).
- [x] Signed out and signed in (B1, B5, B8).
- [ ] Concept Graph: not involved; the story touches no concepts.

## Test infrastructure

- **Node:** the gate's runner (`npm test`). The suite needs `npm ci` (it loads `nostr-tools` through the key store). Stack-free.
- **Browser:** Playwright, Chromium project, against an origin serving the **built** UI. B0 fails when the served bundle predates the edit.
- **Concept Graph API:** not used. The local stack was not running this session, and no test needs it.
- **Firmware state:** none.
- **Fixtures:** `test/helpers/aboutThisInstanceFixtures.js`, and temporary key stores built per test (removed after each).
- **Live check at Review (not automated):** after the staging deploy, `GET https://staging.brainstorm.world/api/about-this-instance` answers the four fields with staging's real owner, and `/about` shows the section with real names.

## How to run

```
npm ci
node test/about-this-instance.test.js      # this suite alone
npm test                                   # the whole gate; read the run with `npm run gate:status`
```

For the browser half:
```
cd ui && npm ci && npm run build && npx vite preview --port 4173 --strictPort &
BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/about-this-instance.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-13 at commit `a33ea828` (base) with this plan's files added.

**Node suite (`node test/about-this-instance.test.js`): 0 passed, 28 failed.** Every failure names what is missing:

| Tests | What is missing |
|---|---|
| K1–K6 | `SecureKeyStorage must have listStoredAccounts()` / `getStoredPubkey()` |
| C1–C6, H5 | `src/utils/assistantKeys.js must export countInstanceCustomers(deps)` |
| H1–H4, H6 | `src/api/owner/aboutThisInstance.js must load … Cannot find module` |
| R1 | `the table needs 'GET /api/about-this-instance': PUBLIC_READ — got undefined` |
| R2 | `register app.get('/api/about-this-instance', …)` |
| S1 | `BrainstormAbout.jsx must import the section` |
| S2–S7 | `ui/src/components/AboutThisInstance.jsx must exist` |
| S8 | `expected <a href="/about#this-instance" …>About this Brainstorm Instance</a>` |

None fails on a fixture. The AC-3 store, with real encryption, was built before every K and C test reached its first check.

**The whole gate (`npm test`, record `tmp/gate-runs/20261013T215003Z-18276-09a2.json`):**
```
about-this-instance: FAIL (0 passed, 28 failed, 0 skipped)
Failed suites: about-this-instance
Overall: FAIL — 5986 passed, 28 failed, 582 skipped across 309 suites
```
No other suite changed: every other suite passed or skipped for its usual stated reason.

**Browser spec (Chromium, the pre-story build served by `vite preview`): 11 failed.** Each fails after `/about` loads, at the missing section or link:

| Test | Where it fails |
|---|---|
| B0 | the subtitle is in none of the 11 JS assets |
| B1 | `AC-1: the section carries id="this-instance"`. Before that point it confirmed `/about`'s existing content is visible. |
| B2–B5, B7–B9 | the section never draws a card or a failure line |

*(These are the pre-implementation results. B5 was later re-aimed, see Amendment 1, and the whole spec passes 11/11 against the implementation.)*
| B6 | the failure line is not found |
| B10 | the link "About this Brainstorm Instance" is not found on `/about-brainstorm-search` |

**The tests can pass, and K5 is not vacuous.** This was checked in a throwaway git worktree outside the repo, deleted afterwards; none of its code is committed.
- A minimal server side written to the ADR (the two store methods, the count, the handler, the table entry and the registration) passed **all 20** K, C, H and R tests. The eight S tests stayed red because it had no UI.
- `getStoredPubkey` was then swapped for a version that goes through `getRelayKeys`, which decrypts everything. K5 failed with "getStoredPubkey decrypted a private field".
