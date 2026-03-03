import Breadcrumbs from '../../components/Breadcrumbs';

export default function NewConcept() {
  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🧩 New Concept</h1>
      <p className="page-description">Create a new concept in the knowledge graph.</p>
      <div style={{
        marginTop: '2rem',
        padding: '2rem',
        border: '1px dashed var(--border)',
        borderRadius: '8px',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}>
        <p style={{ fontSize: '1.2rem' }}>🚧 Coming soon</p>
        <p style={{ marginTop: '0.5rem' }}>
          Creating a new concept involves generating multiple coordinated events:
          a ListHeader, Superset, JSON Schema, relationship wiring, and optionally graphs.
          This form is under development.
        </p>
      </div>
    </div>
  );
}
