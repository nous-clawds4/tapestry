/*
 * Profile fetch + people-search against brainstorm.world's public API.
 *
 * Two endpoints, both anonymous:
 *
 *   GET /api/search/profiles?searchType=kind0&searchString=<q>
 *     → { success, pubkeys: string[] }  (up to ~60 hex pubkeys)
 *
 *   GET /api/profiles?pubkeys=<csv>
 *     → { success, profiles: { hex: { name, display_name, picture, ... } } }
 *
 * The two endpoints are split because search needs to be fast (just a
 * list of matches) and hydration is a separate batch. We always pipe
 * search results through fetchProfiles so callers get the rendered
 * shape without doing the second round-trip themselves.
 *
 * Mock-mode projects the legacy mockData.members array into the same
 * shape so the dev wizard stays exercisable end-to-end. Each mock
 * member gets a deterministic synthetic hex so seedMembers can carry
 * pubkey strings everywhere (matching the production publish path).
 *
 * CORS caveat: brainstorm.world's CORS posture for cross-origin reads
 * from communities.brainstorm.world hasn't been formally verified.
 * If a fetch fails, we resolve to empty rather than throw so the UI
 * gracefully shows "no results" instead of crashing. A console.warn
 * surfaces the cause for whoever's looking.
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

export async function searchProfilesByQuery(query, { limit = 12 } = {}) {
  const q = (query || '').trim()
  if (q.length === 0) return []

  if (USE_MOCK) {
    const lc = q.toLowerCase()
    return mockMembers
      .filter(m => m.name.toLowerCase().includes(lc))
      .slice(0, limit)
      .map(m => ({ pubkey: mockPubkey(m.id), profile: projectMockProfile(m) }))
  }

  try {
    const url = `${API_BASE}/api/search/profiles?searchType=kind0&searchString=${encodeURIComponent(q)}`
    const r = await fetch(url, { credentials: 'omit' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    if (!data || !data.success || !Array.isArray(data.pubkeys)) return []
    const top = data.pubkeys.slice(0, limit)
    const profiles = await fetchProfiles(top)
    return top
      .map(pk => ({ pubkey: pk, profile: profiles[pk] }))
      .filter(x => x.profile)
  } catch (err) {
    console.warn('[profiles] search failed:', err && err.message)
    return []
  }
}

export function getCachedProfile(pubkey) {
  return cache.get(pubkey) || null
}
