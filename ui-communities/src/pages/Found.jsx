import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import FormInput from '../components/FormInput.jsx'
import StepProgress from '../components/StepProgress.jsx'
import ViewCallout from '../components/ViewCallout.jsx'
// The "right way" found flow (ADR 0029): founding writes a Community
// Declaration (kind 39998), distinct from the frozen bespoke Create flow.
// New code path, strangler-clean — Create.jsx is left untouched.
import { buildCommunityDeclaration } from '../events/declaration.js'
import { publishEvent } from '../events/publish.js'
import { publishErrorCopy, signInErrorCopy } from '../lib/errors.js'
import { slugify } from '../lib/slug.js'
import s from './Create.module.css'

const STEPS = ['Name', 'Belonging', 'Review']

export default function Found() {
  const { viewer, signedIn, navigate, onJoin, onSignIn } = useOutletContext()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [belongingBar, setBelongingBar] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(null)
  const [signInState, setSignInState] = useState({ status: 'idle', error: null })

  async function handleFound() {
    if (!signedIn || !viewer || publishing) return
    const slug = slugify(name)
    if (!slug) {
      setPublishError('Please choose a name with at least one letter or number.')
      return
    }
    setPublishing(true)
    setPublishError(null)
    const circle = {
      slug,
      name: name.trim(),
      purpose: purpose.trim(),
      belongingBar: belongingBar.trim(),
    }
    const result = await publishEvent(buildCommunityDeclaration({ viewerPubkey: viewer, circle }))
    setPublishing(false)
    if (!result.ok) {
      setPublishError(publishErrorCopy(result))
      return
    }
    // The founder is a peer who belongs to the circle they declared.
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
        <h1 className={s.title}>Start a Circle</h1>
        <p className={s.subtitle}>Describe what it is and what it takes to belong. You are a peer here.</p>
      </header>

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
                    {publishing ? 'Publishing…' : 'Create your circle'}
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
