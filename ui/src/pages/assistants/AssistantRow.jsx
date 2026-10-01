import { Link } from 'react-router-dom';
import { COPY, IDENTIFICATION_TAGS_PATH } from './myAssistants';

/**
 * One row of the My Assistants list (my-assistants #1; opening and its actions since #2, ADR my-assistants/0002
 * sub-decision 9). A row with actions is a toggle: its main line is a button with aria-expanded, and the open row
 * shows Change to … (when it carries one tag) and Remove Tag. The untagged Local row has no actions in story 2, so it
 * is not a toggle; its prompt to Identification Tags stays visible beneath it, outside any button.
 *
 * Props: row (buildRows' shape); open; onToggle(); actions (rowActions' answer, or null); busy ({ kind, pubkey } while a
 * press publishes, else null); onChange(toKey); onRemove().
 */

/** The blueprint's house mark on the Local badge. */
function HomeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="bsd-ma-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function RowLine({ row, toggle }) {
  return (
    <>
      <span className="bsd-ma-avatar" aria-hidden="true">{row.initial}</span>
      <span className="bsd-ma-who">
        <span className="bsd-ma-name-line">
          <span className="bsd-ma-name">{row.name}</span>
          {row.local && (
            <span className="bsd-ma-local" title={COPY.localTooltip}><HomeIcon />{COPY.localBadge}</span>
          )}
        </span>
        <span className="bsd-ma-npub">{row.npubShort}</span>
      </span>
      <span className="bsd-ma-field is-url">
        <span className="bsd-ma-label">{COPY.fieldUrl}</span>
        <span className="bsd-ma-value">{row.url}</span>
      </span>
      <span className="bsd-ma-field is-nip05">
        <span className="bsd-ma-label">{COPY.fieldNip05}</span>
        <span className="bsd-ma-value">{row.nip05}</span>
      </span>
      <span className="bsd-ma-tags">
        {row.untagged
          ? <span className="bsd-ma-untagged" title={COPY.notTaggedTooltip}>{COPY.notTagged}</span>
          : row.tags.map((tag) => <span key={tag.key} className={`bsd-ma-chip is-${tag.key}`}>{tag.name}</span>)}
      </span>
      {toggle && <Chevron />}
    </>
  );
}

export default function AssistantRow({ row, open, onToggle, actions, busy, onChange, onRemove }) {
  const mine = busy && busy.pubkey === row.pubkey;
  return (
    <li className={`bsd-ma-row${row.local ? ' is-local' : ''}${open ? ' is-open' : ''}`}>
      {actions ? (
        <button type="button" className="bsd-ma-line bsd-ma-toggle" aria-expanded={open ? 'true' : 'false'} onClick={onToggle}>
          <RowLine row={row} toggle />
        </button>
      ) : (
        <div className="bsd-ma-line"><RowLine row={row} toggle={false} /></div>
      )}
      {open && actions && (
        <div className="bsd-ma-panel">
          <div className="bsd-ma-panel-actions">
            {actions.change && (
              <button
                type="button"
                className="bsd-ma-btn"
                disabled={!!busy || !actions.change.enabled}
                onClick={() => onChange(actions.change.toKey)}
              >
                {mine && busy.kind === 'change' ? COPY.busy.change : actions.change.label}
              </button>
            )}
            <button type="button" className="bsd-ma-btn is-danger" disabled={!!busy} onClick={onRemove}>
              {mine && busy.kind === 'remove' ? COPY.busy.remove : actions.remove.label}
            </button>
          </div>
          {actions.change && !actions.change.enabled && <p className="bsd-ma-reason">{actions.change.reason}</p>}
        </div>
      )}
      {row.untagged && (
        <p className="bsd-ma-prompt">
          {COPY.tagPrompt} <Link to={IDENTIFICATION_TAGS_PATH}>{COPY.tagPromptLink}</Link>
        </p>
      )}
    </li>
  );
}
