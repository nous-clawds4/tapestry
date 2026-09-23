# Build Audit: Modernizing `feat/tags` against `staging`

**Book:** `engineering-team/audits/feat-tags-modernization/book.md`
**Date:** 2026-09-23
**Branch / commit range:** `feat/tags`, merge base `39822c9d` (2026-07-22) .. `c3b40b01`; the
integration was carried on `integrate/staging-into-tags-2026-09` (worktree `~/src/tapestry-tags`)
and pushed to `feat/tags` on 2026-09-17 (`515419f8`, then `c3b40b01`).
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high

> The Build Audit is the as-built record — what the product *is* now, factual and source-linked.
> It does not propose changes; that is the seed's job.

**Scale.** `git log --oneline 39822c9d..c3b40b01` = **1081 commits** absorbed;
`git diff --stat 39822c9d c3b40b01 -- src ui/src test firmware` = **290 files, +60930 / −2252**.
The book's own authored tail (`0338fd14..c3b40b01`, the close-out steps 5–6 plus the CSS restore)
is 19 commits, **11 files, +941 / −19** over the same paths.

## 1. What shipped

- **`feat/tags` now contains staging's content.** The 943-commit gap measured at kickoff was closed
  by a single bulk merge, `1f4fa6f7` — `git rev-list --count feat/tags..staging` was **0** at the
  push. Security parity was verified on the merged tree rather than assumed (`auth.js` identical,
  nsec sign-in page absent, `publishEvent.js` carrying both the signature check and the brain-write
  hook, legacy `GET /api/neo4j/run-query` unrouted) — `stories/feat-tags-modernization/1-census-and-destination-ruling.md`.
- **Contextual pins and TL membership methods now compose**, instead of each branch carrying one and
  not the other. A pin can be scoped to a community context (LFO, "Tapestry & Web of Trust") *and*
  its Trusted List is scored by the operator's chosen membership method (`count` | `input` |
  `certainty`) — `stories/feat-tags-modernization/2-pin-stack-integration.md`, ADR
  `decisions/feat-tags-modernization/0001-pin-stack-composition.md`.
- **A contextual Trusted List is discoverable by a plain relay filter.** The context concept is
  stamped as an additional `z` on both the profile TL (30392) and the note TL (30393); the
  `-in-<context>` `d` suffix is demoted to a pure replaceability key no reader parses — ADR 0001 §3.
- **The Pinned tab's "update the note list" is a server recompute** of the assistant-signed 30393
  (`POST /api/trusted-list/refresh-pinned-tag`), not a client-signed bookmark publish; the bookmark
  export survives as its own action in the Export modal — book D2 / story 2 AC-7.
- **Two live data hazards on the interim merged tree were closed before deployment**: a contextual
  pin and its neutral twin publishing to the same replaceable coordinate (mutual overwrite), and a
  `retractStaleTLs` cron pass retracting every pre-existing `-in-<context>` list — ADR 0001 §Context.
- **`dlist-item-tagging` landed by ordinary merge** (`ffe74a75` / `515419f8`, zero code conflicts) —
  the proof the gap was really closed. The parked divergent replay `tags/dlist-item-tagging` is
  retired as evidence-only.
- **A branch policy exists and is executable, not remembered.** `feat/tags` is the **upstream** line
  for tagging work; staging is pulled into it after **every** promotion; graduation to staging
  happens by book close. The trigger is a mandatory checklist section in both promotion skills
  (`.claude/skills/cycle-staging/SKILL.md` §8b, `.claude/skills/cycle-prod/SKILL.md` §9) — book D3.
- **The contextual-pins CSS block was restored** after a merge silently dropped all 119 lines
  (`c3b40b01`, OPEN 303).

## 2. Epics & stories rolled up

### Epic: `feat-tags-modernization`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 census-and-destination-ruling | Enumerated the 54 `feat/tags`-only commits; one-sided features ruled promote vs tags-only; security parity verified on the merged tree | Done | in-session ruling (docs-mode; no separate review file) |
| #2 pin-stack-integration | Contextual pins composed onto membership methods; shared `d`-tag composer in `src/lib/event-tagging/pins.js`; context as a third `z`; Pinned-tab server recompute | Done | `reviews/feat-tags-modernization/2-pin-stack-integration.md` (final verdict `PASS`) |

