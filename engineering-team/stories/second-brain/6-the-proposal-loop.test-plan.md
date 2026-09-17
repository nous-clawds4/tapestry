# Test Plan: Story 6 — The proposal loop (nominate one viable goal, decide it on the spine)

**Story:** `engineering-team/stories/second-brain/6-the-proposal-loop.md`
**ADR:** `engineering-team/decisions/second-brain/0006-the-proposal-loop.md`
**Date:** 2026-07-24

Test file: `test/the-proposal-loop.test.js` (structural template: `test/sessions-read-the-brain.test.js`). Classes per the ADR's Test-class guidance + test-hermeticity-ci/0001: **U** (pure `proposals.js` core, always executed), **S** (source assertions, stack-free), **H** (live local stack, per-test SKIP when unreachable), **R** (regression sentinels).

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| **AC1** — nominates exactly one **viable** goal + why-now + named runners-up (each with a why-not); a non-viable/parent nominee is refused | `H1` (make-proposal round-trip: whyNow + passedOver read back on the queue); `H3` (`not-viable` refused on a captured goal, nothing written); `H5` (runner-up refusals: is-nominee, not-viable); `S1` (route/gate/`not-viable`/`runner-up-*`); `U2` (parse whyNow/passedOver) | integration + source + unit |
| **AC2** — the Proposal queue renders open proposals as emphasis cards with equal-weight Approve/Skip; verbatim empty/error | `S9` (emphasis card, equal-weight Approve/Skip…, "What next?", "Next:", "considered instead"); `S10` (verbatim empty + error states); `S12` (owner-gated route + nav); `H1` (queue read returns the open card) | source + integration |
| **AC3** — Approve records a dated `approved` decision, retires the proposal, shows on the spine; **launches nothing** | `H6` (approve → `approved` spine entry; leaves the queue; append-only ADD); `S2` (route/gate/`approved` + **no launch/egress** in `decideProposal`); `S10` (ratified approve confirmation verbatim) | integration + source |
| **AC4** — Skip requires a one-line reason (disabled until non-empty); records `skipped` + reason; confirms "Skipped — noted." | `H8` (empty reason refused → nothing written; with a reason → `skipped` entry carrying the reason, leaves the queue); `S9` (Skip disabled until the reason is non-empty; verbatim placeholder); `S10` (verbatim "Skipped — noted.") | integration + source |
| **AC5** — standing is exactly `open`/`approved`/`skipped`; transitions only by an owner act (no auto-decide/expiry); full lifecycle on one spine; append-only | `U3` (open-derivation: a decided proposal is excluded; open = no decision references it; newest-first); `H1`+`H6`+`H8` (`proposed`→`approved`/`skipped` all on the nominee's/runner's one spine); `H6` (append-only: the `proposed` entry byte-unchanged after the decision); `H7` (`already-decided` — decided exactly once); `H4` (`already-open` — one open per goal); `U4`/`U5` (projection + grouping) | unit + integration |
| **AC6** — no numeric score in any owner-facing proposal copy | `S11` (Proposals.jsx renders no score/rank/percentage/gauge/star); `H2` (the queue card object carries no numeric score/rank field) | source + integration |
| **AC7** — jargon-clean verbatim copy; Proposal new/append-only/runtime-created/never-firmware-seeded/TA-runtime-resolved; no regression | `S13` (jargon-clean + no exclamation on Proposals.jsx); `S5` (append-only mint: random/nonce d-tag, **never** `regenerateJson`); `S3`+`H1` (self-bootstrap: concept + schema exist live after the first proposal); `S15` (no 64-hex); `H10` (hygiene stays green); the five sibling suites re-run green under the widen-only import re-pin | source + integration |
| **Load-bearing (a)/(b) — append-only shape (b)** (ADR d3) | `S5` (no `regenerateJson` anywhere on the make/decide/mint path — decisions are separate appended facts); `H6` (the `proposed` element is byte-unchanged after its decision — nothing re-signed); `U3` (open-ness derived at read from the absence of a decision) | source + integration + unit |
| **Read surface — records[] merge; brain 8th require, re-pinned across 5 suites** (ADR d10) | `S6`+`S7`+`S8` (queue read; goal-detail merges the proposal projection; brain requires `proposals`, import surface pinned to EIGHT); `H9` (the spine MERGES `worked` + `proposed` + `approved`, newest-first); sibling re-pins in `capture`, `structures`, `break`, `attach`, `sessions-read` (allowlist widened to eight — widen-only, all stay green) | source + integration |

## Edge cases

- [x] Malformed / non-proposal json → `parseProposalRow` returns `null`, never throws (`U2`).
- [x] Open-derivation: a `proposed` with a matching `approved`/`skipped` (by `proposalId`) is excluded; one with none is open; newest-first (`U3`).
- [x] The spine projection is uniform across `proposed`/`approved`/`skipped` — `{date,type,summary}` (`U4`); records bucket by goal (`U5`).
- [x] A non-viable (captured) or parent goal is never nominated (`H3`, `S1`); a viable leaf is (`H1`).
- [x] A runner-up equal to the nominee, or non-viable, is refused with nothing written (`H5`).
- [x] One open proposal per goal — a second is refused `already-open` (`H4`); after a decision, the goal is re-proposable (implicit — `H8` proposes on the runner after its own lifecycle).
- [x] A decision is made exactly once — a second decide (approve or skip) is refused `already-decided` (`H7`).
- [x] Skip with an empty reason is refused; the proposal stays open (`H8`).
- [x] Append-only under a real decision — the `proposed` spine entry is byte-unchanged; the decision ADDs one entry (`H6`).
- [x] The goal-detail `records[]` merges proposal + work-record facts, newest-date first (`H9`).
- [x] No numeric score in the card copy or the card object (`S11`, `H2`).
- [x] Caller classes: remote GET `/api/brain/proposals` → 403 (in-handler gate); remote POST make/approve/skip → 401 (default-deny middleware) (`H11`).
- [x] Concept absent (fresh instance) — the read tolerates it; the write self-bootstraps (`H1`, `S3`).
- [x] Untouchables (`relationships.js`, `probe.js`, `auth.js`/`PUBLIC_MUTATIONS`) free of this story (`R2`).

