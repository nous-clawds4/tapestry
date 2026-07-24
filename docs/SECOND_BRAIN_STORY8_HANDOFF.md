# Second Brain — Story 8 Session Handoff (2026-07-24)

**Status:** 🔴 OPEN

> Written at the close of the story-7 session (teach-it-what-matters: review PASS,
> shipped to production 2026-07-24, staging PR #454, prod promotion PR #455). This
> is the pickup prompt for the next session, with the load-bearing discoveries
> from story 7 baked in. When story 8 ships, flip this Status to ✅ ADDRESSED.

## Pickup prompt

Pick up story 8 of the second-brain book — **"The brain survives — export and
restore"** (the owner exports the brain's owner-authored content and proves,
once, that a restore reproduces it — PRD §5.7, §7.4). Stories 1–7 are Done and
in production. **This is the book's LAST story** — after it PASSes, run
completion detection and offer `/close-book` (the operator's "yes" triggers it;
see "Then" below for the close-out bundle). The book, epic, and stories folder
exist — do **not** re-open the book. Branch fresh off updated staging
(`git checkout staging && git pull`, then re-create `feat/second-brain` — the
remote branch auto-deletes at each PR merge).

Read, in order:

1. `product-team/stories-queue.md` — Second Brain block, Story 8. The 4 ACs:
   a dated export artifact carrying **goals (with decomposition positions),
   resources, signals, proposals and decisions, and work records**; a restore
   drill against a **scratch target** that reproduces goals/pointers/records,
   **journaled**; **no egress** (§7.4 — the export completes without touching
   or publishing anything outward); running export twice with no changes →
   **equivalent content**. "Notes for engineering": scope is the owner-authored
   second-brain content, **not a whole-database backup**; "scratch target" =
   any environment that is not the live brain — **the drill must not risk the
   thing it protects**. Dependency: story 1 only (satisfied). Until the
   separate firmware clobber-protection epic lands, **this export IS the
   protection** (referenced, never re-specified — PRD §7.9).
2. `product-team/prd/second-brain.md` — §5.7 (safeguards: export + one verified
   restore drill), §7.4 (privacy: local by convention, no outbound sync), §7.2
   (append-only), §5.9 (second-operator guard — the export is also the
   portability seed; no reference-instance identities baked in).
3. `product-team/guides/second-brain-style-guide.md` — **story 8 has LESS of a
   copy gap than 6/7 did:** the button label **"Export brain."** (line 24) and
   the confirmation *"Restore drill complete — your brain matches the export."*
   (line 27) are **already pinned verbatim**. What's NOT pinned: where the
   export affordance lives (the design guide's three-view inventory has no
   export surface — §5.8 names three views only) and any export confirmation
   sentence. Surface placement + any new string at a gate (the d16/d5
   precedent). Note the design guide's do-not-design list still binds.
4. `engineering-team/epics/second-brain.md` + `audits/second-brain/book.md` —
   roster (stories 1–7 all marked Done), guardrails, the two recorded coverage
   gaps (rename/abandon; category instances/filter) — both land in the
   book-close addendum, not story 8.
5. `engineering-team/decisions/second-brain/0007-teach-it-what-matters.md` —
   the freshest ADR (the fourth runtime-created append-only concept; the
   two-goal read-time fan-out; server-stamped framing). ADRs 0001–0006 remain
   binding. **For story 8 the load-bearing prior art is the full concept set:**
   the export must carry five content families whose live producers now all
   exist — `tapestry-owner-goal`, `tapestry-external-resource`,
   `tapestry-work-record`, `tapestry-proposal`, `tapestry-priority-signal`.
6. `engineering-team/reviews/second-brain/7-teach-it-what-matters.md` — PASS;
   zero blocking; the fetchSignals omission adjudicated defensible (dead-code
   avoidance beats notes-listing); non-blocking items all dispositioned.

## Load-bearing context from story 7

- **All five owner-authored content families have live read paths in
  `src/api/brain/index.js`:** `readResolvedGoals`, `readResourceRecords`,
  `readWorkRecords`, `readProposals`, `readSignals` — each the same
  EXPLICIT ∪ IMPLICIT ConceptElements union, absence-tolerant. These are the
  natural export read set; whether export rides them (a brain read?) or a
  normalize lane is the Architect's call — but remember the brain module is
  **pinned read-only** (no mutation/strfry tokens) and RESTORE writes, so
  restore cannot live in `src/api/brain/`.
- **The brain import surface is NINE, septuple-pinned.** The identical
  allowlist array now sits in SEVEN suites (capture 333, structures 454, break
  540, attach 560, sessions-read 573, the-proposal-loop 580, and
  teach-it-what-matters — grep `lib\\/brain\\/signals` for the exact lines). A
  tenth require (e.g. `lib/brain/export`) amends **all seven in the same
  diff** — the recurring lesson, now the eighth occurrence. If story 8 adds NO
  brain require (plausible — export may live entirely in normalize or a new
  module), the pins stay untouched; decide in Phase 3 either way.
- **Restore must respect the self-bootstrap pattern.** Every non-goal concept
  is runtime-created (`ensureResourceConcept` / `ensureWorkRecordConcept` /
  `ensureProposalConcept` / `ensureSignalConcept` in
  `src/api/normalize/index.js`) — a scratch target starts WITHOUT them. A
  restore path that writes elements must ensure the concept first (the
  ensure-then-mint idiom), and the goal concept itself
  (`tapestry-owner-goal`) exists on the reference instance via firmware — a
  TRULY fresh scratch target may lack it; the second-operator guard (§5.9)
  says nothing may assume it pre-exists. Surface this at Architecture.
