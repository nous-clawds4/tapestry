# Review: search-index-selection #4 — a confirm step on first pin

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18
**Branch:** `feat/search-index-selection` · **HEAD:** `250a5f79`
**Round:** 3 (re-review of the round-2 CHANGES_REQUESTED; rounds 1–2 kept below as history)
**Fix under review:** `250a5f79` — "fix(ui): pass the context SLUG and NAME to the interstitial,
not the picker's object (review round 2 crash); S13 pins the shape"
**Story:** `engineering-team/stories/search-index-selection/4-confirm-step-on-first-pin.md`
(Approved; **Light** lane, **Design note**, no ADR — Gate A 2026-09-18)
**Test plan:** `engineering-team/test-plans/search-index-selection/4-confirm-step-on-first-pin.md`
**ADR:** none by design (Light lane); the story's Design note is the architecture of record.

---

## Round 3 — the fix commit

### The diff

Two files, 16 insertions / 8 deletions.

- `ui/src/pages/Tag.jsx:630-641` — the create-mode mount now derives both props from the picker's
  object: `context={pinDialog.context?.slug || null}`,
  `contextName={pinDialog.context?.name || pinDialog.context?.slug || null}`. The dead
  `KNOWN_CONTEXTS.find((c) => c.slug === pinDialog.context)` lookup (the round-2 crash, a
  string-vs-object comparison) is gone. `onSubmit` still hands `publishContextPin` the **object**,
  which is what `pinTag` wants (`ui/src/utils/publishTagPin.js:152` — `context.slug`). One shape
  end-to-end: object upstream of the mount, slug + name downstream into the presentational dialog.
  The comment above the mount states the two shapes explicitly, so the next reader can't repeat the
  copy-paste from `Tag.jsx:175` (`contextNameOf`, where `p.context` really is a slug string).
- `KNOWN_CONTEXTS` is still imported and still used (`Tag.jsx:175`, `:618`) — no unused import, and
  lint confirms.
- `test/confirm-step-on-first-pin.test.js:471-487` — S13 rewritten as a shape contract (see
  judgement below).

No other file changed; `CurationMethodDialog.jsx:220-227` (the fixed, non-editable `Community: …`
line, gated to `mode === 'create'`) is untouched from round 2, where its structure was already
judged correct.

### Quality gates (run by reviewer, not trusted)

Scoped gate per Gate A, Nix dev shell (`direnv exec .`, no system node),
`BRAINSTORM_BASE_URL=http://localhost:8778`, per-suite, capped at 180s. **Not** the full
`npm test` — the scope was capped by the invoking instruction, so no `npm run gate:status` run id
is quotable for this story; the full-gate verdict remains owed at book close.

| Suite | Result |
|---|---|
| `test/confirm-step-on-first-pin.test.js` (with the rewritten S13) | **27 passed, 0 failed, 0 skipped** — EXIT=0 |
| `test/generalized-tag-pinning.test.js` | 12 passed, 0 failed — EXIT=0 |
| `test/only-me-curation.test.js` | 35 passed, 0 failed, 0 skipped — EXIT=0 |
| `test/pin-stack-composition.test.js` | 20 passed, 0 failed, 0 skipped — EXIT=0 |
| `test/context-scoped-pins.test.js` | 32 passed, 0 failed — EXIT=0 |
| `test/per-pin-membership-method.test.js` | 31 passed, 0 failed, 0 skipped — EXIT=0 |

- **Lint** (`ui` eslint, the two touched files): `src/pages/Tag.jsx` **clean**;
  `src/components/CurationMethodDialog.jsx` reports the **same 3 pre-existing errors**
  (`178:21 no-unused-vars`, `266:12` / `425:12 no-constant-binary-expression`), proven pre-existing
  in round 1 against `fb689943^`. **Zero new lint errors.**
- **Build:** `direnv exec . npm --prefix ui run build` → `✓ built in 17.76s`, EXIT=0. The live
  checks below ran against **this** bundle (rebuilt before driving the browser).

### Live verification (headless Chromium against the panel, `:8778`)

Same harness as rounds 1–2: `page.route` stubs on `/api/auth/status` +
`/api/auth/user-classification`, a recording `window.nostr` (synthetic viewer `1111…1111`),
`window.WebSocket` neutered, `/api/strfry/publish` and `/api/trusted-list/refresh-pinned-tag`
intercepted. Tag `/tag/ai-agent/98e61331…`, a tag this viewer has not pinned. Nothing signed by a
real signer, nothing reached any relay. `pageerror` and console-error listeners attached: **zero
fired for the whole run.**

