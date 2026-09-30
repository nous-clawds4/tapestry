import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrainstormUserMenu from '../../components/BrainstormUserMenu';

/**
 * The frame of the /dictionary pages, in the styling of the owner's Claude Design mock (the
 * Brainstorm mock in docs/DICTIONARY_PAGE_HANDOFF.md, account menu → Dictionary): a light page,
 * a sticky bar with the Brainstorm wordmark on the left, the top bar's alert centred and the
 * avatar menu on the right, and a 720px reading column.
 *
 * The bar's right-hand side is the app's own BrainstormUserMenu, which brings the Setup Alert and
 * the Assistant Alert with it, so this frame adds no second copy of either. `.bsd-nav-auth` is
 * `display: contents` (styles.css), which lets the bar's grid centre whichever alert shows and keep
 * the avatar, or the sign-in button, at the right edge.
 */
export default function DictionaryShell({ children }) {
  const { user, login, logout } = useAuth();
  return (
    <div className="bsd-page">
      <header className="bsd-nav">
        <div className="bsd-nav-inner">
          <Link to="/" className="bsd-logo" aria-label="Brainstorm home">
            <img src="/brainstorm-wordmark.svg" alt="" draggable="false" />
          </Link>
          <div className="bsd-nav-auth">
            <BrainstormUserMenu user={user} login={login} logout={logout} />
          </div>
        </div>
      </header>
      <main className="bsd-main">{children}</main>
    </div>
  );
}

/**
 * The design's section label: a small cyan mono word and a rule. Hidden from screen readers: it
 * repeats the page's h1, and its pale cyan is decoration rather than text to read.
 */
export function Eyebrow({ children }) {
  return (
    <div className="bsd-eyebrow" aria-hidden="true">
      <span>{children}</span>
      <span className="bsd-eyebrow-rule" />
    </div>
  );
}
