# ADR 0003: One default assistant profile — a role-free definition, one public-instance rule, one finishing step for every publish

**Status:** Accepted (Amendment 1 appended 2026-09-21 — the status seam keeps story 2's literal publish list)
**Date:** 2026-09-20
**Story:** `engineering-team/stories/assistant-profile/3-one-default-assistant-profile.md`

## Context

The story replaces three definitions of an assistant's default kind 0 with the one the owner ratified
on 2026-09-11. The table and the verbatim about text are in the story. In short:

- **Name and display name:** "‹name›'s Tapestry Assistant", or "npub...‹last 6›'s Tapestry Assistant"
  when the person has no name.
- **About:** two fixed paragraphs. The first names "‹name› (‹npub›)", or "‹npub›" alone.
- **Picture:** the branded avatar, always. On a public instance it is the instance's own copy;
  otherwise it is the reference deployment's copy.
- **Website, NIP-05 and a `["client", "‹domain›"]` tag:** only on a public instance. NIP-05 and the tag
  go on *every* assistant profile a public instance publishes, whether default or edited.
- **A public instance** is defined in the story. It is not loopback, not a private-network address, not
  a `.local`, `.internal` or `.home.arpa` name, and not a bare hostname.

AC4 adds that no value the app itself supplies is ever a loopback, private-network or relative URL.
That covers a default, the branded image and a generated badged avatar. AC5 adds that every path that
publishes an assistant profile starts from this one definition.

### Concept-graph orientation

- The local graph (TA `e00ed090…`) answers `/summaries` with 9 concepts, and none of them is
  `nostr-user`. So I oriented against staging.
- Staging's `/summaries` lists `39998:8e901369…:nostr-user`, with 0 elements.
  - Its `/neighbors` returned only class-thread wiring: the superset, the JSON schema, the concept graph
    and the core-nodes graph.
  - No property models a kind 0 profile.
  - Staging then went 502 during a deploy, so a follow-up read of the schema node did not land.
    **Re-verify the handle** against a populated graph if it ever becomes load-bearing.
- As the story expected, the kind 0 is a nostr event this instance signs, not a knowledge-graph node.
  **No concept changes, and no firmware reinstall.**

### Codebase facts this design rests on (verified on `6fd8759d`)

**Today's server default.** `buildDefaultProfileContent(pubkey, isOwner)`
(`src/api/assistant/index.js:162-198`) has two branches.

- Admins get the Customer branch.
- The Customer fallback name is the literal `'a customer'` (`:187`, OPEN.md row 154).
- The person's name comes from `getKind0DisplayName` (`:44-64`). That is a `strfry scan` of the local
  relay only.
- `website` is `getInstanceWebsite()` (`:85-88`).
  - On a dev box that is `https://localhost:7777`.
  - This is because `getInstanceDomain()` (`:70-79`) falls back to the host in `BRAINSTORM_RELAY_URL`.
- The picture is gated on `isPubliclyReachable()` (`:99-110`). That check admits RFC1918 addresses,
  `.internal` names and `.home.arpa` names (OPEN.md row 148).
- **Live, 2026-09-20.** I sent an anonymous `GET /api/assistant/status` for a pubkey with no key.
  - Local, staging and production all propose "a customer's Tapestry Assistant".
  - Local also proposes `website: https://localhost:7777` and no picture.

**The publish handler.** `createPublishProfileHandler(deps)` (`:246-385`) is the dependency seam from
ADR 0002.

- The content is the sanitized user `content`, or else `d.buildDefaultProfileContent(...)`
  (`:292-294`).
- `nip05` is always set to `‹localPart›@getInstanceDomain()` (`:300-303`). On a dev box that is
  `…@localhost:7777`.
- The `nostr.json` mapping is always written (`:345-350`).
- The event goes out with `tags: []` (`:317`).

**The status handler.** `handleAssistantStatus` (`:396-459`):

- builds `defaults` for every caller, anonymous callers included (`:408`);
- computes `computedNip05` from the local-only name (`:417-420`);
- decides `allowRelayFallback` (`:428-437`, ADR 0001) only after both of those.

**The shared address classifier already exists.** It is `src/utils/ssrfGuard.js` (nip05-ssrf-guard #1,
merged 2026-09-20).

- It exports `isPublicAddress(ip)` (`:179-186`) and `hasPrivateHostSuffix(host)` (`:201-209`). Both are
  synchronous and do no I/O.
- Its header (`:19-21`) says row 148 "is scheduled into `assistant-profile` #3, which should import
  these rather than grow a second, divergent copy".
- I ran the composition this ADR specifies against the story's cases:
  - **public:** `staging.brainstorm.world`, `tapestry.brainstorm.world`;
  - **not public:** `localhost`, `localhost:7777`, `127.0.0.1:7777`, `[::1]:7777`, `10.0.0.5`,
    `172.16.4.2`, `192.168.1.50:7777`, `[fd12:3456::1]`, `169.254.169.254`, `nas.internal`,
    `box.local`, `router.home.arpa`, `myhost` and `''`.

**The editor** — `ui/src/components/AssistantProfileEditor.jsx`.

- It already offers exactly the seven editable fields (`PROFILE_FIELDS`, `:12-20`).
- It shows the NIP-05 read-only, from `status.computedNip05` (`:298-303`).
- "Use the branded image instead" falls back to the relative path `/ta-avatar.png` (`:170`).
- "Use this avatar" writes `data.url || data.path` (`:159`). Whenever the instance is not public, that
  is the relative `/generated/…` path — the "relative picture URL" in the story's Background.

**The other writers.** A repo-wide search finds no other server path that signs an assistant kind 0.

- The dashboard's "🎲 Surprise me" (`ui/src/pages/Dashboard.jsx:755-783`) signs its own literals: the
  name `'Tapestry Assistant'` and a robohash picture.
  - It publishes through `POST /api/strfry/publish` with `signAs: 'assistant'`.
  - ADR 0001 made it Owner-only (`:27`).
- The legacy pages (`public/pages/nip85.html:214-218`, `public/pages/customers/customer.html:926-930`)
  post to `publish-profile` with no `content`. So they already publish the server's default.

**The badged avatar.** `storeCompositeAvatar` (`src/api/assistant/avatar.js:110-117`) gates its
publishable URL on `isPubliclyReachable(getInstanceWebsite())`. ADR ta-avatar/0003 D4 kept that single
predicate on purpose, so that fixing it in one place fixes it for both stories.

**Reading a person's kind 0 from relays.**

- ADR 0001 has a per-relay helper, `realQueryRelaysKind0` (`src/api/assistant/profileState.js:75-95`).
  - It asks each relay separately against one deadline.
  - It loads its libraries lazily, so it is safe in a bare checkout.
  - It is not exported.
- `/api/profiles` uses `getProfiles`, which cannot be reused:
  - it loads nostr-tools and ws by container-absolute path when the module loads
    (`src/api/profiles/fetchProfiles.js:14-21`);
  - it asks the relays before the local relay;
  - it skips the local relay when its race times out (OPEN.md row 273);
  - it is not exported.
- The profile relays are `aRelays.aProfileRelays` (purplepag.es and profiles.nostr1.com).
  `getConfiguredPublishRelays` (ADR 0002, `src/api/assistant/profilePublish.js:59-87`) already parses
  relay settings defensively.
- **Measured 2026-09-20** from a dev host, with a scratch copy of that helper: both profile relays
  answered a kind 0 request in about 0.6 s.

**The reference avatar.** `https://tapestry.brainstorm.world/ta-avatar.png` answered `200 image/png`,
16,863 bytes, on 2026-09-20. Its SHA-256 matches the committed `ui/public/ta-avatar.png` (512×512).

**The setup hook.** `ui/src/hooks/useAssistantSetupState.js:37` calls `/api/assistant/status` on every
signed-in dashboard load. It reads only `success`, `hasRelayKey` and `hasProfile`.

### Constraints

- No new dependencies and no new tooling (CLAUDE.md).
- **Principle 1.** The default always belongs to *the viewer's own* assistant and is derived from that
  person. It is never the instance TA's default.
- **Principle 4.** Nothing here may remove local state. A person's kind 0 read from a relay is their
  letter, not this instance's, so it is not copied into the local relay.
- **The epic's guardrail.** No already-published profile changes until its user re-publishes.
- **Degrade honestly.** The app never publishes anything dead, loopback, private-network or relative.
- **The story's ratified values are fixed inputs.** That includes the reference-deployment URL and the
  three-dot `npub...` form. This ADR decides only how to produce them.

## Options considered

### Option A — A role-free definition module that both handlers use

A new module, `src/api/assistant/profileDefaults.js`, owns everything the story defines:

- **The instance description:** `{ domain, isPublic, website, avatarUrl }`. `isPublic` comes from
  ssrfGuard's two synchronous classifiers.
- **The person's name:** the local relay first, then the profile relays.
- **A pure builder** of the default content, with no role parameter.
- **A finishing step** that every published profile passes through. It sets or strips NIP-05 and the
  client tag.

Both handlers call it. The rest of Option A:

- `isPubliclyReachable` and `getInstanceWebsite` stay as thin wrappers, so the badged avatar follows the
  same rule with no change to its own module.
- "Surprise me" publishes through `publish-profile`.
- The editor stops supplying URLs that cannot be published.

**Pros**

- AC1 holds by construction, because the builder cannot see a role.
- AC3 holds by construction, because no signed assistant kind 0 skips the finishing step.
- Row 148 closes in one place, for the default and the composite alike.
- The builder and the finishing step are pure, so every row of the story's table can be pinned
  without a stack. That matters here: the local stack serves the main checkout, not this branch.

**Cons**

- A new module and a second handler seam, which is more surface than an in-place patch.

### Option B — Patch the existing builder in place

- Collapse the two branches inside `buildDefaultProfileContent`.
- Extend `isPubliclyReachable` to RFC1918, ULA, `.internal` and `.home.arpa` — row 148's suggested fix.
- Add a relay fallback inside `getKind0DisplayName`.
- Gate `website`, `nip05` and the tag inline in the handler.

**Pros**

- The smallest diff.

**Rejected, because**

- It writes a second address classifier next to ssrfGuard's, which asks by name not to be forked.
- "Every published profile carries NIP-05 and the tag on a public instance" would then depend on
  statement order inside one handler. It would not be a function that every publish must pass through.
- The builder stays async and tied to the config file and strfry. AC1 ("three roles, one table") could
  then only be checked against a live stack, and the only local stack serves another branch.

### Option C — Build the default in the browser

The editor already fetches the signed-in user's profile. It could fill in the table and send the result
as `content`.

**Rejected, because**

- The legacy pages and "Surprise me" publish with no `content`, so the server needs the definition
  anyway. That makes two definitions again, which is the failure this story removes.
- The browser cannot be the authority on whether the instance is public, or on the server-managed
  NIP-05.

## Decision

We chose **Option A**.

AC1, AC3 and AC5 are all statements about *every* path. Only Option A makes each of them true by
construction rather than by discipline:

- no role reaches the builder;
- no signed assistant kind 0 skips the finishing step;
- there is no second copy of "public" that could drift.

### Sub-decisions

**1. "Public instance" is a syntactic check of the configured domain. There is no DNS lookup.**

- The domain is read as it is today: `STRFRY_DOMAIN`, else the host in `BRAINSTORM_RELAY_URL`, else
  `localhost`. It may include a port.
- Parse it as `https://‹domain›` and take the hostname.
  - An IP literal is classified with `isPublicAddress`.
  - A name is public unless `hasPrivateHostSuffix` says otherwise.
  - Anything that does not parse is not public.
- We do not use ssrfGuard's DNS-resolving `isPublicHostname`:
  - it would add I/O to every status call and every publish;
  - Docker's resolver can answer differently from the public internet;
  - a resolver hiccup at publish time would strip NIP-05 and the client tag from a signed event that
    relays copy onward.
- The same configuration must always give the same answer.
- `isPubliclyReachable(url)` keeps its name, signature and export, and delegates to the same check.
- `getInstanceWebsite()` returns `''` when the instance is not public.
- Together, these mean `avatar.js` follows the rule without being changed, as ADR ta-avatar/0003 D4
  intended.

**2. ‹name› comes from the local relay first, then the instance's profile relays.**

- **Which field.** Take `display_name`, else `name`. Collapse runs of whitespace and trim the ends. An
  empty or whitespace-only value counts as no name. This is the precedence the app uses everywhere
  else.
- **Local first.** If the newest kind 0 on the local relay has a name, use it, and ask no relay.
- **Then the profile relays.** Otherwise, ask the profile relays (`aRelays.aProfileRelays`):
  - use ADR 0001's per-relay helper, within ADR 0001's relay budget;
  - the newest kind 0 among what they return *and* the local one decides, so an older copy that has a
    name cannot override a newer profile with no name.
- **Memo.** Relay answers, found or not, are remembered per person for 10 minutes.
- **Who may trigger it.** The relay step runs only for callers ADR 0001 already lets reach relays: the
  signed-in person, the Owner, an Admin, or the in-container operator.
  - An anonymous call reads the local relay only.
  - So a public GET cannot make the server query relays about arbitrary pubkeys.
- **Nothing is copied into the local relay.** The person's kind 0 is their letter, not this instance's.
- **Local-only publish mode does not stop the lookup.** The lookup is a read, as `/api/profiles` is;
  that mode governs only what this instance *sends*.

**3. The same ‹name› feeds the NIP-05 local-part.**

- The story writes the local-part as `‹name›-tapestry-assistant-‹6 hex›`, using the table's own
  placeholder. Its format stays unchanged.
- The alternative would be a separate local-only reader just for the NIP-05. That leaves two answers to
  "what is this person called", which is the kind of inconsistency this epic removes.

**4. `/api/assistant/status` keeps `defaults` in its answer; the dashboard's check opts out with
`defaults=0`.**

- With `defaults=0`, the handler skips the name lookup and leaves out `defaults` and `computedNip05`.
- `hasProfile` is decided exactly as before, so ADR 0001's "one answer" is untouched.
- **Why the dashboard opts out.** The setup hook runs on every signed-in dashboard load, and it never
  reads the defaults. Without the opt-out it would wait about 0.6 s on each memo miss, or up to the 4 s
  budget if a profile relay went silent.
- **When defaults are wanted,** the name lookup runs *at the same time* as the setup-state check, so the
  status call's worst case does not grow.
- **The status call now validates `customerPubkey`** as 64 lowercase hex characters, as the publish call
  already does. The defaults need the person's npub, and it can only be derived from a valid pubkey.

**5. One function finishes every assistant kind 0, and the handler's default cannot be swapped out.**

- `finalizeAssistantProfile` always removes any `nip05` it is given and drops empty strings.
- On a public instance it then sets `nip05 = ‹localPart›@‹domain›` and returns
  `tags: [["client", ‹domain›]]`.
- On any other instance it returns no NIP-05 and `tags: []`.
- The `nostr.json` mapping is written only on a public instance. An existing mapping is never deleted.
- The publish handler calls the pure builder directly, not through its dependency seam. Tests can
  replace the name lookup and the instance, but never the definition itself.

**6. "Surprise me" publishes the one default.**

- It posts `{ customerPubkey: user.pubkey }` to `/api/assistant/publish-profile`, with no `content` —
  the same call the legacy pages make.
- Its literals, its robohash picture and its use of the generic signer for kind 0 all go.
- It is relabelled "✨ Use the default profile", because a fixed default is no surprise.
- It stays Owner-only. Story 5 still removes it.
- We rejected the two alternatives. Removing it now would take on story 5's work, and leaving it as it
  is would fail AC5.

**7. The editor supplies only absolute, public URLs.**

- "Use the branded image instead" takes `status.defaults.picture`, which is always absolute.
- "Use this avatar" takes only the upload's `url`. If that is empty, the instance is not public: the
  editor says so and offers the branded image, instead of the relative `path`.
- The relative `/ta-avatar.png` stays only as the `src` of the in-app preview image.
- When the instance is not public, the NIP-05 line says that no NIP-05 is published, and why.

**8. The reference deployment's URL is one named constant.**
`REFERENCE_TA_AVATAR_URL = 'https://tapestry.brainstorm.world/ta-avatar.png'` lives in the new module
and is used only when the instance is not public.

**What we trade away**

- A URL for another deployment now lives in the code. Profiles from non-public instances depend on the
  reference deployment staying up. This was ratified at approval.
- A new module and a second handler seam add surface area.
- A query flag on `/status` adds a little to its contract.
- Some Customers' assistant NIP-05 addresses change on their next publish (sub-decision 3).

## Consequences

**Enables**

- One answer to "what is my assistant's default?", for every role and every publish path.
- Story 4's page can read `defaults`, `computedNip05` and `isPublicInstance` from `/status` as they are.
- Story 5 has one publish path left to protect, plus the generic signer to close.

**Partly supersedes two shipped ADRs.** Both live under `decisions/done/ta-avatar/` and are left
unedited as history.

- **ta-avatar/0002:** its "no public address, no picture" rule, its "never a literal domain" rule, its
  generic owner name `'Tapestry Assistant'`, and its two branches.
- **ta-avatar/0003 D4:** the rule inside `isPubliclyReachable` changes, but D4's structure (one shared
  predicate) is kept.

