# Test Plan: Story 1 — In-app badged TA avatar

**Story:** `engineering-team/stories/ta-avatar/1-in-app-badged-ta-avatar.md`
**ADR:** `engineering-team/decisions/ta-avatar/0001-shared-avatar-with-ta-badge-overlay.md`
**Date:** 2026-08-06

**Test files:**
- `test/in-app-badged-ta-avatar.test.js` — 13 tests (9 **S** source assertions, 4 **R** regression sentinels). Registered in `test/test.js` (gates the exit code, with its own summary line).
- `tests/brainstorm/ta-badged-avatar.spec.js` — 7 tests (**B** class, Playwright). Every acceptance criterion is settled here.

---

## Why two classes, and which one decides

Every criterion in this story is a claim about what a viewer **sees**. A source scan proves a token
is in a file; only a browser proves a badge reaches a screen. The standing precedent is the
`goal-intent-fields` #3 Gate-3 kick-back (2026-07-27, "green suite, invisible feature") — a 36/0
green Node suite against an implementation that rendered nothing. So:

- **S** pins the ratified *structure* (component, asset, classes, delegation, runtime lookup). Fails now.
- **R** pins what the ADR promised **not** to disturb. Passes before **and** after — it fails only on collateral damage.
- **B** pins the *acceptance criteria themselves*, in a real browser against a fully mocked network.

## The before-state, measured

Probed against the current build on the fixture page (three rows: owner-authored, TA-authored,
stranger-with-a-dead-picture). This is what the ACs are written against — each premise confirmed,
not assumed:

