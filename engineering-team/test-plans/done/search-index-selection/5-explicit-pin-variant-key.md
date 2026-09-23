# Test Plan: search-index-selection #5 — an explicit pin variant key

**Story:** `engineering-team/stories/search-index-selection/5-explicit-pin-variant-key.md` (Approved; Light lane **with an ADR**, Gate A 2026-09-18)
**ADR:** `engineering-team/decisions/search-index-selection/0003-explicit-pin-variant-key.md` (Accepted — J1, five rounds; its §4 readers table is the exhaustive consumer list)
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) §§ `:187-225`, `:229-243`
**Date:** 2026-09-18
**Suite:** `test/explicit-pin-variant-key.test.js` (new; registered in `test/registry.js:227`, beside `confirm-step-on-first-pin.test.js`)
**Pre-implementation result:** **13 passed / 37 failed / 0 skipped** at commit `e467846e` (branch `feat/search-index-selection`).

## Scoped gate (Gate A ruling)

```
test/explicit-pin-variant-key.test.js     (new — this story's suite)
test/pin-stack-composition.test.js        guard — the variant/d-tag spine + byte-identity fixtures
test/context-scoped-pins.test.js          guard — contextual pins keep working (AC-2 / E1)
test/only-me-curation.test.js             guard — ADR 0001 author constraint
test/per-pin-membership-method.test.js    guard — ADR 0002 method composition (E6)
test/item-trusted-list.test.js            guard — the 30394 runner's own addresses
test/note-trusted-list.test.js            guard — the 30393 runner's own addresses
```

`test/tl-membership-method-selector.test.js`, `test/tl-certainty-method.test.js` and
`test/tl-weighted-sum-method.test.js` are **live-stack** (layer 3) and stay out of the judge
gate; operator-run at Gate B.

**Guard-suite carve-out (templates/adr.md).** Phase 4 must not edit any of the six guard
suites. `pin-stack-composition` AC-4 holds the literal whole-event fixtures for a neutral
pin's 30392/30393 and `context-scoped-pins` holds the contextual d-tag fixtures — those, not
this plan, own byte-identity. **R1** enforces the carve-out by byte-comparing four of them
against `git show HEAD`.

## Test classes

| Class | What it drives | Level |
|---|---|---|
| **U** | the SDK (`src/lib/event-tagging/pins.js`): `pinVariantKey`, `variantOfPin`, `variantKeyArgs`, the three TL composers, `validateVariantSlug` | unit, relay-free |
| **H** | the real runners (`runOnePin` / `runOneNotePin` / `runOneItemPin` / `refreshAllPinnedTags` / `retractStaleTLs`) through **injected deps** | integration, stack-free |
| **A** | client/server parity for the four client composers; the curation blob's continued innocence | unit |
| **S** | source sentinels — one per row of ADR §4's readers table (the JSX rows cannot import in node) | structure |
| **R** | regression sentinels, green **before and after** | unit + structure |

**Stack-free. No graph-state prerequisites.** No strfry, no neo4j, no control panel; no
`POST /api/firmware/install` precondition (S20 reads the firmware file on disk, it does not
query the graph). `process.env.TA_PUBKEY` is provisioned at load time as in
`pin-stack-composition`, so nothing depends on `/etc/brainstorm.conf` (which does not exist on
this host — the stack is in Docker). No suite is skipped for a missing stack.

> **Live-stack follow-up for Gate B (not automatable here):** the firmware reinstall the ADR
> §8 requires (`POST /api/firmware/install` against the dev panel `http://localhost:8778`) and
> `test/tl-membership-method-selector.test.js`. S20 proves the *file* changed; only the
> reinstall proves the *graph* did.

## The two testability contracts this plan introduces

The Implementer must land both. They exist because the ADR's enforcement points live where
node cannot reach them.

### SEAM 1 — the pre-signature uniqueness/slug check must be pure and shared

ADR §3 puts the only real guard (the one that prevents the replaceable-event stomp) in the
create dialog, which is JSX; ADR §1 already puts the slug rules and `KNOWN_CONTEXTS` in the
SDK. So the *rule* lives in the SDK and the dialog renders it:

```js
// src/lib/event-tagging/pins.js  (re-exported from index.js == the UI's @tapestry/event-tagging)
const VARIANT_SLUG_MAX = 40;

function validateVariantSlug({ name, existing = [] })
// `existing` = the viewer's existing pins of THIS tag as variantOfPin() outputs:
//              [{ kind: 'context'|'recipe'|null, slug }]
// -> { ok: true,  slug }
// -> { ok: false, reason: 'empty'|'too-long'|'known-context'|'in-use', error }
//    `error` is the inline message the dialog renders and MUST name the conflict.
```

`CurationMethodDialog.jsx` calls it and refuses inline; nothing is signed on `ok:false`.
`ui/src/utils/curationDialogBuild.js` is **not** involved — the variant is identity, not
scoring (ADR §2; Option B rejected). Handles: **U10, U11, S17**.

### SEAM 2 — `refreshAllPinnedTags` must accept injected deps

ADR §3 layer 2 puts the collision pre-pass in `refreshAllPinnedTags`, which today takes no
arguments and reaches strfry through the module-level `enumeratePinnedTags`. The house shape,
unchanged from the runners:

```js
async function refreshAllPinnedTags(options = {}) {
  const deps = options.deps || options;
  const enumerate = deps.enumeratePinnedTags || enumeratePinnedTags;
  // deps forwarded verbatim to runOnePin / runOneNotePin / runOneItemPin
  // and to all three retractStaleTLs calls.
}
```

Defaults stay the real implementations. Without it neither the pre-pass nor the roster
behaviour under C3 is checkable without a live stack. Handles: **H8, H9**.

## Coverage map — AC → handle

| Criterion | Handles | Level |
|---|---|---|
| **AC-1** a variant that is not a community (own pin `d`, own 30392/30393/30394 `d`s, **no** context `z`) | U2, U8, **H1**, H2, H3, A1 | unit + integration |
| **AC-2** contextual and neutral pins unchanged, byte for byte (five schemes, `z` set, list bytes) | U1, **U9**, **H4**, R5, A1, + guards `pin-stack-composition` AC-4 / `context-scoped-pins` | unit + integration |
| **AC-3** variant uniqueness per (observer, tag) — refused pre-signature, message names the conflict | **U10**, S17, H8 (the residual server-side class) | unit + structure |
| **AC-4** slug rules are the house rules (canonical `slug()`, empty refused, slug stored, name display-only) | **U10**, U4, S17 | unit + structure |
| **AC-5** every derived-`d` reader keys off the stored variant | S1, S2, S3, **S4**, **S5**, S6, S9, S10, S11 | structure |
| **AC-6** the minimum switcher UX (recipes visually distinct, "Personal"-first preserved) | S12, **S13**, **S14**, S16, S18, S19 | structure |

### Edge cases → handle

| Edge case | Handles |
|---|---|
| **E1** a variant slug that *is* a known community slug behaves exactly like today's contextual pin | **H4**, U6, R3 |
| **E2** a deployment extends `KNOWN_CONTEXTS` after publication — no address moves, no `z` appears | **H11**, U5 |
| **E3** `variant` tag and context `z` disagree ⇒ the stored variant wins, deterministically | **U3**, **U5** |
| **E4** a variant slug long enough to threaten the `d` tag ⇒ bounded at 40, enforced pre-signature | **U4**, U10 |
| **E5** the kind-30003 note-bookmark export takes the same variant (no neutral fallback) | **A1**, **S8** |
| **E6** variant × per-pin membership method — independent folds, distinct addresses | **H10** |
| **C3** a pin whose author ≠ observer publishes nothing and claims no address | **H5**, **H6** |
| **C3 consequence** that pin's previously-published list IS retracted; the owner's is untouched | **H7** |
| Residual own-pin collision ⇒ both skipped, logged, `d` kept on the roster | **H8** |
| OPEN 298 — `useTagMemberSets` loses every suffixed pin today | **S11** |
| House rule — no 64-hex TA literal introduced | **S21** |
| ADR §4's one declared **non-consumer** (`Tag.jsx:142`) really is one | **S15** |
| `PinToContextModal` stays out of it | **S19**, S14 |
| The firmware schema is the only human-readable definition of the wire shape | **S20** |

### Not derivable from any acceptance criterion (the J2 §1 requirement)

