# Test Plan: Story 4 — The curation method panel shows my method, a cutoff, and each candidate's verdict

**Story:** `engineering-team/stories/curated-dlist-update/4-curation-method-panel.md`
**ADR:** `engineering-team/decisions/curated-dlist-update/0004-curation-method-and-verdicts.md`
**Date:** 2026-09-12

## Coverage map

**New suite:** `test/curated-dlist-update-curation-method.test.js`, 24 tests in the house classes.
- **U (behavioral)**, through ESM imports:
  - the shared rule, `ui/src/utils/dlistScore.js` (new): `classifyReaction`, `reactionsByItem`, `scoreItem`,
    `qualifies`.
    - A characterization table taken from Simple Lists' inline rule as it stands at `502badc4`
      (`ui/src/pages/lists/DListItems.jsx` `:32–40`, `:199–214`, `:248–347`, `:852`). Each row's expected value came
      from running that code verbatim in a scratch harness. Each row also checks itself against a frozen copy of the
      code kept in the suite (`SIMPLE_LISTS`).
    - A seeded differential check: 500 generated cases must credit, score and qualify exactly as the frozen copy does.
      Each case has:
      - two items;
      - up to seven votes, whose first `e` is either item or elsewhere, with trimmed and emoji contents;
      - weights from {missing, null, 0, 0.25, 0.5, 1, 1.75, 3};
      - a cutoff from {−1, 0, 0.5, 1, 2, 2.5}.
  - the curation util, `ui/src/utils/treasureMap.js`: `VOTES_LIMIT`, `lookupItemVotes` (fakes for both sources),
    `weightsState`, `candidateVerdicts`, `CUTOFF_DEFAULT`, `cutoffStorageKey`, `readStoredCutoff`.
- **S (structure):** source reads of Simple Lists, the util, the detail page, the items module and the two new hooks.
  User-facing phrases are pinned as literals on whitespace-flattened source, so each phrase must appear whole in the
  source. An apostrophe may be `'`, `’` or `&apos;`, and a quote `"`, `“ ”` or `&quot;`.
- **D (docs):** `my-curated-dlists` ADR 0003's superseded-in-part note (ADR §8).
- **R (sentinels):** pass before and after:
  - Simple Lists' controls and publish;
  - `TrustContext` and `useTrustWeights`.

It is registered in `test/test.js` in five places: the require, the run, the results line, the overall verdict and the
skip aggregate. It carries the `require.main` block (OPEN.md row 276).

**Re-aimed in place:** `test/my-curated-dlists-items.test.js` S3 — its title, with a comment, because the method panel
is no longer text only. Its assertions still hold before and after:
- Update is disabled, with no handler;
- "isn't built yet" is still there;
- the words upvotes and downvotes appear, now from the rule sentence.

**Unchanged, and passing before and after** (checked against the sketch):
- the rest of `my-curated-dlists-items`;
- `curated-dlist-update-read-only-curation`. Its S2 pins the panel inside a conditional branch and its S4 the
  `ItemsSection` signature; both hold with the new props;
- `curated-dlist-update-pointer-switch`;
- the neighbours listed under Verification.

