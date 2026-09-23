# Review: search-index-selection #5 — an explicit pin variant key

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18 · **Round 2** (re-review after round 1's CHANGES_REQUESTED)
**Branch:** `feat/search-index-selection` · **HEAD:** `e54e99f9`
**Story:** `engineering-team/stories/search-index-selection/5-explicit-pin-variant-key.md`
(Light lane **with an ADR**, Gate A 2026-09-18 — last story of the epic)
**ADR:** `engineering-team/decisions/search-index-selection/0003-explicit-pin-variant-key.md`
**Test plan:** `engineering-team/test-plans/search-index-selection/5-explicit-pin-variant-key.md`

Round 1 is preserved verbatim below under "## Round 1 (history)". This section covers only the
fix commit and the re-verification; every round-1 finding not repeated here stands as recorded
there and was re-confirmed unchanged.

---

## Round 2 — the fix under review

**Diff:** `e54e99f9` — 5 files, +53/−1 (`ui/src/pages/Tag.jsx`,
`ui/src/components/CurationMethodDialog.jsx`, `ui/src/styles.css`,
`test/explicit-pin-variant-key.test.js`, `OPEN.md`). Working tree otherwise clean apart from the
three untracked files unrelated to this story (`.envrc`, two `docs/SHARED_CONCEPTS_*.md`).

The shape: the Pinned tab renders a `＋ New curation` chip whenever `hasAnyPin && user`
(`Tag.jsx:660-669`, above `PinnedListPanel`), opening the *same* create dialog with
`{ open: true, context: null, variantOnly: true }`; the mount forwards
`requireVariant={!!pinDialog.variantOnly}` (`Tag.jsx:722`); `CurationMethodDialog.jsx:158-161`
refuses to submit in that mode without a name. Nothing on the wire changed — the fix is purely
an entry point plus a guard, exactly the scope round 1 said was needed.

### Quality gates (run by reviewer, not trusted)

Scoped gate per Gate A, Nix dev shell (`direnv exec .`, no system node),
`BRAINSTORM_BASE_URL=http://localhost:8778`, per-suite, capped at 180s. **Not** the full
`npm test` — the scope was capped by the invoking instruction, so no `npm run gate:status` run
id is quotable for this story; the full-gate verdict remains owed at book close.

| Suite | Result | vs round 1 |
|---|---|---|
| `test/explicit-pin-variant-key.test.js` | **51 passed, 0 failed, 0 skipped** — EXIT=0 | +1 (S22) |
| `test/pin-stack-composition.test.js` | 20 passed, 0 failed — EXIT=0 | unchanged |
| `test/context-scoped-pins.test.js` | 32 passed, 0 failed — EXIT=0 | unchanged |
| `test/only-me-curation.test.js` | 35 passed, 0 failed — EXIT=0 | unchanged |
| `test/per-pin-membership-method.test.js` | 31 passed, 0 failed — EXIT=0 | unchanged |
| `test/confirm-step-on-first-pin.test.js` | 27 passed, 0 failed — EXIT=0 | unchanged |
| `test/item-trusted-list.test.js` | 51 passed, 0 failed — EXIT=0 | unchanged |
| `test/note-trusted-list.test.js` | 15 passed, 0 failed — EXIT=0 | unchanged |
| `test/generalized-tag-pinning.test.js` | 12 passed, 0 failed — EXIT=0 | unchanged |

- **Lint** (`ui` eslint, the two files this commit touches): `Tag.jsx` **clean**;
  `CurationMethodDialog.jsx` 3 errors at `216:21 no-unused-vars`, `326:12` / `485:12
  no-constant-binary-expression` — the same three round 1 proved pre-existing, shifted exactly
  +8 lines by the +8 lines this commit adds above them (208→216, 318→326, 477→485). **Zero new
  lint findings.**
- **Build:** `direnv exec . npm --prefix ui run build` → `✓ built in 15.88s`, EXIT=0. Every live
  check below ran against *this* bundle.

### Live re-verification (headless Chromium, `:8778`, rebuilt bundle)

Same house harness as round 1: `page.route` stubs on `/api/auth/status` +
`/api/auth/user-classification`, `/api/profile-tags/by-id` patched to inject `viewerPins`, a
recording `window.nostr` (synthetic viewer `1111…1111`), `window.WebSocket` neutered,
`/api/strfry/publish` and `/api/trusted-list/refresh-pinned-tag` intercepted. Nothing was signed
by a real signer; nothing reached a relay. Tag `/tag/ai-agent/98e61331…`. Zero `pageerror`s in
every run (the only console errors are the two unrelated 401s from the stubbed auth surface).

**The case round 1 blocked on — viewer holds a NEUTRAL pin:**

| Check | Result |
|---|---|
| Pinned tab shows the door | **PASS** — exactly one `.bs-pin-switcher-new`, text `＋ New curation` |
| Click opens the create dialog with the name field | **PASS** — `.pcd-variant` label `Save as a separate curation (optional)`; `.pcd-create-context` count 0 (no community line) |
| Confirm with the name **empty** is refused | **PASS** — inline `Name this curation — a second personal pin would replace the one you already have.` |
| …and nothing is signed / nothing published | **PASS** — `window.__signed.length === 0`, zero `PUBLISH` / `REFRESH` interceptions |
| Valid name → correct recipe address | **PASS** — one kind-39999, `d = tag-pin-ai-agent-a666f97a-11111111-v-my-search-index`, `['variant','my-search-index']`, **no context `z`** (only the `tag-pinning` pair) |
| The neutral pin is **not** re-signed | **PASS** — `window.__signed.length === 1`; the only event is the `-v-` one |
| Switcher shows both under the divider | **PASS** — `📌 Personal` (aria-selected=true) → `<span class="bs-pin-switcher-divider">Your curations</span>` → `🧪 search-index` |

**Regression paths re-checked:**

| Path | Result |
|---|---|
| **No pins** | **PASS** — no `＋ New curation` door (count 0, correct: `hasAnyPin` false); `📌 Pin` opens the dialog; signed neutral pin `d = tag-pin-ai-agent-a666f97a-11111111`, no `variant` tag. The name field is **absent** here (`.pcd-variant` count 0) — see "Brief vs ADR" below. |
| **LFO pin only** | **PASS** — `📌 Pin` visible, dialog carries the name field, a valid name signs `d = …-v-strict-list` with `['variant','strict-list']` and no context `z`. Unchanged from round 1. |

### Round-1 findings — disposition

- **Blocking 1 (creation unreachable from a neutral pin) — CLOSED.** Live-verified above on the
  rebuilt bundle, in the exact state that failed in round 1. The `variantOnly` guard also closes
  the hazard the new door would otherwise have opened: this second entrance can never publish a
  second neutral pin at the viewer's existing address, because an empty name is refused before
  anything is signed (verified: zero signatures, zero publishes).
- **Blocking 2 (no handle pinned the reachability contract) — CLOSED, with a follow-up.** S22
  (`test/explicit-pin-variant-key.test.js:910-927`) is a source-level assertion, not the
  render-level assertion I asked for. I judge it **adequate here** on three grounds: (a) it pins
  all four load-bearing links of the chain — the `hasAnyPin && user` gate, the `variantOnly: true`
  setter, the `requireVariant` forward, and the dialog's empty-name refusal *plus* its stomp
  wording — so a regression that removes any one of them fails the suite; (b) it asserts the
  premise it exists to guard (`TagPinAffordance` is gated on `viewerPin`), so the test carries its
  own rationale; (c) the behaviour itself is verified live in this review against the shipped
  bundle. It is *not* immune to the class of defect that bit round 1 — a button rendered inside a
  branch that never evaluates would still satisfy the regex — so I am recording a render-level
  follow-up (Non-blocking 6) rather than treating the source regex as the final word. This is the
  epic's last story; a new blocking round to convert one regex into a render harness is not
  proportionate when the behaviour is live-verified.
- **Non-blocking 1–5 — still acceptable, unchanged.** Re-checked: R1's self-referential compare
  (now against `e54e99f9`, still a working-tree-vs-HEAD consistency check — the substantive claim
  stays verified from history: `git show --stat 1498cf5f` touches no `test/` file); the pre-pass
  double `lookupTag`; the unbounded `warnedAuthorObserverMismatch` Set; the dropped
  `variant.name`; the wide `existingVariants`. None is a ship blocker.

### Spec adherence — the two partial ACs

| AC | Round 1 | Round 2 |
|---|---|---|
| **AC-1** a non-community variant coexists, own address, no context `z` | Partly (UI path unreachable) | **PASS** — the wire half was already right; the creation path is now reachable from the primary state and live-verified end to end |
| **AC-6** minimum switcher UX, recipes distinct, "Personal" first | Partly | **PASS** — recipes can now be *created* from the state the switcher displays them in; three-band ordering re-verified live |

AC-2/AC-3/AC-4/AC-5 were PASS in round 1 and are untouched by this commit; their owning suites
(`pin-stack-composition` 20/20, `context-scoped-pins` 32/32) are green unmodified, and the live
neutral-pin byte shape is identical to round 1's.

### ADR adherence (delta only)

- **§5** — "offered only when the viewer already holds a pin of this tag" is now *satisfiable*:
  the gate is `hasAnyPin && user`, the same predicate as `offerVariant`, so the door and the field
  can never disagree. Creation still lives in the curation dialog, never in the community picker
  (`PinToContextModal.jsx` still untouched). The `variantOnly` mode is an addition to §5's
  mechanism, not a departure from it — §5's rule was "when, and where"; this adds "and here is the
  second way in, hardened so it cannot be misused".
- **§1–§4, §8** — untouched by `e54e99f9` (no composer, wire, runner, reader or firmware change in
  the diff). Round 1's verdicts stand.
- No new deviation is introduced or needed.

### Concept-graph integrity

No new handle, no new `z`, no firmware change in this commit — the composed handles in the live
signed events are byte-identical to round 1's. No TA-pubkey literal on any added line (S21 green,
and the diff adds no hex). Firmware reinstall was performed and verified live in round 1 and needs
no repeat.

