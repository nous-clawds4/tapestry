/**
 * Pure reaction aggregation (ADR-0034).
 *
 * Latest-per-reactor +/- model: a reactor's current state for a target is the
 * content of their MOST RECENT kind-7 reaction. The count is the number of
 * distinct reactors whose latest reaction is '+'. This makes counts exact
 * (deduped by reactor) and the toggle deterministic, with no deletion semantics.
 *
 * Input: an array of projected reactions { targetId, reactor, content, createdAt }.
 * Output: { [targetId]: { count, mine } } where `mine` is whether the given
 * viewer's latest reaction on that target is active ('+').
 */
export function summarizeReactions(reactions, viewerPubkey) {
  // targetId -> reactor -> { content, createdAt }  (latest createdAt wins)
  const byTarget = {}
  for (const rx of reactions || []) {
    if (!rx || !rx.targetId || !rx.reactor) continue
    const reactors = byTarget[rx.targetId] || (byTarget[rx.targetId] = {})
    const prev = reactors[rx.reactor]
    if (!prev || (rx.createdAt || 0) >= prev.createdAt) {
      reactors[rx.reactor] = { content: rx.content, createdAt: rx.createdAt || 0 }
    }
  }

  const out = {}
  for (const targetId of Object.keys(byTarget)) {
    const reactors = byTarget[targetId]
    let count = 0
    for (const reactor of Object.keys(reactors)) {
      if (reactors[reactor].content === '+') count++
    }
    const mineEntry = viewerPubkey ? reactors[viewerPubkey] : null
    out[targetId] = { count, mine: !!mineEntry && mineEntry.content === '+' }
  }
  return out
}
