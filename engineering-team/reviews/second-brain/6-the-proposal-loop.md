# Review: Story 6 — The proposal loop (nominate one viable goal, decide it on the spine)

**Reviewer:** Claude (acting as Reviewer — independent subagent; the main session ran PO/Architect/Tester/Implementer, so this is the OPEN.md row-80(b) independent audit — nothing the Implementer reported was trusted; every gate re-run and every claim re-verified here)
**Date:** 2026-07-24
**Diff:** `git diff fe8660a0..HEAD` on `feat/second-brain` — story `8a5e6b5d` → adr `48ca2507` → tests `d7b969a6` → impl `496d1544`; base `fe8660a0` = staging tip; tree clean, HEAD `496d1544`
**Story:** `engineering-team/stories/second-brain/6-the-proposal-loop.md`
**ADR:** `engineering-team/decisions/second-brain/0006-the-proposal-loop.md` (d1–d16 + Test-class guidance; builds on second-brain 0001–0005)
**Test plan:** `engineering-team/stories/second-brain/6-the-proposal-loop.test-plan.md`
**Binding guides:** `product-team/guides/second-brain-style-guide.md`, `second-brain-design-guide.md`, `second-brain-wireframes.html` §3, PRD `product-team/prd/second-brain.md` §5.5/§6/§7.1–7.7

## Quality gates (run by reviewer, not trusted)

- [x] **Full `npm test` (~24-min gate) — RE-RUN IN FULL by me — `Overall: PASS`, exit 0.** `Total skipped: 51` (pre-existing Meili-not-indexed / settings-not-writable env skips in the pin/TL publish-flow suites — unrelated to this story). **No FAIL line anywhere** (the two `grep FAIL` hits are PASS test-names containing the word "FAIL"/"FAILS OPEN"). I re-ran the whole gate rather than accept the reported result.
  - `the-proposal-loop: 33 passed, 0 failed, 0 skipped` — **all 11 H rows ran LIVE** (stack present; 0 skipped). Authoritative live proof of every AC. (Pre-impl was 6/27 per the test plan; 6 + 27 = 33, so every previously-failing test now passes and no sentinel regressed.)
  - `capture-a-goal-and-see-it: 27 passed, 0 failed` · `structures-the-brain-can-trust: 24 passed, 0 failed` · `break-a-goal-into-pieces: 30 passed, 0 failed` · `attach-the-world: 29 passed, 0 failed` · `sessions-read-the-brain: 30 passed, 0 failed` — the five re-pinned siblings, all green under the widen-only 8th-require re-pin.
- [x] **Impl-commit-touched-no-test check:** `git diff d7b969a6..496d1544 --stat` lists **only the 8 source files** (`src/lib/brain/proposals.js`, `src/api/brain/index.js`, `src/api/normalize/index.js`, `ui/src/pages/brain/Proposals.jsx`, `ui/src/hooks/useBrainProposals.js`, `ui/src/App.jsx`, `ui/src/components/Layout.jsx`, `ui/src/styles.css`) — the impl commit touched **no test file**. Tests were not weakened after they were written.
- [x] **In-container JSX build** (the compile gap-filler for the new UI): `docker exec -w /usr/local/lib/node_modules/brainstorm/ui tapestry npx vite build` → **`✓ built in 51.01s`**, clean (only the pre-existing chunk-size >500 kB warnings; no errors). `Proposals.jsx` compiles.
- [x] **Independent live round-trip** (loopback via `docker exec tapestry curl 127.0.0.1:7778` = the `localTrusted` class; TA resolved per-run via `/api/assistant/pubkey` → `11f23fe4…93767`, never hardcoded) — a self-created **sentinel viable goal** (`rev6spot`, deliverable+boundary), fully torn down after:
  - `make-proposal` on the viable goal → `{success:true, result:'proposed', proposal:{uuid, slug, goal}}`; reads back on `GET /api/brain/proposals` as an **open card** (`goalName`, `whyNow`, `passedOver:[]`, `madeOn`) **and** on the goal detail spine as a **`proposed`** entry.
  - `approve-proposal` → `approved`; the proposal **leaves the queue** (empty), the goal spine gains an **`approved`** entry, and the prior **`proposed` entry is byte-identical before/after** (append-only confirmed live — nothing re-signed).
  - re-propose (allowed after the first was decided) → `skip-proposal` with empty reason **refused `reason-required`**; with a reason → **`skipped`** spine entry carrying the reason; leaves the queue.
  - a second decide of the same proposal → **refused `already-decided`**; `make-proposal` on a legacy captured goal → **refused `not-viable`** (nothing written).
