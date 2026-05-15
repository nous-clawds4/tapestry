import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import TagPill from '../components/TagPill.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import BrainstormMark from '../components/BrainstormMark.jsx'
import CardSkeleton from '../components/CardSkeleton.jsx'
import FetchError from '../components/FetchError.jsx'
import { getCommunities } from '../api/client.js'
import { tags } from '../data/mockData.js'
import s from './Discover.module.css'

const SKELETON_COUNT = 8

export default function Discover() {
  const { joinedSet } = useOutletContext()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const [state, setState] = useState({ status: 'loading', communities: [], error: null })

  useEffect(() => {
    let cancelled = false
    // Reset to loading on every fetch (initial mount + retry). The React 19
    // set-state-in-effect rule flags the idiomatic data-fetch pattern;
    // a Suspense + use() rework is out of scope for Slice 3.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading', communities: [], error: null })
    getCommunities(null /* viewer wired in Slice 4 */)
      .then(communities => {
        if (cancelled) return
        setState({ status: 'ready', communities, error: null })
      })
      .catch(error => {
        if (cancelled) return
        console.error('[Discover] getCommunities failed:', error)
        setState({ status: 'error', communities: [], error })
      })
    return () => {
      cancelled = true
    }
  }, [retryNonce])

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
