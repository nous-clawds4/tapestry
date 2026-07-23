# Jumble tagging kit

Self-contained integration kit for adding Tapestry/Brainstorm decentralized tagging to a fork of
the Jumble Nostr client. Copy this whole folder into the Jumble fork's repo root and tell a Claude
instance there:

> Read `jumble-tagging/GO.md` and do what it says.

Contents: `GO.md` (the build instructions), `ACCEPTANCE.md` (definition of done), `CONFIG.json`
(deployment identity — see its `_comment` keys, especially if pointing at a different instance),
`sdk/` (the dependency-free protocol core, ESM), `protocol/` (normative wire specs, reference).

Maintained in the Tapestry repo at `integration-kits/jumble-tagging/`. The `sdk/event-tagging/`
files are an ESM port of `src/lib/event-tagging/` (CJS) — if the source lib changes, re-port
(mechanical: `require`→`import`, `module.exports`→`export`). `sdk/profile-tagging.js` mirrors the
wire shape in `ui/src/utils/publishProfileTag.js`; keep them in sync until the profile-tag shape
is extracted into the shared lib.

Decisions baked in (2026-07-23): dcosl.brainstorm.world as the default (configurable) tag-hub
relay; house-POV trust via lazy NIP-85 kind-30382 lookups with count-everyone degrade; legacy
hashtag bridging and pinning explicitly out of scope for v1.

Empirical caveats (probed live 2026-07-23, both encoded in CONFIG.json — details in its
comments): (1) the house's TA-signed trust artifacts (30382/3039x) exist on the **house relay
only**, not on dcosl — hence `trustRelays`; (2) the entire live 30382 corpus is signed by a
**retired** house key (2026-05-26 snapshot; assistant keys rotate on container re-init) — hence
`nip85AuthorPubkeys` is a list, latest-per-subject wins across authors. When the house re-runs
its NIP-85 pipeline under the current TA, fresher events simply supersede; no kit change needed.
