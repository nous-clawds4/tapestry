import { getMember } from '../data/mockData.js'
import { getAvatarBg, getInitials } from '../lib/format.js'
import s from './Avatar.module.css'

/*
 * Avatar — initials in a deterministically-colored disc.
 * `glow` strength is proportional to trust, so the most-trusted members
 * carry a quiet halo. Halo color comes from --accent-glow.
 */
export default function Avatar({ member, size = 36, glow = false }) {
  const m = typeof member === 'string' ? getMember(member) : member
  if (!m) return null

  const fontSize = Math.max(11, Math.round(size * 0.36))
  const glowStrength = glow ? Math.max(2, m.trust * 8) : 0

  return (
    <span
      className={s.avatar}
      style={{
        width: size,
        height: size,
        background: getAvatarBg(m.id),
        fontSize,
        boxShadow: glow
          ? `0 0 ${glowStrength}px ${glowStrength / 2}px var(--accent-glow)`
          : undefined,
      }}
      aria-label={m.name}
      title={m.name}
    >
      {getInitials(m.name)}
    </span>
  )
}
