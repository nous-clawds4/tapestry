import DevPage, { S } from './DevPage';

export default function DevelopersTrustedAssertions() {
  return (
    <DevPage
      title="Trusted Assertions"
      intro={<>Portable web-of-trust scores, published as ordinary nostr events.</>}
    >
      <p style={S.p}>
        Trusted Assertions are <code style={S.code}>kind 30382</code> nostr events carrying web-of-trust
        scores — rank, verified follower counts, and related metrics — published by a trust authority
        about other pubkeys.
      </p>
      <p style={S.p}>
        Because they are ordinary signed nostr events, any client can fetch them, verify who signed them,
        and apply its own trust perspective without depending on this instance.
      </p>

      <p style={{ ...S.p, marginTop: '2rem', opacity: 0.6 }}>Documentation coming soon.</p>
    </DevPage>
  );
}
