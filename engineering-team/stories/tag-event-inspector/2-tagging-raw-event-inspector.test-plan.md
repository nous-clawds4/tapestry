# Test Plan: Story 2 — Raw event inspector for profile taggings

**Story:** `engineering-team/stories/tag-event-inspector/2-tagging-raw-event-inspector.md`
**ADR:** `engineering-team/decisions/tag-event-inspector/0002-tagging-raw-event-inspector.md`
**Date:** 2026-07-16

## What actually gates — read this first

The three layers below are **not** equally binding, and conflating them is how this story would ship with imaginary coverage.

| Layer | File | Gates CI? | Why |
|---|---|---|---|
| **Stack-free source assertions** | `test/tagging-raw-event-inspector-ui.test.js` | **YES — the only automatic gate** | Runs with no stack, no network, no transpile. |
| Live HTTP contract | `test/tag-detail.test.js` (extended) | **No** | **Skips wholesale** when the control panel is unreachable (`:268-271` returns `{pass:0, fail:0, skipped}`) — which is exactly CI's stack-free job. Contributes `fail === 0` trivially. |
| Live publish-flow | `test/tag-detail-publish.test.js` (extended) | **No** | Needs `nak` + a relay + Meili + writable settings; skips otherwise. |
| Playwright | *(none written)* | **No** | Nothing runs it — verified by grep across `.github/`, `.claude/`, `scripts/`. The only references are the role docs that *instruct* writing specs. |

**Why no Playwright spec.** Not laziness — a **ratified project decision**. `OPEN.md` #13 records the reviewer's call verbatim: *"e2e/Playwright in CI has a heavy dependency setup and relay-state pollution (hundreds of test tags accumulate on a dev relay) — first CI story is stack-free suites ONLY, e2e deferred."* CI runs `npm ci && npm test` → `node test/test.js` and nothing else (`.github/workflows/test.yml`). Story 1 set the same precedent: it shipped `tag-actions-menu-ui.test.js` and no spec. A spec here would join 31 others that nothing runs and rot unread.

**A correction the Reviewer should have.** ADR 0002 D1 lists *"testable by the existing node HTTP-contract suite"* among its reasons for preferring eager Option A. That is true locally and on staging, but those tests **do not gate CI**, so the argument carries less than it reads. It does **not** change D1 — the decisive argument was scan cost (Option B re-scans the whole tag per panel opened), which stands untouched. Recorded here rather than left for someone to discover.

## Coverage map

`U` = fails now, passes once built. `R` = regression sentinel, passes before **and** after; exists to fail on a *future* edit.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 (⋯ at every width, hover/focus-reveal, no permanent noise) | `U10` wide kebab scoped to `.is-raw-enabled`, `visibility` not `display`; `U7` row carries the class | `tagging-raw-event-inspector-ui` | source |
| AC-2 (menu contents by width; float-right; no auth gate) | `U3` both labels; `U11` above 769px scores/actions leave the **a11y tree**; `U13` `margin-left:auto`; `R9` button stays out of `renderActionsMarkup` | `tagging-raw-event-inspector-ui` | source |
| AC-3 (default hidden, per-row panel, menu closes) | `U5` `closeOverflow()` on select; `U6` per-row `useState`; `U12` `flex-basis:100%` | `tagging-raw-event-inspector-ui` | source |
| AC-4 (**every** event, faithful, identifiable) | `U14` `{polarity,counted,event}`; `U18` author pubkey; `U19` uncounted marked; `U1` panel component | `tagging-raw-event-inspector-ui` | source |
| AC-4 (**the invariant**) | `THE INVARIANT — counted blocks reconcile to the row's +N/-M` | `tag-detail` | live HTTP |
| AC-4 (whitelist) | `assertion.event carries EXACTLY the seven canonical NIP-01 keys` + canonical **order** | `tag-detail` | live HTTP |
| AC-4 (identity/order) | `kind-39999 + names its row as target`; `polarity is apply\|dispute`; `ordered applications-before-disputes`; `order stable across identical requests` | `tag-detail` | live HTTP |
| AC-4 (**the case `counted` exists for**) | `an untrusted viewer assertion is returned but counted:false` | `tag-detail-publish` | live publish |
| AC-5 (honest degradation) | *(see gap below)* | — | verify-by-driving |
| AC-6 (**modal untouched**) | `R7` — the highest-value sentinel here | `tagging-raw-event-inspector-ui` | source |
| AC-6 (Story 1 untouched) | `R3` header menu items; `R4` `.bs-tag-raw-pre` shared not forked | `tagging-raw-event-inspector-ui` | source |
| AC-6 (no TA literal) | `R1` no 64-hex / no `LEGACY_*` / no `taPubkey` | `tagging-raw-event-inspector-ui` | source |
| AC-6 (additive safety) | `R — the documented envelope survives`; existing 400s | `tag-detail` | live HTTP |
| ADR D1 | `R8` `toRawEvent` declared exactly once | `tagging-raw-event-inspector-ui` | source |
| ADR D2 | `U15` `authorAllowed` returned | `tagging-raw-event-inspector-ui` | source |
| ADR D2 (TL safety) | `R6` `applyDisputesFunction` still whitelists | `tagging-raw-event-inspector-ui` | source |
| Decision #5 (neutral) | `U17` (source) + `a neutral assertion is excluded entirely` (runtime) | both | source + live publish |
| profile-tag-hardening 0001 | `R2` scan still unions `#e`/`#a`, still `federatedScan` | `tagging-raw-event-inspector-ui` | source |