**What people see after their next publish.** Nothing that is already published changes on its own.

- Every role's default follows the table, and no default reads "a customer's Tapestry Assistant".
- A Customer whose name is only on the profile relays gets that name in the default, and in their
  assistant's NIP-05 local-part.
- A dev or LAN instance stops publishing `https://localhost:7777`, `…@localhost:7777`, and relative or
  private pictures. Its default picture is the reference deployment's copy.
- A public instance's assistant profiles carry `["client", "‹domain›"]`.
- "Use the default profile" publishes to the configured relays, not only to the local relay.

**Latency**

- The dashboard check is unchanged, because it opts out.
- The editor's first load per person per 10 minutes can wait for the name: about 0.6 s, or up to 4 s if a
  profile relay is silent. That wait overlaps the setup-state check.
- A publish can wait the same amount before it signs.

**Coupling.** A non-public instance's default picture lives on `tapestry.brainstorm.world`.

- If the image there changes, every profile that uses it changes too. That is intended for a brand mark
  (see ta-avatar/0002).
- If that host moved, those pictures would break until each profile is re-published.

**Known gaps, named on purpose**

- **Stale values in the form.** The editor prefills from the published profile. So a value that an
  *older* default supplied — for example `website: https://localhost:7777` — stays in the form. If the
  user publishes without editing, it is published again.
  - Validating fields a user edits is out of the story's scope.
  - "Reset to defaults" clears it.
