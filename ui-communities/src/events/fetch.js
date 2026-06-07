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

export const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'

export const FETCH_TIMEOUT_MS = 5000

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

export async function collectFromRelay(url, filter, events, timeoutMs) {
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
  // The lowercase `e` tag points at the parent comment for a reply (ADR-0033);
  // top-level posts have no `e` (their parent is the community `a`), so null.
  const eTag = Array.isArray(ev.tags) ? ev.tags.find(t => t[0] === 'e') : null
  return {
    id: ev.id,
    author: ev.pubkey,
    content: ev.content || '',
    createdAt: typeof ev.created_at === 'number' ? ev.created_at : 0,
    parentId: (eTag && eTag[1]) || null,
  }
}

/**
 * Fetch NIP-25 kind-7 reactions for a community (ADR-0034). Scoped by the
 * uppercase `#A` community tag, same posture as posts. Returns projected
 * reactions { targetId, reactor, content, createdAt }; aggregation is done by
 * `lib/reactions.js#summarizeReactions`.
 */
export async function fetchReactionsForCommunity({
  communityATag,
  relays = DEFAULT_RELAYS,
  timeout = FETCH_TIMEOUT_MS,
}) {
  if (!communityATag) throw new Error('fetchReactionsForCommunity: communityATag is required')
  if (USE_MOCK) return []

  const filter = { kinds: [7], '#A': [communityATag] }
  const events = new Map()
  await Promise.all(
    relays.map(url => collectFromRelay(url, filter, events, timeout)),
  )
  return Array.from(events.values()).map(projectReaction).filter(Boolean)
}

/**
 * Fetch foothold invites a member has issued for a circle (ADR-0039). kind-39999
 * by author + `#a`, filtered to the foothold-invite `z` marker. Returns
 * { code, createdAt, id } newest-first.
 */
