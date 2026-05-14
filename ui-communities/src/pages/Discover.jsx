import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import TagPill from '../components/TagPill.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import BrainstormMark from '../components/BrainstormMark.jsx'
import { communities, tags } from '../data/mockData.js'
import s from './Discover.module.css'

export default function Discover() {
  const { joinedSet } = useOutletContext()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return communities.filter(c => {
      const matchTag = !activeTag || c.tags.includes(activeTag)
      if (!matchTag) return false
      if (!q) return true
      if (c.name.toLowerCase().includes(q)) return true
      if (c.description.toLowerCase().includes(q)) return true
      return c.tags.some(t => {
        const tag = tags.find(x => x.id === t)
        return tag && tag.label.toLowerCase().includes(q)
      })
    })
  }, [query, activeTag])

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
        {filtered.map((c, i) => (
          <CommunityCard
            key={c.slug}
            community={c}
            joined={joinedSet.has(c.slug)}
            index={i}
          />
        ))}
        {filtered.length === 0 && (
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
