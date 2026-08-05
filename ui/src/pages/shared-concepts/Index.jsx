import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../utils/auth';
import { queryRelay } from '../../api/relay';

// A shared concept is an element of the `shared-concept` concept: a kind-39999
// addressable event z-tagged to `39998:<TA>:shared-concept`. Read from strfry
// like the tapestries directory (the durable source of truth for elements —
// ADR tapestries/0001 pattern).
const SHARED_CONCEPT_KIND = 39999;

/** Parse a strfry shared-concept element event into a directory row (or null to skip). */
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
  const sc = json.sharedConcept || {};
  return {
    uuid: `${SHARED_CONCEPT_KIND}:${ev.pubkey}:${dTag}`,
    name: sc.name || dTag,
    description: sc.description || '',
    author: ev.pubkey,
  };
}

export default function SharedConceptsIndex() {
  const navigate = useNavigate();
  const { taPubkey } = useConfig();
  const { user } = useAuth();
  const isOwner = hasAdminAccess(user);
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
          kinds: [SHARED_CONCEPT_KIND],
          '#z': [`39998:${taPubkey}:shared-concept`],
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
    { key: 'name', label: 'Name' },
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
        <h1>🤝 View Shared Concepts</h1>
        {isOwner && (
          <button className="btn btn-primary" onClick={() => navigate('/tapestry/shared-concepts/new')}>
            + Create New Shared Concept
          </button>
        )}
      </div>
      <p className="subtitle">
        These are concepts recognized by the local tapestry (me) as being authoritative. They
        typically will not be authored by me (the Tapestry owner) or my Tapestry Assistant,
        although they could be.
      </p>

      {loading && <p>Loading shared concepts…</p>}
      {error && <p className="error">Error: {error}</p>}
      {!loading && !error && (
        <>
          <p className="subtitle">{rows.length} shared concepts</p>
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(row) => navigate(`/tapestry/shared-concepts/${encodeURIComponent(row.uuid)}`)}
            emptyMessage="No shared concepts yet."
          />
        </>
      )}
    </div>
  );
}