Unstoried book steps, executed and recorded in `book.md` rather than as stories (the epic file's
expected shape listed six; rulings collapsed them): **step 1** the bulk merge (`1f4fa6f7`), **step 3**
the pinned-panel decision (absorbed into story 2 by ruling A), **step 5** the branch policy (D3, landed
as skill sections), **step 6** landing `dlist-item-tagging` (`ffe74a75`).

### Retroactively regularised: `contextual-pins`
`epics/contextual-pins.md` did not exist — its three stories and ADR shipped on `feat/tags` without an
epic umbrella (harness-lint L3 red). Written retroactively 2026-09-17 and flipped to **Done**; ADR
`decisions/contextual-pins/0001-context-scoped-pins.md` flipped *Proposed* → **Accepted** by story 2
AC-5, because it had shipped and been reviewed while still marked Proposed.

Epic folder retirement (`stories/`, `decisions/`, `reviews/` → `done/`) is **not** performed at this
close, matching the `contextual-pins` precedent in this same tree; no lint invariant requires the move,
and the `dlist-item-tagging` book that shares this branch is still open. Carried in §6.

## 3. As-built inventory

**User-facing**
- Tag page (`ui/src/pages/Tag.jsx`): pin switcher across neutral + contextual pins; `PinToContextModal`;
  contextual pin styling restored (`.bs-pin-switcher*`, `.ptc-list`/`.ptc-item*`, `.bs-tag-pin-actions`,
  `.bs-pins-context-badge` in `ui/src/styles.css`).
- Pinned panel (`ui/src/components/PinnedListPanel.jsx`): "update the note list" now POSTs
  `/api/trusted-list/refresh-pinned-tag`; the Export modal keeps the client bookmark publish.
  The per-context banner/labels were deliberately left to contextual-pins story 3.
- Everything staging had accumulated over 943 commits, now present on tags.brainstorm.world: the
  `dlist-item-tagging` surfaces (`/lists` paginated at 50, `/list/:ref`, item tagging), the
  links-config nav refactor, the `CoreNodeViews` Firmware Explorer, site-trust signals, relay-scan
  bounds, the About page and the developers NIP-85 link.

**Domain / concepts**
- Context concepts are existing firmware anchors: `39998:<runtime TA>:lfo`,
  `39998:<runtime TA>:tapestry-web-of-trust`, gated by `KNOWN_CONTEXT_SLUGS` in
  `src/lib/event-tagging/pins.js`. Composed only by `contextHandle(TA, slug)` — never hand-formatted.
- The pin's base `z` stays `39998:<LEGACY_TA_PUBKEY>:tag-pinning` (ADR event-tagging/0015 carve-out);
  a signed-in user's contextual pin carries three `z`: legacy `tag-pinning`, local `tag-pinning`
  (ADR shared-concepts-adoption/0004 dual-`z`), context.
- **No firmware reinstall required** — no concept definition changed (`firmware/**` absent from the
  story-2 diff); both context concepts already exist in the graph and in `firmware/active/`.

**Data & contracts**
- Kind **30392** (profile TL) and **30393** (note TL): contextual lists gain exactly one extra `z`
  (the context handle), appended last; neutral lists are **byte-identical to the pre-change output**
  (`pinVariantKey({})` → `''`, no extra `z`) — the guarantee that makes the membership ladder provably
  unaffected.
- `d`-tag strings now have a single source: `tlDTag` / `noteTlDTag` in `src/lib/event-tagging/pins.js`,
  delegated to by `src/api/trustedList/refreshPinnedTags.js` and `ui/src/utils/publishTagPin.js`
  (client/server parity pinned by a shared-fixture test).
- `pinTag({ tag, curationMethod, localTaPubkey, context, taPubkey })` — two distinct TA params that are
  never merged; `taPubkey` is legal **only** alongside `context` (book ruling C).
- `POST /api/trusted-list/refresh-pinned-tag` (pre-existing, Story 11) is now the Pinned tab's update path
  and recomputes **both** runners.
