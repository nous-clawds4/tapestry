/**
 * AddOrEditEntryModal (story #17 / ADR 0015): the modal used to create
 * or edit a scheduled task entry. The argument form is registry-driven —
 * the task dropdown comes from GET /api/scheduled-tasks/registry-tasks
 * (parameterized-only subset), and each task's `arguments` block drives
 * the form fields rendered via argFieldRenderer.
 *
 * On Save the modal POSTs to /api/scheduled-tasks/create (new entry) or
 * /api/scheduled-tasks/update (existing entry). The Save button is
 * disabled while any required argument is unset — story #17 AC-6
 * "Required arguments block save".
 */

import { useState, useEffect, useMemo } from 'react';
import renderArgField from './argFieldRenderer.jsx';

export default function AddOrEditEntryModal({ entry, onClose, onSaved }) {
  const isEdit = !!entry;
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskId, setTaskId] = useState(entry?.taskId || '');
  const [args, setArgs] = useState(entry?.args || {});
  const [label, setLabel] = useState(entry?.label || '');
  const [enabled, setEnabled] = useState(entry?.enabled ?? false);
  const [intervalHours, setIntervalHours] = useState(entry?.intervalHours ?? 24);
  const [intervalDays, setIntervalDays] = useState(entry?.intervalDays ?? 0);
  const [intervalMinutes, setIntervalMinutes] = useState(entry?.intervalMinutes ?? 0);
  const [cron, setCron] = useState(entry?.cron ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  // Fetch the parameterized-task list for the dropdown.
  useEffect(() => {
    fetch('/api/scheduled-tasks/registry-tasks')
      .then((r) => r.json())
      .then((d) => {
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
        setLoadingTasks(false);
      })
      .catch((err) => {
        console.error('AddOrEditEntryModal: failed to load /api/scheduled-tasks/registry-tasks', err);
        setLoadingTasks(false);
      });
  }, []);

  // When the operator picks a new task (create mode only), pre-fill the
  // form with the registry's declared defaults for optional args.
  useEffect(() => {
    if (!taskId) return;
    if (isEdit && taskId === entry?.taskId) return;
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return;
    const defaults = {};
    for (const [argName, schema] of Object.entries(task.arguments || {})) {
      if (schema && typeof schema === 'object' && 'default' in schema) {
        defaults[argName] = schema.default;
      }
    }
    setArgs(defaults);
  }, [taskId, tasks, isEdit, entry?.taskId]);

  // Compute the list of missing required arguments. Save is disabled
  // while this is non-empty — story #17 AC-6 "Required arguments block save".
  const missingRequiredArgs = useMemo(() => {
    if (!taskId) return ['taskId'];
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return ['taskId'];
    const missing = [];
    for (const [argName, schema] of Object.entries(task.arguments || {})) {
      // Currently the only "required" arg shape is `customer: true`.
      if (argName === 'customer' && schema === true) {
        const v = args[argName];
        if (v === undefined || v === null || v === '') missing.push(argName);
      }
    }
    return missing;
  }, [taskId, tasks, args]);

  const saveDisabled = saving || loadingTasks || missingRequiredArgs.length > 0;

  function updateArg(name, value) {
    setArgs((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setErrors([]);
    try {
      const body = {
        taskId,
        args,
        label: label || undefined,
        enabled,
        intervalHours: parseInt(intervalHours, 10) || 0,
        intervalDays: parseInt(intervalDays, 10) || 0,
        intervalMinutes: parseInt(intervalMinutes, 10) || 0,
        cron: typeof cron === 'string' ? cron.trim() : '',
      };
      const url = isEdit ? '/api/scheduled-tasks/update' : '/api/scheduled-tasks/create';
      if (isEdit) body.entryId = entry.id;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!data.success) {
        setErrors(data.errors || [{
          field: 'server', code: 'SERVER_ERROR', message: data.error || 'Save failed',
        }]);
        setSaving(false);
        return;
      }
      setSaving(false);
      onSaved && onSaved(data.entry);
      onClose && onClose();
    } catch (err) {
      setErrors([{ field: 'network', code: 'NETWORK_ERROR', message: err.message }]);
      setSaving(false);
    }
  }

  const selectedTask = tasks.find((t) => t.taskId === taskId);
  const argsSchema = (selectedTask && selectedTask.arguments) || {};
  const errorByField = (field) => (errors.find((e) => e.field === field) || {}).message;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '1.5rem',
        maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto',
        color: '#e0e0e0',
      }}>
        <h2 style={{ marginTop: 0 }}>{isEdit ? 'Edit Scheduled Entry' : 'Add Scheduled Entry'}</h2>

        {/* Task picker */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span>
              Task <span style={{ color: '#ef4444' }}>*</span>
              <span style={{ color: '#888', fontSize: '0.85rem' }}> (required)</span>:
            </span>
            <select
              value={taskId}
              disabled={isEdit || loadingTasks}
              onChange={(e) => setTaskId(e.target.value)}
              style={{ padding: '0.4rem', backgroundColor: '#222', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <option value="">{loadingTasks ? 'Loading…' : '— Select a task —'}</option>
              {tasks.map((t) => (
                <option key={t.taskId} value={t.taskId}>{t.name || t.taskId}</option>
              ))}
            </select>
            {selectedTask?.description && (
              <span style={{ fontSize: '0.8rem', color: '#888' }}>{selectedTask.description}</span>
            )}
          </label>
        </div>

        {/* Argument form (registry-driven) */}
        {selectedTask && Object.keys(argsSchema).length > 0 && (
          <div style={{
            marginBottom: '1rem', padding: '0.75rem',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
          }}>
            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
              Arguments:
            </div>
            {Object.entries(argsSchema).map(([argName, schema]) => (
              <div key={argName} style={{ marginBottom: '0.6rem' }}>
                {renderArgField({
                  name: argName,
                  schema,
                  value: args[argName],
                  onChange: updateArg,
                  error: errorByField(argName),
                })}
              </div>
            ))}
          </div>
        )}

        {/* Optional label */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.9rem' }}>Label (optional nickname):</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={selectedTask?.name || 'Auto: <task name>'}
              style={{ padding: '0.4rem', backgroundColor: '#222', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.15)' }}
            />
          </label>
        </div>

        {/* Schedule */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enabled</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', flexWrap: 'wrap' }}>
            <span>Run every</span>
            <input
              type="number" min="0" max="30" value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              style={{ width: '3.5rem', padding: '0.3rem 0.5rem', backgroundColor: '#222', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.15)' }}
            />
            <span>days</span>
            <input
              type="number" min="0" max="23" value={intervalHours}
              onChange={(e) => setIntervalHours(e.target.value)}
              style={{ width: '3.5rem', padding: '0.3rem 0.5rem', backgroundColor: '#222', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.15)' }}
            />
            <span>hours</span>
            <input
              type="number" min="0" max="59" value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(e.target.value)}
              style={{ width: '3.5rem', padding: '0.3rem 0.5rem', backgroundColor: '#222', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.15)' }}
            />
            <span>minutes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            <span>or cron:</span>
            <input
              type="text" value={cron} placeholder="e.g. 0 4 * * 0"
              onChange={(e) => setCron(e.target.value)}
              style={{ flex: 1, padding: '0.3rem 0.5rem', backgroundColor: '#222', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.15)' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#777' }}>(overrides interval)</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.3rem' }}>
            ADR 0019 dropped the 1-hour floor; an enabled schedule needs either a cron expression or any positive interval.
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{
            marginBottom: '1rem', padding: '0.5rem',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px',
          }}>
            {errors.map((e, i) => (
              <div key={i} style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                <strong>{e.field}:</strong> {e.message}
              </div>
            ))}
          </div>
        )}

        {missingRequiredArgs.length > 0 && (
          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#f59e0b' }}>
            ⚠️ Missing required arguments: {missingRequiredArgs.join(', ')} — Save is disabled until these are filled in.
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.75rem' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: saveDisabled ? '#444' : '#22c55e',
              color: '#fff', cursor: saveDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
