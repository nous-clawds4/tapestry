import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchFirmwareManifest, fetchFirmwareConcept,
  fetchFirmwareVersions, fetchInstallStatus, installFirmware,
} from '../../api/firmware';
import ConceptMembersView from './ConceptMembersView';
// Per-concept core-node views, shared with the Tapestry Exploration page (ADR tapestries/0004).
import { CORE_NODES, ConceptOverview as FirmwareOverview, ConceptNodeJson as FirmwareNodeJson } from '../../components/concept/CoreNodeViews';

// Per-concept membership views — the concept's live elements and sets, rendered
// as a list → JSON-detail drill-down (distinct from the manifest-level
// Integrations section in the sidebar).
const MEMBER_VIEWS = [
  { key: 'elements', label: 'Elements' },
  { key: 'sets',     label: 'Sets' },
];

// CORE_NODES is imported from components/concept/CoreNodeViews (shared with the Tapestry page).

const INTEGRATION_TYPES = [
  { key: 'enumerations', label: 'Enumerations', icon: '🔢' },
  { key: 'elements',     label: 'Elements',     icon: '📦' },
  { key: 'subsets',      label: 'Subsets',       icon: '🔀' },
  { key: 'graph',        label: 'Integration Graph', icon: '🕸️', noCount: true },
];

