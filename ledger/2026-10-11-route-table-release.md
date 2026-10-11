# Every admin action is the owner's side's unless the route table opens it — shipped everywhere

**Id:** 2026-10-11-route-table-release
**Type:** bug
**Opened:** 2026-10-10 (book `admin-action-owner-check`, story security-auth-exposure #8)
**Status:** DONE
**Done:** 2026-10-11 — `staging` `151e39fb`; PR #847 into `main` (merge `175cffa6`, deploy run 147); PR #848 into `feat/tags` (merge `1e888786`, deploy run 93); PR #849 into `feature-magic-carpet` (merge `41fe9363`, deploy run 36). Live visitor probes on all four answer 401 with a message naming who may act; pages and public reads unchanged.

The admin actions that any signed-in key (and, for two GET routes, any visitor) could reach are closed by one route
table and a default-deny access check (ADR `security-auth-exposure/0005`). The named inventory is
`engineering-team/audits/admin-action-owner-check/inventory.md`. OPEN.md row 269 is settled (owner-only signing as the
assistant) and row 276's F4/F5 are closed.

**Pointer:** story `security-auth-exposure/8-admin-action-sweep.md`; review `reviews/security-auth-exposure/8-admin-action-sweep.md`.
