import DictionaryShell from './DictionaryShell';
import { ConceptEntryBody } from '../dictionaries/ConceptEntry';
import { DICTIONARY_PATH, dictionaryItemPath } from '../dictionaries/conceptsDictionary';

/**
 * /dictionary/:coord — one entry of the /dictionary list, in the design's styling. It renders the
 * control panel entry page's ConceptEntryBody, so the two show the same entry; only the frame, the
 * skin, the back link (to /dictionary), the Filed by links (to the Main side's /user pages) and the item
 * links (to /dictionary/:coord/items/:item) differ.
 */
export default function DictionaryEntryPage() {
  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <ConceptEntryBody listHref={DICTIONARY_PATH} listLabel="Dictionary" profileBase="/user" itemHref={dictionaryItemPath} />
      </div>
    </DictionaryShell>
  );
}
