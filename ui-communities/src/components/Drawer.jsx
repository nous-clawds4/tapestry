import { useEffect } from 'react'
import s from './Drawer.module.css'

export default function Drawer({ open, onClose, children, ariaLabel = 'Member details' }) {
  // Lock background scroll while the drawer is open + ESC closes.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={s.root} data-testid="member-drawer" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className={s.overlay} data-testid="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className={s.panel}>
        <button
          type="button"
          className={s.close}
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className={s.content}>{children}</div>
      </aside>
    </div>
  )
}
