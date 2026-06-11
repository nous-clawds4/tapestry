# Book: protocols-directory

**Status:** Closed (2026-06-10)
**Opened:** 2026-06-09 (de facto — see provenance)
**Type:** Bounded ask (no PRD)
**Epics:** `protocols-directory` (sole epic; stories 1–7)

> **Provenance note:** this manifest was created at close — the book predates the eager-`book.md` practice. Its intent anchor, however, was eager in substance: `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` was written and committed (`206f9850`, 2026-06-09) *before* story 1, and every story cites it as the design record. Anchor provenance: **acceptance-frame (eager)**; confidence: **high**.

## Acceptance frame (the ask, restated and confirmed at kickoff)

Create a dedicated home for protocol-related matters in the tapestry repo, and migrate the protocol content into it:

1. A `protocols/` directory at the repo root, with `nips/` (published Custom NIPs as working copies), `drafts/` (local pre-NIPs that may or may not ever publish), a status-tracked index (`README.md`), and a `worksheet.md` for open protocol problems.
2. A **boundary rule** separating protocol (signed events an independent implementation must parse/produce to interoperate) from BIBLE material (how our stack stores/computes/displays) — each wire format normative in exactly one place, with affected BIBLE sections rewritten as pointer + implementation detail.
3. Migration of the seven-spec map (handoff §4): Decentralized Lists (reconciled against the NostrHub-published version, ending ready-to-republish), its Cross-NIP companion, Tapestry Concepts, Class-Thread Tags, Inherit-From & Resolved Definition, Communities, and Tags & Taggings.
4. Content **copied** from the unmerged branches (`feat/communities`, `feat/pubkey-tagging-target`), never merged; deployment pubkeys never hardcoded into specs; open questions surfaced to the worksheet rather than silently resolved.

## Close

All seven stories Done (PASS); shipped to production through PRs #259–#274 (final: `main` @ `a3d2b06c`). Artifacts: `audit.md` + `prd-seed.md` in this folder.
