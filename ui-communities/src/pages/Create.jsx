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
import s from './Create.module.css'

const STEPS = ['Name', 'Similar circles', 'Topics', 'Founding voices', 'Review']

export default function Create() {
  const { navigate, onJoin } = useOutletContext()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [seedMembers, setSeedMembers] = useState([])
  const [memberQuery, setMemberQuery] = useState('')

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
          </div>
          <ViewCallout title="This creates your view of this circle">
            Others who join will form their own view. That is how a self-sustaining
            circle works.
          </ViewCallout>
          <Footer
            secondary={<Button variant="ghost" onClick={() => setStep(3)}>Back</Button>}
            primary={
              <Button variant="primary" size="lg" onClick={() => navigate('/my-circles')}>
                Create your circle
              </Button>
            }
          />
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
