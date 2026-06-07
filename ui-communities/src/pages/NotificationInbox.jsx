import { useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { notificationSentence } from '../lib/notifications.js'
import { npubShort, relativeTime } from '../lib/format.js'
import s from './NotificationInbox.module.css'

/*
 * Notification inbox (ADR-0038). A calm list of things that happened involving
 * the viewer, derived app-side and gated by their preferences. Opening clears
 * the new-marker. In-app only; no count badge, no nag.
 */
export default function NotificationInbox() {
  const {
    signedIn, onSignIn,
    notifications = [], notificationsStatus, markNotificationsSeen, reloadNotifications,
  } = useOutletContext()

  // Opening the inbox clears the new-marker.
  useEffect(() => {
    if (signedIn && markNotificationsSeen) markNotificationsSeen()
  }, [signedIn, markNotificationsSeen])

  if (!signedIn) {
    return (
      <div className={s.page}>
        <h1 className={s.heading}>Notifications</h1>
        <p className={s.lede}>Sign in to see what happened involving you.</p>
        <button type="button" className={s.signIn} onClick={onSignIn}>Sign in</button>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <h1 className={s.heading}>Notifications</h1>

      {notificationsStatus === 'error' && (
        <div className={s.state} role="alert">
          <span>We couldn&rsquo;t load your updates.</span>
          <button type="button" className={s.retry} onClick={reloadNotifications}>Retry</button>
        </div>
      )}

      {notifications.length === 0 && notificationsStatus !== 'error' && (
        <p className={s.empty}>
          Nothing new. When someone vouches for you or a circle you&rsquo;re in gets active, it shows up here.
        </p>
      )}

      <ul className={s.list}>
        {notifications.map(n => {
          const line = notificationSentence(n, n.actor ? npubShort(n.actor) : null)
          const when = typeof n.createdAt === 'number' ? relativeTime(n.createdAt) : ''
          const body = (
            <>
              <span className={s.sentence}>{line}</span>
              {when && <span className={s.time}>{when}</span>}
            </>
          )
          return (
            <li key={n.id} className={s.row}>
              {n.sourceSlug
                ? <Link to={`/community/${n.sourceSlug}`} className={s.link}>{body}</Link>
                : <span className={s.link}>{body}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
