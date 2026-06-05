import { useMemo, useState } from 'react';
import { useParams, NavLink, Outlet } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { publishEverywhere } from '../../utils/nostrPublish';

export default function ConceptDetail() {
  const { uuid } = useParams();
  const decodedUuid = decodeURIComponent(uuid);

  const { data, loading, error } = useCypher(`
    MATCH (h:ListHeader {uuid: '${decodedUuid}'})
    OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset)
    OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s)-[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(elem:ListItem)
    WITH h, s, count(DISTINCT elem) AS elementCount
    RETURN h.uuid AS uuid, h.name AS name, h.pubkey AS author,
           s.uuid AS supersetUuid, s.name AS supersetName,
           elementCount
    LIMIT 1
  `);

  const concept = data?.[0];
  const authorPubkeys = useMemo(
    () => concept?.author ? [concept.author] : [],
    [concept?.author]
  );
  const profiles = useProfiles(authorPubkeys);

  // Story #9 / ADR 0004 (Rev 1) — owner publishes this concept to the
  // community. Server enumerates the own-authored (TA) event set
  // (Concept-Graph-rooted, owner-only); we re-publish each via the existing
  // publishEverywhere primitive, targeting ONLY the DList relay
  // wss://dcosl.brainstorm.world (not the general-purpose PUBLISH_RELAYS) so
  // we don't pollute popular relays. Non-owners get a server error surfaced.
  const CONCEPT_PUBLISH_RELAYS = ['wss://dcosl.brainstorm.world'];
  const [publishStatus, setPublishStatus] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const publishConcept = async () => {
    setPublishing(true);
    setPublishStatus('Collecting concept events…');
    try {
      const resp = await fetch(`/api/concept/${encodeURIComponent(decodedUuid)}/export-set`);
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setPublishStatus(`Error: ${data.error || `HTTP ${resp.status}`}`);
        return;
      }
      const events = data.events || [];
      if (events.length === 0) {
        setPublishStatus('Nothing to publish — no own-authored events for this concept.');
        return;
      }
      let ok = 0;
      let fail = 0;
      for (const ev of events) {
        setPublishStatus(`Publishing ${ok + fail + 1}/${events.length}…`);
        try {
          const r = await publishEverywhere(ev, CONCEPT_PUBLISH_RELAYS);
          if (r?.local?.success || (r?.external?.successes?.length > 0)) ok++;
          else fail++;
        } catch {
          fail++;
        }
      }
      setPublishStatus(`Published ${ok}/${events.length} concept events to the community${fail ? ` (${fail} failed)` : ''}.`);
    } catch (err) {
      setPublishStatus(`Error: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  // Story #14 / ADR 0010 (mechanism amended by ADR 0011) — owner pulls the
  // curator's class-thread closure into the local Neo4j as a foreign sub-graph
  // reachable from the local concept only via the #11 IS_A_SUPERSET_OF anchor.
  // Owner-only (server enforces via requireOwner middleware). Walks #n + #s
  // tags + back-compat z-at-Header walk; honors trust gate (curator-pubkey
  // only); honest invariants (no editorial relationships, no election, local
  // concept untouched).
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState(null);

  const pullCommunityClassThread = async () => {
    setPulling(true);
    setPullStatus('Walking community class thread…');
    try {
      const resp = await fetch(
        `/api/concept/${encodeURIComponent(decodedUuid)}/pull-community-class-thread`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setPullStatus(`Error: ${data.error || `HTTP ${resp.status}`}`);
        return;
      }
      const skippedNote = data.skipped > 0 ? ` (${data.skipped} skipped by trust gate)` : '';
      const truncNote = data.truncated ? ' [TRUNCATED — fetch budget hit]' : '';
      setPullStatus(
        `Pulled ${data.materialized}/${data.fetched} events; ${data.edgesMerged} canonical edges merged at depth ${data.depth}${skippedNote}${truncNote}.`
      );
    } catch (err) {
      setPullStatus(`Error: ${err.message}`);
    } finally {
      setPulling(false);
    }
  };

  const tabs = [
    { to: '', label: 'Overview', end: true },
    { to: 'core-nodes', label: 'Core Nodes' },
    { to: 'elements', label: 'Elements' },
    { to: 'dag', label: 'Organization (Sets)' },
    { to: 'visualization', label: 'Visualization' },
    { to: 'properties', label: 'Properties' },
    { to: 'schema', label: 'JSON Schema' },
    { to: 'health', label: '🩺 Health Audit' },
  ];

  return (
    <div className="page">
      <Breadcrumbs />

      {loading && <div className="loading">Loading concept…</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {concept && (
        <>
          <h1>{concept.name || concept.uuid?.slice(0, 20) + '…'}</h1>
          <div className="concept-meta">
            <span className="meta-item">UUID: <code>{concept.uuid}</code></span>
            <span className="meta-item">Elements: <strong>{concept.elementCount}</strong></span>
            <span className="meta-item">Author: <AuthorCell pubkey={concept.author} profiles={profiles} /></span>
          </div>

          <div className="concept-actions">
            <button
              type="button"
              className="btn"
              onClick={publishConcept}
              disabled={publishing}
              title="Publish this concept's own-authored events to the community relays"
            >
              {publishing ? 'Publishing…' : 'Publish concept to community'}
            </button>
            {publishStatus && <span className="meta-item" style={{ marginLeft: '0.75rem' }}>{publishStatus}</span>}
          </div>

          <div className="concept-actions" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              onClick={pullCommunityClassThread}
              disabled={pulling}
              title="Walk the community curator's class-thread closure into your local graph as a foreign sub-graph (reachable only via the IS_A_SUPERSET_OF anchor; your concept stays untouched)"
            >
              {pulling ? 'Pulling…' : 'Pull community class thread'}
            </button>
            {pullStatus && <span className="meta-item" style={{ marginLeft: '0.75rem' }}>{pullStatus}</span>}
          </div>

          <nav className="tab-nav">
            {tabs.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="tab-content">
            <Outlet context={{ concept, uuid: decodedUuid }} />
          </div>
        </>
      )}
    </div>
  );
}
