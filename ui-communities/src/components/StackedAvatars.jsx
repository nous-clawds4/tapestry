import Avatar from './Avatar.jsx'
import s from './StackedAvatars.module.css'

export default function StackedAvatars({ memberIds, max = 4, size = 26 }) {
  const shown = memberIds.slice(0, max)
  const overflow = Math.max(0, memberIds.length - max)
  return (
    <span className={s.stack}>
      {shown.map((id, i) => (
        <span
          key={id}
          className={s.item}
          style={{ marginLeft: i === 0 ? 0 : -size * 0.3, zIndex: max - i }}
        >
          <Avatar member={id} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={s.overflow}
          style={{ marginLeft: -size * 0.3, width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}
