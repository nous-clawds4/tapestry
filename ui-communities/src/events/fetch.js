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
 * Fetch kind-1 posts for a community.
 *
 * @param {object} args
 * @param {string} args.communityATag  e.g. "39999:<curator>:<slug>"
 * @param {string} [args.slug]         used by mock projection only
 * @param {string[]} [args.relays]
 * @param {number} [args.timeout]
 * @returns {Promise<Post[]>}  Post = { id, author, content, createdAt }
 */
export async function fetchKind1ForCommunity({
  communityATag,
  slug,
  relays = DEFAULT_RELAYS,
  timeout = FETCH_TIMEOUT_MS,
}) {
  if (!communityATag) throw new Error('fetchKind1ForCommunity: communityATag is required')

  if (USE_MOCK) {
    return projectMockPosts(slug)
  }

  const filter = { kinds: [1], '#a': [communityATag] }
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
