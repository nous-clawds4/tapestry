import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import FormInput from '../components/FormInput.jsx'
import StepProgress from '../components/StepProgress.jsx'
import SearchBar from '../components/SearchBar.jsx'
import TagPill from '../components/TagPill.jsx'
import Avatar from '../components/Avatar.jsx'
import ViewCallout from '../components/ViewCallout.jsx'
// Create intentionally reads from mockData per Slice 3 / story #9:
// - the "Similar circles" step needs a similar-communities query (no API
//   endpoint exists yet);
// - the "Founding voices" step needs a member-search-within-trust-network
//   endpoint (also unbuilt).
// Both endpoints come in a later story; Create stays on mock data until
// then so the create flow remains exercisable end-to-end during dev.
import { communities, members, tags } from '../data/mockData.js'
import { buildCommunitiesDListHeader, buildCommunityRecord } from '../events/build.js'
import { publishEvent } from '../events/publish.js'
import { slugify } from '../lib/slug.js'
import s from './Create.module.css'

const STEPS = ['Name', 'Similar circles', 'Topics', 'Founding voices', 'Review']

export default function Create() {
  const { viewer, signedIn, navigate, onJoin, onSignIn } = useOutletContext()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [seedMembers, setSeedMembers] = useState([])
  const [memberQuery, setMemberQuery] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(null)
  const [signInState, setSignInState] = useState({ status: 'idle', error: null })

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
    const seeds = Array.from(new Set([viewer, ...seedMembers]))
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

  const memberResults = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    return members
      .filter(m => !q || m.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [memberQuery])

  const toggleTag = id =>
    setSelectedTags(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const toggleSeed = id =>
    setSeedMembers(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

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
            placeholder="Search for people…"
          />
          <ul className={s.memberList}>
            {memberResults.map(m => (
              <li key={m.id} className={s.memberItem}>
                <Avatar member={m} size={36} />
                <div className={s.memberName}>{m.name}</div>
                <button
                  type="button"
                  onClick={() => toggleSeed(m.id)}
                  className={
                    seedMembers.includes(m.id) ? `${s.seedToggle} ${s.seedToggleOn}` : s.seedToggle
                  }
                  aria-pressed={seedMembers.includes(m.id)}
                >
                  {seedMembers.includes(m.id) && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
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

function Footer({ primary, secondary }) {
  return (
    <div className={s.footer}>
      {secondary ?? <span />}
      {primary}
    </div>
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

function signInErrorCopy(code) {
  switch (code) {
    case 'no-extension':
      return 'You need a nostr browser extension (Alby, nos2x) to publish.'
    case 'rejected':
      return 'Sign-in cancelled.'
    default:
      return 'Sign-in failed. Try again?'
  }
}
