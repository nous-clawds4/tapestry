# Test Plan: search-index-selection #4 — a confirm step on first pin

**Story:** `engineering-team/stories/search-index-selection/4-confirm-step-on-first-pin.md` (Approved; Light lane, Gate A 2026-09-18 "approved as proposed")
**ADR:** none — Light lane, **Design note** in the story ("Design note (Light — after Gate A)"). Gate A ruled the story reorders *when* the same pin event and the same curation blob publish, so no irreversibility trigger fires.
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) — the "place vs recipe" warning at `:221-224` is binding on story 5 and bears here (this story must not become a variant-naming surface).
**Date:** 2026-09-18
**Suite:** `test/confirm-step-on-first-pin.test.js` (new; registered in `test/registry.js` beside `per-pin-membership-method.test.js`)

## Scoped gate (Gate A)

```
test/confirm-step-on-first-pin.test.js   (new — this story's suite)
test/generalized-tag-pinning.test.js
test/only-me-curation.test.js
test/pin-stack-composition.test.js
test/context-scoped-pins.test.js
```

**Guard-suite carve-out.** Phase 4 must not edit any of the four guard suites. In particular
`pin-stack-composition` AC-4 holds the *literal whole-event* fixtures for a neutral pin's
30392/30393 — those, not this plan, are the whole-event byte-identity owner. This suite owns
the **blob** identity (the `curation-method` JSON), which is the only thing this story could
plausibly change.

## Test classes

| Class | What it drives | Level |
|---|---|---|
| **U** | the curation blob as pure logic: `defaultCurationMethod` (`ui/src/utils/publishTagPin.js`, loaded via the ESM-rewrite trick) and the new pure build module the dialog must delegate to | unit, relay-free |
| **S** | source sentinels: the interstitial is wired in `Tag.jsx`, the create-mode copy exists and is mode-gated, the untouched surfaces are byte-compared against `git show HEAD` | structure |
| **R** | regression sentinels on the deliberately untouched behaviour — green **before and after** | structure |

**Stack-free.** No strfry, no neo4j, no control panel: there is no server seam in this story.
No graph-state prerequisites; no suite is skipped for a missing stack.

## The testability contract this plan introduces

React JSX does not import in node, so the dialog's submit build — today inline at
`ui/src/components/CurationMethodDialog.jsx:120-153` — cannot be exercised where it lives.
AC-2's sentinel is the whole point of the story's Light classification, so the build rule must
become reachable. The Implementer extracts it, **behaviour-preserving**, into:

```
ui/src/utils/curationDialogBuild.js          (new, pure ESM — no JSX, no React, no vite-only specifiers)

  export function normalizeCutoff(raw)                  // '1' -> { ok:true, value:1 }  |  { ok:false, error }
  export function normalizeObserver(raw, viewerPubkey)  // ''  -> { ok:true, value:viewerPubkey }
  export function buildCuration(state)

  state = { observer, viewerPubkey, cutoff, includeScoreInTL, method,
            includeProfiles, includeNotes, includeItems, noteMethod,
            authorConstraint, rawAuthorConstraint, authorConstraintTouched }

  returns { ok: true, curation }                 on success
          { ok: false, fieldErrors: {...} }      on validation failure (nothing may be signed)
```

`CurationMethodDialog.jsx` keeps its `useState` wiring and calls `buildCuration(state)` in
`handleSubmit`, rendering `fieldErrors` exactly as it does today. `normalizeCutoff` /
`normalizeObserver` **move** (or are re-exported); they must not be duplicated in the JSX (S8).

`defaultCurationMethod` is the **wire contract** and is not touched — S9 byte-compares the
function text against `git show HEAD:ui/src/utils/publishTagPin.js`. Where the untouched
build and the default disagree, the Implementer aligns the dialog's **seeding**, never the
default (story design note).

## Coverage map — acceptance criteria

