# Parallel gate-judges share one scratchpad, and can't tell which build a preview server serves

**Id:** 2026-10-09-judge-workspace-and-served-build
**Type:** meta
**Opened:** 2026-10-08 (treasure-map-card-details book close, retro finding 2)
**Status:** OPEN
**Done:** —

Two frictions from handing judges a live environment, both seen in the treasure-map-card-details book:

1. **Shared scratchpad.** Two J3 judges ran at once with the same session scratchpad. One wrote its gate log to
   `scratchpad/j3-gate.log`, and the other then overwrote it. The first noticed, re-ran into a private directory and
   disclosed it. A less careful judge could have read another story's gate result as its own.
2. **Unidentified build.** The session kept a `vite preview` of the branch on :7799 for the browser specs. Two judges
   and the Reviewer couldn't tell which build it served, so each rebuilt the UI into the scratchpad (about 25 s plus a
   server each). One of them compared asset hashes to confirm the server was current.

**Fix shape:** spawn prompts give each judge or reviewer its own output directory
(`<scratchpad>/<gate>-<story>-<nonce>/`), and name the served build by commit and asset hash
(`index-<hash>.js`, built at `<sha>`). A served build is then evidence to check, not something to trust or redo.
Belongs in `roles/director.md` § "The blinded gate-judge protocol", which the Light profile shares, so it ports to
both flows.

**Recurred 2026-10-11 (`assistant-shared-categories` #1).**
- The J3 judge found :7799 held by the Implementer's preview, ran its browser pass against it, and showed the served
  build byte-identical to its own.
- It also wrote logs into the session's shared scratchpad, where they may have replaced files of the same name.
- The Gate B Reviewer used this row's fix shape (its own directory and port, the served build named by asset hash),
  and that worked: it tied the browser pass to the bundle hash staging serves.
- The story's "How to run" still hard-codes :7799.

**Pointer:** `engineering-team/audits/treasure-map-card-details/audit.md` §7 finding 2.
