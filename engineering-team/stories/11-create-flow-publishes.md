# Story 11: Create flow publishes a new community (Slice 5)

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background

The Create wizard at `/create` has been a five-step flow against mock data since Slice 0: Name → Similar circles → Topics → Founding voices → Review. The final Review step's "Create your circle" button currently navigates to `/my-circles` without writing anything.

Slice 4 landed the publish infrastructure: NIP-07 sign-in, the `viewer` pubkey threaded through the App, `buildCommunityRecord` + `buildCommunitiesDListHeader` event builders, and the `publishEvent` wrapper that mocks in dev / publishes to `wss://communities.brainstorm.world` in production. Slice 5's job is the smallest possible change to make Create's final button do something real.

Two events get published on Create:

1. **`kind 39998` brainstorm-communities DList header** — published first via `buildCommunitiesDListHeader`. Replaceable per its d-tag, so first-time creators establish their DList here and subsequent creators idempotently re-publish (one wasted signature per create event after the first; acceptable at v1 scale).
2. **`kind 39999` community-record ListItem** — built via `buildCommunityRecord` from the wizard's collected state (name, description, topics, founding voices, plus default `weighting_model` and `endorsement_threshold` from `gr-community-default-v1` / 0.5). Default `relay` set is `DEFAULT_RELAYS` from `events/publish.js` — `wss://communities.brainstorm.world` for v1, per PLAN.md §6 Q5.3's "brainstorm.world-managed for v1" deferral.

The slug — which becomes the event's `d` tag — is auto-derived from the wizard's `name` field (lowercase, hyphenate non-alphanumeric, collapse, trim). PLAN.md §6 Q4 commits to "no hard dedup" — two different curators with the same slug coexist at the protocol level because d-tags are scoped per `(kind, pubkey)`. No uniqueness check at publish time.

On successful publish, the UI optimistically adds the new community to the viewer's `joinedSet` and navigates to `/community/<slug>`. On failure, the wizard stays on the Review step with an inline error and the user can retry.

Live publish to a real relay is deferred to staging smoke (matches every prior write-path story). In dev mode (`VITE_USE_MOCK_DATA=true`), the publish wrapper logs the signed events to console with `[publish/mock]` and resolves success; the UI proceeds as if real.

## User-facing description

**As a NIP-07-signed-in visitor** with an idea for a circle, I want the Create wizard's final button to actually publish my community to the network — header DList plus the new community-record, both signed with my key — **so that** the circle exists for other people running mirror relays to discover and join.

**As an operator** seeding the brainstorm.world launch with 3-5 example circles (PLAN.md §6 Q5 commits to this), I want the same Create flow to be the path I take — no special "operator seed" code branch — **so that** seeded circles look like every other circle to the API and to other clients. Operator launches → signs in → creates 3-5 communities → done.

**As a curious unsigned visitor**, I want the "Start a Circle" entry point to remain visible but the wizard's final action to clearly require sign-in **so that** I understand the trade — I can explore the wizard, but only members with a real identity can publish.

## Acceptance criteria

### Publish behavior

- [ ] Clicking "Create your circle" on the Review step (step 4) of `/create` publishes **two events in sequence**:
  1. The viewer's kind-39998 `brainstorm-communities` DList header via `buildCommunitiesDListHeader({ viewerPubkey })` — same `d` tag (`"brainstorm-communities"`) for every viewer, so this is idempotent under nostr's replaceable-event semantics.
  2. The new kind-39999 community-record via `buildCommunityRecord({ viewerPubkey, community })` where `community` is the projection of the wizard's collected state.
- [ ] Both events go through `publishEvent` (the Slice 4 wrapper). In dev mode (`VITE_USE_MOCK_DATA=true`), both are logged with `[publish/mock]` and the success path proceeds; in production, both go to `DEFAULT_RELAYS` = `['wss://communities.brainstorm.world']`.
- [ ] The community-record event is only published if the header publish resolved `ok: true`. A header failure aborts the flow; the user sees an inline error and the wizard stays on Review for retry.
- [ ] On both-events-success: optimistically add the new community slug to `joinedSet`, then navigate to `/community/<slug>`. The viewer is the founder of their own community and a member of it by default.
- [ ] On record-event failure (header succeeded): inline error on Review describing the failure mode (`no-extension` / `rejected` / `network` / `rejected-by-relay` / `timeout`); user can retry. The header is already on the network — re-publish is fine because the header is idempotent.

