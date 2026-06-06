import s from './TrustSignal.module.css'

/*
 * Trust Signal — the load-bearing component (design guide §"Trust Signal").
 * A compact cluster: a short row of overlapping member avatars + a line of text.
 *
 *   personalPov true  → "N people you trust are inside" (--accent)
 *   personalPov false → "N established members" (--text-secondary), and when the
 *                       viewer is signed out, a quiet "Sign in to see who you trust" hint.
 *
 * v1 always passes personalPov=false: the roster is computed from the house PoV
 * (per-viewer PoV needs WoT provisioning on the read host). The flag flips to
 * true automatically when that lands — the copy is already wired for it.
 *
 * Renders fully with no account (read-only first visit is first-class).
 */

function initials(name, pubkey) {
  const base = (name || '').trim()
  if (base) return base.slice(0, 2).toUpperCase()
  return (pubkey || '?').slice(0, 2).toUpperCase()
}

export default function TrustSignal({ members = [], personalPov = false, signedIn = false }) {
  const n = members.length
  const shown = members.slice(0, 5)

  return (
    <div className={s.cluster}>
      {n > 0 && (
        <div className={s.avatars} aria-hidden="true">
          {shown.map((m, i) => (
            <span key={m.pubkey} className={s.avatar} style={{ zIndex: shown.length - i }}>
              {m.picture
                ? <img src={m.picture} alt="" className={s.avatarImg} loading="lazy" />
                : <span className={s.avatarFallback}>{initials(m.displayName, m.pubkey)}</span>}
            </span>
          ))}
        </div>
      )}
      <div className={s.text}>
        {personalPov ? (
          <span className={s.trustLine}>
            {n} {n === 1 ? 'person you trust is' : 'people you trust are'} inside
          </span>
        ) : (
          <>
            <span className={s.houseLine}>
              {n} established {n === 1 ? 'member' : 'members'}
            </span>
            {!signedIn && (
              <span className={s.hint}>Sign in to see who you trust</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
