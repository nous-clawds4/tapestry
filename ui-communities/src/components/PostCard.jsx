import Avatar from './Avatar.jsx'
import { getMember } from '../data/mockData.js'
import { getAvatarBg, getInitials, npubShort, relativeTime } from '../lib/format.js'
import s from './PostCard.module.css'

/*
 * PostCard — renders a single post.
 *
 * Accepts both shapes:
 * - Slice 6 fetch shape:  { id, author, content, createdAt }   (author may be hex)
 * - Legacy mock shape:    { author, text, time }               (author is an m-id)
 *
 * When `author` resolves to a known member (mock or kind-0 profile in the
 * future), we render their name + Avatar. When it's a raw hex pubkey we
 * fall back to an `npubShort` handle in a deterministically-colored disc
 * (no kind-0 lookup until Slice 2 NB-1 lands).
 *
 * `pending` flips the post into a soft, slightly-dimmed state with a
 * "Sending…" indicator; `error` shows an inline retry affordance.
 */
export default function PostCard({
  post, pending = false, error = null, onRetry = null, onReply = null, replyHint = null,
  reactionCount = 0, reactionMine = false, canReact = false, onToggleReaction = null,
}) {
  if (!post) return null
  const content = post.content || post.text || ''
  const timeLabel =
    post._mockTime || post.time ||
    (typeof post.createdAt === 'number' ? relativeTime(post.createdAt) : '')

  const member = getMember(post.author)

  return (
    <article className={pending ? `${s.post} ${s.pending}` : s.post}>
      <header className={s.meta}>
        {member ? (
          <Avatar member={member} size={32} />
        ) : (
          <HexAvatar pubkey={post.author} />
        )}
        <span className={s.author}>
          {member ? member.name : npubShort(post.author)}
        </span>
        {timeLabel && (
          <>
            <span className={s.dot} aria-hidden="true">·</span>
            <span className={s.time}>{timeLabel}</span>
          </>
        )}
        {pending && (
          <span className={s.pendingTag} aria-live="polite">Sending…</span>
        )}
      </header>
      <p className={s.body}>{content}</p>
      {(onToggleReaction || onReply || replyHint) && (
        <div className={s.actions}>
          {onToggleReaction && (
            <button
              type="button"
              className={reactionMine ? `${s.reactBtn} ${s.reactMine}` : s.reactBtn}
              onClick={onToggleReaction}
              aria-pressed={reactionMine}
              title={canReact ? (reactionMine ? 'Remove your reaction' : 'React') : 'React'}
              aria-label={`${reactionCount} like reaction${reactionCount === 1 ? '' : 's'}${reactionMine ? ', you reacted' : ''}`}
            >
              <span aria-hidden="true">▲</span> {reactionCount}
            </button>
          )}
          {onReply ? (
            <button type="button" className={s.replyBtn} onClick={onReply}>Reply</button>
          ) : (
            replyHint && <span className={s.replyHint}>{replyHint}</span>
          )}
        </div>
      )}
      {error && (
        <div className={s.errorRow} role="alert">
          <span className={s.errorText}>{error}</span>
          {onRetry && (
            <button type="button" className={s.retryBtn} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function HexAvatar({ pubkey }) {
  const label = npubShort(pubkey)
  const initial = (pubkey || '?').slice(0, 2).toUpperCase()
  return (
    <span
      className={s.hexAvatar}
      style={{ background: getAvatarBg(pubkey || 'unknown') }}
      aria-label={label}
      title={label}
    >
      {getInitials(initial)}
    </span>
  )
}
