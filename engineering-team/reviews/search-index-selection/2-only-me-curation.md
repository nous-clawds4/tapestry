# Review: search-index-selection #2 — "Only me" curation

**Reviewer:** Claude (acting as Reviewer) — Gate B, Light profile
**Date:** 2026-09-18
**Branch:** `feat/search-index-selection`
**Diff under review:** `d994c0ef` (implementation) + `d0c1e5ba` (OPEN 309 status reconcile,
one line). Test commit `3a36f66c` (Phase 3) reviewed as context, not as deliverable.
**Story:** `engineering-team/stories/search-index-selection/2-only-me-curation.md`
(Approved; AC-7 as amended 2026-09-18)
**ADR:** `engineering-team/decisions/search-index-selection/0001-author-constraint.md` (**Accepted**)
**Test plan:** `engineering-team/test-plans/search-index-selection/2-only-me-curation.md`
**Book:** `engineering-team/audits/search-index-selection/book.md` (acceptance frame, bullet 2)
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) § "The guard principle"

---

## Quality gates (run by reviewer, not trusted)

Nix shell (`direnv exec .`, no system node), each suite in the foreground, exit code captured by
brace-redirect — never piped through `tail` (OPEN #157).

| Suite | Result | Exit |
|---|---|---|
| `only-me-curation` (new, this story) | **35 passed, 0 failed, 0 skipped** | 0 |
| `pin-stack-composition` (guard — AC-4 literal whole-event fixtures) | **20 / 0 / 0** | 0 |
| `item-trusted-list` (guard) | **51 / 0 / 0** | 0 |
| `note-trusted-list` (guard) | **15 / 0** | 0 |
| `generalized-tag-pinning` (guard) | **12 / 0** | 0 |
| `context-scoped-pins` (extra guard — E4) | **32 / 0** | 0 |
| `event-tagging-read-api` (extra guard — the note/item aggregation's other caller) | **11 / 0 / 0** | 0 |
| `tl-membership-method-selector` (extra guard) | every printed assertion **✓** (U1–U7, S1, S2, L0); the run then **hung past the 180 s cap**, EXIT=124 | 124 (timeout, **not** a failure) |

The `tl-membership-method-selector` hang is after `L0 GUARD publish policy is local-only` and is
the suite's live-stack HTTP tail — pre-existing, not introduced here (it touches none of this
diff's files). Zero assertions failed in it.

- [x] **ESLint** (`ui/`), pre-vs-post comparison done the honest way — `git show d994c0ef^:<file>`
      copies written **inside `ui/src/`** so eslint would not silently skip them:
      **identical error sets before and after** — `CurationMethodDialog.jsx` 3 pre-existing
      (`no-unused-vars` on the caught `e`, two `no-constant-binary-expression`),
      `useTLDetail.js` 1 pre-existing (`react-hooks/set-state-in-effect`), `PinnedListPanel.jsx`
      clean. Only the line numbers moved. **No new lint error.**
- [ ] **Full `npm test`** — not run (capped by instruction; under Light it is the book-close /
      promotion gate). **No `npm run gate:status` line for this review** — the counts above are
      per-suite foreground runs; the full-gate verdict is owed at book close, together with
      story 1's (also deferred).
- [x] _Typecheck / build — not configured (JS-without-build)._

## Live verification (running stack, `:8778`, local relay only)

The panel's served bundle (`/assets/index-K-uw2lJf.js`) contains both `Trust scope` and
`Curation scope`, so the deployed UI is this commit. Headless Chromium with `page.route` stubs
for `/api/auth/status` + `/api/auth/user-classification` (house pattern, story-1 precedent);
nothing signed, nothing published to any relay.

**Browser — AC-1 / AC-5 read surface.** `/tag/verified-human/d16ed17c…` Pinned tab (default tab),
viewer `a666f97a…` (has real pins).
- The curation dialog renders **"Trust scope"** directly under the Method select, as two radios —
  **"My web of trust" / "Only me"** — with the helper copy. For the existing (unconstrained) pin
  the DOM reads `input[name="pcd-author-constraint"][value=""] checked=true`,
  `value="observer" checked=false`: **defaults to WoT, no silent narrowing on edit** (E3).
- The pin-detail `<dl>` ("Details and List IDs") shows Observer / Cutoff / Min rank and **no**
  "Curation scope" row on an unconstrained list — correct; the row is `tl.authorConstraint === 'observer'`-gated.

**Server, in-container, against the real corpus (2 567 pins, real strfry + Meili), publish
stubbed so nothing was written to the relay** — `runOnePin` driven with the pin's own
`curationMethod` plus an injected `authorConstraint`:

| Case | Result |
|---|---|
| unconstrained (3 distinct pins) | 1 member; tags `… ['cutoff','1'], ['min-rank','0'], ['z',…]` |
| + `authorConstraint:'observer'` | **0 members** (the sole tagger was a third party) and `['author-constraint','observer']` emitted **exactly once, immediately after `['min-rank',…]`** |
| + `authorConstraint:'list:abc'` (unknown) | membership **unchanged** (fail open), **no** disclosure tag, `extraTags` **byte-identical** to the unconstrained run, and one `[aggregateProfilesTagged] unknown authorConstraint "list:abc" ignored (unconstrained)` on stderr — at the call site, once |
| constrained pin where the observer *has* tagged (`ade8c6bc`, observer `2efaa715`) | **17 members** — AC-6 positively, live |
| same pin, membership method forced to **`certainty`** with a POV suffix the observer has no rank doc under | **status ok, 17 members, every score 50** (= `round(1 × (1 − 0.5¹) × 100)`), tags `['min-rank','0'], ['author-constraint','observer'], ['rigor','0.5']` |

That last row **is the AC-7 carve-out live**: without the 1.0 self-weight, `weightedInput` would
be 0, `certainty`'s `score >= 1` filter would drop every member, and the list would be empty
under the very method the guard is meant to run. (The instance's own dial is `count`
(`/var/lib/brainstorm/settings.json`), so the method was injected via the runner's existing
`deps.resolveMembershipMethod` seam rather than by touching operator settings.)

**Notes / items path, live** (`aggregateNotesTagged` called directly, tag `b83a28b7…:verified-human`):
unconstrained → 4 item members; `authorConstraint:'observer'` with a stranger observer → **0**;
`'weird'` → 4, **byte-identical** to unconstrained, with one `[aggregateNotesTagged] unknown
authorConstraint "weird" ignored` warn. Both aggregations behave identically on the fail-open path.

**Firmware.** `POST /api/firmware/install` did land locally: the published
`39999:<TA>:tag-pinning-schema` element on the local relay now contains `authorConstraint`
(alongside `targetTypes` / `includeScoreInTL`). OPEN 309's status line is accurate; the
`tags.brainstorm.world` reinstall is correctly still recorded as owed.

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1** the dialog option | **Pass** | `CurationMethodDialog.jsx:292-323` (radio group under the Method select); S1/S2/U1 green; live DOM + screenshot. |
| **AC-2** the pin blob carries the value | **Pass** | `CurationMethodDialog.jsx:137-152` conditional spread into `custom`; the two copies agreeing verified **by inspection** as the plan asked — `ui/src/utils/publishTagPin.js:151` binds one `curation` variable, stringified into the `curation-method` tag (`:169`) and into `content.tagPinning.curationMethod` (`:171-173`). Structural; they cannot diverge. |
| **AC-3** absent means today | **Pass** | `authorConstraintTags()` returns `[]` when absent (`refreshPinnedTags.js:40-52`); guard `pin-stack-composition` AC-4 whole-event fixtures green; H3/H5/H7/U4/A3/S4 green; live byte-identical `extraTags` on the unknown-value run. |
| **AC-4** all three runners honour it | **Pass** | `refreshPinnedTags.js:295` / `:538` / `:650` thread `{ authorConstraint, observer }`; composition inside both aggregations (`profile-tags/index.js:721-728`, `event-tags/index.js:347-353`); U2/H1/H4/H6/A1/A4/A5 green; live 1 → 0 and 4 → 0 membership swings. |
| **AC-5** the published list discloses it | **Pass** | Emitted after `['min-rank',…]` (`:366-369`) and after `['p', observer]` (`:576-580`, `:693-697`); gated on `isKnownAuthorConstraint`, so exactly one tag and none for an unknown value; parsed at `useTLDetail.js:68`, rendered at `PinnedListPanel.jsx:472-480`. Live-confirmed position and cardinality. |
| **AC-6** the observer's own taggings always count | **Pass** | `pins.js:174-180` — the constraint **replaces** the POV predicate; U3 covers the deny-all-POV and no-POV corners; live: 17 members under a POV suffix the observer holds no rank doc under. |
| **AC-7** the membership methods compose (as amended) | **Pass** | Composition happens *before* the fold (`profile-tags/index.js:721` precedes `for (const ev of deduped)` at `:730`); `membershipMethods.js` and the three folds untouched (R3/R4); `authorWeightFor` (`pins.js:190-195`) applies 1.0 only to the observer and only under a **known** constraint — A2/A3 pin both halves; live `certainty` run scores 50. Base weight is always a function (`profile-tags/index.js:706`), so composing when `wotFiltering` is false cannot produce a type error; `wotFiltering` itself is returned unchanged, so the existing "weighted method without a POV degrades to `count`" rule (`refreshPinnedTags.js:301-302`) is preserved. |
| **AC-8** regression sentinels | **Pass** | `retractStaleTLs` `carryOver` (`:466-469`) untouched — still `title`/`metric`/`observer`/`source-tag`/`z`; `min-rank`/`cutoff` emission unchanged; R1–R5, H9, context-scoped-pins 32/0. |

Edge cases: **E1** fold unchanged (filter precedes it). **E2** all three runners read
`curation.authorConstraint` *after* the `isHexPubkey(observer)` bail (`:260`, `:506`, `:624`) —
ordering preserved, H10 green. **E3** verified live in the dialog. **E4** H9 + `context-scoped-pins`.
**E5** no runner behaviour changed. **E6** U3. **E7** live, both aggregations. **E8** U2/A1.

No criterion dropped; nothing implemented beyond the story.

## ADR adherence

Every file in the diff is in the ADR's declared blast radius, and every file the ADR named is in
the diff — nothing more, nothing less (plus the `OPEN.md` row the Consequences section called for):
`src/lib/event-tagging/pins.js`, `src/api/profile-tags/index.js`, `src/api/event-tags/index.js`,
`src/api/trustedList/refreshPinnedTags.js`, `CurationMethodDialog.jsx`, `useTLDetail.js`,
`PinnedListPanel.jsx`, `publishTagPin.js` (comment only), the firmware json-schema description.

- **§1 placement** — Option A as decided: one pure composer in the SDK, composed inside both
  aggregations at the single site the predicate is built, before the fold. Verified by reading,
  by A4/A5's ordering assertions, and live.
- **§1 purity** — `pins.js` gains no `require`, no `console`, no I/O (U7). The one-time warn lives
  at the two call sites, as ruled.
- **§2 carrier** — `parseCurationMethod` and `defaultCurationMethod` untouched; new pins
  unconstrained (comment only in `publishTagPin.js:97-101`).
- **§3 dialog** — separate control, not a `method` enum value; `initTypes` discipline followed;
  conditional spread so `authorConstraint: undefined` is never written.
- **§4 disclosure** — value is the *resolved* constraint; position as ruled; `carryOver` untouched.
- **§5 read surfaces** — list-side only, one parse + one `<dl>` row.
- **§6 contextual pins** — untouched; d-tag and context `z` unaffected.
- **§7 SDK parity** — `AUTHOR_CONSTRAINTS`, `isKnownAuthorConstraint`, `authorPredicateFor`,
  `authorWeightFor` all reachable through the `...pins` spread (verified by requiring
  `src/lib/event-tagging` directly). No new dependency; `package.json` untouched.

**Ratification of the testability extraction (the plan flagged this for me).**
`composeAuthorPredicates` in `src/api/profile-tags/index.js:634-648`, exported at `:1981`, is the
plan's *first* named seam, and the Implementer built **both** it and the accepted alternative
(`authorWeightFor` in the SDK), with the composer delegating to the SDK pair rather than
re-stating the rule. **Ratified.** It is the minimum needed to make the AC-7 weight carve-out
reachable at all (neither aggregation has an injectable Meili/strfry seam), it adds no vocabulary
— the rule still lives in exactly one pure place — and it does not widen the wire, the API, or
the ADR's blast radius. It is an addition to the ADR's text, not a departure from its decision.

**Gate-A classification ratified: ADR, not Design note.** The wire-format trigger genuinely fired
(a new field on a signed `curationMethod` blob *and* a new tag on a permanent consumer interface),
and the ADR carries Options considered + Consequences per the template.

## Concept-graph integrity

- [x] Handles remain `kind:pubkey:slug`; none composed or changed here.
- [x] Concept **definition prose changed** (`tag-pinning` json-schema `curationMethod.description`)
      → firmware reinstall required, **performed locally** (verified on the relay: the published
      `tag-pinning-schema` element carries `authorConstraint`), and the remaining
      `tags.brainstorm.world` reinstall is recorded in **OPEN 309**. The Implementer also folded in
      the ADR's aside (the prose had been missing `targetTypes` / `noteMethod` since
      `dlist-item-tagging` #5) — a description-only correction, explicitly sanctioned by the ADR.
- [x] New code orients via the concepts/SDK, not by re-deriving from BIBLE.md.

## Architecture invariants

- [x] **Read-time filter, not write-time gating.** No publish path is gated; anyone may still tag
      anything. The constraint decides only whose assertions *this pin's list* folds in
      (invariants 2 and 3).
- [x] **POV-first.** The POV cascade (`resolvePov({ wotPov:'user', userPubkey: observer })`) is
      untouched; the constraint composes *after* it and is per-pin, so nothing global is asserted.
- [x] **No new TA-pubkey literal** — the diff contains **no** 64-hex literal at all (grep over
      `src/`, `ui/`, `firmware/`); `LEGACY_*` constants untouched.
- [x] **Local-first.** Read-only over the graph; nothing deleted, rebuilt, or migrated.

## Things tests can't catch

- [x] No secrets, no `console.log`, no `TODO`/`FIXME`, no `debugger`, no commented-out code. The
      two `console.warn`s are ADR-mandated and de-duplicated per value.
- [x] No race introduced — the composition is synchronous and local to one aggregation call.
- [x] Error paths: malformed/absent observer still bails first; unknown value fails open on *both*
      the predicate and the weight; a non-hex observer under a known constraint denies everyone
      rather than admitting everyone (`pins.js:177`, `:193`).
- [x] No blob-equality comparison anywhere reads `curationMethod` as a whole (only `.method`,
      `.observer`, `.targetTypes`, `.noteMethod`, `.cutoff`), so the extra field cannot flip a
      status or an export diff.
- [x] Scope creep: none. Diff = ADR blast radius + one ledger row.

## House rules

- [x] Concept Graph API authority respected; firmware reinstall performed and the remainder tracked.
- [x] No new lint/typecheck/build tooling; `package.json` / `ui/package.json` untouched.
- [x] Guard-suite carve-out honoured: the implementation commit touches **no** file under `test/`
      (verified: `git diff 3a36f66c d994c0ef -- test/` is empty).

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/profile-tags/index.js:652-660` and `src/api/event-tags/index.js:202-211`** — the
   one-time-warn helper is duplicated verbatim in two modules, each holding a module-level `Set`
   keyed by an **attacker-supplied** string (any pubkey may publish a pin carrying any
   `authorConstraint`, and `refreshAllPinnedTags` walks every pin). N distinct bogus values ⇒ N
   retained strings and N log lines, with no length cap on the value interpolated into the log.
   Bounded by the number of distinct values ever published, so the practical risk is log noise
   rather than memory, and the ADR deliberately put the warn at the call sites. *Optional:* cap
   the set (or truncate the value to, say, 32 chars) when rung 2 touches this code.
2. **`ui/src/styles.css:6947`** — `.pcd-toggle input[type="checkbox"] { margin-top: .2rem }` does
   not cover the new radios, so they sit on a slightly different baseline from the "Include"
   checkboxes. Confirmed cosmetic-only in the live screenshot; the group reads correctly.
3. **`ui/src/components/CurationMethodDialog.jsx:90-92, 137-139`** — for an *unrecognised* initial
   value the control displays "My web of trust" while an untouched save re-emits the unknown value
   verbatim: shown state and saved state disagree. This is exactly what ADR §3 asked for (never
   silently downgrade), and the case is unreachable until rung 2 exists, but rung 2 should give
   such a value a visible rendering rather than inheriting this corner.
4. **Read-surface latency.** Because the disclosure lives on the *published list* (ADR §5), a
   curator who switches a pin to "Only me" sees nothing change in the panel until the next TL
   refresh completes. Accepted by the ADR; worth knowing during the operator's local test so an
   absent "Curation scope" row immediately after saving isn't read as a defect.

### Harness friction *(for the book audit §7)*
1. `test/tl-membership-method-selector.test.js` hangs after its last printed assertion on this
   host (180 s cap, EXIT=124) — every assertion it *does* print passes. Pre-existing and unrelated
   to this diff, but it makes any gate that includes it unable to report a clean exit code.
2. Two per-story gates in a row now carry "full `npm test` not run" (story 1 and story 2). The
   Light profile puts the full gate at book close; the book close for `search-index-selection`
   inherits the full-gate debt for both stories and should state it explicitly.
3. ESLint silently skips files passed from outside the `ui/` tree, so a naive before/after lint
   comparison "passes" by doing nothing. The pre-image copies had to be written *inside*
   `ui/src/` to get a real comparison — worth a line in the reviewer notes so the next Gate B
   doesn't take an empty run for a clean one.

## Verdict
**PASS**
