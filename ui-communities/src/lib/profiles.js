/*
 * Profile fetch + people-search against brainstorm.world's API.
 *
 * Two endpoints power the read paths:
 *
 *   1) GET /api/search/profiles/meili?q=<q>&limit=<n>&wotPov=house
 *      The brainstorm.world meilisearch proxy. Returns hits with the
 *      full kind-0 profile INLINE plus namespaced WoT scores. Single
 *      round-trip, ~sub-10ms on the backend, sufficient for a typed
 *      autocomplete. This is the path the communities wizard uses.
 *
 *   2) GET /api/profiles?pubkeys=<csv>
 *      The bulk kind-0 hydrate. Used by the Header to resolve the
 *      signed-in viewer's own profile (which meili wouldn't naturally
 *      surface unless the viewer types their own name).
 *
 * Meili hit shape (per src/api/search/profiles/meili/index.js):
 *   {
 *     id, pubkey, npub,
 *     name, display_name, picture, banner, about, nip05, website, lud16,
 *     wot_rank_<8charPovSuffix>: number,
 *     wot_followers_<8charPovSuffix>: number,
 *     created_at,
 *   }
 * The response also carries `povSuffix` so the caller knows which
 * suffix is live for this query.
 *
 * Mock-mode projects mockData.members through the same shape so dev
 * stays exercisable end-to-end. Each mock member gets a deterministic
 * synthetic hex pubkey so seedMembers can carry hex strings everywhere
 * (matching the production publish path).
 *
 * CORS caveat: brainstorm.world's CORS posture for cross-origin reads
 * from communities.brainstorm.world isn't formally verified. On a
 * fetch failure we log + resolve empty so the UI shows "no results"
 * instead of crashing.
 */

import { members as mockMembers } from '../data/mockData.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'
const API_BASE = (import.meta.env.VITE_PROFILE_API_BASE || '').replace(/\/$/, '')

const cache = new Map()  // hex pubkey → profile object (or null when miss)
const inflight = new Map()  // hex pubkey → Promise

function mockPubkey(memberId) {
  // Deterministic synthetic 64-char hex from the mock id ('m1' → 64 chars).
  const seed = String(memberId || '').toLowerCase()
  let out = ''
  for (let i = 0; i < 64; i++) {
    const ch = seed.charCodeAt(i % seed.length) || 97
    out += (ch % 16).toString(16)
  }
  return out
}

function projectMockProfile(member) {
  if (!member) return null
  return {
    name: member.name,
    display_name: member.name,
    picture: null,
    nip05: member.handle ? `${member.handle}@brainstorm.dev` : null,
    about: null,
  }
}

export function mockMemberPubkey(memberId) {
  return mockPubkey(memberId)
}

export async function fetchProfiles(pubkeys) {
  if (!Array.isArray(pubkeys) || pubkeys.length === 0) return {}
  const unique = Array.from(new Set(pubkeys.filter(Boolean)))
  const need = unique.filter(p => !cache.has(p))

  if (USE_MOCK) {
    for (const pk of need) {
      const m = mockMembers.find(x => mockPubkey(x.id) === pk)
      cache.set(pk, m ? projectMockProfile(m) : null)
    }
  } else if (need.length > 0) {
    // Coalesce in-flight requests so a Header mount + a parallel
    // search-hydration don't fire two identical fetches.
    const fetched = need.filter(pk => !inflight.has(pk))
    if (fetched.length > 0) {
      const p = doFetch(fetched)
      for (const pk of fetched) inflight.set(pk, p)
    }
    await Promise.all(need.map(pk => inflight.get(pk)))
    for (const pk of need) inflight.delete(pk)
  }

  const out = {}
  for (const pk of unique) out[pk] = cache.get(pk) || null
  return out
}

async function doFetch(pubkeys) {
  try {
    const url = `${API_BASE}/api/profiles?pubkeys=${encodeURIComponent(pubkeys.join(','))}`
    const r = await fetch(url, { credentials: 'omit' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    const profiles = (data && data.profiles) || {}
    for (const pk of pubkeys) cache.set(pk, profiles[pk] || null)
  } catch (err) {
    console.warn('[profiles] /api/profiles failed:', err && err.message)
    for (const pk of pubkeys) cache.set(pk, null)
  }
}

export async function fetchProfile(pubkey) {
  if (!pubkey) return null
  const r = await fetchProfiles([pubkey])
  return r[pubkey]
}

/* Extract the WoT score for a metric ("rank" | "followers") from a
 * meili hit, using the per-response POV suffix to find the namespaced
 * field. Falls back to a non-namespaced legacy field if present. */
function extractWot(hit, metric, povSuffix) {
  if (povSuffix) {
    const v = hit[`wot_${metric}_${povSuffix}`]
    if (v != null) return v
  }
  const legacy = hit[`wot_${metric}`]
  return legacy != null ? legacy : null
}

export async function searchProfilesByQuery(query, { limit = 12 } = {}) {
  const q = (query || '').trim()
  if (q.length < 2) return []

  if (USE_MOCK) {
    const lc = q.toLowerCase()
    return mockMembers
      .filter(m => m.name.toLowerCase().includes(lc))
      .slice(0, limit)
      .map(m => ({
        pubkey: mockPubkey(m.id),
        profile: projectMockProfile(m),
        wot: {
          rank: Math.round(m.trust * 100) / 100,
          followers: m.vouchedBy || null,
        },
      }))
  }

  try {
    const url = `${API_BASE}/api/search/profiles/meili?q=${encodeURIComponent(q)}&limit=${limit}&offset=0&wotPov=house`
    const r = await fetch(url, { credentials: 'omit' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    if (!data || data.success === false || !Array.isArray(data.hits)) return []
    const povSuffix = data.povSuffix || null
    const hits = data.hits.map(hit => {
      const pubkey = hit.pubkey || hit.id
      // Pre-warm the cache so a follow-up fetchProfile (e.g. header
      // hydration after selecting yourself as a seed) is a no-op.
      cache.set(pubkey, hitToProfile(hit))
      return {
        pubkey,
        profile: hitToProfile(hit),
        wot: {
          rank: extractWot(hit, 'rank', povSuffix),
          followers: extractWot(hit, 'followers', povSuffix),
        },
        nip05Verified: hit._nip05Verified === true,
      }
    })
    // Surface NIP-05 verified result first (server-side parallel
    // verification — when the user's query is itself an nip-05 string).
    if (data.nip05Result) {
      const n = data.nip05Result
      const pubkey = n.pubkey || n.id
      const already = hits.find(h => h.pubkey === pubkey)
      if (!already) {
        cache.set(pubkey, hitToProfile(n))
        hits.unshift({
          pubkey,
          profile: hitToProfile(n),
          wot: {
            rank: extractWot(n, 'rank', povSuffix),
            followers: extractWot(n, 'followers', povSuffix),
          },
          nip05Verified: true,
        })
      }
    }
    return hits
  } catch (err) {
    console.warn('[profiles] meili search failed:', err && err.message)
    return []
  }
}

function hitToProfile(hit) {
  return {
    name: hit.name || '',
    display_name: hit.display_name || hit.displayName || '',
    picture: hit.picture || null,
    banner: hit.banner || null,
    nip05: hit.nip05 || null,
    about: hit.about || null,
    website: hit.website || null,
    lud16: hit.lud16 || null,
  }
}

export function getCachedProfile(pubkey) {
  return cache.get(pubkey) || null
}
