import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Placeholder pages for the upcoming second-brain goal surfaces. Each renders
 * a single descriptive sentence until the real page lands; owner-gated like
 * the other brain views (Goals, Proposals). Replace an export with a real
 * page file when its surface is built.
 */

function Placeholder({ title, text }) {
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';

  return (
    <div className="page brain-goals">
      <Breadcrumbs />
      <h1>{title}</h1>
      {authLoading ? (
        <p className="brain-muted">Checking who you are…</p>
      ) : !isOwner ? (
        <div className="brain-gate">
          <p>🔒 This page is only available to the owner.</p>
          {!user && <p>Please sign in to continue.</p>}
        </div>
      ) : (
        <p>{text}</p>
      )}
    </div>
  );
}

export function GoalsGraph() {
  return (
    <Placeholder
      title="Goals (graph)"
      text="This page will show all of the goals in the Second Brain and their graphical connections in neo4j."
    />
  );
}

export function GoalRelationshipTypes() {
  return (
    <Placeholder
      title="Goal Relationship Types"
      text="This page lists each of the relationship types that can connect two goals."
    />
  );
}