- [x] **Host-side caller-class gates** (remote class, plain `curl http://localhost:7778`): `GET /api/brain/proposals` → **403**; `POST /api/normalize/{make,approve,skip}-proposal` → **401** each. Matches AC2's owner-gating and the default-deny middleware.
- [x] **Post-run residue** — brain clean: **3 legacy goals only** (revolutionize-physics / nosfabrica-success / tapestry-agentic-second-brain), **queue empty**, **hygiene `sound:true, problems:[]`**, **0 proposal elements**, **0 `harness-proposal-`/`rev6spot` json residue** (verified in strfry by-d-tag count-0 and Neo4j by-uuid + orphan sweep). The **`tapestry-proposal` concept persists** (self-bootstrapped, 0 elements) — expected and correct (only fixture *elements* are torn down; the concept is idempotent).
- [x] _Lint / typecheck not configured — skipped. Playwright not applicable — the interactive skip flow is source-asserted by S9 and the vite build is the JSX compile gap-filler; the disabled-until-non-empty + Enter/Escape behavior is source-verified in `Proposals.jsx:118–138`._

## Spec adherence (all seven ACs — live-proven)

- [x] **AC1 — Nominates exactly one viable leaf, comparative rationale, canonical register.** `makeProposal` (`normalize/index.js`) re-reads the live graph (`resolveGoalConcept` + `fetchGoalRecords` + `resolveDecomposition`) and refuses unless the nominee is a single viable leaf — `deriveStanding(g, {hasChildren}) === 'viable'` (`goals.js:68-72`: a parent is `captured`, never viable). Refusals `goal-not-found`/`ambiguous-slug`/`not-viable`; each runner-up must resolve, be viable, and be distinct (`runner-up-unknown`/`runner-up-not-viable`/`runner-up-is-nominee`/`runner-up-duplicate`). Proven live (my round-trip + `not-viable` refusal) and by S1/H1/H3/H5. `whyNow` + `passedOver:[{goal,whyNot}]` carried on the `proposed` element; the card renders *"Next: {goal}"* + why-now + *"considered instead"* + one line per runner-up (`Proposals.jsx:100–114`).
- [x] **AC2 — Proposal queue renders emphasis cards, equal-weight Approve/Skip, verbatim empty/error.** Route `proposals` under `/tapestry` (`App.jsx:211`), owner-gated nav (`Layout.jsx:16`, `ownerOnly:true`), owner-gated read (`handleGetProposals` gates `isOwner||localTrusted → 403`). Card = the one derived tint `rgba(88,166,255,0.08)`, *"Next:"*, why-now body, *"considered instead"* block; **Approve** solid (`.brain-btn-approve`) + **Skip…** outline (`.brain-btn-skip-open`), both `.brain-btn` (44px min-height) — neither subordinate. Empty state verbatim (`Proposals.jsx:17` = design-guide:79); error state verbatim (`:88` = design-guide:79). Newest-first + decided-never-renders via `openProposals`. Host 403 proven live (H11 + my check).
- [x] **AC3 — Approve records a dated `approved`, retires the proposal, on the spine; launches nothing.** `decideProposal` appends an `approved` element (`goal` = nominee slug, `happenedOn` = today), never mutates the `proposed`. Queue removal + spine entry proven live (my round-trip + H6). **No launch:** `decideProposal`/`handleApprove*` contain no `fetch`/`spawn`/`enqueue`/`scheduler`/`launch*`/`child_process` (grep-confirmed + S2). Confirmation string ratified verbatim (d16, below).
- [x] **AC4 — Skip requires a one-line reason; records skip+reason; canonical confirm.** Server enforces `reason-required` before the core (`handleSkipProposal:` refuses empty/whitespace reason). UI disables Skip until `reason.trim()` (`Proposals.jsx:135`), placeholder verbatim (`:18`), Enter submits / Escape cancels (`:127–130`), confirms *"Skipped — noted."* (`:19`). Proven live (empty refused → still open; with reason → `skipped` entry carries reason) + H8.
- [x] **AC5 — Standing is exactly open/approved/skipped; owner-only transitions; one spine; append-only.** `PROPOSAL_TYPES = ['proposed','approved','skipped']` (no fourth state). Open-ness **derived at read** from the absence of a decision (`openProposals`, `proposals.js:106-115`) — no stored flag. No auto-decide/auto-expiry path exists; `already-decided` blocks a second decision. Full lifecycle on the nominee's one spine (`proposed`+`approved`/`skipped` all carry the same `goal`). Append-only: mint-only path, `RecordEntry` exposes no edit/delete affordance (GoalDetail unchanged). Byte-unchanged proven live (H6 + my check).
- [x] **AC6 — No numeric score anywhere owner-facing.** The card object (`handleGetProposals`) carries only `proposalId/goal/goalName/whyNow/passedOver/madeOn` — no score/rank/percentage. `Proposals.jsx` renders words only; S11/H2 pin the absence; my live card had no numeric-score token.
- [x] **AC7 — Copy discipline, append-only spine, second-operator guard, no regression.** Jargon scan clean over `Proposals.jsx` (no `element/kind/schema/pubkey/superset/persona/acceptance criteria/lease/payload/endpoint`); no exclamation marks in any owner-facing string. Concept is new/append-only/runtime-created (`ensureProposalConcept`)/never-firmware-seeded/TA-runtime-resolved. Five sibling suites green under the widen-only re-pin (gate above).