### Things tests can't catch

- No secrets, no debug logging, no commented-out code in the diff. The CSS is three scoped rules
  in the existing pin-switcher block.
- `requireVariant` is read inside `handleSubmit` before `showVariantField`'s `const` line (184) in
  source order, but `handleSubmit` is only ever *called* after render, so there is no TDZ hazard —
  and the guard is inert unless `showVariantField` is true, which is the correct conservative
  order (a community-context dialog can never trip it).
- `onCancel` now resets `variantOnly: false` alongside `context: null`, so a cancelled
  variant-only dialog cannot leak its mode into the next open. Verified in the diff
  (`Tag.jsx:729`).
- Race: the door sets `pinError` to null and opens the dialog synchronously; no async gap where a
  stale error could mislead.

### House rules

- No new lint/typecheck/build tooling. Concept Graph API authority respected. No hardcoded TA
  pubkey.

### Brief vs ADR (recorded, not a defect)

The re-review brief again asked me to confirm the no-pin path shows the name field "present,
optional". It is **absent** there — `offerVariant={!pinDialog.context && hasAnyPin}`, and ADR §5
gates the field on the viewer already holding a pin, so a first-ever pin correctly offers no
recipe field. I follow the ADR. This is the same brief-vs-ADR friction round 1 flagged; OPEN 313
(added in `e54e99f9`) records it, which is the right disposition.

