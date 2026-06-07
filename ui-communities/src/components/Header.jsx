import { useEffect, useState } from 'react'
import BrainstormMark from './BrainstormMark.jsx'
import ProfileAvatar from './ProfileAvatar.jsx'
import { npubFull, npubShort } from '../auth/viewer.js'
import { signInErrorCopy } from '../lib/errors.js'
import { fetchProfile, getCachedProfile } from '../lib/profiles.js'
import s from './Header.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Discover' },
  { to: '/my-circles', label: 'Your Circles', requiresAuth: true },
  { to: '/found', label: 'Start a Circle', requiresAuth: true },
]

export default function Header({ viewer, signedIn, pathname, onNavigate, onSignIn, onSignOut, notificationsHasNew = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [signInState, setSignInState] = useState({ status: 'idle', error: null })
  const [copied, setCopied] = useState(false)
  const [profile, setProfile] = useState(() => (signedIn ? getCachedProfile(viewer) : null))
  const visible = NAV_ITEMS.filter(item => !item.requiresAuth || signedIn)

  const viewerNpub = signedIn ? npubFull(viewer) : ''
  const viewerNpubShort = signedIn ? npubShort(viewer) : ''
  const viewerDisplayName = profile && (profile.display_name || profile.name) || ''

  // Fetch the viewer's kind-0 profile after sign-in so the header
  // can render a real picture + display name instead of the bare npub.
  useEffect(() => {
    if (!signedIn || !viewer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(null)
      return
    }
    let cancelled = false
    fetchProfile(viewer).then(p => {
      if (!cancelled) setProfile(p)
    })
    return () => { cancelled = true }
  }, [signedIn, viewer])

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
                title={viewerDisplayName || viewerNpub}
              >
                <ProfileAvatar pubkey={viewer} profile={profile} size={28} />
                <span className={s.userName}>
                  {viewerDisplayName || viewerNpubShort}
                </span>
              </button>
              {menuOpen && (
                <div className={s.userDropdown} role="menu">
                  <div className={s.userMeta} title={viewerNpub}>
                    {viewerDisplayName ? (
                      <>
                        Signed in as <strong className={s.userDisplayName}>{viewerDisplayName}</strong>
                        <span className={s.userNpubLine}>
                          <code className={s.userNpub}>{viewerNpubShort}</code>
                        </span>
                      </>
                    ) : (
                      <>Signed in as <code className={s.userNpub}>{viewerNpubShort}</code></>
                    )}
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
                    onClick={() => { onNavigate('/found'); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    Start a Circle
                  </button>
                  <button
                    type="button"
                    className={s.userItem}
                    onClick={() => { onNavigate('/notifications'); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    Notifications
                    {notificationsHasNew && (
                      <>
                        <span className={s.notifDot} aria-hidden="true" />
                        <span className={s.srOnly}> new updates</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={s.userItem}
                    onClick={() => { onNavigate('/settings'); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    Notification settings
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