| Criterion | Handle | What it pins | Level |
|---|---|---|---|
| **AC-1** the first pin opens an interstitial, nothing published first | S1, S3 | `handlePin` no longer calls `publishWithCuration(defaultCurationMethod(…))` but opens dialog state; exactly ONE `<CurationMethodDialog mode="create" initialCuration={defaultCurationMethod(…)} viewerPubkey={…}>` in `Tag.jsx` | structure |
| **AC-2** confirming untouched is byte-identical to today | **U3** (the sentinel), U1, U2, U4, S9, R1 | an untouched submit deep-equals `defaultCurationMethod(pk)` (order-insensitive); the default keeps exactly `{observer, method, cutoff, includeScoreInTL, targetTypes, noteMethod}` with today's values and no `authorConstraint`/`membershipMethod`; the function text is byte-identical to HEAD; the refresh is still awaited before both exports | unit + structure |
| **AC-3** cancelling publishes nothing | S5, U10 | `onCancel` closes the dialog state and contains no `pinTag` / `publishWithCuration` / `publishContextPin` / `fetch`; a build that fails validation yields no curation at all | structure + unit |
| **AC-4** edits land in the first pin, in one publish | S4, U5 | `onSubmit` routes to `publishWithCuration` or the factored-out `publishContextPin`; no call site still publishes the defaults directly (no publish-then-amend) | structure + unit |
| **AC-5** "Pin to community" goes through the same interstitial | S2, S4, S10, R4 | `handlePinToContext` no longer calls `pinTag` inline, carries the chosen context into the same dialog, and shares one publish; `PinToContextModal.jsx` unchanged vs HEAD | structure |
| **AC-6** existing pins untouched | R2, R3, S7, U6, U7 | the `PinnedListPanel` mount stays `mode="edit"` with its Unpin and its `curationMethod` seeding; `Save changes` / `Pin with these settings` / both titles survive; the create-mode copy is mode-gated; the `['profile','note']` fallback survives; an untouched trust-scope control re-emits the raw value and emits nothing when the pin carried nothing | structure + unit |
| **AC-7** a returning viewer sees no interstitial | S10 | `TagPinAffordance.jsx` byte-identical to HEAD — the pinned-state branch still renders the Pinned/Back toggle and never calls `onPin`, so the dialog is bound to *publishing a new pin* | structure |

## Coverage map — edge cases

| Edge case | Handle | How it is covered |
|---|---|---|
| **E1** signer refusal mid-flow | S12 | the dialog still `await`s `onSubmit`, still lands a rejection in `setError`, and closes only on success — so the dialog stays open with the user's edits and nothing was published |
| **E1b** refusal on the *second* prompt | R1 | the export calls stay fire-and-forget **after** the awaited refresh; the pin stands and `/pins` remains the recovery path (ordering pinned, semantics unchanged) |
| **E2** the worked example (day-one search pin) | U5 | "Only me" + items selected builds ONE blob carrying `authorConstraint:'observer'` and `targetTypes` including `item` — today that combination needs pin-then-edit |
| **E3** a viewer with no WoT computed | U8, U9 | the build path depends on no POV input: an empty observer resolves to the viewer and a cutoff of `'1'` normalizes to `1`, so the dialog submits normally. **Not covered:** whether the dialog echoes `PovStatusNotice` — Gate A ruling 3 deferred it |
| **E4** double-click / in-flight guard | S3, U10 | exactly one dialog mount (the picker closes before the interstitial opens — never two); the dialog's existing `submitting` guard is untouched. **Not covered:** the render-time race between `pinning` and `submitting` — needs a browser; Gate B smoke |
| **E5** not signed in | S10 | `TagPinAffordance.jsx` byte-identical — no user, no affordance; the interstitial is never the login prompt |
| **E6** pinning the same tag into a second context | S2, S3 | the context is carried into the same single dialog, so a viewer with a neutral pin who picks a community still passes through the interstitial for that new pin (Gate A ruling 6) |
| **Story-3 / story-5 collision** (E5 in the story's own list) | U1, U4 | an unchosen control emits **nothing**: the default's key set is frozen and the untouched build may add no key the default lacks — this is what keeps `membershipMethod` and the variant key out of the wire default |

## Not covered (and why)

- **Rendered-DOM behaviour** — Escape / backdrop / × dismissal paths, focus, and the visual
  collapse of the `<details>`. The dialog's Escape + backdrop handlers are pre-existing and
  unchanged; a Playwright spec would need a signed-in NIP-07 session, which this repo's
  browser tests do not provision. Gate B browser smoke covers it.
- **Whole-event byte identity** of the published kind-39999 (`d` / `e` / `a` / `z` order) —
  owned by the guards (`pin-stack-composition` AC-4, `context-scoped-pins`). This suite pins
  the blob, which is the only input this story could change.
- **The two copies of the blob agreeing** — structural in `pinTag` (one variable stringified
  twice); owned by `generalized-tag-pinning`.
- **Copy wording** — the operator's call; S6 pins only the two required elements (the
  explanation line and the collapsed expander).

