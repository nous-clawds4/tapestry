import DictionaryShell, { Eyebrow } from './DictionaryShell';
import { ConceptsDictionaryBody } from '../dictionaries/Concepts';
import { dictionaryEntryPath, useDictionaryPerson } from '../dictionaries/conceptsDictionary';

/**
 * /dictionary — the Concepts dictionary in the styling of the owner's Claude Design mock (account
 * menu → Dictionary). It works exactly as Tapestry › Dictionaries › Concepts
 * (/tapestry/dictionaries/concepts) because it renders the same ConceptsDictionaryBody: the same
 * person, the same GET /api/dictionaries/concepts, the same FAQ, search, sort, finder and rows.
 * Only the frame and the skin are the design's (DictionaryShell, `.dict-skin-light` in
 * styles.css); its rows open /dictionary/:coord.
 *
 * The lede is the control panel page's, not the mock's: the mock says the Assistant already keeps
 * the entries up to date and that any entry can be vetoed, and neither is built yet (SPEC § 3).
 */
export default function DictionaryPage() {
  const person = useDictionaryPerson();
  // "Your" for a signed-in reader, "The owner’s" signed out, nothing while the roster is still loading.
  const whose = person.loading ? '' : person.signedIn ? 'Your ' : 'The owner’s ';
  return (
    <DictionaryShell>
      <Eyebrow>Dictionary</Eyebrow>
      <h1 className="bsd-title">{whose}<span className="bsd-title-accent">Dictionary</span>.</h1>
      <p className="bsd-lede">
        The concepts your trusted community generally accepts. You can add entries yourself; in a later version
        your Assistant will keep them up to date automatically, and you’ll be able to veto any entry.
      </p>
      <div className="dict-page dict-skin-light">
        <ConceptsDictionaryBody entryHref={dictionaryEntryPath} />
      </div>
    </DictionaryShell>
  );
}
