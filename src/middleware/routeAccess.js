'use strict';
/**
 * The route table: who may use each route this instance serves.
 * Story security-auth-exposure #8, ADR security-auth-exposure/0005 (one route table; every action is the owner's side's
 * unless the table opens it).
 *
 * ROUTE_ACCESS is TOTAL: every route src/api registers (register(app)) and every route the entrypoint
 * (bin/control-panel.js) registers, keyed "<METHOD> <path as registered>", valued { access, kind, why }:
 *
 *   access  'public'      anyone
 *           'signed-in'   any verified session, and the owner's side
 *           'owner'       the owner's side: the owner, admins and direct-local callers
 *           'owner-only'  the owner and direct-local callers (none today: admins equal the owner, ADR 0005 Decision 4)
 *   kind    'read'        changes nothing and starts no heavy work
 *           'action'      changes something the instance keeps, or starts heavy work, whatever the HTTP method
 *   why     required on every action open to 'public' or 'signed-in'. Those entries ARE the allowlist (story AC-4):
 *           each says who may use it and why. Anything else is the owner's side's.
 *
 * authMiddleware (src/middleware/auth.js) resolves every /api request here with resolveRouteAccess. A request that no
 * entry matches is the owner's side's (fail closed), so a new route is closed until an entry opens it, and the
 * route-walk suite (test/admin-action-sweep.test.js) names any registered route that has no entry.
 *
 * Matching is Express's own: each key's path is compiled with the path-to-regexp Express uses, with Express's route
 * options (case-insensitive, optional trailing slash, whole path). HEAD resolves as GET, as Express dispatches it,
 * unless a HEAD key matches. When several entries match, the strictest access wins, so the answer never depends on
 * registration order.
 *
 * Routes outside the API prefix are listed so the table stays total; the middleware does not judge them (the
 * route-walk suite does). Not keyed: the static-file and API-docs mounts (/, /control, /legacy, /generated, /libs/*,
 * /docs), which serve files and documentation only; and the entrypoint's app-shell catch-all (GET *), which hands
 * every /api path on: a key for it would match every path and, strictest match winning, set the floor for every GET.
 *
 * Route guards and handler checks still narrow routes further (requireSyncManager*, requireOwner*, the owner-or-local
 * handler checks, the owner-only parameter checks); the table never widens what they allow.
 */

const ACCESS_ORDER = Object.freeze(['public', 'signed-in', 'owner', 'owner-only']);
const KINDS = new Set(['read', 'action']);
const KEY_RE = /^(GET|HEAD|POST|PUT|PATCH|DELETE|USE) \/\S*$/;

const PUBLIC_READ = Object.freeze({ access: 'public', kind: 'read' });
const OWNER_READ = Object.freeze({ access: 'owner', kind: 'read' });
const OWNER_ACTION = Object.freeze({ access: 'owner', kind: 'action' });
/** An allowlist entry: an action opened to `access` ('public' or 'signed-in'), with the reason. */
const allow = (access, why) => Object.freeze({ access, kind: 'action', why });

const WHY_HANDSHAKE = 'The sign-in handshake: it must work before anyone is signed in (ADR 0003).';