- New endpoint from the landed epic: `GET /api/dlists/page-counts` (`src/api/dlists/pageCounts.js`), the
  bounded replacement for the O(all items) `item-counts` scan on the `/lists` index.

## 4. Deviations from intent

| # | Specified (frame bullet) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "restore **or** replace" the 2026-07-16 downstream-only policy | Policy **reversed**: `feat/tags` is upstream for tag work; the rule became cadence, not direction | intentional-change | Book D3 — actual usage since July (contextual-pins, parts of security-auth-exposure, and the framing of `dlist-item-tagging`) was the reverse of the note; the note was stale | Tagging features are built and live-tested on tags.b.w before graduating | Skill §8b/§9 are the durable home; the stale July framing still sits in `stories/_intake.md:2448` (§7 finding c) |
| 2 | "each of the 54 commits promoted or marked tags-only" | One feature (`contextual-pins`) promoted; the rest ruled *already on staging in substance* | interpretation | Story 1 census — security hardening, site-trust, relay-scan bounds, About, developers link all present on staging; the Firmware Explorer JSON toggle subsumed by `CoreNodeViews` | None | — |
| 3 | The planned story 3 (pinned-panel refresh decision) | Folded into story 2 as AC-7 | intentional-change | Ruling A — one AC-1 assertion already bundled it; ~10 lines | None | — |
| 4 | AC-3's illustrative filter `{"#z":[header, context]}` read as a conjunction | Shipped as a **union** plus local narrowing by per-tag header | constraint-discovered | ADR 0001 §Decision — NIP-01 ORs within one filter key; the story's prose was corrected on the record | "TLs about X in LFO" costs one round-trip plus a client predicate, not one filter | Option D (a context-scoped per-tag TL header) deferred by ruling B |
| 5 | A contextual TL carries three `z` under `dlist-item-tagging` ADR 0002 | On this branch it carries **one** (`trusted-list` / `trusted-list-for-tag` concepts absent) | constraint-discovered | ADR 0001 §Decision — the two-`z` TL convention was that book's story 5 and has landed on no branch; the context `z` is additive and order-free, so it composes forward | Discovery by context works today; discovery by *kind of list* waits on the other book | Tracked by the `dlist-item-tagging` book |
| 6 | "the full suite ran" (deployability bullet) | Ran **capped**, interrupted at 177/206 suites; **every** failure attributed | interpretation | `book.md` §Full-suite attribution — ~45 were the port-7778 false-positive class (green when re-run with `BRAINSTORM_BASE_URL`), tag-detail was a corpus precondition, assistant-setup-state a stale dev server, harness-lint real and fixed in `0338fd14` | None | OPEN 292 / 297 (§7 finding d) |
| 7 | (not specified) `pinned-notes-display` guards | Two assertions re-aimed in the implementation commit, i.e. test edits outside the Implementer's lane | added-beyond-scope | Ruling C + the review's "Test re-aims — ratified individually"; both guards were generationally superseded by D2 and by the accepted contextual-pins hook, and both were already red on `origin/feat/tags` | None | §7 finding — the workflow has no named path for "re-aim of a superseded guard" |
| 8 | (not specified) Panel context banner | Not restored | deferred | Story 2 Deviations — user-facing per-context labelling belongs to contextual-pins story 3 | A contextual pin's panel does not name its context | OPEN 299-adjacent; §6 |

**Undocumented work** — diff content with no story/ADR provenance:
- `ui/src/styles.css` +119 lines (`c3b40b01`) — a *restoration*, not new work, and its own OPEN row (303).
- `ec8c41e2` (tag page accepts an `author:slug` coordinate) and `fb761edf`/`ba2a39a0` (the `/lists`
  index stops gating on item-counts) were bug-lane fixes carried on this branch under OPEN 301/302, with
  a review (`9b11da9e`) but no story — correct for the bug lane, noted here so the diff reconciles.
- Everything else in the 290-file diff arrives via the bulk merge and carries the provenance of its
  originating book on staging.

## 5. Quality state at close

- **Test gate at close:** see the `gate:status` line recorded below. Run on the post-flip tree.
  `GATE_RUN_PLACEHOLDER`