| Row | What renders today |
|---|---|
| Owner's own | `<img class="author-avatar" naturalWidth=1>` — loads, unbadged (the control) |
| **TA** | **no image at all**: `.author-avatar-placeholder` with `textContent === ""` — a literally empty grey disc — and the name column reads `aaaaaaaa…`, a truncated pubkey |
| Stranger, dead URL | `<img class="author-avatar" naturalWidth=0>` — **the image failed to load and is still in the DOM**: the browser's broken-image glyph |

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| **AC1** — TA row shows the owner's picture with the badge, visibly distinct from the owner's own unbadged avatar | `B1` — TA row's `.avatar-img` src is the owner's picture and decodes; `.avatar-ta-badge` present and ≥14px; the **owner's own row carries the identical picture and no badge** | `tests/brainstorm/ta-badged-avatar.spec.js` | browser |
| AC1 (structure) | `S1`, `S3` — the component exists with the ADR's signature; renders `.avatar-wrap` / `.avatar-ta-badge` from `/ta-badge.svg` | `test/in-app-badged-ta-avatar.test.js` | source |
| AC1 (runtime identity) | `S2` — badging keys on `useConfig().taPubkey` + `ownerProfile`; **no 64-hex literal in the file** | same | source |
| **AC2** — hover / AT identifies it as the Tapestry Assistant of the owner, by name | `B2` — wrapper `title`/`aria-label` matches `/Tapestry Assistant/` **and** contains the owner's display name (+ ADR-mandated: the row name reads "Tapestry Assistant", not a truncated pubkey) | spec | browser |
| **AC3** — owner has no picture, or it fails → branded placeholder still badged; never an empty disc, never a broken glyph | `B3` (no picture → `.avatar-initial` carrying the owner's initial + badge) and `B4` (picture 404s → the dead `<img>` is **gone**, letter tier shown, badge survives) | spec | browser |
| AC3 (mechanism) | `S4` — the component has an `onError` handler and an `.avatar-initial` tier | source suite | source |
| **AC4** — any non-TA author with a dead picture URL shows a letter, not the broken-image glyph | `B5` — no `.avatar-img[src=<dead>]` remains; `.avatar-initial` reads `W` from "Wilhelmina Stranger"; **not** badged | spec | browser |
| AC4 (delegation) | `S6` — AuthorCell renders `<Avatar>` and no longer emits the error-blind `<img className="author-avatar">` or the empty placeholder | source suite | source |
| **AC5** — the TA's own user page header carries the same badged avatar | `B6` — `.user-detail-header .avatar-wrap` shows the owner's picture, badged, at header size | spec | browser |
| AC5 (structure) | `S7` — UserDetail renders `<Avatar size={64}>` | source suite | source |
| ADR §A1 (one fetch app-wide) | `S5` — ConfigContext fetches `/api/profiles` and publishes `ownerProfile` on the provider value | source suite | source |
| ADR §asset | `S8` — `ta-badge.svg` exists: a `<circle>`, all three brand colors, **both** real path openings from `brainstorm.svg`, and none of its filter/mask residue | source suite | source |
| ADR §CSS | `S9` — the four classes exist; `.avatar-wrap` is `position: relative`; the badge is `position: absolute` with a `min-width` floor; the `-8px` row compensation lives on `.author-cell .avatar-wrap`, **not** in the shared component | source suite | source |
| Prerequisite | `B0` — the **served** bundle contains `avatar-ta-badge`, and `/ta-badge.svg` serves a real SVG **body** | spec | browser |

## Edge cases covered

- [x] **Owner has no `picture` at all** → letter tier, still badged (`B3`). This is the live local state.
- [x] **Owner's `picture` 404s** → failover, not a broken glyph; badge survives (`B4`).
- [x] **TA has published no kind-0** → the whole fixture runs this way; `store[TA] = null`.
- [x] **A non-TA author with a dead picture** → letter, and *not* badged (`B5`) — a fallback must not manufacture an assistant.
- [x] **Badge legibility floor** → measured `boundingBox().width >= 14` (`B1`), not merely "present in the DOM".
- [x] **SPA-fallback trap** → `B0` asserts the asset's *body*, because both the control panel and `vite preview` answer an unknown path with `index.html` and a 200. (Verified: `/ta-badge.svg` returns **200** today despite not existing.)
- [x] **Stale-bundle trap** → `B0` fails loudly if the served build predates the edit; a source-only change is invisible to this class.
- [x] **No call-site churn** → `R1` re-derives the census from disk (≥33 sites, each still passing `pubkey` + `profiles`).
- [x] **Guardrails intact** → `R2` (AuthorCell's exported contract), `R3` (the 🤖 dropdown affordance, ≥7 files), `R4` (`.author-avatar*` rules left in place per the ADR).
- [ ] **Not covered — deliberately:** the remaining one-off avatar sites (NoteCard, search, user menu, TagChip), customer-delegate badging, and the `useProfiles` in-flight dedupe gap. All named out-of-scope by the story or the ADR.

## Test infrastructure

- **Node runner:** `node test/test.js` (`npm test`). No new framework.
- **Browser:** existing Playwright (`playwright.config.js`, `tests/brainstorm/`), gated on `BRAINSTORM_SERVER_ACCESSIBLE=true` like every other spec there.
- **Concept Graph API:** not used. This story touches no concept (confirmed at Architecture: 48 concepts, none models the assistant identity). **No firmware reinstall.**
- **Fixtures:** entirely in-spec — three tapestry rows over a mocked `/api/strfry/scan`, a kind-0 store over a mocked `/api/profiles`, and two fixture images: one fulfilled as a real 1×1 PNG, one as a genuine 404. **Nothing depends on live graph state**, which matters because on this machine the owner has no `picture` and the TA has no kind-0 — the photo tier is unobservable against live data.

## How to run

```bash
npm test
```

The browser class needs an origin serving the **built** UI. From an isolated worktree (no stack, no
co-tenant risk — every API call is mocked):

```bash
cd ui && npm run build && npx vite preview --port 4173 --strictPort
```

```bash
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/ta-badged-avatar.spec.js --project=chromium
```

Against the local control panel instead, drop `BRAINSTORM_BASE_URL` — but only when the checkout it
serves is the one under test (it bind-mounts the shared checkout, not this worktree).

## Verification — confirmed RED on 2026-08-06 at `fc642fd6`

**Node class — 4 passed, 9 failed.** The 9 failures are the absent feature; the 4 passes are the
regression sentinels, correctly green before implementation:

```
  ✗ S1: a shared Avatar component exists and takes the ADR's prop contract
      ui/src/components/Avatar.jsx does not exist. ADR 0001 chose Option A …
  ✗ S5: ConfigContext resolves the owner profile once and publishes it
      ConfigContext must expose ownerProfile (ADR sub-decision A1) …
  ✗ S6: AuthorCell delegates its avatar to Avatar and no longer renders a bare, error-blind <img>
  ✗ S8: the badge asset exists, is the brand mark on a filled disc, and carries no vectorizer residue
  ✗ S9: the avatar CSS family exists, and the row-height compensation stayed context-local
  ✓ R1: every AuthorCell call site still passes pubkey + profiles, and none was churned
  ✓ R2: AuthorCell keeps its exported contract (the delegation is internal, not a new API)
  ✓ R3: the 🤖 text affordance in the author-filter dropdowns is untouched
  ✓ R4: the superseded .author-avatar rules are left in place rather than deleted
  >>> RESULT {"pass":4,"fail":9}
```

**Browser class — 7 failed, 0 passed**, against a freshly built bundle served at `:4173`:

```
Error: the served bundle does not contain "avatar-ta-badge", the class ADR 0001 names for the overlay…   [B0]
Error: the assistant row must render an avatar at all                                                     [B1]
  Locator: …tr.filter({ hasText: 'Signed By The Assistant' }).first().locator('.avatar-wrap').first()
  Error: element(s) not found
```

**Failing for the right reason — the check that matters.** In `B1`–`B5` the row locator's
`toHaveCount(1)` assertion **passed** before the avatar assertion failed. The mocked scan, the row
parser and the table all worked; only `.avatar-wrap` was missing. The suite is failing on the absent
feature, not on broken fixtures.
