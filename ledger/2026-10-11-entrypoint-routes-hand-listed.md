# The route-table gate names a new unsorted route only if `register(app)` adds it; the entrypoint's routes are a hand-kept list

**Id:** 2026-10-11-entrypoint-routes-hand-listed
**Type:** bug
**Opened:** 2026-10-11 (book `admin-action-owner-check` close, audit §4 #6)
**Status:** OPEN
**Done:** —

`test/admin-action-sweep.test.js` (AC6a, T2, T6) walks the real router that `register(app)` builds, and adds the
entrypoint's own routes from a literal list, `ENTRYPOINT_ROUTES` and `ENTRYPOINT_MOUNTS`, because `bin/control-panel.js`
cannot load without Redis. Nothing compares that list with the file, so a route added to `bin/control-panel.js` is not
named by the gate:
- a new `/api/` route registered after `app.use(authMiddleware)` still fails closed at runtime (no table entry means the
  owner's side), but the gate stays green;
- a route registered before the access check, or outside `/api/`, is judged by nothing, and the gate stays green.

Today the list matches the file and every entrypoint route is a read or a page (compared at the book's close), so
there is no member. ADR `security-auth-exposure/0005` calls this part a static scan; the list was taken by hand once.

**Fix shape.** In the gate, scan `bin/control-panel.js` for `app.<method>(` and `app.use(` registrations and fail,
naming the route, when the scan and the list disagree. Also fail when an `/api/` route is registered before
`app.use(authMiddleware)`.

**Pointer:** `test/admin-action-sweep.test.js` (`ENTRYPOINT_ROUTES`); `bin/control-panel.js`; book
`admin-action-owner-check` frame bullet 5.
