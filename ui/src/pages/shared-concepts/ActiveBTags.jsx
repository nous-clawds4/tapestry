import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import TagDetailPanel from '../../components/TagDetailPanel';
import useProfiles from '../../hooks/useProfiles';
import { useAssistantRoster } from '../../context/AssistantRosterContext';
import { queryRelay } from '../../api/relay';
import { SENTINEL, dispositionOf } from '../../utils/bDisposition';
import { matchesScope } from '../../utils/authorScope';
import { fetchFromRelays } from '../../utils/nostrPublish';

// Where b-tag targets are looked up. Hardcoded for now — the future source is
// the appropriate subset of the nostr-relays concept.
const COMMUNITY_RELAYS = ['wss://dcosl.brainstorm.world'];

// Nostr filters cannot express "has a b tag", so the scan is bounded by kind
// and filtered client-side. Concept headers (39998) are the only b-tag
// carriers today (~150 events); widen this—or move the has-b filter into a
// server endpoint—if b-tags start appearing on other kinds.
const B_CARRIER_KINDS = [39998];

const A_TAG_RE = /^(\d+):([0-9a-f]{64}):(.+)$/;
const EVENT_ID_RE = /^[0-9a-f]{64}$/;

/** The singular name: `names` tag = ["names", singular, plural, …]. */
function singularName(ev) {
  const t = ev?.tags?.find((x) => x[0] === 'names');
  return t && typeof t[1] === 'string' && t[1].trim() !== '' ? t[1] : null;
}

/** The event's description tag value, if any. */
function descriptionOf(ev) {
  const t = ev?.tags?.find((x) => x[0] === 'description');
  return t && typeof t[1] === 'string' && t[1].trim() !== '' ? t[1] : null;
}

/**
 * Active b-tags — EVERY event in the local relay carrying a `b` tag, one row per b tag,
 * whoever signed it: the local event's singular name, its author, and the name + author of
 * the event the b-tag points to, fetched from the community relay. A b-tag is an a-tag or an
 * event id; anything else is unresolvable ("cannot locate event"). A located event without a
 * `names` tag reads "cannot locate name".
 *
 * The page used to answer `authors:[<owner assistant>]` and say so nowhere, so a reader could
 * not tell it was narrow. It now scans every author and narrows as a VIEW, on two independent
 * axes (ADR author-scoped-inspection/0002):
 *
 *   Showing   — a person: their own account AND the assistant this instance issued them.
 *   Signed by — a class of author: assistants here, the people they belong to, or anyone else.
 *
 * Both are applied at render time over one fetch, so changing either costs no request.
 */