### Slug derivation

- [ ] The slug derives from the wizard's `name` field by: trim → lowercase → replace any run of non-alphanumeric characters with a single hyphen → trim hyphens. Examples:
  - `"Sunset Hikers"` → `"sunset-hikers"`
  - `"Code & Coffee"` → `"code-coffee"`
  - `"  The Listening Room!  "` → `"the-listening-room"`
- [ ] If the derived slug is empty (e.g. the user typed only punctuation), the publish fails before reaching `buildCommunityRecord` with an inline error: "Please choose a name with at least one letter or number."
- [ ] The slug derivation is a pure function exported alongside the existing event builders (or in `src/lib/`), so it's unit-testable and reusable by Edit / future stories.

### Wizard wiring

- [ ] The Review step shows the locked decisions: name, description, selected topics, founding voices count, plus a small "Your circle will live on `communities.brainstorm.world` for now" note referencing the v1 brainstorm.world-managed relay default (PLAN.md §6 Q5.3).
- [ ] The "Create your circle" button is disabled when the viewer is not signed in. In its place, a friendly call-to-action prompts sign-in inline (don't redirect away from the wizard; preserve the user's typed state). Reads something like "Sign in to publish your circle" with a Sign-in button that fires the same NIP-07 flow the Header uses.
- [ ] Clicking the button shows a "Publishing…" state on the button itself for the duration of the two-event sequence. Both Cancel/Back navigation and the button itself disable during publish.
- [ ] After successful publish, the user lands on `/community/<slug>`. The new community's detail page shows them as a member (`joinedSet.has(slug) === true`) and presents the "Your view" / "Leave" actions instead of the Join CTA. The Conversation tab is empty (Slice 6 wires posts) and the People tab shows just the founding voices.

### Seed members → record fields

- [ ] The wizard's `seedMembers` array (collected at step 3) becomes the community-record's `seed` tags. Each seed is a pubkey string. The viewer is **also** included as a seed (founder is always a seed) — added automatically if not already present.
- [ ] `founder` tag is set to the viewer's pubkey.
- [ ] The topics selected at step 2 become `topic` tags (multi). Empty topic selection is allowed (no topic tags emitted; matches PLAN.md §3 which marks `topic` as optional).
- [ ] `weighting_model` is `gr-community-default-v1`; `endorsement_threshold` is `0.5`. Both come from `WEIGHTING_MODEL_ID` and `DEFAULT_THRESHOLD` constants imported from `src/algos/grCommunity/` if accessible, or from inline constants in the wizard that match those values. Either works — the test pins the literal strings.
- [ ] `relay` tags use `DEFAULT_RELAYS` from `publish.js` (single entry `wss://communities.brainstorm.world` for v1).

### Edge cases & guards

- [ ] If the user signs out partway through the wizard (after typing name + selecting seeds), the Review step's CTA flips to the sign-in inline prompt. Their typed state is preserved.
- [ ] If the wizard's `name` is empty at Review (user used Back), Continue from prior steps already gates this — Review shouldn't be reachable without a name. Defensive: the publish path validates `name.trim().length > 0` and bails with an inline error if not.
- [ ] If `seedMembers.length === 0` at Review, the slugify still works but the founder (viewer) is the only seed in the published event. PLAN.md §3 requires at least one seed; the viewer alone satisfies this.
- [ ] Slug collision with an existing community (same `(viewer, slug)` tuple) **replaces** the prior record under nostr's replaceable-event rules. We don't try to detect or warn — that's the documented "no hard dedup" policy (PLAN.md §6 Q4).

### Hygiene & mock-mode

