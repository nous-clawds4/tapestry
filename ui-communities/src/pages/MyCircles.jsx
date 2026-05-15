import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import CardSkeleton from '../components/CardSkeleton.jsx'
import BrainstormMark from '../components/BrainstormMark.jsx'
// MyCircles hydrates the viewer's joinedSet through the API client,
// which uses the relay fallback under the hood (Slice 2 NB-4 stopgap).
// Each slug round-trips to /api/communities/:slug, and on null the
// client pulls the kind-39999 event straight from the relay.
import { getJoinedCommunitySummaries } from '../api/client.js'
import s from './MyCircles.module.css'

export default function MyCircles() {
  const { viewer, joinedSet, navigate } = useOutletContext()
  const [state, setState] = useState({ status: 'loading', joined: [] })

  // Snapshot the joinedSet as a sorted, comma-joined string so the
  // effect re-runs when the set's contents change (Set identity flips
  // on every join/leave, but we want a stable dep).
  const joinedKey = Array.from(joinedSet).sort().join(',')

  useEffect(() => {
    if (joinedSet.size === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: 'ready', joined: [] })
      return
    }
    let cancelled = false
    setState({ status: 'loading', joined: [] })
    getJoinedCommunitySummaries(Array.from(joinedSet), viewer)
      .then(joined => {
        if (cancelled) return
        setState({ status: 'ready', joined })
      })
      .catch(error => {
        if (cancelled) return
        console.error('[MyCircles] hydration failed:', error)
        setState({ status: 'ready', joined: [] })
      })
    return () => { cancelled = true }
  }, [joinedKey, viewer])  // eslint-disable-line react-hooks/exhaustive-deps

  const { status, joined } = state

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Your Circles</h1>
          <p className={s.subtitle}>The circles you belong to.</p>
        </div>
        <Button variant="primary" size="md" onClick={() => navigate('/create')}>
          + Start a circle
        </Button>
      </header>

      {status === 'loading' ? (
        <section className={s.grid}>
          <CardSkeleton delay={0} />
          <CardSkeleton delay={80} />
          <CardSkeleton delay={160} />
        </section>
      ) : joined.length === 0 ? (
        <div className={s.empty}>
          <BrainstormMark variant="mark" size={64} className={s.emptyMark} />
          <h2 className={s.emptyTitle}>You haven&apos;t joined any circles yet.</h2>
          <p className={s.emptySub}>Browse Discover to find one, or start your own.</p>
          <div className={s.emptyActions}>
            <Button variant="primary" onClick={() => navigate('/')}>Explore circles</Button>
            <Button variant="ghost" onClick={() => navigate('/create')}>Start a circle</Button>
          </div>
        </div>
      ) : (
        <section className={s.grid}>
          {joined.map((c, i) => (
            <CommunityCard key={c.slug} community={c} joined index={i} />
          ))}
        </section>
      )}
    </div>
  )
}
