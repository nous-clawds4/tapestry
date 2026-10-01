import { COPY, TAG_KEYS, tagAvailability } from './myAssistants';

/**
 * "On your Treasure Map, but not tagged" (my-assistants #3, ADR my-assistants/0003 sub-decision 5; story AC-4): the
 * Assistants your Treasure Map gives duties to that aren't in your list, each with its name, URL · NIP-05, duty count
 * and two Tag buttons. The buttons do what the search card's do — the page's one `press`, so one at a time, disabled
 * while a tag is unpublished (its reason as their description), reported, then the list re-read; a tagged Assistant
 * moves into the list and out of here. With none, there is no section.
 *
 * Props: items ([{ pubkey, name, url, nip05, count }], mapOnlyAssistants with the profile fields); definitions (the
 * read's); busy ({ kind, pubkey, key } while a press publishes, else null); onTag(pubkey, tagKey).
 */
export default function MapOnlySection({ items, definitions, busy, onTag }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const availability = tagAvailability(definitions);
  const reasonId = (key) => `bsd-ma-maponly-reason-${key}`;
  return (
    <section className="bsd-ma-maponly" aria-labelledby="bsd-ma-maponly-heading">
      <h2 id="bsd-ma-maponly-heading" className="bsd-ma-section-title">{COPY.sectionHeading}</h2>
      <p className="bsd-ma-section-text">{COPY.sectionText}</p>
      {TAG_KEYS.filter((key) => !availability[key].enabled).map((key) => (
        <p key={key} className="bsd-ma-reason" id={reasonId(key)}>{availability[key].reason}</p>
      ))}
      <ul className="bsd-ma-maponly-list">
        {items.map((item) => (
          <li key={item.pubkey} className="bsd-ma-maponly-item">
            <div className="bsd-ma-maponly-who">
              <span className="bsd-ma-name">{item.name}</span>
              <span className="bsd-ma-maponly-meta">{item.url} · {item.nip05}</span>
              <span className="bsd-ma-maponly-count">{COPY.sectionLine(item.count)}</span>
            </div>
            <div className="bsd-ma-maponly-actions">
              {TAG_KEYS.map((key) => {
                const pressed = busy && busy.kind === 'tag' && busy.pubkey === item.pubkey && busy.key === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`bsd-ma-btn${key === 'brainstorm' ? ' is-primary' : ''}`}
                    disabled={!!busy || !availability[key].enabled}
                    aria-describedby={availability[key].enabled ? undefined : reasonId(key)}
                    onClick={() => onTag(item.pubkey, key)}
                  >
                    {pressed ? COPY.busy.tag : COPY.sectionTag[key]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
