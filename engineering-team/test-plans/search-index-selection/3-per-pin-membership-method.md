# Test Plan: search-index-selection #3 — per-pin membership method

**Story:** `engineering-team/stories/search-index-selection/3-per-pin-membership-method.md` (Approved; Light lane + ADR, Gate A 2026-09-18, scoped gate corrected by the story's Amendment)
**ADR:** `engineering-team/decisions/search-index-selection/0002-per-pin-membership-method.md` (**Accepted**, J1 2026-09-18)
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3), § "Design note: per-pin curation implies multiple pins per tag" (`:187-225`)
**Ledger:** OPEN 307 (`OPEN.md:363`)
**Date:** 2026-09-18
**Suite:** `test/per-pin-membership-method.test.js` (new; registered in `test/registry.js:225`, beside `only-me-curation.test.js`)

## Scoped gate (Gate A, as corrected by the story Amendment)

```
test/per-pin-membership-method.test.js   (new — this story's suite)
test/pin-stack-composition.test.js       (guard, EXCEPT the two AC-4 30392 fixtures — re-aimed below)
test/only-me-curation.test.js            (guard, EXCEPT H3 — re-aimed below)
test/item-trusted-list.test.js           (guard)
test/note-trusted-list.test.js           (guard)
test/tl-weighted-sum-method.test.js      (re-aim target, live-stack — operator runs it at Gate B)
```

**Guard-suite carve-out (`templates/adr.md`).** Phase 4 **must not edit any test file**. The five
re-aims below were made in Phase 3, deliberately, and are itemised so a reviewer can diff them.
`test/item-trusted-list.test.js` and `test/note-trusted-list.test.js` are untouched and remain the
owners of the note/item runners' behaviour (E1).

## Test classes

| Class | What it drives | Level |
|---|---|---|
| **U** | the new pure registry predicate `isImplementedMembershipMethod` in `src/api/trustedList/membershipMethods.js` | unit, no I/O |
| **H** | `runOnePin` / `runOneNotePin` / `runOneItemPin` through **injected deps** — which fold actually ran, what the published event discloses and where, fail-open + warn, the WoT downgrade, composition with ADR 0001, the dial-flip sentinel | behavioral, stack-free |
| **S** | source sentinels: the dialog select, the single UI vocabulary module, the Trust Determination copy, the two read surfaces, the firmware schema, the client default, the retired strip comment, the no-TA-literal rule | structure |
| **R** | regression sentinels on the deliberately untouched surfaces (green **before and after**) | unit + structure |

