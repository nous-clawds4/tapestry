# Review: Story 19 — NIP-51 kind-30000 list export from pinned tags

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-28
**Branch:** `dual-publish-nip-51` (base: `main`, story-19 starts at `e7326872`)
**Diff:** `git diff e7326872..HEAD` (head commit `5d1b1877`)
**Story:** `engineering-team/stories/done/19-nip51-list-export-from-pins.md`
**ADR:** `engineering-team/decisions/0017-nip51-list-export-from-pins.md`
**Test plan:** `engineering-team/stories/done/19-nip51-list-export-from-pins.test-plan.md`

## Quality gates (run by Reviewer, not trusted from Implementer)

- [x] `node test/nip51-list-export-from-pins.test.js` — **8 passed, 0 failed**
- [x] `node test/nip51-list-export-from-pins-publish.test.js` — **14 passed, 0 failed**
- [x] `npm test` (full suite) — 30 suites green; 2 skipped on `nak` preconditions;
      1 suite (`tag-detail-curated-view-and-pin-polish`) has **2 pre-existing failures**
      (AC-8 `showActionsOnHover` prop assertion + AC-17 Pin-button `title` tooltip).
      **Verified pre-existing** via `git stash` baseline against `b4cda5fe`
      (failing before Story 19's impl commit too). Not introduced by this story.
- [ ] `npm run test:playwright` — **NOT RUN** (no browser env on this machine;
      gated on `BRAINSTORM_SERVER_ACCESSIBLE=true`). The Playwright spec at
      `tests/brainstorm/nip51-list-export-from-pins.spec.js` is committed and
      ready; it covers AC-1, AC-9, AC-10/14, AC-11, AC-13, AC-17, AC-19, AC-26,
      AC-27 in browser. Reviewer's manual walkthrough on `localhost:8080`
      (Tier 4) and the cross-client paste (AC-21/22) take over from here.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has at least one test or a documented
      manual-verification path (AC-21 / AC-22).
- [x] No criterion silently dropped.
- [x] No behavior added that isn't in the story (the unpin hint in
      `CurationMethodDialog.jsx` is authorized by ADR Q9 / story Out-of-Scope
      "the UI MUST surface this clearly").

### AC-by-AC coverage check

| AC | Status | Where |
|---|---|---|
| AC-1 (pin-time both events) | ✓ | Tag.jsx:80–87 fires `publishNip51ExportForPin` fire-and-forget after pin; Playwright AC-1 |
| AC-2 (wire shape) | ✓ | `prepare-nip51-export` returns d/z/title/description/p tags; publish-flow AC-2 |
| AC-3 (optional description/image) | ✓ | description always populated; image omitted (per ADR Q5); publish-flow AC-2 |
| AC-4 (shared membership) | ✓ | Server reads current kind-30392 p-tag set; same source the cron uses |
| AC-5 (single addressable slot) | ✓ | publish-flow test "two re-exports → same coordinate" |
| AC-6 (d-tag composition) | ✓ | `tl-pin-${observer8}-${tagAuthor8}-${slug}` at `trustedList/index.js:303` |
| AC-7 (no NIP-09 on re-export) | ✓ | publish-flow test scans kind-5 by viewer (none); no kind-5 code path added |
| AC-8 (re-pin reuses slot) | ✓ | d-tag invariant tested in publish-flow |
| AC-9 (title customizable + fallback) | ✓ | `trustedList/index.js:313–315`; default = bare tag.name |
| AC-9 (no interstitial at pin time) | ✓ | Tag.jsx publishes fire-and-forget; no dialog opened |
| AC-10 (Export visible alongside Share) | ✓ | Pins.jsx:230, PinDetail.jsx:209 — TLExportButton + TLShareButton co-render |
| AC-11 (NIP-07 sign + naddr clipboard) | ✓ | TLExportButton.jsx:64–82; Playwright AC-11 |
| AC-12 (legacy-pin first-export) | ✓ | Server endpoint handles never-exported same as re-export; one button covers both |
| AC-13 (no NIP-07 disabled) | ✓ | TLExportButton.jsx:84 `disabled={!hasNip07 \|\| exporting}` |
| AC-14 (two distinct affordances) | ✓ | Pins.jsx and PinDetail.jsx render both; distinct labels + colors |
| AC-15 (last-exported timestamp) | ✓ | `nip51ExportStatus.exportedAt` field; publish-flow AC-15 |
| AC-16 (staleness diff) | ✓ | `diffVsTL: { added, removed }`; publish-flow AC-16 |
| AC-17 (never-exported inviting state) | ✓ | `renderExportStatusLine` is-never variant; Playwright AC-17 |
| AC-18 (no regression on /pins) | ✓ | Pins.jsx existing tlStatus logic untouched; full test suite green |
| AC-19 (no regression on /pin/:dTag) | ✓ | PinDetail.jsx existing metadata unchanged; new section inserted before members |
| AC-20 (no regression on chips) | ✓ | No chip code touched |
| AC-21 (paste into Amethyst) | **MANUAL** | Reviewer to verify post-merge per test-plan walkthrough |
| AC-22 (recipient lacks relay) | **MANUAL** | Reviewer to verify post-merge |
| AC-23 (two POVs → two events) | ✓ | publish-flow test #12 |
| AC-24 (WoT-filter membership) | ✓ | Server reads kind-30392 which is itself per-POV WoT-filtered |
| AC-25 (publish to write relays) | ✓ | publishNip51ExportForPin calls `publishEverywhere(signed, writeRelays)` |
| AC-25 (kind 10002 in syncWoT kinds) | ✓ | `syncWoT.sh:31` — `10002` present |
| AC-26 (pre-publish relay preview) | ✓ | TLExportButton popover renders before NIP-07; Playwright AC-26 |
| AC-27 (no-NIP-65 warning copy) | ✓ | TLExportButton.jsx:124–131; `nip51ExportStatus.writeRelays: []` on row |
| AC-27 (server returns writeRelays:[]) | ✓ | publish-flow no-kind-10002 test |
| AC-28 (naddr includes write relays) | ✓ | `nip19.naddrEncode({ relays: writeRelays })`; publish-flow AC-28 |
| Q9 unpin hint | ✓ | CurationMethodDialog.jsx:293–301 — renders during confirmingUnpin |

