import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import DictionaryShell from './DictionaryShell';
import DictIcon from '../dictionaries/DictIcon';
import { scan } from '../dictionaries/ConceptEntry';
import { coordParts, dictionaryEntryPath, displayName, useConceptDictionary, useDictionaryPerson } from '../dictionaries/conceptsDictionary';
import { usePov } from '../../context/PovContext';
import { publishToRelays } from '../../utils/nostrPublish';
import { CONCEPT_PUBLISH_RELAYS } from '../../utils/dispositionActions';
import { ASSISTANT_COPY } from '../assistant/actions';
import { classifyBroadcast, outcomeMessage } from '@tapestry/broadcast-outcome';
import { PROPERTY_REQUIREMENTS, changesTags, checkEditFields, composeEdit, headerFields, nameKeyed } from '@tapestry/concept-header-edit';

/** Saves the new version with the signed-in person's own Assistant (src/api/adoption/editConcept.js). */
export const EDIT_CONCEPT_API = '/api/dictionaries/concepts/edit';

const firstD = (ev) => (ev?.tags || []).find((t) => Array.isArray(t) && t[0] === 'd')?.[1];

/** The header's latest version at exactly this address, as the server reads it (first d tag, the newest). */
function useLatestHeader(coord) {
  const [state, setState] = useState({ event: null, error: null, done: false });
  useEffect(() => {
    let cancelled = false;
    setState({ event: null, error: null, done: false });
    const { kind, pubkey, d } = coordParts(coord);
    (async () => {
      try {
        if (kind !== '39998' || !/^[0-9a-f]{64}$/.test(pubkey || '') || !d) throw new Error(`Not a concept’s address: ${coord}`);
        const events = (await scan({ kinds: [39998], authors: [pubkey], '#d': [d] }))
          .filter((ev) => ev && ev.pubkey === pubkey && ev.kind === 39998 && firstD(ev) === d);
        const newest = events.reduce((a, b) => (!a || (b.created_at || 0) > (a.created_at || 0) ? b : a), null);
        if (!cancelled) setState({ event: newest, error: newest ? null : 'This instance’s relay has no header at this address.', done: true });
      } catch (err) {
        if (!cancelled) setState({ event: null, error: err.message, done: true });
      }
    })();
    return () => { cancelled = true; };
  }, [coord]);
  return state;
}

