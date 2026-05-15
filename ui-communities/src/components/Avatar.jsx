import { useState } from 'react'
import { getMember } from '../data/mockData.js'
import { getAvatarBg, getInitials } from '../lib/format.js'
import s from './Avatar.module.css'

/*
 * Avatar — initials in a deterministically-colored disc, OR a real
 * kind-0 picture when the member object carries one (relay-sourced
 * members from the Slice 2 NB-4 fallback). Picture URLs that fail to
 * load fall back to the initials disc.
 *
 * `glow` strength is proportional to trust, so the most-trusted members
 * carry a quiet halo. Halo color comes from --accent-glow.
 */
export default function Avatar({ member, size = 36, glow = false }) {
  const m = typeof member === 'string' ? getMember(member) : member
  const [imgFailed, setImgFailed] = useState(false)
  if (!m) return null

  const fontSize = Math.max(11, Math.round(size * 0.36))
  const trust = typeof m.trust === 'number' ? m.trust : 0.5
  const glowStrength = glow ? Math.max(2, trust * 8) : 0
  const hasPicture = m.picture && !imgFailed

  return (
    <span
      className={s.avatar}
      style={{
        width: size,
        height: size,
        background: hasPicture ? 'transparent' : getAvatarBg(m.id),
        fontSize,
        boxShadow: glow
          ? `0 0 ${glowStrength}px ${glowStrength / 2}px var(--accent-glow)`
          : undefined,
      }}
      aria-label={m.name}
      title={m.name}
    >
      {hasPicture ? (
        <img
          src={m.picture}
          alt=""
          onError={() => setImgFailed(true)}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        getInitials(m.name)
      )}
    </span>
  )
}
