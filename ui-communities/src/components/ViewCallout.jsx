import s from './ViewCallout.module.css'

/*
 * ViewCallout — the "Your view" framing surface.
 *
 * Brainstorm Communities is built on a personal-projection pattern:
 * there is no canonical community-record anywhere. Each user's record
 * is a personal view, and the community-as-thing is the convergent
 * overlap of all participants' records. This callout is how we make
 * that pattern legible in the UI, especially on the Edit screen.
 */
export default function ViewCallout({ title = 'Your view of this circle', children }) {
  return (
    <aside className={s.callout} role="note">
      <span className={s.eyebrow} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <div className={s.body}>
        <strong className={s.title}>{title}.</strong>{' '}
        <span className={s.copy}>
          {children || (
            <>These settings are personal to you. Other members have their own view — edits here don&apos;t change theirs.</>
          )}
        </span>
      </div>
    </aside>
  )
}
