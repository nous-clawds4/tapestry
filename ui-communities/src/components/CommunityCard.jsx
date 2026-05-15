import { useNavigate } from 'react-router-dom'
import TagPill from './TagPill.jsx'
import StackedAvatars from './StackedAvatars.jsx'
import { formatCount } from '../lib/format.js'
import s from './CommunityCard.module.css'

export default function CommunityCard({ community, joined, index = 0 }) {
  const navigate = useNavigate()
  const trustedMembers = community.members.slice(0, 4)
  return (
    <article
      className={joined ? `${s.card} ${s.cardJoined}` : s.card}
      style={{
        '--card-accent': community.accent,
        '--card-delay': `${Math.min(index * 35, 320)}ms`,
      }}
      data-testid="community-card"
      onClick={() => navigate(`/community/${community.slug}`)}
      role="link"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/community/${community.slug}`)
        }
      }}
    >
      <span className={s.accentBar} aria-hidden="true" />
      <div className={s.body}>
        <header className={s.head}>
          <h3 className={s.title}>{community.name}</h3>
          {joined && (
            <span className={s.joinedBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              You belong here
            </span>
          )}
        </header>
        <p className={s.description}>{community.description}</p>
        <div className={s.tags}>
          {community.tags.map(t => <TagPill key={t} tag={t} small />)}
        </div>
        <footer className={s.footer}>
          <span className={s.trust}>
            <StackedAvatars memberIds={trustedMembers} size={22} />
            <span className={s.trustLabel}>{community.trustedHere} trusted here</span>
          </span>
          <span className={s.peopleCount}>{formatCount(community.memberCount)} people</span>
        </footer>
      </div>
    </article>
  )
}
