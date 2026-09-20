# NIP-05 verification stopped following redirects, so a domain that serves `/.well-known/nostr.json` behind a 30x now fails to verify

**Id:** 2026-09-20-nip05-verification-no-longer-follows-redirects
**Type:** bug
**Opened:** 2026-09-20 (nip05-ssrf-guard #1 — recorded when the change was made, not after it bit)
**Status:** OPEN
**Done:** —

`src/utils/ssrfGuard.js` `guardedFetch` sets `redirect: 'manual'`, and all three NIP-05
verification call sites map a non-`ok` response to `null`. A 301/302/303/307/308 is therefore a
failed lookup. This was **chosen deliberately** at the story's Planning gate on 2026-09-20, over the
alternative of following hops and re-running the address guard on each one. The reason for the
stricter option: following a redirect lets a public host that passes the guard aim the next request
wherever it likes, which is the cheapest way around a first-hop-only check.

**The accepted cost, stated plainly:** a domain whose `/.well-known/nostr.json` is reached through a
redirect — apex → `www`, a CDN-level host or scheme canonicalisation, a path rewrite — verified
before this change and does not verify after it. The failure is fail-closed (`verified: false`,
never a false positive) and NIP-05 does not require clients to follow redirects, so nothing is
*incorrect*; but it is a real behaviour change for legitimate domains and it is silent from the
user's side — a checkmark simply does not appear.

No such domain is known to be affected. This row exists so that if one is reported, the cause is
one grep away instead of a fresh investigation.

**Fix shape if it bites:** switch `guardedFetch` to a bounded manual follow — `redirect: 'manual'`,
then read `Location`, resolve it against the current URL, require `https:`, run `isPublicHostname`
on the new host, repeat up to ~3 hops. That was option 1 at the Planning gate and is ~20 lines
inside the shared helper; no call site changes. `MAX_REDIRECTS` already exists in the module as the
place that count would live.

**Pointer:** `src/utils/ssrfGuard.js` (`guardedFetch`, `MAX_REDIRECTS`);
`engineering-team/stories/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md` § Open questions 1;
tests `D1`/`D2` in `test/nip05-ssrf-guard.test.js`.
