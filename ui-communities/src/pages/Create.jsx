import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import FormInput from '../components/FormInput.jsx'
import StepProgress from '../components/StepProgress.jsx'
import SearchBar from '../components/SearchBar.jsx'
import TagPill from '../components/TagPill.jsx'
import ProfileAvatar from '../components/ProfileAvatar.jsx'
import ViewCallout from '../components/ViewCallout.jsx'
// "Similar circles" still reads from mockData per Slice 3 / story #9 —
// the similar-community query endpoint isn't built yet, so the wizard
// stays on mock data for that step until the API lands. "Founding
// voices" now hits the real brainstorm.world profile-search API
// (src/lib/profiles.js) instead of the mock members list.
import { communities, tags } from '../data/mockData.js'
import { buildCommunitiesDListHeader, buildCommunityRecord } from '../events/build.js'
import { publishEvent } from '../events/publish.js'
import { publishErrorCopy, signInErrorCopy } from '../lib/errors.js'
import { searchProfilesByQuery } from '../lib/profiles.js'
import { slugify } from '../lib/slug.js'
import { npubShort } from '../lib/format.js'
import s from './Create.module.css'

const STEPS = ['Name', 'Similar circles', 'Topics', 'Founding voices', 'Review']

export default function Create() {
  const { viewer, signedIn, navigate, onJoin, onSignIn } = useOutletContext()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  // seedMembers is an array of { pubkey, profile } entries so the
  // Review/Publish path can render names + pictures, and the publish
  // payload carries the real hex pubkeys.
  const [seedMembers, setSeedMembers] = useState([])
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [memberSearchStatus, setMemberSearchStatus] = useState('idle')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(null)
  const [signInState, setSignInState] = useState({ status: 'idle', error: null })
  const searchTokenRef = useRef(0)

  async function handleCreate() {
    if (!signedIn || !viewer || publishing) return
    const slug = slugify(name)
    if (!slug) {
      setPublishError('Please choose a name with at least one letter or number.')
      return
    }
    setPublishing(true)
    setPublishError(null)

    // 1. Publish the brainstorm-communities DList header (idempotent under
    //    nostr replaceable-event semantics — same d-tag every time).
    const headerResult = await publishEvent(buildCommunitiesDListHeader({ viewerPubkey: viewer }))
    if (!headerResult.ok) {
      setPublishing(false)
      setPublishError(publishErrorCopy(headerResult))
      return
    }

    // 2. Publish the kind-39999 community-record. Founder is always a seed.
    const seedPubkeys = seedMembers.map(m => m.pubkey).filter(Boolean)
    const seeds = Array.from(new Set([viewer, ...seedPubkeys]))
    const community = {
      slug,
      name: name.trim(),
      description: description.trim(),
      topics: selectedTags,
      seedMembers: seeds,
      founder: viewer,
      weightingModel: 'gr-community-default-v1',
      endorsementThreshold: 0.5,
    }
    const recordResult = await publishEvent(buildCommunityRecord({ viewerPubkey: viewer, community }))
    if (!recordResult.ok) {
      setPublishing(false)
      setPublishError(publishErrorCopy(recordResult))
      return
    }

    // 3. Optimistic joinedSet update + navigate to the new community.
    onJoin(slug)
    navigate(`/community/${slug}`)
  }

  async function handleSignInInline() {
    setSignInState({ status: 'pending', error: null })
    const result = await onSignIn()
    if (!result || result.ok === false) {
      setSignInState({ status: 'error', error: signInErrorCopy(result && result.error) })
    } else {
      setSignInState({ status: 'idle', error: null })
    }
  }

  const similar = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (q.length < 2) return []
    return communities
      .filter(c => c.name.toLowerCase().includes(q) || c.tags.some(t => {
        const tag = tags.find(x => x.id === t)
        return tag && tag.label.toLowerCase().includes(q)
      }))
      .slice(0, 3)
  }, [name])

  // Debounced people-search against brainstorm.world's meilisearch
  // proxy. 180 ms is short enough to feel instant, long enough to
  // collapse typed bursts. Mirrors the brainstorm.world suggestion-
  // box pacing (200 ms there). searchTokenRef guards against stale
  // promises overwriting newer results.
  useEffect(() => {
    const q = memberQuery.trim()
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMemberResults([])
      setMemberSearchStatus('idle')
      return
    }
    const token = ++searchTokenRef.current
    setMemberSearchStatus('searching')
    const handle = setTimeout(() => {
      searchProfilesByQuery(q, { limit: 12 }).then(results => {
        if (token !== searchTokenRef.current) return
        setMemberResults(results)
        setMemberSearchStatus(results.length === 0 ? 'empty' : 'ready')
      })
    }, 180)
    return () => clearTimeout(handle)
  }, [memberQuery])

  const toggleTag = id =>
    setSelectedTags(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const toggleSeed = entry =>
    setSeedMembers(prev => {
      const already = prev.find(m => m.pubkey === entry.pubkey)
      return already
        ? prev.filter(m => m.pubkey !== entry.pubkey)
        : [...prev, entry]
    })

  const seedHasPubkey = pubkey => seedMembers.some(m => m.pubkey === pubkey)

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Start a Circle</h1>
        <p className={s.subtitle}>Build a home for people who share your interest.</p>
      </header>

      <StepProgress steps={STEPS} current={step} />

      {step === 0 && (
        <div className={s.step}>
          <FormInput
            label="What's your circle called?"
            value={name}
            onChange={setName}
            placeholder="e.g. Sunset Hikers, Code & Coffee, Film Nerds"
            maxLength={64}
          />
          <FormInput
            label="Describe it in a sentence or two"
            value={description}
            onChange={setDescription}
            placeholder="What brings people here? What will they find?"
            multiline
            rows={3}
            hint="People will read this first. Be honest and inviting."
          />
          <Footer
            primary={
              <Button variant="primary" disabled={!name.trim()} onClick={() => setStep(1)}>
                Continue
              </Button>
            }
          />
        </div>
      )}

      {step === 1 && (
        <div className={s.step}>
          <div className={s.note}>
            Before you start from scratch, take a look at these. People you trust are
            already part of them.
          </div>
          {similar.length > 0 ? (
            <ul className={s.similarList}>
              {similar.map(c => (
                <li key={c.slug} className={s.similarItem}>
                  <div>
                    <div className={s.similarName}>{c.name}</div>
                    <div className={s.similarMeta}>
                      {c.memberCount} people · {c.trustedHere} you trust
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onJoin(c.slug)
                      navigate(`/community/${c.slug}`)
                    }}
                  >
                    Join this one
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.empty}>
              Type a name on the previous step to see similar circles.
            </p>
          )}
          <Footer
            secondary={<Button variant="ghost" onClick={() => setStep(0)}>Back</Button>}
            primary={
              <Button variant="primary" onClick={() => setStep(2)}>
                Start fresh
              </Button>
            }
          />
        </div>
      )}

      {step === 2 && (
        <div className={s.step}>
          <p className={s.lede}>
            Choose topics that describe your circle. This helps people find you.
          </p>
          <div className={s.tagGrid}>
            {tags.map(t => (
              <TagPill
                key={t.id}
                tag={t}
                active={selectedTags.includes(t.id)}
                onClick={toggleTag}
              />
            ))}
          </div>
          <Footer
            secondary={<Button variant="ghost" onClick={() => setStep(1)}>Back</Button>}
            primary={
              <Button variant="primary" onClick={() => setStep(3)}>
                Continue
              </Button>
            }
          />
        </div>
      )}

      {step === 3 && (
        <div className={s.step}>
          <p className={s.lede}>
            Invite a few people you trust as founding voices. They&apos;ll help shape
            who belongs here.
          </p>
          <SearchBar
            value={memberQuery}
            onChange={setMemberQuery}
            placeholder="Search nostr by name, npub, or nip-05…"
          />
          {seedMembers.length > 0 && (
            <ul className={s.seedChipRow} aria-label="Selected founding voices">
              {seedMembers.map(m => (
                <li key={m.pubkey} className={s.seedChip}>
                  <ProfileAvatar pubkey={m.pubkey} profile={m.profile} size={22} />
                  <span className={s.seedChipName}>
                    {(m.profile && (m.profile.display_name || m.profile.name)) || npubShort(m.pubkey)}
                  </span>
                  <button
                    type="button"
                    className={s.seedChipRemove}
                    onClick={() => toggleSeed(m)}
                    aria-label={`Remove ${(m.profile && m.profile.name) || 'this person'}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className={s.memberList}>
            {memberResults.map(entry => {
              const p = entry.profile || {}
              const displayName = p.display_name || p.name || npubShort(entry.pubkey)
              const selected = seedHasPubkey(entry.pubkey)
              const wot = entry.wot || {}
              const rank = typeof wot.rank === 'number' ? wot.rank : null
              const followers = typeof wot.followers === 'number' ? wot.followers : null
              return (
                <li key={entry.pubkey} className={s.memberItem}>
                  <ProfileAvatar pubkey={entry.pubkey} profile={p} size={36} />
                  <div className={s.memberMeta}>
                    <div className={s.memberNameRow}>
                      <span className={s.memberName}>{displayName}</span>
                      {entry.nip05Verified && (
                        <span className={s.nip05Verified} title="NIP-05 verified">✓</span>
                      )}
                    </div>
                    {p.nip05 && <div className={s.memberHandle}>{p.nip05}</div>}
                    {(rank != null || followers != null) && (
                      <div className={s.wotRow}>
                        {rank != null && (
                          <span className={s.wotBadge} title="Verification score (web-of-trust rank)">
                            <span className={s.wotIcon} aria-hidden="true">★</span>
                            {formatWot(rank)}
                          </span>
                        )}
                        {followers != null && (
                          <span className={s.wotBadgeMuted} title="Verified followers">
                            <span aria-hidden="true">👥</span>
                            {formatFollowers(followers)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSeed(entry)}
                    className={selected ? `${s.seedToggle} ${s.seedToggleOn}` : s.seedToggle}
                    aria-pressed={selected}
                    aria-label={selected ? `Remove ${displayName}` : `Add ${displayName}`}
                  >
                    {selected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
            {memberSearchStatus === 'idle' && seedMembers.length === 0 && (
              <li className={s.memberHint}>Type at least two characters to search nostr.</li>
            )}
            {memberSearchStatus === 'searching' && memberResults.length === 0 && (
              <li className={s.memberHint}>Searching…</li>
            )}
            {memberSearchStatus === 'empty' && (
              <li className={s.memberHint}>No matches. Try a different name, npub, or nip-05.</li>
            )}
          </ul>
          <Footer
            secondary={<Button variant="ghost" onClick={() => setStep(2)}>Back</Button>}
            primary={
              <Button
                variant="primary"
                disabled={seedMembers.length === 0}
                onClick={() => setStep(4)}
              >
                Continue ({seedMembers.length} selected)
              </Button>
            }
          />
        </div>
      )}

      {step === 4 && (
        <div className={s.step}>
          <div className={s.reviewCard}>
            <h3 className={s.reviewTitle}>{name || 'Untitled Circle'}</h3>
            <p className={s.reviewDescription}>{description || 'No description'}</p>
            <div className={s.reviewTags}>
              {selectedTags.map(t => <TagPill key={t} tag={t} small />)}
              {selectedTags.length === 0 && <span className={s.reviewMuted}>No topics selected</span>}
            </div>
            <div className={s.reviewMeta}>
              {seedMembers.length} founding voice{seedMembers.length === 1 ? '' : 's'}
            </div>
            <p className={s.relayNote}>
              Your circle will live on <code>communities.brainstorm.world</code> for now.
              You can host your own mirror later.
            </p>
          </div>
          <ViewCallout title="This creates your view of this circle">
            Others who join will form their own view. That is how a self-sustaining
            circle works.
          </ViewCallout>

          {signedIn ? (
            <>
              <Footer
                secondary={
                  <Button variant="ghost" onClick={() => setStep(3)} disabled={publishing}>
                    Back
                  </Button>
                }
                primary={
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleCreate}
                    disabled={publishing || !name.trim()}
                  >
                    {publishing ? 'Publishing…' : 'Create your circle'}
                  </Button>
                }
              />
              {publishError && (
                <p className={s.publishError} role="alert">{publishError}</p>
              )}
            </>
          ) : (
            <div className={s.signInPanel}>
              <p className={s.signInPanelCopy}>Sign in to publish your circle.</p>
              <Button
                variant="primary"
                size="md"
                onClick={handleSignInInline}
                disabled={signInState.status === 'pending'}
              >
                {signInState.status === 'pending' ? 'Signing in…' : 'Sign in'}
              </Button>
              {signInState.status === 'error' && (
                <p className={s.publishError} role="alert">{signInState.error}</p>
              )}
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatWot(rank) {
  // wot_rank in meili is an integer-ish "verification score" (e.g. 92,
  // 145, etc. on brainstorm.world). Show as-is rounded.
  return Math.round(rank).toLocaleString()
}

function formatFollowers(n) {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1000000) return `${Math.round(n / 1000)}k`
  return `${(n / 1000000).toFixed(1)}M`
}

function Footer({ primary, secondary }) {
  return (
    <div className={s.footer}>
      {secondary ?? <span />}
      {primary}
    </div>
  )
}

