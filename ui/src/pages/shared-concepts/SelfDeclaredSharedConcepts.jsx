import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { useConfig } from '../../context/ConfigContext';
import { queryRelay } from '../../api/relay';
import { fetchFromRelays } from '../../utils/nostrPublish';

// The public relay searched for self-declarations. Hardcoded for now — the
// future source is the appropriate subset of the nostr-relays concept.
const COMMUNITY_RELAYS = ['wss://dcosl.brainstorm.world'];

// Relay filters cannot express "has a b tag", so the search is bounded by
// kind and filtered client-side. Concept headers (39998) are where the
// self-declaration pattern lives; widen if it appears on other kinds.
const SELF_DECLARED_KINDS = [39998];

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

/** Age as trimmed "Ny Nd Nh Nm Ns" (leading zero units dropped). */
function formatAge(totalSeconds) {
  let s = Math.max(0, Math.floor(totalSeconds));
  const y = Math.floor(s / 31536000); s -= y * 31536000;
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const parts = [];
  if (y) parts.push(`${y}y`);
  if (y || d) parts.push(`${d}d`);
  if (y || d || h) parts.push(`${h}h`);
  if (y || d || h || m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/**
 * Self-declared Shared Concepts — events on the community relay whose author
 * offers them as shared concepts, evidenced by a b-tag pointing at the
 * event's OWN a-tag coordinate (kind:pubkey:d-tag). Self-declaration by
 * event id is impossible (an event cannot know its id before signing), so
 * only a-tag-form b-tags are considered — the self-coordinate equality
 * enforces that by construction. Replaceable events dedupe newest-first per
 * coordinate before the match.
 */
export default function SelfDeclaredSharedConcepts() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null); // null = loading
  const [loadedAt, setLoadedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const events = await fetchFromRelays({ kinds: SELF_DECLARED_KINDS }, COMMUNITY_RELAYS);
      if (cancelled) return;

      // Newest per coordinate (addressable events replace by coordinate).
      const byCoord = new Map();
      for (const ev of events || []) {
        const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
        if (d == null) continue;
        const coord = `${ev.kind}:${ev.pubkey}:${d}`;
        const prev = byCoord.get(coord);
        if (!prev || ev.created_at > prev.created_at) byCoord.set(coord, ev);
      }

      const out = [];
      for (const [coord, ev] of byCoord) {
        const selfDeclared = (ev.tags || []).some(
          (t) => t[0] === 'b' && typeof t[1] === 'string' && t[1].trim() === coord,
        );
        if (!selfDeclared) continue;
        out.push({
          uuid: coord,
          eventId: ev.id,
          name: singularName(ev),
          description: descriptionOf(ev),
          author: ev.pubkey,
          createdAt: ev.created_at,
        });
      }
      out.sort((a, b) => b.createdAt - a.createdAt);
      setRows(out);
      setLoadedAt(Math.floor(Date.now() / 1000));
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Local-usage indicators, one per definition of "using locally" ───────
  // b: some OTHER local event points at the concept via a b-tag (the
  //    concept's own self-pointer — including pulled copies of its header —
  //    is the declaration itself, not usage, and is excluded);
  // record: the local `shared concept` registry holds an element whose
  //    identifiers reference it (official recognition, not actual usage);
  // z: some event in the local strfry files itself under the concept via a
  //    z-tag — the purest usage signal.
  const { taPubkey } = useConfig();
  const [usage, setUsage] = useState({ map: {}, done: false });

  useEffect(() => {
    setUsage({ map: {}, done: false });
    if (!rows || rows.length === 0 || !taPubkey) return undefined;
    let cancelled = false;

    (async () => {
      const coords = rows.map((r) => r.uuid);
      const [bCarriers, zCarriers, registryElems] = await Promise.all([
        queryRelay({ '#b': coords }).catch(() => []),
        queryRelay({ '#z': coords }).catch(() => []),
        queryRelay({ kinds: [39999], '#z': [`39998:${taPubkey}:shared-concept`] }).catch(() => []),
      ]);
      if (cancelled) return;

      const usedB = new Set();
      for (const ev of bCarriers || []) {
        const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
        const own = d != null ? `${ev.kind}:${ev.pubkey}:${d}` : null;
        for (const t of ev.tags || []) {
          if (t[0] === 'b' && coords.includes(t[1]) && t[1] !== own) usedB.add(t[1]);
        }
      }

      const usedZ = new Set();
      for (const ev of zCarriers || []) {
        for (const t of ev.tags || []) {
          if (t[0] === 'z' && coords.includes(t[1])) usedZ.add(t[1]);
        }
      }

      const recordATags = new Set();
      const recordEventIds = new Set();
      for (const ev of registryElems || []) {
        try {
          const raw = ev.tags?.find((t) => t[0] === 'json')?.[1];
          const ids = (raw ? JSON.parse(raw).sharedConcept : null)?.identifiers || {};
          if (typeof ids['a-tag'] === 'string' && ids['a-tag'].trim() !== '') recordATags.add(ids['a-tag'].trim());
          if (typeof ids['event-id'] === 'string' && ids['event-id'].trim() !== '') recordEventIds.add(ids['event-id'].trim());
        } catch { /* malformed registry element — skip */ }
      }

      const map = {};
      for (const r of rows) {
        map[r.uuid] = {
          b: usedB.has(r.uuid),
          record: recordATags.has(r.uuid) || recordEventIds.has(r.eventId),
          z: usedZ.has(r.uuid),
        };
      }
      setUsage({ map, done: true });
    })();

    return () => { cancelled = true; };
  }, [rows, taPubkey]);

  const authors = useMemo(() => (rows || []).map((r) => r.author), [rows]);
  const profiles = useProfiles(authors);

  const usageCell = (indicator) => (coord) => {
    if (!usage.done) return <span className="text-muted">…</span>;
    return usage.map[coord]?.[indicator]
      ? <span title="in local use">✓</span>
      : <span className="text-muted">—</span>;
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val) => val || <span className="text-muted">—</span>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (val) => val || <span className="text-muted">—</span>,
    },
    {
      key: 'author',
      label: 'Author',
      render: (val) => <AuthorCell pubkey={val} profiles={profiles} />,
    },
    {
      key: 'createdAt',
      label: 'Age',
      render: (val) => <span style={{ whiteSpace: 'nowrap' }}>{formatAge((loadedAt || 0) - val)}</span>,
    },
    { key: 'uuid', label: 'used (b-tag)', render: usageCell('b') },
    { key: 'uuid', label: 'record', render: usageCell('record') },
    { key: 'uuid', label: 'used (z-tag)', render: usageCell('z') },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 Self-declared Shared Concepts</h1>
      <p className="subtitle">
        Events published to a public relay whose author offers them as shared concepts, as
        evidenced by a b-tag that points to the event itself. To make use of one, point to it
        with the same b-tag it uses to point to itself.
      </p>

      {rows === null ? (
        <p>Searching the community relay…</p>
      ) : (
        <>
          <p className="subtitle">{rows.length} self-declared shared concepts</p>
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(row) => navigate(`/tapestry/shared-concepts/self-declared/${encodeURIComponent(row.uuid)}`)}
            emptyMessage="No self-declared shared concepts found."
          />
        </>
      )}
    </div>
  );
}
