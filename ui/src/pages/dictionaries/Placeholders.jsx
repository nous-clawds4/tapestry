import PlaceholderPage from '../../components/PlaceholderPage';

/**
 * Placeholder pages for the Dictionaries section (navigation-scaffolding #1).
 *
 * A "dictionary" here is the shared vocabulary a trust network demonstrably
 * uses — the thread running through the S1/S2/S3 subset taxonomy and the
 * existing Trusted Dictionary Snapshot. What each of these pages actually
 * shows is deliberately still open; nothing below commits to a model.
 *
 * Replace an export with a real page file when its surface is built.
 */

export function DictionariesIndex() {
  return (
    <PlaceholderPage title="📖 Dictionaries">
      <p>
        This page will list the dictionaries this instance knows about — each one a dated,
        attributed answer to "what vocabulary does this trust network actually use?"
      </p>
    </PlaceholderPage>
  );
}

export function DictionaryTags() {
  return (
    <PlaceholderPage title="📖 Tags">
      <p>
        This page will be the dictionary of tags — the tag vocabulary in use, rather than the
        raw list of every tag anyone has ever published.
      </p>
    </PlaceholderPage>
  );
}

export function DictionaryDLists() {
  return (
    <PlaceholderPage title="📖 DLists">
      <p>
        This page will be the dictionary of DLists — the lists in circulation, as distinct from
        the list headers stored on this instance.
      </p>
    </PlaceholderPage>
  );
}

export function DictionaryConcepts() {
  return (
    <PlaceholderPage title="📖 Concepts">
      <p>
        This page will be the dictionary of concepts — the concepts a trust network demonstrably
        uses, as distinct from the concept headers held in this instance's own graph.
      </p>
    </PlaceholderPage>
  );
}
