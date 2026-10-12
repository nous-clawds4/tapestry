# A STRFRY_DOMAIN with a port, an IDN or an IPv6 literal would let the derived own relay be treated as an outside relay

**Id:** 2026-10-12-derived-relay-literal-domain-match
**Type:** bug (low; no deployment affected)
**Opened:** 2026-10-12 (duty-menu-public-relay #1 review, N1)
**Status:** OPEN
**Done:** —

**What could happen.** `instanceRelayUrl()` (`src/api/assistant/profileDefaults.js`) derives
`wss://<STRFRY_DOMAIN>/relay` and normalizes it. `outsideOnly()` (`src/api/setup/status.js:214-235`) recognizes this
instance by comparing a URL's hostname with `STRFRY_DOMAIN` as written. For a domain with a port
(`example.org:8443`), an IDN that URL parsing punycodes, or a bracketed IPv6 literal, the two spellings differ. The
Duty Menu check would then read its own relay as an outside relay, and the publisher would send to it as one: harmless,
but a wasted connection, and AC-4 of story duty-menu-public-relay #1 not held.

**Why it's low.** Every deployment's `DOMAIN_NAME` is a plain lower-case name (staging.brainstorm.world,
tapestry.brainstorm.world).

**Fix shape** (review round 1). Have `outsideOnly` compare normalized hosts. Parse `STRFRY_DOMAIN` through `new URL`
the same way as the candidate URL, and drop the port before comparing. Add a test per spelling.

**Pointer:** `engineering-team/reviews/done/duty-menu-public-relay/1-the-instances-public-relay-address.md` (N1).
