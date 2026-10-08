# A built UI records no commit, so a browser-spec pass can't be tied to the reviewed code

**Id:** 2026-10-07-built-ui-records-no-commit
**Type:** meta
**Opened:** 2026-10-07 (treasure-map-edit #2 review, harness friction 3)
**Status:** OPEN
**Done:** —

The stack-free browser recipe (`docs/TREASURE_MAP_EDIT_HANDOFF.md` § 6) builds `ui/` into the repo-root `dist/` and runs
the specs against it on :7799. Nothing in `dist/` says which commit, or which working tree, it was built from. A review
that quotes "57 passed" can tie that pass to the reviewed code only by grepping the minified bundle for something the
change added or removed. In the treasure-map-edit book the bundle was built from the working tree minutes before the
implementation commit, twice: story 1 (built 15:01:51, committed 15:02:50) and story 2 (built 22:00:02, committed
22:04:13). Both times the tree matched the commit, but only the grep showed it.

Rows 124, 226 and 253 cover the bind mount and `docker cp`, not this.

**Fix shape.** Write the commit (`git rev-parse HEAD`) and a dirty flag into the build, for example a Vite `define`
read into a `<meta name="build-commit">` in `dist/index.html`. Then make the browser recipe print it before the specs
run, as `gate:status` does for Node runs (`… on <sha>+dirty`). Reviews then quote it beside the pass count.

**Pointer:** `engineering-team/reviews/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.md` § Harness friction 3.
