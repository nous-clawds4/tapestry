import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { useConfig } from '../../context/ConfigContext';
import { queryRelay } from '../../api/relay';
import useCommunitySharedConcepts from '../../hooks/useCommunitySharedConcepts';
import { SENTINEL } from '../../utils/bDisposition';

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
 * Self-declared Shared Concepts — the community-relay fetch (dedupe +
 * self-coordinate match) lives in useCommunitySharedConcepts (extracted
 * behavior-preserving, ADR shared-concepts-adoption/0001, so the disposition
 * panel's wire-external picker shares it). This page adds the local-usage
 * indicators.
 */
export default function SelfDeclaredSharedConcepts() {
  const navigate = useNavigate();
  const { rows, loadedAt } = useCommunitySharedConcepts();

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
          // The reserved sentinel is a disposition marker, never usage —
          // skipped by name (it can't equal a coord, but the skip is
          // deliberate, not accidental; ADR shared-concepts-adoption/0001).
          if (t[0] === 'b' && t[1] !== SENTINEL && coords.includes(t[1]) && t[1] !== own) usedB.add(t[1]);
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
