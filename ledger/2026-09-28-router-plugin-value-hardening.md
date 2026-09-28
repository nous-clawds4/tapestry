# Router config writes stream plugin/URL values unescaped and unvalidated, and admins (not just the owner) can set the plugin that the router executes

**Id:** 2026-09-28-router-plugin-value-hardening
**Type:** bug
**Opened:** 2026-09-28 (PR #771 review, this session — the residual I flagged in review question 4)
**Status:** OPEN
**Done:** —

**What was seen.** `handleUpdateRouterConfig` (`src/api/strfry/routerConfig.js:203`) validates a
stream's `name` (`^\w+$`), `dir` (enum) and that `urls` is an array, and reconstructs `filter`
against a closed vocabulary (`sanitizeStreamFilter`, ADR relay-management/0002) — but it stores
`pluginDown`, `pluginUp` and each `urls` element with **no validation**. `generateConfig`
(`:157-168`) then writes all three into the router config **inside double quotes with no escaping**:

    pluginDown = "${stream.pluginDown}"
    ...
        "${url}",

`pluginDown`/`pluginUp` name a program the `strfry-router` process **executes** on every event, so a
caller who controls them can point the router at an arbitrary executable, and an unescaped `"` or
newline in any of the three can break out of the quotes and inject arbitrary router-config
directives — the exact crash-loop-on-next-restart failure mode the filter-sanitization block was
written to prevent, but for these fields it is un-guarded.

**Residual after PR #771 (`2026-09-28-router-endpoints-owner-gate`).** #771 shrank the reachable
audience from "any signed-in guest" to owner/admin/local — a strict improvement — but did not touch
validation or escaping. Two things remain:

1. **Escaping/robustness (fixed regardless of who can call it).** An owner pasting a URL with a quote
   can still crash-loop the router. `generateConfig` should `JSON.stringify` the URL and plugin
   strings (it already does for `filter`).
2. **`isOwner()` admits admins.** `requireOwnerOrLocal` → `isOwner` → `isOwnerOrAdmin`
   (`src/middleware/auth.js:291`), and the Settings → Relays plugin picker renders for owner **or**
   admin (`ui/src/pages/settings/Index.jsx`; `ui/src/pages/settings/RelaySettings.jsx:183,193`), and
   the API accepts any string regardless of the dropdown. So an admin can name an arbitrary program
   for a system service to run. Calibration: admins here are already near-owner (they can reach
   `/api/run-script` and `/service-management/control` via the same `isOwner`), so this is one more
   RCE-adjacent surface at that tier rather than a brand-new door — which is why the escaping/
   validation fix is the higher-value change and owner-only-for-plugins is a reasonable secondary
   hardening, not a must.

**Fix shape.**
- **Plugins:** allowlist against the files `handleListPlugins` actually lists in `PLUGINS_DIR`
  (`realpath`, require a direct existing child; empty string = none). Stronger than a
  `startsWith(PLUGINS_DIR)` prefix check, which a `…/plugins/../../tmp/evil.js` traversal defeats and
  which admits non-existent paths (note `PLUGINS_DIR/data` is a writable subdir, `Dockerfile:76`).
- **URLs:** reconstruct-or-reject like `sanitizeStreamFilter` — require `ws://`/`wss://`, reject any
  quote, backslash, newline or control char.
- **Escaping:** `JSON.stringify` the URL and plugin strings in `generateConfig` as belt-and-suspenders.
- **Optional:** gate plugin-setting specifically behind owner-only (`requireOwnerOnly` semantics)
  rather than owner-or-admin.
- Add a stack-free suite mirroring `strfry-router-owner-gate`: a traversal/quote/newline plugin path
  and a non-`ws(s)` URL are rejected or neutralised, and a listed plugin + `wss://` URL pass.

**Pointer:** `src/api/strfry/routerConfig.js:157-168` (`generateConfig`), `:203-250`
(`handleUpdateRouterConfig`), `:302-320` (`handleListPlugins`, the plugin allowlist source);
`src/middleware/auth.js:291` (`isOwner` admits admins); `ui/src/pages/settings/RelaySettings.jsx`;
OPEN.md row `2026-09-28-router-endpoints-owner-gate` (the gate this follows).