export default function FirmwareExplorer() {
  const [manifest, setManifest] = useState(null);
  const [versions, setVersions] = useState(null);
  const [activeDir, setActiveDir] = useState(null);
  const [installStatus, setInstallStatus] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [selectedNode, setSelectedNode] = useState('overview');
  const [conceptData, setConceptData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState(null);
  const [error, setError] = useState(null);
  const [constraintsReady, setConstraintsReady] = useState(false);

  // Integration explorer state
  const [integrationMode, setIntegrationMode] = useState(null); // 'enumerations' | 'elements' | 'subsets' | null
  const [selectedIntegrationItem, setSelectedIntegrationItem] = useState(null); // key into the selected category

  // Load everything on mount
  useEffect(() => {
    Promise.all([
      fetchFirmwareManifest().catch(e => ({ error: e.message })),
      fetchFirmwareVersions().catch(e => ({ error: e.message })),
      fetchInstallStatus().catch(e => ({ error: e.message })),
      fetch('/api/status/neo4j-constraints').then(r => r.json()).catch(e => ({ error: e.message })),
    ]).then(([man, ver, status, constraints]) => {
      if (!man.error) {
        setManifest(man);
        if (man.concepts?.length > 0) setSelectedSlug(man.concepts[0].slug);
      }
      if (!ver.error) {
        setVersions(ver.versions);
        setActiveDir(ver.activeDir);
      }
      if (!status.error) setInstallStatus(status);
      setConstraintsReady(constraints?.constraintsTimestamp > 0);
    }).finally(() => setLoading(false));
  }, []);

  // Load concept data when selection changes
  const loadConcept = useCallback((slug) => {
    if (!slug) return;
    setConceptLoading(true);
    fetchFirmwareConcept(slug)
      .then(data => { setConceptData(data); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setConceptLoading(false));
  }, []);

  useEffect(() => {
    if (selectedSlug) loadConcept(selectedSlug);
  }, [selectedSlug, loadConcept]);

  // Selecting an integration clears concept selection and vice versa
  function selectIntegration(type) {
    setIntegrationMode(type);
    setSelectedIntegrationItem(null);
    setSelectedSlug(null);
    setConceptData(null);
  }

  function selectConcept(slug) {
    setSelectedSlug(slug);
    setIntegrationMode(null);
    setSelectedIntegrationItem(null);
  }

  // Flatten manifest integration sections into per-pair items
  // Build slug → pluralSlug map from manifest concepts
  const slugToPlural = useMemo(() => {
    if (!manifest?.concepts) return {};
    const map = {};
    for (const c of manifest.concepts) {
      map[c.slug] = c.pluralSlug || c.slug + 's';
    }
    return map;
  }, [manifest]);

  function getIntegrationItems(type) {
    if (!manifest) return [];
    // Map manifest key: "sets" in manifest corresponds to "subsets" integration type
    const manifestKey = type === 'subsets' ? 'sets' : type;
    const section = manifest[manifestKey];
    if (!section) return [];

    // Build direct items
    const items = [];
    for (const [categorySlug, categoryDef] of Object.entries(section)) {
      const nodes = categoryDef['existing-nodes'] || categoryDef['existing-sets'] || [];
      for (const node of nodes) {
        // For subsets, display both parent and child as plural slugs
        const childDisplay = type === 'subsets'
          ? (slugToPlural[node.concept] || node.concept + 's')
          : node.concept;
        items.push({
          key: `${categorySlug}::${node.concept}`,
          categorySlug,       // already plural (category key)
          concept: node.concept, // singular (for lookups)
          childDisplay,        // plural for subsets, singular for others
          direct: true,
          ...node,
        });
      }
    }

    // For subsets, compute transitive closure using pluralSlug → category key mapping
    if (type === 'subsets') {
      // Build parent (categorySlug, plural) → children (concept slug, singular) map
      const childrenOf = {};
      for (const item of items) {
        if (!childrenOf[item.categorySlug]) childrenOf[item.categorySlug] = [];
        childrenOf[item.categorySlug].push(item.concept);
      }

      // Build singular concept slug → plural category key map
      // e.g., "graph" → "graphs", "set" → "sets", "property" → "properties"
      const conceptToCategory = {};
      const allCategoryKeys = new Set(Object.keys(childrenOf));
      for (const c of (manifest.concepts || [])) {
        const plural = slugToPlural[c.slug];
        if (plural && allCategoryKeys.has(plural)) {
          conceptToCategory[c.slug] = plural;
        }
      }

      // Compute transitive closure
      const added = new Set(items.map(i => i.key));

      function addDescendants(ancestor, childSlug, via) {
        const childAsCat = conceptToCategory[childSlug];
        if (!childAsCat) return;
        const grandchildren = childrenOf[childAsCat] || [];
        for (const gc of grandchildren) {
          const key = `${ancestor}::${gc}`;
          if (!added.has(key)) {
            added.add(key);
            items.push({
              key,
              categorySlug: ancestor,
              concept: gc,
              childDisplay: slugToPlural[gc] || gc + 's',
              direct: false,
              via: slugToPlural[childSlug] || childSlug,
            });
          }
          // Recurse deeper
          addDescendants(ancestor, gc, childSlug);
        }
      }

      const directItems = [...items];
      for (const item of directItems) {
        addDescendants(item.categorySlug, item.concept, item.concept);
      }
    }

    return items;
  }

  async function handleInstall() {
    if (!confirm('Install firmware? This will create all firmware concepts, elements, and relationship types in the knowledge graph.')) return;
    setInstalling(true);
    setInstallResult(null);
    setError(null);
    try {
      const result = await installFirmware();
      setInstallResult(result);
      // Refresh install status
      const status = await fetchInstallStatus();
      setInstallStatus(status);
    } catch (e) {
      setError(e.message);
    } finally {
      setInstalling(false);
    }
  }

  if (loading) return <div className="loading">Loading firmware…</div>;

  return (
    <div className="firmware-explorer">
      {/* ── Install Status Banner ── */}
      <InstallStatusBanner
        installStatus={installStatus}
        versions={versions}
        activeDir={activeDir}
        manifest={manifest}
        installing={installing}
        onInstall={handleInstall}
        constraintsReady={constraintsReady}
      />

      {/* Install result */}
      {installResult && (
        <div style={{
          padding: '0.75rem 1rem', margin: '0.75rem 0', borderRadius: '8px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
        }}>
          <strong style={{ color: '#22c55e' }}>✅ Firmware installed!</strong>
          {installResult.pass1 && (
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '0.3rem' }}>
              Pass 1: {Object.keys(installResult.pass1.results || {}).length} concepts created,
              {' '}{installResult.pass1.errors?.length || 0} errors
            </div>
          )}
          {installResult.pass2 && (
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              Pass 2: {installResult.pass2.updated?.length || 0} schemas enriched,
              {' '}{installResult.pass2.errors?.length || 0} errors
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.75rem 1rem', margin: '0.75rem 0', borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
        }}>
          ❌ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>dismiss</button>
        </div>
      )}

      {/* ── Manifest Preview ── */}
      {manifest && (
        <>
          <div className="firmware-header">
            <h3>🔧 Firmware Explorer</h3>
            <span className="firmware-version">
              v{manifest.version} · {manifest.concepts.length} concepts · {manifest.relationshipTypes?.length || 0} relationship types
            </span>
          </div>

          <div className="firmware-layout">
            {/* Left: concept list */}
            <div className="firmware-sidebar">
              <div className="firmware-sidebar-header">
                <select
                  className="firmware-category-select"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All ({manifest.concepts.length})</option>
                  {manifest.categories?.map(cat => {
                    const count = manifest.concepts.filter(c => c.categories.includes(cat)).length;
                    return (
                      <option key={cat} value={cat}>
                        {cat} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
              {manifest.concepts
                .filter(c => selectedCategory === 'all' || c.categories.includes(selectedCategory))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(c => (
                  <button
                    key={c.slug}
                    className={`firmware-concept-btn ${selectedSlug === c.slug && !integrationMode ? 'active' : ''}`}
                    onClick={() => selectConcept(c.slug)}
                    title={c.description}
                  >
                    {c.name}
                    {installStatus && !installStatus.installed && installStatus.installedSlugs?.includes(c.slug) && (
                      <span style={{ marginLeft: '0.3rem', fontSize: '0.7rem', opacity: 0.6 }}>✅</span>
                    )}
                  </button>
                ))}

              {/* ── Integration Types ── */}
              <div className="firmware-sidebar-divider">Integrations</div>
              {INTEGRATION_TYPES.map(t => {
                let countLabel = '';
                if (!t.noCount) {
                  const manifestKey = t.key === 'subsets' ? 'sets' : t.key;
                  const section = manifest[manifestKey] || {};
                  const count = Object.values(section).reduce((sum, cat) => {
                    const nodes = cat['existing-nodes'] || cat['existing-sets'] || [];
                    return sum + nodes.length;
                  }, 0);
                  countLabel = ` (${count})`;
                }
                return (
                  <button
                    key={t.key}
                    className={`firmware-concept-btn ${integrationMode === t.key ? 'active' : ''}`}
                    onClick={() => selectIntegration(t.key)}
                  >
                    {t.icon} {t.label}{countLabel}
                  </button>
                );
              })}
            </div>

            {/* Right: content area */}
            <div className="firmware-content">
              {integrationMode === 'graph' ? (
                /* ── Integration Graph ── */
                <IntegrationGraph manifest={manifest} slugToPlural={slugToPlural} />
              ) : integrationMode ? (
                /* ── Integration content ── */
                <IntegrationPanel
                  type={integrationMode}
                  items={getIntegrationItems(integrationMode)}
                  selectedItem={selectedIntegrationItem}
                  onSelectItem={setSelectedIntegrationItem}
                  onBack={() => setSelectedIntegrationItem(null)}
                  manifest={manifest}
                />
              ) : (
                <>
                  {/* Top: node selector tabs (core class-thread nodes + membership views) */}
                  <div className="firmware-node-tabs">
                    {CORE_NODES.map(n => (
                      <button
                        key={n.key}
                        className={`firmware-node-tab ${selectedNode === n.key ? 'active' : ''}`}
                        onClick={() => setSelectedNode(n.key)}
                      >
                        {n.label}
                      </button>
                    ))}
                    <span className="firmware-node-tab-divider" aria-hidden="true" />
                    {MEMBER_VIEWS.map(n => (
                      <button
                        key={n.key}
                        className={`firmware-node-tab ${selectedNode === n.key ? 'active' : ''}`}
                        onClick={() => setSelectedNode(n.key)}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>

                  {/* Content */}
                  <div className="firmware-node-content">
                    {conceptLoading ? (
                      <div className="loading">Loading…</div>
                    ) : !conceptData ? (
                      <div className="empty">Select a concept</div>
                    ) : !conceptData.installed ? (
                      <div className="firmware-not-installed">
                        <h3>⚠️ Not Installed</h3>
                        <p>
                          <strong>{conceptData.name}</strong> is defined in firmware but not yet installed in the graph.
                        </p>
                        {!installStatus?.installed && (
                          <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                            Use the <strong>Install Firmware</strong> button above to create all firmware concepts.
                          </p>
                        )}
                      </div>
                    ) : selectedNode === 'overview' ? (
                      <FirmwareOverview data={conceptData} />
                    ) : selectedNode === 'elements' || selectedNode === 'sets' ? (
                      <ConceptMembersView
                        key={`${conceptData.nodes?.header?.uuid}:${selectedNode}`}
                        conceptData={conceptData}
                        kind={selectedNode}
                      />
                    ) : (
                      <FirmwareNodeJson data={conceptData} nodeKey={selectedNode} />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Install Status Banner ── */

function InstallStatusBanner({ installStatus, versions, activeDir, manifest, installing, onInstall, constraintsReady }) {
  const isInstalled = installStatus?.installed;
  const isPartial = installStatus?.partial;

  return (
    <div style={{
      padding: '1rem 1.25rem', marginBottom: '1rem', borderRadius: '8px',
      border: `1px solid ${isInstalled ? 'rgba(34, 197, 94, 0.3)' : isPartial ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
      backgroundColor: isInstalled ? 'rgba(34, 197, 94, 0.05)' : isPartial ? 'rgba(245, 158, 11, 0.05)' : 'rgba(239, 68, 68, 0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>
              {isInstalled ? '✅' : isPartial ? '⚠️' : '📦'}
            </span>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {isInstalled ? 'Firmware Installed' : isPartial ? 'Firmware Partially Installed' : 'Firmware Not Installed'}
            </h3>
          </div>

          {installStatus && (
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              {isInstalled ? (
                <span>All {installStatus.totalCount} concepts are installed (v{installStatus.activeVersion}).</span>
              ) : isPartial ? (
                <span>
                  {installStatus.installedCount} of {installStatus.totalCount} concepts installed.
                  Missing: {installStatus.missing.slice(0, 5).join(', ')}
                  {installStatus.missing.length > 5 ? ` +${installStatus.missing.length - 5} more` : ''}
                </span>
              ) : (
                <span>No firmware concepts found in the knowledge graph. Install firmware to create the foundational meta-concepts.</span>
              )}
            </div>
          )}

          {/* Available versions */}
          {versions && versions.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.7 }}>
                Available Versions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {versions.map(v => (
                  <div key={v.dir} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.3rem 0.5rem', borderRadius: '4px',
                    backgroundColor: v.dir === activeDir ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: v.dir === activeDir ? 600 : 400 }}>
                      v{v.version}
                    </span>
                    {v.dir === activeDir && (
                      <span style={{
                        fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8',
                      }}>
                        active
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                      {v.date} · {v.conceptCount} concepts · {v.relationshipTypeCount} rel types
                    </span>
                    {v.description && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.5, fontStyle: 'italic' }}>
                        — {v.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manifest summary for active version */}
          {manifest && !isInstalled && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.7 }}>
                Active Firmware Summary (v{manifest.version})
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', opacity: 0.7 }}>
                <span>🧩 {manifest.concepts.length} concepts</span>
                <span>🔗 {manifest.relationshipTypes?.length || 0} relationship types</span>
                <span>📂 {Object.keys(manifest.elements || {}).length} element categories</span>
              </div>
              {manifest.relationshipTypes && manifest.relationshipTypes.length > 0 && (
                <details style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  <summary style={{ cursor: 'pointer', opacity: 0.7 }}>
                    Relationship Types ({manifest.relationshipTypes.length})
                  </summary>
                  <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {manifest.relationshipTypes.map(rt => (
                      <span key={rt.slug} style={{
                        fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
                      }} title={rt.description || ''}>
                        {rt.alias || rt.slug}
                      </span>
                    ))}
                  </div>
                </details>
              )}
              {manifest.concepts && manifest.concepts.length > 0 && (
                <details style={{ marginTop: '0.3rem', fontSize: '0.8rem' }}>
                  <summary style={{ cursor: 'pointer', opacity: 0.7 }}>
                    Concepts ({manifest.concepts.length})
                  </summary>
                  <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {manifest.concepts.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                      <span key={c.slug} style={{
                        fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px',
                        backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)',
                      }} title={c.description || ''}>
                        {c.name}
                        {c.categories?.length > 0 && (
                          <span style={{ opacity: 0.5 }}> ({c.categories.join(', ')})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Install button */}
        {!isInstalled && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
            <button
              className="btn-primary"
              onClick={onInstall}
              disabled={installing || !constraintsReady}
              style={{
                padding: '0.6rem 1.2rem', fontSize: '0.9rem', whiteSpace: 'nowrap',
                opacity: (installing || !constraintsReady) ? 0.4 : 1,
                cursor: !constraintsReady ? 'not-allowed' : 'pointer',
              }}
            >
              {installing ? '⏳ Installing…' : isPartial ? '🔧 Complete Install' : '🚀 Install Firmware'}
            </button>
            {!constraintsReady && (
              <span style={{ fontSize: '0.75rem', color: 'rgba(239, 68, 68, 0.9)', textAlign: 'right' }}>
                ⚠️ Neo4j constraints &amp; indexes must be set up first
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Firmware Overview → ConceptOverview, imported from components/concept/CoreNodeViews ── */

/* ── Integration Panel ── */

function IntegrationPanel({ type, items, selectedItem, onSelectItem, onBack, manifest }) {
  const typeInfo = INTEGRATION_TYPES.find(t => t.key === type);
  const [groupBy, setGroupBy] = useState('none'); // 'none' | 'parent' | 'child'

  const parentLabel = type === 'enumerations' ? 'Source' : 'Parent';
  const childLabel = type === 'enumerations' ? 'Target' : 'Child';
  const colCount = type === 'enumerations' ? 4 : 2;

  // Toggle: click same row to close, different row to switch
  function handleRowClick(key) {
    onSelectItem(selectedItem === key ? null : key);
  }

  // Sort items by group key, then by the other column
  function getSortedItems() {
    if (groupBy === 'none') return items;
    const groupKey = groupBy === 'parent' ? 'categorySlug' : (type === 'subsets' ? 'childDisplay' : 'concept');
    const sorted = [...items].sort((a, b) => {
      const ga = (a[groupKey] || a.concept).toLowerCase();
      const gb = (b[groupKey] || b.concept).toLowerCase();
      if (ga !== gb) return ga.localeCompare(gb);
      const sa = groupBy === 'parent' ? (a.childDisplay || a.concept) : a.categorySlug;
      const sb = groupBy === 'parent' ? (b.childDisplay || b.concept) : b.categorySlug;
      return sa.toLowerCase().localeCompare(sb.toLowerCase());
    });
    return sorted;
  }

  const sortedItems = getSortedItems();

  // Render rows — when grouping, use rowSpan but skip it for groups that contain an expanded detail
  function renderRows() {
    const rows = [];
    const groupKey = groupBy === 'parent' ? 'categorySlug' : (type === 'subsets' ? 'childDisplay' : 'concept');

    for (let index = 0; index < sortedItems.length; index++) {
      const item = sortedItems[index];
      const isExpanded = selectedItem === item.key;
      const currentGroup = item[groupKey] || item.concept;
      const prevGroup = index > 0 ? (sortedItems[index - 1][groupKey] || sortedItems[index - 1].concept) : null;
      const isFirstInGroup = groupBy === 'none' || currentGroup !== prevGroup;

      // Count group size for rowSpan, but only if no item in the group is expanded
      let groupCount = 0;
      let groupHasExpanded = false;
      if (isFirstInGroup && groupBy !== 'none') {
        for (let i = index; i < sortedItems.length; i++) {
          if ((sortedItems[i][groupKey] || sortedItems[i].concept) === currentGroup) {
            groupCount++;
            if (selectedItem === sortedItems[i].key) groupHasExpanded = true;
          } else break;
        }
      }
      // Disable rowSpan if any item in the group is expanded (detail row breaks the span)
      const useRowSpan = isFirstInGroup && groupBy !== 'none' && groupCount > 1 && !groupHasExpanded;

      const parentCell = isFirstInGroup || groupBy !== 'parent' || groupHasExpanded ? (
        <td
          className={groupBy === 'parent' && isFirstInGroup && !groupHasExpanded ? 'firmware-group-cell' : ''}
          {...(groupBy === 'parent' && useRowSpan ? { rowSpan: groupCount } : {})}
        >
          <strong>{item.categorySlug}</strong>
        </td>
      ) : null;

      // When group has expanded item, show parent cell on every row except when rowSpan is active
      const showParent = groupBy !== 'parent' || isFirstInGroup || groupHasExpanded;

      const childContent = (
        <>
          {item.childDisplay || item.concept}
          {type === 'subsets' && !item.direct && (
            <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', opacity: 0.5 }}>
              (via {item.via})
            </span>
          )}
        </>
      );

      const showChild = groupBy !== 'child' || isFirstInGroup || groupHasExpanded;
      const childCell = showChild ? (
        <td
          className={groupBy === 'child' && isFirstInGroup && !groupHasExpanded ? 'firmware-group-cell' : ''}
          {...(groupBy === 'child' && useRowSpan ? { rowSpan: groupCount } : {})}
        >
          {childContent}
        </td>
      ) : null;

      rows.push(
        <tr
          key={item.key}
          onClick={() => handleRowClick(item.key)}
          style={{ cursor: 'pointer' }}
          className={[
            'clickable-row',
            isFirstInGroup && groupBy !== 'none' ? 'firmware-group-first-row' : '',
            isExpanded ? 'firmware-expanded-row' : '',
          ].filter(Boolean).join(' ')}
        >
          {showParent && parentCell}
          {childCell}
          {type === 'enumerations' && <td><code>{item['destination-path']}</code></td>}
          {type === 'enumerations' && (
            <td>{item['enforce-wordType-conditionals'] ? '✅ biconditional' : '—'}</td>
          )}
        </tr>
      );

      // Expanded detail row
      if (isExpanded) {
        rows.push(
          <tr key={item.key + '::detail'} className="firmware-detail-row">
            <td colSpan={colCount}>
              <IntegrationDetail type={type} item={item} manifest={manifest} />
            </td>
          </tr>
        );
      }
    }

    return rows;
  }

  // List view
  return (
    <div className="firmware-node-content">
      <h2>{typeInfo.icon} {typeInfo.label}</h2>
      <p style={{ opacity: 0.7, marginBottom: '0.75rem' }}>
        {type === 'enumerations' && 'Enumerations inject allowed values from one concept\'s elements into another concept\'s JSON Schema.'}
        {type === 'elements' && 'Element integrations wire a concept\'s header as a pre-populated element of another concept\'s superset.'}
        {type === 'subsets' && 'Subset integrations wire a concept\'s superset as a subset of another concept\'s superset.'}
      </p>

      {/* Grouping toggle */}
      <div className="firmware-group-toggle">
        <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '0.5rem' }}>Group by:</span>
        {[
          { key: 'none', label: 'None' },
          { key: 'parent', label: parentLabel },
          { key: 'child', label: childLabel },
        ].map(opt => (
          <button
            key={opt.key}
            className={`firmware-group-btn ${groupBy === opt.key ? 'active' : ''}`}
            onClick={() => setGroupBy(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="empty">No {typeInfo.label.toLowerCase()} defined in firmware.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{parentLabel}</th>
              <th>{childLabel}</th>
              {type === 'enumerations' && <th>Destination Path</th>}
              {type === 'enumerations' && <th>Conditionals</th>}
            </tr>
          </thead>
          <tbody>
            {renderRows()}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Integration Detail ── */

function IntegrationDetail({ type, item, manifest }) {
  if (type === 'enumerations') {
    return (
      <div className="firmware-overview">
        <h2>Enumeration: {item.categorySlug} → {item.concept}</h2>
        <table className="data-table" style={{ marginTop: '1rem' }}>
          <tbody>
            <tr><td><strong>Source Concept</strong></td><td>{item.categorySlug}</td></tr>
            <tr><td><strong>Target Concept</strong></td><td>{item.concept}</td></tr>
            <tr><td><strong>Source Path</strong></td><td><code>{item['source-path']}</code></td></tr>
            <tr><td><strong>Destination Path</strong></td><td><code>{item['destination-path']}</code></td></tr>
            <tr>
              <td><strong>Enforce wordType Conditionals</strong></td>
              <td>{item['enforce-wordType-conditionals'] ? '✅ Yes — biconditional if/then blocks' : '❌ No — enum values only'}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: '1.5rem' }}>
          <h3>How It Works</h3>
          <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
            The elements of <strong>{item.categorySlug}</strong> provide the allowed values.
            Each element's <code>{item['source-path']}</code> is read and injected as an
            <code> enum</code> constraint on the <code>{item['destination-path']}</code> field
            in the <strong>{item.concept}</strong> JSON Schema.
          </p>
          {item['enforce-wordType-conditionals'] && (
            <p style={{ opacity: 0.8, lineHeight: 1.6, marginTop: '0.5rem' }}>
              Because <strong>wordType conditionals</strong> are enabled, <code>apply-enumerations</code> also
              generates biconditional <code>allOf</code> entries: if the property equals a value, then
              <code> word.wordTypes</code> must contain it, and vice versa.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (type === 'elements') {
    return (
      <div className="firmware-overview">
        <h2>Element: {item.concept} ∈ {item.categorySlug}</h2>
        <table className="data-table" style={{ marginTop: '1rem' }}>
          <tbody>
            <tr><td><strong>Parent Concept</strong></td><td>{item.categorySlug}</td></tr>
            <tr><td><strong>Child Concept</strong></td><td>{item.concept}</td></tr>
            <tr><td><strong>Core Node Type</strong></td><td><code>{item['core-node-type']}</code></td></tr>
          </tbody>
        </table>
        <div style={{ marginTop: '1.5rem' }}>
          <h3>How It Works</h3>
          <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
            The <strong>{item['core-node-type']}</strong> of <strong>{item.concept}</strong> is
            wired as an element of the <strong>{item.categorySlug}</strong> superset via
            a <code>HAS_ELEMENT</code> relationship.
          </p>
        </div>
      </div>
    );
  }

  if (type === 'subsets') {
    const childPlural = item.childDisplay || item.concept;
    return (
      <div className="firmware-overview">
        <h2>Subset: {childPlural} ⊂ {item.categorySlug}</h2>
        <table className="data-table" style={{ marginTop: '1rem' }}>
          <tbody>
            <tr><td><strong>Parent</strong></td><td>{item.categorySlug}</td></tr>
            <tr><td><strong>Child</strong></td><td>{childPlural}</td></tr>
            <tr>
              <td><strong>Relationship</strong></td>
              <td>
                {item.direct ? (
                  <span>Direct</span>
                ) : (
                  <span>Indirect <span style={{ opacity: 0.6 }}>(via {item.via})</span></span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: '1.5rem' }}>
          <h3>How It Works</h3>
          <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
            {item.direct ? (
              <>
                The superset of <strong>{childPlural}</strong> is wired as a direct subset of
                the <strong>{item.categorySlug}</strong> superset via
                an <code>IS_A_SUPERSET_OF</code> relationship.
              </>
            ) : (
              <>
                The superset of <strong>{childPlural}</strong> is an indirect subset of
                the <strong>{item.categorySlug}</strong> superset, reached
                via <strong>{item.via}</strong>.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return <div className="empty">Unknown integration type.</div>;
}

/* ── Firmware Node JSON → ConceptNodeJson, imported from components/concept/CoreNodeViews ── */

/* ══════════════════════════════════════════════════════════
   Integration Graph — vis-network visualization of all
   firmware integrations (subsets, elements, enumerations)
   ══════════════════════════════════════════════════════════ */

const GRAPH_COLORS = {
  superset:      { bg: '#8b5cf6', border: '#a78bfa', font: '#fff' },
  conceptHeader: { bg: '#6366f1', border: '#818cf8', font: '#fff' },
  property:      { bg: '#f59e0b', border: '#fbbf24', font: '#fff' },
};

const GRAPH_EDGE_COLORS = {
  IS_THE_CONCEPT_FOR:  '#818cf8',
  IS_A_SUPERSET_OF:    '#38bdf8',
  HAS_ELEMENT:         '#4ade80',
  ENUMERATES:          '#f59e0b',
  BELONGS_TO_CONCEPT:  '#9ca3af',
};

function IntegrationGraph({ manifest, slugToPlural }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  // Build graph data from manifest
  const graphData = useMemo(() => {
    if (!manifest) return null;

    const nodes = new Map(); // id → { id, label, type, concept }
    const edges = [];        // { from, to, relType }

    // Helper: ensure a Superset node exists for a concept
    function ensureSuperset(conceptSlug) {
      const id = `superset::${conceptSlug}`;
      if (!nodes.has(id)) {
        const plural = slugToPlural[conceptSlug] || conceptSlug + 's';
        nodes.set(id, { id, label: plural, type: 'superset', concept: conceptSlug });
      }
      return id;
    }

    // Helper: ensure a ConceptHeader node exists
    function ensureConceptHeader(conceptSlug) {
      const id = `header::${conceptSlug}`;
      if (!nodes.has(id)) {
        nodes.set(id, { id, label: conceptSlug, type: 'conceptHeader', concept: conceptSlug });
      }
      return id;
    }

    // Helper: ensure IS_THE_CONCEPT_FOR edge between header and superset of same concept
    function ensureConceptEdge(conceptSlug) {
      const headerId = `header::${conceptSlug}`;
      const supersetId = `superset::${conceptSlug}`;
      if (nodes.has(headerId) && nodes.has(supersetId)) {
        const key = `${headerId}->${supersetId}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from: headerId, to: supersetId, relType: 'IS_THE_CONCEPT_FOR' });
        }
      }
    }

    const edgeKeys = new Set();

    // 1. Subsets: Superset → Superset via IS_A_SUPERSET_OF
    const setsSection = manifest.sets || {};
    for (const [parentSlug, catDef] of Object.entries(setsSection)) {
      const parentId = ensureSuperset(parentSlug);
      for (const node of (catDef['existing-sets'] || [])) {
        const childId = ensureSuperset(node.concept);
        const key = `${parentId}->${childId}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from: parentId, to: childId, relType: 'IS_A_SUPERSET_OF' });
        }
      }
    }

    // 2. Elements: Superset → ConceptHeader via HAS_ELEMENT
    const elemSection = manifest.elements || {};
    for (const [parentSlug, catDef] of Object.entries(elemSection)) {
      const parentId = ensureSuperset(parentSlug);
      for (const node of (catDef['existing-nodes'] || [])) {
        const childId = ensureConceptHeader(node.concept);
        const key = `${parentId}->${childId}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from: parentId, to: childId, relType: 'HAS_ELEMENT' });
        }
      }
    }

    // 3. Enumerations: Superset → Property (represented as a special node)
    const enumSection = manifest.enumerations || {};
    for (const [sourceSlug, catDef] of Object.entries(enumSection)) {
      const sourceId = ensureSuperset(sourceSlug);
      for (const node of (catDef['existing-nodes'] || [])) {
        // Property node: labeled as "concept.destPath"
        const propId = `property::${node.concept}::${node['destination-path']}`;
        if (!nodes.has(propId)) {
          nodes.set(propId, {
            id: propId,
            label: `${node.concept}\n.${node['destination-path']}`,
            type: 'property',
            concept: node.concept,
            destPath: node['destination-path'],
          });
        }
        const key = `${sourceId}->${propId}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from: sourceId, to: propId, relType: 'ENUMERATES' });
        }
      }
    }

    // 4. BELONGS_TO_CONCEPT: Property → ConceptHeader (virtual, derived)
    // Each property node belongs to a target concept; connect them directly.
    for (const [, node] of nodes) {
      if (node.type === 'property') {
        const headerId = ensureConceptHeader(node.concept);
        const key = `${node.id}->${headerId}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from: node.id, to: headerId, relType: 'BELONGS_TO_CONCEPT' });
        }
      }
    }

    // 5. Add IS_THE_CONCEPT_FOR edges where both header and superset exist for same concept
    const conceptsWithSuperset = new Set();
    const conceptsWithHeader = new Set();
    for (const [, node] of nodes) {
      if (node.type === 'superset') conceptsWithSuperset.add(node.concept);
      if (node.type === 'conceptHeader') conceptsWithHeader.add(node.concept);
    }
    for (const slug of conceptsWithSuperset) {
      if (conceptsWithHeader.has(slug)) {
        ensureConceptEdge(slug);
      }
    }

    return { nodes: [...nodes.values()], edges };
  }, [manifest, slugToPlural]);

  // Build vis-network
  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    import('vis-network/standalone').then(({ Network, DataSet }) => {
      const visNodes = new DataSet();
      const visEdges = new DataSet();

      for (const node of graphData.nodes) {
        const colors = GRAPH_COLORS[node.type] || GRAPH_COLORS.superset;
        const shape = node.type === 'conceptHeader' ? 'diamond'
                    : node.type === 'superset' ? 'triangle'
                    : 'box'; // property
        const size = node.type === 'superset' ? 20
                   : node.type === 'conceptHeader' ? 16
                   : 14;

        visNodes.add({
          id: node.id,
          label: node.label,
          shape,
          size,
          color: {
            background: colors.bg,
            border: colors.border,
            highlight: { background: colors.border, border: colors.bg },
          },
          font: { color: colors.font, size: 11, face: 'system-ui', multi: 'md' },
          borderWidth: node.type === 'superset' ? 2 : 1,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 4, x: 2, y: 2 },
          _data: node,
        });
      }

      for (const edge of graphData.edges) {
        const color = GRAPH_EDGE_COLORS[edge.relType] || '#6e7681';
        const shortLabel = edge.relType === 'IS_THE_CONCEPT_FOR' ? 'CONCEPT_FOR'
                         : edge.relType === 'IS_A_SUPERSET_OF'   ? 'SUPERSET_OF'
                         : edge.relType === 'BELONGS_TO_CONCEPT'  ? 'BELONGS_TO'
                         : edge.relType;
        // Dash patterns: ENUMERATES = dashed, BELONGS_TO_CONCEPT = dotted, others = solid
        const dashes = edge.relType === 'ENUMERATES'         ? [5, 5]
                     : edge.relType === 'BELONGS_TO_CONCEPT' ? [2, 4]
                     : false;
        visEdges.add({
          from: edge.from,
          to: edge.to,
          label: shortLabel,
          color: { color, highlight: '#e6edf3' },
          font: { color: '#8b949e', size: 8, strokeWidth: 0, face: 'system-ui' },
          arrows: 'to',
          width: edge.relType === 'BELONGS_TO_CONCEPT' ? 1 : edge.relType === 'ENUMERATES' ? 2 : 1.5,
          dashes,
          smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.3 },
        });
      }

      const options = {
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -120,
            centralGravity: 0.008,
            springLength: 160,
            springConstant: 0.04,
            damping: 0.4,
            avoidOverlap: 0.8,
          },
          stabilization: { iterations: 300, updateInterval: 25 },
        },
        layout: { improvedLayout: true },
        edges: { arrows: { to: { scaleFactor: 0.6 } }, font: { align: 'middle' } },
        interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true },
      };

      const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
      networkRef.current = network;

      network.on('stabilized', () => {
        network.setOptions({ physics: { enabled: false } });
      });

      network.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = visNodes.get(nodeId);
          if (node?._data) {
            setTooltip({
              label: node._data.label,
              type: node._data.type,
              concept: node._data.concept,
              x: params.event.center.x,
              y: params.event.center.y,
            });
          }
        } else {
          setTooltip(null);
        }
      });

      return () => network.destroy();
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [graphData]);

  if (!manifest) return <div className="empty">Loading manifest…</div>;

  const nodeCount = graphData?.nodes.length || 0;
  const edgeCount = graphData?.edges.length || 0;

  return (
    <div className="firmware-node-content">
      <h2>🕸️ Integration Graph</h2>
      <p style={{ opacity: 0.7, marginBottom: '0.75rem' }}>
        Visualization of all firmware integrations — subsets, elements, and enumerations — as a graph of Neo4j nodes and relationships.
      </p>

      {/* Legend */}
      <div className="firmware-graph-legend">
        <span className="firmware-graph-legend-item">
          <span className="firmware-graph-dot" style={{ background: GRAPH_COLORS.superset.bg }} />
          Superset (▲)
        </span>
        <span className="firmware-graph-legend-item">
          <span className="firmware-graph-dot" style={{ background: GRAPH_COLORS.conceptHeader.bg }} />
          Concept Header (◆)
        </span>
        <span className="firmware-graph-legend-item">
          <span className="firmware-graph-dot" style={{ background: GRAPH_COLORS.property.bg }} />
          Property (■)
        </span>
        <span style={{ opacity: 0.5, fontSize: '0.8rem', marginLeft: '0.5rem' }}>
          {nodeCount} nodes · {edgeCount} edges
        </span>
      </div>

      {/* Edge legend */}
      <div className="firmware-graph-legend" style={{ marginTop: '0.25rem' }}>
        {[
          { color: GRAPH_EDGE_COLORS.IS_A_SUPERSET_OF, label: 'SUPERSET_OF', style: 'solid' },
          { color: GRAPH_EDGE_COLORS.HAS_ELEMENT, label: 'HAS_ELEMENT', style: 'solid' },
          { color: GRAPH_EDGE_COLORS.IS_THE_CONCEPT_FOR, label: 'CONCEPT_FOR', style: 'solid' },
          { color: GRAPH_EDGE_COLORS.ENUMERATES, label: 'ENUMERATES', style: 'dashed' },
          { color: GRAPH_EDGE_COLORS.BELONGS_TO_CONCEPT, label: 'BELONGS_TO (virtual)', style: 'dotted' },
        ].map(e => (
          <span key={e.label} className="firmware-graph-legend-item">
            <span
              className="firmware-graph-line"
              style={{
                background: e.style === 'solid' ? e.color : 'transparent',
                borderBottom: e.style !== 'solid' ? `2px ${e.style} ${e.color}` : 'none',
              }}
            />
            {e.label}
          </span>
        ))}
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        className="firmware-graph-container"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="firmware-graph-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <strong>{tooltip.label}</strong>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.2rem' }}>
            {tooltip.type} · {tooltip.concept}
          </div>
        </div>
      )}
    </div>
  );
}
