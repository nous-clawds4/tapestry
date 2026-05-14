/*
 * GET /api/communities/:slug?viewer=<pubkey>
 *
 * Returns one community record + the viewer's projection of it. 404 with
 * { success: false } when no community-record with that slug exists in the
 * viewer's trust network.
 */

const dataSources = require('./dataSources.js')
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys')
const { projectListEntry } = require('./list.js')

function resolveViewer(req) {
  const q = req && req.query && req.query.viewer
  if (typeof q === 'string' && /^[0-9a-f]{64}$/i.test(q)) return q.toLowerCase()
  try {
    return getOwnerAssistantPubkey() || null
  } catch {
    return null
  }
}

async function handleDetail(req, res) {
  try {
    const viewer = resolveViewer(req)
    const slug = req.params && req.params.slug
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ success: false, message: 'slug parameter is required' })
    }
    const record = await dataSources.loadCommunityRecord(slug, viewer)
    if (!record) {
      return res.status(404).json({ success: false, message: 'Circle not found' })
    }
    const entry = projectListEntry(record, viewer)
    return res.json({
      success: true,
      community: {
        ...entry,
        founder: record.founder || null,
        relays: Array.isArray(record.relays) ? record.relays : [],
        weightingModel: record.weightingModel || 'gr-community-default-v1',
        endorsementThreshold: typeof record.endorsementThreshold === 'number'
          ? record.endorsementThreshold
          : 0.5,
        nip72Wrapping: record.nip72Wrapping || null,
        posts: [], // Slice 6 wires kind-1 feed; empty array for v1 read path.
      },
    })
  } catch (err) {
    console.error('[communities/detail] unexpected error:', err && err.message)
    return res.status(500).json({ success: false, message: 'Failed to load community' })
  }
}

module.exports = { handleDetail }
