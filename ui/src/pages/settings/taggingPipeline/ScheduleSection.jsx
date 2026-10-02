/**
 * The backstop schedule (tagging-edges Story 4 AC-2 "The backstop schedule"; ADR tagging-edges/0004 § UI
 * scheduleView): how many enabled Scheduled Tasks entries run the pass, and a warning with a way to the Scheduled
 * Tasks sub-tab when the backstop is missing, unscheduled, weaker than daily, or doubled. The panel does not
 * create, enable or edit a schedule.
 *
 * BackstopVerdict is the one place each schedule state is put into words: this section and the real-time path's
 * off prompt both render it, so the two cannot drift apart (story 5; ADR tagging-edges/0005 D13).
 */

import { Loading, ReadFailed, Section, TONE_COLOUR, counted, when } from './parts.jsx';

function Warning({ children }) {
  return <p style={{ color: TONE_COLOUR.warn }}>{children}</p>;
}

/**
 * What the backstop schedule's verdict is, in words, from scheduleView's result. With no view (the list has not
 * been read), it says the backstop could not be checked.
 */
export function BackstopVerdict({ view }) {
  if (!view) {
    return <Warning>The backstop could not be checked, because the schedule list could not be read.</Warning>;
  }
  return (
    <>
      {view.verdict === 'none' && (
        <Warning>
          No enabled Scheduled Tasks entry runs the pass "Reconcile tagging relationships", so the real-time path has
          no backstop.
        </Warning>
      )}
      {view.verdict === 'one' && (
        <p>
          One enabled entry runs the pass: {view.intervalText}.
          {view.nextRunAt ? ` It runs next at ${when(view.nextRunAt)}.` : ''}
        </p>
      )}
      {view.verdict === 'one' && view.unscheduled && (
        <Warning>It is enabled but not scheduled: the scheduler has no next run for it.</Warning>
      )}
      {view.verdict === 'one' && view.weakerThanDaily && (
        <Warning>It runs less often than daily, so the backstop is weaker than daily.</Warning>
      )}
      {view.verdict === 'several' && (
        <Warning>
          {counted(view.enabledCount, 'enabled entry runs', 'enabled entries run')} the pass. One is enough, and the
          others repeat its work.
        </Warning>
      )}
    </>
  );
}

/**
 * `read` is the schedule list's read ({ state, body, error, readAt }); `view` is scheduleView of its body, or null.
 * `onOpenSchedule` opens the Scheduled Tasks sub-tab.
 */
export default function ScheduleSection({ read, view, onRetry, onOpenSchedule }) {
  const title = 'The backstop schedule';
  if (read.state === 'loading') {
    return <Section testId="tp-schedule" state="loading" title={title}><Loading what="the schedule list" /></Section>;
  }
  if (!view) {
    // No good answer yet, or one that is not a list: the read failed either way, and no figures follow.
    const error = read.error || { code: 'bad-json' };
    return (
      <Section testId="tp-schedule" state="error" title={title}>
        <ReadFailed what="The schedule list" error={error} readAt={null} onRetry={onRetry} />
      </Section>
    );
  }

  const disabled = view.disabledCount > 0 && (
    <p className="settings-hint">
      Not counted: {counted(view.disabledCount, 'disabled entry', 'disabled entries')} for the pass.
    </p>
  );
  const warned = view.verdict !== 'one' || view.unscheduled || view.weakerThanDaily;
  return (
    <Section testId="tp-schedule" state={read.state === 'error' ? 'error' : 'ready'} title={title} tone={view.tone}>
      {read.state === 'error' && (
        <ReadFailed what="The schedule list" error={read.error} readAt={read.readAt} onRetry={onRetry} />
      )}
      <BackstopVerdict view={view} />
      {disabled}
      {warned && (
        <button className="btn-small" onClick={onOpenSchedule}>Open Scheduled Tasks</button>
      )}
    </Section>
  );
}
