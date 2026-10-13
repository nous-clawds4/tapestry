import { useEffect, useState } from 'react';
import { categoryOf } from '../assistant/dutyMenuCopy';
import { ASSISTANT_DUTIES_COPY as COPY, refusalLine, moveDuty, addDuty, removeDuty, setRelay } from './assistantDutiesCopy';

/**
 * The Settings page's Assistant Duties tab (assistant-duties-settings #1, ADR assistant-duties-settings/0001
 * sub-decision 7): the duties every Assistant on this instance offers on its Duty Menu, in order, each with its
 * category and relay. The Owner or an Admin adds any key of the Treasure Maps grammar, removes duties, reorders them (dragging, or Move
 * up / Move down from the keyboard), changes a duty's relay, and resets to the six defaults.
 *
 * Each change sends the whole list to PUT /api/settings/assistant-duties at once; the server checks it (src/lib/duty-menu
 * validateDutyList) and answers the list it stored, which the tab then shows. A refusal leaves the list as it was. Reset
 * is POST /api/settings/assistant-duties/reset, after a confirmation. Every control is disabled while a request is out.
 * The Settings page shows this tab to the Owner and Admins only; the routes refuse anyone else.
 */

const ROUTE = '/api/settings/assistant-duties';
const RESET_ROUTE = '/api/settings/assistant-duties/reset';

/** One request; answers { ok, body } where body is the parsed JSON or null. */
async function ask(url, options) {
  try {
    const res = await fetch(url, options);
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { ok: res.ok && Boolean(body && body.success), body };
  } catch {
    return { ok: false, body: null };
  }
}

