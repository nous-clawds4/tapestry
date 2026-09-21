# Test Plan: Story 3 — One default profile for every assistant

**Story:** `engineering-team/stories/assistant-profile/3-one-default-assistant-profile.md`
**ADR:** `engineering-team/decisions/assistant-profile/0003-one-role-free-default-profile.md`
**Date:** 2026-09-21

The tests are in two new files, plus re-aims of three existing ones.

- **`test/one-default-assistant-profile.test.js`** — Node runner tests, registered in `test/registry.js`
  right after `assistant-publish-relays`. All of them are stack-free.
  - **I — the instance.** The story's "public instance" rule (`isPublicDomain`), what `describeInstance`
    makes of the configured domain, and `index.js`'s `isPubliclyReachable`, which gates the badged
    avatar's publishable URL.
  - **N — the person's name.** `nameFromProfileEvent`, and `resolvePersonName` with injected relays.
    N9 goes through the real settings module and a temp settings file instead.
  - **D — the one definition.** `buildDefaultProfile`, which is pure, checked against the story's table
    and the owner's verbatim about text. D6 goes through `index.js`'s exported
    `buildDefaultProfileContent`.
  - **F — the finishing step.** `finalizeAssistantProfile`.
  - **Q — the status answer.** Tested through its new seam, `createAssistantStatusHandler(deps)`.
  - **E — the publish handler.** Tested through ADR 0002's seam. These tests read the signed kind 0
    itself: its content and its tags.
  - **W — the browser code, by source.** This is the CI-enforced backstop for the B-class. CI does not
    run Playwright.
  - **S — server source sentinels.**
  - **R — regression guards.** These pass before and after.
- **`tests/brainstorm/assistant-default-profile.spec.js`** — the Playwright **B** class: what the
  dashboard and the editor *do*. It is hermetic, because every `/api` route is mocked.
