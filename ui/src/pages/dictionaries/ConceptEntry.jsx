import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';
import useTreasureMap from '../../hooks/useTreasureMap';
import { usePov } from '../../context/PovContext';
import { classifyBValue } from '../../utils/bDisposition';
import { conceptCurator } from '../../utils/treasureMap';
import DictIcon from './DictIcon';
import {
  CONCEPTS_DICTIONARY_PATH, coordParts, displayName, itemsPovLine, overrideBadge,
  useConceptDictionary, useConceptItems, useDictionaryPerson,
} from './conceptsDictionary';

/**
 * A Concepts dictionary entry, laid out as the design's Dictionary entry screen (the owner's Claude
 * Design artifact, 2026-10-01): the names and description; the Items filed under the concept by
 * people the active point of view trusts, with search, sort and pages; who curates it; the FAQ; who
 * authored the shared concept and how many trusted members file under it; and the two headers.
 *
 * What has no backend yet is shown and disabled, with a note: the Trusted Curation Method, the
 * Curation switches, Veto / Restore (Pins, SPEC § 3) and the item pages.
 *
 * The row arrives in router state when the page is opened from the list; a direct visit reads the
 * person's dictionary (/api/dictionaries/concepts) for the active point of view. The Items come
 * from /api/dictionaries/concepts/items; the header events are plain reads of local strfry.
 */

const PAGE_SIZE = 10;