const ROUTE_ACCESS = Object.freeze({
  // ── Outside the API prefix (served by src/api) ──
  'GET /.well-known/nostr.json': PUBLIC_READ,
  'GET /.well-known/open-ranking.json': PUBLIC_READ,
  'POST /followers': PUBLIC_READ,
  'POST /muters': PUBLIC_READ,
  'POST /rank/pubkeys': PUBLIC_READ,
  'POST /search/pubkeys': PUBLIC_READ,
  'POST /stats/pubkey': PUBLIC_READ,

  // ── Served by the entrypoint (bin/control-panel.js) ──
  'GET /.well-known/security.txt': PUBLIC_READ,
  'GET /:filename.html': PUBLIC_READ,
  'GET /legacy': PUBLIC_READ,
  'GET /legacy/:filename.html': PUBLIC_READ,
  'GET /llms.txt': PUBLIC_READ,
  'GET /robots.txt': PUBLIC_READ,
  // The task-queue dashboard, mounted only when TASK_QUEUE_ENABLED=true (src/api/index.js), behind requireOwnerOrAdmin;
  // its router includes job retry and remove.
  'USE /admin/queues': OWNER_ACTION,

  // ── The API ──
  'POST /api/add-new-customer': OWNER_ACTION,
  'POST /api/admin/add': OWNER_ACTION,
  'GET /api/admin/list': OWNER_READ,
  'POST /api/admin/remove': OWNER_ACTION,
  'GET /api/adoption-queue': PUBLIC_READ,
  'GET /api/adoption-twins': PUBLIC_READ,
  'GET /api/algos/config/get': PUBLIC_READ,
  'GET /api/algos/config/get/graperank': PUBLIC_READ,
  'POST /api/algos/config/reset': OWNER_ACTION,
  'POST /api/algos/config/update': OWNER_ACTION,
  'POST /api/algos/config/update/graperank': OWNER_ACTION,
  // This branch's avatar routes are the owner's: both handlers admit only the owner's side (owner, admins,
  // direct-local). The read reaches its handler for anyone today and keeps that access; the store is an action.
  'GET /api/assistant/owner-avatar': PUBLIC_READ,
  'POST /api/assistant/avatar': OWNER_ACTION,
  'POST /api/assistant/provision-key': allow('signed-in',
    "Your own Assistant key; the handler admits only the owner, an admin or an active customer, and refuses a second " +
    "provisioning."),
  'GET /api/assistant/pubkey': PUBLIC_READ,
  'POST /api/assistant/publish-profile': allow('signed-in',
    "Your own Assistant's profile; the handler requires the session to be that Assistant's person."),
  'GET /api/assistant/status': PUBLIC_READ,
  'GET /api/audit/bios': PUBLIC_READ,
  'GET /api/audit/concept': PUBLIC_READ,
  'GET /api/audit/concepts-summary': PUBLIC_READ,
  'GET /api/audit/firmware': PUBLIC_READ,
  'GET /api/audit/health': PUBLIC_READ,
  'GET /api/audit/labels': PUBLIC_READ,
  'GET /api/audit/orphans': PUBLIC_READ,
  'GET /api/audit/skeletons': PUBLIC_READ,
  'GET /api/audit/stats': PUBLIC_READ,
  'GET /api/audit/threads': PUBLIC_READ,
  'GET /api/audit/wiring': PUBLIC_READ,
  'POST /api/auth/login': allow('public', WHY_HANDSHAKE),
  'POST /api/auth/login-user': allow('public', WHY_HANDSHAKE),
  'POST /api/auth/logout': allow('public', "Signing out ends your own session; harmless without one (ADR 0003)."),
  'POST /api/auth/sign-up-new-customer': OWNER_ACTION,
  'GET /api/auth/status': PUBLIC_READ,
  'GET /api/auth/test': OWNER_READ,
  'GET /api/auth/user-classification': PUBLIC_READ,
  'POST /api/auth/verify': allow('public', WHY_HANDSHAKE),
  'POST /api/auth/verify-user': allow('public', WHY_HANDSHAKE),
  'POST /api/backup-customers': OWNER_ACTION,
  'GET /api/backups': OWNER_READ,
  'GET /api/backups/download': OWNER_READ,
  'POST /api/batch-transfer': OWNER_ACTION,
  'GET /api/blacklist-count': PUBLIC_READ,
  'GET /api/brain/direction/:slug': PUBLIC_READ,
  'GET /api/brain/export': PUBLIC_READ,
  'GET /api/brain/goals': PUBLIC_READ,
  'GET /api/brain/goals/:slug': PUBLIC_READ,
  'GET /api/brain/hygiene': PUBLIC_READ,
  'GET /api/brain/orient': PUBLIC_READ,
  'GET /api/brain/proposals': PUBLIC_READ,
  'GET /api/brain/serves-path': PUBLIC_READ,
  'POST /api/brainstorm-control': OWNER_ACTION,
  'POST /api/calculate-hops': OWNER_ACTION,
  'GET /api/calculation-history/analyzeFollowsMutesReports': PUBLIC_READ,
  'GET /api/calculation-history/hops': PUBLIC_READ,
  'GET /api/calculation-history/kind30382Export': PUBLIC_READ,
  'GET /api/calculation-history/personalizedGrapeRank': PUBLIC_READ,
  'GET /api/calculation-history/personalizedPageRank': PUBLIC_READ,
  'GET /api/calculation-history/processAllTrustMetrics': PUBLIC_READ,
  'GET /api/calculation-status': PUBLIC_READ,
  'POST /api/change-customer-status': OWNER_ACTION,
  'GET /api/concept-graph/node/:handle': PUBLIC_READ,
  'GET /api/concept-graph/node/:handle/core-nodes': PUBLIC_READ,
  'GET /api/concept-graph/node/:handle/neighbors': PUBLIC_READ,
  'GET /api/concept-graph/subgraph/:handle': PUBLIC_READ,
  'GET /api/concept-graph/summaries': PUBLIC_READ,
  'POST /api/concept/:handle/b-append': OWNER_ACTION,
  'POST /api/concept/:handle/b-defer': OWNER_ACTION,
  'GET /api/concept/:handle/export-set': OWNER_READ,
  'POST /api/concept/:handle/pull-community-class-thread': OWNER_ACTION,
  'POST /api/concept/:handle/self-declare': OWNER_ACTION,
  'GET /api/concept/:handle/sharing-state': PUBLIC_READ,
  'POST /api/create-all-customer-relays': OWNER_ACTION,
  'POST /api/create-and-publish-kind10040': OWNER_ACTION,
  'POST /api/create-kind10040': OWNER_ACTION,
  'POST /api/create-unsigned-kind10040': allow('signed-in',
    "A read served by POST: the unsigned kind 10040 template for the legacy customer pages."),
  'GET /api/customer-schedule/history': PUBLIC_READ,
  'GET /api/customer-schedule/status': PUBLIC_READ,
  'POST /api/customer-schedule/trigger': OWNER_ACTION,
  'POST /api/customer-schedule/update': OWNER_ACTION,
  'GET /api/debug': PUBLIC_READ,
  'POST /api/delete-all-relationships': OWNER_ACTION,
  'POST /api/delete-customer': OWNER_ACTION,
  'GET /api/deploy-safety/status': PUBLIC_READ,
  'POST /api/dlist-curation/header': allow('signed-in',
    "Your own Assistant authors its curation header; the handler requires the same host, your session and your own " +
    "Assistant's keys."),
  'GET /api/dlists/item-counts': PUBLIC_READ,
  'GET /api/dlists/page-counts': PUBLIC_READ,
  'GET /api/event': PUBLIC_READ,
  'GET /api/event-tags/for-event': PUBLIC_READ,
  'GET /api/event-tags/for-tag': PUBLIC_READ,
  'GET /api/event-tags/headers-for-tag': PUBLIC_READ,
  'GET /api/event-tags/notes-by-author': PUBLIC_READ,
  'POST /api/export-whitelist': OWNER_ACTION,
  'GET /api/feed': PUBLIC_READ,
  'GET /api/firmware/concept/:slug': PUBLIC_READ,
  'POST /api/firmware/install': OWNER_ACTION,
  'GET /api/firmware/install-status': PUBLIC_READ,
  'GET /api/firmware/manifest': PUBLIC_READ,
  'GET /api/firmware/versions': PUBLIC_READ,
  'POST /api/generate-blacklist': OWNER_ACTION,
  'POST /api/generate-graperank': OWNER_ACTION,
  'POST /api/generate-nip85': OWNER_ACTION,
  'POST /api/generate-pagerank': OWNER_ACTION,
  'POST /api/generate-reports': OWNER_ACTION,
  'POST /api/generate-verified-followers': OWNER_ACTION,
  'GET /api/get-30382-count-externally': PUBLIC_READ,
  'GET /api/get-all-10040-authors-externally': PUBLIC_READ,
  'GET /api/get-all-10040-authors-locally': PUBLIC_READ,
  'GET /api/get-blacklist-config': PUBLIC_READ,
  'GET /api/get-customer': PUBLIC_READ,
  'GET /api/get-customer-relay-keys': OWNER_READ,
  'GET /api/get-customers': PUBLIC_READ,
  'GET /api/get-follows-hops': PUBLIC_READ,
  'GET /api/get-follows-hops-paths': PUBLIC_READ,
  'GET /api/get-graperank-config': PUBLIC_READ,
  'GET /api/get-graperank-review': PUBLIC_READ,
  'GET /api/get-grapevine-followers': PUBLIC_READ,
  'GET /api/get-grapevine-follows': PUBLIC_READ,
  'GET /api/get-grapevine-interaction': PUBLIC_READ,
  'GET /api/get-grapevine-muters': PUBLIC_READ,
  'GET /api/get-grapevine-reporters': PUBLIC_READ,
  'GET /api/get-kind0': PUBLIC_READ,
  'GET /api/get-kind10040-event': PUBLIC_READ,
  'GET /api/get-kind10040-info': PUBLIC_READ,
  'GET /api/get-kind30382-info': PUBLIC_READ,
  'GET /api/get-network-proximity': PUBLIC_READ,
  'GET /api/get-nip56-profiles': PUBLIC_READ,
  'GET /api/get-nip85-status': PUBLIC_READ,
  'GET /api/get-npub-from-pubkey': PUBLIC_READ,
  'GET /api/get-profile-scores': PUBLIC_READ,
  'GET /api/get-profiles': PUBLIC_READ,
  'GET /api/get-pubkey-from-npub': PUBLIC_READ,
  'GET /api/get-recently-active-pubkeys': PUBLIC_READ,
  'GET /api/get-strfry-filteredContent': PUBLIC_READ,
  'GET /api/get-user-counts': PUBLIC_READ,
  'GET /api/get-user-data': PUBLIC_READ,
  'GET /api/get-whitelist': PUBLIC_READ,
  'GET /api/get-whitelist-config': PUBLIC_READ,
  'GET /api/grapevine/preferences': PUBLIC_READ,
  'PUT /api/grapevine/preferences': OWNER_ACTION,
  'GET /api/hops-count': PUBLIC_READ,
  'GET /api/influence-count': PUBLIC_READ,
  'GET /api/instance-status': PUBLIC_READ,
  'GET /api/io/exports': OWNER_READ,
  'POST /api/io/exports': OWNER_ACTION,
  'GET /api/io/exports/:filename': OWNER_READ,
  'POST /api/io/imports/:tempId/execute': OWNER_ACTION,
  'GET /api/io/imports/:tempId/word/:slug': PUBLIC_READ,
  'POST /api/io/imports/upload': OWNER_ACTION,
  'GET /api/list-status': PUBLIC_READ,
  'POST /api/negentropy-sync': OWNER_ACTION,
  'POST /api/negentropy-sync-personal': OWNER_ACTION,
  'POST /api/negentropy-sync-profiles': OWNER_ACTION,
  'POST /api/negentropy-sync-wot': OWNER_ACTION,
  'GET /api/neo4j-config/overview': PUBLIC_READ,
  'GET /api/neo4j-health/alerts': PUBLIC_READ,
  'GET /api/neo4j-health/complete': PUBLIC_READ,
  'GET /api/neo4j-health/heap-metrics-history': PUBLIC_READ,
  'GET /api/neo4j-health/preserved-heap-metrics': PUBLIC_READ,
  'GET /api/neo4j-health/task-timeline': PUBLIC_READ,
  'GET /api/neo4j-logs/errors': PUBLIC_READ,
  'POST /api/neo4j-setup-constraints-and-indexes': OWNER_ACTION,
  'GET /api/neo4j-status': PUBLIC_READ,
  'GET /api/neo4j/event-check': PUBLIC_READ,
  'POST /api/neo4j/event-update': OWNER_ACTION,
  'GET /api/neo4j/event-uuids': PUBLIC_READ,
  'POST /api/neo4j/query': allow('public',
    "The read backbone of public browsing (book negentropy-sync-access decision 3); the handler keeps write Cypher " +
    "on the owner's side (ADR 0001)."),
  'GET /api/network-status': PUBLIC_READ,
  'GET /api/nip05/verify': PUBLIC_READ,
  'POST /api/normalize/add-node-as-element': OWNER_ACTION,
  'POST /api/normalize/add-relationship': OWNER_ACTION,
  'POST /api/normalize/add-subset': OWNER_ACTION,
  'POST /api/normalize/add-to-set': OWNER_ACTION,
  'POST /api/normalize/adoption-disposition': OWNER_ACTION,
  'POST /api/normalize/apply-enumerations': OWNER_ACTION,
  'POST /api/normalize/approve-proposal': OWNER_ACTION,
  'POST /api/normalize/create-child-goal': OWNER_ACTION,
  'POST /api/normalize/create-concept': OWNER_ACTION,
  'POST /api/normalize/create-element': OWNER_ACTION,
  'POST /api/normalize/create-property': OWNER_ACTION,
  'POST /api/normalize/create-resource': OWNER_ACTION,
  'POST /api/normalize/create-set': OWNER_ACTION,
  'POST /api/normalize/create-work-record': OWNER_ACTION,
  'POST /api/normalize/delete-relationship': OWNER_ACTION,
  'POST /api/normalize/enumerate': OWNER_ACTION,
  'POST /api/normalize/fork-node': OWNER_ACTION,
  'POST /api/normalize/generate-property-tree': OWNER_ACTION,
  'POST /api/normalize/json': OWNER_ACTION,
  'POST /api/normalize/link-concepts': OWNER_ACTION,
  'POST /api/normalize/make-proposal': OWNER_ACTION,
  'POST /api/normalize/migrate-primary-property-ztags': OWNER_ACTION,
  'GET /api/normalize/node-primitives': PUBLIC_READ,
  'POST /api/normalize/note-goal-idea': OWNER_ACTION,
  'POST /api/normalize/prune-superset-edges': OWNER_ACTION,
  'POST /api/normalize/reconcile-primary-property': OWNER_ACTION,
  'POST /api/normalize/record-priority-signal': OWNER_ACTION,
  'POST /api/normalize/record-restore-drill': OWNER_ACTION,
  'GET /api/normalize/relationship-primitives': PUBLIC_READ,
  'POST /api/normalize/restore-brain': OWNER_ACTION,
  'POST /api/normalize/save-element-json': OWNER_ACTION,
  'POST /api/normalize/save-schema': OWNER_ACTION,
  'POST /api/normalize/set-json-tag': OWNER_ACTION,
  'POST /api/normalize/set-slug': OWNER_ACTION,
  'POST /api/normalize/skeleton': OWNER_ACTION,
  'POST /api/normalize/skip-proposal': OWNER_ACTION,
  'POST /api/normalize/trusted-dictionary-snapshot': OWNER_ACTION,
  'POST /api/normalize/update-goal-intent': OWNER_ACTION,
  'POST /api/normalize/verify-resource': OWNER_ACTION,
  'POST /api/normalize/wire-implicit-elements': OWNER_ACTION,
  'GET /api/owner-info': PUBLIC_READ,
  'GET /api/owner/pubkey': PUBLIC_READ,
  'GET /api/personalized-pagerank': OWNER_ACTION,
  'POST /api/post-blacklist-config': OWNER_ACTION,
  'POST /api/post-graperank-config': OWNER_ACTION,
  'POST /api/post-whitelist-config': OWNER_ACTION,
  'POST /api/process-all-active-customers': OWNER_ACTION,
  'GET /api/profile-tags/authored-by': PUBLIC_READ,
  'GET /api/profile-tags/available-tags': PUBLIC_READ,
  'GET /api/profile-tags/by-id': PUBLIC_READ,
  'GET /api/profile-tags/index': PUBLIC_READ,
  'GET /api/profile-tags/match': PUBLIC_READ,
  'GET /api/profile-tags/pins': PUBLIC_READ,
  'GET /api/profile-tags/profiles-tagged': PUBLIC_READ,
  'GET /api/profile-tags/tags-for-profile': PUBLIC_READ,
  'GET /api/profile-tags/wot-tags': PUBLIC_READ,
  'GET /api/profiles': PUBLIC_READ,
  'POST /api/property/generate-json-schema': OWNER_ACTION,
  'POST /api/publish-kind10040-event': OWNER_ACTION,
  'POST /api/publish-kind30382': OWNER_ACTION,
  'GET /api/publish-policy': PUBLIC_READ,
  'POST /api/publish-signed-kind10040': allow('signed-in',
    "Publishing a validly signed kind 10040 (any author; the handler verifies the signature and relays it as signed, principle 2); legacy customer pages."),
  'GET /api/ranking-status': PUBLIC_READ,
  'GET /api/reactions/external': PUBLIC_READ,
  'POST /api/reconciliation': OWNER_ACTION,
  'GET /api/relay-config': PUBLIC_READ,
  'GET /api/relay/external': PUBLIC_READ,
  'GET /api/relay/presence': PUBLIC_READ,
  'GET /api/relays': PUBLIC_READ,
  'POST /api/restore/customer': OWNER_ACTION,
  'GET /api/restore/sets': OWNER_READ,
  'POST /api/restore/upload': OWNER_ACTION,
  'POST /api/run-script': OWNER_ACTION,
  'POST /api/run-task': OWNER_ACTION,
  'POST /api/scheduled-tasks/create': OWNER_ACTION,
  'POST /api/scheduled-tasks/delete': OWNER_ACTION,
  'GET /api/scheduled-tasks/history': PUBLIC_READ,
  'GET /api/scheduled-tasks/list': PUBLIC_READ,
  'GET /api/scheduled-tasks/registry-tasks': PUBLIC_READ,
  'GET /api/scheduled-tasks/status': PUBLIC_READ,
  'POST /api/scheduled-tasks/update': OWNER_ACTION,
  'GET /api/search/profiles': PUBLIC_READ,
  'GET /api/search/profiles/keyword': PUBLIC_READ,
  'GET /api/search/profiles/keyword/precompute-whitelist-maps': OWNER_ACTION,
  'GET /api/search/profiles/keyword/precompute-whitelist-maps/status': PUBLIC_READ,
  'GET /api/search/profiles/meili': PUBLIC_READ,
  'POST /api/search/profiles/meili/backfill-profiles': OWNER_ACTION,
  'GET /api/search/profiles/meili/bulk-status': PUBLIC_READ,
  'GET /api/search/profiles/meili/document/:pubkey': PUBLIC_READ,
  'POST /api/search/profiles/meili/load-scores': OWNER_ACTION,
  'POST /api/search/profiles/meili/prune-unscored': OWNER_ACTION,
  'GET /api/search/profiles/meili/random-scored': PUBLIC_READ,
  'POST /api/search/profiles/meili/resync': OWNER_ACTION,
  'GET /api/search/profiles/meili/scored-missing-profile': PUBLIC_READ,
  'GET /api/search/profiles/meili/settings': PUBLIC_READ,
  'GET /api/search/profiles/meili/stats': PUBLIC_READ,
  'GET /api/search/profiles/meili/tasks': PUBLIC_READ,
  'DELETE /api/search/profiles/meili/wipe': OWNER_ACTION,
  'GET /api/search/profiles/stream': PUBLIC_READ,
  'POST /api/service-management/control': OWNER_ACTION,
  'GET /api/service-management/logs': PUBLIC_READ,
  'GET /api/service-management/status': PUBLIC_READ,
  'GET /api/service-status': PUBLIC_READ,
  'GET /api/settings': OWNER_READ,
  'PUT /api/settings': OWNER_ACTION,
  'DELETE /api/settings/*': OWNER_ACTION,
  'GET /api/settings/defaults': OWNER_READ,
  'GET /api/settings/overrides': OWNER_READ,
  'GET /api/shared-by-me': PUBLIC_READ,
  'GET /api/status': PUBLIC_READ,
  'GET /api/status/neo4j-constraints': PUBLIC_READ,
  'POST /api/streaming-etl/control': OWNER_ACTION,
  'GET /api/streaming-etl/logs': PUBLIC_READ,
  'GET /api/streaming-etl/status': PUBLIC_READ,
  'GET /api/strfry-stats': PUBLIC_READ,
  'GET /api/strfry-status': PUBLIC_READ,
  'POST /api/strfry/negentropy-sync': allow('signed-in',
    "Signed-in people may run the point-of-view sync (book negentropy-sync-access decision 2); the route guard " +
    "narrows it to exactly that shape, every other sync is the owner's side's (ADR 0004)."),
  'GET /api/strfry/negentropy-sync/count': OWNER_READ,
  'GET /api/strfry/negentropy-sync/status': OWNER_READ,
  'GET /api/strfry/negentropy-sync/stream': OWNER_READ,
  'POST /api/strfry/publish': allow('public',
    "Anyone may publish an event they signed themselves (principle 2); the handler verifies the signature and keeps " +
    "signAs:'assistant' for the owner (ADR 0002, ADR 0005)."),
  'POST /api/strfry/router-config': OWNER_ACTION,
  'GET /api/strfry/router-plugins': PUBLIC_READ,
  'GET /api/strfry/router-presets': PUBLIC_READ,
  'POST /api/strfry/router-restart': OWNER_ACTION,
  'POST /api/strfry/router-restore-defaults': OWNER_ACTION,
  'GET /api/strfry/router-status': PUBLIC_READ,
  'POST /api/strfry/router-toggle': OWNER_ACTION,
  'GET /api/strfry/scan': PUBLIC_READ,
  'GET /api/strfry/scan/count': PUBLIC_READ,
  'GET /api/strfry/scan/stream': PUBLIC_READ,
  'POST /api/strfry/wipe': OWNER_ACTION,
  'GET /api/systemd-services': OWNER_ACTION,
  'GET /api/tags/applicability': PUBLIC_READ,
  'GET /api/tags/index': PUBLIC_READ,
  'GET /api/tapestry-key/:key': PUBLIC_READ,
  'POST /api/tapestry-key/:key': OWNER_ACTION,
  'POST /api/tapestry-key/derive-all/:label': OWNER_ACTION,
  'GET /api/tapestry-key/derive-status': PUBLIC_READ,
  'POST /api/tapestry-key/derive/:key': OWNER_ACTION,
  'POST /api/tapestry-key/initialize': OWNER_ACTION,
  'POST /api/tapestry-key/offload': OWNER_ACTION,
  'POST /api/tapestry-key/offload-all': OWNER_ACTION,
  'GET /api/tapestry-key/offload-status': PUBLIC_READ,
  'GET /api/tapestry-key/resolve/:key': PUBLIC_READ,
  'GET /api/tapestry-key/status': PUBLIC_READ,
  'GET /api/task-analytics/analytics': PUBLIC_READ,
  'GET /api/task-analytics/performance': PUBLIC_READ,
  'GET /api/task-analytics/predictions': PUBLIC_READ,
  'GET /api/task-analytics/trends': PUBLIC_READ,
  'GET /api/task-dashboard/state': PUBLIC_READ,
  'GET /api/task-explorer/data': PUBLIC_READ,
  'GET /api/task-explorer/single-task/data': PUBLIC_READ,
  'GET /api/task-watchdog/alerts': PUBLIC_READ,
  'GET /api/task-watchdog/orphaned-processes': PUBLIC_READ,
  'GET /api/task-watchdog/status': PUBLIC_READ,
  'GET /api/task-watchdog/stuck-tasks': PUBLIC_READ,
  'POST /api/toggle-strfry-filteredContent': OWNER_ACTION,
  'GET /api/trusted-dictionary': PUBLIC_READ,
  'POST /api/trusted-list/notify-applicability': allow('signed-in',
    "Sent after you apply a tag; schedules one debounced instance-wide applicability refresh and takes no input."),
  'POST /api/trusted-list/prepare-nip51-export': allow('signed-in',
    "A read served by POST: the unsigned NIP-51 template for your own pin."),
  'POST /api/trusted-list/publish': OWNER_ACTION,
  'POST /api/trusted-list/refresh-all-pinned-tags': OWNER_ACTION,
  'POST /api/trusted-list/refresh-applicability-lists': OWNER_ACTION,
  'POST /api/trusted-list/refresh-pinned-tag': allow('signed-in',
    "Refreshes the Trusted List for your own pin (the handler requires the pin's author to be you); the instance's " +
    "assistant signs it."),
  'POST /api/trusted-list/refresh-pinned-tags-for-viewer': allow('signed-in',
    "Refreshes the Trusted Lists for your own pins (the handler requires the viewer to be you); the instance's " +
    "assistant signs them."),
  'POST /api/update-customer-display-name': OWNER_ACTION,
  'GET /api/user-prefs': PUBLIC_READ,
  'PUT /api/user-prefs': allow('signed-in',
    "Your own preferences (your point of view and the like); the handler keys them by your session."),
  'GET /api/user/:pubkey/content': PUBLIC_READ,
  'GET /api/user/:pubkey/notes': PUBLIC_READ,
  'GET /api/validate-encoding': PUBLIC_READ,
  'GET /api/whitelist-preview-count': PUBLIC_READ,
  'GET /api/whitelist-stats': PUBLIC_READ,
});

