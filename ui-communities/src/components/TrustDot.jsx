import s from './TrustDot.module.css'

/*
 * Trust indicator dot. Color is brand accent; the visual cue scales with
 * the level so high-trust members carry a faint halo. Color alone is
 * never the only signal — components that use TrustDot pair it with
 * adjacent text (see MemberRow / MemberDrawerContent).
 */
export default function TrustDot({ level = 0, size = 8 }) {
  const opacity = 0.35 + level * 0.65
  const glowSize = level > 0.7 ? Math.round(level * 10) : 0
  return (
    <span
      className={s.dot}
      style={{
        width: size,
        height: size,
        opacity,
        boxShadow: glowSize ? `0 0 ${glowSize}px var(--accent-glow)` : 'none',
      }}
      role="presentation"
    />
  )
}
