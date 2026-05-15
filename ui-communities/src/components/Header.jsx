import { useState } from 'react'
import BrainstormMark from './BrainstormMark.jsx'
import { npubFull, npubShort } from '../auth/viewer.js'
import { signInErrorCopy } from '../lib/errors.js'
import s from './Header.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Discover' },
  { to: '/my-circles', label: 'Your Circles', requiresAuth: true },
  { to: '/create', label: 'Start a Circle', requiresAuth: true },
]

export default function Header({ viewer, signedIn, pathname, onNavigate, onSignIn, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [signInState, setSignInState] = useState({ status: 'idle', error: null })
  const [copied, setCopied] = useState(false)
  const visible = NAV_ITEMS.filter(item => !item.requiresAuth || signedIn)

  const viewerNpub = signedIn ? npubFull(viewer) : ''
  const viewerNpubShort = signedIn ? npubShort(viewer) : ''
  const avatarInitials = viewerNpubShort ? viewerNpubShort.slice(5, 7).toUpperCase() : '··'

  async function handleSignInClick() {
    setSignInState({ status: 'pending', error: null })
    const result = await onSignIn()
    if (!result || result.ok === false) {
      setSignInState({
        status: 'error',
        error: signInErrorCopy(result && result.error),
      })
    } else {
      setSignInState({ status: 'idle', error: null })
    }
  }

  async function handleCopyNpub() {
    try {
      await navigator.clipboard.writeText(viewerNpub)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard API blocked — silently fail.
    }
  }

  return (
    <header className={s.header}>
      <div className={s.inner}>
        <button
          type="button"
          className={s.brand}
          onClick={() => onNavigate('/')}
          aria-label="Brainstorm Communities home"
        >
          <BrainstormMark variant="mark" size={28} className={s.mark} />
          <span className={s.wordmark}>
            <span className={s.brandName}>Brainstorm</span>
            <span className={s.divider} aria-hidden="true" />
            <span className={s.subBrand}>Communities</span>
          </span>
        </button>

        <nav className={s.nav} aria-label="Primary">
          {visible.map(item => {
            const active = item.to === pathname || (item.to === '/' && pathname === '/')
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => onNavigate(item.to)}
                className={active ? `${s.navItem} ${s.navItemActive}` : s.navItem}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className={s.right}>
          <a
            className={s.crossLink}
            href="https://brainstorm.world"
            target="_blank"
            rel="noopener noreferrer"
            title="Brainstorm Search"
          >
            <span className={s.crossArrow} aria-hidden="true">↗</span>
            <span className={s.crossLabel}>Brainstorm Search</span>
          </a>

          {signedIn ? (
            <div className={s.userMenu}>
              <button
                type="button"
                className={s.userTrigger}
                onClick={() => setMenuOpen(o => !o)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                title={viewerNpub}
              >
                <span className={s.userAvatar} aria-hidden="true">{avatarInitials}</span>
                <span className={s.userName}>{viewerNpubShort}</span>
              </button>
              {menuOpen && (
                <div className={s.userDropdown} role="menu">
                  <div className={s.userMeta} title={viewerNpub}>
                    Signed in as <code className={s.userNpub}>{viewerNpubShort}</code>
                  </div>
                  <button
                    type="button"
                    className={s.userItem}
                    onClick={() => { onNavigate('/'); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    Discover
                  </button>
                  <button
                    type="button"
                    className={s.userItem}
                    onClick={() => { onNavigate('/my-circles'); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    Your Circles
                  </button>
                  <button
                    type="button"
                    className={s.userItem}
                    onClick={() => { onNavigate('/create'); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    Start a Circle
                  </button>
                  <button
                    type="button"
                    className={s.userItem}
                    onClick={handleCopyNpub}
                    role="menuitem"
                  >
                    {copied ? 'Copied!' : 'Copy npub'}
                  </button>
                  <button
                    type="button"
                    className={s.userItemMuted}
                    onClick={() => { onSignOut(); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={s.signInBlock}>
              <button
                type="button"
                className={s.signInBtn}
                onClick={handleSignInClick}
                disabled={signInState.status === 'pending'}
              >
                {signInState.status === 'pending' ? 'Signing in…' : 'Sign in'}
              </button>
              {signInState.status === 'error' && (
                <p className={s.signInError} role="alert">{signInState.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

