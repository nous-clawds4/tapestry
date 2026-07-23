import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/DataTable';
import PlacementDialog from '../../components/PlacementDialog';

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
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';
  const [placeTarget, setPlaceTarget] = useState(null); // { uuid, name }

  // Fetch the superset + all downstream sets via IS_A_SUPERSET_OF
  // directCount = elements connected directly to this set
  // totalCount = elements reachable through this set + all its subsets
  const { data, loading, error, refetch } = useCypher(
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

  // Owner-only per-row placement affordance (AC5): opens the shared dialog
  // in forNode mode for the row's set; subset kind preselected (re-parenting
  // a set is the common case here).
  if (isOwner) {
    columns.push({
      key: 'actions',
      label: '',
      render: (_val, row) => (
        <button
          className="btn btn-small"
          title="Place or move this node under a set"
          onClick={(e) => {
            e.stopPropagation();
            setPlaceTarget({ uuid: row.uuid, name: row.name });
          }}
        >
          Place / move…
        </button>
      ),
    });
  }

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
            onClick={() => navigate(`/tapestry/concepts/${encodedUuid}/dag/new-set`)}
          >
            + New Set
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/tapestry/concepts/${encodedUuid}/elements/new`)}
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
          onRowClick={(row) => navigate(`/tapestry/concepts/${encodedUuid}/dag/${encodeURIComponent(row.uuid)}`)}
        />
      )}

      <PlacementDialog
        open={!!placeTarget}
        mode="forNode"
        conceptUuid={uuid}
        fixedNode={placeTarget || undefined}
        defaultKind="subset"
        onChanged={refetch}
        onClose={() => setPlaceTarget(null)}
      />
    </div>
  );
}
