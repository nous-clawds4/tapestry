# CLAUDE.md says local source edits are live via a bind mount; the running container has no bind mount and serves a baked image

**Id:** 2026-09-20-claude-md-overstates-bind-mount
**Type:** meta
**Opened:** 2026-09-20 (review of story `shared-concepts-row-detail` #1, harness friction 1)
**Status:** OPEN
**Done:** —

CLAUDE.md § "House rules" ends with: *"locally the repo is bind-mounted to
`/usr/local/lib/node_modules/brainstorm` (source edits are live) with `node_modules` as a separate
volume."* On this machine the first half is false, and it fails silently.

Measured 2026-09-20 while verifying a UI change:

```
$ docker inspect tapestry --format '{{range .Mounts}}{{.Type}} | {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
volume | …/tapestry_tapestry-logs/_data   -> /var/log/brainstorm
volume | …/tapestry_tapestry-neo4j/_data  -> /var/lib/neo4j/data
volume | …/tapestry_tapestry-strfry/_data -> /var/lib/strfry
volume | …/tapestry_tapestry-data/_data   -> /var/lib/brainstorm
```

Four volumes, none of them the repo. The container's
`/usr/local/lib/node_modules/brainstorm/dist/index.html` was dated **Sep 17** and referenced
`assets/index-DKVp6eWS.js`, while the host `dist/index.html`, rebuilt minutes earlier, referenced
`assets/index-Ci4a4Afn.js`. `curl -s http://localhost:7778/ | grep -o 'assets/index-[^"]*\.js'`
returned the Sep 17 bundle.

**Why it is worth a row:** the failure is invisible. The build succeeds, the page loads, nothing
errors — the browser simply shows pre-change code, so every browser-level check quietly describes
the old build. In this story it made a Playwright suite report ten failures against an
implementation that was already correct, and the natural next move is to go looking for the bug in
the diff. A session that trusts the sentence never thinks to check what is being served.

The correct mechanism is already documented accurately one level down, in
`.claude/skills/cycle-local/SKILL.md` § "1. UI changes": build, then
`docker cp $WT/dist/. tapestry:/usr/local/lib/node_modules/brainstorm/dist/`. That is what made the
change appear.

**Fix shape:** correct the CLAUDE.md sentence — source edits are *not* live; a deploy step is
required — and point at the cycle-local skill for the mechanism rather than restating it (the L5
waiver already makes that skill the owner of the local deploy constants). Worth checking first
whether a dev-overlay compose file *does* bind-mount the repo and simply is not what is running
here, in which case the sentence needs a precondition rather than a correction — `OPEN.md` row 252
records a closely related trap, where documented `-f` flags make compose skip
`docker-compose.override.yml` entirely.

**Pointer:** `CLAUDE.md` § "House rules", final bullet; `.claude/skills/cycle-local/SKILL.md` § 1;
related: `OPEN.md` row 252 (dev-overlay `-f` flags skip the override file).
