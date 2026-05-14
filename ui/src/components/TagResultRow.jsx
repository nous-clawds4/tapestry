import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Tag-element result row shared by the live popup and the Enter-results
 * page (Story 7 / ADR-0006). Click → /tag/:slug/:tagEventId. Renders a
 * single line with a small "tag" badge, the tag name, and a truncated
 * description when present.
 */
function truncate(str, n) {
  if (!str) return '';
  return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
}

export default function TagResultRow({ tag, onClick, variant = 'popup' }) {
  return (
    <Link
      to={`/tag/${encodeURIComponent(tag.slug)}/${tag.eventId}`}
      className={`bs-tag-result-row bs-tag-result-row-${variant}`}
      onClick={onClick}
    >
      <span className="bs-tag-result-badge" aria-hidden="true">#</span>
      <span className="bs-tag-result-body">
        <span className="bs-tag-result-name">{tag.name}</span>
        {tag.description && (
          <span className="bs-tag-result-desc">{truncate(tag.description, 140)}</span>
        )}
      </span>
      <span className="bs-tag-result-type" aria-label="tag">tag</span>
    </Link>
  );
}
