# Relay URLs are compared by two different rules: `relayKey`/`outsideOnly` and the stricter `normalizeRelayUrl`

**Id:** 2026-10-09-two-relay-url-normalizers
**Type:** cleanup
**Opened:** 2026-10-09 (book `assistant-outbox-relays` close; ADR assistant-outbox-relays/0001 § Consequences "debt noticed, not fixed")
**Status:** OPEN
**Done:** —

`relayKey` in `src/api/assistant/profilePublish.js` and the de-duplication in `outsideOnly`
(`src/api/setup/status.js`) compare relays by the whole URL lower-cased with every trailing slash removed.
`normalizeRelayUrl` in `src/lib/relay-list/index.js` parses the URL, lower-cases only the scheme and host, drops a default
port and one trailing slash, and refuses credentials and fragments. The Outbox Relays page and route use the strict rule
for the draft, the signed list and the "configured relay" check; the fan-out's de-duplication still goes through
`outsideOnly`. Two spellings the strict rule treats as different (a path differing only in case) are one relay to the
loose rule, and two the loose rule keeps apart (`:443` written out) are one relay to the strict rule. Nothing is known to
break today. Fix shape: one normalizer, the strict one, used by `relayKey`, `outsideOnly` and `readConfiguredRelays`,
with their suites re-aimed.

**Pointer:** `engineering-team/decisions/done/assistant-outbox-relays/0001-the-outbox-check-joins-the-one-attention-answer.md` § Consequences; `engineering-team/audits/assistant-outbox-relays/audit.md` § 5.