- **The kind 10040 sentence can be wrong.** For someone with assistants on several instances, the about
  text's kind 10040 sentence can be false (OPEN.md row 267). It is kept as approved.
- **The NIP-05 local-part can change.** Take two publishes more than 10 minutes apart. If the profile
  relays fail during the second, its local-part loses the name. Each publish rewrites the kind 0 and
  `nostr.json` together, so the address always verifies.

**OPEN.md.** Rows 148 and 154 close when this story passes review.

**Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

### New — `src/api/assistant/profileDefaults.js`

**Loading and dependencies**

- Dependencies can be injected the way `profileState.js` does it: `options.deps?.X ?? options.X ?? realX`.
- Only `net` and `../../utils/ssrfGuard` are required at the top level. (`ssrfGuard` itself needs only
  `net` and `dns`.)
- `nostr-tools`, `../../utils/config`, `./profileState` and `./profilePublish` are required lazily,
  inside the functions that use them, so the module loads in a bare checkout.

**Constants**

- `TA_AVATAR_PATH = '/ta-avatar.png'`
- `REFERENCE_TA_AVATAR_URL = 'https://tapestry.brainstorm.world/ta-avatar.png'`
- `NAME_MEMO_MS = 10 * 60 * 1000`
- The relay budget is `profileState.RELAY_BUDGET_MS`.

