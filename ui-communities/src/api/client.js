/*
 * Communities API client.
 *
 * One module owns the mock-vs-real mode decision (per ADR 0007). The mode is
 * a strict `=== 'true'` check on import.meta.env.VITE_USE_MOCK_DATA — Vite
 * exposes env vars as strings, so a `!!` check would treat the literal "false"
 * as truthy and enable mock mode in production. Don't trust the boolean
 * coercion; pin the comparison.
 *
 * Mock projections derive from src/data/mockData.js and match the real API's
 * response shape exactly, so page components are oblivious to which mode the
 * client is in.
 *
 * Production builds with VITE_USE_MOCK_DATA=false tree-shake the mock branch
 * away — verified by absence of "The Listening Room" string in the built
 * bundle (manual check in the test plan).
 */

import {
  communities as MOCK_COMMUNITIES,
  members as MOCK_MEMBERS,
  getCommunity as mockGetCommunity,
  getCommunityMembers as mockGetCommunityMembers,
  getVoucherNames as mockGetVoucherNames,
} from '../data/mockData.js'
import { fetchCommunityRecord } from '../events/fetch.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'

/* ────────────────────────────────────────────────────────────
 * Mock-mode projections — shape mirrors the real API responses.
 * ──────────────────────────────────────────────────────────── */

function projectListEntry(c, viewer) {
  return {
    slug: c.slug,
    name: c.name,
    description: c.description,
    tags: Array.isArray(c.tags) ? c.tags : [],
    image: c.image || null,
    accent: c.accent || null,
    language: c.language || null,
    memberCount: typeof c.memberCount === 'number' ? c.memberCount : (c.members ? c.members.length : 0),
    trustedHere: typeof c.trustedHere === 'number' ? c.trustedHere : 0,
    activity: c.activity || null,
    members: Array.isArray(c.members) ? c.members.slice(0, 4) : [],
    joined: viewer ? Array.isArray(c.members) && c.members.includes(viewer) : false,
  }
}

function projectDetailEntry(c, viewer) {
  const base = projectListEntry(c, viewer)
  return {
    ...base,
    founder: c.founder || null,
    relays: Array.isArray(c.relays) ? c.relays : [],
    weightingModel: c.weightingModel || 'gr-community-default-v1',
    endorsementThreshold: typeof c.endorsementThreshold === 'number' ? c.endorsementThreshold : 0.5,
    nip72Wrapping: c.nip72Wrapping || null,
    // Mock posts surface as-is from the dataset; Slice 6 wires real kind-1.
    posts: Array.isArray(c.posts) ? c.posts : [],
  }
}

function projectMockMemberEntries(slug) {
  const members = mockGetCommunityMembers(slug)
  return members.map(m => ({
    // API-emitted fields (mirror the real /api/communities/:slug/members shape)
    pubkey: m.id,
    score: typeof m.trust === 'number' ? m.trust : 0,
    isMember: true,
    vouchedBy: typeof m.vouchedBy === 'number' ? m.vouchedBy : 0,
    voucherNames: mockGetVoucherNames(m.id, slug),
    // Legacy mock fields preserved so existing components (MemberRow,
    // MemberDrawerContent, Avatar) work unchanged in mock mode. Real mode
    // currently emits API fields only; name resolution lands in a future
    // story per Slice 2 NB-1 / Slice 3 inline note.
    id: m.id,
    name: m.name,
    handle: m.handle,
    trust: typeof m.trust === 'number' ? m.trust : 0,
  }))
}

/* ────────────────────────────────────────────────────────────
 * Real-mode HTTP helpers.
 * ──────────────────────────────────────────────────────────── */

const NOT_FOUND = { _notFound: true }