### Findings (round 2)

**Blocking:** none.

**Non-blocking (new):**

6. **Follow-up: convert S22 to a render-level assertion.** `test/explicit-pin-variant-key.test.js:910`
   pins the reachability contract by regex over `Tag.jsx` / `CurationMethodDialog.jsx`. It would
   still pass if the door were moved inside a branch that never evaluates. The durable form is a
   render of the Pinned tab with `viewerPins = [neutral]` asserting a reachable path to the create
   dialog. Worth an OPEN row at book close if no render harness lands first.
7. **`ui/src/components/CurationMethodDialog.jsx:267-283` — the field label still reads
   "Save as a separate curation (optional)" in variant-only mode**, where it is mandatory. The
   refusal message is clear and arrives before anything is signed, so this is cosmetic, not a
   correctness issue; a `requireVariant`-aware label would be a one-line improvement.
8. **`ui/src/pages/Tag.jsx:660` — the door's gate is `hasAnyPin && user` while the field's is
   `!pinDialog.context && hasAnyPin`.** They agree today because the door always passes
   `context: null`. If a future caller opens the dialog with a context *and* `variantOnly`, the
   requirement would silently go inert (`showVariantField` false ⇒ the guard is skipped). Cheap
   hardening: assert `!context` when `requireVariant` in the dialog, or derive `requireVariant`
   from `variantOnly && !context` at the mount.