- **H7** — the *retraction* consequence of C3. No AC mentions it; the ADR's Consequences do,
  and it is the one place where this story **withdraws** data at a permanent subscription
  address. Green pre-implementation (it documents existing `retractStaleTLs` behaviour under
  the new roster), red the moment someone "fixes" the sweep to spare skipped pins.
- **H8** — the residual own-pin collision. Reachable only through suffix ambiguity
  (`foo-v-bar` vs `foo`+`bar`) or an 8-char prefix collision; no AC covers it.
- **R2** — that the retraction sweep still *catches* `-v-` d-tags across all three kinds. A
  new address form that the sweep silently ignores would leak orphan lists forever.
- **A2** — that the variant never leaks into the `curationMethod` blob. ADR Option B's
  failure mode (an unparseable blob collapsing two pins onto one address) is invisible to
  every AC.
- **S21 / S15 / S19** — house-rule and declared-non-consumer sentinels.

### Error paths of the external dependencies this design touches

| Dependency | Covered |
|---|---|
| `lookupTag` (strfry) missing tag | not re-covered — unchanged by this story; owned by `item-trusted-list` / `note-trusted-list` |
| `publishTL` transport failure | not re-covered — unchanged; the "failed publish still joins the roster" rule is owned by `item-trusted-list` |
| `strfryScan` in the sweep | **H7, R2** (injected; both the retract and the spare path) |
| malformed `curationMethod` blob | **A2** proves the variant does not depend on it at all — the ADR's whole reason for Option A |
| malformed `variant` tag on the wire (`['variant']`, `['variant','']`) | **U6** |
| observer missing/malformed | unchanged (the C3 check lands *after* the existing observer bail) — covered by `only-me-curation` |

## Re-aims to existing suites

The ADR's "For the Tester" list names fourteen suites that hand-compose a pin/TL `d`-tag.
**Every one of them composes a NEUTRAL form** (`tl-pin-<o8>-<a8>-<slug>`,
`tag-pin-<slug>-<a8>-<v8>`) or a contextual `-in-` form, both of which this story keeps
byte-identical (AC-2). **Zero lines were changed.** Audited, each with the reason it stays:

| Suite | Lines inspected | Verdict |
|---|---|---|
| `test/context-scoped-pins.test.js` | `:49-92` (`pinVariantKey`, `contextSlugOfPin`), `:187` | **unchanged by design** — asserts `pinVariantKey()`/`{}`/`{contextSlug:null}` → `''` and `{contextSlug:'lfo'}` → `-in-lfo`; the generalised helper preserves all four. Guard (R1). |
| `test/pin-stack-composition.test.js` | `:270-274`, `:286`, `:299`, `:321`, `:344`, `:390-393` | **unchanged by design** — neutral + `-in-lfo` fixtures only; the E-class guard for AC-2. Guard (R1). |
| `test/item-trusted-list.test.js` | `:138-151`, `:216`, `:376-383`, `:467-472` | **unchanged by design** — neutral and `-in-lfo` item addresses. |
| `test/note-trusted-list.test.js` | `:122-127` | **unchanged by design** — neutral note address. |
| `test/per-pin-membership-method.test.js` | (no hand-composed `d`) | **unchanged by design.** Guard (R1). |
| `test/only-me-curation.test.js` | (no hand-composed `d`) | **unchanged by design.** Guard (R1). |
| `test/confirm-step-on-first-pin.test.js` | `U1`–`U4`, `S9` | **unchanged by design** — story 4's blob-identity sentinels; A2 is this suite's mirror of them, and the ADR keeps `curationDialogBuild.js` out of the diff precisely so they stay meaningful. |
| `test/restore-historical-data-and-fix-tl-author-filter.test.js` | `:384-394` (R-2) | **unchanged by design**, but **load-bearing**: R-2 matches the ``tl-pin-${…slice(0,8)}-…`` template that now survives only in the *comment* at `refreshPinnedTags.js:118`. Mirrored here as **R4** so the scoped gate catches it if the Implementer rewrites that comment. |
| `test/customize-pin-curation-publish.test.js` | `:183`, `:215` | **unchanged by design** — neutral forms; live-stack. |
| `test/pin-a-tag-publish.test.js` | `:100`, `:108` | **unchanged by design** — neutral; live-stack. |
| `test/tl-publication-from-pins-publish.test.js` | `:198`, `:235` | **unchanged by design** — neutral; live-stack. |
| `test/nip51-list-export-from-pins-publish.test.js` | `:161`, `:200`, `:375-384` | **unchanged by design** — neutral; live-stack. |
| `test/most-pinned-tag-index-publish.test.js` | `:138`, `:326` | **unchanged by design** — neutral; live-stack. |
| `test/trusted-list-raw-view.test.js` | `:55`, `:78` | **unchanged by design** — literal neutral/contextual `d` fixtures. |
| `test/tag-detail-curated-view-and-pin-polish-publish.test.js` | `:173`, `:205` | **unchanged by design** — neutral; live-stack. |
| `test/tl-weighted-sum-method.test.js` | `:219`, `:228` | **unchanged by design** — neutral `tag-pin-`/`tl-pin-` pair. Live-stack, **not run** (per instruction). |
| `test/tl-certainty-method.test.js`, `test/tl-membership-method-selector.test.js` | — | live-stack, operator-run at Gate B. |

