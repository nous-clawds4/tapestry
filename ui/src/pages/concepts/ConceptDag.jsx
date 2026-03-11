import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';

/**
 * Organization (Sets) tab
 *
 * Shows a table of all Set/Superset nodes downstream of the concept's Superset
 * via IS_A_SUPERSET_OF relationships, including the Superset itself.
 */

export default function ConceptDag() {
  const { concept, uuid } = useOutletContext();
  const navigate = useNavigate();
  const encodedUuid = encodeURIComponent(uuid);

  // Fetch the superset + all downstream sets via IS_A_SUPERSET_OF
  // directCount = elements connected directly to this set
  // totalCount = elements reachable through this set + all its subsets
  const { data, loading, error } = useCypher(
    uuid ? `
      MATCH (h:NostrEvent {uuid: '${uuid}'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      OPTIONAL MATCH path = (sup)-[:IS_A_SUPERSET_OF*0..10]->(s)
      WITH sup, s, length(path) AS depth
      OPTIONAL MATCH (s)-[:HAS_ELEMENT]->(directElem)
      WITH s, depth, labels(s) AS nodeLabels, collect(DISTINCT directElem) AS directElems
      OPTIONAL MATCH (s)-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(totalElem)
      WITH s, depth, nodeLabels, size(directElems) AS directCount, count(DISTINCT totalElem) AS totalCount
      RETURN s.uuid AS uuid, s.name AS name, nodeLabels,
             depth, directCount, totalCount
      ORDER BY depth, name
    ` : null
  );

  // DataTable render signature: render(cellValue, fullRow)
  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (_val, row) => (
        <span style={{ paddingLeft: `${(row.depth || 0) * 1.2}rem` }}>
          {row.depth > 0 && <span style={{ opacity: 0.3, marginRight: '0.4rem' }}>└</span>}
          {row.name || row.uuid?.slice(0, 20) + '…'}
        </span>
      ),
    },
    {
      key: 'nodeLabels',
      label: 'Type',
      render: (_val, row) => {
        const labels = row.nodeLabels || [];
        if (labels.includes('Superset')) return <span style={{ color: '#a78bfa' }}>Superset</span>;
        if (labels.includes('Set')) return <span style={{ color: '#38bdf8' }}>Set</span>;
        return <span style={{ opacity: 0.5 }}>—</span>;
      },
    },
    {
      key: 'directCount',
      label: 'Direct',
    },
    {
      key: 'totalCount',
      label: 'Total',
    },
    {
      key: 'depth',
      label: 'Depth',
    },
  ];

  return (
    <div>
      {/* Header row with buttons */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <h2 style={{ margin: 0 }}>Organization (Sets)</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/kg/concepts/${encodedUuid}/dag/new-set`)}
          >
            + New Set
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/kg/concepts/${encodedUuid}/elements/new`)}
          >
            + New Element
          </button>
        </div>
      </div>

      {loading && <div className="loading">Loading sets…</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {data && data.length === 0 && (
        <p style={{ opacity: 0.5 }}>
          No superset found for this concept. Has it been normalized?
        </p>
      )}

      {data && data.length > 0 && (
        <DataTable
          columns={columns}
          data={data}
          onRowClick={(row) => navigate(`/kg/concepts/${encodedUuid}/dag/${encodeURIComponent(row.uuid)}`)}
        />
      )}
    </div>
  );
}
