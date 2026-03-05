import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useState, useMemo } from 'react';

function tryParseJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  let str = typeof raw === 'string' ? raw : String(raw);
  // Try standard JSON first
  try { return JSON.parse(str); } catch {}
  // Try with escaped-quote cleanup
  str = str.replace(/\\"/g, '"');
  try { return JSON.parse(str); } catch {}
  // Handle Neo4j map literal format: {key: "val", key2: 123}
  // Quote unquoted keys
  try {
    const fixed = str.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1 "$2":');
    return JSON.parse(fixed);
  } catch {}
  return null;
}

function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button className="collapsible-toggle" onClick={() => setOpen(!open)}>
        {open ? '▼' : '▶'} {title}
      </button>
      {open && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

export default function NodeRaw() {
  const { node, uuid } = useOutletContext();

  // Neo4j properties — return as individual columns to avoid map parsing issues
  const { data: propsRows } = useCypher(`
    MATCH (n {uuid: '${uuid}'})
    RETURN n.uuid AS uuid, n.id AS id, n.name AS name, n.slug AS slug,
           n.pubkey AS pubkey, n.kind AS kind, n.created_at AS created_at,
           n.aTag AS aTag, labels(n) AS nodeLabels
    LIMIT 1
  `);
  const neo4jProps = propsRows?.[0] || null;

  // Tags (for reconstructing raw event)
  const { data: tagRows } = useCypher(`
    MATCH (n {uuid: '${uuid}'})-[:HAS_TAG]->(t:NostrEventTag)
    RETURN t.type AS type, t.value AS value,
           t.value1 AS value1, t.value2 AS value2
    ORDER BY t.type
  `);

  const rawEvent = useMemo(() => {
    if (!node || !tagRows) return null;
    const eventTags = tagRows.map(t => {
      const arr = [t.type];
      if (t.value) arr.push(t.value);
      if (t.value1) arr.push(t.value1);
      if (t.value2) arr.push(t.value2);
      return arr;
    });
    return {
      id: node.id,
      pubkey: node.pubkey,
      kind: parseInt(node.kind) || node.kind,
      created_at: parseInt(node.created_at) || node.created_at,
      tags: eventTags,
      content: '',
    };
  }, [node, tagRows]);

  return (
    <div>
      <h2>🔧 Raw Data</h2>

      <div className="detail-section">
        <CollapsibleSection title="🗄️ Neo4j Node Properties" defaultOpen={true}>
          {neo4jProps ? (
            <pre className="json-block">{JSON.stringify(neo4jProps, null, 2)}</pre>
          ) : (
            <p className="placeholder">Neo4j properties not available.</p>
          )}
        </CollapsibleSection>
      </div>

      <div className="detail-section">
        <CollapsibleSection title="📡 Reconstructed Nostr Event" defaultOpen={false}>
          {rawEvent ? (
            <pre className="json-block">{JSON.stringify(rawEvent, null, 2)}</pre>
          ) : (
            <p className="placeholder">Raw event data not available.</p>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
