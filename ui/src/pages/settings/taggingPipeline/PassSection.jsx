/**
 * The gap-filling pass (tagging-edges Story 4 AC-2; ADR tagging-edges/0004 § UI): whether a pass is running, the
 * latest pass explained with its figures, and the earlier passes the report keeps, newest first.
 *
 * Whether a pass is running is passView's `running`, which is liveness alone. While one runs, its stored record
 * (the pessimistic "failed, stopped" one) is never shown as a result.
 */

import { Explained, Loading, ReadFailed, Section, TONE_COLOUR, counted, figure, took, when } from './parts.jsx';

/** A pass record's figures, in the order the story names them. */
function passFigures(r) {
  const rel = r.relationships || {};
  return [
    ['Taggings read', r.taggingsRead],
    ['Added', rel.added],
    ['Changed', rel.changed],
    ['Removed', rel.removed],
    ['Unchanged', rel.unchanged],
    ['Refused taggings', r.refused ? r.refused.total : null],
    ['Held', r.held ? r.held.total : null],
    ['Left in place', rel.leftInPlace],
    ['People added', r.peopleAdded],
  ];
}

/**
 * What a pass did with the owner's confirmation it honoured, from `latest.confirmed` (reconcileTaggingEdges.js step
 * 7 and its removals). `confirmation.honoured` is set when the pass claims the confirmation, before its reads, so a
 * pass that fails afterwards keeps it with `removalsApplied` 0: the sentence says what was applied, never more.
 * `heldNoLongerDue` is null until the pass has planned its changes. A pass that never recorded its end (`ended`
 * false: its pessimistic record, saved every 10 write batches) holds only what it had applied by its last save, so
 * the figure is a lower bound (story 4 review round 2, R2-3).
 */
function ConfirmedLine({ confirmed, ended }) {
  const c = confirmed && typeof confirmed === 'object' ? confirmed : null;
  if (!c) return <p>It honoured the owner's confirmation.</p>;
  const applied = typeof c.removalsApplied === 'number' && Number.isFinite(c.removalsApplied) ? c.removalsApplied : null;
  let appliedText;
  if (applied === null) appliedText = 'How many of them it applied is not recorded.';
  else if (!ended && applied === 0) {
    appliedText = 'It never recorded its end, and by its last save it had applied none of the confirmed removals. '
      + 'It may have applied some after that save.';
  } else if (!ended) {
    appliedText = `It never recorded its end, and by its last save it had applied ${figure(applied)} of the confirmed `
      + 'removals, so it applied at least that many.';
  } else if (applied === 0) appliedText = 'It applied none of the confirmed removals.';
  else appliedText = `It applied ${figure(applied)} of the confirmed removals.`;
  const gone = typeof c.heldNoLongerDue === 'number' && c.heldNoLongerDue > 0 ? c.heldNoLongerDue : null;
  return (
    <p>
      It honoured the owner's confirmation of {counted(c.heldCount, 'removal', 'removals')} held by pass{' '}
      {String(c.confirmedRunId)}. {appliedText}
      {gone !== null && ` By its own read, ${figure(gone)} of them were no longer due for removal.`}
    </p>
  );
}

/** A failure's own text (R2-6): its error message, or a relay read's last strfry output, both redacted already. */
const said = (v) => typeof v === 'string' && v !== '';

