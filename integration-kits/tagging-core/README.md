# Tagging core (target-agnostic integration kit)

The reusable core for adding Tapestry/Brainstorm decentralized tagging to **any** Nostr client.
It contains everything protocol-shaped and nothing target-specific:

- `INTEGRATION.md` — the target-agnostic build instructions (ground rules, mental model,
  service-layer contract, capability ladder C0–C7, wire checklist, traps).
- `ACCEPTANCE.md` — "tagging is integrated," verified at the wire/console level with no UI
  assumptions; sections mirror the capability ladder.
- `CONFIG.template.json` — deployment-identity template (defaults point at the reference
  deployment: dcosl hub + tags.brainstorm.world house). Read its `_comment` keys.
- `sdk/` — the dependency-free protocol core (ESM): `event-tagging/`, `profile-tagging.js`,
  `trust.js`.
- `protocol/` — normative wire specs the SDK implements.

## How per-target kits consume this

A per-target kit (e.g. `../nosfabrica-tagging/`) is a **thin overlay**: a `Start.md` (seam map +
interview + surface choices for one specific codebase), a filled-in `CONFIG.json`, a UI-coupled
acceptance doc — plus a verbatim copy of this folder as `core/`, so the per-target kit stays a
single self-contained folder a developer can drop into their fork and point an agent at.
`INTEGRATION.md` §9 specifies exactly what an overlay may specialize.

Standalone use works too: with no overlay, `INTEGRATION.md` + `ACCEPTANCE.md` +
`CONFIG.template.json` (renamed to `CONFIG.json`, values checked) are sufficient.

## Provenance and sync rules

Extracted 2026-08-03 from `../jumble-tagging/` (the first, target-coupled kit) after its
one-shot integration succeeded; the jumble kit predates the split and keeps its own copies.
**This folder is now the canonical home of `sdk/` and `protocol/`** — fix here first, then
propagate to per-target kits (and jumble, while it lives).

- `sdk/event-tagging/` is an ESM port of the Tapestry repo's `src/lib/event-tagging/` (CJS) —
  if the source lib changes, re-port (mechanical: `require`→`import`,
  `module.exports`→`export`).
- `sdk/profile-tagging.js` mirrors the wire shape in `ui/src/utils/publishProfileTag.js`; keep
  them in sync until the profile-tag shape is extracted into the shared lib.

Decisions baked into the defaults (2026-07-23, unchanged from the jumble kit):
dcosl.brainstorm.world as the default (configurable) tag-hub relay; house-POV trust via lazy
NIP-85 kind-30382 lookups with count-everyone degrade. Empirical caveats encoded in the config
template: trust artifacts live on the house relay only (`trustRelays`); the live 30382 corpus is
signed by a retired house key (`nip85AuthorPubkeys` is a list, latest-per-subject wins).