- [ ] In mock mode, the wizard's mock-data imports (the `communities` / `members` arrays for the Similar-circles + Founding-voices steps) **stay**. Slice 5 doesn't change the wizard's discovery surface — it only wires the final publish action. The inline comment about story #9 + Slice 3 (mock-data retention) is preserved.
- [ ] No mock community names ship into the published event. The `community` payload built in the Review step's handler is constructed from the wizard's local state — `name`, `description`, `selectedTags`, `seedMembers` — never read from `mockData.communities`.

### Regression

- [ ] All 132 pre-existing tests pass. Slice 5 adds a new suite; no existing tests should flip.
- [ ] `cd ui-communities && npm run build && npm run lint` — clean.
- [ ] The dev-mode visual review still works: `cd ui-communities && npm run dev` → `/create` → step through the wizard → click Create → console shows two `[publish/mock]` log lines + the page navigates to `/community/<derived-slug>`.

## Concepts touched

- `brainstorm-community` (kind 39998 concept-header, Slice 1) — the kind-39999 community-record validates against this schema.
- `brainstorm-communities` DList header — published as kind 39998 with the canonical `brainstorm-communities` d-tag. First time a viewer creates anything, this is the header that gets established.

No new concepts. No firmware reinstall.

## Out of scope

- **Founder mirror tooling.** PLAN.md §6 Q5.3 defers to v1.1. v1 uses the brainstorm.world-hosted relay set only.
- **Slug-uniqueness warning at Create time.** PLAN.md §6 Q4: no hard dedup. Two creators with the same slug coexist at the protocol level. UI warning is a future story.
- **Editing the slug independently of the name.** v1 auto-derives. If the user wants a different slug, they change the name. A separate "edit slug" field is a future enhancement.
- **Avatar / banner image upload for new communities.** The schema accepts an `image` URL but the v1 wizard doesn't collect one. The published event omits the `image` tag.
- **Real backend round-trip verification.** Stays at staging-smoke level: the event publishes to the relay; the API's `GET /api/communities` will surface it once Slice 2 NB-4 wires the data sources. Until then, the published event exists on the relay but doesn't round-trip to Discover.
- **Edit-screen publishing.** Slice 5 ships Create-publishing only. Editing an existing community's view (the `/edit/:slug` Save button) remains local-state-only per Slice 4's deferral.
- **NIP-05 verification at Create time.** Out of scope; not in the firmware schema.
- **Rate-limiting Create.** A user could create dozens of communities in a session; nostr's relay-side policies handle abuse if it materializes. Belt-and-suspenders client-side throttling is post-v1.
- **Optimistic-with-rollback for the community-record publish failure.** v1: on failure after the header succeeded, the wizard stays on Review with the error. The header is on the network; the user can retry the record publish. We don't "unpublish" the header (you can't on nostr) and we don't try to roll back the joinedSet because the navigation hasn't happened yet.

## Open questions

Resolved at intake:

- **Two events: serial or parallel?** Serial — header first, then record. A header failure cancels the record publish; a record failure leaves the header on the network (idempotent, harmless). Parallel would publish both even if the header fails, which we don't want for v1.
- **Slug normalization rule.** `name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')`. Standard slugify. Examples documented above.
- **Where to put the slugify helper.** `src/lib/slug.js` — small, pure, importable from the wizard + future Edit story. Co-locates with the existing `src/lib/format.js` + `src/lib/glossary.js`.
- **What happens after success — navigate to detail or back to Discover?** Detail (`/community/<slug>`). The user just created this circle; they should land in it.
- **Sign-in inline or redirect to Header?** Inline — the wizard's state shouldn't get lost to a route change. Re-uses the same `onSignIn` callback the Header uses.

## Linked artifacts

- ADR: [`engineering-team/decisions/0009-create-flow-publishes.md`](../decisions/0009-create-flow-publishes.md)
- Test plan: `engineering-team/stories/11-create-flow-publishes.test-plan.md` (filled in by Tester)
- Review: `engineering-team/reviews/11-create-flow-publishes.md` (filled in by Reviewer)
