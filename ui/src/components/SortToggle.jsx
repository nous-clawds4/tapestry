import React from 'react';

/**
 * Shared sort-button group. Consumed by /tag/:id (Story 2), /tags (Story 4),
 * and the TAGGING ACTIVITY section (Story 5 / ADR-0005). Per-page visual
 * treatment is scoped via the `className` prop on the wrapper — each caller
 * keeps its own CSS namespace (`bs-tag-sort`, `bs-tagindex-sort`,
 * `bsp-authored-sort`) on the parent; rules target descendants
 * (`.bs-tag-sort .bs-sort-toggle-btn`, etc.).
 */
export default function SortToggle({ options, value, onChange, ariaLabel, className }) {
  return (
    <div
      className={`bs-sort-toggle${className ? ' ' + className : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`bs-sort-toggle-btn${value === key ? ' is-active' : ''}`}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
