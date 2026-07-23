/**
 * Read-only deployment probe for the relationship-primitives surface.
 * Evidence-only: proves the surface's delivery unit is deployed
 * (acceptance frame bullet 8a). NOT a health/monitoring/status endpoint —
 * do not add version, uptime, counts, or any computed field (story #2
 * out-of-scope; ADR relationship-primitives/0002).
 * Zero requires BY CONTRACT: this module must never import anything —
 * the empty import surface IS the zero-side-effect guarantee.
 */
const PROBE_RESPONSE = {
  success: true,
  surface: 'relationship-primitives',
  operations: ['add-relationship', 'delete-relationship'],
};

function handleRelationshipPrimitivesProbe(req, res) {
  return res.json(PROBE_RESPONSE);
}

module.exports = { handleRelationshipPrimitivesProbe, PROBE_RESPONSE };