## Test infrastructure

- **Framework:** Node built-in runner (`node test/test.js`; the suite also runs standalone: `node test/the-proposal-loop.test.js`). No new frameworks.
- **Concept Graph API:** loopback `http://127.0.0.1:7778` via `docker exec tapestry curl` (the `localTrusted` class) for reads/writes; host `http://localhost:7778` via `fetch` for the remote caller-class gate checks. TA pubkey resolved at runtime (`/api/assistant/pubkey`) — never hardcoded.
- **Firmware state:** none required. The **Proposal concept is runtime-created / self-bootstrapped** on the first `make-proposal` (never firmware-seeded); no `POST /api/firmware/install` precondition.
- **Fixtures:** sentinel-named (`harness-proposal-`) — a **viable nominee** (deliverable + boundary), a **viable runner-up**, a **non-viable/captured** goal (no deliverable/boundary), append-only proposal elements (`proposed`/`approved`/`skipped`), and one work record (the merge proof). Teardown: strfry delete by d-tag (goals via the real `dtag` core; proposals/work records' random d-tags captured from responses) → Neo4j element+tag delete by uuid → value-scoped orphan sweep (json CONTAINS the sentinel) → strfry count-0 verify. Pre-clean runs the same routine; a teardown failure is a loud suite failure. The **concept persists** across runs (only fixture *elements* are torn down); the suite is idempotent. **Verified post-run: 3 legacy goals, zero `harness-proposal-` leftovers, hygiene sound.**
- **Result-shape note (result of the teardown need + the create-work-record precedent):** `make-proposal` / `approve-proposal` / `skip-proposal` responses carry the minted element's **`uuid`** (`proposal.uuid` / `decision.uuid`) alongside the slug — required for durable teardown and asserted by `H1`. This extends ADR d6/d7's result shape (`{slug, goal}` → `{slug, goal, uuid}`), consistent with `create-work-record`'s `record.uuid`.
- **Registration:** the suite is wired into `test/test.js` — require, run-call, summary line, the **live `overallOk` chain** (the OPEN.md #43 severed terminator flipped `;`→`&&` with the new term ending `;`; the dead block untouched), and `totalSkipped`.

## How to run

```bash
node test/the-proposal-loop.test.js
```

Full gate (≈24 min; background via the OPEN.md rows 74/83 bounded waiter):

```bash
npm test
```

## Verification

The new tests fail with the current code, for the right reason (feature absent — the `proposals` core is missing, the three routes 404, the concept is absent, the queue read 404s, the Proposal view does not exist, the goal-detail `records[]` carries no proposal projection). The five sibling suites re-run green under the widen-only import re-pin. Confirmed 2026-07-24 (stack present) at commit `48ca2507`:

```
the-proposal-loop: 6 passed, 27 failed, 0 skipped
  # 27 FAIL — the substantive spec (U1–U5, S1–S3, S5–S13, H1–H9, H11):
  #   "proposals.js does not exist yet"; "make-proposal is not registered";
  #   "must register GET /api/brain/proposals"; "must require ../../lib/brain/proposals";
  #   "Proposals.jsx does not exist yet"; "must add an owner-gated nav entry";
  #   route 404s on the H rows ("Cannot POST /api/normalize/make-proposal"; "Got 404").
  #  6 PASS pre-impl (documented sentinels): S4 (serializeGoalWrite survives; per-handler
  #   checks guarded), S14 (brain read-only today), S15 (no 64-hex), H10 (hygiene green),
  #   R1/R2 (invariants). These pass BEFORE and AFTER.

capture-a-goal-and-see-it:      27 passed, 0 failed, 0 skipped   (re-pin S1 → PASS)
structures-the-brain-can-trust: 24 passed, 0 failed, 0 skipped   (re-pin S3 → PASS)
break-a-goal-into-pieces:       30 passed, 0 failed, 0 skipped   (re-pin S1 → PASS)
attach-the-world:               29 passed, 0 failed, 0 skipped   (re-pin S11 → PASS)
sessions-read-the-brain:        30 passed, 0 failed, 0 skipped   (re-pin S8 → PASS)
```

Post-run residue check: brain shows the 3 legacy goals only, 0 `harness-proposal-` json leftovers, hygiene sound.

## Notes for the Implementer

- **Consider Playwright** for the interactive **skip-reason-required** flow (Skip disabled until non-empty; Enter submits; "Skipped — noted.") — the ADR flags it as optional-but-recommended (the first interactive owner-facing brain write). The core ACs are U/S/live-H covered regardless; a browser spec would harden the disabled-until-non-empty + Enter-submits interaction that S9 can only source-assert.
- **The result shape must include `uuid`** on all three producers (see the result-shape note) — `H1` fails without it.
- **The five sibling re-pins are already applied** (widen-only, in this test commit). The Implementer's source diff must **not** touch any test file (the impl-commit-touched-no-test guard); adding `require('../../lib/brain/proposals')` keeps all five siblings green.
