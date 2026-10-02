# Review: Story 4 — Wire to an external shared concept on My Assistant rows

**Reviewer:** Claude (acting as Reviewer), plus the independent adversarial reviewer agent from story 3, resumed on
story 4
**Date:** 2026-10-01
**Diff:** `git diff 38acde1c..23b900e3` (story 4 since story 3's round-3 PASS; the branch is 0 behind `origin/staging`)

This is a signing story, so it got the same treatment as story 3:
- an isolated full gate on the commit;
- browser specs on a fresh `git archive` build;
- an independent adversarial pass on the new action. That reviewer worked read-only, signed nothing, and ran
  stand-in probes in a scratch directory.

Each finding from that pass that is recorded below, I re-checked in the code first.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, reproduced as CI, with no network during the run** (ledger row
      `2026-09-30-npm-test-step-leaks-fixtures`), on a clean `--no-local` clone at `23b900e3`. The verdict, read with
      `npm run -s gate:status -- --label review-lhd-4`:

  > `20261002T013003Z-20-18bc [review-lhd-4] started 2026-10-02T01:30:03.051Z on 23b900e3 — PASS, exit 0, 4530 passed, 0 failed, 593 skipped, 257/257 suites · /w/repo/tmp/gate-runs/20261002T013003Z-20-18bc.json`

  - **The record:** `node: v22.23.3`, `git: { commit: 23b900e3…, branch: feat/list-headers-disposition, dirty: false }`.
  - **Per suite:**

    | Suite | Verdict | Pass / fail / skipped |
    |---|---|---|
    | `list-headers-my-assistant-disposition` | PASS | 42 / 0 / 2 (the live pair skips with no network) |
    | `list-headers-disposition-column` | PASS | 12 / 0 / 0 |
    | `list-headers-author-options` | PASS | 9 / 0 / 0 |
    | `gate-result-record` | PASS | 33 / 0 / 1 |
    | `harness-lint` | PASS | 76 / 0 / 0 |
    | `stack-free-npm-test` | PASS | 6 / 0 / 1 |

  - The total matches the Implementer's own isolated run on the same commit (`20261002T012427Z-20-0ce2`).
- [x] **Playwright**, all three List Headers specs on a fresh `git archive 23b900e3` build: **180 passed with
      `--repeat-each=5`**.
- [x] **On the host** (the independent pass ran this): `list-headers-my-assistant-disposition` 44/0/0, with both live
      refusals executed against the deployed handler, which matches the branch.

## Spec adherence
- [x] **Every acceptance criterion has a passing test:**
  - AC 1: browser W1;
  - AC 2: W1, W2, P3, HW3, HW5, and browser W2, W3, W6;
  - AC 3: W3, HW4, and browser W4;
  - AC 4: W4, HW2, and browser W5;
  - AC 5: HW1, H2, R1, and the live L1.
- [ ] **Story 3's AC 5 (an honest outcome) isn't met for one input that anyone can reach** (blocking 1).

## ADR adherence
- [x] **The change matches ADR 0004's Implementation notes:**
  - `composeWire` (`src/lib/headerDispositionCompose.js:46-56`, the function at `:51`);
  - the `b-append` action, with `prepare` as step 4b (`src/api/list-headers/myAssistantDisposition.js:39-49`,
    `:127-128`);
  - compose called with `prep` (`:146`);
  - `wireAndBroadcast`;
  - the Wire section, with the client-side refusals;
  - `ListHeaderDispositionHost`, unkeyed, which passes the key to the panel.
- [x] **Steps 0–5b are unchanged and apply to Wire.** The independent pass confirmed the order:
  - another site gets 403 before the body is read;
  - someone else's handle gets 403 before the target is checked;
  - a bad target gets 400 before the lookup;
  - a forged header gets 409 before "already-wired".
- [ ] **ADR 0004 didn't bound the target's size or characters** (blocking 1). That's a gap in the design, so the fix
      starts with a short amendment.

## Things tests can't catch
- [x] **No other b-type or extra tags.** Across every accepted input, the appended tag is exactly
      `['b', target, 'pointer']`. An array target becomes plain text and can't change the type.
- [x] **The UI can't send a request for a different row:**
  - the handle always comes from `row.routeId`; the pick-list only sets the target;
  - the panel is still keyed by row inside the host;
  - `onActed` matches the returned event by its own address;
  - names and descriptions render as text.
- [x] **No key material** in any answer or log.
- [ ] **The target's length and characters** are unbounded (blocking 1).

## Findings

### Blocking
1. **`myAssistantDisposition.js:40-45` (`prepare`): the target has no type, size or character bound, and an
   over-long target makes the outcome dishonest.**
   - **What I re-checked:**
     - the local relay is configured with `maxTagValSize = 1024` (`/etc/strfry*.conf`);
     - `strfry import` exits 0 even when it rejects an event, which the code itself notes at
       `src/api/strfry/commands/publishEvent.js:84` and `src/api/dlist-curation/update.js:311`;
     - `publishToStrfry` (`src/api/normalize/helpers.js:53-61`) treats that exit as success.
   - **So a target over about 1 KB means:**
     - the relay silently drops the new version, but the handler goes on to `importEventDirect` and answers
       `wired`;
     - the panel then reports "Wired — …" or "Saved here, …", which isn't true of the relay;
     - the graph now disagrees with the relay, and the next Submit or Keep private overwrites the graph again
       from the older relay version.
   - **The independent pass also showed** (stand-in parts, nothing signed):
     - 2 KB and 5 MB targets reach signing (the app-wide JSON limit is 100 MB);
     - control and invisible characters (NUL, ESC, an RTL override, U+0085) are accepted inside the address;
     - an object with a custom `toString` gives a 500 instead of a 400.
   - **Asked change:**
     - amend ADR 0004 so `prepare` requires all of these: `typeof req.body.target === 'string'`; after trimming,
       at most 1024 UTF-8 bytes (the relay's own limit); no control or format characters (Unicode categories
       Cc and Cf);
     - mirror that in the panel's client-side check;
     - add tests for an over-long target, a control or format character, and a non-string target, each answered
       400 before the lookup.

### Non-blocking
1. **Check that the relay really stored the new version before writing the graph.**
   - Blocking 1 closes the reachable case. But `publishToStrfry` would also report success for any *other*
     silent rejection, such as an event at the relay's tag-count or size limit. That applies to all three
     actions.
   - The house's answer is to read the event back by id after `strfry import` (`dlist-curation/update.js:311`:
     `published` when it's there, `not-stored` when it isn't).
   - Recommended in the same amendment: read back, and answer an error without importing into the graph when the
     event isn't stored. Not required for this round.