for (const [key, v] of Object.entries(ROUTE_ACCESS)) {
  if (!KEY_RE.test(key)) throw new Error(`routeAccess: malformed key "${key}" (want "<METHOD> /path as registered")`);
  if (!v || !ACCESS_ORDER.includes(v.access)) {
    throw new Error(`routeAccess: "${key}" has no valid access (one of ${ACCESS_ORDER.join(', ')})`);
  }
  if (!KINDS.has(v.kind)) throw new Error(`routeAccess: "${key}" has no valid kind ('read' or 'action')`);
  const opened = v.kind === 'action' && (v.access === 'public' || v.access === 'signed-in');
  if (opened && !(typeof v.why === 'string' && v.why.trim())) {
    throw new Error(`routeAccess: "${key}" opens an action to ${v.access} without a why (the allowlist, story AC-4)`);
  }
}

// Express's own path matcher and route options, compiled lazily, once.
const pathToRegexp = require(require.resolve('path-to-regexp', { paths: [require.resolve('express')] }));
const EXPRESS_ROUTE_OPTIONS = Object.freeze({ sensitive: false, strict: false, end: true });
let byMethod = null;

function compiled() {
  if (byMethod) return byMethod;
  const map = new Map();
  for (const [key, v] of Object.entries(ROUTE_ACCESS)) {
    const sp = key.indexOf(' ');
    const method = key.slice(0, sp);
    if (method === 'USE') continue; // a mount outside the API prefix, never resolved per request
    if (!map.has(method)) map.set(method, []);
    const re = pathToRegexp(key.slice(sp + 1), [], { ...EXPRESS_ROUTE_OPTIONS });
    map.get(method).push({ key, re, access: v.access });
  }
  byMethod = map;
  return byMethod;
}

