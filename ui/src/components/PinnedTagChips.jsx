import React from 'react';

/**
 * Story 11 follow-up — chip row under the Brainstorm Search input.
 * Single-select: clicking a chip toggles the active filter; clicking the
 * active chip clears it. (Multi-chip / union-intersection is a follow-up.)
 *
 * Props:
 *   sets        — from useTagMemberSets
 *   activePinId — currently-active pin's pinEventId (or null)
 *   onChange    — (pinEventId | null) => void
 */
export default function PinnedTagChips({ sets, activePinId, onChange }) {
  if (!sets || sets.length === 0) return null;

  return (
    <div className="bs-pin-chips" role="group" aria-label="Filter by pinned tag">
      <span className="bs-pin-chips-label">Filter by pinned tag:</span>
      {sets.map((s) => {
        const isActive = s.pinEventId === activePinId;
        const isDisabled = s.status !== 'ok' || s.memberCount === 0;
        const title = s.status === 'unsupported'
          ? 'Unsupported curation method'
          : s.status === 'never'
          ? 'Trusted List not generated yet — refresh from /pins first'
          : s.memberCount === 0
          ? 'Trusted List has no members (none passed the cutoff)'
          : `${s.memberCount} member${s.memberCount === 1 ? '' : 's'}`;
        return (
          <button
            key={s.pinEventId}
            type="button"
            className={`bs-pin-chip${isActive ? ' is-active' : ''}${isDisabled ? ' is-disabled' : ''}`}
            onClick={() => onChange(isActive ? null : s.pinEventId)}
            disabled={isDisabled}
            title={title}
            aria-pressed={isActive}
          >
            📌 {s.tagName}
            {!isDisabled && (
              <span className="bs-pin-chip-count">{s.memberCount}</span>
            )}
          </button>
        );
      })}
      {activePinId && (
        <button
          type="button"
          className="bs-pin-chip-clear"
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
