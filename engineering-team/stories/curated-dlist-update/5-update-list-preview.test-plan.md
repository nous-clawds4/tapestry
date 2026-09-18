# Test Plan: Story 5 — Update list shows what my assistant would do, built only from reads it could complete

**Story:** `engineering-team/stories/curated-dlist-update/5-update-list-preview.md`
**ADR:** `engineering-team/decisions/curated-dlist-update/0005-update-preview-and-honest-reads.md` (with Amendments 1 and 2)
**Date:** 2026-09-13

## Coverage map

**New suite:** `test/curated-dlist-update-update-preview.test.js`, 30 tests in six classes, and four more from Amendment 2
(§ Amendment 2 below).
- **V (server, behavioral):** `readRelayEvents`, through an injected `connect` / `verify`. Its fake relay follows the
  presence suite's pattern, and a refused connection throws the bare string that nostr-tools throws.
- **F (API, behavioral):** `handleFetchExternalEvents` with an injected `readRelay`. The module must load without the
  container's nostr-tools and ws paths; today it can't, on this machine.
- **U (client, behavioral):** ESM imports of `ui/src/utils/treasureMap.js`:
  - `lookupItemVotes`' chunks and caps;
  - `lookupListItems`' `relayTruncated`;
  - `candidateVerdicts`' `incomplete` list;
  - the AC-5 invariant (U5);
  - `updatePlan`, over a full fixture of copies.
- **S (structure):** source reads. User-facing phrases are pinned as literals, on whitespace-flattened source.
  - An apostrophe may be `'`, `’`, `&apos;` or `&#39;`, but not a backslash-escaped `\'`. So a string with an apostrophe
    goes in double quotes or a template literal, or uses `’`.
- **D (docs):** ADR 0005 §9's notes, and OPEN.md row 314.
- **R (sentinels):** the presence probe, and Simple Lists' weights warning. They pass before and after.

It is registered in `test/test.js` in five places: the require, the run, the results line, the overall verdict and the
skip aggregate. It carries the `require.main` block (OPEN.md row 310).

**Re-aimed in place.** Each pinned the disabled Update placeholder that this story replaces:
- **`curated-dlist-update-curation-method` S8.** The disabled-Update assertion becomes "Update's preview writes nothing".
  It passes before and after.
- **`curated-dlist-update-read-only-curation` S4.** "My own Update placeholder unchanged" becomes "the 'isn't built yet'
  line is gone". It fails now.
- **`curated-dlist-update-read-only-curation` R1.** The placeholder check becomes "my labels and the Update list button".
  It passes before and after.
- **`my-curated-dlists-items` S3.** It becomes "Update list opens the preview (it has a handler), and the preview says
  publishing isn't built yet". It fails now.

| Criterion | Tests | Level |
|---|---|---|
| AC-1 a preview on my own list, which writes nothing; read-only lists keep Update disabled | **S4:** `UpdateListButton({ curator, canCurateHere, open, onToggle })` — enabled with `onClick={onToggle}` on my own lists, disabled on read-only lists, and the "isn't built yet" line gone. **S6:** the preview is rendered, and `curator` still gates it. **S8:** nothing written. **Re-aims:** items S3, read-only S4. | structure |
| AC-2 what the preview is based on | **S5:** "Scoring Method:", "Point of view:", "Cutoff (≥)", and "These apply in this browser and are not written onto the list." | structure |
| AC-3 what it proposes | **U6:** ready — copy, skipped (named, with scores), refresh, delete, keep-flagged (with `why`), unchanged, upgrade. **U9:** up to date, even with skipped and kept items. **S5:** the six headings and their words. | unit + structure |
| AC-4 a failed or incomplete read proposes nothing | **V1–V4:** the strict reader. **F1–F5:** the strict endpoint. **S1:** the curation reads opt in. **S2:** the weights' two new errors. **U1–U3:** chunks, caps, `relayTruncated`. **U4:** the `incomplete` list. **U7:** every blocked reason, alone and together. **U8:** checking, and Amendment 1's precedence. | unit + structure |
| AC-5 the same verdicts as the panel | **U5:** a candidate's verdict is the same judged alone or with every shared item (true today; it guards the new two-verdict-set design). **U4:** the panel's summary for a partial read. **S6:** two verdict sets from one set of reads. **Amendment 2:** **S9:** the panel's verdicts wait for my list and carry its gaps; **U10:** those gaps' words; **U11:** a failed vote source named as the votes; **D3:** ADR 0004's §4 note. | unit + structure |
| AC-6 nothing else moves | **S2:** Follow List weights stay 1 or 0. **R2:** Simple Lists' footnote renders `trustError`, so the new errors reach it. **R1:** the presence probe. **D1–D2:** the notes and the row. **S8:** nothing signed. | regression + structure |