**`isPublicHost(host)` → boolean**

- Lowercase it, drop one trailing dot, and remove the brackets from an IPv6 literal.
- Empty → false.
- If `net.isIP(host)` → `isPublicAddress(host)`; otherwise → `!hasPrivateHostSuffix(host)`.

**`isPublicDomain(domain)` → boolean**

- Take the hostname of `new URL('https://' + domain.trim())`, then apply `isPublicHost`.
- A parse failure → false.

**`getInstanceDomain(options)`**

- Moved unchanged from `index.js:70-79`, with a `getConfigFromFile` dependency.

**`describeInstance(options)` → `{ domain, isPublic, website, avatarUrl }`**

- `website`: `https://‹domain›` when public, else `''`.
- `avatarUrl`: `https://‹domain›/ta-avatar.png` when public, else `REFERENCE_TA_AVATAR_URL`.

**`nameFromProfileEvent(event)` → string**

- Parse `event.content`.
- Take `display_name`, else `name`. Use strings only; replace `/\s+/g` with `' '` and trim.
- Return `''` for a missing event, invalid JSON, or no usable value.

**`resolvePersonName({ personPubkey, allowRelayLookup = false, deps })` → `{ name, source }`**

`source` is `'local'`, `'relay'` or `null`. The dependencies:

- `scanLocalKind0` — default `profileState.scanLocalKind0`;
- `queryRelaysKind0` — default `profileState.queryRelaysKind0`;
- `getProfileRelays` — default `readConfiguredRelays(['aProfileRelays'])`;
- `now`;
- `memo` — a module-level `Map`.

The steps, in order:

1. **Local.** Scan the local relay. If it has a usable name, return `{ name, source: 'local' }`. No relay
   traffic.
2. **The gate.** If `!allowRelayLookup`, return `{ name: '', source: null }`.
3. **The memo.** If there is an entry younger than `NAME_MEMO_MS`, return its name. `source` is
   `'relay'` if the name is non-empty, else `null`.
4. **The relays.**
   - Call `queryRelaysKind0(getProfileRelays(), personPubkey, { maxWait: RELAY_BUDGET_MS })` inside the
     `BACKSTOP_MS` backstop.
   - Keep only events where `kind === 0 && pubkey === personPubkey`.
   - Take the newest by `created_at`, comparing those events with the local event from step 1 if there
     was one.
5. **Record.** Store `{ name, at: now() }` in the memo, found or not. Any error or timeout counts as not
   found.

**`getPersonName(pubkey, { allowRelayLookup } = {})` → `Promise<string>`**

- Returns `resolvePersonName(...).name`. This is the handlers' dependency.

