import DevPage, { S } from './DevPage';

export default function DevelopersRelayTools() {
  return (
    <DevPage
      title="Relay Tools"
      intro={<>Spam-screening for your own relay, powered by your web of trust.</>}
    >
      <p style={S.p}>
        <a href="https://relay.tools" target="_blank" rel="noreferrer">Relay Tools</a> is a nostr relay
        hosting service. Your Relay Tools relay draws a personalized whitelist of pubkeys from Brainstorm
        over an API and uses it to screen out spam — so the people your web of trust vouches for are the
        ones who can write to your relay.
      </p>

      <p style={{ ...S.p, marginTop: '2rem', opacity: 0.6 }}>Documentation coming soon.</p>
    </DevPage>
  );
}