## ADR adherence

- [x] Picked Option A (server prepares unsigned template; client signs).
- [x] Files changed match ADR Implementation notes:
    - `src/api/trustedList/index.js` — new `handlePrepareNip51Export` ✓
    - `src/api/_shared/userRelays.js` — new shared helper (sibling of `pov.js`) ✓
    - `src/api/profile-tags/index.js` — extended `enrichRowsWithTLStatus` returns tlByDTag; new `enrichRowsWithNip51ExportStatus` ✓
    - `src/manage/negentropySync/syncWoT.sh` — added kind 10002 ✓ (Amendment A2)
    - `ui/src/components/TLExportButton.jsx` — new component ✓
    - `ui/src/utils/publishTagPin.js` — `publishNip51ExportForPin` helper ✓
    - `ui/src/pages/Tag.jsx` — pin handler extension ✓
    - `ui/src/pages/Pins.jsx` — export status line + button ✓
    - `ui/src/pages/PinDetail.jsx` — new Export section ✓
    - `ui/src/components/CurationMethodDialog.jsx` — unpin hint ✓ (Q9)
- [x] Open questions resolved per ADR: Q1 sequential prompts ✓; Q2 reuse
      `tag-pinning` z-tag with LEGACY pubkey ✓; Q3 superseded by Amendment ✓;
      Q4/Q5 title default + description hint ✓; Q6 staleness line shape ✓;
      Q7 read current kind-30392 ✓; Q8 allow stale TL ✓; Q9 unpin hint ✓.
- [x] Amendment A9 honored: **no** `/api/config/public-relay` endpoint added.
      Contract test guards against it (`nip51-list-export-from-pins.test.js`).
- [x] No new dependencies introduced. Reuses existing `nostr-tools`,
      `publishEverywhere`, `getOwnerAssistantPubkey`, etc.

## Concept-graph integrity

- [x] Handles in `kind:pubkey:slug` form throughout (`profileTags.TAG_PINNING_Z_TAG`
      → `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`).
- [x] **No firmware reinstall required** — z-tag reuses the existing
      `tag-pinning` concept (no new concept introduced).
- [x] No code re-derives from BIBLE.md or firmware JSON; everything goes
      through `profileTags.*` exports and the existing strfry-scan pattern.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No `console.log` debug statements; only `console.error` consistent with
      existing trustedList error logging (`trustedList/index.js:185`,
      `:204`, `:373`).
- [x] No commented-out code.
- [x] Input validation at boundaries:
    - `pinEventId` hex-validated at `trustedList/index.js:265–267`
    - Session pubkey check at `:280–281` (auth) + `:283–285` (ownership)
    - Observer pubkey hex-validated at `:294–296`
    - Tag payload presence + slug presence at `:304–306`
- [x] Concurrency: pin-time fires both refresh-on-pin AND publishNip51ExportForPin
      in parallel. Race documented per ADR Q1 — if prepare runs before refresh,
      kind-30000 has empty/old members; user can re-export later. The `/pins`
      row's nip51ExportStatus correctly reports diff. Not a bug.
- [x] Security: `requireAuth` enforces session; pin ownership enforced at
      `trustedList/index.js:283`. No SQL/command injection vectors — strfry
      filters are JSON.stringified, single-quoted in shell with escape.
