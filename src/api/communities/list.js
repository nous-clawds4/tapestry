/*
 * GET /api/communities?viewer=<pubkey>
 *
 * Returns the list of communities reachable through viewer's trust network,
 * sorted by trustedHere desc. Always succeeds: empty data → empty array, no
 * 500s on fresh deploys.
 */

const dataSources = require('./dataSources.js')
const { getOrCompute } = require('./cache.js')
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys')

function resolveViewer(req) {
  const q = req && req.query && req.query.viewer
  if (typeof q === 'string' && /^[0-9a-f]{64}$/i.test(q)) return q.toLowerCase()
  // Malformed or absent — fall back to the local TA. Public endpoint:
  // never 400 on viewer; just compute against the canonical viewer.
  try {
    return getOwnerAssistantPubkey() || null
  } catch {
    return null
  }
}

async function handleList(req, res) {
  try {
    const viewer = resolveViewer(req)
    const cacheKey = `list:${viewer || 'anon'}`
    const communities = await getOrCompute(cacheKey, async () => {
      const records = await dataSources.loadCommunitiesForViewer(viewer)
      // Sort by trustedHere desc, then by name asc as a tiebreaker.
      const sorted = [...records].sort((a, b) => {
        const tb = (b.trustedHere || 0) - (a.trustedHere || 0)
        if (tb !== 0) return tb
        return String(a.name || '').localeCompare(String(b.name || ''))
      })
      return sorted.map(c => projectListEntry(c, viewer))
    })
    return res.json({ success: true, communities })
  } catch (err) {
    console.error('[communities/list] unexpected error:', err && err.message)
    return res.status(500).json({ success: false, message: 'Failed to load communities' })
  }
}

function projectListEntry(c, viewer) {
  const memberPubkeys = Array.isArray(c.seedMembers) ? c.seedMembers : []
  return {
    slug: c.slug,
    name: c.name,
    description: c.description,
    tags: Array.isArray(c.topics) ? c.topics : [],
    image: c.image || null,
    accent: c.accent || null,
    language: c.language || null,
    memberCount: typeof c.memberCount === 'number' ? c.memberCount : memberPubkeys.length,
    trustedHere: typeof c.trustedHere === 'number' ? c.trustedHere : 0,
    activity: c.activity || null,
    members: memberPubkeys.slice(0, 4),
    joined: viewer ? memberPubkeys.includes(viewer) : false,
  }
}

module.exports = { handleList, resolveViewer, projectListEntry }
