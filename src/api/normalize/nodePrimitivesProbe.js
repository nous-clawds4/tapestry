/**
 * Read-only deployment probe for the node-primitives surface.
 * Evidence-only: proves the surface's delivery unit is deployed, so staging and
 * production can be checked without credentials (ADR node-primitives/0001
 * decision 1, under ADR relationship-primitives/0002's contract). NOT a
 * health/monitoring/status endpoint — do not add version, uptime, counts, or any
 * computed field.
 * Zero requires BY CONTRACT: this module must never import anything —
 * the empty import surface IS the zero-side-effect guarantee.
 */
const PROBE_RESPONSE = {
  success: true,
  surface: 'node-primitives',
  operations: ['add-subset'],
};

function handleNodePrimitivesProbe(req, res) {
  return res.json(PROBE_RESPONSE);
}

module.exports = { handleNodePrimitivesProbe, PROBE_RESPONSE };
