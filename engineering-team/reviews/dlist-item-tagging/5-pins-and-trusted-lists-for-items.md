# Review: Story 5 — Pins and Trusted Lists for tagged items (kind-30394)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-17
**Branch:** `feat/dlist-item-tls` @ `7fc7e528`
**Diff:** implementation `git show c0138b9a`; test corrections `git show 7fc7e528`; Test Design `fccc7c3e`
**Lane:** Light (Gate B). Story § Rulings 2026-09-17 are the governing overrides; ADR 0003 supersedes the
2026-09-10 Design note; wire shape from ADR 0002.

## Quality gates (run by reviewer, not trusted)

Scoped gate (Light — the full suite is not a judge/review gate here; run per-suite in the foreground,
exit code captured by brace-redirect, never piped through `tail`):

| Suite | Result | Exit |
|---|---|---|
| `test/item-trusted-list.test.js` | `{"pass":51,"fail":0,"skipped":0}` | 0 |
| `test/generalized-tag-pinning.test.js` *(guard — unedited)* | `{"pass":12,"fail":0}` | 0 |
| `test/strfry-write-assertion-bracket.test.js` *(guard — unedited)* | `{"pass":6,"fail":0,"skipped":0}` | 0 |
| `test/note-trusted-list.test.js` *(AC-7 regression)* | `{"pass":15,"fail":0}` | 0 |
| `test/pin-stack-composition.test.js` | `{"pass":20,"fail":0,"skipped":0}` | 0 |
| `test/context-scoped-pins.test.js` | `{"pass":32,"fail":0}` | 0 |
| `test/event-tagging-firmware-seed.test.js` | `{"pass":10,"fail":0,"skipped":1}` (pre-existing LIVE skip) | 0 |

`npm run gate:status` → `no gate run records in /home/vcavallo/src/tapestry/tmp/gate-runs` — expected:
the capped Light gate was invoked per-suite through `node -e "require('./test/<x>.test.js').run()"`,
which does not write a gate-run record. Full `npm test` remains the book-close/promotion gate.

- Lint (UI, changed files only): `ui/src/utils/publishTagPin.js` and `ui/src/components/PinnedListPanel.jsx`
  clean. `ui/src/components/CurationMethodDialog.jsx` reports 3 errors (`171:21 no-unused-vars`,
  `234:12` + `332:12 no-constant-binary-expression`). **Verified pre-existing:** linting
  `git show c0138b9a^:ui/src/components/CurationMethodDialog.jsx` gives the identical 3 errors at the
  pre-shift lines 166/229/318. No new lint error introduced.
- Typecheck / build: not configured (JS-without-build, house rule).
- Live check: `GET :8778/api/concept-graph/summaries` (62 concepts) resolves
  `39998:82b75e47…973833:trusted-list` and `…:trusted-list-for-tag` — both seeded with the
  ADR-0002 descriptions, `elementCount: 0` (expected and documented in ADR 0003 §4). Firmware JSON
  (4 concept files + `manifest.json`) parses.

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 — TA-signed 30394, `a` members, d-tag/back-ref/observer discipline | PASS | `refreshPinnedTags.js` `runOneItemPin` → `kind:30394`, `items: a/m.address`, `dTag = itemTlDTag(…)`, `['observer']`, `['source-tag',…]`, `['p', observer]`. U6, U7, U8 green. |
| AC-2 — gate on `targetTypes`; absent = pre-existing default; existing pins unchanged | PASS | Gate literal `['profile','note']` byte-identical to the note gate; U9/U10/S7 green. Test correction in `7fc7e528` makes U9 actually omit the field (see below). |
| AC-3 — dialog offers items; validation accounts for it | PASS | `CurationMethodDialog.jsx:78,121,296–303`; copy "Select at least one: profiles, notes, or items."; S6. |
| AC-4 — stale 30394 retracted by the same mechanism | PASS | third sweep `retractStaleTLs(currentItemDTags, {kind:30394, dPrefix:'tl-pin-items-'})`; U28/U29/S2. |
| AC-5 *(Rulings 2: Pinned tab only)* | PASS | `PinnedListPanel.jsx:477–497` renders status + member count and the `naddr30394` (gated on `status==='ok'`); `Pins.jsx` untouched (R5). |
| AC-6 — no empty 30394 | PASS | `published.length === 0 ⇒ {status:'skipped'}` before any publish; U11/U12. |
| AC-7 — 30392/30393 runners, tests, published lists unaffected | PASS *(with the ratified exception)* | The two runners gain exactly the `...tlZTags` spread + the header ensure; `note-trusted-list` 15/15, `context-scoped-pins` 32/32. The new `z` pair and the `currentNoteDTags` roster change are the ADR-0002 / Rulings-1 changes the story explicitly authorizes. |

