import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

export default function ConceptOverview() {
  const { concept, uuid } = useOutletContext();

  // Parameter, not interpolation — an inlined `…:set` handle reads as a write to
  // the server's guard and 403s unauthenticated visitors (ADR 0003 Amendment 1).
  const params = useMemo(() => ({ conceptUuid: uuid }), [uuid]);

  const { data } = useCypher(`
    MATCH (h:ListHeader {uuid: $conceptUuid})
    OPTIONAL MATCH (h)-[:HAS_TAG]->(nt:NostrEventTag {type: 'names'})
    OPTIONAL MATCH (h)-[:HAS_TAG]->(dt:NostrEventTag {type: 'description'})
    OPTIONAL MATCH (p:Property)-[:IS_A_PROPERTY_OF]->(:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    RETURN h.name AS name, h.pubkey AS author, h.created_at AS createdAt,
           nt.value AS singular, nt.value1 AS plural,
           dt.value AS description,
           count(DISTINCT p) AS propertyCount
    LIMIT 1
  `, [], params);

  const d = data?.[0] || {};
  const authorPubkeys = useMemo(() => d.author ? [d.author] : [], [d.author]);
  const profiles = useProfiles(authorPubkeys);

  return (
    <div className="concept-overview">
      <h2>Overview</h2>
      <div className="detail-grid">
        {d.singular && (
          <div className="detail-row">
            <span className="detail-label">Name (singular)</span>
            <span className="detail-value">{d.singular}</span>
          </div>
        )}
        {d.plural && (
          <div className="detail-row">
            <span className="detail-label">Name (plural)</span>
            <span className="detail-value">{d.plural}</span>
          </div>
        )}
        {d.description && (
          <div className="detail-row">
            <span className="detail-label">Description</span>
            <span className="detail-value">{d.description}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Author</span>
          <span className="detail-value">
            <AuthorCell pubkey={d.author} profiles={profiles} />
          </span>
        </div>
        {d.createdAt && (
          <div className="detail-row">
            <span className="detail-label">Created</span>
            <span className="detail-value">
              {new Date(parseInt(d.createdAt) * 1000).toLocaleString()}
            </span>
          </div>
        )}
        {/* Counts come from the parent route, not from this page's own query
            (ADR graph-curation-ui/0003). This page used to compute them itself
            and disagreed with the header above it — reading them here is what
            makes the two figures the same number rather than two that happen to
            match. */}
        <div className="detail-row">
          <span className="detail-label">Elements</span>
          <span className="detail-value">{concept?.elementCount ?? 0}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Sets</span>
          <span className="detail-value">{concept?.setCount ?? 0}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Properties</span>
          <span className="detail-value">{d.propertyCount ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
