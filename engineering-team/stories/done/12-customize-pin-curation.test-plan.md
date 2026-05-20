# Test Plan: Story 12 — Customize curation method at pin time and on /pins

**Story:** `engineering-team/stories/done/12-customize-pin-curation.md`
**ADR:** `engineering-team/decisions/0011-customize-pin-curation.md`
**Date:** 2026-05-20

## Coverage map

One row per AC + the form-validation edge cases the ACs imply.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (Pin opens dialog; field set; defaults) | `clicking Pin opens the curation dialog with the documented fields and Story-10 defaults` | `tests/brainstorm/customize-pin-curation.spec.js` | e2e |
| AC-2 (submit publishes customized curation-method) | `submitting the dialog with cutoff=1 publishes a kind-39999 pin event whose curation-method JSON has cutoff=1` | `tests/brainstorm/customize-pin-curation.spec.js` | e2e |
| AC-2 (server side, observed) | `pin event with cutoff=1 produces a TL whose ['cutoff','1'] event-tag matches the pin's curation` | `test/customize-pin-curation-publish.test.js` | integration |
| AC-3 (/pins per-row Edit pre-fills) | `/pins row Edit button opens the dialog pre-filled with that row's current curationMethod` | `tests/brainstorm/customize-pin-curation.spec.js` | e2e |
| AC-4 (edit replaces pin in place) | `editing a pin and saving replaces the kind-39999 at the same d-tag with new curation values` | `test/customize-pin-curation-publish.test.js` | integration |
| AC-5 (refresh-on-edit fires) | `saving a curation edit fires POST /api/trusted-list/refresh-pinned-tag fire-and-forget` | `tests/brainstorm/customize-pin-curation.spec.js` | e2e |
| AC-5 (server side, observed) | `after an edit-and-refresh, the kind-30392 d-tag slot reflects the new cutoff value` | `test/customize-pin-curation-publish.test.js` | integration |
| AC-6 (cutoff validation) | `dialog blocks submission and shows inline error on cutoff=0, cutoff=-1, cutoff=1.5, cutoff=abc, cutoff=empty` | `tests/brainstorm/customize-pin-curation.spec.js` | e2e |
| AC-7 (includeScoreInTL + POV configured) | `pin with includeScoreInTL=true + resolvable POV produces a kind-30392 whose p tags carry ['p', pubkey, '', '<score>'] triples` | `test/customize-pin-curation-publish.test.js` | integration (POV-required) |
| AC-8 (includeScoreInTL + POV unresolvable) | `pin with includeScoreInTL=true + no resolvable POV still publishes a kind-30392 with bare p tags (no score) and no error` | `test/customize-pin-curation-publish.test.js` | integration |
| AC-9 (method picker locked) | `dialog method picker exposes nip85:rank as enabled and shows follows / trust-everyone / trusted-list as disabled with a "coming soon" affordance` | `tests/brainstorm/customize-pin-curation.spec.js` | e2e |
| AC-10 (observer validation; npub accepted; empty defaults to self) | `dialog Advanced > observer field rejects non-hex non-npub input, decodes npub to hex, and defaults empty to the viewer pubkey` | `tests/brainstorm/customize-pin-curation.spec.js` | e2e |
| AC-11 (cancel doesn't publish) | `closing the dialog via Cancel / Escape / backdrop-click does not call signEvent` | `tests/brainstorm/customize-pin-curation.spec.js` | e2e |

## Edge cases

- [x] Cutoff that is exactly `1` is accepted (the minimum legal value).
- [x] Cutoff with surrounding whitespace (`"  5  "`) is accepted after trim.
- [x] Submitting with unchanged defaults produces a wire event
  identical in shape to Story-10's direct publish (no regression).
- [x] Editing a pin produces a kind-39999 with the **same `d`-tag**
  as the original (replacement-in-place semantics; strfry's
  addressable-replaceable index resolves to the latest by
  `created_at`).
- [x] Editing while the cron is mid-run: the cron and the edit
  publish are sequential at the strfry level; latest wins on the next
  refresh.
- [x] Backdrop click closes the dialog without publishing (mirrors
  `AddTagDialog`'s pattern).
- [x] ESC closes the dialog without publishing.
- [x] Re-pin after unpin (via the dialog) lands in the same d-tag
  slot because the d-tag is derived from `(tagSlug, tagAuthor8,
  viewer8)` — kind-5 deletion of the prior event doesn't affect the
  d-tag identity.
- [x] Submitting the form a second time before the first publish
  resolves is prevented by the `submitting` state (button disabled).

## Test infrastructure

- **Test framework:** Node built-in runner (`node test/test.js`) and
  Playwright (`npm run test:playwright`).
- **Control panel API:** `BRAINSTORM_BASE_URL` env or default
  `http://localhost:7778`.
- **Meili:** `MEILI_URL_HOST` env or default `http://localhost:7700`.
  Required for the AC-7 POV-required test, which seeds a member's
  `wot_rank_<suffix>` column.
- **Settings file mutation:** the AC-7 test installs a deterministic
  POV by writing to `settings.json` (path = `TAPESTRY_SETTINGS_PATH`
  env or `/var/lib/brainstorm/settings.json`). Skipped when the file
  is not writable from the test process (same skip path as Story
  11's POV-required tests).
- **Firmware state:** no new firmware concept — no reinstall
  required.
- **Playwright base URL:** `BRAINSTORM_BASE_URL` or default
  `http://localhost:7778`. Tests skip when
  `BRAINSTORM_SERVER_ACCESSIBLE !== 'true'`. Same NixOS-style host
  limitation as Stories 10 + 11 — Playwright bundled chromium needs
  Linux .so deps; tests will run in CI / a standard Linux env.
- **Fixtures:** ephemeral keypairs via `nak`; deterministic mock
  pubkeys in Playwright (`'1'.repeat(64)`, etc.); mocked
  `window.nostr` for the Playwright suite.

## How to run

```bash
npm test                                          # contract + publish-flow
npm run test:playwright                            # UI / e2e
node test/customize-pin-curation-publish.test.js   # publish-flow only
BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test customize-pin-curation.spec.js
```

## Verification

### Where the failing-first signal lives

The publish-flow suite `customize-pin-curation-publish.test.js`
**passes against the current code** for AC-2 / AC-4 / AC-8 — this is
not a gap in test design, it's a signal that the wire-shape work
landed in Story 11. Specifically:

- `pinTag({ tag, curationMethod })` at
  `ui/src/utils/publishTagPin.js:39–64` already accepts a
  customization argument; the Pin button just hasn't been wiring it
  up. So tests that publish a custom-curation pin event via `nak`
  succeed against today's server.
- The Story-11 generator at
  `src/api/trustedList/refreshPinnedTags.js:124–202` already reads
  `curation.cutoff` per-pin and emits it as the TL's `cutoff`
  event-tag. So AC-2's TL assertion already holds.
- Replaceable kind-39999 semantics handle AC-4's edit-in-place at
  the protocol level. The strfry index resolves the d-tag slot to
  the latest event by `created_at`.
- AC-8 holds because the current generator IGNORES
  `includeScoreInTL` entirely — bare `p` tags are what comes out
  today. The test guards the AC's "TL still publishes / no error"
  contract against regression once AC-7's score-emission branch
  lands.

The failing-first signal is therefore concentrated in:

1. **`customize-pin-curation.spec.js` (Playwright, 15 tests).** Every
   test fails today because there is no `<CurationMethodDialog>` —
   the Pin button still fires a direct publish; `/pins` has no Edit
   button; there is no Advanced observer field; no inline cutoff
   validation; no method picker. **This is the primary failing-test
   surface for the Implementer.**
2. **AC-7 (POV-required) in the publish suite.** Skips locally on
   NixOS-style hosts; runs in CI / Linux environments where
   `settings.json` is writable from the test process. Will fail
   against today's code because the generator doesn't emit per-member
   scores; passes once the AC-7 branch lands per ADR §Implementation
   notes.

The publish-flow suite's three currently-passing tests are
**regression-protection tests**: they assert the wire-shape
guarantees the customization depends on. The Tester intentionally
chose to leave them passing today so the Implementer's UI work
doesn't accidentally break the publish path.

Confirmed Playwright parse + listing on **2026-05-20**:
all 15 tests appear under `npx playwright test --list`. The actual
fail-then-pass cycle runs in CI / Linux env where Playwright can
execute. On this host the suite skips via the existing
`BRAINSTORM_SERVER_ACCESSIBLE !== 'true'` skip path (same as Stories
10 + 11).

Sample current state (from `node test/customize-pin-curation-publish.test.js`):

```
--- customize-pin-curation publish-flow tests (Story 12) ---
  PASS  pin event with cutoff=1 produces a TL whose [cutoff,1] event-tag matches the pin's curation
  PASS  editing a pin (re-publish kind-39999 with same d-tag, new cutoff) lands at the same TL d-tag with the new values after refresh
  PASS  pin with includeScoreInTL=true + no resolvable POV still publishes a kind-30392 with bare p tags (no score) and no error
  SKIP  (phase 2: POV-required) settings.json not writable from this process

customize-pin-curation-publish: 3 passed, 0 failed, 1 skipped
```
