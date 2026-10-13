# The harness-lint suite's git fixtures inherit the session's commit signing, so a signer hiccup fails them

**Id:** 2026-10-13-lint-fixtures-inherit-commit-signing
**Type:** meta
**Opened:** 2026-10-13 (book `assistant-self-map`, story 2's review round 5)
**Status:** OPEN
**Done:** —

**What was seen.**
- The gate run `20261013T135439Z-5747-c867 [s2-r5-review]`, on a clean `9d6e67fc`, failed `harness-lint` alone with
  2 failures. Both were `Command failed: git … commit -qm …` inside the suite's throwaway repos:
  - "L10 is quiet when the same commit touches both the def path and the CHANGELOG";
  - "L9 in a shallow clone: a header checked against the boundary commit is not called stale".
- The suite passed alone straight after (85/0), and so did the full rerun `20261013T140149Z-6531-5175` (5981/0).

**Why.** The fixtures commit with `git -c user.email=… -c user.name=… commit` (`test/harness-lint.test.js:79`, `:93–94`,
`:410`), so they inherit the session's global git config. In this cloud container that config has `commit.gpgsign=true`
with `gpg.ssh.program=/tmp/code-sign`. Every fixture commit then calls the external signer, and a failure or timeout in
it fails the test. That has nothing to do with the lint rule the test checks.

**Fix shape.** The fixtures commit with `-c commit.gpgsign=false` (or run with `GIT_CONFIG_GLOBAL=/dev/null`), so they
don't depend on the machine's signing setup. That is the harness's own test, so it takes a small harness story.

**Pointer:** `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, Round 5, Harness
friction.