export async function fetchFootholdInvites({ communityATag, issuer, relays = DEFAULT_RELAYS, timeout = FETCH_TIMEOUT_MS }) {
  if (!communityATag || !issuer || USE_MOCK) return []
  const filter = { kinds: [39999], '#a': [communityATag], authors: [issuer] }
  const events = new Map()
  await Promise.all(
    relays.map(url => collectFromRelay(url, filter, events, timeout)),
  )
  const out = []
  for (const ev of events.values()) {
    const z = (Array.isArray(ev.tags) ? (ev.tags.find(t => t[0] === 'z') || []) : [])[1] || ''
    if (!z.endsWith(':foothold-invite')) continue
    const d = (ev.tags.find(t => t[0] === 'd') || [])[1] || ''
    out.push({ code: d.startsWith('invite-') ? d.slice('invite-'.length) : d, createdAt: ev.created_at || 0, id: ev.id })
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Resolve a single foothold invite by its code (ADR-0040). Returns the issuer +
 * circle coordinate so the accept page can show who invited and which circle,
 * or null if unresolvable/expired.
 */
export async function fetchFootholdInvite({ code, relays = DEFAULT_RELAYS, timeout = FETCH_TIMEOUT_MS }) {
  if (!code || USE_MOCK) return null
  const filter = { kinds: [39999], '#d': [`invite-${code}`] }
  const events = new Map()
  await Promise.all(relays.map(url => collectFromRelay(url, filter, events, timeout)))
  for (const ev of events.values()) {
    const z = (Array.isArray(ev.tags) ? (ev.tags.find(t => t[0] === 'z') || []) : [])[1] || ''
    if (!z.endsWith(':foothold-invite')) continue
    return {
      issuer: (ev.tags.find(t => t[0] === 'p') || [])[1] || ev.pubkey,
      communityATag: (ev.tags.find(t => t[0] === 'a') || [])[1] || null,
      id: ev.id,
      createdAt: ev.created_at || 0,
    }
  }
  return null
}

/**
 * Fetch redemptions of an issuer's invites for a circle (ADR-0040). The issuer
 * fulfills the carried vouch for each. Returns { code, recipient, createdAt }.
 */
export async function fetchRedemptions({ issuer, communityATag, relays = DEFAULT_RELAYS, timeout = FETCH_TIMEOUT_MS }) {
  if (!issuer || !communityATag || USE_MOCK) return []
  const filter = { kinds: [39999], '#p': [issuer], '#a': [communityATag] }
  const events = new Map()
  await Promise.all(relays.map(url => collectFromRelay(url, filter, events, timeout)))
  const out = []
  for (const ev of events.values()) {
    const z = (Array.isArray(ev.tags) ? (ev.tags.find(t => t[0] === 'z') || []) : [])[1] || ''
    if (!z.endsWith(':foothold-redemption')) continue
    const d = (ev.tags.find(t => t[0] === 'd') || [])[1] || ''
    out.push({ code: d.startsWith('redeem-') ? d.slice('redeem-'.length) : d, recipient: ev.pubkey, createdAt: ev.created_at || 0 })
  }
  return out
}

function projectReaction(ev) {
  const eTag = Array.isArray(ev.tags) ? ev.tags.find(t => t[0] === 'e') : null
  if (!eTag || !eTag[1]) return null
  return {
    targetId: eTag[1],
    reactor: ev.pubkey,
    content: ev.content || '',
    createdAt: typeof ev.created_at === 'number' ? ev.created_at : 0,
  }
}

/**
 * Batched "signs of life" fetch (ADR-0036). One query for recent kind-1111
 * posts across many circles (by their uppercase `#A` coordinates), bucketed
 * per circle into post-time arrays. The discovery grid calls this once for all
 * cards (not N times); the detail calls it with a single coordinate.
 * Returns Map<aTag, number[]> of post created_at values.
 */
export async function fetchActivityForCircles({ aTags, relays = DEFAULT_RELAYS, timeout = FETCH_TIMEOUT_MS }) {
  const tags = Array.isArray(aTags) ? aTags.filter(Boolean) : []
  const map = new Map()
  if (!tags.length || USE_MOCK) return map

  const filter = { kinds: [1111], '#A': tags, limit: 300 }
  const events = new Map()
  await Promise.all(
    relays.map(url => collectFromRelay(url, filter, events, timeout)),
  )
  for (const ev of events.values()) {
    const aTag = Array.isArray(ev.tags) ? ev.tags.find(t => t[0] === 'A') : null
    const key = aTag && aTag[1]
    if (!key) continue
    const arr = map.get(key) || []
    arr.push(typeof ev.created_at === 'number' ? ev.created_at : 0)
    map.set(key, arr)
  }
  return map
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
  // Dev safety: the client selects mock impls, but direct callers (the
  // /found fork path, the CommunityDetail resolve effect) reach this fn
  // straight. Without this guard, dev/mock mode would open a live relay.
  if (USE_MOCK) return null
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
  // FENCE (multi-parent deferred): we read only the FIRST `b` tag into a
  // singular `parent`. The §26 resolver supports multi-parent (`parents` +
  // first-listed-wins), but until multi-parent fork ships — and the resolver's
  // shared-visited diamond bug is fixed (see resolveDefinition.js) — we keep
  // single-parent. To enable: parse ALL `b` tags into `parents`.
  const bTag = event.tags.find(x => x[0] === 'b')
  const slug = one('d') || ''
  return {
    model: 'declaration',
    slug,
    name: one('name') || slug,
    description: one('description') || '',
    belongingBar: one('belonging') || '',
    // Membership (ADR 0030): claimed concept(s) + the trust bar. Reported as
    // stated — an absent threshold/cutoff is `null`, not a default, so the §26
    // resolver can inherit a parent's value. The final fallback (cutoff 0.5,
    // threshold 1) lives in the consumer (deriveRoster), not here, so defaults
    // aren't applied twice and never masquerade as a stated value.
    claims: many('claims'),
    membershipThreshold: Number.isFinite(parseFloat(one('membership_threshold'))) ? parseFloat(one('membership_threshold')) : null,
    influenceCutoff: Number.isFinite(parseFloat(one('influence_cutoff'))) ? parseFloat(one('influence_cutoff')) : null,
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