| Criterion | Tests | Level |
|---|---|---|
| AC-1 the panel shows my method | **S5:** the Scoring Method from `useTrust()` and `SCORING_METHODS`, with the Trusted List's name; "Point of view:" through `useProfiles`; "Change them on Trust Determination →" linking to `/tapestry/grapevine/trust-determination`; "Cutoff (≥)", a number input, step 0.1, `onCutoffChange(parseFloat(v) \|\| 0)`; the browser-only line, exact; the placeholder text gone. **S4:** the cutoff hook runs before the early return, with my own list's coordinate or null; the panel gets `cutoff`, `onCutoffChange` and `summary`. **S7:** `useCurationCutoff` — the util's helpers, storage inside try/catch, no coordinate → no storage. **U13:** `CUTOFF_DEFAULT` 2; one key per list; a stored value reads back (0 included); missing or invalid → 2. | unit + structure |
| AC-2 each candidate's verdict and reason; the summary | **U11:** the verdicts and "N of M" at cutoffs 2, 1, 2.0001 and 0. **S6:** the Verdict column and its four cell phrases; the reason's Voter · Vote · Weight · Contribution · Note headings; the summary reported up, `{ state: 'hidden' }` while candidates are off. **S5:** the summary lines — "⏳ Checking…", "N of M candidates qualify", "Verdicts incomplete — couldn't check", and the hint while candidates are off. | unit + structure |
| AC-3 decided exactly as Simple Lists | **U1–U4:** the characterization table. **U5:** 500 seeded cases against the frozen copy. **U11:** each verdict equals the shared rule's and the frozen copy's. **U12:** only the current version's votes count (gate decision 2); the author's first reaction follows the merged order; a vote counts for its first `e` only. **S2:** Simple Lists calls the shared rule and keeps no copy. **S3:** the util imports the same module and keeps no copy. **S6:** `candidateVerdicts({ …, cutoff })`, so a cutoff edit re-judges at once. | unit + structure |
| AC-4 a failed read decides nothing | **U6:** one filter to both sources; merged by id, local first, each vote once; the local cap reported. **U7:** a failed or unsuccessful source is `failed`, and the other still counts; a non-ws relay is skipped; it never rejects; a missing reader is `failed`; no ids → no read. **U8:** `weightsState` — failed, checking or ready, with own keys only. **U9:** checking while anything is pending. **U10:** each failure makes every candidate `unchecked`, with the reason named, and the summary incomplete — never skipped. **S5, S6:** the "couldn't check" phrases. | unit + structure |
| AC-5 nothing else moves | **R1:** Simple Lists' controls, Ratings Source, cutoff default and parsing, breakdown labels and publish. **U5:** Simple Lists' scores unchanged. **R2:** Trust Determination's settings — `tapestry_trust_method`, the four methods, the exports — and `useTrustWeights`, unchanged. **S5:** no Trust Determination setter is called. **S6:** the verdict path is gated on `curator`, so read-only lists get none. **S4:** a read-only list still shows its one line. **S8:** nothing is written, no identity literal, and Update is still disabled. **D1:** the ADR note. | regression + structure |

## Edge cases

- [x] **E1 — a vote whose first `e` names an inherited property** (`constructor`, `__proto__`, `toString`,
      `hasOwnProperty`).
      - Simple Lists' inline code throws on it today, with "map[targetId].push is not a function" (confirmed by running
        the verbatim copy). So one crafted kind-7 reaction, published by anyone, breaks the Simple Lists items page for
        that list. After the move it would break the curation page too.
      - ADR §1's "never throws, only the given ids" drops it (U2).
      - This is the one change to Simple Lists' behavior: a crash becomes an ignored vote.
      - The differential check never generates such ids, so U5 still compares like with like.
- [x] **E2 — no candidate ids:** no read at all, no events, nothing failed (U7). An empty `#e` filter could match every
      vote.
- [x] **E3 — a stored cutoff of 0** reads back as 0, not the default (U13).
- [x] **E4 — the author reacting both ways** (T7, T8), and **a self-downvote with the author's weight unknown** (T9).
      They are characterized as Simple Lists computes them, quirks included: T8's later 👍 also gets an
      "explicit-downvote" row (U3).
- [x] **E5 — one voter, two reactions with different ids:** counted twice (T11).
- [x] **E6 — an edited 39999 original:** votes on the earlier version's id don't count (U12; gate decision 2).
- [x] **E7 — before the weights' first answer, or with no point of view,** the weights are `checking`, never `ready`, so
      no candidate is "skipped" by accident (U8). Inherited keys are not answers.
- [x] **E8 — checking outranks couldn't check** while anything is pending (U9, the ADR's order).
- [x] **E9 — garbage never throws:** every new pure function, and `candidateVerdicts`, which runs on every render (U1–U4,
      U7–U9, U13).
