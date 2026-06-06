import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { OCCASIONS, loadPreferences, savePreference } from '../lib/notificationPrefs.js'
import s from './NotificationSettings.module.css'

/*
 * Notification preferences — the sovereignty control (ADR-0037).
 * Independent occasion toggles, everything off by default, no master switch.
 * Each toggle saves immediately (device-local); a failed save reverts and
 * offers retry. State is shown by switch position AND an On/Off text label.
 */
export default function NotificationSettings() {
  const { viewer, signedIn, onSignIn } = useOutletContext()
  const [prefs, setPrefs] = useState(() => loadPreferences(viewer))
  const [savedId, setSavedId] = useState(null)   // last occasion saved OK
  const [errorId, setErrorId] = useState(null)   // last occasion that failed

  // Re-hydrate when the identity changes (sign out → in as someone else) so we
  // never show one person's toggles while writes go to another's storage key.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(loadPreferences(viewer))
    setSavedId(null)
    setErrorId(null)
  }, [viewer])

  function applyToggle(id) {
    const nextVal = !prefs[id]
    const prev = prefs
    setPrefs({ ...prefs, [id]: nextVal })
    setErrorId(null)
    setSavedId(null)
    const result = savePreference(viewer, id, nextVal)
    if (result.ok) {
      setSavedId(id)
    } else {
      setPrefs(prev)        // revert to last saved position
      setErrorId(id)
    }
  }

  if (!signedIn) {
    return (
      <div className={s.page}>
        <h1 className={s.heading}>Notifications</h1>
        <p className={s.lede}>Sign in to choose what you hear about. It stays your choice.</p>
        <button type="button" className={s.signIn} onClick={onSignIn}>Sign in</button>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <h1 className={s.heading}>Notifications</h1>
      <p className={s.lede}>
        Choose what you hear about. Everything here is off until you turn it on. You can turn any of it off again.
      </p>

      <ul className={s.list}>
        {OCCASIONS.map(o => {
          const on = !!prefs[o.id]
          return (
            <li key={o.id} className={s.row}>
              <span className={s.label}>{o.label}</span>
              <span className={s.control}>
                {savedId === o.id && <span className={s.saved} aria-live="polite">Saved</span>}
                {errorId === o.id && (
                  <button type="button" className={s.retry} onClick={() => applyToggle(o.id)}>
                    Couldn&rsquo;t save. Retry?
                  </button>
                )}
                <span className={s.stateLabel}>{on ? 'On' : 'Off'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={o.label}
                  className={on ? `${s.switch} ${s.switchOn}` : s.switch}
                  onClick={() => applyToggle(o.id)}
                >
                  <span className={s.knob} aria-hidden="true" />
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
