/**
 * Drift between the relay and the graph, explained (tagging-edges Story 4 AC-4; ADR tagging-edges/0004 § UI
 * driftView): the relay taggings and the graph relationships as counted on opening or on Recount, their
 * difference, the part the newest finished pass explains, and the unexplained remainder with what is named beside
 * it. An unknown count reads "unknown", never 0, and no difference is taken from it. Counts taken before the
 * explaining pass ended (driftView's countsPredatePass, T5) are not explained by it: the section says so and asks for
 * a Recount instead of showing an explained part and a remainder.
 */

import { Explained, Loading, NOT_YET, ReadFailed, Section, TONE_COLOUR, counted, figure, when } from './parts.jsx';

function CountLine({ label, count }) {
  if (count.known) {
    return <p>{label}: {figure(count.count)}, counted at {when(count.takenAt)}.</p>;
  }
  return (
    <p>
      {label}: unknown.
      {count.code ? <> Code: <Explained kind="countCode" code={count.code} /></> : null}
      {count.takenAt ? ` Counted at ${when(count.takenAt)}.` : null}
    </p>
  );
}

/**
 * The explained part, the arithmetic behind it, and which pass it comes from. A figure the pass lacks reads 0, as
 * driftView counts it.
 */
function ExplainedPart({ view, pass }) {
  if (!view.explainedBy) {
    const why = view.explainedReason === 'report-unavailable'
      ? 'The pass report is not available, so no part of the difference is explained.'
      : 'No finished pass is in the report, so no part of the difference is explained.';
    return <p>Explained: none. {why}</p>;
  }
  const refused = pass && pass.refused ? pass.refused.total : null;
  const held = pass && pass.held ? pass.held.total : null;
  const left = pass && pass.relationships ? pass.relationships.leftInPlace : null;
  return (
    <div>
      <p>
        Explained: {figure(view.explained)}, by pass {view.explainedBy.runId}, which ended at{' '}
        {when(view.explainedBy.endedAt)}.
      </p>
      <p className="settings-hint">
        That is {counted(refused, 'refused tagging', 'refused taggings', '0')}, minus{' '}
        {counted(held, 'held removal', 'held removals', '0')}, minus{' '}
        {counted(left, 'relationship', 'relationships', '0')} left in place.
      </p>
      {view.explainedBy.usedInsteadOfLatest && (
        <p className="settings-hint">
          {view.passRunning
            ? 'A pass is running, so the newest finished pass explains the difference.'
            : 'The latest pass did not finish, so the newest finished pass explains the difference instead.'}
        </p>
      )}
    </div>
  );
}

/** What the explained part leaves out: the pass's leftovers, a running pass, and the path's own figures. */
function Named({ view, known }) {
  const since = view.explainedBy ? 'since that pass' : 'since the last pass';
  return (
    <div>
      {known && view.leftToNextPass !== null && (
        <p>
          That pass left {counted(view.leftToNextPass, 'address', 'addresses')} to the next one: lost races and
          conflicting addresses.
        </p>
      )}
      {view.passRunning && <p>A pass is running, so the graph count moves while it writes.</p>}
      {view.newerUnfinished && (
        <p>
          {view.passRunning
            ? 'A newer pass, running or ended early, got as far as planning its changes, so it may have written after that pass.'
            : 'A newer pass that did not finish got as far as planning its changes, so it may have written after that pass.'}
        </p>
      )}
      {view.pathUnknown && <p>The path's figures are not available, so they are not named here.</p>}
      {!view.pathUnknown && !view.waitsForPass && (
        <p>
          The path is on. Refused taggings, counted at each look: {figure(view.pathRefusedLooks, NOT_YET)}. Addresses
          parked: {figure(view.parked, NOT_YET)}. The explained part does not include them.
        </p>
      )}
      {view.waitsForPass && <p>The path is off, so changes on the relay {since} wait for the next pass.</p>}
    </div>
  );
}

/**
 * `read` is the drift-counts read ({ state, body, error }); `view` is driftView of its body (null when it failed)
 * and the status and path bodies; `pass` is the newest finished pass whose figures the explained part uses.
 */
export default function DriftSection({ read, view, pass, onCount }) {
  const title = 'Drift between the relay and the graph';
  if (read.state === 'loading' || !view) {
    return <Section testId="tp-drift" state="loading" title={title}><Loading what="the relay and graph counts" /></Section>;
  }
  const failed = read.state === 'error';
  return (
    <Section testId="tp-drift" state={failed ? 'error' : 'ready'} title={title} tone={view.tone}>
      {failed && <ReadFailed what="The relay and graph counts" error={read.error} onRetry={onCount} />}
      <CountLine label="Relay taggings" count={view.relay} />
      <CountLine label="Graph relationships" count={view.graph} />
      {view.known && view.countsPredatePass && (
        <div>
          <p>Difference (relay minus graph): {figure(view.difference)}.</p>
          <p>
            These counts were taken before pass {view.explainedBy.runId} ended at {when(view.explainedBy.endedAt)}, so
            that pass cannot explain them. Press Recount to count again.
          </p>
        </div>
      )}
      {view.known && !view.countsPredatePass && (
        <div>
          <p>Difference (relay minus graph): {figure(view.difference)}.</p>
          <ExplainedPart view={view} pass={pass} />
          <p style={{ color: TONE_COLOUR[view.tone] }}>Unexplained: {figure(view.unexplained)}.</p>
        </div>
      )}
      {!view.known && (
        <p className="settings-hint">No difference is shown while a count is unknown.</p>
      )}
      <Named view={view} known={view.known} />
      {!failed && <button className="btn-small" onClick={onCount}>Recount</button>}
    </Section>
  );
}
