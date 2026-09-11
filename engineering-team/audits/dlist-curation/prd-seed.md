# PRD Seed: DList Curation — empower your assistant to curate community lists

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/dlist-curation/audit.md`
**Anchor:** acceptance frame in `book.md` (confirmed by the operator at kickoff, 2026-09-10)
**Confidence:** medium — the as-built is high-confidence, and the frame came from a long design conversation with the operator, but the product framing below is inferred from one operator's intent (Bob on Alice's instance preparing his own firmware) and has never been tested with a second user or a real signer
**Date:** 2026-09-10

> A reverse-engineered baseline in the product-team PRD shape. A strawman for `/discover`, not a ratified spec. Sections tagged `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A user can **empower their instance's Tapestry Assistant to curate a community DList on their behalf**. The assistant authors its own header for that list — inheriting the community's items, never duplicating them — and the user's Treasure Map is the user-signed record that the empowerment was granted. The assistant's header and (later) its items are the **scaffold from which a separate Tapestry instance can build a concept** — the stated case is Bob using Alice's instance to community-curate firmware before launching his own.

`[INFERRED]` What this implies: a **personal curation layer over community lists** that is (a) permissionless — anyone's assistant may curate any community list, (b) composable — curated lists inherit rather than copy, so community lists are never spammed with duplicates, (c) legible — the Map says who is empowered for what, the header says how the list composes, and (d) portable — the artefacts are signed events on relays, not rows in one instance's database.

`[UNKNOWN — product input needed]` Whether "curation" is primarily a **staging area for one's own future instance** (the stated case) or a **standing personal view** people keep on an instance they never leave. The two want different affordances later (export/import vs. day-to-day editing).

## 2. Personas

`[FROM FRAME]` / `[INFERRED]` from the stories' "As a…" lines:

- **The Map owner opting in** — signed in, reads the folded Trusted Lists line, decides whether to let the local instance publish their pubkey Trusted Lists after being told *why* (Vespa search on brainstorm.world consumes them). Served by story 1.
- **The curator-to-be (Bob)** — a customer on someone else's instance who wants his assistant to curate community lists so that, on his own instance later, those headers and items become firmware. Served by stories 2–6.
- **The hosting operator (Alice)** — runs the instance, signs nothing for Bob, and whose graph must never be written by Bob's curation; treated the same as any user when curating on her own instance in v1. Served by the no-graph-write rule (story 4).
- **The external reader** — a federating instance or client resolving a user's headers from their Map. Served by the ratified conventions (stories 2, 3) and by Map Entries' verification (story 6).

`[UNKNOWN]` Whether the **community list's curator** (the author of the shared concept) is a persona with any stake — e.g. wants to see who inherits their list. Nothing in the book serves them.

## 3. Scope (as-built)

`[FROM FRAME]` All nine acceptance-frame bullets shipped: the Trusted Lists prompt copy and folded three-state panel; the per-DList Map convention; the `inherit-items` facet; the assistant-authored header (endpoint); the DList Curation panel (search, add, revoke); Map Entries' class, link, pointer, and warnings; "nothing else moves"; and the merge-preserve fix the operator chose to include.

`[INFERRED]` Also shipped without being asked for by name: honest per-relay publish reporting from the server; the "Replace" path for an entry naming another assistant; the two-step add with an exact-event preview; verification of the assistant's header from Map Entries (local then the hinted relay); the DList detail route resolving kind-39999 coordinates; refusal to regenerate a Map blind on a lookup error.

**Explicitly out of scope as shipped:** the curation feature itself (the assistant adding, removing, or ranking items under its header); a `pointer` `b` for declared affiliation; kind-39999 community headers in the add flow; deleting or re-pointing headers; item removal/replacement in `inherit-items` (W6); the deployment's derivation and any resolver for the facet; persistence of any panel's open state; editing entries from Map Entries; the legacy pages' UI.

## 4. Domain model

`[FROM FRAME]` / `[INFERRED]`

