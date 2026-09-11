# Review: Story 4 — Tagged items on the tag page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-11
**Profile:** Light (trial) — Gate B, full rigor (`workflows/light-profile.md`)
**Diff:** `git diff 3ba98b0f^..HEAD` — `3ba98b0f` (test OPEN-ref renumber) + `5e1a31aa` (implementation).
Test plan landed earlier at `3d204622`. Uncommitted `.envrc` / `.gitignore` / `CLAUDE.md` /
`docs/SHARED_CONCEPTS_*` excluded per scope.
**Story:** `engineering-team/stories/dlist-item-tagging/4-tagged-items-on-the-tag-page.md`
**ADR:** none (Design note — classification ratified below).
**Book frame:** `engineering-team/audits/dlist-item-tagging/book.md:23–46` (bullet 4, "Find tagged
items from the tag").

## Quality gates (run by the reviewer, not trusted)

Operator-scoped gate: the story's three suites only, each run individually in the foreground from
the repo root under `direnv exec .`, exit code captured by brace-redirect (no `tail` in the pipe of
the exit path, OPEN #157). **No full `npm test`** per the operator constraint.

| Suite | Command | Result | Exit |
|---|---|---|---|
| `test/dlist-tagged-items.test.js` | `{ BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e "require('./test/dlist-tagged-items.test.js').run()…"; echo "EXIT=$?"; }` | `{ pass: 33, fail: 0, skipped: 0 }` | 0 |
| `test/event-tagging-for-tag.test.js` | same shape | `{ pass: 15, fail: 0, failures: [], skipped: 0 }` | 0 |
| `test/strfry-write-assertion-bracket.test.js` (guard) | same shape | `{ pass: 6, fail: 0, failures: [], skipped: 0 }` | 0 |

Expected 33 / 15 / 6 — matched exactly. No skipped or vacuous tests in the changed areas; the guard
suite is untouched by the diff (`git diff --stat` shows only `test/dlist-tagged-items.test.js`, and
that change is a comment/message OPEN-number renumber 223→256, not an assertion edit — the Phase-4
carve-out is respected).

- Playwright — not applicable; the story explicitly adds no spec (Known gap; obligation 4).
- Lint / typecheck / build — not configured; skipped. No new tooling introduced (house rule OK).

## Evidence table

| Claim under review | How verified |
|---|---|
| Three scoped suites green at the stated counts | Run above, exit 0 each |
| Notes track byte-identical (E1 additivity) | Read `src/api/event-tags/index.js:344–378` — `rankedIds`, `memberOf`, `members`, `fullMembers`, `total`, `truncated` unchanged; `memberOf` still reads the raw maps, not the generalized comparators. Plus R8 (hand-written pre-change expectation) |
| `a:` key prefix cannot collide with a 64-hex id | Read `:346–350`; `startsWith('a:')` needs `:` at index 1, not a hex character. Notes keys are bare ids from `latestByNote` |
| No address leaks into `members`, no id-keyed member gets `address` | `itemMemberOf` `:389–401` spreads exactly one of `{address}`/`{id}`; R8 asserts `!('address' in m)` for members |
| `refreshPinnedTags` still a three-key non-consumer | `grep -n fullMembers src/api/trustedList/refreshPinnedTags.js` → `:351` `const { fullMembers, scanTruncated, total }` — all three unchanged; file not in the diff |
| `ui/src/pages/List.jsx`, `ui/src/components/dlist/*`, `src/api/trustedList/*`, `protocols/drafts/trusted-lists.md` untouched | `git log --oneline 3ba98b0f^..HEAD -- <paths>` → empty |
| Integration-guide edit additive + cap line accurate | Read the diff; `NOTES_CAP = 50` at `src/api/event-tags/index.js:42` is the single value applied to both tracks — the corrected checklist line is accurate |
| No secrets / debug logging / hardcoded TA pubkey | `grep -nE '^\+.*(console\.(log|debug)|TODO|FIXME|nsec|api[_-]?key|82b75e47)'` over the diff → no hits |
| Curated/expanded parity with Notes | `TagItemsView.jsx:135` vs `TagNotesView.jsx:64` — identical `(applications - disputes) >= 1 || !!mine` rule |

## Gate-A classification — ratified

Irreversibility walk re-run against the **actual** diff, not the design prose:

- **Wire format / event shape** — no. The diff publishes nothing; the JSON envelope only gains
  `items` / `itemTotal` / `itemTruncated` (`:569`). `fullMembers` is untouched, so the kind-30393
  note TL is bit-for-bit what it was.
- **Auth / trust default** — no. One `trustPredicateFor`, unchanged; both key spaces read the same
  `targets`/`mine` result.
- **Schema / firmware / concept definitions** — no. No concept definition changed; no
  `POST /api/firmware/install` needed. Concept handles appear in prose only, in `kind:pubkey:slug`
  form.
- **New dependency** — no. All imports pre-existed.
- **Cross-repo contract** — not tripped *as a narrowing*: every documented field keeps its meaning
  (R8), and the guide edit only adds. But see Blocking 1 — the guide now documents an `items[].kind`
  the server can state falsely, so the additive edit publishes one inaccurate field.
- **Routing / middleware order / headers** — no. Same route, same handler, same content type.
- **Value existing in more than one repo** — no.

**Verdict: Design note, correctly classified.** No escalation to a full ADR required.

## Spec adherence — AC verdict table

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 — `a` targets returned as a distinct items group, POV-counted, not dropped, not mixed into notes | **PASS** | U1–U4, U13, R8 green; read of `:291–336` (address + id tracks built alongside) and `:384–404` |
| AC-2 — third **Items** switch with a count | **PASS** | `Tag.jsx:343–358` button inside the *default* tab; `:361–363` eager `hidden=` mount with `onCount`; S1, S2 green |
| AC-3 — header-driven rendering, story-3 affordance, per-list groups linking to `/list/<coord>` | **PASS** | `TagItemsView.jsx:186–209`; U14, U15, S3, S4 green |
| AC-4 — header not on local strfry → coordinate + author + "list not on this relay", no crash | **PASS** | `TagItemsView.jsx:198–200` marks the group only when the header query came back empty (obligation 4 honored); U16, S5 green |
| AC-5 — same sort/recency controls + POV disclosure; disputes bucket as on notes | **PASS** | `TagItemsView.jsx:148–161` reuses `TagViewControls`; curated rule identical to `TagNotesView.jsx:64`; U2, U8, S6 green |
| AC-6 — Notes and Profiles unchanged | **PASS** | R1–R8, U7 green; `TagNotesView.jsx` not in the diff; hook return keys strictly appended (`useNotesForTag.js:74`) |

Edge cases E1–E11 all carry a green handle; E4's zero-field branch is pinned as UI copy only, which
the Tester already declared non-server-observable (obligation 4) — accepted.

**Implementation obligations 1–6** are each resolved in the story's `## Deviations` and each matches
the code I read: 1 → `:479–496` try/catch; 2 → `:330–335` try/catch; 3 → `normalizeAddress` `:299–302`;
4 → `TagItemsView.jsx:198`; 5 → `listCoordOf` `:545–550` (first matching tag in event order);
6 → `Tag.jsx:361`. Obligation 3's consistency probe: `itemMembers` is a `slice(0, NOTES_CAP)` of
`fullItemMembers` (`:402–403`), so the two cannot disagree about normalization by construction, and
case-variant merging builds a **fresh** `{applications, disputes}` object (`:310–314`) rather than
mutating the `groupTaggingsByTarget` result.

## Findings

### Blocking

1. **`src/api/event-tags/index.js:557`** — an unresolved `a` member is *asserted* to be kind 39999:
   `kind: ev ? ev.kind : (m.address ? 39999 : null)`. The address track admits **any** `a` coordinate
   (`src/lib/event-tagging/classify.js:130–136` puts the first `a` tag in the target with no kind
   constraint), and the resolution scan at `:536` only looks for `kinds: [39999]`, so a
   `30023:<pk>:<slug>` (long-form) or any other addressable target lands here unresolved and is
   labelled 39999. Two consequences:
   - The response field is simply false, and `docs/INTEGRATION_GUIDE_…:158–163` now documents
     `kind` to external clients, so the falsehood is published on a cross-repo surface.
   - **Signed-write hazard.** `TagItemsView.jsx:44–52` (`toTableItem`) synthesizes a `d` tag from
     the coordinate for exactly these degraded rows; `DListItemTags` → `itemTarget`
     (`ui/src/utils/dlistFields.js:155–166`) then gates on `item.kind === 39999` and produces
     `39999:<pk>:<d>`. For a `30023:` target that is a **different coordinate from the row's own
     `address`**: the row shows the tags of a coordinate that isn't it, and applying/disputing from
     the row publishes a signed assertion aimed at a coordinate that does not exist. Story 5 will
     then carry the *real* (`30023:`) address into a kind-30394 `a` member, so the two surfaces
     disagree about the same row.

   This is not hypothetical for this repo's direction — long-form (`30023`) `a`-target taggings are
   an actively-planned client scenario, and publication is permissionless by architecture principle 2,
   so the code may not assume every `a` target is a list item.

   **Asked change:** derive the kind from the coordinate instead of assuming it —
   `kind: ev ? ev.kind : (m.address ? Number(m.address.split(':')[0]) : null)` — and make the
   client-side `d` synthesis (`TagItemsView.jsx:46`) conditional on the coordinate's kind being
   39999, so a non-39999 degraded row renders (E2/E3 still satisfied) without offering a mis-aimed
   tag affordance. Add one handle to `test/dlist-tagged-items.test.js` for a non-39999 `a` target
   (U16's fixture with a `30023:` coordinate) — this is a behavior no current handle pins. U16 uses a
   39999 coordinate, so the fix cannot regress it.

### Non-blocking

1. **`src/api/event-tags/index.js:479–496`** — the E11 try/catch is wider than obligation 1 asked
   for: it wraps `resolveGeneralPurposeRelays` (a neo4j round-trip) and the pure hint-collection
   loop as well as `realQuerySync`, and the handler is `catch { externalNotes = []; }` with no log.
   A programming error (TypeError in the loop) now silently degrades to "no external notes" where it
   previously surfaced as a 500. Same silence at `:335` and `:536`. Suggestion: a one-line
   `console.warn` in each of the three catches — degrade-by-design is right, invisible degradation
   isn't.
2. **`src/api/event-tags/index.js:305–314`** — two case-variant coordinates merge by concatenating
   `applications`/`disputes`, so one asserter who published both casings is counted twice. This
   matches the notes track's existing (non-per-author-deduped) behavior, so it is consistent rather
   than a regression — noted only because obligation 3 made the merge explicit.
3. **`src/api/event-tags/index.js:545–550`** — `listCoordOf` takes the *first* `z` tag of a
   kind-39999 event as the parent list coordinate. Kind 39999 is overloaded in this repo (tag
   elements carry a `z` naming a `39998:<TA>:<concept>` handle), so a tagged **tag element** would be
   grouped under a concept handle and rendered as if it were a list. This follows from the design's
   own "items = anything kind-39999" routing rule (E2 ratified at J1), not from the implementation —
   flagged for the epic's ledger, not as a change ask here.
4. **Story-5 forward note** — the eligibility discriminator is "`address` is present", which would
   admit a `30023:` (or any non-39999) coordinate into a kind-30394 item Trusted List. Story 5 should
   decide explicitly whether to restrict to `39999:` before publishing.
5. **`ui/src/pages/Tag.jsx:361`** — the eager mount fires a `for-tag` request on every tag-page load,
   including while the Pinned tab is active (the default tabpanel stays mounted). Declared and
   accepted in the Design note; recording it so the cost is traceable if tag-page latency is measured
   later.
6. **`ui/src/components/TagItemsView.jsx`** — the Items count reads `(0)` until the first response
   lands. Cosmetic; AC-2's "shows a count" is satisfied.

### Operator step not attempted

A signed-in browser check of the Items switch on `localhost:7778` — the third switch appearing with
its count, a group heading linking to `/list/<coord>`, a degraded "list not on this relay" group, and
the story-3 tag affordance on a row — is the operator's Gate-B step. I did not attempt it; the JSX
half is pinned by source contract only (the story's Known gap), so browser confirmation is the only
execution evidence available for AC-2/-3/-4 rendering.

### Harness friction
1. None. The story file carried everything needed (Design note, obligations, Deviations, AC→handle
   lines); the scoped gate ran exactly as named at Gate A.

## Concept-graph integrity
- Handles appear only as documentation (`39998:<TA>:nostr-event-tag`, `tagging-with-specific-tag`,
  `list`), in `kind:pubkey:slug` form. No concept definition changed → no firmware reinstall needed.
- No TA-pubkey literal introduced (grep clean); the diff adds no identity check.

## House rules
- [x] No new lint/typecheck/build tooling.
- [x] Concept Graph API authority respected (no re-derivation from BIBLE.md).
- [x] Read-time POV filtering preserved; no per-POV denormalization added; cache key unchanged
      (R5 green).

## Verdict
**CHANGES_REQUESTED**

One blocking issue (Blocking 1, two loci with a single root cause). Everything else in the diff is
sound: the additivity guarantee holds by reading as well as by sentinel, the comparator
generalization is collision-free, the collateral surfaces are genuinely untouched, and all three
scoped suites are green at the expected counts.

## On PASS (not applicable this round)
- [ ] Story `**Status:**` → `Done` (withheld — verdict is CHANGES_REQUESTED).
- [ ] Completion detection — not run; book bullet 4 cannot be marked satisfied until the fix lands.

---

## Re-review — 2026-09-11 (narrow, Blocking 1 only)

**Diff under re-review:** `git show f03aa3c9` — "fix(tags): an a-target keeps its own kind".
Four code/test files (`src/api/event-tags/index.js`, `ui/src/utils/dlistFields.js`,
`ui/src/components/TagItemsView.jsx`, `test/dlist-tagged-items.test.js`) plus this review file.
`git status` clean apart from the pre-existing out-of-scope untracked files (`.envrc`,
`docs/SHARED_CONCEPTS_*`). Nothing outside the fix changed. The original review body above is
unmodified.

### Gates (re-run by the reviewer, individually, foreground, `direnv exec .`, no full `npm test`)

| Suite | Result | Exit | Expected |
|---|---|---|---|
| `test/dlist-tagged-items.test.js` | `{ pass: 34, fail: 0, skipped: 0 }` | 0 | 34 (33 + U20) ✓ |
| `test/event-tagging-for-tag.test.js` | `{ pass: 15, fail: 0, failures: [], skipped: 0 }` | 0 | 15 ✓ |
| `test/strfry-write-assertion-bracket.test.js` | `{ pass: 6, fail: 0, failures: [], skipped: 0 }` | 0 | 6 ✓ |
| `test/dlist-item-tagging.test.js` (story-3 regression on `itemCoord`) | `{ pass: 20, fail: 0, skipped: 0 }` | 0 | 20 ✓ |

### Blocking 1 — resolved

1. **Server kind derivation** (`src/api/event-tags/index.js:557`) — now
   `kind: ev ? ev.kind : (m.address ? (Number(m.address.split(':')[0]) || null) : null)`. The
   coordinate's own kind prefix is the source of truth; a non-numeric prefix (possible, since
   `normalizeAddress` `:299–302` passes a non-matching string through verbatim) yields `null` via
   the `|| null`, not `NaN`. The guide-documented `items[].kind` can no longer state a falsehood.
2. **`itemCoord` short-circuit** (`ui/src/utils/dlistFields.js:155–160`) — returns an explicit
   `item.address` verbatim before the kind-39999 re-derivation. I checked this against story 3
   rather than taking the claim: the only `itemTarget`/`itemCoord` consumers are
   `DListItemTags` (`ui/src/components/dlist/DListItemTags.jsx:12`), mounted from
   `ui/src/pages/List.jsx:169` and `ui/src/components/TagANoteModal.jsx:272`. Both feed it raw
   relay events — `queryRelayBounded(itemsFilter(header))` (`List.jsx:84,105`) and
   `queryRelay({kinds:[39999],…})` (`TagANoteModal.jsx:74`) — and `ui/src/api/relay.js` adds no
   `address` key (grep: zero hits). So the short-circuit is unreachable on every story-3 path;
   the story-3 suite's 20/20 confirms it. On the story-4 path the field is the coordinate the row
   is keyed by, which for a *resolved* 39999 item is byte-identical to the old derivation (the
   resolution map is keyed by that same `39999:<pk>:<d>` string), so no resolved row changes either.
   **Approach judged right, not a papering-over:** the defect was re-deriving a coordinate that the
   caller already holds authoritatively. Preferring the carried coordinate removes the whole class
   of mint-a-different-address bugs, rather than special-casing 30023. The kind fix (1) and this are
   independent belts — either alone would close the write hazard; together the row's affordance
   provably publishes at the address the row is keyed by.
3. **`d` synthesis gated** (`ui/src/components/TagItemsView.jsx:46`) — `item.kind === 39999` added,
   so a degraded non-39999 row no longer gets a fabricated `d` tag. E2/E3 rendering is unaffected
   (U16 + S5 still green; U16's fixture is a 39999 coordinate).
4. **U20** (`test/dlist-tagged-items.test.js:533–549`) pins a `30023:<owner>:my-article` target's
   `kind === 30023` and re-asserts a real 39999 row still reports 39999. **It would have failed
   before the fix**: the coordinate is never in `itemEventByAddress` (the resolution scan is
   `kinds:[39999]` and the map is keyed `39999:<pk>:<d>`, so even a same-author same-`d` 39999
   event keys under a different string), so `ev` is undefined and the old expression returned the
   literal `39999` — `row.kind === 30023` fails. It is a genuine regression pin, not a tautology.
5. **Non-blocking finding 2 (silent catches)** — all three now `console.warn` with the error
   message (`:335`, `:496`, `:536`); U17/U18 show the lines emitting under fault injection. Closed.

### New findings (both non-blocking, neither gating)

1. **`ui/src/components/TagItemsView.jsx:38–43`** — the `toTableItem` doc comment still says the
   re-derived `d` "keeps `itemTarget` pointing at the same `a` address the row is keyed by." After
   change 2 that is no longer the mechanism — `itemCoord` uses `address` directly, and the `d`
   synthesis is now purely for `DListItemsTable` display. Stale rationale in a comment; worth a
   one-line edit whenever this file is next touched.
2. **Malformed-coordinate behavior changed shape (not severity).** A junk `a` value (e.g. `"foo"`)
   survives `normalizeAddress` verbatim, now reports `kind: null`, and `itemCoord` returns `"foo"`
   as the target address — where previously it produced `39999:<pk>:foo`. Both are garbage; the new
   one at least echoes exactly what the tagger published rather than inventing a coordinate.
   No new hazard, recorded for completeness.

Findings 3–6 and non-blocking 2–5 from the original round are unchanged and remain non-gating;
finding 4 (story-5 eligibility discriminator "`address` is present" admitting a `30023:`) is now
*more* visible, since `items[].kind` makes the non-39999 case detectable — story 5 should use it.

### Re-checked, unchanged
- No secrets, debug `console.log`, TODO/FIXME, or TA-pubkey literal in the fix
  (`grep -nE '^\+.*(console\.log|TODO|FIXME|nsec|api[_-]?key|82b75e47)'` over `f03aa3c9` → clean;
  the three `console.warn`s are the asked-for change).
- No new lint/typecheck/build tooling. No concept definition changed → no firmware reinstall.
- Response shape still additive; `members`/`fullMembers`/`total`/`truncated` untouched (R8 green).
- Operator's browser check of the Items switch on `localhost:7778` remains the outstanding Gate-B
  step, as recorded above — the JSX half is pinned by source contract only.

## Final verdict
**PASS**

Blocking 1 is closed at both loci, with the right fix (authoritative-coordinate preference plus
coordinate-derived kind) rather than a symptom patch, pinned by a new handle that provably fails
against the old code. All four scoped suites green at 34 / 15 / 6 / 20, including story 3's suite as
the regression guard on the `itemCoord` change.

## On PASS
- [x] Story `**Status:**` → `Done` (set in `engineering-team/stories/dlist-item-tagging/4-tagged-items-on-the-tag-page.md`).
- [ ] Story file NOT moved — retirement is per-epic; the `dlist-item-tagging` folder moves under
      `done/` only at epic close-out.
- [ ] Completion detection: book bullet 4 ("Find tagged items from the tag") is now satisfied;
      story 5 (kind-30394 item TL) is still open, so the book is not complete.