- [ ] **Not covered — an unreachable relay answered as "success, no events."** Accepted for this story at the Test
      Design gate (the operator's call, 2026-09-12), because the page only reads. It is filed as OPEN.md row 280, which
      story 5 must settle before Update proposes a deletion (the epic's story 5 entry).
      - `/api/relay/external` (`src/api/relay/fetchEvents.js`) runs nostr-tools' `querySync`, which resolves empty when
        a relay refuses the connection. That is OPEN.md row 245's root cause, recorded there for the dlist-curation
        server seams.
      - On the client, the empty answer is indistinguishable from "no votes" (the community relay) or "nobody is
        ranked" (the point of view's rank provider).
      - In the second case, `useTrustWeights` sets no error and every weight reads unknown, so the verdicts say
        "skipped", not "couldn't check".
      - Separately, `useTrustWeights` drops a `success: false` answer silently. Its own 8-second abort usually fires
        first, and that does set the error.
      - So AC-4's example "its rank provider is unreachable" is met only when the read fails on the client. The tests
        pin every failure the client can see.
- [ ] **Not covered — the rendered page and the real reads:** the Implementer's local check with the fetch stub (ADR
      note 8), including that a read-only list makes no kind-7 read.
- [ ] **Not applicable — the Concept Graph API:** no concept changes.

## Test infrastructure
- **Framework:** Node's built-in runner (`node test/test.js`); no Playwright half.
- **How the code is reached:** the two pure modules through ESM import; the pages, hooks and ADR by reading their source.
- **Not exercised:** the stack, relays, the DOM and browser storage.
- **Firmware state:** none required.
- **Fixtures,** inline:
  - synthetic pubkeys and ids;
  - kind-7 votes;
  - three kind-39999 candidates under Trust Everyone weights (akita 2, beagle 1, corgi 1);
  - the frozen `SIMPLE_LISTS` copy;
  - a seeded PRNG (mulberry32, seed 20260912), so every run replays the same 500 cases.

## How to run

Full suite:
```
npm test
```

Story-scoped gate. Always go through `run()`, never `node test/<file>` (OPEN.md row 276):
```
node -e "Promise.all(['./test/curated-dlist-update-curation-method.test.js','./test/my-curated-dlists-items.test.js','./test/curated-dlist-update-read-only-curation.test.js','./test/curated-dlist-update-pointer-switch.test.js','./test/my-curated-dlists-page.test.js','./test/my-curated-dlists-headers.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+(r.fail||0),0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification

The new tests fail with the current code. Confirmed on 2026-09-12 at commit `502badc4` with these tests applied, each
suite through `run()`:

```
curated-dlist-update-curation-method:     2 passed, 22 failed — U1–U13, S1–S8, D1 (R1 R2 pass)
my-curated-dlists-items:                 23 passed, 0 failed  (S3 re-aimed: title only)
curated-dlist-update-read-only-curation: 13 passed, 0 failed
curated-dlist-update-pointer-switch:     12 passed, 0 failed
```

Each failure names what is missing. Samples:
- U1–U5 and U11: "ui/src/utils/dlistScore.js must exist and load in Node (ADR 0004 §1 …)";
- U6: "VOTES_LIMIT = 5000; got undefined";
- U7–U10 and U12: "ui/src/utils/treasureMap.js must export …";
- S6: `ItemsSection({ …, cutoff, onVerdictSummary }); got { myCoord, … canCurateHere = false }`;
- D1: the Status line, which has no ADR 0004 parenthetical.

`node --check` is clean on the new suite and on `test/test.js`.

**Satisfiability check** (OPEN.md row 264's practice). I applied an ADR-faithful sketch of the implementation, never
committed, in a throwaway `git worktree` at `502badc4` holding these tests. The sketch covered every file ADR notes 1–7
name:
- `dlistScore.js`;
- Simple Lists' four call sites;
- the util's new exports;
- the two hooks;
- the detail page;
- the items module;
- the ADR note.

Results against the sketch:
- the new suite: 24 passed, 0 failed;
- 14 neighbouring suites, unchanged, all passing:

  | Suite | Result |
  |---|---|
  | items | 23/0 |
  | read-only | 13/0 |
  | pointer switch | 12/0 |
  | page | 19/0 |
  | headers | 16/0 |
  | DList Curation panel | 18/0 |
  | map entries | 14/0 |
  | TL panel | 19/0 |
  | merge-preserve | 16/0 |
  | TL Treasure Map panel | 18/0 |
  | opt-in publish | 23/0 |
  | panel summary | 18/0 |
  | relay presence | 35/0 |
  | relay sync | 22/0 |

- all seven sketch source files transform cleanly with the UI's esbuild (0.27.3).

Writing the sketch showed two structural pins stricter than the ADR. Both were loosened before the gate:
- S5's link: the path may come through a constant;
- S6's `candidateVerdicts({ …, cutoff })`: the argument may hold a nested object.

No behavioral test was relaxed.

**Mutation check.** Five plausible wrong implementations were applied to the sketch one at a time. Each was caught:

| Mutation | Caught by |
|---|---|
| `weightsState` counts inherited keys as answers | U8 |
| `readStoredCutoff` turns a stored 0 into the default | U13 |
| a capped local read counts as complete | U10 |
| the author's *last* reaction decides | U3, U5, U12 |
| Simple Lists' unguarded lookup (E1's crash) | U2 |

The worktree was removed after the check. Implementation writes its own code, not the sketch's (story 3's review,
Harness friction 1).
