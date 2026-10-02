import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DictionaryShell from './DictionaryShell';
import DictIcon from '../dictionaries/DictIcon';
import useProfiles from '../../hooks/useProfiles';
import { npubOf, scan } from '../dictionaries/ConceptEntry';
import { DICTIONARY_PATH, DICTIONARY_WIRE_PARAM, dictionaryEntryPath, useDictionaryPerson } from '../dictionaries/conceptsDictionary';
import { publishToRelays } from '../../utils/nostrPublish';
import { CONCEPT_PUBLISH_RELAYS } from '../../utils/dispositionActions';
import { COMMUNITY_RELAYS } from '../../hooks/useCommunitySharedConcepts';
import { ASSISTANT_COPY } from '../assistant/actions';
import { classifyBroadcast, outcomeMessage } from '@tapestry/broadcast-outcome';
import { copiedHeaderTags } from '@tapestry/concept-header-copy';
import { MAX_D_BYTES, conceptHeaderDraft, draftPreview, fieldsFromHeader, wireProblem, wireTarget } from './newConceptDraft';

/** Creates the header with the signed-in person's own Assistant (src/api/adoption/newConcept.js). */
export const NEW_CONCEPT_API = '/api/dictionaries/concepts/new';

/**
 * The community relay, read strictly (`strict=1`): a relay that couldn't be read is an error, never an
 * empty answer, so the page can't mistake "unreachable" for "not there" (the lenient read answers
 * `{success: true, events: []}` for both).
 */
async function readCommunityStrict(filter) {
  const params = new URLSearchParams({ filter: JSON.stringify(filter), relays: COMMUNITY_RELAYS.join(','), strict: '1' });
  const resp = await fetch(`/api/relay/external?${params}`);
  const data = await resp.json();
  if (!data || data.success !== true) throw new Error((data && data.error) || `HTTP ${resp.status}`);
  return Array.isArray(data.events) ? data.events : [];
}

/**
 * The shared concept's header, for `?wire=`: the newest of this instance's relay and the community relay,
 * so the form can start from its names and description and the copy from its tags.
 * { event, done, unreadable, reload }: `unreadable` when neither relay has it and the community relay
 * couldn't be read, so whether it has a header there isn't known.
 */
function useSharedHeader(target) {
  const [state, setState] = useState({ event: null, done: !target, unreadable: false });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!target) { setState({ event: null, done: true, unreadable: false }); return undefined; }
    let cancelled = false;
    setState({ event: null, done: false, unreadable: false });
    const [, pubkey, ...rest] = target.split(':');
    const d = rest.join(':');
    const filter = { kinds: [39998], authors: [pubkey], '#d': [d] };
    const own = (ev) => ev && ev.kind === 39998 && ev.pubkey === pubkey && (ev.tags || []).find((t) => t[0] === 'd')?.[1] === d;
    (async () => {
      const reads = await Promise.allSettled([scan(filter), readCommunityStrict(filter)]);
      const events = reads.flatMap((r) => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [])).filter(own);
      const newest = events.reduce((a, b) => (!a || (b.created_at || 0) > (a.created_at || 0) ? b : a), null);
      if (!cancelled) setState({ event: newest, done: true, unreadable: !newest && reads[1].status === 'rejected' });
    })();
    return () => { cancelled = true; };
  }, [target, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}

/**
 * /dictionary/new — Create New Concept, as the design's screen: singular and plural names, a
 * description, and a live preview of the header that is published. A concept here is a DList header
 * (kind 39998). Created plainly it is shared as it is created (its b-tag points to itself), so it joins
 * the person's Dictionary and others can adopt it. Opened from the finder for a shared concept
 * (`?wire=<its address>`), the form starts from that concept's names and description, and the header's
 * b-tag points to it instead: wired to it, it joins the person's Dictionary as that concept, with no
 * twin to pick. No Private option in this version (owner, 2026-10-02).
 *
 * Who signs: the signed-in person's own Assistant on this instance, whoever they are — owner, admin or
 * customer (owner, 2026-10-02). The server signs with the caller's own Assistant key and no other
 * (POST /api/dictionaries/concepts/new); someone with no Assistant here is told so, with the way to
 * set one up, and can't create. The page then broadcasts the header to the community relay
 * (CONCEPT_PUBLISH_RELAYS) and says what the broadcast did (broadcastOutcome). If this instance's relay
 * already holds a header by the Assistant at that d-tag, the server refuses and the page links to it
 * rather than replace it (a header only the community relay holds isn't checked). Once a header is
 * published the form is locked: Try again re-broadcasts that event, and the page opens that event's
 * concept, whatever the fields say.
 */
