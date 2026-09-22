import { Fragment } from 'react';

/**
 * An action's description (ui/src/pages/assistant/actions.js): its strings as text, and each { text, href } part
 * as a link that opens in a new tab (assistant-management #1, ADR 0001 sub-decision 4). The page's cards and the
 * placeholder pages both render descriptions with it.
 *
 * On a card, the card-wide link sits over the description, so these links carry their own class, which lifts
 * them above it: following one opens the NIP, not the card's page.
 */
export default function ActionText({ parts }) {
  return (parts || []).map((part, i) => (typeof part === 'string'
    ? <Fragment key={i}>{part}</Fragment>
    : (
      <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="bs-assistant-hub-inline-link">
        {part.text}
      </a>
    )));
}