export default function ActiveBTags() {
  const navigate = useNavigate();
  const { assistants, viewer, loading: rosterLoading } = useAssistantRoster();

  // `person` is an ACCOUNT pubkey (or null = Everyone); `authorType` is one of the four classes.
  // Not persisted — the selection resets on each load (ADR author-scoped-inspection/0002).
  const [person, setPerson] = useState(null);
  const [authorType, setAuthorType] = useState('anyone');
  const [chosen, setChosen] = useState(false); // has the reader touched the person selector yet?

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // b-tag value → located event (null = searched, not found). `done` flips
  // when the community lookup for the current row set has completed.
  const [shared, setShared] = useState({ map: {}, done: false });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        // No `authors`: the relay holds b-tag events signed by other instances' assistants and by
        // ordinary accounts, and a wire inspector that hides them under-reports silently.
        const events = await queryRelay({ kinds: B_CARRIER_KINDS });
        if (cancelled) return;
        const out = [];
        for (const ev of events || []) {
          const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
          for (const t of ev.tags || []) {
            // Skip the reserved `b-tag-deferred` sentinel by name — it is a
            // disposition marker, not a correspondence claim, and must never
            // render as an unresolvable target (ADR shared-concepts-adoption/0001).
            if (t[0] === 'b' && typeof t[1] === 'string' && t[1].trim() !== '' && t[1].trim() !== SENTINEL) {
              const value = t[1].trim();
              out.push({
                uuid: `${ev.id}:${t[1]}`,
                localName: singularName(ev),
                bTag: value,
                // Who signed the event that CARRIES the b-tag — distinct from the author of the
                // event it points at, which the shared columns report.
                authorPubkey: ev.pubkey,
                // A b-tag equal to its carrier's own coordinate is a self-declaration, not a
                // correspondence. The rule has one home; do not re-derive it inline.
                selfDeclared: d != null
                  && dispositionOf([value], `${ev.kind}:${ev.pubkey}:${d}`).selfDeclared,
                // The description of the LOCAL event carrying the b-tag — deliberately not
                // the shared event's (story AC-8). It is already on `ev`; no extra fetch.
                description: descriptionOf(ev),
                // Detail-page coordinate of the local event; rows without a
                // d-tag (non-addressable carriers) have no detail route.
                coord: d != null ? `${ev.kind}:${ev.pubkey}:${d}` : null,
              });
            }
          }
        }
        setRows(out);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // The default person: the reader's own account when signed in, else the owner's. Applied once
  // the roster has answered and only until the reader picks for themselves, so their choice is
  // never overwritten by a later roster refresh (story 3 AC-1, AC-2).
  const ownerAccount = useMemo(
    () => assistants.find((a) => a.role === 'owner')?.accountPubkey || null,
    [assistants],
  );
  useEffect(() => {
    if (rosterLoading || chosen) return;
    setPerson(viewer ? viewer.accountPubkey : ownerAccount);
  }, [rosterLoading, chosen, viewer, ownerAccount]);

  // The roster is the instance's view of itself; a signed-in reader it does not list (an admin an
  // unauthenticated-shaped response withholds) still has to be scopeable, so union `viewer` in.
  const scopeRoster = useMemo(() => {
    if (!viewer || assistants.some((a) => a.accountPubkey === viewer.accountPubkey)) return assistants;
    return [...assistants, {
      accountPubkey: viewer.accountPubkey,
      assistantPubkey: viewer.assistantPubkey,
      role: 'admin',
      displayName: 'Me',
    }];
  }, [assistants, viewer]);

  const visibleRows = useMemo(
    () => rows.filter((r) => matchesScope(r.authorPubkey, { person, authorType }, scopeRoster)),
    [rows, person, authorType, scopeRoster],
  );

  // Look the b-tag targets up on the community relay — two merged filters
  // (one for all a-tag coordinates, one for all event ids) instead of a
  // relay dial per row. The merged a-tag filter over-fetches across the
  // cross-product; rows re-match precisely below, newest per coordinate.
  useEffect(() => {
    setShared({ map: {}, done: false });
    if (rows.length === 0) return undefined;
    let cancelled = false;

    (async () => {
      const targets = [...new Set(rows.map((r) => r.bTag))];
      const aTags = targets.filter((v) => A_TAG_RE.test(v));
      const ids = targets.filter((v) => EVENT_ID_RE.test(v));
      const filters = [];
      if (aTags.length > 0) {
        filters.push({
          kinds: [...new Set(aTags.map((v) => Number(v.match(A_TAG_RE)[1])))],
          authors: [...new Set(aTags.map((v) => v.match(A_TAG_RE)[2]))],
          '#d': [...new Set(aTags.map((v) => v.match(A_TAG_RE)[3]))],
        });
      }
      if (ids.length > 0) filters.push({ ids });

      const results = (await Promise.all(
        filters.map((f) => fetchFromRelays(f, COMMUNITY_RELAYS)),
      )).flat();
      if (cancelled) return;

      const byId = new Map();
      const byCoord = new Map();
      for (const ev of results) {
        byId.set(ev.id, ev);
        const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
        if (d != null) {
          const coord = `${ev.kind}:${ev.pubkey}:${d}`;
          const prev = byCoord.get(coord);
          if (!prev || ev.created_at > prev.created_at) byCoord.set(coord, ev);
        }
      }

      const map = {};
      for (const v of targets) {
        if (A_TAG_RE.test(v)) map[v] = byCoord.get(v) || null;
        else if (EVENT_ID_RE.test(v)) map[v] = byId.get(v) || null;
        else map[v] = null; // neither an a-tag nor an event id — unresolvable
      }
      setShared({ map, done: true });
    })();

    return () => { cancelled = true; };
  }, [rows]);

  // Both author columns resolve through the same batched profile fetch.
  const authorsToName = useMemo(
    () => [...new Set([
      ...Object.values(shared.map).filter(Boolean).map((ev) => ev.pubkey),
      ...visibleRows.map((r) => r.authorPubkey),
    ])],
    [shared, visibleRows],
  );
  const profiles = useProfiles(authorsToName);

  const columns = [
    {
      key: 'localName',
      label: 'name (local)',
      render: (val) => val || <span className="text-muted">—</span>,
    },
    {
      // Who signed the LOCAL event carrying the b-tag. Sits beside name (local) so the local
      // pair reads together, ahead of the two columns describing what the b-tag points at.
      key: 'authorPubkey',
      label: 'author (local)',
      render: (_val, row) => <AuthorCell pubkey={row.authorPubkey} profiles={profiles} />,
    },
    {
      // Virtual column: no `sharedName` field exists on the row — the cell
      // resolves through the async lookup map via the row's bTag.
      key: 'sharedName',
      label: 'name (shared)',
      render: (_val, row) => {
        if (!shared.done) return <span className="text-muted">…</span>;
        const ev = shared.map[row.bTag];
        if (!ev) return <span className="text-muted">cannot locate event</span>;
        return singularName(ev) || <span className="text-muted">cannot locate name</span>;
      },
    },
    {
      key: 'sharedAuthor',
      label: 'author (shared)',
      render: (_val, row) => {
        const ev = shared.done ? shared.map[row.bTag] : null;
        if (!ev) return <span className="text-muted">—</span>;
        return <AuthorCell pubkey={ev.pubkey} profiles={profiles} />;
      },
    },
  ];

  const personLabel = (pk) => {
    if (!pk) return 'Everyone';
    if (viewer && pk === viewer.accountPubkey) return 'Mine';
    const row = scopeRoster.find((a) => a.accountPubkey === pk);
    // Unreachable while every option comes from scopeRoster, but name the pubkey rather than
    // guess: labelling an unknown account "Mine" would assert something false about whose it is.
    if (!row) return `${pk.slice(0, 8)}…`;
    if (row.role === 'owner') return 'Owner';
    return row.displayName || `${pk.slice(0, 8)}…`;
  };

  const AUTHOR_TYPES = [
    ['anyone', 'Anyone'],
    ['assistants', 'Assistants'],
    ['people', 'People'],
    ['everyone-else', 'Everyone else'],
  ];

  const selectStyle = {
    padding: '0.4rem 0.6rem', fontSize: '0.85rem',
    backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid var(--border, #444)', borderRadius: '4px',
  };

  // Names both selections, so an empty table says WHY it is empty rather than just that it is.
  const emptyMessage = person || authorType !== 'anyone'
    ? `No b-tags match “${personLabel(person)}” signed by “${
      AUTHOR_TYPES.find(([v]) => v === authorType)?.[1] || 'Anyone'}”.`
    : 'No active b-tags.';

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 Active b-tags</h1>
      <p className="subtitle">
        Every nostr event in this instance&rsquo;s relay that uses the b-tag to point to a shared
        nostr event — whoever signed it.
      </p>

      {/* Nothing below renders until the roster has answered. Until it does the page does not know
          WHOSE view to show, and drawing the table anyway paints every author for a beat and then
          snaps to the reader's own — a flash of a view they did not ask for. */}
      {!rosterLoading && (
      <div style={{ display: 'flex', gap: '1.5rem', margin: '0 0 1rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="text-muted">Showing</span>
            <select
              style={selectStyle}
              value={person || ''}
              onChange={(e) => { setChosen(true); setPerson(e.target.value || null); }}
            >
              <option value="">Everyone</option>
              {viewer && <option value={viewer.accountPubkey}>Mine</option>}
              {scopeRoster
                .filter((a) => !viewer || a.accountPubkey !== viewer.accountPubkey)
                .map((a) => (
                  <option key={a.accountPubkey} value={a.accountPubkey}>{personLabel(a.accountPubkey)}</option>
                ))}
            </select>
          </label>
          <p className="text-muted" style={{ fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
            A person&rsquo;s own events and their assistant&rsquo;s.
          </p>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="text-muted">Signed by</span>
            <select style={selectStyle} value={authorType} onChange={(e) => setAuthorType(e.target.value)}>
              {AUTHOR_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <p className="text-muted" style={{ fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
            Assistants this instance controls, the people they belong to, or anyone else.
          </p>
        </div>
      </div>

      )}

      {viewer && viewer.assistantPubkey === null && (
        <p className="subtitle">
          You have no assistant key on this instance, so &ldquo;Mine&rdquo; shows only events you
          signed yourself.
        </p>
      )}

      {(loading || rosterLoading) && <p>Loading active b-tags…</p>}
      {error && <p className="error">Error: {error}</p>}
      {!loading && !rosterLoading && !error && (
        <>
          <p className="subtitle">{visibleRows.length} active b-tags</p>
          <DataTable
            columns={columns}
            data={visibleRows}
            filterKeys={['bTag', 'description']}
            rowClassName={(row) => (row.selfDeclared ? 'row-self-declared' : undefined)}
            renderExpanded={(row) => (
              <TagDetailPanel
                description={row.description}
                tagLabel="b-tag"
                tagValue={row.bTag}
                note={row.selfDeclared ? '* self-declaration' : undefined}
              />
            )}
            onRowClick={(row) => {
              if (!row.coord) return;
              navigate(`/tapestry/shared-concepts/b-tags/${encodeURIComponent(row.coord)}?b=${encodeURIComponent(row.bTag)}`);
            }}
            emptyMessage={emptyMessage}
          />
        </>
      )}
    </div>
  );
}
