import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DictionaryShell, { Eyebrow } from './DictionaryShell';
import ManagedBy from './ManagedBy';
import useProfiles from '../../hooks/useProfiles';
import { ConceptsDictionaryBody } from '../dictionaries/Concepts';
import { dictionaryEntryPath, useDictionaryPerson, useMyAssistants } from '../dictionaries/conceptsDictionary';
import {
  MANAGED_BY_PARAM, managedByParam, managedView, managerOptions, parseManagedBy,
} from '../dictionaries/managedDictionary';

/**
 * /dictionary — the Concepts dictionary in the styling of the owner's Claude Design mock (account
 * menu → Dictionary). It works as Tapestry › Dictionaries › Concepts
 * (/tapestry/dictionaries/concepts) because it renders the same ConceptsDictionaryBody: the same
 * person, the same GET /api/dictionaries/concepts, the same FAQ, search, sort, finder and rows.
 * The frame and the skin are the design's (DictionaryShell, `.dict-skin-light` in styles.css); its
 * rows open /dictionary/:coord.
 *
 * What it adds is the design's "Managed by" beside the title: which of the signed-in reader's
 * Assistants' Dictionaries to show, or all of them (managedDictionary.js). The choice lives in the
 * URL (?managedBy=<npub> or all); no value is the reader's own Dictionary, as before.
 *
 * The lede is the control panel page's, not the mock's: the mock says the Assistant already keeps
 * the entries up to date and that any entry can be vetoed, and neither is built yet (SPEC § 3).
 */
export default function DictionaryPage() {
  const person = useDictionaryPerson();
  const mine = useMyAssistants(person);
  const [params, setParams] = useSearchParams();
  const profiles = useProfiles(mine.rows.map((r) => r.pubkey));
  const options = useMemo(
    () => (person.signedIn && mine.status === 'ready' ? managerOptions({ rows: mine.rows, profiles, person }) : []),
    [person, mine, profiles],
  );
  const asked = params.get(MANAGED_BY_PARAM);
  const { choice, unknown } = parseManagedBy(asked, options);
  // A URL that names an Assistant waits for the list of Assistants; no value reads the reader's own at once.
  const pending = Boolean(asked) && person.signedIn && (mine.status === 'loading' || mine.status === 'idle');
  const view = person.signedIn && options.length ? managedView({ choice, options }) : null;
  const managed = pending ? { pending: true } : view && !view.person ? { ...view, options } : null;

  const pick = (key) => {
    const next = new URLSearchParams(params);
    const local = options.find((o) => o.local);
    if (local && key === local.key) next.delete(MANAGED_BY_PARAM);
    else next.set(MANAGED_BY_PARAM, managedByParam(key));
    setParams(next);
  };

  // "Your" for a signed-in reader, "The owner’s" signed out, nothing while the roster is still loading.
  const whose = person.loading ? '' : person.signedIn ? 'Your ' : 'The owner’s ';
  return (
    <DictionaryShell>
      <Eyebrow>Dictionary</Eyebrow>
      <div className="bsd-title-row">
        <h1 className="bsd-title">{whose}<span className="bsd-title-accent">Dictionary</span>.</h1>
        <ManagedBy person={person} status={mine.status} options={options} choice={choice} onPick={pick} />
      </div>
      <p className="bsd-lede">
        The concepts your trusted community generally accepts. You can add entries yourself; in a later version
        your Assistant will keep them up to date automatically, and you’ll be able to veto any entry.
      </p>
      {/* Only once the reader's Assistants are known can a link be said to name none of them. */}
      {unknown && person.signedIn && mine.status === 'ready' && (
        <p className="dict-pov text-muted bsd-managed-note">
          The link named a Dictionary that isn’t one of your Assistants’, so this is your own.
        </p>
      )}
      {person.signedIn && mine.status === 'error' && (
        <p className="dict-pov text-muted bsd-managed-note" role="status">
          Couldn’t load your Assistants, so this is your own Dictionary
          {asked ? ', not the one the link named' : ''}.{' '}
          <button type="button" className="dict-link-btn bsd-managed-retry" onClick={mine.reload}>Try again</button>
        </p>
      )}
      <div className="dict-page dict-skin-light">
        <ConceptsDictionaryBody entryHref={dictionaryEntryPath} managed={managed} />
      </div>
    </DictionaryShell>
  );
}
