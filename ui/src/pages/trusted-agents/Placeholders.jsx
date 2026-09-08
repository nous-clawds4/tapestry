import PlaceholderPage from '../../components/PlaceholderPage';

/**
 * Placeholder pages for the Trusted Agents section (navigation-scaffolding #1).
 *
 * "Trusted Agent" has no concept in the graph yet — the nearest neighbour is
 * `tapestry assistant`, which is not the same thing. Both pages below stay
 * deliberately vague about what an agent is.
 *
 * Replace an export with a real page file when its surface is built.
 */

export function MyTrustedAgents() {
  return (
    <PlaceholderPage title="🕵️ My Trusted Agents">
      <p>
        This page will show the agents you trust — who they are, what you have delegated to each
        of them, and what they have done on your behalf.
      </p>
    </PlaceholderPage>
  );
}

export function AllTrustedAgents() {
  return (
    <PlaceholderPage title="🕵️ All Trusted Agents">
      <p>
        This page will show every agent this instance knows about, trusted by you or not — the
        directory your own selection is drawn from.
      </p>
    </PlaceholderPage>
  );
}

export function TrustedAgentSetup() {
  return (
    <PlaceholderPage title="🕵️ Set Up a Trusted Agent">
      <p>
        This page is where you will pair a <strong>Sponsor</strong> with an <strong>Agent</strong>.
      </p>
    </PlaceholderPage>
  );
}
