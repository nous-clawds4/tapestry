import s from './CardSkeleton.module.css'

/*
 * CardSkeleton — a community-card-shaped placeholder rendered during fetch.
 * Mirrors CommunityCard's layout so the real cards drop into place without
 * layout shift when the fetch resolves (CLS = 0).
 */
export default function CardSkeleton({ delay = 0 }) {
  return (
    <div
      className={s.card}
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden="true"
    >
      <span className={s.accentBar} />
      <div className={s.body}>
        <div className={s.title} />
        <div className={s.lineLong} />
        <div className={s.lineMed} />
        <div className={s.tagRow}>
          <span className={s.tag} />
          <span className={s.tag} />
        </div>
        <div className={s.footer}>
          <div className={s.avatarStack}>
            <span className={s.avatar} />
            <span className={s.avatar} />
            <span className={s.avatar} />
          </div>
          <span className={s.count} />
        </div>
      </div>
    </div>
  )
}