function LatestPass({ latest, tone }) {
  const failure = latest.failure && typeof latest.failure === 'object' ? latest.failure : null;
  const confirmation = latest.confirmation && typeof latest.confirmation === 'object' ? latest.confirmation : null;
  const ended = latest.endedAt !== null && latest.endedAt !== undefined;
  return (
    <div>
      <p style={{ color: TONE_COLOUR[tone] }}>
        Latest pass: <Explained kind="passOutcome" code={latest.outcome} />
      </p>
      <p>Reason: <Explained kind="passReason" code={latest.reasonCode} /></p>
      {typeof latest.reason === 'string' && latest.reason !== '' && (
        <p className="settings-hint">In the pass's own words: {latest.reason}</p>
      )}
      {failure && (
        <p>
          Where it failed: <Explained kind="failureStage" code={failure.stage} />
          {failure.read && <> Which read: <Explained kind="failureRead" code={failure.read} /></>}
          {failure.code !== null && failure.code !== undefined && (
            <> Code: <Explained kind="failureCode" code={failure.code} /></>
          )}
        </p>
      )}
      {failure && said(failure.message) && <p className="settings-hint">Its error message: {failure.message}</p>}
      {failure && said(failure.stderrTail) && (
        <p className="settings-hint">The relay command's last output: {failure.stderrTail}</p>
      )}
      {confirmation && confirmation.honoured === true && (
        <ConfirmedLine confirmed={latest.confirmed} ended={ended} />
      )}
      {confirmation && confirmation.why && (
        <p>It did not honour the owner's confirmation. Why: <Explained kind="confirmationWhy" code={confirmation.why} /></p>
      )}
      <p>
        Run {latest.runId}. It started at {when(latest.startedAt)}, ended at {when(latest.endedAt)}, and took{' '}
        {took(latest.durationMs)}.
      </p>
      <table>
        <thead>
          <tr>{passFigures(latest).map(([label]) => <th key={label}>{label}</th>)}</tr>
        </thead>
        <tbody>
          <tr>{passFigures(latest).map(([label, n]) => <td key={label}>{figure(n)}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

function EarlierPasses({ earlier }) {
  // Each distinct outcome is explained once, under the table, rather than on every row.
  const outcomes = [...new Set(earlier.map((r) => r.outcome))];
  return (
    <div>
      <p>Earlier passes in the report, newest first:</p>
      <table>
        <thead>
          <tr>
            <th>Started</th>
            <th>Outcome</th>
            {passFigures({}).map(([label]) => <th key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {earlier.map((r, i) => (
            <tr key={r.runId || i}>
              <td>{when(r.startedAt)}</td>
              <td><code>{String(r.outcome)}</code></td>
              {passFigures(r).map(([label, n]) => <td key={label}>{figure(n)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="settings-hint">
        {outcomes.map((o) => <li key={String(o)}><Explained kind="passOutcome" code={o} /></li>)}
      </ul>
    </div>
  );
}

/**
 * `read` is the status read ({ state, body, error, readAt }); `view` is passView of its body, or null before a
 * good answer.
 */
export default function PassSection({ read, view, onRetry }) {
  const title = 'The gap-filling pass';
  if (!view) {
    return (
      <Section testId="tp-pass" state={read.state} title={title}>
        {read.state === 'error'
          ? <ReadFailed what="The pass report" error={read.error} onRetry={onRetry} />
          : <Loading what="the pass report" />}
      </Section>
    );
  }
  if (read.state === 'loading') {
    return <Section testId="tp-pass" state="loading" title={title}><Loading what="the pass report" /></Section>;
  }

  const failed = read.state === 'error'
    ? <ReadFailed what="The pass report" error={read.error} readAt={read.readAt} onRetry={onRetry} />
    : null;
  if (view.empty) {
    return (
      <Section testId="tp-pass" state={failed ? 'error' : 'empty'} title={title}>
        {failed}
        <p>No pass has run yet.</p>
        <p>
          A pass starts from an enabled Scheduled Tasks entry, "Reconcile tagging relationships", or when it is run
          from the Task Explorer.
        </p>
      </Section>
    );
  }
  return (
    <Section testId="tp-pass" state={failed ? 'error' : 'ready'} title={title} tone={view.tone}>
      {failed}
      {view.running && view.current && (
        <div>
          <p>A pass is running now.</p>
          <p>
            Run {view.current.runId}, started at {when(view.current.startedAt)}.
            {view.current.finishing ? ' It is finishing.' : ''} Its result shows here when it ends.
          </p>
        </div>
      )}
      {view.latest && <LatestPass latest={view.latest} tone={view.tone} />}
      {view.earlier.length > 0 && <EarlierPasses earlier={view.earlier} />}
    </Section>
  );
}