---

## Round 1 (history)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18
**Branch:** `feat/search-index-selection` · **HEAD:** `b78dac5a`
**Diff under review:** `1498cf5f` (implementation, 16 files, +670/−106) and `b78dac5a`
(Phase-3 sentinel re-aims, 2 files, +16/−5). Working tree clean apart from three untracked
files unrelated to this story (`.envrc`, two `docs/SHARED_CONCEPTS_*.md`).
**Story:** `engineering-team/stories/search-index-selection/5-explicit-pin-variant-key.md`
(Approved; **Light** lane **with an ADR**, Gate A 2026-09-18 — last story of the epic)
**ADR:** `engineering-team/decisions/search-index-selection/0003-explicit-pin-variant-key.md`
(Accepted, J1 five rounds; §4 readers table is the exhaustive checklist)
**Test plan:** `engineering-team/test-plans/search-index-selection/5-explicit-pin-variant-key.md`

---

### Quality gates (run by reviewer, not trusted)

Scoped gate per Gate A, Nix dev shell (`direnv exec .`, no system node),
`BRAINSTORM_BASE_URL=http://localhost:8778`, per-suite, capped at 180s. **Not** the full
`npm test` — the scope was capped by the invoking instruction, so no `npm run gate:status`
run id is quotable for this story; the full-gate verdict remains owed at book close.

