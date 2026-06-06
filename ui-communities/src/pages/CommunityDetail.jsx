import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import TagPill from '../components/TagPill.jsx'
import MemberRow from '../components/MemberRow.jsx'
import PostCard from '../components/PostCard.jsx'
import PostSkeleton from '../components/PostSkeleton.jsx'
import BrainstormMark from '../components/BrainstormMark.jsx'
import FetchError from '../components/FetchError.jsx'
import TrustSignal from '../components/TrustSignal.jsx'
import { getCommunity, getCommunityMembers } from '../api/client.js'
import { buildCommunityRecord, buildCommunityPost } from '../events/build.js'
import { buildMembershipAssertion } from '../events/assertion.js'
import { publishEvent, MEMBERSHIP_WRITE_RELAYS } from '../events/publish.js'
import { fetchPostsForCommunity, fetchCommunityDeclaration } from '../events/fetch.js'
import { getRoster, resolveTagElement } from '../lib/roster.js'
import { resolveDefinition } from '../lib/resolveDefinition.js'
import { publishErrorCopy } from '../lib/errors.js'
import { formatCount } from '../lib/format.js'
import s from './CommunityDetail.module.css'

// Fetch a parent Community Declaration by its a-tag, for §26 resolution.
async function declFetchByATag(aTag) {
  const parts = String(aTag).split(':')
  return fetchCommunityDeclaration({
    slug: parts[parts.length - 1],
    preferredFounder: parts.length >= 3 ? parts[1] : null,
  })
}

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

  // Live, per-viewer member roster for declaration-model circles (Story 45).
  // Bespoke circles keep the getCommunityMembers path (state.members).
  const [rosterState, setRosterState] = useState({
    status: 'idle', members: [], degraded: false,
  })
  const [actionTarget, setActionTarget] = useState(null) // pubkey mid-assertion ('self' = the viewer)

  // Conversation tab state — lazy fetch on first tab open, re-fetch
  // after Send. See ADR-0010 for the one-shot vs live decision.
  const [postsState, setPostsState] = useState({
    status: 'idle',
    items: [],
    error: null,
  })
  const [pending, setPending] = useState([])  // optimistic kind-1111 posts + replies
  const [composerText, setComposerText] = useState('')
  const [composerSending, setComposerSending] = useState(false)
  // Reply composer (ADR-0033). replyTarget is always a TOP-LEVEL post {id, author}
  // so replies stay one level deep (re-parented from any reply that was clicked).
  const [replyTarget, setReplyTarget] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [resolved, setResolved] = useState(null)  // §26 resolved definition for forked circles
  const conversationLoadedRef = useRef(false)

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

  // Resolve the inherited definition for forked circles (§26). Live read.
  useEffect(() => {
    const community = state.community
    if (!community || !community.parent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolved(null)
      return
    }
    let cancelled = false
    resolveDefinition(community, declFetchByATag)
      .then(r => { if (!cancelled) setResolved(r) })
      .catch(() => { /* parent unreachable — show own fields only */ })
    return () => { cancelled = true }
  }, [state.community])

  // Load the live roster for declaration circles. House PoV in v1 (per-viewer
  // PoV needs WoT provisioning on the read host; ADR 0031). getRoster never
  // throws — it returns `degraded:true` when the trust network was unreachable,
  // which the People tab distinguishes from a genuinely empty circle.
  useEffect(() => {
    const community = state.community
    if (!community || community.model !== 'declaration') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRosterState({ status: 'idle', members: [], degraded: false })
      return
    }
    let cancelled = false
    setRosterState(prev => ({ ...prev, status: 'loading' }))
    getRoster(community, { wotPov: 'house' })
      .then(r => {
        if (cancelled) return
        setRosterState({ status: 'ready', members: r.members, degraded: r.degraded })
      })
      .catch(() => {
        if (cancelled) return
        setRosterState({ status: 'ready', members: [], degraded: true })
      })
    return () => { cancelled = true }
  }, [state.community, retryNonce])

  // Publish a membership assertion: "I'm in" (target = the viewer, +1) or a
  // vouch for another member (+1). Resolves the circle's first claimed
  // tag-element, signs via NIP-07, dual-publishes, then re-fetches the roster.
  async function handleAssert(target, polarity) {
    if (!signedIn || !viewer || !currentCommunity || actionTarget) return
    // Writes target the FIRST claimed tag-element; reads (getRoster) union across
    // all claims. Fine in v1 — founding only emits the single default claim, so
    // multi-claim circles aren't UI-creatable yet. Revisit if/when they are.
    const coord = (currentCommunity.claims && currentCommunity.claims[0]) || null
    if (!coord) { setPublishError("This circle hasn't set up membership yet."); return }
    setActionTarget(target === viewer ? 'self' : target)
    setPublishError(null)
    try {
      const tagEl = await resolveTagElement(coord)
      if (!tagEl) { setPublishError("Couldn't reach this circle's membership tag. Try again in a moment."); return }
      const unsigned = buildMembershipAssertion({ viewerPubkey: viewer, target, tagElement: tagEl, polarity })
      const result = await publishEvent(unsigned, { relays: MEMBERSHIP_WRITE_RELAYS })
      if (!result.ok) { setPublishError(publishErrorCopy(result)); return }
      triggerRetry() // re-fetch the roster (propagation may lag a beat)
    } finally {
      setActionTarget(null)
    }
  }

  const currentCommunity = state.community
  // Post anchor (NB-1): a Community Declaration is kind-39998; the bespoke
  // record is kind-39999. Derive the anchor kind from the circle's model.
  // A declaration MUST key on its real founder — never fall back to the viewer
  // (that would forge an unreadable address); bespoke keeps its prior fallback.
  const communityATag = (() => {
    if (!currentCommunity) return null
    const kind = currentCommunity.model === 'declaration' ? '39998' : '39999'
    const author = currentCommunity.model === 'declaration'
      ? currentCommunity.founder
      : (currentCommunity.founder || currentCommunity.curator || viewer)
    if (!author) return null
    return `${kind}:${author}:${currentCommunity.slug}`
  })()

  const loadPosts = useCallback(async () => {
    if (!currentCommunity || !communityATag) return
    setPostsState({ status: 'loading', items: [], error: null })
    try {
      const items = await fetchPostsForCommunity({
        communityATag,
        slug: currentCommunity.slug,
      })
      setPostsState({ status: 'ready', items, error: null })
    } catch (error) {
      console.error('[CommunityDetail] fetchKind1 failed:', error)
      setPostsState({ status: 'error', items: [], error })
    }
  }, [currentCommunity, communityATag])

  // Lazy-load posts the first time the Conversation tab is opened, and
  // re-fetch when the slug changes if we'd already loaded once.
  useEffect(() => {
    if (tab !== 'conversation') return
    if (!currentCommunity) return
    if (conversationLoadedRef.current) return
    conversationLoadedRef.current = true
    loadPosts()
  }, [tab, currentCommunity, loadPosts])

  // Reset conversation-tab state when the slug changes. The React 19
  // rule flags the idiomatic "reset state on prop change" pattern;
  // a key-based remount is out of scope for Slice 6.
  useEffect(() => {
    conversationLoadedRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPostsState({ status: 'idle', items: [], error: null })
    setPending([])
    setComposerText('')
  }, [slug])

  async function handleSendPost() {
    if (!signedIn || !viewer || !communityATag) return
    const text = composerText.trim()
    if (!text || composerSending) return

    const localId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    setComposerSending(true)
    setPending(prev => [
      {
        id: localId,
        author: viewer,
        content: text,
        createdAt: Math.floor(Date.now() / 1000),
        _localId: localId,
        _status: 'pending',
      },
      ...prev,
    ])
    setComposerText('')

    const unsigned = buildCommunityPost({
      viewerPubkey: viewer,
      communityATag,
      content: text,
    })
    const result = await publishEvent(unsigned)
    setComposerSending(false)

    if (!result.ok) {
      const errorCopy = result.error === 'rejected-by-relay'
        ? "The relay didn't recognize you yet. Try again in a moment."
        : publishErrorCopy(result)
      setPending(prev => prev.map(p => p._localId === localId
        ? { ...p, _status: 'error', _error: errorCopy, _text: text }
        : p))
      return
    }

    // Success — drop the optimistic entry and re-fetch so the resolved
    // event id replaces the local one. Mirrors Slice 5's "navigate after
    // success" beat: simple over clever.
    setPending(prev => prev.filter(p => p._localId !== localId))
    loadPosts()
  }

  // Send a reply to a top-level post (ADR-0033). replyTarget is always the
  // top-level post, so the reply parents it and stays one level deep.
  async function handleSendReply() {
    if (!signedIn || !viewer || !communityATag || !replyTarget) return
    const text = replyText.trim()
    if (!text || replySending) return

    const localId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const parent = { id: replyTarget.id, author: replyTarget.author }

    setReplySending(true)
    setPending(prev => [
      {
        id: localId,
        author: viewer,
        content: text,
        createdAt: Math.floor(Date.now() / 1000),
        parentId: parent.id,
        _localId: localId,
        _status: 'pending',
      },
      ...prev,
    ])
    setReplyText('')
    setReplyTarget(null)

    const unsigned = buildCommunityPost({ viewerPubkey: viewer, communityATag, content: text, parent })
    const result = await publishEvent(unsigned)
    setReplySending(false)

    if (!result.ok) {
      const errorCopy = result.error === 'rejected-by-relay'
        ? "The relay didn't recognize you yet. Try again in a moment."
        : publishErrorCopy(result)
      setPending(prev => prev.map(p => p._localId === localId
        ? { ...p, _status: 'error', _error: errorCopy, _text: text, _parent: parent }
        : p))
      return
    }

    setPending(prev => prev.filter(p => p._localId !== localId))
    loadPosts()
  }

  function handleRetryPending(localId) {
    const entry = pending.find(p => p._localId === localId)
    if (!entry || !entry._text) return
    setPending(prev => prev.filter(p => p._localId !== localId))
    // A failed reply reopens the reply composer to its top-level parent;
    // a failed top-level post refills the main composer.
    if (entry._parent) {
      setReplyTarget(entry._parent)
      setReplyText(entry._text)
    } else {
      setComposerText(entry._text)
    }
  }

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
  const isDeclaration = c.model === 'declaration'
  const peopleCount = isDeclaration ? rosterState.members.length : members.length

  const realPosts = postsState.items
  const allPosts = [...pending, ...realPosts]
  // One-level threading (ADR-0033): top-level posts keep the existing newest-first
  // order; replies group under their parentId, oldest-first within a thread.
  const topLevelIds = new Set(allPosts.filter(p => !p.parentId).map(p => p.id))
  // A reply whose parent isn't present renders as top-level (ADR-0033 graceful
  // degradation) rather than vanishing — near-impossible under Option A, but a
  // dropped post would be invisible data loss.
  const topLevelPosts = allPosts.filter(p => !p.parentId || !topLevelIds.has(p.parentId))
  const repliesByParent = allPosts.reduce((acc, p) => {
    if (p.parentId && topLevelIds.has(p.parentId)) (acc[p.parentId] = acc[p.parentId] || []).push(p)
    return acc
  }, {})
  for (const id of Object.keys(repliesByParent)) {
    repliesByParent[id].sort((a, b) => a.createdAt - b.createdAt)
  }
  // Posting gate (Story 47): declaration circles gate on REAL membership derived
  // from the roster (the viewer is a member from the PoV), retiring the interim
  // `joined` local flag. Bespoke circles keep the interim flag (no roster).
  const viewerIsMember = isDeclaration && !!viewer && rosterState.members.some(m => m.pubkey === viewer)
  // ADR-0032: when the roster source is unreachable (degraded), declaration posting
  // falls back to the interim gate extended to the founder, so conversation is never
  // dead during the dark window. A healthy-but-empty roster (degraded === false) is
  // untouched and stays gated — an outage must not silently open the room to all.
  const isFounder = isDeclaration && !!viewer && viewer === c.founder
  const rosterDegraded = isDeclaration && rosterState.degraded
  const canCompose = isDeclaration
    ? (signedIn && (viewerIsMember || (rosterDegraded && (joined || isFounder))))
    : (signedIn && joined)
  // Peer-framed prompt when the viewer can't post yet — points at the membership
  // path (the People tab's "I'm in" / Vouch), never "approve/admit".
  const composePrompt = !signedIn
    ? 'Sign in to post.'
    : isDeclaration
      ? 'Members post here. Add yourself on the People tab, or earn a vouch.'
      : 'Join this circle to post.'
  // Calm note shown above the composer when posting is allowed only because the
  // trust source is unreachable. Stated as a situation, never an error (no
  // "something went wrong"). String literal keeps the apostrophes out of JSX text.
  const DEGRADED_NOTE = "We can't reach the trust network right now, so we can't confirm membership. You can still post."

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
          {(c.belongingBar || resolved?.belongingBar) && (
            <p className={s.belongingBar}>
              <span className={s.belongingLabel}>To belong:</span>{' '}
              {c.belongingBar || resolved?.belongingBar}
              {!c.belongingBar && resolved?.belongingBar && (
                <span className={s.inheritedTag}> (inherited)</span>
              )}
            </p>
          )}
          {c.parent && (
            <p className={s.basedOn}>
              Based on{' '}
              <button
                type="button"
                className={s.parentLink}
                onClick={() => navigate(`/community/${String(c.parent).split(':').pop()}`)}
              >
                {String(c.parent).split(':').pop()}
              </button>
            </p>
          )}
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
            {c.model === 'declaration' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/found?from=39998:${c.founder}:${c.slug}`)}
              >
                Fork this circle
              </Button>
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
            {t.id === 'people' ? `${t.label} (${peopleCount})` : t.label}
          </button>
        ))}
      </nav>

      <section className={s.body}>
        {tab === 'people' && isDeclaration && (
          <div className={s.peoplePanel}>
            <TrustSignal members={rosterState.members} personalPov={false} signedIn={signedIn} />

            {signedIn && (
              <div className={s.belongActions}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleAssert(viewer, 1)}
                  disabled={actionTarget === 'self'}
                >
                  {actionTarget === 'self' ? 'Sending…' : "I'm in"}
                </Button>
                {publishError && <p className={s.publishError} role="alert">{publishError}</p>}
              </div>
            )}

            {rosterState.status === 'loading' && (
              <div className={s.rosterShimmer} aria-hidden="true">
                <div className={s.shimmerRow} />
                <div className={s.shimmerRow} />
              </div>
            )}

            {rosterState.status === 'ready' && (
              <ul className={s.peopleList}>
                {rosterState.members.map(m => (
                  <li key={m.pubkey}>
                    <RosterRow
                      member={m}
                      isSelf={m.pubkey === viewer}
                      canVouch={signedIn && m.pubkey !== viewer}
                      pending={actionTarget === m.pubkey}
                      onVouch={() => handleAssert(m.pubkey, 1)}
                    />
                  </li>
                ))}
                {rosterState.members.length === 0 && !rosterState.degraded && (
                  <li className={s.emptyPosts}>No established members yet — be the first to belong.</li>
                )}
                {rosterState.members.length === 0 && rosterState.degraded && (
                  <li className={s.emptyPosts}>
                    We couldn&rsquo;t reach the trust network.{' '}
                    <button type="button" className={s.parentLink} onClick={triggerRetry}>Retry</button>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        {tab === 'people' && !isDeclaration && (
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
            {rosterDegraded && canCompose && (
              <div className={s.degradedNote}>{DEGRADED_NOTE}</div>
            )}
            {canCompose ? (
              <form
                className={s.composer}
                onSubmit={e => {
                  e.preventDefault()
                  handleSendPost()
                }}
              >
                <textarea
                  className={s.composerTextarea}
                  rows={3}
                  placeholder="Share something with the circle"
                  value={composerText}
                  onChange={e => setComposerText(e.target.value)}
                  disabled={composerSending}
                  aria-label="Write a post"
                />
                <div className={s.composerActions}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSendPost}
                    disabled={composerSending || !composerText.trim()}
                  >
                    {composerSending ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className={s.joinPrompt}>
                <span>{composePrompt}</span>
              </div>
            )}

            {postsState.status === 'loading' && allPosts.length === 0 && (
              <>
                <PostSkeleton delay={0} />
                <PostSkeleton delay={80} />
                <PostSkeleton delay={160} />
              </>
            )}

            {postsState.status === 'error' && (
              <FetchError onRetry={loadPosts} />
            )}

            {topLevelPosts.map(p => (
              <div key={p.id || p._localId} className={s.thread}>
                <PostCard
                  post={p}
                  pending={p._status === 'pending'}
                  error={p._status === 'error' ? p._error : null}
                  onRetry={p._status === 'error' ? () => handleRetryPending(p._localId) : null}
                  onReply={canCompose && !p._status ? () => { setReplyTarget({ id: p.id, author: p.author }); setReplyText('') } : null}
                  replyHint={!signedIn ? 'Sign in to reply' : null}
                />

                {replyTarget && replyTarget.id === p.id && (
                  <form
                    className={`${s.composer} ${s.replyComposer}`}
                    onSubmit={e => { e.preventDefault(); handleSendReply() }}
                  >
                    <textarea
                      className={s.composerTextarea}
                      rows={2}
                      placeholder="Write a reply"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      disabled={replySending}
                      aria-label="Write a reply"
                    />
                    <div className={s.composerActions}>
                      <Button variant="secondary" size="md" onClick={() => { setReplyTarget(null); setReplyText('') }}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="md" onClick={handleSendReply} disabled={replySending || !replyText.trim()}>
                        {replySending ? 'Sending…' : 'Reply'}
                      </Button>
                    </div>
                  </form>
                )}

                {(repliesByParent[p.id] || []).map(r => (
                  <div key={r.id || r._localId} className={s.reply}>
                    <PostCard
                      post={r}
                      pending={r._status === 'pending'}
                      error={r._status === 'error' ? r._error : null}
                      onRetry={r._status === 'error' ? () => handleRetryPending(r._localId) : null}
                    />
                  </div>
                ))}
              </div>
            ))}

            {postsState.status === 'ready' && allPosts.length === 0 && (
              <p className={s.emptyPosts}>No posts yet. Be the first to share.</p>
            )}
          </div>
        )}

        {tab === 'about' && <About />}
      </section>
    </div>
  )
}

function RosterRow({ member, isSelf, canVouch, pending, onVouch }) {
  // A surfaced member cleared the trust gate, so they read as trusted from the
  // (house) PoV. The untrusted variant is data-driven for when applicant/0-app
  // rows surface later (needs the endpoint's selfApplied flag).
  const trusted = (member.applications || 0) > 0
  const name = member.displayName || `${String(member.pubkey).slice(0, 8)}…`
  return (
    <div className={s.rosterRow}>
      <span className={s.rosterAvatar} aria-hidden="true">
        {member.picture
          ? <img src={member.picture} alt="" className={s.rosterAvatarImg} loading="lazy" />
          : <span className={s.rosterAvatarFallback}>{name.slice(0, 2).toUpperCase()}</span>}
      </span>
      <span className={s.rosterIdentity}>
        <span className={s.rosterName}>
          {name}
          {isSelf && <span className={s.rosterYou}> (you)</span>}
        </span>
        <span className={trusted ? s.standingTrusted : s.standingUntrusted}>
          {trusted && <span className={s.trustDot} aria-hidden="true" />}
          {trusted ? 'trusted by people you trust' : 'no one you trust vouches for them'}
        </span>
      </span>
      {canVouch && (
        <Button size="sm" variant="ghost" onClick={onVouch} disabled={pending}>
          {pending ? 'Sending…' : 'Vouch'}
        </Button>
      )}
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
          text="There is no central authority who can rug-pull. If someone behaves badly, members can raise a concern. When enough do, the algorithm responds."
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

