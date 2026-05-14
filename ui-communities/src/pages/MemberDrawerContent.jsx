import Avatar from '../components/Avatar.jsx'
import TrustDot from '../components/TrustDot.jsx'
import Button from '../components/Button.jsx'
import { getCommunity, getMember } from '../data/mockData.js'
import { trustTier } from '../lib/format.js'
import s from './MemberDrawerContent.module.css'

export default function MemberDrawerContent({ memberId, communitySlug, vouchedSet, onVouch, signedIn }) {
  const m = getMember(memberId)
  const c = getCommunity(communitySlug)
  if (!m || !c) return null

  const vouchers = c.members
    .filter(id => id !== memberId)
    .slice(0, 5)
    .map(getMember)
    .filter(Boolean)
  const tier = trustTier(m.trust)
  const trustPct = Math.round(m.trust * 100)

  return (
    <div className={s.root}>
      <header className={s.head}>
        <Avatar member={m} size={64} glow />
        <div className={s.headText}>
          <h2 className={s.name}>{m.name}</h2>
          <p className={s.handle}>@{m.handle}</p>
          <p className={s.trustLine}>
            <TrustDot level={m.trust} size={8} />
            <span>Trusted by {m.vouchedBy} people in this circle</span>
          </p>
        </div>
      </header>

      <section className={s.standing}>
        <span className={s.eyebrow}>Standing in this circle</span>
        <div className={s.barWrap}>
          <div className={s.bar} style={{ width: `${trustPct}%` }} />
        </div>
        <div className={s.tier}>
          <span className={s[`tier_${tier.tone}`]}>{tier.label}</span>
          <span className={s.pct}>{trustPct}%</span>
        </div>
      </section>

      <section className={s.section}>
        <span className={s.eyebrow}>Vouched by</span>
        <ul className={s.voucherList}>
          {vouchers.map(v => (
            <li key={v.id} className={s.voucherRow}>
              <Avatar member={v} size={28} />
              <span className={s.voucherName}>{v.name}</span>
              <TrustDot level={v.trust} size={6} />
            </li>
          ))}
        </ul>
      </section>

      {signedIn && (
        <footer className={s.footer}>
          <Button
            variant={vouchedSet.has(m.id) ? 'success' : 'primary'}
            size="lg"
            className={s.vouchBtn}
            onClick={() => onVouch(m.id)}
          >
            {vouchedSet.has(m.id) ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                You vouched
              </>
            ) : 'Vouch for this person'}
          </Button>
          <Button variant="danger" size="lg">Raise a concern</Button>
        </footer>
      )}
    </div>
  )
}
