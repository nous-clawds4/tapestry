import Button from './Button.jsx'
import s from './FetchError.module.css'

/*
 * FetchError — page-level error block shown when an API fetch fails.
 *
 * Visually distinct from the "Nothing matches your search" empty state so
 * users can tell the difference between "no data exists" and "we couldn't
 * reach the network". Uses --danger-muted for the left border (signals
 * failure without shouting) and the primary Button for the Retry action.
 */
export default function FetchError({ onRetry, message }) {
  return (
    <div className={s.block} role="alert">
      <div className={s.icon} aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      {/* canonical brand copy: "couldn't reach" */}
      <h2 className={s.title}>{`We couldn't reach the circle network.`}</h2>
      <p className={s.copy}>
        {message || 'Check your connection and try again.'}
      </p>
      <Button variant="primary" onClick={onRetry}>Retry</Button>
    </div>
  )
}
