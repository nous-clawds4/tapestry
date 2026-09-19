# Review (docs-lane): row 325 — diagnosis + close, Neo4j-readiness wait

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19
**Lane:** Docs-mode / doc-lane (no story, no test plan; non-numbered filename per `workflows/0-intake.md` §3).
**Verdict history:** Round 1 (2026-09-19) — **CHANGES_REQUESTED** (one durable-ledger overclaim). Round 2 (2026-09-19) — **PASS** (blocker remedied and independently re-derived). Round 1 retained below as history.
**Diff:** Round 1 reviewed `git show 82abeb63`; Round 2 reviewed the amended `git show 16294363` (parent `a2d652a2`; `82abeb63` amended away). Branch `docs/row-325-diagnosed-pointer`.
**Files under review (4, all docs/ledger — no code):** `OPEN.md`, `docs/SMOKE_TEST.md`, `OPERATIONS.md`, `engineering-team/stories/_intake.md`.

Docs-mode audit: accuracy of the prose against the shipped code, the incident record, the deploy platform, and cross-reference consistency. `npm test` is a regression check only here and there is no code in this diff (see Quality gates).

---

# Round 1 (CHANGES_REQUESTED)

## Quality gates (run by reviewer, not trusted)

- [x] **Regression surface untouched.** The diff changes docs/ledger files only; `git show 82abeb63 --stat` shows no `src/` or `test/` path. The code regression gate for the underlying fix was already green at that fix's own review — `20260919T041557Z-22-a36b [reviewer-udep] … on 9b00dc45 — PASS, exit 0, 2852 passed, 0 failed, 522 skipped, 205/205 suites` (`engineering-team/reviews/user-data-error-path/1-harden-user-data-error-path.md:21`). Not re-run: no code changed in this diff.
- [x] **`npm run test:playwright`** — N/A (no browser/UI surface).
- [x] **harness-lint** — `bash scripts/harness-lint.sh` → `harness-lint: clean (0 violations)`, exit 0. No L7/L14 verdict-token and no L8 dead-link issues introduced (the fixed `SMOKE_TEST.md:19` → §9.5 target exists at `OPERATIONS.md:343`).
- [x] **Cross-references / index rows** — verified per the claims table below.
- [x] _Lint / typecheck / build not configured — skipped._

## Claims-adherence (one row per substantive claim; evidence-first)

| # | Claim in the prose | Verdict | Evidence (command / file:line) |
|---|---|---|---|
| 1 | Cause = `handleGetUserData`, non-timeout `.catch`, shorthand `query,` vs in-scope `cypherQuery`; fixed to `query: cypherQuery`; no `unhandledRejection` handler in server entry | **Accurate** | Fix at `src/api/export/users/queries/userdata.js:284` (`query: cypherQuery`) inside the `.catch` at `:271`; the timeout branch returns 504 at `:276`; `cypherQuery` declared at `:69`; no `const/let/var query` anywhere in the handler (grep). `grep -n unhandledRejection\|uncaughtException bin/control-panel.js` → none. |
| 1b | "A global unhandled-rejection backstop … **was decided (log-and-exit)** and is **tracked as its own story**" | **OVERCLAIM — blocking** | Contradicted by every source artifact: story `…/1-harden-user-data-error-path.md:49` ("**raised, not decided**"), `:57-62` ("log-and-exit, **or** log-and-continue … decision is recorded, not made inside this story"); book `…/user-data-error-path/book.md:20`; epic `…/user-data-error-path.md:15-16` ("**Raise — but do not decide**"). Repo-wide `grep -rniE "log-and-exit"` finds only OPEN.md:386 and the story's list of *two* options. No story/intake tracks it (`ls stories/`, `_intake.md` grep → none). See Blocking finding 1. |
| 2 | Timing figures ("roughly 8–40 s"; "~40 s … on the production deploy where it was timed") | **Supported / hedged** | `OPEN.md:386` uses "roughly"; `SMOKE_TEST.md:40`, `OPERATIONS.md` §9.5, `_intake.md` all use "~/about … the production deploy where it was timed" — approximate + scoped to one observation, internally consistent (ready-time ≈ upper bound of the down-window). Minor note below on the 8 s lower bound. |
| 3 | Residual §8 citations: `SMOKE_TEST.md:19` fixed to §9.5; `cycle-staging/SKILL.md:157,164`, `cycle-prod/SKILL.md:162`, `BIBLE.md:1407` still stale | **Accurate** | `sed -n` of each line: `SMOKE_TEST.md:19` → "§9.5" (fixed); `cycle-staging:157` "§8.5", `:164` "§8"; `cycle-prod:162` "§8.2"; `BIBLE.md:1407` "§8.5/§8.6" (all stale). Renumber mapping confirmed: `OPERATIONS.md` §9.5 at `:343`, §9.2 at `:319`. "three files" (staging, prod, BIBLE) correct. |
| 4 | Incident history 1–5 preserved; only final paragraph + status columns changed; row well-formed | **Accurate** | `diff` of the pre-`**Diagnosed`** slice of the old (`a2d652a2:OPEN.md`) vs new row → identical. Occurrence markers `35393147680 / 35400622146 / #88 / 2026-09-10 / "A fifth occurrence" / 35408387041 / "four recorded occurrences"` each present exactly once. `awk -F'|'` on the row: `NF=9` (7 columns), Status (f6)=`DONE`, Done (f7)=`2026-09-19 (…)`. |
| 5 | Readiness recipe: jq path `.data.verifiedFollowerCount`; 3 consecutive non-null reads | **Accurate** | `handleGetUserCounts` returns `{ success, data: { …, verifiedFollowerCount } }` at `userdata.js:434`; Neo4j-down leaves it `null` via the outer `catch` (`:424-426`), a number once up. Recipe at `SMOKE_TEST.md:44-51`: `jq -r '.data.verifiedFollowerCount // "null"'`, `until [ $streak -ge 3 ]`, reset on null. `PK`/`H` defined (`:24-25`); route at `src/api/index.js:209`. |
| 6 | "Live on production" — PRs #681/#682 merged, run `35423273836` success | **Accurate** | `gh pr view 681` → MERGED→staging, merge `a6f1d3ea`; `gh pr view 682` → MERGED→main, merge `6e5c6a5f`; `gh run view 35423273836` → `conclusion: success`, "Deploy to Tapestry". |
| 7 | harness-lint clean | **Accurate** | `bash scripts/harness-lint.sh` → `clean (0 violations)`, exit 0. |
| 8 | Merge kept both sides; no rows dropped; #680 (326–328) not merged | **Accurate** | `diff` of OPEN.md row-number sets `origin/staging` vs branch → identical; row 257 absent in **both** (pre-existing gap, not a merge drop); max row 325 in both (no 326–328); fix present in branch (`userdata.js:284`). `git log --oneline -3` → `82abeb63 / a2d652a2 / a6f1d3ea`. |