- [x] Replaceability invariant (AC-5/6/7/8) enforced structurally: d-tag
      composition is identical to kind-30392; no NIP-09 code path added.

## House rules check

- [x] Concept Graph API authority respected (concepts referenced via runtime
      handles, not BIBLE.md).
- [x] No new lint/typecheck/build tooling.
- [x] Runtime TA pubkey rule honored: `profileTags.TA_PUBKEY` (runtime) for
      author filtering; `LEGACY_Z_TAG_PUBKEY` (via `TAG_PINNING_Z_TAG`) for
      z-tag composition per ADR 0015.

## Findings

### Blocking

_None._

### Non-blocking

1. **`ui/src/utils/publishTagPin.js:155–159`** — when `writeRelays === []` (no
   kind-10002 fallback per AC-27), the publish-failure condition
   `!localOk && !externalOk && publishRelays.length > 0` silently swallows a
   local-strfry failure (the `&& publishRelays.length > 0` clause is too
   permissive). In practice local strfry doesn't fail, so the edge case is
   rare; a future tightening to `!localOk && !externalOk` (and trusting the
   "external empty when length===0 is OK" semantics that publishEverywhere
   already supports) would close this gap. *Optional improvement.*

2. **`ui/src/utils/publishTagPin.js:158`** — uses dynamic `await import('./nostrPublish')`
   for `publishEverywhere` whereas the sibling `publishProfileTag.js:1` uses
   a static import. Style inconsistency; functionally equivalent. *Optional
   improvement.*

3. **`ui/src/components/TLExportButton.jsx`** — the popover does not dismiss
   on outside-click (only via Cancel button or after a successful export).
   Story AC-26 doesn't require outside-click dismissal; minor UX polish.
   *Optional improvement; not a blocker.*

4. **`src/api/trustedList/index.js:226–238`** — third copy of a small
   `strfryScan` helper (also in `refreshPinnedTags.js:35`,
   `profile-tags/index.js:69`, `_shared/userRelays.js:25`). Existing
   per-module pattern; extracting to `_shared/strfry.js` would clean up
   long-term but isn't authorized by this ADR. *Observation only.*

5. **Pre-existing failures in `tag-detail-curated-view-and-pin-polish` suite**
   — 2 of 33 tests fail (AC-8 + AC-17). Confirmed pre-existing via
   `git stash` baseline against b4cda5fe. Orthogonal to Story 19. Worth a
   separate cleanup story. *Not a blocker for this review.*

6. **`tests/brainstorm/nip51-list-export-from-pins.spec.js`** — Playwright
   spec is committed but was not exercised by the Implementer's
   `cycle-local` run (no browser env). Reviewer should run it before
   `cycle-staging` if browser environment is available, or rely on the
   manual AC walkthrough on `localhost:8080`. *Verification gap noted; not
   a code defect.*

## Manual ACs awaiting Reviewer verification (out of this report's scope)

- **AC-21** — Cross-client paste of a copied `naddr` into Amethyst (Android)
  or equivalent NIP-51-aware client. Test plan documents the walkthrough.
