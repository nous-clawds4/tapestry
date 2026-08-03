# Jumble tagging kit

Self-contained integration kit for adding Tapestry/Brainstorm decentralized tagging to a fork of
the Jumble Nostr client. Copy this whole folder into the Jumble fork's repo root and tell a Claude
instance there:

> Read `jumble-tagging/GO.md` and do what it says.

Contents: `GO.md` (the build instructions), `ACCEPTANCE.md` (definition of done), `CONFIG.json`
(deployment identity — see its `_comment` keys, especially if pointing at a different instance),
`sdk/` (the dependency-free protocol core, ESM), `protocol/` (normative wire specs, reference).

Maintained in the Tapestry repo at `integration-kits/jumble-tagging/`. **Since 2026-08-03 the
canonical home of `sdk/` and `protocol/` is `../tagging-core/`** (extracted from this kit) —
fix there first, then propagate here; its README carries the SDK sync rules. This kit predates
the core/overlay split and keeps its own flat copies plus the Jumble-coupled GO.md; newer kits
(e.g. `../nosfabrica-tagging/`) embed the core as `core/` and add only a target overlay.

Decisions baked in (2026-07-23): dcosl.brainstorm.world as the default (configurable) tag-hub
relay; house-POV trust via lazy NIP-85 kind-30382 lookups with count-everyone degrade; legacy
hashtag bridging and pinning explicitly out of scope for v1.

Empirical caveats (probed live 2026-07-23, both encoded in CONFIG.json — details in its
comments): (1) the house's TA-signed trust artifacts (30382/3039x) exist on the **house relay
only**, not on dcosl — hence `trustRelays`; (2) the entire live 30382 corpus is signed by a
**retired** house key (2026-05-26 snapshot; assistant keys rotate on container re-init) — hence
`nip85AuthorPubkeys` is a list, latest-per-subject wins across authors. When the house re-runs
its NIP-85 pipeline under the current TA, fresher events simply supersede; no kit change needed.