- **Treasure Map** (kind 10040, user-signed, replaceable) — a map of triples. Entry families it now carries: `30382:<metric>` (Trust Assertions, the generator's), `30392` (Trusted Lists delegation), `<kind>:<d-tag>` for kind 39998/39999 (**per-DList curation entries**, this book), `39998:dlist-header` (the blanket designation, reserved). First-occurrence-wins for duplicates; replace-in-place writers; regeneration preserves every family it does not own.
- **Assistant curation header** (kind 39998, assistant-signed, `d` = the community list's d-tag) — addressed by reconstruction from a Map entry; carries `["b", <community header>, "inherit-items"]`; names/slug/json copied at creation; never silently re-pointed.
- **Community shared concept** (kind 39998, self-declared by a `b` to its own coordinate, fetched from the community relay) — the only things the panel offers; own and assistant-authored ones excluded.
- **`b` type registry** — `pointer` · `inherit` (definition fields) · `inherit-items` (items); unknown types read as `pointer`. Derived relationships `REFERENCES {source:'b-tag'}` · `INHERITS_FROM` · `INHERITS_ITEMS_FROM` (the last a target; not derived yet).
- **Resolved item set** — union over the items-deference closure; a candidate set the observer trust-filters per item; no subtraction in v1.
- **Two statements, two signers** — the Map (user) says *empowered*; the header (assistant) says *how it composes*. Revocation removes the Map entry; the header stays.
- **Relay groups** — `aDListRelays` (the hint and the send targets), the NIP-85 home relay + Trusted-Assertion + general-purpose groups (the current-Map lookup). The router's `dcosl` stream exists but was disabled on the dev instance.

`[UNKNOWN]` The Treasure Map still has **no concept-graph handle** (also noted by the previous Treasure Map book): the product's central object is invisible to the concept graph.

## 5. Design rules (as-built)

`[INFERRED]`, several now written for the first time:

- **Fold to a status line.** Every panel on the page is collapsed on load behind a real disclosure control whose line carries a verdict ("✅ Your Tapestry Assistant", "3 DLists curated"); the body is what you can *do* about it.
- **Header before Map.** Never let the Map point at a header that does not exist; the server authors first, the user signs second; a cancelled signature is harmless.
- **Never silently re-point; never regenerate blind; never a blanket success.** Conflicts return the existing pointer verbatim; a lookup error refuses; every relay gets its own verdict.
- **Authorization is read from the Map; composition from the header.**
- **The hosting instance's graph is the host's.** Another user's letters live in the relay, never in the host's Neo4j, whatever the owner's own headers do later.
- **Explain, don't assume.** The prompt says why 30392 matters; the panel says what empowerment means; warnings name where they looked.
- **Exclusion by construction.** You cannot curate your own or your assistant's headers; the search never shows them.

`[UNKNOWN]` No style guide governs the wording, colours, or the disclosure idiom (six hand-rolled copies now exist). The two-step add vs one-click was decided at a gate, not by a rule.

## 6. Carry-forward & open questions

Promoted from audit §6 — the strongest candidates for the next phase:

- **The curation feature itself** — what Bob's assistant actually does with the header: add items (as the assistant, under its header), rank, remove (needs W6's removal algebra), and whether to add a `pointer` `b` so the curated items become discoverable in the community cloud.
- **Bob's firmware-from-scaffold flow** — how a *new* instance imports a user's assistant headers and items as firmware (the stated purpose); nothing in this book builds the receiving side.
- **When the owner's own instance ingests the owner's curation headers** (v1 treats the owner like any user).
- **The count/duplicate consistency** and the **shared disclosure/lookup primitive** — small engineering follow-ups (ledger rows 248–249).
- **Kind-39999-declared headers** — the endpoint refuses them; precedence undefined.
- **Ownership by prefix on Map regeneration** — a hand-split of metrics across providers is lost.

## 7. What product must validate

- [ ] Is curation a **staging area for a future instance** or a **standing personal view** (§1)?
- [ ] Should a curated list be **discoverable in the community cloud** (add the `pointer` `b`) or stay private to the assistant's header until the user says otherwise?
- [ ] Does the community list's **author** get any view of who inherits from their list?
- [ ] The **two-step add** (preview then sign) — keep, or one click once trust in the flow is established?
- [ ] Is "**N DLists curated**" counting the right thing (every entry, or effective entries only)?
- [ ] On regeneration, is **ownership by the `30382:` prefix** the right rule, or should rows that name a *different* provider be preserved?
- [ ] Whether **kind-39999-declared headers** need support before the DList NIP settles them.
- [ ] Whether the Treasure Map should become a **concept** with a handle (carried over from the previous book, still unanswered).