The **behavioural** seam is the one the ADR chose deliberately (Option A): the injected
`deps.resolveMembershipMethod` stays the **zero-arg dial**, so a suite that stubs the dial still
exercises the *real* precedence code. Every H handle therefore tests shipped logic, not a mock —
that is why AC-1 cannot pass vacuously here (the ADR's stated reason for rejecting Option B).

## Coverage map

| Criterion | Handle | What it pins | Level |
|---|---|---|---|
| **AC-1** the pin's method wins | **H1, H2, H12, U1** | the sharpest sentinel: one corpus, one observer, a dial stubbed to `'count'`, a pin carrying `membershipMethod:'certainty'` ⇒ the **certainty** fold runs (integer 0–100 scores, score-desc order M2 75 / M1 50) and the list says `certainty`. H12 runs the same pin under two different dials and gets identical output | behavioral |
| **AC-2** absent means today | **H3, H4, H12, R3, S8** | an absent field ⇒ the dial supplies the fold (`'input'` dial ⇒ weighted-sum scores); under a `'count'` dial the 30392 tag array is exactly today's array **plus the one disclosure tag** and nothing else; the dial still moves method-less pins; the resolver and its fail-safe are untouched; new pins still carry no method | behavioral + unit + structure |
| **AC-3** fail-safe, per pin | **U2, H5, H6, H7** | the predicate rejects absent / unknown / future-rung / non-string / case-variant values; an unknown per-pin value **fails open to the dial**, still publishes (`status:'ok'`), discloses the dial's fold, and warns **once**; absence warns **never**; the weighted→`count` WoT downgrade still applies to the per-pin value | unit + behavioral |
| **AC-4** the list discloses the fold that ran | **H2, H3, H5, H7, H8, H10, S9** | exactly one `['membership-method', <id>]` on **every** 30392 — neutral, contextual, constrained, downgraded; value = the **post-downgrade, post-fail-open** variable; position = immediately after `authorConstraintTags(...)`/`min-rank` and immediately **before** `rigor`, ahead of the discovery `z` pair; the Story-4 strip comment is gone | behavioral + structure |
| **AC-5** the curation dialog sets it | **S1, S2, S3** | a "Membership method" `<select>` whose first option is `value=""` "Instance default"; seeded from `init.membershipMethod`; raw value + `touched` flag so an untouched control re-emits verbatim; conditional spread, never `membershipMethod: undefined`. *(The two published copies agreeing is **structural** — `pinTag` stringifies one variable into both, `publishTagPin.js:169,171`; not covered by a handle, same call as story 2's plan.)* | structure |
| **AC-6** the dial's copy tells the truth | **S4, S3** | the card describes itself as the "default for pins that don't choose", says a pin's own choice wins, and its claim becomes "records the method that actually ran"; the now-false "One setting for the whole pipeline" is gone; the page imports the vocabulary instead of declaring it | structure |

## Edge cases

| Edge case | Handle | How it is covered |
|---|---|---|
| **E1** per-pin method on a note/item pin | **H9, R4** | a `membershipMethod` on a note/item pin changes nothing: no `membership-method` tag on the 30393/30394 (they already carry `['curation-method', noteMethod]`), and neither runner consults the dial at all (`dialCalls.length === 0`). R4 adds a source sentinel that neither runner body mentions `membershipMethod` — Gate A ruling 1, the two vocabularies stay two fields. |
| **E2** a weighted per-pin method with no WoT filter | **H7** | `membershipMethod:'certainty'` with `wotFiltering:false` ⇒ the **count** fold runs (score-less members), the disclosure reads `'count'`, and no `rigor` tag rides. The disclosure is post-downgrade, never the requested method. |
| **E3** per-pin method × `authorConstraint:'observer'` | **H11** | the day-one search-index pin. Both fields reach their stages — the constraint into the aggregation, the method into the fold — both are disclosed on one list, and ADR 0001's observer self-weight **1.0** still holds under a per-pin `certainty` (re-checked through story 2's pure `composeAuthorPredicates` seam, since the carve-out is a property of the weight function, not of any fold). |
| **E4** the operator flips the dial after this story | **H12, H10** | a pin with an explicit method publishes identical members **and** identical tags under a `count` dial and a `certainty` dial; a pin without one moves, and each list honestly names its own fold. H10 adds the contextual case: identity (`d`-tag, context `z`) is untouched — only the disclosure differs. |
| **Not covered (story § Edge cases):** rung 2 (`author ∈ <list>`); naming the `worth-indexing-for-search` tag; what a search backend does with the list. | — | Out of scope by the story. |

### Not derivable from any acceptance criterion (J2 rubric 1)

- **U3** — the predicate must stay **pin-blind and pure**: arity 1, no `getSettings`/`require`, no
  `console`. Nothing in the ACs says so. It is the guard against the rejected Option B creeping
  back in as "the registry may as well read the pin too", which would silently discard the pin's
  choice under every existing argument-blind stub.
- **H6** — the fail-open warn must be **silent on absence**. No AC mentions it, and the natural
  implementation (`if (!isImplemented(v)) warn(v)`) logs once per pre-story pin per refresh cycle,
  forever, on every deployment. Every pin published to date omits the field.
- **H13** — the injected dial seam must stay **zero-arg**, and precedence must gate on the shared
  `isImplementedMembershipMethod` rather than on truthiness or a second inline vocabulary. A
  truthiness gate would let `'rung-9'` through and publish an over-claiming list.
- **S9** — the Story-4 strip comment ("the ladder's membership-method tag is stripped (never
  spec'd)") must be **deleted**, not left beside the code that now contradicts it. A stale comment
  is the next reader's false premise; nothing in the ACs asks for its removal.
- **R1** — `retractStaleTLs`'s `carryOver` must **not** learn `membership-method`. The tempting
  "carry every tag forward" edit is invisible until a consumer reads a retracted (empty) list as
  still characterised by a fold.
- **R2** — `enrichRowsWithTLStatus` must not start reading the method. If it does, a *scoring*
  field has leaked into an *identity* path — precisely the confusion story 5 exists to resolve.
- **S10** — no 64-hex literal in any touched file (CLAUDE.md's per-deployment TA rule).

### Error paths for the external dependencies the design touches

| Dependency | Covered? |
|---|---|
| **Settings store** (`resolveMembershipMethod` → `getSettings`) | **R3**: unreadable settings still fail safe to `'count'` (this host has none), and the resolver keeps its zero-arg signature and its fresh-per-call read. The pin falls back to the dial; the dial falls back to `count`. |
| **A malformed / unknown pin blob value** | **H5, H6, U2** — fail open, publish anyway, warn once, disclose honestly. |
| **The aggregation returning `wotFiltering:false`** (Meili/POV absent) | **H7** — the existing downgrade, now applied to the per-pin value, with an honest disclosure. |
| **strfry / Meili throws inside the aggregation** | **Not covered, deliberately.** Unchanged by this story — no new failure mode, no injectable client; owned by `note-trusted-list` / `item-trusted-list` (guards). |
| **`publishTL` / relay refusal** | **Not covered by a new handle** — unchanged; `item-trusted-list` already drives the `publishThrows` path. |
| **The concept graph / firmware install** | **S7** pins the schema prose only. `POST /api/firmware/install` (ADR Consequences — **required**) is an operator action verified at Gate B, not by this suite. |

## Re-aims made in Phase 3 (the Tester's lane — every changed line)

AC-4 reverses the Story-4 strip, so five suites that asserted the tag's **absence** are amended
here, deliberately, so the Implementer never has to touch a test. Everything else in those files
is untouched.

| File | Line(s) after edit | Change |
|---|---|---|
| `test/only-me-curation.test.js` | `390-392` (H3 fixture) | inserted a 2-line comment + `['membership-method', 'count'],` after `['min-rank','0.25'],` in the deep-equal `extraTags` array. The stub dial for `profileDeps` is `'count'`. |
| `test/pin-stack-composition.test.js` | `307-309` (AC-4 **count** fixture) | inserted a 2-line comment + `['membership-method', 'count'],` after `['min-rank','0.25'],`. |
| `test/pin-stack-composition.test.js` | `329-331` (AC-4 **certainty** fixture) | inserted a 2-line comment + `['membership-method', 'certainty'],` after `['min-rank','0.25'],` and **before** `['rigor','0.5'],`. |
| `test/tl-weighted-sum-method.test.js` | `322-327` (LA, fallback path) | absence assertion → `assertEqual(tl.tags.find(x=>x[0]==='membership-method')?.[1], 'count', …)`. **Live-stack.** |
| `test/tl-weighted-sum-method.test.js` | `387-391` (LB, seeded POV) | absence assertion → `assertEqual(…, 'input', …)`. **Live-stack.** |
| `test/tl-weighted-sum-method.test.js` | `428-431` (LC, back to count) | absence assertion → `assertEqual(…, 'count', …)`. **Live-stack.** |
| `test/tl-certainty-method.test.js` | `286-289` (LB) | absence assertion → `assertEqual(…, 'certainty', …)`; the `rigor` assertion beneath it is unchanged. **Live-stack.** |
| `test/tl-membership-method-selector.test.js` | `369-374` (L1+L2 body) | absence assertion → `assert(tl.tags.some(x => x[0]==='membership-method' && x[1]==='count'), …)`. **Live-stack.** |

**Deviation from the ADR's re-aim table — flagged for the Reviewer.** The ADR's Implementation
notes give the three `tl-weighted-sum-method` expectations as `'input'`, `'input'`, `'count'`,
mapping each to the **dial** its setup writes (`:304`, `:337`, `:417`). For the first one (LA) that
is wrong on the story's own rule: LA deliberately runs with **no POV filter**, so a weighted dial
degrades to `count` (E2), and its own next assertion — "fallback TL must carry plain p tags (no
score)" — proves the count fold ran. AC-4 requires the **post-downgrade** fold, so this plan
re-aims LA to `'count'`. The other two match the ADR.

**The three live-stack suites were edited but NOT run** (`tl-weighted-sum-method`,
`tl-certainty-method`, `tl-membership-method-selector`): they publish through a running control
panel and strfry and hang without a live stack (`test/registry.js:205-207`). The **operator runs
them at Gate B**. Their edits are single-assertion swaps, listed line-by-line above.

## Test infrastructure

- Framework: Node built-in runner, house `module.exports = { run }` shape returning
  `{pass, fail, skipped, failures}`. Harness modelled directly on `test/only-me-curation.test.js`
  (injected deps + `process.env.TA_PUBKEY` provisioned before any server module loads).
- **No live stack, no relay, no graph state, no Playwright.** No `POST /api/firmware/install`
  prerequisite for the suite itself (the firmware reinstall the ADR requires is verified at Gate
  B). `BRAINSTORM_BASE_URL=http://localhost:8778` is set in the run command for house consistency;
  this suite never calls it. **No suite was skipped for want of the stack** (skipped = 0).
- `TA_PUBKEY` is provisioned to a fixture stand-in (`f…f1`); every `z` expectation is derived from
  `profileTags.TA_PUBKEY` at runtime — never a literal.
- Fixtures: `makePin({ membershipMethod, authorConstraint, contextSlug, cutoff, targetTypes })`
  omits `membershipMethod` from the published blob entirely when unset (a pre-story pin).
  `profileDeps({ dial, wotFiltering })` injects the **zero-arg** dial stub and records its call
  arguments (H13).
- One corpus throughout, with hand-computed expectations per fold — `count`: `[M1, M2]`, no score
  key; `input`: same order, scores 1 / 2; `certainty`: `[M2 75, M1 50]` (score-desc). The
  score *shape* is what makes "which fold ran" observable without reading the source.
- Module loads go through `safeRequire` / `rd`, so a missing export or file reports as a named
  assertion, never a crashed run. `console.warn` is captured per call (`withWarnCapture`) and the
  unknown-value fixtures use a **fresh random** id so the implementation's dedupe `Set` cannot
  mask the warn across handles.

## How to run

```
cd /home/vcavallo/src/tapestry
for t in per-pin-membership-method pin-stack-composition only-me-curation; do { timeout 180 env BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e "require('./test/$t.test.js').run().then(r=>{console.log('$t',JSON.stringify({pass:r.pass,fail:r.fail,skipped:r.skipped}));process.exit(r.fail?1:0)})"; echo \"EXIT=\$?\"; } 2>&1; done
```

Live-stack re-aim targets (operator, Gate B, stack up on `:8778`):
`test/tl-weighted-sum-method.test.js`, `test/tl-certainty-method.test.js`,
`test/tl-membership-method-selector.test.js`.
Full gate (`npm test`) at book close / promotion.

## Verification — pre-implementation

Run 2026-09-18 at commit `cae6934b` (branch `feat/search-index-selection`), before any
implementation:

| Suite | Result | Reading |
|---|---|---|
| `per-pin-membership-method` | **9 passed, 22 failed, 0 skipped** (exit 1) | 31 handles; the 9 green are the regression/invariant sentinels that must stay green afterwards |
| `pin-stack-composition` | **18 passed, 2 failed, 0 skipped** (exit 1) | exactly the two re-aimed AC-4 30392 fixtures, which now expect the disclosure tag |
| `only-me-curation` | **34 passed, 1 failed, 0 skipped** (exit 1) | exactly the re-aimed H3 fixture |

Passing by design in the new suite (green **before and after**): **H6** (silent on absence),
**H9** (30393/30394 gain nothing), **S8** (new pins carry no method), **S10** (no TA literal),
**R1–R5**.

```
  ✗ U1 (AC-1): the registry exports isImplementedMembershipMethod, true for every implemented id
      ADR §1: src/api/trustedList/membershipMethods.js must export the pure predicate isImplementedMembershipMethod(v) — the vocabulary check belongs in the module that owns the vocabulary. Load error: none.
  ✗ U2 (AC-3): the predicate is false for absent, unknown, future-rung and non-string values
      ADR §1: membershipMethods.js must export isImplementedMembershipMethod(v).
  ✗ U3 (ADR §1): the predicate stays pin-blind and pure — no settings read, no logging
      ADR §1: membershipMethods.js must export isImplementedMembershipMethod(v).
  ✗ H1 (AC-1, the sharpest sentinel): the pin's 'certainty' beats a 'count' dial — the certainty fold RUNS
      AC-1: on a deployment whose dial says 'count', a pin carrying membershipMethod:'certainty' must be folded by CERTAINTY — integer 0–100 scores, score-desc order (M2 75 before M1 50). Got [{"tag":"p","value":"1111…"},{"tag":"p","value":"2222…"}]. (A 'count' fold publishes score-less p tags in endorsements-desc order — that is what a failure here looks like.)
  ✗ H2 (AC-4): that same list discloses ['membership-method','certainty'] exactly once
      AC-4: exactly one ['membership-method', …] tag on every 30392; got 0 (extraTags: [["observer","aaaa…"],["source-tag",…],["cutoff","1"],["min-rank","0.25"],["z","39998:…:trusted-list"],["z","39999:…:tl:funny-tls"]]).
  ✗ H3 (AC-2): an ABSENT membershipMethod still follows the instance dial, and the dial's value is disclosed
      AC-4: the disclosure names the dial's fold when the pin chose nothing; got [].
  ✗ H4 (AC-2): under a 'count' dial an absent-method pin publishes today's 30392 plus exactly the one new tag
      AC-2 + AC-4: a pre-story pin's 30392 tag array must be exactly today's array with the ONE disclosure tag inserted after ['min-rank', …] — no other tag added, removed, reordered or revalued. Got [… no membership-method …].
  ✗ H5 (AC-3): an UNKNOWN per-pin value fails OPEN to the dial, discloses the dial's fold, and warns once
      AC-4: the list never over-claims — it discloses the fold that ran (the dial's), never the unrecognised request "bogus-1x3nej"; got [].
  ✓ H6 (ADR §1): the warn is SILENT when the field is simply absent — a pre-story pin is not a defect
  ✗ H7 (E2, AC-3): a weighted per-pin method with the WoT filter OFF downgrades to count — and says 'count'
      AC-4 / E2: the disclosure records the POST-DOWNGRADE fold — the math that actually ran, never the method the pin requested; got [].
  ✗ H8 (AC-4, ADR §2): the tag sits after author-constraint/min-rank and immediately before rigor
      ADR §2: with no author constraint the disclosure rides immediately after ['min-rank', …]; tag order was ["observer","source-tag","cutoff","min-rank","z","z"].
  ✓ H9 (E1): the 30393 and 30394 gain NOTHING — they already disclose their own per-pin fold
  ✗ H10 (E4 of ADR 0001): a CONTEXTUAL pin is unchanged apart from the disclosure tag
      AC-4: a contextual list discloses its fold too — the tag rides EVERY 30392; got [].
  ✗ H11 (E3): membershipMethod composes with authorConstraint — both honoured, both disclosed
      E3: the day-one search-index pin — { authorConstraint:'observer', membershipMethod:'certainty' } on a 'count' deployment — must fold by certainty; got [{"tag":"p","value":"1111…"},{"tag":"p","value":"2222…"}].
  ✗ H12 (E4): flipping the instance dial moves only the pins that chose nothing
      E4: a pin carrying an explicit method is UNAFFECTED by an operator flipping the deployment dial — same members, same tags. Got [{"tag":"p","value":"1111…"},{"tag":"p","value":"2222…"}] vs [{"tag":"p","value":"2222…","score":75},{"tag":"p","value":"1111…","score":50}].
  ✗ H13 (ADR §1): the injected dial seam stays ZERO-ARG and pin-blind
      ADR §1: precedence must gate on the registry's shared predicate, not on a second inline copy of the vocabulary or on truthiness.
  ✗ S1 (AC-5): the curation dialog offers a "Membership method" select led by an "Instance default" option
      AC-5 / ADR §3: the dialog needs a control labelled "Membership method", under the existing Method select.
  ✗ S2 (AC-5, E3-discipline): the dialog seeds from init, keeps the raw value, and spreads conditionally
      ADR §3: the dialog must read and write membershipMethod.
  ✗ S3 (ADR §3, open question): the method vocabulary lives in ONE UI module, imported by both consumers
      ADR §3 / sub-option (c): ui/src/config/tlMembershipMethods.js must exist — the single hand-kept client mirror (a third copy inside the dialog was rejected; importing from the page inverts the dependency direction).
  ✗ S4 (AC-6): the Trust Determination blurb describes a DEFAULT for pins that do not choose
      AC-6 / ADR §4: the card must say it is the "default for pins that don't choose" — it is no longer the only dial.
  ✗ S5 (ADR §5): useTLDetail parses the membership-method tag onto the tl object
      ADR §5: useTLDetail must parse findTag('membership-method') — the disclosure is on the LIST, which is the surface a consumer actually has.
  ✗ S6 (ADR §5): the pin detail panel renders a "Membership method" row
      ADR §5: PinnedListPanel gains one <dl> row, "Membership method", after "Curation scope" and before "Min rank".
  ✗ S7 (concept graph): the tag-pinning firmware schema documents membershipMethod
      ADR §7: the curationMethod description is the only human-readable definition of the blob vocabulary — it must gain membershipMethod ('count' | 'input' | 'certainty'; absent = the instance-wide default), then POST /api/firmware/install.
  ✓ S8 (AC-2): defaultCurationMethod still leaves NEW pins on the instance default
  ✗ S9 (AC-4): the Story-4 "membership-method is stripped" comment is gone from the runner
      AC-4 / ADR §2: the strip comment at :372-374 must be REPLACED, not left beside the code that now contradicts it — a stale comment claiming the tag is stripped is the next reader's false premise.
  ✓ S10 (CLAUDE.md): no deployment TA pubkey literal is introduced by any touched file
  ✓ R1: retractStaleTLs carryOver does NOT learn membership-method
  ✓ R2 (ADR §5): enrichRowsWithTLStatus does not read the membership method
  ✓ R3 (AC-2): resolveMembershipMethod keeps its zero-arg signature, its settings read and its fail-safe
  ✓ R4 (E1): the note and item runners still read their own per-pin noteMethod, unchanged
  ✓ R5: the three membership folds are unchanged and method-provenance-blind

per-pin-membership-method: 9 passed, 22 failed, 0 skipped
```

The two re-aimed guards, failing for the one intended reason (the new tag is missing from the
published event):

```
  ✗ AC-4: a neutral pin under the count method publishes exactly the pre-change 30392 event
      neutral / count: the published event must be byte-identical to the pinned fixture (AC-4).
      expected: … ["min-rank","0.25"],["membership-method","count"],["z",…] …
      actual:   … ["min-rank","0.25"],["z",…] …
  ✗ AC-4: a neutral pin under the certainty method publishes exactly the pre-change 30392 event (scores, rigor, order)
      expected: … ["min-rank","0.25"],["membership-method","certainty"],["rigor","0.5"],["z",…] …
      actual:   … ["min-rank","0.25"],["rigor","0.5"],["z",…] …
pin-stack-composition: 18 passed, 2 failed, 0 skipped

  ✗ H3 (AC-3, profiles): an UNCONSTRAINED pin publishes the same 30392 metadata tags as today, with no disclosure
      AC-3: the unconstrained 30392 tag array must be byte-identical to today's; got [… no membership-method …].
only-me-curation: 34 passed, 1 failed, 0 skipped
```
