/*
 * Relay-side reads for kind-1 events scoped to a community.
 *
 * Mock-mode projects the existing `c.posts` arrays from mockData (shape
 * `{ author, text, time }`) into the new `Post` shape used by Slice 6
 * (`{ id, author, content, createdAt }`). The mockData arrays stay; only
 * the projection lives here so the call site never sees the legacy shape.
 *
 * Real-mode opens a one-shot subscription per relay (filter on
 * `kinds: [1]` and `'#a': [communityATag]`), collects events until EOSE
 * or a 5-second timeout, dedupes by event id, then sorts newest-first.
 *
 * Per ADR-0010 we don't keep a live subscription open; clients re-fetch
 * after a successful Send. Live updates are a v1.1 follow-up.
 */

import { Relay } from 'nostr-tools/relay'
import { DEFAULT_RELAYS } from './publish.js'
import { communities } from '../data/mockData.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'

const FETCH_TIMEOUT_MS = 5000

/**
 * Fetch NIP-22 kind-1111 comments for a community.
 *
 * Migrated from kind-1 — see build.js / buildCommunityPost for the
 * leakage rationale. Filter uses the uppercase `#A` capture so both
 * top-level posts and any future replies (which point lowercase a/k/p
 * at the parent comment but keep the same uppercase root) surface in
 * one conversation feed.
 *
 * @param {object} args
 * @param {string} args.communityATag  e.g. "39999:<curator>:<slug>"
 * @param {string} [args.slug]         used by mock projection only
 * @param {string[]} [args.relays]
 * @param {number} [args.timeout]
 * @returns {Promise<Post[]>}  Post = { id, author, content, createdAt }
 */
export async function fetchPostsForCommunity({
  communityATag,
  slug,
  relays = DEFAULT_RELAYS,
  timeout = FETCH_TIMEOUT_MS,
}) {
  if (!communityATag) throw new Error('fetchPostsForCommunity: communityATag is required')

  if (USE_MOCK) {
    return projectMockPosts(slug)
  }

  const filter = { kinds: [1111], '#A': [communityATag] }
  const events = new Map()
  await Promise.all(
    relays.map(url => collectFromRelay(url, filter, events, timeout)),
  )
  return Array.from(events.values())
    .map(projectRealEvent)
    .sort((a, b) => b.createdAt - a.createdAt)
}