## The two tests that matter most

**1. `THE INVARIANT — counted blocks reconcile to the row's +N/-M`** (`tag-detail`). This is the whole story in one assert. AC-4 promises a reader can count the blocks and get the row's numbers; this is that promise, executed.

**2. `an untrusted viewer assertion is returned but counted:false`** (`tag-detail-publish`). The subtlest case in the story and the reason ADR D1 added the flag. A viewer whose own assertion fails the POV's WoT filter, on a target that *also* carries trusted assertions: the counts read `+2`; `onlyViewerVisible` is **false** (it requires `applications===0 && disputes===0`, `index.js:970`) so **no badge explains anything**; yet the viewer-union still lands the viewer's event in the panel — **three blocks under a "+2"**. Without `counted`, AC-4's promise is simply false there. The test asserts: 3 blocks, exactly 2 `counted:true`, they reconcile to `+2`, and the uncounted one is the viewer's own. It reuses the existing 4-author WoT fixture's exact seeding shape (2 authors at rank 80, 2 at rank 10, `minRank` 50).

**And the highest-value *sentinel*: `R7`.** An implementation that gates the affordance on `row.assertions?.length` instead of the `showRawEvent` prop **passes every other test in the suite and fails only R7** — because `TagSomeoneModal.jsx:196` (`const row = existingRow || {…}`) passes the `profiles-tagged` row object *by reference*, so modal rows genuinely carry `assertions`.

## Edge cases covered

