import { useState } from 'react'
import { getAvatarBg, getInitials, npubShort } from '../lib/format.js'
import s from './ProfileAvatar.module.css'

/*
 * ProfileAvatar — renders a kind-0 picture URL if we have one, with a
 * deterministically-colored disc + initials fallback for:
 *   - no picture in the profile
 *   - picture URL that 404s / fails to load
 *   - no profile at all yet (pre-fetch)
 *
 * `pubkey` is the canonical identity. `profile` is the kind-0 metadata
 * (may be null while loading). Color hash + initials fall back to the
 * pubkey so the same hex always produces the same disc, even before
 * the profile fetch resolves.
 */
export default function ProfileAvatar({ pubkey, profile, size = 32, glow = false }) {
  const [imgFailed, setImgFailed] = useState(false)

  const displayName = (profile && (profile.display_name || profile.name)) || ''
  const initialsSource = displayName || npubShort(pubkey || '') || '·'
  const initials = displayName ? getInitials(displayName) : initialsSource.slice(5, 7).toUpperCase()
  const fontSize = Math.max(11, Math.round(size * 0.36))
  const bg = getAvatarBg(pubkey || 'unknown')

  const showImage = profile && profile.picture && !imgFailed

  return (
    <span
      className={s.avatar}
      style={{
        width: size,
        height: size,
        background: showImage ? 'transparent' : bg,
        fontSize,
        boxShadow: glow ? `0 0 ${size * 0.18}px ${size * 0.09}px var(--accent-glow)` : undefined,
      }}
      aria-label={displayName || npubShort(pubkey || '')}
      title={displayName || npubShort(pubkey || '')}
    >
      {showImage ? (
        <img
          className={s.img}
          src={profile.picture}
          alt=""
          onError={() => setImgFailed(true)}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        initials
      )}
    </span>
  )
}
