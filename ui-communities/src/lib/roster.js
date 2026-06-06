/*
 * Live roster client (Story 45 data layer; ADR 0030 + ADR 0031).
 *
 * The production roster path (app-as-consumer): resolve each tag-element a circle
 * CLAIMS to its current event id, ask brainstorm.world's read engine for the
 * WoT-gated per-target apply/dispute counts, union across claimed tags, then
 * apply the shared membership gate (`isMember`). The server owns the WoT/Meili
 * scoring; we never re-run trust math here.
 *
 *   GET ${VITE_PROFILE_API_BASE}/api/profile-tags/profiles-tagged
 *       ?tagEventId=<id>&wotPov=house
 *   → { rows: [{ pubkey, applications, disputes, displayName, picture, ... }],
 *       viewerAssertions: { <pubkey>: 'applied'|'disputed' } }
 *
 * v1 surfaces MEMBERS only. The count primitive collapses self-application, so
 * "applicant" (self-tagged-below-threshold) isn't derivable from it — that needs
 * a per-row `selfApplied` flag on the endpoint (a Vinney ask). The offline
 * `deriveRoster` still computes applicants from raw tags for the test oracle.
 *
 * Network seams are injected (`resolveEventId`, `fetchCounts`) so the
 * orchestration is unit-testable without a relay or HTTP, mirroring how
 * `deriveRoster` injects `wotScore`. The real defaults are below.
 */

import { isMember } from './membership.js'
import { Relay } from 'nostr-tools/relay'
import { DEFAULT_RELAYS } from '../events/publish.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'
const API_BASE = (import.meta.env.VITE_PROFILE_API_BASE || '').replace(/\/$/, '')
const FETCH_TIMEOUT_MS = 5000

/** Parse a claimed tag-element coord `39999:<author>:<slug>`. */
export function parseClaimCoord(coord) {
  if (typeof coord !== 'string') return null
  const m = coord.match(/^39999:([0-9a-f]{64}):(.+)$/)
  return m ? { author: m[1], slug: m[2] } : null
}

/**
 * Union per-target rows across several claimed tag-elements: a person is a
 * candidate via ANY claimed tag, so sum applications/disputes per pubkey and
 * keep the first non-empty profile fields seen.
 */
export function mergeRows(rowSets) {
  const byPubkey = new Map()
  for (const rows of rowSets || []) {
    for (const r of rows || []) {
      if (!r || !r.pubkey) continue
      const e = byPubkey.get(r.pubkey) || {
        pubkey: r.pubkey, applications: 0, disputes: 0,
        displayName: null, picture: null, nip05: null,
      }
      e.applications += r.applications || 0
      e.disputes += r.disputes || 0
      e.displayName = e.displayName || r.displayName || null
      e.picture = e.picture || r.picture || null
      e.nip05 = e.nip05 || r.nip05 || null
      byPubkey.set(r.pubkey, e)
    }
  }
  return Array.from(byPubkey.values())
}

/**
 * Apply the membership gate to merged server count-rows. Pure.
 * @returns {{ members: Array }}
 */
export function rosterFromCounts(rows, { threshold } = {}) {
  const members = (rows || []).filter(r => isMember(r.applications || 0, r.disputes || 0, threshold))
  members.sort((a, b) =>
    (b.applications - a.applications)
    || (a.disputes - b.disputes)
    || String(a.pubkey).localeCompare(String(b.pubkey)))
  return { members }
}

/**
 * Resolve a claimed coord to its current tag-element event id by fetching the
 * newest kind-39999 with that author + d-tag. (The read engine scans `#e`
 * today; we pass the event id. Swap to `#a` when the server generalizes.)
 */
async function defaultResolveEventId(coord, { relays = DEFAULT_RELAYS, timeout = FETCH_TIMEOUT_MS } = {}) {
  const parsed = parseClaimCoord(coord)
  if (!parsed) return null
  const filter = { kinds: [39999], authors: [parsed.author], '#d': [parsed.slug] }
  const events = new Map()
  await Promise.all(relays.map(url => collectFromRelay(url, filter, events, timeout)))
  if (events.size === 0) return null
  let newest = null
  for (const ev of events.values()) {
    if (!newest || (ev.created_at || 0) > (newest.created_at || 0)) newest = ev
  }
  return newest ? newest.id : null
}

