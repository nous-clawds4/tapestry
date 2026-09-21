# ADR 0001: The instance assistant roster, and one main→delegate resolver

**Status:** Accepted
**Date:** 2026-09-20
**Story:** `engineering-team/stories/author-scoped-inspection/1-instance-assistant-roster.md`

## Context

The story asks the instance to state, in one read, which assistants it controls and whose account
each belongs to. Five facts constrain the design.

**Fact 1 — the routing already exists, and it returns private keys.**
`getAssistantKeys(pubkey)` (`src/utils/assistantKeys.js:20`) already routes owner → the
`tapestry-assistant` slot, anyone else → `getCustomerRelayKeys(pubkey)`. It returns
`{ privkey, pubkey, npub, nsec }`. Nothing that answers an HTTP request may call it and forward the
result.

**Fact 2 — the account rosters exist but are not joined to the assistants.**
`GET /api/get-customers` (`src/api/customers/getCustomers.js`) is **public** and already publishes
every *active* customer's `pubkey`, `name`, `display_name` and `status`. `getAdminPubkeys()`
(`src/utils/config.js:99`) reads settings.json then `brainstorm.conf`. The owner is
`BRAINSTORM_OWNER_PUBKEY`. Nothing joins these three to the assistant keys the instance issued.

**Fact 3 — the admin roster is deliberately private; the customer roster deliberately is not.**
`GET /api/admin/list` is registered behind `requireOwnerOnly` (`src/api/index.js:510`).
`GET /api/get-customers` has no guard. The auth middleware is default-deny for **mutations** only
(`src/middleware/auth.js`, security-auth-exposure ADR 0002); an unauthenticated `GET` is public
unless its path matches `protectedGetEndpoints` (`src/middleware/auth.js:491`), whose one
key-material entry is `/get-customer-relay-keys`. **The existing policy is legible: public-key
reads are public, key material is protected, and the admin roster is owner-only.** A blanket-public
roster carrying admins would silently defeat `/api/admin/list`'s guard.

**Fact 4 — a duplicate resolver already exists, and a second one is planned.**
`resolveAssistantPubkey(userPubkey)` is a private helper in
`src/api/auth/getUserClassification.js:10` — `getAssistantKeys` narrowed to its pubkey. Separately,
worksheet **W13** plans `resolveProvisionedDelegate(mainPubkey)` → owner-TA / customer-relay-key /
`null` for `open-ranking` story 3. That is the same function under a third name. Left alone, the
codebase acquires three mappings from a human's main pubkey to their delegated key.

**Fact 5 — provisioning is uneven by design.** Customers get an assistant at signup; the owner gets
one at first container startup; **admins get one only on request**
(`handleProvisionAssistantKey`, `src/api/assistant/index.js:476`). So "account with no assistant" is
a normal state, not an error — the story's AC-3.

Concepts: none written. `39998:<TA>:tapestry-assistant` — *"nostr profiles that correspond to
tapestry assistants"* — is the future home for assistants this instance does **not** control, and
is read-only context here. The roster answers a different question and must not be filed under it.

## Options considered

### Option A — One roster endpoint, session-shaped, built on an extracted pubkey-only resolver

Extract the singular, pubkey-only resolver into `src/utils/assistantKeys.js` (which already owns
the routing), and build the plural roster on top of it. The endpoint's *content* varies by caller:

| Caller | Owner | Active customers | Admins | Self |
|---|---|---|---|---|
| unauthenticated | ✅ | ✅ | ✖ | — |
| customer / admin | ✅ | ✅ | ✖ | ✅ always |
| owner | ✅ | ✅ | ✅ | ✅ |

Public content is exactly `get-customers` ⋈ assistant pubkeys — no new disclosure. Admins stay
owner-only, matching `/api/admin/list`. An authenticated caller always gets their own row so
"Mine" resolves for an admin who is otherwise undisclosed.

**Pros.** No new disclosure over what is already public. Honors the existing owner-only admin guard
instead of routing around it. One mapping, reused by `getUserClassification` and available to W13.
Works signed out, which story 3's fallback needs.
**Cons.** A response whose row set depends on the session is more to test than a constant one, and
a client cannot assume the roster it holds is complete.

### Option B — One roster endpoint, fully public, admins included

Simplest possible shape: one response for everyone.

**Pros.** Trivially cacheable and testable; no session branch.
**Cons.** Publishes the admin roster, which `/api/admin/list` deliberately withholds. Deciding that
in a story about a b-tags page — where it would arrive as a side effect — is the wrong place to
re-open a settled security posture. Rejected on that ground alone.

### Option C — Roster behind authentication entirely

Add the path to `protectedGetEndpoints`.

**Pros.** Most conservative; no disclosure question at all.
**Cons.** Breaks story 3's signed-out default (fall back to **Owner**): the page could not name the
owner's assistant without a session, though `/api/assistant/pubkey` already publishes it
unauthenticated. Protects data that is already public via two existing endpoints, so it buys
nothing and costs a working signed-out page.

## Decision

We chose **Option A**.

