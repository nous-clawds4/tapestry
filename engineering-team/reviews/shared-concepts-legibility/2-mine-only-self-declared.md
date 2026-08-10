# Review: Story 2 — One place that lists everything my instance has offered

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-09
**Diff:** `git diff 770f3526..HEAD` (implementation commit `71cab19b`) — 5 files, +288, −0.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS on the story's terms**, after dispositioning three non-story failures. Two
      full runs, both read from complete captures and grepped — never piped through `tail` (OPEN.md
      row 157, opened by this epic's previous review):

  | Run | Result | `my-offerings` | `state-on-concept-page` |
  |---|---|---|---|
  | Implementer's (4142 lines) | `Overall: PASS`, all suites 0 failed, 53 skipped | 14/0/0 | 20/0/0 |
  | **Reviewer's independent** (4145 lines) | `Overall: FAIL` — three non-story suites | **14/0/0** | **20/0/0** |

  **The runs diverged; the divergence is recorded, not absorbed.** Neither epic suite moved.

  1. `relationship-primitives` **H8** — `scan count went 6609410 -> 6609412` (+2).
  2. `relationship-primitives-probe` **H4** — `scan count went 6609412 -> 6609413` (+1).

     Both are OPEN.md **row 150**, and this is the first run in this book where **both** suites in
     the pair fired together — the row anticipated that ("both suites' brackets need the same
     narrowing"). Dispositioned by the remedy this epic's previous review added to the row: quiesce
     `strfry-router`, re-run. Result **23/0** and **9/0** respectively; router restored to RUNNING
     immediately. **Environmental — a second countable occurrence within this book.**
  3. `harness-lint` — the L1 review-gate window, exactly as OPEN.md **#158** predicts. See Harness
     friction 1.
- [ ] `npm run test:playwright` — not applicable; no browser spec in this story.
- [~] `harness-lint` — clean at audit time; **1 violation once this report existed and before the
      story flipped** (L1). Not a defect in the story — OPEN.md #158, reproduced. See Harness
      friction 1.
- [x] UI build — `npm run build` succeeds; page verified live at `:7778`.

## Spec adherence

- [x] All seven criteria covered by passing tests. Spot-checked the two that carry the story:
      **AC-1** via `H2`, which recomputes the expected set independently from `/api/strfry/scan` and
      compares in both directions; **AC-2/AC-3** via `H3`, which grades against
      `wss://dcosl.brainstorm.world` through `/api/relay/external` rather than letting the endpoint
      mark its own work.
- [x] No criterion silently dropped.
- [x] Nothing added beyond the story: no send action on this page (Open question 2), no adopted/wired
      rows (Open question 1), the community directory untouched.
- [~] **AC-7 holds by construction but is unverified in practice on this instance** — see
      Non-blocking 1.

**Verified beyond the tests.** Live payload: 4 offerings, `relayOk: true`, and
`b-coverage-fixture-s1b` → `published: false` while `tapestry`/`dog`/`dog-breed` → `true`. That is
the divergence measured at Planning time (4 local, 3 on relay) reproduced through the shipped
endpoint. The page renders it as **⚠️ Declared here — not yet sent** against three **🤝 Shared**.
No console errors.

## ADR adherence

- [x] Files match the implementation notes exactly: `src/api/concept/myOfferings.js`, the page, the
      route, the nav entry, one registration line.
- [x] **Two queries regardless of N** — one `strfryScan` (`:112`) and one `fetchRelayHeaders`
      (`:117`), both filtered `authors:[TA]`. The N-calls shape the ADR rejected is absent.
- [x] **The deliberate asymmetry is implemented as decided.** Local failure → `503` with the
      underlying error (`:112–117`), never an empty list. Relay failure → `relayOk:false` and every
      row `null` via the pure core. This is the ADR's central decision and it is honored precisely.
- [x] **The tri-state rule has exactly one home.** `myOfferings.js` never computes `published`; it
      calls `resolveSharingState` per row (`:142`). Pinned across both endpoints by `S2`.
- [x] Classification at the seam via `dispositionOf`/`classifyBValue` (`:133–139`), matching ADR 0001.
- [x] TA resolved at runtime (`getOwnerAssistantPubkey`, `:104`); no 64-hex literal anywhere in the
      new code (grepped).
- [x] Display fields from event tags, no Neo4j read — so a declared header with no graph node still
      lists, as specified.

**Deviation, endorsed:** the ADR said "non-200"; the Implementer chose **503** rather than 500
(`:113`). That is a better reading — an unreadable local store is an availability condition, not a
handler fault — and it stays inside the ADR's instruction. No change asked.

## Concept-graph integrity

- [x] Handles in `kind:pubkey:slug` form throughout; coordinates built from the events themselves.
- [x] Firmware reinstall correctly not required — no concept definitions changed.
- [x] Orientation performed via `/api/concept-graph/summaries` during Architecture.

## Things tests can't catch

- [x] No secrets, no debug logging (`console.error` only, matching house practice), no commented-out
      code.
- [x] Shell-injection: `strfryScan` (`:53`) reuses the `selfDeclare.js:34` single-quote escaping; the
      only interpolated value is a filter built from a runtime-resolved pubkey.
- [x] The relay pool is closed in a `finally` (`:96`) and the timeout races the query.
- [x] **A `maxBuffer` overflow now fails loudly rather than truncating.** `exec` kills the child and
      errors when the 32 MB ceiling is hit, which reaches the `catch` and becomes a 503. Worth
      recording because this codebase has been bitten before — PR #500 was an outage fix for exactly
      that failure mode on an unbounded scan. Here the scan is bounded to one author's headers, and
      the no-swallow decision means an overflow would surface instead of producing a short list.
- [x] Concurrency: the two reads are not atomic, so a concept declared between them could read as
      not-yet-sent for one load. Self-correcting on refresh; recorded in the test plan, not worth
      machinery.
- [~] One defensive-direction nit — see Non-blocking 2.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] The hardwired relay constant is authorized by the story and ADR (sixth call site for the
      eventual concept-graph-sourced sweep).

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/pages/shared-concepts/MyOfferings.jsx:100` — the only actionable row leads to a blank
   page on this instance.** Rows navigate to `/tapestry/concepts/<coord>`, which renders nothing when
   the concept has no Neo4j `ListHeader` (pre-existing, `ConceptDetail.jsx:49`; first observed with
   `cat` during story 1; recorded in ADR 0002's Consequences). Verified directly: `b-coverage-fixture-s1b`
   has **no** graph node while `dog-breed` does. So the single **not-yet-sent** row here — the one row
   whose whole purpose is to be clicked — lands on a blank page. AC-7 is satisfied by the link and
   defeated by the destination.

   *Why not blocking:* the offending row is a test-fixture husk with no graph node, i.e. an instance
   of the local wire-archaeology already tracked as OPEN.md **#152**, not something a real
   owner-declared concept would hit — a concept created through the normal path has a graph node
   (confirmed: `dog-breed`). The Implementer built what the ADR specified, and the ADR named this
   consequence in advance. *Optional improvement, cheap:* have the page render a non-navigating row
   (or a hint) when the destination cannot resolve, rather than a link into nothing. Worth doing
   before this reaches an instance whose archaeology is less well understood.

2. **`ui/src/pages/shared-concepts/MyOfferings.jsx:25` — `stateOf` leans the unsafe way on bad
   input.** `published === null ? unknown : published ? shared : unsent` maps `undefined`, and any
   missing field, to **"Declared here — not yet sent"** — an affirmative claim. For a feature whose
   organising principle is *never assert a state you could not confirm*, the fall-through should land
   on `unknown`. The server guarantees the tri-state and `H1` pins it, so this is unreachable today.
   *Optional improvement:* treat anything that is not exactly `true`/`false` as unknown.

### Harness friction

1. **The L1 review-gate window, now confirmed as recurring.** OPEN.md **#158** (opened by this
   epic's previous review) predicted that a PASS-final review makes `harness-lint` red until the
   story flips. It did so again here — lint clean before this file existed, `Overall: FAIL` in the
   reviewer's own run afterward. Second occurrence, same book, one story apart, and both times it
   landed inside the reviewer's own quality gate. That is the evidence the row's fix shape was
   waiting for. No new row; #158 is amended by this citation rather than duplicated.

2. **Row 150's sharpened remedy worked, and the pair fired together for the first time.** The
   quiesce-don't-just-re-run guidance that this epic's previous review added to row 150 was applied
   verbatim and cleared both suites first try (23/0, 9/0). Two data points now support it. New
   detail for the row: this is the first observation of `relationship-primitives` H8 and
   `-probe` H4 failing in the *same* run, which is the case the row's "both suites need the same
   narrowing" note anticipated but had not yet seen.

## Verdict

**PASS**

The story's promise is completeness, and the implementation defends it in the two places it could
have been broken. `H2` proves the list is exactly the local self-declared set — in both directions,
computed independently — so the shortcut this story exists to prevent (filtering the relay-sourced
directory) would fail loudly rather than quietly. And a failed local read returns 503 rather than an
empty list, which is the difference between "something went wrong" and the false claim *"you have
offered nothing."*

Two judgement calls deserve endorsing rather than passing over. The **503-for-500 substitution**
improves on the ADR's letter while honoring its intent. And the **asymmetric failure handling** —
relay tri-stated, local hard-failed — reads at a glance like the defect story 1's review flagged,
but is the opposite: it was reasoned to in ADR 0002 from what each store's absence actually tells
you, and the code implements that reasoning exactly.

The one finding I would not want lost is Non-blocking 1: on this instance, the *only* row a user has
reason to click is the one that goes nowhere. The root cause is pre-existing and tracked, and the
row is an artifact — but the coincidence is unlucky enough to be worth fixing before it meets an
instance whose leftovers are less well understood.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not recorded here.
