import Avatar from './Avatar.jsx'
import { getMember } from '../data/mockData.js'
import s from './PostCard.module.css'

export default function PostCard({ post }) {
  const m = getMember(post.author)
  if (!m) return null
  return (
    <article className={s.post}>
      <header className={s.meta}>
        <Avatar member={m} size={32} />
        <span className={s.author}>{m.name}</span>
        <span className={s.dot} aria-hidden="true">·</span>
        <span className={s.time}>{post.time}</span>
      </header>
      <p className={s.body}>{post.text}</p>
    </article>
  )
}