| Suite | Result |
|---|---|
| `test/explicit-pin-variant-key.test.js` (this story's suite) | **50 passed, 0 failed, 0 skipped** — EXIT=0 |
| `test/pin-stack-composition.test.js` (guard; AC-2 owner) | 20 passed, 0 failed — EXIT=0 |
| `test/context-scoped-pins.test.js` (guard; AC-2 owner) | 32 passed, 0 failed — EXIT=0 |
| `test/only-me-curation.test.js` (guard) | 35 passed, 0 failed — EXIT=0 |
| `test/per-pin-membership-method.test.js` (guard) | 31 passed, 0 failed — EXIT=0 |
| `test/confirm-step-on-first-pin.test.js` (story 4, same surface) | 27 passed, 0 failed — EXIT=0 |
| `test/item-trusted-list.test.js` | 51 passed, 0 failed — EXIT=0 |
| `test/note-trusted-list.test.js` | 15 passed, 0 failed — EXIT=0 |
| `test/generalized-tag-pinning.test.js` | 12 passed, 0 failed — EXIT=0 |
| `test/trusted-list-raw-view.test.js` | 25 passed, 0 failed — EXIT=0 |
| `test/tag-a-list-header.test.js` | 28 passed, 0 failed — EXIT=0 |

- **Lint** (`ui` eslint, the eight touched UI files): 3 errors + 1 warning, all in
  `CurationMethodDialog.jsx` (`208:21 no-unused-vars`, `318:12` / `477:12
  no-constant-binary-expression`) and `usePinnedNotes.js` (`110:6 exhaustive-deps` warning).
  Proven **pre-existing**: linting `git show 1498cf5f^:` copies of the same two files
  reproduces the identical 3 errors + 1 warning (at the pre-diff line numbers 178/266/425 and
  104). **Zero new lint findings.**
- **Build:** `direnv exec . npm --prefix ui run build` → `✓ built in 15.88s`, EXIT=0. All live
  checks below ran against *this* bundle.
- **Firmware:** reinstall confirmed live — `GET /api/concept-graph/node/39998:<TA>:tag-pinning`
  returns the new "A user may hold SEVERAL coexisting pins of one tag…" sentence, so the graph
  copy matches `firmware/versions/v1.0.0/concepts/tag-pinning/concept-header.json`.

### Live verification (headless Chromium against the panel, `:8778`)

House harness: `page.route` stubs on `/api/auth/status` + `/api/auth/user-classification`,
`/api/profile-tags/by-id` patched to inject `viewerPins`, a recording `window.nostr` (synthetic
viewer `1111…1111`), `window.WebSocket` neutered, `/api/strfry/publish` and
`/api/trusted-list/refresh-pinned-tag` intercepted. Nothing was signed by a real signer and
nothing reached a relay. Tag `/tag/ai-agent/98e61331…`. Zero `pageerror`s across every run (the
only console errors were two unrelated 401s from the stubbed auth surface).

| Check | Result |
|---|---|
| Recipe create: live slug preview | **PASS** — typing `Search Index!!` renders `…their own permanent address: -v-search-index` |
| Known-community refusal (`LFO`) | **PASS** — inline `"lfo" names a community…`, `window.__signed.length === 0` |
| In-use refusal (`Search index` vs an existing `search-index`) | **PASS** — inline `You already have a curation named "search-index"…`, nothing signed |
| Valid name → confirm | **PASS** — one kind-39999 with `d = tag-pin-ai-agent-a666f97a-11111111-v-my-search-index`, `['variant','my-search-index']`, **no** context `z` (only the `tag-pinning` `z` pair) |
| Neutral pin unchanged | **PASS** — `d = tag-pin-ai-agent-a666f97a-11111111`, no `variant` tag |
| Community pin unchanged | **PASS** — `d = …-in-lfo`, `z = 39998:<runtime TA>:lfo`, **no** `variant` tag; the create dialog shows **0** variant fields on the community path |
| Switcher three bands | **PASS** — `📌 Personal` (aria-selected=true) → `📌 LFO` → `<span class="bs-pin-switcher-divider">Your curations</span>` → `🧪 recipes` → `🧪 search-index`, from a deliberately shuffled `viewerPins` order |
| Community picker never lists recipes | **PASS** — picker renders only `LFO` and `Tapestry & Web of Trust` |
| Recipe curation edit (Deviation 2) | **PASS** — the panel scans the recipe's own `tl-pin-11111111-a666f97a-ai-agent-v-search-index`; "Save changes" re-signs `d = tag-pin-…-v-search-index` **with** `['variant','search-index']` and routes the refresh to `POST /api/trusted-list/refresh-pinned-tag` — never neutral |
| **Recipe creation reachable from an ordinary (neutral) pin** | **FAIL** — see Blocking #1 |

Server side is covered behaviourally by the green suite rather than by a re-run of my own: H1–H3
(recipe `-v-` addresses on 30392/30393/30394 with the `variant` disclosure and no context `z`),
H5/H6 (author ≠ observer ⇒ `{status:'skipped', errorReason:'author-observer-mismatch'}` in all
three runners, nothing published), H7 (`retractStaleTLs` retracts the skipped stranger's earlier
list, leaves the owner's on-roster list untouched), H8 (own-pin collision ⇒ both `collision`,
`d` kept on the roster, `pin-variant-collision` logged, nothing published), R2 (`-v-` suffixed
lists survive the prefix sweep). I read each of those assertions; they are real injected-deps
runs, not source regexes.

### Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1** a non-community variant coexists, own addresses, no context `z` | **Partly** — wire half fully correct (U2, U8, H1–H3, A1 + live signed event); the UI creation path is unreachable in the primary case (Blocking #1) |
| **AC-2** contextual/neutral byte-identity across all five schemes | **PASS** — U1/U9/H4/R5 plus the AC-2 owners `pin-stack-composition` (20/20) and `context-scoped-pins` (32/32) green unmodified; live neutral + community events byte-shape unchanged |
| **AC-3** variant uniqueness per (observer, tag), refused pre-signature | **PASS** — U10, S17, H8; live refusals for community slug and in-use slug with nothing signed |
| **AC-4** canonical `slug()`, ≤40, empty refused, name display-only | **PASS** — `pins.js:VARIANT_SLUG_MAX=40`, `validateVariantSlug` reuses `canonicalSlug`; U4/U10 |
| **AC-5** every derived-`d` reader keys off the stored variant | **PASS** — all §4 rows landed: S1–S6, S8–S11; `enrichRowsWithTLStatus` now delegates to `tlDTag` (`src/api/profile-tags/index.js:1726-1735`), `enrichRowsWithItemTLStatus` takes `row.variant` (`:1812-1819`), `trustedList/index.js:409-419` composes via `variantOfPin` + `tlDTag`, `useTagMemberSets` delegates to `tlDTag` (**OPEN 298's call site is genuinely fixed**), `usePinnedNotes` takes the full variant, `Tag.jsx:165` uses `(p.variant?.kind ?? null) === null` (not `!p.variant`) |
| **AC-6** minimum switcher UX, recipes distinct, "Personal" first | **Partly** — the switcher itself is exactly as ruled (live-verified three bands + divider + glyph); but with no reachable creation path the affordance can only ever display recipes made from a context-pin-only state (Blocking #1) |

E1–E6 all have handles and pass; E5's export path is fixed end to end (`publishTagPin.js:414-419`
plus the `ExportModal.jsx` forward, Deviation 1).

### ADR adherence

- **§1** — one composer; `pinVariantKey({contextSlug, variantSlug})` with the variant winning
  (`src/lib/event-tagging/pins.js:47-51`); `variantOfPin` + `variantKeyArgs` exported and used at
  every call site — no call site re-writes the ternary. `contextSlugOfPin` unchanged (R3).
- **§2** — `['variant', slug]` on the pin only for a recipe, and `pinTag` throws on
  `context && variant` (`ui/src/utils/publishTagPin.js:158-161`). Lists disclose via
  `variantDisclosureTags` (recipes only), placed before the `z` block.
- **§3** — C3 lands in all three runners immediately after the observer bail
  (`refreshPinnedTags.js:316-318`, `:592-594`, `:718-720`), returns the house `errorReason`
  shape, and logs once per pin id (`warnedAuthorObserverMismatch`). The pre-pass grouping in
  `refreshAllPinnedTags` (`:875-891`) skips both claimants, keeps all three `d`s on the roster
  and logs `pin-variant-collision`; deps are injectable and forwarded verbatim to the runners
  **and** to all three `retractStaleTLs` calls (which already accepted `options.deps`).
- **§4** — every row of the readers table is accounted for; `Tag.jsx:142` `pinnedContextSlugs`
  is byte-identical (S15), `PinToContextModal.jsx` and `curationDialogBuild.js` are untouched
  (S19; confirmed absent from the diff stat).
- **§5** — divider + 🧪 glyph + three-band ordering + one new `.bs-pin-switcher-divider` CSS rule
  in the existing block. Creation is in the curation dialog, never the community picker.
- **§8** — schema `variant` property + concept-header sentence + reinstall confirmed.
- **Deviations** — both logged deviations are justified and in the ADR's spirit: the ExportModal
  2-line forward makes ADR §4's `publishTagPin.js:396` row do anything, and the
  `handleEditSubmit` recipe threading closes exactly the stomp hazard the story exists to
  prevent (live-verified above). The three Phase-3 sentinel re-aims (`b78dac5a`) are minimal,
  preserve each sentinel's real rule, and document why.

### Concept-graph integrity

- Handles stay `kind:pubkey:slug`; the context `z` still composes from the runtime TA
  (`contextHandle(taPubkey, …)`), and the only literal TA is the pre-existing ADR-0015
  `LEGACY_TA_PUBKEY` on the `tag-pinning` handle — **no new literal** anywhere in the diff
  (verified: no 64-hex literal on any added line; S21 green).
- Firmware reinstall performed and verified live (above).

### Things tests can't catch

- No secrets, no leftover `console.log`, no commented-out code. The two new `console.warn` /
  `console.error` calls are the ADR-mandated C3 / collision logs.
- Error paths: `validateVariantSlug` is pure and total; `pinClaimedAddresses` returns `null`
  (never throws) for every class of pin that claims no address.
- Concurrency: the pre-pass and the publish loop both iterate the same deduped snapshot; the
  collision set is computed before any publish, so no partial-publish window.
- Security: the variant slug is canonical-slugified before it reaches an address or a wire tag,
  so `[a-z0-9-]` only; C3 narrows, never widens, who can publish at an observer's address.
  Write-time gating is exactly the operator-ruled C3 and nothing more; POV cascade untouched.

### House rules

- Concept Graph API authority respected; no new lint/typecheck/build tooling.
- No hardcoded TA pubkey (above).

### Findings

### Blocking

1. **`ui/src/pages/Tag.jsx:704` × `ui/src/components/TagPinAffordance.jsx:26-33` — the recipe
   creation surface is unreachable for a viewer who holds an ordinary pin, which is the story's
   primary case.** The only mount that can show the "Save as a separate curation" field is the
   create-mode dialog, opened solely by `handlePin` (`Tag.jsx:299-302`, the only setter of
   `pinDialog` with `context: null`). `TagPinAffordance` calls `onPin()` **only when
   `viewerPin` is falsy** (`TagPinAffordance.jsx:26-33`: once pinned, the button switches tabs).
   But the field is gated on `offerVariant={!pinDialog.context && hasAnyPin}` — it needs the
   viewer to already hold ≥1 pin. The two conditions intersect **only** when the viewer holds a
   context or recipe pin *and no neutral pin*. Live-verified on the rebuilt bundle:
   - viewer with **no pins** → `📌 Pin` opens the dialog, `.pcd-variant` count = **0**;
   - viewer with a **neutral pin** (the state after pinning once — the normal state) → buttons
     are `← Back to Tag` / `📌 Pin to community…`; **the create dialog cannot be opened at all**;
   - viewer with an **LFO pin only** → field appears and the whole flow works.

   So "I already pin this tag; now I want a separate, strictly-curated list beside it" — the
   story's user-facing description ("beside my ordinary lists") and the book's day-one need — has
   no path through the UI. Gate A ruling 3 and ADR §5 chose the option where AC-1 *is* verifiable
   through the UI; open question 6's rejected alternative ("no switcher entry at all … then AC-1
   is not verifiable through the UI") is effectively what shipped for the common case.
   **Asked change:** give the already-pinned viewer a way to open the create-mode dialog for a
   recipe (e.g. a "New curation…" affordance beside `📌 Pin to community…`, or a second entry on
   the Pinned tab), and add a handle that fails when that path is unreachable — not a source
   regex on `offerVariant`, but an assertion driven from the `viewerPin`-present state. If the
   operator would rather defer the entry point, that is an ADR §5 amendment plus an explicit
   story-scope narrowing (AC-1/AC-6 "protocol only, creation deferred"), not a silent gap.

   *Note:* the protocol half of the story is complete and correct — this blocker is confined to
   the creation entry point. Nothing on the wire needs to change to fix it.

2. **Test gap that let #1 through: no handle exercises the create surface in the state ADR §5
   describes.** `test/explicit-pin-variant-key.test.js:865` (S17) and `:879` (S18) are
   source-regex checks on `CurationMethodDialog.jsx` / `Tag.jsx`; S13/S14 likewise. Nothing
   asserts that the dialog is *openable* for a viewer who already holds a pin — the exact
   precondition ADR §5 states. Same class as the round-2 finding on story 4 ("the only thing that
   caught it was a human driving a browser"). **Asked change:** a handle that pins the
   reachability contract (render `TagPinAffordance` with `viewerPin` set and assert a path to
   `onPin`, or assert the affordance exposes a recipe entry), added with the fix for #1.

### Non-blocking

1. **`test/explicit-pin-variant-key.test.js:925` (R1) is now self-referential.** It byte-compares
   the four guard suites against `git show HEAD:`, and HEAD (`b78dac5a`) *is* the re-aim commit,
   so the assertion is trivially true and no longer proves "Phase 4 did not edit a guard suite".
   I ratify it as a working-tree-vs-HEAD consistency check and verified the substantive claim
   independently from history: `git show --stat 1498cf5f` touches no `test/` file at all, and the
   re-aims live in their own Phase-3 commit. Optional improvement: anchor the comparison to the
   pre-story ref (`3b3ef1e7`) or drop it in favour of the history check.
2. **`src/api/trustedList/refreshPinnedTags.js:829-848` — the pre-pass re-runs `lookupTag` for
   every pin**, doubling tag lookups on the cron path (once in `pinClaimedAddresses`, once in
   `runOnePin`). Fine at today's volumes; a memo keyed on `tagEventId` would remove it.
3. **`refreshPinnedTags.js:159` — `warnedAuthorObserverMismatch` is an unbounded module-level
   `Set`** in a long-running process. Bounded in practice by the number of distinct offending pin
   ids ever seen, but it never evicts.
4. **`ui/src/utils/publishTagPin.js:158-190` — a recipe's human-readable `variant.name` is
   accepted and then dropped**; only the slug reaches the wire, so the switcher labels recipes by
   slug (`🧪 search-index`). Consistent with AC-4 ("the stored variant is the slug, any name is
   display-only"), but the name is not stored anywhere, so it is display-only *and* unavailable.
   Worth an explicit line in the follow-ups if a friendlier label is wanted later.
5. **`ui/src/pages/Tag.jsx:202` (`existingVariants`)** includes the neutral pin as
   `{kind:null, slug:null}`. Harmless — `validateVariantSlug` skips null slugs — but it makes the
   list's contract ("the viewer's other pins") slightly wider than it reads.

### Harness friction

1. The review brief asked me to verify the recipe name field "on an unpinned tag", which
   contradicts ADR §5 ("offered only when the viewer already holds a pin of this tag"). Following
   the ADR rather than the brief is what surfaced Blocking #1 — but the contradiction is worth a
   `meta` row: a review brief that restates an ADR precondition inaccurately can mask exactly this
   class of defect.


**Round 1 verdict:** CHANGES_REQUESTED (both blockers closed in round 2 above).

---

## Verdict

**PASS**

The story is complete: the wire half was correct in round 1, and `e54e99f9` makes the recipe
creation path reachable from the state the story exists to serve, hardened so the new door can
never stomp the viewer's existing neutral pin. Gates green (51/0 on this story's suite, eight
guard suites unchanged), zero new lint findings, live-verified against a freshly built bundle.
Three non-blocking follow-ups (6–8) are recorded for book close.
