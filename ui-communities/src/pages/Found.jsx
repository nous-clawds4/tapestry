import { useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import Button from '../components/Button.jsx'
import FormInput from '../components/FormInput.jsx'
import StepProgress from '../components/StepProgress.jsx'
import ViewCallout from '../components/ViewCallout.jsx'
// The "right way" found flow (ADR 0029): founding writes a Community
// Declaration (kind 39998), distinct from the frozen bespoke Create flow.
// With `?from=<parent a-tag>` it becomes a FORK — pre-filled from the
// parent's resolved definition (§26); unedited fields are omitted so they
// inherit live from the parent.
import { buildCommunityDeclaration } from '../events/declaration.js'
import { buildTagElement } from '../events/assertion.js'
import { publishEvent, MEMBERSHIP_WRITE_RELAYS } from '../events/publish.js'
import { fetchCommunityDeclaration } from '../events/fetch.js'
import { resolveDefinition } from '../lib/resolveDefinition.js'
import { publishErrorCopy, signInErrorCopy } from '../lib/errors.js'
import { slugify } from '../lib/slug.js'
import s from './Create.module.css'

const STEPS = ['Name', 'Belonging', 'Review']

async function fetchByATag(aTag) {
  const parts = String(aTag).split(':')
  const slug = parts[parts.length - 1]
  const founder = parts.length >= 3 ? parts[1] : null
  return fetchCommunityDeclaration({ slug, preferredFounder: founder })
}

export default function Found() {
  const { viewer, signedIn, navigate, onJoin, onSignIn } = useOutletContext()
  const [searchParams] = useSearchParams()
  const parentATag = searchParams.get('from') || null

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [belongingBar, setBelongingBar] = useState('')
  const [baseline, setBaseline] = useState(null) // parent's resolved definition (fork only)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(null)
  const [signInState, setSignInState] = useState({ status: 'idle', error: null })

  // Fork: pre-fill from the parent's resolved definition.
  useEffect(() => {
    if (!parentATag) return
    let cancelled = false
    fetchByATag(parentATag)
      .then(parent => (parent ? resolveDefinition(parent, fetchByATag) : null))
      .then(resolved => {
        if (cancelled || !resolved) return
        setName(resolved.name || '')
        setPurpose(resolved.description || '')
        setBelongingBar(resolved.belongingBar || '')
        setBaseline({
          name: resolved.name || '',
          purpose: resolved.description || '',
          belongingBar: resolved.belongingBar || '',
        })
      })
      .catch(() => { /* parent unreachable — fall back to a blank found */ })
    return () => { cancelled = true }
  }, [parentATag])

  const forking = !!parentATag
  const parentSlug = parentATag ? String(parentATag).split(':').pop() : null

  async function handleFound() {
    if (!signedIn || !viewer || publishing) return
    const slug = slugify(name)
    if (!slug) {
      setPublishError('Please choose a name with at least one letter or number.')
      return
    }
    setPublishing(true)
    setPublishError(null)

    // Founding includes every field. Forking includes only fields the user
    // changed from the parent's resolved baseline — unchanged fields are
    // omitted so they inherit live from the parent (§26).
    const changed = (val, base) => (val || '').trim() !== (base || '').trim()
    const circle = { slug }
    if (!forking || !baseline || changed(name, baseline.name)) circle.name = name.trim()
    if (!forking || !baseline || changed(purpose, baseline.purpose)) circle.purpose = purpose.trim()
    if (!forking || !baseline || changed(belongingBar, baseline.belongingBar)) circle.belongingBar = belongingBar.trim()

    const unsigned = buildCommunityDeclaration({ viewerPubkey: viewer, circle, parentATag })
    const result = await publishEvent(unsigned)
    if (!result.ok) {
      setPublishing(false)
      setPublishError(publishErrorCopy(result))
      return
    }

    // Founding also publishes the circle's own tag-element (kind-39999) so its
    // default claim `39999:<founder>:<slug>` resolves to a real event for the
    // roster read (ADR 0030/0031). Dual-published so the read engine's host sees
    // it. A fork inherits the parent's claim, so it skips this. Best-effort:
    // the circle already exists (the CD published); a failed tag-element only
    // delays membership, so we log rather than fail the whole found.
    if (!forking) {
      const tagEl = buildTagElement({
        viewerPubkey: viewer,
        slug,
        name: circle.name || slug,
        description: circle.purpose || '',
      })
      const tagResult = await publishEvent(tagEl, { relays: MEMBERSHIP_WRITE_RELAYS })
      if (!tagResult.ok) {
        console.warn('[found] tag-element publish failed:', tagResult.error, tagResult.message)
      }
    }

    setPublishing(false)
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

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>{forking ? 'Fork a Circle' : 'Start a Circle'}</h1>
        <p className={s.subtitle}>Describe what it is and what it takes to belong. You are a peer here.</p>
      </header>

      {forking && (
        <div className={s.note}>
          Based on <strong>{parentSlug}</strong>. Every field starts inherited — edit only what you want to
          change. Unedited fields stay linked and update if the parent updates.
        </div>
      )}

      <StepProgress steps={STEPS} current={step} />

      {step === 0 && (
        <div className={s.step}>
          <FormInput
            label="What's your circle called?"
            value={name}
            onChange={setName}
            placeholder="e.g. Sunset Hikers, Code & Coffee"
            maxLength={64}
          />
          <FormInput
            label="What's it for?"
            value={purpose}
            onChange={setPurpose}
            placeholder="What brings people here? What will they find?"
            multiline
            rows={3}
            hint="People read this first. Be honest and inviting."
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
          <FormInput
            label="What does it take to belong?"
            value={belongingBar}
            onChange={setBelongingBar}
            placeholder="e.g. a few current members who trust you vouch you in"
            multiline
            rows={3}
            hint="This is the circle's rule, in plain words. Not a member list."
          />
          <Footer
            secondary={<Button variant="ghost" onClick={() => setStep(0)}>Back</Button>}
            primary={
              <Button variant="primary" disabled={!belongingBar.trim()} onClick={() => setStep(2)}>
                Continue
              </Button>
            }
          />
        </div>
      )}

      {step === 2 && (
        <div className={s.step}>
          <div className={s.reviewCard}>
            <h3 className={s.reviewTitle}>{name || 'Untitled Circle'}</h3>
            <p className={s.reviewDescription}>{purpose || 'No description'}</p>
            <div className={s.reviewMeta}>
              <strong>To belong:</strong> {belongingBar || 'Not set'}
            </div>
            {forking && (
              <p className={s.relayNote}>Stands on <code>{parentSlug}</code>; unedited fields inherit live.</p>
            )}
            <p className={s.relayNote}>
              Your circle will live on <code>communities.brainstorm.world</code> for now.
            </p>
          </div>
          <ViewCallout title="This creates your view of this circle">
            Others who stand on it form their own view. That is how a self-sustaining circle works.
          </ViewCallout>

          {signedIn ? (
            <>
              <Footer
                secondary={
                  <Button variant="ghost" onClick={() => setStep(1)} disabled={publishing}>Back</Button>
                }
                primary={
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleFound}
                    disabled={publishing || !name.trim()}
                  >
                    {publishing ? 'Publishing…' : (forking ? 'Create your fork' : 'Create your circle')}
                  </Button>
                }
              />
              {publishError && <p className={s.publishError} role="alert">{publishError}</p>}
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
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
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