## Concept-graph integrity
- N/A — no concept handles, schema, or firmware in this diff. No `/summaries` orientation required.

## Things tests can't catch
- [x] No secrets; no TA-pubkey literals introduced.
- [x] No leftover debug code; ledger/docs prose only.
- [x] Disclosure discipline now correctly *lifted* — the fix is live on production, so the mechanism, endpoint-as-trigger, and file:line are stated in the open per SECURITY.md's own "until a fix ships" condition. Consistent across all four files.

## House rules check
- [x] No new lint/typecheck/build tooling.
- [x] Concept Graph API authority not implicated.

## Findings (Round 1)

### Blocking
1. **`OPEN.md:386`** — the "Diagnosed, fixed, and shipped" paragraph asserts, as settled fact: *"A global unhandled-rejection backstop for the server entry **was decided (log-and-exit)** and is **tracked as its own story**."* Both halves are unsupported and the first directly contradicts the authoritative source artifacts for this same follow-up:
   - **"was decided (log-and-exit)"** — the story (`engineering-team/stories/user-data-error-path/1-harden-user-data-error-path.md:49`, `:57-62`), book (`engineering-team/audits/user-data-error-path/book.md:20`), and epic (`engineering-team/epics/user-data-error-path.md:15-16`) uniformly say the policy was **raised, not decided**, and list *two* open options (log-and-exit **or** log-and-continue). No decision record, ADR, or ledger row in-repo records that log-and-exit was chosen (`grep -rniE "log-and-exit"` → only OPEN.md:386 and the story's two-option list).
   - **"tracked as its own story"** — there is no such story or intake entry (`ls engineering-team/stories/` and `_intake.md` grep → none; the book's acceptance-frame bullet for it is unchecked and "Epics in this book" lists only `user-data-error-path`).
   This lands in the durable ledger on a row being **closed (DONE)**, and "tracked as its own story" will send a future reader hunting for a story that does not exist — the exact "nothing tracks fixing it" failure mode this row was opened to complain about.
   **Asked change:** align the sentence with the source artifacts — e.g. "Whether the server entry should adopt a global unhandled-rejection / uncaught-exception policy (log-and-exit vs log-and-continue) was **raised** to the operator as a follow-up; no decision or tracking story is recorded yet." If a decision and a tracking story do in fact exist out-of-band, cite the decision record and the story path so the claim is verifiable. → **Remedied in round 2.**

### Non-blocking
1. **`OPEN.md:386` (timing).** The "~40 s" figures are properly hedged and scoped ("on the production deploy where it was timed"); the "roughly 8–40 s" window's **8 s lower bound** is the least-anchored number. It is under the "roughly" hedge and is consistent with the documented 5–30 s Express-bind window, so it is not blocking — but per this repo's standing timing-claim discipline, if anyone later hardens that lower bound it needs its own source. No change required now.
2. **`OPEN.md:386` (headline).** The row's original title still ends "…*nothing tracks fixing it*." For a now-DONE, fixed row this reads stale; the ledger's preserve-and-annotate convention makes it tolerable (Status=DONE + diagnosis paragraph resolve it), but trimming/annotating the trailing clause would remove the last stale phrase. Optional.

### Harness friction
1. None.

## Verdict — Round 1
**CHANGES_REQUESTED** — single blocker: the durable-ledger overclaim at `OPEN.md:386` (backstop "decided/tracked"). The diagnosis, readiness recipe, residual-citation note, preserved incident history, merge integrity, production-live evidence, and harness-lint were all otherwise accurate.

---

# Round 2 (PASS)

The round-1 blocker was addressed in an **amended** doc-lane commit (`82abeb63` → `16294363`). Per the reviewer's later-round rule (roles/reviewer.md step 10), each changed statement was re-derived from commands — not recognised as my own suggested wording and waved through. The coordinator attests that the operator made the log-and-exit decision in-session; I cannot see the chat, so I verify **internal consistency and the absence of any new overclaim**, not the chat itself.

## Re-verification (round 2)

- [x] **Amended diff is still docs-only.** `git show 16294363 --stat` → `OPEN.md`, `OPERATIONS.md`, `docs/SMOKE_TEST.md`, `engineering-team/stories/_intake.md` (4 files; `_intake.md` grew from +14 to +36). No `src/`/`test/`. `git log --oneline -4` → `16294363 / a2d652a2 / a6f1d3ea / ec0c9ec6`; `82abeb63` is amended away.
- [x] **The overclaim is gone.** `OPEN.md:386` now reads: *"A global unhandled-rejection backstop for the server entry is a **recommended follow-up**; the operator chose log-and-exit (2026-09-19), **filed as its own bug-lane item in `engineering-team/stories/_intake.md` (2026-09-19 entry) — not built here**."* `grep -oE 'tracked as its own story|its own story file|stories/[a-z-]*backstop' OPEN.md` → none. No story-file existence claim remains; the decision is attributed to the operator with a date; "not built here" is explicit.
- [x] **The pointer resolves.** The `_intake.md` "2026-09-19 entry" cited by OPEN.md exists — `## 2026-09-19 — Global unhandled-rejection backstop for the server entry (bug / hardening)` at `engineering-team/stories/_intake.md:2465`.
- [x] **No new overclaim in the intake entry.** `_intake.md:2465-2477` records "**Operator decision (2026-09-19): adopt log-and-exit**" (attested; treated as the operator's, not verified against chat) with rationale (log-and-exit not log-and-continue; a backstop, not a substitute for fixing the site). It scopes the work as *what a future story will be* ("**Scope:** a small bug-lane story with its own test"; "Follow-up to the `user-data-error-path` book") — it does **not** assert a story file exists or that anything is built, and it carries **no** PICKED-UP/RESOLVED marker, so `whats-open` correctly treats it as open. The server-entry gap it cites is real (`grep -n unhandledRejection\|uncaughtException bin/control-panel.js` → none).
- [x] **The reconciliation note is accurate.** `_intake.md:2457-2463` ("Update 2026-09-19") states which 2026-09-18 "While there" items this lane closed (SMOKE_TEST:19 §8.5→§9.5; the retry/observed-once readings) vs left residual (the three skills' "retry once" wording + remaining stale §8 citations in `cycle-staging`/`cycle-prod`/`BIBLE`) — consistent with my Round 1 claim-#3 findings.
- [x] **"raised, not decided" vs "operator decided" is coherent, not contradictory.** Story/book/epic (2026-09-18) scope their statement to *inside those artifacts at that time*; the story explicitly says "the decision is **recorded, not made inside this story**." The decision (2026-09-19) is recorded downstream in the ledger/intake — exactly where the story pointed — and those 2026-09-18 artifacts were not retroactively edited. Temporal + scoped; no artifact now claims the decision was made "inside the story" or at kickoff.
- [x] **Ledger integrity unchanged by the amend.** `awk -F'|'` on row 325 → `NF=9` (7 columns), Status=`DONE`, Done date present. `diff` of the pre-`**Diagnosed`** slice vs `a2d652a2:OPEN.md` → identical (symptom record untouched); occurrence markers 1–5 each present once.
- [x] **harness-lint still clean.** `bash scripts/harness-lint.sh` → `clean (0 violations)`, exit 0, with the amended commit and my (untracked) review file present. No L7/L14/L8 issues. Docs-only; no code touched.
- [x] Round 1 non-blocking notes (timing lower bound; stale headline clause) stand as recorded — neither is blocking.

## Verdict — Round 2
**PASS**

The single Round 1 blocker is remedied and independently re-derived: `OPEN.md:386` no longer overclaims (no "tracked as its own story"; the log-and-exit choice is attributed to the operator with a date and pointed at a real `_intake.md` entry marked "not built here"), the new `_intake.md` backstop entry records the decision without asserting a story exists or is built, internal consistency holds across ledger/intake/story/book/epic, and the diagnosis, readiness recipe, residual-citation note, preserved incident history, merge integrity, and production-live evidence remain accurate. harness-lint is clean; the diff is docs-only.

## On verdict
- Docs-lane review: no story `Status:` to flip; retirement is per-epic, not triggered here.
- Review left **uncommitted** per the coordinator's instruction (the operator owns the commit/ship sequence for this branch).