- **Neutral pin — PASS.** Create-mode dialog opens with the explanation line; `.pcd-create-context`
  count = **0**. No community line on the neutral path, as AC-5 requires by omission.
- **Community pin — PASS (round-2 crash is gone).** `📌 Pin to community…` → pick **LFO**: the
  picker closes (`.tsm-dialog` count 0), exactly one interstitial renders (`.pcd-create-line`
  count 1), **no error boundary**, page intact. The context line renders as
  `Community: LFO — this pin and its lists are scoped to this community`, HTML
  `<p class="pcd-create-context">Community: <strong>LFO</strong>…</p>` — the KNOWN_CONTEXTS
  **name**, not the slug, not `[object Object]`.
  - **Fixed, not editable:** `.pcd-create-context input|select|button` count = **0**.
  - **Above the fields:** the context line document-precedes `.pcd-body` → true.
  - **Nothing publishes before confirm:** intercept log `[]`, `window.__signed.length` 0.
  - **Confirm:** exactly one signed event, kind **39999**, with
    `d = tag-pin-ai-agent-a666f97a-11111111-in-lfo` (the `-in-lfo` discriminator),
    `z = 39998:<runtime TA>:tag-pinning` and `z = 39998:<runtime TA>:lfo` (the context stamp),
    and a `curation-method` blob equal to `defaultCurationMethod`. Ordering
    `PUBLISH → REFRESH_START → REFRESH_END` (the refresh is awaited), dialog closes after.

That is AC-5 end to end — routed through the same interstitial, context shown and fixed, wire shape
unchanged.

### Judgement — is S13 as a shape contract adequate?

**Adequate to unblock; a render-level handle should follow.**

What it now buys (`test/confirm-step-on-first-pin.test.js:471-487`): it asserts the *premise*
(`PinToContextModal` calls `onPick(c)` with the whole object), asserts the two prop expressions
resolve slug and name **from that object**, and — the part that matters — asserts the negative,
`!/context=\{pinDialog\.context\}/`, so the exact round-2 defect cannot come back green. That is a
real improvement over round 2's handle, which pinned the typo and passed while the page crashed.

What it still can't do: it is source-regex, so it is whitespace/refactor brittle (rename the state
field, or reformat the JSX across lines, and the assertions go vacuous or falsely red), and it
verifies nothing about *rendering* — a different object-as-React-child crash elsewhere in the
create-mode block would sail through. The only thing that caught round 2 was a human driving a
browser; nothing in the suite would have.

**Recommended follow-up (non-blocking, since the live check passes):** a render-level handle for
the community-pin interstitial — mount `CurationMethodDialog` in `mode="create"` with
`context="lfo" contextName="LFO"` and assert the rendered `.pcd-create-context` text, plus a
negative case asserting a render throw when an object is passed. The book already has DOM-capable
handles; this is small. Filed as non-blocking #5 below — the Tester's to write, and worth a row in
the story's follow-ups rather than a new blocking round.

### Findings — Round 3

#### Blocking

None. Both round-2 blockers are cleared: #1 by `Tag.jsx:636-637` (live-verified above), #2 by the
S13 rewrite (adequate as argued, with the render-level handle carried as a follow-up).

#### Non-blocking (carried)

1. `CurationMethodDialog.jsx` `advancedDetailsProps` still reshapes dead code to satisfy S6 —
   narrow S6 instead (Tester).
2. The test plan's AC-5 row (`test-plans/…/4-…md:75`) still drops the story's "with the chosen
   context shown and fixed" clause; the live behaviour now exists, but the plan row doesn't claim
   it. Amend when S13's render handle lands.
3. Full-gate verdict still owed at book close — no `gate:status` line exists for this story.

#### Non-blocking (new)

4. **`publishContextPin` never passes `localTaPubkey`** (`ui/src/pages/Tag.jsx:300-302`), so a
   context pin emits the canonical `tag-pinning` z and the context z but **not** the personal
   `39998:<localTA>:tag-pinning` stamp that the neutral path emits
   (`Tag.jsx:224`, `publishTagPin.js:168`). Verified live (2 z tags, not 3). **Pre-existing** —
   `git show b782a50d:ui/src/pages/Tag.jsx` has the same omission, it arrived with contextual-pins,
   and this story explicitly must not change the wire shape. Out of scope, but it is a real
   W11-parity gap on the context path; worth an `_intake` row.
5. S13 has no render-level counterpart — see the judgement section. Recommended, not required.