2. **The own-address check can be dodged with a leading zero:** `039998:<own pubkey>:<own d>` passes as `wired`.
   The result is a self-pointer that the 🧭 column shows as 🔗, because it isn't string-equal to the header's own
   address. Only the caller's own header is affected. Concept Headers has the same gap.
   - Recommended in the same pass: compare parsed parts (`Number(kind)`, pubkey, d), or require a canonical kind
     (`^[1-9]\d*:`).
3. **"Any header address" is implemented as "any a-tag".** Kinds 0, 1 and 39999, and an absurdly long kind number,
   are all accepted. That's the same as Concept Headers, and it matches the owner's planning ruling as written.
   It's worth one line from the owner: was "header" meant to be limited to the list-header kinds (39998, 9998)?
4. **`composeWire`'s guard returns `refused: 'self'`** (`headerDispositionCompose.js:53`), which the handler would
   show as the bare word "self". Today it can't be reached, because step 4b refuses the own address first. A
   sentence would be safer if the guard is ever reached.

### Harness friction
- None new. Story 3's lessons were applied in Test Design (the threat list, the isolated gate, and the shared
  stack-HTTP helper), and no guard suite tripped. The one gap here, unbounded input sizes, wasn't on the threat
  list. I've added it to the signing-endpoint checklist in OPEN.md row
  `2026-10-01-signing-endpoint-precedent-misses-samehost`.

## Verdict
**CHANGES_REQUESTED**

Wire keeps the owner's rule: nobody else's signer can be reached, and a caller can add only one pointer b. The
gate, the browser specs and the independent pass all agree. One blocking item remains: an over-long pasted target
makes the panel report a save the relay silently refused, and leaves the graph disagreeing with the relay.

**Suggested fix round:**
1. An ADR 0004 amendment: the target bound, plus the recommended relay read-back and canonical-address comparison.
2. Tester additions.
3. Implementation.
4. Re-review.

## On PASS (same commit)
- [ ] Not applicable: the verdict is CHANGES_REQUESTED, and the story stays **Approved**.

## Re-review, round 2 (2026-10-01)

