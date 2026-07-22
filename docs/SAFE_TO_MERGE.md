# Safe-to-Merge Check

> **Audience:** AI agents (Claude Code, etc.) running the deploy cycles for this repo, plus human operators promoting any deploy-triggering branch by hand.
>
> **Purpose:** A single canonical definition of the **pre-merge deploy-safety check** — the gate that keeps a deploy-triggering merge from landing while a scheduled task is running or imminent on the instance that merge redeploys. The cycle skills reference this file rather than restating it; when the recipe changes, update this file and every consumer inherits (the `docs/SMOKE_TEST.md` pattern).

**Last updated:** 2026-07-18

---

## What the check is

Every merge into a deploy-triggering branch recreates that instance's container, killing any in-flight scheduled task and silently corrupting its scoring data. Story #1 of the deploy-safety-gate epic gave every instance the answer: `GET <base>/api/deploy-safety/status` (one plain unauthenticated request, ADR deploy-safety-gate/0001) returns `safeToDeploy` (boolean), `verdict`, `reasons[]`, `checkedAt`, the effective `bufferMs`, and per-source detail. The instance owns the verdict policy; consumers act on the verdict as delivered and never re-derive their own safety policy from the raw schedule data.

This check is the consuming side: **as the immediate precursor of any deploy-triggering merge, ask the instance that merge will redeploy, and merge only on a safe verdict just observed.** While the verdict is unsafe, wait and recheck — bounded and journaled — rather than aborting outright or merging anyway.

## The canonical invocation

```bash
scripts/check-safe-to-merge.sh <instance-base-url>
```

The script is THE mechanism — do not hand-roll the loop, and do not improvise the numbers per run. It polls the status endpoint and journals every attempt to stdout (`[<UTC timestamp>] attempt <i>/<N> verdict=<safe|unsafe|no-answer> reasons=<[...]|n/a> raw=<response body>`), exiting the moment a safe verdict is observed.

**The canonical numbers: 45 attempts × 60 seconds (~45 minutes), the script's built-in defaults.** Rationale: the 60 s cadence bounds merge latency after the safe window opens to ≤ 1 minute and matches the transients it rides out (the legacy flag's 30 s clear-poll, the ~30 s BullMQ stall interval); the bound of 45 absorbs the worst *common* case — a fire landing inside the 10-minute buffer window, followed by a default-profile task run (30-minute registry kill-timeout), plus ~5 minutes of slack for the post-deploy stalled-active transient. It deliberately does not outlast the 4 h/6 h override tasks — for those the bound exhausts into a loud stop and the operator decides, which is the designed behavior. The `[max-attempts] [interval-seconds]` override args exist only for the test suite and for an operator's explicit, recorded post-stop decision to wait longer; a cycle run never passes them on its own initiative.

**No-usable-answer fast path:** 3 *consecutive* unusable attempts (connection failure, non-2xx, unparseable body, missing `safeToDeploy`) exit early with code 2 — about 3 minutes on a dead instance, not the full bound. A usable answer (safe or unsafe) resets the counter, so a single blip never kills a run.

**Staleness rule (the verdict must be *just observed*):** the merge must be the immediate next action after exit 0. If more than **5 minutes** elapse between exit 0 and the merge command, re-run the check. A safe verdict guarantees at least the buffer window (10 minutes by default) to the next fire; 5 minutes spends at most half that margin. A safe answer is acted on, never banked across a delay.

## Branch → instance map

| Branch merged into | Instance the merge redeploys | Consumer of this recipe |
|---|---|---|
| `staging` | `https://staging.brainstorm.world` | cycle-staging (step 4) |
| `main` | `https://tapestry.brainstorm.world` | cycle-prod (step 4) |
| `feat/tags` | `https://tags.brainstorm.world` | manual promotion — see "Manual promotions to `feat/tags`" below |

cycle-full carries no check of its own — it inherits by delegating its staging and prod merges to cycle-staging and cycle-prod.

Other deploy-triggering sandbox branches (`feat/communities`, `feature-magic-carpet`, `feat/curate`) may adopt the same row-and-URL pattern later; they are not covered today.

## Verdict handling

| Exit code | Meaning | What to do |
|---|---|---|
| 0 | Safe verdict just observed | Merge **immediately** (re-run if more than 5 min elapse first) |
| 1 | Bound exhausted without a safe verdict | **Stop. Do not merge.** Surface the full journal; the operator decides |
| 2 | No usable answer (3 consecutive unusable attempts) | **Stop. Do not merge.** Surface the full journal; the operator decides |
| 3 | Usage error (missing/malformed arguments) | Fix the invocation; nothing was checked |

An answer that cannot be obtained is **never** treated as safe — an unreachable instance, a 404, or a garbled body is a stop, not a pass. Proceeding after a non-zero exit happens only as an **explicit, recorded operator decision** — the operator says so in the session, and the run's record (PR body, report, or journal entry) states that the merge proceeded on the operator's call with the check's last observed state quoted. It is never the procedure's silent default.

The check's full journal output goes into the run's report either way — the wait is visible, every attempt timestamped, every unsafe reason named.

## Buffer policy

The recipe does **not** pin `?bufferMinutes=` — the instance owns the verdict policy, and a caller-pinned window would silently override any future instance-side policy change. Every response echoes the effective `bufferMs`, and the journal captures every response verbatim, so the window each check actually used is always in the run record.

## Manual promotions to `feat/tags`

`feat/tags` → `tags.brainstorm.world` has no cycle skill; a manual promotion runs the identical mechanism with the tags URL, as the immediate precursor of the merge into `feat/tags`:

```bash
scripts/check-safe-to-merge.sh https://tags.brainstorm.world
```

Same exit-code handling, same staleness rule, same journaling — paste the check's output into wherever the promotion is being recorded (the PR body or the session report).

**Transition note:** an instance whose branch predates story #1 does not serve the endpoint yet — the check gets a 404, which is "no usable answer" (exit 2), never safe. Promote the endpoint to that branch first, or proceed only as an explicit recorded operator decision.

## Limits

- The endpoint must exist on the target instance (see the transition note above); this recipe cannot conjure an answer from an instance that predates story #1.
- The check protects deploy-triggering **merges**. Local rebuilds (cycle-local) also kill local in-flight tasks but are outside this recipe's coverage today.
- Nothing mechanically prevents a merge after a stop — the gate is procedural by design (CI-side enforcement was ruled out of scope at intake). The recorded-operator-decision rule above is the backstop.