**`personNpub(pubkey)`**

- Returns the full npub, via `nip19.npubEncode`.

**`defaultAbout(personName, npub)`**

- Returns the story's two paragraphs, joined by `\n\n`.
- The second paragraph is a verbatim constant: the story's quoted lines joined with single spaces.
- The first paragraph reads, with a name:
  `I am the Tapestry Assistant for ‹name› (‹npub›). You can find my pubkey in my owner's kind 10040 event.`
- Without a name:
  `I am the Tapestry Assistant for ‹npub›. You can find my pubkey in my owner's kind 10040 event.`

**`buildDefaultProfile({ personPubkey, personName, instance })`**

A pure function with no role parameter. It returns exactly these keys:

- `name` and `display_name`: `‹name›'s Tapestry Assistant`, or `npub...‹npub.slice(-6)›'s Tapestry
  Assistant`. Use three ASCII dots and an ASCII apostrophe.
- `about`: `defaultAbout(...)`.
- `picture`: `instance.avatarUrl`.
- `website`: `instance.website`.
- `banner`, `nip05` and `lud16`: `''`.

**`finalizeAssistantProfile({ content, instance, nip05LocalPart })` → `{ content, tags }`**

A pure function.

- Copy `content`, leaving out `nip05` and any `''` values.
- On a public instance, add `nip05: ‹nip05LocalPart›@‹instance.domain›` and return
  `tags: [['client', instance.domain]]`.
- Otherwise return `tags: []`.

### Changed — `src/api/assistant/profileState.js`

- Export `RELAY_BUDGET_MS`, `BACKSTOP_MS` and `withinBudget`.
- Export the two real helpers under the names `scanLocalKind0` and `queryRelaysKind0`.
- No behaviour change.

### Changed — `src/api/assistant/profilePublish.js`

- Move the body of `getConfiguredPublishRelays` into a new exported function,
  `readConfiguredRelays(categories, options)`.
- `getConfiguredPublishRelays` calls it with `PUBLISH_RELAY_CATEGORIES`. No behaviour change.
- It remains the one parser of relay settings.

### Changed — `src/api/assistant/index.js`

**Delete**

- `getKind0DisplayName`, the two-branch builder, and `getInstanceDomain` (it moves to the new module).

**Keep, as thin wrappers**

- `getInstanceWebsite()` → `describeInstance().website`.
- `isPubliclyReachable(url)` → parse the URL, then `isPublicHost(hostname)`. Unparseable or empty →
  false.
- `buildDefaultProfileContent(personPubkey, options = {})` → `buildDefaultProfile(...)`.
  - It uses `options.personName`, or else
    `getPersonName(personPubkey, { allowRelayLookup: Boolean(options.allowRelayLookup) })`.
  - It uses `options.instance`, or else `describeInstance()`.
  - It stays exported, as the stack-free entry point for "the default for this person".

**`createPublishProfileHandler(deps)`**

- Dependencies: remove `getKind0DisplayName` and `buildDefaultProfileContent`; add `getPersonName` and
  `describeInstance`.
- After the key checks:
  1. `const instance = d.describeInstance()`.
  2. `hasUserContent = content && typeof content === 'object'`.
  3. `personName = (!hasUserContent || instance.isPublic) ? await d.getPersonName(customerPubkey, { allowRelayLookup: true }) : ''`.
     The name is only needed for the default content or for the NIP-05.
  4. The content is `sanitizeProfileContent(content)`, or else
     `buildDefaultProfile({ personPubkey: customerPubkey, personName, instance })`.
  5. `localPart = computeAssistantLocalPart(personName, assistantPubkey)`, unchanged.
  6. `{ content, tags } = finalizeAssistantProfile(...)`. The event carries those `tags`.
- Call `d.updateNip05Mapping` only when `instance.isPublic`.
- The response's `nip05` is `{ localPart, domain, address }` on a public instance, else `null`.
- Everything else stays as ADR 0002 left it. That includes the literal `getAssistantPublishRelays(` in
  the inner function's body, which S3 checks for.

**New seam — `createAssistantStatusHandler(deps = {})`**

