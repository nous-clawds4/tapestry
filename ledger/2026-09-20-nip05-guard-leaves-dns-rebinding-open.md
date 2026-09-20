# The NIP-05 address guard resolves and then lets `fetch` resolve again, so a rebinding host can still be reached

**Id:** 2026-09-20-nip05-guard-leaves-dns-rebinding-open
**Type:** bug
**Opened:** 2026-09-20 (nip05-ssrf-guard #1 — carried forward from the intake entry's Architect call, 2026-05-17)
**Status:** OPEN
**Done:** —

`isPublicHostname()` resolves the name and demands that every answer be public; `fetch` then
resolves the same name independently. A host that answers a public address to the first query and a
non-public one to the second passes the guard and is reached anyway. This gap was identified when
the guard was designed and left open on purpose — it is recorded here so it is not mistaken for an
oversight.

**Why it was left open:** closing it airtight means pinning the vetted address into the socket,
which needs a custom `undici` dispatcher — a new direct dependency (`undici` is not currently
resolvable as one) and a materially larger change than the bug it would close. The house rule
against new tooling without an ADR applies.

**What bounds it today:** the scheme is hardcoded `https:`, there is a 5s abort, redirects are
refused, and the response body is parsed for one field and never returned to the caller. What a
successful rebind yields is therefore an existence/timing signal, not content — the same
"constrained oracle" posture the Story #6 review accepted as non-blocking. The guard did remove the
whole trivial case: direct IP literals and stable internal names.

**Fix shape when taken up:** evaluate adding `undici` as a direct dependency and give `guardedFetch`
a dispatcher whose `connect` uses the address the guard already vetted, rather than re-resolving.
Worth pairing with the redirect row above, since both live in `guardedFetch`.

**Pointer:** `src/utils/ssrfGuard.js` (module header, "Known and accepted limit");
`engineering-team/stories/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md` § Out of scope;
`engineering-team/stories/_intake.md` lines 77–146, Architect's call item 3.
