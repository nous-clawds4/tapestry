import { useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import s from './ConcernDialog.module.css'

/*
 * ConcernDialog — confirmation modal for "Raise a concern" (a kind-39999
 * veto signal). Surfaces an optional comments textarea (max 280 chars, per
 * the firmware schema's optional `comments` tag). Submit fires the publish;
 * Cancel and ESC dismiss without sending anything.
 *
 * Centered modal, NOT the right-side Drawer — different UX (confirmation,
 * not exploration), so it gets its own component.
 */
export default function ConcernDialog({ open, memberName, onCancel, onConfirm, busy }) {
  const [comments, setComments] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!open) {
      // Reset textarea when the dialog closes so a future re-open starts
      // empty. The React 19 rule flags setState-in-effect; this is a
      // legitimate "side effect on close transition" case.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComments('')
      return
    }
    // Lock background scroll while the dialog is open + focus the textarea
    // so the keyboard lands somewhere useful immediately.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => { textareaRef.current?.focus() }, 50)
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onCancel, busy])

  if (!open) return null

  const remaining = 280 - comments.length

  return (
    <div className={s.root} role="dialog" aria-modal="true" aria-labelledby="concern-title">
      <div className={s.overlay} onClick={busy ? undefined : onCancel} aria-hidden="true" />
      <div className={s.panel}>
        <h2 className={s.title} id="concern-title">Raise a concern about {memberName || 'this person'}</h2>
        <p className={s.copy}>
          Your concern signs a public signal that other members can see. It carries
          weight when other members trust you, and contributes nothing when they don&apos;t.
        </p>
        <label className={s.field}>
          <span className={s.label}>Why? <span className={s.optional}>(optional)</span></span>
          <textarea
            ref={textareaRef}
            className={s.textarea}
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Share context if it helps. Other members will see this."
            maxLength={280}
            rows={4}
            disabled={busy}
          />
          <span className={s.counter}>{remaining} characters left</span>
        </label>
        <div className={s.actions}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(comments.trim() || null)}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Raise concern'}
          </Button>
        </div>
      </div>
    </div>
  )
}
