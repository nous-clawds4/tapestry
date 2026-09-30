import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { usePov } from '../../context/PovContext';
import { classifyBValue } from '../../utils/bDisposition';
import DictIcon from './DictIcon';
import {
  CONCEPTS_DICTIONARY_PATH, coordParts, displayName, itemCountText, metricLabel, overrideBadge, povLine,
  useConceptDictionary, useDictionaryPerson,
} from './conceptsDictionary';

/**
 * A Concepts dictionary entry (handoff SPEC § 2.6): the names, description,
 * item count, some items, the header coordinate and its b target. Veto /
 * Restore lives here, not in the list's rows — stubbed until Pins land
 * (SPEC § 3): the owner's add-to-dictionary pinning is version 2.
 *
 * The row arrives in router state when the page is opened from the list; a
 * direct visit reads the person's dictionary (/api/dictionaries/concepts) for
 * the active point of view. The header event and the sample items are plain
 * reads of local strfry.
 */

const SAMPLE_SIZE = 8;

async function scan(filter) {
  const resp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify(filter))}`);
  const json = await resp.json();
  if (!resp.ok || json.success === false) throw new Error(json.error || `HTTP ${resp.status}`);
  return json.events || json.data || [];
}

const tagValue = (ev, name, idx = 1) => {
  const t = (ev?.tags || []).find((x) => x[0] === name);
  return t && typeof t[idx] === 'string' && t[idx].trim() !== '' ? t[idx] : null;
};

/** The newest event at the coordinate (the HeaderEvent page's read). */
function useHeaderEvent(coord) {
  const [state, setState] = useState({ event: null, error: null, done: false });
  useEffect(() => {
    let cancelled = false;
    const { kind, pubkey, d } = coordParts(coord);
    (async () => {
      try {
        if (!/^\d+$/.test(kind || '') || !/^[0-9a-f]{64}$/.test(pubkey || '') || !d) {
          throw new Error(`Not a concept coordinate: ${coord || '(empty)'}`);
        }
        const events = await scan({ kinds: [Number(kind)], authors: [pubkey], '#d': [d] });
        const newest = events.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
        if (!cancelled) setState({ event: newest, error: newest ? null : 'No event found at this coordinate.', done: true });
      } catch (err) {
        if (!cancelled) setState({ event: null, error: err.message, done: true });
      }
    })();
    return () => { cancelled = true; };
  }, [coord]);
  return state;
}

/** A few items filed under the header (z → coord), named for display. */
function useSampleItems(coord) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const events = await scan({ '#z': [coord], limit: SAMPLE_SIZE * 3 });
        const names = [];
        for (const ev of events.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))) {
          const n = tagValue(ev, 'names') || tagValue(ev, 'name') || tagValue(ev, 'd') || `${ev.id.slice(0, 8)}…`;
          if (!names.includes(n)) names.push(n);
          if (names.length === SAMPLE_SIZE) break;
        }
        if (!cancelled) setItems(names);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [coord]);
  return items;
}

/** One b value, said plainly. */
function BTarget({ value, type, coord }) {
  const form = classifyBValue(value);
  if (form === 'sentinel') return <span>None: kept private (<code>b-tag-deferred</code>)</span>;
  if (value === coord) return <span>Itself: its author shared it with the community</span>;
  if (form === 'a-tag') {
    return (
      <span>
        <Link to={`/tapestry/shared-concepts/header/${encodeURIComponent(value)}`} className="dict-mono">{value}</Link>
        {type ? <span className="text-muted"> ({type})</span> : null}
      </span>
    );
  }
  return <code className="dict-mono">{value}</code>;
}

/** The Tapestry control panel's entry page: the app's breadcrumbs over the shared entry. */
export default function DictionaryConceptEntry() {
  return (
    <div className="page dict-page">
      <Breadcrumbs />
      <ConceptEntryBody />
    </div>
  );
}

/**
 * The entry itself, from the back link down. Both Dictionary entry pages render it: this one and
 * the Brainstorm-styled /dictionary/:coord (pages/dictionary/Entry.jsx), which passes its own list
 * as the back link.
 */
export function ConceptEntryBody({ listHref = CONCEPTS_DICTIONARY_PATH, listLabel = 'Concepts' }) {
  const { coord: rawCoord } = useParams();
  const coord = decodeURIComponent(rawCoord || '');
  const location = useLocation();
  const passed = location.state?.entry?.coord === coord ? location.state : null;
  const { povParams } = usePov();
  const person = useDictionaryPerson();
  const { data, error } = useConceptDictionary(person, povParams, { enabled: !passed });
  const header = useHeaderEvent(coord);
  const samples = useSampleItems(coord);

  const entry = passed ? passed.entry : (data?.entries || []).find((e) => e.coord === coord) || null;
  const metric = passed ? passed.metric : data?.metric;
  const pov = passed ? passed.pov : data?.pov;
  const settled = Boolean(passed) || data !== null;

  const { pubkey: author } = coordParts(coord);
  const profiles = useProfiles(author ? [author] : []);

  const ev = header.event;
  const singular = entry ? displayName(entry) : (tagValue(ev, 'names') || tagValue(ev, 'name') || coordParts(coord).d);
  const plural = entry?.plural || tagValue(ev, 'names', 2);
  const description = entry?.description || tagValue(ev, 'description');
  const bTags = (ev?.tags || []).filter((t) => t[0] === 'b' && typeof t[1] === 'string');
  const badge = overrideBadge(entry);
  const whose = person.signedIn ? 'your' : 'the owner’s';

  return (
    <>
      <Link to={listHref} className="dict-back"><DictIcon name="back" /> {listLabel}</Link>

      <div className="dict-entry-badges">
        {entry?.isFirmware && <span className="dict-pill dict-pill--firmware">Firmware</span>}
        {entry?.selfDeclared && (
          <span className="dict-marker dict-marker--shared">
            <DictIcon name="share" size={12} /> {person.signedIn ? 'Shared by you' : 'Shared by the owner'}
          </span>
        )}
        {badge && <span className={badge.className}>{badge.label}</span>}
      </div>
      <h1 className="dict-entry-title">{singular}</h1>
      <p className="dict-entry-sub text-muted">
        {plural ? `Plural: ${plural}` : 'No plural name'}
        {entry ? ` · ${itemCountText(entry.itemCount)}` : ''}
      </p>
      {description && <p className="dict-lede">{description}</p>}

      <div className="dict-entry-actions">
        <button
          type="button" className="dict-pill-btn dict-pill-btn--quiet" disabled aria-describedby="dict-veto-note"
          title="Vetoing an entry arrives with Pins (version 2)"
        >
          {entry?.override === 'vetoed' ? 'Restore' : 'Veto'}
        </button>
        <span id="dict-veto-note" className="dict-entry-note text-muted">
          Vetoing and restoring entries by hand arrive with Pins, in a later version.
        </span>
      </div>

      {settled && !entry && (
        <p className="dict-notice">
          {error
            ? `Could not read ${whose} Dictionary: ${error}`
            : `This concept is not in ${whose} Dictionary, which lists only ${whose} own concepts that carry a b-tag.`}
        </p>
      )}

      {entry && (
        <div className="dict-card dict-entry-card">
          <div className="dict-field-label">Usage</div>
          {entry.sharedCoord ? (
            <>
              <p className="dict-entry-usage">
                <span className="dict-row-gum">{entry.gum}</span> {metricLabel(metric)}
                <span className="text-muted"> · all usage: {entry.totalAuthorCount} {entry.totalAuthorCount === 1 ? 'author' : 'authors'},
                  {' '}{entry.totalEventCount} {entry.totalEventCount === 1 ? 'filing' : 'filings'}</span>
              </p>
              <p className="dict-pov text-muted">
                {entry.sharedCoord === coord
                  ? 'Scored as itself: it is the shared concept.'
                  : <>Scored for the shared concept it points to: <span className="dict-mono">{entry.sharedCoord}</span></>}
              </p>
            </>
          ) : (
            <p className="text-muted">No score: its b-tag points at an event id, not a concept that items are filed under.</p>
          )}
          {pov && <p className="dict-pov text-muted">{povLine(pov)}</p>}
        </div>
      )}

      <div className="dict-card dict-entry-card">
        <div className="dict-field-label">Some items</div>
        {samples === null && <p className="text-muted">Reading items…</p>}
        {samples && samples.length === 0 && <p className="text-muted">No items found on this instance.</p>}
        {samples && samples.length > 0 && (
          <ul className="dict-chips">
            {samples.map((n) => <li key={n} className="dict-chip">{n}</li>)}
          </ul>
        )}
      </div>

      <div className="dict-card dict-entry-card">
        <div className="dict-field-label">Concept header</div>
        <p className="dict-mono dict-entry-coord">{coord}</p>
        <div className="dict-entry-author">
          <span className="dict-field-label">Author</span>
          {author && author === person.assistant
            ? <span>{person.signedIn ? 'Your Assistant' : 'The owner’s Assistant'}</span>
            : <AuthorCell pubkey={author} profiles={profiles} size={20} />}
        </div>
        <div className="dict-field-label">b-tag target</div>
        {!header.done && <p className="text-muted">Reading the header…</p>}
        {header.done && header.error && <p className="text-muted">{header.error}</p>}
        {ev && bTags.length === 0 && <p className="text-muted">None: this header carries no b-tag.</p>}
        {bTags.length > 0 && (
          <ul className="dict-btargets">
            {bTags.map((t) => <li key={`${t[1]}|${t[2] || ''}`}><BTarget value={t[1]} type={t[2]} coord={coord} /></li>)}
          </ul>
        )}
        {ev && <pre className="dict-json">{JSON.stringify(ev, null, 2)}</pre>}
        <p className="dict-entry-links">
          <Link to={`/tapestry/concepts/${encodeURIComponent(coord)}`}>Open the concept →</Link>
          <Link to={`/tapestry/shared-concepts/header/${encodeURIComponent(coord)}`}>Raw header event →</Link>
        </p>
      </div>
    </>
  );
}
