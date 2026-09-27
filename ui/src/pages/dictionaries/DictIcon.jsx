/**
 * The small inline icons of the Dictionary design reference (handoff mock).
 * They are decorative (aria-hidden) and take the surrounding text colour.
 */
export default function DictIcon({ name, size = 14 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
  };
  switch (name) {
    case 'chevron':
      return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    case 'search':
      return <svg {...common} strokeWidth={2}><circle cx="10" cy="10" r="6" /><path d="m20 20-5.6-5.6" /></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case 'back':
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'share':
      return (
        <svg {...common}>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4" /><path d="m15.4 6.5-6.8 4" />
        </svg>
      );
    case 'lock':
      return <svg {...common}><rect width="16" height="11" x="4" y="11" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
    default:
      return null;
  }
}
