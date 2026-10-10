# Admin-action sweep inventory (story security-auth-exposure #8)

Derived 2026-10-10 on `staging` @ 9326094a by the Architect; kept private until the fix shipped (book
`admin-action-owner-check`, ground rule 1) and committed with it. "Today" in the tables means before the fix.
The owner's decisions are recorded under each proposal. The route table that enforces them is
`src/middleware/routeAccess.js`.

## How this was derived (re-derivable)

1. **Router stack, stack-free.** A scratch script built a bare Express app, mapped `/usr/local/lib/node_modules/brainstorm/*`
   to the repo, stubbed `getOwnerAssistantKeys`, called the real `src/api` `register(app)`, and walked
   `app._router.stack`: **383 route registrations** (218 GET, 160 POST, 3 PUT, 2 DELETE; 0 PATCH). Handler file:line came
   from the inspector's `[[FunctionLocation]]`. (Side effect found: `initRouter()` writes
   `/etc/strfry-router-tapestry.config` and `/var/lib/brainstorm/router-state.json`; the AC-6 test must stub it.)
2. **Real middleware verdicts.** The real `authMiddleware` was run against every registration for three callers, proxied
   (X-Forwarded-For set): visitor, signed-in non-owner, owner (config stubbed). HEAD = GET and case are already handled
   (stories 5, 7).
3. **Handler reads.** Every registration that passes the middleware for a signed-in non-owner (88 mutation-method
   registrations) and every GET whose handler or helper could act was read for its own caller check and its effect.
4. **Entrypoint and mounts** (not loadable stack-free): `bin/control-panel.js` and the BullBoard mount, read by hand.
5. **Pages.** React `ui/src` and legacy `public/pages` were grepped for each mutation route to see who is offered it.

## Counts

| Class | Mutation methods | GET | Total |
|---|---|---|---|
| A — action reachable by a non-owner today | 27 | 2 | **29** registrations (28 distinct routes; one is registered twice) across **13 modules** |
| B — action already guarded | 99 | 1 | 100 |
| C — read (public or guarded) | 5 (reads served by POST, outside /api) | 215 | 220 |
| D — intentionally open action (visitors 7, signed-in 27) | 34 | 0 | 34 |
| **Total (src/api register)** | 165 | 218 | **383** |

Plus the entrypoint (`bin/control-panel.js`): GET `/.well-known/security.txt`, GET `/robots.txt`, GET `/llms.txt`, GET
information-for-agents, GET `/legacy`, GET `/legacy/:filename.html`, GET `/:filename.html` (302), USE `/docs` (swagger),
GET `*` (SPA catch-all), static mounts (`/`, `/control`, `/legacy`, `/generated`, `/libs/*`): all **C** (reads; most
registered before the session and auth middleware). USE `/admin/queues` (BullBoard, only when TASK_QUEUE_ENABLED): **B**,
mount guard `requireOwnerOrAdmin` (its router includes job retry/remove actions).

Modules holding class A: algos/config (2), export/nip85 (4), neo4j/eventSync (1), search/profiles/meili (5),
firmware install (1 route, registered in firmware/index.js AND normalize/index.js), streaming-etl (1), property (1),
trustedList (1), io (3), tapestry-key (6), auth/signUpNewCustomer (1), export/services (1 GET), search/profiles/whitelistPrecompute (1 GET).

## Found on the way, handled outside this table

- **Batch 0:** request values reached a shell string in a few handlers. Fixed and shipped everywhere before this
  sweep: ledger `2026-10-10-request-values-reached-a-shell`.
- **An admin could change the admin list** through a settings update or reset. Owner-only since this fix (owner's
  decision E2).
- **The customer-or-owner quirk** on three reads (signed-in non-customers get less than visitors) is carried unchanged
  (AC-5); a product call for later.
- One route was registered twice (same handler); left as is (cleanup).

### Class A — actions reachable by a non-owner today (29)