- It returns `async function handleAssistantStatus(req, res)`.
- The module exports `handleAssistantStatus = createAssistantStatusHandler()`, so `src/api/index.js:538`
  does not change.
- Its dependencies, each defaulting to today's call:
  - `getOwnerPubkey`
  - `getAdminPubkeys`
  - `getAssistantKeys`
  - `getPersonName`
  - `describeInstance`
  - `resolveAssistantProfileState`
  - ~~`getPublishRelays` (default `getAssistantPublishRelays`)~~ *(Removed by Amendment 1, 2026-09-21: the
    seam takes no publish-list dependency.)*

The handler's steps:

1. Validate `customerPubkey` against `/^[0-9a-f]{64}$/`. If it fails, answer 400.
2. Set `wantDefaults = req.query.defaults !== '0'`.
3. Compute `allowRelayFallback` exactly as `:428-437` does today. Keep its literals (`localTrusted` and
   `sessionPubkey === customerPubkey`) in the inner body, because story 1's S2 reads them there.
4. `instance = d.describeInstance()`, then look up the keys.
5. **No key:** answer `{ success, hasRelayKey: false, hasProfile: false, profileSource: null, isPublicInstance }`.
   Add `defaults` when `wantDefaults`.
6. **Otherwise,** run both lookups at once:
   `const [personName, state] = await Promise.all([wantDefaults ? d.getPersonName(customerPubkey, { allowRelayLookup: allowRelayFallback }) : '', d.resolveAssistantProfileState({ assistantPubkey, allowRelayFallback, getPublishRelays: d.getPublishRelays })])`.
   *(Amended 2026-09-21 — see Amendment 1: pass `getPublishRelays: getAssistantPublishRelays`, written
   literally, not `d.getPublishRelays`.)*
7. **Answer** with every existing field, plus `isPublicInstance`:
   - `defaults` is `buildDefaultProfile(...)`;
   - `computedNip05` is `{ localPart, domain, address }` when public, else `null`;
   - leave out both keys when `!wantDefaults`.

**Exports**

- `module.exports` adds `createAssistantStatusHandler` and keeps every current name.

### Changed — `ui/src/hooks/useAssistantSetupState.js:37`

- Request `…/status?customerPubkey=${user.pubkey}&defaults=0`.
- Story 1's D3 regex still matches.

### Changed — `ui/src/components/AssistantProfileEditor.jsx`

- **`useBrandedFallback`** (`:169-173`): call `updateField('picture', status.defaults.picture)` only when
  that is a non-empty string. There is no relative fallback value.
- **`useComposite`** (`:149-167`): use only `data.url`. If it is empty:
  - clear the preview;
  - call `setOfferFallback(true)`;
  - say: "This instance has no public web address, so nostr clients elsewhere could not load an avatar
    stored here. Use the branded image instead."
- **The NIP-05 line** (`:298-303`):
  - when `computedNip05?.address` is set, it is unchanged;
  - when `status.isPublicInstance === false`, show: "NIP-05: none — this instance has no public web
    address, so no NIP-05 is published."
- **`BRANDED_FALLBACK_SRC`:** keep it only for the `<img>` preview (`:347`), and update its comment to
  say so.

### Changed — `ui/src/pages/Dashboard.jsx`

- **`handleSurpriseMe`** (`:755-783`) becomes `handleUseDefaultProfile`.
  - It posts `/api/assistant/publish-profile` with `{ customerPubkey: user.pubkey }`.
  - On `data.success` it calls `refreshAssistantStatus()`; otherwise it alerts `data.error`.
  - The browser builds no event.
- **`WelcomeCard`** (`:23-59`): the button reads "✨ Use the default profile".
  - The gate stays Owner-only.
  - The comment says so, and says that story 5 retires the button.

### Unchanged, deliberately

- **`avatar.js`.** It already asks `isPubliclyReachable(getInstanceWebsite())`, and ta-avatar's S7
  keeps passing.
- **The legacy pages.** They post no `content`, so they now publish the one default.
- **Also unchanged:**
  - `ssrfGuard.js`;
  - `fetchProfiles.js`;
  - `nip05.js`;
  - the route table;
  - `sanitizeProfileContent`'s seven fields.

### Test-file changes this ADR requires (Phase 3, the Tester's lane)

- **`test/assistant-publish-relays.test.js`, `handlerFakes` (`:578-606`).** Replace
  `getKind0DisplayName` and `buildDefaultProfileContent` with `getPersonName` and `describeInstance`.
  - **This one is load-bearing.** The handler passes `allowRelayLookup: true`. If `getPersonName` is not
    injected, the real one would query the real profile relays from inside a unit test.
