import { useState, useCallback, useEffect } from 'react';
import { cypher } from '../../api/cypher';
import * as auditApi from '../../api/audit';

// ─── Audit Command Definitions ─────────────────────────────────────
// Each mirrors a `tapestry audit` subcommand and calls the server API.

const AUDIT_COMMANDS = {
  health: {
    label: '🩺 Health',
    description: 'Full health check — runs all audit checks and shows pass/warn/fail summary.',
    cli: 'tapestry audit health',
    options: [],
    run: () => auditApi.auditHealth(),
    renderResult: (data) => {
      const statusIcon = data.status === 'pass' ? '✅' : data.status === 'warn' ? '⚠️' : '❌';
      const statusLabel = data.status === 'pass' ? 'HEALTHY' : data.status === 'warn' ? 'WARNINGS' : 'ISSUES FOUND';
      const rows = data.checks.map(c => ({
        check: c.name,
        status: c.status === 'pass' ? '✅ Pass'
          : c.status === 'warn' ? '⚠️ Warning'
          : c.status === 'info' ? 'ℹ️ Info'
          : '❌ Fail',
        summary: c.summary,
      }));
      return [{
        label: `${statusIcon} ${statusLabel} — ${data.stats.nodes.toLocaleString()} nodes, ${data.stats.relationships.toLocaleString()} relationships, ${data.stats.concepts} concepts`,
        rows,
      }];
    },
  },
  stats: {
    label: '📊 Stats',
    description: 'Quick summary: node counts, relationship counts, concept counts, signers, JSON coverage.',
    cli: 'tapestry audit stats',
    options: [],
    run: () => auditApi.auditStats(),
    renderResult: (data) => [
      { label: 'Totals', rows: [data.data.totals] },
      { label: 'Nodes by Label', rows: data.data.byLabel },
      { label: 'Relationships by Type', rows: data.data.byRelType },
      { label: 'Concepts', rows: data.data.concepts },
      { label: 'Signers', rows: data.data.signers },
      { label: 'JSON Tag Coverage', rows: data.data.jsonCoverage },
    ],
  },
  concept: {
    label: '🔬 Concept',
    description: 'Comprehensive health check for a single concept — skeleton, elements, wiring, labels, JSON coverage.',
    cli: 'tapestry audit concept',
    options: [
      { key: 'concept', type: 'concept', label: 'Concept name', placeholder: 'e.g. "property"', required: true },
    ],
    run: (opts) => auditApi.auditConcept(opts.concept),
    renderResult: (data) => {
      if (!data.found) return [{ label: 'Not found', rows: [{ error: data.error }] }];

      const statusIcon = data.status === 'pass' ? '✅' : data.status === 'warn' ? '⚠️' : '❌';
      const statusLabel = data.status === 'pass' ? 'HEALTHY' : data.status === 'warn' ? 'WARNINGS' : 'ISSUES FOUND';

      const sections = [];

      // Checks summary
      sections.push({
        label: `${statusIcon} ${statusLabel} — "${data.concept.name}"`,
        rows: data.checks.map(c => ({
          check: c.name,
          status: c.status === 'pass' ? '✅ Pass'
            : c.status === 'warn' ? '⚠️ Warning'
            : c.status === 'info' ? 'ℹ️ Info'
            : '❌ Fail',
          summary: c.summary,
        })),
      });

      // Skeleton nodes
      sections.push({
        label: 'Skeleton Nodes',
        rows: data.skeleton.nodes.map(n => ({
          role: n.role,
          exists: n.exists ? '✅' : '❌',
          json: n.json ? '✅' : '❌',
          name: n.name || '—',
        })),
      });

      // Elements
      if (data.elements.total > 0) {
        sections.push({
          label: `Elements (${data.elements.total})`,
          rows: data.elements.items.map(e => ({
            name: e.name || '(unnamed)',
            json: e.hasJson ? '✅' : '❌',
            orphan: (e.missingZTag || e.brokenZTag) ? '⚠️' : '—',
          })),
        });
      }

      // Wiring violations
      if (data.wiring.count > 0) {
        sections.push({
          label: `Wiring Violations (${data.wiring.count})`,
          rows: data.wiring.violations.map(v => ({
            from: v.fromName, rel: v.relType, to: v.toName,
          })),
        });
      }

      return sections;
    },
  },
  skeletons: {
    label: '🦴 Skeletons',
    description: 'Check concepts for missing core nodes (superset, schema, 3 graphs).',
    cli: 'tapestry audit skeletons',
    options: [
      { key: 'concept', type: 'concept', label: 'Concept name', placeholder: 'e.g. "dog" (blank = all)' },
    ],
    run: (opts) => auditApi.auditSkeletons(opts.concept),
    renderResult: (data) => {
      const rows = data.data.map(r => ({
        concept: r.concept,
        superset: r.superset ? '✅' : '❌',
        schema: r.schema ? '✅' : '❌',
        primaryProp: r.primaryProp ? '✅' : '❌',
        coreGraph: r.coreGraph ? '✅' : '❌',
        ctGraph: r.ctGraph ? '✅' : '❌',
        ptGraph: r.ptGraph ? '✅' : '❌',
      }));
      return [{ label: 'Skeleton completeness', rows }];
    },
  },
  orphans: {
    label: '🔍 Orphans',
    description: 'Find nodes with broken or missing parent references.',
    cli: 'tapestry audit orphans',
    options: [],
    run: () => auditApi.auditOrphans(),
    renderResult: (data) => [
      { label: 'Broken z-tag references (parent not found)', rows: data.data.brokenZ },
      { label: 'Items without z-tag', rows: data.data.noZ },
      { label: 'Empty concepts (no elements)', rows: data.data.empty },
    ],
  },
  wiring: {
    label: '🔌 Wiring',
    description: 'Check for relationship type mismatches (wrong node types connected).',
    cli: 'tapestry audit wiring',
    options: [],
    run: () => auditApi.auditWiring(),
    renderResult: (data) => data.data.map(r => ({
      label: `${r.rule} (${r.count} violation${r.count !== 1 ? 's' : ''})`,
      rows: r.violations,
    })),
  },
  labels: {
    label: '🏷️ Labels',
    description: 'Find nodes missing expected Neo4j labels based on their z-tag parent.',
    cli: 'tapestry audit labels',
    options: [],
    run: () => auditApi.auditLabels(),
    renderResult: (data) => data.data.map(r => ({
      label: `${r.label} (${r.count} missing)`,
      rows: r.missing,
    })),
  },
  bios: {
    label: '🧬 BIOS',
    description: 'Verify all 11 canonical BIOS concepts exist with complete skeletons.',
    cli: 'tapestry audit bios',
    options: [],
    run: () => auditApi.auditBios(),
    renderResult: (data) => {
      const rows = data.data.map(r => ({
        concept: r.concept,
        exists: r.exists ? '✅' : '❌',
        CTH: r.cth ? '✅' : '❌',
        superset: r.superset ? '✅' : '❌',
        schema: r.schema ? '✅' : '❌',
        primaryProp: r.primaryProp ? '✅' : '❌',
        coreGraph: r.coreGraph ? '✅' : '❌',
        ctGraph: r.ctGraph ? '✅' : '❌',
        ptGraph: r.ptGraph ? '✅' : '❌',
        json: r.json ? '✅' : '❌',
        status: r.complete ? '✅ Complete' : r.exists ? '⚠️ Partial' : '❌ Missing',
      }));
      return [
        { label: `BIOS concept skeletons — ${data.summary.complete}/${data.summary.total} complete`, rows },
      ];
    },
  },
  threads: {
    label: '🧵 Threads',
    description: 'Traverse concept graph for a concept.',
    cli: 'tapestry audit threads',
    options: [
      { key: 'concept', type: 'concept', label: 'Concept name', placeholder: 'e.g. "property" (blank = summary)' },
      { key: 'mode', type: 'select', label: 'Mode', choices: [
        { value: 'elements', label: 'Elements (leaf nodes)' },
        { value: 'sets', label: 'Sets (intermediate nodes)' },
        { value: 'paths', label: 'Full paths' },
      ]},
      { key: 'through', type: 'text', label: 'Through set', placeholder: 'Filter paths through a specific set' },
      { key: 'depth', type: 'text', label: 'Max depth', placeholder: '10' },
    ],
    run: (opts) => auditApi.auditThreads({
      concept: opts.concept,
      mode: opts.mode,
      through: opts.through,
      depth: opts.depth,
    }),
    renderResult: (data) => {
      const mode = data.mode || 'summary';
      const label = data.header
        ? `${mode === 'summary' ? 'Summary' : mode} for "${data.header.name}"`
        : `Class thread summary (all concepts)`;
      return [{ label, rows: data.data }];
    },
  },
};

