/**
 * The pre-image records of a write batch (ADR tagging-edges/0002 "The guard", step 1; the line shape as amended by
 * tagging-edges/0003): one per row whose snapshot carries a key outside the nine, built from the snapshot itself, so
 * it holds for any caller's rows. `writer` says which writer dropped the keys: 'pass' or 'realtime'. The caller
 * appends them through state.appendPreimages, fsynced, before the batch's transaction opens (graph.js's `preimage`).
 */

const { TAGS_PROPERTY_KEYS, canonicalValue } = require('../../lib/tagging-edges/sweep');
const { SCALAR_TYPES } = require('./graph');

/** → [{ runId, writer, address, rid, fromPubkey, toPubkey, props: [[key, type, value]] }], empty when no row needs one. */
function preimageRecords(runId, batch, { writer } = {}) {
  const records = [];
  for (const r of batch) {
    const snap = r && (r.snapshot || r.row);
    if (!snap || !Array.isArray(snap.props)) continue;
    const props = snap.props.filter(Array.isArray);
    if (!props.some((p) => !TAGS_PROPERTY_KEYS.includes(String(p[0])))) continue;
    records.push({
      runId,
      writer,
      address: r.address,
      rid: snap.rid == null ? null : String(snap.rid),
      fromPubkey: typeof snap.fromPubkey === 'string' ? snap.fromPubkey : canonicalValue(snap.fromPubkey),
      toPubkey: typeof snap.toPubkey === 'string' ? snap.toPubkey : canonicalValue(snap.toPubkey),
      props: props.map((p) => [p[0], p[1], SCALAR_TYPES.includes(p[1]) ? p[2] : canonicalValue(p[3])]),
    });
  }
  return records;
}

module.exports = { preimageRecords };
