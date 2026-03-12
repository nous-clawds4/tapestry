import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…';
}

export default function UsersIndex() {
  const navigate = useNavigate();
  const [neo4jPubkeys, setNeo4jPubkeys] = useState([]);
  const [strfryPubkeys, setStrfryPubkeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch Neo4j users and strfry kind 0 events in parallel
        const [neo4jRes, strfryRes] = await Promise.all([
          fetch(`/api/neo4j/run-query?cypher=${encodeURIComponent(
            'MATCH (u:NostrUser) RETURN u.pubkey AS pubkey ORDER BY u.pubkey'
          )}`).then(r => r.json()),
          fetch(`/api/strfry/scan?filter=${encodeURIComponent(
            JSON.stringify({ kinds: [0] })
          )}`).then(r => r.json()).catch(() => ({ events: [] })),
        ]);

        if (cancelled) return;

        // Parse Neo4j CSV response
        const lines = (neo4jRes.cypherResults || '').trim().split('\n').slice(1);
        const pubkeys = lines.map(l => l.replace(/"/g, '').trim()).filter(Boolean);
        setNeo4jPubkeys(pubkeys);

        // Build set of strfry kind 0 pubkeys
        const strfrySet = new Set((strfryRes.events || []).map(e => e.pubkey));
        setStrfryPubkeys(strfrySet);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Merge all unique pubkeys from both sources
  const allPubkeys = useMemo(() => {
    const set = new Set([...neo4jPubkeys, ...strfryPubkeys]);
    return [...set].sort();
  }, [neo4jPubkeys, strfryPubkeys]);

  const profiles = useProfiles(allPubkeys);

  const rows = useMemo(() => {
    return allPubkeys.map(pubkey => {
      const p = profiles?.[pubkey];
      return {
        pubkey,
        displayName: p?.display_name || p?.name || shortPubkey(pubkey),
        picture: p?.picture || null,
        inNeo4j: neo4jPubkeys.includes(pubkey),
        inStrfry: strfryPubkeys.has(pubkey),
        nip05: p?.nip05 || null,
      };
    });
  }, [allPubkeys, profiles, neo4jPubkeys, strfryPubkeys]);

  const columns = [
    {
      key: 'displayName',
      label: 'User',
      render: (val, row) => (
        <span className="author-cell" title={row.pubkey}>
          {row.picture ? (
            <img src={row.picture} alt="" className="author-avatar" />
          ) : (
            <span className="author-avatar-placeholder" />
          )}
          <span className="author-name">{val}</span>
        </span>
      ),
    },
    {
      key: 'nip05',
      label: 'NIP-05',
      render: (val) => val || <span className="text-muted">—</span>,
    },
    {
      key: 'pubkey',
      label: 'Pubkey',
      render: (val) => <code title={val}>{shortPubkey(val)}</code>,
    },
    {
      key: 'inNeo4j',
      label: 'Neo4j',
      render: (val) => val
        ? <span style={{ color: '#3fb950' }} title="In Neo4j">●</span>
        : <span style={{ color: '#6e7681' }} title="Not in Neo4j">○</span>,
    },
    {
      key: 'inStrfry',
      label: 'Strfry (kind 0)',
      render: (val) => val
        ? <span style={{ color: '#3fb950' }} title="Kind 0 in strfry">●</span>
        : <span style={{ color: '#6e7681' }} title="No kind 0 in strfry">○</span>,
    },
  ];

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>👤 Nostr Users</h1>
        <p>Loading users…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>👤 Nostr Users</h1>
        <p className="error">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>👤 Nostr Users</h1>
      <p className="subtitle">
        {allPubkeys.length} users · {neo4jPubkeys.length} in Neo4j · {strfryPubkeys.size} with kind 0 in strfry
      </p>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => navigate(`/kg/users/${row.pubkey}`)}
        emptyMessage="No users found"
      />
    </div>
  );
}