- **Append-only survives export/restore by construction if you carry the
  record fields, not the element identities.** Records link by SLUG fields
  (`goal`, `proposalId`, `prefers`/`over`) — record-based linkage means an
  export of json sections round-trips the graph structure with zero edge
  reconstruction. But element d-tags are random (work records / proposals /
  signals) and goal d-tags are name-derived — the Architect must decide
  whether restore re-mints (new d-tags, same content — simplest honest;
  "equivalent content" not byte-identical events) or replays raw events
  (byte-true; heavier). The queue's AC4 says "equivalent content" — that
  word choice is load-bearing.
- **§7.4 is a structural test target:** the story-7 S-suite's no-egress scan
  (`publishEverywhere`/outbound `fetch`/etc.) extends naturally over the
  export path; export writes a LOCAL artifact only. Local-only publish
  (`publishToStrfry` + `importEventDirect`) applies to restore writes.
- **Copy:** "Export brain." + the restore-drill confirmation are already
  canonical (style guide lines 24/27). No numeric anywhere owner-facing. Any
  NEW strings (export confirmation, drill-journal wording if owner-facing) are
  authored to register and ratified at a gate.
- **The drill's journal is an artifact question** — where does "the drill's
  result is journaled" live? (A work record on a goal? A file? The book's
  audit?) The PO should pin the intent at Planning; story 5's work-record
  spine is available as the append-only journal surface (a `worked`/`noted`
  entry about the drill) — but that's mechanism; decide at the gates.

## Practicalities

- TA pubkey runtime-resolved (`/api/assistant/pubkey`); never hand-transcribe.
- Full `npm test` ≈ **25 min** (the reviewer's measured number; includes the
  story-7 suite). Background it AS the backgrounded call (no inner `nohup…&`).
  **Quiesce `strfry-router` first** (`docker exec tapestry supervisorctl stop
  strfry-router`, restart after) — OPEN.md row 75: it drifts the
  relationship-primitives scan-count brackets under load.
- **OPEN.md row 94 (new this session): the brain H-suites' fixture pre-clean
  cannot recover from a crashed teardown** — deletions derive from
  process-local state, so a mid-gate teardown crash strands element nodes
  whose json tags the next pre-clean sweeps away, leaving "already exists" +
  hygiene `unreadable-record` cascades (the-proposal-loop went 23/10 twice).
  Recovery: query Neo4j for `uuid CONTAINS 'harness-proposal'` (or
  `'harness-signal'`), delete strfry events by the uuid's d-tag part, DETACH
  DELETE nodes+tags, verify count-0. **If the Tester writes story-8 H
  fixtures, consider the row-94 fix in-suite** (pre-seed known fixture names;
  name-based sweep) — that closes the row for the new suite at least.
- The `tl-publication-from-pins-publish` suite still flakes under heavy local
  churn (row from story 6) — unrelated to brain code; CI clean-env is
  authoritative.
- **Parallel-session collisions remain live.** Story 7 hit both flavors AGAIN:
  (a) tapestry-key #452 merged to staging mid-session → pre-PR re-sync merge;
  conflicts only in `test/test.js` (BOTH sides added runner registrations —
  additive keep-both; their suite is module-only/4-touch, which is fine); (b)
  a concurrent promotion #453 carried #452 to prod before ours, so our
  promote (#455) was exclusively second-brain — **always re-check
  `origin/main..origin/staging` before the prod merge.** Also: **main now has
  a required `stack-free` CI check** — the promotion PR merge is BLOCKED until
  it completes (~1 min); poll `gh pr view --json statusCheckRollup`, then
  merge (seen on #455).
- New suite registers in `test/test.js`'s live `overallOk` chain — the current
  live terminator is `teachItWhatMattersResult.fail === 0;` (flip its `;` to
  ` &&`, add your term ending `;`, leave the dead block — OPEN.md #43) + the
  `totalSkipped` array + a summary line.
- Host shell quirks: bare `curl`/`python3` "command not found" in compound
  scripts (use `/usr/bin/curl`, `/opt/homebrew/bin/python3`); foreground
  `sleep N && cmd` chains are blocked — use bounded `until` loops.
- Local dev loop: server routes need `docker exec tapestry supervisorctl
  restart brainstorm`; UI changes need the in-container `npx vite build`
  (story 7 had zero UI diff; story 8 likely adds an export affordance — plan
  the build).
- The independent reviewer subagent is required-by-practice (OPEN.md row 80b)
  when the main session implements — it re-runs every gate itself.
- Known environmental: `GET /api/get-user-data` for large-graph pubkeys
  (Jack, and since 2026-07-24 also Odell) 504s in ~16s on staging AND prod —
  the documented per-query-timeout class with its own planned fix; never a
  second-brain defect (SMOKE_TEST.md updated this session).

## Then

Act as the engineering Product Owner: promote Story 8 — "The brain survives —
export and restore" — via `/plan-feature` into
`engineering-team/stories/second-brain/` (next story number: 8, slug
`the-brain-survives` per the epic roster). ADR number: 0008.

Run human-gated: the operator answers every phase gate. One story per session.
**After story 8 PASSes, the book is complete — offer `/close-book`.** The
close-out bundle waiting at book-close: back-fill into the product-team guides
(the return edge) the ratified strings — ADR 0006 d16's approve confirmation
(*"Approved — launch it when you're ready."*), ADR 0007 d5's signal wording
(type words `preferred` / `passed over`, both side templates, the capture
confirmation *"Noted — "{prefers}" over "{over}"."*), and the canonical
pairwise prompt — plus the epic's story-8 Done marker, the two recorded
coverage gaps (rename/abandon; category instances) into the PRD addendum, and
the book's audit + addendum artifacts under `audits/second-brain/`.