No criterion silently dropped; no behavior beyond the story + its rulings.

## ADR adherence (0003 implementation, 0002 wire shape)

- **Wire shape vs ADR 0002 worked example — matched exactly.** `trustedListZTags` emits
  `['z','39998:<TA>:trusted-list']` + `['z','39999:<TA>:tl:<slug>-tls']` (`pins.js:81–86`).
  `buildTLHeader` (`builders.js:133–147`) emits `d = tl:<slug>-tls`, `names`, `description`,
  `z → 39998:<TA>:trusted-list-for-tag`, `a → 39999:<tagAuthor>:<slug>`, `content: ''` — field-for-field
  the ADR-0002 example. `requireHex64(tagAuthorPubkey)` keeps a malformed author from minting an orphan.
- **E1 honored:** no `a` back-ref and no `['e', tag.eventId]` substitute on the 30394; `['p', observer]`
  kept as the non-member observer axis (U8, U7).
- **Address filter (ADR 0003 §1.7) present and load-bearing:** `filter((m) => typeof m.address === 'string' && m.address)`
  before `curateNotes`; id-keyed members can never become `a` members (U13). No second type filter (E5/U14).
- **Cap semantics:** `ITEM_TL_MEMBER_CAP = 500`; `partial = !!scanTruncated || curated.length > CAP`;
  `['truncated', String(totalTrusted)]` and `content.partial` only when partial — **absence means complete**
  (U16, U17).
- **`ensureTagTLHeader`** — no literal anywhere: `TA_PUBKEY` is `getOwnerAssistantPubkey()` at module init,
  the signer path is the reused `normalize/helpers` triple (`loadTAKey` → `signAndFinalize` →
  `publishToStrfry` → best-effort `importEventDirect` in its own try/catch). Idempotence is a real
  `{kinds:[39999], authors:[TA], '#d':[tl:<slug>-tls]}` scan; the memo is **positive-only** (set on a
  confirmed hit or a successful publish, never on absence or failure), so a failed mint cannot wedge until
  restart. Every relay call is bounded by `withRelayTimeout(…, 5000)` with an `unref`'d timer, and the whole
  body is inside one try/catch returning `{status:'error'}` — **it cannot throw into a runner and cannot hang
  the cron path** (U27 asserts the no-throw contract; I also confirmed by inspection that the only code
  outside the try — `tlHeaderDTag`/`tlHeaderAddr` — is pure string concatenation).
- **F1 fallback verified:** on `status:'error'` the runners fall back to `[['z', conceptTrustedList(TA)]]`,
  so the concept `z` survives and the context `z` (appended separately) is unaffected — the list stays
  deployment-wide and context-discoverable, losing only the per-tag membership claim (U20).
- **Retraction sweep:** `carryOver` now includes `t[0] === 'z'` (U30); the `dTag.startsWith(dPrefix)` guard is
  intact and proven by U28 over a fixture relay carrying both applicability lists — exactly one retraction,
  applicability lists untouched. `refreshApplicabilityLists.js` is not edited (R3, Rulings 3).
- **Unified failure policy (Rulings 1):** `if (result.dTag)` / `if (noteResult.dTag)` / `if (itemResult.dTag)`
  — all three rosters now collect unconditionally, and `runOneItemPin`'s catch returns `{status:'error', dTag}`
  (U23, S2). Interaction with retraction is the safe direction: a transient publish error keeps the d-tag on
  the roster, so the sweep cannot retract a live list. The genuinely-stale paths still retract, because the
  skip/unsupported/empty returns carry **no** dTag (verified in all three early-return branches).
- **Status enrichment:** `enrichRowsWithItemTLStatus` composes its d-tag with the shared `itemTlDTag`
  (not hand-formatted), scans in its **own** `try` whose catch returns, and defaults every row to `'never'`
  before any scan. `row.tlStatus` / `row.nip51ExportStatus` are byte-identical — the item work only adds a
  new field (E12/S9). Scratch d-tags live in a local `Map`, so the response shape is unchanged.
- **Client:** `taPubkey` comes from `useConfig()` (`PinnedListPanel.jsx:120`), never a literal; `initTypes`
  fallback stays `['profile','note']` on edit while `defaultCurationMethod` opts *new* pins into `'item'`;
  `pinTag`'s signature untouched.
- **Firmware:** two concept dirs with `concept-header.json` + `json-schema.json`, both appended to
  `manifest.json` `concepts[]` in sibling form, **no `communityReference` block** (correct — no canonical
  pubkey literal), `headerTags [["recommended","a"],["allowed","e"]]` on `trusted-list-for-tag` only.
  Reinstall performed on `:8778` and verified live.
- **Layering:** `src/api/trustedList/index.js` unedited (R4); `pins.js` gains one import of the equally pure
  `handles.js` and its header comment was corrected accordingly — the "no I/O, portable" contract holds.
  No new dependencies.