/** Is this header one a firmware reinstall rebuilds? Decided by the server from the address. null until known. */
function useFirmware(coord) {
  const [firmware, setFirmware] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setFirmware(null);
    fetch(`/api/dictionaries/concepts/firmware?coord=${encodeURIComponent(coord)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setFirmware(Boolean(data && data.success && data.firmware)); })
      .catch(() => { if (!cancelled) setFirmware(null); });
    return () => { cancelled = true; };
  }, [coord]);
  return firmware;
}

/** The new version as the preview shows it: the event, one tag per line. */
function preview(event) {
  const lines = (event.tags || []).map((t) => `    ${JSON.stringify(t)}`).join(',\n');
  return `{\n  "kind": ${event.kind},\n  "tags": [\n${lines}\n  ],\n  "content": ${JSON.stringify(event.content || '')}\n}`;
}

/**
 * /dictionary/:coord/edit — edit a concept (the owner's request of 2026-10-02): the New DList page's
 * fields, the singular and plural names, the description and the Item Property Tags, filled in from the
 * header's latest version. Saving has the signed-in person's own Assistant sign a new version of its
 * header; only a header that Assistant wrote can be edited here, and the entry page offers Edit only
 * then. The address (d-tag) never changes, so the concept's items and anything wired to it keep pointing
 * at it, and every tag the form doesn't show (the b-tags among them) is kept. The preview is exactly what
 * is signed (src/lib/conceptHeaderEdit.js, shared with the server).
 *
 * If the header changed after this page loaded it, saving stops and offers to start again from the
 * latest version rather than overwrite it. A firmware concept can be edited, with a warning that a
 * firmware reinstall rebuilds its header (owner, 2026-10-02). The new version is broadcast to the
 * community relay, and the page says what the broadcast did.
 */
export default function DictionaryEditConceptPage() {
  // The router has decoded the param already: decoding again would break a d-tag with a "%" in it.
  const { coord: rawCoord } = useParams();
  const coord = rawCoord || '';
  const location = useLocation();
  const navigate = useNavigate();
  const { povParams } = usePov();
  const person = useDictionaryPerson();
  const passed = location.state?.entry?.coord === coord ? location.state : null;
  const dict = useConceptDictionary(person, povParams, { enabled: !passed?.entry });
  const entry = passed?.entry || (dict.data?.entries || []).find((e) => e.coord === coord) || null;
  const read = useLatestHeader(coord);
  const firmware = useFirmware(coord);
  const { pubkey: author, d } = coordParts(coord);

  const [base, setBase] = useState(null); // the version being edited: the one read, or the latest after a conflict
  const [form, setForm] = useState(null);
  const [newReq, setNewReq] = useState('required');
  const [newValue, setNewValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [taken, setTaken] = useState(null); // another concept of the Assistant's with the singular name asked for
  const [changed, setChanged] = useState(null); // the latest version, when it isn't the one being edited
  const [undelivered, setUndelivered] = useState(null); // { event, message } when the broadcast didn't land

  // Start from what was read; a conflict replaces the base, and only then the form, at the person's word.
  useEffect(() => {
    if (read.event && !base) { setBase(read.event); setForm(headerFields(read.event)); }
  }, [read.event]); // the read arriving, not each render

  const mine = person.signedIn && Boolean(author) && author === person.assistant;
  // The server finds some concepts by their name: their singular name stays (the rest can change).
  const baseSingular = base ? headerFields(base).singular : '';
  const lockedName = nameKeyed(baseSingular);
  const check = form ? checkEditFields(form) : { error: null };
  const draft = base && check.fields ? composeEdit(base, check.fields, Math.floor(Date.now() / 1000)) : null;
  const dirty = Boolean(base && draft && changesTags(base, draft));
  const locked = Boolean(undelivered);
  const canSave = mine && Boolean(draft) && dirty && !busy && !locked && !changed;

  const set = (key) => (e) => {
    if (key === 'singular') setTaken(null); // a taken name's alert goes once the name changes
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };
  const addProperty = () => {
    const value = newValue.trim();
    if (!value) return;
    setForm((f) => ({ ...f, properties: [...f.properties, [newReq, value]] }));
    setNewValue('');
  };
  const removeProperty = (i) => setForm((f) => ({ ...f, properties: f.properties.filter((_, k) => k !== i) }));

  const entryPath = dictionaryEntryPath(coord);
  const backState = passed ? { entry: passed.entry, listHref: passed.listHref } : undefined;
  const name = form?.singular || (entry ? displayName(entry) : d);

  const finish = async (signed, graph) => {
    let result = null;
    try { result = await publishToRelays(signed, CONCEPT_PUBLISH_RELAYS); } catch { result = null; }
    const outcome = classifyBroadcast(result);
    let message = outcomeMessage({ outcome, verb: 'save' });
    if (graph === 'failed') message += ' This instance’s graph wasn’t fully updated, so the control panel may show the old version, or an incomplete one.';
    if (outcome === 'not-delivered') { setUndelivered({ event: signed, message, graph }); return; }
    navigate(entryPath, { state: { notice: message, listHref: passed?.listHref } });
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    setTaken(null);
    try {
      const resp = await fetch(EDIT_CONCEPT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coord, basedOn: base.id, ...check.fields }),
      });
      let data = {};
      try { data = await resp.json(); } catch { data = {}; }
      if (resp.status === 409 && data.code === 'changed' && data.event) { setChanged(data.event); return; }
      if (resp.status === 409 && data.code === 'name-taken' && data.coord) { setTaken({ coord: data.coord, name: check.fields.singular }); return; }
      if (!resp.ok || !data.success) throw new Error(data.error || `HTTP ${resp.status}`);
      if (data.unchanged) { navigate(entryPath, { state: { notice: 'No changes to save.', listHref: passed?.listHref } }); return; }
      const signed = data.event;
      // Broadcast only what was signed as the Assistant this page names.
      if (!signed || signed.pubkey !== person.assistant) {
        throw new Error('The server signed with a different key from your Assistant’s. The new version is stored on this instance, but it was not shared onward.');
      }
      await finish(signed, data.graph);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!undelivered) return;
    setBusy(true);
    try { await finish(undelivered.event, undelivered.graph); } finally { setBusy(false); }
  };

  const startOver = () => {
    setBase(changed);
    setForm(headerFields(changed));
    setChanged(null);
    setError(null);
  };

  const refusal = person.loading ? null
    : !person.signedIn ? 'Sign in to edit this concept.'
      : !person.assistant ? null // the no-Assistant line below
        : !mine ? 'This concept’s header was published by someone other than your Assistant, so your Assistant can’t edit it.'
          : null;
  const noAssistant = !person.loading && person.signedIn && !person.assistant;
  const selfShared = (base?.tags || []).some((t) => t[0] === 'b' && t[1] === coord);

  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <Link to={entryPath} state={backState} className="dict-back"><DictIcon name="back" /> {name}</Link>
        <h1 className="dict-entry-title">Edit concept</h1>
        <p className="dict-lede dict-new-lede">
          Change its names, its description and its Item Property Tags. Your Assistant publishes the new version of
          its header. Its address stays <code>{d}</code>, so its items and anything wired to it keep pointing at it,
          and its other tags are kept as they are.
        </p>
        {refusal && <p className="dict-notice">{refusal}</p>}
        {noAssistant && (
          <p className="dict-notice" role="status">
            {ASSISTANT_COPY.noAssistantLine} <Link to="/setup">{ASSISTANT_COPY.noAssistantLink}</Link>
          </p>
        )}
        {(firmware || entry?.firmwareHeader) && (
          <p className="dict-notice dict-edit-warning" role="note">
            This is a firmware concept. A firmware reinstall rebuilds its header from the built-in definition, which
            will undo these edits.
          </p>
        )}
        {selfShared && (
          <p className="dict-entry-note text-muted">
            It’s shared, so the new version is what others see once it reaches the community relay.
          </p>
        )}
        {!read.done && <p className="text-muted">Reading the concept’s header…</p>}
        {read.done && read.error && <p className="dict-notice">{`Couldn’t read the concept’s header: ${read.error}`}</p>}

        {form && (
          <form className="dict-card dict-new-card" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <fieldset disabled={!mine || busy || locked || Boolean(changed)} className="dict-new-fields">
              <div className="dict-new-names">
                <label className="dict-field">
                  <span className="dict-field-label">Singular name</span>
                  <input className="dict-input" value={form.singular} onChange={set('singular')} readOnly={lockedName} aria-readonly={lockedName} />
                </label>
                <label className="dict-field">
                  <span className="dict-field-label">Plural name</span>
                  <input className="dict-input" value={form.plural} onChange={set('plural')} />
                </label>
              </div>
              {lockedName && (
                <p className="dict-entry-note text-muted dict-new-hint" role="note">
                  This instance finds “{baseSingular}” by its name, so renaming it would break what uses it. Its plural,
                  description and Item Property Tags can still be changed.
                </p>
              )}
              <label className="dict-field dict-new-desc">
                <span className="dict-field-label">Description</span>
                <textarea className="dict-input dict-new-textarea" rows={3} value={form.description} onChange={set('description')} />
              </label>

              <div className="dict-edit-props">
                <span className="dict-field-label">Item Property Tags</span>
                <p className="dict-entry-note text-muted dict-edit-props-help">What tags items filed under this concept should have.</p>
                {form.properties.length > 0 ? (
                  <ul className="dict-edit-prop-list" aria-label="Item Property Tags">
                    {form.properties.map((t, i) => (
                      <li key={`${i}-${t.join('\u0000')}`} className="dict-edit-prop">
                        <span className={`dict-edit-prop-req dict-edit-prop-req--${t[0]}`}>{t[0]}</span>
                        <span className="dict-edit-prop-value">{t[1]}</span>
                        {t.length > 2 && <span className="dict-strip-faint dict-edit-prop-extra">{t.slice(2).join(' · ')}</span>}
                        <button
                          type="button" className="dict-link-btn dict-edit-prop-remove" onClick={() => removeProperty(i)}
                          aria-label={`Remove ${t[0]} ${t[1]}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dict-entry-note text-muted">None yet.</p>
                )}
                <div className="dict-edit-prop-add">
                  <select className="dict-input dict-edit-prop-select" value={newReq} onChange={(e) => setNewReq(e.target.value)} aria-label="Requirement">
                    {PROPERTY_REQUIREMENTS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input
                    className="dict-input dict-edit-prop-input" value={newValue} placeholder="Tag name, e.g. url"
                    aria-label="New Item Property Tag" onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProperty(); } }}
                  />
                  <button type="button" className="dict-pill-btn dict-pill-btn--quiet" onClick={addProperty} disabled={!newValue.trim()}>
                    Add
                  </button>
                </div>
              </div>
              {form && check.error && <p className="dict-entry-note text-muted dict-new-hint" role="status">{check.error}.</p>}
            </fieldset>

            <figure className="dict-new-figure">
              <figcaption className="dict-field-label dict-new-preview-label">New version your Assistant publishes</figcaption>
              <pre className="dict-json dict-new-preview">{preview(locked ? undelivered.event : (draft || base))}</pre>
            </figure>

            {changed && (
              <p className="dict-notice" role="alert">
                This concept changed after this page loaded it, so nothing was saved.{' '}
                <button type="button" className="dict-link-btn" onClick={startOver}>Start again from the latest version</button>{' '}
                (your changes here will be replaced).
              </p>
            )}
            {taken && (
              <p className="dict-notice" role="alert">
                Your Assistant already has a concept named “{taken.name}”, and this instance finds concepts by name, so two
                would be ambiguous. Choose another name, or <Link to={dictionaryEntryPath(taken.coord)}>open that concept</Link>.
              </p>
            )}
            {error && <p className="error" role="alert">Couldn’t save the concept: {error}</p>}
            {undelivered && (
              <p className="dict-notice" role="status">
                {undelivered.message}{' '}
                <button type="button" className="dict-link-btn" onClick={retry} disabled={busy}>Try again</button>{' '}
                <Link to={entryPath}>Open the concept</Link>
              </p>
            )}

            <div className="dict-new-actions">
              <button type="submit" className="dict-add-btn" disabled={!canSave}>{busy ? 'Saving…' : 'Save changes'}</button>
              <Link to={entryPath} state={backState} className="dict-pill-btn dict-pill-btn--quiet dict-new-cancel">Cancel</Link>
            </div>
          </form>
        )}
      </div>
    </DictionaryShell>
  );
}
