# Test Plan: Story 2 — Recognizable published TA profile defaults

**Story:** `engineering-team/stories/ta-avatar/2-recognizable-published-ta-profile.md`
**ADR:** `engineering-team/decisions/ta-avatar/0002-branded-published-profile-defaults.md`
**Date:** 2026-08-07

**Test file:** `test/recognizable-published-ta-profile.test.js` — 13 tests in four classes
(**A** asset ×2, **U** unit ×3, **S** source ×3, **H** live ×5). Registered in `test/test.js`
(gates the exit code; carries its own summary line and an explicit H-class execution line).

---

## Finding that changes what Implementation must do

**ADR 0002 says "AC4 is free" — it is not, and this suite is the reason we know.**

The ADR reasons that a local instance has no website, so `picture` stays `''` and
`handlePublishProfile:281` strips it before signing. Checked against the running instance, that is
false: `/api/assistant/status` reports **`"website": "https://localhost:7777"`**.

The cause is in `getInstanceDomain()` (`src/api/assistant/index.js:108-117`): when `STRFRY_DOMAIN`
is unset or literally `localhost`, it falls back to `BRAINSTORM_RELAY_URL`'s host, which yields
`localhost:7777` — and `'localhost:7777' !== 'localhost'`, so `getInstanceWebsite()` returns a
truthy `https://localhost:7777`.

So the ADR's literal recipe — `picture: website ? \`${website}/ta-avatar.png\` : ''` — would publish
**`https://localhost:7777/ta-avatar.png`** from every dev instance. For any third-party client that
fetches it, that URL resolves to *their own machine*. That is exactly the dead link AC4 forbids.

The AC is unchanged and remains testable, so this is not a kick-back — but the Implementer must
recognise a non-routable address, not merely an empty one, and `H2` fails the build if they don't.
(Pre-existing, and out of scope: the `website` field itself already publishes `https://localhost:7777`
on dev instances. This story only governs `picture`.)

## Why there is no browser class

Story 1 needed Playwright because every criterion was about what a viewer *sees*. Here the criteria
are about what the server *proposes* and what gets *signed*: ADR 0002 leaves `AssistantProfileEditor`
deliberately untouched, so the contract under test is the `defaults` object on
`/api/assistant/status`. A browser would only re-observe that object through an unchanged consumer.

## Coverage map

| Criterion | Test | Level | Notes |
|---|---|---|---|
| **AC1** — "<owner>'s Tapestry Assistant" when named, generic otherwise | `H1` (named branch, against whatever instance is reachable), `U2` (generic branch, executed with no config and no relay), `S3` (the empty-fallback that makes the generic branch *reachable at all*) | live + unit + source | both branches genuinely exercised |
| **AC2** — the proposed picture is the branded image at the instance's own address | `H2` positive branch (fires when the instance is publicly routable), `S1`, `S2` | live + source | positive branch runs against staging; see below |
| **AC3** — on a deployed instance the published URL resolves publicly | `H2` positive branch + `H5` (fetches the URL and checks **PNG bytes**) | live | |
| **AC4** — no public address → no picture; never a dead link | **`H2` negative branch** (the decisive one), `U2`, `U3` | live + unit | the test the ADR gap turns on |
| **AC5** — a customer's assistant carries the same picture under the same rule | `H3`, `U3`, `S2` | live + unit + source | |
| **AC6** — an already-published profile is unchanged until re-publish | `H4` (defaults and profile returned as separate fields) | live | structural: the editor prefers `profile` when `hasProfile` |
| ADR §asset | `A1` (committed where the build publishes it), `A2` (real PNG magic, 512×512, ≤50 KB) | stack-free | |

### One invariant, two environments — how AC2/AC3 and AC4 share a test

`H2` and `H3` do not hardcode "localhost". They read the instance's own reported `website`, decide
whether it is publicly routable, and assert **the picture is proposed exactly when it is**. The
branch is selected by the environment, so the same assertion is correct everywhere:

- **Against the local instance** (`https://localhost:7777` — not routable): asserts **no** picture.
  Vacuously true today, and it becomes the load-bearing guard the moment the Implementer adds the
  URL — a naive implementation turns `H2` red.
- **Against staging** (`https://staging.brainstorm.world` — routable): asserts the picture is exactly
  `https://staging.brainstorm.world/ta-avatar.png`. **Verified failing that way today** (see below),
  so AC2/AC3's positive half is genuinely covered, not merely asserted in source.

## Edge cases covered