| Method | Path | Effect / guard / who today | Flags | Handler location |
|---|---|---|---|---|
| POST | `/api/algos/config/update/graperank` | sets any customer's GrapeRank preset (customer config write). Today: any signed-in key (anon 401 by ADR 0002). Pages: owner-only manage-customer page. |  | src/api/algos/config/commands/graperank.js:14 |
| POST | `/api/algos/config/update` | sets any customer's preset for any config type. Today: any signed-in key (anon 401 by ADR 0002). Pages: owner-only manage-customer page. |  | src/api/algos/config/commands/index.js:15 |
| POST | `/api/auth/sign-up-new-customer` | makes the caller a customer: generates relay (assistant) keys, writes customers file. /api/auth/* is skipped by the middleware, so its owner-only entry never applies. Today: any signed-in key (no session: soft refusal). Pages: legacy sign-up.html / index.html offer it to signed-in people. | judgment (page-offered self-service vs owner-only list entry) | src/api/auth/signUpNewCustomer.js:10 |
| POST | `/api/create-kind10040` | runs bin/brainstorm-create-kind10040.js (its shell-input defect was fixed in batch 0). Today: any signed-in key (anon 401 by ADR 0002). Page: nip85-control-panel. | identity | src/api/export/nip85/commands/kind10040.js:17 |
| POST | `/api/publish-kind10040-event` | legacy: writes the caller-signed 10040 to disk and runs a publish script. Handler needs session.challenge, which nothing sets since ADR 0003, so it 400s in practice. Today: any signed-in key (anon 401 by ADR 0002). | judgment: dead flow | src/api/export/nip85/commands/kind10040.js:79 |
| POST | `/api/create-and-publish-kind10040` | runs the create-and-publish script (its shell-input defect was fixed in batch 0) and publishes. Today: any signed-in key (anon 401 by ADR 0002). | identity | src/api/export/nip85/commands/create-and-publish-kind10040.js:17 |
| POST | `/api/publish-kind30382` | spawns detached background publish of all kind 30382 (instance/customer relay keys sign). Heavy. Today: any signed-in key (anon 401 by ADR 0002). | identity; heavy | src/api/export/nip85/commands/kind30382.js:16 |
| GET | `/api/systemd-services` | with ?action=start/stop/restart&service=<listed>: systemctl on neo4j/strfry/control-panel/timers. Owner-only entry is POST-only. Today: ANYONE incl. anonymous (GET/HEAD). Inert where systemctl is absent (the Docker image); live on systemd hosts. Without params: status read. | GET that acts; anonymous | src/api/export/services/commands/control.js:29 |
| POST | `/api/neo4j/event-update` | re-imports an event from local strfry into Neo4j, DETACH DELETEing its old tag nodes first (graph write). Today: any signed-in key (anon 401 by ADR 0002). Pages: DList pages, shown to anyone. | judgment | src/api/neo4j/eventSync.js:318 |
| GET | `/api/search/profiles/keyword/precompute-whitelist-maps` | recomputes every observer's whitelist map (force=true skips freshness), 180 s timeouts. Today: ANYONE incl. anonymous (GET/HEAD). No HTTP caller (the cron script calls the JS directly). | GET that acts; anonymous; heavy | src/api/search/profiles/whitelistPrecompute.js:144 |
| POST | `/api/search/profiles/meili/resync` | starts a full Meili resync (heavy). Today: any signed-in key (anon 401 by ADR 0002). Also loopback cron refreshSearchIndex.sh (direct-local). |  | src/api/search/profiles/meili/index.js:389 |
| POST | `/api/search/profiles/meili/load-scores` | loads scores into Meili (heavy write). Today: any signed-in key (anon 401 by ADR 0002). |  | src/api/search/profiles/meili/index.js:340 |
| DELETE | `/api/search/profiles/meili/wipe` | WIPES the search index. Today: any signed-in key (anon 401 by ADR 0002). | destructive | src/api/search/profiles/meili/index.js:450 |
| POST | `/api/search/profiles/meili/prune-unscored` | deletes unscored docs from Meili. Today: any signed-in key (anon 401 by ADR 0002). | destructive | src/api/search/profiles/meili/index.js:585 |
| POST | `/api/search/profiles/meili/backfill-profiles` | backfills Meili from a full strfry scan (heavy). Today: any signed-in key (anon 401 by ADR 0002). |  | src/api/search/profiles/meili/index.js:763 |
| POST | `/api/firmware/install` | firmware reinstall: TA signs and publishes the seed, rewrites concept graph (heavy). Registered TWICE (src/api/firmware/index.js and src/api/normalize/index.js). Today: any signed-in key (anon 401 by ADR 0002). Firmware bridge + CLI are direct-local. | identity; heavy | src/firmware/install.js:1391, src/firmware/install.js:1391 |
| POST | `/api/firmware/install` | firmware reinstall: TA signs and publishes the seed, rewrites concept graph (heavy). Registered TWICE (src/api/firmware/index.js and src/api/normalize/index.js). Today: any signed-in key (anon 401 by ADR 0002). Firmware bridge + CLI are direct-local. | identity; heavy | src/firmware/install.js:1391, src/firmware/install.js:1391 |
| POST | `/api/streaming-etl/control` | supervisorctl start/stop/restart stream-consumer. Today: any signed-in key (anon 401 by ADR 0002). | service control | src/api/streaming-etl/index.js:106 |
| POST | `/api/property/generate-json-schema` | regenerates and saves a concept's JSON Schema (TA-signed via regenerateJson). Today: any signed-in key (anon 401 by ADR 0002). Page: ConceptProperties. | identity | src/api/property/index.js:13 |
| POST | `/api/trusted-list/publish` | TA SIGNS and publishes a Trusted List with caller-supplied items. Today: any signed-in key (anon 401 by ADR 0002). Page: DListItems TrustedListPanel offers it to ANY signed-in user. | identity; judgment (page-offered) | src/api/trustedList/index.js:162 |
| POST | `/api/io/exports` | builds an export file on disk from Neo4j (heavy, file write). Today: any signed-in key (anon 401 by ADR 0002). |  | src/api/io.js:95 |
| POST | `/api/io/imports/upload` | stages an uploaded import (multer, memory/disk). Today: any signed-in key (anon 401 by ADR 0002). |  | src/api/io.js:266 |
| POST | `/api/io/imports/:tempId/execute` | imports staged words into Neo4j. Today: any signed-in key (anon 401 by ADR 0002). |  | src/api/io.js:435 |
| POST | `/api/tapestry-key/initialize` | sets tapestryKey on every Neo4j node lacking one (whole-graph write). Today: any signed-in key (anon 401 by ADR 0002). | heavy | src/api/tapestry-key/index.js:98 |
| POST | `/api/tapestry-key/offload` | moves a json tag into LMDB. Today: any signed-in key (anon 401 by ADR 0002). |  | src/api/tapestry-key/index.js:205 |
| POST | `/api/tapestry-key/offload-all` | offloads ALL inline json tags into LMDB (whole-graph). Today: any signed-in key (anon 401 by ADR 0002). | heavy | src/api/tapestry-key/index.js:312 |
| POST | `/api/tapestry-key/derive-all/:label` | derives LMDB entries for every node of a label (heavy). Today: any signed-in key (anon 401 by ADR 0002). | heavy | src/api/tapestry-key/index.js:413 |
| POST | `/api/tapestry-key/derive/:key` | derives one LMDB entry. Today: any signed-in key (anon 401 by ADR 0002). |  | src/api/tapestry-key/index.js:395 |
| POST | `/api/tapestry-key/:key` | writes arbitrary tapestryJSON into LMDB + Neo4j timestamp. Today: any signed-in key (anon 401 by ADR 0002). |  | src/api/tapestry-key/index.js:167 |

### Class D — intentionally open, visitors (7)

| Method | Path | Effect / guard / who today | Flags | Handler location |
|---|---|---|---|---|
| POST | `/api/auth/verify` | auth handshake (ADR 0003); /api/auth/* skipped by middleware |  | src/middleware/auth.js:63 |
| POST | `/api/auth/login` | auth handshake (ADR 0003); /api/auth/* skipped by middleware |  | src/middleware/auth.js:157 |
| POST | `/api/auth/verify-user` | auth handshake (ADR 0003); /api/auth/* skipped by middleware |  | src/middleware/auth.js:536 |
| POST | `/api/auth/login-user` | auth handshake (ADR 0003); /api/auth/* skipped by middleware |  | src/middleware/auth.js:583 |
| POST | `/api/auth/logout` | auth handshake (ADR 0003); /api/auth/* skipped by middleware |  | src/middleware/auth.js:207 |
| POST | `/api/neo4j/query` | read backbone; handler gates write Cypher to owner/admin/local (ADR 0001). Signed-in non-customers 403 (customerOrOwner list). Decided (book decision 3). |  | src/api/neo4j/queryPost.js:19 |
| POST | `/api/strfry/publish` | client-signed publish (principle 2); handler gates signAs:assistant to owner/admin/local (ADR 0002). Decided. | identity: signAs assistant = row 269 | src/api/strfry/commands/publishEvent.js:30 |

### Class D — intentionally open, signed-in (allowlist proposals) (27)

| Method | Path | Effect / guard / who today | Flags | Handler location |
|---|---|---|---|---|
| POST | `/api/create-unsigned-kind10040` | read via POST: unsigned kind 10040 template (legacy customer pages: sign-up, customer, nip85). |  | src/api/export/nip85/commands/create-unsigned-kind10040.js:20 |
| POST | `/api/publish-signed-kind10040` | publish a kind 10040 you signed yourself (signature verified). Legacy customer pages. |  | src/api/export/nip85/commands/publish-signed-kind10040.js:21 |
| PUT | `/api/user-prefs` | own preferences (handler keys by session pubkey). Pages: search, settings, user menu. |  | src/api/settings/userPrefsApi.js:53 |
| POST | `/api/strfry/negentropy-sync` | POV sync for signed-in people; route guard requireSyncManagerOrPovSync narrows to the exact POV shape. Decided. |  | src/api/strfry/negentropySync.js:67 |
| POST | `/api/assistant/publish-profile` | own Assistant profile (handler: session == customerPubkey). |  | src/api/assistant/index.js:192 |
| POST | `/api/assistant/provision-key` | own Assistant key (handler: owner/admin/active customer; refuses re-provision). |  | src/api/assistant/index.js:483 |
| POST | `/api/assistant/avatar` | own Assistant avatar (route guard requireOwnAssistant). |  | src/api/assistant/avatar.js:384 |
| POST | `/api/assistant/identification-tags/publish` | own Assistant signs its two identification taggings of you (session-bound). |  | src/api/assistant/identificationTaggings.js:210 |
| POST | `/api/assistant/outbox-relays/publish` | own Assistant signs its relay list (session-bound). |  | src/api/assistant/relayListPublish.js:223 |
| POST | `/api/trusted-list/refresh-pinned-tag` | refresh the TL for your own pin (handler: pin author == session). The TA signs the TL. | identity (TA signs for the person) | src/api/trustedList/index.js:232 |
| POST | `/api/trusted-list/refresh-pinned-tags-for-viewer` | refresh TLs for your own pins (handler: viewer == session). TA signs. | identity (TA signs for the person) | src/api/trustedList/index.js:289 |
| POST | `/api/trusted-list/notify-applicability` | fire-and-forget after you apply a tag; schedules a debounced instance-wide applicability refresh. No input. | judgment (not strictly own thing) | src/api/trustedList/index.js:282 |
| POST | `/api/trusted-list/prepare-nip51-export` | read via POST: unsigned NIP-51 template for your own pin. |  | src/api/trustedList/index.js:349 |
| POST | `/api/dlist-curation/header` | your own Assistant authors a curation header (same-host + session + own keys). |  | src/api/dlist-curation/index.js:241 |
| POST | `/api/dlist-curation/update` | your own Assistant updates its own curated list. |  | src/api/dlist-curation/update.js:549 |
| POST | `/api/list-headers/my-assistant/:handle/self-declare` | your own Assistant dispositions its own header. |  | src/api/list-headers/myAssistantDisposition.js:121 |
| POST | `/api/list-headers/my-assistant/:handle/b-defer` | your own Assistant dispositions its own header. |  | src/api/list-headers/myAssistantDisposition.js:121 |
| POST | `/api/list-headers/my-assistant/:handle/b-append` | your own Assistant dispositions its own header. |  | src/api/list-headers/myAssistantDisposition.js:121 |
| POST | `/api/list-headers/me/:handle/self-declare/prepare` | your own headers, signed by your browser signer. |  | src/api/list-headers/meDisposition.js:53 |
| POST | `/api/list-headers/me/:handle/self-declare/commit` | your own headers, signed by your browser signer. |  | src/api/list-headers/meDisposition.js:53 |
| POST | `/api/list-headers/me/:handle/b-defer/prepare` | your own headers, signed by your browser signer. |  | src/api/list-headers/meDisposition.js:53 |
| POST | `/api/list-headers/me/:handle/b-defer/commit` | your own headers, signed by your browser signer. |  | src/api/list-headers/meDisposition.js:53 |
| POST | `/api/list-headers/me/:handle/b-append/prepare` | your own headers, signed by your browser signer. |  | src/api/list-headers/meDisposition.js:53 |
| POST | `/api/list-headers/me/:handle/b-append/commit` | your own headers, signed by your browser signer. |  | src/api/list-headers/meDisposition.js:53 |
| POST | `/api/dictionaries/concepts/new` | your own Assistant creates/edits/re-syncs its own concept header. |  | src/api/adoption/newConcept.js:162 |
| POST | `/api/dictionaries/concepts/edit` | your own Assistant creates/edits/re-syncs its own concept header. |  | src/api/adoption/editConcept.js:192 |
| POST | `/api/dictionaries/concepts/resync` | your own Assistant creates/edits/re-syncs its own concept header. |  | src/api/adoption/resyncConcept.js:52 |

### Class B — actions already guarded (100)

| Method | Path | Effect / guard / who today | Flags | Handler location |
|---|---|---|---|---|
| POST | `/api/algos/config/reset` | handler: session pubkey == target pubkey OR == owner pubkey (admins excluded; customers may reset their own) |  | src/api/algos/config/commands/resetToDefault.js:15 |
| POST | `/api/strfry/router-config` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/strfry/routerConfig.js:563 |
| POST | `/api/strfry/router-toggle` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/strfry/routerConfig.js:637 |
| POST | `/api/strfry/router-restart` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/strfry/routerConfig.js:714 |
| POST | `/api/strfry/router-restore-defaults` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/strfry/routerConfig.js:735 |
| POST | `/api/strfry/wipe` | handler: isOwner // localTrusted (story strfry-wipe-owner-gate) |  | src/api/strfry/wipe.js:8 |
| POST | `/api/generate-nip85` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/export/nip85/commands/generate.js:14 |
| POST | `/api/post-graperank-config` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/export/graperank/commands/update-config.js:15 |
| POST | `/api/generate-graperank` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/algos/graperank/commands/generate.js:13 |
| POST | `/api/post-blacklist-config` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/export/blacklist/commands/update-config.js:14 |
| POST | `/api/generate-blacklist` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/export/blacklist/commands/generate.js:13 |
| POST | `/api/post-whitelist-config` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/export/whitelist/commands/update-config.js:14 |
| POST | `/api/export-whitelist` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/export/whitelist/commands/export.js:13 |
| POST | `/api/generate-pagerank` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/algos/pagerank/commands/generate.js:13 |
| GET | `/api/personalized-pagerank` | middleware ownerOnlyGetEndpoints + protectedGetEndpoints (GET/HEAD); spawns a computation |  | src/api/algos/pagerank/commands/generateForApi.js:22 |
| POST | `/api/generate-verified-followers` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/algos/verifiedFollowers/commands/generate.js:13 |
| POST | `/api/generate-reports` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/algos/reports/commands/generate.js:13 |
| POST | `/api/toggle-strfry-filteredContent` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/strfry/commands/toggle.js:15 |
| POST | `/api/delete-all-relationships` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/pipeline/batch/commands/deleteAllRelationships.js:8 |
| POST | `/api/batch-transfer` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/pipeline/batch/commands/transfer.js:13 |
| POST | `/api/reconciliation` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/pipeline/reconcile/commands/execute.js:13 |
| POST | `/api/negentropy-sync` | route guard requireSyncManager (owner/admin/direct-local); ADR 0004 |  | src/api/pipeline/batch/commands/negentropySync.js:40 |
| POST | `/api/calculate-hops` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/algos/hops/commands/calculate.js:13 |
| POST | `/api/run-task` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/manage/commands/runTask.js:361 |
| POST | `/api/negentropy-sync-wot` | route guard requireSyncManager (owner/admin/direct-local); ADR 0004 |  | src/api/manage/negentropySync/commands/syncWoT.js:13 |
| POST | `/api/negentropy-sync-profiles` | route guard requireSyncManager (owner/admin/direct-local); ADR 0004 |  | src/api/manage/negentropySync/commands/syncProfiles.js:13 |
| POST | `/api/negentropy-sync-personal` | route guard requireSyncManager (owner/admin/direct-local); ADR 0004 |  | src/api/manage/negentropySync/commands/syncPersonal.js:13 |
| POST | `/api/brainstorm-control` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/manage/commands/brainstormControl.js:16 |
| POST | `/api/run-script` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/manage/commands/runScript.js:16 |
| PUT | `/api/grapevine/preferences` | route guard requireOwner (owner/admin; 401 direct-local) |  | src/api/settings/grapevinePrefApi.js:36 |
| PUT | `/api/settings` | route guard requireOwner (owner/admin). NOTE: patch passes adminPubkeys through, so an admin can change the admin list (flag e) |  | src/api/settings/settingsApi.js:90 |
| DELETE | `/api/settings/*` | route guard requireOwner (owner/admin). NOTE: can reset adminPubkeys (flag e) |  | src/api/settings/settingsApi.js:125 |
| POST | `/api/neo4j-setup-constraints-and-indexes` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/neo4j/commands/setupConstraintsAndIndexes.js:18 |
| POST | `/api/create-all-customer-relays` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/commands/create-all-customer-relays.js:13 |
| POST | `/api/process-all-active-customers` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/commands/process-all-active-customers.js:13 |
| POST | `/api/backup-customers` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/commands/backup-customers.js:39 |
| POST | `/api/restore/upload` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/commands/restore-upload.js:88 |
| POST | `/api/restore/customer` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/commands/restore-customer.js:32 |
| POST | `/api/add-new-customer` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/commands/add-new-customer.js:18 |
| POST | `/api/delete-customer` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/deleteCustomer.js:20 |
| POST | `/api/change-customer-status` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/changeCustomerStatus.js:16 |
| POST | `/api/update-customer-display-name` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customers/commands/update-customer-display-name.js:16 |
| POST | `/api/service-management/control` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/service-management/queries/control.js:102 |
| POST | `/api/normalize/skeleton` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:210 |
| POST | `/api/normalize/json` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:793 |
| POST | `/api/normalize/create-concept` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:1183 |
| POST | `/api/normalize/create-element` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:1760 |
| POST | `/api/normalize/save-schema` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:1907 |
| POST | `/api/normalize/reconcile-primary-property` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:2107 |
| POST | `/api/normalize/create-child-goal` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:2190 |
| POST | `/api/normalize/update-goal-intent` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:2291 |
| POST | `/api/normalize/create-resource` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:2523 |
| POST | `/api/normalize/verify-resource` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:2632 |
| POST | `/api/normalize/create-work-record` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:2831 |
| POST | `/api/normalize/note-goal-idea` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:2913 |
| POST | `/api/normalize/make-proposal` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3158 |
| POST | `/api/normalize/approve-proposal` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3266 |
| POST | `/api/normalize/skip-proposal` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3284 |
| POST | `/api/normalize/record-priority-signal` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:4779 |
| POST | `/api/normalize/restore-brain` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:4999 |
| POST | `/api/normalize/record-restore-drill` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:5189 |
| POST | `/api/normalize/adoption-disposition` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:5295 |
| POST | `/api/normalize/trusted-dictionary-snapshot` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:5403 |
| POST | `/api/normalize/save-element-json` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3348 |
| POST | `/api/normalize/create-property` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3387 |
| POST | `/api/normalize/generate-property-tree` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3573 |
| POST | `/api/normalize/add-node-as-element` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3824 |
| POST | `/api/normalize/migrate-primary-property-ztags` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3905 |
| POST | `/api/normalize/link-concepts` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:3970 |
| POST | `/api/normalize/enumerate` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:4047 |
| POST | `/api/normalize/set-slug` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:4183 |
| POST | `/api/normalize/create-set` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:4252 |
| POST | `/api/normalize/add-to-set` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:4358 |
| POST | `/api/normalize/fork-node` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:4479 |
| POST | `/api/normalize/set-json-tag` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:4615 |
| POST | `/api/normalize/prune-superset-edges` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:5544 |
| POST | `/api/normalize/apply-enumerations` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:5789 |
| POST | `/api/normalize/wire-implicit-elements` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/index.js:5650 |
| POST | `/api/normalize/add-relationship` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/relationships.js:150 |
| POST | `/api/normalize/delete-relationship` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/relationships.js:188 |
| POST | `/api/normalize/add-subset` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/normalize/nodes.js:109 |
| POST | `/api/strfry/negentropy-presets` | handler: requireOwnerOrLocal (routerConfig.js) |  | src/api/strfry/negentropyPresets.js:332 |
| POST | `/api/strfry/negentropy-presets/toggle` | handler: requireOwnerOrLocal (routerConfig.js) |  | src/api/strfry/negentropyPresets.js:356 |
| POST | `/api/strfry/negentropy-presets/delete` | handler: requireOwnerOrLocal (routerConfig.js) |  | src/api/strfry/negentropyPresets.js:372 |
| POST | `/api/strfry/negentropy-presets/run` | handler: requireOwnerOrLocal (routerConfig.js) |  | src/api/strfry/negentropyPresets.js:387 |
| POST | `/api/scheduled-tasks/update` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/scheduled-tasks/index.js:425 |
| POST | `/api/scheduled-tasks/create` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/scheduled-tasks/index.js:377 |
| POST | `/api/scheduled-tasks/delete` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/scheduled-tasks/index.js:491 |
| POST | `/api/customer-schedule/update` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customer-schedule/index.js:241 |
| POST | `/api/customer-schedule/trigger` | middleware ownerOnlyEndpoints (POST, substring) -> 403 signed-in non-owner; anon 401 (ADR 0002) |  | src/api/customer-schedule/index.js:285 |
| POST | `/api/admin/add` | route guard requireOwnerOnly |  | src/api/admin/index.js:186 |
| POST | `/api/admin/remove` | route guard requireOwnerOnly |  | src/api/admin/index.js:226 |
| POST | `/api/tagging-edges/confirm-held-removals` | route guard requireOwnerOnly |  | src/api/tagging-edges/index.js:261 |
| POST | `/api/tagging-edges/realtime/switch` | route guard requireOwnerOrAdmin |  | src/api/tagging-edges/realtime.js:351 |
| POST | `/api/trusted-list/refresh-all-pinned-tags` | handler: loopback-only (isLoopbackRequest) |  | src/api/trustedList/index.js:215 |
| POST | `/api/trusted-list/refresh-applicability-lists` | handler: loopback-only (isLoopbackRequest) |  | src/api/trustedList/index.js:256 |
| POST | `/api/concept/:handle/self-declare` | handler: isOwner // localTrusted |  | src/api/concept/selfDeclare.js:49 |
| POST | `/api/concept/:handle/b-append` | handler: isOwner // localTrusted |  | src/api/concept/bDisposition.js:151 |
| POST | `/api/concept/:handle/b-defer` | handler: isOwner // localTrusted |  | src/api/concept/bDisposition.js:181 |
| POST | `/api/concept/:handle/pull-community-class-thread` | route guard requireOwner |  | src/api/concept/pullClassThread.js:78 |

### Class C — reads with judgment notes (17)

| Method | Path | Effect / guard / who today | Flags | Handler location |
|---|---|---|---|---|
| GET | `/api/auth/test` | read; returned part of the instance config. Closed to the owner's side by this fix (owner's judgment call 8). | judgment | src/middleware/auth.js:234 |
| GET | `/api/get-kind10040-info` | read (its shell-input defect was fixed in batch 0). | judgment | src/api/export/nip85/queries/info.js:20 |
| GET | `/api/get-all-10040-authors-externally` | read; external relay fan-out. | judgment | src/api/export/nip85/queries/get-all-10040-authors-externally.js:41 |
| GET | `/api/get-30382-count-externally` | read; external relay fan-out. | judgment | src/api/export/nip85/queries/get-30382-count-externally.js:27 |
| GET | `/api/get-kind0` | read (its shell-input defect was fixed in batch 0). | judgment | src/api/export/profiles/queries/kind0.js:25 |
| GET | `/api/strfry/scan` | read; public long scan (ADR 0001/0002 public read the UI depends on). | judgment | src/api/strfry/queries/scan.js:72 |
| GET | `/api/strfry/scan/stream` | read; public streaming scan. | judgment | src/api/strfry/queries/scanStream.js:10 |
| GET | `/api/strfry/scan/count` | read; public count. | judgment | src/api/strfry/queries/scanCount.js:8 |
| GET | `/api/profiles` | read (its shell-input defect was fixed in batch 0). | judgment | src/api/profiles/fetchProfiles.js:145 |
| GET | `/api/search/profiles` | read; heavy neo4j/grep search, public. | judgment | src/api/search/profiles/index.js:52 |
| GET | `/api/search/profiles/stream` | read; heavy, public. | judgment | src/api/search/profiles/index.js:476 |
| GET | `/api/get-customers` | read; public to visitors, 403 to signed-in non-customers (the quirk, carried). The owner kept it public. | judgment | src/api/customers/getCustomers.js:9 |
| GET | `/api/get-customer` | read; as the customer list. The owner kept it public. | judgment | src/api/customers/getCustomer.js:7 |
| GET | `/api/task-dashboard/state` | read; regenerates its state file once if missing (10 s script). Task reads stay public (owner c). | judgment | src/api/taskDashboard/getTaskDashboardState.js:13 |
| GET | `/api/neo4j-health/complete` | read; runs JVM diagnostics. | judgment | src/api/neo4j-health/queries/complete-neo4j-health.js:472 |
| GET | `/api/io/exports` | read (lists exports). Closed to the owner's side by this fix (owner's judgment call 8). | judgment | src/api/io.js:65 |
| GET | `/api/io/exports/:filename` | read (downloads an export). Closed to the owner's side by this fix (owner's judgment call 8). | judgment | src/api/io.js:244 |

### Class C — other reads (203)

| Method | Path | Effect / guard / who today | Flags | Handler location |
|---|---|---|---|---|
| GET | `/.well-known/nostr.json` | public read |  | src/api/nip05.js:87 |
| GET | `/api/nip05/verify` | public read |  | src/api/nip05.js:178 |
| GET | `/.well-known/open-ranking.json` | public read |  | src/api/open-ranking/index.js:26 |
| POST | `/stats/pubkey` | read via POST: open-ranking provider (ADR open-ranking/0001), bounded; outside /api so middleware never sees it |  | src/api/open-ranking/stats.js:113 |
| POST | `/rank/pubkeys` | read via POST: open-ranking provider (ADR open-ranking/0001), bounded; outside /api so middleware never sees it |  | src/api/open-ranking/rank.js:91 |
| POST | `/search/pubkeys` | read via POST: open-ranking provider (ADR open-ranking/0001), bounded; outside /api so middleware never sees it |  | src/api/open-ranking/search.js:89 |
| POST | `/followers` | read via POST: open-ranking provider (ADR open-ranking/0001), bounded; outside /api so middleware never sees it |  | src/api/open-ranking/inbound.js:117 |
| POST | `/muters` | read via POST: open-ranking provider (ADR open-ranking/0001), bounded; outside /api so middleware never sees it |  | src/api/open-ranking/inbound.js:117 |
| GET | `/api/algos/config/get/graperank` | public read |  | src/api/algos/config/queries/graperank.js:14 |
| GET | `/api/algos/config/get` | public read |  | src/api/algos/config/queries/index.js:15 |
| GET | `/api/calculation-history/processAllTrustMetrics` | public read |  | src/api/algos/calculation-history/queries/processAllTrustMetrics.js:16 |
| GET | `/api/calculation-history/hops` | public read |  | src/api/algos/calculation-history/queries/hops.js:16 |
| GET | `/api/calculation-history/personalizedPageRank` | public read |  | src/api/algos/calculation-history/queries/personalizedPageRank.js:16 |
| GET | `/api/calculation-history/personalizedGrapeRank` | public read |  | src/api/algos/calculation-history/queries/personalizedGrapeRank.js:16 |
| GET | `/api/calculation-history/analyzeFollowsMutesReports` | public read |  | src/api/algos/calculation-history/queries/analyzeFollowsMutesReports.js:16 |
| GET | `/api/calculation-history/kind30382Export` | public read |  | src/api/algos/calculation-history/queries/kind30382Export.js:16 |
| GET | `/api/strfry-status` | public read |  | src/api/strfry/strfryStatus.js:15 |
| GET | `/api/strfry/router-status` | public read |  | src/api/strfry/routerStatus.js:51 |
| GET | `/api/strfry/router-presets` | public read |  | src/api/strfry/routerConfig.js:675 |
| GET | `/api/strfry/router-plugins` | public read |  | src/api/strfry/routerConfig.js:689 |
| GET | `/api/list-status` | public read |  | src/api/lists/listStatus.js:23 |
| GET | `/api/ranking-status` | public read |  | src/api/ranking/rankingStatus.js:23 |
| GET | `/api/network-status` | public read |  | src/api/network/networkStatus.js:23 |
| GET | `/api/debug` | public read |  | src/api/debug.js:11 |
| GET | `/api/auth/status` | public read |  | src/middleware/auth.js:222 |
| GET | `/api/auth/user-classification` | public read |  | src/api/auth/getUserClassification.js:13 |
| GET | `/api/instance-status` | public read |  | src/api/index.js:711 |
| GET | `/api/get-kind10040-event` | public read |  | src/api/export/nip85/queries/kind10040.js:15 |
| GET | `/api/get-kind30382-info` | public read |  | src/api/export/nip85/queries/info.js:79 |
| GET | `/api/get-nip85-status` | public read |  | src/api/export/nip85/queries/get-nip85-status.js:8 |
| GET | `/api/get-all-10040-authors-locally` | public read |  | src/api/export/nip85/queries/get-all-10040-authors-locally.js:8 |
| GET | `/api/validate-encoding` | public read |  | src/api/export/nip19/queries/validate-encoding.js:18 |
| GET | `/api/relay-config` | public read |  | src/api/export/relay/queries/config.js:14 |
| GET | `/api/get-profiles` | public read |  | src/api/export/users/queries/profiles.js:16 |
| GET | `/api/get-profile-scores` | public read |  | src/api/export/users/queries/get-profile-scores.js:173 |
| GET | `/api/get-nip56-profiles` | public read |  | src/api/export/users/queries/nip56-profiles.js:18 |
| GET | `/api/get-user-data` | public read |  | src/api/export/users/queries/userdata.js:19 |
| GET | `/api/get-user-counts` | public read |  | src/api/export/users/queries/userdata.js:315 |
| GET | `/api/get-follows-hops` | public read |  | src/api/export/users/queries/follows-hops.js:35 |
| GET | `/api/get-follows-hops-paths` | public read |  | src/api/export/users/queries/follows-hops-paths.js:39 |
| GET | `/api/get-network-proximity` | public read |  | src/api/export/users/queries/proximity.js:14 |
| GET | `/api/get-npub-from-pubkey` | public read |  | src/api/export/users/queries/get-npub-from-pubkey.js:18 |
| GET | `/api/get-pubkey-from-npub` | public read |  | src/api/export/users/queries/get-pubkey-from-npub.js:18 |
| GET | `/api/get-graperank-config` | public read |  | src/api/export/graperank/queries/config.js:14 |
| GET | `/api/get-graperank-review` | public read |  | src/api/export/graperank/queries/getGrapeRankReview.js:14 |
| GET | `/api/get-blacklist-config` | public read |  | src/api/export/blacklist/queries/config.js:13 |
| GET | `/api/get-whitelist` | public read |  | src/api/export/whitelist/queries/getWhitelist.js:27 |
| GET | `/api/get-whitelist-config` | public read |  | src/api/export/whitelist/queries/config.js:13 |
| GET | `/api/service-status` | public read |  | src/api/export/services/queries/status.js:27 |
| GET | `/api/status` | public read |  | src/api/status/queries/system.js:14 |
| GET | `/api/strfry-stats` | public read |  | src/api/status/queries/strfry.js:13 |
| GET | `/api/neo4j-status` | public read |  | src/api/status/queries/neo4j.js:14 |
| GET | `/api/calculation-status` | public read |  | src/api/status/queries/calculation.js:14 |
| GET | `/api/status/neo4j-constraints` | public read |  | src/api/status/queries/neo4j-constraints.js:38 |
| GET | `/api/dlists/item-counts` | public read |  | src/api/dlists/itemCounts.js:173 |
| GET | `/api/get-strfry-filteredContent` | public read |  | src/api/strfry/queries/filteredContent.js:13 |
| GET | `/api/whitelist-stats` | public read |  | src/api/lists/queries/whitelist-stats.js:13 |
| GET | `/api/blacklist-count` | public read |  | src/api/lists/queries/blacklist-count.js:14 |
| GET | `/api/whitelist-preview-count` | public read |  | src/api/lists/queries/whitelist-preview-count.js:14 |
| GET | `/api/influence-count` | public read |  | src/api/algos/graperank/queries/influence-count.js:14 |
| GET | `/api/hops-count` | public read |  | src/api/algos/hops/queries/hops-count.js:15 |
| GET | `/api/neo4j/event-check` | public read |  | src/api/neo4j/eventSync.js:88 |
| GET | `/api/neo4j/event-uuids` | public read |  | src/api/neo4j/eventSync.js:367 |
| GET | `/api/reactions/external` | public read |  | src/api/reactions/fetchReactions.js:22 |
| GET | `/api/relay/external` | public read |  | src/api/relay/fetchEvents.js:79 |
| GET | `/api/relay/presence` | public read |  | src/api/relay/presence.js:27 |
| GET | `/api/feed` | public read |  | src/api/feed/feedReadPath.js:266 |
| GET | `/api/user/:pubkey/notes` | public read |  | src/api/notes/userNotesReadPath.js:205 |
| GET | `/api/user/:pubkey/content` | public read |  | src/api/notes/profileContentReadPath.js:130 |
| GET | `/api/event` | public read |  | src/api/event/eventReadPath.js:156 |
| GET | `/api/grapevine/preferences` | public read |  | src/api/settings/grapevinePrefApi.js:21 |
| GET | `/api/user-prefs` | public read |  | src/api/settings/userPrefsApi.js:30 |
| GET | `/api/settings` | guarded read (requireOwner; anon=next user=next) |  | src/api/settings/settingsApi.js:60 |
| GET | `/api/settings/defaults` | guarded read (requireOwner; anon=next user=next) |  | src/api/settings/settingsApi.js:74 |
| GET | `/api/settings/overrides` | guarded read (requireOwner; anon=next user=next) |  | src/api/settings/settingsApi.js:82 |
| GET | `/api/owner-info` | public read |  | src/api/owner/ownerInfo.js:13 |
| GET | `/api/get-grapevine-interaction` | public read |  | src/api/grapevineInteractions/queries/index.js:14 |
| GET | `/api/get-grapevine-follows` | public read |  | src/api/grapevineInteractions/queries/followsWithMetrics.js:43 |
| GET | `/api/get-grapevine-followers` | public read |  | src/api/grapevineInteractions/queries/followersWithMetrics.js:50 |
| GET | `/api/get-grapevine-reporters` | public read |  | src/api/grapevineInteractions/queries/reportersWithMetrics.js:49 |
| GET | `/api/get-grapevine-muters` | public read |  | src/api/grapevineInteractions/queries/mutersWithMetrics.js:55 |
| GET | `/api/search/profiles/keyword` | public read |  | src/api/search/profiles/keyword/handler.js:378 |
| GET | `/api/search/profiles/keyword/precompute-whitelist-maps/status` | public read |  | src/api/search/profiles/whitelistPrecompute.js:168 |
| GET | `/api/search/profiles/meili` | public read |  | src/api/search/profiles/meili/index.js:106 |
| GET | `/api/search/profiles/meili/stats` | public read |  | src/api/search/profiles/meili/index.js:322 |
| GET | `/api/search/profiles/meili/bulk-status` | public read |  | src/api/search/profiles/meili/index.js:405 |
| GET | `/api/search/profiles/meili/document/:pubkey` | public read |  | src/api/search/profiles/meili/index.js:423 |
| GET | `/api/search/profiles/meili/settings` | public read |  | src/api/search/profiles/meili/index.js:470 |
| GET | `/api/search/profiles/meili/random-scored` | public read |  | src/api/search/profiles/meili/index.js:490 |
| GET | `/api/search/profiles/meili/tasks` | public read |  | src/api/search/profiles/meili/index.js:534 |
| GET | `/api/search/profiles/meili/scored-missing-profile` | public read |  | src/api/search/profiles/meili/index.js:694 |
| GET | `/api/get-customer-relay-keys` | guarded read (middleware list; anon=401 user=403) |  | src/api/customers/queries/get-customer-relay-keys.js:13 |
| GET | `/api/backups` | guarded read (middleware list; anon=401 user=403) |  | src/api/customers/queries/list-backups.js:24 |
| GET | `/api/backups/download` | guarded read (middleware list; anon=401 user=403) |  | src/api/customers/queries/download-backup.js:24 |
| GET | `/api/restore/sets` | guarded read (middleware list; anon=401 user=403) |  | src/api/customers/queries/list-restore-sets.js:64 |
| GET | `/api/get-recently-active-pubkeys` | public read |  | src/api/content/queries/recentlyActivePubkeys.js:16 |
| GET | `/api/task-explorer/data` | public read |  | src/api/taskExplorer/getTaskExplorerData.js:9 |
| GET | `/api/task-explorer/single-task/data` | public read |  | src/api/taskExplorer/getTaskExplorerSingleTaskData.js:9 |
| GET | `/api/neo4j-health/alerts` | public read |  | src/api/neo4j-health/queries/alerts-neo4j-health.js:11 |
| GET | `/api/neo4j-health/heap-metrics-history` | public read |  | src/api/neo4j-health/queries/heap-metrics-history.js:225 |
| GET | `/api/neo4j-health/preserved-heap-metrics` | public read |  | src/api/neo4j-health/queries/preserved-heap-metrics.js:173 |
| GET | `/api/neo4j-health/task-timeline` | public read |  | src/api/neo4j-health/getTaskTimeline.js:8 |
| GET | `/api/neo4j-logs/errors` | public read |  | src/api/neo4j-logs/index.js:14 |
| GET | `/api/neo4j-config/overview` | public read |  | src/api/neo4j-config/index.js:432 |
| GET | `/api/task-watchdog/status` | public read |  | src/api/task-watchdog/queries/status.js:8 |
| GET | `/api/task-watchdog/alerts` | public read |  | src/api/task-watchdog/queries/alerts.js:8 |
| GET | `/api/task-watchdog/stuck-tasks` | public read |  | src/api/task-watchdog/queries/stuck-tasks.js:8 |
| GET | `/api/task-watchdog/orphaned-processes` | public read |  | src/api/task-watchdog/queries/orphaned-processes.js:12 |
| GET | `/api/task-analytics/analytics` | public read |  | src/api/task-analytics/queries/analytics.js:8 |
| GET | `/api/service-management/status` | public read |  | src/api/service-management/queries/status.js:175 |
| GET | `/api/service-management/logs` | public read |  | src/api/service-management/queries/logs.js:66 |
| GET | `/api/task-analytics/trends` | public read |  | src/api/task-analytics/queries/trends.js:8 |
| GET | `/api/task-analytics/predictions` | public read |  | src/api/task-analytics/queries/predictions.js:8 |
| GET | `/api/task-analytics/performance` | public read |  | src/api/task-analytics/queries/performance.js:8 |
| GET | `/api/audit/health` | public read |  | src/api/audit/index.js:318 |
| GET | `/api/audit/concepts-summary` | public read |  | src/api/audit/index.js:487 |
| GET | `/api/audit/concept` | public read |  | src/api/audit/index.js:554 |
| GET | `/api/audit/stats` | public read |  | src/api/audit/index.js:64 |
| GET | `/api/audit/skeletons` | public read |  | src/api/audit/index.js:84 |
| GET | `/api/audit/orphans` | public read |  | src/api/audit/index.js:119 |
| GET | `/api/audit/wiring` | public read |  | src/api/audit/index.js:133 |
| GET | `/api/audit/labels` | public read |  | src/api/audit/index.js:159 |
| GET | `/api/audit/bios` | public read |  | src/api/audit/index.js:192 |
| GET | `/api/audit/firmware` | public read |  | src/api/audit/index.js:192 |
| GET | `/api/audit/threads` | public read |  | src/api/audit/index.js:233 |
| GET | `/api/normalize/relationship-primitives` | public read |  | src/api/normalize/probe.js:16 |
| GET | `/api/normalize/node-primitives` | public read |  | src/api/normalize/nodePrimitivesProbe.js:17 |
| GET | `/api/firmware/manifest` | public read |  | src/api/firmware/index.js:24 |
| GET | `/api/firmware/versions` | public read |  | src/api/firmware/index.js:78 |
| GET | `/api/firmware/install-status` | public read |  | src/api/firmware/index.js:127 |
| GET | `/api/firmware/concept/:slug` | public read |  | src/api/firmware/index.js:167 |
| GET | `/api/strfry/negentropy-sync/stream` | guarded read (requireSyncManager; anon=next user=next) |  | src/api/strfry/negentropySync.js:142 |
| GET | `/api/strfry/negentropy-sync/status` | guarded read (requireSyncManager; anon=next user=next) |  | src/api/strfry/negentropySync.js:223 |
| GET | `/api/strfry/negentropy-sync/count` | guarded read (requireSyncManager; anon=next user=next) |  | src/api/strfry/negentropySync.js:439 |
| GET | `/api/strfry/negentropy-presets` | guarded read (requireSyncManager; anon=next user=next) |  | src/api/strfry/negentropyPresets.js:323 |
| GET | `/api/streaming-etl/status` | public read |  | src/api/streaming-etl/index.js:85 |
| GET | `/api/streaming-etl/logs` | public read |  | src/api/streaming-etl/index.js:133 |
| GET | `/api/scheduled-tasks/status` | public read |  | src/api/scheduled-tasks/index.js:521 |
| GET | `/api/scheduled-tasks/history` | public read |  | src/api/scheduled-tasks/index.js:554 |
| GET | `/api/scheduled-tasks/list` | public read |  | src/api/scheduled-tasks/index.js:305 |
| GET | `/api/scheduled-tasks/registry-tasks` | public read |  | src/api/scheduled-tasks/index.js:372 |
| GET | `/api/deploy-safety/status` | public read |  | src/api/deploy-safety/index.js:83 |
| GET | `/api/customer-schedule/status` | public read |  | src/api/customer-schedule/index.js:207 |
| GET | `/api/customer-schedule/history` | public read |  | src/api/customer-schedule/index.js:323 |
| GET | `/api/admin/list` | guarded read (requireOwnerOnly; anon=next user=next) |  | src/api/admin/index.js:141 |
| GET | `/api/tagging-edges/status` | public read |  | src/api/tagging-edges/index.js:198 |
| GET | `/api/tagging-edges/held` | public read |  | src/api/tagging-edges/index.js:220 |
| GET | `/api/tagging-edges/realtime/status` | public read |  | src/api/tagging-edges/realtime.js:242 |
| GET | `/api/tagging-edges/realtime/switch` | guarded read (requireOwnerOrAdmin; anon=next user=next) |  | src/api/tagging-edges/realtime.js:387 |
| GET | `/api/tagging-edges/drift-counts` | guarded read (requireOwnerOrAdmin; anon=next user=next) |  | src/api/tagging-edges/drift.js:164 |
| GET | `/api/assistant/status` | public read |  | src/api/assistant/index.js:367 |
| GET | `/api/assistant/pubkey` | public read |  | src/api/assistant/index.js:458 |
| GET | `/api/assistant/roster` | public read |  | src/api/assistant/roster.js:30 |
| GET | `/api/assistant/my-picture` | guarded read (requireOwnAssistant; anon=next user=next) |  | src/api/assistant/avatar.js:291 |
| GET | `/api/setup/status` | public read |  | src/api/setup/status.js:253 |
| GET | `/api/assistant/attention` | public read |  | src/api/assistant/attention.js:288 |
| GET | `/api/assistant/my-assistants` | public read |  | src/api/assistant/myAssistants.js:166 |
| GET | `/api/owner/pubkey` | public read |  | src/api/owner/index.js:12 |
| GET | `/api/relays` | public read |  | src/api/relays/index.js:13 |
| GET | `/api/publish-policy` | public read |  | src/api/publish-policy/index.js:38 |
| GET | `/api/profile-tags/available-tags` | public read |  | src/api/profile-tags/index.js:203 |
| GET | `/api/profile-tags/tags-for-profile` | public read |  | src/api/profile-tags/index.js:245 |
| GET | `/api/profile-tags/wot-tags` | public read |  | src/api/profile-tags/index.js:330 |
| GET | `/api/profile-tags/match` | public read |  | src/api/profile-tags/index.js:552 |
| GET | `/api/profile-tags/by-id` | public read |  | src/api/profile-tags/index.js:804 |
| GET | `/api/profile-tags/profiles-tagged` | public read |  | src/api/profile-tags/index.js:912 |
| GET | `/api/profile-tags/index` | public read |  | src/api/profile-tags/index.js:1085 |
| GET | `/api/profile-tags/authored-by` | public read |  | src/api/profile-tags/index.js:1316 |
| GET | `/api/profile-tags/pins` | public read |  | src/api/profile-tags/index.js:1553 |
| GET | `/api/event-tags/for-event` | public read |  | src/api/event-tags/index.js:142 |
| GET | `/api/event-tags/headers-for-tag` | public read |  | src/api/event-tags/index.js:203 |
| GET | `/api/event-tags/for-tag` | public read |  | src/api/event-tags/index.js:343 |
| GET | `/api/tags/index` | public read |  | src/api/event-tags/index.js:508 |
| GET | `/api/tags/applicability` | public read |  | src/api/event-tags/index.js:489 |
| GET | `/api/event-tags/notes-by-author` | public read |  | src/api/event-tags/index.js:592 |
| GET | `/api/io/imports/:tempId/word/:slug` | public read |  | src/api/io.js:326 |
| GET | `/api/concept-graph/summaries` | public read |  | src/api/concept-graph/index.js:28 |
| GET | `/api/concept-graph/node/:handle/neighbors` | public read |  | src/api/concept-graph/index.js:107 |
| GET | `/api/concept-graph/node/:handle/core-nodes` | public read |  | src/api/concept-graph/index.js:147 |
| GET | `/api/concept-graph/node/:handle` | public read |  | src/api/concept-graph/index.js:83 |
| GET | `/api/concept-graph/subgraph/:handle` | public read |  | src/api/concept-graph/index.js:160 |
| GET | `/api/brain/goals` | public read |  | src/api/brain/index.js:212 |
| GET | `/api/brain/orient` | public read |  | src/api/brain/index.js:400 |
| GET | `/api/brain/proposals` | public read |  | src/api/brain/index.js:471 |
| GET | `/api/brain/direction/:slug` | public read |  | src/api/brain/index.js:643 |
| GET | `/api/brain/goals/:slug` | public read |  | src/api/brain/index.js:256 |
| GET | `/api/brain/hygiene` | public read |  | src/api/brain/index.js:732 |
| GET | `/api/brain/export` | public read |  | src/api/brain/index.js:760 |
| GET | `/api/brain/serves-path` | public read |  | src/api/brain/index.js:808 |
| GET | `/api/concept/:handle/export-set` | guarded read (requireOwner; anon=next user=next) |  | src/api/concept/exportSet.js:39 |
| GET | `/api/concept/:handle/sharing-state` | public read |  | src/api/concept/sharingState.js:85 |
| GET | `/api/shared-by-me` | public read |  | src/api/concept/sharedByMe.js:104 |
| GET | `/api/adoption-queue` | public read |  | src/api/adoption/index.js:37 |
| GET | `/api/trusted-dictionary` | public read |  | src/api/adoption/index.js:280 |
| GET | `/api/dictionaries/concepts` | public read |  | src/api/adoption/index.js:463 |
| GET | `/api/dictionaries/concepts/items` | public read |  | src/api/adoption/index.js:503 |
| GET | `/api/dictionaries/concepts/firmware` | public read |  | src/api/adoption/index.js:576 |
| GET | `/api/adoption-twins` | public read |  | src/api/adoption/index.js:534 |
| GET | `/api/tapestry-key/status` | public read |  | src/api/tapestry-key/index.js:35 |
| GET | `/api/tapestry-key/offload-status` | public read |  | src/api/tapestry-key/index.js:363 |
| GET | `/api/tapestry-key/derive-status` | public read |  | src/api/tapestry-key/index.js:428 |
| GET | `/api/tapestry-key/resolve/:key` | public read |  | src/api/tapestry-key/index.js:272 |
| GET | `/api/tapestry-key/:key` | public read |  | src/api/tapestry-key/index.js:146 |

---

## Allowlist (approved by the owner 2026-10-10, every entry as proposed)

Rule applied: owner's side by default. Proposed only (1) the two already decided and (2) what pages already offer
ordinary signed-in people or customers **for their own things**, whose handler already scopes to the caller.

### Visitors (not signed in) — and therefore everyone

| # | Entry | Who | Why |
|---|---|---|---|
| V1 | POST `/api/strfry/publish` (`signAs:'client'`) | anyone | Decided. Publishing an event you signed yourself (principle 2). The handler keeps `signAs:'assistant'` on the owner's side. |
| V2 | POST `/api/neo4j/query` (reads) | anyone | Decided (book decision 3). The read backbone of public browsing; the handler keeps write Cypher on the owner's side. Signed-in non-customers keep today's 403 (quirk carried, AC-5). |
| V3 | POST `/api/auth/verify`, `/login`, `/verify-user`, `/login-user`, `/logout` | anyone | The sign-in handshake itself (ADR 0003). |

### Signed-in people (and customers)

| # | Entry | Who | Why | Note |
|---|---|---|---|---|
| S1 | POST `/api/strfry/negentropy-sync` | signed-in | Decided: the POV sync; the route guard narrows to the exact POV shape (ADR 0004). | |
| S2 | PUT `/api/user-prefs` | signed-in | Your own preferences (POV choice etc.); keyed by session. Search, Settings, user menu. | |
| S3 | POST `/api/assistant/publish-profile` | signed-in with an Assistant | Your own Assistant's profile; handler requires session = target. | |
| S4 | POST `/api/assistant/provision-key` | owner/admin/active customer | Your own Assistant key; handler refuses others and re-provisioning. | customers |
| S5 | POST `/api/assistant/avatar` | signed-in with an Assistant | Your own Assistant's avatar (route guard `requireOwnAssistant`). | |
| S6 | POST `/api/assistant/identification-tags/publish` | signed-in with an Assistant | Your Assistant signs its two taggings of you (session-bound). | |
| S7 | POST `/api/assistant/outbox-relays/publish` | signed-in with an Assistant | Your Assistant signs its relay list (session-bound). | |
| S8 | POST `/api/dlist-curation/header`, `/api/dlist-curation/update` | signed-in with an Assistant | Your Assistant's own curated lists (same-host + session + own keys). | 2 routes |
| S9 | POST `/api/list-headers/my-assistant/:handle/{self-declare,b-defer,b-append}` | signed-in with an Assistant | Your Assistant's own headers. | 3 routes |
| S10 | POST `/api/list-headers/me/:handle/{self-declare,b-defer,b-append}/{prepare,commit}` | signed-in | Your own headers, signed by your browser signer. | 6 routes |
| S11 | POST `/api/dictionaries/concepts/{new,edit,resync}` | signed-in with an Assistant | Your Assistant's own concept headers. | 3 routes |
| S12 | POST `/api/trusted-list/refresh-pinned-tag` | signed-in | The TL for your own pin (pin author = session). | **identity**: the instance's TA signs the TL for you |
| S13 | POST `/api/trusted-list/refresh-pinned-tags-for-viewer` | signed-in | TLs for your own pins (viewer = session). | **identity** (TA signs) |
| S14 | POST `/api/trusted-list/prepare-nip51-export` | signed-in | A read served by POST: the unsigned NIP-51 template for your own pin. | |
| S15 | POST `/api/trusted-list/notify-applicability` | signed-in | Fired after you apply a tag; schedules a debounced instance-wide refresh; takes no input. | **judgment**: not strictly your own thing |
| S16 | POST `/api/create-unsigned-kind10040` | signed-in | A read served by POST: the unsigned kind 10040 template (legacy customer pages). | legacy |
| S17 | POST `/api/publish-signed-kind10040` | signed-in | Publishing a kind 10040 you signed yourself (signature verified). Legacy customer pages. | legacy |

Not proposed (owner's side), though a page offers them to signed-in people today — **judgment calls** below:
POST `/api/trusted-list/publish` (TA-signed), POST `/api/auth/sign-up-new-customer`, POST `/api/neo4j/event-update`,
POST `/api/publish-kind10040-event` (dead flow). Per decision (b), people who lose them get the bare 403.

## Admin vs owner — flagged for the owner (decision e). Default: admins = owner.

**Owner's decision (2026-10-10):** E1 and E2 owner-only, checked in their handlers; everything else admin = owner.

| # | Action(s) | Why flagged | My lean |
|---|---|---|---|
| E1 | `signAs:'assistant'` on POST `/api/strfry/publish` (OPEN.md row 269) | The instance signs arbitrary content as itself | **owner-only** (settles row 269 as the record says) |
| E2 | PUT `/api/settings` / DELETE `/api/settings/*` touching `adminPubkeys` | An admin can add or remove admins, sidestepping owner-only `/api/admin/add|remove` (ADR 0016) | **owner-only for the admin list** (refuse `adminPubkeys` in an admin's patch/reset) |
| E3 | POST `/api/run-script`, POST `/api/brainstorm-control` | Run scripts on the host | owner-only, or keep admin if admins are fully trusted |
| E4 | POST `/api/firmware/install` | TA signs and republishes the seed; rewrites the concept graph | admin = owner |
| E5 | TA-signing graph writes: POST `/api/normalize/*` (40), concept self-declare / b-append / b-defer, pull-community-class-thread, property/generate-json-schema, trusted-list/publish | Act with the instance's identity | admin = owner |
| E6 | NIP-85 publishing as the instance: generate-nip85, publish-kind30382, create(-and-publish)-kind10040 | Instance/customer relay keys sign | admin = owner |
| E7 | Whole-instance destructive: POST `/api/strfry/wipe`, DELETE meili wipe, POST meili prune-unscored, POST `/api/delete-all-relationships`, POST `/api/normalize/restore-brain`, POST `/api/restore/upload|customer`, POST `/api/delete-customer` | Irreversible or wide | admin = owner (consider owner-only for strfry wipe and delete-all-relationships) |
| E8 | Service control: POST `/api/service-management/control`, POST `/api/streaming-etl/control`, GET `/api/systemd-services?action=`, router restart | Stop the instance's services | admin = owner |

## Judgment calls

**Owner's decision (2026-10-10):** accepted as proposed. For 8, the config-peek read and the export list and download
are closed to the owner's side; the customer reads stay public. At Review the owner also kept closed a customer
resetting their own algorithm preset (an already-guarded action whose handler allowed it; no page offers it to
customers).

1. **POST `/api/trusted-list/publish`** — the DList page offers "Publish Trusted List" to any signed-in person, but the
   instance's TA signs it. Proposed: owner's side (not allowlisted). Cost: non-admins get a bare 403 on that button.
2. **POST `/api/auth/sign-up-new-customer`** — legacy sign-up pages offer self-sign-up as a customer (mints
   instance-held relay keys, enrols in customer processing), yet the middleware lists it owner-only (never applied:
   `/api/auth/*` is skipped). Proposed: owner's side unless the owner runs open sign-up; then allowlist (signed-in).
3. **POST `/api/neo4j/event-update`** — DList pages offer a "sync to Neo4j" button to anyone; it re-imports a
   local-relay event and recreates its tag nodes. Proposed: owner's side.
4. **POST `/api/trusted-list/notify-applicability`** (S15) — proposed allowlisted though not strictly "own thing".
5. **S12/S13** — TA-signed refreshes for the person's own pins: proposed allowlisted (every person's pin flow needs them).
6. **POST `/api/publish-kind10040-event`** — dead since ADR 0003 (needs `session.challenge`). Proposed: owner's side.
7. **GETs that act lightly, kept as reads:** `/api/task-dashboard/state` (regenerates its state file once if missing;
   task reads stay public per c); public scans/searches (`/api/strfry/scan*`, `/api/search/profiles*`) and external-relay
   fan-out reads. Proposed: reads (C).
8. **Sensitive public reads** (not actions; AC-5 keeps them unless the owner adds them to its exception list):
   `/api/auth/test`, `/api/get-customers`, `/api/get-customer`, `/api/io/exports`, `/api/io/exports/:filename`.
   Proposed: the owner considers closing `/api/auth/test` and the export list/download (owner's side).
9. **The two GETs that act** (systemd-services with params, precompute-whitelist-maps) become owner's side for every
   method; their parameterless/status uses close too. `systemd-services` without params is a status read used by legacy
   owner pages only. Proposed: owner's side for the whole route (legacy owner pages unaffected).

## Size and batching

**Owner's decision (2026-10-10):** one release.

- Class A: **29 registrations (28 distinct routes) across 13 modules**; 2 are GETs that act (anonymous today).
- With the chosen design (ADR 0005: one route table + default-deny in the central check), all of class A closes in **one
  change** (middleware + table + conf-path seam + docs), not 29 edits. Recommendation: **one release** for the sweep.
- **Batch 0** (the shell-input fix) shipped separately, before this release.
- A batched alternative (interim hand guards first, then the table) was offered and declined.