**If Phase 4 finds a re-aim is needed after all, that is a kick-back to Phase 3, not an edit
to a guard suite** (R1 will go red).

## ADR ambiguities found, and how they were resolved

1. **The skip result's key.** ADR §3 layer 1 specifies `{ status: 'skipped', reason:
   'author-observer-mismatch' }`, but every existing runner skip uses `errorReason`
   (`refreshPinnedTags.js:664`, `:700`). **Resolved:** H5/H6 accept *either* key carrying that
   *exact* value, so the Implementer may stay consistent with the house shape without
   contradicting the ADR. The status (`'skipped'`) and the reason string are pinned exactly.
2. **No uniqueness helper is named.** ADR §3 describes the refusal behaviourally and puts it
   in JSX. **Resolved:** SEAM 1 above — the rule goes in the SDK beside `KNOWN_CONTEXTS` and
   `slug()`, which is where both of its inputs already live, and the dialog renders it.
   `reason` vocabulary (`empty` / `too-long` / `known-context` / `in-use`) is this plan's, and
   is a Gate-B ratification point.
3. **No seam is named for the collision pre-pass.** ADR §3 layer 2 edits
   `refreshAllPinnedTags`, which takes no options. **Resolved:** SEAM 2 above, copying the
   runners' `options.deps || options` shape verbatim (the precedent `retractStaleTLs` already
   follows since dlist-item-tagging #5).
4. **The collision result's status.** ADR §3 says `status:'collision'` for the residual case
   and "keep-on-roster". **Resolved as written:** H8 asserts `status === 'collision'` on both
   rows, a log containing `pin-variant-collision`, no publish at the collided address, and —
   via an injected `strfryScan` that already holds a list there — **no retraction**, which is
   what "kept on the roster" means observably.
5. **Where the variant disclosure sits in a list's tag array.** ADR §2 says "beside
   `['membership-method', …]` and before the `z` block". **Resolved:** H1–H3 assert the tag's
   *presence and value* but not its index — ordering inside `extraTags` is not something the
   ADR makes load-bearing for a consumer, and pinning it would constrain the Implementer
   without a spec reason. H4/R5 pin the *absence* of the tag on contextual and neutral lists,
   which is the byte-identity claim that matters.

## Test infrastructure

- Node's built-in runner; entry `test/test.js`, registry `test/registry.js:227`. A full run's
  result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- No Playwright: every surface this story touches that a browser could exercise (the chip row,
  the dialog field) is reachable only behind a NIP-07 signer, which the Playwright config does
  not provision; those are S-class sentinels plus the operator's Gate-B browser pass.
- Fixtures: `OBS = 'a'*64`, `TAGAUTHOR = 'b'*64`, tag `funny`, stranger `'9'*64`,
  `process.env.TA_PUBKEY` defaulted to `'f'*63 + '1'` when unset.

## How to run

```
cd /home/vcavallo/src/tapestry
for t in explicit-pin-variant-key pin-stack-composition context-scoped-pins only-me-curation \
         per-pin-membership-method confirm-step-on-first-pin item-trusted-list note-trusted-list; do
  { timeout 180 env BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e \
    "require('./test/$t.test.js').run().then(r=>{console.log('$t',JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped}));process.exit(r.fail?1:0)})"; echo "EXIT=$?"; } 2>&1
