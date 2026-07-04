# ADR 0006: enforcement — a shared meta-state lib, an allow-plus-default-ask permission shape, and a digest hook

**Status:** Proposed
**Date:** 2026-07-02
**Story:** `engineering-team/stories/harness-self-improvement/6-enforcement.md`

## Context

Three mechanism questions under the ratified gate decisions (digest hook; gate-judge keeps Bash; ask-not-deny for out-of-tree writes).

1. **The digest needs the meta-escalation state, which lives inside `whats-open.sh`'s `collect_meta()`.** Re-implementing it in `session-start.sh` is the drift class this book kills; running all of `whats-open.sh` and grepping is worse — the roll-up does `git fetch` and `gh pr list` (network), unacceptable in a ≤seconds session-start hook.
2. **Per-agent write scoping must not depend on contested rule-precedence semantics.** The platform documents deny > ask > allow; whether a *bare* `ask: Write` outranks a *specific* `allow: Write(product-team/**)` is exactly the kind of subtlety that breaks silently across CLI versions.
3. **Hook schema:** `SessionStart` command hooks exist and inject stdout as session context; they cannot block (non-blocking event) — which matches the advisory principle: the digest informs, never bricks.

## Options considered

### Option A — extract `scripts/lib/collect-meta.sh` (sourced by whats-open + session-start); per-agent `permissions.allow` only, relying on the default ask for everything else; hook = one command entry running the digest script
`collect_meta()` moves verbatim into `scripts/lib/collect-meta.sh`; `whats-open.sh` sources it (behavior identical — reviewer re-verifies both story-4 paths); `session-start.sh` sources it for the banner/count line, runs `harness-lint.sh`, probes the stack (AGENTS.md §1 discovery: `/etc/brainstorm.conf` else the code default 7778; `curl -sf -m 2` against the summaries endpoint), prints the digest, exits 0. Product agents get **allow-list-only** permissions — `Write(./product-team/**)`, `Edit(./product-team/**)`, `Write(./OPEN.md)`, `Edit(./OPEN.md)` — and *no* ask/deny rules: in-tree writes auto-approve; out-of-tree writes fall through to the platform's **default** ask behavior. The ratified "ask" outcome is achieved without betting on ask-vs-allow precedence.
**Pros:** one meta parser (three consumers now); no network in the hook; precedence-proof permission shape; hook cannot block by construction. **Cons:** `scripts/lib/collect-meta.sh` is a second lib file (def path, same as the first); the default-ask fallback depends on the session's permission *mode* (an operator running `acceptEdits`/auto mode weakens it — documented in the rewording as "requires approval under default permission modes").

### Option B — hook runs `whats-open.sh` wholesale
Rejected per gate decision 1 (context economics) — and it performs network calls at session start.

### Option C — global PreToolUse hook script that denies out-of-tree writes "when the actor is a product agent"
Rejected: hook payloads don't reliably identify the acting subagent, so the check would either over-block the main session or under-block the agents — enforcement theater, the exact thing R-E2 exists to end.

## Decision

**Option A.** Single-source the meta parser, keep the hook network-free and non-blocking, and shape permissions so correctness doesn't hinge on undocumented precedence.

## Consequences

- `scripts/lib/` now holds two shared sources (verdict awk, meta-state sh) — both def paths (already registered as `scripts/lib`).
- The digest is the third consumer of the meta state; thresholds still live in exactly one place.
- Permission enforcement is honest-by-mode: hard inside the tree, default-ask outside, weaker under operator-chosen permissive modes — the rewording says precisely this.
- The hook's live firing is unverifiable from this session (predates the hook) — deferred to the next fresh session per the story's AC-7, recorded in the review.
- **Firmware reinstall required?** No.

## Implementation notes

- **`scripts/lib/collect-meta.sh`** — header naming its three consumers + the thresholds-live-here rule; the `collect_meta()` function moved verbatim from whats-open.sh (sets `META_LINES`/`META_COUNT`/`META_MAX_AGE`; caller decides banner/section rendering).
- **`scripts/whats-open.sh`** — replaces the inline function with `. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/collect-meta.sh"`; banner/section rendering unchanged.
- **`scripts/session-start.sh`** — `set -uo pipefail`; cd to repo root; header line; `bash scripts/harness-lint.sh` output indented (violations fully visible; clean = 1 line + waiver lines); meta line from the sourced lib (banner text when firing, else "meta inbox: N open, oldest Nd"); stack probe: port per AGENTS.md §1 (`grep CONTROL_PANEL_PORT /etc/brainstorm.conf` else 7778), `curl -sf -m 2 http://localhost:$PORT/api/concept-graph/summaries -o /dev/null` → "stack present at :$PORT" / "stack absent → use the AGENTS.md fallback ladder (§1–§2)"; open-books one-liner; closing pointer "full roll-up: /whats-open · stats: scripts/harness-stats.sh"; `exit 0` unconditionally.
- **`.claude/settings.json`** — minimal valid config: `{ "hooks": { "SessionStart": [ { "hooks": [ { "type": "command", "command": "bash scripts/session-start.sh" } ] } ] } }` (matcher omitted; schema kept to the documented core to survive CLI evolution).
- **Six product agents** — frontmatter gains:
  `permissions:\n  allow:\n    - Write(./product-team/**)\n    - Edit(./product-team/**)\n    - Write(./OPEN.md)\n    - Edit(./OPEN.md)`
  (no ask/deny rules — Option A rationale). Body text untouched.
- **`product-advisor.md` / `product-expert.md`** — `tools:` lines drop Bash; one body line each aligned ("no Bash, no Write — advisory by construction").
- **Honesty rewording** — `engineering-team/README.md` § Role isolation: "the Architect cannot Edit source (Edit withheld; its Write is for ADR files and its Bash is trust-based)… the Reviewer's sanctioned write is the review file + the story Status flip"; `product-team/README.md` §§: "writing roles' Write/Edit are permission-scoped to `product-team/` + OPEN.md (out-of-tree writes require approval under default permission modes); the Advisor and Expert have no Bash and no Write"; CLAUDE.md wiring bullets: same clause, edited in place, line count unchanged (191).
- **`scripts/harness-def-paths.txt`** — add `.claude/settings.json` and `scripts/session-start.sh`.
- **`test/session-start.test.js`** — tiny suite (registered per convention): settings.json parses as JSON and its SessionStart command names `scripts/session-start.sh`; the script exists + is executable; spawn in repo → exit 0, output matches `/harness-lint:/`, a meta line, and `/stack (present|absent)/`; spawn in an empty temp dir → still exit 0. Existing suites green.
- **`engineering-team/CHANGELOG.md`** — one row.
- Verification: suites green; lint clean (L10 rides); reviewer re-runs the story-4 quiet/firing paths post-extraction; hook firing = deferred post-merge check (AC-7).

## Out of scope

- Bash path-scoping (platform can't); engineering-agent re-tooling; CI; sandboxing.
- Any change to gate-judge.md (keeps Bash per gate decision 2 — noted in the rewording only).
