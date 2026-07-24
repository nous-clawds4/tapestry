import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { useConfig } from '../../context/ConfigContext';
import { queryRelay } from '../../api/relay';

// A tapestry is an element of the `tapestry` concept: a kind-39999 addressable
// event z-tagged to `39998:<TA>:tapestry`. We read these from strfry (the
// durable source of truth) rather than Neo4j — see ADR tapestries/0001.
const TAPESTRY_KIND = 39999;

/** Parse a strfry tapestry element event into a directory row (or null to skip). */
function toRow(ev) {
  const dTag = ev.tags?.find((t) => t[0] === 'd')?.[1];
  if (!dTag) return null; // an addressable event with no d-tag has no stable identity
  let json = {};
  try {
    const raw = ev.tags?.find((t) => t[0] === 'json')?.[1];
    if (raw) json = JSON.parse(raw);
  } catch {
    json = {}; // malformed json → fall back to the d-tag below
  }
  const t = json.tapestry || {};
  return {
    // uuid is the stable a-tag coordinate (kind:pubkey:d-tag), which survives edits.
    uuid: `${TAPESTRY_KIND}:${ev.pubkey}:${dTag}`,
    title: t.title || dTag,
    description: t.description || '',
    author: ev.pubkey,
  };
}

export default function TapestriesIndex() {
  const navigate = useNavigate();
  const { taPubkey } = useConfig();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taPubkey) return; // wait for the runtime-resolved TA pubkey (never hardcode)
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const events = await queryRelay({
          kinds: [TAPESTRY_KIND],
          '#z': [`39998:${taPubkey}:tapestry`],
        });
        if (cancelled) return;
        setRows((events || []).map(toRow).filter(Boolean));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [taPubkey]);

  const authors = useMemo(() => rows.map((r) => r.author), [rows]);
  const profiles = useProfiles(authors);

  const columns = [
    { key: 'title', label: 'Title' },
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
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header-row">
        <h1>🧵 View Tapestries</h1>
        <button className="btn btn-primary" onClick={() => navigate('/tapestry/tapestries/new')}>
          + Create New Tapestry
        </button>
      </div>

      {loading && <p>Loading tapestries…</p>}
      {error && <p className="error">Error: {error}</p>}
      {!loading && !error && (
        <>
          <p className="subtitle">{rows.length} tapestries</p>
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(row) => navigate(`/tapestry/tapestries/${encodeURIComponent(row.uuid)}`)}
            emptyMessage="No tapestries yet."
          />
        </>
      )}
    </div>
  );
}
