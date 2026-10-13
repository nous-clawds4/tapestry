# Stopping `vite preview` by the pid of `npx vite preview &` can leave the vite server running, orphaned

**Id:** 2026-10-13-vite-preview-pid-orphans
**Type:** meta
**Opened:** 2026-10-13 (book `assistant-self-map`, story 2's Implementation and Review)
**Status:** OPEN
**Done:** —

**What was seen.** The story-1 handoff's lesson for browser specs is "build the UI, run `vite preview`, … stop `vite
preview` by pid, never with `pkill -f`". Following it:
- `(npx vite preview --outDir <dir> --port <p> --strictPort > log 2>&1 & echo $! > pidfile)` records the pid of
  **npx**, not of vite.
- Killing that pid (and its direct children) once left vite's node process running, parented to init and still
  answering on its port.
- It was found only because `curl` still got a 200, and was then stopped by its own pid.
- The "port free" check used before that, `ss -ltn | grep …`, proved nothing: `ss` is not installed in this container,
  so the grep never matched.

**What worked.** Launching the server directly with node makes `$!` the server itself:
`(node ui/node_modules/vite/bin/vite.js preview --outDir <dir> --port <p> --strictPort > log 2>&1 & echo $! > pidfile)`,
then `kill $(cat pidfile)`, then `curl -s --max-time 2 http://localhost:<p>/` to confirm nothing answers.

**Fix shape.** Write that recipe where the lesson lives: the handoff template's environment notes, the `/design-tests`
and `/review-changes` browser-run lines, or a small `scripts/` helper that starts and stops a preview. Check that the
port is free with `curl`, not `ss`.

**Pointer:** `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md` § Harness friction.
