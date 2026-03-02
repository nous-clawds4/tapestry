import { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

export default function ConceptElements() {
  const { uuid } = useOutletContext();
  const navigate = useNavigate();

  // Explicit elements: connected via Superset → HAS_ELEMENT
  const { data: explicit, loading: l1, error: e1 } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})-[:IS_THE_CONCEPT_FOR]->(s:Superset)
      -[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(e:ListItem)
    OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    WITH DISTINCT e, head(collect(j.value)) AS json
    RETURN e.uuid AS uuid, e.name AS name, e.pubkey AS author, json
  `);

  // Implicit elements: z-tag points to the concept's uuid
  const { data: implicit, loading: l2, error: e2 } = useCypher(`
    MATCH (e:ListItem)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z', value: '${uuid}'})
    OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    WITH DISTINCT e, head(collect(j.value)) AS json
    RETURN e.uuid AS uuid, e.name AS name, e.pubkey AS author, json
  `);

  // Merge explicit + implicit, dedup by uuid, mark binding type
  const merged = useMemo(() => {
    const explicitUuids = new Set((explicit || []).map(e => e.uuid));
    const implicitUuids = new Set((implicit || []).map(e => e.uuid));
    const byUuid = new Map();

    for (const e of (explicit || [])) {
      byUuid.set(e.uuid, { ...e, isExplicit: true, isImplicit: implicitUuids.has(e.uuid) });
    }
    for (const e of (implicit || [])) {
      if (byUuid.has(e.uuid)) {
        byUuid.get(e.uuid).isImplicit = true;
      } else {
        byUuid.set(e.uuid, { ...e, isExplicit: false, isImplicit: true });
      }
    }

    return [...byUuid.values()].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [explicit, implicit]);

  const loading = l1 || l2;
  const error = e1 || e2;

  const authorPubkeys = useMemo(
    () => [...new Set(merged.map(r => r.author).filter(Boolean))],
    [merged]
  );
  const profiles = useProfiles(authorPubkeys);

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'isExplicit',
      label: 'Explicit',
      render: (val) => val ? '✅' : '—',
    },
    {
      key: 'isImplicit',
      label: 'Implicit',
      render: (val) => val ? '✅' : '—',
    },
    {
      key: 'json',
      label: 'JSON Data',
      render: (val) => {
        if (!val) return '—';
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val.replace(/\\"/g, '"')) : val;
          return <code className="json-preview">{JSON.stringify(parsed, null, 0).slice(0, 80)}…</code>;
        } catch {
          return <code className="json-preview">{String(val).slice(0, 80)}…</code>;
        }
      },
    },
    {
      key: 'author',
      label: 'Author',
      render: (val) => <AuthorCell pubkey={val} profiles={profiles} />,
    },
  ];

  return (
    <div>
      <h2>Elements</h2>
      {loading && <div className="loading">Loading elements…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {!loading && !error && (
        <DataTable
          columns={columns}
          data={merged}
          onRowClick={(row) => navigate(`/kg/nodes/${encodeURIComponent(row.uuid)}`)}
          emptyMessage="No elements found"
        />
      )}
    </div>
  );
}