## Test corrections in `7fc7e528` — assessed independently

Both are legitimate suite defects, not weakenings:

1. `test/item-trusted-list.test.js:79–82` — `makeItemPin({targetTypes: undefined})` never omitted the field
   (a JS default parameter reinstates `['item']` on `undefined`), so U9 was asserting the *opposite* of
   AC-2 and would have passed for the wrong reason. The `null` sentinel makes the field genuinely absent.
   The added `process.env.TA_PUBKEY = TA` guard is set only when unset, and the suite's expectations are
   derived from the same `TA` constant, so a pre-set env value fails loudly rather than vacuously.
2. `test/pin-stack-composition.test.js` — the "byte-identical pre-change event" assertions are relaxed by
   exactly the new `z` pair (`tlZPair()`, composed from the runtime TA), and the "no context z" assertions
   are preserved via `contextZTags()` rather than deleted. That is the correct narrow amendment for an
   authorized family-wide additive change; nothing else in those expectations moved.

No guard suite was edited (`generalized-tag-pinning`, `strfry-write-assertion-bracket` absent from both
diffs). Every plan handle is present in the suite (51/51); the suite carries two extra wiring sentinels
(S1, S4) named in the story's AC→handle lines.

## Concept-graph integrity
- Handles in `kind:pubkey:slug` form, composed from the runtime TA in all four new composers.
- Firmware reinstall **required and performed** (verified live on `:8778`); documented in ADR 0003 §4.
- No 64-hex pubkey literal in any touched file (S10; I re-grepped the diff independently — none).

## Things tests can't catch
- No secrets, no `console.log`/`TODO`/`FIXME`, no commented-out code in the diff (grepped).
- Error paths: every external call in the new code is guarded (header scan/publish, item publish, item
  status scan, `importEventDirect`).
- Concurrency: the memo is a module-level `Set` mutated only after a confirmed positive; concurrent runners
  can at worst duplicate one idempotent replaceable-event publish. The cron path is sequential per pin.
- Security: no new input boundary; the observer is hex-validated before use; the d-tag is composed from
  validated fields.
- Architecture invariants: the POV cascade (`resolvePov({wotPov:'user', userPubkey: observer})`) is unchanged
  and per-pin; nothing global is precomputed; no write-time gating is introduced — the item TL is a
  read-time snapshot of one POV, and two observers' lists coexist at distinct d-tags.

## House rules check
- Concept Graph API authority respected (concepts checked live, not re-derived from BIBLE).
- No new lint/typecheck/build tooling.
- ADR-0015 legacy-literal carve-out untouched; the new TL handles are runtime-composed as ADR 0003 requires.

## Findings

### Blocking
none.

### Non-blocking
1. **`src/api/profile-tags/index.js:1714`** — `enrichRowsWithItemTLStatus(pins)` is awaited at the *end* of
   `enrichRowsWithTLStatus`, after two early `return`s (empty `wantedDTags` at `:1682`, and the 30392 scan's
   `catch` at `:1694`). E12's stated direction holds (a failing 30394 scan never disturbs `tlStatus`), but the
   converse does not: a failing or empty 30392 path skips item enrichment entirely, leaving rows at `'never'`
   instead of the `'unsupported'` they would otherwise get. Degrades safely (the UI only renders the naddr on
   `'ok'`), but "independent" is currently one-directional. Optional: hoist the call above the early returns.
2. **`src/api/trustedList/refreshPinnedTags.js:147–152`** — the header memo is never invalidated. If a relay
   copy of a header is lost after the process cached it (a dev wipe, a relay prune), TLs keep emitting a
   per-tag `z` that points at a missing event for the process lifetime. Sound under the ADR's "a header is
   never deleted" premise; worth a line in the epic's follow-ups if relay pruning is ever enabled.
3. **`src/api/trustedList/refreshPinnedTags.js:604`** — `totalTrusted` falls back to `itemTotal`, which counts
   the aggregation's item members *before* the address filter, so a partial signal on a set containing
   id-keyed members can overstate the true addressable total by a few. Signal direction is conservative
   (overstates, never understates completeness); note it if a consumer ever treats `truncated` as exact.
4. **`src/api/trustedList/refreshPinnedTags.js:171`** — `ensureTagTLHeader` accepts `deps.publish` as a header
   publisher alias while `retractStaleTLs` uses `deps.publish` as a TL publisher. Harmless today (the runners
   never pass a bare `publish`), but the overloaded alias is a future foot-gun in test fixtures.

### Harness friction
none. ADR 0003's line-citation audit of the stale Design note (the "What changed under the story's Design
note" table) did exactly what it should — every premise it corrected held up against the tree at review time.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed — reported in chat, not recorded here.