export default function DictionaryNewConceptPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wireParam = params.get(DICTIONARY_WIRE_PARAM);
  const target = wireTarget(wireParam);
  const badWire = wireParam !== null ? wireProblem(wireParam) : null;
  const shared = useSharedHeader(target);
  const sharedAuthor = target ? target.split(':')[1] : null;
  const profiles = useProfiles(sharedAuthor ? [sharedAuthor] : []);
  const person = useDictionaryPerson();
  const [singular, setSingular] = useState('');
  const [plural, setPlural] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [existing, setExisting] = useState(null); // the coord of a header the Assistant already has here
  const [undelivered, setUndelivered] = useState(null); // { event, message, coord } when the broadcast didn't land

  // Start from the shared concept's names and description, unless the person has already typed.
  useEffect(() => {
    if (!shared.event || touched) return;
    const start = fieldsFromHeader(shared.event);
    setSingular(start.singular);
    setPlural(start.plural);
    setDescription(start.description);
  }, [shared.event]); // the shared header arriving, not each keystroke
  const edit = (set) => (e) => { setTouched(true); set(e.target.value); };

  const signer = person.signedIn ? person.assistant : null;
  const plain = conceptHeaderDraft({ singular, plural, description, pubkey: signer, target });
  // Wired to a shared concept whose header was read: a copy of that header, by the rule the server signs with.
  const source = target && shared.event ? shared.event : null;
  const draft = source
    ? {
      ...plain,
      event: {
        ...plain.event,
        tags: copiedHeaderTags({ source, d: plain.d, singular: singular.trim(), plural: plural.trim(), description: description.trim(), target }),
      },
    }
    : plain;
  const locked = Boolean(undelivered); // the header exists: what's left is its broadcast
  // Wired to its own address would only be the plain, self-shared concept under another name.
  const selfTarget = Boolean(target && draft.coord === target);
  // Wired: never before the shared header's read has settled, and never without its tags when the community
  // relay couldn't be read (the copy would silently lack them: the owner's report of 2026-10-02).
  const sharedSettled = !target || (shared.done && !shared.unreadable);
  const canCreate = person.signedIn && Boolean(signer) && draft.ready && !selfTarget && sharedSettled && !busy && !locked;
  // A name with no Latin letter or digit has no slug, so it can't name the header's d-tag yet.
  const noSlug = Boolean(singular.trim()) && !draft.d;

  const sharedName = shared.event ? fieldsFromHeader(shared.event).singular : null;
  const p = sharedAuthor ? profiles?.[sharedAuthor] : null;
  const sharedBy = sharedAuthor
    ? (p && typeof p === 'object' && (p.display_name || p.name)) || `${npubOf(sharedAuthor).slice(0, 12)}…`
    : null;

  // The concept the published event IS: its own signer and d-tag, never the form's current values.
  const coordOf = (signed) => `39998:${signed.pubkey}:${(signed.tags || []).find((t) => t[0] === 'd')?.[1] || ''}`;

  const finish = async (signed) => {
    let result = null;
    try { result = await publishToRelays(signed, CONCEPT_PUBLISH_RELAYS); } catch { result = null; }
    const outcome = classifyBroadcast(result);
    const message = outcomeMessage({ outcome, verb: target ? 'wire' : 'submit' });
    const coord = coordOf(signed);
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
      const resp = await fetch(NEW_CONCEPT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ singular, plural, description, ...(target ? { target } : {}), ...(source ? { copyFrom: source.id } : {}) }),
      });
      let data = {};
      try { data = await resp.json(); } catch { data = {}; }
      if (resp.status === 409 && data.code === 'exists') { setExisting(data.coord || draft.coord); return; }
      if (resp.status === 409 && data.code === 'source-missing') {
        // The version the preview showed has been replaced: read the shared header again, so the preview and
        // the next request are of the current one.
        shared.reload();
        throw new Error('The shared concept’s header changed after this page read it, so the page is reading it again: check the preview, then create the concept.');
      }
      if (!resp.ok || !data.success) throw new Error(data.error || `HTTP ${resp.status}`);
      const signed = data.event;
      // Broadcast only what was signed as the Assistant this page names.
      if (!signed || signed.pubkey !== signer) {
        throw new Error('The server signed with a different key from your Assistant’s. The header is stored on this instance, but it was not shared onward.');
      }
      await finish(signed);
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

  const signInNote = person.loading ? null : !person.signedIn ? 'Sign in to create a concept.' : null;
  const noAssistant = !person.loading && person.signedIn && !person.assistant;

  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <Link to={DICTIONARY_PATH} className="dict-back"><DictIcon name="back" /> Dictionary</Link>
        <h1 className="dict-entry-title">Create New Concept</h1>
        <p className="dict-lede dict-new-lede">
          {target
            ? `Your Assistant publishes a concept of your own, wired to the shared concept below: its b-tag points to it, so it joins your Dictionary as that concept. Its names and description start as the shared concept’s; change them if you like.${source ? ' Its other tags are copied from the shared concept’s header, except json, concept-graph, the z tags that file it under other concepts, and the ones about that event rather than the concept: client, alt, and the expiration, protected and proof-of-work tags.' : ''}`
            : 'Define a new concept: its singular and plural names, and a description. Your Assistant publishes the header, marked as shared, so others can find it and adopt it.'}
        </p>
        {signInNote && <p className="dict-notice">{signInNote}</p>}
        {noAssistant && (
          <p className="dict-notice" role="status">
            {ASSISTANT_COPY.noAssistantLine}{' '}
            <Link to="/setup">{ASSISTANT_COPY.noAssistantLink}</Link>
          </p>
        )}
        {badWire === 'not-an-address' && (
          <p className="dict-notice" role="status">
            This link doesn’t name a shared concept (a list header’s address), so this creates a concept of its own.
          </p>
        )}
        {badWire === 'too-long' && (
          <p className="dict-notice" role="status">
            This shared concept’s address is longer than this instance’s relay can look up (255 bytes), so a concept
            wired to it couldn’t be read back into your Dictionary. This creates a concept of its own instead.
          </p>
        )}

        {target && (
          <div className="dict-card dict-new-wired" aria-label="Wired to">
            <span className="dict-field-label">Wired to</span>
            <span className="dict-new-wired-name">
              {sharedName || (shared.done ? target : 'Reading the shared concept…')}
              {sharedBy && <span className="dict-strip-faint"> · shared by {sharedBy}</span>}
            </span>
            {shared.done && !shared.event && !shared.unreadable && (
              <span className="dict-entry-note text-muted">
                Its header wasn’t found on this instance’s relay or the community relay, so fill in the names yourself.
              </span>
            )}
            {shared.unreadable && (
              <span className="dict-entry-note" role="alert">
                Couldn’t reach the community relay to read its header, so its tags can’t be copied now, and creating the
                concept would leave them out.{' '}
                <button type="button" className="dict-link-btn" onClick={shared.reload}>Try again</button>
              </span>
            )}
          </div>
        )}

        <form className="dict-card dict-new-card" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <fieldset disabled={!signer || busy || locked} className="dict-new-fields">
            <div className="dict-new-names">
              <label className="dict-field">
                <span className="dict-field-label">Singular name</span>
                <input className="dict-input" value={singular} onChange={edit(setSingular)} placeholder="e.g. Taco Truck in Nashville" />
              </label>
              <label className="dict-field">
                <span className="dict-field-label">Plural name</span>
                <input className="dict-input" value={plural} onChange={edit(setPlural)} placeholder="e.g. Taco Trucks in Nashville" />
              </label>
            </div>
            <label className="dict-field dict-new-desc">
              <span className="dict-field-label">Description</span>
              <textarea className="dict-input dict-new-textarea" rows={3} value={description} onChange={edit(setDescription)} placeholder="What belongs in this concept?" />
            </label>
            {noSlug && (
              <p className="dict-entry-note text-muted dict-new-hint" role="status">
                The singular name needs at least one Latin letter or digit, which make its header’s d-tag.
              </p>
            )}
            {draft.tooLong && (
              <p className="dict-entry-note text-muted dict-new-hint" role="status">
                The singular name is too long: its d-tag would be {draft.d.length} characters, and this instance’s relay can
                look up at most {MAX_D_BYTES}.
              </p>
            )}
            {selfTarget && (
              <p className="dict-entry-note text-muted dict-new-hint" role="status">
                That is already your Assistant’s concept, so it’s in your Dictionary as it is.
              </p>
            )}
          </fieldset>

          <figure className="dict-new-figure">
            <figcaption className="dict-field-label dict-new-preview-label">
              {target
                ? 'Header your Assistant publishes (wired: its b-tag points to the shared concept)'
                : 'Header your Assistant publishes (shared: its b-tag points to itself)'}
            </figcaption>
            <pre className="dict-json dict-new-preview">{draftPreview(locked ? undelivered.event : draft.event)}</pre>
          </figure>

          {existing && (
            <p className="dict-notice" role="alert">
              This instance’s relay already holds your Assistant’s concept header at this name, so creating it would
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
