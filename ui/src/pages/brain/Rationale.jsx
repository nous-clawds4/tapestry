import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useBrainGoals from '../../hooks/useBrainGoals';
import useServesPath from '../../hooks/useServesPath';

/**
 * Rationale — early slices of the page that will trace SERVES paths between
 * goals in neo4j. Slice 1: pick the two endpoints — parent and child panels,
 * each a typeahead over the owner's goals, functionally mirroring the
 * Tapestry add-concept affordance (search the preloaded list, pick to
 * select — AddConceptToTapestry.jsx). Slice 2: the main view underneath,
 * reusing the Firmware Explorer's two-column shell (firmware-layout classes):
 * a thin left rail with name-only cards for the selected parent and child,
 * and a wide right panel where the connection will eventually render.
 * Slice 3: the left rail is the IN SERVICE panel — one shortest directed
 * SERVES path from child to parent (useServesPath, mirroring the follows-hops
 * page's paths + re-roll contract), its connecting goals rendered as cards in
 * order between the parent and child. Slice 4: the wide right panel is the
 * detail view of whichever rail card is selected (default: the parent), with
 * a Firmware-Explorer-style tab bar — Overview plus one tab per property of
 * the tapestry-owner-goal JSON Schema, read from the schema node at runtime
 * (never a hardcoded property list — the schema is expected to evolve).
 * Slice 5: a property tab renders the goal's value for that property, read
 * from the element's RAW json section (the /api/brain/goals record is a
 * projection that drops unknown fields — raw json is what stays honest as
 * the schema grows). Missing property → "not available"; arrays list their
 * elements (complex ones stringified); object-typed properties open a nested
 * selection bar from the schema, to a maximum depth of 3 selection levels.
 * Slice 6: "Save goal set" at the rail's foot persists the selected pair as
 * an element of the goal-set concept (POST /api/normalize/create-element,
 * explicit section json). parentGoal/childGoal carry the goals' json SLUGS —
 * the instance-portable goal reference, same convention as the goal record's
 * own `parent` field (ADR second-brain/0003 d2) — never the TA-bound uuid.
 * Owner-gated like the other brain views.
 */

const panelStyle = {
  flex: '1 1 300px',
  minWidth: 0,
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
};

function searchBlob(g) {
  return [g.name, g.slug, g.statement]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function truncate(text, max = 160) {
  if (typeof text !== 'string') return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const cardStyle = {
  margin: '0.5rem',
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '6px',
};

const cardLabelStyle = {
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  marginBottom: '0.25rem',
};

/**
 * Left-rail card: the goal's name only — no description (by design). When the
 * card holds a goal it is selectable: picking it drives the detail view in
 * the wide right panel (active = currently detailed).
 */
function GoalCard({ label, goal, active, onSelect }) {
  const selectable = Boolean(goal && onSelect);
  const style = active
    ? { ...cardStyle, borderColor: 'var(--accent, #6366f1)' }
    : cardStyle;
  return (
    <div
      style={selectable ? { ...style, cursor: 'pointer' } : style}
      aria-label={label ? `${label} goal card` : `${goal?.name ?? 'goal'} card`}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? Boolean(active) : undefined}
      onClick={selectable ? () => onSelect(goal) : undefined}
      onKeyDown={selectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(goal); } } : undefined}
    >
      {label && <div style={cardLabelStyle}>{label}</div>}
      {goal ? (
        <div style={{ fontSize: '0.9rem' }}>{goal.name}</div>
      ) : (
        <div className="brain-muted" style={{ fontSize: '0.85rem' }}>None selected</div>
      )}
    </div>
  );
}

const pathNoteStyle = { margin: '0.5rem', fontSize: '0.85rem' };

/** Follow a property path into the raw json section; undefined = absent. */
function walkValue(section, path) {
  let v = section;
  for (const k of path) {
    if (v === null || typeof v !== 'object') return undefined;
    v = v[k];
  }
  return v;
}

/**
 * Leaf value renderer. Absent → "not available" (a malformed element is a
 * state, not an error). Arrays list each element, stringified when the
 * element is itself an object/array. A raw object here means the schema
 * called it a scalar (or gave it no properties) — stringify rather than hide.
 */
