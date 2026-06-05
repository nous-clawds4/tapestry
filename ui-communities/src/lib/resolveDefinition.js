/*
 * §26 Resolved Definition — client-side resolver (ADR 0028).
 *
 * The read-side companion to the `b` inherit-from tag (§25): a circle's
 * effective definition after following its `b`-parent chain and applying
 * its own overrides. Whole-field replace (set-valued algebra deferred).
 *
 *   resolved(node) = merge( <parents folded, first-listed wins>, node.statedFields )
 *
 * Live, read-time: the walk fetches each ancestor's current state via an
 * injected `fetchByATag`. MAX_DEPTH bounds the walk; a visited-set cycle
 * guard truncates a revisited ancestor (treated as a leaf) rather than
 * throwing — read-path resolution degrades gracefully.
 */

export const MAX_DEPTH = 16

const DEFINITION_FIELDS = ['name', 'description', 'belongingBar', 'topics']

/** A non-empty child field overrides the base; an empty/absent one inherits. */
export function mergeDefinition(base, child) {
  const out = { ...base }
  for (const f of DEFINITION_FIELDS) {
    const cv = child ? child[f] : undefined
    const present = Array.isArray(cv) ? cv.length > 0 : (cv !== undefined && cv !== null && cv !== '')
    if (present) out[f] = cv
    else if (!(f in out)) out[f] = Array.isArray(cv) ? [] : (cv === undefined ? undefined : cv)
  }
  return out
}

function statedFields(node) {
  if (!node) return {}
  return {
    name: node.name,
    description: node.description,
    belongingBar: node.belongingBar,
    topics: node.topics,
  }
}

function parentTags(node) {
  if (!node) return []
  if (Array.isArray(node.parents) && node.parents.length) return node.parents
  return node.parent ? [node.parent] : []
}

function aTagOf(node) {
  if (!node) return null
  if (node.aTag) return node.aTag
  if (node.founder && node.slug) return `39998:${node.founder}:${node.slug}`
  return node.slug || null
}

/**
 * Resolve a circle's effective definition.
 * @param {object} circle            the starting circle projection (has .parent / .parents)
 * @param {(aTag:string)=>Promise<object|null>} fetchByATag  fetch a parent circle by its a-tag
 * @param {object} [opts] { maxDepth }
 * @returns {Promise<{name, description, belongingBar, topics}>}
 */
export async function resolveDefinition(circle, fetchByATag, { maxDepth = MAX_DEPTH } = {}) {
  const visited = new Set()

  async function walk(node, depth) {
    if (!node) return {}
    const a = aTagOf(node)
    // FENCE (multi-parent / diamond): `visited` is shared across sibling
    // branches, which is cycle-safe but NOT diamond-correct — in A→(B,C)→D the
    // branch resolved first claims D and the other skips it (path-dependent
    // field loss). Harmless while single-parent (no diamonds can form). Before
    // enabling multi-parent (see fetch.js projectDeclaration), switch to a
    // per-path set (pass `path` down, remove on unwind) AND add a multi-node
    // walk test — the current tests never exercise a real diamond.
    if (a) visited.add(a)

    let base = {}
    const parents = parentTags(node)
    // Fold parents in reverse so the FIRST-listed parent is merged last and wins.
    for (let i = parents.length - 1; i >= 0; i--) {
      const pTag = parents[i]
      if (!pTag || visited.has(pTag)) continue   // cycle-guard: truncate, don't throw
      if (depth >= maxDepth) break               // depth-guard
      let parent = null
      try { parent = await fetchByATag(pTag) } catch { parent = null }
      if (parent) base = mergeDefinition(base, await walk(parent, depth + 1))
    }
    return mergeDefinition(base, statedFields(node))
  }

  return walk(circle, 0)
}