**Diff:** `git diff a031442d..2633e4d5` (base = round 1's review commit). The commits:
- `994e0666`: ADR 0004 Amendment 1;
- `484c8028`: the Tester's pass. It adds HW7–HW12 and W5, adds browser W8 and W9, re-aims HW2 and browser W5, and
  adds `isStored` to `deps()`;
- `2633e4d5`: the implementation, touching `myAssistantDisposition.js`, `headerDispositionCompose.js` and
  `ListHeaderDispositionPanel.jsx` only. It touches nothing under `test/` or `tests/`.

**The owner's decisions at round 1's gate:**
- "Go ahead with the fix round for story 4";
- both ride-alongs: "Read back from the relay (Recommended), Compare addresses by parts (Recommended)";
- target kinds: "List headers only (39998/9998)". Amendment 1 §2 records why that means the literal kind 39998 for
  an address.

**In short:** the blocking item and both ride-alongs are fixed, and I checked each as a fresh claim. The full
isolated gate passes on the commit. The independent pass re-attacked the bounds and the read-back, against the real
relay too, and found nothing blocking.

### Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, reproduced as CI, with no network during the run,** on a clean `--no-local` clone at
      `2633e4d5`:

  > `20261002T015743Z-20-5116 [review-lhd-4-r2] started 2026-10-02T01:57:43.205Z on 2633e4d5 — PASS, exit 0, 4537 passed, 0 failed, 593 skipped, 257/257 suites · /w/repo/tmp/gate-runs/20261002T015743Z-20-5116.json`

  - **The record:** `node: v22.23.3`, `git: { commit: 2633e4d5…, branch: feat/list-headers-disposition, dirty: false }`.
  - **This book's suite:** `list-headers-my-assistant-disposition` passes 49/0/2.
  - **The guard suites** all pass: `gate-result-record` 33/0/1, `harness-lint` 76/0/0, `stack-free-npm-test` 6/0/1.
  - The total matches the Implementer's own run (`20261002T015439Z-20-1def`).
- [x] **Playwright,** all three List Headers specs on a fresh `git archive 2633e4d5` build: **190 passed with
      `--repeat-each=5`** (38 tests ×5).
- [x] **On the host** (independent pass): the suite passes 51/0/0, with both live refusals executed against the
      deployed handler, which matches the branch.

### Each round-1 ask, re-derived

| Ask | Status | Evidence |
|---|---|---|
| **Blocking 1:** bound the target | **Fixed** | See below |
| **Ride-along: read back before the graph** | **Fixed** | See below |
| **Ride-along: own address by parts** | **Fixed** | `039998:<own>:<d>`, kind 9998, kind 39999 and an upper-case pubkey get the list-header-address 400; the own address gets the own-address 400, exact or padded. The caller's own pubkey with a *different* d is allowed: wiring to a sibling header is correct. |
| **Non-blocking 4:** the guard sentence | **Fixed** | `composeWire` now returns the own-address sentence (W5). |

- **Blocking 1.** `prepare` checks type, then control or format characters, then UTF-8 bytes, then the
  list-header form (`myAssistantDisposition.js`).
  - **Tests:** HW7–HW10 and browser W8; mutants r1–r4 and m1 each fail.
  - **The independent pass:** 1024 bytes passes and 1025 fails. A 1024-byte value ending in a 3-byte `€` passes,
    and the 1025-byte one fails. Trimming happens before counting. NEL, DEL, an internal BOM, zero-width
    characters, an RTL override, LRI, a soft hyphen and U+E0041 are all refused, and U+2028 and U+2029 fall to the
    address pattern. Non-strings, including objects with a `toString`, get 400 and never a 500.
- **The read-back.** Every action now reads its new version back by id before the graph follows.
  - **Tests:** HW12, for all three actions, and browser W9; mutants r5–r7 each fail.
  - **Real path in Implementation:** one real Wire on the local b-coverage fixture. The read-back found it, and
    only then did the graph follow. The independent pass confirmed that relay and graph hold the same id
    `7a07b6db…` with the same three b-values.
  - **The deployed `isStored` against the real relay** (the independent pass, read-only): an id that exists is
    stored; an absent id gets 502 "didn't keep"; a malformed id gets 502 "couldn't confirm". The relay's
    remaining silent-rejection limits (`maxEventSize`, `maxNumTags`, `rejectEventsNewerThanSeconds`) all now
    surface as 502, not as a false save.

### Findings

#### Blocking
None.

#### Non-blocking (filed together as OPEN.md row `2026-10-01-list-headers-readback-hardening`)
1. **The read-back matches by id only.** Submit's and Keep private's ids are predictable. If the unverified import
   path (already in the private report) let someone plant an event with a predicted id, our import would be
   skipped as a duplicate while `isStored` still said yes.
   - It affects only the caller's own header, and needs that access plus exact timing.
   - **Fix shape:** `isStored` should also verify the event it finds, rather than comparing `sig`: two identical
     same-second requests can legitimately share an id with different signatures.
2. **A lone surrogate** (`\ud800`) passes `prepare`. The relay would most likely reject the event, which the
   read-back turns into a 502, so it's harmless. Adding `\p{Cs}`, or using `isWellFormed()`, would refuse it up
   front with the right message.
3. **A narrowed race remains.** If request A's read-back succeeds and a concurrent request B then replaces A in the
   relay, the two graph writes can finish in either order. Only the caller's own header, under concurrent
   requests.

#### Harness friction
- None new. The checklist items from story 3's and this story's round 1 (the same-host check, verify before
  re-signing, bounding request values, the isolated gate at Test Design) all held.

### Verdict
**PASS**

Story 4 meets its five acceptance criteria and ADR 0004 with Amendment 1:
- Wire signs only with the caller's own Assistant;
- it accepts only a bounded, well-formed list-header address that isn't the header's own;
- every action now proves the relay kept its new version before the graph follows.

The isolated gate is green on the commit, and the independent pass found no way around the rule.
