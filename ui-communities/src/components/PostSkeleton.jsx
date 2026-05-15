import s from './PostSkeleton.module.css'

/*
 * PostSkeleton — placeholder for an in-flight kind-1 fetch.
 * Mirrors PostCard's metadata-row + body-paragraph layout so real
 * posts drop into place without layout shift (CLS = 0).
 */
export default function PostSkeleton({ delay = 0 }) {
  return (
    <div
      className={s.post}
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden="true"
    >
      <div className={s.meta}>
        <span className={s.avatar} />
        <span className={s.author} />
        <span className={s.time} />
      </div>
      <div className={s.body}>
        <span className={s.lineLong} />
        <span className={s.lineMed} />
      </div>
    </div>
  )
}
