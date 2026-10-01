import { Link } from 'react-router-dom';
import { COPY, IDENTIFICATION_TAGS_PATH, TREASURE_MAP_PATH } from './myAssistants';
import Nip05Status from './Nip05Status';
import ProfileLink from './ProfileLink';

/**
 * One row of the My Assistants list (my-assistants #1; opening and its actions since #2, ADR my-assistants/0002
 * sub-decision 9; its Treasure Map since #3, ADR my-assistants/0003 sub-decision 5). Every row is a toggle: its main
 * line is a button with aria-expanded, and the open row shows the Assistant's duties on your Treasure Map with Manage on
 * Treasure Map, then Change to … (when it carries one tag) and Remove Tag (when it carries any). The untagged Local
 * row's prompt to Identification Tags stays visible beneath it, outside any button.
 *
 * The status (On / Not on Treasure Map) shows only once the Map has been read — `found` or `none` — so nothing is
 * claimed while it loads or after a failed read (AC-7).
 *
 * Since my-assistants #4 (ADR my-assistants/0004) the NIP-05 carries its status (Nip05Status, text inside the toggle),
 * and the open panel has View profile (ProfileLink, outside the toggle).
 *
 * Props: row (buildRows' shape); open; onToggle(); actions (rowActions' answer); busy ({ kind, pubkey } while a press
 * publishes, else null); onChange(toKey); onRemove(); mapStatus (useTreasureMap's status); duties (dutiesOf's answer).
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

function RowLine({ row, onMap }) {
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
        <Nip05Status pubkey={row.pubkey} nip05Id={row.nip05Id} />
      </span>
      <span className="bsd-ma-tags">
        {row.untagged
          ? <span className="bsd-ma-untagged" title={COPY.notTaggedTooltip}>{COPY.notTagged}</span>
          : row.tags.map((tag) => <span key={tag.key} className={`bsd-ma-chip is-${tag.key}`}>{tag.name}</span>)}
        {onMap !== null && (
          <span className={`bsd-ma-onmap${onMap ? ' is-on' : ''}`}>
            <span className="bsd-ma-onmap-dot" aria-hidden="true" />{onMap ? COPY.onMap : COPY.notOnMap}
          </span>
        )}
      </span>
      <Chevron />
    </>
  );
}

/** The open row's duties: grouped, or the no-duties line; while the Map loads or after a failed read, that instead. */
function Duties({ mapStatus, duties }) {
  if (mapStatus === 'error') return <p className="bsd-ma-duties-note">{COPY.mapError}</p>;
  if (mapStatus !== 'found' && mapStatus !== 'none') return <p className="bsd-ma-duties-note">{COPY.mapLoading}</p>;
  const count = duties ? duties.count : 0;
  return (
    <>
      <p className="bsd-ma-duties-head">
        <span className="bsd-ma-duties-title">{COPY.dutiesHeading}</span>
        <span className="bsd-ma-duties-count">{COPY.dutyCount(count)}</span>
      </p>
      {count === 0 && <p className="bsd-ma-duties-note">{COPY.noDuties}</p>}
      {count > 0 && ['scores', 'lists', 'concepts'].filter((group) => duties[group].length > 0).map((group) => (
        <div key={group} className="bsd-ma-duty-group">
          <p className="bsd-ma-label">{COPY.groups[group]}</p>
          <ul className="bsd-ma-duty-items">
            {duties[group].map((duty) => (
              <li key={duty.key} className="bsd-ma-duty-item">
                <span className="bsd-ma-duty-name">{duty.title}</span>
                <code className="bsd-ma-duty-key">{duty.key}</code>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export default function AssistantRow({ row, open, onToggle, actions, busy, onChange, onRemove, mapStatus, duties }) {
  const mine = busy && busy.pubkey === row.pubkey;
  const reasonId = `bsd-ma-reason-${row.pubkey}`;
  const changeBlocked = actions && actions.change && !actions.change.enabled;
  const onMap = mapStatus === 'found' || mapStatus === 'none' ? !!(duties && duties.count > 0) : null;
  return (
    <li className={`bsd-ma-row${row.local ? ' is-local' : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="bsd-ma-line bsd-ma-toggle" aria-expanded={open ? 'true' : 'false'} onClick={onToggle}>
        <RowLine row={row} onMap={onMap} />
      </button>
      {open && (
        <div className="bsd-ma-panel">
          <div className="bsd-ma-panel-box">
            <Duties mapStatus={mapStatus} duties={duties} />
            <div className="bsd-ma-panel-actions">
              <Link className="bsd-ma-btn bsd-ma-link-btn" to={TREASURE_MAP_PATH}>{COPY.manage}</Link>
              <ProfileLink pubkey={row.pubkey} name={row.name} />
              {actions && actions.change && (
                <button
                  type="button"
                  className="bsd-ma-btn"
                  disabled={!!busy || !actions.change.enabled}
                  aria-describedby={changeBlocked ? reasonId : undefined}
                  onClick={() => onChange(actions.change.toKey)}
                >
                  {mine && busy.kind === 'change' ? COPY.busy.change : actions.change.label}
                </button>
              )}
              {actions && actions.remove && (
                <button type="button" className="bsd-ma-btn is-danger" disabled={!!busy} onClick={onRemove}>
                  {mine && busy.kind === 'remove' ? COPY.busy.remove : actions.remove.label}
                </button>
              )}
            </div>
            {changeBlocked && <p className="bsd-ma-reason" id={reasonId}>{actions.change.reason}</p>}
          </div>
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