- **Known-environmental failure classes on this host** (unchanged from the book's attribution note, and
  re-observed in this run): the `:7778` foreign-relay false positive (OPEN 292 / 297) and the
  tag-detail corpus precondition. Neither is attributable to this book's code.
- **Accepted open issues:** OPEN 299 (three contextual-pins hardening gaps), 302 (fresh-tag chip
  coordinate — since fixed on this branch by `ec8c41e2`), 311 (a context pin omits the personal
  `localTA` `z` stamp), 316 (the context stamp is instance-scoped, so a mirrored contextual pin degrades
  — sibling book's row, referenced only).
- **Closed during or after the book:** OPEN 298 (`useTagMemberSets` hand-composed `d`-tag — closed by
  `search-index-selection` #5), 301 (`/lists` index gating on an unbounded count scan), 303 (the CSS block).
- **Debt from ADR 0001 §Consequences:** two `d`-tag composers exist client- and server-side and are kept
  honest only by a parity test; the context `z` count differs from the `dlist-item-tagging` convention
  until that book's story 5 lands.

## 6. Carry-forward register

- [ ] Option D — a context-scoped per-tag TL header making "TLs about X in <context>" a single relay
      filter (deferred by ruling B; revisit if the conjunction becomes a hot query) — §4 #4.
- [ ] Contextual-pins hardening: unchecked `refresh-pinned-tag` response, the contextual note-bookmark
      export row naming an address nothing publishes, `taPubkey` not hex-validated — OPEN 299.
- [ ] The panel's per-context banner / labels (contextual-pins story 3) — §4 #8.
- [ ] Republish existing contextual TLs so they carry the context `z` (they re-derive on the next
      refresh; explicitly out of scope for story 2).
- [ ] Retire the epic's folders under `done/` and delete the parked `tags/dlist-item-tagging` from origin
      (a remote-branch delete is a push — operator's act) — §2.
- [ ] OPEN 292 / 297 — the two "harness lies to itself" probes that produced ~45 of this book's
      full-suite failures — §7 (d).
- [ ] OPEN 300 — cross-branch OPEN.md row-number collisions — §7 (a).

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| (a) **OPEN.md row numbers collide on every cross-branch merge** — three collisions in this book alone (219–223 at the 2026-09-11 staging sync; 252–259 twice at the 2026-09-17 landing), each costing a renumber plus a cross-reference sweep with real risk of a stale pointer surviving. | OPEN 300 (`meta`) | **OPEN.md row 300** — already open with a fix shape (branch-scoped prefixes resolved at merge, or `scripts/open-row.sh` claiming from `origin/staging` and refusing hand-numbering). Not converted to a harness commit here: the fix changes how *every* session writes the ledger and needs its own story, and this close is explicitly barred from editing `OPEN.md`. Disposition = existing `meta` row, restated. |
| (b) **A cross-branch merge silently dropped a whole CSS block**; the JSX kept the class names, so tags.b.w rendered unstyled chips and a raw bulleted list in the Pin-to-community modal until an operator screenshot caught it. A conflict resolved "by superset" is not proof nothing fell out. | OPEN 303 (`meta`); operator screenshots 2026-09-17 | **Operator-ratified harness commit — proposed, not made.** Insert one numbered step into the `feat/tags` sync section of **both** promotion skills, as the new **step 3** (the existing "Do not push or merge it yourself" becomes step 4): `.claude/skills/cycle-staging/SKILL.md` §8b at line 158, `.claude/skills/cycle-prod/SKILL.md` §9 at line 161. Exact line: *3. **If the merge touched `ui/src/styles.css`, audit the selector set.** Diff that file against the merge base, extract every removed `.selector`, and grep each one against `ui/src`; a removed selector still referenced by JSX is a dropped rule, not a superset resolution (OPEN 303). Report any hits with the conflict count.* |
| (c) **The stale July "feat/tags is downstream" policy note misled a session** until the operator corrected it mid-book. Repo surfaces audited at this close: `OPERATIONS.md` does **not** assert it (lines 39 and 55 describe `feat/tags` as a long-lived sandbox that merges back — consistent with D3); both promotion skills now say "upstream" explicitly. One surface remains — `engineering-team/stories/_intake.md:2452`, which still ends its Policy note with "The book must restore, amend, or replace that policy explicitly" and no resolution pointer. | Memory `feedback_feat_tags_branch_policy`; book D3 | **Operator-ratified harness commit — proposed, not made.** Append one sentence at `engineering-team/stories/_intake.md:2452`: *Resolved 2026-09-17 (book D3): replaced — `feat/tags` is UPSTREAM for tagging work and the rule is cadence, not direction; see `.claude/skills/cycle-staging/SKILL.md` §8b and `cycle-prod/SKILL.md` §9.* |
| (d) **The session-start "stack present" probe is fooled by a foreign relay on :7778**, and its twin in the strfry guard suite turns a skip into hard failures. Still live: `scripts/session-start.sh:41-48` hardcodes 7778 and treats any 2xx as the concept-graph API (verified unchanged at this close); `test/strfry-write-assertion-bracket.test.js` `stackAvailable()` still checks only `r.ok` on the host leg (`:111-113`). This class produced ~45 of the 51 failures in the book's capped full-suite run and has now cost several sessions a false red. | OPEN 292, OPEN 297 (both `meta`, both OPEN) | **OPEN.md rows 292 + 297** — status re-verified as unfixed at this close, fix shapes already recorded (require `content-type: application/json` or parse the body; derive the port from `docker port tapestry 7778`). Disposition = existing `meta` rows, restated with a measured cost figure so the next triage has a number rather than an anecdote. |
| (e) **The CLAUDE.md NixOS section was committed by an Implementer stash detour** (`5e1a31aa` re-staged an unrelated local edit), pushing an always-loaded file to 212 lines against its 190-line budget and leaving harness-lint red on the branch until the book's full-suite pass found it. Fixed by moving the section to `docs/DEV_ENVIRONMENT_NIX.md` (`63c7fe5d`, `f95e7c58`) with a CHANGELOG row. | `engineering-team/CHANGELOG.md:84`; `book.md` §Full-suite attribution | **Operator-ratified harness commit — proposed, not made.** The lesson is that Implementer commits must be scoped by path. Append one sentence to `engineering-team/roles/implementer.md:51` (§"Per-phase commits"): *Stage by path — never `git add -A`, and never let a `git stash pop` carry unrelated files in. A stash detour once re-staged a local `CLAUDE.md` edit into an implementation commit (`5e1a31aa`), blowing an always-loaded file's line budget and leaving harness-lint red for days.* |
| (f) **Phase 4 edited `test/` twice**, and the story's own Deviations asserted the opposite — the shape by which a lane exception becomes invisible. Both re-aims were correct in substance (superseded generational guards, operator-ruled) and each was ratified individually in the review. | Review §Harness friction 2 | **Declined** — for now. The workflow would need a named "re-aim of a superseded guard" path with an inline authorizing-ruling requirement; the operator's in-session ruling plus the reviewer's per-assertion ratification already produced the right outcome, and a new lane invented from one instance would be premature. Declined as a workflow amendment; the *symptom* (the story's Deviations contradicting the commit) was corrected at close-out. |
| (g) **"Ruling C" had no durable home** — cited in a test and in the story, absent from the book's Decision log, so a future session could not verify what authorized two re-aims. | Review §Harness friction 1 | **Fixed in this book, not deferred:** Ruling C was written into `book.md` § Decision log entry 6 at close-out. Disposition = completed harness correction; no row needed. |

**Measurement** (`scripts/harness-stats.sh`, run 2026-09-23): 228 reviews parsed, 0 without a verdict,
2 final `CHANGES_REQUESTED`, 45 reviews with kick-back history, 3 story numbers with more than one
review file. This book contributed 5 phase commits under its epic name. Books open→close: this one at
6 days is the second-longest open book at close after `take-a-concept-back-out` — consistent with an
integration book that waited on operator pushes and live verification rather than on engineering.

**Port to the other flow?** (a), (d) and (e) are flow-agnostic — they bite Direction-mode books
identically (a Director-run book on a feature branch mints the same colliding rows, reads the same
lying probe, and can make the same unscoped commit). (b) is promotion-skill scoped and therefore
already shared. (f) is human-gated-flow specific.
