import { useParams } from 'react-router-dom';
import DictionaryShell from './DictionaryShell';
import { ConceptEntryBody } from '../dictionaries/ConceptEntry';
import { DICTIONARY_PATH, dictionaryEditPath, dictionaryItemPath } from '../dictionaries/conceptsDictionary';

/**
 * /dictionary/:coord — one entry of the /dictionary list, in the design's styling. It renders the
 * control panel entry page's ConceptEntryBody, so the two show the same entry; only the frame, the
 * skin, the back link (to /dictionary), the Filed by links (to the Main side's /user pages) and the item
 * links (to /dictionary/:coord/items/:item) differ, and only here does the reader's own Assistant's
 * header offer Edit (/dictionary/:coord/edit) and, when it is wired to a shared concept, Re-Sync.
 */
export default function DictionaryEntryPage() {
  // One body per concept: moving to another entry (a link in the Re-Sync panel, Back) starts afresh, so no
  // state of one concept (its header, an open Re-Sync, a note) shows on another's page.
  const { coord } = useParams();
  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <ConceptEntryBody key={coord} listHref={DICTIONARY_PATH} listLabel="Dictionary" profileBase="/user" itemHref={dictionaryItemPath} editHref={dictionaryEditPath} resync />
      </div>
    </DictionaryShell>
  );
}