async function realGet(pathname) {
  const resp = await fetch(pathname, { credentials: 'same-origin' })
  if (resp.status === 404) return NOT_FOUND
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText || ''}`.trim())
  }
  return resp.json()
}

function buildQuery(viewer) {
  return viewer ? `?viewer=${encodeURIComponent(viewer)}` : ''
}

/* ────────────────────────────────────────────────────────────
 * Real-mode implementations.
 * ──────────────────────────────────────────────────────────── */

async function realGetCommunities(viewer) {
  const body = await realGet(`/api/communities${buildQuery(viewer)}`)
  return body && Array.isArray(body.communities) ? body.communities : []
}

async function realGetCommunity(slug, viewer) {
  const body = await realGet(`/api/communities/${encodeURIComponent(slug)}${buildQuery(viewer)}`)
  // _notFound sentinel from a 404 response — resolve to null per ADR-0007.
  const apiCommunity = body && !body._notFound && body.community ? body.community : null
  if (apiCommunity) return apiCommunity

  // Client-side relay fallback. The Slice 2 NB-4 dataSources stub
  // returns null until backend strfry/Neo4j wiring lands, which means
  // a freshly-published kind-39999 isn't visible via the API. Pull it
  // back from the relay directly so the just-created circle (and any
  // other slug a viewer types in) actually renders.
  const relayRecord = await fetchCommunityRecord({ slug, preferredCurator: viewer })
  if (!relayRecord) return null
  return {
    ...relayRecord,
    // Seed-member-includes-viewer is the right proxy for "joined" until
    // the GR-Community membership read lands. Founder is always a seed.
    joined: viewer ? relayRecord.founder === viewer : false,
  }
}

async function realGetCommunityMembers(slug, viewer) {
  const body = await realGet(`/api/communities/${encodeURIComponent(slug)}/members${buildQuery(viewer)}`)
  if (body === NOT_FOUND) return []
  return body && Array.isArray(body.members) ? body.members : []
}

/* ────────────────────────────────────────────────────────────
 * Mock-mode implementations.
 * ──────────────────────────────────────────────────────────── */

async function mockListCommunities(viewer) {
  return MOCK_COMMUNITIES.map(c => projectListEntry(c, viewer))
}

async function mockReadCommunity(slug, viewer) {
  const c = mockGetCommunity(slug)
  return c ? projectDetailEntry(c, viewer) : null
}

async function mockReadCommunityMembers(slug /* , viewer */) {
  const c = mockGetCommunity(slug)
  if (!c) return []
  return projectMockMemberEntries(slug)
}

/* ────────────────────────────────────────────────────────────
 * Selected export.
 *
 * The branch happens once at module load. Production builds with
 * VITE_USE_MOCK_DATA=false tree-shake the mock branch out of the bundle.
 * ──────────────────────────────────────────────────────────── */

const impl = USE_MOCK
  ? {
      getCommunities: mockListCommunities,
      getCommunity: mockReadCommunity,
      getCommunityMembers: mockReadCommunityMembers,
    }
  : {
      getCommunities: realGetCommunities,
      getCommunity: realGetCommunity,
      getCommunityMembers: realGetCommunityMembers,
    }

export const getCommunities = impl.getCommunities
export const getCommunity = impl.getCommunity
export const getCommunityMembers = impl.getCommunityMembers
export const IS_MOCK_MODE = USE_MOCK

/**
 * Hydrate a set of slugs into their full community shape. Uses
 * getCommunity per slug (which has the relay fallback for real mode
 * and mock projection for dev mode), filters nulls, and returns the
 * results as list-entry-shaped objects.
 *
 * Used by MyCircles (joined-only listing) and Discover (to merge the
 * viewer's own circles into a backend list that may be empty until
 * Slice 2 NB-4 wires the data sources).
 */
export async function getJoinedCommunitySummaries(slugs, viewer) {
  if (!Array.isArray(slugs) || slugs.length === 0) return []
  const results = await Promise.all(
    slugs.map(slug => getCommunity(slug, viewer).catch(() => null)),
  )
  return results.filter(Boolean).map(c => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    tags: Array.isArray(c.tags) ? c.tags : [],
    image: c.image || null,
    accent: c.accent || null,
    language: c.language || null,
    memberCount: typeof c.memberCount === 'number' ? c.memberCount : 0,
    trustedHere: typeof c.trustedHere === 'number' ? c.trustedHere : 0,
    activity: c.activity || null,
    members: Array.isArray(c.members) ? c.members : [],
    joined: true,
  }))
}
// silence eslint for the import we keep for the mock-mode branch
void MOCK_MEMBERS
