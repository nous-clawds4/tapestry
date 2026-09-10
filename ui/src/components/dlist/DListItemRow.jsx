import { Link } from 'react-router-dom';
import Avatar from '../Avatar';
import { fieldCellModel } from '../../utils/dlistFields';

function formatAge(ts) {
  if (!ts) return '—';
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortPubkey(pk) {
  return pk ? `${pk.slice(0, 8)}…` : '—';
}

function FieldCell({ cell }) {
  if (cell.missing) return <span className="bs-dlist-missing">missing</span>;
  if (cell.value == null) return null;
  return (
    <>
      {cell.href
        ? <a href={cell.href} target="_blank" rel="noreferrer">{cell.value}</a>
        : cell.value}
      {cell.extra > 0 && <span className="bs-dlist-extra"> +{cell.extra} more</span>}
    </>
  );
}

/**
 * One DList item. Votes are read-only counts handed in by the page; the trailing
 * slot is where later stories mount their affordance.
 */
export default function DListItemRow({ item, fieldDecls, profile, votes, renderExtra }) {
  const name = profile?.display_name || profile?.name || shortPubkey(item.pubkey);
  return (
    <tr className="bs-dlist-row">
      <td className="bs-dlist-author">
        <Link to={`/user/${item.pubkey}`} className="bs-dlist-author-link">
          <Avatar pubkey={item.pubkey} profile={profile} size={24} />
          <span>{name}</span>
        </Link>
      </td>
      <td className="bs-dlist-age">{formatAge(item.created_at)}</td>
      {fieldDecls.map((decl) => (
        <td key={decl.name} className="bs-dlist-field">
          <FieldCell cell={fieldCellModel(item, decl)} />
        </td>
      ))}
      <td className="bs-dlist-votes">
        {votes ? `▲${votes.up} ▼${votes.down}` : '—'}
      </td>
      {renderExtra && <td className="bs-dlist-extra-slot">{renderExtra(item)}</td>}
    </tr>
  );
}