## Edge cases

- [x] **E1 — a real empty answer against an unreachable relay.** A reachable relay holding nothing is `ok` with no events
      (V1). A refused connection, an early close or a missing EOSE is `unreachable` (V2, V3).
- [x] **E2 — the retry is bounded at one,** and a relay that fails once and then connects is read (V2).
- [x] **E3 — what the reader drops:**
      - forged events, and events of the wrong kind or the wrong author;
      - but a filter that names no authors keeps any author (V4).
- [x] **E4 — strict mode's edges:**
      - mixed relays: one read, one unreachable (F3);
      - events merged by id across relays (F3);
      - a non-ws relay is skipped (F4);
      - validation is unchanged (F5);
      - without `strict`, the strict reader is never used (F4).
- [x] **E5 — chunk boundaries:** exactly 50 ids is one read, 51 is two (U1). A relay answer of 4,999 votes is not capped
      (U2).
- [x] **E6 — what counts as a copy:**
      - someone else's copy doesn't make a candidate "copied";
      - my assistant's item with no `q` isn't a copy, and the plan leaves it alone (U6).
- [x] **E7 — a kind-9999 original** is never "edited": its copy stays unchanged (U6).
- [x] **E8 — precedence (Amendment 1):**
      - a header that leaves no shared list to read blocks even while reads are pending;
      - a failed list read blocks without waiting for the verdicts (U8).
- [x] **E9 — garbage never throws:** `candidateVerdicts`' `incomplete` (U4) and `updatePlan` (U9).
- [ ] **Not covered — the rendered preview in a browser, and a live refused connection.** These are the Implementer's
      local check (ADR note 10), including the fetch stub forcing a failed strict read.
- [ ] **Not covered — publishing** (story 6), and the endpoint's non-strict callers (OPEN.md row 314).
- [ ] **Not applicable — the Concept Graph API:** no concept changes.

## Test infrastructure
- **Framework:** Node's built-in runner (`node test/test.js`); no Playwright half.
- **How the code is reached:**
  - the server modules through `require`, with injected dependencies, so nostr-tools is never required;
  - the UI util through ESM import;
  - the pages, hooks, docs and OPEN.md by reading their source.
- **Not exercised:** the stack, relays and DOM.
- **Firmware state:** none required.
- **Fixtures,** inline:
  - fake relays;
  - a copy fixture covering edited, unedited, not found, someone else's, no `q`, and a kind-9999 original;
  - verdict objects built directly, so the planner is tested apart from scoring.

## How to run

Full suite:
```
npm test
```

Story-scoped gate. Always go through `run()`, never `node test/<file>` (OPEN.md row 310):
```
node -e "Promise.all(['./test/curated-dlist-update-update-preview.test.js','./test/curated-dlist-update-curation-method.test.js','./test/my-curated-dlists-items.test.js','./test/curated-dlist-update-read-only-curation.test.js','./test/treasure-map-relay-presence.test.js','./test/event-page-read-path.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+(r.fail||0),0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification

The new and re-aimed tests fail with the current code. Confirmed on 2026-09-13 at commit `434b0ff0` with these tests
applied, each suite through `run()`:

```
curated-dlist-update-update-preview:      3 passed, 27 failed — V1–V4, F1–F5, U1–U4, U6–U9, S1–S8, D1–D2
                                          (passing: U5, the AC-5 invariant, true today; R1 and R2, the sentinels)