## Test infrastructure

- Node built-in runner; suite registered in `test/registry.js`. No new framework.
- `ui/src/utils/publishTagPin.js` is ESM with a vite-only alias, so the suite copies
  `loadClientPublishTagPin` from `test/pin-stack-composition.test.js` — rewrite
  `@tapestry/event-tagging` onto the real CJS lib, stub every other import, import a temp
  `.mjs` that is deleted in `finally`.
- `nostr-tools` is imported for the npub case in U9 (resolves from the repo root).
- **Graph-state prerequisites: none.** No control panel, no firmware install, no relay.

## How to run

```
{ timeout 120 env BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . \
  node -e "require('./test/confirm-step-on-first-pin.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"; echo "EXIT=$?"; } 2>&1
```

Full gate: `npm test` (read the result per engineering-team/README.md, "Running and reading the test gate").

## Verification — the tests fail for the right reason

Confirmed 2026-09-18 on `feat/search-index-selection`. **16 failed, 9 passed, 0 skipped.**

The 9 green are exactly the ones that must be green *before* implementation: U1/U2 (the wire
default is already correct — the story must keep it that way), S9/S10/S11 (untouched surfaces),
S12 and R1/R2/R3 (regressions). The 16 red split into "the pure module does not exist yet"
(U3–U10) and "the interstitial is not wired / the copy is not written" (S1–S8).