- **`test/recognizable-published-ta-profile.test.js`.** Several tests pin rules from ta-avatar/0002
  that this ADR supersedes. Re-aim them at the story's table:
  - U2 and U3 (generic name, no picture);
  - S1 and S2 (no literal domain, two branches);
  - H1–H3 (generic name, and a picture only when the address is routable).
  - Its independent mirror predicate, `isPubliclyRoutable`, has row 148's gap. It must change along
    with the production rule.
- **Should pass unchanged by construction:** `test/assistant-setup-state.test.js` S1, S2, S5 and D3,
  and `test/stamped-composite-avatar.test.js` S7. Confirm them; do not edit them.
- **A new suite** registers as one line in `test/registry.js`.

### Testability note (not a test plan)

**The pure functions.** These are the core. Together they cover every row of the story's table and
every class in its "public instance" definition, with no stack:

- `isPublicDomain`;
- `describeInstance`, with `getConfigFromFile` injected;
- `nameFromProfileEvent`;
- `buildDefaultProfile`, including the no-name forms and the verbatim about text;
- `finalizeAssistantProfile`.

**`resolvePersonName`.** Cases to cover:

- a local hit with no relay call;
- a local profile with no name, so the relays are asked;
- a newer profile with no name beating an older one that has a name;
- the anonymous gate;
- the memo, both within and beyond its window;
- a relay timeout.

**The two seams**

- **AC1:** call the status handler as Owner, Admin and Customer, and compare the defaults field by
  field.
- **AC3:** check the publish handler's signed event (content and tags) for a default publish and an
  edited one, on a public instance and a non-public one.
- **`defaults=0`:** the status handler must not call `getPersonName` at all.

**The browser changes** can be checked in the source:

- the editor never writes `data.path` into `picture`, and never uses the relative path as a value;
- the dashboard builds no kind 0 of its own.

**Live checks.** `:7778` serves the main checkout, not this branch, so a live H-class there would
verify another branch. Point it at staging after deploy, or run it inside a container built from this
branch.

## Out of scope

- **Existing published profiles:** no backfill and no auto-republish (the epic's guardrail).
- **Validating URLs a user types** into picture, banner or website. That includes stale values an
  older default put into a published profile.
- **The NIP-05 local-part *format*.**
- **Which relays are the profile relays** (OPEN.md row 270), and `/api/profiles`' timeout gap (OPEN.md
  row 273).
- **The My Assistant page** (story 4).
- **Removing the other writers:** "Surprise me", the legacy panels and the generic signer for kind 0
  (story 5, OPEN.md row 269).
- **DNS-based reachability.**
- **Badged avatars** for Admins and Customers.
- **In-app display fallbacks.**
- **The kind 10040 wording question** (OPEN.md row 267).

## Amendment 1 (2026-09-21) — the status seam keeps story 2's literal publish list

### Why

The implementation notes gave `createAssistantStatusHandler` a `getPublishRelays` dependency. The handler
would then pass `getPublishRelays: d.getPublishRelays` to the setup check. That contradicts a guard that
already exists:

- Story 2's S3 (`test/assistant-publish-relays.test.js`) requires the literal
  `getPublishRelays: getAssistantPublishRelays` in `handleAssistantStatus`'s body.
- That literal is how the suite pins ADR 0002's rule that the setup check and the publisher read one
  list.

This came to light while the Phase 3 tests were being validated against a throwaway reference
implementation. With the note followed as written, S3 fails with "handleAssistantStatus must pass
getAssistantPublishRelays to the resolver". With the literal kept, S3 passes.

### What changes

- The status seam takes **no** `getPublishRelays` dependency. Its dependencies are `getOwnerPubkey`,
  `getAdminPubkeys`, `getAssistantKeys`, `getPersonName`, `describeInstance` and
  `resolveAssistantProfileState`.
- Step 6 passes the list literally:
  `d.resolveAssistantProfileState({ assistantPubkey, allowRelayFallback, getPublishRelays: getAssistantPublishRelays })`.

### Consequences

- **No test loses reach.** The Q-class of `test/one-default-assistant-profile.test.js` injects
  `resolveAssistantProfileState`, and its fake never calls the list. The list itself stays covered by
  story 1's U10 and story 2's L-class.
- **Story 2's S3 stays as it is,** and so does ADR 0002's "one list both sides read".
- **Firmware reinstall required?** No.