function ValueView({ value }) {
  if (value === undefined) {
    return <p className="brain-muted" style={{ margin: 0 }}>not available</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="brain-muted" style={{ margin: 0 }}>(empty array)</p>;
    }
    return (
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {value.map((el, i) => (
          <li key={i} style={{ marginBottom: '0.25rem', overflowWrap: 'anywhere' }}>
            {el !== null && typeof el === 'object' ? JSON.stringify(el) : String(el)}
          </li>
        ))}
      </ul>
    );
  }
  if (value !== null && typeof value === 'object') {
    return (
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.85rem' }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{String(value)}</p>;
}

/**
 * Property-tab content. Walks the selected path: an object-typed property
 * (per the schema) opens a further selection bar of ITS schema properties —
 * to a maximum of 3 selection levels — and anything else renders its value
 * via ValueView. `tabPath[0]` is the top bar's pick; this renders everything
 * below it.
 */
function PropertyContent({ tabPath, schemaSection, section, onNavigate }) {
  const out = [];
  let props = schemaSection;
  for (let i = 0; i < tabPath.length; i++) {
    const node = props ? props[tabPath[i]] : undefined;
    const nodeProps = (node && node.properties && typeof node.properties === 'object') ? node.properties : null;
    if (nodeProps) {
      if (i + 1 >= 3) {
        out.push(
          <p key="depth" className="brain-muted" style={{ margin: 0 }}>
            Deeper than 3 levels is not supported.
          </p>,
        );
        break;
      }
      out.push(
        <div key={`bar-${i}`} className="firmware-node-tabs" style={{ padding: 0, marginBottom: '0.75rem' }}>
          {Object.keys(nodeProps).map((k) => (
            <button
              key={k}
              type="button"
              className={`firmware-node-tab ${tabPath[i + 1] === k ? 'active' : ''}`}
              onClick={() => onNavigate([...tabPath.slice(0, i + 1), k])}
            >
              {nodeProps[k]?.title || k}
            </button>
          ))}
        </div>,
      );
      if (tabPath[i + 1] === undefined) {
        out.push(<p key="pick" className="brain-muted" style={{ margin: 0 }}>Select a property above.</p>);
        break;
      }
      props = nodeProps;
    } else {
      out.push(<ValueView key="value" value={walkValue(section, tabPath.slice(0, i + 1))} />);
      break;
    }
  }
  return <>{out}</>;
}

/**
 * One picker panel. Unselected: a search box whose non-empty query shows the
 * matching goals (excluding the other panel's pick); choosing one selects it
 * and clears the box. Selected: the goal's name and statement with a Change
 * button that returns to the search box.
 */
function GoalPickerPanel({ label, goals, loading, selected, excludedUuid, onSelect, onClear }) {
  const [filter, setFilter] = useState('');

  const results = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return [];
    return goals.filter((g) => g.uuid !== excludedUuid && searchBlob(g).includes(q));
  }, [goals, filter, excludedUuid]);

  return (
    <section style={panelStyle} aria-label={`${label} goal`}>
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>{label} goal</h2>
      {selected ? (
        <div>
          <p style={{ margin: '0 0 0.25rem' }}><strong>{selected.name}</strong></p>
          {selected.statement && (
            <p className="brain-muted" style={{ margin: '0 0 0.5rem' }}>{truncate(selected.statement)}</p>
          )}
          <button type="button" onClick={() => { setFilter(''); onClear(); }}>Change</button>
        </div>
      ) : (
        <>
          <input
            type="text"
            className="tapestry-concept-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search goals…"
            aria-label={`Search goals for the ${label.toLowerCase()} goal`}
          />
          {filter.trim() && (
            <div className="tapestry-concept-picker" role="listbox" aria-label={`Matching goals for ${label.toLowerCase()}`}>
              {loading ? (
                <p className="placeholder" style={{ margin: '0.25rem' }}>Loading goals…</p>
              ) : results.length === 0 ? (
                <p className="placeholder" style={{ margin: '0.25rem' }}>No goals match “{filter}”.</p>
              ) : (
                results.map((g) => (
                  <button
                    key={g.uuid}
                    type="button"
                    className="tapestry-concept-option"
                    aria-label={`Select ${g.name}`}
                    onClick={() => { setFilter(''); onSelect(g); }}
                  >
                    <span>{g.name}</span>
                    <span className="tapestry-concept-add">Select</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function Rationale() {
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';
  const { goals, loading, error } = useBrainGoals();
  const [parent, setParent] = useState(null);
  const [child, setChild] = useState(null);

  const goalList = Array.isArray(goals) ? goals : [];

  // Pre-load a pair from ?parent=<slug>&child=<slug> (the Goal Sets page's
  // deep link — slugs, the same portable reference the goal-set element
  // stores). Applied once, when the goal list first arrives; after that the
  // user's own picks always win. An unknown slug simply stays unselected.
  const [searchParams] = useSearchParams();
  const preloadDone = useRef(false);
  useEffect(() => {
    if (preloadDone.current || goalList.length === 0) return;
    preloadDone.current = true;
    const bySlug = (slug) => (slug ? goalList.find((g) => g.slug === slug) || null : null);
    const p = bySlug(searchParams.get('parent'));
    const c = bySlug(searchParams.get('child'));
    if (p) setParent(p);
    if (c) setChild(c);
  }, [goalList, searchParams]);

  const {
    paths, truncated, noPath,
    loading: pathLoading, error: pathError,
  } = useServesPath(child?.uuid, parent?.uuid);

  // Which of the equally-short paths is shown. Reset whenever the path set
  // changes (the follows-hops re-roll contract).
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => { setSelectedIndex(0); }, [paths]);

  const reroll = () => {
    if (paths.length <= 1) return;
    let i = selectedIndex;
    while (i === selectedIndex) i = Math.floor(Math.random() * paths.length);
    setSelectedIndex(i);
  };

  // Path nodes run child→parent; the rail renders parent-first, so the
  // connecting cards are the reversed interior of the active path.
  const activePath = paths[selectedIndex] || null;
  const intermediates = activePath && activePath.length > 2
    ? [...activePath].reverse().slice(1, -1)
    : [];

  // ── Detail view (wide right panel) ──────────────────────────────────────
  // The tab list is Overview + one tab per property of the tapestry-owner-goal
  // JSON Schema, read from the schema node at runtime. The section key is
  // derived from the schema itself (required[0], else its first property) so
  // a schema update flows through without a code change.
  const { taPubkey } = useConfig();
  const [sectionKey, setSectionKey] = useState(null);       // e.g. 'tapestryOwnerGoal'
  const [schemaSection, setSchemaSection] = useState(null); // the section's properties map
  const [schemaError, setSchemaError] = useState(null);

  useEffect(() => {
    if (!taPubkey) return undefined;
    const controller = new AbortController();
    fetch(`/api/concept-graph/node/39999:${taPubkey}:tapestry-owner-goal-schema`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const tag = json?.node?.tags?.find((t) => t.type === 'json');
        const schema = tag ? JSON.parse(tag.value)?.jsonSchema : null;
        const section = (Array.isArray(schema?.required) && schema.required[0])
          || (schema?.properties && Object.keys(schema.properties)[0]);
        const props = section ? schema?.properties?.[section]?.properties : null;
        if (!props || typeof props !== 'object') throw new Error('schema shape not recognized');
        setSectionKey(section);
        setSchemaSection(props);
        setSchemaError(null);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setSectionKey(null);
        setSchemaSection(null);
        setSchemaError(err.message || 'Could not load the goal schema');
      });
    return () => controller.abort();
  }, [taPubkey]);

  const schemaProps = useMemo(
    () => (schemaSection ? Object.keys(schemaSection).map((k) => ({ key: k, label: schemaSection[k]?.title || k })) : []),
    [schemaSection],
  );

  // Which rail card is detailed. Defaults to the parent, and re-defaults
  // whenever the parent changes.
  const [detailUuid, setDetailUuid] = useState(null);
  useEffect(() => { setDetailUuid(parent ? parent.uuid : null); }, [parent]);

  // The tab selection as a property PATH into the schema: [] = Overview,
  // ['deliverable'] = a top-level property, ['x','y'] = a property of an
  // object-typed property, … capped at 3 levels. Back to Overview on goal
  // switch.
  const [tabPath, setTabPath] = useState([]);
  useEffect(() => { setTabPath([]); }, [detailUuid]);

  // The detailed goal's RAW element json (schema-honest: shows whatever the
  // element actually stores, unknown-to-the-record fields included).
  const [rawJson, setRawJson] = useState(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState(null);

  useEffect(() => {
    if (!detailUuid) { setRawJson(null); setRawError(null); setRawLoading(false); return undefined; }
    const controller = new AbortController();
    setRawLoading(true); setRawError(null); setRawJson(null);
    fetch(`/api/concept-graph/node/${encodeURIComponent(detailUuid)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const tag = json?.node?.tags?.find((t) => t.type === 'json');
        setRawJson(tag ? JSON.parse(tag.value) : null);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setRawError(err.message || 'Could not load the goal data');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRawLoading(false);
      });
    return () => controller.abort();
  }, [detailUuid]);

  const rawSection = (rawJson && sectionKey) ? rawJson[sectionKey] : null;

  // ── Save goal set (rail foot) ───────────────────────────────────────────
  // null | 'busy' | 'done' | <error string>. Cleared when the pair changes.
  const [saveState, setSaveState] = useState(null);
  useEffect(() => { setSaveState(null); }, [parent, child]);

  const saveGoalSet = async () => {
    if (!parent || !child || saveState === 'busy') return;
    setSaveState('busy');
    try {
      const name = `Rationale for ${child.name}`;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const resp = await fetch('/api/normalize/create-element', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: 'goal set',
          name,
          json: {
            goalSet: {
              name,
              slug,
              description: `the goal set consisting of parent goal ${parent.name} and child goal ${child.name}`,
              parentGoal: parent.slug || null,
              childGoal: child.slug || null,
            },
          },
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || `Save failed: status ${resp.status}`);
      }
      setSaveState('done');
    } catch (err) {
      setSaveState(err.message || 'Save failed');
    }
  };

  // Resolve the detailed goal: the full record when we have it (name +
  // description live there), else whatever rail card carries the uuid.
  const detailGoal = useMemo(() => {
    if (!detailUuid) return null;
    const record = goalList.find((g) => g.uuid === detailUuid);
    if (record) return record;
    return [parent, child, ...(activePath || [])].find((g) => g && g.uuid === detailUuid) || null;
  }, [detailUuid, goalList, parent, child, activePath]);

  const selectForDetail = (g) => setDetailUuid(g.uuid);

  if (authLoading) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>Rationale</h1>
        <p className="brain-muted">Checking who you are…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page brain-goals">
        <Breadcrumbs />
        <h1>Rationale</h1>
        <div className="brain-gate">
          <p>🔒 This page is only available to the owner.</p>
          {!user && <p>Please sign in to continue.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page brain-goals">
      <Breadcrumbs />
      <h1>Rationale</h1>
      <p className="brain-muted">
        Select two goals — a parent and a child. The child goal serves the parent.
      </p>
      {error && <p className="error">Could not load goals: {error}</p>}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <GoalPickerPanel
          label="Parent"
          goals={goalList}
          loading={loading}
          selected={parent}
          excludedUuid={child?.uuid}
          onSelect={setParent}
          onClear={() => setParent(null)}
        />
        <GoalPickerPanel
          label="Child"
          goals={goalList}
          loading={loading}
          selected={child}
          excludedUuid={parent?.uuid}
          onSelect={setChild}
          onClear={() => setChild(null)}
        />
      </div>
      <div className="firmware-layout" style={{ marginTop: '1rem' }}>
        <aside className="firmware-sidebar" aria-label="In service">
          <div className="firmware-sidebar-header">In Service</div>
          <GoalCard label="Parent" goal={parent} active={parent && detailUuid === parent.uuid} onSelect={selectForDetail} />
          {parent && child && (
            pathLoading ? (
              <p className="brain-muted" style={pathNoteStyle}>Finding path…</p>
            ) : pathError ? (
              <p className="error" style={pathNoteStyle}>{pathError}</p>
            ) : noPath ? (
              <p className="brain-muted" style={pathNoteStyle}>The child does not serve the parent goal.</p>
            ) : (
              intermediates.map((g) => (
                <GoalCard key={g.uuid} goal={g} active={detailUuid === g.uuid} onSelect={selectForDetail} />
              ))
            )
          )}
          <GoalCard label="Child" goal={child} active={child && detailUuid === child.uuid} onSelect={selectForDetail} />
          {parent && child && !pathLoading && !pathError && paths.length > 1 && (
            <button type="button" onClick={reroll} style={{ margin: '0.5rem' }}>
              ↻ Show a different path{truncated ? ' (of 25+).' : ` (of ${paths.length}).`}
            </button>
          )}
          <div style={{ margin: '0.5rem' }}>
            <button
              type="button"
              onClick={saveGoalSet}
              disabled={!parent || !child || saveState === 'busy'}
            >
              {saveState === 'busy' ? 'Saving…' : 'Save goal set'}
            </button>
            {saveState === 'done' && (
              <p className="brain-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Saved.</p>
            )}
            {saveState && saveState !== 'busy' && saveState !== 'done' && (
              <p className="error" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>{saveState}</p>
            )}
          </div>
        </aside>
        <div className="firmware-content">
          <div className="firmware-node-tabs">
            <button
              type="button"
              className={`firmware-node-tab ${tabPath.length === 0 ? 'active' : ''}`}
              onClick={() => setTabPath([])}
            >
              Overview
            </button>
            {schemaProps.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`firmware-node-tab ${tabPath[0] === p.key ? 'active' : ''}`}
                onClick={() => setTabPath([p.key])}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="firmware-node-content">
            {schemaError && (
              <p className="brain-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>
                Could not load the goal schema ({schemaError}) — property tabs are unavailable.
              </p>
            )}
            {!detailGoal ? (
              <p className="brain-muted">Select a goal on the left to see its details.</p>
            ) : tabPath.length === 0 ? (
              <>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{detailGoal.name}</h2>
                {detailGoal.statement ? (
                  <p style={{ margin: 0 }}>{detailGoal.statement}</p>
                ) : (
                  <p className="brain-muted" style={{ margin: 0 }}>No description.</p>
                )}
              </>
            ) : rawLoading ? (
              <p className="brain-muted" style={{ margin: 0 }}>Loading…</p>
            ) : rawError ? (
              <p className="brain-muted" style={{ margin: 0 }}>Could not load the goal data: {rawError}</p>
            ) : (
              <PropertyContent
                tabPath={tabPath}
                schemaSection={schemaSection}
                section={rawSection}
                onNavigate={setTabPath}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