- [x] **Neutral assertions** (polarity strictly between ±0.5) — excluded from `assertions` entirely, matching the counts. Deliberate (story decision #5); named explicitly so a reviewer doesn't read it as a bug.
- [x] **Absent `polarity` tag** → `readPolarity` returns 1 → `apply`. Covered by the runtime polarity assert over real corpus events.
- [x] **Viewer-union / uncounted blocks** — the `counted:false` test above.
- [x] **A row with zero applies and only disputes** — the `+0 −3` shape (`verified-human`'s NY Times row on staging). Covered structurally by the polarity + reconciliation asserts, which are polarity-symmetric.
- [x] **Empty/unknown tag** — existing envelope test; `rows: []`, no throw.
- [x] **Two events sharing `created_at`** — the sort is a *total* order (polarity → `created_at` desc → `id`), asserted by the stable-order test.
- [x] **Assertion data reaching a published kind-30392 TL** — `R6`. The one real hazard on the shared helper.

## Known coverage gaps — named, not implied

These are **not** covered by any automatic gate. They go to verify-by-driving, per ADR 0002 and Story 1's precedent. Listing them so the Reviewer audits the right things by hand rather than trusting a green suite:

1. **AC-5 (degradation) end-to-end** — that selecting the item with `assertions: []` shows a visible message, opens no panel, and throws nothing. Source can show the branch exists; only driving proves the behavior. *(Note AC-5's "still being retrieved" clause needs no state by design — under D1 the assertions arrive with the rows, so the existing `rowsLoading` → "Loading profiles…" is the indication. No spinner test, because the architecture deliberately has no spinner.)*
2. **The menu actually closing on click**, at both widths.
3. **Two rows holding panels open simultaneously** (AC-3). Falls out of per-row `useState` (D3) and `U6` pins the mechanism, but the behavior is unproven.
4. **The desktop hover/focus-within reveal actually revealing** — and staying visible once the dropdown is open. `U10` pins the CSS; only a browser proves the interaction.
5. **No 1280px horizontal overflow with a panel open.** `R4` pins `pre-wrap`+`break-all`, which is the mechanism, not the outcome.
6. **The multi-block panel against real multi-author data.** The local corpus tops out at **one assertion per row** (measured 2026-07-16), so the local runtime tests cannot exercise N>1. Drive **staging** for that: `podcaster` (Avi Burra `+4 −0`), `verified-human` (NY Times NewsBot `+0 −3`, zero applies), `aos-2026-participant` (99 rows / 108 assertions).

## Test infrastructure

- **Framework:** Node's built-in runner (`node test/test.js`). No new infrastructure.
- **Registration (the four touches):** `test/test.js` — require `:126`, run `:371`, summary `:717`, and the `overallOk` term. **The term lands in the LIVE chain.** Per `OPEN.md` #43 the chain is severed by a stray `;` and 9 registered suites never gate; the terminal live term was `tagActionsMenuUiResult.fail === 0;` (Story 1 hit exactly this and had to move its term up). This suite extends that terminal term rather than appending below it — **verified mechanically**, not by eye:
  ```
  term inside LIVE chain : YES ✓
  live chain terminates  : "taggingRawEventInspectorUiResult.fail === 0;"
  ```
  The severing `;` itself is left alone: re-attaching the other 7 suites is a gate-semantics change for other stories and belongs to the meta-sweep harness story (`OPEN.md` #43), not slipped into this diff.
- **Fixtures.** *Source suite:* none — reads the repo. *Live HTTP:* discovery, not a hardcoded id (a tagging row's evidence depends on whichever corpus the base URL holds); probes the first 60 of `available-tags` for a tag with rows and **fails loudly** if none, rather than passing vacuously. *Live publish:* seeds its own multi-author assertion graph with `nak`.
- **Prerequisites.** Live HTTP: a control panel at `BRAINSTORM_BASE_URL || http://localhost:7778` with ≥1 tagging. Live publish: `nak` on PATH + a writable `settings.json` (skips with a reason otherwise). No firmware reinstall — no concept definitions change.

## How to run

```
node test/tagging-raw-event-inspector-ui.test.js     # the CI gate — no stack needed
node test/tag-detail.test.js                         # live HTTP contract
node test/tag-detail-publish.test.js                 # live publish (nak + relay + Meili)
npm test                                             # everything; see the gate note below
```

**Do not read a green `npm test` as the gate, and do not read a red one as failure.** A full local run reports **Overall: FAIL for environmental reasons** (`OPEN.md` #27) — the local Neo4j graph is near-empty, so ~11 tag/pin/TL suites fail regardless of this change, and a tail-view of the output hides it. The binding gates are **(a)** a *differential* against the `origin/staging` baseline (same suites failing before and after; no **new** failures) and **(b)** CI's stack-free run.

## Verification — the tests fail now, for the right reasons

Confirmed 2026-07-16 at commit `ecf13b93` (pre-implementation).

**Stack-free suite — every `U` fails, every `R` passes.** That split is the point: a `U` that passed before implementation would prove nothing, and an `R` that failed would mean the change broke something already shipped.

```
tagging-raw-event-inspector-ui: 9 passed, 16 failed   (16 U fail, 9 R pass — a clean split)
  FAIL  U1  … TagRowRawEvents component exists                (does not exist yet)
  FAIL  U2  … showRawEvent prop, defaulting to false
  FAIL  U3  … Show/Hide Raw Event labels
  FAIL  U5  … selecting the raw item CLOSES the menu
  FAIL  U6  … open state is PER ROW
  FAIL  U7  … row carries is-raw-enabled
  FAIL  U8  … tag page opts its rows in
  FAIL  U10 … wide kebab scoped to is-raw-enabled
  FAIL  U11 … above 769px the menu carries ONLY the raw item
  FAIL  U12 … panel wraps below its row
  FAIL  U13 … raw button floats right
  FAIL  U14 … API builds row.assertions {polarity,counted,event}
  FAIL  U15 … aggregateProfilesTagged returns authorAllowed
  FAIL  U17 … neutral excluded
  FAIL  U18 … block shows the author pubkey
  FAIL  U19 … uncounted blocks marked
  PASS  R1 R2 R3 R4 R5 R6 R7 R8 R9   (all 9 sentinels — correct: they must pass before AND after)
```

```
tag-detail: 19 passed, 9 failed        (the 9 are all Story-2 additions)
  FAIL  every row carries an assertions array
  FAIL  each assertion entry is EXACTLY {polarity, counted, event}
  FAIL  assertion.event carries EXACTLY the seven canonical NIP-01 keys
  FAIL  assertion.event emits the canonical fields in canonical order
  FAIL  each assertion is a kind-39999 event that names its row as the target
  FAIL  polarity is one of apply|dispute — never neutral, never raw
  FAIL  THE INVARIANT — counted blocks reconcile to the row's +N/-M
  FAIL  assertions are ordered applications-before-disputes
  FAIL  assertion order is stable across identical requests
  PASS  R — the documented envelope survives the additive change
```

### Three vacuous passes were caught and fixed while writing this — worth recording

Every one of them *reported PASS while asserting nothing*, which is strictly worse than no test. All three are now structurally prevented:

1. **`U17` matched a comment.** The word "neutral" already appears in prose at `index.js:965` ("the viewer has a non-neutral assertion"), so a bare `/neutral/` grep passed against the *unbuilt* feature. Fixed: assert the **quoted literal** `'neutral'` in **comment-stripped** source.
2. **`R3` was simply wrong** — it asserted `TagActionsMenu` contains no `setOpen(false)`, but `:32` legitimately calls it in the click-outside effect. Story 1's suite already sentinels stays-open *correctly* at `tag-actions-menu-ui.test.js:309` by excluding that region. Fixed: dropped the clause and deferred to the suite that owns it. Duplicating another suite's assertion badly is worse than deferring.
3. **Four `tag-detail` tests looped `row.assertions || []`** — an empty list today, so the loop body never ran and the assert never executed. Fixed with an `assertNonVacuous(rows)` helper that fails when the fixture yields zero assertions across all rows.

`U4` was also **reclassified to `R9`**: it asserts the raw button is *absent* from `renderActionsMarkup`, which is trivially true when nothing is built. It passes now, passes after a correct build, and fails only on a wrong one — that is a sentinel, not a `U` test, and labelling it `U` would have been a lie.
