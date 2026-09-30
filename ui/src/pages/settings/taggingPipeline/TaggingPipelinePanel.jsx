/**
 * Settings › Relays › Tagging pipeline (tagging-edges Story 4 / ADR tagging-edges/0004 § UI).
 *
 * A read-only panel for the tagging pipeline: the gap-filling pass, its held removals, the backstop schedule, the
 * real-time path, and the drift between the relay and the graph. Every request it sends is a GET, and it changes
 * nothing; the controls are story 5's.
 *
 * Each section reads its own route through readSection, so it loads, fails and retries on its own, and keeps what
 * it last read when a later read fails. The pass and path status are re-read every POLL_MS, a tick being skipped
 * while the previous one is in flight; the schedule list every SCHEDULE_POLL_MS; the drift counts only on opening
 * and on Recount. Only the newest request's answer is kept for each read. Every derivation lives in
 * taggingPipelineView.js; this file only fetches and renders.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  POLL_MS, SCHEDULE_POLL_MS, driftView, newestFinishedPass, passView, pathView, scheduleView,
} from '../../../utils/taggingPipelineView.js';
import { readSection } from '../../../utils/taggingPipelineFetch.js';
import PassSection from './PassSection.jsx';
import HeldSection from './HeldSection.jsx';
import ScheduleSection from './ScheduleSection.jsx';
import PathSection from './PathSection.jsx';
import DriftSection from './DriftSection.jsx';

const STATUS_PATH = '/api/tagging-edges/status';
const REALTIME_PATH = '/api/tagging-edges/realtime/status';
const SCHEDULE_PATH = '/api/scheduled-tasks/list';
const DRIFT_PATH = '/api/tagging-edges/drift-counts';
const HELD_PATH = '/api/tagging-edges/held';
const HELD_PAGE_SIZE = 50;

function heldUrl(runId, offset) {
  return `${HELD_PATH}?runId=${encodeURIComponent(runId)}&offset=${offset}&limit=${HELD_PAGE_SIZE}`;
}

const NOT_READ = { state: 'loading', body: null, error: null, readAt: null };

/** Whether a read has answered at least once, well or not (a Retry's loading keeps the earlier body or error). */
function answered(read) {
  return read.state !== 'loading' || read.body !== null || read.error !== null;
}
const NO_LIST = { runId: null, offset: 0, state: 'loading', page: null, error: null };

/**
 * One section's read: { state, body, error, readAt } and a function that reads again. A failure after a good
 * answer keeps that answer's body and time. An answer to a request older than the newest is dropped, and so is
 * every answer after unmount. The function resolves to readSection's result either way.
 */
function useRead(url) {
  const [read, setRead] = useState(NOT_READ);
  const newest = useRef(0);
  useEffect(() => () => { newest.current += 1; }, []);
  const run = useCallback(async ({ showLoading = false } = {}) => {
    const mine = ++newest.current;
    if (showLoading) setRead((r) => ({ ...r, state: 'loading' }));
    const result = await readSection(url);
    if (mine === newest.current) {
      if (result.ok) setRead({ state: 'ready', body: result.body, error: null, readAt: new Date().toISOString() });
      else setRead((r) => ({ ...r, state: 'error', error: result }));
    }
    return result;
  }, [url]);
  return [read, run];
}

