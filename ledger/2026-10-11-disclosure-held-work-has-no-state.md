# Work held back for disclosure has no named state: held commits fight the environment's stop hook, and held material lives only in the container

**Id:** 2026-10-11-disclosure-held-work-has-no-state
**Type:** meta
**Opened:** 2026-10-11 (book `admin-action-owner-check` close, retro §7 #1)
**Status:** OPEN
**Done:** —

**What was seen.** Book `admin-action-owner-check` (its ground rule 1) could not push its fix commit anywhere until
production and both sandboxes were ready, because the commit names every route it closes. Three things followed.
- **The stop hook.** The cloud environment's stop hook (`~/.claude/stop-hook-git-check.sh`, configured outside the
  repo) asks at every turn end for uncommitted, untracked and unpushed work to be committed and pushed. The coordinator
  declined it by hand through about eight prompts. To keep the held named suite out of the hook's untracked-file check,
  the coordinator excluded it locally (`.git/info/exclude`) under a `.held` name. Nothing in the harness names this
  state, so each refusal was a judgment call against an instruction. A locally excluded file is invisible to
  `git status`, so a held item can be forgotten as easily as it is hidden.
- **The container.** The held material (the named inventory, the held suite and the Reviewer's private notes) existed
  only in the container, which restarted three times during the book. One restart lost a subagent's final report; its
  files survived. At this close, two open rows still point at private notes for their details
  (`2026-10-10-cross-site-request-settings-review`, `2026-10-10-public-read-follow-up`), and those notes are still
  files in a session scratchpad in the container.
- **The window.** Even pushed in one round, the fix was public for about eight minutes before production had it: from
  the `staging` push to the end of the production deploy (audit `admin-action-owner-check` §4 #7). A flow gated on a PR
  check needs the PR's head pushed first, so it cannot reach zero this way.

Nearby rows: `2026-10-10-review-files-committed-unscreened` (screening before commit) and
`2026-10-07-staging-sessions-push-red-tests` (the same hook, another cost).

**Fix shape (for the owner to choose).**
- **A named "held for disclosure" state.** The book lists each held item under its ground rules: the path, why it is
  held, and the release condition. A session that ends a turn with held work answers the hook by pointing at that list.
  Held commits sit on a local branch (`hold/<book-slug>`), never on the shared branch, so a push of the shared branch
  can't carry them.
- **A durable private copy** of held material outside the public repo, in a place the owner chooses, refreshed at each
  phase boundary, so a lost container loses nothing. Rows whose details are private say where the details are kept,
  not only that they exist.
- **For a fix that must have no public window,** GitHub's security-advisory private fork lets the fix be written,
  checked and merged before any public push. OPEN.md row 276 already plans an advisory.

Ports to both flows: a Director holds disclosure-sensitive work the same way.

**Recurred 2026-10-12, from a different cause (`assistant-coming-soon` #1, Gate B; book-close retro §7 #8).** The
Reviewer's PASS file could not be committed before the owner's Gate B verdict: `harness-lint` L1 requires a PASS-final
review's story to read Done. Meanwhile the stop hook asked for the untracked file to be committed. The session held the
draft outside the repo (a copy in its scratchpad) and committed it with the verdict. The gap is the same: the harness
has no named state for work that must wait, so each refusal of the hook is a judgment call.

**Pointer:** `engineering-team/audits/admin-action-owner-check/audit.md` §7 #1 and §4 #7; book `admin-action-owner-check`
ground rule 1.
