import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import TagPill from '../components/TagPill.jsx'
import MemberRow from '../components/MemberRow.jsx'
import PostCard from '../components/PostCard.jsx'
import Avatar from '../components/Avatar.jsx'
import BrainstormMark from '../components/BrainstormMark.jsx'
import FetchError from '../components/FetchError.jsx'
import { getCommunity, getCommunityMembers } from '../api/client.js'
import { buildCommunityRecord } from '../events/build.js'
import { publishEvent } from '../events/publish.js'
import { formatCount } from '../lib/format.js'
import s from './CommunityDetail.module.css'

const TABS = [
  { id: 'people', label: 'People' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'about', label: 'How this works' },
]

export default function CommunityDetail({ slug }) {
  const { viewer, signedIn, joinedSet, vouchedSet, onJoin, onLeave, onVouch, onOpenDrawer, navigate } = useOutletContext()
  const [tab, setTab] = useState('people')
  const [retryNonce, setRetryNonce] = useState(0)
  const [state, setState] = useState({
    status: 'loading',
    community: null,
    members: [],
    error: null,
  })
  const [publishError, setPublishError] = useState(null)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Reset to loading on every fetch (initial mount + retry + slug change
    // + viewer change). The React 19 set-state-in-effect rule flags the
    // idiomatic data-fetch pattern; a Suspense + use() rework is out of
    // scope for Slice 4.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(prev => ({ ...prev, status: 'loading', error: null }))
    Promise.all([
      getCommunity(slug, viewer),
      getCommunityMembers(slug, viewer),
    ])
      .then(([community, members]) => {
        if (cancelled) return
        if (community === null) {
          setState({ status: 'not-found', community: null, members: [], error: null })
          return
        }
        setState({ status: 'ready', community, members, error: null })
      })
      .catch(error => {
        if (cancelled) return
        console.error('[CommunityDetail] fetch failed:', error)
        setState({ status: 'error', community: null, members: [], error })
      })
    return () => {
      cancelled = true
    }
  }, [slug, viewer, retryNonce])

  // Publish error auto-clears after 5s so the chrome doesn't linger.
  useEffect(() => {
    if (!publishError) return
    const t = setTimeout(() => setPublishError(null), 5000)
    return () => clearTimeout(t)
  }, [publishError])

  const triggerRetry = useCallback(() => setRetryNonce(n => n + 1), [])

  async function handleJoinClick() {
    if (!signedIn || !viewer || !state.community || publishing) return
    setPublishing(true)
    setPublishError(null)
    // Optimistic — flip the joined state immediately for responsiveness.
    onJoin(state.community.slug)
    const unsigned = buildCommunityRecord({
      viewerPubkey: viewer,
      community: state.community,
    })
    const result = await publishEvent(unsigned)
    setPublishing(false)
    if (!result.ok) {
      // Roll back the optimistic state on publish failure.
      onLeave(state.community.slug)
      setPublishError(publishErrorCopy(result))
    }
  }

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        <div className={s.banner} aria-hidden="true" style={{ opacity: 0.5 }} />
        <div className={s.loadingPad} aria-hidden="true">
          <div className={s.loadingTitle} />
          <div className={s.loadingLine} />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        <FetchError onRetry={triggerRetry} />
      </div>
    )
  }

  if (state.status === 'not-found' || !state.community) {
    return (
      <div className={s.notFound}>
        <BrainstormMark variant="mark" size={64} className={s.notFoundMark} />
        <h1>Circle not found.</h1>
        <Button variant="primary" onClick={() => navigate('/')}>Back to Discover</Button>
      </div>
    )
  }

  const c = state.community
  const members = state.members
  const joined = joinedSet.has(c.slug)
  const posts = Array.isArray(c.posts) ? c.posts : []

  return (
    <div className={s.page} style={{ '--community-accent': c.accent || 'var(--accent)' }}>
      <div className={s.banner} aria-hidden="true">
        <div className={s.bannerWash} />
        <div className={s.bannerPattern} />
      </div>

      <header className={s.header}>
        <div className={s.identity}>
          <h1 className={s.name}>{c.name}</h1>
          <p className={s.description}>{c.description}</p>
          <div className={s.tagRow}>
            {(c.tags || []).map(t => <TagPill key={t} tag={t} small />)}
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
              <Button
                variant="primary"
                size="lg"
                onClick={handleJoinClick}
                disabled={publishing}
              >
                {publishing ? 'Joining…' : 'Join this circle'}
              </Button>
            )}
            {publishError && (
              <p className={s.publishError} role="alert">{publishError}</p>
            )}
          </div>
        )}
      </header>

      <dl className={s.stats}>
        <Stat label="People" value={formatCount(c.memberCount)} />
        <Stat label="Trusted here" value={c.trustedHere} accent />
        <Stat label="Active" value={c.activity || '—'} />
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
              <li key={m.id || m.pubkey}>
                <MemberRow
                  member={m}
                  communitySlug={c.slug}
                  isVouched={vouchedSet.has(m.id || m.pubkey)}
                  onVouch={onVouch}
                  onOpen={id => onOpenDrawer(id, c.slug)}
                  showVouch={signedIn && joined}
                />
              </li>
            ))}
            {members.length === 0 && (
              <li className={s.emptyPosts}>No members surfaced for this circle yet.</li>
            )}
          </ul>
        )}

        {tab === 'conversation' && (
          <div className={s.conversation}>
            {signedIn && joined && (
              <div className={s.composer}>
                <Avatar member="m1" size={36} />
                <button type="button" className={s.composerInput}>
                  Share something with the circle
                </button>
              </div>
            )}
            {posts.map((p, i) => <PostCard key={i} post={p} />)}
            {posts.length === 0 && (
              <p className={s.emptyPosts}>No posts yet. Be the first to share.</p>
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
        <strong className={s.aboutCalloutTitle}>This circle runs itself.</strong>{' '}
        <span>
          The people already here decide who belongs, through vouches and the trust each
          person carries.
        </span>
      </div>
      <div className={s.aboutGrid}>
        <AboutBlock
          title="How membership works"
          text="When members vouch for someone, that person becomes part of the circle. A more trusted voucher carries more weight. Membership runs on reputation."
        />
        <AboutBlock
          title="Your view is yours"
          text="Every member sees this circle from their own perspective. You can adjust your settings, your trust in members, and even your servers without changing what anyone else sees."
        />
        <AboutBlock
          title="No central authority"
          text="There is no admin who can rug-pull. If someone behaves badly, members can raise a concern. When enough do, the algorithm responds."
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

function publishErrorCopy(result) {
  switch (result && result.error) {
    case 'no-extension':
      return 'Sign in with a nostr extension to publish.'
    case 'rejected':
      return 'Signing cancelled.'
    case 'timeout':
      return 'The relay took too long to confirm. Try again?'
    case 'rejected-by-relay':
      return 'The relay rejected this event.'
    case 'network':
      return 'We could not reach the relay. Check your connection?'
    default:
      return 'Something went wrong publishing. Try again?'
  }
}
