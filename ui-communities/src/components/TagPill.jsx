import { getTag } from '../data/mockData.js'
import s from './TagPill.module.css'

export default function TagPill({ tag, active, onClick, small }) {
  const t = typeof tag === 'string' ? getTag(tag) : tag
  if (!t) return null
  const cls = [
    s.pill,
    small ? s.small : null,
    active ? s.active : null,
    onClick ? s.clickable : null,
  ].filter(Boolean).join(' ')

  if (!onClick) {
    return <span className={cls}>{t.label}</span>
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={() => onClick(t.id)}
      aria-pressed={active}
    >
      {t.label}
    </button>
  )
}
