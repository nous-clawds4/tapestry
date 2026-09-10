import DListItemRow from './DListItemRow';

/**
 * Items of a DList rendered by the header's own field declarations.
 * Knows nothing about routes or where the data came from — `profiles` and
 * `voteCounts` (by item id → {up, down}) are props; `renderExtra(item)` is an
 * optional trailing cell for later stories.
 */
export default function DListItemsTable({ items, fieldDecls, profiles = {}, voteCounts = {}, renderExtra }) {
  return (
    <div className="bs-dlist-table-wrap">
      <table className="bs-dlist-table">
        <thead>
          <tr>
            <th>Added by</th>
            <th>Age</th>
            {fieldDecls.map((decl) => (
              <th
                key={decl.name}
                className={decl.requirement === 'required' ? 'is-required' : `is-${decl.requirement}`}
                title={decl.description || `${decl.requirement} · ${decl.type}`}
              >
                {decl.name}{decl.requirement === 'required' && ' *'}
              </th>
            ))}
            <th className="is-other" title="Item tags the list header did not declare">Other fields</th>
            <th>Votes</th>
            {renderExtra && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <DListItemRow
              key={item.id}
              item={item}
              fieldDecls={fieldDecls}
              profile={profiles[item.pubkey]}
              votes={voteCounts[item.id]}
              renderExtra={renderExtra}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