It is the only option that leaves both existing disclosure decisions where their authors put them:
customers public (`get-customers`), admins owner-only (`/api/admin/list`). The roster becomes a
*join* over already-published facts rather than a new disclosure, which is the same standard the
`shared-concepts-legibility` reads were held to — *"public deliberately: they reveal nothing an
observer could not read off the relay."*

**On fact 4 — one resolver, not three.** The pubkey-only singular lands in
`src/utils/assistantKeys.js` beside the routing it narrows.
`getUserClassification.js`'s private `resolveAssistantPubkey` is deleted and its one call site
repointed. W13's planned `resolveProvisionedDelegate(mainPubkey)` **is this function**; when
`open-ranking` story 3 is built it adopts this one rather than minting a third. The worksheet entry
should be annotated then, not now — this ADR does not edit `protocols/worksheet.md`.

**The private-key boundary is structural, not a convention.** The new singular returns a string or
`null`. It never returns an object that *could* carry `privkey`, so no caller can leak one by
forwarding too much. That is the property the test plan should pin.

## Consequences

- **Enables.** Story 3's person selector; the signed-out fallback; Avatar/AuthorCell knowing what
  an assistant is (ADR 0002). Any future surface that wants "whose is this?" has one place to ask.
- **Constrains.** The roster is *not* a complete list of assistants in the world, and code must
  never treat absence from it as "not an assistant" — only as "not one we control". Assistants
  controlled elsewhere are the `tapestry-assistant` concept's business, unbuilt.
- **A client cannot assume completeness.** A customer's roster omits admins. Story 3's person
  selector therefore offers what the roster returned, never a hardcoded set of roles.
- **Callers of `getAssistantKeys` are unchanged.** The private-key accessor keeps its signature and
  its existing signing call sites; this ADR adds a narrower sibling, it does not replace it.
- **New debt.** `protocols/worksheet.md` W13 still describes a resolver under a different name.
  Annotating it is a doc-lane follow-up for the book close, recorded in the epic.
- **Firmware reinstall required?** **No** — no concept definitions change.

## Implementation notes

- **File: `src/utils/assistantKeys.js`** — add and export
  `getAssistantPubkeyFor(accountPubkey)`: `async`, returns the assistant's **hex pubkey string** or
  `null`. Internally narrows `getAssistantKeys`; returns `null` on any throw, never a partial
  object. Do not widen the return type later — the string is the boundary.
- **File: `src/utils/assistantKeys.js`** — add and export
  `listInstanceAssistants({ includeAdmins })`: resolves owner (`BRAINSTORM_OWNER_PUBKEY`), active
  customers (`CustomerManager#listActiveCustomers`), and — only when `includeAdmins` — admins
  (`getAdminPubkeys()`); maps each through `getAssistantPubkeyFor`; returns rows of
  `{ accountPubkey, assistantPubkey, role, displayName }` where `assistantPubkey` is `null` when
  unprovisioned and `role` ∈ `owner | admin | customer`. **No other field.** An account appearing
  in more than one role is reported once under the most privileged (owner > admin > customer) —
  the multi-role gap is a known limitation and this is the narrow, local disambiguation, not a fix
  for it.
- **New file: `src/api/assistant/roster.js`** — `handleGetAssistantRoster(req, res)`. Reads
  `req.session?.pubkey`; `includeAdmins` iff that pubkey equals `BRAINSTORM_OWNER_PUBKEY`. When a
  session pubkey is present and absent from the rows, append its own row. Responds
  `{ success: true, assistants: [...], viewer: { accountPubkey, assistantPubkey } | null }`.
- **File: `src/api/assistant/index.js`** — re-export `handleGetAssistantRoster`.
- **File: `src/api/index.js`** — register `app.get('/api/assistant/roster', …)` beside the other
  `/api/assistant/*` routes at `:535–539`. **No middleware entry.** Do *not* add the path to
  `protectedGetEndpoints`; the handler shapes its own content. Check the chosen path does not
  contain any `protectedGetEndpoints` substring — that list matches with `.includes()`
  (`src/middleware/auth.js:498`), so a careless path could be silently 401'd.
- **File: `src/api/auth/getUserClassification.js`** — delete the private
  `resolveAssistantPubkey` (`:10–18`); call `getAssistantPubkeyFor` instead. Response shape
  unchanged.

**Deploying to check it.** The `tapestry` container has **no source bind mount** — verified this
session: its only mounts are the four named volumes (logs, neo4j, strfry, brainstorm data). Server
changes reach the running stack by `docker cp` + a `supervisorctl restart`, not by editing on the
host. CLAUDE.md's claim that the repo is bind-mounted is stale for this container.

## Out of scope

- Assistants this instance does not control, and the `tapestry-assistant` concept's elements.
- Provisioning, rotating or repairing an assistant key.
- Inactive, suspended or mid-provisioning customers: the roster reports the **active** roster, as
  `listActiveCustomers` defines it.
- Caching. `CustomerManager` already caches `customers.json`; no additional layer is designed here.
- Editing `protocols/worksheet.md` W13.
- Any change to `getAssistantKeys`, `getCustomerRelayKeys`, or any signing path.
