# Review: Story 1 — Tag surfaces honor the explicitly-selected POV

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-09
**Epic:** pov-selectable-tag-surfaces
**Diff:** `git diff HEAD~1 HEAD` (commit `3b97651b` — "feat: tag surfaces honor the explicitly-selected POV (pov-selectable-tag-surfaces #1)")

## Quality gates (run by reviewer, not trusted)

- [x] `node test/pov-selectable-tag-surfaces.test.js` → **17 passed, 0 failed** (B1–B6, S1–S6, S2a–S2f).
- [x] `npm --prefix ui run build` → **clean** (`✓ built in 15.57s`; only the pre-existing chunk-size advisory).
- [x] Sibling suites spot-checked: `unified-tags-directory` **4/0**, `tag-detail-curated-view-and-pin-polish-publish` **1/0**. Live/POV-install suites (`authored-tagging-publish`, `most-pinned-tag-index-publish`) SKIP/fail on filesystem-shared-install preconditions — environmental, not this diff.
- [x] `dual-z-writer` → **13 passed, 1 failed**. The one failure (`AC-1 + dual-z-count: createTag (useProfileTags.js) … EXACTLY two z entries`) is a **source-contract on the untouched write path**. Verified pre-existing: checking out `HEAD~1`'s `useProfileTags.js` yields the identical `13 passed, 1 failed`. Not a regression from this story.
- [x] _Lint not configured — skipped._ _Typecheck not configured — skipped._

## Diff shape

Client-only. `git diff --name-only` shows exclusively `ui/**` (10 files) + the story doc. No backend, no `src/api/**`, no write-path files (`publishProfileTag`, `profile-tags/index`, `publishTagPin`), no schema/concept/firmware. Read-time parameter threading only, exactly as the ADR scoped.

## AC-by-AC evidence

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1** explicit selection honored, not login-binary | PASS | `resolvePovReadParams` (`ui/src/utils/povReadParams.js:14`) returns `{wotPov:'user',userPubkey}` **only** for `pov==='user'` + 64-hex key; every other case (named/house/no-key/invalid) → `{wotPov:'house'}`, no `userPubkey`. Test **B2** proves a *named* selection (`nosfabrica`) with a viewer key present resolves to house, not own. The login-binary block is deleted from all five surfaces that had it (test **S3**). |
| **AC-2** my-own POV when selected | PASS | `PovContext.jsx:60` derives `povParams = resolvePovReadParams({pov:selectedPov, userPubkey:user?.pubkey})`. Test **B1**: `{pov:'user', hex}` → `{wotPov:'user', userPubkey}`. |
| **AC-3** house / logged-out default | PASS | `selectedPov` defaults `'nosfabrica'` (`PovContext.jsx:35`). Logged-out → `user` is undefined → `povParams={wotPov:'house'}`. Tests **B3/B4**. |
| **AC-4** consistency across all six surfaces | PASS | All six consume `usePov().povParams` and spread it (tests **S2a–S2f**). Each preserves its own params: `useEventTags` keeps `viewerPubkey` (mine channel); `useTagIndex` keeps `viewerPubkey`/`mineOnly`/`pinnedByMe`/`q`/`sort`/`offset`; `useTagDetail` keeps `viewerPubkey`/`sort`; `useAuthoredTagging` keeps `authorPubkey`/`sort`; `useProfileTags` keeps `pubkey` (read path only); `TagPageSearch` keeps `q`/`limit`/`offset`. POV fields added to every effect dep array (AC-6). |
| **AC-5** one selection governs search + tags | PASS | `main.jsx:14` mounts `<PovProvider>` inside `<AuthProvider>` (it calls `useAuth`) wrapping the whole app (test **S6**). `BrainstormSearch.jsx:784` sources `const {selectedPov:pov, setSelectedPov:setPov}=usePov()` — no local `useState('nosfabrica')` (test **S5**) — and resolves read params via the shared util at `:834`. Exactly one persistence writer for `pov` (`PovContext` persist effect); UserMenu no longer writes `pov`. |
| **AC-6** switching updates the view | PASS | `povParams.wotPov` + `povParams.userPubkey` present in every one of the six effect dep arrays (verified line-by-line in the diff). A POV switch changes `wotPov` (and `userPubkey`), re-firing each fetch on next mount. |

## Deviation assessment — persist-effect split (the main regression surface)

