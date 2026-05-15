import Avatar from './Avatar.jsx'
import TrustDot from './TrustDot.jsx'
import Button from './Button.jsx'
import { getMember, getVoucherNames } from '../data/mockData.js'
import s from './MemberRow.module.css'

export default function MemberRow({ member, communitySlug, isVouched, onVouch, onOpen, showVouch = true }) {
  const m = typeof member === 'string' ? getMember(member) : member
  if (!m) return null

  const vouchers = getVoucherNames(m.id, communitySlug)
  const lead = vouchers[0]
  const others = m.vouchedBy - 1
  const vouchLine = lead
    ? `Welcomed by ${lead}${others > 0 ? ` + ${others} other${others === 1 ? '' : 's'}` : ''}`
    : `${m.vouchedBy} people vouch`

  return (
    <div className={s.row} data-testid="member-row">
      <button
        type="button"
        className={s.identity}
        onClick={() => onOpen?.(m.id)}
        aria-label={`Open ${m.name}'s details`}
      >
        <Avatar member={m} size={40} glow />
        <span className={s.text}>
          <span className={s.name}>{m.name}</span>
          <span className={s.subline}>
            <TrustDot level={m.trust} size={7} />
            <span>{vouchLine}</span>
          </span>
        </span>
      </button>
      {showVouch && (
        <Button
          size="sm"
          variant={isVouched ? 'success' : 'secondary'}
          onClick={() => onVouch?.(m.id)}
          aria-pressed={isVouched}
        >
          {isVouched ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Vouched
            </>
          ) : 'Vouch'}
        </Button>
      )}
    </div>
  )
}