async function collectFromRelay(url, filter, events, timeoutMs) {
  let relay
  try {
    relay = await Relay.connect(url)
  } catch (err) {
    console.warn(`[fetch] relay connect failed ${url}:`, (err && err.message) || err)
    return
  }
  return new Promise(resolve => {
    let resolved = false
    const done = () => {
      if (resolved) return
      resolved = true
      try { sub.close() } catch { /* ignore */ }
      try { relay.close() } catch { /* ignore */ }
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    const sub = relay.subscribe([filter], {
      onevent: (ev) => {
        if (ev && ev.id) events.set(ev.id, ev)
      },
      oneose: () => {
        clearTimeout(timer)
        done()
      },
      eoseTimeout: timeoutMs,
    })
  })
}

function projectRealEvent(ev) {
  return {
    id: ev.id,
    author: ev.pubkey,
    content: ev.content || '',
    createdAt: typeof ev.created_at === 'number' ? ev.created_at : 0,
  }
}

/**
 * Fetch a community-record (kind 39999) by slug, directly from the
 * relay. Used as a client-side fallback when the backend API's
 * loadCommunityRecord stub returns null — without this, the user's
 * just-published kind-39999 isn't visible until the backend's
 * strfry/Neo4j wiring lands (Slice 2 NB-4).
 *
 * Returns a normalized API-shaped community object, or null if no
 * matching event surfaced before EOSE/timeout.
 *
 * Disambiguation: kind-39999 has no hard dedup, so multiple curators
 * may publish with the same d-tag. When `preferredCurator` is given
 * (typically the viewer's pubkey right after Create), we pick that
 * one; otherwise we take the highest created_at.
 */
export async function fetchCommunityRecord({
  slug,
  preferredCurator = null,
  relays = DEFAULT_RELAYS,
  timeout = FETCH_TIMEOUT_MS,
}) {
  if (!slug) throw new Error('fetchCommunityRecord: slug is required')

  const filter = { kinds: [39999], '#d': [slug] }
  const events = new Map()
  await Promise.all(
    relays.map(url => collectFromRelay(url, filter, events, timeout)),
  )
  if (events.size === 0) return null

  const list = Array.from(events.values())
  let chosen = null
  if (preferredCurator) {
    chosen = list.find(e => e.pubkey === preferredCurator) || null
  }
  if (!chosen) {
    chosen = list.reduce((best, e) =>
      best && (e.created_at || 0) <= (best.created_at || 0) ? best : e, null)
  }
  return projectCommunityRecord(chosen)
}

/**
 * Fetch every community-record on the relay, regardless of curator.
 * Used as a discovery-side fallback so users see communities created
 * by other curators (the backend /api/communities list is still the
 * Slice 2 NB-4 stub returning []).
 *
 * Filters at the relay by kind only — strfry has no way to filter on
 * a partial tag suffix — and client-side narrows to events whose `z`
 * header points at `…:brainstorm-communities`. That excludes the
 * firmware's other kind-39999 events (supersets, node-types, etc.)
 * which use the same kind number but different schemas.
 */
export async function fetchAllCommunityRecords({
  relays = DEFAULT_RELAYS,
  timeout = FETCH_TIMEOUT_MS,
} = {}) {
  if (USE_MOCK) return []  // Discover already merges mock data via the API path
  const filter = { kinds: [39999] }
  const events = new Map()
  await Promise.all(
    relays.map(url => collectFromRelay(url, filter, events, timeout)),
  )
  const records = []
  for (const e of events.values()) {
    const zTag = e.tags.find(t => t[0] === 'z')
    if (!zTag || !zTag[1] || !zTag[1].endsWith(':brainstorm-communities')) continue
    const projected = projectCommunityRecord(e)
    if (projected) {
      projected._createdAt = e.created_at || 0
      records.push(projected)
    }
  }
  records.sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
  return records
}

/* ── Community Declarations (kind 39998 — the "right way" model, ADR 0029) ──
 * Read beside the bespoke kind-39999 records (strangler coexistence). Marked
 * by a `t = brainstorm-community` tag so we can filter them apart from the
 * bespoke DList header and other concept headers. */

const COMMUNITY_TYPE_MARKER = 'brainstorm-community'

export async function fetchCommunityDeclaration({
  slug,
  preferredFounder = null,
  relays = DEFAULT_RELAYS,
  timeout = FETCH_TIMEOUT_MS,
}) {
  if (!slug) throw new Error('fetchCommunityDeclaration: slug is required')
  const filter = { kinds: [39998], '#d': [slug], '#t': [COMMUNITY_TYPE_MARKER] }
  const events = new Map()
  await Promise.all(relays.map(url => collectFromRelay(url, filter, events, timeout)))
  if (events.size === 0) return null
  const list = Array.from(events.values())
  let chosen = preferredFounder ? list.find(e => e.pubkey === preferredFounder) : null
  if (!chosen) {
    chosen = list.reduce((best, e) =>
      best && (e.created_at || 0) <= (best.created_at || 0) ? best : e, null)
  }
  return projectDeclaration(chosen)
}

export async function fetchAllCommunityDeclarations({
  relays = DEFAULT_RELAYS,
  timeout = FETCH_TIMEOUT_MS,
} = {}) {
  if (USE_MOCK) return []
  const filter = { kinds: [39998], '#t': [COMMUNITY_TYPE_MARKER] }
  const events = new Map()
  await Promise.all(relays.map(url => collectFromRelay(url, filter, events, timeout)))
  const out = []
  for (const e of events.values()) {
    const p = projectDeclaration(e)
    if (p) { p._createdAt = e.created_at || 0; out.push(p) }
  }
  out.sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
  return out
}

function projectDeclaration(event) {
  if (!event || !Array.isArray(event.tags)) return null
  const one = key => { const t = event.tags.find(x => x[0] === key); return t && t[1] ? t[1] : null }
  const many = key => event.tags.filter(x => x[0] === key && x[1]).map(x => x[1])
  const bTag = event.tags.find(x => x[0] === 'b')
  const slug = one('d') || ''
  return {
    model: 'declaration',
    slug,
    name: one('name') || slug,
    description: one('description') || '',
    belongingBar: one('belonging') || '',
    tags: many('topic'),
    image: null,
    accent: null,
    language: null,
    memberCount: 0,
    trustedHere: 0,
    activity: null,
    members: [],
    joined: false,
    founder: one('founder') || event.pubkey,
    parent: bTag && bTag[1] ? bTag[1] : null,
    relays: DEFAULT_RELAYS,
    weightingModel: null,
    endorsementThreshold: null,
    nip72Wrapping: null,
    posts: [],
    _source: 'relay',
  }
}

function projectCommunityRecord(event) {
  if (!event || !Array.isArray(event.tags)) return null

  const tagsByKey = new Map()  // key → string[]  (multi-value)
  for (const t of event.tags) {
    if (!Array.isArray(t) || t.length < 2) continue
    const key = t[0]
    const value = t[1]
    if (!key || !value) continue
    if (!tagsByKey.has(key)) tagsByKey.set(key, [])
    tagsByKey.get(key).push(value)
  }
  const one = key => {
    const v = tagsByKey.get(key)
    return v && v.length > 0 ? v[0] : null
  }
  const many = key => tagsByKey.get(key) || []

  const slug = one('d') || ''
  const seedMembers = many('seed')
  const founder = one('founder') || event.pubkey
  const threshold = parseFloat(one('endorsement_threshold'))

  return {
    slug,
    name: one('name') || slug,
    description: one('description') || '',
    tags: many('topic'),
    image: one('image'),
    accent: null,
    language: one('language'),
    // Placeholder counts — real numbers come from the backend when
    // GR-Community scoring + member resolution wire up. Seed members
    // give us at least a floor.
    memberCount: seedMembers.length,
    trustedHere: 0,
    activity: null,
    members: [],
    joined: false,  // caller layers viewer-specific membership on top
    founder,
    relays: many('relay'),
    weightingModel: one('weighting_model') || 'gr-community-default-v1',
    endorsementThreshold: Number.isFinite(threshold) ? threshold : 0.5,
    nip72Wrapping: one('a'),
    posts: [],
    _source: 'relay',
  }
}

function projectMockPosts(slug) {
  const c = communities.find(x => x.slug === slug)
  if (!c || !Array.isArray(c.posts)) return []
  // The mock array is hand-ordered newest-first; preserve that order by
  // assigning descending synthetic createdAt values.
  const now = Math.floor(Date.now() / 1000)
  return c.posts.map((p, i) => ({
    id: `mock-${slug}-${i}`,
    author: p.author,
    content: p.text || p.content || '',
    createdAt: now - i * 3600,
    _mockTime: p.time,
  }))
}
