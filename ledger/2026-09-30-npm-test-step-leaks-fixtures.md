# The phases' "run `npm test`" step leaks tag fixtures to a public relay on the Mac Studio, and no phase doc says so

**Id:** 2026-09-30-npm-test-step-leaks-fixtures
**Type:** meta
**Opened:** 2026-09-30 (my-assistants #1, review 1's Harness friction 1)
**Status:** OPEN
**Done:** —

These all tell a session to run `npm test`:

- `engineering-team/workflows/4-implementation.md`, step 1 and step 7;
- `engineering-team/roles/implementer.md`;
- `engineering-team/workflows/5-review.md`, step 1;
- `engineering-team/roles/reviewer.md`, step 1;
- the review template's first checkbox.

On the Mac Studio, that run sends the live tag suites' fixtures through the enabled strfry-router tag streams to
`wss://dcosl.brainstorm.world`. `BRAINSTORM_PUBLISH_LOCAL_ONLY` doesn't stop it. It happened in my-assistants #1's
Implementation: six kind 39999 events reached the relay. The details are in the 2026-09-30 update to OPEN.md row
`2026-09-27-test-fixture-taggings-on-prod-relays`. That row names the hazard, but nothing in the phase docs points to
it.

**A safe full-gate verdict exists and was used in review 1.** It reproduces CI (`.github/workflows/test.yml`) in
Docker, with no network during the test run:

1. Make a full clone of the branch (history kept for harness-lint L9/L10).
2. Copy it into a Docker named volume with `COPYFILE_DISABLE=1 tar --no-xattrs`. Docker Desktop doesn't share the
   session scratchpad, so a bind mount comes up empty. Without the tar flags, AppleDouble `._pack-*.idx` files break
   git inside the volume.
3. Run `npm ci` in `node:22-bookworm`, with network. `node:22-alpine` can't build `bufferutil` on arm64: node-gyp finds
   no Python.
4. Run `GATE_LABEL=<label> npm test` with `--network none`. The label is set at run time; `gate:status -- --label`
   only looks it up. Then read the verdict with `npm run -s gate:status -- --label <label>`.

The copied tree must be owned by the container's user (`chown -R root:root` inside the volume), or git in the
container refuses it as a dubious-ownership repo. Review 1 round 2 lost a restart to this, and another to the label.
Redirect the gate's output to a file **outside** the copied tree. A log inside it makes the run's record start
`dirty`, which cost my-assistants #2's review a restart.

Result: 245/245 suites, every live suite skipped, nothing published (gate run `20260930T213125Z-20-ca8a`, PASS).

**Fix shape**, any one of:

- put that recipe behind a script (for example `scripts/gate-isolated.sh <ref>`), and point the "run `npm test`" steps
  at it for machines with enabled `up` or `both` router streams;
- have the gate engine refuse the live publishing suites when `GET /api/strfry/router-status` shows an enabled tag
  stream;
- disable the Mac Studio's tag streams. That's the owner's call: the flags have been set since 2026-07-18
  (`/var/lib/brainstorm/router-state.json`), and nothing found records why.

**Pointer:** `engineering-team/reviews/my-assistants/1-the-my-assistants-page.md` § Harness friction 1; OPEN.md row
`2026-09-27-test-fixture-taggings-on-prod-relays` (its 2026-09-29 and 2026-09-30 updates).
