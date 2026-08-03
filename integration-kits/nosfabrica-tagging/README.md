# NosFabrica tagging kit

Self-contained integration kit for adding Tapestry/Brainstorm decentralized tagging to
**Brainstorm-UI** (the NosFabrica client at brainstorm.world). Copy this whole folder into the
Brainstorm-UI repo root and tell a Claude instance there:

> Read `nosfabrica-tagging/Start.md` and do what it says.

The agent will first run a short **interview** with you (scope floor, how the existing role
chips relate to protocol tags, trust POV, relay configurability, picker vocabulary), record the
answers in `DECISIONS.md`, then build to the chosen floor.

Contents: `Start.md` (the NosFabrica-specific overlay: interview, seam map, build plan),
`CONFIG.json` (deployment identity — Tapestry reference deployment by default; the interview
can repoint trust at NosFabrica's own NIP-85 corpus), `ACCEPTANCE.md` (UI-coupled definition of
done, per floor), and `core/` — a verbatim copy of the target-agnostic tagging core
(`core/INTEGRATION.md` + `core/ACCEPTANCE.md` + `sdk/` + `protocol/`), which remains binding
underneath the overlay.

Maintained in the Tapestry repo at `integration-kits/nosfabrica-tagging/`. `core/` is a copy of
`../tagging-core/` (the canonical home — fix there first, then re-copy; see its README for the
SDK sync rules). The seam map in `Start.md` §3 reflects a survey of
github.com/NosFabrica/Brainstorm-UI and brainstorm_server as of 2026-08-03 — line-number
anchors drift; patterns are the contract.

Decisions baked in (2026-08-03): same tag hub (dcosl.brainstorm.world) and house-trust POV as
the jumble kit; pure client-side integration (brainstorm_server uninvolved in v1); self-tagging
on one's own profile as the recommended anchor floor; role-chip migration posed as an interview
question rather than prescribed.
