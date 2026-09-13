# Test Plan: Story 6 — Update list publishes what I approved

**Story:** `engineering-team/stories/curated-dlist-update/6-update-list-publishes.md`
**ADR:** `engineering-team/decisions/curated-dlist-update/0006-update-publishes.md` (with ADR 0001 Decision §1–§6, the copy
convention, and ADR 0005 §7–§8 with its amendments, the planner)
**Date:** 2026-09-13

## Coverage map

**New suite:** `test/curated-dlist-update-publish.test.js`, 50 tests in six classes. H9, H24 and H7's capped case pin
ADR 0006 Amendment 1 (its own row below).
- **P (pure, server):** `src/api/dlist-curation/updateEvents.js` — `copyD`, `composeCopy`, `composeDeletion`,
  `composeUpgrade`, `validateUpdateBody`. Where ADR 0006 note 1 leaves an argument's shape open, the test pins the output:
  - `now` is given as a clock that reads as a number and can also be called;
  - a copy to delete carries its versions both as `ids` and as `versions`;
  - a refusal may be a throw, an error value, or a 4xx status.
- **H (the handler):** `createUpdateHandler(deps)` from `src/api/dlist-curation/update.js`, with every side effect
  injected and recorded.
  - It runs over a fake world of two places, this instance's strfry and the list's relay. Each place replaces
    addressable events and honors deletion requests as its strfry does (ADR §10): `a` and `e` locally (1.1.0), `e` only
    on the community relay (1.0.4), or not at all.
  - The seams follow the header endpoint's: every dep is a function.
    - `scan(filter)` → events; `readRelay(url, filter)` → `{ status, events, error }`;
    - `publishLocal(event)`; `publishRelay(event, url)` → the relay's message, in either argument order;
    - `getKeys(pubkey)`, `requireAuth(req, res)`, `sign(template, privkey)`, `now()`, `localOnly()`, `relays()`.
- **U (behavioral, UI):** ESM imports of `ui/src/utils/treasureMap.js`:
  - `planIntents`;
  - `updatePlan`'s pins;
  - `describeCurationHeader`'s `marker`;
  - `curateHereOffer`'s `own`;
  - a round trip: what the server composes, the next plan doesn't propose again.
- **S (structure):** source reads, with user-facing phrases pinned as literals on whitespace-flattened source. An
  apostrophe may be `'`, `’`, `&apos;` or `&#39;`; curly quotes and the em dash may be their HTML entities.
- **D (docs):** ADR §11's notes on ADRs 0002, 0003 and 0005, and the three OPEN.md rows, matched by content, not number.
- **R (sentinels):** the header endpoint's 409, and Simple Lists untouched. They pass before and after.

It is registered in `test/test.js` in five places: the require, the run, the results line, the overall verdict and the
skip aggregate. It carries the `require.main` block (OPEN.md row 276).

**Re-aimed in place.** Each pinned something this story makes false:
- **`curated-dlist-update-update-preview`:**
  - **U6 and the `proposes` helper:** `upgrade === true` becomes "upgrade is truthy". The upgrade now carries
    `dropsMarker` (ADR 0006 §7). Both pass before and after.
  - **S5:** story 5's closing line "Nothing is signed: publishing isn't built yet." must now be gone. The upgrade line's
    full stop is no longer pinned right after “pointer”, because the marker clause can continue the sentence. It fails
    now.
  - **S8:** "writes nothing" becomes: the items module and the preview sign nothing and post only to
    `/api/dlist-curation/update`, and the two hooks write nothing. It passes before and after.
- **`curated-dlist-update-curation-method`:**
  - **S8:** re-aimed the same way. It passes before and after.
  - **S6:** `useItemVotes(…, communityRelay)` may take the epoch after the relay. It passes before and after.
  - **R2:** `useTrustWeights(pubkeys)` and its effect keys may add the optional epoch. It passes before and after.
- **`my-curated-dlists-items`:**
  - **S3:** "the preview says publishing isn't built yet" becomes "the preview offers “Publish these changes”". It
    fails now.
  - **S9:** the items module may post Update's intents to `/api/dlist-curation/update`, and still signs nothing. It
    passes before and after.

No `dlist-curation-panel` pin names the 409 sentence, and no `curateHereOffer` test contradicts `own`: the read-only
suite's U2 passes no viewer, and its pointers are someone else's.