## ADR adherence (Option A; d1–d16 + the load-bearing (a)/(b))

- [x] **The load-bearing (a)/(b) → shape (b), verified by construction and live.** grep-confirmed: **no `regenerateJson`** anywhere in `makeProposal`/`decideProposal`/`mintProposalElement` (the only `regenerateJson` call sites are the unrelated schema/property paths at `:56–2087`). A decision is a **separate appended element** (random d-tag) referencing the proposal by `proposalId`; open-ness is `openProposals` (derived). H6 + my round-trip prove the `proposed` element is byte-identical after a decision.
- [x] **d1** — `tapestry proposal` → slug `tapestry-proposal` → handle `39998:<TA>:tapestry-proposal` (TA runtime-resolved); single `proposal` wrapper; `required:['name','slug','description','type','goal','happenedOn']`; `x-tapestry.unique:['slug']`; enum `['proposed','approved','skipped']`; plain-language descriptions. Present in `PROPOSAL_SCHEMA`.
- [x] **d2** — one concept, three types by `type`; merged into the story-5 `records` array beside `worked`/`noted`. `PROPOSAL_TYPES` exported.
- [x] **d3** — append-only by construction: `mintProposalElement` uses `randomDTag()` nonce + `dtag.childDTag(label, header, nonce)`, derived unique `slug`, `publishToStrfry`+`importEventDirect`+`SET :ListItem`+`MERGE superset→elem`; no dedup, no MERGE-over, never re-signed.
- [x] **d4** — record-based linkage: `proposal.goal` = nominee slug; decision carries `proposalId` = the `proposed` slug; passed-over goals get no spine entry (confirmed — only `goal` projects). No relationship-whitelist edge.
- [x] **d5** — nominee verified viable-leaf at write against the live graph; heuristic is the caller's (only `goal`/`whyNow`/`passedOver` supplied). `achieved`/`abandoned` aren't yet real standings (later stories) so any non-viable resolves to `captured` → `not-viable`.
- [x] **d6** — `POST /api/normalize/make-proposal`: gate-first, 400 on missing `goal`/`whyNow`, `too-many-runners-up`>`MAX_PASSED_OVER`, `runner-up-incomplete`, then one `serializeGoalWrite` task with viability + distinctness + `already-open` checks, `ensureProposalConcept()`, mint. Result `{success:true, result:'proposed', proposal:{uuid,slug,goal}}` (uuid added per the test-plan result-shape note). Registered at `registerNormalizeRoutes`.
- [x] **d7** — `approve-proposal`/`skip-proposal`: gate-first, shared `decideProposal` under `serializeGoalWrite`; `proposal-not-found`; **`already-decided`** guard; `reason-required` validated before the core on skip; `approve` carries no reason; **neither launches anything**. Both registered.
- [x] **d8** — `ensureProposalConcept()` idempotent: resolve → return if present (so `save-schema` runs only when absent — no per-write churn); else `create-concept` + `save-schema` via `invokeNormalizeHandler`, re-resolve. Self-bootstrap confirmed live (concept present, 0 elements post-teardown). Never firmware-seeded.
- [x] **d9** — all three producers run through the **existing** `serializeGoalWrite` (14 refs; not renamed). `mintProposalElement` holds no mutex; no nested-serialized core → no deadlock (S4).
- [x] **d10** — new pure `proposals.js` (zero-require: `parseProposalRow`/`groupProposalsByGoal`/`openProposals`/`proposalEntry`/`PROPOSAL_TYPES` + a `sortProposalsByRecency` helper); `handleGetGoalDetail` merges the proposal projection into `records` and re-sorts newest-first with a `_createdAt` tie-break stripped on output; brain gains **exactly one require** (the 8th), stays read-only (no mutation/strfry tokens). Merge proven live (H9).
- [x] **d11** — `GET /api/brain/proposals`: gate-first, `openProposals` + goal-name resolution, projected cards sorted newest-first, empty → `{success:true, proposals:[]}`, no egress. Confirmed live.
- [x] **d12** — new `Proposals.jsx` + `useBrainProposals.js` + `App.jsx` route + `Layout.jsx` nav + `styles.css`; `GoalDetail.jsx` unchanged (byte-verified). One derived tint, no new `:root` tokens.
- [x] **d13** — copy discipline (above). `event` not present; no banned jargon; no numeric score.
- [x] **d14** — conversational-contract addendum is doc-only; no code obligation — satisfied.
- [x] **d15** — `MAX_PASSED_OVER = 8` single named constant in `normalize/index.js`; `too-many-runners-up` refusal above it.
- [x] **d16** — approve string **`Approved — launch it when you're ready.`** verbatim (`Proposals.jsx:20`). No other approve wording present.

