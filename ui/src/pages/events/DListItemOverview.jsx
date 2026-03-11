import { useMemo } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import useProfiles from '../../hooks/useProfiles';
import { useCypher } from '../../hooks/useCypher';
import AuthorCell from '../../components/AuthorCell';

function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

function formatAge(ts) {
  if (!ts) return '—';
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

export default function DListItemOverview() {
  const { event } = useOutletContext();
  const navigate = useNavigate();
  const authorPubkeys = useMemo(() => event?.pubkey ? [event.pubkey] : [], [event?.pubkey]);
  const profiles = useProfiles(authorPubkeys);

  const isListHeader = event.kind === 9998 || event.kind === 39998;
  const name = getTag(event, 'name') || (isListHeader ? null : '(unnamed)');
  const namesTag = getTag(event, 'names');             // singular (index 1)
  const namesPlural = getTag(event, 'names', 2);       // plural  (index 2)
  const description = getTag(event, 'description') || event.content || '(none)';
  const dTag = getTag(event, 'd');
  const zTag = getTag(event, 'z');
  const eTag = getTag(event, 'e');
  const parentRef = zTag || eTag;

  const aTag = (event.kind === 39998 || event.kind === 39999)
    ? `${event.kind}:${event.pubkey}:${dTag}`
    : null;

  // Check if this event exists in Neo4j (use aTag for replaceable, event.id otherwise)
  const neo4jUuid = aTag || event.id;
  const { data: neo4jData, loading: neo4jLoading } = useCypher(
    neo4jUuid
      ? `MATCH (n:NostrEvent {uuid: '${neo4jUuid.replace(/'/g, "\\'")}'}) RETURN n.uuid AS uuid LIMIT 1`
      : null
  );
  const neo4jExists = neo4jData && neo4jData.length > 0;

  function goToParentList() {
    if (parentRef) {
      navigate(`/kg/lists/${encodeURIComponent(parentRef)}`);
    }
  }

  return (
    <div className="dlist-overview">
      <h2>Overview</h2>
      <table className="detail-table">
        <tbody>
          {isListHeader ? (
            <>
              <tr>
                <th>Type</th>
                <td>📄 DList (List Header)</td>
              </tr>
              {namesTag && (
                <tr>
                  <th>Singular</th>
                  <td>{namesTag}</td>
                </tr>
              )}
              {namesPlural && (
                <tr>
                  <th>Plural</th>
                  <td>{namesPlural}</td>
                </tr>
              )}
              {name && (
                <tr>
                  <th>Name</th>
                  <td>{name}</td>
                </tr>
              )}
            </>
          ) : (
            <tr>
              <th>Name</th>
              <td>{name}</td>
            </tr>
          )}
          <tr>
            <th>Description</th>
            <td>{description}</td>
          </tr>
          <tr>
            <th>Author</th>
            <td><AuthorCell pubkey={event.pubkey} profiles={profiles} /></td>
          </tr>
          <tr>
            <th>Event Kind</th>
            <td>{event.kind}</td>
          </tr>
          <tr>
            <th>Event ID</th>
            <td><code style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{event.id}</code></td>
          </tr>
          {aTag && (
            <tr>
              <th>a-tag</th>
              <td><code style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{aTag}</code></td>
            </tr>
          )}
          {dTag && (
            <tr>
              <th>d-tag</th>
              <td><code>{dTag}</code></td>
            </tr>
          )}
          {parentRef && (
            <tr>
              <th>Parent List</th>
              <td>
                <code
                  style={{ fontSize: '0.85em', wordBreak: 'break-all', cursor: 'pointer', color: 'var(--accent)' }}
                  onClick={goToParentList}
                  title="Go to parent list"
                >
                  {parentRef}
                </code>
              </td>
            </tr>
          )}
          <tr>
            <th>Neo4j Node</th>
            <td>
              {neo4jLoading ? (
                <span style={{ opacity: 0.5 }}>Checking…</span>
              ) : neo4jExists ? (
                <Link to={`/kg/databases/neo4j/nodes/${encodeURIComponent(neo4jUuid)}`}>
                  🔗 View in Neo4j
                </Link>
              ) : (
                <span style={{ opacity: 0.5 }}>Not yet imported into Neo4j</span>
              )}
            </td>
          </tr>
          <tr>
            <th>Created</th>
            <td>{formatDate(event.created_at)} ({formatAge(event.created_at)})</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