| Criterion | Tests | Level |
|---|---|---|
| AC-1 one approval publishes the preview; nothing before I press it; nothing to press unless ready and not up to date; never on another assistant's list | **S1:** "Publish these changes" is gated on `ready` and not `upToDate`. **S3:** the button's own `onClick` starts it, and nothing runs on a timer. **H10:** one call carries the whole plan. Another assistant's list keeps a disabled Update, per story 3's S4 and story 5's S6. | structure + handler |
| AC-2 everything re-read, my header included; a failed or capped read signs nothing and says what; a changed plan signs nothing and shows the new preview | **H7:** 503 `{ couldntCheck }` for each of the four reads in either place, and for a shared list answering 500 events. **H24 (Amendment 1):** the shared list, my list and the deletion requests are read with limit 500 in both places; 500 events → 503, 499 → the call proceeds. **H8:** 409 `{ stale }` for every kind of stale intent. **H18:** the header is the newest of the two places. **H19:** my header must name one shared list. **S2:** "The list changed since you pressed Publish; here is the new preview."; the comparison goes through `planIntents`; `couldntCheck` and 409 are handled. **S4:** the epoch. **U1:** `planIntents` is canonical. | handler + unit + structure |
| AC-3 copies follow the convention; the next preview doesn't propose them; approving twice leaves one copy | **P1–P3:** `copyD` and the copy's exact tags and content. **H10:** the signed copy, built from the server's own read. **H20:** a second approval of the same copy is stale, and one copy stays. **U5:** the next plan doesn't propose it. | unit + handler |
| AC-4 refreshes replace the copy at the same address; not offered again | **P4:** the same d, a new version `q`, `created_at` max(now, copy + 1). **H10:** the signed refresh. **H23:** a copy whose d isn't derived from its original is refused. **U5:** the refresh isn't offered again. | unit + handler |
| AC-5 deletions; kept and unchanged copies untouched; the original is a candidate again | **P5:** `a`, `e`, `k`, no reason, never another author's `a`. **H10:** the deletion is signed and the copy is gone. **H15:** an `e` for every version read. **H9 (Amendment 1):** a delete's or a refresh's target must be one of my assistant's copies. Another author's item, an item on another list, a hand-added item, or an item with no `q` at a copy's address → 409, listed under `stale`, and `sign` is never called. **U5:** the original is a candidate again. **U2:** only the plan's own entries become intents. | unit + handler |
| AC-6 the header upgrade in place; the marker rule; the preview says so first | **P6:** the upgrade in place, with or without the marker. **H10:** the signed upgrade. **H18:** `dropsMarker` must agree with the newest header. **H20:** the upgrade isn't done twice. **U2:** `dropsMarker` comes from `header.marker`. **U3:** `marker` itself. **U5:** the next plan doesn't offer the upgrade. **S1:** the marker clause. **S6:** the detail page passes `marker`. | unit + handler + structure |
| AC-7 only I, signed in; my own assistant's key; never the Simple Lists signer; no one else's session | **H1:** Origin. **H2:** session. **H3:** no key, including the object of nulls. **H4:** the key is `getKeys(session pubkey)`, and a user named in the body is never used. **H5:** another user's list. **S9:** no `isOwner`, no `/api/strfry/publish`, no `signAs`. **S10:** the route, clear of every owner-only substring rule. | handler + structure |
| AC-8 per item and per place; a partial failure shown; nothing retried; the next Update proposes what is missing | **H10:** `{ action, ref, name, places }`, published. **H11:** local-only rows are `skipped`. **H12:** a fulfilled "connection failure: …" and a rejection are both `failed`, with their reasons. **H13:** `not-stored`. **H21:** at most 4 in flight per relay. **H22:** a failed local import is reported, not hidden. **S2:** the result words. **S4:** the epoch re-reads. | handler + structure |
| AC-9 an unhonored deletion is shown; the copy stays flagged | **H14:** `still-there` or `gone`, per place. **H15:** every version is named, so the `e`-only relay still drops it. **H16:** a re-copy is timed after the deletion. **S5:** the deletion-request read; "deletion requested — still shown by"; "(asked before)". The relay survey is ADR §10's. | handler + structure |
| AC-10 no schedule; nothing written onto the header; a failed read publishes nothing; Simple Lists and the panel as today | **S3:** no `setInterval`. **H17:** no method, point of view or cutoff is written, and no body is signed. **H7:** a failed read signs nothing. **R1:** the header endpoint's 409. **R2:** Simple Lists untouched. The neighbouring suites stay green. | handler + regression |
| AC-11 R2-2's offer and the panel's 409 sentence | **U4:** `own`, after the target check, for the viewer's key or my assistant's. **S6:** the detail page passes `viewerPubkey`. **S7:** `REASON_TAILS.own`, exact. **S8:** the panel's sentence, and no "pointing elsewhere". | unit + structure |
| ADR §11 and § Consequences | **D1:** each of the three ADRs has a Status parenthetical and a one-line "Superseded in part" note naming what is superseded, by short name. **D2:** the three OPEN.md rows are `OPEN`. | docs |
| ADR 0006 Amendment 1 (from Test Design) | **Rule 1, targets are copies only — H9:** six non-copy targets (four deletes, two refreshes) each get 409, listed under `stale`, with `sign` never called. **Rule 2, limit 500 — H24:** the three reads carry `limit: 500` in both places; an answer of 500 events → 503 with nothing signed; one of 499 → the call proceeds. **H7:** its capped case answers 500 events. | handler |

