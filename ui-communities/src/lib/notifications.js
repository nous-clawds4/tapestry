/**
 * Notifications (ADR-0038) — derived, preference-gated, in-app only.
 *
 * The pure core (buildNotifications / hasNew / notificationSentence) carries the
 * sovereignty rules: off occasions never appear, the viewer's own events never
 * notify, a reply-in-your-circle counts once (as a reply). Fetch + last-seen are
 * thin I/O around it. Notifications are derived from existing events — not stored.
 */
import { DEFAULT_RELAYS } from '../events/publish.js'
import { collectFromRelay, USE_MOCK, FETCH_TIMEOUT_MS } from '../events/fetch.js'

// Pure. Build the viewer's notification list from projected event arrays, gated
// by preferences, excluding the viewer's own events, deduped by id (reply wins
// over new-post), newest-first.
export function buildNotifications({ vouches = [], replies = [], circlePosts = [], viewer, prefs = {}, circleIndex }) {
  const MAX_ITEMS = 50   // inlined so the function evaluates standalone in tests
  const idx = circleIndex && typeof circleIndex.get === 'function' ? circleIndex : new Map()
  const items = []
  const seen = new Set()
  const push = it => { if (it && it.id && !seen.has(it.id)) { seen.add(it.id); items.push(it) } }

  if (prefs.vouched) {
    for (const v of vouches) {
      if (!v || v.actor === viewer || v.target !== viewer) continue
      push({ id: v.id, occasion: 'vouched', actor: v.actor, circle: null, sourceSlug: null, createdAt: v.createdAt || 0 })
    }
  }
  // Replies before new-posts so a reply that is also a circle post dedups to reply.
  if (prefs.replies) {
    for (const r of replies) {
      if (!r || r.actor === viewer) continue
      const c = idx.get(r.aTag)
      push({ id: r.id, occasion: 'reply', actor: r.actor, circle: c ? c.name : null, sourceSlug: c ? c.slug : null, createdAt: r.createdAt || 0 })
    }
  }
  if (prefs['new-posts']) {
    for (const p of circlePosts) {
      if (!p || p.actor === viewer) continue
      const c = idx.get(p.aTag)
      push({ id: p.id, occasion: 'new-post', actor: p.actor, circle: c ? c.name : null, sourceSlug: c ? c.slug : null, createdAt: p.createdAt || 0 })
    }
  }

  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return items.slice(0, MAX_ITEMS)
}

// Pure. Is anything newer than the last time the inbox was opened?
export function hasNew(items, lastSeen) {
  const seen = lastSeen || 0
  return (items || []).some(i => (i.createdAt || 0) > seen)
}

// Pure. One plain sentence per occasion (circle omitted when absent).
export function notificationSentence(item, displayName) {
  const who = displayName || 'Someone'
  if (!item) return ''
  if (item.occasion === 'vouched') return `${who} vouched for you`
  if (item.occasion === 'reply') return item.circle ? `${who} replied to you in ${item.circle}` : `${who} replied to you`
  if (item.occasion === 'new-post') return item.circle ? `New posts in ${item.circle}` : 'New posts in a circle you’re in'
  return ''
}

// ── device-local last-seen marker (mirrors notificationPrefs storage) ──
function lastSeenKey(pubkey) { return `communities:notif-seen:${pubkey || 'anon'}` }

export function getLastSeen(pubkey) {
  try { return Number(localStorage.getItem(lastSeenKey(pubkey))) || 0 } catch { return 0 }
}

export function markSeen(pubkey) {
  try { localStorage.setItem(lastSeenKey(pubkey), String(Math.floor(Date.now() / 1000))) } catch { /* ignore */ }
}

// ── source fetch (relay; one query per occasion) ──
export async function fetchNotificationSources({ viewer, joinedATags = [], relays = DEFAULT_RELAYS, timeout = FETCH_TIMEOUT_MS }) {
  if (!viewer || USE_MOCK) return { vouches: [], replies: [], circlePosts: [] }

  const vEvents = new Map(), rEvents = new Map(), cEvents = new Map()
  const collect = (filter, store) => Promise.all(relays.map(url => collectFromRelay(url, filter, store, timeout)))
  await Promise.all([
    collect({ kinds: [39999], '#p': [viewer], limit: 100 }, vEvents),
    collect({ kinds: [1111], '#p': [viewer], limit: 100 }, rEvents),
    joinedATags.length ? collect({ kinds: [1111], '#A': joinedATags, limit: 200 }, cEvents) : Promise.resolve(),
  ])

  const tag = (ev, k) => (Array.isArray(ev.tags) ? ev.tags.find(t => t[0] === k) : null)
  const aOf = ev => { const t = tag(ev, 'A'); return t && t[1] ? t[1] : null }

  const vouches = Array.from(vEvents.values())
    .filter(ev => {
      const z = tag(ev, 'z'); const pol = tag(ev, 'polarity')
      return z && /nostr-user-tag/.test(z[1] || '') && pol && pol[1] === '1'
    })
    .map(ev => ({ id: ev.id, actor: ev.pubkey, target: (tag(ev, 'p') || [])[1] || null, createdAt: ev.created_at || 0 }))

  const replies = Array.from(rEvents.values())
    .filter(ev => !!tag(ev, 'e'))   // a reply carries the lowercase parent e-tag
    .map(ev => ({ id: ev.id, actor: ev.pubkey, aTag: aOf(ev), createdAt: ev.created_at || 0 }))

  const circlePosts = Array.from(cEvents.values())
    .map(ev => ({ id: ev.id, actor: ev.pubkey, aTag: aOf(ev), createdAt: ev.created_at || 0 }))

  return { vouches, replies, circlePosts }
}