- [x] Owner with no discoverable name → generic assistant name (`U2`).
- [x] Owner with a name → owner-linked name (`H1`; this instance's owner is `"Brainstorm"`, staging's is `"david"`).
- [x] **Loopback address that is truthy but unreachable** — the ADR gap (`H2` negative branch).
- [x] Customer branch, no relay key → the endpoint still proposes defaults, and they obey the same rule (`H3`, `U3`).
- [x] Asset served but wrong bytes — `H5` checks **PNG magic**, not status, because this is an SPA server: an unknown path returns `index.html` with a **200** (observed: 470 bytes of `<!doctype html>`).
- [x] Asset committed but not built — `H5`'s message names `cd ui && npm run build`, since the control panel serves `dist/`.
- [x] A hardcoded deployment domain — `S1` fails if `brainstorm.world` appears in the builder, which would point every instance's assistant at someone else's server.
- [x] Fully-skipped live class — `run()` prints an explicit H-class line and shouts when nothing executed (OPEN.md #104/#106); `TAPESTRY_REQUIRE_LIVE=1` turns that into a failure.
- [ ] **Not covered — deliberately:** the customer branch's `'a customer'` name fallback (publishes *"a customer's Tapestry Assistant"*), flagged out-of-scope by ADR 0002; NIP-05 derivation; backfilling existing instances.

## Test infrastructure

- **Runner:** Node built-in, `node test/test.js` (`npm test`). No new framework, no Playwright for this story.
- **Live target:** `BRAINSTORM_BASE_URL` (default `http://localhost:7778`). The H class skips cleanly when unreachable, so CI (`stack-free`) runs A/U/S only.
- **One testability ask on the implementation:** `buildDefaultProfileContent` must be **exported** from `src/api/assistant/index.js` (`U1`). This constrains visibility, not design — without it AC1's generic branch and AC4's mechanism have no CI-executable handle at all, only source scanning.
- **Hermetic by construction:** `U2`/`U3` rely on there being no `/etc/brainstorm.conf` and no `strfry` on PATH — true on a dev host *and* on the CI runner, so they behave identically in both.
- **Concept Graph:** not used; no concept changes, **no firmware reinstall** (confirmed at Architecture).
- **Fixtures:** none. No writes of any kind — every live call is a GET.

## How to run

```bash
npm test
```

Just this suite, against the local stack:

```bash
node -e "require('./test/recognizable-published-ta-profile.test.js').run()"
```

After deploying, to exercise the routable branch of `H2`/`H3`:

```bash
BRAINSTORM_BASE_URL=https://staging.brainstorm.world node -e "require('./test/recognizable-published-ta-profile.test.js').run()"
```

## Verification — confirmed RED on 2026-08-07 at `d6cb5fa2`

**Against the local instance — 3 passed, 10 failed.** The failures are the absent feature:

```
  FAIL  A1: ui/public/ta-avatar.png does not exist …
  FAIL  U1: src/api/assistant/index.js must export buildDefaultProfileContent …
            Exports found: handlePublishProfile, handleAssistantStatus, handleGetTAPubkey, handleProvisionAssistantKey
  FAIL  S3: AC1's two cases are indistinguishable while the owner name is fetched with the 'the owner' fallback …
  FAIL  H1: this instance's owner publishes the name "Brainstorm", so the proposed assistant name must be
            "Brainstorm's Tapestry Assistant". Got "Tapestry Assistant".
  FAIL  H5: http://localhost:7778/ta-avatar.png did not serve PNG bytes (HTTP 200, 470 bytes,
            starts "<!doctype html>\n") …
  PASS  H2 / H3   ← vacuous today: this instance is not routable, so "no picture" is trivially satisfied.
  PASS  H4
  H-class 5 executed / 0 skipped
```

**Against staging — 1 passed, 12 failed.** This is the run that proves `H2`/`H3` are not dead weight:

```
  FAIL  H1: this instance's owner publishes the name "david" … Got "Tapestry Assistant".
  FAIL  H2: this instance reports the public address "https://staging.brainstorm.world", so the proposed
            picture must be "https://staging.brainstorm.world/ta-avatar.png". Got "".
  FAIL  H3: a customer's assistant carries the same branded picture. Got "".
  FAIL  H5: https://staging.brainstorm.world/ta-avatar.png did not serve PNG bytes (HTTP 200, 470 bytes …)
```

**Failing for the right reasons.** Every failure names the missing artefact or the wrong value, with
the observed value quoted. The H class executed 5/5 in both environments — no silent skips. The three
locally-passing tests are the invariant guard (`H2`, `H3`) and the structural AC6 check (`H4`), all of
which must stay green after implementation; `H2`/`H3` are precisely what turn red if the Implementer
follows the ADR's literal recipe and publishes a loopback URL.
