# Book: sync-panel-tag-filters

**Status:** Closed (2026-07-15)
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

Sole story Done (PASS first review, no kick-backs); shipped to `staging` via PR #355 (merge `08d0b5c0`, deploy 92s, CI `stack-free` green). Every acceptance-frame bullet verified live on staging 2026-07-15: panel present in the served bundle and rendered as owner; validation blocking with named-value errors; the executed count discriminates (`#z` real handle → 12, nonsense → 0, unfiltered kind-39999 → 400) — the server honors tag filters end-to-end. Operator ratified completion same day. Artifacts: [`audit.md`](./audit.md) + [`prd-seed.md`](./prd-seed.md) (retro dispositions in audit §7; follow-on Router Management feature triaged in `stories/_intake.md`). Confidence: **high**. Prod promotion deliberately held (OPEN.md #30).
