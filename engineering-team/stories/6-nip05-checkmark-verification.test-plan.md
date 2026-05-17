# Test Plan: Story 6 — NIP-05 green checkmark must reflect real verification

**Story:** `engineering-team/stories/6-nip05-checkmark-verification.md`
**ADR:** None — Architecture phase intentionally skipped per Standard-strictness Bug classification (see story §"Linked artifacts").
**Date:** 2026-05-17

## Approach

Same precedent as story #5 and `strfry-router-first-boot-config`: failing tests are **source-regex assertions** against the two scoped components, plus **regression sentinels** for the out-of-scope surfaces. They pin the single thing the spec fixes — *the ✅ next to a profile's NIP-05 must no longer be gated by `nip05`-presence alone* — without prescribing **how** verification is wired (client vs server, reuse of the existing `verifyNip05()` helper, caching). The story explicitly left that to the Implementer.

**Deliberate limitation (read this).** A source test cannot prove the new gate is a *real* pubkey match or that it is fail-closed in flight — a structurally-correct but semantically-fake gate (a hook that returns `true` whenever `nip05` exists) would pass T1/T2. The **authoritative behavioral gate** for AC-1, the positive half of AC-2, and AC-4 is the staging smoke in §"Not covered": the two #151 pubkeys must show **no ✅**, and a known-good identity **must** show ✅. The Reviewer must treat that smoke evidence as required, not optional. This mirrors story #5, where "Jack actually returns 504" was likewise deferred to staging smoke because it is not reproducible in the hand-rolled runner and pinning it in source would over-constrain the Implementer.

## Coverage map

