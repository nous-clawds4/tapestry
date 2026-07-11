import React from 'react';

/**
 * Styled search input — the (box, icon, input) triple BrainstormSearch uses
 * for both its landing and post-results variants. Extracted in ADR-0003 so
 * the tag-index page (and any future filter inputs) reuse the same visual
 * treatment.
 *
 * `children` is rendered inside the same box so callers can mount an
 * autocomplete dropdown that inherits the box's positioning context
 * (`position: relative` on `.bs-search-box-*` makes `position: absolute;
 * top: 100%` resolve against the box).
 */
export default function SearchInput({
  variant = 'results',
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  autoFocus,
  inputRef,
  boxRef,
  children,
}) {
  const boxClass = variant === 'landing' ? 'bs-search-box-landing' : 'bs-search-box-results';
  const inputClass = variant === 'landing' ? 'bs-search-input-landing' : 'bs-search-input-results';
  return (
    <div className={boxClass} ref={boxRef}>
      <span className="bs-search-icon" aria-hidden="true">🔍</span>
      <input
        ref={inputRef}
        type="text"
        className={inputClass}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {children}
    </div>
  );
}