```
  ✓ U1 AC-2: the default curation a first pin publishes carries exactly today's six keys — no membershipMethod, no authorConstraint
  ✓ U2 AC-2: the default curation's values are today's values (observer=viewer, nip85:rank, cutoff 1, score on, all three target types, net-endorsed)
  ✗ U3 AC-2 (the sentinel): confirming the interstitial without touching a field builds exactly the default blob
      U3: ui/src/utils/curationDialogBuild.js must load in plain node (error: ui/src/utils/curationDialogBuild.js does not exist).
  ✗ U4 AC-2: the untouched build stays key-for-key with the default even as the dialog grows fields (no extra, no missing)
      U4: ui/src/utils/curationDialogBuild.js must load in plain node (error: ui/src/utils/curationDialogBuild.js does not exist).
  ✗ U5 AC-4 / E2: the day-one search pin — "Only me" plus items selected builds one blob carrying authorConstraint and the item target
      U5: ui/src/utils/curationDialogBuild.js must load in plain node (error: ui/src/utils/curationDialogBuild.js does not exist).
  ✗ U6 AC-6: an untouched trust-scope control re-emits whatever the pin already carried, and emits nothing when the pin carried nothing
      U6: ui/src/utils/curationDialogBuild.js must load in plain node (error: ui/src/utils/curationDialogBuild.js does not exist).
  ✗ U7 AC-6: the edit-path targetTypes fallback is ["profile","note"] — editing a pre-item pin cannot silently add items
      U7: ui/src/utils/curationDialogBuild.js must load in plain node (error: ui/src/utils/curationDialogBuild.js does not exist).
  ✗ U8 E3: a cutoff of "1" normalizes to the number 1, and junk is rejected rather than silently coerced
      curationDialogBuild.js must load in plain node (error: ui/src/utils/curationDialogBuild.js does not exist).
  ✗ U9 E3: an empty observer field means "me" — it resolves to the viewer, and an npub resolves to its hex
      curationDialogBuild.js must load in plain node (error: ui/src/utils/curationDialogBuild.js does not exist).
  ✗ U10 AC-3 / E4: a build that fails validation returns field errors and no curation — there is nothing to publish
      U10: ui/src/utils/curationDialogBuild.js must load in plain node (error: ui/src/utils/curationDialogBuild.js does not exist).
  ✗ S1 AC-1: clicking Pin no longer publishes — handlePin opens the dialog instead of calling publishWithCuration directly
      AC-1: handlePin must NOT call publishWithCuration(defaultCurationMethod(…)) — nothing may be signed or published before the interstitial's primary action.
  ✗ S2 AC-5 / E6: "Pin to community" routes through the same interstitial — handlePinToContext no longer calls pinTag inline
      AC-5: handlePinToContext must not sign the pin inline — it closes the picker and opens the same interstitial with the chosen context.
  ✗ S3 AC-1 / E4: Tag.jsx mounts exactly ONE curation dialog, in create mode, seeded with defaultCurationMethod
      AC-1: Tag.jsx must mount exactly one <CurationMethodDialog (found 0). E4: never two dialogs at once.
  ✗ S4 AC-4 / AC-5: the dialog's onSubmit publishes ONE pin — routing to publishWithCuration or the factored-out context publish
      the mount must wire onSubmit; element was:
  ✗ S5 AC-3: cancelling closes the dialog and publishes nothing
      AC-3: the mount must wire onCancel; element was:
  ✗ S6 Gate A ruling 2: create mode explains what a pin does, and offers a collapsed "What's a Trusted List?"
      Gate A ruling 2: create mode must carry the explanation line "Pinning publishes a Trusted List under your point of view with this curation."
  ✗ S7 AC-6: the create-mode copy is gated on the mode — an edit of an existing pin sees neither the line nor the expander
      the create-mode copy must exist before this sentinel can check its gating (see S6).
  ✗ S8: the dialog builds its blob through the shared pure module — no second copy of the build rule
      CurationMethodDialog.jsx must import the build rule from ui/src/utils/curationDialogBuild.js (the testability contract in this file's header) — a JSX-only build cannot be pinned by AC-2's sentinel.
  ✓ S9 AC-2: defaultCurationMethod is byte-identical to HEAD — the wire default is not touched by this story
  ✓ S10 AC-7 / AC-5 / E5: the pin affordance and the community picker are byte-identical to HEAD
  ✓ S11 (house rule): no 64-char hex pubkey literal is introduced in any file this story touches
  ✓ S12 E1: a failed publish surfaces inline and leaves the dialog open with the user's edits intact
  ✓ R1 AC-2: the pin refresh is still AWAITED before the NIP-51 exports fire
  ✓ R2 AC-6: the Pinned-tab "Edit curation" path still mounts the dialog in edit mode, with its Unpin affordance
  ✓ R3 AC-6: the edit-path targetTypes fallback ["profile","note"] survives the refactor

confirm-step-on-first-pin: 9 passed, 16 failed, 0 skipped
EXIT=1
```

**Note for the Implementer:** S9 compares against `git show HEAD`. Once this story's commits
land, HEAD moves with them — S9 keeps working (it compares the *current* HEAD's copy of
`defaultCurationMethod`, which this story never edits) but it stops being a guard against a
change made *in the same commit* as the comparison. If you touch `publishTagPin.js` at all,
say so at Gate B so the Reviewer re-checks the function against the story's quoted body.