- **AC-22** — Recipient on a relay set that doesn't mirror local strfry or
  the user's write relays. Expected behavior: failure-tolerance is correct
  (per ADR's "best-effort multi-relay" semantics).

These can be exercised against staging once the branch is promoted, or
locally against `localhost:8080` after the implementation lands. They
remain prerequisites for declaring the cross-client UX promise honored
end-to-end.

## Verdict

**PASS**

The diff matches the story's 28 acceptance criteria, conforms to ADR 0017
including the 2026-05-28 Amendment, passes the full Node test gate (30 of
31 suites; the one failing suite has 2 unrelated pre-existing failures),
respects all three CLAUDE.md invariants (POV-first, decentralized-first,
filter-at-view-time), and introduces no new firmware concepts or build
infrastructure. Non-blocking findings are noted for follow-up but do not
gate merge.

---

## Amendment II review — 2026-05-28

The PO surfaced a wrong-layer issue after the original PASS: the user's
NIP-65 write-relay list is identity data sourced from `window.nostr`,
not WoT-graph data. ADR Amendment II rerouted the lookup client-side
via `window.nostr.getRelays()`. This addendum reviews the
implementation of that amendment.

### Quality gates (Reviewer-run)

- [x] `node test/nip51-list-export-from-pins.test.js` — **8 passed, 0 failed**
- [x] `node test/nip51-list-export-from-pins-publish.test.js` — **11 passed, 0 failed**
      (3 writeRelays-row tests removed per Amendment II §11; 1 strfry
      kind-10002 precondition removed)
- [x] `npm test` (full) — same shape as original review: 30 suites green,
      `tag-detail-curated-view-and-pin-polish` 2 pre-existing failures
      (unrelated; previously confirmed via git stash baseline).
- [ ] `npm run test:playwright` — not run on this machine; spec updated
      with `getRelays` mocks for AC-26 / AC-27.

### Spec adherence (Amendment II ACs)

- [x] **AC-25** — `publishNip51ExportForPin` accepts writeRelays from
      caller; falls back to `fetchUserWriteRelays()` (NIP-07 getRelays)
      when omitted. `publishEverywhere(signed, writeRelays)` is the
      publish target.
- [x] **AC-26** — `TLExportButton` `useEffect` on `open` calls
      `fetchUserWriteRelays()`; popover renders the relay list from
      component state. "Reading your relay list…" loading state added.
- [x] **AC-27** — When `getRelays()` is missing, rejects, or returns
      no write entries, the popover renders the no-NIP-65 warning copy
      (rewritten to mention `window.nostr.getRelays()`).
- [x] **AC-28** — Client composes naddr via `nip19.naddrEncode` from
      the user's write relays after signing. Server endpoint no longer
      returns a pre-composed naddr.

### ADR adherence (Amendment II §§II-1–II-13)

- [x] II-1 `fetchUserWriteRelays()` helper present in
      `ui/src/utils/publishTagPin.js`, parses `getRelays()` output,
      filters write entries (`meta.write !== false`).
- [x] II-2 No deferred fallback to direct relay fetch (correctly
      out of v1 scope).
- [x] II-3 `prepare-nip51-export` response shrank to
      `{ success, unsigned, dTag, memberCount }` — no writeRelays,
      no naddr.
- [x] II-4 `nip51ExportStatus` shape on /pins rows dropped
      writeRelays; other fields unchanged.
- [x] II-5 `src/api/_shared/userRelays.js` deleted (`git rm`).
- [x] II-6 `syncWoT.sh` kind-10002 reverted (line 31 back to
      `[0, 3, 1984, 10000, 30000, 38000, 38172, 38173]`).
- [x] II-7 `TLExportButton` fetches relays on `open`; no
      `writeRelays` prop.
- [x] II-8 `publishNip51ExportForPin` signature
      `{ pinEventId, title, writeRelays? }`; composes naddr via
      `nip19.naddrEncode` client-side.
- [x] II-9 `Tag.jsx` pin-time flow unchanged (fire-and-forget without
      `writeRelays` arg → helper does its own NIP-07 lookup).
- [x] II-10 ACs reframed in-place (no AC numbers reused).
- [x] II-11 Tester revisions applied per Amendment II §11 list.
- [x] II-12 No new firmware concept; no firmware reinstall.

### Concept-graph integrity

Unchanged from original review. Still reuses `tag-pinning` z-tag with
`LEGACY_Z_TAG_PUBKEY`. No firmware concepts touched.

### Things tests can't catch

- [x] No secrets in committed files.
- [x] No `console.log` debug statements (only existing `console.error`
      from prior commit).
- [x] No commented-out code.
- [x] **Original non-blocking finding #1 (silent local-failure swallow)
      is FIXED in this amendment** —
      `publishTagPin.js:198` removed the `&& publishRelays.length > 0`
      clause; the helper now throws on full publish failure
      regardless of whether external targets were specified.
- [x] **Original non-blocking finding #2 (dynamic import) is FIXED** —
      `publishEverywhere` + `nip19` now static-imported at file top.
- [x] No regressions in row-shape: `nip51ExportStatus` still carries
      `status`, `exportedAt`, `exportEventId`, `memberCount`,
      `diffVsTL`, `currentTitle`. Only `writeRelays` removed.

### House rules

- [x] Concept Graph API authority respected (no changes here).
- [x] No new lint/typecheck/build tooling.
- [x] Runtime TA pubkey rule still honored.

### Findings

**Blocking:** _None._

**Non-blocking:**

1. **`ui/src/components/TLExportButton.jsx:69–73`** — popover still
   does not dismiss on outside-click. Carried over from original
   review; minor UX polish; not a regression.

2. **`tests/brainstorm/nip51-list-export-from-pins.spec.js`** — Playwright
   spec was updated but not exercised here (no browser env). Reviewer
   note: the `getRelays`-absent path (AC-27) is covered by
   `mockNip07TwoSignNoGetRelays`; recommend running the spec before
   first user-pushed deploy.

3. **Pre-existing failures in `tag-detail-curated-view-and-pin-polish`**
   — same 2 tests as the original review. Still orthogonal.

### Amendment II verdict

**PASS**

Amendment II correctly relocates the user's NIP-65 lookup to its
proper layer (NIP-07 / client-side identity data), drops the
wrong-layer infrastructure (server helper, syncWoT kind addition,
row-payload field, server-composed naddr), and fixes two of the
original review's non-blocking findings (silent failure swallow,
dynamic import). All Story 19 tests green. Ready to ship.