#### Harness friction (carried)

1. `engineering-team/roles/reviewer.md:22-24` still claims lint/typecheck/build are "not
   configured"; `ui/` has a working eslint and a required vite build. Worth an `OPEN.md` `meta` row.

### Concept-graph / house rules (re-checked on the fix)

- [x] No concept definition changed — **no firmware reinstall needed**.
- [x] No pubkey literal introduced. The runtime TA lookup drives the context stamp
      (`contextHandle(taPubkey, …)`); the ADR-0015 `LEGACY_*` constants are untouched and none were
      removed.
- [x] POV-first / filter-at-view-time: the change is presentational prop-shaping only; no
      denormalized trust state added.
- [x] No new dependency, no new lint/typecheck/build tooling.
- [x] No secrets, no debug logging, no commented-out code, no scope creep in `250a5f79`.

---

## Round 2 (2026-09-18, HEAD `48c2b910`) — history

**Verdict then: CHANGES_REQUESTED.** Gates: new suite 27/0/0; the five neighbours green; lint
unchanged (same 3 pre-existing); build green.

Blocking #1: `Tag.jsx:633-636` passed the picker's `{ slug, name }` **object** as the `context`
prop and ran `KNOWN_CONTEXTS.find((c) => c.slug === pinDialog.context)` against it, so the lookup
never matched, the `||` fallback yielded the object, and `CurationMethodDialog.jsx:223-226` rendered
it as a React child → **minified React error #31**, the whole Tag route replaced by the Router error
boundary, zero `pcd-` elements, no pin publishable. Live-reproduced. Root cause: the expression was
copy-pasted from `Tag.jsx:174-176` where `p.context` is a slug string. Asked change: derive
`context` from `.slug` and `contextName` from `.name || .slug`, keep `publishContextPin`/`pinTag`
on the object, one shape end-to-end.

Blocking #2: S13 was green against a crashing page — every assertion a regex over source text
(`/context=\{pinDialog\.context\}/` among them), so it pinned the typo rather than the behaviour.
Asked change: assert the shape contract, ideally add a render-level handle.

Non-blocking then: `advancedDetailsProps` dead-code reshape; the test plan's narrowed AC-5 row;
full-gate verdict owed. Noted as correct and not in dispute: the `Community: …` copy, its
non-editability, the `mode === 'create'` gate (edit mode untouched), and the two additive scoped
CSS rules.

## Round 1 (2026-09-18, HEAD `aff0b0bd`) — history

Gates then: new suite **26/0/0**; `generalized-tag-pinning` 12/0; `only-me-curation` 35/0/0;
`pin-stack-composition` 20/0/0; `context-scoped-pins` 32/0; `per-pin-membership-method` 31/0/0.
Lint: same 3 pre-existing `CurationMethodDialog.jsx` errors, proven pre-existing by linting
`fb689943^`'s copy. Build green.

Live: AC-1 (dialog opens, correct copy, collapsed explainer, default pre-fill, zero publishes),
AC-2 (one kind-39999 whose `curation-method` blob is byte-equal to `defaultCurationMethod`, both
copies agreeing, `PUBLISH → REFRESH_START → REFRESH_END`), AC-3 (Escape → zero publishes, zero
signs), AC-5 routing (picker closes, one dialog, `d = tag-pin-ai-agent-a666f97a-22222222-in-lfo`,
canonical `tag-pinning` z + `39998:<runtime TA>:lfo`), AC-7 (Pin button gone when pinned) all
verified. Not browser-verified: NIP-51 export ordering after the awaited refresh (source sentinel
R1 + read of `Tag.jsx:232-262`), E1 signer refusal (S12), ×/backdrop dismissal.

Spec adherence then: AC-1/2/3/4/6/7 and E1–E6 ✅; the Design note's blast radius, verbatim
extraction, no-new-dependency and awaited-refresh claims all verified; `publishTagPin.js`,
`TagPinAffordance.jsx`, `PinToContextModal.jsx`, `PinnedListPanel.jsx`, `src/` all 0-line diffs vs
`b782a50d`. `publishContextPin`'s new rethrow (Deviation 1) judged **correct** — without it a
failed context pin would close the interstitial as if it had succeeded.

Round-1 blocking finding (superseded by round 2, resolved in round 3): `Tag.jsx:627-638` +
`CurationMethodDialog.jsx` dropped AC-5's "with the chosen context shown and fixed" — the mount
never passed `pinDialog.context` and the community dialog was visually identical to the neutral one.

---

## Verdict
**PASS**
