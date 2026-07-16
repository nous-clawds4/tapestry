/**
 * Debounced applicability-refresh scheduler (ADR tag-applicability/0003).
 *
 * The client fires a best-effort notify on every tag mutation; `schedule()` coalesces all calls
 * within `windowMs` into a SINGLE `refresh()` run (the diff-guard in refreshApplicabilityLists then
 * publishes only the lists whose membership actually changed). In-process state — the control panel
 * is a single node process; a pending run dropped on restart is recovered by the next mutation or
 * the slow backstop.
 *
 * Overlap-guarded: a `schedule()` that arrives while a refresh is in flight queues exactly one
 * trailing run (so a mutation during a slow refresh is never lost, and runs never overlap).
 *
 * @param {Object} o
 * @param {() => Promise<any>} o.refresh   the refresh to run (e.g. refreshApplicabilityLists)
 * @param {number} [o.windowMs=10000]      coalescing window
 * @returns {{ schedule: () => void }}
 */
function createApplicabilityScheduler({ refresh, windowMs = 10000 } = {}) {
  let timer = null;      // pending window timer
  let running = false;   // a refresh() is in flight
  let pending = false;   // a schedule() arrived mid-run → run once more after

  async function runNow() {
    timer = null;
    if (running) { pending = true; return; }
    running = true;
    try {
      await refresh();
    } catch (err) {
      // Best-effort — a failed refresh is retried by the next mutation or the backstop.
      console.error('[applicabilityScheduler] refresh failed:', err && err.message);
    } finally {
      running = false;
      if (pending) { pending = false; schedule(); }
    }
  }

  function schedule() {
    if (running) { pending = true; return; } // fold into a single trailing run
    if (timer) return;                        // already coalescing this window
    timer = setTimeout(runNow, windowMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }

  return { schedule };
}

module.exports = { createApplicabilityScheduler };
