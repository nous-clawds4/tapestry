import { Link } from 'react-router-dom'
import BrainstormMark from '../components/BrainstormMark.jsx'
import s from './NotFound.module.css'

export default function NotFound() {
  return (
    <div className={s.page}>
      <BrainstormMark variant="mark" size={88} className={s.mark} />
      <h1 className={s.title}>We can&apos;t find that circle.</h1>
      <p className={s.copy}>
        It may have moved. It may also be outside your trust network.
      </p>
      <Link to="/" className={s.cta}>
        ← Back to Discover
      </Link>
    </div>
  )
}