const SORTS = [
  { value: 'none', label: 'Default order' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
];

// The design's Curation switches. None has a backend yet, so each is shown off and disabled.
const CURATION_OPTIONS = [
  'Publish Trusted List of items',
  'Publish Trusted Lists of Tagged Items',
  'Organize items into subsets',
  'Update the expected format for list items',
];

const ITEMS_FAQ_Q = 'Who decides which items belong on this list?';
/** The answer, in the reader's voice: "your" when signed in, "the owner's" when it is the owner's Dictionary. */
const itemsFaqAnswer = (signedIn) => (signedIn
  ? 'Your trusted, extended community. Anyone can file an item under this concept, but this list only shows items filed by people your community trusts: those ranked above your verified cutoff, from your point of view. Items you or your Assistant filed always show. The list is read fresh each time you open this page. Coming in a later version: the more trusted people file the same item, the more firmly it belongs, and you will be able to add or exclude items yourself, with your choice always winning.'
  : 'The owner’s trusted, extended community. Anyone can file an item under this concept, but this list only shows items filed by people the community trusts: those ranked above the verified cutoff, from the point of view in use. Items the owner or the owner’s Assistant filed always show. The list is read fresh each time this page opens. Coming in a later version: the more trusted people file the same item, the more firmly it belongs, and the Dictionary’s owner will be able to add or exclude items by hand, with their choice always winning.');

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

/** The newest event at the coordinate (the HeaderEvent page's read). A null coord reads nothing. */
function useHeaderEvent(coord) {
  const [state, setState] = useState({ event: null, error: null, done: false });
  useEffect(() => {
    if (!coord) { setState({ event: null, error: null, done: true }); return undefined; }
    let cancelled = false;
    setState({ event: null, error: null, done: false });
    const { kind, pubkey, d } = coordParts(coord);
    (async () => {
      try {
        if (!/^\d+$/.test(kind || '') || !/^[0-9a-f]{64}$/.test(pubkey || '') || !d) {
          throw new Error(`Not a concept coordinate: ${coord}`);
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

/** A card whose body opens under a small uppercase heading (the design's header panels). */
function Disclosure({ id, label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dict-card dict-entry-card dict-disclosure">
      <button
        type="button" className="dict-disclosure-btn" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        {label} <span className={`dict-chev${open ? ' is-open' : ''}`}><DictIcon name="chevron" /></span>
      </button>
      {open && <div id={id} className="dict-disclosure-body">{children}</div>}
    </div>
  );
}

/** An event as JSON, one tag per line (the design's header panels). */
const eventJson = (ev) => {
  const tags = Array.isArray(ev.tags) ? ev.tags : [];
  const list = tags.length ? `[\n${tags.map((t) => `    ${JSON.stringify(t)}`).join(',\n')}\n  ]` : '[]';
  // A function replacer, so a `$` in a tag is never read as a replacement pattern.
  return JSON.stringify({ ...ev, tags: '\u0000tags' }, null, 2).replace('"\\u0000tags"', () => list);
};

const npubOf = (pubkey) => {
  try { return nip19.npubEncode(pubkey); } catch { return pubkey; }
};
const initialOf = (name) => (String(name || '?').replace(/^the owner’s /i, '').trim()[0] || '?').toUpperCase();

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
 * as the back link and its own profile pages for the Filed by links.
 */
export function ConceptEntryBody({ listHref = CONCEPTS_DICTIONARY_PATH, listLabel = 'Concepts', profileBase = '/tapestry/users' }) {
  const { coord: rawCoord } = useParams();
  const coord = decodeURIComponent(rawCoord || '');
  const location = useLocation();
  const passed = location.state?.entry?.coord === coord ? location.state : null;
  const { povParams } = usePov();
  const person = useDictionaryPerson();
  const { data, error } = useConceptDictionary(person, povParams, { enabled: !passed });

  const entry = passed ? passed.entry : (data?.entries || []).find((e) => e.coord === coord) || null;
  const metric = passed ? passed.metric : data?.metric;
  // Until the row is known, nothing that depends on it is said (or asked for).
  const settled = Boolean(passed) || data !== null;
  const sharedCoord = entry?.sharedCoord || null;
  const sharedIsSelf = sharedCoord === coord;

  const header = useHeaderEvent(coord);
  const shared = useHeaderEvent(sharedCoord && !sharedIsSelf ? sharedCoord : null);
  const sharedEvent = sharedIsSelf ? header.event : shared.event;
  const items = useConceptItems({ coord, shared: sharedCoord, person, povParams, enabled: settled });
  // Strict: a Map no relay could be asked for is unreadable, never "none" (my-assistants ADR 0003 Amendment 1).
  const map = useTreasureMap(person.loading ? null : person.account, { strict: true });

  const { pubkey: author, d } = coordParts(coord);
  const sharedAuthor = sharedCoord ? coordParts(sharedCoord).pubkey : null;
  const mapSettled = !person.loading && map.status !== 'loading';
  const mapError = map.status === 'error';
  const curator = mapSettled && !mapError ? conceptCurator(map.event?.tags, coord, person.assistant) : null;

  // Items: keyword, sort and page, all in the page (the server returns the whole trusted list).
  const [toolsOpen, setToolsOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('none');
  const [pageNo, setPageNo] = useState(0);
  const [curOpen, setCurOpen] = useState(false);
  const [faqShown, setFaqShown] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);

  const all = useMemo(() => (items.data?.items || []).map((it, i) => ({ ...it, n: i + 1 })), [items.data]);
  const filers = useMemo(() => [...new Set(all.map((it) => it.author))], [all]);

  const profiles = useProfiles([...new Set([author, sharedAuthor, curator?.pubkey, ...filers].filter(Boolean))]);
  const whose = person.signedIn ? 'your' : 'the owner’s';
  const Whose = person.signedIn ? 'Your' : 'The owner’s';
  const nameOf = (pubkey) => {
    if (!pubkey) return '';
    if (pubkey === person.assistant) return `${Whose} Assistant`;
    if (pubkey === person.account) return person.signedIn ? 'You' : 'The owner';
    const p = profiles?.[pubkey];
    const name = p && typeof p === 'object' ? (p.display_name || p.name) : null;
    return name || `${npubOf(pubkey).slice(0, 12)}…`;
  };
  const nip05Of = (pubkey) => {
    const p = profiles?.[pubkey];
    return p && typeof p === 'object' && typeof p.nip05 === 'string' && p.nip05 ? p.nip05 : null;
  };

  // The keyword matches the item's name and who filed it, as the design's search does.
  const needle = q.trim().toLowerCase();
  let shown = needle ? all.filter((it) => `${it.name} ${nameOf(it.author)}`.toLowerCase().includes(needle)) : all;
  if (sort !== 'none') {
    shown = [...shown].sort((a, b) => (sort === 'az' ? 1 : -1) * a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pg = Math.min(pageNo, pages - 1);
  const from = pg * PAGE_SIZE;
  const visible = shown.slice(from, from + PAGE_SIZE);
  const setAside = items.data ? items.data.totalCount - items.data.keptCount : 0;

  const ev = header.event;
  const singular = entry ? displayName(entry) : (tagValue(ev, 'names') || tagValue(ev, 'name') || d);
  const plural = entry?.plural || tagValue(ev, 'names', 2);
  const description = entry?.description || tagValue(ev, 'description');
  const bTags = (ev?.tags || []).filter((t) => t[0] === 'b' && typeof t[1] === 'string');
  const badge = overrideBadge(entry);
  const members = entry?.gum || 0;

  const curatorWhy = !curator ? null
    : curator.why === 'assigned' ? `Assigned to this Concept on ${whose} Treasure Map`
      : curator.why === 'catch-all' ? `${Whose} Treasure Map’s catch-all Assistant: no Assistant is assigned to this Concept specifically`
        : map.status === 'found' ? `${Whose} local Assistant: ${whose} Treasure Map has no Assistant for this`
          : `${Whose} local Assistant: no Treasure Map was found for ${person.signedIn ? 'you' : 'the owner'}`;
  const curatorSummary = curator ? nameOf(curator.pubkey)
    : mapError ? 'Could not read the Treasure Map' : mapSettled ? 'No Assistant' : 'Reading…';

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
      <p className="dict-entry-sub text-muted">{plural ? `Plural: ${plural}` : 'No plural name'}</p>
      {description && <p className="dict-lede">{description}</p>}

      {settled && !entry && (
        <p className="dict-notice">
          {error
            ? `Could not read ${whose} Dictionary: ${error}`
            : `This concept is not in ${whose} Dictionary, which lists only ${whose} own concepts that carry a b-tag.`}
        </p>
      )}

      {/* Items — the trusted list, with search, sort and pages. */}
      <section className="dict-card dict-items" aria-label="Items">
        <div className="dict-items-head">
          <div className="dict-items-title">
            <span className="dict-items-name">Items</span>
            <span className="dict-items-count">
              {items.data ? `${all.length.toLocaleString()} ${all.length === 1 ? 'item' : 'items'}` : items.error ? '' : 'Reading…'}
            </span>
          </div>
          <button
            type="button" className="dict-link-btn dict-items-tools-btn" aria-expanded={toolsOpen} aria-controls={toolsOpen ? 'dict-items-tools' : undefined}
            onClick={() => setToolsOpen(!toolsOpen)}
          >
            <DictIcon name="search" /> Search &amp; sort <span className={`dict-chev${toolsOpen ? ' is-open' : ''}`}><DictIcon name="chevron" /></span>
          </button>
        </div>
        {toolsOpen && (
          <div id="dict-items-tools" className="dict-items-tools">
            <label className="dict-field dict-field--grow">
              <span className="dict-field-label">Keyword</span>
              <input
                type="text" className="dict-input" value={q} placeholder="Search items"
                onChange={(e) => { setQ(e.target.value); setPageNo(0); }}
              />
            </label>
            <label className="dict-field dict-items-sort">
              <span className="dict-field-label">Sort</span>
              <select className="dict-input" value={sort} onChange={(e) => { setSort(e.target.value); setPageNo(0); }}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <div className="dict-items-method">
              <div className="dict-items-method-text">
                <span className="dict-field-label">Trusted Curation Method</span>
                <span className="dict-items-method-name">Default</span>
                <span className="dict-entry-note text-muted">Custom methods arrive in a later version.</span>
              </div>
              <button type="button" className="dict-pill-btn dict-pill-btn--quiet" disabled title="Custom curation methods arrive in a later version">
                Customize
              </button>
            </div>
          </div>
        )}
        <div role="table" aria-label="Items">
          <div className="dict-items-row dict-items-row--head" role="row">
            <span role="columnheader">#</span><span role="columnheader">Item</span><span role="columnheader">Filed by</span>
          </div>
          {items.data && visible.map((it) => (
            <div key={it.address || it.id} className="dict-items-row" role="row">
              <span className="dict-items-n" role="cell">{it.n}</span>
              <span className="dict-items-item" role="cell">{it.name}</span>
              <span role="cell" className="dict-items-by-cell">
                <Link to={`${profileBase}/${it.author}`} title={npubOf(it.author)} className="dict-items-by">{nameOf(it.author)}</Link>
              </span>
            </div>
          ))}
        </div>
        {items.error && <p className="dict-items-msg">Could not read the items: {items.error}</p>}
        {items.data && shown.length === 0 && (
          <p className="dict-items-msg">
            {q.trim() ? `No items match “${q.trim()}”.` : 'No items filed by people your community trusts yet.'}
          </p>
        )}
        <div className="dict-items-foot">
          <span className="dict-items-range">
            {!items.data ? '' : shown.length ? `${from + 1}–${from + visible.length} of ${shown.length.toLocaleString()}` : '0 items'}
          </span>
          <div className="dict-items-pager">
            <button type="button" className="dict-pill-btn dict-pill-btn--quiet" disabled={pg === 0} onClick={() => setPageNo(pg - 1)}>Previous</button>
            <button type="button" className="dict-pill-btn dict-pill-btn--quiet" disabled={pg >= pages - 1} onClick={() => setPageNo(pg + 1)}>Next</button>
          </div>
        </div>
      </section>
      {items.data && (
        <p className="dict-pov text-muted">
          {itemsPovLine(items.data.pov)}
          {items.data.truncated
            ? ` Showing the first ${all.length.toLocaleString()} of ${items.data.keptCount.toLocaleString()} items.`
            : ''}
          {setAside > 0
            ? ` ${setAside.toLocaleString()} more filed by people below the verified cutoff ${setAside === 1 ? 'is' : 'are'} not shown.`
            : ''}
          {' '}Item pages arrive in a later version.
        </p>
      )}

      {/* Curation — who curates this concept, and the switches still to come. */}
      <div className="dict-card dict-entry-card dict-curation">
        <button
          type="button" className="dict-curation-btn" aria-expanded={curOpen} aria-controls={curOpen ? 'dict-curation' : undefined}
          onClick={() => setCurOpen(!curOpen)}
        >
          <span className="dict-items-title">
            <span className="dict-items-name">Curation</span>
            <span className="dict-items-count">{curatorSummary}</span>
          </span>
          <span className={`dict-chev${curOpen ? ' is-open' : ''}`}><DictIcon name="chevron" size={16} /></span>
        </button>
        {curOpen && (
          <div id="dict-curation">
            {curator ? (
              <div className="dict-strip">
                <span className={`dict-avatar${curator.pubkey === person.assistant ? ' dict-avatar--local' : ''}`}>{initialOf(nameOf(curator.pubkey))}</span>
                <div className="dict-strip-text">
                  <span className="dict-field-label">Curated by</span>
                  <span className="dict-strip-name">
                    {nameOf(curator.pubkey)}{nip05Of(curator.pubkey) && <span className="dict-strip-faint"> · {nip05Of(curator.pubkey)}</span>}
                  </span>
                  <span className="dict-strip-why">{curatorWhy}</span>
                </div>
              </div>
            ) : (
              <p className="dict-items-msg">
                {!mapSettled ? 'Reading the Treasure Map…'
                  : mapError ? `Could not read ${whose} Treasure Map: ${map.error}`
                    : `No Assistant curates this for ${whose} Dictionary.`}
              </p>
            )}
            <div className="dict-switches">
              {CURATION_OPTIONS.map((label) => (
                <div key={label} className="dict-switch-row">
                  <span className="dict-switch-label">{label}</span>
                  <button type="button" role="switch" aria-checked="false" aria-label={label} aria-describedby="dict-curation-note" className="dict-switch" disabled>
                    <span className="dict-switch-knob" />
                  </button>
                </div>
              ))}
            </div>
            <p id="dict-curation-note" className="dict-entry-note text-muted">These settings arrive in a later version.</p>
          </div>
        )}
      </div>

      {/* FAQ — closed by default. */}
      <div className="dict-faq-wrap">
        <button
          type="button" className="dict-link-btn" aria-expanded={faqShown} aria-controls={faqShown ? 'dict-entry-faq' : undefined}
          onClick={() => setFaqShown(!faqShown)}
        >
          Frequently asked questions <span className={`dict-chev${faqShown ? ' is-open' : ''}`}><DictIcon name="chevron" /></span>
        </button>
        {faqShown && (
          <div id="dict-entry-faq" className="dict-card dict-faq">
            <div className="dict-faq-item">
              <button
                type="button" className="dict-faq-q" aria-expanded={faqOpen} aria-controls={faqOpen ? 'dict-entry-faq-a' : undefined}
                onClick={() => setFaqOpen(!faqOpen)}
              >
                <span>{ITEMS_FAQ_Q}</span>
                <span className={`dict-chev${faqOpen ? ' is-open' : ''}`}><DictIcon name="chevron" size={16} /></span>
              </button>
              {faqOpen && <p id="dict-entry-faq-a" className="dict-faq-a">{itemsFaqAnswer(person.signedIn)}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Who authored the shared concept, how many trusted members file under it, and Veto. */}
      <div className="dict-strip dict-author-strip">
        <span className="dict-avatar dict-avatar--soft">{initialOf(sharedCoord ? nameOf(sharedAuthor) : nameOf(author))}</span>
        <div className="dict-strip-text dict-author-text">
          {!settled ? (
            <span>Reading {whose} Dictionary…</span>
          ) : sharedCoord ? (
            <span>
              A Shared Community Concept, authored by{' '}
              <Link to={`${profileBase}/${sharedAuthor}`} className="dict-strip-link">{nameOf(sharedAuthor)}</Link>
              {nip05Of(sharedAuthor) && <span className="dict-strip-faint"> · {nip05Of(sharedAuthor)}</span>}
            </span>
          ) : (
            <span>{entry ? 'Its b-tag points at an event id, not at a shared concept that items are filed under.' : 'Not in this Dictionary, so it is not scored.'}</span>
          )}
          {/* GUM₁ counts distinct trusted authors filing under the shared concept; another metric needs its own words. */}
          {entry && sharedCoord && metric === 'gum1' && (
            <span>
              <strong>{members} {members === 1 ? 'member' : 'members'}</strong> of {whose} trusted, extended community {members === 1 ? 'files' : 'file'} items under it.
            </span>
          )}
        </div>
        <button
          type="button" className="dict-pill-btn dict-pill-btn--quiet" disabled aria-describedby="dict-veto-note"
          title="Vetoing an entry arrives with Pins (version 2)"
        >
          {entry?.override === 'vetoed' ? 'Restore' : 'Veto'}
        </button>
      </div>
      <p id="dict-veto-note" className="dict-entry-note text-muted dict-veto-note">
        Vetoing and restoring entries by hand arrive with Pins, in a later version.
      </p>

      <Disclosure id="dict-community-header" label="Community Concept header">
        {!settled ? (
          <p className="text-muted">Reading {whose} Dictionary…</p>
        ) : sharedCoord ? (
          <>
            <p className="dict-mono dict-shared-coord">{sharedCoord}</p>
            <div className="dict-field-label dict-disclosure-label">Authored by</div>
            <p className="dict-disclosure-text">
              {nameOf(sharedAuthor)}{nip05Of(sharedAuthor) && <span className="dict-strip-faint"> · {nip05Of(sharedAuthor)}</span>}
            </p>
            {sharedEvent && <pre className="dict-json">{eventJson(sharedEvent)}</pre>}
            {!sharedIsSelf && shared.done && shared.error && <p className="text-muted">{shared.error}</p>}
            <p className="dict-entry-links">
              <Link to={`/tapestry/shared-concepts/header/${encodeURIComponent(sharedCoord)}`}>Raw header event →</Link>
            </p>
          </>
        ) : (
          <p className="text-muted">None: this entry does not point at a shared concept by coordinate.</p>
        )}
      </Disclosure>

      <Disclosure id="dict-own-header" label={author && author === person.assistant ? `${Whose} Assistant’s header` : `${Whose} header`}>
        <p className="dict-mono dict-entry-coord">{coord}</p>
        <div className="dict-field-label dict-disclosure-label">Recognizes the shared concept</div>
        {!header.done && <p className="text-muted">Reading the header…</p>}
        {header.done && header.error && <p className="text-muted">{header.error}</p>}
        {ev && bTags.length === 0 && <p className="text-muted">None: this header carries no b-tag.</p>}
        {bTags.length > 0 && (
          <ul className="dict-btargets">
            {bTags.map((t) => <li key={`${t[1]}|${t[2] || ''}`}><BTarget value={t[1]} type={t[2]} coord={coord} /></li>)}
          </ul>
        )}
        {ev && <pre className="dict-json">{eventJson(ev)}</pre>}
        <p className="dict-entry-links">
          <Link to={`/tapestry/concepts/${encodeURIComponent(coord)}`}>Open the concept →</Link>
          <Link to={`/tapestry/shared-concepts/header/${encodeURIComponent(coord)}`}>Raw header event →</Link>
        </p>
      </Disclosure>
    </>
  );
}
