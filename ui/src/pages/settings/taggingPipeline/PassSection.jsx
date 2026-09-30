/**
 * The gap-filling pass (tagging-edges Story 4 AC-2; ADR tagging-edges/0004 § UI): whether a pass is running, the
 * latest pass explained with its figures, and the earlier passes the report keeps, newest first.
 *
 * Whether a pass is running is passView's `running`, which is liveness alone. While one runs, its stored record
 * (the pessimistic "failed, stopped" one) is never shown as a result.
 */

import { Explained, Loading, ReadFailed, Section, TONE_COLOUR, figure, took, when } from './parts.jsx';

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

function LatestPass({ latest, tone }) {
  const failure = latest.failure && typeof latest.failure === 'object' ? latest.failure : null;
  const confirmation = latest.confirmation && typeof latest.confirmation === 'object' ? latest.confirmation : null;
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
        </p>
      )}
      {confirmation && confirmation.honoured === true && (
        <p>It applied removals the owner had confirmed.</p>
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
