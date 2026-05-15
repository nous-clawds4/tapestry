import s from './FormInput.module.css'

export default function FormInput({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  hint,
  rows = 3,
  ...rest
}) {
  return (
    <div className={s.field}>
      {label && <label className={s.label}>{label}</label>}
      {multiline ? (
        <textarea
          className={s.textarea}
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          {...rest}
        />
      ) : (
        <input
          className={s.input}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          {...rest}
        />
      )}
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  )
}
