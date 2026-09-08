import Breadcrumbs from '../../components/Breadcrumbs';
import PlaceholderPage from '../../components/PlaceholderPage';

/**
 * Placeholder pages for the Dictionaries section (navigation-scaffolding #1).
 *
 * A "dictionary" here is the shared vocabulary a trust network demonstrably
 * uses — the thread running through the S1/S2/S3 subset taxonomy and the
 * existing Trusted Dictionary Snapshot.
 *
 * Replace an export with a real page file when its surface is built.
 */

/**
 * The index carries the operator's own statement of the dictionary model
 * (navigation-scaffolding #3) — the first written form of it, and what later
 * work will be built against. The prose is VERBATIM; only paragraph breaks
 * were added. Don't paraphrase it, tighten it, or "fix" its punctuation — if
 * the model changes, change it deliberately, not in passing.
 *
 * The page is still a placeholder: nothing it describes is built yet.
 */
export function DictionariesIndex() {
  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📖 Dictionaries</h1>
      <div className="page-prose">
        <p>
          There are currently three dictionaries: Tags, DLists, and Concepts. More will be added
          later. Each Dictionary is a concept, and each dictionary entry is an element of its
          corresponding concept. (But that only works for the Tapestry Owner. And so: Conversely,
          for users who do not have their own neo4j: each dictionary may be a DList Header, and each
          dictionary entry may be an item on that dlist.)
        </p>
        <p>
          The primary criteria to be an element (or item) of any given dictionary is usage and
          acceptance by the community. There may be more than one way to measure usage and
          acceptance, and the precise criteria for any given dictionary may evolve over time. This is
          exemplified by Tags: criteria may be based on direct usage, on b-tags, and/or on pins.
          These criteria can be used to keep track of dictionary entries dynamically and
          automatically. Which means that dictionary entries can be added and removed automatically.
          Which means there needs to be a property specified by the DList header (or Concept Header)
          to flag elements / items that are considered no longer valid items.
        </p>
        <p>
          But there is a second way to gain entry into a dictionary, and that is to be added by hand
          by the steward of the dictionary. For Tapestry, that typically means: the owner of the
          Tapestry instance. Being added by hand will override community-based criteria. Therefore,
          each dictionary concept needs to have a field to keep track of whether it is added by hand,
          lest it be removed from the concept by automated scripts.
        </p>
      </div>
      <div className="placeholder">
        <p><strong>Placeholder page.</strong></p>
        <p>None of the above is built yet — this page describes the model, it does not run it.</p>
      </div>
    </div>
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
