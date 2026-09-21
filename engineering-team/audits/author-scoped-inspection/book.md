# Book of Work: Author-scoped inspection on Active b-tags

**Slug:** author-scoped-inspection
**Status:** Closed
**Opened:** 2026-09-20
**Closed:** 2026-09-21

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask in session 2026-09-20, restated and confirmed at
kickoff. The ask began as a question — *"how exactly do we select which events get listed on this
page?"* — and the answer (only the owner's TA; everything else in the relay is hidden) was itself
the problem statement.

### Acceptance frame

- [x] **Active b-tags shows every b-tag event the local relay holds**, not only the ones the
      instance's own assistant signed — including events signed by assistants and people this
      instance does not control.
- [x] **Every row says who signed it.** With more than one author in the table, a row that does
      not name its author is not readable.
- [x] **A reader can narrow to one person** — the owner, themselves, or any customer of this
      instance — and see that person's events together with their assistant's.
- [x] **A reader can narrow by kind of author** — assistants this instance controls, the people
      who control them, or everyone else — independently of the person filter.
- [x] **The default view is the signed-in reader's own** (their events and their assistant's),
      falling back to the owner's when nobody is signed in.
- [x] **A row whose b-tag points at itself is visibly distinct** in the table, and says so in its
      detail panel.

## Epics in this book
- `author-scoped-inspection` — who signed what you are looking at, on the wire inspectors.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — the anchor was captured at intake before any code, and every frame bullet was verified against the running staging deployment, not against the tests.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/author-scoped-inspection/audit.md`
- Product feedback: `engineering-team/audits/author-scoped-inspection/prd-seed.md`
