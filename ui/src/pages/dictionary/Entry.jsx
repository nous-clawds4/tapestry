import DictionaryShell from './DictionaryShell';
import { ConceptEntryBody } from '../dictionaries/ConceptEntry';
import { DICTIONARY_PATH } from '../dictionaries/conceptsDictionary';

/**
 * /dictionary/:coord — one entry of the /dictionary list, in the design's styling. It renders the
 * control panel entry page's ConceptEntryBody, so the two show the same entry; only the frame, the
 * skin and the back link (to /dictionary) differ.
 */
export default function DictionaryEntryPage() {
  return (
    <DictionaryShell>
      <div className="dict-page dict-skin-light">
        <ConceptEntryBody listHref={DICTIONARY_PATH} listLabel="Dictionary" />
      </div>
    </DictionaryShell>
  );
}
