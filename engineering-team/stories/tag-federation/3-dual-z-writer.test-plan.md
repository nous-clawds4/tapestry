# Test Plan: Story 3 — Dual-z writer (epic tag-federation, Half 2 — Part B)

**Story:** `engineering-team/stories/tag-federation/3-dual-z-writer.md`
**ADR:** `engineering-team/decisions/tag-federation/0003-dual-z-writer.md`
**Date:** 2026-06-17
**Branch:** `feat/dual-z-writer`
**Test file:** `test/dual-z-writer.test.js` (registered in `test/test.js`)

## Test-level reality (read first)

The two writers under test are **ESM under `ui/`** (`ui/package.json` → `"type": "module"`)
and are **NOT `require()`-able** from the CJS root runner (`node test/test.js`). This is the
same constraint every prior tag story hit (`test/tag-read-union.test.js`,
`test/b-tag-seeds.test.js`, `test/b-tag-primitive.test.js`). Therefore:

- **Runnable-now coverage = SOURCE-CONTRACT regex** over the writer + call-site files
  (read with `fs.readFileSync`, assert on source text). This proves the *mechanism*:
  two z entries are emitted by construction, the second composed from the runtime TA arg.
- **Live behavioral ACs (AC-4, AC-5)** need the running stack + NIP-07 + relay
  inspection. They are documented below as a **manual/Playwright recipe**, NOT faked.
- **AC-7** (David PR breadcrumb) is a **PR-description deliverable**, not a test.

### ⚠️ Dev-box degenerate-z caveat (per ADR 0003 §"Dev-box degenerate-z caveat")

On **this dev box** the runtime local TA equals the canonical coordinate
(`/api/assistant/pubkey` → `82b75e47…`, verified in ADR 0002). So the two z handles
resolve to **identical strings** here — the writer emits `['z','39998:82b75e47…:<slug>']`
twice. The distinct-value case **only manifests on a non-dev instance** (different runtime
TA). Accordingly the **assertion of record** is: *the writer emits **two** `['z', …]` entries
by construction, the **second** composed from the **runtime `taPubkey`/`localTaPubkey`** arg
(not a literal)* — NOT "the two values differ". The source-contract regex (one canonical-literal
z + one runtime-interpolated z + a hard count of exactly two z entries) proves this regardless of
whether the two resolve equal on this box.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (tag element dual-z) | `AC-1: createTag … still stamps the canonical z via the TAG_HANDLE const` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-1 (tag element dual-z) | `AC-1: createTag … stamps a NEW local z composed from runtime ${taPubkey} (39998:${taPubkey}:tag)` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-1 + dual-z count | `AC-1 + dual-z-count: createTag … tags array contains EXACTLY two z entries` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-2 (tagging dual-z) | `AC-2: publishProfileTagAssertion still stamps the canonical z via NOSTR_USER_TAG_HANDLE` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-2 (tagging dual-z) | `AC-2: publishProfileTagAssertion stamps a NEW local z composed from runtime ${localTaPubkey} (39998:${localTaPubkey}:nostr-user-tag)` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-2 + dual-z count | `AC-2 + dual-z-count: publishProfileTagAssertion tags array contains EXACTLY two z entries` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-3 (composes with hybrid e+a) | `AC-3: publishProfileTag.js still composes the ADR-0022 hybrid \`a\` coordinate …` | `test/dual-z-writer.test.js` | source-contract (runnable-now) — regression guard |
| AC-3 (composes with hybrid e+a) | `AC-3: publishProfileTagAssertion tags array still carries BOTH the \`a\` … and \`e\` … lines` | `test/dual-z-writer.test.js` | source-contract (runnable-now) — regression guard |
| AC-4 (local list populates) | live Playwright/manual recipe (see below) | — | **live-only** (not host-unit-testable) |
| AC-5 (no migration / network-visible) | live Playwright/manual recipe (see below) | — | **live-only** (not host-unit-testable) |
| AC-6 (runtime local TA — anti-hardcode) | `AC-6: useProfileTags.js introduces NO new 82b75e47… literal — exactly the one pre-existing canonical const occurrence` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-6 (runtime local TA — anti-hardcode) | `AC-6: publishProfileTag.js introduces NO new 82b75e47… literal — exactly the one pre-existing canonical const occurrence` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-2/AC-3 signature (OQ-3) | `SIGNATURE: publishProfileTagAssertion accepts the new localTaPubkey param …` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-2/AC-3 threading (OQ-3) | `THREADING: useProfileTags.js reads taPubkey via useConfig and passes localTaPubkey …` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| AC-2/AC-3 threading (OQ-3) | `THREADING: Tag.jsx reads taPubkey via useConfig and passes localTaPubkey into both calls` | `test/dual-z-writer.test.js` | source-contract (runnable-now) |
| Non-throw design (ADR §Consequences) | `SOFT: publishProfileTag.js introduces NO new throw tied to a missing/malformed localTaPubkey …` | `test/dual-z-writer.test.js` | source-contract (runnable-now) — **soft, see limitation** |
| AC-7 (David breadcrumb) | — | — | **PR-description deliverable**, not a test |