done
```

(`direnv exec .` because there is no system node on this host; the dev panel is `:8778`, not
`:7778`.)

## Verification — pre-implementation

Confirmed 2026-09-18 at commit `e467846e` on `feat/search-index-selection`:

```
explicit-pin-variant-key {"pass":13,"fail":37,"skipped":0}     EXIT=1
pin-stack-composition    {"pass":20,"fail":0,"skipped":0}      EXIT=0
context-scoped-pins      {"pass":32,"fail":0}                  EXIT=0
only-me-curation         {"pass":35,"fail":0,"skipped":0}      EXIT=0
per-pin-membership-method{"pass":31,"fail":0,"skipped":0}      EXIT=0
confirm-step-on-first-pin{"pass":27,"fail":0,"skipped":0}      EXIT=0
item-trusted-list        {"pass":51,"fail":0,"skipped":0}      EXIT=0
note-trusted-list        {"pass":15,"fail":0}                  EXIT=0
```

The 13 green handles pre-implementation are the regression/consequence sentinels — **U1, U9,
H4, H7, A2, S15, S19, S21, R1, R2, R3, R4, R5** — exactly the set that must stay green
through Phase 4. The 37 red handles each name the missing piece; a representative sample of
the actual output:

```
  ✗ U2: pinVariantKey gives a recipe its own prefix — "-v-<slug>", never "-in-"
      a recipe must key on -v-<slug> (ADR §1); got "".
  ✗ U3: the two members are mutually exclusive and the variant wins (E3 …)
      with both members present the VARIANT wins (ADR §1, matching variantOfPin's precedence); got "-in-lfo".
  ✗ U5: variantOfPin reads the pin's own variant tag first …
      pins.js must export variantOfPin(pinEvent, taPubkey) (ADR §1).
  ✗ U10: validateVariantSlug is the pre-signature house rule …
      pins.js must export validateVariantSlug({name, existing}) — SEAM 1: the ADR §3 client refusal
      must be pure to be testable (the dialog is JSX).
  ✗ H1: a recipe pin publishes its profile TL (30392) at the -v-<slug> address …
      a recipe's 30392 must publish at tl-pin-<obs8>-<author8>-<slug>-v-search-index;
      got tl-pin-aaaaaaaa-bbbbbbbb-funny.
  ✗ H5 (C3): a pin whose author is not the observer publishes nothing and claims no address …
      C3 (ADR §3 layer 1): a pin about someone else's point of view must return
      {status:'skipped', reason:'author-observer-mismatch'}; got {"status":"ok",…,"dTag":"tl-pin-aaaaaaaa-bbbbbbbb-funny","memberCount":2}.
  ✗ H9 (SEAM 2): refreshAllPinnedTags drives its pins through injected deps …
      SEAM 2: refreshAllPinnedTags must accept injected deps ({ enumeratePinnedTags, … });
      it reached the real stack instead: Command failed: strfry scan '{"kinds":[39999],…}'
  ✗ S2: the neutral pin is the one with NEITHER a context NOR a variant (profile-tags:905-906)
      AC-5: viewerPin must be "no context AND no variant" … Line was:
      viewerPin = viewerPins.find((p) => p.context === null) || null;
  ✗ S12: the Pinned tab's default pin is the one with NEITHER context nor variant — not `!p.variant`
      the default pin must be selected on the variant's KIND being null;
      got: const neutral = viewerPins.find((p) => !p.context)
  ✗ S20: the tag-pinning firmware schema documents the variant (ADR §8)
      ADR §8: the tag-pinning element schema must gain a 'variant' property beside tagEventId …
      Properties were ["tagEventId","curationMethod"].
```

No failure is an import error, a typo, or a crash: every load goes through a safe-require /
safe-read helper that turns a missing module into a named assertion message.

**One honest note on H8.** Pre-implementation it fails on its fixture *precondition* — the two
colliding pins cannot be constructed until `tlDTag` threads `variantSlug` (U8's failure). Its
message says so explicitly. It becomes a real assertion the moment U8 goes green, which is the
Implementer's first step.
