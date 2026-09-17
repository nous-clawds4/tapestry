import NoteTags from '../NoteTags';
import { itemTarget } from '../../utils/dlistFields';

/**
 * The tag affordance for one DList item (dlist-item-tagging #3) — the shared
 * NoteTags aimed at the item's `a` coordinate (`39999:<author>:<d>`; a
 * non-addressable kind-9999 item falls back to its event id). This wrapper is
 * the single place the item-target rule is applied; the list page mounts it in
 * DListItemsTable's `renderExtra` slot and the tag page (story 4) reuses it.
 */
export default function DListItemTags({ item, showScores = false }) {
  return <NoteTags item={item} target={itemTarget(item)} subject="list item" showScores={showScores} />;
}
