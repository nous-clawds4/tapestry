import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { useConfig } from '../../context/ConfigContext';
import { queryRelay } from '../../api/relay';
import { SENTINEL } from '../../utils/bDisposition';
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

/**
 * Active b-tags — every local-TA-authored event carrying a `b` tag, one row
 * per b tag: the local event's singular name, the b-tag itself, and the name
 * + author of the event the b-tag points to, fetched from the community
 * relay. A b-tag is an a-tag or an event id; anything else is unresolvable
 * ("cannot locate event"). A located event without a `names` tag reads
 * "cannot locate name".
 */
export default function ActiveBTags() {
  const navigate = useNavigate();
  const { taPubkey } = useConfig();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // b-tag value → located event (null = searched, not found). `done` flips
  // when the community lookup for the current row set has completed.
  const [shared, setShared] = useState({ map: {}, done: false });

  useEffect(() => {
    if (!taPubkey) return undefined; // wait for the runtime-resolved TA pubkey
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const events = await queryRelay({ authors: [taPubkey], kinds: B_CARRIER_KINDS });
        if (cancelled) return;
        const out = [];
        for (const ev of events || []) {
          const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
          for (const t of ev.tags || []) {
            // Skip the reserved `b-tag-deferred` sentinel by name — it is a
            // disposition marker, not a correspondence claim, and must never
            // render as an unresolvable target (ADR shared-concepts-adoption/0001).
            if (t[0] === 'b' && typeof t[1] === 'string' && t[1].trim() !== '' && t[1].trim() !== SENTINEL) {
              out.push({
                uuid: `${ev.id}:${t[1]}`,
                localName: singularName(ev),
                bTag: t[1].trim(),
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
  }, [taPubkey]);

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

  const sharedAuthors = useMemo(
    () => [...new Set(Object.values(shared.map).filter(Boolean).map((ev) => ev.pubkey))],
    [shared],
  );
  const profiles = useProfiles(sharedAuthors);

  const columns = [
    {
      key: 'localName',
      label: 'name (local)',
      render: (val) => val || <span className="text-muted">—</span>,
    },
    {
      key: 'bTag',
      label: 'b-tag',
      render: (val) => <code style={{ overflowWrap: 'anywhere' }}>{val}</code>,
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

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 Active b-tags</h1>
      <p className="subtitle">
        A list of locally-authored nostr events that use the b-tag to point to shared nostr events.
      </p>

      {loading && <p>Loading active b-tags…</p>}
      {error && <p className="error">Error: {error}</p>}
      {!loading && !error && (
        <>
          <p className="subtitle">{rows.length} active b-tags</p>
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(row) => {
              if (!row.coord) return;
              navigate(`/tapestry/shared-concepts/b-tags/${encodeURIComponent(row.coord)}?b=${encodeURIComponent(row.bTag)}`);
            }}
            emptyMessage="No active b-tags."
          />
        </>
      )}
    </div>
  );
}
