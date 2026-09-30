/**
 * The real-time path (tagging-edges Story 4 AC-3; ADR tagging-edges/0004 § UI pathView): whether it is on and
 * whether its process is alive, its state explained, its warnings, what it has done since its first start (or a
 * reset), its gauges now, its last catch-up and its problems.
 *
 * Liveness first: a path switched on whose process is not alive shows no current state, since the stored one may
 * still read live. A figure the path has never produced reads "not yet available", never 0.
 */

import { Explained, Figures, Loading, NOT_YET, ReadFailed, Section, TONE_COLOUR, figure, took, when } from './parts.jsx';

function Warning({ tone, children }) {
  return <p style={{ color: TONE_COLOUR[tone] }}>{children}</p>;
}

function OnLine({ view, body }) {
  if (view.on && view.running) {
    return (
      <p>
        The path is on, and its process is running. It was switched on at {when(body.onSince)} and has run since{' '}
        {when(body.runningSince)}.
      </p>
    );
  }
  if (view.onButNotRunning) {
    return <p style={{ color: TONE_COLOUR.bad }}>The path is on, but its process is not running.</p>;
  }
  return <p>{view.running ? 'The path is off, and its process is winding down.' : 'The path is off.'}</p>;
}

function WhatItHasDone({ view, body }) {
  const started = view.started;
  const c = view.counts || {};
  const fr = c.failedReads || {};
  const n = (v) => (started ? figure(v, NOT_YET) : NOT_YET);
  const failedReads = started
    ? `relay ${n(fr.relay)}, graph ${n(fr.graph)}, element ${n(fr.element)}, catch-up ${n(fr.catchUp)}, in all ${n(fr.total)}`
    : NOT_YET;
  const g = view.gauges || {};
  return (
    <div>
      <Figures
        rows={[
          ['First started', started ? when(body.firstStartedAt) : NOT_YET],
          ['Last reflected a change', started ? when(body.lastReflectedAt) : NOT_YET],
        ]}
      />
      {view.countsSince && view.countsSince.from === 'reset' && (
        <p style={{ color: TONE_COLOUR.warn }}>
          The counts were reset because the path's status was lost. They run from that reset.
        </p>
      )}
      {view.countsSince && view.countsSince.from === 'first-start' && (
        <p className="settings-hint">The counts run from its first start.</p>
      )}
      <p>What it has done:</p>
      <Figures
        rows={[
          ['Added', n(c.added)],
          ['Changed', n(c.changed)],
          ['Removed', n(c.removed)],
          ['Unchanged', n(c.unchanged)],
          ['People added', n(c.peopleAdded)],
          ['Refused taggings, counted at each look', n(c.refusedLooks)],
          ['Failed reads', failedReads],
          ['Database refusals', n(c.dbRefused)],
          ['Removals it was not prompted to make, left to the next pass', n(c.removalsNotPrompted)],
          ['Changes dropped over the backlog, left to the next pass', n(c.droppedOverBacklog)],
        ]}
      />
      <p>As it stands now:</p>
      <Figures
        rows={[
          ['Addresses parked', n(g.parked)],
          ['Work pending', n(g.pending)],
        ]}
      />
    </div>
  );
}

function CatchUp({ view, body }) {
  const last = view.lastCatchUp;
  const current = body.catchUp && body.catchUp.current;
  return (
    <div>
      {last ? (
        <p>
          Last catch-up: <Explained kind="catchUpOutcome" code={last.outcome} /> It started at {when(last.startedAt)}{' '}
          and took {took(last.durationMs)}.
          {last.stage && <> Where it failed: <Explained kind="catchUpStage" code={last.stage} /></>}
          {last.reason && <> Why: <Explained kind="notEstablishedReason" code={last.reason} /></>}
        </p>
      ) : (
        <p>Last catch-up: none yet.</p>
      )}
      <p>
        Catch-up under way:{' '}
        {current
          ? `since ${when(current.startedAt)}, with ${figure(current.remaining, 'an unknown number of')} addresses left.`
          : 'none.'}
      </p>
    </div>
  );
}

function Problems({ view, body }) {
  const sp = body.setupProblem;
  const err = view.lastError;
  return (
    <div>
      <p>
        Setup problem:{' '}
        {view.setupProblemKey ? <Explained kind="setupProblem" code={view.setupProblemKey} /> : 'none.'}
      </p>
      {sp && sp.kind === 'identity' && (
        <p className="settings-hint">Identity: {String(sp.identity)}. Read from: {String(sp.source)}.</p>
      )}
      {sp && sp.kind === 'schema' && <p className="settings-hint">Rule: {String(sp.rule)}.</p>}
      <p>
        Last error:{' '}
        {err ? (
          <>
            at {when(err.at)}. Stage: <Explained kind="lastErrorStage" code={err.stage} /> Code:{' '}
            <Explained kind="countCode" code={err.code} />
          </>
        ) : 'none.'}
      </p>
      <p>Pre-image file of removed relationships: {body.preimageFile ? <code>{String(body.preimageFile)}</code> : 'none.'}</p>
    </div>
  );
}

/** `read` is the path status read ({ state, body, error, readAt }); `view` is pathView of its body, or null. */
export default function PathSection({ read, view, onRetry }) {
  const title = 'The real-time path';
  if (!view || read.state === 'loading') {
    return (
      <Section testId="tp-path" state={read.state} title={title}>
        {read.state === 'error'
          ? <ReadFailed what="The path status" error={read.error} onRetry={onRetry} />
          : <Loading what="the path status" />}
      </Section>
    );
  }

  const body = read.body;
  const failed = read.state === 'error';
  let state = 'ready';
  if (failed) state = 'error';
  else if (!view.started) state = 'empty';
  return (
    <Section testId="tp-path" state={state} title={title} tone={view.tone}>
      {failed && <ReadFailed what="The path status" error={read.error} readAt={read.readAt} onRetry={onRetry} />}
      <OnLine view={view} body={body} />
      {view.state !== null && (
        <p style={{ color: TONE_COLOUR[view.tone] }}>State: <Explained kind="pathState" code={view.state} /></p>
      )}
      {view.warnings.includes('stale') && (
        <Warning tone="warn">Its status has not been rewritten for over a minute, so these figures may be old.</Warning>
      )}
      {view.warnings.includes('statusUnreadable') && (
        <Warning tone="bad">Its status file cannot be read, so what it is doing is unknown.</Warning>
      )}
      {view.warnings.includes('switchUnreadable') && (
        <Warning tone="bad">Its on/off record cannot be read, so the path counts as off.</Warning>
      )}
      {view.lastFigures && (
        <p className="settings-hint">These are its last figures, written at {when(view.lastFigures.updatedAt)}.</p>
      )}
      {!view.started && <p>The path has not started yet, so it has produced no figures.</p>}
      <WhatItHasDone view={view} body={body} />
      {view.started && <CatchUp view={view} body={body} />}
      {view.started && <Problems view={view} body={body} />}
    </Section>
  );
}
