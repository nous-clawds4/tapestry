import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import OrganizationView from './OrganizationView';
import PropertyTreeView from './PropertyTreeView';

const VIEWS = [
  { key: 'organization', label: 'Organization (Sets)' },
  { key: 'property-tree', label: 'Property Tree' },
];

export default function ConceptVisualization() {
  const { concept, uuid } = useOutletContext();
  const [activeView, setActiveView] = useState('organization');

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '1.5rem',
      }}>
        {VIEWS.map(view => (
          <button
            key={view.key}
            onClick={() => setActiveView(view.key)}
            style={{
              padding: '0.4rem 0.9rem',
              fontSize: '0.85rem',
              fontWeight: activeView === view.key ? 600 : 400,
              borderRadius: '6px',
              border: `1px solid ${activeView === view.key ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255,255,255,0.1)'}`,
              backgroundColor: activeView === view.key ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeView === view.key ? '#818cf8' : 'var(--text-muted, #aaa)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {view.label}
          </button>
        ))}
      </div>

      {activeView === 'organization' && (
        <OrganizationView uuid={uuid} conceptName={concept?.name} />
      )}

      {activeView === 'property-tree' && (
        <PropertyTreeView uuid={uuid} conceptName={concept?.name} />
      )}
    </div>
  );
}
