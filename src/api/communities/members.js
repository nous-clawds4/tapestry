/*
 * GET /api/communities/:slug/members?viewer=<pubkey>
 *
 * Returns the membership roster for a community with computed GR-Community
 * scores from the viewer's perspective. Members sorted by score desc; seeds
 * always at the top (score 1).
 */

const dataSources = require('./dataSources.js')
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys')
const { getOrCompute } = require('./cache.js')
const { computeGrCommunityScores, isMember } = require('../../algos/grCommunity')

function resolveViewer(req) {
  const q = req && req.query && req.query.viewer
  if (typeof q === 'string' && /^[0-9a-f]{64}$/i.test(q)) return q.toLowerCase()
  try {
    return getOwnerAssistantPubkey() || null
  } catch {
    return null
  }
}

async function handleMembers(req, res) {
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
    const aTag = record.aTag || `39999:${record.founder || ''}:${record.slug}`
    const cacheKey = `${aTag}:${viewer || 'anon'}`

    const members = await getOrCompute(cacheKey, async () => {
      const signals = await dataSources.loadEndorsementSignals(aTag)
      const endorsements = signals.filter(s => s.type !== 'veto').map(s => ({ rater: s.rater, target: s.target }))
      const vetoes = signals.filter(s => s.type === 'veto').map(s => ({ rater: s.rater, target: s.target }))

      // Collect every pubkey we might want a baseline for.
      const allRaters = new Set([
        ...(record.seedMembers || []),
        ...signals.map(s => s.rater),
        ...signals.map(s => s.target),
      ])
      const baselineGr = await dataSources.loadBaselineGrScores(Array.from(allRaters))

      const { scores } = computeGrCommunityScores({
        seeds: record.seedMembers || [],
        endorsements,
        vetoes,
        baselineGr,
      })

      const threshold = typeof record.endorsementThreshold === 'number'
        ? record.endorsementThreshold
        : 0.5

      // Count endorsements per target for the vouchedBy display field.
      const endorsementCounts = new Map()
      for (const e of endorsements) {
        endorsementCounts.set(e.target, (endorsementCounts.get(e.target) || 0) + 1)
      }

      const entries = []
      for (const [pubkey, score] of scores) {
        entries.push({
          pubkey,
          score,
          isMember: isMember(score, threshold),
          vouchedBy: endorsementCounts.get(pubkey) || 0,
          voucherNames: [], // name resolution comes from a separate concern; empty until populated.
        })
      }
      entries.sort((a, b) => b.score - a.score)
      return entries
    })

    return res.json({ success: true, members })
  } catch (err) {
    console.error('[communities/members] unexpected error:', err && err.message)
    return res.status(500).json({ success: false, message: 'Failed to load members' })
  }
}

module.exports = { handleMembers }