export default function TaggingPipelinePanel({ onOpenTab }) {
  const [status, readStatus] = useRead(STATUS_PATH);
  const [realtime, readRealtime] = useRead(REALTIME_PATH);
  const [schedule, readSchedule] = useRead(SCHEDULE_PATH);
  const [drift, readDrift] = useRead(DRIFT_PATH);
  const [held, setHeld] = useState(NO_LIST);
  const heldNewest = useRef(0);
  const polling = useRef(false);

  useEffect(() => {
    readStatus();
    readRealtime();
    readSchedule();
    readDrift();
    const pollId = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        await Promise.allSettled([readStatus(), readRealtime()]);
      } finally {
        polling.current = false;
      }
    }, POLL_MS);
    const scheduleId = setInterval(() => { readSchedule(); }, SCHEDULE_POLL_MS);
    return () => {
      clearInterval(pollId);
      clearInterval(scheduleId);
      heldNewest.current += 1;
    };
  }, [readStatus, readRealtime, readSchedule, readDrift]);

  const pass = status.body ? passView(status.body) : null;
  // The held list belongs to the latest pass, and is read only when that pass is not running and held removals.
  const heldRunId = pass && !pass.running && pass.latest && pass.latest.held && pass.latest.held.total > 0
    ? pass.latest.runId
    : null;

  /**
   * One page of the held list for `runId`. An answer for another run, or a 404 naming the latest run id, means a
   * newer pass wrote the report since the status was read: re-read the status, and the list restarts for the new
   * latest pass (the effect below) instead of showing a failure.
   */
  const readHeld = useCallback(async (runId, offset) => {
    const mine = ++heldNewest.current;
    setHeld({ runId, offset, state: 'loading', page: null, error: null });
    const r = await readSection(heldUrl(runId, offset));
    if (mine !== heldNewest.current) return;
    const moved = r.ok
      ? r.body.runId !== runId
      : r.httpStatus === 404 && !!r.body && typeof r.body.latestRunId === 'string';
    if (moved) {
      const s = await readStatus();
      if (mine !== heldNewest.current) return;
      if (s.ok && !(s.body.latest && s.body.latest.runId === runId)) return;
      // The status could not be read, or still names this run: say so rather than asking again. The failure shown
      // is the held list's own answer: its 404, or 'bad-json' for a 200 that names another run.
      const error = r.ok ? { code: 'bad-json' } : r;
      setHeld({ runId, offset, state: 'error', page: null, error });
      return;
    }
    if (r.ok) setHeld({ runId, offset, state: 'ready', page: r.body, error: null });
    else setHeld({ runId, offset, state: 'error', page: null, error: r });
  }, [readStatus]);

  useEffect(() => {
    if (heldRunId) readHeld(heldRunId, 0);
    else heldNewest.current += 1; // drop any answer for a list that no longer applies
  }, [heldRunId, readHeld]);

  const path = realtime.body ? pathView(realtime.body) : null;
  const sched = schedule.body ? scheduleView(schedule.body) : null;
  // A failed drift-counts read makes both counts unknown. Until the pass and path status have each answered once,
  // drift stays loading rather than saying their figures are not available.
  const drifted = drift.state === 'loading' || !answered(status) || !answered(realtime)
    ? null
    : driftView(drift.state === 'error' ? null : drift.body, status.body, realtime.body);

  return (
    <div className="settings-section">
      <h2>Tagging pipeline</h2>
      <p className="settings-hint">
        The gap-filling pass and the real-time path keep one TAGS relationship in the graph for each tagging on the
        relay. This page shows how they are doing. It changes nothing.
      </p>
      <PassSection read={status} view={pass} onRetry={() => readStatus({ showLoading: true })} />
      <HeldSection
        pass={pass}
        reportFailed={status.state === 'error' && !status.body}
        runId={heldRunId}
        held={held}
        onPage={(offset) => readHeld(heldRunId, Math.max(0, offset))}
        onRetry={() => readHeld(held.runId, held.offset)}
      />
      <ScheduleSection
        read={schedule}
        view={sched}
        onRetry={() => readSchedule({ showLoading: true })}
        onOpenSchedule={() => onOpenTab('schedule')}
      />
      <PathSection read={realtime} view={path} onRetry={() => readRealtime({ showLoading: true })} />
      <DriftSection
        read={drift}
        view={drifted}
        pass={status.body ? newestFinishedPass(status.body) : null}
        onCount={() => readDrift({ showLoading: true })}
      />
    </div>
  );
}