- **Re-aims.** Each one is required by the ADR's decisions, and each is listed in its test-file changes:
  - **`test/assistant-publish-relays.test.js` `handlerFakes`.**
    - `getKind0DisplayName` and `buildDefaultProfileContent` are replaced by `getPersonName` and
      `describeInstance`.
    - This is load-bearing. Without it, the real `getPersonName` would query the real profile relays
      from inside a unit test, because a publish is always signed in.
  - **`test/recognizable-published-ta-profile.test.js`** (ta-avatar #2).
    - U2, U3, S1–S3 and H1–H3 now assert the new table. ADR 0003 supersedes ta-avatar/0002's rules:
      "no public address → no picture", "never a literal domain", the generic owner name, and two
      branches.
    - Its mirror predicate `isPubliclyRoutable` now also rejects private networks, ULA, link-local,
      `.internal` and `.home.arpa`. That fixes OPEN.md row 148, which says the mirror "must move
      together" with the production rule.
    - A1, A2, U1, H4 and H5 are unchanged.
  - **`tests/brainstorm/assistant-setup-prompt.spec.js`** (story 1) — B3 and B5. ADR 0003 renames
    "Surprise me" to "Use the default profile", so both tests now look for the new label.
    - B5: the Owner is offered the button.
    - B3: an Admin is not offered it.
    - This spec was not in the ADR's list; the rename requires it.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC1 | `Q1: an Owner, an Admin and a Customer on one instance are each offered exactly the table for themselves — differing only in name, npub and their assistant's own NIP-05` | `test/one-default-assistant-profile.test.js` | unit (status seam) |
| AC1 | `Q2: "Reset to defaults" on an assistant that already has a profile still offers the table — and the published profile comes back separately, untouched` | node | unit (status seam) |
| AC1 | `E5: the Owner, an Admin and a Customer each publishing their own default get the same table — differing only in name, npub and NIP-05` | node | unit (publish seam) |
| AC1 | `D1: a person with a name, on a public instance — exactly the story's table` | node | unit |
| AC1 | `S1: no default can read "a customer's Tapestry Assistant" — the 'a customer' fallback is gone from the assistant code (OPEN.md row 154)` | node | source |
| AC1 | `U3: a second person gets the same definition — the same picture, and never "a customer's Tapestry Assistant"`, `S2: one definition for every role — neither buildDefaultProfileContent nor the definition branches on the role` | `test/recognizable-published-ta-profile.test.js` | unit / source (re-aimed) |
| AC2 | `N1: a person's name is their display_name, else their name — whitespace tidied, blanks and non-strings ignored` | node | unit |
| AC2 | `N2: a name on the local relay is used at once — no relay is asked, even when relays are allowed` | node | unit |
| AC2 | `N3: with no local profile, the instance's profile relays are asked about this person within the relay budget, and the newest valid kind 0 wins` | node | unit |
| AC2 | `N4: a local profile without a name sends the lookup to the relays — but the person's newest profile decides, so a newer nameless one beats an older copy with a name` | node | unit |
| AC2 | `N9: with no relays injected, the lookup asks exactly the instance's profile relays from the relay settings — not the general-purpose or WoT lists` | node | integration (real settings module, temp file) |
| AC2 | `D2: a person with no name — "npub...‹last 6›'s Tapestry Assistant", and the about names the full npub alone`, `Q3: a person with no name is offered the npub forms, and their assistant's NIP-05 has no name part` | node | unit / unit (status seam) |
| AC2 | `Q4: the name lookup may reach the relays exactly when ADR 0001 lets the setup check reach them — …; never an anonymous caller`, `N5: an anonymous caller's lookup stays on the local relay — no relay is ever asked` | node | unit (status seam) / unit |
| AC2 | `E6: the person's name feeds the NIP-05 local-part too, and the publisher may look it up on the relays`, `E8: the Owner publishing a Customer's default publishes the CUSTOMER's — their name, their npub, their assistant` | node | unit (publish seam) |
| AC2 | `S3: the name reads "‹name›'s Tapestry Assistant", and with no name the npub form — never a placeholder like "the owner" or "a customer"` | ta-avatar suite | unit (re-aimed) |
| AC3 | `I1: the story's public examples are public …`, `I2: every class the story excludes is not public — loopback, private-network, IPv6 ULA, .local/.internal/.home.arpa names, a bare hostname — nor is anything empty or unparseable` | node | unit |
| AC3 | `I4: a public instance is described by its own domain …`, `I5: a dev box (STRFRY_DOMAIN=localhost, relay ws://localhost:7777) is not public …`, `I6: the domain is derived as before … and a LAN address is not public (OPEN.md row 148)` | node | unit |
| AC3 | `Q5: on a public instance the status answer says so, offers the website, and shows the assistant's NIP-05`, `Q6: on an instance that is not public the status answer says so — no website, no NIP-05, and the reference avatar` | node | unit (status seam) |
| AC3 | `E1: a default publish (no content …) on a public instance signs exactly the table, the server-managed NIP-05 and ["client", "‹domain›"]`, `E2: an edited profile on a public instance keeps the user's fields, but its NIP-05 is the server's and it carries the client tag` | node | unit (publish seam) |
| AC3 | `E3: a default publish on an instance that is not public carries no website, no NIP-05 and no client tag — and writes no nostr.json mapping`, `E4: an edited profile on an instance that is not public carries no NIP-05 and no client tag, whatever it was sent with` | node | unit (publish seam) |
| AC3 | `F1: on a public instance every published profile gets the server-managed NIP-05 and ["client", "‹domain›"] …`, `F2: on an instance that is not public no published profile carries a NIP-05 or a client tag …`, `F3: a NIP-05 the profile arrived with is never kept …` | node | unit |
| AC3 | `B7: on an instance that is not public, the editor says no NIP-05 is published, and why` | `tests/brainstorm/assistant-default-profile.spec.js` | e2e |
| AC3 | `H2: the proposed picture is always the branded avatar — … — and a website is proposed only when public` | ta-avatar suite | live (re-aimed) |
| AC4 | `D3: on an instance that is not public — no website, and the reference deployment's copy of the branded avatar`, `D5: nothing the definition supplies is a loopback, private-network or relative URL — on either kind of instance` | node | unit |
| AC4 | `D6: index.js's exported buildDefaultProfileContent is the same definition — and with no instance config and no relay it is the npub form with the reference avatar and no website` | node | unit (real wiring, hermetic) |
| AC4 | `I7: the badged avatar's gate (index.js isPubliclyReachable) follows the same rule — a LAN, .internal or ULA address is not reachable (OPEN.md row 148)` | node | unit |
| AC4 | `S2: the reference deployment's avatar URL is written once — one named constant in profileDefaults.js` | node | source |
| AC4 | `W3: the editor never puts a relative path into the picture field — not the upload's path, not the relative branded image` | node | source |
| AC4 | `B3: when the instance cannot publish the badged avatar, "Use this avatar" never puts a relative path into the picture field — it says why and offers the branded image` | spec | e2e |
| AC4 | `B4: "Use the branded image instead" puts the absolute URL the server offers into the picture field` (guard), `B5: when the server offers no picture, "Use the branded image instead" never falls back to the relative /ta-avatar.png` | spec | e2e |
| AC4 | `U2: with no instance config and no relay, the default is the npub form, the reference deployment's branded picture, and no website`, `S1: a public instance's picture is its own /ta-avatar.png; the only deployment URL written into the code is the reference copy, once`, `H2`, `H3` | ta-avatar suite | unit / source / live (re-aimed) |
| AC5 | `R2: the editor still offers exactly the seven editable fields, and NIP-05 is not one of them` (guard), `B6: the editor offers exactly the seven editable fields, and shows the NIP-05 read-only` (guard) | node / spec | source / e2e |
| AC5 | `E7: the one definition cannot be swapped out through the seam — an injected buildDefaultProfileContent changes nothing` | node | unit (publish seam) |
| AC5 | `W2: the dashboard supplies no assistant profile of its own — no robohash, no kind 0, no sign-as-assistant; it asks publish-profile for the one default` | node | source |
| AC5 | `B1: the Owner's "Use the default profile" asks publish-profile for the one default — no content, no kind 0 of its own — and the prompt goes away` | spec | e2e |
| AC5 | `R1: the legacy pages still publish with no content — so they publish the one default` (guard) | node | source |
| AC5 | story 1's `B5` (the Owner is offered "Use the default profile") and `B3` (an Admin is not) | `tests/brainstorm/assistant-setup-prompt.spec.js` | e2e (re-aimed) |
| ADR contract | `Q7: the dashboard's check (defaults=0) skips the name lookup …`, `W1`, `B2: the dashboard's setup check asks for the setup state only — every status request it makes carries defaults=0` | node / spec | unit / source / e2e |
| ADR contract | `Q8` (no key), `Q9` (400 for a malformed pubkey), `Q10` (the two lookups run at once), `N6` (10-minute memo), `N7` / `N8` (relay failure and a hung helper), `I3` (one notion of "public" with the SSRF guard), `S3` (lazy requires), `S4` (the shared classifier, no second copy) | node | unit / source |
| Prerequisite | `B0: the served origin runs a build that contains the code under test` | spec | prerequisite |

## Edge cases

- [x] Domains with ports, IPv6 literals in brackets, a trailing dot, and unparseable or empty domains
      (I1, I2).
- [x] Addresses outside the story's list that no stranger can reach — link-local cloud metadata, 0.0.0.0,
      carrier-grade NAT, IPv6 link-local (I3).
- [x] The domain fallbacks: the relay URL's host with its path dropped, and nothing configured (I6).
- [x] A name made only of whitespace, a name with inner newlines, a non-string name, invalid JSON (N1).
- [x] A relay event by someone else, or of another kind (N3).
- [x] A newer profile with no name versus an older copy that has one, in both orders (N4).
- [x] Relay failure, and a relay helper that never returns (N7, N8).
- [x] The memo remembers a "no name" answer too, keeps a separate entry per person, and expires at
      10 minutes (N6).
- [x] An edited profile that carries a forged NIP-05, on both kinds of instance (E2, E4, F3).
- [x] A website the user typed, on a non-public instance: kept, because validating URLs is out of scope
      (E4).
- [x] The Owner publishing a Customer's default, which is the Customer's (E8).
- [x] A status call for a person with no assistant key, with and without `defaults=0` (Q8).
- [x] Malformed pubkeys: non-hex, uppercase, too short, empty (Q9).
- [x] A server that offers no default picture: the editor must still never fall back to a relative path
      (B5).
- [ ] The publish handler skipping the name lookup for an edited profile on a non-public instance. The
      ADR allows it as an optimisation, and nothing a user sees depends on it, so it is not pinned.
- [ ] Real public relays — deliberately not tested. No test reads from or writes to a public relay.
- [ ] DNS-based reachability — out of scope by the ADR (sub-decision 1).
- [ ] The editor prefilling an old default's loopback `website` from an already-published profile. The
      ADR names this gap; validating user-edited fields is out of the story's scope.
- [ ] How the legacy pages render. They send no `content` (R1 pins that), and story 5 retires them.

## Test infrastructure

- **Node runner.** `npm test` runs every suite in `test/registry.js` through the gate engine. This suite
  is one line there. A run's verdict is read with `npm run gate:status`.
- **Hermetic by construction.** There is no `/etc/brainstorm.conf` and no `strfry` on PATH, on this Mac
  and on the CI runner. So the real wiring used by D6 and the ta-avatar U-class resolves to "localhost,
  not public, no name". Every relay helper is injected; N9 injects everything except the relay list.
- **Settings (N9).** A temp `settings.json` is selected through `TAPESTRY_SETTINGS_PATH`. The require
  cache for the settings, publish and defaults modules is cleared before the test and again after, as
  story 2's L5 does.
- **Timing.** N8 waits out the real 4 s relay budget plus the 1 s backstop, about 5 s in total. It is the
  only slow test. Q10 does not use timing: its two fakes each wait for the other to *start*, so a handler
  that runs them one after the other deadlocks, and `within()` reports it after 3 s.
- **Browser.** Playwright with chromium. Every `/api` route is mocked, following the patterns of story
  1's spec (the dashboard, with a strict `success: false` catch-all) and `ta-composite-avatar.spec.js`
  (the editor). The editor tests also mock `/api/settings`, because the Settings page around the editor
  loads it first. The spec needs an origin that serves the **built** UI under test.
- **Live class (ta-avatar H1–H3).**
  - It runs against `BRAINSTORM_BASE_URL`, which defaults to `:7778`. That is the local stack, and it
    serves the **main** checkout. So these tests fail locally until this branch is deployed, and a local
    failure there is environmental.
  - To check them for real, point the live class at staging after deploy. It sends GET requests only.
- **Firmware state:** none — no concept changes.
- **Fixtures.** Fixture pubkeys only (`aa…`, `bb…`, `ad…`, `cc…`, `dd…`, `a1…`, `c1…`), and freshly
  generated keys for signing. No live keys.

## How to run

```
node test/one-default-assistant-profile.test.js
```

The whole gate is `npm test`, and its verdict is read with `npm run gate:status`. On this machine some
suites fail for environmental reasons (the local dev stack), so treat CI's `stack-free` job as the
binding gate.

For the browser class, build the worktree's UI, serve it, and run the specs.

- The main checkout's local, gitignored `.claude/launch.json` has an entry, `ap3-worktree-ui-preview`,
  that serves this worktree's `dist/` on :4173 through `preview_start`.
- From another shell, `npx vite preview --port 4173 --strictPort` in `ui/` does the same.

```
cd ui && npm run build
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/assistant-default-profile.spec.js tests/brainstorm/assistant-setup-prompt.spec.js --project=chromium
```

## Verification

Confirmed on 2026-09-21 in the worktree. The code under test is `98fb6a96` (the ADR commit); the new and
re-aimed tests are uncommitted on top of it.

**New Node suite:** 2 passed, 50 failed, 0 skipped. Every failure names what is missing, or shows the old
behaviour by value:

```
FAIL  I1–I6, N1–N9, D1–D5, F1–F3   src/api/assistant/profileDefaults.js does not exist. ADR 0003 creates it: …
FAIL  I7   … "https://192.168.1.50:7777" → expected false, got true; "https://10.0.0.5" → expected false, got true; …
FAIL  D6   with the name and instance given, expected the table — got {"name":"Tapestry Assistant", … "Server-side Tapestry Assistant for the owner. …
FAIL  Q1–Q10   src/api/assistant/index.js does not export createAssistantStatusHandler(deps). ADR 0003 gives the status handler a dependency seam …
FAIL  E1–E5   the signed content must be the table — … got … "nip05":"tapestry-assistant-…@localhost" (old default, NIP-05 on a non-public domain, no client tag)
FAIL  E6   the same ‹name› names the NIP-05 — got "tapestry-assistant-876a2b@localhost"
FAIL  E7   … got {"name":"Injected","about":"a second definition", …}
FAIL  E8   … got {"name":"a customer's Tapestry Assistant", …}
FAIL  W1   the hook … must opt out of the name lookup
FAIL  W2   Dashboard.jsx still has a robohash picture, signAs: 'assistant', a kind 0 built in the browser
FAIL  W3   AssistantProfileEditor.jsx still does updateField('picture', … path …) and updateField('picture', … BRANDED_FALLBACK_SRC)
FAIL  S1   still present in index.js         FAIL  S2   … found []
FAIL  S3, S4   src/api/assistant/profileDefaults.js does not exist (see I1).
PASS  R1, R2   (guards)
```

**Re-aimed ta-avatar #2 suite:** 5 passed, 8 failed. H ran against `:7778`, which serves the main
checkout.

```
FAIL  U2   … Got name="a customer's Tapestry Assistant".        FAIL  U3   … Got picture="".
FAIL  S1, S2   src/api/assistant/profileDefaults.js is missing …
FAIL  S3   with a name: "‹name›'s Tapestry Assistant". Got "Tapestry Assistant".
FAIL  H1   the about names the owner by their npub. Got "Server-side Tapestry Assistant for Brainstorm. …"
FAIL  H2   … this instance proposes "https://localhost:7777", which a stranger's client cannot reach …
FAIL  H3   … Got website="https://localhost:7777", picture="".
PASS  A1, A2, U1, H4, H5
```

**Neighbours, unchanged by the re-aims:**

- story 2's suite: 39 of 39 (the swapped fixture is harmless before implementation);
- story 1's suite: 28 of 28;
- `stamped-composite-avatar`: 15 of 15;
- `stack-free-npm-test`: 7 of 7 (G5 sees the new suite registered).

**Browser class** against this worktree's own build (`vite preview` on :4173; every `/api` route mocked):
11 passed, 7 failed.

```
B0  FAIL  the bundle … does not contain "Use the default profile"
B1  FAIL  getByRole('button', { name: /Use the default profile/ }) — expected 1, received 0
B2  FAIL  every status request lacks "defaults": "0"
B3  FAIL  the picture field received "/generated/ta-avatar-deadbeef.png"
B4  pass  (guard: the absolute URL the server offers is used)
B5  FAIL  the picture field received "/ta-avatar.png"
B6  pass  (guard: seven fields, NIP-05 read-only)
B7  FAIL  expected /NIP-05: none[^.]*public web address/i — the editor shows nothing there
story 1 B5  FAIL  no "Use the default profile" button (B0–B4 and B6–B9 of that spec pass)
```

**The tests can pass, and they judge.** A test that fails today can still be wrong, if it would also fail
against a correct implementation. To rule that out, the tests were run against a throwaway reference
implementation of ADR 0003. It was written in the session scratchpad, outside the repo, and is **not
committed**. The Implementer writes the real one.

- **New Node suite:** 52 of 52.
- **Re-aimed ta-avatar suite:** 8 of 8, with the live class skipped. H needs a server running the new
  code.
- **Story 2's suite:** 39 of 39.
- **Story 1's suite:** 26 of 26, plus 2 live skips.
- **`stamped-composite-avatar`:** 15 of 15.
- **Browser, against the reference UI's build:** 27 of 27. That includes this spec, story 1's re-aimed
  spec, `ta-composite-avatar.spec.js` and `assistant-publish-result.spec.js`, so the editor changes keep
  both existing specs green.
- **Mutations.** Planted one at a time in the reference, each was caught by the test written for it:

| Planted defect | Caught by |
|---|---|
| status runs the name lookup, then the setup check | Q10 |
| an injected `buildDefaultProfileContent` wins | E7 |
| the local profile is not compared with the relays' | N4 |
| a NIP-05 is kept on a non-public instance | F2 |
| the name lookup may always reach relays | Q4 |
| `defaults=0` is ignored | Q7, Q8 |
| the old reachability rule (no private networks) | I2, I3, I6, I7 |
| a "no name" answer is not remembered | N6 |
| the client tag is added on a non-public instance | F2, E3, E4 |
| the npub form uses "…" instead of "..." | D2, D6, Q3 |

- The re-aimed mirror predicate classifies all 22 cases of the story's "public instance" definition
  correctly.

**One inconsistency the reference surfaced — resolved by ADR 0003 Amendment 1 (2026-09-21), approved at
this phase's gate.**

- The ADR's status seam passes `getPublishRelays: d.getPublishRelays` from a new `getPublishRelays`
  dependency.
- Story 2's S3 guard (`test/assistant-publish-relays.test.js`) requires the literal
  `getPublishRelays: getAssistantPublishRelays` in `handleAssistantStatus`'s body. Applied literally to
  the reference, the ADR's wording makes S3 fail.
- The status seam needs no such dependency: the Q-class injects `resolveAssistantProfileState`, whose
  fake ignores the list. So the amendment drops the dependency, the inner handler keeps the literal,
  and S3 stays as it is.

**Full gate.** `npm run gate:status -- --label ap3-phase3-failing`:

```
20260921T041720Z-4783-1b49 [ap3-phase3-failing] started 2026-09-21T04:17:20.614Z on 98fb6a96+dirty — FAIL, exit 1,
3435 passed, 149 failed, 35 skipped, 215/215 suites
```

36 suites failed.

- **Two are this story's own, as intended:** `one-default-assistant-profile` and the re-aimed
  `recognizable-published-ta-profile`.
- **The other 34 are this machine's environmental failures, not side effects of these tests.**
  - All suites are loaded before any runs, and this story touches only test files.
  - 33 of the 34 run before this suite (it is 208th of 215), and none of them was edited here.
  - The one failing suite that runs after it, `author-scoped-inspection-roster`, fails only its live
    H1–H5. Its endpoint, `/api/assistant/roster`, came in with `a33dc5c7` (2026-09-20). The local stack
    serves the main checkout at `a55b9631`, which predates that commit, so the endpoint answers 404.
    Run on its own, the suite gives the same 10 pass / 5 fail.
