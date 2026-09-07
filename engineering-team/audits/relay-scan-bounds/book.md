# Book of Work: Relay scan bounds

**Slug:** relay-scan-bounds
**Status:** Open
**Opened:** 2026-09-07
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff.

The reported symptom: `https://staging.brainstorm.world/tapestry/lists` and
`https://tags.brainstorm.world/tapestry/lists` render
`Error: stdout maxBuffer length exceeded` instead of content;
`tapestry.brainstorm.world` and `localhost:7778` do not.

### Acceptance frame

- [ ] The Simple Lists pages (List Headers and List Items) load and show their content on
      **every** deployment — including staging and tags, which hold ~450,000 list items.
- [ ] The Items count shown per list is the true count, at any scale.
- [ ] Where a page cannot show everything, it says so on screen — a bounded set with its
      total stated, never a silently truncated one.
- [ ] The shared relay-scan path can no longer be tripped into a buffer failure by an
      unbounded request, so the deployments that work today (prod, local — both within
      ~1,700 items of the same ceiling) do not fail here later.
- [ ] Deployments holding few list items show what they show today; nothing regresses.

## Epics in this book
- `relay-scan-bounds` — bound the relay-scan path and the surfaces that read it unboundedly.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** (set at close)

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/relay-scan-bounds/audit.md`
- Product feedback: `engineering-team/audits/relay-scan-bounds/prd-seed.md`
