import s from './StepProgress.module.css'

export default function StepProgress({ steps, current }) {
  return (
    <ol className={s.row} role="list">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className={s.step}>
            {i > 0 && (
              <span
                className={done ? `${s.bar} ${s.barDone}` : s.bar}
                aria-hidden="true"
              />
            )}
            <div className={s.node}>
              <span
                className={[
                  s.dot,
                  done ? s.dotDone : null,
                  active ? s.dotActive : null,
                ].filter(Boolean).join(' ')}
                aria-current={active ? 'step' : undefined}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <span className={s.num}>{i + 1}</span>
                )}
              </span>
              <span
                className={
                  active ? `${s.label} ${s.labelActive}` : done ? `${s.label} ${s.labelDone}` : s.label
                }
              >
                {label}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