/** The relay choice: This instance's relay, or Another relay with a field for it. */
function RelayChoice({ name, mode, relay, onMode, onRelay, disabled }) {
  return (
    <div className="settings-duties-relay-choice">
      <label>
        <input type="radio" name={name} checked={mode === 'instance'} onChange={() => onMode('instance')} disabled={disabled} />
        {' '}{COPY.relayChoice.thisInstance}
      </label>
      <label>
        <input type="radio" name={name} checked={mode === 'another'} onChange={() => onMode('another')} disabled={disabled} />
        {' '}{COPY.relayChoice.another}
      </label>
      {mode === 'another' && (
        <input
          type="text"
          className="settings-duties-relay-input"
          placeholder={COPY.relayChoice.placeholder}
          value={relay}
          onChange={(e) => onRelay(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}

export default function AssistantDuties() {
  const [duties, setDuties] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  // The open relay change, by its duty's key, so it stays with that duty whatever else moves (ADR Amendment 1 item 3).
  const [editing, setEditing] = useState(null); // { key, mode, relay }
  const [newKey, setNewKey] = useState('');
  const [newMode, setNewMode] = useState('instance');
  const [newRelay, setNewRelay] = useState('');
  const [dragFrom, setDragFrom] = useState(null);

  useEffect(() => {
    let live = true;
    ask(ROUTE).then(({ ok, body }) => {
      if (!live) return;
      if (ok && Array.isArray(body.duties)) setDuties(body.duties);
      else setLoadFailed(true);
    });
    return () => { live = false; };
  }, []);

  /** Send the whole next list; true when the server stored it. */
  async function save(next) {
    setBusy(true);
    setMessage(null);
    const { ok, body } = await ask(ROUTE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duties: next }),
    });
    setBusy(false);
    if (ok && Array.isArray(body.duties)) {
      setDuties(body.duties);
      // An open relay change whose duty is gone closes with it.
      setEditing((open) => (open && body.duties.some((d) => d.key === open.key) ? open : null));
      setMessage({ type: 'success', text: COPY.saved });
      return true;
    }
    setMessage({ type: 'error', text: refusalLine(body && body.code) });
    return false;
  }

  async function reset() {
    if (!window.confirm(COPY.resetConfirm)) return;
    setBusy(true);
    setMessage(null);
    setEditing(null);
    const { ok, body } = await ask(RESET_ROUTE, { method: 'POST' });
    setBusy(false);
    if (ok && Array.isArray(body.duties)) {
      setDuties(body.duties);
      setMessage({ type: 'success', text: COPY.saved });
    } else {
      setMessage({ type: 'error', text: COPY.requestFailed });
    }
  }

  async function add(e) {
    e.preventDefault();
    const entry = newMode === 'another' ? { key: newKey, relay: newRelay } : { key: newKey };
    if (await save(addDuty(duties, entry))) {
      setNewKey('');
      setNewRelay('');
      setNewMode('instance');
    }
  }

  async function saveRelay() {
    const index = duties.findIndex((d) => d.key === editing.key);
    if (index < 0) { setEditing(null); return; }
    // An empty Another relay is sent as it is, so the server refuses it as when adding (ADR Amendment 1 item 4).
    const relay = editing.mode === 'another' ? editing.relay : null;
    if (await save(setRelay(duties, index, relay))) setEditing(null);
  }

  function drop(to) {
    const from = dragFrom;
    setDragFrom(null);
    if (from === null || from === to || busy) return;
    save(moveDuty(duties, from, to));
  }

  if (loadFailed) {
    return (
      <div className="settings-section">
        <h2>{COPY.heading}</h2>
        <p className="error">{COPY.loadFailed}</p>
      </div>
    );
  }
  if (duties === null) {
    return (
      <div className="settings-section">
        <h2>{COPY.heading}</h2>
        <p className="text-muted">{COPY.loading}</p>
      </div>
    );
  }

  const last = duties.length - 1;
  return (
    <div className="settings-section settings-duties">
      <h2>{COPY.heading}</h2>
      <p className="settings-hint">{COPY.intro}</p>

      {message && <div className={`settings-message settings-message-${message.type}`} role="status">{message.text}</div>}

      {duties.length === 0 && <p className="text-muted">{COPY.empty}</p>}
      {duties.length > 0 && (
        <ol className="settings-duties-list" aria-label={COPY.heading}>
          {duties.map((duty, i) => {
            const category = categoryOf(duty.key);
            const isEditing = editing && editing.key === duty.key;
            return (
              <li
                key={duty.key}
                className={`settings-group settings-duties-row${dragFrom === i ? ' is-dragging' : ''}`}
                draggable={!busy}
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', duty.key); }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e) => { e.preventDefault(); drop(i); }}
                onDragEnd={() => setDragFrom(null)}
              >
                <div className="settings-duties-line">
                  <span className="settings-duties-handle" aria-label={COPY.dragHandle} title={COPY.dragHandle}>⋮⋮</span>
                  <code className="settings-duties-key">{duty.key}</code>
                  {category && <span className="settings-duties-category">{category}</span>}
                  <span className={`settings-duties-relay${duty.relay ? '' : ' is-instance'}`}>{duty.relay || COPY.relayChoice.thisInstance}</span>
                  <span className="settings-group-actions">
                    <button type="button" className="btn-small" onClick={() => save(moveDuty(duties, i, i - 1))} disabled={busy || i === 0}>{COPY.moveUp}</button>
                    <button type="button" className="btn-small" onClick={() => save(moveDuty(duties, i, i + 1))} disabled={busy || i === last}>{COPY.moveDown}</button>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => setEditing({ key: duty.key, mode: duty.relay ? 'another' : 'instance', relay: duty.relay || '' })}
                      disabled={busy || Boolean(isEditing)}
                    >
                      {COPY.changeRelay}
                    </button>
                    <button type="button" className="btn-small" onClick={() => save(removeDuty(duties, i))} disabled={busy}>{COPY.remove}</button>
                  </span>
                </div>
                {isEditing && (
                  <div className="settings-duties-edit">
                    <RelayChoice
                      name={`assistant-duties-relay-${duty.key}`}
                      mode={editing.mode}
                      relay={editing.relay}
                      onMode={(mode) => setEditing({ ...editing, mode })}
                      onRelay={(relay) => setEditing({ ...editing, relay })}
                      disabled={busy}
                    />
                    <button type="button" className="btn-small btn-primary" onClick={saveRelay} disabled={busy}>{COPY.save}</button>
                    <button type="button" className="btn-small" onClick={() => setEditing(null)} disabled={busy}>{COPY.cancel}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <form className="settings-group settings-duties-add" onSubmit={add}>
        <label className="settings-duties-key-field" htmlFor="assistant-duties-new-key">{COPY.keyLabel}</label>
        <input id="assistant-duties-new-key" type="text" value={newKey} onChange={(e) => setNewKey(e.target.value)} disabled={busy} />
        <RelayChoice
          name="assistant-duties-add-relay"
          mode={newMode}
          relay={newRelay}
          onMode={setNewMode}
          onRelay={setNewRelay}
          disabled={busy}
        />
        <button type="submit" className="btn-small btn-primary" disabled={busy}>{COPY.add}</button>
      </form>

      <button type="button" className="btn-small" onClick={reset} disabled={busy}>{COPY.reset}</button>
    </div>
  );
}