## Concept-graph integrity
- [x] Handle is `39998:<TA>:tapestry-proposal` (kind:pubkey:slug), TA runtime-resolved via `getOwnerAssistantPubkey()` (server) / `readProposals(taPubkey)` — **no hardcoded 64-hex anywhere in the source diff** (grep-confirmed).
- [x] **Firmware reinstall correctly NOT required** — the concept is runtime-created / self-bootstrapped; `firmware/` and the installer are byte-unchanged (verified). ADR "Firmware reinstall required? No." holds; confirmed live (concept present without any firmware install).
- [x] New code orients via the runtime graph read, not by re-deriving from BIBLE.md.

## Things tests can't catch
- [x] **No secrets / no hardcoded pubkey** — clean.
- [x] **No stray debug** — the only `console.error` calls are catch-path only (`handleMakeProposal`/`handleApproveProposal`/`handleSkipProposal` catch blocks), matching the sibling handlers. No `console.log`, no commented-out code.
- [x] **Error paths gate-before-work** — every handler gates and validates before any `serializeGoalWrite`/mint; refusals return before the write point; `makeProposal`'s viability checks precede `ensureProposalConcept`+mint (a `not-viable` refusal writes nothing — proven live).
- [x] **Concurrency** — all three writes serialize through the single process-singleton `serializeGoalWrite`; the `already-open` and `already-decided` read-validate-write guards are correct under the mutex (safe against a double-click).
- [x] **Privacy §7.4** — no `publishEverywhere`/`nostrPublish`/outbound `fetch` in the diff; writes ride `publishToStrfry`(local)+`importEventDirect`; the decide POSTs are same-origin. No egress.
- [x] **Residue** — sentinel round-trip fully cleaned; brain at 3 legacy goals, hygiene sound (above).