// ─── Component ─────────────────────────────────────────────────────

export default function Audit() {
  const [selectedCmd, setSelectedCmd] = useState('health');
  const [options, setOptions] = useState({});
  const [sections, setSections] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [conceptNames, setConceptNames] = useState([]);

  // Fetch available concept names for the picker
  useEffect(() => {
    cypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
      RETURN DISTINCT t.value AS name ORDER BY name
    `).then(rows => {
      setConceptNames(rows.map(r => r.name).filter(Boolean));
    }).catch(() => {
      // Silently fail — user can still type manually
    });
  }, []);

  const cmd = AUDIT_COMMANDS[selectedCmd];

  // Build the CLI command string for display
  const buildCliString = useCallback(() => {
    let cli = cmd.cli;
    if (selectedCmd === 'concept' && options.concept) {
      cli += ` "${options.concept}"`;
    }
    if (selectedCmd === 'threads' && options.concept) {
      cli += ` "${options.concept}"`;
    }
    if (selectedCmd === 'skeletons' && options.concept) {
      cli += ` --concept "${options.concept}"`;
    }
    if (options.mode && options.mode !== 'elements') {
      cli += ` --${options.mode}`;
    }
    if (options.through) {
      cli += ` --through "${options.through}"`;
    }
    if (options.depth && options.depth !== '10') {
      cli += ` --depth ${options.depth}`;
    }
    return cli;
  }, [cmd, selectedCmd, options]);

  // Run the audit command via API
  const runAudit = useCallback(async () => {
    setRunning(true);
    setError(null);
    setSections(null);

    try {
      const result = await cmd.run(options);
      const rendered = cmd.renderResult(result);
      setSections(rendered);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }, [cmd, options]);

  const handleOptionChange = (key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleCommandSelect = (cmdKey) => {
    setSelectedCmd(cmdKey);
    setOptions({});
    setSections(null);
    setError(null);
  };

  return (
    <div className="audit-page">
      {/* ── Command Selector ── */}
      <div className="audit-commands">
        <h3>Audit Commands</h3>
        <div className="audit-command-buttons">
          {Object.entries(AUDIT_COMMANDS).map(([key, c]) => (
            <button
              key={key}
              className={`audit-cmd-btn ${selectedCmd === key ? 'active' : ''}`}
              onClick={() => handleCommandSelect(key)}
              title={c.description}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Description ── */}
      <div className="audit-description">
        <p>{cmd.description}</p>
      </div>

      {/* ── Options Panel ── */}
      {cmd.options && cmd.options.length > 0 && (
        <div className="audit-options">
          <h3>Options</h3>
          <div className="audit-options-grid">
            {cmd.options.map(opt => (
              <div key={opt.key} className="audit-option">
                <label htmlFor={`opt-${opt.key}`}>{opt.label}</label>
                {opt.type === 'select' ? (
                  <select
                    id={`opt-${opt.key}`}
                    value={options[opt.key] || opt.choices[0].value}
                    onChange={e => handleOptionChange(opt.key, e.target.value)}
                  >
                    {opt.choices.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                ) : opt.type === 'concept' ? (
                  <>
                    <input
                      id={`opt-${opt.key}`}
                      type="text"
                      list="concept-names-list"
                      placeholder={opt.placeholder}
                      value={options[opt.key] || ''}
                      onChange={e => handleOptionChange(opt.key, e.target.value)}
                    />
                    <datalist id="concept-names-list">
                      {conceptNames.map(name => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    id={`opt-${opt.key}`}
                    type="text"
                    placeholder={opt.placeholder}
                    value={options[opt.key] || ''}
                    onChange={e => handleOptionChange(opt.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CLI Command Preview ── */}
      <div className="audit-cli-preview">
        <h3>CLI Command</h3>
        <div className="cli-command-box">
          <code>$ {buildCliString()}</code>
        </div>
      </div>

      {/* ── Run Button ── */}
      <div className="audit-run">
        <button
          className="run-button"
          onClick={runAudit}
          disabled={running}
        >
          {running ? '⏳ Running...' : '▶️ Run Audit'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="audit-error">
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {/* ── Results ── */}
      {sections && (
        <div className="audit-results">
          <h3>Results</h3>
          {sections.map((section, idx) => (
            <div key={idx} className="audit-result-section">
              <h4>{section.label} ({section.rows.length} row{section.rows.length !== 1 ? 's' : ''})</h4>

              {section.rows.length === 0 ? (
                <p className="no-results">✅ No results (clean!)</p>
              ) : (
                <div className="result-table-wrapper">
                  <table className="result-table">
                    <thead>
                      <tr>
                        {Object.keys(section.rows[0]).map(col => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j}>{formatValue(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) return val.join(' → ');
  if (typeof val === 'object') return JSON.stringify(val);
  if (val === true) return '✅';
  if (val === false) return '❌';
  return String(val);
}