## Edge cases

- [x] **E1 — refusals come before anything is read or signed, in the ADR's guard order.**
  - A foreign Origin is refused before the session check (H1).
  - No session means no key is looked up (H2).
  - No key, another user's list, or more than 50 intents means nothing is read (H3, H5, H6).
- [x] **E2 — the intent count at 50 and 51,** in one group and across groups (P7, H6).
- [x] **E3 — d-tags:**
  - 256 characters is accepted;
  - 257, empty, NUL, a line feed or U+001F is refused;
  - colons and non-ASCII letters are accepted (P7).
- [x] **E4 — one stale intent anywhere,** including the last one, stops the whole call: nothing is signed (H8).
- [x] **E5 — two versions of one copy,** a refresh that reached one place only: the deletion names both (H15).
- [x] **E6 — a deletion request stamped ahead of the clock:** the re-copy is timed after it (H16). A copy or header stamped
  ahead is refreshed or upgraded at old + 1 (P4, P6).
- [x] **E7 — a body that smuggles** an event, tags, content, a name, a `created_at`, a method, a point of view or a
  cutoff: none reaches `sign` (H17).
- [x] **E8 — the header:**
  - the newest of the two places decides (H18);
  - none, only the marker, or two real links is refused (H19);
  - a newer pointer header anywhere makes the upgrade stale (H18).
- [x] **E9 — a place that says ok but keeps nothing** is `not-stored`, both locally and on the relay (H13). A fulfilled
  "connection failure" is `failed` (H12).
- [x] **E10 — a refresh whose copy's d isn't derived from its original** is refused, so no second copy is made (H23).
- [x] **E11 — `planIntents` and garbage:** it never throws, and a plan that isn't ready gives no intents (U1).
- [x] **E12 — a target that isn't a copy (Amendment 1).** Update never deletes or refreshes an item added by hand. My
  assistant's own item with no `q` is refused as a target, whether at its own address or at a copy's derived address, as
  are another author's item and an item on another list. Each gets 409 under `stale`, and nothing is signed (H9).
- [x] **E13 — the read limit's boundary (Amendment 1):** 500 events is capped, and 499 is complete, for each of the three
  reads in either place (H24).
- [ ] **Not covered — the browser's publish run.** Its calls of at most 50, its stop at a refused call, and the rendered
  results are the Implementer's local check with the fetch stub (ADR note 6).
- [ ] **Not covered — a live publish,** and the relays' real deletion behavior. ADR §10's survey is the evidence, and a
  public write needs the operator's OK.
- [ ] **Deliberately not pinned (the ADR leaves it open):**
  - whether relays still get an event whose local import failed;
  - whether the upgrade counts toward the 50;
  - a same-host Origin on another port, and `Origin: null`.
- [ ] **Not applicable — the Concept Graph API:** no concept changes.

## Test infrastructure
- **Framework:** Node's built-in runner (`node test/test.js`); no Playwright half.
- **How the code is reached:**
  - the server modules through `require`, with every dependency injected, so nostr-tools and the container paths are
    never needed;
  - the UI util through ESM import;
  - the pages, hooks, ADRs and OPEN.md by reading their source.
- **Not exercised:** the stack, relays, strfry and the DOM.
- **Firmware state:** none required.
- **Fixtures,** inline:
  - the two-place fake world described above;
  - an answer of exactly n events, the real matches padded with fillers that match the filter (500 is capped, 499 is
    complete);
  - a copy fixture whose d is computed from ADR 0001 §4 with Node's `crypto`, never with the module under test;
  - story 5's planner fixture, with a kind-9999 candidate.

## How to run

Full suite:
```
npm test
```

