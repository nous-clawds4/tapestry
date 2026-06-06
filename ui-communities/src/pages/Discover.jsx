import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import TagPill from '../components/TagPill.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import BrainstormMark from '../components/BrainstormMark.jsx'
import CardSkeleton from '../components/CardSkeleton.jsx'
import FetchError from '../components/FetchError.jsx'
import {
  getCommunities,
  getDiscoverableCommunitiesFromRelay,
  getJoinedCommunitySummaries,
} from '../api/client.js'
import { tags } from '../data/mockData.js'
import { fetchActivityForCircles } from '../events/fetch.js'
import { circleATag } from '../lib/circle.js'
import { describeActivity } from '../lib/activity.js'
import s from './Discover.module.css'

const SKELETON_COUNT = 8

export default function Discover() {
  const { viewer, joinedSet } = useOutletContext()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const [state, setState] = useState({ status: 'loading', communities: [], error: null })
  // Signs of life (ADR-0036): one batched activity fetch keyed per circle's
  // coordinate, plus the fetch-time `now` used to describe recency in render.
  const [activity, setActivity] = useState({ map: new Map(), now: 0 })

  // Snapshot joinedSet for the dep array — Set identity flips on every
  // mutation but we only want to refetch when the contents change.
  const joinedKey = Array.from(joinedSet).sort().join(',')

  useEffect(() => {
    let cancelled = false
    // Reset to loading on every fetch (initial mount + retry + viewer
    // change). The React 19 set-state-in-effect rule flags the idiomatic
    // data-fetch pattern; a Suspense + use() rework is out of scope.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading', communities: [], error: null })

    // Three data sources merged in priority order:
    //   1. API list (authoritative when backend wiring lands — Slice 2 NB-4)
    //   2. Joined-circle hydration (the viewer's own joins/creates)
    //   3. Relay-wide community-record discovery (other curators' circles)
    // Dedupe by slug; earlier sources win on collision.
    Promise.all([
      getCommunities(viewer),
      getJoinedCommunitySummaries(Array.from(joinedSet), viewer),
      getDiscoverableCommunitiesFromRelay(viewer),
    ])
      .then(([apiList, joinedExtras, relayList]) => {
        if (cancelled) return
        const seen = new Set()
        const merged = []
        for (const source of [apiList || [], joinedExtras, relayList]) {
          for (const c of source) {
            if (!c || !c.slug || seen.has(c.slug)) continue
            seen.add(c.slug)
            merged.push(c)
          }
        }
        setState({ status: 'ready', communities: merged, error: null })

        // One batched signs-of-life fetch for the whole grid (not N per card).
        // A failure is non-fatal — cards render, lines just fall back/omit.
        const aTags = merged.map(c => circleATag(c)).filter(Boolean)
        fetchActivityForCircles({ aTags })
          .then(map => { if (!cancelled) setActivity({ map, now: Math.floor(Date.now() / 1000) }) })
          .catch(() => { if (!cancelled) setActivity({ map: new Map(), now: 0 }) })
      })
      .catch(error => {
        if (cancelled) return
        console.error('[Discover] getCommunities failed:', error)
        setState({ status: 'error', communities: [], error })
      })
    return () => {
      cancelled = true
    }
    // joinedSet is captured via the joinedKey string snapshot — the
    // Set identity flips on every mutation, so it can't be a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, retryNonce, joinedKey])

  const triggerRetry = useCallback(() => setRetryNonce(n => n + 1), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.communities.filter(c => {
      const matchTag = !activeTag || (Array.isArray(c.tags) && c.tags.includes(activeTag))
      if (!matchTag) return false
      if (!q) return true
      if ((c.name || '').toLowerCase().includes(q)) return true
      if ((c.description || '').toLowerCase().includes(q)) return true
      return (c.tags || []).some(t => {
        const tag = tags.find(x => x.id === t)
        return tag && tag.label.toLowerCase().includes(q)
      })
    })
  }, [query, activeTag, state.communities])

  return (
    <div className={s.page}>
      <section className={s.hero}>
        <BrainstormMark variant="mark" size={56} className={s.heroMark} />
        <h1 className={s.heading}>
          Find <em>your</em> people
        </h1>
        <p className={s.lede}>
          Circles built on trust. The people inside each one decide who belongs.
        </p>
        <div className={s.searchWrap}>
          <SearchBar value={query} onChange={setQuery} />
        </div>
      </section>

      <nav className={s.filterRow} aria-label="Topic filters">
        <TagPill tag={{ id: null, label: 'All' }} active={!activeTag} onClick={() => setActiveTag(null)} />
        {tags.map(t => (
          <TagPill
            key={t.id}
            tag={t}
            active={activeTag === t.id}
            onClick={id => setActiveTag(activeTag === id ? null : id)}
          />
        ))}
      </nav>

      <section className={s.grid} aria-label="Community results">
        {state.status === 'loading' && (
          Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <CardSkeleton key={`skel-${i}`} delay={i * 35} />
          ))
        )}

        {state.status === 'error' && (
          <FetchError onRetry={triggerRetry} />
        )}

        {state.status === 'ready' && filtered.map((c, i) => (
          <CommunityCard
            key={c.slug}
            community={c}
            joined={joinedSet.has(c.slug)}
            index={i}
            activityLine={describeActivity({
              postTimes: activity.map.get(circleATag(c)) || [],
              foundedAt: c._createdAt || null,
              now: activity.now || null,
            })}
          />
        ))}

        {state.status === 'ready' && filtered.length === 0 && (
          <div className={s.empty}>
            <BrainstormMark variant="mark" size={64} className={s.emptyMark} />
            <p className={s.emptyTitle}>Nothing matches that search.</p>
            <p className={s.emptySub}>Try a different interest or clear the filter.</p>
          </div>
        )}
      </section>
    </div>
  )
}
