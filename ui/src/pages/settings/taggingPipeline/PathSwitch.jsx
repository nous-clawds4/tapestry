/**
 * The real-time path's switch (tagging-edges Story 5; ADR tagging-edges/0005 D12, D13, D14): one control, "Turn off"
 * while the path is on and "Turn on" while it is off (an unreadable switch counts as off), the prompt "Turn off"
 * opens first, the warning beside "Turn on", what the last change's answer meant, and the record of who switched the
 * path and when.
 *
 * The change itself is the panel's (TaggingPipelinePanel.jsx switchPath, through sendSwitch's 15 s race); this file
 * only renders and asks. The prompt is an inline confirmation that replaces the control while open, so only one
 * "Turn off" exists at a time; Cancel sends nothing, and the prompt closes by itself when a read shows the path off.
 */

import { useEffect, useRef, useState } from 'react';
import { offPromptVariant, turnOnWarning } from '../../../utils/taggingPipelineView.js';
import { ReadFailed, TONE_COLOUR, when } from './parts.jsx';
import { BackstopVerdict } from './ScheduleSection.jsx';

/**
 * The normal prompt's middle (story 5 AC-2 "Normally"): what is kept, and what keeps the graph in step meanwhile.
 * `schedPending` is true while the schedule list's first read has not answered.
 */
function WhileOff({ sched, schedPending }) {
  return (
    <div>
      <p>
        What it holds is kept. Changes stored on the relay meanwhile are caught up when it is turned back on, apart
        from the few cases it leaves to the next pass.
      </p>
      <p>Meanwhile, only a pass keeps the graph in step:</p>
      <BackstopVerdict view={sched} pending={schedPending} />
    </div>
  );
}

/** Before the first start has completed (story 5 AC-2; ADR 0005 D8 'first-start'): what turning off loses instead. */
function BeforeFirstStart() {
  return (
    <div>
      <p>
        Its first start has not completed, so what it has gathered so far is dropped, and the next Turn on is a first
        start again.
      </p>
      <p>At that first start, what the relay holds waits for a pass, so run one after the path shows live.</p>
    </div>
  );
}

/**
 * The off prompt (ADR 0005 D13): a heading, the variant's text (D8), and "Turn off" and "Cancel". Focus moves to
 * Cancel when it opens, through an effect, with no timer.
 */
function OffPrompt({ variant, sched, schedPending, onConfirm, onCancel }) {
  const cancel = useRef(null);
  useEffect(() => {
    if (cancel.current) cancel.current.focus();
  }, []);
  return (
    <div className="settings-group" style={{ borderColor: TONE_COLOUR.warn }}>
      <h4>Turn the real-time path off?</h4>
      <p>The path stops reflecting changes within a few seconds.</p>
      {variant === 'first-start' ? <BeforeFirstStart /> : <WhileOff sched={sched} schedPending={schedPending} />}
      {variant === 'unknown' && (
        <p>
          The path's status cannot be read, so the panel could not check whether its first start has completed. If it
          has not, what it has gathered so far is dropped, the next Turn on is a first start again, and a pass should
          run after the path shows live.
        </p>
      )}
      <p>
        <button className="btn-small" onClick={onConfirm}>Turn off</button>{' '}
        <button className="btn-small" ref={cancel} onClick={onCancel}>Cancel</button>
      </p>
    </div>
  );
}

/** The warning beside "Turn on" (story 5 AC-1; ADR 0005 D14). */
function TurnOnWarning({ warning }) {
  if (warning === 'no-finished-pass') {
    return (
      <p style={{ color: TONE_COLOUR.warn }}>
        The pass report holds no finished pass, so taggings already on the relay wait for a pass after the path is
        turned on.
      </p>
    );
  }
  if (warning === 'could-not-check') {
    return (
      <p style={{ color: TONE_COLOUR.warn }}>
        The pass report could not be read, so the panel could not check for a finished pass. Without one, taggings
        already on the relay wait for a pass after the path is turned on.
      </p>
    );
  }
  return null;
}

/** The last change's outcome: switchOutcome's sentence, and the refusal's HTTP status or the failure's code. */
function Outcome({ outcome }) {
  return (
    <p style={{ color: TONE_COLOUR[outcome.tone] }}>
      {outcome.text}
      {outcome.outcome === 'refused' && outcome.httpStatus !== null && ` HTTP status: ${outcome.httpStatus}.`}
      {outcome.code && <> Code: <code>{outcome.code}</code></>}
    </p>
  );
}

/**
 * `view` is pathView of the path status body; `statusRead` is the pass status read (for the warning beside "Turn
 * on"); `sched` is scheduleView of the schedule list, or null, and `schedPending` is true while that list's first
 * read has not answered; `change` is the panel's { target, pending, outcome }; `onSwitch(on)` sends a change.
 */
export default function PathSwitch({ view, body, statusRead, sched, schedPending, change, onSwitch }) {
  const [asking, setAsking] = useState(false);
  // A read that shows the path off closes the prompt: there is nothing left to turn off.
  useEffect(() => {
    if (!view.on) setAsking(false);
  }, [view.on]);

  let control;
  if (change.pending) {
    control = (
      <button className="btn-small" disabled aria-busy="true">
        {change.target ? 'Turning the path on…' : 'Turning the path off…'}
      </button>
    );
  } else if (asking) {
    control = (
      <OffPrompt
        variant={offPromptVariant(body)}
        sched={sched}
        schedPending={schedPending}
        onConfirm={() => { setAsking(false); onSwitch(false); }}
        onCancel={() => setAsking(false)}
      />
    );
  } else if (view.on) {
    control = <button className="btn-small" onClick={() => setAsking(true)}>Turn off</button>;
  } else {
    control = <button className="btn-small" onClick={() => onSwitch(true)}>Turn on</button>;
  }
  return (
    <div>
      {control}
      {!view.on && !change.pending && <TurnOnWarning warning={turnOnWarning(statusRead)} />}
      {change.outcome && !change.pending && <Outcome outcome={change.outcome} />}
    </div>
  );
}

/** One change: its sentence, and the time a recorded one was made. */
function ChangeLine({ line }) {
  return <>{line.text}{line.at && ` at ${when(line.at)}.`}</>;
}

/**
 * The record of who switched the path (story 5 AC-5; ADR 0005 D12): the latest change, then the last 10 changes,
 * newest first, as an ordered list. `view` is switchRecordView of the record read and the path status body. A read
 * that failed has its own ReadFailed, and never shows a kept body.
 */
export function SwitchRecord({ read, view, onRetry }) {
  if (view.status === 'failed') {
    return <ReadFailed what={view.what} error={read.error || { code: 'bad-json' }} onRetry={onRetry} />;
  }
  if (view.status !== 'shown') return <p className="settings-hint">{view.text}</p>;
  const labelled = view.state === 'recorded' || view.state === 'unrecorded-off';
  return (
    <div>
      <p>{labelled && 'Latest change: '}<ChangeLine line={view.latest} /></p>
      {view.notes.map((n) => <p key={n} style={{ color: TONE_COLOUR.warn }}>{n}</p>)}
      {view.history.length > 0 && (
        <div>
          <p className="settings-hint">Recent changes, newest first:</p>
          <ol>
            {view.history.map((h, i) => <li key={i}><ChangeLine line={h} /></li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
