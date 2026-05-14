import s from './SearchBar.module.css'

export default function SearchBar({ value, onChange, placeholder = 'Search by interest, passion, or vibe…' }) {
  return (
    <label className={s.wrap}>
      <svg
        className={s.icon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        className={s.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search circles"
      />
    </label>
  )
}
