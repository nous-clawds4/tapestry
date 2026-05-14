import s from './Button.module.css'

/*
 * Button — primary CTA component.
 * Variants: primary | secondary | ghost | success | danger
 * Sizes:    sm | md | lg
 */
export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  disabled,
  onClick,
  className,
  ...rest
}) {
  const cls = [s.btn, s[variant], s[size], className].filter(Boolean).join(' ')
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cls} {...rest}>
      {children}
    </button>
  )
}
