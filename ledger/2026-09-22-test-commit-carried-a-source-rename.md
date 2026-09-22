# A Tester-lane `test:` commit carried a source rename, leaving a commit that does not build

**Id:** 2026-09-22-test-commit-carried-a-source-rename
**Type:** meta
**Opened:** 2026-09-22 (assistant-identification-tags #2, review § Harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** During story 2's implementation the copy module was renamed with `git mv` (which stages the
rename), and the next commit, meant to carry only the suite's re-aimed path constant (`d7611992`, `test:`), took the
staged rename with it. The page's import was fixed in the following commit (`1089f04e`). So at `d7611992` the page
imports `./identificationTags` while the file is `identificationTagsCopy.js`: a non-building commit on Linux, and on
macOS one where the import resolves to the page itself. The plan's record and the Reviewer's brief both placed the
rename in `1089f04e`; the Reviewer found the truth with `git show --stat`.

**Why it happens.** `git mv` stages; a partial commit that adds one path with `git add <file>` still commits
everything already staged. Nothing in the per-phase commit conventions says to check `git status` for staged
changes before a scoped commit, and no lint looks at a `test:` commit's paths.

**Fix shape.** One sentence in the Tester's and Implementer's per-phase commit rules: before a scoped commit, `git
status` and unstage anything outside the phase's lane (`git restore --staged`). Optionally, `scripts/harness-lint.sh`
or a pre-commit check: a commit whose subject starts with `test:` touches only `test/`, `tests/`, `test/helpers/` and
the plan file.

**Pointer:** review `engineering-team/reviews/done/assistant-identification-tags/2-the-page-and-your-two-taggings.md`
§ Harness friction 1; commits `d7611992` and `1089f04e`.
