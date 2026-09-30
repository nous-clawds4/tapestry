/**
 * The held removals (tagging-edges Story 4 AC-2 "Held removals"; ADR tagging-edges/0004 § UI "The held list"): the
 * latest pass's held list, a page at a time, why each was held, and the owner's confirmation as the status reports
 * it. It offers no way to confirm; that control is story 5's.
 */

import { Explained, Loading, ReadFailed, Section, TONE_COLOUR, counted, figure, when } from './parts.jsx';

/** The owner's confirmation, in passView's five states. The server decides whether it has expired. */
function ConfirmationLine({ confirmation }) {
  const c = confirmation;
  if (!c || c.state === 'none') return <p className="settings-hint">No confirmation from the owner is waiting.</p>;
  if (c.state === 'pending') {
    return (
      <p style={{ color: TONE_COLOUR.warn }}>
        The owner's confirmation of pass {c.runId} is pending until {when(c.expiresAt)}. The next pass honours it.
      </p>
    );
  }
  if (c.state === 'expired') {
    return (
      <p style={{ color: TONE_COLOUR.warn }}>
        The owner's confirmation of pass {c.runId} expired at {when(c.expiresAt)}. It stays until the next pass,
        which does not honour it.
      </p>
    );
  }
  if (c.state === 'unreadable') {
    return (
      <p style={{ color: TONE_COLOUR.bad }}>
        The owner's confirmation cannot be read. Code: <Explained kind="countCode" code={c.code} />
      </p>
    );
  }
  return (
    <p style={{ color: TONE_COLOUR.warn }}>
      The owner's confirmation of pass {c.runId} is waiting, but its expiry time cannot be read.
    </p>
  );
}

function HeldPage({ runId, heldTotal, page, onPage }) {
  const items = page.items;
  const first = items.length ? page.offset + 1 : page.offset;
  const reasons = [...new Set(items.map((it) => it.reason))];
  return (
    <div>
      <p>
        Showing {figure(first)} to {figure(page.offset + items.length)} of {figure(page.total)} for pass {runId}.
      </p>
      <ul>
        {items.map((it) => (
          <li key={it.address}><code>{it.address}</code> <code>{String(it.reason)}</code></li>
        ))}
      </ul>
      {reasons.length > 0 && (
        <div className="settings-hint">
          <p>Why these were held:</p>
          <ul>
            {reasons.map((r) => <li key={String(r)}><Explained kind="heldReason" code={r} /></li>)}
          </ul>
        </div>
      )}
      <button className="btn-small" disabled={page.offset === 0} onClick={() => onPage(page.offset - page.limit)}>
        Previous
      </button>{' '}
      <button
        className="btn-small"
        disabled={page.offset + items.length >= page.total}
        onClick={() => onPage(page.offset + page.limit)}
      >
        Next
      </button>
      {page.total !== heldTotal && (
        <p className="settings-hint">
          The report counts {counted(heldTotal, 'held removal', 'held removals')}, and the list on the data volume
          holds {figure(page.total)}.
        </p>
      )}
    </div>
  );
}

/**
 * `pass` is passView of the status body, or null before a good answer. `reportFailed` is true when the status read
 * has failed with no good answer before it. `runId` is the latest pass's run id when it holds removals and no pass
 * runs, else null. `held` is the list's read: { runId, offset, state, page, error }.
 */
export default function HeldSection({ pass, reportFailed, runId, held, onPage, onRetry }) {
  const title = 'Held removals';
  if (!pass && reportFailed) {
    // Its own read has not failed, so the section is not 'error': it waits on the pass report.
    return (
      <Section testId="tp-held" state="loading" title={title}>
        <p className="settings-hint">The held list waits for the pass report, which could not be read.</p>
      </Section>
    );
  }
  if (!pass) {
    return (
      <Section testId="tp-held" state="loading" title={title}>
        <Loading what="the held list, once the pass report is in" />
      </Section>
    );
  }
  const confirmation = <ConfirmationLine confirmation={pass.confirmation} />;
  if (pass.running) {
    return (
      <Section testId="tp-held" state="empty" title={title}>
        <p>A pass is running. The held list returns when it ends.</p>
        {pass.confirmation.state !== 'none' && confirmation}
      </Section>
    );
  }
  if (!runId) {
    return (
      <Section testId="tp-held" state="empty" title={title}>
        <p>{pass.latest ? 'The latest pass held no removals.' : 'No pass has run, so nothing is held.'}</p>
        {pass.confirmation.state !== 'none' && confirmation}
      </Section>
    );
  }

  const heldTotal = pass.latest.held.total;
  // Until the list of this run id has answered, the section is loading (a restart after a newer pass included).
  const state = held.runId === runId ? held.state : 'loading';
  return (
    <Section testId="tp-held" state={state} title={title} tone="warn">
      <p>The latest pass, {runId}, held {counted(heldTotal, 'removal', 'removals')} for the owner to confirm.</p>
      {confirmation}
      {state === 'loading' && <Loading what="the held list" />}
      {state === 'error' && <ReadFailed what="The held list" error={held.error} onRetry={onRetry} />}
      {state === 'ready' && <HeldPage runId={runId} heldTotal={heldTotal} page={held.page} onPage={onPage} />}
    </Section>
  );
}
