import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import TagPill from '../components/TagPill.jsx'
import MemberRow from '../components/MemberRow.jsx'
import PostCard from '../components/PostCard.jsx'
import Avatar from '../components/Avatar.jsx'
import { getCommunity, getCommunityMembers } from '../data/mockData.js'
import { formatCount } from '../lib/format.js'
import s from './CommunityDetail.module.css'

const TABS = [
  { id: 'people', label: 'People' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'about', label: 'How this works' },
]

export default function CommunityDetail({ slug }) {
  const { signedIn, joinedSet, vouchedSet, onJoin, onLeave, onVouch, onOpenDrawer, navigate } = useOutletContext()
  const [tab, setTab] = useState('people')
  const c = getCommunity(slug)

  if (!c) {
    return (
      <div className={s.notFound}>
        <h1>Circle not found.</h1>
        <Button variant="primary" onClick={() => navigate('/')}>Back to Discover</Button>
      </div>
    )
  }

  const members = getCommunityMembers(slug)
  const joined = joinedSet.has(c.slug)

  return (
    <div className={s.page} style={{ '--community-accent': c.accent }}>
      <div className={s.banner} aria-hidden="true">
        <div className={s.bannerWash} />
        <div className={s.bannerPattern} />
      </div>

      <header className={s.header}>
        <div className={s.identity}>
          <h1 className={s.name}>{c.name}</h1>
          <p className={s.description}>{c.description}</p>
          <div className={s.tagRow}>
            {c.tags.map(t => <TagPill key={t} tag={t} small />)}
          </div>
        </div>
        {signedIn && (
          <div className={s.actions}>
            {joined ? (
              <div className={s.joinedCluster}>
                <span className={s.belong}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  You belong here
                </span>
                <span className={s.joinedActions}>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/edit/${c.slug}`)}>
                    Your view
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onLeave(c.slug)}>
                    Leave
                  </Button>
                </span>
              </div>
            ) : (
              <Button variant="primary" size="lg" onClick={() => onJoin(c.slug)}>
                Join this circle
              </Button>
            )}
          </div>
        )}
      </header>

      <dl className={s.stats}>
        <Stat label="People" value={formatCount(c.memberCount)} />
        <Stat label="Trusted here" value={c.trustedHere} accent />
        <Stat label="Active" value={c.activity} />
      </dl>

      <nav className={s.tabs} aria-label="Section">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? `${s.tab} ${s.tabActive}` : s.tab}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'true' : undefined}
          >
            {t.id === 'people' ? `${t.label} (${members.length})` : t.label}
          </button>
        ))}
      </nav>

      <section className={s.body}>
        {tab === 'people' && (
          <ul className={s.peopleList}>
            {members.map(m => (
              <li key={m.id}>
                <MemberRow
                  member={m}
                  communitySlug={c.slug}
                  isVouched={vouchedSet.has(m.id)}
                  onVouch={onVouch}
                  onOpen={id => onOpenDrawer(id, c.slug)}
                  showVouch={signedIn && joined}
                />
              </li>
            ))}
          </ul>
        )}

        {tab === 'conversation' && (
          <div className={s.conversation}>
            {signedIn && joined && (
              <div className={s.composer}>
                <Avatar member="m1" size={36} />
                <button type="button" className={s.composerInput}>
                  Share something with the circle…
                </button>
              </div>
            )}
            {c.posts.map((p, i) => <PostCard key={i} post={p} />)}
            {c.posts.length === 0 && (
              <p className={s.emptyPosts}>No conversations yet. Be the first to share.</p>
            )}
          </div>
        )}

        {tab === 'about' && <About />}
      </section>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className={s.stat}>
      <span className={accent ? `${s.statValue} ${s.statAccent}` : s.statValue}>{value}</span>
      <span className={s.statLabel}>{label}</span>
    </div>
  )
}

function About() {
  return (
    <div className={s.about}>
      <div className={s.aboutCallout}>
        <strong className={s.aboutCalloutTitle}>This circle is self-sustaining.</strong>{' '}
        <span>
          No single person controls who belongs. Membership is determined by the people
          already here — through vouches and the trust they carry.
        </span>
      </div>
      <div className={s.aboutGrid}>
        <AboutBlock
          title="How membership works"
          text="When existing members vouch for someone, that person becomes part of the circle. The more trusted the voucher, the more weight their word carries. It's reputation, not rules."
        />
        <AboutBlock
          title="Your view, your choice"
          text="Every member has their own perspective on this circle. You can adjust your settings, your trust in members, even your servers — without affecting anyone else."
        />
        <AboutBlock
          title="No central authority"
          text="There's no admin who can rug-pull. If someone here behaves badly, members can raise a concern; if many do, the algorithm reflects it."
        />
      </div>
    </div>
  )
}

function AboutBlock({ title, text }) {
  return (
    <article className={s.aboutBlock}>
      <h4 className={s.aboutBlockTitle}>{title}</h4>
      <p className={s.aboutBlockText}>{text}</p>
    </article>
  )
}
