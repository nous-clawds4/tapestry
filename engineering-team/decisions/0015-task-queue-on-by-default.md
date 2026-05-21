# ADR 0015: Flip TASK_QUEUE_ENABLED default to `true` in the brainstorm.conf template

**Status:** Accepted
**Date:** 2026-05-21
**Story:** `engineering-team/stories/17-task-queue-on-by-default.md`

## Context

Story #17 closes the operator-pain loop opened by story #16: every deploy regenerates `/etc/brainstorm.conf` from `config/brainstorm.conf.template`, and the template's `TASK_QUEUE_ENABLED=false` default resets the queue flag on every fresh container start. We just lived through the manual flip recipe twice today (staging + prod) immediately after story #16's deploy.

The decision space is minimal. The implementation is mechanically one line in the template plus three tightly-scoped test/doc updates. We are writing this ADR anyway because:

1. **Project policy: ADRs enabled** (per [CLAUDE.md](../../CLAUDE.md)).
2. **Future readers will ask "why is the default true?"** This ADR is the answer they will land on. Without it, the rationale (queue path matured in prod over days; story #16 made rollback git-trackable; manual-flip dance was a chronic post-deploy chore) lives only in the story Background.
3. **The story explicitly invited the Architect to consider skipping.** Documenting that we chose not to skip (and why) is itself a useful signal for the next adjacent decision.

### Grounded facts

- **Single source-of-truth line.** `config/brainstorm.conf.template:100` reads `export TASK_QUEUE_ENABLED=false`. There is exactly one such line; no other repo file declares the default.
- **Two test touchpoints** in `test/entrypoint-template-rendering.test.js`:
  - **T4 fixture expected pairs** at line 291: `TASK_QUEUE_ENABLED: 'false'` — the byte-equivalence rendering test expects this value to come out of the renderer.
  - **R2 regression sentinel** at lines 429-434: asserts the template carries `TASK_QUEUE_ENABLED\s*=\s*false`.
  Both flip together with the template. R2's purpose (catch deletion of the line) is preserved by asserting `=true` instead.
- **OPERATIONS.md §10.1** (lines 421-422) documents the flag values with the current wording "(default)". The default annotation moves from `=false` to `=true`; the rollback-path wording inverts symmetrically.
- **No concept-graph impact.** This is purely a config-default change. No concepts touched. **No firmware reinstall.**
- **Story #13's rollback path remains intact.** Per [`src/api/manage/commands/runTask.js`](../../src/api/manage/commands/runTask.js) and [`bin/control-panel.js`](../../bin/control-panel.js), the `TASK_QUEUE_ENABLED=false` branch still works — operators flipping back to legacy direct-spawn use the same recipe they used today, just inverted.

### Operator state after this lands

- **Fresh containers + post-deploy restarts:** queue + BullBoard come up automatically.
- **Already-running staging + prod containers** (manually flipped to `=true` earlier today): no change — they already have `=true` in `/etc/brainstorm.conf`; the next container restart will pick up `=true` from the template anyway.
- **An operator who wants to disable the queue:** runs the inverse recipe (`sed` `=true` → `=false` + `supervisorctl restart brainstorm`). Persistent rollback is now a repo edit (`=true` → `=false` in template, commit, deploy) — story #16 made this a clean git operation.

## Options considered

### Option A — Flip the template default (chosen)

One-line change: `=false` → `=true` in `config/brainstorm.conf.template:100`. Plus the R2 sentinel update and the OPERATIONS.md wording flip.

**Pros**
- Mechanically trivial. Single value change, two test touchpoints, one doc paragraph.
- No new code paths, no new modules, no new dependencies.
- Story #16's source-of-truth contract guarantees the template change propagates to every fresh `/etc/brainstorm.conf` on the next deploy.
- Rollback is symmetric: the same template-edit-and-deploy pattern flips it back to `=false` if a future operational issue surfaces.
- The boot-time loud-failure mode (story #13's `QUEUE_UNAVAILABLE` + `RenderError` from story #16) still catches Redis-down or env-var-missing scenarios — no new silent failure surface.

**Cons**
- The next post-deploy container restart on staging + prod will re-render the conf, which is unconditional overwrite. Operators won't notice because the rendered value matches what they manually flipped to — but it's worth knowing the unconditional regeneration still fires.
- A future "we want the queue OFF by default again" decision would require another repo change + deploy. This is a cost we're willing to pay because the default-on case is the empirically-mature one.

### Option B — Add env-var override mechanism, keep template default at false

E.g., extend `docker/entrypoint.sh` to honor `${TASK_QUEUE_ENABLED:-false}` from the docker-compose environment, with the template default as fallback. Operator sets `TASK_QUEUE_ENABLED=true` via the per-environment docker-compose env_file.

**Pros**
- Per-environment override without changing the template. Different defaults for sandbox vs prod become possible.
- Decouples "what the repo template says" from "what each environment actually runs."

**Cons**
- **Out of scope per story #17 §Out of scope** and story #16 §Out of scope. Both stories explicitly defer env-var-overlay-based override to a separate story.
- Adds a fourth knob (template default, env var, manual edit, docker env_file) that operators have to triangulate when something is wrong. The current two-knob shape (template default + manual override) is simpler.
- Doesn't actually solve the immediate pain — we'd still need to write the docker-compose env_file with `TASK_QUEUE_ENABLED=true` for staging + prod, which is functionally equivalent to flipping the template default but with more moving parts.

Rejected. The narrower option (A) is sufficient.

### (Option C considered but not detailed: detect Redis at boot and flip dynamically)

Explicitly out of scope per story #17. Story #13's `QUEUE_UNAVAILABLE` 503 already covers Redis-down detection at runtime; adding boot-time Redis probing would duplicate that signal with extra complexity.

## Decision

**We chose Option A — flip the template default.**

Reasons:
- The queue path has been running on both staging and prod with `=true` for days (since story #15's rollout) with no reported issues.
- Story #16 made the template a clean repo-tracked source of truth — flipping a value here is a real git operation, fully reversible.
- The cost is one line in code + two tightly-scoped test/doc updates. The benefit is removing a chronic post-deploy operator chore that we just performed twice within hours.
- The rollback path (Option A in reverse) is no worse than today's — and is now *better* than today's because it's repo-edit rather than fragile in-container edit.

What we are trading away: a tiny amount of "explicit operator opt-in" safety margin. Acceptable given the path's maturity in production.

## Consequences

**Enabled**
- Fresh containers, image rebuilds, and post-deploy container restarts automatically come up with the task queue + BullBoard + cross-task neo4j-heavy serialization (stories #13 + #15 + #16) running.
- The operator no longer needs to remember the manual flip recipe after every deploy.
- Story #17 is itself a self-validating round-trip — the next deploy after merging this story should NOT trigger the manual flip dance.

**Constrained / made harder**
- Operators wanting `=false` need to either edit `/etc/brainstorm.conf` in the running container (lost on next restart) or edit the template + commit + deploy (persistent). The latter is the correct path; the former is the documented trap (OPERATIONS.md §11).
- The R2 regression sentinel now asserts `=true`; if a future change accidentally deletes the line, R2 trips. If a future change *intentionally* re-flips to `=false`, R2 needs to flip back as part of that change. This is the same kind of guard as story #13's R2; the bidirectional behavior is fine.

**Follow-up debt (out of scope here)**
- **Env-var overlay** for per-environment overrides (Option B above). A genuine future operator need if sandbox/dev environments want different defaults. Separate story.
- **Long-running container reconciliation.** Already-deployed staging + prod containers have `=true` from manual flips; no action needed because the template value matches. If we ever flip the template back to `=false`, those manually-flipped containers won't be affected until restart — same trap §11 already documents.
- **Per-request config-re-read spam** in `brainstorm.log` (the `Found BRAINSTORM_OWNER_PUBKEY` chatter — pre-existing, surfaced during story #17 planning). Step 3 of the operator's plan-of-plans; separate story.

**Firmware reinstall required?** **No.** No concept changes.

## Implementation notes

The Implementer reads this section verbatim. Total diff: **5 files, ~5-10 lines net.**

### 1. `config/brainstorm.conf.template:100`

Change:
```
export TASK_QUEUE_ENABLED=false
```
to:
```
export TASK_QUEUE_ENABLED=true
```

The surrounding comment block (lines 94-99) describes the flag's purpose; that text is mostly correct but the parenthetical "default in phase 1" is now stale. Update to reflect the new posture — something like:

```
# Task queue (story #13 / ADR 0012, default flipped to true in story #17 /
# ADR 0015). When true, /api/run-task enqueues jobs through BullMQ and
# BullBoard mounts at /admin/queues (owner-only). When false, the legacy
# direct-spawn path runs — that's the rollback path. Requires Redis (already
# a runtime dependency for sessions and the strfry-stream-consumer).
export TASK_QUEUE_ENABLED=true
```

### 2. `test/entrypoint-template-rendering.test.js`

Two surgical edits.

**Line 291** (T4 fixture expected map):
```js
TASK_QUEUE_ENABLED: 'false'
```
becomes:
```js
TASK_QUEUE_ENABLED: 'true'
```

**Lines 429-434** (R2 regression sentinel) — flip both the test name and the regex + error message:
```js
test('R2: config/brainstorm.conf.template still carries TASK_QUEUE_ENABLED=true (story #17 contract preserved; AC "fresh containers contain export TASK_QUEUE_ENABLED=true")', () => {
  const src = readSafe(CONF_TEMPLATE);
  assert(src !== null, 'brainstorm.conf.template missing — cannot check story #17 contract.');
  assert(
    /TASK_QUEUE_ENABLED\s*=\s*true/.test(src),
    'R2: config/brainstorm.conf.template no longer carries TASK_QUEUE_ENABLED=true (story #17 / ADR ' +
      '0015 regression). The flag must remain in the template at the new deploy-safe default `true`; ' +
      'reverting to `false` re-opens the manual-flip-after-every-deploy operator chore that story #17 ' +
      'closed. If you intentionally want to roll back to `=false`, also flip this sentinel back to its ' +
      'pre-story-#17 form (assert =false) so it tracks the new intended default.'
  );
});
```

The error message intentionally walks the next reader through the bidirectional rollback story.

### 3. `OPERATIONS.md` §10.1

**Lines 421-422:**

```markdown
- `TASK_QUEUE_ENABLED=false` (default) — legacy direct-spawn. Zero queue dependency. **This is the rollback path** — flip the flag, `supervisorctl restart brainstorm`, and the queue is out of the picture.
- `TASK_QUEUE_ENABLED=true` — `/api/run-task` enqueues per-task BullMQ jobs; in-process Workers consume them; `launchChildTask.sh` still spawns the work (its pgrep guard remains as belt-and-suspenders).
```

becomes (default annotation moves; rollback wording stays attached to `=false`):

```markdown
- `TASK_QUEUE_ENABLED=true` (default since story #17 / ADR 0015) — `/api/run-task` enqueues per-task BullMQ jobs; in-process Workers consume them; `launchChildTask.sh` still spawns the work (its pgrep guard remains as belt-and-suspenders). BullBoard UI mounts at `/admin/queues` (owner-only).
- `TASK_QUEUE_ENABLED=false` — legacy direct-spawn. Zero queue dependency. **This is the rollback path** — flip the flag in the template (or, for an in-container hotfix, in `/etc/brainstorm.conf`), `supervisorctl restart brainstorm`, and the queue is out of the picture.
```

Other OPERATIONS.md mentions (§10.4 line 460, §10.6 line 470, §11 lines 546+562) reference `TASK_QUEUE_ENABLED` as state descriptions and historical narratives — leave those as-is, they remain accurate.

### 4. Nothing else

No new files. No source changes outside the template + test + doc. No Dockerfile change. No new dependency.

### Tests

The Tester writes a brief test-plan amendment to story #16's `test/entrypoint-template-rendering.test.js`. Specifically:

- **T4 fixture expected map update** — folded into the R2 sentinel flip (lines 291 + 429-434 change together).
- **No new sentinels.** The existing R2 + T4 cover the new default; the existing T2 (heredoc variable list) still passes because `TASK_QUEUE_ENABLED` is still in the template, just with a different value.
- **Story-specific smoke (Reviewer):** verify that on a fresh container start, `/etc/brainstorm.conf` contains `TASK_QUEUE_ENABLED=true` and the boot log shows the four-line task-queue stack — story #17's AC #2 and AC #5.

### Smoke

Cycle-local (Reviewer) — minimal scope because the change is minimal:
- Render the template inside the container with the same env state used for story #16's smoke. Confirm the rendered output contains `export TASK_QUEUE_ENABLED=true` instead of `=false`. No need to re-run the full byte-equivalence diff — the only value that changes is this one line.
- Optionally: verify the `npm test` suite still goes 14/14 inside the container after the bind-mount picks up the changes.

### Concept handle

None. No new concepts.

## Out of scope

- **Removing the `TASK_QUEUE_ENABLED` flag entirely.** The flag stays as a rollback handle.
- **Env-var-overlay-based override mechanism** (Option B). Separate story when operator need for per-environment overrides surfaces.
- **Backfilling already-deployed staging + prod containers.** Both already have `=true` from manual flips; the template change matches their current state. No reconciliation needed.
- **Per-request config-re-read log spam fix.** Step 3 of the operator's three-step plan; separate story.
- **Updating prior ADRs to reflect the new default.** ADRs are historical records of the decision at their time; they should not be retroactively edited. This ADR supersedes the "default false" posture in ADR 0012 §Implementation.
