import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useState, useEffect } from 'react';

function tryParseJson(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch {}
  try { return JSON.parse(raw.replace(/""/g, '"')); } catch {}
  return null;
}

function isLmdbRef(value) {
  return typeof value === 'string' && value.startsWith('lmdb:');
}

function JsonSection({ title, icon, data, loading, emptyMessage, badge }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>{icon} {title}</h3>
        {badge && (
          <span style={{
            fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
            fontWeight: 600, ...badge.style,
          }}>
            {badge.text}
          </span>
        )}
      </div>
      {loading && <div className="loading">Loading…</div>}
      {!loading && data ? (
        <pre className="json-block">{JSON.stringify(data, null, 2)}</pre>
      ) : !loading ? (
        <p className="placeholder">{emptyMessage}</p>
      ) : null}
    </div>
  );
}

export default function NodeJson() {
  const { node, uuid } = useOutletContext();

  // ── Neo4j json tag ──
  const { data: tagData, loading: tagLoading } = useCypher(`
    MATCH (n {uuid: '${uuid}'})-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    RETURN j.value AS json
    LIMIT 1
  `);

  const rawTagValue = tagData?.[0]?.json;
  const tagIsLmdbRef = isLmdbRef(rawTagValue);
  const tagJsonData = tagIsLmdbRef ? null : tryParseJson(rawTagValue);

  // ── LMDB tapestryJSON ──
  const tapestryKey = node?.tapestryKey;
  const [lmdbData, setLmdbData] = useState(undefined); // undefined=loading, null=not found
  const [lmdbLoading, setLmdbLoading] = useState(true);

  useEffect(() => {
    if (!tapestryKey) {
      setLmdbData(null);
      setLmdbLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/tapestry-key/${tapestryKey}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          setLmdbData(d.success ? d.data : null);
        }
      })
      .catch(() => { if (!cancelled) setLmdbData(null); })
      .finally(() => { if (!cancelled) setLmdbLoading(false); });
    return () => { cancelled = true; };
  }, [tapestryKey]);

  // ── Comparison ──
  const lmdbContent = lmdbData?.data;
  const bothExist = tagJsonData && lmdbContent;
  const match = bothExist ? JSON.stringify(tagJsonData) === JSON.stringify(lmdbContent) : null;

  return (
    <div>
      <h2>📋 JSON Data</h2>

      {/* Match indicator when both sources exist */}
      {match !== null && (
        <div style={{
          padding: '0.5rem 1rem', borderRadius: '6px', marginBottom: '1.5rem',
          backgroundColor: match ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${match ? '#22c55e' : '#f59e0b'}`,
          fontSize: '0.85rem', fontWeight: 600,
          color: match ? '#22c55e' : '#f59e0b',
        }}>
          {match
            ? '✅ Neo4j json tag and LMDB tapestryJSON match'
            : '⚠️ Neo4j json tag and LMDB tapestryJSON differ — the derived version in LMDB may contain richer data'
          }
        </div>
      )}

      {/* LMDB tapestryJSON — shown first (the "duality" representation) */}
      <JsonSection
        title="tapestryJSON"
        icon="🗄️"
        data={lmdbContent}
        loading={lmdbLoading}
        emptyMessage="No tapestryJSON in LMDB for this node."
        badge={lmdbData?.rebuiltFrom ? {
          text: `via ${lmdbData.rebuiltFrom}`,
          style: { backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' },
        } : null}
      />

      {lmdbData?.updatedAt && (
        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '-1.5rem', marginBottom: '2rem' }}>
          Last updated: {new Date(lmdbData.updatedAt * 1000).toLocaleString()}
          {tapestryKey && <> · Key: <code>{tapestryKey}</code></>}
        </div>
      )}

      {/* Neo4j json tag — the original inline representation */}
      <JsonSection
        title="Neo4j JSON Tag"
        icon="🏷️"
        data={tagJsonData}
        loading={tagLoading}
        emptyMessage={
          tagIsLmdbRef
            ? `JSON tag offloaded to LMDB (${rawTagValue})`
            : 'No JSON tag on this node.'
        }
        badge={tagIsLmdbRef ? {
          text: 'offloaded to LMDB',
          style: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' },
        } : rawTagValue ? {
          text: 'inline',
          style: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
        } : null}
      />
    </div>
  );
}
