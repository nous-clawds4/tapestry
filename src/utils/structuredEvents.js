/**
 * Node-side structured-events emitter.
 * Story #15 / ADR 0013.
 *
 * Node equivalent of bash `emit_task_event` (from src/utils/structuredLogging.sh).
 * Writes single JSONL lines to ${BRAINSTORM_LOG_DIR}/taskQueue/events.jsonl
 * matching the bash version's shape exactly, so the existing structured-event
 * UI / grep workflow doesn't have to learn a second format.
 *
 * Bash-matching JSONL shape per line:
 *   {
 *     "timestamp":   "<ISO-8601>",
 *     "eventType":   "<TASK_START | PROGRESS | TASK_END | TASK_ERROR | ...>",
 *     "taskName":    "<...>",
 *     "target":      "<...>",
 *     "metadata":    { ...arbitrary... },
 *     "scriptName":  "<filename derived from caller stack>",
 *     "pid":         <process.pid of the Node process>
 *   }
 *
 * Design notes (per ADR 0013 §New files):
 * - `fs.appendFileSync` for line-atomic writes under PIPE_BUF (4 KB on Linux).
 *   Async appendFile interleaves under concurrent writes and corrupts JSONL.
 * - Honors `BRAINSTORM_STRUCTURED_LOGGING=false` env var to short-circuit
 *   (matches bash version's gate).
 * - Does NOT implement rotation; the bash structuredLogging.sh side already
 *   rotates the events.jsonl file. Single owner of rotation = simpler.
 * - `scriptName` is derived from the call stack (best-effort) so events
 *   originated from different Node modules are distinguishable in `events.jsonl`.
 * - `pid` is always `process.pid` of the Node process. For Worker emissions
 *   this is the control-panel process PID (all Workers share it). Bash-side
 *   emitters capture each spawned script's `$$`, which differs.
 */

const fs = require('fs');
const path = require('path');
const brainstormConfig = require('./brainstormConfig');

function getEventsPath() {
  const logDir = brainstormConfig.get('BRAINSTORM_LOG_DIR') || '/var/log/brainstorm';
  return path.join(logDir, 'taskQueue', 'events.jsonl');
}

function ensureDir(filePath) {
  try { fs.mkdirSync(path.dirname(filePath), { recursive: true }); }
  catch (_e) { /* best-effort */ }
}

/**
 * Derive a useful `scriptName` for the event payload by walking the V8 stack
 * back to the first frame outside this module. Falls back to require.main or
 * the literal string 'node' if we can't find one.
 */
function getCallerScriptName() {
  try {
    const stack = new Error().stack || '';
    const lines = stack.split('\n');
    for (let i = 2; i < lines.length; i++) {
      // Match either "at fn (path:line:col)" or "at path:line:col".
      const m = lines[i].match(/\(([^)]+):\d+:\d+\)/) || lines[i].match(/at ([^\s]+):\d+:\d+/);
      if (m && m[1] && !m[1].endsWith('structuredEvents.js')) {
        return path.basename(m[1]);
      }
    }
  } catch (_e) { /* fall through */ }
  if (require.main && require.main.filename) return path.basename(require.main.filename);
  return 'node';
}

/**
 * Emit a single structured event to events.jsonl.
 *
 * Signature mirrors bash emit_task_event:
 *   emit_task_event "EVENT_TYPE" "task-name" "target" '{"k":"v"}'
 *
 * @param {string} eventType    e.g., "TASK_START", "PROGRESS", "TASK_ERROR"
 * @param {string} taskName     e.g., "calculateOwnerGrapeRank"
 * @param {string} target       e.g., a pubkey, customer id, or ""
 * @param {object} metadata     arbitrary structured metadata
 */
function emitTaskEvent(eventType, taskName, target, metadata) {
  if (process.env.BRAINSTORM_STRUCTURED_LOGGING === 'false') return;

  const eventsPath = getEventsPath();
  ensureDir(eventsPath);

  const event = {
    timestamp: new Date().toISOString(),
    eventType: eventType || 'UNKNOWN',
    taskName: taskName || '',
    target: target || '',
    metadata: metadata || {},
    scriptName: getCallerScriptName(),
    pid: process.pid
  };

  try {
    fs.appendFileSync(eventsPath, JSON.stringify(event) + '\n');
  } catch (e) {
    // Best-effort: don't crash the caller if event logging fails.
    // (e.g., disk full, permission denied) — log to stderr and proceed.
    console.warn(`[structured-events] Failed to write event: ${e.message}`);
  }
}

module.exports = { emitTaskEvent };
