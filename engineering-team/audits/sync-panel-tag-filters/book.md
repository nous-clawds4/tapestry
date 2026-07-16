# Book: sync-panel-tag-filters

**Status:** Open
**Opened:** 2026-07-15 (retroactive backfill at review time — the eager intake open was missed; OPEN.md #29)
**Type:** Bounded ask (no PRD)
**Epics:** `relay-management` (new; sole story so far)

**Intent anchor:** the operator's 2026-07-15 ask, restated and confirmed at Phase-1 planning. Anchor provenance: **acceptance-frame (backfilled same-day from the verbatim ask and the approved story)**; confidence: **high** (single session, ask → story → ship traceable end to end).

## Acceptance frame (the ask, restated and confirmed 2026-07-15)

On the Negentropy Sync panel (`/tapestry/settings/relays`, Sync tab), alongside the existing Relay / Direction / Event Kinds / Authors / Time Range panels:

1. **A new panel to add one or more single-character tag filters** to the sync filter — e.g. `"#x": ["foo1","foo2"]` and `"#y": ["bar"]` — added one at a time, each entry being (a) the single character and (b) one or more strings.
2. **Format validation for `p`, `e`, `a` values** at entry (64-hex for p/e; `kind:pubkey:identifier` for a); other letters take arbitrary strings (no check exists to run).
3. The built command in **Command Preview reflects the tag filters**, and (established during planning as the ask's necessary completion) the **executed sync/count must honor them end-to-end** — the server previously dropped unknown filter keys silently.

Approved defaults folded in at the story gate: uppercase `P`/`E`/`A` validated like lowercase; duplicate-letter adds merge + dedupe; bech32 (`npub`/`nprofile`/`note`/`nevent`/`naddr`) accepted and normalized to hex/coordinate.

**Done looks like:** the single story (`stories/relay-management/1-sync-panel-tag-filters.md`) passes review and ships to staging; an operator can compose and run a tag-scoped sync (e.g. the tags-federation `{"kinds":[39999],"#z":[<canonical>]}` sync) entirely from the UI.

## Close

_(open — story 1 is Done and PASS-reviewed on `feat/sync-panel-tag-filters`; close pends the operator's ratification and the staging ship)_
