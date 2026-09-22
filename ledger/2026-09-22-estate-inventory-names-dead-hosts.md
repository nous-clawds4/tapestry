# Three estate host lists outside this repo still name the two sandboxes decommissioned on 2026-09-12

**Id:** 2026-09-22-estate-inventory-names-dead-hosts
**Type:** cleanup
**Opened:** 2026-09-22 (site-trust-signals book close, audit §6)
**Status:** OPEN
**Done:** —

`communities.brainstorm.world` and `curate.brainstorm.world` were decommissioned on 2026-09-12
(PR #656). Neither resolves any more (`curl` exit 6, checked 2026-09-22).

That PR trimmed every host list **in this repo**: `SECURITY.md`, `ESTATE_ATTESTATION` in
`src/utils/siteTrust.js` (now guarded by test U6c), and `OPERATIONS.md`. Three lists outside the repo
were not touched, and all three still name both hosts:

1. **`ECOSYSTEM.md` in NosFabrica/protocols**, in its "R&D UI — tapestry" table (last updated
   2026-08-22). The file declares itself the canonical inventory: "if one of them disagrees with this
   file, this file is right and the copy has a bug". Today the canonical file is the wrong one, and
   this repo's copy is right.
2. **The Brainstorm-UI copy of the ownership attestation.** It is served live at
   `/.well-known/security.txt` on `brainstorm.world`, `brainstorm.nosfabrica.com` and
   `brainstorm-staging.nosfabrica.com` (checked 2026-09-22). The export note on `ESTATE_ATTESTATION`
   says any edit here must be mirrored there.
3. **NosFabrica/protocols#6** (llms.txt), whose fleet table lists six tapestry hosts.

The llms.txt intake entry in `engineering-team/stories/_intake.md` said "six" as well. It was
corrected in the book close.

**Why it matters.** The attestation is a published claim that these hosts are operated by the team,
and row 175 established that such claims must be true, not just present. The llms.txt draft also
routes agents to `ECOSYSTEM.md` for the list of hosts.

**Fix shape:**
- (a) Drop the two hosts from `ECOSYSTEM.md` and from the Brainstorm-UI attestation, and update
  protocols#6's table. All three are outward-facing edits in other repositories, so they are the
  operator's call.
- (b) Add one line to `OPERATIONS.md`'s decommission steps that names the lists outside the repo, so
  the next retirement sweeps them too.
- (c) Row 173's proposed resolve-check covers `ESTATE_ATTESTATION` only. The copies elsewhere are best
  checked by hand at the `security.txt` renewal (row 172), when every copy has to be touched anyway.

**Pointer:** `engineering-team/audits/site-trust-signals/audit.md` §4 #1 and §6;
`src/utils/siteTrust.js` (the `ESTATE_ATTESTATION` export note); OPEN.md rows 172, 173, 175.
