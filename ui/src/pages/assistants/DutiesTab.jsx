import { useState } from 'react';
import { Link } from 'react-router-dom';
import { COPY, TREASURE_MAP_PATH } from './myAssistants';
import ProfileLink from './ProfileLink';

/**
 * The Duties tab (my-assistants #3, ADR my-assistants/0003 sub-decision 5; story AC-6, AC-7): every duty on your
 * Treasure Map, most generic first, read-only. A row shows its number, name, entry key, level, the Assistant listed
 * first (marked Not tagged when it isn't one of yours) and the Alternates; opened, all its Assistants labelled
 * Preferred then Alternate, the duty as a sentence, its raw entries, and a link to the Treasure Map page, where duties
 * are changed. One duty is open at a time. Since my-assistants #4 (ADR my-assistants/0004) each of an open duty's
 * Assistants has View profile.
 *
 * While the Map is being read, the loading line; none published, that line; unreadable, the error with Try again.
 *
 * Props: status (useTreasureMap's); rows (dutyRows' answer); onRetry().
 */

function Chevron() {
  return (
    <svg className="bsd-ma-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function NotTagged() {
  return <span className="bsd-ma-untagged" title={COPY.notTaggedDutyTooltip}>{COPY.notTagged}</span>;
}

function DutyRow({ duty, open, onToggle }) {
  return (
    <li className={`bsd-ma-row${open ? ' is-open' : ''}`}>
      <button type="button" className="bsd-ma-duty-line bsd-ma-toggle" aria-expanded={open ? 'true' : 'false'} onClick={onToggle}>
        <span className="bsd-ma-duty-rank">{duty.rank}</span>
        <span className="bsd-ma-duty-what">
          <span className="bsd-ma-duty-title-line">
            <span className="bsd-ma-duty-title">{duty.title}</span>
            <span className={`bsd-ma-level is-${duty.level.toLowerCase()}`}>{duty.level}</span>
          </span>
          <code className="bsd-ma-duty-key">{duty.key}</code>
        </span>
        <span className="bsd-ma-duty-who">
          <span className="bsd-ma-duty-preferred">
            <span className="bsd-ma-duty-name">{duty.preferred}</span>
            {duty.untagged && <NotTagged />}
          </span>
          {duty.alternates.length > 0 && <span className="bsd-ma-duty-alternates">{COPY.alternatesLine(duty.alternates)}</span>}
        </span>
        <Chevron />
      </button>
      {open && (
        <div className="bsd-ma-panel">
          <div className="bsd-ma-panel-box">
            <p className="bsd-ma-duties-head">
              <span className="bsd-ma-duties-title">{COPY.assistantsFor}</span>
              <span className="bsd-ma-duties-count">{duty.assistants.length > 1 ? COPY.firstPreferred : COPY.onlyProvider}</span>
            </p>
            <ol className="bsd-ma-duty-assistants">
              {duty.assistants.map((assistant, i) => (
                <li key={assistant.pubkey} className="bsd-ma-duty-assistant">
                  <span className={`bsd-ma-duty-role${i === 0 ? ' is-preferred' : ''}`}>{assistant.label}</span>
                  <span className="bsd-ma-duty-assistant-name">
                    <span className="bsd-ma-duty-name">{assistant.name}</span>
                    {assistant.untagged && <NotTagged />}
                  </span>
                  <ProfileLink pubkey={assistant.pubkey} name={assistant.name} />
                </li>
              ))}
            </ol>
            <p className="bsd-ma-label bsd-ma-duty-sentence-label">{COPY.sentenceLabel}</p>
            <p className="bsd-ma-duty-sentence">{duty.sentence}</p>
            <pre className="bsd-ma-duty-raw">{duty.raw}</pre>
            <Link className="bsd-ma-duty-link" to={TREASURE_MAP_PATH}>{COPY.manageLink}</Link>
          </div>
        </div>
      )}
    </li>
  );
}

export default function DutiesTab({ status, rows, onRetry }) {
  const [openKey, setOpenKey] = useState(null);

  if (status === 'error') {
    return (
      <div className="bsd-ma-status is-error" role="alert">
        <p>{COPY.mapError}</p>
        <button type="button" className="bsd-ma-btn" onClick={onRetry}>{COPY.retry}</button>
      </div>
    );
  }
  if (status !== 'found' && status !== 'none') {
    return <div className="bsd-ma-status" role="status"><p>{COPY.mapLoading}</p></div>;
  }

  return (
    <>
      <p className="bsd-ma-duties-intro">{COPY.dutiesIntro}</p>
      {status === 'none' && <p className="bsd-ma-status">{COPY.mapNone}</p>}
      {status === 'found' && (
        <>
          <div className="bsd-ma-count-row">
            <span className="bsd-ma-count">{COPY.dutiesCount(rows.length)}</span>
            <span className="bsd-ma-count-aside">{COPY.dutiesOrder}</span>
          </div>
          <div className="bsd-ma-card">
            <div className="bsd-ma-duty-columns" aria-hidden="true">
              <span className="bsd-ma-duty-rank">{COPY.columns.rank}</span>
              <span className="bsd-ma-duty-what">{COPY.columns.duty}</span>
              <span className="bsd-ma-duty-who">{COPY.columns.preferred}</span>
            </div>
            {rows.length > 0 ? (
              <ul className="bsd-ma-list" aria-label={COPY.dutiesHeading}>
                {rows.map((duty) => (
                  <DutyRow
                    key={duty.key}
                    duty={duty}
                    open={openKey === duty.key}
                    onToggle={() => setOpenKey(openKey === duty.key ? null : duty.key)}
                  />
                ))}
              </ul>
            ) : (
              <p className="bsd-ma-note">{COPY.mapEmpty}</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