| Criterion | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (verified → ✅) | **T1/T2** ensure the ✅ is no longer presence-only-gated (necessary condition); the *positive* behavior — a genuinely verified profile actually shows ✅ — is **staging smoke** with a known-good identity (§"Not covered") | test/nip05-checkmark-verification.test.js | source + manual smoke |
| AC-2 (present but unverified → plain text, no ✅, no warning) | **T1/T2** (presence-only ✅ removed) + **R2** (no warning/indicator added to plain-text surfaces); concrete negative — the two #151 pubkeys still show the nip05 *text* with **no ✅** — is **staging smoke** | test/nip05-checkmark-verification.test.js | source + manual smoke |
| AC-3 (no `nip05` field → nothing shown, unchanged) | Invariant preserved by any sane fix (cannot verify without a `nip05` to verify). Deliberately **not** pinned in-runner: a structural grep for `profile.nip05` in the page file would false-FAIL a legitimate component-extraction refactor the story did not forbid (Tester role: don't write brittle tests against undescribed implementation). Verified by **staging smoke** (a no-nip05 profile renders no nip05 line, as today). | — | manual smoke |
| AC-4 (fail-closed; ✅ never shown in flight) | Covered in spirit by **T1/T2** — a ✅ that cannot render from presence alone also cannot render before a positive result. True in-flight *timing* is observation-only (note in §"Not covered"). | test/nip05-checkmark-verification.test.js | source + manual smoke |
| AC-5 (both surfaces; search badge unchanged) | **T1** (UserDetail) + **T2** (BrainstormProfile) cover "both"; **R1** pins the search-results "✅ NIP-05 Verified" badge unchanged | test/nip05-checkmark-verification.test.js | source (sentinel) |
| Concrete #151 (`b17e0293…`, `ff18165a…` → no ✅) | **Staging smoke** — exact URLs in §"Not covered" | — | manual smoke |

T1, T2 = FAIL pre-implementation, PASS post. R1, R2 = PASS pre AND post (out-of-scope guards; a flip to FAIL means the Implementer touched something the story put out of scope).

## Edge cases

- [x] **Incidental ✅ in scope files not false-matched.** `UserDetail.jsx:341` (`✅ Active PoV`) and `BrainstormProfile.jsx:41` (`icon: '✅'`) are unrelated. The `PRESENCE_ONLY_CHECKMARK` regex requires a `nip05 &&` guard *immediately* in front of a JSX tag whose content starts with ✅, so neither is matched. Confirmed: pre-implementation only the two real bug lines match.
- [x] **Identity-table row not false-matched.** `UserDetail.jsx`'s `{profile?.nip05 && ( <tr>…<td>NIP-05</td>… )}` has a `nip05 &&` guard but **no ✅** in the tag — regex correctly does not fire on it, and R2 separately pins it ✅-free.
- [x] **A correct "presence AND verification" gate passes.** `profile?.nip05 && verified && <p>✅` and `nip05Verified && <p>✅` do **not** match `PRESENCE_ONLY_CHECKMARK` (verified by construction in the test header) — the tests do not force a particular gate expression, only forbid the presence-only one.
- [x] **Component-extraction refactor not blocked.** If the Implementer extracts a `<Nip05Badge profile=…/>`, the scoped files contain no presence-only ✅ → T1/T2 pass; AC-3/behavior covered by smoke. The tests do not require the ✅ to stay in these files.
- [x] **Out-of-scope already-correct badge protected.** R1 fails if the search `nip05Result` badge is altered/removed — guards against "fixing" the wrong surface.
- [x] **Scope creep into plain-text surfaces caught.** R2 fails if a ✅ is added to `bs-result-nip05`, `bs-suggest-nip05`, or the UserDetail Identity row — encodes the "two ✅ sites only" scope decision.
- [ ] **Semantically-fake verification (gate that always returns true when nip05 exists).** *Not catchable in source* — this is exactly what the staging smoke exists to catch (#151 pubkeys must show no ✅).

## Not covered (deferred to staging smoke — authoritative behavioral gate)

The bug reproduces on staging (confirmed by the reporter), so post-deploy smoke on `staging.brainstorm.world` is the real proof.

**N1 — AC-2 / #151 negative (must show NO ✅):**
```
https://staging.brainstorm.world/user/b17e029321ce8ef14d989d964041576151e0a7b87a69e50809ff6ca8ebd795b1?pov=78ed0837
https://staging.brainstorm.world/user/ff18165afde00852d49a4e1316c981c7af0164c1810c0bc0fe41d361dd7ca7f0?pov=a1420e44
```
Expect: NIP-05 string still shown as **plain text**, **no green ✅**, no warning glyph. Repeat on the Brainstorm profile page surface for the same pubkeys.

**N2 — AC-1 positive (must show ✅):** load a profile whose NIP-05 is genuinely valid — i.e. `https://<domain>/.well-known/nostr.json?name=<name>` returns exactly that profile's pubkey. **Most stable fixture: an identifier `<name>@brainstorm.world` registered in our own NIP-05 registry** (we control that `.well-known/nostr.json`, so it is deterministic and not subject to third-party drift). The Implementer/Tester picks a current registered name and its pubkey. Expect: green ✅ shown on both the `/user/:pubkey` and Brainstorm profile surfaces.

**N3 — AC-4 fail-closed timing:** with network throttling, the ✅ must **never flash** before the positive result resolves (it should be absent, then appear only if verified). Observation-only; record whether any pre-confirmation flash is seen.

**N4 — AC-3 no-nip05 invariant:** load a profile with no `nip05` field — no nip05 line, no ✅ (unchanged from today).

## Test infrastructure

- **Test framework:** the project's existing hand-rolled Node runner (`npm test` → `test/test.js`). No new dependencies, no new framework (house rule).
- **No Playwright spec.** Story #5 precedent: externally-dependent behavior (here, a live `.well-known/nostr.json` fetch to arbitrary third-party domains) is not deterministically reproducible in-runner without mocking infrastructure this project has no ADR for, and intercepting a specific fetch URL would prescribe the client-vs-server approach the story left open. Behavioral proof is staging smoke (above).
- **Fixtures:** none in-runner — all four tests read source via `fs.readFileSync`. Smoke fixtures: the two #151 pubkeys (negative) and a `@brainstorm.world` registered name (positive).
- **Files asserted against:** `ui/src/pages/users/UserDetail.jsx`, `ui/src/pages/BrainstormProfile.jsx`, `ui/src/pages/BrainstormSearch.jsx`.

## How to run

```
npm test
```

Targeted run of just this suite:
```
node -e "require('./test/nip05-checkmark-verification.test.js').run()"
```

## Verification

The new tests fail on the pre-implementation tree. Confirmed against the working tree at story commit `e522d073` (`story: nip05-checkmark-verification`), with `test/nip05-checkmark-verification.test.js` and the `test/test.js` registration on top:

```
nip05-checkmark-verification suite:
  ✗ T1: UserDetail.jsx no longer renders the NIP-05 ✅ gated by nip05-presence alone
      UserDetail.jsx must not render the green ✅ next to a profile's NIP-05 merely because `profile.nip05` is non-empty (AC-1, AC-2, AC-4). The ✅ must be gated on a verification outcome (domain-attested pubkey === profile pubkey), fail-closed. HOW (client/server, reuse of an existing verifyNip05() helper, caching) is the Implementer's call — only the presence-only gate must go. Found the presence-only pattern still present (currently UserDetail.jsx:84).
  ✗ T2: BrainstormProfile.jsx no longer renders the NIP-05 ✅ gated by nip05-presence alone
      BrainstormProfile.jsx must not render the green ✅ next to a profile's NIP-05 merely because `profile.nip05` is non-empty (AC-1, AC-2, AC-4, AC-5 — same fix on both surfaces). The ✅ must be gated on a verification outcome, fail-closed. Found the presence-only pattern still present (currently BrainstormProfile.jsx:228).
  ✓ R1: BrainstormSearch.jsx keeps the server-verified "✅ NIP-05 Verified" badge gated on nip05Result
  ✓ R2: plain-text NIP-05 surfaces stay checkmark-free (no positive indicator added where the story deferred it)

Test Results
-------------
Configuration Loading:                           PASS
treasure-maps-router-preset suite:               PASS (5 passed, 0 failed)
scheduled-search-and-house-scores-refresh suite: PASS (12 passed, 0 failed)
strfry-router-first-boot-config suite:           PASS (3 passed, 0 failed)
per-query-neo4j-timeout-safety-net suite:        PASS (8 passed, 0 failed)
nip05-checkmark-verification suite:              FAIL (2 passed, 2 failed)
Overall:                                         FAIL
```

- 2 failing tests (T1, T2), each citing the spec by AC number and stating what must change *without* prescribing the mechanism — not a typo or import error.
- 2 passing sentinels (R1, R2): the already-correct server-verified search badge, and the plain-text surfaces staying checkmark-free. Intentionally green; a flip to FAIL during Implementation means an out-of-scope surface was touched.
- All four pre-existing suites stay green — no collateral regression from registering the new file in `test/test.js`.