The story `## Deviations` logs that `rankAuthor`/`rankRelay` persistence stays a UserMenu effect while `pov` moves to `PovContext`. I scrutinized all three sub-claims and confirm each:

- **(a) merge preserves `rankAuthor` when PovContext PUTs `{pov}`.** `handleUpdateUserPrefs` reads existing prefs from disk and merges `{...existing, ...prefs}` (`src/api/settings/userPrefsApi.js:78`). A `PUT {pov}` therefore leaves `rankAuthor`/`rankRelay`/`filters`/`sortConfig` intact, and the UserMenu `PUT {rankAuthor,rankRelay}` leaves `pov` intact. Search's `wotPov=user` resolution (`resolvePov` reading `rankAuthor`) is preserved. **Confirmed.**
- **(b) no double-writer race / lost update.** The two writers PUT disjoint keys, and the server handler's read-modify-write is a synchronous `readFileSync` → `writeFileSync` pair with **no `await` between them** (`userPrefsApi.js:75–79`). On Node's single thread, two concurrent requests cannot interleave their sync fs ops, so each PUT is an atomic RMW against fresh-on-disk state. No lost update. **Confirmed.**
- **(c) localStorage key + prefs shape byte-compatible.** `PovContext` uses the same `bs_pov_<pubkey>` key and the same `preferences.pov ∈ {'user','nosfabrica'}` accept-list lifted verbatim from `BrainstormSearch`. The auto-select logic (`BrainstormSearch.jsx:449,456`) still reads that exact key and continues to work; mount-time persistence writes `'nosfabrica'` on first mount identically to the old UserMenu persist effect (same guard `if (!user || !selectedPov)`), so existing users' persisted `pov` loads unchanged and auto-select timing is unaltered. **Confirmed — no regression.**

## Risk areas audited

- **`useEventTags` viewerPubkey channel (POV added where there was none).** The trust-unfiltered `mine` channel is preserved (`if (HEX64.test(viewerPubkey||'')) params.set('viewerPubkey', …)`) **and** the new `wotPov`(+`userPubkey`) are added alongside — the two channels coexist as required (`useEventTags.js:56–61`).
- **`useTagIndex`/`useTagDetail` viewerPubkey now sent for any logged-in user** (previously only inside the `'user'` branch). This is correct, not a regression: the viewer/pin "mine" channel is POV-independent, so a logged-in user selecting house still gets their `viewerPinned`/viewer-flag rows. Consistent with the mine-vs-POV-filtered separation the ADR calls out.
- **PovContext load correctness.** Fast-path `localStorage['bs_pov_'+pubkey]` then `GET /api/user-prefs`, both gated on `p === 'user' || p === 'nosfabrica'` (rejects anything else). Load effect is keyed on `[user?.pubkey]`, so switching accounts re-runs the load and doesn't bleed a stale pov.
- **`usePov()` outside a provider.** Would throw on destructure if a consumer rendered outside `<PovProvider>`; the provider is at the app root wrapping `<App/>`, so every route (search + tag pages) is covered. Build + tests confirm imports resolve.
- **No pubkey literals** added to the client (only `wotPov` + the viewer's own `useAuth` key). No `console.*`, no `debugger`, no TODO/FIXME, no commented-out code in added lines.

## Concept-graph integrity

- [x] No concept handles touched; no `kind:pubkey:slug` changes.
- [x] No schema/concept-definition change → **firmware reinstall not required** (ADR §Consequences confirms; verified — no concept files in diff).
- [x] No new code needs `/summaries` orientation (pure client param threading).

## House rules

- [x] Concept Graph API authority respected (no concept edits).
- [x] No new lint/typecheck/build tooling. JS-without-build honored (dependency-free ESM util).
- [x] Architecture invariants: read-time param threading only; no new per-POV columns, no denormalized "trusted set," no write-path change. POV-first / filter-at-read-time honored.

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/context/PovContext.jsx:22`** — `usePov()` returns raw `useContext` (null outside a provider) rather than throwing a named error like some sibling contexts. Harmless given the root mount; optional hardening for future misuse.
2. **`ui/src/context/PovContext.jsx` persist effect** — fires a mount-time `PUT {pov:'nosfabrica'}` for a fresh logged-in user before the server GET resolves, then a second PUT once the loaded value applies. This is behavior-identical to the pre-existing UserMenu effect (same double-write on mount) and is merge-safe, so it's not a regression — noting only that the redundant first PUT is inherited, not introduced.

## Verdict
**PASS**