async function collectFromRelay(url, filter, events, timeoutMs) {
  let relay
  try { relay = await Relay.connect(url) } catch { return }
  return new Promise(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      try { sub.close() } catch { /* ignore */ }
      try { relay.close() } catch { /* ignore */ }
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    const sub = relay.subscribe([filter], {
      onevent: ev => { if (ev && ev.id) events.set(ev.id, ev) },
      oneose: () => { clearTimeout(timer); finish() },
      eoseTimeout: timeoutMs,
    })
  })
}

/**
 * Resolve a claimed coord to a tag-element descriptor `{ eventId, aCoord, slug }`
 * for the assertion writer (which needs the current event id + the stable coord).
 * Returns null if the coord is malformed or no element is on the relay yet.
 */
export async function resolveTagElement(coord, opts = {}) {
  const parsed = parseClaimCoord(coord)
  if (!parsed) return null
  const resolve = opts.resolveEventId || defaultResolveEventId
  const eventId = await resolve(coord)
  return eventId ? { eventId, aCoord: coord, slug: parsed.slug } : null
}

/**
 * Fetch WoT-gated counts for one tag-element from the read engine (cross-origin).
 * `ok` distinguishes a real failure (CORS/network/server) from a genuinely empty
 * tag, so getRoster can surface "trust network unreachable" vs "no members yet".
 */
async function defaultFetchCounts(tagEventId, wotPov = 'house') {
  const url = `${API_BASE}/api/profile-tags/profiles-tagged?tagEventId=${encodeURIComponent(tagEventId)}&wotPov=${encodeURIComponent(wotPov)}`
  try {
    const resp = await fetch(url)
    if (!resp.ok) return { rows: [], viewerAssertions: {}, ok: false }
    const body = await resp.json()
    if (!body || body.success === false) return { rows: [], viewerAssertions: {}, ok: false }
    return { rows: body.rows || [], viewerAssertions: body.viewerAssertions || {}, ok: true }
  } catch (err) {
    // Graceful — same posture as lib/profiles.js (CORS/network failures show an
    // empty roster rather than crashing the People tab), but flagged degraded.
    console.warn('[roster] profiles-tagged failed:', (err && err.message) || err)
    return { rows: [], viewerAssertions: {}, ok: false }
  }
}

/**
 * Derive a circle's live member roster from the resolved PoV (house in v1).
 *
 * @param {object} circle                 has `.claims` (tag-element coords) + optional `.membershipThreshold`
 * @param {object} [opts]
 * @param {number} [opts.threshold]       overrides circle.membershipThreshold (default 1)
 * @param {string} [opts.wotPov='house']
 * @param {(coord:string)=>Promise<string|null>} [opts.resolveEventId]  injectable seam
 * @param {(eventId:string, wotPov:string)=>Promise<{rows,viewerAssertions}>} [opts.fetchCounts]  injectable seam
 * @returns {Promise<{ members: Array, viewerAssertions: object }>}
 */
export async function getRoster(circle, opts = {}) {
  const {
    wotPov = 'house',
    resolveEventId = defaultResolveEventId,
    fetchCounts = defaultFetchCounts,
  } = opts
  const threshold = opts.threshold != null
    ? opts.threshold
    : (circle && circle.membershipThreshold != null ? circle.membershipThreshold : undefined)

  if (USE_MOCK) return { members: [], viewerAssertions: {}, degraded: false }

  const claims = (circle && Array.isArray(circle.claims)) ? circle.claims : []
  const rowSets = []
  const viewerAssertions = {}
  let degraded = false
  for (const coord of claims) {
    const eventId = await resolveEventId(coord)
    if (!eventId) continue
    const res = await fetchCounts(eventId, wotPov)
    if (res && res.ok === false) degraded = true
    rowSets.push((res && res.rows) || [])
    Object.assign(viewerAssertions, (res && res.viewerAssertions) || {})
  }

  const { members } = rosterFromCounts(mergeRows(rowSets), { threshold })
  return { members, viewerAssertions, degraded }
}