## Notes on specific tests

- **Dual-z-count guard** (the dev-box-degenerate-proof assertion): each writer's `tags`
  array is extracted by bracket-balancing from its `tags:` opener, then `['z', …]` element
  openers are counted. Asserting **exactly two** is the assertion of record per the ADR's
  degenerate-z caveat — we assert two z's are EMITTED, not that their values differ.

- **AC-3 is the most important regression guard.** It asserts the ADR-0022 `tagAddress =
  \`39999:${tag.authorPubkey}:${tag.slug}\`` composition and both the `['a', tagAddress]`
  and `['e', tag.eventId]` lines remain intact — i.e. the second z did NOT replace or disturb
  the hybrid e+a shape. These PASS today (baseline intact); they will FAIL only if the
  Implementer regresses the wire shape while adding the local z.

- **AC-6 anti-hardcode** counts `82b75e47…` literal occurrences per file and requires
  **exactly one** (the pre-existing `const TA_PUBKEY` def). canonical = literal (the ADR-0015
  named exception, allowed); local = runtime (required). A second occurrence = the local z was
  hardcoded. These PASS today and stay green only if the Implementer composes the local z from
  the runtime arg.

- **Non-throw SOFT guard — limitation.** This is a regex heuristic: it scans every `throw`
  and fails if a `localTaPubkey` reference appears within the preceding ~220 chars. It cannot
  prove the *positive* (that a warn+omit branch exists), only catch an obvious new hard-throw
  guard tied to the local TA. The positive ("missing local TA warns and still ships the
  canonical publish") is a **code-review item** and is covered behaviorally only via the live
  recipe (a publish with a stubbed/absent local TA still lands the canonical z). Treat the SOFT
  test as a tripwire, not a proof.

## Edge cases

- [x] Second z is **additive**, not a replacement (canonical const reference still present) — AC-1/AC-2 canonical tests + AC-3 e+a guards.
- [x] No new hardcoded TA literal for the local handle — AC-6 (both files).
- [x] Exactly two z entries (degenerate-z proof) — dual-z-count tests.
- [x] Runtime arg threaded from BOTH call sites (hook + page; the page calls twice) — THREADING tests.
- [x] Writer signature actually accepts the new arg — SIGNATURE test.
- [x] No new hard-throw on a missing local TA (must warn+omit) — SOFT test (tripwire) + code-review.
- [ ] **Distinct-value case** (two z's resolve to *different* strings) — **not testable on this dev box** (local TA == canonical). Manifests only on a non-dev instance; see live recipe.
- [ ] **Local list actually populates** (AC-4) — live-only.
- [ ] **No migration of old single-z events** (AC-5) — live-only.

## Live Playwright / manual recipe (AC-4, AC-5 — NOT host-unit-testable)

Per ADR 0003 §"Verification plan (live, on the dev stack)". Requires the running dev stack
(control panel + strfry + Neo4j + Redis in Docker; Concept Graph API at `localhost:8877`) and a
NIP-07 browser extension logged in. **These are not faked in the host unit suite.**

1. **Emit a dual-z event.** Log in via NIP-07. Create a new tag and/or apply a tagging through
   the UI (profile chip popover, or the `/tag/:slug` page Apply/Dispute).
2. **Inspect the published kind-39999 event** on the local relay. Assert it carries **two `z`
   tags**: the canonical `39998:82b75e47…:<slug>` AND the local `39998:<localTA>:<slug>`. For
   the **tagging** event, also assert the ADR-0022 `['a','39999:<author>:<slug>']` +
   `['e',<id>]` shape is intact (AC-3 live confirmation).
   - **Dev-box note:** on this box `<localTA>` == `82b75e47…`, so the two z values are the
     **same string** — you will see `['z','39998:82b75e47…:<slug>']` twice. That is the
     expected degenerate case here; the distinct-value case needs a non-dev TA.
3. **AC-4 — local list populates.** Load the local concept list
   `39998:<localTA>:nostr-user-tag` (the `/tapestry` concept browser, or the `/api/profile-tags`
   `#z`-scan on the local handle) and confirm the new tagging now appears in it — while
   remaining network-visible via the canonical z.
   - **Prerequisite:** the local header `39998:<localTA>:nostr-user-tag` must exist (firmware
     install materializes it; verified live in ADR 0002 — `nostr-user-tag` local header id
     `7df925f7…` on this box). No reinstall is required *by this story* (the pointer-`b` seed
     reinstall belongs to Story 2 / ADR 0002).
4. **AC-5 — no migration.** Confirm a pre-change single-z event is **not** rewritten: it stays
   canonical-z-only and remains network-visible but does NOT retroactively appear in the local
   list. (Inspect an event authored before this change; no backfill runs.)

**Non-dev distinct-value verification (optional, off this box):** on an instance whose
`/api/assistant/pubkey` differs from `82b75e47…`, repeat step 2 and confirm the two z values are
**distinct** strings — proving the local z genuinely tracks the runtime instance TA (AC-6 live).

## Test infrastructure

- Test framework: Node built-in runner — `node test/test.js` (this suite registered there) or
  `node test/dual-z-writer.test.js` standalone. No new framework (JS-without-build).
- Concept Graph API: `localhost:8877` — only needed for the **live recipe** (AC-4/AC-5), not for
  the source-contract suite.
- Firmware state: no reinstall required by this story (Story 2 owns the pointer-`b` seed reinstall).
- Fixtures: none — source-contract tests read the live source files directly.

## How to run

Source-contract suite (runnable now, host-only):
```
node test/dual-z-writer.test.js
```
Full suite:
```
npm test
```
Live behavioral (AC-4/AC-5) — manual recipe above against the running dev stack; or Playwright
via:
```
npm run test:playwright
```

## Verification (red phase)

The new source-contract tests **fail for the right reason** with the current code — the local z
and the runtime-arg threading do not exist yet (not a typo/import error). Confirmed on
2026-06-17 on branch `feat/dual-z-writer`:

```
--- dual-z writer tests (epic tag-federation, Story 3) ---
  PASS  AC-1: createTag (useProfileTags.js) still stamps the canonical z via the TAG_HANDLE const
  FAIL  AC-1: createTag (useProfileTags.js) stamps a NEW local z composed from runtime ${taPubkey} (39998:${taPubkey}:tag)
        createTag's tags array has no runtime-interpolated local z. Expected a second z entry like ['z', `39998:${taPubkey}:tag`] …
  FAIL  AC-1 + dual-z-count: createTag (useProfileTags.js) tags array contains EXACTLY two z entries
        … Found 1. tags array was: ['d', slug], ['z', TAG_HANDLE],
  PASS  AC-2: publishProfileTagAssertion still stamps the canonical z via NOSTR_USER_TAG_HANDLE
  FAIL  AC-2: publishProfileTagAssertion stamps a NEW local z composed from runtime ${localTaPubkey} (39998:${localTaPubkey}:nostr-user-tag)
        … has no runtime-interpolated local z …
  FAIL  AC-2 + dual-z-count: publishProfileTagAssertion tags array contains EXACTLY two z entries
        … Found 1. …
  PASS  AC-3: publishProfileTag.js still composes the ADR-0022 hybrid `a` coordinate (39999:${tag.authorPubkey}:${tag.slug})
  PASS  AC-3: publishProfileTagAssertion tags array still carries BOTH the `a` (tagAddress) and `e` (tag.eventId) lines
  PASS  AC-6: useProfileTags.js introduces NO new 82b75e47… literal — exactly the one pre-existing canonical const occurrence
  PASS  AC-6: publishProfileTag.js introduces NO new 82b75e47… literal — exactly the one pre-existing canonical const occurrence
  FAIL  SIGNATURE: publishProfileTagAssertion accepts the new localTaPubkey param in its destructured signature
  FAIL  THREADING: useProfileTags.js reads taPubkey via useConfig and passes localTaPubkey into publishProfileTagAssertion
  FAIL  THREADING: Tag.jsx reads taPubkey via useConfig and passes localTaPubkey into both publishProfileTagAssertion calls
  PASS  SOFT: publishProfileTag.js introduces NO new throw tied to a missing/malformed localTaPubkey (warn+omit, not throw)

dual-z-writer: 7 passed, 7 failed
```

The 7 PASSes are intentional baselines/guards that must STAY green through implementation:
the canonical-z presence (AC-1/AC-2), the ADR-0022 e+a regression guards (AC-3), the
anti-hardcode literal counts (AC-6), and the non-throw tripwire (SOFT). The 7 FAILs flip green
once the Implementer adds the local z + threads the runtime arg.

`node --check test/dual-z-writer.test.js` and `node --check test/test.js` both pass.
```
```

## Notes for the Implementer

- Two writer edits + two call-site edits, per ADR 0003 §"Implementation notes":
  - `ui/src/hooks/useProfileTags.js` — `createTag` tags array: append
    `['z', \`39998:${taPubkey}:tag\`]` after the existing `['z', TAG_HANDLE]`; read
    `const { taPubkey } = useConfig()` at the top of the hook; thread `localTaPubkey: taPubkey`
    into `publishProfileTagAssertion` in `buildAndPublishAssertion`.
  - `ui/src/utils/publishProfileTag.js` — extend the signature to
    `publishProfileTagAssertion({ tag, targetPubkey, polarity, localTaPubkey })`; append
    `['z', \`39998:${localTaPubkey}:nostr-user-tag\`]` after the existing
    `['z', NOSTR_USER_TAG_HANDLE]` (and BEFORE `['polarity', …]`, to match the ADR's after-block).
    Do NOT touch the `a`/`e`/`d`/`p`/`content` lines (AC-3).
  - `ui/src/pages/Tag.jsx` — read `const { taPubkey } = useConfig()`; thread
    `localTaPubkey: taPubkey` into BOTH the `handleApply` and `handleDispute`
    `publishProfileTagAssertion` calls.
- **Non-throw guard:** the missing/malformed-localTaPubkey path must `console.warn` and omit the
  local z — NEVER hard-throw (a missing local z has no cost; the canonical still ships). The
  existing `authorPubkey` hard-throw is the ONLY throw-guard and must stay. The SOFT test trips
  if you add a `throw` near a `localTaPubkey` reference.
- The dual-z-count test requires **exactly two** `['z', …]` entries per writer — do not add a
  third, and do not drop the canonical.
- Regexes match a template literal interpolating the runtime var (`\`39998:${taPubkey}:tag\``
  and `\`39998:${localTaPubkey}:nostr-user-tag\``). Match that shape exactly; the literal pubkey
  path will (correctly) fail AC-6 and the local-z tests.
