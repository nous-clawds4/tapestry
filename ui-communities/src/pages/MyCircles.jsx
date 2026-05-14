import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import BrainstormMark from '../components/BrainstormMark.jsx'
import { communities } from '../data/mockData.js'
import s from './MyCircles.module.css'

export default function MyCircles() {
  const { joinedSet, navigate } = useOutletContext()
  const joined = communities.filter(c => joinedSet.has(c.slug))

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

      {joined.length === 0 ? (
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