## House rules check
- [x] Concept Graph API authority respected (three-call orientation done at recon per the ADR; runtime graph reads, not source-derived truth).
- [x] No new lint/typecheck/build tooling; no new deps; JS-without-build preserved.
- [x] **Untouchables byte-unchanged** (git-verified no diff): `relationships.js`, `probe.js`, `middleware/auth.js` (incl. `PUBLIC_MUTATIONS`), `firmware/`, the four ADR-0015 `LEGACY_*` files, `ui/src/utils/nostrPublish.js`, `GoalDetail.jsx`. `serializeGoalWrite` not renamed; no relationship-whitelist edge; `HYGIENE_CONCEPTS` unchanged; no LEGACY_* removal.
- [x] test.js registration is the standard 5-touch; the new `overallOk` term is added **before** the severed terminator (OPEN.md #43 dead block left intact).

## Product-guide adherence
- [x] **Copy matches the guides verbatim:** "What next?" (wireframes §3), "Next:", "considered instead", skip placeholder "why not this one, in a few words", "Skipped — noted." (style-guide:27), empty + error states (design-guide:79), approve string (ADR d16). No exclamation marks; no banned jargon; no numeric score (comparisons and words only — design principle 2).
- [x] **Design-guide patterns honored:** the emphasis card with the one permitted derived tint `rgba(88,166,255,0.08)`; equal-weight Approve(solid)/Skip…(outline); inline skip field on the contrasting input background; designed empty/loading/error states; colors via tokens (`--accent`/`--border`/`--text-muted`/`--bg-tertiary`/`--accent-hover`). Note: the guide's `--radius`/`--space-3` are product-guide token *names* that do not exist in this codebase's `:root`; the impl correctly uses raw px (matching the established `.brain-*` CSS convention, e.g. story-5's `border-radius: 6px`) rather than undefined `var()`s — the right call, not a defect.

## Findings

### Blocking
_None._

### Non-blocking
1. **`ui/src/pages/brain/Proposals.jsx:86–90`** — the error state renders the verbatim canonical string but omits the `.brain-retry` `<button>` + `refetch` that ADR d12 describes (mirroring `Goals.jsx`); the hook exposes `refetch` but the page doesn't destructure it. Not an AC or test requirement, and the hook auto-refetches on window `focus`/`visibilitychange` + a 20 s poll, so the error self-heals without a manual control. Optional: add the retry button for parity with the Goals view.
2. **`src/api/normalize/index.js` (make-proposal ordering)** — `ensureProposalConcept()` runs *before* the `already-open` check (the ADR d6 prose lists it after), because the concept header is required to read existing proposals. This is a necessary, benign reorder: the concept is created only after viability passes, is idempotent, and on the first-ever proposal there are no proposals to be `already-open`. No behavioral impact.

### Harness friction
_None._ The story/ADR/test-plan were internally consistent; the planned five-touch sibling re-pin and result-shape `uuid` note landed exactly as documented; the pre-impl 6/27 baseline matched. The `--radius`/`--space-3` guide-token mismatch (non-blocking #note above) is a product-guide artifact, not harness friction.

## Verdict
**PASS**

## On PASS (owned by the main session per launch instruction)
- [ ] Story `**Status:**` → `Done` — **deferred to the main session** (this independent audit does not flip status or commit).
- [x] Completion detection — story 6 was the last-planned second-brain story per the book anchor; on flipping status the main session should run the book-completion check and *offer* `/close-book` (do not auto-run). The ratified approve string `Approved — launch it when you're ready.` should be back-filled into the style guide's confirmations list at book-close (d16 / return edge).
