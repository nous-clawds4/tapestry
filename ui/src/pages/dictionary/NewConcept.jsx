import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DictionaryShell from './DictionaryShell';
import DictIcon from '../dictionaries/DictIcon';
import { scan } from '../dictionaries/ConceptEntry';
import { DICTIONARY_PATH, dictionaryEntryPath, useDictionaryPerson } from '../dictionaries/conceptsDictionary';
import { publishToRelays } from '../../utils/nostrPublish';
import { CONCEPT_PUBLISH_RELAYS } from '../../utils/dispositionActions';
import { classifyBroadcast, outcomeMessage } from '@tapestry/broadcast-outcome';
import { conceptHeaderDraft, draftPreview } from './newConceptDraft';

/**
 * /dictionary/new — Create New Concept, as the design's screen: singular and plural names, a
 * description, and a live preview of the header that is published. A concept here is a DList header
 * (kind 39998), shared as it is created (its b-tag points to itself), so it joins the signer's
 * Dictionary and others can adopt it. No Private option in this version (owner, 2026-10-02).
 *
 * Who signs: the owner's header is signed by their Assistant on this instance (`signAs: 'assistant'`,
 * which the server allows the owner only); any other signed-in reader signs with their own key in
 * their nostr extension (NIP-07), as the New DList page lets them. Both publish through
 * POST /api/strfry/publish, then broadcast to the community relay (CONCEPT_PUBLISH_RELAYS), and the
 * page says what the broadcast did (broadcastOutcome). A header the signer already has at that
 * d-tag is never replaced: the page stops and links to it.
 */
export default function DictionaryNewConceptPage() {
  const navigate = useNavigate();
  const person = useDictionaryPerson();
  const [singular, setSingular] = useState('');
  const [plural, setPlural] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [existing, setExisting] = useState(null); // the coord of a header the signer already has here
  const [undelivered, setUndelivered] = useState(null); // { event, message } when the broadcast didn't land

  const byAssistant = Boolean(person.isOwner && person.assistant);
  const signer = byAssistant ? person.assistant : person.account;
  const draft = conceptHeaderDraft({ singular, plural, description, pubkey: signer });
  const canCreate = person.signedIn && Boolean(signer) && draft.ready && !busy;

  const finish = async (signed) => {
    let result = null;
    try { result = await publishToRelays(signed, CONCEPT_PUBLISH_RELAYS); } catch { result = null; }
    const outcome = classifyBroadcast(result);
    const message = outcomeMessage({ outcome, verb: 'submit' });
    const coord = `39998:${signed.pubkey}:${draft.d}`;
    if (outcome === 'not-delivered') { setUndelivered({ event: signed, message, coord }); return; }
    navigate(dictionaryEntryPath(coord), { state: { notice: message } });
  };

  const create = async () => {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    setExisting(null);
    setUndelivered(null);
    try {
      let pubkey = signer;
      if (!byAssistant) {
        if (!window.nostr) throw new Error('No nostr extension (NIP-07) found to sign with.');
        pubkey = await window.nostr.getPublicKey();
        if (pubkey !== person.account) throw new Error('Your nostr extension holds a different key from the account you’re signed in with.');
      }
      const { event, coord } = conceptHeaderDraft({ singular, plural, description, pubkey });
      // Never replace a header the signer already has: a kind-39998 event at the same d-tag would.
      const found = await scan({ kinds: [39998], authors: [pubkey], '#d': [draft.d] });
      if (found.length > 0) { setExisting(coord); return; }
      const unsigned = { ...event, created_at: Math.floor(Date.now() / 1000) };
      const body = byAssistant
        ? { event: unsigned, signAs: 'assistant' }
        : { event: await window.nostr.signEvent({ ...unsigned, pubkey }), signAs: 'client' };
      const resp = await fetch('/api/strfry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || `HTTP ${resp.status}`);
      await finish(data.event || body.event);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!undelivered) return;
    setBusy(true);
    try { await finish(undelivered.event); } finally { setBusy(false); }
  };

  const signedOutNote = person.loading ? null
    : !person.signedIn ? 'Sign in to create a concept.'
      : !signer ? 'This instance didn’t say which key to sign with.'
        : null;

  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <Link to={DICTIONARY_PATH} className="dict-back"><DictIcon name="back" /> Dictionary</Link>
        <h1 className="dict-entry-title">Create New Concept</h1>
        <p className="dict-lede dict-new-lede">
          Define a new concept: its singular and plural names, and a description.{' '}
          {byAssistant
            ? 'Your Assistant publishes the header and shares it, so others can find it and adopt it.'
            : 'You publish the header, signed with your nostr extension, and share it, so others can find it and adopt it.'}
        </p>
        {signedOutNote && <p className="dict-notice">{signedOutNote}</p>}

        <form className="dict-card dict-new-card" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <fieldset disabled={!person.signedIn || busy} className="dict-new-fields">
            <div className="dict-new-names">
              <label className="dict-field">
                <span className="dict-field-label">Singular name</span>
                <input className="dict-input" value={singular} onChange={(e) => setSingular(e.target.value)} placeholder="e.g. Taco Truck in Nashville" />
              </label>
              <label className="dict-field">
                <span className="dict-field-label">Plural name</span>
                <input className="dict-input" value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="e.g. Taco Trucks in Nashville" />
              </label>
            </div>
            <label className="dict-field dict-new-desc">
              <span className="dict-field-label">Description</span>
              <textarea className="dict-input dict-new-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What belongs in this concept?" />
            </label>
          </fieldset>

          <div className="dict-field-label dict-new-preview-label">
            {byAssistant ? 'Header your Assistant publishes' : 'Header you publish'} (shared: its b-tag points to itself)
          </div>
          <pre className="dict-json dict-new-preview" aria-label="Header preview">{draftPreview(draft.event)}</pre>

          {existing && (
            <p className="dict-notice" role="alert">
              {byAssistant ? 'Your Assistant already has' : 'You already have'} a concept header at this name, so creating it would
              replace it. Choose another name, or <Link to={dictionaryEntryPath(existing)}>open the existing one</Link>.
            </p>
          )}
          {error && <p className="error" role="alert">Couldn’t create the concept: {error}</p>}
          {undelivered && (
            <p className="dict-notice" role="status">
              Created on this instance. {undelivered.message}{' '}
              <button type="button" className="dict-link-btn" onClick={retry} disabled={busy}>Try again</button>{' '}
              <Link to={dictionaryEntryPath(undelivered.coord)}>Open the concept</Link>
            </p>
          )}

          <div className="dict-new-actions">
            <button type="submit" className="dict-add-btn" disabled={!canCreate || Boolean(undelivered)}>
              {busy ? 'Creating…' : 'Create concept'}
            </button>
            <Link to={DICTIONARY_PATH} className="dict-pill-btn dict-pill-btn--quiet dict-new-cancel">Cancel</Link>
          </div>
        </form>
      </div>
    </DictionaryShell>
  );
}
