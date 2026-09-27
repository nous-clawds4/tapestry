# The `pr-assets/dictionary-concepts-v1` branch exists only to host PR #763's SPEC.md and screenshots; delete it once #763 is reviewed

**Id:** 2026-09-27-delete-pr-assets-dictionary-branch
**Type:** cleanup
**Opened:** 2026-09-27 (Dictionary › Concepts v1, PR #763)
**Status:** OPEN
**Done:** —

`pr-assets/dictionary-concepts-v1` is an orphan branch: root commit `59ddd4ee`, with no history shared with the code.

- **What it holds:** a README, the design handoff `SPEC.md` (verbatim from the Claude Design export) and eight
  screenshots.
- **What depends on it:** #763's description embeds the screenshots from this branch
  (`raw.githubusercontent.com/nous-clawds4/tapestry/refs/heads/pr-assets/dictionary-concepts-v1/…`) and links `SPEC.md`
  there.
- **Why it is separate:** it keeps the binaries and the `_import/` material out of the code history. The repo is public
  and keeps almost no images.

**When #763 is reviewed**, delete it with `git push origin --delete pr-assets/dictionary-concepts-v1`. The images and the
spec link in #763's description stop working then. Before deleting, decide whether `SPEC.md` should live in the repo:
version 2 of the Dictionary (SPEC § 3–4: add/veto pinnings, GUM₂/GUM₃, subject groups) builds on it. A
`docs/*HANDOFF*.md` with a Status line would put it on `/whats-open`'s radar.

**Pointer:** PR #763 (§ Screenshots, and the SPEC.md link in its first line); the branch's README.