/**
 * The entries for `method` whose path matches `reqPath`. HEAD considers HEAD and GET entries together, since Express
 * dispatches HEAD to the first route with either; the strictest of them then wins in resolveRouteAccess.
 */
function matching(method, reqPath) {
  const m = String(method || '').toUpperCase();
  const hits = (want) => (compiled().get(want) || []).filter((e) => e.re.test(reqPath));
  return m === 'HEAD' ? hits('HEAD').concat(hits('GET')) : hits(m);
}

/**
 * Who may make this request: 'public', 'signed-in', 'owner' or 'owner-only'. Of all matching entries the strictest
 * wins; no match is 'owner' (fail closed).
 */
function resolveRouteAccess(method, reqPath) {
  const found = matching(method, reqPath);
  if (found.length === 0) return 'owner';
  const rank = (access) => ACCESS_ORDER.indexOf(access);
  return found.reduce((a, e) => (rank(e.access) > rank(a) ? e.access : a), found[0].access);
}

/** Whether this request (method, path) is dispatched to the route registered as `key`, by the same matcher. */
function matchesRoute(key, method, reqPath) {
  return matching(method, reqPath).some((e) => e.key === key);
}

module.exports = { ROUTE_ACCESS, ACCESS_ORDER, resolveRouteAccess, matchesRoute };
