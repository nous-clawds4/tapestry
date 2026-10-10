# Every docs-only push to `staging` rebuilds the image and recreates the container, so it restarts strfry's router and every task like a code deploy

**Id:** 2026-10-10-docs-only-push-redeploys-staging
**Type:** bug
**Opened:** 2026-10-10 (book `relay-stream-gaps` close; staging verification of stories 1–2)
**Status:** OPEN
**Done:** —

**What was seen.** `.github/workflows/deploy-staging.yml` runs on every push to `staging`, with no `paths` filter, and
runs `docker compose up -d --build`. The Dockerfile's `COPY . /usr/local/lib/node_modules/brainstorm/` (`Dockerfile:94`)
takes in every tracked file except the few in `.dockerignore`. That includes `engineering-team/`, `ledger/`, `OPEN.md`
and `protocols/`. So a push that changes only those still builds a new image, and the container is recreated:
- strfry's router restarts, and every stream has a deploy hole;
- every running scheduled task is killed, which is why each such merge has to pass the safe-to-merge check;
- the supervisor logs, which are not on a volume, start empty.

Of the 12 staging deploys from #544 (2026-10-09 17:05Z) to #555 (2026-10-10 02:17Z), 7 changed nothing outside
`engineering-team/`, `ledger/`, `protocols/`, `docs/` and `*.md` (#545, #546, #549, #550, #553, #554, #555), and one
changed no file at all (#548, a history-only merge). The book's measurements show #545, #546, #553, #554 and #555
recreating the container or restarting the router. Four of them lost events on a stream whose limit had not yet been
raised to 500: one WoT event at each of #545 and #546 (limit 5), and two and one kind-0 events at #553 and #554
(`userProfiles`, no limit then).

Raising the limits (relay-stream-gaps #2) makes these holes refill, so the cost is now mostly the restarts, the killed
tasks and the merge-check friction, not lost content.

**Fix shape, pick one:**
- `paths-ignore` on the deploy workflows for pushes that touch only `engineering-team/**`, `ledger/**`, `OPEN.md` and
  other files the running app never reads. First check that nothing at runtime reads them (a 2026-10-10 grep of
  `src/` and `ui/src` found no reads).
- Or add those paths to `.dockerignore`, so the build hits the cache and `up -d` has nothing to recreate. Then check
  that `/whats-open` or any in-container tool doesn't need them in the image.

Either is a CI or build change and should ride a story. `docs/SAFE_TO_MERGE.md` would then say which merges deploy.

**Pointer:** `.github/workflows/deploy-staging.yml`; `Dockerfile:94`; `.dockerignore`; `gh run list --workflow
deploy-staging.yml`; book `engineering-team/audits/relay-stream-gaps/book.md` § Staging verification; related row
`2026-10-10-router-boots-with-empty-streams`.