Story-scoped gate. Always go through `run()`, never `node test/<file>` (OPEN.md row 276):
```
node -e "Promise.all(['./test/curated-dlist-update-publish.test.js','./test/curated-dlist-update-update-preview.test.js','./test/curated-dlist-update-curation-method.test.js','./test/my-curated-dlists-items.test.js','./test/curated-dlist-update-read-only-curation.test.js','./test/dlist-curation-header-endpoint.test.js','./test/dlist-curation-panel.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+(r.fail||0),0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification

The new and re-aimed tests fail with the current code. Confirmed on 2026-09-13 at commit `e1625ea1` with these tests
applied, each suite through `run()`. The run was repeated after Amendment 1's tests were added:

```
curated-dlist-update-publish:            2 passed, 48 failed — P1–P7, H1–H24, U1–U5, S1–S10, D1–D2
                                         (passing: R1 and R2, the sentinels)
curated-dlist-update-update-preview:    33 passed, 1 failed  — S5 (re-aimed)
curated-dlist-update-curation-method:   24 passed, 0 failed  — S6, S8, R2 (re-aimed) pass before and after
my-curated-dlists-items:                22 passed, 1 failed  — S3 (re-aimed); S9 (re-aimed) passes
curated-dlist-update-read-only-curation: 13 passed, 0 failed
```

Each failure names what is missing. Samples, verbatim:
- P: "ADR 0006 note 1: src/api/dlist-curation/updateEvents.js must load (pure, no nostr-tools); loading it threw: Cannot
  find module '…/src/api/dlist-curation/updateEvents.js'"
- H: "ADR 0006 note 2: src/api/dlist-curation/update.js must load without the container's nostr-tools and ws paths;
  loading it threw: Cannot find module '…/src/api/dlist-curation/update.js'"
- U1: "ui/src/utils/treasureMap.js must export planIntents (ADR 0006 note 3)"
- U2: "ADR 0006 §7: a copy entry carries version, the original's current id; got
  [{"name":"akita","routeId":"39999:cccc…:akita","score":2}, …]"
- U4: "ADR 0006 §8: a header by the viewer's own key → own; got {"status":"available","target":"39998:bbbb…:dog-breed"}"
- S4: "ADR 0006 §7: every useListItems(…) call in the items section passes the epoch; got ["[myCoord], listRelay", …]"
- S6: "ADR 0006 §7: headerState carries marker; got "const headerState = readOnly ? null : { state: …, olderLink: …,
  problems: …, };""
- D1: "…0002-pointer-switch-and-copy-wording.md's Status line cites `curated-dlist-update` ADR 0006; got
  "**Status:** Accepted""

`node --check` is clean on the new suite, the three re-aimed suites and `test/test.js`.

**Satisfiability check** (OPEN.md row 264's practice). An ADR-faithful sketch was applied to a throwaway `git worktree`
at `e1625ea1` holding these tests:
- the two server modules and a deletion-request hook were written new;
- a script patched the existing files, asserting every anchor it replaced: the util, the items section, the preview, the
  detail page, the offer, the panel, the three hooks, the route's registration, the three ADR notes and three OPEN.md
  rows.

The session's working directory never moved into the worktree.

Results against the sketch:
- the new suite: 49 passed, 0 failed. After Amendment 1, 50 passed, 0 failed against the amended sketch (below);
- 24 neighbouring suites, all green. They include every suite that reads a changed file, and the read-path suites
  story 5 ran:

  | Suite | Result |
  |---|---|
  | update-preview | 34/0 |
  | curation-method | 24/0 |
  | items | 23/0 |
  | read-only | 13/0 |
  | pointer switch | 12/0 |
  | DList Curation panel | 18/0 |
  | header endpoint | 29/0 |
  | headers | 16/0 |
  | page | 19/0 |
  | map entries | 14/0 |
  | merge-preserve | 16/0 |
  | TL panel | 19/0 |
  | publish-export-a-concept (RE1) | 3/0 |
  | opt-in publish | 23/0 |
  | TL Treasure Map panel | 18/0 |
  | panel summary | 18/0 |
  | relay presence | 35/0 |
  | relay sync | 22/0 |
  | treasure-maps router preset | 5/0 |
  | scheduled search and house scores | 12/0 |
  | event-page-read-path | 23/0 |
  | live-feed-read-path | 37/0 |
  | note-surfaces-read-path | 28/0 |
  | profile-content-card | 18/0 |

- the UI's esbuild (0.27.3) transforms all ten changed UI files, and `node --check` passes the three server files;
- `scripts/harness-lint.sh` is clean in the sketch worktree, with the notes and rows in place;
- no suite counts OPEN.md's rows.

Three pins were loosened during the check, because the sketch showed each was stricter than the ADR:
- **S3** had forbidden any effect from posting. ADR §7 step 2 sends once the fresh plan settles, which is naturally an
  effect. S3 now pins that the button's `onClick` starts the run.
- **S9** had forbidden the word "nostr-tools" anywhere in `updateEvents.js`, comments included. It now forbids only the
  `require`.
- **curation-method S6 and R2** pinned the hooks' calls and signature exactly. They now allow ADR §7's epoch, and are
  listed above.

**Mutation check.** Sixteen plausible wrong implementations were applied to the sketch one at a time, each run in a
fresh process, with the file restored after each. Amendment 1's re-check added three, and re-ran all nineteen against
the amended sketch. Each was caught:

| Mutation | Caught by |
|---|---|
| a delete of my assistant's item with no `q` is accepted (Amendment 1, rule 1) | H9 |
| a refresh of my assistant's item with no `q` is accepted (Amendment 1, rule 1) | H9 |
| the three item reads carry no limit (Amendment 1, rule 2) | H7, H24 |
| signs an event the body sent (Option B's forgery class) | H17 |
| skips the Origin check | H1 |
| takes the key for a user named in the body | H4 |
| chooses the key through an `isOwner` check | S9 |
| publishes the intents that check out before refusing the stale ones | H8 |
| a deletion names the newest version only (handler) | H15 |
| a deletion names the newest version only (composer) | P5, H15 |
| classifies a relay publish on its settled status only | H12 |
| trusts the import's exit code (no read-back here) | H10, H13, H14 |
| reads my header on this instance only | H7, H18 |
| publishes deletions before copies | H10 |
| times a re-copy at now, not after the deletion request | H16 |
| the upgrade keeps the "deliberately unaffiliated" marker | P6, H18, U5 |
| the preview keeps story 5's closing line | S1, update-preview S5 |
| `planIntents` keeps the names | U1 |
| `useTrustWeights` leaves the epoch out of its keys | S4 |

The `isOwner` mutant is caught structurally, not by H4. A real session carries only identity, and roles come from
config, so a fake session can't make `isOwner` true. H4 pins the behavior instead: keys are asked only for the session's
pubkey, and every event is signed with that key.

**Amendment 1 re-check** (2026-09-13). A second throwaway worktree at `e1625ea1` held these tests and the sketch,
re-applied. Rule 1's copies-only checks were added to it; rule 2's limit of 500 was already there. Results:
- the new suite: 50 passed, 0 failed;
- the 24 neighbouring suites are all green again. The eight that read the changed server files are among them:

  | Suite | Result |
  |---|---|
  | header endpoint | 29/0 |
  | read-only | 13/0 |
  | merge-preserve | 16/0 |
  | publish-export-a-concept (RE1) | 3/0 |
  | map entries | 14/0 |
  | DList Curation panel | 18/0 |
  | TL panel | 19/0 |
  | page | 19/0 |

- esbuild transforms all ten changed UI files, `node --check` passes the three server files, and harness-lint is clean;
- the nineteen mutations above are each caught.

Both sketch worktrees and their scripts were discarded. As in stories 4 and 5, a separate Implementer agent writes the
code from the ADR, not from the sketch.

## What the ADR leaves open, and how the tests treat it
- **`composeDeletion`'s `copy` shape.** "An `e` for every version" needs the versions, and note 1 names only `copy`. P5
  passes an event-shaped copy that also carries `d`, `ids` and `versions`. H15 pins the rule through the handler, whatever
  the shape.
- **The re-copy's timing.** It isn't among `composeCopy`'s named inputs, so it is pinned through the handler (H16).
  Whether the handler raises `now` or passes the deletion is the Implementer's call.
- **`now`'s type, and `validateUpdateBody`'s answer.** Both are read loosely, as described in the coverage map.
- **The result objects.** `action` and `ref` values aren't fixed. The tests find a result by an action pattern and by the
  route ids it mentions, and pin `places` and the statuses. Only a copy's `name` is pinned.
- **Settled by Amendment 1:** two questions this plan first left open — a delete of my assistant's item that isn't a
  copy, and the server's read limit. H9 and H24 now pin them.
- **Left open by Amendment 1:**
  - its rule 2 opens "each server read" but names three reads, so my header's read and the by-id read-backs aren't
    pinned to the limit;
  - an answer above 500, from a relay that ignores the limit, isn't pinned;
  - a target's "copy" status is judged on its newest version, as `updatePlan` judges the merged item. A place still
    holding an older, `q`-carrying version under a newer version without one isn't pinned.