my-curated-dlists-items:                 22 passed, 1 failed  — S3 (re-aimed)
curated-dlist-update-read-only-curation: 12 passed, 1 failed  — S4 (re-aimed); R1 (re-aimed) passes
curated-dlist-update-curation-method:    24 passed, 0 failed  — S8 (re-aimed) passes before and after
```

Each failure names what is missing. Samples:
- V: "src/api/_shared/relaySource.js must export readRelayEvents(relayUrl, filter, opts)".
- F1: "src/api/relay/fetchEvents.js must load without the container's nostr-tools and ws paths …; loading it threw:
  Cannot find module '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools'". Neither path exists on this
  machine.
- U6–U9: "ui/src/utils/treasureMap.js must export updatePlan".
- D2: row 314 does not yet say "strict mode" and "opt in". A first version of this test passed by accident, because the
  row already said "the strict fetch"; it was tightened before the gate.

`node --check` is clean on the new suite, the three re-aimed suites and `test/test.js`.

**An ADR amendment, found while writing the tests.** ADR 0005 §7 put "checking while anything is pending" before
"blocked". So a header that leaves no shared list to read, or a failed list read, would have kept the preview
"Checking…" forever. Amendment 1 corrects the order:
1. the header decides first;
2. then the two list reads;
3. then the verdicts.

U8 pins it.

**Satisfiability check** (OPEN.md row 264's practice). An ADR-faithful sketch was applied to a throwaway `git worktree`
at `434b0ff0` holding these tests:
- a script patched the existing files, asserting every anchor it replaced;
- it rewrote `fetchEvents.js` whole;
- `UpdatePreview.jsx` was written alongside.

The session's working directory never moved into the worktree: commands used absolute paths and `git -C`, and the one
`cd` ran inside a subshell.

Results against the sketch:
- the new suite: 30 passed, 0 failed;
- 20 neighbouring suites, all green:

  | Suite | Result |
  |---|---|
  | curation-method | 24/0 |
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
  | community-reference-nostr-relay-stub | 4/0 |
  | event-page-read-path | 23/0 |
  | live-feed-read-path | 37/0 |
  | note-surfaces-read-path | 28/0 |
  | profile-content-card | 18/0 |

  The last five read the relay code.
- the UI's esbuild (0.27.3) transforms all seven changed UI files, and `node --check` passes the two server files.

**Mutation check.** Six plausible wrong implementations were applied to the sketch one at a time, each run in a fresh
process. Each was caught:

| Mutation | Caught by |
|---|---|
| the planner waits for the shared list before the header decides | U8 |
| the reader reads an early close or a timeout as an empty `ok` | V3 |
| strict mode answers success when every relay is unreachable | F2 |
| a relay answer at the vote limit isn't reported as capped | U2 |
| an edited copy whose new version doesn't qualify is deleted | U6 |
| every id goes in one read (no chunking) | U1 |

The sketch worktree was removed after the check. As in story 4, a separate Implementer agent writes the code from the
ADR, not from the sketch.

## Amendment 2 (2026-09-13, from the Implementation gate)

The Implementation gate found that AC-5's second bullet wasn't met when my own list's read fails. The preview proposed
nothing, but the panel could still show a complete-looking "N of M", because candidacy is computed against my copies.
ADR 0005 Amendment 2 closes the gap, and four tests are added to the same suite:

| Test | What it pins | Level |
|---|---|---|
| **U10** | `listReadGaps(record, 'your list')`: "your list on this instance’s strfry", "your list on the community relay", "every item on your list (more than one read returns)". A clean read and garbage give none. It passes before and after: it pins the words the panel will show. | unit |
| **U11** | `candidateVerdicts` names a failed vote source as the votes: "the votes on this instance’s strfry", "the votes on the community relay", both joined with "and", in the summary and on each candidate. | unit |
| **S9** | In `ItemsSection`, the panel's `candidateVerdicts` call waits for my list and carries `listReadGaps(<my list>, 'your list')`. "Waits" means its votes input depends on `myList`, followed through the section's `const` definitions. | structure |
| **D3** | ADR 0004's Status parenthetical and its superseded-in-part note name §4's words for a failed vote source. | docs |

No test is re-aimed:
- story 4 matches the reasons with `/community relay/` and `/strfry/`, which the new words still satisfy;
- this suite's only exact "the community relay" strings are fixture inputs to `updatePlan` (U7).

**Verification.** On today's code (`68eefaff`, with the four tests applied), through `run()`:

```
curated-dlist-update-update-preview: 31 passed, 3 failed — U11, S9, D3
```

Each failure names what is missing:
- **U11:** the summary's reason should be "the votes on this instance’s strfry", and is "this instance’s strfry".
- **S9:** the panel's votes input, `judging ? votes : null`, doesn't depend on my list's read.
- **D3:** ADR 0004's Status parenthetical doesn't name §4.

**Satisfiability.** An ADR-faithful sketch was applied to a throwaway `git worktree` at `68eefaff` holding the extended
suite. A script patched it, asserting every anchor. The session's working directory never moved into the worktree.
- The suite: 34 passed, 0 failed.
- 15 neighbouring suites, all green. Every suite that reads the changed files was among them.

  | Suite | Result |
  |---|---|
  | curation-method | 24/0 |
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
- esbuild transforms both changed UI files.

**Mutation check.** Five wrong implementations were applied one at a time, each run in a fresh process, and each was
caught:

| Mutation | Caught by |
|---|---|
| the panel's verdicts don't wait for my list | S9 |
| the panel drops my list's gaps | S9 |
| only the community relay's source is renamed | U11 |
| ADR 0004's note leaves out §4's words | D3 |
| the wait is done by emptying the candidates only, while the votes still flow (the panel would read "0 of 0") | S9 |

The sketch worktree and script were discarded. The Implementer writes the change from the amendment.

**Not covered:** the rendered panel with only my list's read failing. That is the local check in the amendment's
implementation notes.
