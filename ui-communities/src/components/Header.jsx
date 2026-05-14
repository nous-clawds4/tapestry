import { useState } from 'react'
import BrainstormMark from './BrainstormMark.jsx'
import s from './Header.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Discover' },
  { to: '/my-circles', label: 'Your Circles', requiresAuth: true },
  { to: '/create', label: 'Start a Circle', requiresAuth: true },
]

export default function Header({ signedIn, pathname, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const visible = NAV_ITEMS.filter(item => !item.requiresAuth || signedIn)

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
              >
                <span className={s.userAvatar} aria-hidden="true">SC</span>
                <span className={s.userName}>Sarah</span>
              </button>
              {menuOpen && (
                <div className={s.userDropdown} role="menu">
                  <div className={s.userMeta}>Signed in as Sarah Chen</div>
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
                  <button type="button" className={s.userItemMuted} role="menuitem">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className={s.signInBtn}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
