import { useMemo, useState } from 'react';
import DListItemRow from './DListItemRow';
import { derivedFieldDecls } from '../../utils/dlistFields';

const DERIVED_TITLE = "not declared by this list's header — derived from its items";

/**
 * Items of a DList rendered by the header's own field declarations.
 * Knows nothing about routes or where the data came from — `profiles` and
 * `voteCounts` (by item id → {up, down}) are props; `renderExtra(item)` is an
 * optional trailing cell for later stories.
 *
 * "Show all fields" (dlist-item-tagging #8) promotes every undeclared tag on the
 * current page to its own column. The toggle is component-local on purpose, so both
 * mount sites inherit it with no per-surface code.
 */
export default function DListItemsTable({ items, fieldDecls, profiles = {}, voteCounts = {}, renderExtra }) {
  const [showAll, setShowAll] = useState(false);
  const derived = useMemo(() => derivedFieldDecls(items, fieldDecls), [items, fieldDecls]);
  const columns = showAll ? [...fieldDecls, ...derived] : fieldDecls;
  const showOther = !showAll;
  return (
    <div className="bs-dlist-table-region">
      {derived.length > 0 && (
        <div className="bs-dlist-table-toolbar">
          <label>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            {' '}Show all fields
          </label>
        </div>
      )}
      <div className="bs-dlist-table-wrap">
        <table className="bs-dlist-table">
          <thead>
            <tr>
              <th>Added by</th>
              <th>Age</th>
              {columns.map((decl) => (
                <th
                  key={decl.name}
                  className={decl.requirement === 'required' ? 'is-required' : `is-${decl.requirement}`}
                  title={decl.derived ? DERIVED_TITLE : (decl.description || `${decl.requirement} · ${decl.type}`)}
                >
                  {decl.name}{decl.requirement === 'required' && ' *'}
                </th>
              ))}
              {showOther && <th className="is-other" title="Item tags the list header did not declare">Other fields</th>}
              <th>Votes</th>
              {renderExtra && <th />}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <DListItemRow
                key={item.id}
                item={item}
                fieldDecls={columns}
                showOther={!showAll}
                profile={profiles[item.pubkey]}
                votes={voteCounts[item.id]}
                renderExtra={renderExtra}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
