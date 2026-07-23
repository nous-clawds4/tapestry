/**
 * Pure placement-ops core for the graph-curation UI.
 * ADR: engineering-team/decisions/graph-curation-ui/0001-shared-placement-dialog-over-primitives.md
 *
 * DIRECTION RULE (stated once, here): a placement edge is always
 * (set)-[relType]->(node) — parent first. fromUuid is the SET, toUuid is the
 * node being placed. The relationship-primitives endpoints apply the body
 * verbatim, so getting this wrong writes a real, wrong edge.
 *
 * No React, no fetch, no side effects — this module is executed directly by
 * the Node test runner.
 */

/** The two placement kinds the server whitelist admits — nothing else. */
export const PLACEMENT_KINDS = {
  element: 'HAS_ELEMENT',
  subset: 'IS_A_SUPERSET_OF',
};

/**
 * Build the ordered operation list for a placement.
 *
 * @param {object} args
 * @param {string} args.nodeUuid    the node being placed
 * @param {string} args.destSetUuid the destination set (edge parent)
 * @param {string} args.kind        'element' | 'subset'
 * @param {{setUuid: string, relType: string}} [args.source]
 *        an existing placement to move away from; when present the result is
 *        a move (add the new edge, then delete the old one)
 * @returns {Array<{op: 'add'|'delete', fromUuid: string, toUuid: string, relType: string}>}
 *
 * Ordering invariant: the add always precedes the delete (no-orphan — a
 * partial failure leaves the node in two places, visibly, never zero).
 * Same-destination guard: moving a placement onto itself returns ZERO ops —
 * add would report already-existed and the delete would then remove the only
 * edge, silently destroying the placement being "moved".
 */
export function buildPlacementOps({ nodeUuid, destSetUuid, kind, source } = {}) {
  const relType = PLACEMENT_KINDS[kind];
  if (!relType) {
    throw new Error(`Unknown placement kind: ${kind} (expected 'element' or 'subset')`);
  }
  if (source && source.setUuid === destSetUuid && source.relType === relType) {
    return [];
  }
  const ops = [{ op: 'add', fromUuid: destSetUuid, toUuid: nodeUuid, relType }];
  if (source) {
    ops.push({ op: 'delete', fromUuid: source.setUuid, toUuid: nodeUuid, relType: source.relType });
  }
  return ops;
}

/**
 * Cycle guard (UI policy — the primitives carry none, ADR decision 3).
 *
 * Filters a candidate list (destinations, or nodes for a fixed destination):
 * the moving node itself is never a legal counterpart; for subset-kind
 * placements the supplied exclusion list (descendants of the node, or
 * ancestors of the fixed set — whichever side is being picked) is also
 * removed, because an IS_A_SUPERSET_OF edge into that set would close a
 * cycle. Element-kind placements exclude only the node itself — a leaf
 * placement under a descendant set is legal.
 *
 * @param {Array<{uuid: string}>} candidates
 * @param {object} args
 * @param {string} args.nodeUuid
 * @param {string} args.kind 'element' | 'subset'
 * @param {string[]} [args.descendantUuids]
 */
export function filterDestinations(candidates, { nodeUuid, kind, descendantUuids = [] } = {}) {
  const excluded = new Set(kind === 'subset' ? descendantUuids : []);
  excluded.add(nodeUuid);
  return (candidates || []).filter(c => !excluded.has(c.uuid));
}
